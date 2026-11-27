<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\GuardsTeamMemberTasks;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreTaskCommentRequest;
use App\Http\Resources\TaskCommentResource;
use App\Models\Role;
use App\Models\Task;
use App\Support\Notifier;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Internal task comments. Never exposed to Portal accounts. */
class TaskCommentController extends Controller
{
    use GuardsTeamMemberTasks;

    public function index(Request $request, Task $task): AnonymousResourceCollection
    {
        abort_unless($task->project->isVisibleTo($request->user()), 404);

        return TaskCommentResource::collection(
            $task->comments()->with('author')->latest()->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreTaskCommentRequest $request, Task $task): JsonResponse
    {
        $this->guardTeamMemberMutation($request->user(), $task);

        $comment = $task->comments()->create([
            'author_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        // BE-009 (docs/WORKFLOW_CONTRACT.md section 4): a new comment
        // notifies the task's assignee and creator (never the author).
        Notifier::notifyMany([$task->assignee_id, $task->created_by], Notifier::TYPE_TASK_COMMENTED, [
            'task_id' => $task->id,
            'task_title' => $task->title,
            'project_id' => $task->project_id,
            'comment_id' => $comment->id,
            'actor_name' => $request->user()->name,
        ], actorId: $request->user()->id);

        // FIX-005 pattern: refresh for stored values, then load the author.
        return TaskCommentResource::make($comment->refresh()->load('author'))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Task $task, int $commentId): Response
    {
        $comment = $task->comments()->findOrFail($commentId);
        $user = $request->user();

        // Only the author, the Owner or an Admin may delete a comment.
        if ($comment->author_id !== $user->id && ! $user->hasRole(Role::OWNER) && ! $user->hasRole(Role::ADMIN)) {
            throw new AuthorizationException('Only the author, the Owner or an Admin can delete this comment.');
        }

        $comment->delete();

        return response()->noContent();
    }
}
