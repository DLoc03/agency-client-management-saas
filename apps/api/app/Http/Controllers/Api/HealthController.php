<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Health check for the API.
 *
 * Response follows the project-wide standard format: { data, meta?, error? }
 * (see docs/CONVENTIONS.md). This endpoint is public and must stay cheap:
 * no database or external service checks here.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => [
                'status' => 'ok',
                'service' => 'api',
                'version' => config('app.version'),
                'timestamp' => now()->toIso8601String(),
            ],
        ]);
    }
}
