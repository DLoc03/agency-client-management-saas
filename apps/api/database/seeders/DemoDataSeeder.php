<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Membership;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Local demo data only. Runs when SEED_DEMO_DATA=true (see DatabaseSeeder).
 * Demo credentials (local only, never production) — every password is "password":
 *   Owner:      owner@demo.test      (agency_owner)
 *   Admin:      admin@demo.test      (admin)
 *   Sales:      sales@demo.test      (sales_manager)
 *   PM:         pm@demo.test         (project_manager)
 *   Accountant: accountant@demo.test (accountant)
 *   Member:     member@demo.test     (team_member)
 *   Client:     client@demo.test     (Portal identity with a client
 *                                     membership on the demo client)
 * Since DEC-018 each account is one identity plus a staff membership
 * in the demo agency (the client account: a client membership).
 * Also seeds one demo client, one demo team and two demo projects with
 * milestones and tasks so every module has data for manual acceptance.
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // The agency itself is tenant-agnostic reference data; all of
        // its tenant data is seeded inside Tenant::run (DEC-018).
        $agency = Agency::firstOrCreate(
            ['slug' => 'demo-agency'],
            ['name' => 'Demo Agency', 'base_currency' => 'USD', 'timezone' => 'Asia/Ho_Chi_Minh']
        );

        Tenant::run($agency->id, function () use ($agency) {
            $this->seedTenantData($agency);
        });
    }

    private function seedTenantData(Agency $agency): void
    {
        $owner = $this->identityWithMembership(
            'owner@demo.test', 'Demo Owner', $agency, [Role::OWNER], null
        );

        $roleAccounts = [
            'admin@demo.test' => ['Demo Admin', Role::ADMIN, 'Administrator'],
            'sales@demo.test' => ['Demo Sales', Role::SALES_MANAGER, 'Sales Manager'],
            'pm@demo.test' => ['Demo PM', Role::PROJECT_MANAGER, 'Project Manager'],
            'accountant@demo.test' => ['Demo Accountant', Role::ACCOUNTANT, 'Accountant'],
            'member@demo.test' => ['Demo Member', Role::TEAM_MEMBER, 'Developer'],
        ];

        $users = ['owner@demo.test' => $owner];
        foreach ($roleAccounts as $email => [$name, $roleKey, $jobTitle]) {
            $users[$email] = $this->identityWithMembership(
                $email, $name, $agency, [$roleKey], $jobTitle
            );
        }

        $pm = $users['pm@demo.test'];
        $member = $users['member@demo.test'];

        $client = Client::firstOrCreate(
            ['agency_id' => $agency->id, 'email' => 'contact@democlient.test'],
            [
                'name' => 'Demo Client Co',
                'type' => Client::TYPE_COMPANY,
                'status' => Client::STATUS_ACTIVE,
                'account_manager_id' => $owner->id,
            ]
        );

        // Portal demo account: an identity + a client membership.
        $portalIdentity = User::firstOrCreate(
            ['email' => 'client@demo.test'],
            [
                'name' => 'Demo Client',
                'password' => Hash::make('password'),
                'locale' => 'en',
            ]
        );
        Membership::firstOrCreate(
            [
                'user_id' => $portalIdentity->id,
                'agency_id' => $agency->id,
                'kind' => Membership::KIND_CLIENT,
                'client_id' => $client->id,
            ],
            ['is_active' => true]
        );

        $team = Team::firstOrCreate(
            ['agency_id' => $agency->id, 'name' => 'Demo Delivery Team'],
            ['description' => 'Demo team for manual acceptance.', 'lead_id' => $pm->id]
        );
        $team->members()->syncWithoutDetaching([$owner->id, $pm->id, $member->id]);

        $projectA = Project::firstOrCreate(
            ['agency_id' => $agency->id, 'name' => 'Website Redesign for Demo Client'],
            [
                'client_id' => $client->id,
                'description' => 'Demo project (in progress) for manual acceptance.',
                'status' => Project::STATUS_IN_PROGRESS,
                'project_manager_id' => $pm->id,
                'start_date' => now()->subDays(14)->toDateString(),
                'due_date' => now()->addDays(30)->toDateString(),
                'budget' => 12000,
            ]
        );
        $projectA->members()->syncWithoutDetaching([$owner->id, $pm->id, $member->id]);

        $milestoneA = Milestone::firstOrCreate(
            ['project_id' => $projectA->id, 'name' => 'Discovery & Design'],
            [
                'agency_id' => $agency->id,
                'status' => Milestone::STATUS_IN_PROGRESS,
                'due_date' => now()->addDays(10)->toDateString(),
            ]
        );

        $demoTasksA = [
            ['Design homepage mockup', Task::STATUS_DONE, Task::PRIORITY_HIGH, $member->id, now()->subDays(2)],
            ['Build landing page', Task::STATUS_IN_PROGRESS, Task::PRIORITY_MEDIUM, $member->id, now()->addDays(5)],
            ['Client review meeting', Task::STATUS_TODO, Task::PRIORITY_MEDIUM, $pm->id, now()->addDays(7)],
            ['Prepare content inventory', Task::STATUS_TODO, Task::PRIORITY_LOW, $member->id, now()->subDay()],
        ];
        foreach ($demoTasksA as $i => [$title, $status, $priority, $assigneeId, $dueDate]) {
            Task::firstOrCreate(
                ['project_id' => $projectA->id, 'title' => $title],
                [
                    'agency_id' => $agency->id,
                    'milestone_id' => $milestoneA->id,
                    'status' => $status,
                    'priority' => $priority,
                    'assignee_id' => $assigneeId,
                    'due_date' => $dueDate,
                    'position' => $i,
                ]
            );
        }

        $projectB = Project::firstOrCreate(
            ['agency_id' => $agency->id, 'name' => 'Brand Identity Package'],
            [
                'client_id' => $client->id,
                'description' => 'Demo project (draft) for manual acceptance.',
                'status' => Project::STATUS_DRAFT,
                'project_manager_id' => $pm->id,
                'due_date' => now()->addDays(45)->toDateString(),
                'budget' => 5000,
            ]
        );
        $projectB->members()->syncWithoutDetaching([$pm->id, $member->id]);

        $milestoneB = Milestone::firstOrCreate(
            ['project_id' => $projectB->id, 'name' => 'Logo Concepts'],
            [
                'agency_id' => $agency->id,
                'status' => Milestone::STATUS_PLANNED,
                'due_date' => now()->addDays(20)->toDateString(),
            ]
        );

        Task::firstOrCreate(
            ['project_id' => $projectB->id, 'title' => 'Prepare logo concepts'],
            [
                'agency_id' => $agency->id,
                'milestone_id' => $milestoneB->id,
                'status' => Task::STATUS_TODO,
                'priority' => Task::PRIORITY_MEDIUM,
                'assignee_id' => $member->id,
                'due_date' => now()->addDays(12),
                'position' => 0,
            ]
        );
    }

    /** Create (or fetch) an identity plus its staff membership + roles. */
    private function identityWithMembership(
        string $email,
        string $name,
        Agency $agency,
        array $roleKeys,
        ?string $jobTitle
    ): User {
        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make('password'),
                'locale' => 'en',
            ]
        );

        $membership = Membership::firstOrCreate(
            [
                'user_id' => $user->id,
                'agency_id' => $agency->id,
                'kind' => Membership::KIND_STAFF,
                'client_id' => null,
            ],
            ['is_active' => true, 'job_title' => $jobTitle]
        );
        $membership->roles()->syncWithoutDetaching(
            Role::whereIn('key', $roleKeys)->pluck('id')
        );

        return $user;
    }
}
