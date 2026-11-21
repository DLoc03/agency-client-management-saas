<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leads\StoreLeadActivityRequest;
use App\Http\Requests\Leads\UpdateLeadActivityRequest;
use App\Http\Resources\LeadActivityResource;
use App\Models\Lead;
use App\Models\LeadActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Follow-up activities on leads (docs/CRM_CONTRACT.md sections 2 and 5).
 * Completing an activity stamps completed_at; reopening clears it.
 */
class LeadActivityController extends Controller
{
    public function index(Request $request, Lead $lead): AnonymousResourceCollection
    {
        return LeadActivityResource::collection(
            $lead->activities()->with('creator')->orderBy('scheduled_at')
                ->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreLeadActivityRequest $request, Lead $lead): JsonResponse
    {
        $data = $request->validated();

        $activity = $lead->activities()->create([
            ...$data,
            'created_by' => $request->user()->id,
            'completed_at' => ($data['is_done'] ?? false) ? now() : null,
        ]);

        return LeadActivityResource::make($activity->refresh()->load('creator'))
            ->response()->setStatusCode(201);
    }

    public function update(UpdateLeadActivityRequest $request, Lead $lead, int $activityId): LeadActivityResource
    {
        $activity = $lead->activities()->findOrFail($activityId);
        $data = $request->validated();

        if (array_key_exists('is_done', $data)) {
            $data['completed_at'] = $data['is_done'] ? ($activity->completed_at ?? now()) : null;
        }
        $activity->update($data);

        return LeadActivityResource::make($activity->load('creator'));
    }

    public function destroy(Lead $lead, int $activityId): Response
    {
        $lead->activities()->findOrFail($activityId)->delete();

        return response()->noContent();
    }

    /** Unfinished activities whose scheduled time has arrived, agency-wide. */
    public function due(Request $request): AnonymousResourceCollection
    {
        $activities = LeadActivity::query()
            ->with(['lead', 'creator'])
            ->where('is_done', false)
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->paginate(min($request->integer('per_page', 15), 100));

        return LeadActivityResource::collection($activities);
    }
}
