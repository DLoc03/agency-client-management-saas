# Workflow Contract — BE-009 (Workflow & Automation, Group 6)

Approved by the Product Owner as proposed on 2026-11-27 (DEC-026). This contract is the single source of truth for the Group 6 MVP: **Status Notifications + Deadline Reminders**. It builds on the Auth/Tenancy/RBAC platform (BE-003, reworked by DEC-018) and the modules of Groups 1–5, whose domain events feed it. Approval Workflow belongs to Group 7 (Portal Approval Requests); the automation rule engine, recurring tasks and multi-level internal approvals are Phase 2.

## 1. Scope (MVP, per docs/MVP_SCOPE.md Group 6)

- **Status Notifications**: an in-app notification system (bell + list) fed by domain events from Groups 1–5, plus email delivery for a small high-signal subset (section 5).
- **Deadline Reminders**: a daily Laravel Scheduler job reminding about due/overdue tasks and milestones, stale leads, and overdue invoices — one shared mechanism on top of the same notification store.
- **Reserved, not implemented here**: notification types for Portal activity (`portal.comment`, `portal.approval_response`) are implemented in Group 7, when Portal comments/approvals exist.
- **Out of scope (Phase 2)**: automation rule engine ("when A do B"), recurring tasks, internal multi-level approvals, push notifications, email digests, per-user notification preference UI, and automatic emails to clients (dunning) — reminders about clients are internal-only in the MVP.

## 2. Data model

### Table `notifications`

A custom table, tenant-scoped via `BelongsToAgency` like every module. Laravel's built-in database-notifications table is deliberately NOT used, to keep one tenancy/audit style.

- `id`, `agency_id` (filled from the tenant context at creation), `user_id` (the recipient identity — a notification belongs to one identity in one agency).
- `type` (string key, section 4), `data` (JSON: entity refs + display params such as `task_id`, `task_title`, `project_id`, `invoice_id`, `invoice_number`, `actor_name`, `from_status`, `to_status` — never display text; the client renders via i18n).
- `dedupe_key` (nullable, UNIQUE): reminder idempotency, format `reminder:{entity}:{id}:{recipient_user_id}:{Y-m-d}` with the date in the agency timezone — the recipient segment keeps the unique index satisfiable when one entity reminds several people (invoice overdue). At most one reminder per entity, recipient and agency-local day.
- `read_at` (nullable), timestamps. Indexes: `(user_id, read_at)`, `(agency_id, created_at)`, unique `dedupe_key`.

### Additions to `tasks` and `invoices`

- `created_by` (nullable FK users, nullOnDelete) on both tables. The recipient rules of section 4 name the task creator and the invoice creator, but neither table recorded its creator; this additive column closes the gap. Rows created before this contract keep NULL and simply have no creator recipient.

### Creation path

All creation goes through one domain service, `App\Support\Notifier`, called from the existing controllers/models at the event points and from the reminders command. Row inserts are synchronous; email (when applicable) is the queued job `App\Jobs\SendNotificationMail`, whose payload carries `agency_id` and which runs inside `Tenant::run()` (AGENTS.md tenant rule 5). A notification is only ever created for an identity holding an ACTIVE STAFF membership in the current agency; the actor never notifies themselves. A notification failure never breaks the business action that triggered it (caught and logged).

## 3. API (internal, Sanctum `app` ability, tenant from token)

| Endpoint | Behaviour |
|---|---|
| `GET /notifications?unread=1&page&per_page` | The token identity's notifications **in the token's agency only**, newest first, standard pagination meta |
| `GET /notifications/unread-count` | `{ count }` for the bell badge |
| `POST /notifications/{id}/read` | Marks own notification read; foreign/other-user id → 404 |
| `POST /notifications/read-all` | Marks all own (this agency) read |

No create/update/delete endpoints — notifications are system-generated. No new permission key: any active staff membership can read its own notifications.

## 4. Event catalogue (internal events, MVP)

| Type | Trigger | Recipients | Email? |
|---|---|---|---|
| `task.assigned` | Task created with an assignee, or assignee changes | The new assignee | YES |
| `task.status_changed` | Task status changes | Assignee + task creator (except the actor) | no |
| `task.commented` | Comment added to a task | Assignee + task creator (except the actor) | no |
| `invoice.status_changed` | Invoice sent / paid / cancelled | Invoice creator | only `paid` |
| `reminder.task_due` | Reminder rule (section 6) | Task assignee | no |
| `reminder.task_overdue` | Reminder rule (section 6) | Task assignee | no |
| `reminder.milestone_due` / `reminder.milestone_overdue` | Reminder rule (section 6) | Project manager | no |
| `reminder.lead_followup` | Reminder rule (section 6) | Lead assignee (`leads.owner_id`) | no |
| `reminder.invoice_overdue` | Reminder rule (section 6) | Accountant role holders + Owner (internal only) | no |
| `portal.comment` / `portal.approval_response` | RESERVED — Group 7 | — | — |

Invoice transitions fire on actual stored-status changes only. The payment-driven transitions (payment recorded → Paid; payment deleted → back to Sent) fire from `Invoice::refreshStatusFromPayments()`, the single choke point both payment endpoints pass through; send/cancel fire from the invoice controller.

## 5. Email policy (decision Q1)

Email is sent ONLY for `task.assigned` and `invoice.status_changed` → paid. Everything else is in-app only (the bell is the primary surface; emailing every status change would train users to ignore it). One `NotificationMail` mailable renders from `type` + `data` using the recipient identity's stored locale (the same rule as API messages). Mail failures never fail the business action (queued job, logged).

## 6. Reminders engine

- Artisan command `reminders:run`, registered in `routes/console.php` to run daily at 01:00 UTC (= 08:00 Asia/Saigon, decision Q5); each agency's rules are evaluated against that agency's own timezone. The command is also runnable manually for acceptance/testing.
- The command iterates agencies (agency ids listed outside any tenant — Agency is the tenant itself — then `Tenant::run($agencyId, …)` per agency) and applies the rules:
  - **Task due**: `due_date` falls on tomorrow (agency-local) and the task is open → `reminder.task_due` to the assignee. **Task overdue**: `due_date` before today (agency-local), same filter → `reminder.task_overdue`. "Open" means status ≠ `done` (tasks have no cancelled status: todo / in_progress / in_review / done).
  - **Milestone due/overdue**: same windows on milestone due dates, status ≠ `completed` → the project's manager only (decision Q6).
  - **Lead follow-up**: pipeline stage in (new, contacted, qualified), not converted, and `last_contacted_at` older than 3 days (decision Q4) — or never contacted and created more than 3 days ago → `reminder.lead_followup` to the lead's assignee.
  - **Invoice overdue**: derived-overdue invoices (stored Sent, due date passed, balance > 0) → `reminder.invoice_overdue` to Accountant role holders + the Owner. NEVER sent to the client in the MVP.
- Dedupe is enforced by the unique `dedupe_key` (section 2) — re-running the command on the same agency-local day is idempotent.
- The same run prunes notifications older than 90 days (decision Q7), as an explicit tenant bypass: a maintenance sweep deleting purely by age across all agencies.

## 7. i18n & errors

- Notification `type` + `data` are keys/params only; the FE renders text via `Notifications.*` i18n keys (EN + VI, FE-021). Email subjects/bodies live in `lang/en|vi/mail.php` keyed by type.
- No new error codes: the read endpoints reuse the standard shapes, and marking a foreign notification read returns the standard 404.

## 8. Testing

- PHPUnit (`tests/Feature/Workflow/`): event creation per trigger (assignment, reassignment, status change, comment, invoice send/cancel, payment-driven paid and paid→sent revert) including actor exclusion and inactive-membership exclusion; email subset assertions; cross-user and cross-agency isolation for list/count/read/read-all; reminders: each rule fires, dedupe prevents a second same-day run, an agency-timezone boundary case, invoice-overdue recipients are internal roles only; retention pruning; unread-count and read-all behaviour.
- The suite must stay green on SQLite AND MySQL.

## 9. Follow-on FE (FE-021, after BE-009 merges)

Bell icon with unread badge in the app shell, dropdown panel (latest ~10, mark-all-read), a full `/notifications` page reusing the shared Pagination, deep links from a notification to its task/invoice/project. The exact FE spec is written when BE-009 is merged (same pattern as Finance: contract → BE → FE).

## 10. PO decisions (DEC-026, all approved as proposed, 2026-11-27)

- **Q1** Email subset: only `task.assigned` + invoice paid. (Alternatives rejected: email everything / in-app only.)
- **Q2** Invoice event recipients: invoice creator only. (Alternative rejected: creator + Accountant role holders.)
- **Q3** Task comment recipients: assignee + creator. (Alternative rejected: all project members.)
- **Q4** Lead follow-up threshold: 3 days without contact. (Alternative rejected: 7 days.)
- **Q5** Reminder evaluation: daily, dates evaluated per agency timezone (single scheduler run 01:00 UTC). (Alternative rejected: fixed server time.)
- **Q6** Milestone reminders: project manager only. (Alternative rejected: PM + all project members.)
- **Q7** Retention: notifications older than 90 days are deleted by the reminders run. (Alternative rejected: keep forever.)
- **Q8** Task split: BE-009 (this contract) → QA sweep → FE-021. Same shape as Group 5.
