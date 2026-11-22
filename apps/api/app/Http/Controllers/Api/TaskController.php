<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\GuardsTeamMemberTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreTaskRequest;
use App\Http\Requests\Projects\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Tasks (docs/PROJECT_CONTRACT.md). List/create are nested under a
 * project; detail/update/delete are standalone. `completed_at` follows
 * the status via the Task model hook.
 */
class TaskController extends Controller
{
    use GuardsTeamMemberTasks;

    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $tasks = $project->tasks()
            ->with(['assignee', 'milestone'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('priority'), fn ($q) => $q->where('priority', $request->string('priority')))
            ->when($request->filled('assignee_id'), fn ($q) => $q->where('assignee_id', $request->integer('assignee_id')))
            ->when($request->filled('milestone_id'), fn ($q) => $q->where('milestone_id', $request->integer('milestone_id')))
            ->when($request->filled('due_before'), fn ($q) => $q->where('due_date', '<=', $request->date('due_before')))
            ->when($request->filled('due_after'), fn ($q) => $q->where('due_date', '>=', $request->date('due_after')))
            ->orderBy('position')
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return TaskResource::collection($tasks);
    }

    public function store(StoreTaskRequest $request, Project $project): JsonResponse
    {
        $task = $project->tasks()->create($request->validated());

        // FIX-005 pattern: reload so column defaults are reflected.
        return TaskResource::make($task->refresh()->load(['assignee', 'milestone']))
            ->response()->setStatusCode(201);
    }

    public function show(Request $request, Task $task): TaskResource
    {
        abort_unless($task->project->isVisibleTo($request->user()), 404);

        return TaskResource::make($task->load([
            'assignee',
            'milestone',
            'project',
            'checklistItems' => fn ($q) => $q->orderBy('position'),
            'comments.author',
        ]));
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        $user = $request->user();
        $this->guardTeamMemberMutation($user, $task);

        $data = $request->validated();
        if ($this->isTeamMemberOnly($user)) {
            // Team Members may only move their own tasks' status.
            $data = array_intersect_key($data, array_flip(['status']));
        }

        $task->update($data);

        return TaskResource::make($task->refresh()->load(['assignee', 'milestone']));
    }

    public function destroy(Task $task): Response
    {
        $task->delete();

        return response()->noContent();
    }

    /** Open tasks due now or within the next N days, agency-wide. */
    public function due(Request $request): AnonymousResourceCollection
    {
        $days = max($request->integer('days', 0), 0);
        $user = $request->user();

        $tasks = Task::query()
            ->with(['assignee', 'milestone', 'project'])
            ->where('status', '!=', Task::STATUS_DONE)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', now()->addDays($days)->endOfDay())
            ->when($this->isTeamMemberOnly($user), fn ($q) => $q->where('assignee_id', $user->id))
            ->orderBy('due_date')
            ->paginate(min($request->integer('per_page', 15), 100));

        return TaskResource::collection($tasks);
    }
}
