<?php

namespace App\Console\Commands;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Lead;
use App\Models\Membership;
use App\Models\Milestone;
use App\Models\Notification;
use App\Models\Role;
use App\Models\Task;
use App\Support\Notifier;
use App\Support\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * Deadline reminders (docs/WORKFLOW_CONTRACT.md section 6, DEC-026).
 * Runs daily from the scheduler; also runnable by hand for acceptance.
 *
 * Every rule is evaluated in the agency's own timezone ("today" is
 * the agency-local date) and writes through the Notifier with a
 * dedupe key of `reminder:{entity}:{id}:{recipient}:{Y-m-d}` — the
 * recipient segment keeps the unique index satisfiable when one
 * entity reminds several people (invoice overdue), and re-running
 * the command on the same agency-local day creates nothing twice.
 * The same run prunes notifications older than 90 days (decision Q7).
 */
class RunReminders extends Command
{
    protected $signature = 'reminders:run';

    protected $description = 'Send daily deadline reminders and prune notifications older than 90 days';

    /** Lead follow-up threshold in days without contact (decision Q4). */
    private const LEAD_FOLLOWUP_DAYS = 3;

    /** Notification retention in days (decision Q7). */
    private const RETENTION_DAYS = 90;

    public function handle(): int
    {
        // Retention sweep: tenant-agnostic maintenance that deletes
        // purely by age across all agencies — hence the explicit
        // bypass (AGENTS.md tenant rule 3).
        Tenant::bypass(fn () => Notification::query()
            ->where('created_at', '<', now()->subDays(self::RETENTION_DAYS))
            ->delete());

        // Agency is the tenant itself (not a tenant-scoped model), so
        // listing ids needs no context; each agency's rules then run
        // inside its own Tenant::run().
        $agencyIds = Agency::query()->pluck('id');

        foreach ($agencyIds as $agencyId) {
            Tenant::run($agencyId, fn () => $this->remindAgency($agencyId));
        }

        $this->info("Reminders evaluated for {$agencyIds->count()} agencies.");

        return self::SUCCESS;
    }

    private function remindAgency(int $agencyId): void
    {
        $agency = Agency::find($agencyId);
        $timezone = $agency?->timezone ?: config('app.timezone');

        $now = Carbon::now($timezone);
        $today = $now->toDateString();
        $tomorrow = $now->copy()->addDay()->toDateString();

        $this->remindTasks($today, $tomorrow, $timezone);
        $this->remindMilestones($today, $tomorrow);
        $this->remindLeads($now);
        $this->remindInvoices($today);
    }

    private function remindTasks(string $today, string $tomorrow, string $timezone): void
    {
        // Task due dates are datetimes stored in UTC: the agency-local
        // "tomorrow" window is converted before comparing.
        $tomorrowStart = Carbon::parse($tomorrow, $timezone)->startOfDay()->utc();
        $tomorrowEnd = Carbon::parse($tomorrow, $timezone)->endOfDay()->utc();
        $todayStart = Carbon::parse($today, $timezone)->startOfDay()->utc();

        // Tasks have no cancelled status (todo/in_progress/in_review/
        // done), so "open" here means simply not done.
        $open = fn ($q) => $q->whereNotNull('assignee_id')->where('status', '!=', Task::STATUS_DONE);

        Task::query()->tap($open)
            ->whereBetween('due_date', [$tomorrowStart, $tomorrowEnd])
            ->get()
            ->each(fn (Task $task) => Notifier::notify($task->assignee_id, Notifier::TYPE_REMINDER_TASK_DUE, [
                'task_id' => $task->id,
                'task_title' => $task->title,
                'project_id' => $task->project_id,
                'due_date' => $task->due_date?->toDateString(),
            ], dedupeKey: "reminder:task:{$task->id}:{$task->assignee_id}:{$today}"));

        Task::query()->tap($open)
            ->whereNotNull('due_date')
            ->where('due_date', '<', $todayStart)
            ->get()
            ->each(fn (Task $task) => Notifier::notify($task->assignee_id, Notifier::TYPE_REMINDER_TASK_OVERDUE, [
                'task_id' => $task->id,
                'task_title' => $task->title,
                'project_id' => $task->project_id,
                'due_date' => $task->due_date?->toDateString(),
            ], dedupeKey: "reminder:task:{$task->id}:{$task->assignee_id}:{$today}"));
    }

    private function remindMilestones(string $today, string $tomorrow): void
    {
        // Milestone due dates are plain dates, so the agency-local
        // date strings compare directly. Recipient: the project's
        // manager only (decision Q6).
        $open = fn ($q) => $q->where('status', '!=', Milestone::STATUS_COMPLETED);

        $notify = function (Milestone $milestone, string $type) use ($today) {
            $managerId = $milestone->project?->project_manager_id;
            if (! $managerId) {
                return;
            }

            Notifier::notify($managerId, $type, [
                'milestone_id' => $milestone->id,
                'milestone_name' => $milestone->name,
                'project_id' => $milestone->project_id,
                'project_name' => $milestone->project?->name,
                'due_date' => $milestone->due_date?->toDateString(),
            ], dedupeKey: "reminder:milestone:{$milestone->id}:{$managerId}:{$today}");
        };

        Milestone::query()->tap($open)->with('project')
            ->whereDate('due_date', $tomorrow)
            ->get()
            ->each(fn (Milestone $m) => $notify($m, Notifier::TYPE_REMINDER_MILESTONE_DUE));

        Milestone::query()->tap($open)->with('project')
            ->whereDate('due_date', '<', $today)
            ->get()
            ->each(fn (Milestone $m) => $notify($m, Notifier::TYPE_REMINDER_MILESTONE_OVERDUE));
    }

    private function remindLeads(Carbon $now): void
    {
        // "Today" for the dedupe key is the agency-local date; the
        // contact threshold is an instant, converted to UTC storage.
        $today = $now->toDateString();
        $threshold = $now->copy()->subDays(self::LEAD_FOLLOWUP_DAYS)->utc();

        Lead::query()
            ->whereIn('status', [Lead::STATUS_NEW, Lead::STATUS_CONTACTED, Lead::STATUS_QUALIFIED])
            ->whereNull('converted_client_id')
            ->whereNotNull('owner_id')
            ->where(fn ($q) => $q
                ->where('last_contacted_at', '<', $threshold)
                ->orWhere(fn ($q2) => $q2->whereNull('last_contacted_at')->where('created_at', '<', $threshold)))
            ->get()
            ->each(fn (Lead $lead) => Notifier::notify($lead->owner_id, Notifier::TYPE_REMINDER_LEAD_FOLLOWUP, [
                'lead_id' => $lead->id,
                'lead_name' => $lead->name,
                'last_contacted_at' => $lead->last_contacted_at?->toISOString(),
            ], dedupeKey: "reminder:lead:{$lead->id}:{$lead->owner_id}:{$today}"));
    }

    private function remindInvoices(string $today): void
    {
        // Derived-overdue invoices (contract section 6): stored Sent,
        // due date passed in agency-local terms, balance still due.
        // Recipients are internal only — Accountant role holders and
        // the Owner; a client is NEVER reminded automatically in MVP.
        $recipientIds = Membership::query()
            ->where('kind', Membership::KIND_STAFF)
            ->where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('key', [Role::ACCOUNTANT, Role::OWNER]))
            ->pluck('user_id')
            ->unique();

        if ($recipientIds->isEmpty()) {
            return;
        }

        Invoice::query()
            ->where('status', Invoice::STATUS_SENT)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->withSum('payments', 'amount')
            ->get()
            ->filter(fn (Invoice $invoice) => $invoice->balanceDue() > 0)
            ->each(function (Invoice $invoice) use ($recipientIds, $today) {
                foreach ($recipientIds as $userId) {
                    Notifier::notify($userId, Notifier::TYPE_REMINDER_INVOICE_OVERDUE, [
                        'invoice_id' => $invoice->id,
                        'invoice_number' => $invoice->number,
                        'due_date' => $invoice->due_date?->toDateString(),
                        'balance_due' => number_format($invoice->balanceDue(), 2, '.', ''),
                    ], dedupeKey: "reminder:invoice:{$invoice->id}:{$userId}:{$today}");
                }
            });
    }
}
