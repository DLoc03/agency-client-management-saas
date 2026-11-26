<?php

use App\Http\Controllers\Api\AgencyPaymentDetailsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientContactController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientNoteController;
use App\Http\Controllers\Api\ClientPortalAccountController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LeadActivityController;
use App\Http\Controllers\Api\LeadContactController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\LeadNoteController;
use App\Http\Controllers\Api\MilestoneController;
use App\Http\Controllers\Api\OwnershipController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PortalAuthController;
use App\Http\Controllers\Api\PortalInvoiceController;
use App\Http\Controllers\Api\PortalProjectController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectMemberController;
use App\Http\Controllers\Api\ProjectTeamController;
use App\Http\Controllers\Api\TagController;
use App\Http\Controllers\Api\TaskChecklistController;
use App\Http\Controllers\Api\TaskCommentController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\TeamMemberController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkloadController;
use Illuminate\Support\Facades\Route;

Route::get('/v1/health', HealthController::class);

// Internal app auth — tokens carry the `app` ability (docs/AUTH_CONTRACT.md).
Route::prefix('v1/auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::post('/select-agency', [AuthController::class, 'selectAgency'])
        ->middleware(['auth:sanctum', 'ability:select']);
    Route::post('/switch-agency', [AuthController::class, 'switchAgency'])
        ->middleware(['auth:sanctum', 'abilities:app,portal']);
    Route::get('/memberships', [AuthController::class, 'memberships'])
        ->middleware('auth:sanctum');

    Route::middleware(['auth:sanctum', 'ability:app'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me'])->middleware('tenant');
        Route::post('/change-password', [AuthController::class, 'changePassword'])->middleware('tenant');
    });
});

// Client Portal auth — separate account type, `portal` ability only.
Route::prefix('v1/portal/auth')->group(function () {
    Route::post('/login', [PortalAuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/forgot-password', [PortalAuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
    Route::post('/reset-password', [PortalAuthController::class, 'resetPassword'])->middleware('throttle:5,1');

    Route::post('/select-agency', [PortalAuthController::class, 'selectAgency'])
        ->middleware(['auth:sanctum', 'ability:select']);
    Route::post('/switch-agency', [PortalAuthController::class, 'switchAgency'])
        ->middleware(['auth:sanctum', 'ability:portal']);

    Route::middleware(['auth:sanctum', 'ability:portal'])->group(function () {
        Route::post('/logout', [PortalAuthController::class, 'logout']);
        Route::get('/me', [PortalAuthController::class, 'me'])->middleware('tenant');
    });
});

// Invitation acceptance is public: the emailed token is the credential
// (docs/TEAM_CONTRACT.md section 4).
Route::post('/v1/invitations/accept', [InvitationController::class, 'accept'])->middleware('throttle:10,1');
Route::get('/v1/invitations/preview', [InvitationController::class, 'preview'])->middleware('throttle:30,1');

// Client module (docs/CLIENT_CONTRACT.md) — internal app only, RBAC
// permissions enforced per route; tenancy via the BelongsToAgency scope.
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app', 'tenant'])->group(function () {
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
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app', 'tenant'])->group(function () {
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

// Project module (docs/PROJECT_CONTRACT.md, DEC-016) — same tenancy and
// permission model. The fixed-path route /tasks/due is registered before
// /tasks/{task} so it is not swallowed by binding.
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app', 'tenant'])->group(function () {
    Route::get('/projects', [ProjectController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/projects', [ProjectController::class, 'store'])->middleware('permission:projects.create');
    Route::get('/projects/{project}', [ProjectController::class, 'show'])->middleware('permission:projects.view');
    Route::patch('/projects/{project}', [ProjectController::class, 'update'])->middleware('permission:projects.update');
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->middleware('permission:projects.delete');
    Route::get('/projects/{project}/timeline', [ProjectController::class, 'timeline'])->middleware('permission:projects.view');

    Route::get('/projects/{project}/members', [ProjectMemberController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/projects/{project}/members', [ProjectMemberController::class, 'store'])->middleware('permission:projects.members.manage');
    Route::delete('/projects/{project}/members/{userId}', [ProjectMemberController::class, 'destroy'])->middleware('permission:projects.members.manage');

    Route::get('/projects/{project}/milestones', [MilestoneController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/projects/{project}/milestones', [MilestoneController::class, 'store'])->middleware('permission:milestones.manage');
    Route::patch('/projects/{project}/milestones/{milestoneId}', [MilestoneController::class, 'update'])->middleware('permission:milestones.manage');
    Route::delete('/projects/{project}/milestones/{milestoneId}', [MilestoneController::class, 'destroy'])->middleware('permission:milestones.manage');

    Route::get('/projects/{project}/tasks', [TaskController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/projects/{project}/tasks', [TaskController::class, 'store'])->middleware('permission:tasks.create');

    Route::get('/tasks/due', [TaskController::class, 'due'])->middleware('permission:projects.view');
    Route::get('/tasks/{task}', [TaskController::class, 'show'])->middleware('permission:projects.view');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->middleware('permission:tasks.update');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->middleware('permission:tasks.delete');

    Route::get('/tasks/{task}/comments', [TaskCommentController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/tasks/{task}/comments', [TaskCommentController::class, 'store'])->middleware('permission:tasks.comments.manage');
    Route::delete('/tasks/{task}/comments/{commentId}', [TaskCommentController::class, 'destroy'])->middleware('permission:tasks.comments.manage');

    Route::get('/tasks/{task}/checklist', [TaskChecklistController::class, 'index'])->middleware('permission:projects.view');
    Route::post('/tasks/{task}/checklist', [TaskChecklistController::class, 'store'])->middleware('permission:tasks.update');
    Route::patch('/tasks/{task}/checklist/{itemId}', [TaskChecklistController::class, 'update'])->middleware('permission:tasks.update');
    Route::delete('/tasks/{task}/checklist/{itemId}', [TaskChecklistController::class, 'destroy'])->middleware('permission:tasks.update');
    // Team & Resource module (docs/TEAM_CONTRACT.md, DEC-017).
    Route::get('/teams', [TeamController::class, 'index'])->middleware('permission:teams.view');
    Route::post('/teams', [TeamController::class, 'store'])->middleware('permission:teams.create');
    Route::get('/teams/{team}', [TeamController::class, 'show'])->middleware('permission:teams.view');
    Route::patch('/teams/{team}', [TeamController::class, 'update'])->middleware('permission:teams.update');
    Route::delete('/teams/{team}', [TeamController::class, 'destroy'])->middleware('permission:teams.delete');
    Route::post('/teams/{team}/members', [TeamMemberController::class, 'store'])->middleware('permission:teams.members.manage');
    Route::delete('/teams/{team}/members/{userId}', [TeamMemberController::class, 'destroy'])->middleware('permission:teams.members.manage');

    Route::get('/users', [UserController::class, 'index'])->middleware('permission:users.view');
    Route::get('/users/{user}', [UserController::class, 'show'])->middleware('permission:users.view');
    Route::patch('/users/{user}', [UserController::class, 'update'])->middleware('permission:users.update');
    Route::put('/users/{user}/roles', [UserController::class, 'updateRoles'])->middleware('permission:users.roles.manage');
    Route::post('/ownership/transfer', [OwnershipController::class, 'transfer']);
    Route::patch('/users/{user}/activation', [UserController::class, 'activation'])->middleware('permission:users.activation');

    Route::get('/invitations', [InvitationController::class, 'index'])->middleware('permission:invitations.manage');
    Route::post('/invitations', [InvitationController::class, 'store'])->middleware('permission:invitations.manage');
    Route::post('/invitations/{invitation}/resend', [InvitationController::class, 'resend'])->middleware('permission:invitations.manage');
    Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy'])->middleware('permission:invitations.manage');

    Route::post('/projects/{project}/teams', [ProjectTeamController::class, 'store'])->middleware('permission:projects.update');
    Route::delete('/projects/{project}/teams/{team}', [ProjectTeamController::class, 'destroy'])->middleware('permission:projects.update');

    Route::get('/workload', [WorkloadController::class, 'index'])->middleware('permission:workload.view');
});

// Finance & Billing module (docs/FINANCE_CONTRACT.md, DEC-019) — same
// tenancy and permission model. The agency payment-details endpoint
// lives here too: it edits the caller's own agency only.
Route::prefix('v1')->middleware(['auth:sanctum', 'ability:app', 'tenant'])->group(function () {
    Route::get('/invoices', [InvoiceController::class, 'index'])->middleware('permission:invoices.view');
    Route::post('/invoices', [InvoiceController::class, 'store'])->middleware('permission:invoices.create');
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show'])->middleware('permission:invoices.view');
    Route::patch('/invoices/{invoice}', [InvoiceController::class, 'update'])->middleware('permission:invoices.update');
    Route::delete('/invoices/{invoice}', [InvoiceController::class, 'destroy'])->middleware('permission:invoices.delete');
    Route::post('/invoices/{invoice}/send', [InvoiceController::class, 'send'])->middleware('permission:invoices.send');
    Route::post('/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel'])->middleware('permission:invoices.cancel');
    Route::get('/invoices/{invoice}/pdf', [InvoiceController::class, 'pdf'])->middleware('permission:invoices.pdf');

    Route::get('/invoices/{invoice}/payments', [PaymentController::class, 'index'])->middleware('permission:invoices.view');
    Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store'])->middleware('permission:payments.manage');
    Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])->middleware('permission:payments.manage');

    Route::patch('/agencies/{agency}/payment-details', [AgencyPaymentDetailsController::class, 'update'])->middleware('permission:agencies.payment-details.update');
});

// Portal project view (docs/PROJECT_CONTRACT.md endpoints 17-18) —
// read-only, scoped to the signed-in client's own projects.
Route::prefix('v1/portal')->middleware(['auth:sanctum', 'ability:portal', 'tenant'])->group(function () {
    Route::get('/projects', [PortalProjectController::class, 'index']);
    Route::get('/projects/{projectId}', [PortalProjectController::class, 'show']);

    // Portal invoices (docs/FINANCE_CONTRACT.md section 4.6) —
    // read-only, scoped to the signed-in client's own invoices.
    Route::get('/invoices', [PortalInvoiceController::class, 'index']);
    Route::get('/invoices/{invoiceId}', [PortalInvoiceController::class, 'show']);
});
