# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow Semantic Versioning.
Only OpenCode may package an `[Unreleased]` section into a release and bump `VERSION.md` (see `docs/CONVENTIONS.md`).

## [Unreleased]

## [0.4.0] - 2026-11-22

### Backend
- Project Management contract published (BE-006): `docs/PROJECT_CONTRACT.md` approved by the Product Owner (DEC-016) — projects with members and milestones, tasks with assignees, priorities, due dates, comments and checklist items, read-time progress %, list timeline, and read-only Portal project endpoints. Implementation follows in BE-006.
- Project Management module (BE-006): projects CRUD with filters and soft-delete cascade, project members, milestones, tasks with assignee/priority/due date and automatic `completed_at`, task comments and checklist items, read-time progress %, list timeline, due list, and read-only Portal project endpoints. `projects.*`/`tasks.*` RBAC per DEC-016 with Team Member scoping (participating projects only, own assigned tasks only).

### Frontend
- Project Management screens (FE-008): enabled Projects nav item; list page with client/status/manager/search filters, progress % with done/total, empty state; project detail with overview, progress bar, milestones with per-milestone %, members add/remove, tasks with status/priority/assignee/milestone filters, timeline list; task detail with status/priority/due/assignee, checklist add/tick/remove, internal comments add/delete by author; BFF proxy routes to /projects and /tasks; Projects i18n namespace EN/VI (vi.json U+FFFD = 0). Self-check: typecheck, build (en+vi), tests pass; responsive classes reviewed at 390/768/1280.

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
