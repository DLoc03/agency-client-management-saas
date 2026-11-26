<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreProjectMemberRequest;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/** Project membership (docs/PROJECT_CONTRACT.md endpoint 7). */
class ProjectMemberController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        return response()->json(['data' => $project->members->map(fn ($member) => [
            'id' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'via_team_id' => $member->pivot->via_team_id,
        ])->values()]);
    }

    public function store(StoreProjectMemberRequest $request, Project $project): JsonResponse
    {
        $project->members()->syncWithoutDetaching([$request->validated('user_id')]);

        return $this->index($project)->setStatusCode(201);
    }

    public function destroy(Project $project, int $userId): Response
    {
        $detached = $project->members()->detach($userId);
        abort_if($detached === 0, 404);

        return response()->noContent();
    }
}
