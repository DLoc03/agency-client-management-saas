<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Exceptions\ApiException;
use App\Models\Role;
use App\Models\User;

/**
 * DEC-017 / TEAM_CONTRACT section 3: touching Admin accounts or the Admin
 * role is Owner-only. Admins hold the users.* / invitations.* permissions
 * but hit this guard whenever an operation involves the Admin role.
 */
trait GuardsAdminManagement
{
    protected function guardAdminManagement(User $actor, ?User $target = null, ?array $newRoleIds = null): void
    {
        if ($actor->isOwner()) {
            return;
        }

        $touchesAdmin = false;
        if ($target !== null && $target->hasRole(Role::ADMIN)) {
            $touchesAdmin = true;
        }
        if ($newRoleIds !== null) {
            $adminRoleId = Role::where('key', Role::ADMIN)->value('id');
            $touchesAdmin = $touchesAdmin || in_array($adminRoleId, $newRoleIds, true)
                || in_array((string) $adminRoleId, $newRoleIds, true);
        }

        if ($touchesAdmin) {
            throw new ApiException('ADMIN_MANAGEMENT_OWNER_ONLY', 403);
        }
    }
}
