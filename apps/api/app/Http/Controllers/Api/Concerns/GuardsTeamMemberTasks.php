<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Role;
use App\Models\Task;
use App\Models\User;

/**
 * Team Member task scoping (DEC-016 matrix): a user whose task access
 * comes only from the Team Member role may mutate just the tasks
 * assigned to them; broader roles (Owner/Admin/PM) are unrestricted.
 */
trait GuardsTeamMemberTasks
{
    protected function isTeamMemberOnly(User $user): bool
    {
        return $user->hasRole(Role::TEAM_MEMBER)
            && ! $user->hasAnyRole([Role::OWNER, Role::ADMIN, Role::PROJECT_MANAGER]);
    }

    /** Abort 403 unless a Team-Member-only user is the task's assignee. */
    protected function guardTeamMemberMutation(User $user, Task $task): void
    {
        if ($this->isTeamMemberOnly($user)) {
            abort_unless($task->assignee_id === $user->id, 403);
        }
    }
}
