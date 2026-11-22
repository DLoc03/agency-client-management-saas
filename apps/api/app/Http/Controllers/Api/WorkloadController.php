<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Workload-lite (docs/TEAM_CONTRACT.md section 6): per-user open,
 * overdue and upcoming task counts plus project memberships, computed
 * at read time. Team-Member-only users receive just their own row.
 */
class WorkloadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $agency = $actor->agency;
        $today = now($agency->timezone ?? 'UTC')->startOfDay();
        $weekAhead = $today->copy()->addDays(7)->endOfDay();

        $query = User::query()
            ->where('agency_id', $actor->agency_id)
            ->where('is_active', true)
            ->orderBy('name');

        if (! $actor->hasAnyRole([Role::OWNER, Role::ADMIN, Role::PROJECT_MANAGER])) {
            $query->whereKey($actor->id);
        }

        $rows = $query->get()->map(function (User $user) use ($today, $weekAhead) {
            $open = Task::where('assignee_id', $user->id)
                ->where('status', '!=', Task::STATUS_DONE);

            return [
                'user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'open_tasks' => (clone $open)->count(),
                'overdue_tasks' => (clone $open)
                    ->whereNotNull('due_date')->where('due_date', '<', $today)->count(),
                'due_next_7_days' => (clone $open)
                    ->whereNotNull('due_date')
                    ->where('due_date', '>=', $today)->where('due_date', '<=', $weekAhead)->count(),
                'projects_count' => $user->memberProjects()
                    ->whereNotIn('projects.status', [Project::STATUS_COMPLETED, Project::STATUS_CANCELLED])
                    ->count(),
            ];
        })->values();

        return response()->json(['data' => $rows]);
    }
}
