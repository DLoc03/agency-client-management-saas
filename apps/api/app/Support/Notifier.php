<?php

namespace App\Support;

use App\Jobs\SendNotificationMail;
use App\Models\Membership;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The single creation point for in-app notifications
 * (docs/WORKFLOW_CONTRACT.md, DEC-026). Called from the controllers
 * and models at the domain event points (section 4) and from the
 * reminders command (section 6).
 *
 * Rules enforced here so no call site can get them wrong:
 * - A notification exists only inside a tenant context, and only for
 *   an identity holding an ACTIVE STAFF membership in that agency.
 * - The actor never notifies themselves.
 * - Reminder dedupe goes through the unique `dedupe_key`: an existing
 *   key returns the existing row and sends nothing again.
 * - Email is sent for the section 5 subset only, via the queued
 *   SendNotificationMail job.
 * - A notification failure NEVER breaks the business action that
 *   triggered it: everything is caught and logged.
 */
class Notifier
{
    public const TYPE_TASK_ASSIGNED = 'task.assigned';

    public const TYPE_TASK_STATUS_CHANGED = 'task.status_changed';

    public const TYPE_TASK_COMMENTED = 'task.commented';

    public const TYPE_INVOICE_STATUS_CHANGED = 'invoice.status_changed';

    public const TYPE_REMINDER_TASK_DUE = 'reminder.task_due';

    public const TYPE_REMINDER_TASK_OVERDUE = 'reminder.task_overdue';

    public const TYPE_REMINDER_MILESTONE_DUE = 'reminder.milestone_due';

    public const TYPE_REMINDER_MILESTONE_OVERDUE = 'reminder.milestone_overdue';

    public const TYPE_REMINDER_LEAD_FOLLOWUP = 'reminder.lead_followup';

    public const TYPE_REMINDER_INVOICE_OVERDUE = 'reminder.invoice_overdue';

    // Group 7 (docs/PORTAL_CONTRACT.md section 5, DEC-028): Portal
    // activity. Recipients are staff only and neither type is in the
    // email subset — clients get no email in the MVP.
    public const TYPE_PORTAL_COMMENT = 'portal.comment';

    public const TYPE_PORTAL_APPROVAL_RESPONSE = 'portal.approval_response';

    /**
     * Notify one recipient. $recipient may be a User or a user id;
     * null recipients (e.g. an unassigned task) are a no-op.
     */
    public static function notify(
        int|User|null $recipient,
        string $type,
        array $data = [],
        ?int $actorId = null,
        ?string $dedupeKey = null,
    ): ?Notification {
        try {
            $agencyId = Tenant::id();
            if (! $agencyId || $recipient === null) {
                return null;
            }

            $user = $recipient instanceof User ? $recipient : User::find($recipient);
            if (! $user) {
                return null;
            }

            if ($actorId !== null && $actorId === $user->id) {
                return null;
            }

            // Membership is tenant-scoped, so this existence check is
            // automatically limited to the current agency.
            $isActiveStaff = Membership::query()
                ->where('user_id', $user->id)
                ->where('kind', Membership::KIND_STAFF)
                ->where('is_active', true)
                ->exists();
            if (! $isActiveStaff) {
                return null;
            }

            if ($dedupeKey !== null) {
                $notification = Notification::firstOrCreate(
                    ['dedupe_key' => $dedupeKey],
                    ['user_id' => $user->id, 'type' => $type, 'data' => $data],
                );

                // A duplicate reminder: the row already exists, so
                // nothing new happened — and no email either.
                if (! $notification->wasRecentlyCreated) {
                    return $notification;
                }
            } else {
                $notification = Notification::create([
                    'user_id' => $user->id,
                    'type' => $type,
                    'data' => $data,
                ]);
            }

            if (static::shouldEmail($type, $data)) {
                SendNotificationMail::dispatch($user->id, $agencyId, $type, $data);
            }

            return $notification;
        } catch (Throwable $e) {
            Log::warning('Notifier failed to create a notification.', [
                'type' => $type,
                'recipient' => $recipient instanceof User ? $recipient->id : $recipient,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Notify several recipients with the same payload (ids may repeat
     * or be null — both are filtered out here).
     *
     * @param  array<int, int|User|null>  $recipients
     */
    public static function notifyMany(array $recipients, string $type, array $data = [], ?int $actorId = null): void
    {
        $seen = [];
        foreach ($recipients as $recipient) {
            $id = $recipient instanceof User ? $recipient->id : $recipient;
            if ($id === null || isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;

            static::notify($recipient, $type, $data, $actorId);
        }
    }

    /**
     * Email subset (contract section 5, decision Q1): task assignment,
     * and an invoice reaching Paid. Everything else is in-app only.
     */
    public static function shouldEmail(string $type, array $data): bool
    {
        return $type === self::TYPE_TASK_ASSIGNED
            || ($type === self::TYPE_INVOICE_STATUS_CHANGED && ($data['to_status'] ?? null) === 'paid');
    }
}
