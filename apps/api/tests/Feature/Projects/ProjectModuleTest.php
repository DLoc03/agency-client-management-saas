<?php

namespace Tests\Feature\Projects;

use App\Models\Client;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-006 Project Management module (docs/PROJECT_CONTRACT.md, DEC-016):
 * CRUD, tenancy isolation, RBAC matrix incl. Team Member scoping,
 * milestones, tasks, comments, checklist, progress, timeline, due list
 * and the read-only Portal project view.
 */
class ProjectModuleTest extends TestCase
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

    private function makeProject(User $owner, array $attrs = []): Project
    {
        return Project::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $this->makeClient($owner)->id,
        ], $attrs));
    }

    public function test_owner_creates_project_and_response_reflects_defaults(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);

        $this->as($owner)->postJson('/api/v1/projects', [
            'client_id' => $client->id,
            'name' => 'Website rebuild',
            'project_manager_id' => $owner->id,
            'budget' => 25000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Website rebuild')
            ->assertJsonPath('data.status', Project::STATUS_DRAFT)
            ->assertJsonPath('data.client.id', $client->id)
            ->assertJsonPath('data.project_manager.id', $owner->id)
            ->assertJsonPath('data.tasks_count', 0)
            ->assertJsonPath('data.progress_percent', 0);
    }

    public function test_create_project_with_foreign_client_is_cross_tenant_422(): void
    {
        $owner = $this->makeUser();
        $foreignClient = Client::factory()->create();

        $this->as($owner)->postJson('/api/v1/projects', [
            'client_id' => $foreignClient->id,
            'name' => 'Nope',
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_project_filters(): void
    {
        $owner = $this->makeUser();
        $clientA = $this->makeClient($owner);
        $this->makeProject($owner, ['client_id' => $clientA->id, 'name' => 'Alpha site', 'status' => Project::STATUS_IN_PROGRESS]);
        $this->makeProject($owner, ['name' => 'Beta app', 'status' => Project::STATUS_DRAFT]);

        $this->as($owner)->getJson('/api/v1/projects?client_id='.$clientA->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha site');
        $this->as($owner)->getJson('/api/v1/projects?status=draft')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta app');
        $this->as($owner)->getJson('/api/v1/projects?q=alpha')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_cross_agency_project_is_404(): void
    {
        $owner = $this->makeUser();
        $foreign = $this->makeProject($this->makeUser());

        $this->as($owner)->getJson('/api/v1/projects/'.$foreign->id)->assertNotFound();
    }

    public function test_pm_can_create_and_update_but_not_delete_project(): void
    {
        $owner = $this->makeUser();
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $client = $this->makeClient($owner);

        $id = $this->as($pm)->postJson('/api/v1/projects', ['client_id' => $client->id, 'name' => 'PM project'])
            ->assertCreated()->json('data.id');

        $this->as($pm)->patchJson('/api/v1/projects/'.$id, ['status' => Project::STATUS_IN_PROGRESS])
            ->assertOk()->assertJsonPath('data.status', Project::STATUS_IN_PROGRESS);
        $this->as($pm)->deleteJson('/api/v1/projects/'.$id)->assertForbidden();
    }

    public function test_admin_cannot_delete_project_but_owner_can(): void
    {
        $owner = $this->makeUser();
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);
        $project = $this->makeProject($owner);

        $this->as($admin)->deleteJson('/api/v1/projects/'.$project->id)->assertForbidden();
        $this->as($owner)->deleteJson('/api/v1/projects/'.$project->id)->assertNoContent();
        $this->assertSoftDeleted($project);
    }

    public function test_sales_and_accountant_are_view_only(): void
    {
        $owner = $this->makeUser();
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $owner->agency_id);
        $project = $this->makeProject($owner);
        $client = $this->makeClient($owner);

        foreach ([$sales, $accountant] as $viewer) {
            $this->as($viewer)->getJson('/api/v1/projects/'.$project->id)->assertOk();
            $this->as($viewer)->postJson('/api/v1/projects', ['client_id' => $client->id, 'name' => 'X'])->assertForbidden();
        }
    }

    public function test_owner_delete_cascades_soft_to_tasks_and_milestones(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        $milestone = Milestone::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id]);
        $task = Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'milestone_id' => $milestone->id]);
        $task->comments()->create(['agency_id' => $owner->agency_id, 'author_id' => $owner->id, 'body' => 'note']);
        $task->checklistItems()->create(['title' => 'step']);

        $this->as($owner)->deleteJson('/api/v1/projects/'.$project->id)->assertNoContent();

        $this->assertSoftDeleted($project);
        $this->assertSoftDeleted($milestone);
        $this->assertSoftDeleted($task);
        $this->assertSoftDeleted('task_comments', ['task_id' => $task->id]);
        $this->assertSoftDeleted('task_checklist_items', ['task_id' => $task->id]);
    }

    public function test_project_members_manage(): void
    {
        $owner = $this->makeUser();
        $member = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $this->as($owner)->postJson('/api/v1/projects/'.$project->id.'/members', ['user_id' => $member->id])
            ->assertCreated()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $member->id);

        $this->as($owner)->deleteJson('/api/v1/projects/'.$project->id.'/members/'.$member->id)->assertNoContent();
        $this->as($owner)->getJson('/api/v1/projects/'.$project->id.'/members')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_team_member_sees_only_participating_projects(): void
    {
        $owner = $this->makeUser();
        $tm = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $joined = $this->makeProject($owner, ['name' => 'Joined']);
        $assigned = $this->makeProject($owner, ['name' => 'Assigned']);
        $this->makeProject($owner, ['name' => 'Hidden']);
        $joined->members()->attach($tm->id);
        Task::factory()->create(['project_id' => $assigned->id, 'agency_id' => $owner->agency_id, 'assignee_id' => $tm->id]);

        $names = collect($this->as($tm)->getJson('/api/v1/projects')->assertOk()->json('data'))->pluck('name');
        $this->assertEqualsCanonicalizing(['Joined', 'Assigned'], $names->all());

        $hidden = Project::where('name', 'Hidden')->first();
        $this->as($tm)->getJson('/api/v1/projects/'.$hidden->id)->assertNotFound();
    }

    public function test_milestone_crud_and_progress(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);

        $milestoneId = $this->as($owner)->postJson('/api/v1/projects/'.$project->id.'/milestones', [
            'name' => 'Design sign-off', 'due_date' => '2026-12-01',
        ])->assertCreated()->assertJsonPath('data.status', Milestone::STATUS_PLANNED)->json('data.id');

        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'milestone_id' => $milestoneId, 'status' => Task::STATUS_DONE]);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'milestone_id' => $milestoneId, 'status' => Task::STATUS_TODO]);

        $this->as($owner)->getJson('/api/v1/projects/'.$project->id.'/milestones')
            ->assertOk()->assertJsonPath('data.0.progress_percent', 50);

        // Milestone of another project resolves to 404 on update.
        $other = $this->makeProject($owner);
        $this->as($owner)->patchJson('/api/v1/projects/'.$other->id.'/milestones/'.$milestoneId, ['name' => 'X'])->assertNotFound();
    }

    public function test_task_crud_filters_and_completed_at_lifecycle(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson('/api/v1/projects/'.$project->id.'/tasks', [
            'title' => 'Design homepage', 'priority' => Task::PRIORITY_HIGH,
        ])->assertCreated()
            ->assertJsonPath('data.status', Task::STATUS_TODO)
            ->assertJsonPath('data.priority', Task::PRIORITY_HIGH)
            ->assertJsonPath('data.completed_at', null)
            ->json('data.id');

        $this->as($owner)->patchJson('/api/v1/tasks/'.$taskId, ['status' => Task::STATUS_DONE])
            ->assertOk()->assertJsonPath('data.status', Task::STATUS_DONE)
            ->assertJson(fn ($json) => $json->whereNot('data.completed_at', null)->etc());

        $this->as($owner)->patchJson('/api/v1/tasks/'.$taskId, ['status' => Task::STATUS_IN_PROGRESS])
            ->assertOk()->assertJsonPath('data.completed_at', null);

        $this->as($owner)->getJson('/api/v1/projects/'.$project->id.'/tasks?priority=high')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->as($owner)->getJson('/api/v1/projects/'.$project->id.'/tasks?priority=low')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_task_with_milestone_from_another_project_is_422(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        $other = $this->makeProject($owner);
        $foreignMilestone = Milestone::factory()->create(['project_id' => $other->id, 'agency_id' => $owner->agency_id]);

        $this->as($owner)->postJson('/api/v1/projects/'.$project->id.'/tasks', [
            'title' => 'Bad milestone', 'milestone_id' => $foreignMilestone->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_task_with_foreign_assignee_is_422(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        $foreignUser = $this->makeUser();

        $this->as($owner)->postJson('/api/v1/projects/'.$project->id.'/tasks', [
            'title' => 'Bad assignee', 'assignee_id' => $foreignUser->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_team_member_updates_only_own_task_status(): void
    {
        $owner = $this->makeUser();
        $tm = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $other = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);
        $ownTask = Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'assignee_id' => $tm->id]);
        $othersTask = Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'assignee_id' => $other->id]);

        $this->as($tm)->patchJson('/api/v1/tasks/'.$ownTask->id, ['status' => Task::STATUS_IN_PROGRESS, 'title' => 'Hijack'])
            ->assertOk()
            ->assertJsonPath('data.status', Task::STATUS_IN_PROGRESS)
            ->assertJsonPath('data.title', $ownTask->title);

        $this->as($tm)->patchJson('/api/v1/tasks/'.$othersTask->id, ['status' => Task::STATUS_DONE])->assertForbidden();
        $this->as($tm)->postJson('/api/v1/projects/'.$project->id.'/tasks', ['title' => 'Nope'])->assertForbidden();
    }

    public function test_task_comments_and_checklist(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        $task = Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id]);

        $commentId = $this->as($owner)->postJson('/api/v1/tasks/'.$task->id.'/comments', ['body' => 'Looks good'])
            ->assertCreated()->assertJsonPath('data.author.id', $owner->id)->json('data.id');

        $itemId = $this->as($owner)->postJson('/api/v1/tasks/'.$task->id.'/checklist', ['title' => 'Check contrast'])
            ->assertCreated()->assertJsonPath('data.is_done', false)->json('data.id');

        $this->as($owner)->patchJson('/api/v1/tasks/'.$task->id.'/checklist/'.$itemId, ['is_done' => true])
            ->assertOk()->assertJsonPath('data.is_done', true);

        $this->as($owner)->getJson('/api/v1/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.checklist')
            ->assertJsonCount(1, 'data.comments');

        $this->as($owner)->deleteJson('/api/v1/tasks/'.$task->id.'/comments/'.$commentId)->assertNoContent();
    }

    public function test_comment_delete_requires_author_or_privileged_role(): void
    {
        $owner = $this->makeUser();
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $project = $this->makeProject($owner);
        $task = Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id]);
        $comment = $task->comments()->create(['agency_id' => $owner->agency_id, 'author_id' => $owner->id, 'body' => 'Owner note']);

        $this->as($pm)->deleteJson('/api/v1/tasks/'.$task->id.'/comments/'.$comment->id)->assertForbidden();
        $this->as($owner)->deleteJson('/api/v1/tasks/'.$task->id.'/comments/'.$comment->id)->assertNoContent();
    }

    public function test_progress_and_timeline(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        $milestone = Milestone::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'due_date' => '2026-12-10', 'name' => 'Launch']);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'status' => Task::STATUS_DONE, 'due_date' => '2026-12-05', 'title' => 'Early task']);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'status' => Task::STATUS_TODO, 'due_date' => '2026-12-10', 'title' => 'Same-day task']);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'status' => Task::STATUS_TODO]);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'status' => Task::STATUS_DONE]);

        $this->as($owner)->getJson('/api/v1/projects/'.$project->id)
            ->assertOk()
            ->assertJsonPath('data.tasks_count', 4)
            ->assertJsonPath('data.tasks_done_count', 2)
            ->assertJsonPath('data.progress_percent', 50);

        $items = $this->as($owner)->getJson('/api/v1/projects/'.$project->id.'/timeline')->assertOk()->json('data');
        $this->assertCount(3, $items);
        $this->assertSame('task', $items[0]['type']);
        $this->assertSame('milestone', $items[1]['type']);
        $this->assertSame('task', $items[2]['type']);
    }

    public function test_due_list_returns_open_tasks_by_due_date(): void
    {
        $owner = $this->makeUser();
        $project = $this->makeProject($owner);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'title' => 'Overdue', 'due_date' => now()->subDay()]);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'title' => 'Future', 'due_date' => now()->addDays(10)]);
        Task::factory()->create(['project_id' => $project->id, 'agency_id' => $owner->agency_id, 'title' => 'Done already', 'status' => Task::STATUS_DONE, 'due_date' => now()->subDay()]);

        $this->as($owner)->getJson('/api/v1/tasks/due')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Overdue');
        $this->as($owner)->getJson('/api/v1/tasks/due?days=14')
            ->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_portal_sees_only_own_projects_without_internal_data(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $otherClient = $this->makeClient($owner);
        // DEC-028 Q2: the project must not be draft/cancelled for
        // the Portal to see it (drafts are hidden since Group 7).
        $mine = $this->makeProject($owner, ['client_id' => $client->id, 'name' => 'Client visible', 'status' => Project::STATUS_IN_PROGRESS]);
        $this->makeProject($owner, ['client_id' => $otherClient->id, 'name' => 'Not yours']);
        $task = Task::factory()->create(['project_id' => $mine->id, 'agency_id' => $owner->agency_id, 'status' => Task::STATUS_DONE]);
        $task->comments()->create(['agency_id' => $owner->agency_id, 'author_id' => $owner->id, 'body' => 'Internal secret']);

        // App tokens cannot use the portal route (checked while the
        // owner token is active; the helper shares one test instance).
        $this->as($owner)->getJson('/api/v1/portal/projects')->assertForbidden();

        $identity = $this->makePortalIdentity($owner->agency_id, $client->id);
        $portal = $this->withFreshToken($this->boundTokenFor($identity, 'portal'));

        $portal->getJson('/api/v1/portal/projects')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Client visible')
            ->assertJsonPath('data.0.progress_percent', 100)
            ->assertJsonMissingPath('data.0.budget');

        $response = $portal->getJson('/api/v1/portal/projects/'.$mine->id)->assertOk();
        $response->assertJsonPath('data.tasks.0.title', $task->title);
        $this->assertStringNotContainsString('Internal secret', $response->getContent());
        $this->assertStringNotContainsString('comments', $response->getContent());

        // Another client's project is not reachable.
        $foreign = Project::where('name', 'Not yours')->first();
        $portal->getJson('/api/v1/portal/projects/'.$foreign->id)->assertNotFound();

        // Portal tokens cannot use the internal route either.
        $portal->getJson('/api/v1/projects')->assertForbidden();
    }
}
