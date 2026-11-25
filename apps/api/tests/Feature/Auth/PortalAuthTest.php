<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * Portal auth since DEC-018: no separate account table — a Portal
 * user is an identity holding a client membership.
 */
class PortalAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_portal_login_success(): void
    {
        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $identity = $this->makePortalIdentity($agency->id, $client->id, [
            'email' => 'client@acme.test',
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'client@acme.test',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('data.client.email', 'client@acme.test')
            ->assertJsonPath('data.client.client_id', $client->id)
            ->assertJsonPath('data.agency.id', $agency->id);
    }

    public function test_portal_token_cannot_access_internal_endpoints(): void
    {
        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $identity = $this->makePortalIdentity($agency->id, $client->id);
        $portalToken = $this->boundTokenFor($identity, 'portal');

        $this->withFreshToken($portalToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');

        $this->withFreshToken($portalToken)
            ->getJson('/api/v1/portal/auth/me')->assertOk();
    }

    public function test_internal_token_cannot_access_portal_endpoints(): void
    {
        $user = $this->makeMembershipUser();
        $appToken = $this->boundTokenFor($user);

        $this->withFreshToken($appToken)
            ->getJson('/api/v1/portal/auth/me')
            ->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_portal_login_locked_agency_is_rejected(): void
    {
        $agency = Agency::factory()->locked()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $this->makePortalIdentity($agency->id, $client->id, [
            'email' => 'client@acme.test',
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'client@acme.test',
            'password' => 'secret123',
        ])->assertStatus(403)->assertJsonPath('error.code', 'AGENCY_LOCKED');
    }

    public function test_portal_password_reset_flow(): void
    {
        $agency = Agency::factory()->create();
        $client = Client::factory()->create(['agency_id' => $agency->id]);
        $identity = $this->makePortalIdentity($agency->id, $client->id, [
            'email' => 'client@acme.test',
        ]);
        // DEC-018: one identity, one password — the users broker
        // serves the Portal too.
        $token = Password::broker('users')->createToken($identity);

        $this->postJson('/api/v1/portal/auth/reset-password', [
            'token' => $token,
            'email' => 'client@acme.test',
            'password' => 'brandnew123',
        ])->assertOk();
        $this->assertTrue(Hash::check('brandnew123', $identity->fresh()->password));
    }
}
