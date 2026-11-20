# API — Laravel Backend

Owned by **Muse (Backend Developer)** — see `../../docs/CONVENTIONS.md`.

- PHP 8.3 · Laravel 12 · MySQL 8 · Redis · Laravel Sanctum (Bearer token)
- API base path: `/api/v1` — all responses follow the standard format `{ data, meta?, error? }` with stable error codes.
- Health check: `GET /api/v1/health`
- OpenAPI contract is generated from this codebase (Scramble) and published to `../../packages/contracts/` through the contract process — never edited by hand there.

## Run locally

From the repository root:

```bash
docker compose up
```

Or without Docker (requires PHP 8.3 + Composer):

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve
```

## Test

```bash
php artisan test
vendor/bin/pint --test
```
