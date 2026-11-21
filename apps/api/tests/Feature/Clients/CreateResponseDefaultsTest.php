<?php

namespace Tests\Feature\Clients;

use App\Models\Client;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * FIX-005 regression: create-endpoint responses must reflect the values
 * actually stored in the database (column defaults included), not the
 * in-memory attributes of the just-built model.
 */
class CreateResponseDefaultsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function owner(): User
    {
        $user = User::factory()->create();
        $user->roles()->sync(Role::where('key', Role::OWNER)->pluck('id'));

        return $user;
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($user->createToken('test', ['app'])->plainTextToken);
    }

    public function test_create_client_response_reflects_database_defaults(): void
    {
        $owner = $this->owner();

        // Neither status nor type is sent: both come from column defaults.
        $this->as($owner)->postJson('/api/v1/clients', ['name' => 'Defaults Co'])
            ->assertCreated()
            ->assertJsonPath('data.status', Client::STATUS_ACTIVE)
            ->assertJsonPath('data.type', Client::TYPE_COMPANY);
    }

    public function test_create_note_response_includes_author(): void
    {
        $owner = $this->owner();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/notes', ['body' => 'First note'])
            ->assertCreated()
            ->assertJsonPath('data.author.id', $owner->id)
            ->assertJsonPath('data.author.name', $owner->name);
    }

    public function test_create_portal_account_response_reflects_database_defaults(): void
    {
        $owner = $this->owner();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        // locale and is_active come from column defaults when not sent.
        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/portal-accounts', [
            'name' => 'Boss', 'email' => 'boss@defaults.test', 'password' => 'secret123',
        ])
            ->assertCreated()
            ->assertJsonPath('data.locale', 'en')
            ->assertJsonPath('data.is_active', true);
    }

    public function test_create_contact_response_reflects_database_defaults(): void
    {
        $owner = $this->owner();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $this->as($owner)->postJson('/api/v1/clients/'.$client->id.'/contacts', [
            'full_name' => 'No Flag',
        ])
            ->assertCreated()
            ->assertJsonPath('data.is_primary', false);
    }
}
