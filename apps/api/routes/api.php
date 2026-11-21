<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientContactController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientNoteController;
use App\Http\Controllers\Api\ClientPortalAccountController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\LeadActivityController;
use App\Http\Controllers\Api\LeadContactController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\LeadNoteController;
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

// CRM module (docs/CRM_CONTRACT.md) — same tenancy and permission model.
// The fixed-path routes (pipeline-summary, lead-activities/due) are
// registered before /leads/{lead} so they are not swallowed by binding.
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app'])->group(function () {
    Route::get('/leads/pipeline-summary', [LeadController::class, 'pipelineSummary'])->middleware('permission:leads.view');
    Route::get('/lead-activities/due', [LeadActivityController::class, 'due'])->middleware('permission:leads.view');

    Route::get('/leads', [LeadController::class, 'index'])->middleware('permission:leads.view');
    Route::post('/leads', [LeadController::class, 'store'])->middleware('permission:leads.create');
    Route::get('/leads/{lead}', [LeadController::class, 'show'])->middleware('permission:leads.view');
    Route::patch('/leads/{lead}', [LeadController::class, 'update'])->middleware('permission:leads.update');
    Route::delete('/leads/{lead}', [LeadController::class, 'destroy'])->middleware('permission:leads.delete');
    Route::post('/leads/{lead}/convert', [LeadController::class, 'convert'])->middleware('permission:leads.convert');

    Route::get('/leads/{lead}/contacts', [LeadContactController::class, 'index'])->middleware('permission:leads.view');
    Route::post('/leads/{lead}/contacts', [LeadContactController::class, 'store'])->middleware('permission:leads.update');
    Route::patch('/leads/{lead}/contacts/{contactId}', [LeadContactController::class, 'update'])->middleware('permission:leads.update');
    Route::delete('/leads/{lead}/contacts/{contactId}', [LeadContactController::class, 'destroy'])->middleware('permission:leads.update');

    Route::get('/leads/{lead}/notes', [LeadNoteController::class, 'index'])->middleware('permission:leads.view');
    Route::post('/leads/{lead}/notes', [LeadNoteController::class, 'store'])->middleware('permission:leads.notes.manage');
    Route::delete('/leads/{lead}/notes/{noteId}', [LeadNoteController::class, 'destroy'])->middleware('permission:leads.notes.manage');

    Route::get('/leads/{lead}/activities', [LeadActivityController::class, 'index'])->middleware('permission:leads.view');
    Route::post('/leads/{lead}/activities', [LeadActivityController::class, 'store'])->middleware('permission:leads.activities.manage');
    Route::patch('/leads/{lead}/activities/{activityId}', [LeadActivityController::class, 'update'])->middleware('permission:leads.activities.manage');
    Route::delete('/leads/{lead}/activities/{activityId}', [LeadActivityController::class, 'destroy'])->middleware('permission:leads.activities.manage');
});
