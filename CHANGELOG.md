# Changelog

All notable changes to this project are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/). Versions follow Semantic Versioning.
Only OpenCode may package an `[Unreleased]` section into a release and bump `VERSION.md` (see `docs/CONVENTIONS.md`).

## [Unreleased]

### Backend
- Repository bootstrap by Muse (Backend): project conventions, finalized stack, MVP scope, RBAC & i18n decisions, and initialization plan added under `docs/`.
- Monorepo foundation & Docker Compose (BE-001): root `docker-compose.yml` with api/web/mysql/redis/mailpit/minio, PHP 8.3 and Node 20 Dockerfiles, shared `.env.example` and `Makefile`.
- Laravel API initialized (BE-002): Laravel 12 in `apps/api`, Sanctum API scaffolding, `GET /api/v1/health` endpoint in the standard response format with a dedicated feature test.

### Frontend
-

### QA & Fixes
-

## [0.1.0] - 2026-11-20
- Project repository created by Nguyen (Product Owner). Pre-release baseline: documentation and planning only, no application code yet.
