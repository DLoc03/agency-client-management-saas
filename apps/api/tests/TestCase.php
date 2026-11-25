<?php

namespace Tests;

use App\Models\Agency;
use App\Models\Membership;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Feature tests share one application instance across requests, and the
     * Sanctum guard caches the resolved user. Forget guards before sending a
     * request with a different (or revoked) token so it is re-read from the
     * Authorization header — mirroring production, where each request is a
     * fresh process.
     */
    protected function withFreshToken(string $token): static
    {
        auth()->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }

    /**
     * DEC-018 fixture: an identity plus an active STAFF membership
     * (with roles) in one agency. The returned user carries the
     * membership as `testMembership` and an `agency_id` attribute
     * bridge so pre-DEC-018 test code keeps reading it.
     */
    protected function makeMembershipUser(array $roles = [Role::OWNER], ?int $agencyId = null, array $userAttrs = []): User
    {
        $user = User::factory()->create($userAttrs);
        $membership = Membership::create([
            'user_id' => $user->id,
            'agency_id' => $agencyId ?? Agency::factory()->create()->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);
        $membership->roles()->sync(Role::whereIn('key', $roles)->pluck('id'));

        $user->testMembership = $membership;
        $user->setAttribute('agency_id', $membership->agency_id);
        $user->syncOriginalAttribute('agency_id');

        return $user;
    }

    /** DEC-018 fixture: an identity plus an active CLIENT membership. */
    protected function makePortalIdentity(int $agencyId, int $clientId, array $userAttrs = []): User
    {
        $user = User::factory()->create($userAttrs);
        $membership = Membership::create([
            'user_id' => $user->id,
            'agency_id' => $agencyId,
            'kind' => Membership::KIND_CLIENT,
            'client_id' => $clientId,
            'is_active' => true,
        ]);

        $user->testMembership = $membership;
        $user->setAttribute('agency_id', $agencyId);
        $user->syncOriginalAttribute('agency_id');

        return $user;
    }

    /** A token bound to the user's test membership (app or portal). */
    protected function boundTokenFor(User $user, string $ability = 'app'): string
    {
        $membership = $user->testMembership
            ?? Tenant::bypass(fn () => $user->memberships()->first());

        $token = $user->createToken($ability, [$ability]);
        $token->accessToken->forceFill([
            'agency_id' => $membership->agency_id,
            'membership_id' => $membership->id,
        ])->save();

        return $token->plainTextToken;
    }
}
