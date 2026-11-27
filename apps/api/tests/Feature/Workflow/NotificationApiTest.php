<?php

namespace Tests\Feature\Workflow;

use App\Models\Agency;
use App\Models\Membership;
use App\Models\Notification as AppNotification;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-009 notification API (docs/WORKFLOW_CONTRACT.md section 3):
 * list / unread-count / mark-read / mark-all-read, pinned to the
 * token identity in the token's agency — nothing leaks across users
 * or across agencies, and foreign ids answer 404.
 */
class NotificationApiTest extends TestCase
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

    private function notify(User $user, array $attrs = []): AppNotification
    {
        return AppNotification::factory()->create(array_merge([
            'agency_id' => $user->agency_id,
            'user_id' => $user->id,
        ], $attrs));
    }

    /** Refresh bypassing the tenant scope (rows may live in another agency). */
    private function fresh(AppNotification $notification): AppNotification
    {
        // Bypass reason: test-side inspection; the row is pinned by id.
        return Tenant::bypass(fn () => AppNotification::query()->findOrFail($notification->id));
    }

    public function test_list_returns_only_own_notifications_newest_first(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $other = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        $first = $this->notify($owner, ['type' => 'task.assigned', 'created_at' => now()->subMinutes(2)]);
        $second = $this->notify($owner, ['type' => 'task.commented', 'created_at' => now()->subMinute()]);
        $this->notify($other, ['type' => 'task.assigned']);

        $response = $this->as($owner)->getJson('/api/v1/notifications')->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$second->id, $first->id], $ids);
        $response->assertJsonPath('data.0.type', 'task.commented');
        $response->assertJsonPath('data.0.read_at', null);
    }

    public function test_unread_filter_and_unread_count(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $this->notify($owner);
        $this->notify($owner);
        $this->notify($owner, ['read_at' => now()]);

        $this->as($owner)->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('data.count', 2);

        $this->as($owner)->getJson('/api/v1/notifications?unread=1')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_mark_read_marks_own_notification(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $notification = $this->notify($owner);

        $this->as($owner)->postJson("/api/v1/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $notification->id)
            ->assertJsonPath('data.read_at', fn ($value) => $value !== null);

        $this->as($owner)->getJson('/api/v1/notifications/unread-count')
            ->assertJsonPath('data.count', 0);
    }

    public function test_mark_read_on_another_users_notification_returns_404(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $other = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $foreign = $this->notify($other);

        $this->as($owner)->postJson("/api/v1/notifications/{$foreign->id}/read")
            ->assertNotFound();

        $this->assertNull($this->fresh($foreign)->read_at);
    }

    public function test_mark_all_read_only_affects_own_notifications_in_the_token_agency(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $otherAgency = Agency::factory()->create();
        $other = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);

        $ownHere = $this->notify($owner);
        $ownElsewhere = AppNotification::factory()->create([
            'agency_id' => $otherAgency->id,
            'user_id' => $owner->id,
        ]);
        $someoneElses = $this->notify($other);

        $this->as($owner)->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.count', 0);

        $this->assertNotNull($this->fresh($ownHere)->read_at);
        // Same identity, different agency: untouched by this token.
        $this->assertNull($this->fresh($ownElsewhere)->read_at);
        // Same agency, different identity: untouched.
        $this->assertNull($this->fresh($someoneElses)->read_at);
    }

    public function test_list_does_not_leak_notifications_from_another_agency_of_the_same_identity(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $otherAgency = Agency::factory()->create();

        // The same identity also holds a staff membership elsewhere.
        Membership::create([
            'user_id' => $owner->id,
            'agency_id' => $otherAgency->id,
            'kind' => Membership::KIND_STAFF,
            'is_active' => true,
        ]);

        $this->notify($owner);
        AppNotification::factory()->create([
            'agency_id' => $otherAgency->id,
            'user_id' => $owner->id,
        ]);

        $this->as($owner)->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_notifications_require_an_app_token(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
    }
}
