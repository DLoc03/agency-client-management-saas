<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $names = [
            Role::OWNER => 'Agency Owner',
            Role::ADMIN => 'Admin',
            Role::SALES_MANAGER => 'Sales Manager',
            Role::PROJECT_MANAGER => 'Project Manager',
            Role::TEAM_MEMBER => 'Team Member',
            Role::ACCOUNTANT => 'Accountant',
        ];

        foreach ($names as $key => $name) {
            Role::firstOrCreate(['key' => $key], ['name' => $name]);
        }
    }
}
