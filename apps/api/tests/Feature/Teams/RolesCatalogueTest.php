<?php

namespace Tests\Feature\Teams;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-014: GET /roles — the roles catalogue behind the invite modal and
 * the member role form. Access requires EITHER invitations.manage OR
 * users.roles.manage on the caller's current membership.
 */
class RolesCatalogueTest extends TestCase
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

    public function test_owner_gets_the_full_catalogue_in_seed_order(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);

        $response = $this->as($owner)->getJson('/api/v1/roles');

        $response->assertOk()->assertJsonCount(6, 'data');
        $this->assertSame(
            [Role::OWNER, Role::ADMIN, Role::SALES_MANAGER, Role::PROJECT_MANAGER, Role::TEAM_MEMBER, Role::ACCOUNTANT],
            array_column($response->json('data'), 'key')
        );
        $response->assertJsonPath('data.0.name', 'Agency Owner')
            ->assertJsonPath('data.5.name', 'Accountant');
        foreach ($response->json('data') as $role) {
            $this->assertSame(['id', 'key', 'name'], array_keys($role));
        }
    }

    public function test_membership_with_only_invitations_manage_can_list_roles(): void
    {
        // No stock role separates the two permissions (only Owner and
        // Admin hold them, and both hold both), so narrow a stock role's
        // permission list via config to exercise the either-branch.
        config()->set('rbac.roles.'.Role::SALES_MANAGER, ['invitations.manage']);
        $user = $this->makeMembershipUser([Role::SALES_MANAGER]);

        $this->as($user)->getJson('/api/v1/roles')
            ->assertOk()
            ->assertJsonCount(6, 'data');
    }

    public function test_membership_with_only_users_roles_manage_can_list_roles(): void
    {
        config()->set('rbac.roles.'.Role::PROJECT_MANAGER, ['users.roles.manage']);
        $user = $this->makeMembershipUser([Role::PROJECT_MANAGER]);

        $this->as($user)->getJson('/api/v1/roles')
            ->assertOk()
            ->assertJsonCount(6, 'data');
    }

    public function test_team_member_without_either_permission_is_forbidden(): void
    {
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER]);

        $this->as($member)->getJson('/api/v1/roles')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_portal_token_is_rejected(): void
    {
        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $portal = $this->makePortalIdentity($agency->id, $client->id);

        $this->withFreshToken($this->boundTokenFor($portal, 'portal'))
            ->getJson('/api/v1/roles')
            ->assertForbidden();
    }

    public function test_guest_is_unauthorized(): void
    {
        $this->getJson('/api/v1/roles')->assertUnauthorized();
    }
}
