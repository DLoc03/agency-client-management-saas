<?php

namespace Tests\Feature\Analytics;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lead;
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
 * BE-012 overview aggregate (docs/ANALYTICS_CONTRACT.md section
 * 3.1): sectioned payload, permission-based omission, the
 * personal-only fallback, deltas and agency-timezone boundaries.
 */
class OverviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    /** A membership whose roles resolve to exactly the given permission set. */
    private function userWithPermissions(array $permissions, ?int $agencyId = null): User
    {
        $key = 'analytics_'.md5(implode(',', $permissions));
        config(["rbac.roles.{$key}" => $permissions]);
        Role::firstOrCreate(['key' => $key], ['name' => 'Analytics fixture']);

        return $this->makeMembershipUser([$key], $agencyId);
    }

    private function invoice(User $owner, array $attrs): Invoice
    {
        // The throwaway client is churned so invoice fixtures never
        // distort the active-clients figure asserted in the tests.
        return Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $owner->agency_id, 'status' => Client::STATUS_CHURNED])->id,
        ], $attrs));
    }

    private function pay(Invoice $invoice, float $amount, string $paidOn): Payment
    {
        return Payment::factory()->create([
            'agency_id' => $invoice->agency_id,
            'invoice_id' => $invoice->id,
            'amount' => $amount,
            'paid_on' => $paidOn,
        ]);
    }

    public function test_owner_sees_all_sections_with_correct_figures(): void
    {
        $this->travelTo(Carbon::parse('2026-11-28 12:00:00', 'UTC'));
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;

        // Sales: 2 leads this month, 1 last month; stages across all leads.
        Lead::factory()->create(['agency_id' => $agencyId, 'status' => Lead::STATUS_NEW, 'created_at' => '2026-11-05 09:00:00']);
        Lead::factory()->create(['agency_id' => $agencyId, 'status' => Lead::STATUS_CONTACTED, 'created_at' => '2026-11-20 09:00:00']);
        Lead::factory()->create(['agency_id' => $agencyId, 'status' => Lead::STATUS_QUALIFIED, 'created_at' => '2026-10-10 09:00:00']);
        Client::factory()->count(2)->create(['agency_id' => $agencyId, 'status' => Client::STATUS_ACTIVE]);
        Client::factory()->create(['agency_id' => $agencyId, 'status' => Client::STATUS_PAUSED]);

        // Projects: one per status bucket plus an overdue task.
        $active = Project::factory()->create(['agency_id' => $agencyId, 'status' => Project::STATUS_IN_PROGRESS, 'due_date' => '2026-11-01']);
        Project::factory()->create(['agency_id' => $agencyId, 'status' => Project::STATUS_DRAFT, 'due_date' => null]);
        Project::factory()->create(['agency_id' => $agencyId, 'status' => Project::STATUS_COMPLETED, 'due_date' => '2026-10-01']);
        Task::factory()->create(['agency_id' => $agencyId, 'project_id' => $active->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-11-01']);
        Task::factory()->create(['agency_id' => $agencyId, 'project_id' => $active->id, 'status' => Task::STATUS_DONE, 'due_date' => '2026-11-01']);

        // Finance: collected 400 this month / 500 last month; a draft
        // counts toward invoiced, a cancelled invoice does not.
        $sent = $this->invoice($owner, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 1000]);
        $this->pay($sent, 400, '2026-11-10');
        $paid = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-10-05', 'total' => 500]);
        $this->pay($paid, 500, '2026-10-06');
        $this->invoice($owner, ['status' => Invoice::STATUS_DRAFT, 'issue_date' => '2026-11-15', 'total' => 200]);
        $this->invoice($owner, ['status' => Invoice::STATUS_CANCELLED, 'issue_date' => '2026-11-01', 'total' => 999]);

        $response = $this->as($owner)->getJson('/api/v1/analytics/overview')->assertOk();

        $response->assertJsonPath('data.sales.new_leads_this_month', 2);
        $response->assertJsonPath('data.sales.new_leads_last_month', 1);
        $this->assertEquals(100.0, $response->json('data.sales.new_leads_delta_percent'));
        $response->assertJsonPath('data.sales.active_clients', 2);
        $response->assertJsonPath('data.sales.leads_by_stage.new', 1);
        $response->assertJsonPath('data.sales.leads_by_stage.contacted', 1);
        $response->assertJsonPath('data.sales.leads_by_stage.qualified', 1);
        $response->assertJsonPath('data.sales.leads_by_stage.unqualified', 0);

        $response->assertJsonPath('data.projects.scope', 'agency');
        $response->assertJsonPath('data.projects.projects_by_status.draft', 1);
        $response->assertJsonPath('data.projects.projects_by_status.in_progress', 1);
        $response->assertJsonPath('data.projects.projects_by_status.completed', 1);
        $response->assertJsonPath('data.projects.projects_by_status.on_hold', 0);
        $response->assertJsonPath('data.projects.overdue_tasks', 1);
        $response->assertJsonPath('data.projects.overdue_projects', 1);

        $response->assertJsonPath('data.finance.collected_this_month', '400.00');
        $response->assertJsonPath('data.finance.collected_last_month', '500.00');
        $this->assertEquals(-20.0, $response->json('data.finance.collected_delta_percent'));
        $response->assertJsonPath('data.finance.invoiced_this_month', '1200.00');
        $response->assertJsonPath('data.finance.outstanding_total', '600.00');

        $series = $response->json('data.finance.monthly_series');
        $this->assertCount(6, $series);
        $this->assertSame('2026-06', $series[0]['month']);
        $this->assertSame(['month' => '2026-06', 'invoiced' => '0.00', 'collected' => '0.00'], $series[0]);
        $this->assertSame(['month' => '2026-10', 'invoiced' => '500.00', 'collected' => '500.00'], $series[4]);
        $this->assertSame(['month' => '2026-11', 'invoiced' => '1200.00', 'collected' => '400.00'], $series[5]);

        $this->assertArrayNotHasKey('personal', $response->json('data'));
    }

    public function test_sections_are_omitted_without_the_matching_permission(): void
    {
        $agencyId = Agency::factory()->create()->id;

        $financeOnly = $this->userWithPermissions(['invoices.view'], $agencyId);
        $data = $this->as($financeOnly)->getJson('/api/v1/analytics/overview')->assertOk()->json('data');
        $this->assertSame(['finance'], array_keys($data));

        $salesOnly = $this->userWithPermissions(['leads.view'], $agencyId);
        $data = $this->as($salesOnly)->getJson('/api/v1/analytics/overview')->assertOk()->json('data');
        $this->assertSame(['sales'], array_keys($data));

        $projectsOnly = $this->userWithPermissions(['projects.view'], $agencyId);
        $data = $this->as($projectsOnly)->getJson('/api/v1/analytics/overview')->assertOk()->json('data');
        $this->assertSame(['projects'], array_keys($data));
        $this->assertSame('agency', $data['projects']['scope']);

        // The stock Team Member holds projects.view (DEC-016) and no
        // leads/invoices permission, so it receives exactly the
        // projects section under the contract section 4 mapping —
        // scoped to its own member projects (DEC-029 supplement).
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $agencyId);
        $data = $this->as($member)->getJson('/api/v1/analytics/overview')->assertOk()->json('data');
        $this->assertSame(['projects'], array_keys($data));
        $this->assertSame('mine', $data['projects']['scope']);
    }

    public function test_team_member_projects_section_counts_member_projects_only(): void
    {
        $this->travelTo(Carbon::parse('2026-11-28 12:00:00', 'UTC'));
        $agencyId = Agency::factory()->create()->id;
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $agencyId);

        // Project A: the member belongs to it. In progress, overdue,
        // with one overdue open task and one done task.
        $own = Project::factory()->create(['agency_id' => $agencyId, 'status' => Project::STATUS_IN_PROGRESS, 'due_date' => '2026-11-01']);
        $own->members()->attach($member->id);
        Task::factory()->create(['agency_id' => $agencyId, 'project_id' => $own->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-11-01']);
        Task::factory()->create(['agency_id' => $agencyId, 'project_id' => $own->id, 'status' => Task::STATUS_DONE, 'due_date' => '2026-11-01']);

        // Project B: the member does NOT belong to it. Also overdue,
        // with an overdue open task that is even assigned to the
        // member — membership, not assignment, is the scope basis.
        $other = Project::factory()->create(['agency_id' => $agencyId, 'status' => Project::STATUS_DRAFT, 'due_date' => '2026-11-01']);
        Task::factory()->create(['agency_id' => $agencyId, 'project_id' => $other->id, 'assignee_id' => $member->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-11-01']);

        $response = $this->as($member)->getJson('/api/v1/analytics/overview')->assertOk();
        $this->assertSame(['projects'], array_keys($response->json('data')));
        $response->assertJsonPath('data.projects.scope', 'mine');
        $response->assertJsonPath('data.projects.projects_by_status.in_progress', 1);
        $response->assertJsonPath('data.projects.projects_by_status.draft', 0);
        $response->assertJsonPath('data.projects.overdue_tasks', 1);
        $response->assertJsonPath('data.projects.overdue_projects', 1);
    }

    public function test_personal_section_only_when_no_section_is_permitted(): void
    {
        $this->travelTo(Carbon::parse('2026-11-28 12:00:00', 'UTC'));
        $user = $this->userWithPermissions([]);
        $other = $this->makeMembershipUser([Role::OWNER], $user->agency_id);
        $project = Project::factory()->create(['agency_id' => $user->agency_id]);

        Task::factory()->create(['agency_id' => $user->agency_id, 'project_id' => $project->id, 'assignee_id' => $user->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-12-05']);
        Task::factory()->create(['agency_id' => $user->agency_id, 'project_id' => $project->id, 'assignee_id' => $user->id, 'status' => Task::STATUS_IN_PROGRESS, 'due_date' => '2026-11-01']);
        Task::factory()->create(['agency_id' => $user->agency_id, 'project_id' => $project->id, 'assignee_id' => $user->id, 'status' => Task::STATUS_DONE, 'due_date' => '2026-11-01']);
        Task::factory()->create(['agency_id' => $user->agency_id, 'project_id' => $project->id, 'assignee_id' => $other->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-11-01']);

        $response = $this->as($user)->getJson('/api/v1/analytics/overview')->assertOk();
        $this->assertSame(['personal'], array_keys($response->json('data')));
        $response->assertJsonPath('data.personal.my_open_tasks', 2);
        $response->assertJsonPath('data.personal.my_overdue_tasks', 1);
    }

    public function test_delta_is_null_when_previous_month_is_zero(): void
    {
        $this->travelTo(Carbon::parse('2026-11-28 12:00:00', 'UTC'));
        $owner = $this->makeMembershipUser([Role::OWNER]);

        Lead::factory()->create(['agency_id' => $owner->agency_id, 'created_at' => '2026-11-03 09:00:00']);
        $invoice = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-11-02', 'total' => 250]);
        $this->pay($invoice, 250, '2026-11-04');

        $response = $this->as($owner)->getJson('/api/v1/analytics/overview')->assertOk();
        $this->assertNull($response->json('data.sales.new_leads_delta_percent'));
        $this->assertNull($response->json('data.finance.collected_delta_percent'));
        $response->assertJsonPath('data.finance.collected_this_month', '250.00');
        $response->assertJsonPath('data.finance.collected_last_month', '0.00');
    }

    public function test_month_boundaries_follow_the_agency_timezone(): void
    {
        // 2026-11-30 20:30 UTC is already 2026-12-01 in Tokyo: the
        // agency's current month is December, not November.
        $this->travelTo(Carbon::parse('2026-11-30 20:30:00', 'UTC'));
        $agency = Agency::factory()->create(['timezone' => 'Asia/Tokyo']);
        $owner = $this->makeMembershipUser([Role::OWNER], $agency->id);

        $december = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-11-20', 'total' => 100]);
        $this->pay($december, 100, '2026-12-01');
        $november = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-11-20', 'total' => 50]);
        $this->pay($november, 50, '2026-11-30');

        // 16:00 UTC is Dec 1 in Tokyo; 14:00 UTC is still Nov 30.
        Lead::factory()->create(['agency_id' => $agency->id, 'created_at' => Carbon::parse('2026-11-30 16:00:00', 'UTC')]);
        Lead::factory()->create(['agency_id' => $agency->id, 'created_at' => Carbon::parse('2026-11-30 14:00:00', 'UTC')]);

        $project = Project::factory()->create(['agency_id' => $agency->id, 'status' => Project::STATUS_IN_PROGRESS]);
        Task::factory()->create(['agency_id' => $agency->id, 'project_id' => $project->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-11-30']);
        Task::factory()->create(['agency_id' => $agency->id, 'project_id' => $project->id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-12-01']);

        $response = $this->as($owner)->getJson('/api/v1/analytics/overview')->assertOk();
        $response->assertJsonPath('data.finance.collected_this_month', '100.00');
        $response->assertJsonPath('data.finance.collected_last_month', '50.00');
        $response->assertJsonPath('data.sales.new_leads_this_month', 1);
        $response->assertJsonPath('data.sales.new_leads_last_month', 1);
        $response->assertJsonPath('data.projects.overdue_tasks', 1);

        $series = $response->json('data.finance.monthly_series');
        $this->assertSame('2026-12', $series[5]['month']);
        $this->assertSame('2026-11', $series[4]['month']);
    }
}
