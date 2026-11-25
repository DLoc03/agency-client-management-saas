<?php

namespace Tests\Feature\Security;

use App\Models\Client;
use App\Models\ClientAccount;
use App\Models\ClientNote;
use App\Models\Contact;
use App\Models\Invitation;
use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\LeadNote;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use App\Models\TaskComment;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cross-tenant isolation sweep (audit 2026-11-25, requested by the
 * Product Owner): every ID-bearing endpoint is probed with records of
 * agency B while authenticated as the Owner of agency A.
 *
 * Expected semantics, per the module contracts:
 * - a record addressed under its own (foreign) parent id resolves
 *   through the BelongsToAgency global scope -> 404;
 * - a foreign child id addressed under an OWN parent id is resolved
 *   through the parent relation -> 404;
 * - a foreign record referenced in a request BODY is rejected with
 *   422 CROSS_TENANT_REFERENCE;
 * - the portal only ever sees the signed-in client's own projects.
 */
class CrossTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;

    private User $ownerB;

    private User $userB;

    private Client $clientA;

    private Client $clientB;

    private Contact $contactB;

    private ClientNote $noteB;

    private ClientAccount $accountB;

    private Lead $leadA;

    private Lead $leadB;

    private Contact $leadContactB;

    private LeadNote $leadNoteB;

    private LeadActivity $activityB;

    private Project $projectA;

    private Project $projectB;

    private Milestone $milestoneB;

    private Task $taskA;

    private Task $taskB;

    private TaskComment $commentB;

    private TaskChecklistItem $itemB;

    private Team $teamA;

    private Team $teamB;

    private Invitation $invitationB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);

        $this->ownerA = $this->makeUser();
        $this->ownerB = $this->makeUser();
        $this->userB = $this->makeUser([Role::TEAM_MEMBER], $this->ownerB->agency_id);

        // Agency B fixtures — everything below belongs to agency B.
        $b = $this->ownerB->agency_id;
        $this->clientB = Client::factory()->create(['agency_id' => $b]);
        $this->contactB = Contact::factory()->create(['agency_id' => $b, 'client_id' => $this->clientB->id, 'lead_id' => null]);
        $this->noteB = ClientNote::factory()->create(['agency_id' => $b, 'client_id' => $this->clientB->id, 'author_id' => $this->ownerB->id]);
        $this->accountB = ClientAccount::factory()->create(['agency_id' => $b, 'client_id' => $this->clientB->id]);
        $this->leadB = Lead::factory()->create(['agency_id' => $b, 'owner_id' => $this->ownerB->id]);
        $this->leadContactB = Contact::factory()->create(['agency_id' => $b, 'lead_id' => $this->leadB->id, 'client_id' => null]);
        $this->leadNoteB = LeadNote::factory()->create(['agency_id' => $b, 'lead_id' => $this->leadB->id, 'author_id' => $this->ownerB->id]);
        $this->activityB = LeadActivity::factory()->create(['agency_id' => $b, 'lead_id' => $this->leadB->id, 'created_by' => $this->ownerB->id]);
        $this->projectB = Project::factory()->create(['agency_id' => $b, 'client_id' => $this->clientB->id]);
        $this->milestoneB = Milestone::factory()->create(['agency_id' => $b, 'project_id' => $this->projectB->id]);
        $this->taskB = Task::factory()->create(['agency_id' => $b, 'project_id' => $this->projectB->id, 'milestone_id' => $this->milestoneB->id]);
        $this->commentB = TaskComment::factory()->create(['agency_id' => $b, 'task_id' => $this->taskB->id, 'author_id' => $this->ownerB->id]);
        $this->itemB = TaskChecklistItem::factory()->create(['task_id' => $this->taskB->id]);
        $this->projectB->members()->attach($this->userB->id);
        $this->teamB = Team::factory()->create(['agency_id' => $b]);
        $this->teamB->members()->attach($this->userB->id);
        $this->invitationB = Invitation::factory()->create(['agency_id' => $b, 'invited_by' => $this->ownerB->id]);

        // Agency A fixtures — own parents for the mixed-parent probes.
        $a = $this->ownerA->agency_id;
        $this->clientA = Client::factory()->create(['agency_id' => $a]);
        $this->leadA = Lead::factory()->create(['agency_id' => $a, 'owner_id' => $this->ownerA->id]);
        $this->projectA = Project::factory()->create(['agency_id' => $a, 'client_id' => $this->clientA->id]);
        $this->taskA = Task::factory()->create(['agency_id' => $a, 'project_id' => $this->projectA->id]);
        $this->teamA = Team::factory()->create(['agency_id' => $a]);
    }

    private function makeUser(array $roles = [Role::OWNER], ?int $agencyId = null): User
    {
        $user = User::factory()->create($agencyId ? ['agency_id' => $agencyId] : []);
        $user->roles()->sync(Role::whereIn('key', $roles)->pluck('id'));

        return $user;
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($user->createToken('test', ['app'])->plainTextToken);
    }

    private function asA(): static
    {
        return $this->as($this->ownerA);
    }

    public function test_client_routes_of_another_agency_are_404(): void
    {
        $id = $this->clientB->id;

        $this->asA()->getJson("/api/v1/clients/{$id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/clients/{$id}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/clients/{$id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/clients/{$id}/contacts")->assertNotFound();
        $this->asA()->postJson("/api/v1/clients/{$id}/contacts", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->patchJson("/api/v1/clients/{$id}/contacts/{$this->contactB->id}", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/clients/{$id}/contacts/{$this->contactB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/clients/{$id}/notes")->assertNotFound();
        $this->asA()->postJson("/api/v1/clients/{$id}/notes", ['body' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/clients/{$id}/notes/{$this->noteB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/clients/{$id}/portal-accounts")->assertNotFound();
        $this->asA()->postJson("/api/v1/clients/{$id}/portal-accounts", [
            'name' => 'Hacked', 'email' => 'hacked@example.test', 'password' => 'password123',
        ])->assertNotFound();
        $this->asA()->patchJson("/api/v1/clients/{$id}/portal-accounts/{$this->accountB->id}", ['is_active' => false])->assertNotFound();
    }

    public function test_foreign_children_under_own_client_are_404(): void
    {
        $id = $this->clientA->id;

        $this->asA()->patchJson("/api/v1/clients/{$id}/contacts/{$this->contactB->id}", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/clients/{$id}/contacts/{$this->contactB->id}")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/clients/{$id}/notes/{$this->noteB->id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/clients/{$id}/portal-accounts/{$this->accountB->id}", ['is_active' => false])->assertNotFound();
    }

    public function test_lead_routes_of_another_agency_are_404(): void
    {
        $id = $this->leadB->id;

        $this->asA()->getJson("/api/v1/leads/{$id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/leads/{$id}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}")->assertNotFound();
        $this->asA()->postJson("/api/v1/leads/{$id}/convert", [])->assertNotFound();
        $this->asA()->getJson("/api/v1/leads/{$id}/contacts")->assertNotFound();
        $this->asA()->postJson("/api/v1/leads/{$id}/contacts", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->patchJson("/api/v1/leads/{$id}/contacts/{$this->leadContactB->id}", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/contacts/{$this->leadContactB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/leads/{$id}/notes")->assertNotFound();
        $this->asA()->postJson("/api/v1/leads/{$id}/notes", ['body' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/notes/{$this->leadNoteB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/leads/{$id}/activities")->assertNotFound();
        $this->asA()->postJson("/api/v1/leads/{$id}/activities", [
            'type' => 'call', 'scheduled_at' => now()->addDay()->toISOString(),
        ])->assertNotFound();
        $this->asA()->patchJson("/api/v1/leads/{$id}/activities/{$this->activityB->id}", ['is_done' => true])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/activities/{$this->activityB->id}")->assertNotFound();
    }

    public function test_foreign_children_under_own_lead_are_404(): void
    {
        $id = $this->leadA->id;

        $this->asA()->patchJson("/api/v1/leads/{$id}/contacts/{$this->leadContactB->id}", ['full_name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/contacts/{$this->leadContactB->id}")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/notes/{$this->leadNoteB->id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/leads/{$id}/activities/{$this->activityB->id}", ['is_done' => true])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/leads/{$id}/activities/{$this->activityB->id}")->assertNotFound();
    }

    public function test_project_and_task_routes_of_another_agency_are_404(): void
    {
        $id = $this->projectB->id;
        $task = $this->taskB->id;

        $this->asA()->getJson("/api/v1/projects/{$id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/projects/{$id}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/projects/{$id}/timeline")->assertNotFound();
        $this->asA()->getJson("/api/v1/projects/{$id}/members")->assertNotFound();
        $this->asA()->postJson("/api/v1/projects/{$id}/members", ['user_id' => $this->ownerA->id])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}/members/{$this->userB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/projects/{$id}/milestones")->assertNotFound();
        $this->asA()->postJson("/api/v1/projects/{$id}/milestones", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->patchJson("/api/v1/projects/{$id}/milestones/{$this->milestoneB->id}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}/milestones/{$this->milestoneB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/projects/{$id}/tasks")->assertNotFound();
        $this->asA()->postJson("/api/v1/projects/{$id}/tasks", ['title' => 'Hacked'])->assertNotFound();
        $this->asA()->postJson("/api/v1/projects/{$id}/teams", ['team_id' => $this->teamA->id])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}/teams/{$this->teamB->id}")->assertNotFound();

        $this->asA()->getJson("/api/v1/tasks/{$task}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/tasks/{$task}", ['title' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/tasks/{$task}")->assertNotFound();
        $this->asA()->getJson("/api/v1/tasks/{$task}/comments")->assertNotFound();
        $this->asA()->postJson("/api/v1/tasks/{$task}/comments", ['body' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/tasks/{$task}/comments/{$this->commentB->id}")->assertNotFound();
        $this->asA()->getJson("/api/v1/tasks/{$task}/checklist")->assertNotFound();
        $this->asA()->postJson("/api/v1/tasks/{$task}/checklist", ['title' => 'Hacked'])->assertNotFound();
        $this->asA()->patchJson("/api/v1/tasks/{$task}/checklist/{$this->itemB->id}", ['title' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/tasks/{$task}/checklist/{$this->itemB->id}")->assertNotFound();
    }

    public function test_foreign_children_under_own_project_and_task_are_404(): void
    {
        $id = $this->projectA->id;
        $task = $this->taskA->id;

        $this->asA()->patchJson("/api/v1/projects/{$id}/milestones/{$this->milestoneB->id}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}/milestones/{$this->milestoneB->id}")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/projects/{$id}/members/{$this->userB->id}")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/tasks/{$task}/comments/{$this->commentB->id}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/tasks/{$task}/checklist/{$this->itemB->id}", ['title' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/tasks/{$task}/checklist/{$this->itemB->id}")->assertNotFound();
    }

    public function test_foreign_references_in_bodies_are_422(): void
    {
        $this->asA()->postJson("/api/v1/projects/{$this->projectA->id}/members", ['user_id' => $this->userB->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
        $this->asA()->postJson("/api/v1/projects/{$this->projectA->id}/teams", ['team_id' => $this->teamB->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
        $this->asA()->postJson("/api/v1/teams/{$this->teamA->id}/members", ['user_id' => $this->userB->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
        $this->asA()->patchJson("/api/v1/tasks/{$this->taskA->id}", ['milestone_id' => $this->milestoneB->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
        $this->asA()->patchJson("/api/v1/leads/{$this->leadA->id}", ['owner_id' => $this->userB->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_team_user_and_invitation_routes_of_another_agency_are_404(): void
    {
        $team = $this->teamB->id;
        $user = $this->userB->id;
        $adminRoleId = Role::where('key', Role::ADMIN)->value('id');

        $this->asA()->getJson("/api/v1/teams/{$team}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/teams/{$team}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/teams/{$team}")->assertNotFound();
        $this->asA()->postJson("/api/v1/teams/{$team}/members", ['user_id' => $this->ownerA->id])->assertNotFound();
        $this->asA()->deleteJson("/api/v1/teams/{$team}/members/{$this->userB->id}")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/teams/{$this->teamA->id}/members/{$this->userB->id}")->assertNotFound();

        $this->asA()->getJson("/api/v1/users/{$user}")->assertNotFound();
        $this->asA()->patchJson("/api/v1/users/{$user}", ['name' => 'Hacked'])->assertNotFound();
        $this->asA()->putJson("/api/v1/users/{$user}/roles", ['role_ids' => [$adminRoleId]])->assertNotFound();
        $this->asA()->patchJson("/api/v1/users/{$user}/activation", ['is_active' => false])->assertNotFound();

        $this->asA()->postJson("/api/v1/invitations/{$this->invitationB->id}/resend")->assertNotFound();
        $this->asA()->deleteJson("/api/v1/invitations/{$this->invitationB->id}")->assertNotFound();
    }

    public function test_lists_do_not_leak_other_agency_records(): void
    {
        $cases = [
            ['/api/v1/clients', $this->clientB->id],
            ['/api/v1/leads', $this->leadB->id],
            ['/api/v1/projects', $this->projectB->id],
            ['/api/v1/teams', $this->teamB->id],
            ['/api/v1/users', $this->userB->id],
            ['/api/v1/invitations', $this->invitationB->id],
        ];

        foreach ($cases as [$url, $foreignId]) {
            $response = $this->asA()->getJson($url);
            $response->assertOk();
            $ids = collect($response->json('data'))->pluck('id');
            $this->assertFalse(
                $ids->contains($foreignId),
                "List {$url} leaked foreign record id {$foreignId}"
            );
        }
    }

    public function test_portal_only_sees_own_client_projects(): void
    {
        $portalAccountA = ClientAccount::factory()->create([
            'agency_id' => $this->ownerA->agency_id,
            'client_id' => $this->clientA->id,
        ]);
        $token = $portalAccountA->createToken('portal', ['portal'])->plainTextToken;

        $this->withFreshToken($token)
            ->getJson("/api/v1/portal/projects/{$this->projectB->id}")
            ->assertNotFound();

        $response = $this->withFreshToken($token)->getJson('/api/v1/portal/projects');
        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($this->projectA->id));
        $this->assertFalse($ids->contains($this->projectB->id));
    }
}
