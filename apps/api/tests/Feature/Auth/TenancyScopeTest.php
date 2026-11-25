<?php

namespace Tests\Feature\Auth;

use App\Exceptions\TenantContextMissing;
use App\Models\Agency;
use App\Models\Client;
use App\Support\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * DEC-018 fail-closed tenancy: scoped models run only inside a
 * Tenant::run context or an explicit Tenant::bypass — never silently
 * unscoped (the pre-DEC-018 behaviour).
 */
class TenancyScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_queries_are_scoped_inside_tenant_run(): void
    {
        $agencyA = Agency::factory()->create();
        $agencyB = Agency::factory()->create();
        Client::factory()->count(2)->create(['agency_id' => $agencyA->id]);
        Client::factory()->count(3)->create(['agency_id' => $agencyB->id]);

        Tenant::run($agencyA->id, function () use ($agencyA) {
            $this->assertEquals(2, Client::count());
            $this->assertTrue(Client::pluck('agency_id')->every(fn ($id) => $id === $agencyA->id));
        });
    }

    public function test_query_without_context_throws_fail_closed(): void
    {
        Client::factory()->count(2)->create();

        $this->expectException(TenantContextMissing::class);
        Client::count();
    }

    public function test_explicit_bypass_runs_unscoped(): void
    {
        Client::factory()->count(2)->create();

        $count = Tenant::bypass(fn () => Client::count());

        $this->assertEquals(2, $count);
    }
}
