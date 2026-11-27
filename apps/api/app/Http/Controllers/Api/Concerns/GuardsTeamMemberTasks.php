<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Exceptions\ApiException;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;

/**
 * Task mutation scoping. DEC-016 introduced the first guard (a
 * Team-Member-only user could mutate just their assigned tasks);
 * DEC-027 generalises it to every user: acting on a task — update,
 * delete, comments, checklist — requires being the task's assignee,
 * the project's manager, or holding the Owner / Admin / Project
 * Manager role on the current membership. The rule itself lives on
 * the Task model (`canBeActedOnBy`) so the API and the `can_act`
 * resource flag can never drift apart.
 */
trait GuardsTeamMemberTasks
{
    protected function isTeamMemberOnly(User $user): bool
    {
        return $user->hasRole(Role::TEAM_MEMBER)
            && ! $user->hasAnyRole([Role::OWNER, Role::ADMIN, Role::PROJECT_MANAGER]);
    }

    /** Throw 403 TASK_ACTION_FORBIDDEN unless the user may act on the task (DEC-027). */
    protected function guardTeamMemberMutation(User $user, Task $task): void
    {
        if (! $task->canBeActedOnBy($user)) {
            throw new ApiException('TASK_ACTION_FORBIDDEN', 403);
        }
    }
}
