# End-to-End Tests (Playwright)

Owned by **OpenCode (QA Review & Tester)** — see `docs/CONVENTIONS.md`.

- Framework: Playwright (TypeScript).
- E2E tests run against the full local stack (`docker compose up`).
- Test cases are written from each task's Acceptance Criteria in `TASK.md` and from the published API contract in `packages/contracts/` — QA does not need to wait for implementation to start writing cases.
- Seed/demo data used by E2E tests must be the shared English demo dataset defined by the Backend (no private test fixtures that diverge from development data).
