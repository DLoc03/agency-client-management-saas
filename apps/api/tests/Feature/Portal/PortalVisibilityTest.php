<?php

namespace Tests\Feature\Portal;

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
 * BE-011 selective Portal visibility (docs/PORTAL_CONTRACT.md
 * sections 2.1/3.1, DEC-028 Q1/Q2): per-item client_visible flags,
 * Portal progress computed over the visible subset only, and
 * draft/cancelled projects hidden from the Portal.
 */
class PortalVisibilityTest extends TestCase
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

    private function asPortal(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user, 'portal'));
    }

    private function makeProject(User $owner, int $clientId, array $attrs = []): Project
    {
        return Project::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $clientId,
            'status' => Project::STATUS_IN_PROGRESS,
        ], $attrs));
    }

    public function test_portal_detail_shows_only_visible_items_and_progress_uses_visible_denominator(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        $visibleMilestone = Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id, 'client_visible' => true,
        ]);
        Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id, 'client_visible' => false,
        ]);

        // Visible: 1 done + 1 todo. Hidden: 1 done. If the hidden
        // task leaked into the counts, progress would read 2/3 = 67
        // instead of 1/2 = 50.
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'milestone_id' => $visibleMilestone->id,
            'status' => Task::STATUS_DONE, 'client_visible' => true,
        ]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'milestone_id' => $visibleMilestone->id,
            'status' => Task::STATUS_TODO, 'client_visible' => true,
        ]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'status' => Task::STATUS_DONE, 'client_visible' => false,
        ]);

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $response = $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}")->assertOk();

        $response->assertJsonPath('data.tasks_count', 2);
        $response->assertJsonPath('data.tasks_done_count', 1);
        $response->assertJsonPath('data.progress_percent', 50);
        $response->assertJsonCount(2, 'data.tasks');
        $response->assertJsonCount(1, 'data.milestones');
        // Milestone progress also uses the visible subset: its two
        // visible tasks are 1 done + 1 todo = 50.
        $response->assertJsonPath('data.milestones.0.progress_percent', 50);

        // The list endpoint applies the same denominator.
        $this->asPortal($portal)->getJson('/api/v1/portal/projects')
            ->assertOk()
            ->assertJsonPath('data.0.progress_percent', 50);
    }

    public function test_draft_and_cancelled_projects_are_hidden_from_the_portal(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $draft = $this->makeProject($owner, $client->id, ['status' => Project::STATUS_DRAFT]);
        $cancelled = $this->makeProject($owner, $client->id, ['status' => Project::STATUS_CANCELLED]);
        $live = $this->makeProject($owner, $client->id, ['status' => Project::STATUS_IN_PROGRESS]);

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);

        $ids = collect($this->asPortal($portal)->getJson('/api/v1/portal/projects')->assertOk()->json('data'))
            ->pluck('id');
        $this->assertTrue($ids->contains($live->id));
        $this->assertFalse($ids->contains($draft->id));
        $this->assertFalse($ids->contains($cancelled->id));

        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$draft->id}")->assertNotFound();
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$cancelled->id}")->assertNotFound();
    }

    public function test_internal_views_are_unaffected_by_visibility_flags(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id, 'client_visible' => false,
        ]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id, 'client_visible' => true,
        ]);

        $this->as($owner)->getJson("/api/v1/projects/{$project->id}/tasks")
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_client_visible_can_be_toggled_through_the_existing_patch_endpoints(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);
        $milestone = Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
        ]);
        $task = Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
        ]);

        $this->as($owner)->patchJson("/api/v1/tasks/{$task->id}", ['client_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.client_visible', false);
        $this->assertFalse($task->refresh()->client_visible);

        $this->as($owner)->patchJson("/api/v1/projects/{$project->id}/milestones/{$milestone->id}", ['client_visible' => false])
            ->assertOk()
            ->assertJsonPath('data.client_visible', false);
        $this->assertFalse($milestone->refresh()->client_visible);
    }
}
