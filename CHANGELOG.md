# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow Semantic Versioning.
Only OpenCode may package an `[Unreleased]` section into a release and bump `VERSION.md` (see `docs/CONVENTIONS.md`).

## [Unreleased]

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
- MinIO removed from the default compose stack (FIX-003): MinIO no longer offers a free public image (Docker Hub removed it; Quay now returns 401), which blocked `docker compose up` entirely. The service now sits behind the `storage` compose profile and the API no longer depends on it; nothing in the current scope uses S3 yet.
- Fixed revoked tokens returning 500 instead of 401 for non-JSON API clients (FIX-002, QA-002 finding): Laravel's default guest redirect called a nonexistent `login` route inside the auth middleware; API guests now get the standard 401 `UNAUTHENTICATED`. Also restored `storage/framework/*` directories via `.gitkeep` so password-reset mails work on a clean checkout.
- Fixed MinIO service failing to start (FIX-001): the `minio/minio` image was removed from Docker Hub; the compose stack now uses MinIO's official Quay registry image `quay.io/minio/minio`.
- QA-001 (OpenCode): reviewed bootstrap DOC-001 — 5 mandatory files + `docs/` verified against DEC-001..DEC-008: PASS, no blocker. Two minor findings logged in `TASK.md` Inbox (stale CONVENTIONS note; missing Portal password-reset endpoints in AUTH_CONTRACT).
- QA-002 (OpenCode): authored 23 Playwright cases from docs/AUTH_CONTRACT.md (17 API + 6 E2E) in tests/e2e/auth.spec.ts; API run on BE-003: 14 PASS / 2 FAIL (TC-AUTH-14, 15 - 500 on revoked token) / 2 SKIP (11, 12 pending BE-004); TC-AUTH-17 enabled after portal reset endpoints landed. E2E pending FE-004.

## [0.1.0] - 2026-11-20
- Project repository created by Nguyen (Product Owner). Pre-release baseline: documentation and planning only, no application code yet.
