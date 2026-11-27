<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesPortalProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StorePortalCommentRequest;
use App\Http\Resources\PortalCommentResource;
use App\Models\PortalComment;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Portal side of a project's discussion thread (docs/
 * PORTAL_CONTRACT.md sections 3.1/5, DEC-028 Q5). One thread per
 * project, shared with the staff side. A client comment notifies
 * the project manager and the project's staff members in-app
 * (portal.comment); no email is sent in the MVP.
 */
class PortalCommentController extends Controller
{
    use ResolvesPortalProject;

    public function index(Request $request, int $projectId): AnonymousResourceCollection
    {
        $project = $this->portalProject($projectId);

        // Conversation order: oldest first, newest at the end.
        $comments = $project->portalComments()
            ->with('author')
            ->oldest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return PortalCommentResource::collection($comments);
    }

    public function store(StorePortalCommentRequest $request, int $projectId): JsonResponse
    {
        $project = $this->portalProject($projectId);

        $comment = $project->portalComments()->create([
            'author_id' => $request->user()->id,
            'author_kind' => PortalComment::AUTHOR_CLIENT,
            'body' => $request->validated('body'),
        ]);

        // Recipients: the project manager plus every staff member of
        // the project (contract section 5). The Notifier itself
        // drops anyone without an active staff membership.
        Notifier::notifyMany(
            [$project->project_manager_id, ...$project->members()->pluck('users.id')->all()],
            Notifier::TYPE_PORTAL_COMMENT,
            [
                'project_id' => $project->id,
                'project_name' => $project->name,
                'comment_id' => $comment->id,
                'actor_name' => $request->user()->name,
            ],
            actorId: $request->user()->id,
        );

        return PortalCommentResource::make($comment->refresh()->load('author'))
            ->response()->setStatusCode(201);
    }
}
