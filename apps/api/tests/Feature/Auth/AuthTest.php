<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeUser(array $attrs = [], array $roles = [Role::TEAM_MEMBER]): User
    {
        $agencyId = $attrs['agency_id'] ?? null;
        unset($attrs['agency_id']);

        return $this->makeMembershipUser($roles, $agencyId, array_merge([
            'password' => Hash::make('secret123'),
        ], $attrs));
    }

    public function test_login_success_returns_token_roles_and_permissions(): void
    {
        $user = $this->makeUser(['email' => 'staff@acme.test'], [Role::ADMIN]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'staff@acme.test',
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.email', 'staff@acme.test')
            ->assertJsonPath('data.user.roles', [Role::ADMIN])
            ->assertJsonPath('data.agency.id', $user->agency_id);
        $this->assertNotEmpty($response->json('data.token'));
        $this->assertContains('members.manage', $response->json('data.user.permissions'));
    }

    public function test_login_wrong_password_returns_invalid_credentials(): void
    {
        $this->makeUser(['email' => 'staff@acme.test']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'staff@acme.test',
            'password' => 'wrong-password',
        ])->assertStatus(401)->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
    }

    public function test_login_locked_agency_is_rejected(): void
    {
        $agency = Agency::factory()->locked()->create();
        $this->makeUser(['email' => 'staff@acme.test', 'agency_id' => $agency->id]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'staff@acme.test',
            'password' => 'secret123',
        ])->assertStatus(403)->assertJsonPath('error.code', 'AGENCY_LOCKED');
    }

    public function test_login_disabled_account_is_rejected(): void
    {
        $this->makeUser(['email' => 'staff@acme.test', 'is_active' => false]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'staff@acme.test',
            'password' => 'secret123',
        ])->assertStatus(403)->assertJsonPath('error.code', 'ACCOUNT_DISABLED');
    }

    public function test_me_requires_authentication_and_returns_profile(): void
    {
        $user = $this->makeUser([], [Role::OWNER]);

        $this->getJson('/api/v1/auth/me')
            ->assertStatus(401)->assertJsonPath('error.code', 'UNAUTHENTICATED');

        $token = $this->boundTokenFor($user);
        $this->withFreshToken($token)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.roles', [Role::OWNER])
            ->assertJsonPath('data.user.permissions', config('rbac.permissions'));
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = $this->makeUser();
        $token = $user->createToken('app', ['app'])->plainTextToken;

        $this->withFreshToken($token)
            ->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->withFreshToken($token)
            ->getJson('/api/v1/auth/me')->assertStatus(401);
    }

    public function test_change_password_validates_current_and_revokes_other_tokens(): void
    {
        $user = $this->makeUser();
        $tokenA = $this->boundTokenFor($user);
        $tokenB = $this->boundTokenFor($user);

        $this->withFreshToken($tokenA)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'not-the-password',
                'new_password' => 'newsecret123',
            ])->assertStatus(422)->assertJsonPath('error.code', 'CURRENT_PASSWORD_MISMATCH');

        $this->withFreshToken($tokenA)
            ->postJson('/api/v1/auth/change-password', [
                'current_password' => 'secret123',
                'new_password' => 'newsecret123',
            ])->assertOk();

        // Other token revoked, current token still valid.
        $this->withFreshToken($tokenB)
            ->getJson('/api/v1/auth/me')->assertStatus(401);
        $this->withFreshToken($tokenA)
            ->getJson('/api/v1/auth/me')->assertOk();
        $this->assertTrue(Hash::check('newsecret123', $user->fresh()->password));
    }

    public function test_forgot_password_always_returns_200(): void
    {
        $this->makeUser(['email' => 'staff@acme.test']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'staff@acme.test'])
            ->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@acme.test'])
            ->assertOk();
    }

    public function test_reset_password_with_valid_and_invalid_token(): void
    {
        $user = $this->makeUser(['email' => 'staff@acme.test']);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => 'staff@acme.test',
            'password' => 'brandnew123',
        ])->assertStatus(422)->assertJsonPath('error.code', 'INVALID_RESET_TOKEN');

        $token = Password::broker('users')->createToken($user);
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'staff@acme.test',
            'password' => 'brandnew123',
        ])->assertOk();
        $this->assertTrue(Hash::check('brandnew123', $user->fresh()->password));
    }
}
