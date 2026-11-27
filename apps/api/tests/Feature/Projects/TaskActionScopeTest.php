<?php

namespace Tests\Feature\Projects;

use App\Models\Client;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FIX-033 task action scope (DEC-027): viewing a task follows the
 * project visibility rules, but ACTING on it — update, delete,
 * comments, checklist — requires being the task's assignee, the
 * project's manager, or holding the Owner / Admin / Project Manager
 * role on the current membership. Denials answer 403 with the code
 * TASK_ACTION_FORBIDDEN, and TaskResource exposes the same rule as
 * the `can_act` flag for the FE.
 */
class TaskActionScopeTest extends TestCase
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
     * A project managed (project_manager_id) by $manager, with one
     * task assigned to $assignee. $outsider is attached as a project
     * member so the task is visible to them.
     *
     * @return array{Project, Task}
     */
    private function fixture(User $owner, User $manager, User $assignee, ?User $outsider = null): array
    {
        $project = Project::factory()->create([
            'agency_id' => $owner->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $owner->agency_id])->id,
            'project_manager_id' => $manager->id,
        ]);

        if ($outsider) {
            $project->members()->attach($outsider->id);
        }

        $task = Task::factory()->create([
            'agency_id' => $owner->agency_id,
            'project_id' => $project->id,
            'assignee_id' => $assignee->id,
            'created_by' => $owner->id,
        ]);

        return [$project, $task];
    }

    public function test_assignee_can_act_on_the_task(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $assignee = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        [, $task] = $this->fixture($owner, $owner, $assignee);

        $this->as($assignee)->patchJson('/api/v1/tasks/'.$task->id, ['status' => 'in_progress'])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.can_act', true);

        $this->as($assignee)->postJson('/api/v1/tasks/'.$task->id.'/comments', ['body' => 'Working on it'])
            ->assertCreated();

        $itemId = $this->as($assignee)->postJson('/api/v1/tasks/'.$task->id.'/checklist', ['title' => 'Step one'])
            ->assertCreated()->json('data.id');

        $this->as($assignee)->patchJson('/api/v1/tasks/'.$task->id.'/checklist/'.$itemId, ['is_done' => true])
            ->assertOk()
            ->assertJsonPath('data.is_done', true);
    }

    public function test_non_assignee_team_member_is_forbidden_from_task_actions(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $assignee = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $outsider = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        [, $task] = $this->fixture($owner, $owner, $assignee, $outsider);
        $item = $task->checklistItems()->create(['title' => 'Existing step']);

        $this->as($outsider)->patchJson('/api/v1/tasks/'.$task->id, ['status' => 'in_progress'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'TASK_ACTION_FORBIDDEN');

        $this->as($outsider)->postJson('/api/v1/tasks/'.$task->id.'/comments', ['body' => 'Me too'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'TASK_ACTION_FORBIDDEN');

        $this->as($outsider)->postJson('/api/v1/tasks/'.$task->id.'/checklist', ['title' => 'Sneaky step'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'TASK_ACTION_FORBIDDEN');

        $this->as($outsider)->patchJson('/api/v1/tasks/'.$task->id.'/checklist/'.$item->id, ['is_done' => true])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'TASK_ACTION_FORBIDDEN');

        $this->as($outsider)->deleteJson('/api/v1/tasks/'.$task->id.'/checklist/'.$item->id)
            ->assertForbidden()
            ->assertJsonPath('error.code', 'TASK_ACTION_FORBIDDEN');

        // DELETE /tasks/{id}: a Team Member does not even hold the
        // tasks.delete permission, so the denial comes from the route
        // permission layer (plain 403 FORBIDDEN) before the scope
        // guard — which is still in place behind it for any role that
        // gains the permission later.
        $this->as($outsider)->deleteJson('/api/v1/tasks/'.$task->id)
            ->assertForbidden();

        // Nothing was actually mutated.
        $this->assertSame(Task::STATUS_TODO, $task->refresh()->status);
        $this->assertDatabaseCount('task_comments', 0);
        $this->assertFalse($item->refresh()->is_done);
    }

    public function test_project_manager_person_can_act_without_a_privileged_role(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $manager = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $assignee = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        [, $task] = $this->fixture($owner, $manager, $assignee);

        // The manager holds only the Team Member role; the right to
        // act comes from projects.project_manager_id alone (DEC-027).
        $this->as($manager)->patchJson('/api/v1/tasks/'.$task->id, ['status' => 'in_review'])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_review');

        $this->as($manager)->postJson('/api/v1/tasks/'.$task->id.'/comments', ['body' => 'Please review'])
            ->assertCreated();

        $this->as($manager)->postJson('/api/v1/tasks/'.$task->id.'/checklist', ['title' => 'Manager step'])
            ->assertCreated();
    }

    public function test_privileged_roles_can_act_on_any_task(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $pm = $this->makeMembershipUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $admin = $this->makeMembershipUser([Role::ADMIN], $owner->agency_id);
        $assignee = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        [, $task] = $this->fixture($owner, $owner, $assignee);

        $this->as($pm)->patchJson('/api/v1/tasks/'.$task->id, ['status' => 'in_progress', 'title' => 'Retitled by PM'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Retitled by PM');

        $this->as($admin)->postJson('/api/v1/tasks/'.$task->id.'/comments', ['body' => 'Admin note'])
            ->assertCreated();

        $this->as($owner)->patchJson('/api/v1/tasks/'.$task->id, ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        // A privileged role may also delete a task outright.
        [, $secondTask] = $this->fixture($owner, $owner, $assignee);
        $this->as($pm)->deleteJson('/api/v1/tasks/'.$secondTask->id)->assertNoContent();
        $this->assertSoftDeleted('tasks', ['id' => $secondTask->id]);
    }

    public function test_can_act_flag_in_task_payload(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $assignee = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $outsider = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        [, $task] = $this->fixture($owner, $owner, $assignee, $outsider);

        $this->as($assignee)->getJson('/api/v1/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.can_act', true);

        // The outsider is a project member, so the task stays
        // viewable — the flag simply reports they may not act on it.
        $this->as($outsider)->getJson('/api/v1/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.can_act', false);

        $this->as($owner)->getJson('/api/v1/tasks/'.$task->id)
            ->assertOk()
            ->assertJsonPath('data.can_act', true);
    }
}
