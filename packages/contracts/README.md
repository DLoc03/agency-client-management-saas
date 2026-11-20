# Contracts

Generated API contract artifacts shared between Backend and Frontend:

- `openapi.yaml` — OpenAPI specification generated from the Laravel API (Scramble).
- `types/` — TypeScript types/client generated from the OpenAPI specification (`openapi-typescript`).

**Rules (see `docs/CONVENTIONS.md`, contract process):**

- Files in this folder are **generated**. Never edit them by hand.
- They change only when a contract proposal has been drafted by Muse, approved by Nguyen (Product Owner), and then published.
- Frontend and QA work against the contract published here — not against drafts in chat.
