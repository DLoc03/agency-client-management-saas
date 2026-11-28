<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClientReportResource;
use App\Http\Resources\ProjectReportResource;
use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Task;
use App\Support\RevenueReport;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Group 8 reports (docs/ANALYTICS_CONTRACT.md sections 3.2–3.5,
 * DEC-029). Permissions are enforced per route (invoices.view /
 * projects.view / clients.view); tenancy by the BelongsToAgency
 * scope. Revenue figures come from the shared RevenueReport code
 * path so the JSON report and the CSV export always agree.
 */
class ReportController extends Controller
{
    public function revenue(Request $request): JsonResponse
    {
        [$from, $to] = $this->revenueRange($request);
        $report = RevenueReport::build($from->toDateString(), $to->toDateString());

        return response()->json([
            'data' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'months' => $report['months'],
                'totals' => $report['totals'],
                'outstanding_total' => $report['outstanding_total'],
            ],
        ]);
    }

    public function revenueExport(Request $request): Response
    {
        [$from, $to] = $this->revenueRange($request);
        $report = RevenueReport::build($from->toDateString(), $to->toDateString());

        $lines = ['month,invoiced,collected'];
        foreach ($report['months'] as $month) {
            $lines[] = "{$month['month']},{$month['invoiced']},{$month['collected']}";
        }
        $lines[] = "total,{$report['totals']['invoiced']},{$report['totals']['collected']}";

        $filename = 'revenue-'.$from->toDateString().'-to-'.$to->toDateString().'.csv';

        return response(implode("\n", $lines)."\n", 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function projects(Request $request): AnonymousResourceCollection
    {
        $projects = Project::query()
            ->where('status', '!=', Project::STATUS_CANCELLED)
            ->with('client')
            ->withCount([
                'tasks',
                'tasks as tasks_done_count' => fn ($q) => $q->where('status', Task::STATUS_DONE),
            ])
            // Due date ascending, projects without a due date last.
            ->orderByRaw('due_date IS NULL')
            ->orderBy('due_date')
            ->orderBy('id')
            ->paginate(min($request->integer('per_page', 15), 100));

        return ProjectReportResource::collection($projects);
    }

    public function clients(Request $request): AnonymousResourceCollection
    {
        $invoicedByClient = Invoice::query()
            ->where('status', '!=', Invoice::STATUS_CANCELLED)
            ->groupBy('client_id')
            ->selectRaw('client_id, SUM(total) as client_sum')
            ->pluck('client_sum', 'client_id');

        // Payments carry no client_id: group them through their
        // invoice. The tenant scope qualifies payments.agency_id, so
        // the join stays inside the current agency.
        $collectedByClient = Payment::query()
            ->join('invoices', 'invoices.id', '=', 'payments.invoice_id')
            ->where('invoices.status', '!=', Invoice::STATUS_CANCELLED)
            ->groupBy('invoices.client_id')
            ->selectRaw('invoices.client_id as client_id, SUM(payments.amount) as client_sum')
            ->pluck('client_sum', 'client_id');

        $outstandingByClient = Invoice::query()
            ->where('status', Invoice::STATUS_SENT)
            ->withSum('payments', 'amount')
            ->get()
            ->groupBy('client_id')
            ->map(fn ($invoices) => round((float) $invoices->sum(
                fn (Invoice $invoice) => $invoice->balanceDue()
            ), 2));

        $clients = Client::query()->withCount('projects')->get();
        foreach ($clients as $client) {
            $client->report_invoiced_total = round((float) ($invoicedByClient[$client->id] ?? 0), 2);
            $client->report_collected_total = round((float) ($collectedByClient[$client->id] ?? 0), 2);
            $client->report_outstanding = round((float) ($outstandingByClient[$client->id] ?? 0), 2);
        }

        // Ordering is by the computed collected total (contract
        // section 3.4), so the sort and the pagination happen in PHP
        // over the agency's client list.
        $sorted = $clients
            ->sortByDesc(fn (Client $client) => $client->report_collected_total)
            ->values();

        $perPage = min(max($request->integer('per_page', 15), 1), 100);
        $page = max($request->integer('page', 1), 1);
        $paginator = new LengthAwarePaginator(
            $sorted->forPage($page, $perPage),
            $sorted->count(),
            $perPage,
            $page,
            ['path' => $request->url()],
        );

        return ClientReportResource::collection($paginator);
    }

    /**
     * The validated revenue range (contract section 3.2): defaults
     * to the 6-month window ending today in the agency timezone;
     * an inverted range or a span over 24 months is a 422.
     *
     * @return array{0: Carbon, 1: Carbon} agency-local dates
     */
    private function revenueRange(Request $request): array
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $agency = Agency::find(Tenant::id());
        $timezone = $agency?->timezone ?: config('app.timezone');
        $today = Carbon::now($timezone)->startOfDay();

        $to = ! empty($validated['to'])
            ? Carbon::parse($validated['to'], $timezone)->startOfDay()
            : $today->copy();
        $from = ! empty($validated['from'])
            ? Carbon::parse($validated['from'], $timezone)->startOfDay()
            : $today->copy()->subMonths(5)->startOfMonth();

        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must not be after the to date.'],
            ]);
        }

        // The number of month buckets the range spans is capped at
        // 24 (contract section 3.2) to bound the aggregation.
        if ($from->copy()->startOfMonth()->diffInMonths($to->copy()->startOfMonth()) > 23) {
            throw ValidationException::withMessages([
                'to' => ['The date range must not exceed 24 months.'],
            ]);
        }

        return [$from, $to];
    }
}
