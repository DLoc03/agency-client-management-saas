<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\Membership;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LastMembershipAutoSelectTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function addStaffMembership(User $user, Agency $agency, array $roles = [Role::OWNER]): Membership
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

    public function test_relogin_auto_selects_the_last_used_agency(): void
    {
        $agencyA = Agency::factory()->create(['name' => 'Agency A']);
        $agencyB = Agency::factory()->create(['name' => 'Agency B']);
        $user = $this->makeMembershipUser([Role::OWNER], $agencyA->id, [
            'email' => 'remember@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $membershipB = $this->addStaffMembership($user, $agencyB, [Role::OWNER]);

        $selectionToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'remember@acme.test', 'password' => 'secret123',
        ])->json('data.selection_token');
        $this->assertNotEmpty($selectionToken);

        $this->withFreshToken($selectionToken)
            ->postJson('/api/v1/auth/select-agency', ['membership_id' => $membershipB->id])
            ->assertOk();

        // Re-login: the remembered agency is chosen automatically, so a
        // full token is issued without a selection token.
        $relogin = $this->postJson('/api/v1/auth/login', [
            'email' => 'remember@acme.test', 'password' => 'secret123',
        ])->assertOk();
        $relogin->assertJsonPath('data.agency.id', $agencyB->id);
        $this->assertArrayNotHasKey('selection_token', $relogin->json('data'));
        $token = $relogin->json('data.token');
        $this->assertNotEmpty($token);

        // The issued token is bound to agency B's context.
        $this->withFreshToken($token)->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.agency.id', $agencyB->id);
    }
}
