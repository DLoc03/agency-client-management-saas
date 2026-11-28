<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Client;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\RevenueReport;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * Group 8 overview aggregate (docs/ANALYTICS_CONTRACT.md section
 * 3.1, DEC-029): one sectioned payload for the dashboard. A section
 * the caller's membership may not see is omitted entirely; when no
 * section is permitted the caller receives only `personal` (their
 * own task counts), so the endpoint never 403s a signed-in staff
 * member. Section visibility follows permission; the projects
 * section's scope follows the caller's data scope (DEC-029
 * supplement). All figures are computed at read time under the
 * tenant scope — no caching (contract section 6.9).
 */
class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        $agency = Agency::find(Tenant::id());
        $timezone = $agency?->timezone ?: config('app.timezone');
        $now = Carbon::now($timezone);
        $today = $now->toDateString();

        $data = [];
        if ($user->hasPermission('leads.view')) {
            $data['sales'] = $this->salesSection($now);
        }
        if ($user->hasPermission('projects.view')) {
            $data['projects'] = $this->projectsSection($user, $today);
        }
        if ($user->hasPermission('invoices.view')) {
            $data['finance'] = $this->financeSection($now, $today);
        }
        if ($data === []) {
            $data['personal'] = $this->personalSection($user, $today);
        }

        return response()->json(['data' => $data]);
    }

    /** Month-over-month delta in percent, 1 decimal; null when the previous period is 0 (contract section 2). */
    private function delta(float $current, float $previous): ?float
    {
        return $previous == 0 ? null : round(($current - $previous) / $previous * 100, 1);
    }

    private function salesSection(Carbon $now): array
    {
        // created_at is a UTC timestamp: the agency-local month
        // boundaries are converted to UTC before comparing.
        $thisMonthStart = $now->copy()->startOfMonth()->utc();
        // Anchor to the 1st BEFORE shifting months: an unanchored
        // addMonth/subMonth on the 29th–31st overflows into the
        // wrong month (Carbon does not clamp), which corrupts both
        // boundaries (QA-009 B1).
        $nextMonthStart = $now->copy()->startOfMonth()->addMonth()->utc();
        $lastMonthStart = $now->copy()->startOfMonth()->subMonth()->utc();

        $newThisMonth = Lead::query()
            ->where('created_at', '>=', $thisMonthStart)
            ->where('created_at', '<', $nextMonthStart)
            ->count();
        $newLastMonth = Lead::query()
            ->where('created_at', '>=', $lastMonthStart)
            ->where('created_at', '<', $thisMonthStart)
            ->count();

        $byStage = Lead::query()
            ->selectRaw('status, COUNT(*) as stage_count')
            ->groupBy('status')
            ->pluck('stage_count', 'status');
        $leadsByStage = [];
        foreach (Lead::STATUSES as $stage) {
            $leadsByStage[$stage] = (int) ($byStage[$stage] ?? 0);
        }

        return [
            'new_leads_this_month' => $newThisMonth,
            'new_leads_last_month' => $newLastMonth,
            'new_leads_delta_percent' => $this->delta($newThisMonth, $newLastMonth),
            'active_clients' => Client::query()->where('status', Client::STATUS_ACTIVE)->count(),
            'leads_by_stage' => $leadsByStage,
        ];
    }

    private function projectsSection(User $user, string $today): array
    {
        // Scope follows the caller's data scope (DEC-029 supplement):
        // callers with unrestricted project visibility — the
        // Project::scopeVisibleTo basis — get agency-wide figures;
        // a Team-Member-only caller gets the same section computed
        // over the projects they are a member of only, so an overdue
        // task in a project they do not belong to is never counted.
        $unrestricted = Project::hasUnrestrictedVisibility($user);

        $projects = Project::query();
        $tasks = Task::query();
        if (! $unrestricted) {
            $memberOf = fn ($q) => $q->whereHas('members', fn ($m) => $m->where('users.id', $user->id));
            $projects->where($memberOf);
            $tasks->whereHas('project', $memberOf);
        }

        $byStatus = (clone $projects)
            ->selectRaw('status, COUNT(*) as status_count')
            ->groupBy('status')
            ->pluck('status_count', 'status');
        $projectsByStatus = [];
        foreach (Project::STATUSES as $status) {
            $projectsByStatus[$status] = (int) ($byStatus[$status] ?? 0);
        }

        return [
            'scope' => $unrestricted ? 'agency' : 'mine',
            'projects_by_status' => $projectsByStatus,
            'overdue_tasks' => $tasks
                ->where('status', '!=', Task::STATUS_DONE)
                ->where('due_date', '<', $today)
                ->count(),
            'overdue_projects' => $projects
                ->whereNotIn('status', [Project::STATUS_COMPLETED, Project::STATUS_CANCELLED])
                ->where('due_date', '<', $today)
                ->count(),
        ];
    }

    private function financeSection(Carbon $now, string $today): array
    {
        // The 6-month window ending today (contract section 3.1),
        // built by the same code path as the revenue report.
        // startOfMonth() first, for the same overflow reason as in
        // salesSection() (QA-009 B1): on the 31st an unanchored
        // subMonths(5) lands in the wrong month and the 6-month
        // window collapses to 5 entries.
        $windowStart = $now->copy()->startOfMonth()->subMonths(5)->toDateString();
        $report = RevenueReport::build($windowStart, $today);
        $series = $report['months'];
        $current = $series[5];
        $previous = $series[4];

        $collectedThisMonth = (float) $current['collected'];
        $collectedLastMonth = (float) $previous['collected'];

        return [
            'collected_this_month' => $current['collected'],
            'collected_last_month' => $previous['collected'],
            'collected_delta_percent' => $this->delta($collectedThisMonth, $collectedLastMonth),
            'invoiced_this_month' => $current['invoiced'],
            'outstanding_total' => $report['outstanding_total'],
            'monthly_series' => $series,
        ];
    }

    private function personalSection(User $user, string $today): array
    {
        $open = Task::query()
            ->where('assignee_id', $user->id)
            ->where('status', '!=', Task::STATUS_DONE);

        return [
            'my_open_tasks' => (clone $open)->count(),
            'my_overdue_tasks' => $open->where('due_date', '<', $today)->count(),
        ];
    }
}
