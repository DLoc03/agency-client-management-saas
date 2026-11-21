<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientContactController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientNoteController;
use App\Http\Controllers\Api\ClientPortalAccountController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\PortalAuthController;
use App\Http\Controllers\Api\TagController;
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

// Client module (docs/CLIENT_CONTRACT.md) — internal app only, RBAC
// permissions enforced per route; tenancy via the BelongsToAgency scope.
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app'])->group(function () {
    Route::get('/clients', [ClientController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients', [ClientController::class, 'store'])->middleware('permission:clients.create');
    Route::get('/clients/{client}', [ClientController::class, 'show'])->middleware('permission:clients.view');
    Route::patch('/clients/{client}', [ClientController::class, 'update'])->middleware('permission:clients.update');
    Route::delete('/clients/{client}', [ClientController::class, 'destroy'])->middleware('permission:clients.delete');

    Route::get('/clients/{client}/contacts', [ClientContactController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients/{client}/contacts', [ClientContactController::class, 'store'])->middleware('permission:clients.update');
    Route::patch('/clients/{client}/contacts/{contactId}', [ClientContactController::class, 'update'])->middleware('permission:clients.update');
    Route::delete('/clients/{client}/contacts/{contactId}', [ClientContactController::class, 'destroy'])->middleware('permission:clients.update');

    Route::get('/clients/{client}/notes', [ClientNoteController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients/{client}/notes', [ClientNoteController::class, 'store'])->middleware('permission:clients.notes.manage');
    Route::delete('/clients/{client}/notes/{noteId}', [ClientNoteController::class, 'destroy'])->middleware('permission:clients.notes.manage');

    Route::get('/clients/{client}/portal-accounts', [ClientPortalAccountController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/clients/{client}/portal-accounts', [ClientPortalAccountController::class, 'store'])->middleware('permission:clients.portal_accounts.manage');
    Route::patch('/clients/{client}/portal-accounts/{accountId}', [ClientPortalAccountController::class, 'update'])->middleware('permission:clients.portal_accounts.manage');

    Route::get('/tags', [TagController::class, 'index'])->middleware('permission:clients.view');
    Route::post('/tags', [TagController::class, 'store'])->middleware('permission:clients.create');
});
