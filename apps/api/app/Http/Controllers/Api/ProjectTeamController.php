<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\StoreProjectTeamRequest;
use App\Models\Project;
use App\Models\Task;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Team-based project assignment (docs/TEAM_CONTRACT.md section 4):
 * attaching a team snapshots its CURRENT members into project_members
 * (via_team_id set); later team changes never propagate. Detaching
 * removes only snapshot members with no task assigned in the project;
 * members with tasks stay and become direct members.
 */
class ProjectTeamController extends Controller
{
    public function store(StoreProjectTeamRequest $request, Project $project): JsonResponse
    {
        $team = Team::findOrFail($request->validated('team_id'));
        $existing = $project->members()->pluck('users.id')->all();

        $added = [];
        foreach ($team->members as $member) {
            if (! in_array($member->id, $existing, true)) {
                $project->members()->attach($member->id, ['via_team_id' => $team->id]);
                $added[] = $member->id;
            }
        }

        return response()->json(['data' => [
            'added_user_ids' => $added,
            'members' => $this->memberList($project),
        ]], 201);
    }

    public function destroy(Project $project, Team $team): JsonResponse
    {
        $snapshotMembers = DB::table('project_members')
            ->where('project_id', $project->id)
            ->where('via_team_id', $team->id)
            ->pluck('user_id')
            ->all();

        $removed = [];
        $kept = [];
        foreach ($snapshotMembers as $userId) {
            $hasTasks = Task::where('project_id', $project->id)
                ->where('assignee_id', $userId)
                ->exists();
            if ($hasTasks) {
                DB::table('project_members')
                    ->where('project_id', $project->id)
                    ->where('user_id', $userId)
                    ->update(['via_team_id' => null]);
                $kept[] = $userId;
            } else {
                $project->members()->detach($userId);
                $removed[] = $userId;
            }
        }

        return response()->json(['data' => [
            'removed_user_ids' => $removed,
            'kept_user_ids' => $kept,
            'members' => $this->memberList($project),
        ]]);
    }

    private function memberList(Project $project): array
    {
        return $project->members()->get()->map(fn ($member) => [
            'id' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'via_team_id' => $member->pivot->via_team_id,
        ])->values()->all();
    }
}
