<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StorePortalCommentRequest;
use App\Http\Resources\PortalCommentResource;
use App\Models\PortalComment;
use App\Models\Project;
use App\Models\Role;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Internal side of a project's Portal discussion thread (docs/
 * PORTAL_CONTRACT.md section 3.2, DEC-028 Q10): any staff member who
 * can view the project may read and reply — replying needs no extra
 * permission key and, per contract section 5, never notifies other
 * staff. Deleting a message is moderation: the author, the Owner or
 * an Admin.
 */
class ProjectPortalCommentController extends Controller
{
    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $comments = $project->portalComments()
            ->with('author')
            ->oldest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return PortalCommentResource::collection($comments);
    }

    public function store(StorePortalCommentRequest $request, Project $project): JsonResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $comment = $project->portalComments()->create([
            'author_id' => $request->user()->id,
            'author_kind' => PortalComment::AUTHOR_STAFF,
            'body' => $request->validated('body'),
        ]);

        return PortalCommentResource::make($comment->refresh()->load('author'))
            ->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Project $project, int $commentId): Response
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $comment = $project->portalComments()->findOrFail($commentId);
        $user = $request->user();

        // Moderation only: the author, the Owner or an Admin (the
        // same rule as internal task comments).
        if ($comment->author_id !== $user->id && ! $user->hasRole(Role::OWNER) && ! $user->hasRole(Role::ADMIN)) {
            throw new AuthorizationException('Only the author, the Owner or an Admin can delete this comment.');
        }

        $comment->delete();

        return response()->noContent();
    }
}
