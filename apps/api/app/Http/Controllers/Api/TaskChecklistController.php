<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\GuardsTeamMemberTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreChecklistItemRequest;
use App\Http\Requests\Projects\UpdateChecklistItemRequest;
use App\Http\Resources\TaskChecklistItemResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Sub-checklist of a task (docs/PROJECT_CONTRACT.md endpoint 16). */
class TaskChecklistController extends Controller
{
    use GuardsTeamMemberTasks;

    public function index(Request $request, Task $task): AnonymousResourceCollection
    {
        abort_unless($task->project->isVisibleTo($request->user()), 404);

        return TaskChecklistItemResource::collection(
            $task->checklistItems()->orderBy('position')->paginate(min($request->integer('per_page', 50), 100))
        );
    }

    public function store(StoreChecklistItemRequest $request, Task $task): JsonResponse
    {
        $this->guardTeamMemberMutation($request->user(), $task);

        $item = $task->checklistItems()->create($request->validated());

        return TaskChecklistItemResource::make($item->refresh())->response()->setStatusCode(201);
    }

    public function update(UpdateChecklistItemRequest $request, Task $task, int $itemId): TaskChecklistItemResource
    {
        $this->guardTeamMemberMutation($request->user(), $task);

        $item = $task->checklistItems()->findOrFail($itemId);
        $item->update($request->validated());

        return TaskChecklistItemResource::make($item->refresh());
    }

    public function destroy(Request $request, Task $task, int $itemId): Response
    {
        $this->guardTeamMemberMutation($request->user(), $task);

        $task->checklistItems()->findOrFail($itemId)->delete();

        return response()->noContent();
    }
}
