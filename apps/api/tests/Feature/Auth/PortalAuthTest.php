<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\ClientAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PortalAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_portal_login_success(): void
    {
        $account = ClientAccount::factory()->create([
            'email' => 'client@acme.test',
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'client@acme.test',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('data.client.email', 'client@acme.test')
            ->assertJsonPath('data.agency.id', $account->agency_id);
    }

    public function test_portal_token_cannot_access_internal_endpoints(): void
    {
        $account = ClientAccount::factory()->create();
        $portalToken = $account->createToken('portal', ['portal'])->plainTextToken;

        $this->withFreshToken($portalToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');

        $this->withFreshToken($portalToken)
            ->getJson('/api/v1/portal/auth/me')->assertOk();
    }

    public function test_internal_token_cannot_access_portal_endpoints(): void
    {
        $user = User::factory()->create();
        $appToken = $user->createToken('app', ['app'])->plainTextToken;

        $this->withFreshToken($appToken)
            ->getJson('/api/v1/portal/auth/me')
            ->assertStatus(403)->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_portal_login_locked_agency_is_rejected(): void
    {
        $agency = Agency::factory()->locked()->create();
        ClientAccount::factory()->create([
            'email' => 'client@acme.test',
            'agency_id' => $agency->id,
            'password' => Hash::make('secret123'),
        ]);

        $this->postJson('/api/v1/portal/auth/login', [
            'email' => 'client@acme.test',
            'password' => 'secret123',
        ])->assertStatus(403)->assertJsonPath('error.code', 'AGENCY_LOCKED');
    }

    public function test_portal_password_reset_flow(): void
    {
        $account = ClientAccount::factory()->create(['email' => 'client@acme.test']);
        $token = Password::broker('clients')->createToken($account);

        $this->postJson('/api/v1/portal/auth/reset-password', [
            'token' => $token,
            'email' => 'client@acme.test',
            'password' => 'brandnew123',
        ])->assertOk();
        $this->assertTrue(Hash::check('brandnew123', $account->fresh()->password));
    }
}
