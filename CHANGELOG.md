# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow Semantic Versioning.
Only OpenCode may package an `[Unreleased]` section into a release and bump `VERSION.md` (see `docs/CONVENTIONS.md`).

## [Unreleased]

### Fixed
- Team invitations page crash ("Rendered fewer hooks than expected") caused by calling `useTranslations` inside JSX; the same pattern was checked across the whole app area and occurred only there.
- App shell layout: the sidebar now always spans the full viewport height and only the content column scrolls, instead of the sidebar ending mid-page on long screens.
- Team section navigation: added a shared tab bar (Teams / Members / Invitations / Workload) to every Team page and pointed the sidebar "Team" item at the Teams list first, so members are no longer mistaken for teams.
- Replaced all native HTML `<select>` dropdowns in the Projects, Clients, Leads and Team screens (38 usages across 9 files) with a shadcn-style `Select` component (design-token listbox, keyboard support, closes on outside click).
- Demo seeder now creates one account per role (admin/sales/pm/accountant/member@demo.test), a demo client linked to the demo portal account, a demo team, and two demo projects with milestones and tasks, so manual acceptance always has standard data; the seeder stays idempotent.
- Added `docker-compose.acceptance.yml` to run the web app as a production build during acceptance sessions (dev mode compiles each route per locale on first visit and feels laggy).

## [0.5.0] - 2026-11-24

### Backend
- Team & Resource Management contract published (BE-007): `docs/TEAM_CONTRACT.md` approved by the Product Owner (DEC-017) — teams and membership, employee directory, role assignment, account activation/deactivation, email invitations, snapshot team-to-project assignment, workload-lite. Implementation follows in BE-007.
- Team & Resource Management module (BE-007): teams CRUD with membership and Team-Member scoping, employee directory with role/team/active filters, role assignment and account activation (deactivation revokes all tokens) with the DEC-017 Admin limits, email invitations (hashed token, 7-day expiry, public accept, resend/revoke), snapshot team-to-project assignment via `project_members.via_team_id`, and `GET /workload` (open/overdue/due-in-7-days task counts computed at read time).

### Frontend
- Client Management screens (FE-010): enabled Clients nav item + route guard; list page with status/tag/account-manager/search filters, cards with single-line status/type/tag chips and portal-account counts, empty state, create-client form (Organization block for company clients, tag selection) and inline tag creation; client detail with overview and profile editing (status, account manager, tags, organization), contacts CRUD with primary flag, internal notes with author-rule deletion, portal account creation and activate/deactivate; client deletion restricted to the Agency Owner; BFF proxy routes to /clients, /tags and /users; Clients i18n namespace EN/VI (vi.json U+FFFD = 0, double-encoding markers = 0). Self-check: typecheck, build (en+vi), tests pass; responsive classes reviewed at 390/768/1280.
- CRM / Lead screens (FE-011): enabled Leads nav item + route guard; Pipeline Kanban board per DEC-013 with the four fixed statuses, drag-and-drop status changes, lead cards (estimated value, source, owner), pipeline summary strip (counts and totals per status) and a due follow-ups strip; search/source/owner filters and create-lead form; lead detail with profile editing (main fields locked after conversion), shared contacts CRUD with primary flag, internal notes with author-rule deletion, follow-up activities (add, mark done/reopen, delete), and Lead → Client conversion with account-manager override, duplicate-candidate warning with force convert, and redirect to the created client; BFF proxy routes to /leads and /lead-activities; Leads i18n namespace EN/VI (vi.json U+FFFD = 0, double-encoding markers = 0). Self-check: typecheck, build (en+vi), tests pass; responsive classes reviewed at 390/768/1280.

### QA & Fixes
- FIX-008 (Muse): resolved the two non-blocking FE-009 findings logged by QA-005 — added the missing `Shell.nav.team` message (EN "Team" / VI "Nhóm") so the Sidebar no longer logs MISSING_MESSAGE on Team pages, and associated the accept-invitation form labels with their inputs (`htmlFor`/`id`: accept-name, accept-password) for accessibility and label-based test access. Self-check: typecheck, build (en+vi), tests pass; vi.json U+FFFD = 0, no new double-encoding markers.
- QA-005 (OpenCode): authored Playwright coverage for Team & Resource from `docs/TEAM_CONTRACT.md` in `tests/e2e/team.spec.ts` (16 API cases) plus `tests/e2e/team-ui.spec.ts` (5 UI cases on FE-009 screens). Real run on Docker/MySQL 8 + full demo seed and Mailpit: **21/21 passed, 0 skipped** — teams CRUD/permission matrix, Team-Member scoping, directory filters, role changes with immediate effect and Admin/Owner guards, activation/token revocation, invitation lifecycle incl. expired/resend/revoke, snapshot team-to-project add/remove/keep, workload numbers, and tenant isolation. Verdict: BE-007 → DONE per QA authority. Two non-blocking FE-009 findings logged in `TASK.md` Inbox (missing `Shell.nav.team` message; accept-invitation labels not associated with inputs).

## [0.4.0] - 2026-11-22

### Backend
- Project Management contract published (BE-006): `docs/PROJECT_CONTRACT.md` approved by the Product Owner (DEC-016) — projects with members and milestones, tasks with assignees, priorities, due dates, comments and checklist items, read-time progress %, list timeline, and read-only Portal project endpoints. Implementation follows in BE-006.
- Project Management module (BE-006): projects CRUD with filters and soft-delete cascade, project members, milestones, tasks with assignee/priority/due date and automatic `completed_at`, task comments and checklist items, read-time progress %, list timeline, due list, and read-only Portal project endpoints. `projects.*`/`tasks.*` RBAC per DEC-016 with Team Member scoping (participating projects only, own assigned tasks only).

### Frontend
- Project Management screens (FE-008): enabled Projects nav item; list page with client/status/manager/search filters, progress % with done/total, empty state; project detail with overview, progress bar, milestones with per-milestone %, members add/remove, tasks with status/priority/assignee/milestone filters, timeline list; task detail with status/priority/due/assignee, checklist add/tick/remove, internal comments add/delete by author; BFF proxy routes to /projects and /tasks; Projects i18n namespace EN/VI (vi.json U+FFFD = 0). Self-check: typecheck, build (en+vi), tests pass; responsive classes reviewed at 390/768/1280.
- Team & Resource screens (FE-009): added Team nav item + route guard; Members directory with role/team/status/search filters and member profile (edit profile, change roles, activate/deactivate with Admin limits); Teams list/detail with member management; Invitations list + invite form (role selection hiding Owner/Admin per actor) + resend/revoke; Workload per person; public accept-invitation page; team assignment (added/removed/kept) on project detail; BFF proxy routes to /teams, /users, /invitations, /workload, /projects/{id}/teams; Teams i18n namespace EN/VI (vi.json U+FFFD = 0, Ã = 0). Self-check: typecheck, build (en+vi), tests pass; responsive classes reviewed at 390/768/1280.

### QA & Fixes
- QA-004 (OpenCode): authored Playwright test cases for the Project Management module from docs/PROJECT_CONTRACT.md in tests/e2e/project.spec.ts (29 API cases) plus tests/e2e/project-ui.spec.ts (UI cases on FE-008 screens). Real run on Docker/MySQL 8 + demo seed: API 17 passed / 12 skipped on minimal seed (missing multi-role/foreign-agency seed data — documented, not product defects); 29 passed / 0 skipped with the full 7-role seed. UI: 5/5 passed on the merged FE-008 screens. Verdict: BE-006 → DONE per QA authority.

## [0.3.0] - 2026-11-21

### Backend
- CRM / Lead module (BE-005, per docs/CRM_CONTRACT.md + DEC-014): lead CRUD with status pipeline (new/contacted/qualified/unqualified), pipeline summary, lead notes, follow-up activities with a due list, shared contacts (contacts now belong to a lead or a client), and one-action Lead → Client conversion that creates the Client + Organization + Contact, re-links contacts, locks the lead, and guards duplicates. New `leads.*` permissions enforced at the API layer.

### Frontend
- Internal app shell (FE-005): Classic Sidebar layout (DEC-013) for the internal app with unified shadcn-style design tokens (CSS variables + Tailwind v4 theme) in globals.css, responsive AppShell (desktop sidebar + mobile drawer), Topbar, single-line role chips, min-height stat cards and empty state. Dashboard moved under a route group so future modules share the shell. Self-check: tsc, build (en/vi) and vitest all pass.
- Normalized backend base URL (FE-006): `getBackendApiUrl()` now strips a trailing `/v1` from `NEXT_PUBLIC_API_URL`/`INTERNAL_API_URL`, preventing a double `/v1` segment in local dev; added regression tests.

### QA & Fixes
- QA-003 (OpenCode): authored Playwright test cases for the CRM/Lead module from docs/CRM_CONTRACT.md in tests/e2e/crm-lead.spec.ts (CRUD + filters, leads.* permission matrix, Lead->Client conversion incl. 409/422 guards, notes, activities + due list, pipeline summary, shared contacts, cross-tenant isolation); real run on demo seed: 10 passed, 8 skipped.
- Create responses now reflect database defaults (FIX-005): POST create endpoints refresh the model before responding, so fields such as client status, note author, and portal account locale/is_active are no longer blank in 201 responses. Includes a regression test.
- Compose hardening (FIX-006): default filesystem disk is now `local` (S3/MinIO returns with the Group 7 storage decision), and the web service waits for the API healthcheck before starting.
- Removed an accidentally committed compiled Blade view file from `apps/api/storage/framework/views` (FIX-007); the directory keeps only `.gitkeep`.
- Fixed web-to-API wiring in Docker (FIX-004): the web service now sets INTERNAL_API_URL=http://api:8000/api so the Next.js BFF can reach the Laravel API over the compose network. Without it the BFF fell back to localhost inside its own container and every login failed with "fetch failed" / HTTP 500 before credentials were even checked.
- MinIO removed from the default compose stack (FIX-003): MinIO no longer offers a free public image (Docker Hub removed it; Quay now returns 401), which blocked `docker compose up` entirely. The service now sits behind the `storage` compose profile and the API no longer depends on it; nothing in the current scope uses S3 yet.

## [0.2.0] - 2026-11-21

### Backend
- Client module (BE-004, per docs/CLIENT_CONTRACT.md + DEC-009): client profiles with organizations (1-1) and contacts, segmentation tags and filters, internal client notes, and Portal account provisioning (create/enable/disable) including the `client_accounts.client_id` foreign key. RBAC `clients.*` permissions are enforced at the API layer via a new permission middleware; deleting a client soft-deletes it and disables its Portal accounts.
- Repository bootstrap by Muse (Backend): project conventions, finalized stack, MVP scope, RBAC & i18n decisions, and initialization plan added under `docs/`.
- Monorepo foundation & Docker Compose (BE-001): root `docker-compose.yml` with api/web/mysql/redis/mailpit/minio, PHP 8.3 and Node 20 Dockerfiles, shared `.env.example` and `Makefile`.
- Laravel API initialized (BE-002): Laravel 12 in `apps/api`, Sanctum API scaffolding, `GET /api/v1/health` endpoint in the standard response format with a dedicated feature test.
- Auth, multi-tenancy & RBAC contract published (BE-003): `docs/AUTH_CONTRACT.md` approved by the Product Owner, including global-unique email, no hard token expiry in the MVP, and portal password reset (DEC-008).

### Frontend
- Next.js web skeleton (FE-001): Next.js 15 + TypeScript strict + Tailwind v4, next-intl routing for `en` (default) and `vi` with all UI strings in `messages/` files, locale switcher on the home frame page. (Entry restored in the BE-003 docs PR — it was missed in PR #3 due to a string-matching mistake by Muse.)
- Real API login wiring (FE-004): replaced mock auth with real Laravel API calls via Next.js BFF Route Handlers (/api/auth/login, /api/auth/logout, /api/auth/me) using secure httpOnly cookie (app_token); mapped API error codes (INVALID_CREDENTIALS, AGENCY_LOCKED, ACCOUNT_DISABLED) to LoginForm banner respecting bilingual messages; verified roles and permissions via GET /v1/auth/me; logout revokes token via API; 14 vitest tests PASS; Next.js build PASS.
- Client Portal login frame (FE-003): dedicated /portal area with custom layout and emerald branding; mock auth service per AUTH_CONTRACT.md §3 (login, logout, me, forgot-password, reset-password); portal_token isolated from internal app_token; portal route guard in middleware; empty dashboard placeholder per i18n; EN/VI fully supported; 16 vitest tests PASS; next build PASS.

### QA & Fixes
- Fixed web-to-API wiring in Docker (FIX-004): the web service now sets INTERNAL_API_URL=http://api:8000/api so the Next.js BFF can reach the Laravel API over the compose network. Without it the BFF fell back to localhost inside its own container and every login failed with "fetch failed" / HTTP 500 before credentials were even checked.
- MinIO removed from the default compose stack (FIX-003): MinIO no longer offers a free public image (Docker Hub removed it; Quay now returns 401), which blocked `docker compose up` entirely. The service now sits behind the `storage` compose profile and the API no longer depends on it; nothing in the current scope uses S3 yet.
- Fixed revoked tokens returning 500 instead of 401 for non-JSON API clients (FIX-002, QA-002 finding): Laravel's default guest redirect called a nonexistent `login` route inside the auth middleware; API guests now get the standard 401 `UNAUTHENTICATED`. Also restored `storage/framework/*` directories via `.gitkeep` so password-reset mails work on a clean checkout.
- Fixed MinIO service failing to start (FIX-001): the `minio/minio` image was removed from Docker Hub; the compose stack now uses MinIO's official Quay registry image `quay.io/minio/minio`.
- QA-001 (OpenCode): reviewed bootstrap DOC-001 — 5 mandatory files + `docs/` verified against DEC-001..DEC-008: PASS, no blocker. Two minor findings logged in `TASK.md` Inbox (stale CONVENTIONS note; missing Portal password-reset endpoints in AUTH_CONTRACT).
- QA-002 (OpenCode): authored 23 Playwright cases from docs/AUTH_CONTRACT.md (17 API + 6 E2E) in tests/e2e/auth.spec.ts; final run on merged main: 17/17 API PASS (TC-AUTH-14/15 closed by FIX-002; TC-AUTH-11/12 enabled on BE-004 endpoints) and 6/6 E2E PASS.

## [0.1.0] - 2026-11-20
- Project repository created by Nguyen (Product Owner). Pre-release baseline: documentation and planning only, no application code yet.
