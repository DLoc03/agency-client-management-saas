<?php

namespace Tests\Feature\Teams;

use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * BE-007 Team & Resource Management (docs/TEAM_CONTRACT.md, DEC-017):
 * teams, employee directory, role administration, activation,
 * invitations, snapshot team-to-project assignment, workload-lite.
 */
class TeamModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
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

    private function roleId(string $key): int
    {
        return Role::where('key', $key)->value('id');
    }

    // ---------- Teams ----------

    public function test_owner_creates_team_and_duplicate_name_is_422(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);

        $this->as($owner)->postJson('/api/v1/teams', ['name' => 'Design', 'lead_id' => $lead->id])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Design')
            ->assertJsonPath('data.lead_id', $lead->id)
            ->assertJsonPath('data.members_count', 0);

        $this->as($owner)->postJson('/api/v1/teams', ['name' => 'Design'])
            ->assertStatus(422);
    }

    public function test_team_permission_matrix(): void
    {
        $owner = $this->makeUser();
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $team = Team::factory()->create(['agency_id' => $owner->agency_id]);

        $this->as($sales)->postJson('/api/v1/teams', ['name' => 'Nope'])->assertForbidden();
        $this->as($pm)->postJson('/api/v1/teams', ['name' => 'PM Team'])->assertCreated();
        $this->as($pm)->deleteJson("/api/v1/teams/{$team->id}")->assertForbidden();
        $this->as($owner)->deleteJson("/api/v1/teams/{$team->id}")->assertNoContent();
        $this->assertSoftDeleted('teams', ['id' => $team->id]);
    }

    public function test_team_members_add_remove_and_cross_tenant_422(): void
    {
        $owner = $this->makeUser();
        $member = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $foreign = $this->makeUser([Role::TEAM_MEMBER]);
        $team = Team::factory()->create(['agency_id' => $owner->agency_id]);

        $this->as($owner)->postJson("/api/v1/teams/{$team->id}/members", ['user_id' => $member->id])
            ->assertCreated()
            ->assertJsonCount(1, 'data.members');

        $this->as($owner)->postJson("/api/v1/teams/{$team->id}/members", ['user_id' => $foreign->id])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->as($owner)->deleteJson("/api/v1/teams/{$team->id}/members/{$member->id}")->assertNoContent();
        $this->assertEquals(0, $team->members()->count());
    }

    public function test_foreign_team_is_404_and_team_member_sees_only_own_teams(): void
    {
        $owner = $this->makeUser();
        $tm = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $own = Team::factory()->create(['agency_id' => $owner->agency_id, 'name' => 'Own Team']);
        $own->members()->attach($tm->id);
        Team::factory()->create(['agency_id' => $owner->agency_id, 'name' => 'Other Team']);
        $foreignTeam = Team::factory()->create();

        $this->as($tm)->getJson('/api/v1/teams')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Own Team');
        $this->as($tm)->getJson("/api/v1/teams/{$foreignTeam->id}")->assertNotFound();
        $this->as($owner)->getJson("/api/v1/teams/{$foreignTeam->id}")->assertNotFound();
    }

    // ---------- Directory & account administration ----------

    public function test_directory_filters_and_show_open_task_count(): void
    {
        $owner = $this->makeUser();
        $dev = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = Project::factory()->create(['agency_id' => $owner->agency_id]);
        Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $dev->id, 'status' => Task::STATUS_TODO]);
        Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $dev->id, 'status' => Task::STATUS_DONE]);

        $this->as($owner)->getJson('/api/v1/users?role=team_member')
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->as($owner)->getJson("/api/v1/users/{$dev->id}")
            ->assertOk()
            ->assertJsonPath('data.open_tasks_count', 1)
            ->assertJsonPath('data.roles.0.key', 'team_member');

        $foreign = $this->makeUser();
        $this->as($owner)->getJson("/api/v1/users/{$foreign->id}")->assertNotFound();
    }

    public function test_role_administration_rules(): void
    {
        $owner = $this->makeUser();
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);
        $member = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);

        // Owner promotes the member; the change is visible immediately.
        $this->as($owner)->putJson("/api/v1/users/{$member->id}/roles", [
            'role_ids' => [$this->roleId(Role::PROJECT_MANAGER)],
        ])->assertOk()->assertJsonPath('data.roles.0.key', 'project_manager');

        // Admin may NOT grant the Admin role (DEC-017).
        $this->as($admin)->putJson("/api/v1/users/{$member->id}/roles", [
            'role_ids' => [$this->roleId(Role::ADMIN)],
        ])->assertForbidden()->assertJsonPath('error.code', 'ADMIN_MANAGEMENT_OWNER_ONLY');

        // The Owner's roles are immutable; nobody edits their own roles.
        $this->as($admin)->putJson("/api/v1/users/{$owner->id}/roles", [
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertForbidden()->assertJsonPath('error.code', 'CANNOT_MODIFY_OWNER');
        $this->as($member)->putJson("/api/v1/users/{$member->id}/roles", [
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertForbidden(); // member lacks users.roles.manage entirely
        $this->as($admin)->putJson("/api/v1/users/{$admin->id}/roles", [
            'role_ids' => [$this->roleId(Role::ADMIN)],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CANNOT_MODIFY_OWN_ROLES');
    }

    public function test_activation_revokes_tokens_and_blocks_login(): void
    {
        $owner = $this->makeUser();
        $member = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $memberToken = $member->createToken('test', ['app'])->plainTextToken;

        $this->withFreshToken($memberToken)->getJson('/api/v1/users')->assertOk();

        $this->as($owner)->patchJson("/api/v1/users/{$member->id}/activation", ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);

        // Existing token revoked; login refused while deactivated.
        $this->withFreshToken($memberToken)->getJson('/api/v1/users')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $member->email, 'password' => 'password'])
            ->assertStatus(403)->assertJsonPath('error.code', 'ACCOUNT_DISABLED');

        // Self-deactivation is refused; reactivation restores login.
        $this->as($owner)->patchJson("/api/v1/users/{$owner->id}/activation", ['is_active' => false])
            ->assertForbidden()->assertJsonPath('error.code', 'CANNOT_MODIFY_OWNER');
        $this->as($owner)->patchJson("/api/v1/users/{$member->id}/activation", ['is_active' => true])->assertOk();
        $this->postJson('/api/v1/auth/login', ['email' => $member->email, 'password' => 'password'])->assertOk();
    }

    // ---------- Invitations ----------

    private function invite(User $actor, string $email, array $roleKeys = [Role::TEAM_MEMBER]): array
    {
        Mail::fake();
        $response = $this->as($actor)->postJson('/api/v1/invitations', [
            'email' => $email,
            'role_ids' => array_map(fn ($key) => $this->roleId($key), $roleKeys),
        ]);
        $sent = null;
        Mail::assertSent(InvitationMail::class, function ($mail) use (&$sent) {
            $sent = $mail;

            return true;
        });

        return [$response, $sent];
    }

    public function test_invitation_create_guards(): void
    {
        $owner = $this->makeUser();
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);
        $existing = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);

        [$response] = $this->invite($owner, 'new.dev@example.com');
        $response->assertCreated()->assertJsonPath('data.email', 'new.dev@example.com');

        // Second pending invitation for the same email -> 422.
        $this->as($owner)->postJson('/api/v1/invitations', [
            'email' => 'new.dev@example.com',
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVITATION_PENDING');

        // Already-registered email -> 422.
        $this->as($owner)->postJson('/api/v1/invitations', [
            'email' => $existing->email,
            'role_ids' => [$this->roleId(Role::TEAM_MEMBER)],
        ])->assertStatus(422)->assertJsonPath('error.code', 'EMAIL_ALREADY_REGISTERED');

        // Admin may not invite with the Admin role (DEC-017).
        $this->as($admin)->postJson('/api/v1/invitations', [
            'email' => 'boss@example.com',
            'role_ids' => [$this->roleId(Role::ADMIN)],
        ])->assertForbidden()->assertJsonPath('error.code', 'ADMIN_MANAGEMENT_OWNER_ONLY');
    }

    public function test_invitation_accept_flow_and_token_lifecycle(): void
    {
        $owner = $this->makeUser();
        [, $mail] = $this->invite($owner, 'join.me@example.com');
        $token = Str::after($mail->acceptUrl, 'token=');

        // Wrong token -> 404.
        $this->postJson('/api/v1/invitations/accept', [
            'token' => 'bogus', 'name' => 'Join Me', 'password' => 'password123',
        ])->assertNotFound();

        // Accept -> the user exists with the invited role and can log in.
        $this->postJson('/api/v1/invitations/accept', [
            'token' => $token, 'name' => 'Join Me', 'password' => 'password123',
        ])->assertCreated()->assertJsonPath('data.email', 'join.me@example.com');
        $newUser = User::where('email', 'join.me@example.com')->first();
        $this->assertTrue($newUser->hasRole(Role::TEAM_MEMBER));
        $this->assertSame($owner->agency_id, $newUser->agency_id);
        $this->postJson('/api/v1/auth/login', ['email' => 'join.me@example.com', 'password' => 'password123'])->assertOk();

        // Second accept -> 422.
        $this->postJson('/api/v1/invitations/accept', [
            'token' => $token, 'name' => 'Join Me', 'password' => 'password123',
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVITATION_ALREADY_ACCEPTED');
    }

    public function test_invitation_resend_invalidates_old_token_and_revoke_kills_link(): void
    {
        $owner = $this->makeUser();
        [$created, $firstMail] = $this->invite($owner, 'resend.me@example.com');
        $invitationId = $created->json('data.id');
        $oldToken = Str::after($firstMail->acceptUrl, 'token=');

        Mail::fake();
        $newMail = null;
        $this->as($owner)->postJson("/api/v1/invitations/{$invitationId}/resend")->assertOk();
        Mail::assertSent(InvitationMail::class, function ($mail) use (&$newMail) {
            $newMail = $mail;

            return true;
        });
        $newToken = Str::after($newMail->acceptUrl, 'token=');
        $this->assertNotSame($oldToken, $newToken);

        $this->postJson('/api/v1/invitations/accept', [
            'token' => $oldToken, 'name' => 'Re Send', 'password' => 'password123',
        ])->assertNotFound();

        // Revoke kills even the fresh link.
        $this->as($owner)->deleteJson("/api/v1/invitations/{$invitationId}")->assertNoContent();
        $this->postJson('/api/v1/invitations/accept', [
            'token' => $newToken, 'name' => 'Re Send', 'password' => 'password123',
        ])->assertNotFound();
    }

    public function test_expired_invitation_accept_is_422(): void
    {
        $owner = $this->makeUser();
        [, $mail] = $this->invite($owner, 'too.late@example.com');
        $token = Str::after($mail->acceptUrl, 'token=');
        Invitation::where('email', 'too.late@example.com')
            ->update(['expires_at' => now()->subHour()]);

        $this->postJson('/api/v1/invitations/accept', [
            'token' => $token, 'name' => 'Too Late', 'password' => 'password123',
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVITATION_EXPIRED');
    }

    // ---------- Team -> project snapshot assignment ----------

    public function test_team_project_assignment_is_a_snapshot(): void
    {
        $owner = $this->makeUser();
        $a = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $b = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $team = Team::factory()->create(['agency_id' => $owner->agency_id]);
        $team->members()->attach($a->id);
        $project = Project::factory()->create(['agency_id' => $owner->agency_id]);

        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/teams", ['team_id' => $team->id])
            ->assertCreated()
            ->assertJsonPath('data.added_user_ids', [$a->id]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $a->id, 'via_team_id' => $team->id,
        ]);

        // Later team changes do NOT propagate to the project.
        $team->members()->attach($b->id);
        $this->assertEquals([$a->id], $project->members()->pluck('users.id')->all());
    }

    public function test_team_project_detach_keeps_members_with_tasks(): void
    {
        $owner = $this->makeUser();
        $withTask = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $withoutTask = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $team = Team::factory()->create(['agency_id' => $owner->agency_id]);
        $team->members()->attach([$withTask->id, $withoutTask->id]);
        $project = Project::factory()->create(['agency_id' => $owner->agency_id]);
        $project->members()->attach($withTask->id, ['via_team_id' => $team->id]);
        $project->members()->attach($withoutTask->id, ['via_team_id' => $team->id]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $withTask->id,
        ]);

        $this->as($owner)->deleteJson("/api/v1/projects/{$project->id}/teams/{$team->id}")
            ->assertOk()
            ->assertJsonPath('data.removed_user_ids', [$withoutTask->id])
            ->assertJsonPath('data.kept_user_ids', [$withTask->id]);
        $this->assertDatabaseHas('project_members', [
            'project_id' => $project->id, 'user_id' => $withTask->id, 'via_team_id' => null,
        ]);
        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id, 'user_id' => $withoutTask->id,
        ]);
    }

    // ---------- Workload-lite ----------

    public function test_workload_counts_and_team_member_scoping(): void
    {
        $owner = $this->makeUser();
        $dev = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $project = Project::factory()->create(['agency_id' => $owner->agency_id, 'status' => Project::STATUS_IN_PROGRESS]);
        $project->members()->attach($dev->id);
        Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $dev->id, 'status' => Task::STATUS_TODO, 'due_date' => now()->subDays(2)]);
        Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $dev->id, 'status' => Task::STATUS_IN_PROGRESS, 'due_date' => now()->addDays(3)]);
        Task::factory()->create(['agency_id' => $owner->agency_id, 'project_id' => $project->id, 'assignee_id' => $dev->id, 'status' => Task::STATUS_DONE, 'due_date' => now()->subDays(5)]);

        $this->as($owner)->getJson('/api/v1/workload')
            ->assertOk()
            ->assertJsonFragment([
                'user_id' => $dev->id, 'open_tasks' => 2, 'overdue_tasks' => 1,
                'due_next_7_days' => 1, 'projects_count' => 1,
            ]);

        // A Team Member receives only their own row; Sales has no access.
        $response = $this->as($dev)->getJson('/api/v1/workload')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame($dev->id, $response->json('data.0.user_id'));
        $this->as($sales)->getJson('/api/v1/workload')->assertForbidden();
    }
}
