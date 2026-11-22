<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreProjectRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Project management (docs/PROJECT_CONTRACT.md). Permissions are
 * enforced by route middleware; tenancy by the BelongsToAgency scope
 * (cross-agency ids resolve to 404); Team Member visibility is scoped
 * by Project::scopeVisibleTo.
 */
class ProjectController extends Controller
{
    /** Load task aggregates used by the progress computation. */
    private function withProgress($query)
    {
        return $query->withCount([
            'tasks',
            'tasks as tasks_done_count' => fn ($q) => $q->where('status', Task::STATUS_DONE),
            'milestones',
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $projects = $this->withProgress(
            Project::query()
                ->visibleTo($request->user())
                ->with(['client', 'projectManager'])
                ->when($request->filled('client_id'), fn ($q) => $q->where('client_id', $request->integer('client_id')))
                ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
                ->when($request->filled('project_manager_id'), fn ($q) => $q->where('project_manager_id', $request->integer('project_manager_id')))
                ->when($request->filled('q'), function ($q) use ($request) {
                    $term = '%'.$request->string('q').'%';
                    $q->where(fn ($w) => $w->where('name', 'like', $term)->orWhere('description', 'like', $term));
                })
                ->latest()
        )->paginate(min($request->integer('per_page', 15), 100));

        return ProjectResource::collection($projects);
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        $project = Project::create($request->validated());

        // FIX-005 pattern: reload so column defaults are reflected.
        $project = $this->withProgress($project->newQuery()->whereKey($project->id))
            ->firstOrFail()->load(['client', 'projectManager']);

        return ProjectResource::make($project)->response()->setStatusCode(201);
    }

    public function show(Request $request, Project $project): ProjectResource
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $project = $this->withProgress($project->newQuery()->whereKey($project->id))
            ->firstOrFail()->load(['client', 'projectManager', 'members']);

        return ProjectResource::make($project);
    }

    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        $project->update($request->validated());

        $project = $this->withProgress($project->newQuery()->whereKey($project->id))
            ->firstOrFail()->load(['client', 'projectManager']);

        return ProjectResource::make($project);
    }

    public function destroy(Project $project): Response
    {
        // Soft delete with a soft cascade (DEC-016.4): the project's
        // milestones, tasks and their comments/checklist items are
        // soft-deleted with it; nothing is hard-deleted.
        DB::transaction(function () use ($project) {
            $taskIds = $project->tasks()->pluck('id');
            TaskComment::whereIn('task_id', $taskIds)->delete();
            TaskChecklistItem::whereIn('task_id', $taskIds)->delete();
            $project->tasks()->delete();
            $project->milestones()->delete();
            $project->delete();
        });

        return response()->noContent();
    }

    /** Milestones and tasks with deadlines, ordered by date (list form). */
    public function timeline(Request $request, Project $project): JsonResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $milestones = $project->milestones()
            ->whereNotNull('due_date')
            ->withCount(['tasks', 'tasks as tasks_done_count' => fn ($q) => $q->where('status', Task::STATUS_DONE)])
            ->get()
            ->map(fn ($milestone) => [
                'type' => 'milestone',
                'id' => $milestone->id,
                'name' => $milestone->name,
                'status' => $milestone->status,
                'due_date' => $milestone->due_date?->toDateString(),
                'progress_percent' => $milestone->progressPercent(),
            ]);

        $tasks = $project->tasks()
            ->whereNotNull('due_date')
            ->with('assignee')
            ->get()
            ->map(fn (Task $task) => [
                'type' => 'task',
                'id' => $task->id,
                'name' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
                'due_date' => $task->due_date?->toDateString(),
                'assignee' => $task->assignee ? ['id' => $task->assignee->id, 'name' => $task->assignee->name] : null,
            ]);

        $items = $milestones->concat($tasks)
            ->sortBy([['due_date', 'asc'], ['type', 'asc']])
            ->values();

        return response()->json(['data' => $items]);
    }
}
