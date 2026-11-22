<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teams\StoreTeamRequest;
use App\Http\Requests\Teams\UpdateTeamRequest;
use App\Http\Resources\TeamResource;
use App\Models\Role;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Teams (docs/TEAM_CONTRACT.md endpoints 1-5). */
class TeamController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Team::query()->with('lead')->withCount('members');

        // DEC-017: a Team-Member-only user sees only their own teams.
        $user = $request->user();
        if ($user->hasRole(Role::TEAM_MEMBER)
            && ! $user->hasAnyRole([Role::OWNER, Role::ADMIN, Role::SALES_MANAGER, Role::PROJECT_MANAGER, Role::ACCOUNTANT])) {
            $query->whereHas('members', fn ($q) => $q->whereKey($user->id));
        }

        if ($request->filled('q')) {
            $query->where('name', 'like', '%'.$request->string('q').'%');
        }

        $teams = $query->orderBy('name')->paginate($request->integer('per_page', 15));

        return TeamResource::collection($teams)->response();
    }

    public function store(StoreTeamRequest $request): JsonResponse
    {
        $team = Team::create($request->validated());
        $team->load('lead')->loadCount('members');

        return (new TeamResource($team))->response()->setStatusCode(201);
    }

    public function show(Request $request, Team $team): JsonResponse
    {
        $user = $request->user();
        if ($user->hasRole(Role::TEAM_MEMBER)
            && ! $user->hasAnyRole([Role::OWNER, Role::ADMIN, Role::SALES_MANAGER, Role::PROJECT_MANAGER, Role::ACCOUNTANT])
            && ! $team->members()->whereKey($user->id)->exists()) {
            abort(404);
        }

        $team->load(['lead', 'members']);

        return (new TeamResource($team))->response();
    }

    public function update(UpdateTeamRequest $request, Team $team): JsonResponse
    {
        $team->update($request->validated());
        $team->load('lead')->loadCount('members');

        return (new TeamResource($team))->response();
    }

    public function destroy(Team $team): Response
    {
        $team->delete();

        return response()->noContent();
    }
}
