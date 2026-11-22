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
        ],
        Role::ACCOUNTANT => ['workspace.view', 'clients.view', 'leads.view', 'projects.view'],
    ],
];
