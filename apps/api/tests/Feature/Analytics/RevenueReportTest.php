<?php

namespace Tests\Feature\Analytics;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * BE-012 revenue report + CSV export (docs/ANALYTICS_CONTRACT.md
 * sections 3.2 and 3.5): defaults, zero-filled months, the section
 * 2 definitions, range validation, 403 and tenant isolation.
 */
class RevenueReportTest extends TestCase
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

    private function invoice(User $owner, array $attrs): Invoice
    {
        return Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $owner->agency_id])->id,
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

    /** Seeds the figures shared by the JSON and CSV assertions. */
    private function seedFigures(User $owner): void
    {
        $sent = $this->invoice($owner, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 1000]);
        $this->pay($sent, 400, '2026-11-10');
        $paid = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-09-05', 'total' => 500]);
        $this->pay($paid, 500, '2026-09-06');
        // Draft counts toward invoiced (contract section 7);
        // cancelled never does.
        $this->invoice($owner, ['status' => Invoice::STATUS_DRAFT, 'issue_date' => '2026-11-15', 'total' => 200]);
        $this->invoice($owner, ['status' => Invoice::STATUS_CANCELLED, 'issue_date' => '2026-11-01', 'total' => 999]);
    }

    public function test_revenue_report_defaults_to_the_six_month_window(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $this->seedFigures($owner);

        $response = $this->as($owner)->getJson('/api/v1/reports/revenue')->assertOk();
        $response->assertJsonPath('data.from', '2026-06-01');
        $response->assertJsonPath('data.to', '2026-11-28');
        $response->assertJsonPath('data.totals.invoiced', '1700.00');
        $response->assertJsonPath('data.totals.collected', '900.00');
        $response->assertJsonPath('data.outstanding_total', '600.00');

        $months = $response->json('data.months');
        $this->assertCount(6, $months);
        $this->assertSame(['month' => '2026-06', 'invoiced' => '0.00', 'collected' => '0.00'], $months[0]);
        $this->assertSame(['month' => '2026-09', 'invoiced' => '500.00', 'collected' => '500.00'], $months[3]);
        $this->assertSame(['month' => '2026-11', 'invoiced' => '1200.00', 'collected' => '400.00'], $months[5]);
    }

    public function test_revenue_report_default_window_does_not_overflow_on_the_31st(): void
    {
        // QA-009 B1 probe: at 2026-07-31 the unanchored
        // subMonths(5) landed in March, shrinking the default
        // window to 5 months starting 2026-03-01.
        $this->travelTo(Carbon::parse('2026-07-31 12:00:00', 'UTC'));
        $owner = $this->makeMembershipUser([Role::OWNER]);

        $response = $this->as($owner)->getJson('/api/v1/reports/revenue')->assertOk();
        $response->assertJsonPath('data.from', '2026-02-01');
        $response->assertJsonPath('data.to', '2026-07-31');

        $months = $response->json('data.months');
        $this->assertCount(6, $months);
        $this->assertSame('2026-02', $months[0]['month']);
        $this->assertSame('2026-07', $months[5]['month']);
    }

    public function test_revenue_report_custom_range_limits_and_zero_fills_months(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $invoice = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-02-10', 'total' => 300]);
        $this->pay($invoice, 300, '2026-02-15');
        // Paid before the range start: outside the report entirely.
        $early = $this->invoice($owner, ['status' => Invoice::STATUS_PAID, 'issue_date' => '2026-01-05', 'total' => 700]);
        $this->pay($early, 700, '2026-01-05');

        $response = $this->as($owner)
            ->getJson('/api/v1/reports/revenue?from=2026-01-10&to=2026-03-31')
            ->assertOk();
        $response->assertJsonPath('data.from', '2026-01-10');
        $response->assertJsonPath('data.to', '2026-03-31');
        $response->assertJsonPath('data.totals.invoiced', '300.00');
        $response->assertJsonPath('data.totals.collected', '300.00');

        $months = $response->json('data.months');
        $this->assertSame(['2026-01', '2026-02', '2026-03'], array_column($months, 'month'));
        $this->assertSame(['month' => '2026-01', 'invoiced' => '0.00', 'collected' => '0.00'], $months[0]);
        $this->assertSame(['month' => '2026-02', 'invoiced' => '300.00', 'collected' => '300.00'], $months[1]);
    }

    public function test_revenue_report_range_validation(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);

        $this->as($owner)->getJson('/api/v1/reports/revenue?from=2026-12-01&to=2026-01-01')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->as($owner)->getJson('/api/v1/reports/revenue?from=2024-01-01&to=2026-06-01')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->as($owner)->getJson('/api/v1/reports/revenue?from=not-a-date')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        // Exactly 24 months is still allowed.
        $response = $this->as($owner)->getJson('/api/v1/reports/revenue?from=2024-01-01&to=2025-12-31')->assertOk();
        $this->assertCount(24, $response->json('data.months'));
    }

    public function test_revenue_export_returns_the_same_figures_as_csv(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $this->seedFigures($owner);

        $response = $this->as($owner)->get('/api/v1/reports/revenue/export')->assertOk();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString(
            'attachment; filename="revenue-2026-06-01-to-2026-11-28.csv"',
            $response->headers->get('Content-Disposition'),
        );

        $expected = implode("\n", [
            'month,invoiced,collected',
            '2026-06,0.00,0.00',
            '2026-07,0.00,0.00',
            '2026-08,0.00,0.00',
            '2026-09,500.00,500.00',
            '2026-10,0.00,0.00',
            '2026-11,1200.00,400.00',
            'total,1700.00,900.00',
        ])."\n";
        $this->assertSame($expected, $response->getContent());
    }

    public function test_revenue_endpoints_require_invoices_view(): void
    {
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER]);

        $this->as($member)->getJson('/api/v1/reports/revenue')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->as($member)->get('/api/v1/reports/revenue/export')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_figures_never_leak_across_tenants(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $other = $this->makeMembershipUser([Role::OWNER]);

        // The other agency has figures everywhere; ours has none.
        Lead::factory()->create(['agency_id' => $other->agency_id, 'created_at' => '2026-11-05 09:00:00']);
        Project::factory()->create(['agency_id' => $other->agency_id, 'status' => Project::STATUS_IN_PROGRESS]);
        $foreign = $this->invoice($other, ['status' => Invoice::STATUS_SENT, 'issue_date' => '2026-11-03', 'total' => 5000]);
        $this->pay($foreign, 2000, '2026-11-10');

        $overview = $this->as($owner)->getJson('/api/v1/analytics/overview')->assertOk();
        $overview->assertJsonPath('data.sales.new_leads_this_month', 0);
        $overview->assertJsonPath('data.projects.projects_by_status.in_progress', 0);
        $overview->assertJsonPath('data.finance.collected_this_month', '0.00');
        $overview->assertJsonPath('data.finance.outstanding_total', '0.00');

        $report = $this->as($owner)->getJson('/api/v1/reports/revenue')->assertOk();
        $report->assertJsonPath('data.totals.invoiced', '0.00');
        $report->assertJsonPath('data.totals.collected', '0.00');
        $report->assertJsonPath('data.outstanding_total', '0.00');
    }
}
