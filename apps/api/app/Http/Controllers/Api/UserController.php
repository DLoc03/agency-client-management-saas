<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\GuardsAdminManagement;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\ActivationRequest;
use App\Http\Requests\Users\UpdateDirectoryUserRequest;
use App\Http\Requests\Users\UpdateUserRolesRequest;
use App\Http\Resources\DirectoryUserResource;
use App\Models\Membership;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Employee directory & membership administration
 * (docs/TEAM_CONTRACT.md endpoints 8-12, reworked by DEC-018).
 *
 * The directory lists the STAFF MEMBERSHIPS of the current agency;
 * identity fields (name, email, locale) come from the user, agency
 * fields (roles, job title, phone, active flag) from the membership.
 * Deactivation and role changes act on the membership and revoke its
 * tokens (design sections 2 and 3.5).
 */
class UserController extends Controller
{
    use GuardsAdminManagement;

    public function index(Request $request): JsonResponse
    {
        $query = Membership::query()
            ->where('kind', Membership::KIND_STAFF)
            ->join('users', 'users.id', '=', 'memberships.user_id')
            ->select('memberships.*')
            ->with(['user.teams', 'roles'])
            ->orderBy('users.name');

        if ($request->filled('q')) {
            $q = $request->string('q');
            $query->whereHas('user', fn ($sub) => $sub
                ->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"));
        }
        if ($request->filled('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('key', $request->string('role')));
        }
        if ($request->filled('team_id')) {
            $query->whereHas('user.teams', fn ($q) => $q->whereKey($request->integer('team_id')));
        }
        if ($request->has('is_active')) {
            $query->where('memberships.is_active', $request->boolean('is_active'));
        }

        $memberships = $query->paginate($request->integer('per_page', 15));
        $memberships->getCollection()->transform(fn (Membership $m) => $this->present($m));

        return DirectoryUserResource::collection($memberships)->response();
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $membership = $this->guardMembership($user);
        $presented = $this->present($membership);
        $presented->open_tasks_count = Task::where('assignee_id', $user->id)
            ->where('status', '!=', Task::STATUS_DONE)
            ->count();

        return (new DirectoryUserResource($presented))->response();
    }

    public function update(UpdateDirectoryUserRequest $request, User $user): JsonResponse
    {
        $membership = $this->guardMembership($user);
        $validated = $request->validated();

        $identityFields = array_intersect_key($validated, array_flip(['name', 'locale']));
        if ($identityFields) {
            $user->update($identityFields);
        }
        $membershipFields = array_intersect_key($validated, array_flip(['job_title', 'phone']));
        if ($membershipFields) {
            $membership->update($membershipFields);
        }

        return (new DirectoryUserResource($this->present($membership->fresh())))->response();
    }

    public function updateRoles(UpdateUserRolesRequest $request, User $user): JsonResponse
    {
        $membership = $this->guardMembership($user);
        $actor = $request->user();

        if ($membership->isOwner()) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
        if ($actor->id === $user->id) {
            throw new ApiException('CANNOT_MODIFY_OWN_ROLES', 422);
        }
        $roleIds = array_map('intval', $request->validated('role_ids'));
        $this->guardAdminManagement($actor, $membership, $roleIds);

        // The Owner role is exclusive and never granted through this API.
        $ownerRoleId = Role::where('key', Role::OWNER)->value('id');
        if (in_array($ownerRoleId, $roleIds, true)) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }

        $membership->roles()->sync($roleIds);
        // Design 3.5: a role change revokes the membership's sessions
        // so the new permissions apply from a fresh sign-in.
        $membership->revokeTokens();

        return (new DirectoryUserResource($this->present($membership->fresh())))->response();
    }

    public function activation(ActivationRequest $request, User $user): JsonResponse
    {
        $membership = $this->guardMembership($user);
        $actor = $request->user();
        $isActive = $request->validated('is_active');

        if ($membership->isOwner()) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
        if (! $isActive && $actor->id === $user->id) {
            throw new ApiException('CANNOT_DEACTIVATE_SELF', 422);
        }
        $this->guardAdminManagement($actor, $membership);

        if ($isActive) {
            $membership->forceFill([
                'is_active' => true,
                'deactivated_at' => null,
                'deactivated_by' => null,
            ])->save();
        } else {
            $membership->deactivate($actor->id);
        }

        return (new DirectoryUserResource($this->present($membership->fresh())))->response();
    }

    /**
     * The target's staff membership in the current agency — 404 when
     * the identity is not a staff member here (DEC-018 replacement for
     * the old agency_id comparison).
     */
    private function guardMembership(User $target): Membership
    {
        $membership = $target->membershipIn(Tenant::id());

        abort_if(! $membership || $membership->kind !== Membership::KIND_STAFF, 404);

        return $membership;
    }

    /** Shape a membership as a directory user for the resource. */
    private function present(Membership $membership): User
    {
        $user = $membership->user;
        $user->setRelation('roles', $membership->roles);
        $user->setRelation('teams', $user->teams);
        $user->directoryMembership = $membership;

        return $user;
    }
}
