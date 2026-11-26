<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Membership;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Workspace ownership transfer (BE-010, DEC-020).
 *
 * The Owner role is exclusive: exactly one active staff membership
 * per agency holds it. It is never granted through the roles API —
 * ownership changes hands only here, where the role leaves the old
 * membership and lands on the new one inside a single transaction,
 * so the agency never has zero or two owners. Both memberships'
 * tokens are revoked because both permission sets change.
 */
class OwnershipController extends Controller
{
    public function transfer(Request $request): JsonResponse
    {
        $request->validate([
            'membership_id' => ['required', 'integer'],
        ]);

        $actorMembership = $request->user()->currentMembership();
        if (! $actorMembership || ! $actorMembership->isOwner()) {
            throw new ApiException('OWNER_REQUIRED', 403);
        }

        // Tenant-scoped query: a membership of another agency (or a
        // client membership, or an inactive one) is simply not found.
        $target = Membership::query()
            ->where('kind', Membership::KIND_STAFF)
            ->where('is_active', true)
            ->find((int) $request->input('membership_id'));
        if (! $target) {
            abort(404);
        }
        if ($target->id === $actorMembership->id) {
            throw new ApiException('VALIDATION_FAILED', 422, ['field' => 'membership_id']);
        }

        DB::transaction(function () use ($actorMembership, $target) {
            $ownerRoleId = Role::where('key', Role::OWNER)->value('id');
            $actorMembership->roles()->detach($ownerRoleId);
            $target->roles()->syncWithoutDetaching([$ownerRoleId]);
            $actorMembership->revokeTokens();
            $target->revokeTokens();
        });

        return response()->json([
            'data' => [
                'membership_id' => $target->id,
                'user_id' => $target->user_id,
                'agency_id' => $target->agency_id,
                'roles' => $target->fresh()->roleKeys(),
            ],
        ]);
    }
}
