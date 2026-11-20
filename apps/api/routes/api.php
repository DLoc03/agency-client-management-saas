<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\PortalAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/health', HealthController::class);

// Internal app auth — tokens carry the `app` ability (docs/AUTH_CONTRACT.md).
Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::middleware(['auth:sanctum', 'ability:app'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

// Client Portal auth — separate account type, `portal` ability only.
Route::prefix('v1/portal/auth')->group(function () {
    Route::post('/login', [PortalAuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [PortalAuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/reset-password', [PortalAuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::middleware(['auth:sanctum', 'ability:portal'])->group(function () {
        Route::post('/logout', [PortalAuthController::class, 'logout']);
        Route::get('/me', [PortalAuthController::class, 'me']);
    });
});
