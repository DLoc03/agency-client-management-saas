# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow Semantic Versioning.
Only OpenCode may package an `[Unreleased]` section into a release and bump `VERSION.md` (see `docs/CONVENTIONS.md`).

## [Unreleased]

### Backend
- Repository bootstrap by Muse (Backend): project conventions, finalized stack, MVP scope, RBAC & i18n decisions, and initialization plan added under `docs/`.
- Monorepo foundation & Docker Compose (BE-001): root `docker-compose.yml` with api/web/mysql/redis/mailpit/minio, PHP 8.3 and Node 20 Dockerfiles, shared `.env.example` and `Makefile`.
- Laravel API initialized (BE-002): Laravel 12 in `apps/api`, Sanctum API scaffolding, `GET /api/v1/health` endpoint in the standard response format with a dedicated feature test.
- Auth, multi-tenancy & RBAC contract published (BE-003): `docs/AUTH_CONTRACT.md` approved by the Product Owner, including global-unique email, no hard token expiry in the MVP, and portal password reset (DEC-008).

### Frontend
- Next.js web skeleton (FE-001): Next.js 15 + TypeScript strict + Tailwind v4, next-intl routing for `en` (default) and `vi` with all UI strings in `messages/` files, locale switcher on the home frame page. (Entry restored in the BE-003 docs PR — it was missed in PR #3 due to a string-matching mistake by Muse.)

### QA & Fixes
- QA-001 (OpenCode): reviewed bootstrap DOC-001 — 5 mandatory files + `docs/` verified against DEC-001..DEC-008: PASS, no blocker. Two minor findings logged in `TASK.md` Inbox (stale CONVENTIONS note; missing Portal password-reset endpoints in AUTH_CONTRACT).

## [0.1.0] - 2026-11-20
- Project repository created by Nguyen (Product Owner). Pre-release baseline: documentation and planning only, no application code yet.
