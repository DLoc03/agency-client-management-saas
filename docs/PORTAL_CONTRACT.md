# Portal & Collaboration Contract — BE-011 (Client Portal & Collaboration, Group 7)

Approved by the Product Owner as proposed on 2026-11-27 (DEC-028) — all twelve decision points (section 9) were accepted exactly as recommended. This contract is the single source of truth for the Group 7 MVP: **Client Dashboard, selective Project Progress, File Sharing, Feedback & Comments, Approval Requests, and Communication History**. It builds on the Auth/Tenancy/RBAC platform (BE-003, reworked by DEC-018), the Project module (BE-006) and Finance (BE-008), and it implements the two Portal notification types reserved by the Group 6 contract (DEC-026).

State of the Portal before this contract (verified in code at `bb2d63d`): the Portal API was read-only — `GET /portal/projects`, `GET /portal/projects/{id}`, `GET /portal/invoices`, `GET /portal/invoices/{id}` — pinned to the `client_id` of the membership bound to the token (`Tenant::membership()->client_id`). The Portal showed **every** milestone/task of a project (including internal work), did **not** filter project status (draft/cancelled projects were visible to the client), and computed progress over all tasks. The API had no file-upload mechanism anywhere. This contract closes those gaps.

## 1. Scope (MVP, per docs/MVP_SCOPE.md Group 7)

**In scope**

- **Selective visibility**: the agency picks which milestones/tasks appear in the Portal; draft/cancelled projects never reach the Portal; Portal progress is computed over the visible subset only.
- **File Sharing**: the agency uploads deliverables/documents to a project and the client downloads them; the client uploads files back. Per-client/per-project authorization, configurable size/type limits.
- **Feedback & Comments**: one discussion thread per project between the client and the agency (no realtime chat).
- **Approval Requests (simple)**: the agency creates a request (for a file, a milestone, or a written hand-over) → the client Approves / Requests Changes with a comment → status and history are stored; notifications flow per section 5.
- **Client Dashboard**: projects + progress, approvals waiting on the client, unpaid invoices, recent files — one aggregate call.
- **Communication History**: one per-project feed composed at read time from comments + approvals + public invoice events. No new activity table, no separate messaging system.

**Out of scope (Phase 2)**: realtime chat; white-label/custom Portal domains; per-file comment threads; e-signature / a contract module; automatic emails to clients (dunning, approval reminders); push notifications; exposing more internal task detail (checklist, assignees) to clients.

## 2. Data model

Common rules: every new table uses the `BelongsToAgency` trait (fail-closed, DEC-018) and soft deletes; only the Backend creates migrations.

### 2.1 Visibility columns (additive migration, no new table)

| Column | Type | Default | Meaning |
|---|---|---|---|
| `milestones.client_visible` | boolean | `true` | Whether the milestone appears in the Portal |
| `tasks.client_visible` | boolean | `true` | Whether the task appears in the Portal |

Default `true` preserves the pre-contract behaviour (the Portal used to show everything) — the agency hides items as needed instead of the Portal starting empty until someone opts items in. The flag is set through the existing task/milestone PATCH endpoints (a new field in their FormRequests); no parallel endpoint exists. Internal resources expose the flag so the FE can render the toggles.

### 2.2 Table `project_files`

| Column | Notes |
|---|---|
| id | |
| agency_id | from the tenant context |
| project_id | FK projects, cascade |
| uploaded_by | FK users — the uploading identity (staff or client) |
| uploader_kind | `staff` \| `client` (the kind of the membership used at upload time) |
| original_name | the original file name, used for display and download |
| stored_path | path on the private disk — **never** exposed in a response |
| mime_type / size_bytes | taken from the real uploaded file, never from client input |
| client_visible | boolean — meaningful only for staff uploads (default `true`); client uploads are always visible to the agency |
| timestamps / softDeletes | |

Index `(agency_id, project_id)`. Physical files live on the `local` private disk (`storage/app/private`, already configured in `config/filesystems.php`), under an agency/project-scoped path with an unguessable name. Downloads always stream through an authorized endpoint; the `public` disk and direct URLs are never used. Deleting a record also deletes the physical file.

Limits (decision Q4) live in `config/portal.php` (`portal.files.max_size_kb`, `portal.files.extensions`, `portal.files.disk`), tunable via `PORTAL_FILE_*` environment variables: default **20 MB per file** and the extension allowlist `pdf, doc, docx, xls, xlsx, ppt, pptx, zip, png, jpg, jpeg, txt, csv`. Size and extension are validated server-side against the real uploaded file.

### 2.3 Table `portal_comments` (its own table, separate from `task_comments`)

| Column | Notes |
|---|---|
| id | |
| agency_id | |
| project_id | the thread is per project |
| author_id | FK users — the writing identity (staff or client) |
| author_kind | `staff` \| `client` |
| body | text, max 5000 characters (consistent with existing description/comment limits) |
| timestamps / softDeletes | |

Rationale for a separate table: `task_comments` are internal, task-bound, and must **never** be exposed to the Portal (stated on the model itself). A separate per-project table puts the exposure boundary in the data layer instead of depending on display filtering.

### 2.4 Table `approval_requests`

| Column | Notes |
|---|---|
| id | |
| agency_id | |
| project_id | |
| file_id | nullable FK project_files — approving a deliverable file |
| milestone_id | nullable FK milestones — approving a milestone |
| title | the "what" of a free-text hand-over; required unless the request points at a file/milestone, in which case the controller defaults it from the target's name when omitted (the column itself is nullable for that case) |
| description | nullable — what the agency wants the client to review |
| created_by | FK users (staff) |
| status | `pending` \| `approved` \| `changes_requested` |
| response_comment | nullable — the client's comment (mandatory for `changes_requested`, section 9 Q6) |
| responded_by | nullable FK users — the portal account that responded |
| responded_at | nullable datetime |
| timestamps / softDeletes | |

A request is answered **exactly once**: once `approved`/`changes_requested` it is immutable — asking again means a new request (history is preserved). A still-`pending` request may be cancelled by the agency (soft delete).

## 3. API

Common conventions: the Portal uses the Sanctum `portal` ability + `tenant` middleware as today, and every query is pinned to the membership's `client_id` — an id belonging to another client answers 404. The internal side uses the `app` ability + permission middleware as today. Errors use the standard `{error:{code,message}}` shape with messages from `lang/en|vi/api.php`.

### 3.1 Portal (client)

| Endpoint | Behaviour |
|---|---|
| `GET /portal/dashboard` | One aggregate call: projects (id, name, status, visible progress), `pending_approvals` (count + compact list with project), `unpaid_invoices` (count + total balance due; the client's issued invoices only — stored status `sent`, which includes derived-overdue, with balance > 0), `recent_files` (the 5 newest client-visible files) |
| `GET /portal/projects` · `GET /portal/projects/{id}` | **Changed**: `draft`/`cancelled` projects excluded; milestones/tasks filtered by `client_visible`; `progress_percent` and counts computed **over the visible subset only** |
| `GET /portal/projects/{id}/files` | Files the client may see: staff uploads with `client_visible = true` plus the client side's own uploads. Metadata only (no `stored_path`) |
| `POST /portal/projects/{id}/files` | Client upload (multipart) — same size/type limits as the staff side |
| `GET /portal/projects/{id}/files/{fileId}/download` | Streams the file when it belongs to one of the client's projects and is visible to the client; otherwise 404 |
| `DELETE /portal/projects/{id}/files/{fileId}` | The client may delete only files uploaded by the client side (`uploader_kind = client`); agency files answer 404 |
| `GET /portal/projects/{id}/comments` | The project's thread, conversation order (oldest first), standard pagination |
| `POST /portal/projects/{id}/comments` | Client writes a comment → fires `portal.comment` (section 5) |
| `GET /portal/projects/{id}/approvals` | The project's approval requests, pending first, answered history included |
| `POST /portal/projects/{id}/approvals/{approvalId}/respond` | Body: `decision` (`approved` \| `changes_requested`) + `comment` (mandatory for `changes_requested`). An already-answered request answers 422 `APPROVAL_ALREADY_RESPONDED`. Fires `portal.approval_response` |
| `GET /portal/projects/{id}/history` | The composed communication history (section 6) |

### 3.2 Internal (staff)

| Endpoint | Permission | Behaviour |
|---|---|---|
| `PATCH /tasks/{task}` · `PATCH /projects/{project}/milestones/{milestone}` | existing (`tasks.update` / `milestones.manage`) | Accept the additional `client_visible` field — no new endpoint |
| `GET /projects/{project}/files` | `projects.view` | All files of the project (including hidden staff uploads and client uploads) |
| `POST /projects/{project}/files` | `portal.files.manage` (new) | Staff upload; may set `client_visible` |
| `PATCH /projects/{project}/files/{fileId}` | `portal.files.manage` | Toggle `client_visible` |
| `DELETE /projects/{project}/files/{fileId}` | `portal.files.manage` | Delete (soft delete + physical file removal) |
| `GET /projects/{project}/files/{fileId}/download` | `projects.view` | Stream the file |
| `GET /projects/{project}/portal-comments` · `POST /projects/{project}/portal-comments` | `projects.view` (replying needs no new key) | Read + reply in the same thread the client sees. A staff POST fires **no** staff notification |
| `DELETE /projects/{project}/portal-comments/{commentId}` | the author, or Owner/Admin | Moderation |
| `GET /projects/{project}/approvals` | `projects.view` | List + statuses |
| `POST /projects/{project}/approvals` | `portal.approvals.manage` (new) | Create a request (file / milestone / free text) |
| `DELETE /projects/{project}/approvals/{approvalId}` | `portal.approvals.manage` | Cancel a still-`pending` request (a responded one answers 422 `APPROVAL_ALREADY_RESPONDED`) |
| `GET /projects/{project}/history` | `projects.view` | The same composed feed, internal view |

On the internal side, every surface additionally requires the project to be visible to the calling staff member (`Project::isVisibleTo`, the DEC-016 matrix) — an invisible project answers 404.

## 4. Permissions & scope

- **Client** accounts are always pinned to the `client_id` of the membership bound to the token (the existing mechanism, unchanged). All portal accounts of **the same client record** see the same data — including comments and approvals: any of the client's accounts may respond to an approval, the first response wins, and `responded_by` records which account it was (decision Q12).
- A client never sees: the budget, internal comments (`task_comments`, client notes), hidden milestones/tasks, their own draft/cancelled projects, or anything of another client (404).
- **Staff**: internal project visibility is unchanged (`Project::scopeVisibleTo`). The internal Portal surfaces (files/approvals) additionally require the project to be visible to the caller.
- New permission keys (decision Q10): `portal.files.manage`, `portal.approvals.manage` — granted to Owner (implicitly, via `*`), Admin and Project Manager. Accountant / Sales Manager / Team Member do not hold them (they can still view and reply in the thread under `projects.view` when they can see the project).
- No tenant bypass is needed anywhere in this module: all queries go through `BelongsToAgency` as usual.

## 5. Notifications (implementing the two types reserved by DEC-026)

Created through `App\Support\Notifier` like every other event — two new type constants, `portal.comment` and `portal.approval_response`, plus the FE render cases (section 7). The Notifier's standing rules apply: recipients must hold an **active staff membership** in the agency, and the actor never notifies themselves.

| Type | Trigger | Recipients | Email? |
|---|---|---|---|
| `portal.comment` | A client writes a comment in a project thread | The project's manager + the project's staff members (except the actor) | No |
| `portal.approval_response` | A client responds to an approval request | The request's creator (`created_by`) + the project manager (except the actor; duplicates collapsed) | No |

`data` follows the existing convention — ids + display names only: `project_id`, `project_name`, `approval_id`, `approval_title`, `actor_name`, `decision` (for `portal.approval_response`). Clicking a notification in the FE leads to the internal project detail page (its Client Portal section).

**No email is sent to clients in the MVP.** Clients have no Portal inbox and the Notifier serves staff by design; a staff reply or a new approval request generates **no** client email in the MVP — the client sees what needs them on the dashboard (pending-approval count). Client email is a Phase 2 candidate (decision Q7). Neither new type belongs to the Notifier's email subset, so staff receive them in-app only.

## 6. Communication History — composed at read time

`GET .../history` merges three sources of that one project, newest first, paginated over the merged set:

- `portal_comments` → `comment` events (author + staff/client kind).
- `approval_requests` → `approval_requested` (at creation) and `approval_responded` (at response, with the decision).
- The project's **client-public** invoices: issued (sent) and fully paid → `invoice_issued` / `invoice_paid` events with id + invoice number + amount only, no line detail. Draft and cancelled invoices never appear.

No new table, no duplicated records. The Portal receives exactly these events (all of them are client-visible by construction); the internal side receives the same set — this is the history of the *exchange with the client*, not an internal audit log (an internal audit log is not part of the MVP).

## 7. FE surfaces (FE-023)

**Portal** (keeping the emerald Bento frosted-glass style of FE-018 / DEC-013, routes under `/portal`, through the existing BFF `portal-proxy`):

- Dashboard: a "Needs your approval" block (pending approvals, linking into the project), an unpaid-invoices block (total due + count, linking to the existing invoices page), and a "Recent files" block (5 newest, downloadable in place).
- Project detail: three blocks under the existing progress section — **Files** (list, download, client upload), **Discussion** (the thread + composer), **Approvals** (pending requests with Approve / Request Changes + comment box; answered requests show status + comment) — plus **History** (the composed feed). Progress/milestones/tasks render exactly what the API returns — the FE does not filter.
- i18n: the `Portal.*` namespace grows (files, discussion, approvals, history) in EN + VI like every other screen.

**Internal** (Sample A style of the main app, through the existing BFF):

- The project detail page gains a **"Client Portal"** section: `client_visible` toggles per milestone/task (via the existing PATCH endpoints), Files management (upload, hide/show, delete, download; a badge marking client uploads), Approvals (create form: pick a file/milestone or enter a title; status list; cancel pending), the Discussion thread (read + reply), and History (the same feed as the Portal).
- The notification bell adds render cases for `portal.comment` / `portal.approval_response` to the FE-021 switch + `Notifications.types.*` keys (EN/VI), deep-linking to the project detail page.

**PO direction for the Portal UI (DEC-028)**: the Portal is the client-facing surface — clients perform few, simple operations, unlike the workspace — so presentation quality matters more than information density. FE-023 starts from design samples the PO approves before implementation (the project's established sample-first workflow), keeping the DEC-013 Sample C Bento emerald direction.

## 8. Testing (QA-008, after BE-011)

- PHPUnit: visibility filtering (hidden tasks/milestones vanish from the Portal list, detail **and** the progress denominator); draft/cancelled projects → Portal 404; client pinning (every new endpoint with another client's id → 404, including file download and approval respond).
- Uploads: over the size cap → 422; disallowed type → 422; mime/size stored from the real file; download by another client / by staff who cannot see the project → 404; a hidden staff file is invisible and undownloadable for the client.
- Comments: a client comment creates `portal.comment` for the project manager + members, and for no staff outside the project; a staff reply creates no staff notification.
- Approvals: the full lifecycle (create → pending → respond approved / changes_requested); a second response → 422; `changes_requested` without a comment → 422; the response creates `portal.approval_response` for the right recipients; a second account of the same client may respond while the request is still pending.
- History: correct chronological order when the three sources interleave; no internal event ever leaks to the Portal side.
- The suite stays green on SQLite **and** MySQL 8 (the standing BE standard); Vietnamese byte checks; no compiled views committed.

## 9. Decisions (DEC-028, approved as proposed on 2026-11-27)

- **Q1 — Visibility granularity**: a per-item `client_visible` flag on each milestone and task (default visible); Portal progress is computed over the visible subset. (Alternative rejected: one project-level switch — simpler, but it does not meet the scope and leaks internal workload through the progress denominator.)
- **Q2 — Draft/cancelled projects**: hidden from the Portal (this fixes an existing exposure). (Alternative rejected: a per-project `portal_visible` flag.)
- **Q3 — File sharing direction**: two-way (agency → client and client → agency) in one table, distinguished by `uploader_kind`. (Alternative rejected: agency → client only in the MVP.)
- **Q4 — File limits + storage**: private `local` disk, downloads stream through authorized endpoints; max **20 MB/file**; extension allowlist `pdf, doc, docx, xls, xlsx, ppt, pptx, zip, png, jpg, jpeg, txt, csv`; both limits in config. (Alternative rejected: S3 from day one — switching disks later is a config change.)
- **Q5 — Comment thread**: one single thread per project; per-file threads are Phase 2. (Alternative rejected: per-file threads in the MVP.)
- **Q6 — Approval outcomes**: Approve / Request Changes; the comment is **mandatory** for Request Changes and optional for Approve; a responded request is immutable. (Alternative rejected: optional comment for both.)
- **Q7 — Email to clients**: **none in the MVP** (staff still receive in-app notifications per section 5). (Alternative rejected: emailing clients on new approval requests and staff replies.)
- **Q8 — Communication History**: composed at read time from comments + approvals + public invoice events; no new table. (Alternative rejected: a dedicated activity table — already excluded by the scope.)
- **Q9 — Dashboard**: one aggregate endpoint `GET /portal/dashboard`. (Alternative rejected: the FE composing it from several endpoints.)
- **Q10 — New permission keys**: exactly two — `portal.files.manage` + `portal.approvals.manage` (Owner/Admin/Project Manager); replying in the thread needs only `projects.view` + project visibility. (Alternative rejected: reusing `projects.update` for everything.)
- **Q11 — Task split**: BE-011 (this contract) → QA-008 → FE-023 covering both the Portal and the internal surfaces in one FE task (acceptance still runs as two halves). (Alternative rejected: splitting FE-023 Portal / FE-024 internal.)
- **Q12 — Who on the client side may respond**: any portal account of the client record (first response wins, `responded_by` recorded). (Alternative rejected: a single designated approver account — the MVP has no such concept.)

## 10. Rollout & acceptance order

1. PO approval of section 9 → **DEC-028** recorded + this contract published (in the BE-011 PR, following the DEC-026/WORKFLOW_CONTRACT precedent).
2. **BE-011**: migrations (2 columns + 3 tables), Portal API changes + additions, internal API, the 2 permission keys, the two Notifier types, PHPUnit tests. No FE in this PR.
3. **QA-008** (OpenCode): cross-review of BE-011 against section 8, including running the suite on MySQL 8.
4. **FE-023** (OpenCode FE): Portal + internal per section 7, starting from PO-approved design samples for the Portal; Muse reviews; Nguyen accepts visually.
5. End-to-end acceptance (office machine, demo data): sign in as `client@demo.test` → the dashboard shows a pending approval + recent files; hide an internal task on the staff side → the Portal loses that task and the progress percent changes accordingly; the client uploads a file and staff see it in the project; the client comments → the staff bell (pm@/owner@) shows `portal.comment`; staff create an approval for the file → the client approves with a comment → staff receive `portal.approval_response`; History shows the full event feed in order.
