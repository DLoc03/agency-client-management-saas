<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\ResolvesPortalProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\RespondApprovalRequest;
use App\Http\Resources\ApprovalRequestResource;
use App\Models\ApprovalRequest;
use App\Support\Notifier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Portal side of approval requests (docs/PORTAL_CONTRACT.md
 * sections 3.1/4, DEC-028 Q6/Q12): any portal account of the client
 * record may respond; the first response wins and is recorded with
 * its account (`responded_by`); a responded request is immutable.
 * Responding notifies the request's creator and the project manager
 * in-app (portal.approval_response).
 */
class PortalApprovalController extends Controller
{
    use ResolvesPortalProject;

    public function index(Request $request, int $projectId): AnonymousResourceCollection
    {
        $project = $this->portalProject($projectId);

        // Pending first, then newest — the client sees what needs
        // their decision before the answered history.
        $approvals = $project->approvalRequests()
            ->with(['creator', 'responder'])
            ->orderByRaw('CASE WHEN status = ? THEN 0 ELSE 1 END', [ApprovalRequest::STATUS_PENDING])
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return ApprovalRequestResource::collection($approvals);
    }

    public function respond(RespondApprovalRequest $request, int $projectId, int $approvalId): ApprovalRequestResource
    {
        $project = $this->portalProject($projectId);
        $approval = $project->approvalRequests()->findOrFail($approvalId);

        // Claim the response atomically: the update only lands
        // while the request is still pending, so two responses
        // racing each other cannot both win — the loser affects
        // zero rows and answers APPROVAL_ALREADY_RESPONDED.
        $claimed = ApprovalRequest::query()
            ->whereKey($approval->id)
            ->where('status', ApprovalRequest::STATUS_PENDING)
            ->update([
                'status' => $request->validated('decision'),
                'response_comment' => $request->validated('comment'),
                'responded_by' => $request->user()->id,
                'responded_at' => now(),
            ]);

        if ($claimed === 0) {
            throw new ApiException('APPROVAL_ALREADY_RESPONDED', 422);
        }

        $approval->refresh();

        Notifier::notifyMany(
            [$approval->created_by, $project->project_manager_id],
            Notifier::TYPE_PORTAL_APPROVAL_RESPONSE,
            [
                'project_id' => $project->id,
                'project_name' => $project->name,
                'approval_id' => $approval->id,
                'approval_title' => $approval->title,
                'decision' => $approval->status,
                'actor_name' => $request->user()->name,
            ],
            actorId: $request->user()->id,
        );

        return ApprovalRequestResource::make(
            $approval->refresh()->load(['creator', 'responder'])
        );
    }
}
