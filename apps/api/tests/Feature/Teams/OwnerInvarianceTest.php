<?php

namespace Tests\Feature\Teams;

use App\Models\Client;
use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-010 owner invariance (DEC-020): exactly one active staff
 * membership per agency holds the Owner role. The role cannot be
 * granted or stripped through the roles API; it changes hands only
 * through the transfer endpoint, atomically. Plus the client-delete
 * cascade onto Portal memberships.
 */
class OwnerInvarianceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function roleId(string $key): int
    {
        return Role::where('key', $key)->value('id');
    }

    private function ownerMemberships(int $agencyId): int
    {
        return Membership::withoutGlobalScopes()
            ->where('agency_id', $agencyId)
            ->where('kind', Membership::KIND_STAFF)
            ->whereHas('roles', fn ($q) => $q->where('key', Role::OWNER))
            ->count();
    }

    public function test_transfer_moves_the_owner_role_atomically_and_revokes_both_sessions(): void
    {
        $owner = $this->makeMembershipUser();
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $this->boundTokenFor($owner);
        $this->boundTokenFor($member);
        $this->assertSame(1, $this->ownerMemberships($owner->agency_id));

        $this->as($owner)->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $member->testMembership->id,
        ])->assertOk()
            ->assertJsonPath('data.membership_id', $member->testMembership->id);
        $this->assertEqualsCanonicalizing(
            [Role::TEAM_MEMBER, Role::OWNER],
            $member->testMembership->fresh()->roleKeys()
        );

        $this->assertSame(1, $this->ownerMemberships($owner->agency_id));
        $this->assertTrue($member->testMembership->fresh()->isOwner());
        $this->assertFalse($owner->testMembership->fresh()->isOwner());
        // Both permission sets changed, so both sessions are revoked.
        $this->assertSame(0, PersonalAccessToken::whereIn('membership_id', [
            $owner->testMembership->id, $member->testMembership->id,
        ])->count());
    }

    public function test_only_the_owner_can_transfer(): void
    {
        $owner = $this->makeMembershipUser();
        $admin = $this->makeMembershipUser([Role::ADMIN], $owner->agency_id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        $this->as($admin)->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $member->testMembership->id,
        ])->assertForbidden()->assertJsonPath('error.code', 'OWNER_REQUIRED');
        $this->assertSame(1, $this->ownerMemberships($owner->agency_id));
    }

    public function test_transfer_rejects_self_client_and_foreign_targets(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);
        $foreign = $this->makeMembershipUser([Role::TEAM_MEMBER]); // other agency

        $this->as($owner)->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $owner->testMembership->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $portalMembership = $portalUser->testMembership;
        $this->as($owner)->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $portalMembership->id,
        ])->assertNotFound();

        $this->as($owner)->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $foreign->testMembership->id,
        ])->assertNotFound();

        $this->assertSame(1, $this->ownerMemberships($owner->agency_id));
    }

    public function test_roles_api_can_never_grant_or_strip_the_owner_role(): void
    {
        $owner = $this->makeMembershipUser();
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        // Granting Owner through the roles API -> 403.
        $this->as($owner)->putJson("/api/v1/users/{$member->id}/roles", [
            'role_ids' => [$this->roleId(Role::OWNER)],
        ])->assertForbidden()->assertJsonPath('error.code', 'CANNOT_MODIFY_OWNER');

        // Touching the Owner's own roles -> 403.
        $this->as($owner)->putJson("/api/v1/users/{$owner->id}/roles", [
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertForbidden()->assertJsonPath('error.code', 'CANNOT_MODIFY_OWNER');

        $this->assertSame(1, $this->ownerMemberships($owner->agency_id));
    }

    public function test_admin_cannot_grant_the_admin_role(): void
    {
        $owner = $this->makeMembershipUser();
        $admin = $this->makeMembershipUser([Role::ADMIN], $owner->agency_id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        $this->as($admin)->putJson("/api/v1/users/{$member->id}/roles", [
            'role_ids' => [$this->roleId(Role::ADMIN)],
        ])->assertForbidden()->assertJsonPath('error.code', 'ADMIN_MANAGEMENT_OWNER_ONLY');
    }

    public function test_deleting_a_client_deactivates_its_portal_memberships_and_revokes_tokens(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);
        $portalToken = $this->boundTokenFor($portalUser, 'portal');
        $membership = $portalUser->testMembership;

        $this->as($owner)->deleteJson("/api/v1/clients/{$client->id}")->assertNoContent();

        $this->assertFalse($membership->fresh()->is_active);
        $this->assertSame(0, PersonalAccessToken::where('membership_id', $membership->id)->count());

        // The dead session is refused on its next request: the
        // token itself was revoked, so this is a plain 401.
        $this->withFreshToken($portalToken)->getJson('/api/v1/portal/auth/me')
            ->assertUnauthorized();
    }
}
