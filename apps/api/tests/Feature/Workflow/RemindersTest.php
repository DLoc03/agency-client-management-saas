<?php

namespace Tests\Feature\Workflow;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Milestone;
use App\Models\Notification as AppNotification;
use App\Models\Project;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * BE-009 deadline reminders (docs/WORKFLOW_CONTRACT.md section 6,
 * DEC-026): each rule fires for the right recipient, a second run on
 * the same agency-local day creates nothing twice (dedupe), dates
 * follow the agency timezone, invoice reminders stay internal, and
 * notifications older than 90 days are pruned.
 */
class RemindersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** @return Collection<int, AppNotification> */
    private function notificationsFor(User $user, ?string $type = null): Collection
    {
        // Bypass reason: test-side inspection across the recipient's
        // rows; the query pins the user explicitly.
        return Tenant::bypass(fn () => AppNotification::query()
            ->where('user_id', $user->id)
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy('id')
            ->get());
    }

    private function runReminders(): void
    {
        $this->artisan('reminders:run')->assertSuccessful();
    }

    private function makeProject(User $owner, array $attrs = []): Project
    {
        return Project::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $owner->agency_id])->id,
        ], $attrs));
    }

    public function test_task_due_and_overdue_reminders_fire_once_per_day(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'assignee_id' => $member->id, 'due_date' => now()->addDay()->setTime(12, 0),
        ]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'assignee_id' => $member->id, 'due_date' => now()->subDay()->setTime(12, 0),
        ]);
        // Done tasks and unassigned tasks never remind.
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'assignee_id' => $member->id, 'status' => Task::STATUS_DONE,
            'due_date' => now()->subDay()->setTime(12, 0),
        ]);
        Task::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'assignee_id' => null, 'due_date' => now()->subDay()->setTime(12, 0),
        ]);

        $this->runReminders();

        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_DUE));
        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_OVERDUE));

        // Idempotent: a second run the same day creates nothing new.
        $this->runReminders();

        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_DUE));
        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_OVERDUE));
    }

    public function test_milestone_reminders_go_to_the_project_manager_only(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $manager = $this->makeMembershipUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner, ['project_manager_id' => $manager->id]);

        Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'due_date' => now()->addDay()->toDateString(),
        ]);
        Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'due_date' => now()->subDays(2)->toDateString(),
        ]);
        // Completed milestones never remind.
        Milestone::factory()->create([
            'agency_id' => $owner->agency_id, 'project_id' => $project->id,
            'status' => Milestone::STATUS_COMPLETED,
            'due_date' => now()->subDays(2)->toDateString(),
        ]);

        $this->runReminders();

        $this->assertCount(1, $this->notificationsFor($manager, Notifier::TYPE_REMINDER_MILESTONE_DUE));
        $this->assertCount(1, $this->notificationsFor($manager, Notifier::TYPE_REMINDER_MILESTONE_OVERDUE));
        $this->assertCount(0, $this->notificationsFor($member));
        $this->assertCount(0, $this->notificationsFor($owner));
    }

    public function test_lead_followup_reminder_rules(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $sales = $this->makeMembershipUser([Role::SALES_MANAGER], $owner->agency_id);

        $makeLead = fn (array $attrs) => Lead::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'owner_id' => $sales->id,
        ], $attrs));

        // Stale contact in an open stage -> reminds.
        $makeLead(['last_contacted_at' => now()->subDays(4)]);
        // Never contacted and created long ago -> reminds.
        $makeLead(['last_contacted_at' => null, 'created_at' => now()->subDays(4)]);
        // Recently contacted -> no.
        $makeLead(['last_contacted_at' => now()->subDay()]);
        // Closed stage -> no.
        $makeLead(['status' => Lead::STATUS_UNQUALIFIED, 'last_contacted_at' => now()->subDays(10)]);
        // Converted -> no.
        $convertedClient = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $makeLead(['last_contacted_at' => now()->subDays(10), 'converted_client_id' => $convertedClient->id, 'converted_at' => now()]);
        // No assignee -> nobody to remind.
        Lead::factory()->create([
            'agency_id' => $owner->agency_id, 'owner_id' => null,
            'last_contacted_at' => now()->subDays(10),
        ]);

        $this->runReminders();

        $this->assertCount(2, $this->notificationsFor($sales, Notifier::TYPE_REMINDER_LEAD_FOLLOWUP));

        $this->runReminders();
        $this->assertCount(2, $this->notificationsFor($sales, Notifier::TYPE_REMINDER_LEAD_FOLLOWUP));
    }

    public function test_invoice_overdue_reminder_goes_to_accountant_and_owner_never_to_clients(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $accountant = $this->makeMembershipUser([Role::ACCOUNTANT], $owner->agency_id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);

        $makeInvoice = fn (array $attrs) => Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $client->id,
            'status' => Invoice::STATUS_SENT,
            'sent_at' => now()->subDays(10),
            'due_date' => now()->subDays(3)->toDateString(),
            'total' => 100,
        ], $attrs));

        $makeInvoice([]);
        // Already fully paid (balance 0) -> no reminder.
        $paidUp = $makeInvoice([]);
        $paidUp->payments()->create([
            'agency_id' => $owner->agency_id, 'amount' => 100, 'paid_on' => now()->toDateString(),
            'method' => 'cash', 'recorded_by' => $owner->id,
        ]);
        // Not yet due -> no reminder.
        $makeInvoice(['due_date' => now()->addDays(5)->toDateString()]);
        // Drafts are never overdue.
        $makeInvoice(['status' => Invoice::STATUS_DRAFT, 'sent_at' => null]);

        $this->runReminders();

        $this->assertCount(1, $this->notificationsFor($accountant, Notifier::TYPE_REMINDER_INVOICE_OVERDUE));
        $this->assertCount(1, $this->notificationsFor($owner, Notifier::TYPE_REMINDER_INVOICE_OVERDUE));
        $this->assertCount(0, $this->notificationsFor($member));
        $this->assertCount(0, $this->notificationsFor($portalUser));

        $this->runReminders();
        $this->assertCount(1, $this->notificationsFor($accountant, Notifier::TYPE_REMINDER_INVOICE_OVERDUE));
    }

    public function test_notifications_older_than_90_days_are_pruned(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);

        $old = AppNotification::factory()->create([
            'agency_id' => $owner->agency_id, 'user_id' => $owner->id,
            'created_at' => now()->subDays(100),
        ]);
        $recent = AppNotification::factory()->create([
            'agency_id' => $owner->agency_id, 'user_id' => $owner->id,
            'created_at' => now()->subDays(10),
        ]);

        $this->runReminders();

        // Bypass reason: test-side inspection pinned by id.
        $remaining = Tenant::bypass(fn () => AppNotification::query()
            ->whereIn('id', [$old->id, $recent->id])->pluck('id')->all());
        $this->assertSame([$recent->id], $remaining);
    }

    public function test_reminder_dates_follow_the_agency_timezone(): void
    {
        // 2026-11-27 17:30 UTC is already 2026-11-28 00:30 in Saigon:
        // agency-local "tomorrow" is 2026-11-29, not the UTC 28th.
        Carbon::setTestNow('2026-11-27 17:30:00');

        $agency = Agency::factory()->create(['timezone' => 'Asia/Ho_Chi_Minh']);
        $owner = $this->makeMembershipUser([Role::OWNER], $agency->id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $agency->id);
        $project = $this->makeProject($owner);

        // Due 2026-11-29 10:00 Saigon (= 03:00 UTC): tomorrow locally.
        Task::factory()->create([
            'agency_id' => $agency->id, 'project_id' => $project->id,
            'assignee_id' => $member->id,
            'due_date' => Carbon::parse('2026-11-29 03:00:00'),
        ]);
        // Due 2026-11-28 17:00 Saigon (= 10:00 UTC): today locally —
        // neither "due tomorrow" nor overdue.
        Task::factory()->create([
            'agency_id' => $agency->id, 'project_id' => $project->id,
            'assignee_id' => $member->id,
            'due_date' => Carbon::parse('2026-11-28 10:00:00'),
        ]);

        $this->runReminders();

        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_DUE));
        $this->assertCount(0, $this->notificationsFor($member, Notifier::TYPE_REMINDER_TASK_OVERDUE));
    }
}
