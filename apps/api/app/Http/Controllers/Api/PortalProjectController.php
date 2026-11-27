<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PortalProjectResource;
use App\Models\Project;
use App\Models\Task;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only Portal view of the signed-in client's own projects
 * (docs/PROJECT_CONTRACT.md endpoints 17-18). Since DEC-018 the
 * tenant context comes from the client membership bound to the
 * token: the agency scope applies automatically, and this controller
 * only pins the query to the membership's client record. Internal
 * comments and the budget are never exposed.
 *
 * Group 7 (docs/PORTAL_CONTRACT.md sections 2.1/3.1, DEC-028 Q1/Q2):
 * draft and cancelled projects are hidden from the Portal, and only
 * client-visible milestones/tasks are shown — the progress percent
 * and the counts are computed over the visible subset only, so the
 * volume of internal work never leaks through the denominator.
 */
class PortalProjectController extends Controller
{
    private function scopedQuery(Request $request)
    {
        return Project::query()
            ->where('client_id', Tenant::membership()->client_id)
            ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED])
            ->withCount([
                'tasks' => fn ($q) => $q->where('client_visible', true),
                'tasks as tasks_done_count' => fn ($q) => $q
                    ->where('client_visible', true)
                    ->where('status', Task::STATUS_DONE),
            ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $projects = $this->scopedQuery($request)
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return PortalProjectResource::collection($projects);
    }

    public function show(Request $request, int $projectId): PortalProjectResource
    {
        $project = $this->scopedQuery($request)
            ->with([
                'milestones' => fn ($q) => $q
                    ->where('client_visible', true)
                    ->withCount([
                        'tasks' => fn ($tq) => $tq->where('client_visible', true),
                        'tasks as tasks_done_count' => fn ($tq) => $tq
                            ->where('client_visible', true)
                            ->where('status', Task::STATUS_DONE),
                    ])->orderBy('due_date'),
                'tasks' => fn ($q) => $q
                    ->where('client_visible', true)
                    ->orderBy('position')->latest(),
            ])
            ->findOrFail($projectId);

        return PortalProjectResource::make($project);
    }
}
