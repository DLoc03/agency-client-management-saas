<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\GuardsAdminManagement;
use App\Http\Controllers\Controller;
use App\Http\Requests\Users\ActivationRequest;
use App\Http\Requests\Users\UpdateDirectoryUserRequest;
use App\Http\Requests\Users\UpdateUserRolesRequest;
use App\Http\Resources\DirectoryUserResource;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Employee directory & account administration
 * (docs/TEAM_CONTRACT.md endpoints 8-12).
 *
 * The User model is not tenant-scoped, so every action verifies the
 * target belongs to the actor's agency and answers 404 otherwise.
 */
class UserController extends Controller
{
    use GuardsAdminManagement;

    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->where('agency_id', $request->user()->agency_id)
            ->with(['roles', 'teams']);

        if ($request->filled('q')) {
            $q = $request->string('q');
            $query->where(fn ($sub) => $sub->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"));
        }
        if ($request->filled('role')) {
            $query->whereHas('roles', fn ($q) => $q->where('key', $request->string('role')));
        }
        if ($request->filled('team_id')) {
            $query->whereHas('teams', fn ($q) => $q->whereKey($request->integer('team_id')));
        }
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $users = $query->orderBy('name')->paginate($request->integer('per_page', 15));

        return DirectoryUserResource::collection($users)->response();
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->guardSameAgency($request, $user);
        $user->load(['roles', 'teams']);
        $user->open_tasks_count = Task::where('assignee_id', $user->id)
            ->where('status', '!=', Task::STATUS_DONE)
            ->count();

        return (new DirectoryUserResource($user))->response();
    }

    public function update(UpdateDirectoryUserRequest $request, User $user): JsonResponse
    {
        $this->guardSameAgency($request, $user);
        $user->update($request->validated());
        $user->refresh();
        $user->load(['roles', 'teams']);

        return (new DirectoryUserResource($user))->response();
    }

    public function updateRoles(UpdateUserRolesRequest $request, User $user): JsonResponse
    {
        $this->guardSameAgency($request, $user);
        $actor = $request->user();

        if ($user->isOwner()) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
        if ($actor->id === $user->id) {
            throw new ApiException('CANNOT_MODIFY_OWN_ROLES', 422);
        }
        $roleIds = array_map('intval', $request->validated('role_ids'));
        $this->guardAdminManagement($actor, $user, $roleIds);

        // The Owner role is exclusive and never granted through this API.
        $ownerRoleId = Role::where('key', Role::OWNER)->value('id');
        if (in_array($ownerRoleId, $roleIds, true)) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }

        $user->roles()->sync($roleIds);
        $user->load(['roles', 'teams']);

        return (new DirectoryUserResource($user))->response();
    }

    public function activation(ActivationRequest $request, User $user): JsonResponse
    {
        $this->guardSameAgency($request, $user);
        $actor = $request->user();
        $isActive = $request->validated('is_active');

        if ($user->isOwner()) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
        if (! $isActive && $actor->id === $user->id) {
            throw new ApiException('CANNOT_DEACTIVATE_SELF', 422);
        }
        $this->guardAdminManagement($actor, $user);

        $user->update(['is_active' => $isActive]);
        if (! $isActive) {
            $user->tokens()->delete();
        }
        $user->load(['roles', 'teams']);

        return (new DirectoryUserResource($user))->response();
    }

    private function guardSameAgency(Request $request, User $target): void
    {
        abort_if($target->agency_id !== $request->user()->agency_id, 404);
    }
}
