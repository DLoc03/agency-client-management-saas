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
        ],
        Role::SALES_MANAGER => [
            'workspace.view',
            // DEC-009.2: sales scope is the whole agency in the MVP.
            'clients.view',
            'clients.create',
            'clients.update',
            'clients.notes.manage',
            'clients.portal_accounts.manage',
        ],
        Role::PROJECT_MANAGER => ['workspace.view', 'clients.view'],
        // DEC-009.3: Team Members hold no clients.* permission in the MVP.
        Role::TEAM_MEMBER => ['workspace.view'],
        Role::ACCOUNTANT => ['workspace.view', 'clients.view'],
    ],
];
