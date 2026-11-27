<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreApprovalRequest;
use App\Http\Resources\ApprovalRequestResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Internal side of approval requests (docs/PORTAL_CONTRACT.md
 * section 3.2, DEC-028 Q10): creating and cancelling require the
 * `portal.approvals.manage` permission (route middleware); listing
 * only needs the project to be visible. A pending request may be
 * cancelled (soft delete); a responded one is immutable history.
 */
class ProjectApprovalController extends Controller
{
    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $approvals = $project->approvalRequests()
            ->with(['creator', 'responder'])
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return ApprovalRequestResource::collection($approvals);
    }

    public function store(StoreApprovalRequest $request, Project $project): JsonResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $data = $request->validated();

        // A request pointing at a file/milestone may omit the title;
        // default it from the target so the client always sees what
        // they are asked to approve.
        if (empty($data['title'])) {
            $data['title'] = ! empty($data['file_id'])
                ? $project->portalFiles()->find($data['file_id'])?->original_name
                : $project->milestones()->find($data['milestone_id'] ?? null)?->name;
        }

        $approval = $project->approvalRequests()->create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return ApprovalRequestResource::make($approval->refresh()->load(['creator', 'responder']))
            ->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Project $project, int $approvalId): Response
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $approval = $project->approvalRequests()->findOrFail($approvalId);

        if (! $approval->isPending()) {
            throw new ApiException('APPROVAL_ALREADY_RESPONDED', 422);
        }

        $approval->delete();

        return response()->noContent();
    }
}
