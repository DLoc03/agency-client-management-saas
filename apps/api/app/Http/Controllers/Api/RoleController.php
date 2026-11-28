<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Roles catalogue (BE-014): the full list of assignable roles, so the
 * invite modal and the member role form can offer every role without
 * deriving options from existing members (a fresh agency whose only
 * member is the Owner would otherwise offer none). Roles are global
 * reference data seeded by RoleSeeder — never agency-scoped.
 */
class RoleController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        // The `permission:` middleware accepts a single key, so the
        // either-permission rule lives here; throwing the same
        // AuthorizationException keeps the standard 403 FORBIDDEN shape.
        if (! $user->hasPermission('invitations.manage') && ! $user->hasPermission('users.roles.manage')) {
            throw new AuthorizationException('Missing permission: invitations.manage or users.roles.manage');
        }

        return RoleResource::collection(Role::query()->orderBy('id')->get());
    }
}
