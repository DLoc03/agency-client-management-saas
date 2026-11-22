<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teams\StoreTeamMemberRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** Team membership (docs/TEAM_CONTRACT.md endpoints 6-7). */
class TeamMemberController extends Controller
{
    public function store(StoreTeamMemberRequest $request, Team $team): JsonResponse
    {
        $team->members()->syncWithoutDetaching([$request->validated('user_id')]);
        $team->load(['lead', 'members']);

        return (new TeamResource($team))->response()->setStatusCode(201);
    }

    public function destroy(Team $team, int $userId): Response
    {
        $detached = $team->members()->detach($userId);
        abort_if($detached === 0, 404);

        return response()->noContent();
    }
}
