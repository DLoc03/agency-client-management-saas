<?php

namespace Tests\Feature\Clients;

use App\Mail\InvitationMail;
use App\Models\Client;
use App\Models\Role;
use App\Models\Tag;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * BE-004 Client module (docs/CLIENT_CONTRACT.md): CRUD, tenancy isolation,
 * RBAC matrix, contacts/notes/tags and the Portal account lifecycle.
 */
class ClientModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeUser(array $roles = [Role::OWNER], ?int $agencyId = null): User
    {
        return $this->makeMembershipUser($roles, $agencyId);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function makeClient(User $owner, array $attrs = []): Client
    {
        return Client::factory()->create(array_merge(['agency_id' => $owner->agency_id], $attrs));
    }

    public function test_owner_creates_client_with_organization_and_tags(): void
    {
        $owner = $this->makeUser();
        $tag = Tag::factory()->create(['agency_id' => $owner->agency_id, 'name' => 'vip']);

        $response = $this->as($owner)->postJson('/api/v1/clients', [
            'name' => 'Acme Corp',
            'type' => 'company',
            'account_manager_id' => $owner->id,
            'tag_ids' => [$tag->id],
            'organization' => ['legal_name' => 'Acme Co., Ltd', 'industry' => 'Retail'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Acme Corp')
            ->assertJsonPath('data.organization.legal_name', 'Acme Co., Ltd')
            ->assertJsonPath('data.tags.0.name', 'vip')
            ->assertJsonPath('data.portal_accounts_count', 0);
    }

    public function test_create_client_requires_name(): void
    {
        $owner = $this->makeUser();

        $this->as($owner)->postJson('/api/v1/clients', ['type' => 'company'])
            ->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_list_filters_by_status_tag_manager_and_search(): void
    {
        $owner = $this->makeUser();
        $manager = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $tag = Tag::factory()->create(['agency_id' => $owner->agency_id, 'name' => 'retail']);
        $a = $this->makeClient($owner, ['name' => 'Alpha Retail', 'status' => 'active', 'account_manager_id' => $manager->id]);
        $a->tags()->attach($tag);
        $this->makeClient($owner, ['name' => 'Beta Studio', 'status' => 'churned']);

        $this->as($owner)->getJson('/api/v1/clients?status=active')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha Retail');
        $this->as($owner)->getJson('/api/v1/clients?tag_id='.$tag->id)
            ->assertOk()->assertJsonCount(1, 'data');
        $this->as($owner)->getJson('/api/v1/clients?account_manager_id='.$manager->id)
            ->assertOk()->assertJsonCount(1, 'data');
        $this->as($owner)->getJson('/api/v1/clients?q=Beta')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta Studio');
    }

    public function test_cross_tenant_client_is_not_visible(): void
    {
        $ownerA = $this->makeUser();
        $clientA = $this->makeClient($ownerA);
        $ownerB = $this->makeUser();

        $this->as($ownerB)->getJson('/api/v1/clients/'.$clientA->id)->assertNotFound();
        $this->as($ownerB)->getJson('/api/v1/clients')->assertOk()->assertJsonCount(0, 'data');
        $this->as($ownerB)->patchJson('/api/v1/clients/'.$clientA->id, ['name' => 'Hijack'])->assertNotFound();
    }

    public function test_cross_tenant_references_are_rejected(): void
    {
        $ownerA = $this->makeUser();
        $ownerB = $this->makeUser();
        $foreignTag = Tag::factory()->create(['agency_id' => $ownerB->agency_id]);

        $this->as($ownerA)->postJson('/api/v1/clients', [
            'name' => 'X', 'account_manager_id' => $ownerB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->as($ownerA)->postJson('/api/v1/clients', [
            'name' => 'X', 'tag_ids' => [$foreignTag->id],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_role_matrix_is_enforced(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $team = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $owner->agency_id);
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);

        // DEC-009.3: Team Member has no clients.* at all.
        $this->as($team)->getJson('/api/v1/clients')->assertForbidden();
        // PM + Accountant are read-only.
        $this->as($pm)->getJson('/api/v1/clients')->assertOk();
        $this->as($pm)->postJson('/api/v1/clients', ['name' => 'Nope'])->assertForbidden();
        $this->as($accountant)->patchJson('/api/v1/clients/'.$client->id, ['name' => 'Nope'])->assertForbidden();
        // Sales can create/update but not delete.
        $this->as($sales)->postJson('/api/v1/clients', ['name' => 'Sales Client'])->assertCreated();
        $this->as($sales)->deleteJson('/api/v1/clients/'.$client->id)->assertForbidden();
        // DEC-009.5: Admin cannot delete either; only the Owner can.
        $this->as($admin)->deleteJson('/api/v1/clients/'.$client->id)->assertForbidden();
        $this->as($owner)->deleteJson('/api/v1/clients/'.$client->id)->assertNoContent();
    }

    public function test_contacts_crud_and_client_scoping(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $other = $this->makeClient($owner);

        $contactId = $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/contacts', [
            'full_name' => 'Jane Tran', 'email' => 'jane@acme.test', 'is_primary' => true,
        ])->assertCreated()->json('data.id');

        $this->as($owner)->patchJson('/api/v1/clients/'.$client->id.'/contacts/'.$contactId, [
            'position' => 'CEO',
        ])->assertOk()->assertJsonPath('data.position', 'CEO');

        // The same contact id under another client is a 404, not a leak.
        $this->as($owner)->patchJson('/api/v1/clients/'.$other->id.'/contacts/'.$contactId, [
            'position' => 'Hijack',
        ])->assertNotFound();

        $this->as($owner)->deleteJson('/api/v1/clients/'.$client->id.'/contacts/'.$contactId)->assertNoContent();
        $this->as($owner)->getJson('/api/v1/clients/'.$client->id.'/contacts')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_notes_are_internal_and_delete_is_author_owner_or_admin(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $sales2 = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);

        $noteId = $this->as($sales)->postJson('/api/v1/clients/'.$client->id.'/notes', [
            'body' => 'Client prefers email over calls.',
        ])->assertCreated()->json('data.id');

        $this->as($owner)->getJson('/api/v1/clients/'.$client->id.'/notes')
            ->assertOk()->assertJsonPath('data.0.body', 'Client prefers email over calls.')
            ->assertJsonPath('data.0.author.id', $sales->id);

        // Another sales user (not the author, not Owner/Admin) cannot delete it.
        $this->as($sales2)->deleteJson('/api/v1/clients/'.$client->id.'/notes/'.$noteId)->assertForbidden();
        // The author can.
        $this->as($sales)->deleteJson('/api/v1/clients/'.$client->id.'/notes/'.$noteId)->assertNoContent();
    }

    public function test_tags_are_unique_per_agency(): void
    {
        $ownerA = $this->makeUser();
        $ownerB = $this->makeUser();

        $this->as($ownerA)->postJson('/api/v1/tags', ['name' => 'vip'])->assertCreated();
        $this->as($ownerA)->postJson('/api/v1/tags', ['name' => 'vip'])
            ->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
        // Same name in another agency is fine.
        $this->as($ownerB)->postJson('/api/v1/tags', ['name' => 'vip'])->assertCreated();
    }

    public function test_portal_account_lifecycle(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);

        // BE-010 (DEC-020): a brand-new email no longer gets an
        // agency-set password — the grant sends an invitation link.
        Mail::fake();
        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/portal-accounts', [
            'email' => 'boss@acme.test',
        ])->assertCreated()
            ->assertJsonPath('data.kind', 'client')
            ->assertJsonPath('data.client_id', $client->id);

        // Granting again while the invitation is pending -> 422.
        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/portal-accounts', [
            'email' => 'boss@acme.test',
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVITATION_PENDING');

        // The invitee accepts the link and sets their own password.
        $sent = null;
        Mail::assertSent(InvitationMail::class, function ($mail) use (&$sent) {
            $sent = $mail;

            return true;
        });
        auth()->forgetGuards();
        $this->withHeader('Authorization', '')
            ->postJson('/api/v1/invitations/accept', [
                'token' => Str::after($sent->acceptUrl, 'token='),
                'name' => 'Acme Client', 'password' => 'secret123',
            ])->assertCreated();

        // Now the email resolves to the existing identity's active
        // access: granting again is rejected (DEC-018).
        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/portal-accounts', [
            'email' => 'boss@acme.test',
        ])->assertStatus(422)->assertJsonPath('error.code', 'EMAIL_ALREADY_REGISTERED');

        // The account can log into the Portal with its own password.
        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'boss@acme.test', 'password' => 'secret123',
        ])->assertOk();

        $accountId = $this->as($owner)->getJson('/api/v1/clients/'.$client->id.'/portal-accounts')
            ->assertOk()->json('data.0.id');

        // Disabling the access leaves the identity without any
        // active membership, so login answers NO_ACTIVE_MEMBERSHIP.
        $this->as($owner)->patchJson('/api/v1/clients/'.$client->id.'/portal-accounts/'.$accountId, [
            'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);
        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'boss@acme.test', 'password' => 'secret123',
        ])->assertForbidden()->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');
    }

    public function test_deleting_client_disables_its_portal_accounts(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $identity = $this->makePortalIdentity($owner->agency_id, $client->id, [
            'email' => 'boss@acme.test',
            'password' => Hash::make('secret123'),
        ]);
        $membership = $identity->testMembership;

        $this->as($owner)->deleteJson('/api/v1/clients/'.$client->id)->assertNoContent();

        // DEC-018 addition: deleting a client deactivates its Portal
        // memberships (and revokes their tokens).
        $this->assertFalse($membership->fresh()->is_active);
        $this->assertSoftDeleted('clients', ['id' => $client->id]);
        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'boss@acme.test', 'password' => 'secret123',
        ])->assertForbidden()->assertJsonPath('error.code', 'NO_ACTIVE_MEMBERSHIP');
    }

    public function test_portal_token_cannot_use_client_module(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $identity = $this->makePortalIdentity($owner->agency_id, $client->id);
        $portalToken = $this->boundTokenFor($identity, 'portal');

        $this->withFreshToken($portalToken)->getJson('/api/v1/clients')->assertForbidden();
    }
}
