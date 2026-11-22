<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreMilestoneRequest;
use App\Http\Requests\Projects\UpdateMilestoneRequest;
use App\Http\Resources\MilestoneResource;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Milestones nested under a project; foreign milestones resolve to 404. */
class MilestoneController extends Controller
{
    private function withProgress($query)
    {
        return $query->withCount([
            'tasks',
            'tasks as tasks_done_count' => fn ($q) => $q->where('status', Task::STATUS_DONE),
        ]);
    }

    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $milestones = $this->withProgress($project->milestones()->orderBy('due_date'))
            ->paginate(min($request->integer('per_page', 15), 100));

        return MilestoneResource::collection($milestones);
    }

    public function store(StoreMilestoneRequest $request, Project $project): JsonResponse
    {
        $milestone = $project->milestones()->create($request->validated());

        // FIX-005 pattern: reload so column defaults are reflected.
        return MilestoneResource::make($this->withProgress($milestone->newQuery()->whereKey($milestone->id))->firstOrFail())
            ->response()->setStatusCode(201);
    }

    public function update(UpdateMilestoneRequest $request, Project $project, int $milestoneId): MilestoneResource
    {
        $milestone = $project->milestones()->findOrFail($milestoneId);
        $milestone->update($request->validated());

        return MilestoneResource::make($this->withProgress($milestone->newQuery()->whereKey($milestone->id))->firstOrFail());
    }

    public function destroy(Project $project, int $milestoneId): Response
    {
        $milestone = $project->milestones()->findOrFail($milestoneId);
        // Tasks keep existing with no milestone rather than being deleted.
        $milestone->tasks()->update(['milestone_id' => null]);
        $milestone->delete();

        return response()->noContent();
    }
}
