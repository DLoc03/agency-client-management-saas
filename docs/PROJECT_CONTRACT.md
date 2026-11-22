# Project Contract — BE-006 (Project Management, Group 3)

Approved by the Product Owner on 2026-11-22 (DEC-016). This contract is the single source of truth for the Project Management module API. It builds on the Auth/Tenancy/RBAC platform (BE-003), the Client module (BE-004) and the CRM/Lead module (BE-005): a Project is the next link of the core flow Lead → Client → **Project → Task** → Portal review → Invoice.

## 1. Scope (MVP, per docs/MVP_SCOPE.md Group 3)

- Project Overview: CRUD for projects attached to a client — name, description, status, start/due dates, budget (feeds Group 5), project manager.
- Task Management: CRUD for tasks inside a project — assignee, priority, due date, status, description, simple sub-checklist, internal comments.
- Milestones (simple form): a milestone has a name, a due date and a status; tasks can be attached to a milestone.
- Project Timeline (simple form): a list view of milestones and deadlines ordered by date. **Gantt charts are Phase 2.**
- Team Assignment: assign members to a project and to tasks — see decision point 2 in DEC-016 (Group 4 is not built yet).
- Progress Tracking: % complete = Done tasks / total tasks, plus milestone status; shown both in the internal app and the Portal.
- OUT of scope: project templates, project cloning, task dependencies, Gantt — all Phase 2.

## 2. Data model

### Table `projects`
- `id`, `agency_id` (BelongsToAgency, like every module).
- `client_id` (FK clients, required — a project always belongs to a client; no free-floating projects in the MVP).
- `name` (required), `description` (nullable text).
- `status` (locked enum): `draft` / `in_progress` / `on_hold` / `completed` / `cancelled` — exactly the 5 statuses in MVP_SCOPE.
- `project_manager_id` (FK users, nullable — the person in charge; must belong to the same agency, cross-tenant checked).
- `start_date`, `due_date` (date, nullable).
- `budget` (decimal, nullable — a single budget figure; currency is implicitly the workspace base currency, feeds Group 5 later).
- Timestamps, soft deletes.

### Table `project_members` (pivot — who works in this project)
- `project_id`, `user_id` (FK users, same agency), timestamps. No per-project role column in the MVP (permissions still come from agency roles).
- Purpose: defines which projects a Team Member may **see**. Owner/Admin/PM/Sales/Accountant visibility follows the matrix in §3; a Team Member only sees projects they are a member of (or have an assigned task in).

### Table `milestones`
- `id`, `agency_id`, `project_id` (FK projects, required).
- `name` (required), `due_date` (date, nullable), `description` (nullable).
- `status` (locked enum): `planned` / `in_progress` / `completed` — default `planned`.
- Timestamps, soft deletes. (No stored % column — a milestone's % is derived from its tasks, see §4.)

### Table `tasks`
- `id`, `agency_id`, `project_id` (FK projects, required).
- `milestone_id` (FK milestones, nullable — a task without a milestone is valid).
- `title` (required), `description` (nullable text).
- `status` (locked enum): `todo` / `in_progress` / `in_review` / `done` — default `todo`.
- `priority` (locked enum): `low` / `medium` / `high` / `urgent` — default `medium`.
- `assignee_id` (FK users, nullable — must belong to the same agency; an unassigned task is valid).
- `due_date` (datetime/date, nullable), `completed_at` (nullable — set automatically when status → done, cleared when leaving done).
- `position` (int — display order inside a project/milestone; used by the FE Kanban later, the API does not enforce drag-drop logic in the MVP).
- Timestamps, soft deletes.

### Table `task_comments` — same shape as `client_notes`/`lead_notes` (body, author_id, timestamps, soft deletes). Internal only; clients never see them.

### Table `task_checklist_items` (simple sub-checklist)
- `id`, `task_id` (FK tasks), `title` (required), `is_done` (bool, default false), `position` (int), timestamps, soft deletes.

## 3. Permissions `projects.*` / `tasks.*` / `milestones.*` (same philosophy as DEC-009)

| Permission | Owner | Admin | Sales Mgr | PM | Accountant | Team Member |
|---|---|---|---|---|---|---|
| projects.view | ✓ | ✓ | ✓ | ✓ | ✓ (read-only) | only projects they participate in |
| projects.create | ✓ | ✓ | — | ✓ | — | — |
| projects.update | ✓ | ✓ | — | ✓ | — | — |
| projects.delete | ✓ | — | — | — | — | — |
| projects.members.manage | ✓ | ✓ | — | ✓ | — | — |
| milestones.manage | ✓ | ✓ | — | ✓ | — | — |
| tasks.create | ✓ | ✓ | — | ✓ | — | — |
| tasks.update | ✓ | ✓ | — | ✓ | — | only tasks assigned to them (status/comment/checklist) |
| tasks.delete | ✓ | ✓ | — | ✓ | — | — |
| tasks.comments.manage | ✓ | ✓ | — | ✓ | — | only tasks assigned to them |

- A project is a billable entity (it feeds Invoices in Group 5), so `projects.delete` is **Owner only** — as strict as `clients.delete` (DEC-009.5), stricter than `leads.delete` (Owner + Admin) because a lead is worth less.
- Sales Manager is view-only (needs to see projects for the lead → client → project handover); Accountant is view-only (serves invoices/budget later).
- Deleting a project: soft delete, and soft-delete all of its milestones/tasks/comments/checklist items with it (no hard delete, no restore in the MVP).

## 4. Progress & timeline rules

- `% project = Done tasks / total tasks`, computed at read time (no stored column — avoids drift). A project with 0 tasks → 0%, and the resource includes `tasks_count` + `tasks_done_count` so the FE can display honestly.
- `% milestone = Done tasks / tasks attached to that milestone`; a milestone with 0 tasks → 0%.
- Timeline: an endpoint returns milestones and tasks that have deadlines, ordered by date (milestones before tasks on the same day) — list form, no Gantt.
- No hard status enforcement in the MVP: a PM may mark a project `completed` while tasks are still open (the FE warns, it does not block) — avoids locking real workflows. A hard block would need its own decision.

## 5. Endpoints (prefix /api/v1, auth:sanctum + ability:app + permission)

**Projects**
1. `GET /projects` — filters: client_id, status, project_manager_id, q (name/description).
2. `POST /projects`
3. `GET /projects/{id}` — detail: project + client + manager + counts (tasks/milestones) + progress %.
4. `PATCH /projects/{id}`
5. `DELETE /projects/{id}` — soft delete + soft cascade (§3).
6. `GET /projects/{id}/timeline` — milestones + tasks with deadlines, ordered by date (§4).
7. `GET/POST /projects/{id}/members`, `DELETE /projects/{id}/members/{userId}` — assign/remove members (permission projects.members.manage).

**Milestones**
8. `GET/POST /projects/{id}/milestones`, `PATCH/DELETE /projects/{id}/milestones/{milestoneId}` — a milestone that does not belong to the project → 404.

**Tasks**
9. `GET /projects/{id}/tasks` — filters: status, priority, assignee_id, milestone_id, due_before/due_after.
10. `POST /projects/{id}/tasks`
11. `GET /tasks/{id}` — detail: task + checklist + comments + milestone/project.
12. `PATCH /tasks/{id}` — changing status sets/clears `completed_at` automatically; moving to a milestone of another project → 422.
13. `DELETE /tasks/{id}` — soft delete.
14. `GET /tasks/due` — tasks not done with due_date <= now (plus upcoming within N days via the `days` query), agency-wide — same shape as `GET /lead-activities/due` in BE-005. Fixed-path routes are registered before `/tasks/{id}`.
15. `GET/POST /tasks/{id}/comments`, `DELETE /tasks/{id}/comments/{commentId}` — only the author or Owner/Admin may delete (same rule as client/lead notes).
16. `GET/POST /tasks/{id}/checklist`, `PATCH/DELETE /tasks/{id}/checklist/{itemId}` — tick/edit/remove checklist items.

**Portal (read-only, for Group 7 to use later)**
17. `GET /portal/projects` — only the projects of the signed-in client (scoped by the Portal account's `client_id`, ability `portal`).
18. `GET /portal/projects/{id}` — detail + progress % (no internal comments exposed).

## 6. Errors & i18n

- Reuse `NOT_FOUND`, `VALIDATION_FAILED`, `CROSS_TENANT_REFERENCE` (422, for cross-tenant project_manager_id/assignee_id/milestone_id or a milestone from another project), `FORBIDDEN` — this module adds no new error codes.
- All enums are stored as keys; error messages are bilingual EN/VI via lang files, like BE-003/BE-004/BE-005.
- FIX-005 note (fixed in PR #25): create responses must refresh DB defaults — apply from the start to projects/tasks/milestones (default status/priority must appear correctly in POST responses, never blank like the old bug).

## 7. Expected testing (QA derives cases from these Acceptance Criteria)

- Project/task/milestone CRUD + filters; the 7-role permission matrix (including Team Member seeing only projects they participate in).
- Tenant isolation (404/422); cross-project milestone/task references → 422.
- Progress % matches the data (including a 0-task project → 0%); timeline ordering by date.
- Soft-deleting a project cascades to tasks/milestones; marking a task done sets `completed_at`.
- Portal: a client sees only their own projects and never internal comments; internal/app tokens cannot use portal endpoints and vice versa (as in BE-003).
