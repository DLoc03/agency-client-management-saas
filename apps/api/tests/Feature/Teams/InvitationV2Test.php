<?php

namespace Tests\Feature\Teams;

use App\Mail\InvitationMail;
use App\Models\Client;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * BE-010 invitations v2 (DEC-020): an invitee who already has an
 * identity accepts by confirming while signed in — never by setting
 * a second password — and Portal access for a brand-new email is
 * granted through a client invitation link instead of an
 * agency-set password (superseding DEC-009.6).
 */
class InvitationV2Test extends TestCase
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

    /** membershipIn() needs an explicit context outside HTTP calls. */
    private function membershipOf(User $user, int $agencyId): ?Membership
    {
        return Tenant::bypass(fn () => $user->membershipIn($agencyId));
    }

    private function roleId(string $key): int
    {
        return Role::where('key', $key)->value('id');
    }

    /** Invite via the API and return [invitation id, raw token]. */
    private function invite(User $actor, string $email): array
    {
        Mail::fake();
        $response = $this->as($actor)->postJson('/api/v1/invitations', [
            'email' => $email,
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertCreated();
        $sent = null;
        Mail::assertSent(InvitationMail::class, function ($mail) use (&$sent) {
            $sent = $mail;

            return true;
        });

        return [$response->json('data.id'), Str::after($sent->acceptUrl, 'token=')];
    }

    public function test_existing_identity_must_sign_in_then_confirms_without_a_password(): void
    {
        $owner = $this->makeMembershipUser();
        // The invitee already has an identity (staff of another agency).
        $invitee = $this->makeMembershipUser([Role::TEAM_MEMBER]);
        $usersBefore = User::count();

        [$invitationId, $token] = $this->invite($owner, $invitee->email);
        $this->assertSame($invitee->id, Invitation::find($invitationId)->user_id);

        // Not signed in: the link alone no longer sets a password.
        $this->asGuest()->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'INVITATION_LOGIN_REQUIRED');

        // Signed in as the invited identity: plain confirmation.
        $this->as($invitee)->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertCreated()
            ->assertJsonPath('data.kind', 'staff');

        $membership = $this->membershipOf($invitee, $owner->agency_id);
        $this->assertNotNull($membership);
        $this->assertTrue($membership->hasRole(Role::TEAM_MEMBER));
        // No new identity, and the original password still works.
        $this->assertSame($usersBefore, User::count());
        $this->postJson('/api/v1/auth/login', [
            'email' => $invitee->email, 'password' => 'password',
        ])->assertOk();
    }

    public function test_signed_in_as_a_different_identity_is_a_mismatch(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = $this->makeMembershipUser([Role::TEAM_MEMBER]);
        $someoneElse = $this->makeMembershipUser([Role::TEAM_MEMBER]);

        [, $token] = $this->invite($owner, $invitee->email);

        $this->as($someoneElse)->postJson('/api/v1/invitations/accept', ['token' => $token])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'INVITATION_IDENTITY_MISMATCH');
        $this->assertNull($this->membershipOf($someoneElse, $owner->agency_id));
    }

    public function test_preview_reports_agency_roles_and_identity_state(): void
    {
        $owner = $this->makeMembershipUser();
        $invitee = $this->makeMembershipUser([Role::TEAM_MEMBER]);
        [, $token] = $this->invite($owner, $invitee->email);

        $this->asGuest()->getJson('/api/v1/invitations/preview?token='.$token)
            ->assertOk()
            ->assertJsonPath('data.agency.id', $owner->agency_id)
            ->assertJsonPath('data.email', $invitee->email)
            ->assertJsonPath('data.kind', 'staff')
            ->assertJsonPath('data.has_identity', true)
            ->assertJsonPath('data.matches_current_user', null)
            ->assertJsonPath('data.roles.0', Role::TEAM_MEMBER);

        $this->as($invitee)->getJson('/api/v1/invitations/preview?token='.$token)
            ->assertOk()
            ->assertJsonPath('data.matches_current_user', true);

        $this->asGuest()->getJson('/api/v1/invitations/preview?token=bogus')->assertNotFound();
    }

    public function test_portal_grant_to_an_existing_identity_is_immediate(): void
    {
        Mail::fake();
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $identity = $this->makeMembershipUser([Role::TEAM_MEMBER]); // staff elsewhere

        $this->as($owner)->postJson("/api/v1/clients/{$client->id}/portal-accounts", [
            'email' => $identity->email,
        ])->assertCreated();

        $membership = $this->membershipOf($identity, $owner->agency_id);
        $this->assertNotNull($membership);
        $this->assertSame(Membership::KIND_CLIENT, $membership->kind);
        $this->assertSame($client->id, $membership->client_id);
        $this->assertSame(0, Invitation::count());
        Mail::assertNothingSent();
    }

    public function test_portal_grant_to_a_new_email_uses_an_invitation_link(): void
    {
        Mail::fake();
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $response = $this->as($owner)->postJson("/api/v1/clients/{$client->id}/portal-accounts", [
            'email' => 'client.person@example.com',
        ])->assertCreated()
            ->assertJsonPath('data.kind', 'client')
            ->assertJsonPath('data.client_id', $client->id);

        // No identity and no membership exist yet — only the invitation.
        $this->assertNull(User::where('email', 'client.person@example.com')->first());
        $invitation = Invitation::find($response->json('data.id'));
        $this->assertSame(Invitation::KIND_CLIENT, $invitation->kind);

        $sent = null;
        Mail::assertSent(InvitationMail::class, function ($mail) use (&$sent) {
            $sent = $mail;

            return true;
        });
        $this->assertStringContainsString('/portal/accept-invitation?token=', $sent->acceptUrl);
        $token = Str::after($sent->acceptUrl, 'token=');

        // A second grant for the same email while pending -> 422.
        $this->as($owner)->postJson("/api/v1/clients/{$client->id}/portal-accounts", [
            'email' => 'client.person@example.com',
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVITATION_PENDING');

        // Accepting sets the invitee's own password and opens the Portal.
        $this->asGuest()->postJson('/api/v1/invitations/accept', [
            'token' => $token, 'name' => 'Client Person', 'password' => 'password123',
        ])->assertCreated()->assertJsonPath('data.kind', 'client');

        $user = User::where('email', 'client.person@example.com')->first();
        $membership = $this->membershipOf($user, $owner->agency_id);
        $this->assertSame(Membership::KIND_CLIENT, $membership->kind);
        $this->assertSame($client->id, $membership->client_id);
        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'client.person@example.com', 'password' => 'password123',
        ])->assertOk();
    }

    public function test_portal_grant_to_a_staff_member_of_the_same_agency_conflicts(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $staff = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        $this->as($owner)->postJson("/api/v1/clients/{$client->id}/portal-accounts", [
            'email' => $staff->email,
        ])->assertStatus(422)->assertJsonPath('error.code', 'STAFF_CLIENT_MEMBERSHIP_CONFLICT');
    }

    public function test_staff_accept_is_blocked_when_the_person_is_a_portal_client_here(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);

        // A staff invitation that somehow exists for this email must
        // still hit rule Q3 at accept time.
        $rawToken = Str::random(64);
        Invitation::create([
            'agency_id' => $owner->agency_id,
            'user_id' => $portalUser->id,
            'email' => $portalUser->email,
            'kind' => Invitation::KIND_STAFF,
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
            'token_hash' => hash('sha256', $rawToken),
            'expires_at' => now()->addDays(7),
            'invited_by' => $owner->id,
        ]);

        $this->withFreshToken($this->boundTokenFor($portalUser, 'portal'))
            ->postJson('/api/v1/invitations/accept', ['token' => $rawToken])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'STAFF_CLIENT_MEMBERSHIP_CONFLICT');
    }
}
