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
    ],

    'roles' => [
        Role::OWNER => ['*'],
        Role::ADMIN => [
            'workspace.view',
            'members.view',
            'members.manage',
            'roles.assign.others',
        ],
        Role::SALES_MANAGER => ['workspace.view'],
        Role::PROJECT_MANAGER => ['workspace.view'],
        Role::TEAM_MEMBER => ['workspace.view'],
        Role::ACCOUNTANT => ['workspace.view'],
    ],
];
