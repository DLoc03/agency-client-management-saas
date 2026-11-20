# Web — Next.js Frontend

Owned by **Google Antigravity (Frontend Developer)** — see `../../docs/CONVENTIONS.md`.
This skeleton was prepared by Muse during repo initialization (REPO_INITIALIZATION.md); Antigravity takes ownership from here.

- Next.js (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form + Zod
- i18n via next-intl: locales `en` (default) and `vi` — **no hardcoded display strings**; all UI text lives in `messages/en.json` / `messages/vi.json` (DEC-006).
- API contract comes only from `../../packages/contracts/` — never call endpoints that are not in the contract; use mocks while the backend is in progress.

## Run locally

```bash
# from the repository root
docker compose up

# or without Docker (Node 20 LTS + pnpm)
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```
