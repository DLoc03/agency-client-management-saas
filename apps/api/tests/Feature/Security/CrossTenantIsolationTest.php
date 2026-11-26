<?php

namespace Tests\Feature\Security;

use App\Models\Agency;
use App\Models\Client;
use App\Models\ClientNote;
use App\Models\Contact;
use App\Models\Invitation;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadNote;
use App\Models\Membership;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Role;
use App\Models\Tag;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\Team;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CrossTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected Agency $agencyA;

    protected Agency $agencyB;

    protected User $ownerA;

    protected User $ownerB;

    protected Client $clientA;

    protected Client $clientB;

    protected Lead $leadA;

    protected Lead $leadB;

    protected Project $projectA;

    protected Project $projectB;

    protected Task $taskA;

    protected Task $taskB;

    protected Milestone $milestoneA;

    protected Milestone $milestoneB;

    protected Team $teamA;

    protected Team $teamB;

    protected Invitation $invitationB;

    protected User $portalUserA;

    protected User $portalUserB;

    protected Contact $contactB;

    protected ClientNote $noteB;

    protected LeadNote $leadNoteB;

    protected LeadActivity $activityB;

    protected TaskComment $commentB;

    protected TaskChecklistItem $checklistB;

    protected Tag $tagB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $this->agencyA = Agency::factory()->create(['name' => 'Agency A']);
        $this->agencyB = Agency::factory()->create(['name' => 'Agency B']);

        Tenant::run($this->agencyA->id, function () {
            $this->ownerA = $this->makeMembershipUser([Role::OWNER], $this->agencyA->id, [
                'email' => 'ownerA@acme.test', 'password' => Hash::make('secret123'),
            ]);
            $this->clientA = Client::factory()->create(['agency_id' => $this->agencyA->id, 'name' => 'Client A']);
            $this->leadA = Lead::factory()->create(['agency_id' => $this->agencyA->id]);
            $this->projectA = Project::factory()->create(['agency_id' => $this->agencyA->id, 'client_id' => $this->clientA->id, 'name' => 'Project A']);
            $this->milestoneA = Milestone::factory()->create(['project_id' => $this->projectA->id, 'agency_id' => $this->agencyA->id]);
            $this->taskA = Task::factory()->create(['project_id' => $this->projectA->id, 'agency_id' => $this->agencyA->id]);
            $this->teamA = Team::factory()->create(['agency_id' => $this->agencyA->id, 'name' => 'Team A']);
        });

        Tenant::run($this->agencyB->id, function () {
            $this->ownerB = $this->makeMembershipUser([Role::OWNER], $this->agencyB->id, [
                'email' => 'ownerB@acme.test', 'password' => Hash::make('secret123'),
            ]);
            $this->clientB = Client::factory()->create(['agency_id' => $this->agencyB->id, 'name' => 'Client B']);
            $this->leadB = Lead::factory()->create(['agency_id' => $this->agencyB->id]);
            $this->projectB = Project::factory()->create(['agency_id' => $this->agencyB->id, 'client_id' => $this->clientB->id, 'name' => 'Project B']);
            $this->milestoneB = Milestone::factory()->create(['project_id' => $this->projectB->id, 'agency_id' => $this->agencyB->id]);
            $this->taskB = Task::factory()->create(['project_id' => $this->projectB->id, 'agency_id' => $this->agencyB->id]);
            $this->commentB = TaskComment::factory()->create(['task_id' => $this->taskB->id, 'agency_id' => $this->agencyB->id]);
            $this->checklistB = TaskChecklistItem::factory()->create(['task_id' => $this->taskB->id]);
            $this->teamB = Team::factory()->create(['agency_id' => $this->agencyB->id, 'name' => 'Team B']);
            $this->invitationB = Invitation::factory()->create([
                'agency_id' => $this->agencyB->id,
                'email' => 'inviteB@acme.test',
                'invited_by' => $this->ownerB->id,
            ]);
            $this->contactB = Contact::factory()->create(['client_id' => $this->clientB->id]);
            $this->noteB = ClientNote::factory()->create(['client_id' => $this->clientB->id, 'author_id' => $this->ownerB->id]);
            $this->leadNoteB = LeadNote::factory()->create(['lead_id' => $this->leadB->id, 'author_id' => $this->ownerB->id]);
            $this->activityB = LeadActivity::factory()->create(['lead_id' => $this->leadB->id]);
            $this->tagB = Tag::factory()->create(['agency_id' => $this->agencyB->id]);
            $this->portalUserB = $this->makePortalIdentity($this->agencyB->id, $this->clientB->id, [
                'email' => 'portalB@acme.test', 'password' => Hash::make('secret123'),
            ]);
        });

        // portal A created after agency A data (needs clientA)
        Tenant::run($this->agencyA->id, function () {
            $this->portalUserA = $this->makePortalIdentity($this->agencyA->id, $this->clientA->id, [
                'email' => 'portalA@acme.test', 'password' => Hash::make('secret123'),
            ]);
        });
    }

    private function asA(): static
    {
        return $this->withFreshToken($this->boundTokenFor($this->ownerA));
    }

    private function asB(): static
    {
        return $this->withFreshToken($this->boundTokenFor($this->ownerB));
    }

    private function portalA(): static
    {
        return $this->withFreshToken($this->boundTokenFor($this->portalUserA, 'portal'));
    }

    private function portalB(): static
    {
        return $this->withFreshToken($this->boundTokenFor($this->portalUserB, 'portal'));
    }

    public function test_foreign_client_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/clients/'.$this->clientB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/clients/'.$this->clientB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/clients/'.$this->clientB->id)->assertNotFound();
    }

    public function test_foreign_client_child_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/clients/'.$this->clientB->id.'/contacts')->assertNotFound();
        $this->asA()->postJson('/api/v1/clients/'.$this->clientB->id.'/contacts', ['full_name' => 'x'])->assertNotFound();
        $this->asA()->getJson('/api/v1/clients/'.$this->clientB->id.'/notes')->assertNotFound();
        $this->asA()->postJson('/api/v1/clients/'.$this->clientB->id.'/notes', ['body' => 'x'])->assertNotFound();
        $this->asA()->getJson('/api/v1/clients/'.$this->clientB->id.'/portal-accounts')->assertNotFound();
        $this->asA()->postJson('/api/v1/clients/'.$this->clientB->id.'/portal-accounts', ['email' => 'x@y.test'])->assertNotFound();
    }

    public function test_foreign_client_child_id_endpoints_are_404(): void
    {
        $this->asA()->patchJson('/api/v1/clients/'.$this->clientA->id.'/contacts/'.$this->contactB->id, ['full_name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/clients/'.$this->clientA->id.'/contacts/'.$this->contactB->id)->assertNotFound();
        $this->asA()->deleteJson('/api/v1/clients/'.$this->clientA->id.'/notes/'.$this->noteB->id)->assertNotFound();
    }

    public function test_foreign_lead_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/leads/'.$this->leadB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/leads/'.$this->leadB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/leads/'.$this->leadB->id)->assertNotFound();
    }

    public function test_foreign_lead_child_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/leads/'.$this->leadB->id.'/activities')->assertNotFound();
        $this->asA()->postJson('/api/v1/leads/'.$this->leadB->id.'/activities', ['type' => 'call', 'scheduled_at' => now()->addDay()->toDateTimeString()])->assertNotFound();
        $this->asA()->getJson('/api/v1/leads/'.$this->leadB->id.'/contacts')->assertNotFound();
        $this->asA()->postJson('/api/v1/leads/'.$this->leadB->id.'/contacts', ['full_name' => 'x'])->assertNotFound();
        $this->asA()->getJson('/api/v1/leads/'.$this->leadB->id.'/notes')->assertNotFound();
        $this->asA()->postJson('/api/v1/leads/'.$this->leadB->id.'/notes', ['body' => 'x'])->assertNotFound();
    }

    public function test_foreign_lead_child_id_endpoints_are_404(): void
    {
        $this->asA()->patchJson('/api/v1/leads/'.$this->leadA->id.'/activities/'.$this->activityB->id, ['note' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/leads/'.$this->leadA->id.'/activities/'.$this->activityB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/leads/'.$this->leadA->id.'/contacts/'.$this->contactB->id, ['full_name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/leads/'.$this->leadA->id.'/contacts/'.$this->contactB->id)->assertNotFound();
        $this->asA()->deleteJson('/api/v1/leads/'.$this->leadA->id.'/notes/'.$this->leadNoteB->id)->assertNotFound();
        $this->asA()->postJson('/api/v1/leads/'.$this->leadB->id.'/convert', [])->assertNotFound();
    }

    public function test_foreign_project_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/projects/'.$this->projectB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/projects/'.$this->projectB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/projects/'.$this->projectB->id)->assertNotFound();
    }

    public function test_foreign_project_child_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/projects/'.$this->projectB->id.'/members')->assertNotFound();
        $this->asA()->postJson('/api/v1/projects/'.$this->projectB->id.'/members', ['user_id' => $this->ownerA->id])->assertNotFound();
        $this->asA()->getJson('/api/v1/projects/'.$this->projectB->id.'/milestones')->assertNotFound();
        $this->asA()->postJson('/api/v1/projects/'.$this->projectB->id.'/milestones', ['name' => 'x', 'due_date' => now()->addDay()->toDateString()])->assertNotFound();
        $this->asA()->getJson('/api/v1/projects/'.$this->projectB->id.'/tasks')->assertNotFound();
        $this->asA()->postJson('/api/v1/projects/'.$this->projectB->id.'/tasks', ['title' => 'x'])->assertNotFound();
        $this->asA()->postJson('/api/v1/projects/'.$this->projectB->id.'/teams', ['team_id' => $this->teamA->id])->assertNotFound();
        $this->asA()->getJson('/api/v1/projects/'.$this->projectB->id.'/timeline')->assertNotFound();
    }

    public function test_foreign_project_child_id_endpoints_are_404(): void
    {
        $this->asA()->deleteJson('/api/v1/projects/'.$this->projectA->id.'/members/'.$this->ownerB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/projects/'.$this->projectA->id.'/milestones/'.$this->milestoneB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/projects/'.$this->projectA->id.'/milestones/'.$this->milestoneB->id)->assertNotFound();
        $this->asA()->deleteJson('/api/v1/projects/'.$this->projectA->id.'/teams/'.$this->teamB->id)->assertNotFound();
    }

    public function test_foreign_task_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/tasks/'.$this->taskB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/tasks/'.$this->taskB->id, ['title' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/tasks/'.$this->taskB->id)->assertNotFound();
        $this->asA()->getJson('/api/v1/tasks/'.$this->taskB->id.'/checklist')->assertNotFound();
        $this->asA()->postJson('/api/v1/tasks/'.$this->taskB->id.'/checklist', ['title' => 'x'])->assertNotFound();
        $this->asA()->getJson('/api/v1/tasks/'.$this->taskB->id.'/comments')->assertNotFound();
        $this->asA()->postJson('/api/v1/tasks/'.$this->taskB->id.'/comments', ['body' => 'x'])->assertNotFound();
    }

    public function test_foreign_task_child_id_endpoints_are_404(): void
    {
        $this->asA()->patchJson('/api/v1/tasks/'.$this->taskA->id.'/checklist/'.$this->checklistB->id, ['title' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/tasks/'.$this->taskA->id.'/checklist/'.$this->checklistB->id)->assertNotFound();
        $this->asA()->deleteJson('/api/v1/tasks/'.$this->taskA->id.'/comments/'.$this->commentB->id)->assertNotFound();
    }

    public function test_foreign_team_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/teams/'.$this->teamB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/teams/'.$this->teamB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/teams/'.$this->teamB->id)->assertNotFound();
        $this->asA()->postJson('/api/v1/teams/'.$this->teamB->id.'/members', ['user_id' => $this->ownerA->id])->assertNotFound();
        $this->asA()->deleteJson('/api/v1/teams/'.$this->teamA->id.'/members/'.$this->ownerB->id)->assertNotFound();
    }

    public function test_foreign_invitation_endpoints_are_404(): void
    {
        $this->asA()->deleteJson('/api/v1/invitations/'.$this->invitationB->id)->assertNotFound();
        $this->asA()->postJson('/api/v1/invitations/'.$this->invitationB->id.'/resend')->assertNotFound();
    }

    public function test_foreign_user_endpoints_are_404(): void
    {
        $this->asA()->getJson('/api/v1/users/'.$this->ownerB->id)->assertNotFound();
        $this->asA()->patchJson('/api/v1/users/'.$this->ownerB->id, ['name' => 'x'])->assertNotFound();
        $this->asA()->patchJson('/api/v1/users/'.$this->ownerB->id.'/activation', ['is_active' => false])->assertNotFound();
        $this->asA()->putJson('/api/v1/users/'.$this->ownerB->id.'/roles', ['role_ids' => [Role::where('key', Role::TEAM_MEMBER)->value('id')]])->assertNotFound();
    }

    public function test_foreign_ownership_transfer_is_404(): void
    {
        $foreignMembership = $this->ownerB->testMembership;
        $this->asA()->postJson('/api/v1/ownership/transfer', [
            'membership_id' => $foreignMembership->id,
        ])->assertNotFound();
    }

    public function test_list_endpoints_exclude_foreign_records(): void
    {
        $this->asA()->getJson('/api/v1/clients')->assertOk()
            ->assertJsonMissing(['name' => 'Client B']);
        $this->asA()->getJson('/api/v1/leads')->assertOk()
            ->assertJsonMissing(['name' => $this->leadB->name]);
        $this->asA()->getJson('/api/v1/projects')->assertOk()
            ->assertJsonMissing(['name' => 'Project B']);
        $this->asA()->getJson('/api/v1/teams')->assertOk()
            ->assertJsonMissing(['name' => 'Team B']);
        $this->asA()->getJson('/api/v1/users')->assertOk()
            ->assertJsonMissing(['email' => 'ownerB@acme.test']);
        $this->asA()->getJson('/api/v1/invitations')->assertOk()
            ->assertJsonMissing(['email' => 'inviteB@acme.test']);
    }

    public function test_cross_tenant_references_are_422(): void
    {
        $this->asA()->postJson('/api/v1/projects', [
            'client_id' => $this->clientB->id,
            'name' => 'Nope',
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->asA()->postJson('/api/v1/teams', [
            'name' => 'Team X', 'lead_id' => $this->ownerB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->asA()->postJson('/api/v1/clients', [
            'name' => 'New', 'type' => Client::TYPE_COMPANY,
            'account_manager_id' => $this->ownerB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_scenario_a_one_identity_two_agencies_isolated_by_token(): void
    {
        $user = $this->makeMembershipUser([Role::OWNER], $this->agencyA->id, [
            'email' => 'both@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $membershipB = Membership::create([
            'user_id' => $user->id,
            'agency_id' => $this->agencyB->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);
        $membershipB->roles()->sync(Role::where('key', Role::OWNER)->pluck('id'));

        Client::factory()->create(['agency_id' => $this->agencyA->id, 'name' => 'Only A']);
        Client::factory()->create(['agency_id' => $this->agencyB->id, 'name' => 'Only B']);

        $tokenA = $this->boundTokenFor($user);
        $this->withFreshToken($tokenA)->getJson('/api/v1/clients')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Only B']);

        $tokenB = $this->withFreshToken($tokenA)
            ->postJson('/api/v1/auth/switch-agency', ['membership_id' => $membershipB->id])
            ->json('data.token');
        $this->withFreshToken($tokenB)->getJson('/api/v1/clients')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Only A']);
    }

    public function test_scenario_b_select_agency_without_membership_is_rejected(): void
    {
        $user = $this->makeMembershipUser([Role::OWNER], $this->agencyA->id, [
            'email' => 'single@acme.test', 'password' => Hash::make('secret123'),
        ]);
        $extra = Membership::create([
            'user_id' => $user->id,
            'agency_id' => $this->agencyB->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);
        $extra->roles()->sync(Role::where('key', Role::OWNER)->pluck('id'));
        $foreignMembership = $this->ownerB->testMembership;

        $selectionToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'single@acme.test', 'password' => 'secret123',
        ])->json('data.selection_token');
        $this->assertNotEmpty($selectionToken);

        $this->withFreshToken($selectionToken)
            ->postJson('/api/v1/auth/select-agency', ['membership_id' => $foreignMembership->id])
            ->assertNotFound();

        $token = $this->boundTokenFor($user);
        $this->withFreshToken($token)->getJson('/api/v1/clients?agency_id='.$this->agencyB->id)
            ->assertOk();
    }

    public function test_scenario_c_deactivated_membership_loses_access(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER], $this->agencyA->id);
        $token = $this->boundTokenFor($owner);
        $this->withFreshToken($token)->getJson('/api/v1/clients')->assertOk();

        $owner->testMembership->deactivate();
        $this->withFreshToken($token)->getJson('/api/v1/clients')->assertUnauthorized();

        $token2 = $this->boundTokenFor($owner);
        Membership::whereKey($owner->testMembership->id)->update(['is_active' => false]);
        $this->withFreshToken($token2)->getJson('/api/v1/clients')
            ->assertForbidden()->assertJsonPath('error.code', 'MEMBERSHIP_INACTIVE');

        $extra = Membership::create([
            'user_id' => $owner->id,
            'agency_id' => $this->agencyB->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);
        $extra->roles()->sync(Role::where('key', Role::OWNER)->pluck('id'));
        $owner->testMembership = $extra;
        $token3 = $this->boundTokenFor($owner);
        $this->withFreshToken($token3)->getJson('/api/v1/clients')->assertOk();
    }

    public function test_portal_token_only_sees_own_client_projects(): void
    {
        $this->portalA()->getJson('/api/v1/portal/projects')->assertOk();
        $this->portalA()->getJson('/api/v1/portal/projects/'.$this->projectB->id)->assertNotFound();
        $this->portalB()->getJson('/api/v1/portal/projects/'.$this->projectA->id)->assertNotFound();
    }

    public function test_portal_foreign_client_same_agency_is_404(): void
    {
        $otherClient = Client::factory()->create(['agency_id' => $this->agencyA->id, 'name' => 'Other Client A']);
        $otherProject = Project::factory()->create(['agency_id' => $this->agencyA->id, 'client_id' => $otherClient->id, 'name' => 'Other Project A']);
        $this->portalA()->getJson('/api/v1/portal/projects/'.$otherProject->id)->assertNotFound();
    }
}
