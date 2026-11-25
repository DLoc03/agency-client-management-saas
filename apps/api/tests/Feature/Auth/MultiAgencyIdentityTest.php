<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Membership;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * DEC-018 identity behaviours: one identity, many agencies.
 * Covers the Phase-2 acceptance scenarios from the approved design:
 * selection flow, selection-token restrictions (addition 4),
 * mid-session membership revocation, client deletion cascading to
 * Portal memberships (addition 3) and the staff/client kind
 * conflict (rule Q3).
 */
class MultiAgencyIdentityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** Give an identity an extra staff membership in another agency. */
    private function addStaffMembership(User $user, Agency $agency, array $roles = [Role::TEAM_MEMBER]): Membership
    {
        $membership = Membership::create([
            'user_id' => $user->id,
            'agency_id' => $agency->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);
        $membership->roles()->sync(Role::whereIn('key', $roles)->pluck('id'));

        return $membership;
    }

    public function test_login_with_two_agencies_returns_selection_then_binds_token(): void
    {
        $agencyA = Agency::factory()->create(['name' => 'Agency A']);
        $agencyB = Agency::factory()->create(['name' => 'Agency B']);
        $user = $this->makeMembershipUser([Role::OWNER], $agencyA->id, [
            'email' => 'multi@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $membershipB = $this->addStaffMembership($user, $agencyB, [Role::OWNER]);
        Client::factory()->create(['agency_id' => $agencyA->id, 'name' => 'Client of A']);
        Client::factory()->create(['agency_id' => $agencyB->id, 'name' => 'Client of B']);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'multi@acme.test', 'password' => 'secret123',
        ])->assertOk()
            ->assertJsonCount(2, 'data.memberships')
            ->assertJsonPath('data.memberships.1.agency.id', $agencyB->id);

        $selectionToken = $login->json('data.selection_token');
        $this->assertNotEmpty($selectionToken);

        // Choosing agency B issues a session bound to that membership;
        // only agency B data is visible through it.
        $session = $this->withFreshToken($selectionToken)
            ->postJson('/api/v1/auth/select-agency', ['membership_id' => $membershipB->id])
            ->assertOk()
            ->assertJsonPath('data.agency.id', $agencyB->id);
        $tokenB = $session->json('data.token');

        $this->withFreshToken($tokenB)->getJson('/api/v1/clients')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Client of B');

        // The choice is remembered: the next login goes straight in.
        $this->postJson('/api/v1/auth/login', [
            'email' => 'multi@acme.test', 'password' => 'secret123',
        ])->assertOk()->assertJsonPath('data.agency.id', $agencyB->id);
    }

    public function test_selection_token_is_rejected_everywhere_except_select_and_switch(): void
    {
        $agencyB = Agency::factory()->create();
        $user = $this->makeMembershipUser([Role::OWNER], null, [
            'email' => 'multi@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $this->addStaffMembership($user, $agencyB, [Role::OWNER]);

        $selectionToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'multi@acme.test', 'password' => 'secret123',
        ])->json('data.selection_token');
        $this->assertNotEmpty($selectionToken);

        // Business and profile endpoints refuse the selection token.
        $this->withFreshToken($selectionToken)->getJson('/api/v1/clients')->assertForbidden();
        $this->withFreshToken($selectionToken)->getJson('/api/v1/auth/me')->assertForbidden();
        $this->withFreshToken($selectionToken)->getJson('/api/v1/users')->assertForbidden();
        $this->withFreshToken($selectionToken)->getJson('/api/v1/projects')->assertForbidden();

        // Only the selection endpoint accepts it.
        $this->withFreshToken($selectionToken)
            ->postJson('/api/v1/auth/select-agency', ['membership_id' => $user->testMembership->id])
            ->assertOk();
    }

    public function test_client_supplied_agency_id_never_changes_the_tenant(): void
    {
        $agencyB = Agency::factory()->create();
        $owner = $this->makeMembershipUser([Role::OWNER]);
        Client::factory()->create(['agency_id' => $owner->agency_id, 'name' => 'Mine']);
        Client::factory()->create(['agency_id' => $agencyB->id, 'name' => 'Theirs']);

        // A foreign agency_id in the query string is ignored: the
        // tenant always comes from the token's membership.
        $this->as2($owner)->getJson('/api/v1/clients?agency_id='.$agencyB->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Mine');
    }

    public function test_deactivated_membership_loses_access_immediately(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $token = $this->boundTokenFor($owner);
        $this->withFreshToken($token)->getJson('/api/v1/clients')->assertOk();

        // Deactivation through the model revokes the membership's
        // tokens, so the very next request is unauthenticated.
        $owner->testMembership->deactivate();
        $this->withFreshToken($token)->getJson('/api/v1/clients')->assertUnauthorized();

        // If a token somehow survives while its membership is
        // inactive, ResolveTenant refuses it and deletes it.
        $token2 = $this->boundTokenFor($owner);
        Membership::whereKey($owner->testMembership->id)->update(['is_active' => false]);
        $this->withFreshToken($token2)->getJson('/api/v1/clients')
            ->assertForbidden()->assertJsonPath('error.code', 'MEMBERSHIP_INACTIVE');
    }

    public function test_deleting_a_client_revokes_its_portal_tokens(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);
        $portalToken = $this->boundTokenFor($portalUser, 'portal');
        $this->withFreshToken($portalToken)->getJson('/api/v1/portal/projects')->assertOk();

        $this->as2($owner)->deleteJson('/api/v1/clients/'.$client->id)->assertNoContent();

        $this->withFreshToken($portalToken)->getJson('/api/v1/portal/projects')->assertUnauthorized();
    }

    public function test_staff_member_cannot_be_granted_portal_access_in_same_agency(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $staff = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        // Rule Q3: one person cannot be both staff and client of the
        // same agency.
        $this->as2($owner)->postJson('/api/v1/clients/'.$client->id.'/portal-accounts', [
            'name' => $staff->name, 'email' => $staff->email, 'password' => 'secret123',
        ])->assertStatus(422)->assertJsonPath('error.code', 'STAFF_CLIENT_MEMBERSHIP_CONFLICT');
    }

    public function test_same_person_can_be_staff_here_and_client_elsewhere(): void
    {
        $agencyB = Agency::factory()->create();
        $staff = $this->makeMembershipUser([Role::TEAM_MEMBER], null, [
            'email' => 'both@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $clientB = Client::factory()->create(['agency_id' => $agencyB->id]);
        Membership::create([
            'user_id' => $staff->id,
            'agency_id' => $agencyB->id,
            'kind' => Membership::KIND_CLIENT,
            'client_id' => $clientB->id,
            'is_active' => true,
        ]);

        // Portal login sees the client membership; app login sees the
        // staff membership — one identity, one password.
        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'both@acme.test', 'password' => 'secret123',
        ])->assertOk()->assertJsonPath('data.agency.id', $agencyB->id);
        $this->postJson('/api/v1/auth/login', [
            'email' => 'both@acme.test', 'password' => 'secret123',
        ])->assertOk()->assertJsonPath('data.agency.id', $staff->agency_id);
    }

    private function as2(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }
}
