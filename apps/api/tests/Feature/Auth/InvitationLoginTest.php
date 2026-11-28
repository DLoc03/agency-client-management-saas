<?php

namespace Tests\Feature\Auth;

use App\Models\Client;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FIX-024 (DEC-030): an identity that exists but holds zero active
 * memberships used to dead-end at login with NO_ACTIVE_MEMBERSHIP —
 * even with a pending invitation, it could never sign in to accept.
 * Login now answers an invitation-scoped token (ability `invitation`,
 * no membership binding, 60 minutes) plus `invitation_only`, whose
 * only useful endpoint is POST /invitations/accept; the token is
 * deleted on a successful accept. Without a pending invitation the
 * refusal is unchanged.
 */
class InvitationLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /**
     * Send the next request with no credentials: the shared test app
     * instance otherwise keeps the previous request's token header
     * and cached Sanctum user (see Tests\TestCase).
     */
    private function asGuest(): static
    {
        auth()->forgetGuards();

        return $this->withHeader('Authorization', '');
    }

    private function login(string $email, string $surface = 'staff')
    {
        $url = $surface === 'portal' ? '/api/v1/portal/auth/login' : '/api/v1/auth/login';

        return $this->asGuest()->postJson($url, [
            'email' => $email,
            'password' => 'password',
        ]);
    }

    /**
     * Create an invitation for $email in the owner's agency and
     * return [invitation, raw accept token]. The factory's random
     * token hash is replaced via issueToken() so the raw token is
     * known to the test. $after holds state overrides (expires_at /
     * revoked_at / accepted_at) applied after issueToken(), which
     * itself resets the expiry to +7 days.
     */
    private function makeInvitation(User $owner, string $email, string $kind, array $attrs = [], array $after = []): array
    {
        return Tenant::run($owner->agency_id, function () use ($owner, $email, $kind, $attrs, $after) {
            $invitation = Invitation::factory()->create(array_merge([
                'agency_id' => $owner->agency_id,
                'email' => $email,
                'kind' => $kind,
                'invited_by' => $owner->id,
            ], $attrs));
            $rawToken = $invitation->issueToken();
            if ($after) {
                $invitation->forceFill($after);
            }
            $invitation->save();

            return [$invitation, $rawToken];
        });
    }

    private function membershipOf(User $user, int $agencyId): ?Membership
    {
        return Tenant::bypass(fn () => $user->membershipIn($agencyId));
    }

    public function test_staff_login_with_pending_invitation_returns_invitation_only_token(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = User::factory()->create();
        $this->makeInvitation($owner, $invitee->email, Invitation::KIND_STAFF, [
            'user_id' => $invitee->id,
        ]);

        $response = $this->login($invitee->email)->assertOk()
            ->assertJsonPath('data.invitation_only', true)
            ->assertJsonPath('data.invitation.kind', 'staff')
            ->assertJsonPath('data.invitation.agency.id', $owner->agency_id)
            ->assertJsonPath('data.identity.email', $invitee->email);

        $plainToken = $response->json('data.token');
        $this->assertNotEmpty($plainToken);

        $tokenRow = PersonalAccessToken::find((int) explode('|', $plainToken)[0]);
        $this->assertNotNull($tokenRow);
        $this->assertSame(['invitation'], $tokenRow->abilities);
        $this->assertNull($tokenRow->membership_id);
        $this->assertNull($tokenRow->agency_id);
    }

    public function test_invitation_token_accepts_is_deleted_and_fresh_login_is_normal(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = User::factory()->create();
        [, $rawToken] = $this->makeInvitation($owner, $invitee->email, Invitation::KIND_STAFF, [
            'user_id' => $invitee->id,
        ]);

        $login = $this->login($invitee->email)->assertOk();
        $invitationToken = $login->json('data.token');
        $tokenRowId = (int) explode('|', $invitationToken)[0];

        $this->withFreshToken($invitationToken)
            ->postJson('/api/v1/invitations/accept', ['token' => $rawToken])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'staff');

        $membership = $this->membershipOf($invitee, $owner->agency_id);
        $this->assertNotNull($membership);
        $this->assertTrue($membership->hasRole(Role::TEAM_MEMBER));

        // One-shot hygiene: the invitation token no longer exists.
        $this->assertNull(PersonalAccessToken::find($tokenRowId));

        // A fresh login is a normal session now — no invitation_only.
        $second = $this->login($invitee->email)->assertOk();
        $this->assertNotEmpty($second->json('data.token'));
        $this->assertNull($second->json('data.invitation_only'));
        $this->assertNotNull($second->json('data.membership'));
    }

    public function test_expired_invitation_token_on_accept_is_unauthenticated_not_login_required(): void
    {
        // QA-009-style probe (FIX-024 round 1, finding F-1): an expired
        // invitation token presented to the public accept route is an
        // authentication failure (401), never INVITATION_LOGIN_REQUIRED —
        // while the no-bearer guest path keeps its 403 below.
        $owner = $this->makeMembershipUser();
        $invitee = User::factory()->create();
        [$invitation, $rawToken] = $this->makeInvitation($owner, $invitee->email, Invitation::KIND_STAFF, [
            'user_id' => $invitee->id,
        ]);

        $login = $this->login($invitee->email)->assertOk();
        $invitationToken = $login->json('data.token');

        $this->travel(61)->minutes();

        $this->withFreshToken($invitationToken)
            ->postJson('/api/v1/invitations/accept', ['token' => $rawToken])
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');

        $this->assertNull($invitation->fresh()->accepted_at);
        $this->assertNull($this->membershipOf($invitee, $owner->agency_id));

        // Same request with NO bearer at all keeps the public semantics:
        // the identity exists but is not signed in -> 403 LOGIN_REQUIRED.
        $this->asGuest()
            ->postJson('/api/v1/invitations/accept', ['token' => $rawToken])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'INVITATION_LOGIN_REQUIRED');
    }

    public function test_no_membership_and_no_invitation_is_still_refused(): void
    {
        User::factory()->create(['email' => 'lonely@example.test']);

        $this->login('lonely@example.test')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');
    }

    public function test_expired_revoked_and_accepted_invitations_do_not_unlock_login(): void
    {
        $owner = $this->makeMembershipUser();

        $expired = User::factory()->create();
        $this->makeInvitation($owner, $expired->email, Invitation::KIND_STAFF, [
            'user_id' => $expired->id,
        ], ['expires_at' => now()->subDay()]);
        $this->login($expired->email)
            ->assertForbidden()
            ->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');

        $revoked = User::factory()->create();
        $this->makeInvitation($owner, $revoked->email, Invitation::KIND_STAFF, [
            'user_id' => $revoked->id,
        ], ['revoked_at' => now()]);
        $this->login($revoked->email)
            ->assertForbidden()
            ->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');

        $accepted = User::factory()->create();
        $this->makeInvitation($owner, $accepted->email, Invitation::KIND_STAFF, [
            'user_id' => $accepted->id,
        ], ['accepted_at' => now()]);
        $this->login($accepted->email)
            ->assertForbidden()
            ->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');
    }

    public function test_client_invitation_unlocks_portal_login_only_and_accepts(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $invitee = User::factory()->create();
        // Portal-grant invitations may carry no user_id — the pending
        // lookup must also match by email.
        [, $rawToken] = $this->makeInvitation($owner, $invitee->email, Invitation::KIND_CLIENT, [
            'client_id' => $client->id,
            'role_ids' => [],
        ]);

        // The staff surface stays closed for a client invitation.
        $this->login($invitee->email)
            ->assertForbidden()
            ->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');

        $login = $this->login($invitee->email, 'portal')->assertOk()
            ->assertJsonPath('data.invitation_only', true)
            ->assertJsonPath('data.invitation.kind', 'client');

        $this->withFreshToken($login->json('data.token'))
            ->postJson('/api/v1/invitations/accept', ['token' => $rawToken])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'client');

        $membership = $this->membershipOf($invitee, $owner->agency_id);
        $this->assertNotNull($membership);
        $this->assertSame(Membership::KIND_CLIENT, $membership->kind);
        $this->assertSame($client->id, $membership->client_id);
    }

    public function test_invitation_token_cannot_reach_tenant_endpoints_or_select_agency(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = User::factory()->create();
        $this->makeInvitation($owner, $invitee->email, Invitation::KIND_STAFF, [
            'user_id' => $invitee->id,
        ]);
        $invitationToken = $this->login($invitee->email)->assertOk()->json('data.token');

        $this->withFreshToken($invitationToken)->getJson('/api/v1/projects')
            ->assertForbidden();
        $this->withFreshToken($invitationToken)->getJson('/api/v1/clients')
            ->assertForbidden();
        // select-agency is gated by the `ability:select` route
        // middleware, so the invitation token is refused with 403
        // before the controller's membership lookup (which would 404)
        // is ever reached — it cannot be traded for a real session.
        $this->withFreshToken($invitationToken)
            ->postJson('/api/v1/auth/select-agency', [
                'membership_id' => $owner->testMembership->id,
            ])
            ->assertForbidden();
    }

    public function test_invitation_token_cannot_accept_another_identitys_invitation(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = User::factory()->create();
        $this->makeInvitation($owner, $invitee->email, Invitation::KIND_STAFF, [
            'user_id' => $invitee->id,
        ]);
        $invitationToken = $this->login($invitee->email)->assertOk()->json('data.token');

        $other = User::factory()->create();
        [, $otherRawToken] = $this->makeInvitation($owner, $other->email, Invitation::KIND_STAFF, [
            'user_id' => $other->id,
        ]);

        $this->withFreshToken($invitationToken)
            ->postJson('/api/v1/invitations/accept', ['token' => $otherRawToken])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'INVITATION_IDENTITY_MISMATCH');

        // The other invitation is untouched and nobody gained a membership.
        $this->assertNull($this->membershipOf($other, $owner->agency_id));
        $this->assertNull($this->membershipOf($invitee, $owner->agency_id));
    }
}
