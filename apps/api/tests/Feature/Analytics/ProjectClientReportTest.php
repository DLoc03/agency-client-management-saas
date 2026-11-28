<?php

namespace Tests\Feature\Analytics;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * BE-012 project and client reports (docs/ANALYTICS_CONTRACT.md
 * sections 3.3 and 3.4): row shape, ordering, reused ProjectResource
 * computations, permissions and tenant isolation.
 */
class ProjectClientReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->travelTo(Carbon::parse('2026-11-28 12:00:00', 'UTC'));
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function invoice(User $owner, Client $client, array $attrs): Invoice
    {
        return Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $client->id,
        ], $attrs));
    }

    private function pay(Invoice $invoice, float $amount, string $paidOn = '2026-11-10'): Payment
    {
        return Payment::factory()->create([
            'agency_id' => $invoice->agency_id,
            'invoice_id' => $invoice->id,
            'amount' => $amount,
            'paid_on' => $paidOn,
        ]);
    }

    public function test_projects_report_rows_ordering_and_figures(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $overdue = Project::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'status' => Project::STATUS_IN_PROGRESS, 'due_date' => '2026-11-01', 'budget' => 1000,
        ]);
        foreach ([Task::STATUS_DONE, Task::STATUS_DONE, Task::STATUS_TODO, Task::STATUS_TODO] as $status) {
            Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $overdue->id, 'status' => $status]);
        }
        $sent = $this->invoice($owner, $client, ['project_id' => $overdue->id, 'status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 800]);
        $this->pay($sent, 300);

        $later = Project::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'status' => Project::STATUS_COMPLETED, 'due_date' => '2026-12-01', 'budget' => null,
        ]);
        $noDueDate = Project::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'status' => Project::STATUS_DRAFT, 'due_date' => null,
        ]);
        Project::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'status' => Project::STATUS_CANCELLED, 'due_date' => '2026-10-01',
        ]);

        $response = $this->as($owner)->getJson('/api/v1/reports/projects')->assertOk();
        $rows = $response->json('data');
        $this->assertCount(3, $rows);
        $this->assertSame([$overdue->id, $later->id, $noDueDate->id], array_column($rows, 'id'));
        $response->assertJsonPath('meta.total', 3);

        $row = $rows[0];
        $this->assertSame($client->id, $row['client']['id']);
        $this->assertSame(50, $row['progress_percent']);
        $this->assertSame('2026-11-01', $row['due_date']);
        $this->assertTrue($row['is_overdue']);
        $this->assertSame('1000.00', $row['budget']);
        $this->assertSame('800.00', $row['invoiced_total']);
        $this->assertSame('300.00', $row['collected_total']);
        $this->assertSame('200.00', $row['remaining_budget']);

        $this->assertFalse($rows[1]['is_overdue']);
        $this->assertNull($rows[1]['budget']);
        $this->assertNull($rows[1]['remaining_budget']);
        $this->assertNull($rows[2]['due_date']);

        // Pagination envelope behaves like the other list endpoints.
        $page = $this->as($owner)->getJson('/api/v1/reports/projects?per_page=2&page=2')->assertOk();
        $this->assertCount(1, $page->json('data'));
        $page->assertJsonPath('meta.current_page', 2);
    }

    public function test_clients_report_aggregates_and_ordering(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $rich = Client::factory()->create(['agency_id' => $owner->agency_id, 'status' => Client::STATUS_ACTIVE]);
        $quiet = Client::factory()->create(['agency_id' => $owner->agency_id, 'status' => Client::STATUS_PAUSED]);

        Project::factory()->count(2)->create(['agency_id' => $owner->agency_id, 'client_id' => $rich->id]);
        $sent = $this->invoice($owner, $rich, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 800]);
        $this->pay($sent, 300);
        $paid = $this->invoice($owner, $rich, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-10-05', 'total' => 200]);
        $this->pay($paid, 200, '2026-10-06');
        $this->invoice($owner, $rich, ['status' => Invoice::STATUS_CANCELLED, 'issue_date' => '2026-11-01', 'total' => 999]);

        $open = $this->invoice($owner, $quiet, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 100]);

        $response = $this->as($owner)->getJson('/api/v1/reports/clients')->assertOk();
        $rows = $response->json('data');
        $this->assertCount(2, $rows);
        // Ordered by collected_total descending.
        $this->assertSame($rich->id, $rows[0]['id']);
        $this->assertSame(2, $rows[0]['projects_count']);
        $this->assertSame('1000.00', $rows[0]['invoiced_total']);
        $this->assertSame('500.00', $rows[0]['collected_total']);
        $this->assertSame('500.00', $rows[0]['outstanding']);
        $this->assertSame($quiet->id, $rows[1]['id']);
        $this->assertSame('paused', $rows[1]['status']);
        $this->assertSame('100.00', $rows[1]['outstanding']);
        $this->assertSame('0.00', $rows[1]['collected_total']);
    }

    public function test_reports_require_their_permissions(): void
    {
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER]);
        // Team Member holds projects.view but no clients.view.
        $this->as($member)->getJson('/api/v1/reports/projects')->assertOk();
        $this->as($member)->getJson('/api/v1/reports/clients')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $noAccess = $this->makeMembershipUser([]);
        $this->as($noAccess)->getJson('/api/v1/reports/projects')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->as($noAccess)->getJson('/api/v1/reports/clients')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_reports_do_not_leak_other_agencies(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $other = $this->makeMembershipUser([Role::OWNER]);
        $foreignClient = Client::factory()->create(['agency_id' => $other->agency_id]);
        Project::factory()->create(['agency_id' => $other->agency_id, 'client_id' => $foreignClient->id]);
        $this->invoice($other, $foreignClient, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 5000]);

        $this->as($owner)->getJson('/api/v1/reports/projects')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
        $this->as($owner)->getJson('/api/v1/reports/clients')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
    }
}
