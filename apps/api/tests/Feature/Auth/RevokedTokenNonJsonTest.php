<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Regression test for QA-002 finding 1 (TC-AUTH-14/15): API clients that do
 * NOT send `Accept: application/json` (e.g. Playwright's default headers)
 * must still receive 401 UNAUTHENTICATED in the standard format when their
 * token has been revoked — never a 500.
 */
class RevokedTokenNonJsonTest extends TestCase
{
    use RefreshDatabase;

    public function test_revoked_token_with_browser_like_accept_header_returns_401(): void
    {
        $this->seed(RoleSeeder::class);
        $user = $this->makeMembershipUser([Role::TEAM_MEMBER], null, [
            'password' => Hash::make('secret123'),
        ]);

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'secret123',
        ])->json('data.token');

        // Revoke via logout, then call /me with a browser-like Accept header
        // (no application/json), like Playwright's APIRequestContext does.
        $this->withFreshToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $response = $this->withFreshToken($token)->call('GET', '/api/v1/auth/me', [], [], [], [
            'HTTP_ACCEPT' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
}
