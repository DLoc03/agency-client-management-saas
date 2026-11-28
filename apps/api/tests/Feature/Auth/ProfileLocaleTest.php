<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-013 (DEC-031): PATCH /auth/profile — plus its Portal mirror —
 * persists the identity's own locale. The endpoint is identity-level
 * (no tenant context, same placement as logout): the ability guard
 * on the route group is what keeps selection / invitation / foreign
 * surface tokens out, and SetApiLocale localizes later API messages
 * from the newly stored locale.
 */
class ProfileLocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_user_can_update_own_locale(): void
    {
        $user = $this->makeMembershipUser(userAttrs: ['locale' => 'en']);
        $token = $this->boundTokenFor($user);

        $this->withFreshToken($token)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['id', 'name', 'email', 'locale', 'roles', 'permissions']])
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.locale', 'vi');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'locale' => 'vi']);
    }

    public function test_api_messages_follow_the_newly_stored_locale(): void
    {
        $user = $this->makeMembershipUser(userAttrs: ['locale' => 'en']);
        $token = $this->boundTokenFor($user);

        $this->withFreshToken($token)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertOk();

        // A later request re-resolves the identity from the token, so
        // SetApiLocale reads the stored locale and answers in vi.
        $this->withFreshToken($token)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'not-the-password',
                'new_password' => 'newsecret123',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CURRENT_PASSWORD_MISMATCH')
            ->assertJsonPath('error.message', 'Mật khẩu hiện tại không đúng.');
    }

    public function test_portal_user_can_update_own_locale(): void
    {
        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $user = $this->makePortalIdentity($agency->id, $client->id, ['locale' => 'en']);
        $token = $this->boundTokenFor($user, 'portal');

        $this->withFreshToken($token)
            ->patchJson('/api/v1/portal/auth/profile', ['locale' => 'vi'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['id', 'client_id', 'name', 'email', 'locale']])
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.locale', 'vi');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'locale' => 'vi']);
    }

    public function test_unsupported_or_missing_locale_is_a_validation_error(): void
    {
        $user = $this->makeMembershipUser(userAttrs: ['locale' => 'en']);
        $token = $this->boundTokenFor($user);

        $this->withFreshToken($token)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'fr'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->withFreshToken($token)
            ->patchJson('/api/v1/auth/profile', [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'locale' => 'en']);
    }

    public function test_guest_cannot_update_profile_on_either_surface(): void
    {
        $this->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertUnauthorized();
        $this->patchJson('/api/v1/portal/auth/profile', ['locale' => 'vi'])
            ->assertUnauthorized();
    }

    public function test_tokens_are_rejected_on_the_foreign_surface(): void
    {
        $staff = $this->makeMembershipUser(userAttrs: ['locale' => 'en']);
        $staffToken = $this->boundTokenFor($staff);

        $this->withFreshToken($staffToken)
            ->patchJson('/api/v1/portal/auth/profile', ['locale' => 'vi'])
            ->assertForbidden();

        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $portal = $this->makePortalIdentity($agency->id, $client->id, ['locale' => 'en']);
        $portalToken = $this->boundTokenFor($portal, 'portal');

        $this->withFreshToken($portalToken)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $staff->id, 'locale' => 'en']);
        $this->assertDatabaseHas('users', ['id' => $portal->id, 'locale' => 'en']);
    }

    public function test_selection_and_invitation_tokens_cannot_update_profile(): void
    {
        $user = $this->makeMembershipUser(userAttrs: ['locale' => 'en']);
        $selectionToken = $user->createToken('select', ['select'], now()->addMinutes(30))->plainTextToken;
        $invitationToken = $user->createToken('invitation', ['invitation'], now()->addMinutes(60))->plainTextToken;

        // The ability:app route guard refuses both scoped tokens with
        // 403 before the controller is reached — the same refusal
        // InvitationLoginTest documents for select-agency.
        $this->withFreshToken($selectionToken)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertForbidden();
        $this->withFreshToken($invitationToken)
            ->patchJson('/api/v1/auth/profile', ['locale' => 'vi'])
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'locale' => 'en']);
    }
}
