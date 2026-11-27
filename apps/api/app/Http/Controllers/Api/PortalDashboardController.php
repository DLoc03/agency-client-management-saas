<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PortalProjectResource;
use App\Http\Resources\ProjectFileResource;
use App\Models\ApprovalRequest;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\Task;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The Portal home in one call (docs/PORTAL_CONTRACT.md section 3.1,
 * DEC-028 Q9): the client's projects with their visible progress,
 * the approvals waiting on the client, what is still owed on issued
 * invoices, and the newest shared files.
 */
class PortalDashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $clientId = Tenant::membership()->client_id;

        $projects = Project::query()
            ->where('client_id', $clientId)
            ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED])
            ->withCount([
                'tasks' => fn ($q) => $q->where('client_visible', true),
                'tasks as tasks_done_count' => fn ($q) => $q
                    ->where('client_visible', true)
                    ->where('status', Task::STATUS_DONE),
            ])
            ->latest()
            ->get();

        $pendingApprovals = ApprovalRequest::query()
            ->where('status', ApprovalRequest::STATUS_PENDING)
            ->whereHas('project', fn ($q) => $q
                ->where('client_id', $clientId)
                ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED]))
            ->with('project')
            ->latest()
            ->get();

        // Issued and not yet fully paid: stored status `sent` covers
        // both plain sent and derived-overdue invoices. Like the
        // rest of the dashboard, invoices of draft/cancelled
        // projects stay out (Q2); project-less invoices still count.
        $openInvoices = Invoice::query()
            ->where('client_id', $clientId)
            ->where('status', Invoice::STATUS_SENT)
            ->where(fn ($q) => $q
                ->whereNull('project_id')
                ->orWhereHas('project', fn ($p) => $p
                    ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED])))
            ->withSum('payments', 'amount')
            ->get()
            ->filter(fn (Invoice $invoice) => $invoice->balanceDue() > 0)
            ->values();

        $recentFiles = ProjectFile::query()
            ->whereHas('project', fn ($q) => $q
                ->where('client_id', $clientId)
                ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED]))
            ->where(fn ($q) => $q
                ->where('uploader_kind', ProjectFile::UPLOADER_CLIENT)
                ->orWhere('client_visible', true))
            ->with(['uploader', 'project'])
            ->latest()
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'projects' => PortalProjectResource::collection($projects)->resolve($request),
                'pending_approvals' => [
                    'count' => $pendingApprovals->count(),
                    'items' => $pendingApprovals->map(fn (ApprovalRequest $approval) => [
                        'id' => $approval->id,
                        'project_id' => $approval->project_id,
                        'project_name' => $approval->project?->name,
                        'title' => $approval->title,
                        'created_at' => $approval->created_at?->toISOString(),
                    ])->values(),
                ],
                'unpaid_invoices' => [
                    'count' => $openInvoices->count(),
                    'total_due' => round($openInvoices->sum(fn (Invoice $invoice) => $invoice->balanceDue()), 2),
                ],
                'recent_files' => ProjectFileResource::collection($recentFiles)->resolve($request),
            ],
        ]);
    }
}
