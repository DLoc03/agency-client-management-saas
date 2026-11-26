<?php

use App\Models\Role;

/*
 * Permission map for internal roles (DEC-005).
 * Permissions are stable machine codes; the API enforces them, the UI only
 * hides/shows. The Agency Owner implicitly holds every permission.
 * Module-level permissions are added here as modules land.
 */
return [
    'permissions' => [
        'workspace.view',
        'workspace.settings.update',
        'workspace.transfer',
        'workspace.delete',
        'members.view',
        'members.manage',
        'roles.assign.admin',
        'roles.assign.others',
        // Client module (docs/CLIENT_CONTRACT.md).
        'clients.view',
        'clients.create',
        'clients.update',
        'clients.delete',
        'clients.notes.manage',
        'clients.portal_accounts.manage',
        // CRM module (docs/CRM_CONTRACT.md).
        'leads.view',
        'leads.create',
        'leads.update',
        'leads.delete',
        'leads.convert',
        'leads.notes.manage',
        'leads.activities.manage',
        // Project module (docs/PROJECT_CONTRACT.md, DEC-016).
        'projects.view',
        'projects.create',
        'projects.update',
        'projects.delete',
        'projects.members.manage',
        'milestones.manage',
        'tasks.create',
        'tasks.update',
        'tasks.delete',
        'tasks.comments.manage',
        // Team & Resource module (docs/TEAM_CONTRACT.md, DEC-017).
        'teams.view',
        'teams.create',
        'teams.update',
        'teams.delete',
        'teams.members.manage',
        'users.view',
        'users.update',
        'users.roles.manage',
        'users.activation',
        'invitations.manage',
        'workload.view',
        // Finance & Billing module (docs/FINANCE_CONTRACT.md, DEC-019).
        'invoices.view',
        'invoices.create',
        'invoices.update',
        'invoices.send',
        'invoices.cancel',
        'invoices.delete',
        'invoices.pdf',
        'payments.manage',
        'agencies.payment-details.update',
    ],

    'roles' => [
        Role::OWNER => ['*'],
        Role::ADMIN => [
            'workspace.view',
            'members.view',
            'members.manage',
            'roles.assign.others',
            // DEC-009.5: Admin manages clients but may NOT delete them.
            'clients.view',
            'clients.create',
            'clients.update',
            'clients.notes.manage',
            'clients.portal_accounts.manage',
            // DEC-014: Admin holds every leads.* permission, delete included.
            'leads.view',
            'leads.create',
            'leads.update',
            'leads.delete',
            'leads.convert',
            'leads.notes.manage',
            'leads.activities.manage',
            // DEC-016: Admin manages projects but may NOT delete them.
            'projects.view',
            'projects.create',
            'projects.update',
            'projects.members.manage',
            'milestones.manage',
            'tasks.create',
            'tasks.update',
            'tasks.delete',
            'tasks.comments.manage',
            // DEC-017: Admin runs teams/users/invitations; touching Admin
            // accounts or the Admin role stays Owner-only (controller level).
            'teams.view',
            'teams.create',
            'teams.update',
            'teams.delete',
            'teams.members.manage',
            'users.view',
            'users.update',
            'users.roles.manage',
            'users.activation',
            'invitations.manage',
            'workload.view',
            // DEC-019: Admin runs Finance end to end except deleting
            // invoices (Owner-only, like clients/projects) and holds
            // the agency payment-details permission with the Owner.
            'invoices.view',
            'invoices.create',
            'invoices.update',
            'invoices.send',
            'invoices.cancel',
            'invoices.pdf',
            'payments.manage',
            'agencies.payment-details.update',
        ],
        Role::SALES_MANAGER => [
            'workspace.view',
            // DEC-009.2: sales scope is the whole agency in the MVP.
            'clients.view',
            'clients.create',
            'clients.update',
            'clients.notes.manage',
            'clients.portal_accounts.manage',
            // DEC-014: Sales runs the pipeline but may NOT delete leads.
            'leads.view',
            'leads.create',
            'leads.update',
            'leads.convert',
            'leads.notes.manage',
            'leads.activities.manage',
            // DEC-016: Sales is view-only on projects (handover visibility).
            'projects.view',
            // DEC-017: directory lookups only.
            'teams.view',
            'users.view',
            // DEC-019: Sales is view-only on Finance (no creating,
            // no payments) but may export the PDF for handovers.
            'invoices.view',
            'invoices.pdf',
        ],
        Role::PROJECT_MANAGER => [
            'workspace.view', 'clients.view', 'leads.view',
            // DEC-016: PM runs projects end to end except deleting them.
            'projects.view',
            'projects.create',
            'projects.update',
            'projects.members.manage',
            'milestones.manage',
            'tasks.create',
            'tasks.update',
            'tasks.delete',
            'tasks.comments.manage',
            // DEC-017: PM builds teams for their projects but may not
            // delete teams or administer accounts.
            'teams.view',
            'teams.create',
            'teams.update',
            'teams.members.manage',
            'users.view',
            'workload.view',
            // DEC-019: PM is view-only on Finance, PDF export included.
            'invoices.view',
            'invoices.pdf',
        ],
        // DEC-009.3: Team Members hold no clients.* permission in the MVP.
        // DEC-014: and no leads.* permission either.
        Role::TEAM_MEMBER => [
            'workspace.view',
            // DEC-016: Team Member views only projects they participate
            // in (scoped in the API layer) and updates only tasks
            // assigned to them (enforced in the controllers).
            'projects.view',
            'tasks.update',
            'tasks.comments.manage',
            // DEC-017: own teams + directory + own workload row (the API
            // layer scopes all three).
            'teams.view',
            'users.view',
            'workload.view',
        ],
        // DEC-019: the Accountant runs Finance (create/update/send/
        // cancel invoices, record payments) but may not delete
        // invoices (Owner-only) nor edit agency payment details.
        Role::ACCOUNTANT => [
            'workspace.view', 'clients.view', 'leads.view', 'projects.view', 'teams.view', 'users.view',
            'invoices.view',
            'invoices.create',
            'invoices.update',
            'invoices.send',
            'invoices.cancel',
            'invoices.pdf',
            'payments.manage',
        ],
    ],
];
