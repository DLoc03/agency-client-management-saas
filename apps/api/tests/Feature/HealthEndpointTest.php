<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_endpoint_returns_standard_format(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => ['status', 'service', 'version', 'timestamp'],
            ])
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonPath('data.service', 'api');
    }
}
