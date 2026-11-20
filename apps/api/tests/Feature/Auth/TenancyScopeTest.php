<?php

namespace Tests\Feature\Auth;

use App\Models\Agency;
use App\Models\ClientAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenancyScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_queries_are_scoped_to_authenticated_users_agency(): void
    {
        $agencyA = Agency::factory()->create();
        $agencyB = Agency::factory()->create();
        ClientAccount::factory()->count(2)->create(['agency_id' => $agencyA->id]);
        ClientAccount::factory()->count(3)->create(['agency_id' => $agencyB->id]);

        $userA = User::factory()->create(['agency_id' => $agencyA->id]);
        $this->actingAs($userA);

        $this->assertEquals(2, ClientAccount::count());
        $this->assertTrue(ClientAccount::pluck('agency_id')->every(fn ($id) => $id === $agencyA->id));
    }

    public function test_unauthenticated_context_is_not_scoped(): void
    {
        ClientAccount::factory()->count(2)->create();

        $this->assertEquals(2, ClientAccount::count());
    }
}
