# TASK.md â€” Danh sÃ¡ch task theo ID
Quy táº¯c ghi file nÃ y xem táº¡i `docs/CONVENTIONS.md` má»¥c F.2. Luá»“ng tráº¡ng thÃ¡i: `TODO â†’ IN_PROGRESS â†’ IN_REVIEW â†’ DONE` Â· nhÃ¡nh: `BLOCKED`, `REOPEN`.

---

## DOC-001 â€” Bootstrap repository documents & conventions
- Assignee: Muse Â· Level: L3 Â· Status: DONE
- Branch: â€” (bootstrap trá»±c tiáº¿p lÃªn `main` má»™t láº§n duy nháº¥t, xem DEC-007) Â· PR: â€”
- Blocked by: â€”
- Acceptance Criteria: 5 file báº¯t buá»™c (VERSION.md, TASK.md, CHANGELOG.md, README.md, DECISIONS.md) cÃ³ máº·t á»Ÿ root vá»›i ná»™i dung Ä‘Ã£ chá»‘t; tÃ i liá»‡u Quy Æ°á»›c / Stack / Scope / RBAC-i18n náº±m trong `docs/`; repo Ä‘á»c láº¡i Ä‘Æ°á»£c trÃªn GitHub sau khi Ä‘áº©y.
- Progress: HoÃ n thÃ nh vÃ  Ä‘áº©y lÃªn `main` ngÃ y 2026-11-20 (commit 05aa5b1), Ä‘Ã£ Ä‘á»c láº¡i xÃ¡c minh trÃªn GitHub. Chá» OpenCode review theo QA-001.
- Handoff: Sau khi xong, OpenCode review theo QA-001.

---
- ÄÃ³ng task: DONE 2026-11-21 â€” QA PASS toÃ n pháº§n, Ä‘Ã³ng cÃ¹ng release 0.2.0 (OpenCode theo tháº©m quyá»n QA).

## BE-001 â€” Monorepo foundation & Docker Compose
- Assignee: Muse Â· Level: L3 Â· Status: IN_REVIEW
- Branch: be/BE-001-monorepo-docker Â· PR: #1 (Ä‘Ã£ merge)
- Blocked by: DOC-001
- Acceptance Criteria: Cáº¥u trÃºc `apps/`, `packages/contracts/`, `tests/e2e/`, `docs/`; `docker-compose.yml` á»Ÿ root cháº¡y Ä‘Æ°á»£c cÃ¡c service api/web/mysql/redis/mailpit/minio trÃªn mÃ¡y sáº¡ch; `.gitignore` + `.editorconfig` Ä‘áº§y Ä‘á»§ cho Laravel + Next.js.
- Progress: Muse báº¯t Ä‘áº§u 2026-11-20: Ä‘Ã£ soáº¡n docker-compose.yml (api/web/mysql/redis/mailpit/minio), Dockerfile cho api (PHP 8.3) vÃ  web (Node 20), README cho packages/contracts vÃ  tests/e2e, .env.example + Makefile á»Ÿ root. ChÆ°a kiá»ƒm chá»©ng cháº¡y Docker tháº­t (mÃ´i trÆ°á»ng cá»§a Muse khÃ´ng cÃ³ Docker) â€” cáº§n OpenCode/Nguyen cháº¡y `docker compose up` kiá»ƒm chá»©ng á»Ÿ bÆ°á»›c review.
- Handoff: â€”

---

## BE-002 â€” Initialize Laravel API & health endpoint
- Assignee: Muse Â· Level: L2 Â· Status: IN_REVIEW
- Branch: be/BE-002-laravel-api-init Â· PR: #2 (Ä‘Ã£ merge)
- Blocked by: BE-001
- Acceptance Criteria: Laravel cháº¡y á»Ÿ `apps/api` trong Docker; `.env.example` khÃ´ng chá»©a secret tháº­t; endpoint `GET /api/v1/health` tráº£ vá» format response chuáº©n Ä‘Ã£ thá»‘ng nháº¥t; Pint + PHPUnit/Pest cháº¡y Ä‘Æ°á»£c.
- Progress: Muse hoÃ n thÃ nh 2026-11-20: Laravel v12.73.0 (ghim Ä‘Ãºng ^12.0 theo DEC-001), Ä‘Ã£ cÃ i Sanctum API scaffolding, HealthController + test riÃªng. Kiá»ƒm chá»©ng táº¡i mÃ¡y Muse: `php artisan test` 3 passed, HTTP tháº­t tá»›i `/api/v1/health` tráº£ 200 Ä‘Ãºng format `{data:{status,service,version,timestamp}}`, Pint PASS. ChÆ°a kiá»ƒm chá»©ng qua Docker (mÃ´i trÆ°á»ng Muse khÃ´ng cÃ³ Docker) â€” kiá»ƒm chá»©ng á»Ÿ bÆ°á»›c review.
- Handoff: â€”

---

## FE-001 â€” Initialize Next.js web app & i18n EN/VI
- Assignee: Google Antigravity Â· Level: L2 Â· Status: IN_REVIEW
- Branch: fe/FE-001-nextjs-init Â· PR: #3 (Ä‘Ã£ merge)
- Blocked by: BE-001
- Acceptance Criteria: Next.js (App Router) + TypeScript strict á»Ÿ `apps/web`; Tailwind CSS + shadcn/ui; `next-intl` vá»›i `en.json`/`vi.json` chuyá»ƒn Ä‘Æ°á»£c EN â†” VI á»Ÿ trang khung; khÃ´ng cÃ³ chuá»—i hiá»ƒn thá»‹ viáº¿t cá»©ng trong component.
- Progress: Khung khá»Ÿi táº¡o do Muse dá»±ng theo káº¿ hoáº¡ch khá»Ÿi táº¡o (2026-11-20), Antigravity tiáº¿p quáº£n tá»« Ä‘Ã¢y: Next.js 15 + TypeScript strict + Tailwind v4 + next-intl, routing theo locale (en máº·c Ä‘á»‹nh, vi Ä‘áº§y Ä‘á»§), trang chá»§ dÃ¹ng 100% chuá»—i dá»‹ch tá»« `messages/`. Kiá»ƒm chá»©ng táº¡i mÃ¡y Muse: `npm install` OK, `tsc --noEmit` khÃ´ng lá»—i, `next build` thÃ nh cÃ´ng, sinh Ä‘á»§ trang `/en` vÃ  `/vi`. ChÆ°a cÃ³ `pnpm-lock.yaml` (mÃ¡y Muse khÃ´ng cÃ³ pnpm) â€” sinh khi `pnpm install` láº§n Ä‘áº§u/Docker build. shadcn/ui + TanStack Query + RHF/Zod thÃªm á»Ÿ cÃ¡c task mÃ n hÃ¬nh Ä‘áº§u tiÃªn. (Ghi chÃº minh báº¡ch: báº£n ghi Progress nÃ y láº½ ra náº±m trong PR #3 nhÆ°ng bá»‹ sÃ³t do lá»—i khá»›p chuá»—i khi Muse cáº­p nháº­t file â€” bá»• sung táº¡i PR tÃ i liá»‡u BE-003.)
- Handoff: Khung khá»Ÿi táº¡o cÃ³ thá»ƒ do Muse dá»±ng á»Ÿ bÆ°á»›c bootstrap theo káº¿ hoáº¡ch khá»Ÿi táº¡o; Antigravity tiáº¿p quáº£n vÃ  hoÃ n thiá»‡n.

---

## QA-001 â€” Review bootstrap, conventions & repository structure
- Assignee: OpenCode Â· Level: L1 Â· Status: DONE
- Branch: qa/QA-001-bootstrap-review Â· PR: #5 (chá» Muse review/merge â€” G.3)
- Blocked by: DOC-001
- Acceptance Criteria: Kiá»ƒm tra 5 file báº¯t buá»™c Ä‘Ãºng quy Æ°á»›c (VERSION.md Ä‘Ãºng 1 dÃ²ng; TASK.md theo ID; quyá»n ghi tá»«ng file); kiá»ƒm tra tÃ i liá»‡u trong `docs/` khá»›p cÃ¡c quyáº¿t Ä‘á»‹nh DEC-001 â†’ DEC-007; bÃ¡o cÃ¡o káº¿t quáº£ trong task nÃ y.
- Progress: OpenCode review ngÃ y 2026-11-20 táº¡i commit `7432ccd` (main). **Káº¿t luáº­n: PASS, khÃ´ng cÃ³ blocker cho DOC-001** â€” pháº¡m vi má»Ÿ rá»™ng theo chá»‰ Ä‘áº¡o cá»§a Nguyen: DEC-001 â†’ DEC-008 (AC gá»‘c ghi Ä‘áº¿n DEC-007).
  - 5 file báº¯t buá»™c: `VERSION.md` Ä‘Ãºng 1 dÃ²ng `0.1.0`, khÃ´ng tiÃªu Ä‘á»/ngÃ y/ghi chÃº, Ä‘Ãºng chá»§ ghi OpenCode âœ… Â· `TASK.md` theo danh sÃ¡ch Task ID (9 má»¥c + Inbox), má»—i má»¥c Ä‘á»§ Assignee/Level/Status/Branch/Blocked by/AC/Progress/Handoff, quyá»n ghi Ä‘Ãºng F.2 âœ… Â· `CHANGELOG.md` Ä‘Ãºng Keep a Changelog, cÃ³ `[Unreleased]` vá»›i 3 tiá»ƒu má»¥c cá»‘ Ä‘á»‹nh, append-only âœ… Â· `README.md` (EN, DEC-006) + `README.vi.md` cÃ³ link chÃ©o Ä‘áº§y Ä‘á»§ âœ… Â· `DECISIONS.md` cÃ³ DEC-001 â†’ DEC-008, append-only, Ä‘Ãºng chá»§ ghi Nguyen + Muse (QA chá»‰ Ä‘á»c, khÃ´ng sá»­a) âœ….
  - `docs/` khá»›p quyáº¿t Ä‘á»‹nh: `STACK.md` â†” DEC-001/003 Â· `MVP_SCOPE.md` â†” DEC-004 (8 nhÃ³m, luá»“ng lÃµi, Super Admin tá»‘i giáº£n, shared DB + `agency_id`) Â· `RBAC_AND_I18N.md` â†” DEC-005/006 (7 vai trÃ², Client tÃ¡ch loáº¡i tÃ i khoáº£n, nhiá»u vai trÃ², scope dá»¯ liá»‡u, EN máº·c Ä‘á»‹nh + VI Ä‘áº§y Ä‘á»§) Â· `REPO_INITIALIZATION.md` â†” DEC-007 Â· `AUTH_CONTRACT.md` â†” DEC-008 (email unique toÃ n há»‡ thá»‘ng, token khÃ´ng háº¡n cá»©ng, Portal cÃ³ quÃªn máº­t kháº©u, tÃ¡ch scope `app`/`portal`, cross-tenant 404) â€” Ä‘á»u nháº¥t quÃ¡n âœ…. `git log` xÃ¡c nháº­n bootstrap `05aa5b1` Ä‘áº©y tháº³ng `main` Ä‘Ãºng ngoáº¡i lá»‡ DEC-007; cÃ¡c thay Ä‘á»•i sau Ä‘i qua PR #1â€“#4 âœ….
  - Finding minor (khÃ´ng block, Ä‘Ã£ ghi Inbox): `docs/CONVENTIONS.md:252` cÃ²n ghi "chá»‘t stack backend + scope MVP â€” váº«n Ä‘ang chá», chÆ°a báº¯t Ä‘áº§u code", mÃ¢u thuáº«n DEC-001/DEC-004 vÃ  thá»±c táº¿ Ä‘Ã£ merge BE-001/BE-002/FE-001. Sá»­a quy Æ°á»›c thuá»™c quyá»n Nguyen (DEC-002) â†’ QA khÃ´ng tá»± sá»­a.
  - Finding minor (khÃ´ng block, Ä‘Ã£ ghi Inbox): `docs/AUTH_CONTRACT.md` má»¥c 8/DEC-008.3 chá»‘t Portal cÃ³ quÃªn máº­t kháº©u, nhÆ°ng báº£ng endpoint má»¥c 3 má»›i cÃ³ login/logout/me â€” thiáº¿u `POST /portal/auth/forgot-password` vÃ  `/portal/auth/reset-password`. Cáº§n Muse + Nguyen chá»‘t trÆ°á»›c khi cháº¡y test tháº­t QA-002.
  - Observation (khÃ´ng block): `docs/STACK.md` má»¥c 3 váº«n liá»‡t kÃª multi-tenancy lÃ  "chÆ°a quyáº¿t" dÃ¹ DEC-004 Ä‘Ã£ chá»‘t; README "Getting started" váº«n nÃ³i chá» monorepo dÃ¹ BE-001 Ä‘Ã£ merge.
  - KhÃ´ng tá»± merge PR cá»§a chÃ­nh mÃ¬nh (B.6/G.3). Task giá»¯ `IN_REVIEW` chá» Muse approve/merge; Muse hoáº·c Nguyen chuyá»ƒn `DONE` theo ngoáº¡i lá»‡ F.2 cho task do OpenCode tá»± lÃ m. Äá» xuáº¥t DOC-001 â†’ `DONE` sau khi PR nÃ y merge (F.2 cho phÃ©p OpenCode nghiá»‡m thu task cá»§a Muse).
- Handoff: PR #5 chá» Muse review; sau approve/merge, Ä‘á» xuáº¥t cáº­p nháº­t DOC-001 â†’ DONE vÃ  xá»­ lÃ½ 2 má»¥c Inbox á»Ÿ trÃªn. (NgÆ°á»i má»Ÿ PR khÃ´ng tá»± merge â€” G.3.)

---
- ÄÃ³ng task: DONE 2026-11-21 â€” do Muse chuyá»ƒn theo ngoáº¡i lá»‡ F.2 (task cá»§a chÃ­nh QA, QA khÃ´ng tá»± Ä‘Ã³ng); 2 finding Ä‘Ã£ xá»­ lÃ½ á»Ÿ PR #9.

## BE-003 â€” Auth, multi-tenancy & RBAC contract (design)
- Assignee: Muse Â· Level: L3 Â· Status: DONE
- Branch: be/BE-003-auth-tenancy-rbac Â· PR: #8
- Blocked by: BE-002
- Acceptance Criteria: Äá» xuáº¥t contract Auth (Ä‘Äƒng kÃ½/Ä‘Äƒng nháº­p/token) + mÃ´ hÃ¬nh multi-tenancy `agency_id` + ma tráº­n phÃ¢n quyá»n chi tiáº¿t 7 vai trÃ² Ä‘Æ°á»£c Muse soáº¡n vÃ  Nguyen duyá»‡t trÆ°á»›c khi phá»• biáº¿n cho Antigravity/OpenCode (quy trÃ¬nh má»¥c E, Quy Æ°á»›c chung).
- Progress: Há»£p Ä‘á»“ng Ä‘Ã£ Ä‘Æ°á»£c Nguyen DUYá»†T ngÃ y 2026-11-20 (kÃ¨m 3 chá»‘t táº¡i DEC-008: email unique toÃ n há»‡ thá»‘ng; token khÃ´ng Ä‘áº·t háº¡n cá»©ng trong MVP; Portal cÃ³ quÃªn máº­t kháº©u) vÃ  cÃ´ng bá»‘ táº¡i `docs/AUTH_CONTRACT.md` (PR #4). Pháº§n Backend Ä‘Ã£ triá»ƒn khai xong: migrations agencies/roles/super_admins/client_accounts + users.agency_id/locale/is_active; trait BelongsToAgency (global scope theo agency cá»§a user Ä‘Äƒng nháº­p, cÃ³ chá»‘ng Ä‘á»‡ quy khi Sanctum Ä‘ang náº¡p tokenable); AuthController + PortalAuthController (token tÃ¡ch ability `app`/`portal`, cháº·n chÃ©o 403); chuáº©n lá»—i `{error:{code,message,details}}` + thÃ´ng Ä‘iá»‡p EN/VI theo locale; rate limit login 5/phÃºt; link reset máº­t kháº©u trá» vá» web app (FRONTEND_URL); seed roles + demo data opt-in (SEED_DEMO_DATA); OpenAPI sinh báº±ng Scramble táº¡i `packages/contracts/openapi.json` (12 paths). Kiá»ƒm chá»©ng táº¡i mÃ¡y Muse: `php artisan test` **19 passed** (gá»“m test tá»«ng mÃ£ lá»—i, cháº·n chÃ©o token, scope cross-tenant), Pint PASS, smoke test HTTP tháº­t: login Owner/Portal Ä‘Ãºng payload, token app gá»i Portal bá»‹ 403 FORBIDDEN, sai máº­t kháº©u vá»›i Accept-Language `vi` tráº£ thÃ´ng Ä‘iá»‡p tiáº¿ng Viá»‡t. ChÆ°a kiá»ƒm chá»©ng qua Docker (mÃ¡y Muse khÃ´ng cÃ³ Docker).
- Handoff: â€”

---
- ÄÃ³ng task: DONE 2026-11-21 â€” QA-002 cháº¡y tháº­t PASS 17/17 API (gá»“m TC-AUTH-14/15 sau FIX-002); Ä‘Ã³ng cÃ¹ng release 0.2.0.

## FE-002 â€” Internal app login (Auth contract implementation)
- Assignee: Google Antigravity Â· Level: L2 Â· Status: DONE
- Branch: fe/FE-002-login Â· PR: â€”
- Blocked by: â€” (há»£p Ä‘á»“ng `docs/AUTH_CONTRACT.md` Ä‘Ã£ duyá»‡t â€” lÃ m báº±ng mock, khÃ´ng chá» BE-003 code)
- Acceptance Criteria: MÃ n hÃ¬nh Ä‘Äƒng nháº­p ná»™i bá»™ gá»i `POST /api/v1/auth/login` theo há»£p Ä‘á»“ng (mock trÆ°á»›c, ná»‘i API tháº­t khi BE-003 xong); lÆ°u token an toÃ n phÃ­a client; route guard cháº·n trang ná»™i bá»™ khi chÆ°a Ä‘Äƒng nháº­p; hiá»ƒn thá»‹ lá»—i theo mÃ£ lá»—i chuáº©n (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`); chuyá»ƒn EN â†” VI ngay táº¡i mÃ n login; khÃ´ng hardcode chuá»—i hiá»ƒn thá»‹.
- Progress: â€”
- Handoff: Báº¯t Ä‘áº§u Ä‘Æ°á»£c ngay sau khi PR tÃ i liá»‡u BE-003 merge.

---
- ÄÃ³ng task: DONE 2026-11-21 â€” luá»“ng login Ä‘Ã£ Ä‘Æ°á»£c FE-004 ná»‘i API tháº­t thay mock; QA E2E PASS; Ä‘Ã³ng cÃ¹ng release 0.2.0.

## FE-003 â€” Client Portal login frame
- Assignee: Google Antigravity Â· Level: L2 Â· Status: DONE
- Branch: fe/FE-003-portal-login Â· PR: â€”
- Blocked by: â€” (há»£p Ä‘á»“ng Ä‘Ã£ duyá»‡t â€” lÃ m báº±ng mock)
- Acceptance Criteria: Khu vá»±c Portal tÃ¡ch riÃªng táº¡i route `/portal` vá»›i layout riÃªng; mÃ n Ä‘Äƒng nháº­p Portal gá»i `POST /api/v1/portal/auth/login` (mock theo há»£p Ä‘á»“ng); token portal tÃ¡ch biá»‡t token ná»™i bá»™ (khÃ´ng dÃ¹ng láº«n); trang tá»•ng quan Portal trá»‘ng (placeholder theo i18n) sau Ä‘Äƒng nháº­p; EN/VI Ä‘áº§y Ä‘á»§.
- Progress: Antigravity hoÃ n thÃ nh 2026-11-20: xÃ¢y dá»±ng khung Client Portal táº¡i route /portal vá»›i layout riÃªng biá»‡t, mock service theo docs/AUTH_CONTRACT.md (login, logout, me, forgot-password, reset-password), token portal_token tÃ¡ch biá»‡t hoÃ n toÃ n vá»›i app_token, route guard cho Portal, i18n EN/VI Ä‘áº§y Ä‘á»§ (16 vitest tests PASS, tsc PASS, next build PASS). Äang má»Ÿ PR.
- Handoff: Báº¯t Ä‘áº§u Ä‘Æ°á»£c ngay sau khi PR tÃ i liá»‡u BE-003 merge.

---
- ÄÃ³ng task: DONE 2026-11-21 â€” QA E2E PASS trÃªn báº£n mock theo há»£p Ä‘á»“ng Portal; Ä‘Ã³ng cÃ¹ng release 0.2.0. (Ná»‘i API tháº­t lÃ  task riÃªng sau nÃ y.)

## QA-002 â€” Auth & tenancy test coverage
- Assignee: OpenCode Â· Level: L1 Â· Status: DONE
- Branch: qa/QA-002-run-results Â· PR: #6 (Ä‘Ã£ merge) + PR káº¿t quáº£ cháº¡y tháº­t nÃ y (Muse má»Ÿ thay OpenCode tá»« commit d4f3af3 trÃªn branch cÅ©, vÃ¬ PR #6 Ä‘Ã£ Ä‘Ã³ng)
- Blocked by: BE-003 (Ä‘Ã£ merge PR #8 â€” pháº§n API cháº¡y xong); FE-004 (chá» merge Ä‘á»ƒ cháº¡y pháº§n E2E)
- Acceptance Criteria: Bá»™ test case bao phá»§: login Ä‘Ãºng/sai thÃ´ng tin, agency bá»‹ khoÃ¡, tÃ i khoáº£n bá»‹ vÃ´ hiá»‡u hoÃ¡, token portal gá»i API ná»™i bá»™ bá»‹ cháº·n vÃ  ngÆ°á»£c láº¡i, truy váº¥n dá»¯ liá»‡u agency khÃ¡c tráº£ 404, rate limit login; E2E Playwright cho luá»“ng login ná»™i bá»™ + Portal; káº¿t quáº£ ghi vÃ o task nÃ y.
- Progress: OpenCode hoÃ n thÃ nh 2026-11-20 bá»™ **23 test case** (17 API + 6 E2E) tá»« `docs/AUTH_CONTRACT.md` Ä‘Ã£ duyá»‡t (DEC-008), lÆ°u táº¡i `tests/e2e/auth.spec.ts`. ChÆ°a cháº¡y tháº­t vÃ¬ BE-003/FE-002/FE-003 chÆ°a lÃªn PR â€” Ä‘Ãºng Handoff cá»§a task.
  - Phá»§ Acceptance Criteria: login Ä‘Ãºng (TC-AUTH-01, TC-E2E-01), sai email/sai máº­t kháº©u (02, E2E-02), agency khoÃ¡ (03, E2E-03), tÃ i khoáº£n vÃ´ hiá»‡u (04, E2E-03), token Portal â†’ API ná»™i bá»™ bá»‹ cháº·n (08, E2E-05) vÃ  token ná»™i bá»™ â†’ API Portal bá»‹ cháº·n (09), Ä‘á»c dá»¯ liá»‡u agency khÃ¡c â†’ 404 thay vÃ¬ 403 (11), rate limit 5 láº§n/phÃºt/IP (13).
  - Phá»§ thÃªm theo há»£p Ä‘á»“ng: token Portal tÃ¡ch biá»‡t + client summary (07), `agency_id` chá»‰ láº¥y tá»« token (10), FK khÃ¡c agency â†’ 422 `CROSS_TENANT_REFERENCE` (12), logout thu há»“i token (14), Ä‘á»•i máº­t kháº©u thu há»“i má»i token khÃ¡c (15), forgot/reset khÃ´ng dÃ² tÃ i khoáº£n + `INVALID_RESET_TOKEN` (16), mÃ£ lá»—i á»•n Ä‘á»‹nh nhÆ°ng message theo locale (06), E2E Portal `/portal` + guard + EN/VI (E2E-05/06).
  - `test.fixme` cÃ³ chá»§ Ä‘Ã­ch: TC-AUTH-17 (Portal forgot/reset) â€” DEC-008.3 Ä‘Ã£ chá»‘t nhÆ°ng `AUTH_CONTRACT.md` má»¥c 3 chÆ°a Ä‘á»‹nh nghÄ©a endpoint; Ä‘Ã£ bÃ¡o táº¡i PR #5 (Inbox QA-001), chá» Muse + Nguyen chá»‘t. TC-AUTH-11/12 dÃ¹ng env `E2E_TENANT_RESOURCE_PATH` / `E2E_TENANT_CREATE_PATH` + `test.skip` cÃ³ lÃ½ do tá»›i khi cÃ³ endpoint nghiá»‡p vá»¥ â€” khÃ´ng fail giáº£.
  - KhÃ´ng hardcode secret: má»i tÃ i khoáº£n/ID Ä‘á»c tá»« biáº¿n `E2E_*` cá»§a seed dÃ¹ng chung (`tests/e2e/README.md`, quy Æ°á»›c H.4). KhÃ´ng thÃªm dependency hay config chung (L4) â€” chá»‰ thÃªm 1 file spec trong pháº¡m vi sá»Ÿ há»¯u QA.
  - Káº¿t quáº£ cháº¡y tháº­t (API, 2026-11-20, DB `agency_saas`, seed demo + QA accounts): **14 PASS / 2 FAIL / 2 SKIP** trÃªn tá»•ng 17 ca API. Chi tiáº¿t:
    - PASS: TC-AUTH-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 13, 16, 17 (vÃ  TC-AUTH-11/12 SKIP vÃ¬ chÆ°a cÃ³ endpoint nghiá»‡p vá»¥ BE-004).
    - FAIL: TC-AUTH-14 vÃ  TC-AUTH-15 â€” sau logout/Ä‘á»•i máº­t kháº©u, token bá»‹ xoÃ¡ tráº£ **500** thay vÃ¬ 401 `UNAUTHENTICATED` (root cause: `auth:sanctum` middleware gá»i `route('login')` khÃ´ng tá»“n táº¡i trong API-only app). ÄÃ£ ghi finding Inbox. TC-AUTH-15 fail cÃ¹ng root cause.
    - SKIP: TC-AUTH-11 (cross-tenant 404), TC-AUTH-12 (cross-tenant FK 422) â€” chá» BE-004 cung cáº¥p endpoint nghiá»‡p vá»¥; giá»¯ `test.skip` cÃ³ lÃ½ do, khÃ´ng fail giáº£.
  - TC-AUTH-17 Ä‘Ã£ báº­t (khÃ´ng cÃ²n `test.fixme`) sau khi PR #9 bá»• sung endpoint Portal forgot/reset; PASS.
  - MÃ´i trÆ°á»ng: cáº§n `storage/framework/views` (view cache) cho luá»“ng forgot-password; Ä‘Ã£ ghi finding setup. Rate limit 5/phÃºt/IP khiáº¿n suite pháº£i cháº¡y theo nhÃ³m + flush Redis â€” ghi nháº­n trong PR.
  - E2E (TC-E2E-01..06) chÆ°a cháº¡y: FE-004 chÆ°a merge; sáº½ cháº¡y sau FE-004.
  - Káº¿t luáº­n: bá»™ API **PASS cÃ³ Ä‘iá»u kiá»‡n** (14/14 ca cÃ³ thá»ƒ cháº¡y Ä‘á»u pass; 2 fail cÃ¹ng 1 bug BE); khÃ´ng tá»± chuyá»ƒn `DONE` khi cÃ²n fail vÃ  cÃ²n E2E chÆ°a cháº¡y; khÃ´ng tá»± merge PR.
- Handoff: Khi BE-003/FE-002/FE-003 má»Ÿ PR, cháº¡y `tests/e2e/auth.spec.ts` trÃªn DB test riÃªng cá»§a QA (`agency_test`, G.2), bá»• sung endpoint Portal forgot/reset sau khi contract chá»‘t, rá»“i ghi káº¿t quáº£ PASS/FAIL vÃ o task nÃ y.

---
- ÄÃ³ng task: DONE 2026-11-21 â€” do Muse chuyá»ƒn theo ngoáº¡i lá»‡ F.2 (task cá»§a chÃ­nh QA); káº¿t quáº£ cháº¡y tháº­t PASS 23/23 (API 17/17 + E2E 6/6) theo bÃ¡o cÃ¡o OpenCode 2026-11-21.

## FIX-001 â€” MinIO image no longer on Docker Hub
- Assignee: Muse Â· Level: L2 Â· Status: IN_REVIEW
- Branch: fix/FIX-001-minio-image Â· PR: â€”
- Blocked by: â€”
- Acceptance Criteria: `docker compose up` kÃ©o Ä‘Æ°á»£c image MinIO (image `minio/minio` Ä‘Ã£ bá»‹ gá»¡ khá»i Docker Hub â€” phÃ¡t hiá»‡n khi Nguyen cháº¡y local láº§n Ä‘áº§u 2026-11-20); chuyá»ƒn sang registry chÃ­nh thá»©c cá»§a MinIO táº¡i Quay (`quay.io/minio/minio`); cÃ¡c service cÃ²n láº¡i khÃ´ng Ä‘á»•i.
- Progress: Muse sá»­a 2026-11-20 trong PR nÃ y; chá» kiá»ƒm chá»©ng báº±ng láº§n `docker compose up` Ä‘áº§y Ä‘á»§ tiáº¿p theo táº¡i mÃ¡y Nguyen.
- Handoff: â€”

---

## FE-004 â€” Ná»‘i mÃ n hÃ¬nh Ä‘Äƒng nháº­p ná»™i bá»™ vÃ o API tháº­t (BE-003)
- Assignee: Google Antigravity Â· Level: L3 Â· Status: DONE
- Branch: fe/FE-004-login-real-api Â· PR: #14
- Blocked by: â€” (BE-003 Ä‘Ã£ merge; FE-002 Ä‘Ã£ merge)
- Acceptance Criteria: thay `mockLogin()` báº±ng `POST /api/v1/auth/login` tháº­t; lÆ°u token vÃ  gá»i Ä‘Æ°á»£c `GET /api/v1/auth/me` (user + roles + permissions); cÃ¡c mÃ£ lá»—i cá»§a API (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`) hiá»ƒn thá»‹ Ä‘Ãºng banner Ä‘Ã£ lÃ m á»Ÿ FE-002, tÃ´n trá»ng thÃ´ng Ä‘iá»‡p song ngá»¯ API tráº£ vá»; logout gá»i API vÃ  xoÃ¡ token; cÃ¡ch lÆ°u token pháº£i ghi rÃµ trade-off báº£o máº­t trong PR (Æ°u tiÃªn httpOnly cookie qua route handler). Cáº­p nháº­t TASK.md má»¥c nÃ y + CHANGELOG.md [Unreleased] Frontend khi lÃ m.
- Progress: Antigravity hoÃ n thÃ nh 2026-11-20: xÃ¢y dá»±ng BFF route handlers (/api/auth/login, /api/auth/logout, /api/auth/me) vá»›i httpOnly cookie app_token; ná»‘i POST /v1/auth/login + GET /v1/auth/me; map cÃ¡c mÃ£ lá»—i chuáº©n (INVALID_CREDENTIALS, AGENCY_LOCKED, ACCOUNT_DISABLED) vÃ  tÃ´n trá»ng message song ngá»¯ tá»« backend; cáº­p nháº­t AuthContext, LoginForm vÃ  test suite (14 tests PASS, tsc PASS, next build PASS). Äang má»Ÿ PR.
- Handoff: OpenCode review theo ma tráº­n G.3; sau merge, QA-002 cháº¡y tháº­t pháº§n E2E trÃªn luá»“ng nÃ y.

---
- ÄÃ³ng task: DONE 2026-11-21 â€” QA E2E PASS + Nguyen nghiá»‡m thu Luá»“ng A Äáº T 2026-11-21; Ä‘Ã³ng cÃ¹ng release 0.2.0.

## BE-004 â€” Module Client (NhÃ³m 2) theo há»£p Ä‘á»“ng CLIENT_CONTRACT
- Assignee: Muse Â· Level: L3 Â· Status: IN_REVIEW
- Branch: be/BE-004-client-module Â· PR: https://github.com/DLoc03/agency-client-management-saas/pull/13
- Blocked by: â€” (há»£p Ä‘á»“ng Ä‘Ã£ duyá»‡t, DEC-009)
- Acceptance Criteria: CRUD Client + Organization + Contacts; tags & bá»™ lá»c phÃ¢n Ä‘oáº¡n; Client Notes ná»™i bá»™; cáº¥p/khoÃ¡ tÃ i khoáº£n Portal cho client (thÃªm FK `client_accounts.client_id â†’ clients.id`); ma tráº­n quyá»n clients.* theo há»£p Ä‘á»“ng; test Pest phá»§ cÃ¡ch ly tenant + ma tráº­n quyá»n + luá»“ng táº¡o tÃ i khoáº£n Portal Ä‘Äƒng nháº­p Ä‘Æ°á»£c; OpenAPI cáº­p nháº­t; Pint PASS.
- Progress: Há»£p Ä‘á»“ng duyá»‡t 2026-11-20 (DEC-009, PR #12). Muse Ä‘Ã£ code xong trong PR nÃ y: 6 migrations (clients, organizations, contacts, client_notes, tags + client_tag, FK client_accounts.client_id), ma tráº­n quyá»n clients.* theo DEC-009 (middleware permission táº¡i API), 17 endpoints (clients CRUD + lá»c status/tag/manager/q, contacts, notes, tags, portal-accounts), test: full suite 31 passed (12 test má»›i cho BE-004), Pint PASS, OpenAPI 21 paths. Kiá»ƒm chá»©ng Docker/MySQL tháº­t: nhá» OpenCode/Nguyen cháº¡y láº¡i migrate trÃªn stack local khi review (mÃ¡y Muse khÃ´ng cÃ³ Docker).
- Handoff: OpenCode review theo ma tráº­n G.3; Antigravity lÃ m mÃ n hÃ¬nh quáº£n lÃ½ Client (task FE riÃªng) sau khi há»£p Ä‘á»“ng chá»‘t, mock-first theo OpenAPI.

---

## FIX-002 â€” Token bá»‹ thu há»“i tráº£ 500 thay vÃ¬ 401 + thiáº¿u thÆ° má»¥c storage khi checkout sáº¡ch
- Assignee: Muse Â· Level: L2 Â· Status: DONE
- Branch: fix/FIX-002-auth-401-storage Â· PR: â€”
- Blocked by: â€”
- Acceptance Criteria: (1) Request API khÃ´ng gá»­i `Accept: application/json` (kiá»ƒu Playwright) vá»›i token Ä‘Ã£ thu há»“i pháº£i tráº£ 401 `UNAUTHENTICATED`, khÃ´ng pháº£i 500 â€” gá»‘c lá»—i: ApplicationBuilder máº·c Ä‘á»‹nh cá»§a Laravel 12 Ä‘Äƒng kÃ½ guest redirect gá»i `route('login')` (route khÃ´ng tá»“n táº¡i trong app API-only) ngay trong Authenticate middleware; sá»­a báº±ng `redirectGuestsTo` tráº£ null + `shouldRenderJsonWhen` cho `api/*`, KHÃ”NG thÃªm route login. CÃ³ test há»“i quy riÃªng. (2) Checkout sáº¡ch pháº£i cÃ³ `storage/framework/{views,cache,sessions,testing}` + `storage/logs` (thÃªm `.gitkeep`) Ä‘á»ƒ forgot/reset-password khÃ´ng cÃ²n 500 "valid cache path". (3) KÃ¨m DEC-010 (chuáº©n hoÃ¡ field reset-password = `password`, sá»­a AUTH_CONTRACT) vÃ  DEC-011 (chuyá»ƒn vai FE sang OpenCode) theo quyáº¿t Ä‘á»‹nh cá»§a Nguyen 2026-11-21.
- Progress: Muse sá»­a xong trong PR nÃ y â€” test há»“i quy má»›i PASS, full suite 32 passed, Pint PASS. Chá» OpenCode review; sau merge, QA cháº¡y láº¡i TC-AUTH-14/15 Ä‘á»ƒ xÃ¡c nháº­n finding 1 Ä‘Ã³ng.
- Handoff: OpenCode review theo ma tráº­n G.3 (PR Backend cá»§a Muse â†’ OpenCode).

---
- ÄÃ³ng task: DONE 2026-11-21 â€” TC-AUTH-14/15 cháº¡y láº¡i PASS; Ä‘Ã³ng cÃ¹ng release 0.2.0.

## FIX-003 â€” MinIO image khÃ´ng cÃ²n public (Docker Hub + Quay Ä‘á»u cháº·n) â€” Ä‘Æ°a MinIO ra khá»i stack máº·c Ä‘á»‹nh
- Assignee: Muse Â· Level: L2 Â· Status: IN_REVIEW
- Branch: fix/FIX-003-minio-optional Â· PR: #20
- Blocked by: â€”
- Acceptance Criteria: `docker compose up -d --build` trÃªn mÃ¡y sáº¡ch cháº¡y Ä‘Æ°á»£c mÃ  khÃ´ng cáº§n kÃ©o image MinIO: service minio chuyá»ƒn sau profile `storage` (báº­t thá»§ cÃ´ng báº±ng `--profile storage` khi cÃ³ quyá»n truy cáº­p image), `api` bá» `depends_on` vÃ o minio (chÆ°a tÃ­nh nÄƒng nÃ o dÃ¹ng S3 á»Ÿ giai Ä‘oáº¡n nÃ y). Khi module File (NhÃ³m 7) báº¯t Ä‘áº§u, chá»n láº¡i giáº£i phÃ¡p S3 self-host cÃ²n Ä‘Æ°á»£c phÃ¢n phá»‘i cÃ´ng khai vÃ  ghi quyáº¿t Ä‘á»‹nh má»›i.
- Progress: Muse sá»­a trong PR nÃ y sau khi Nguyen cháº¡y nghiá»‡m thu Má»‘c 1 bá»‹ cháº·n bá»Ÿi lá»—i 401 tá»« quay.io (Muse Ä‘Ã£ tá»± kiá»ƒm chá»©ng: Quay tráº£ 401 ngay cáº£ vá»›i token pull áº©n danh â€” MinIO Ä‘Ã£ rÃºt toÃ n bá»™ image cÃ´ng khai miá»…n phÃ­). Workaround trÆ°á»›c máº¯t cho mÃ¡y Ä‘ang cháº¡y: `docker compose up -d mysql redis mailpit` rá»“i `docker compose up -d --build --no-deps api web`.
- Handoff: OpenCode review theo ma tráº­n G.3.

---

## FE-005 â€” Ãp dá»¥ng hÆ°á»›ng thiáº¿t káº¿ DEC-013 vÃ o khung á»©ng dá»¥ng ná»™i bá»™
- Assignee: OpenCode Â· Level: L3 Â· Status: DONE
- Branch: â€” Â· PR: â€”
- Blocked by: PR #19 merge (DEC-013 chÃ­nh thá»©c cÃ³ hiá»‡u lá»±c trÃªn main)
- Acceptance Criteria: Khung á»©ng dá»¥ng ná»™i bá»™ theo máº«u A â€” Classic Sidebar (DEC-013) vá»›i design tokens thá»‘ng nháº¥t trÃªn shadcn/ui + Tailwind; tuÃ¢n thá»§ toÃ n bá»™ docs/UI_GUIDELINES.md (responsive nhiá»u bá» rá»™ng, khÃ´ng scroll ngang cho báº£ng dá»¯ liá»‡u lá»›n, tÆ°Æ¡ng pháº£n chá»¯, chip/badge má»™t dÃ²ng, min-height vÃ  empty state giá»¯ khung). Tá»± kiá»ƒm á»Ÿ Ã­t nháº¥t 3 bá» rá»™ng mÃ n hÃ¬nh vÃ  bÃ¡o cÃ¡o rÃµ; Nguyen nghiá»‡m thu UI báº±ng máº¯t. Máº«u D (Pipeline) cho CRM vÃ  hÆ¡i hÆ°á»›ng C cho Portal Ã¡p dá»¥ng á»Ÿ cÃ¡c task mÃ n hÃ¬nh tÆ°Æ¡ng á»©ng sau nÃ y, khÃ´ng thuá»™c task nÃ y.
- Progress: Implemented internal app shell (route group (app)/dashboard) with Classic Sidebar, design tokens in globals.css (shadcn-style CSS variables + Tailwind v4 theme), responsive AppShell (desktop sidebar + mobile drawer), Topbar, role chips (single line), stat cards with min-height, empty state. Self-check: tsc --noEmit PASS; pnpm build PASS (en/vi dashboard routes); vitest 24/24 PASS. Responsive classes reviewed for 3 representative widths (mobile 390px drawer, tablet 768px, desktop 1280px) - sidebar collapses to hamburger below md, content grid adapts sm:grid-cols-2 lg:grid-cols-4, no horizontal overflow at shell level. Browser screenshot not available in this environment; verified via build + class review.
- Handoff: OpenCode (vai Frontend, DEC-011); Muse review chÃ©o theo ma tráº­n (OpenCode khÃ´ng tá»± review code FE cá»§a mÃ¬nh).

---

## BE-005 â€” Module CRM/Lead (NhÃ³m 1) theo há»£p Ä‘á»“ng CRM_CONTRACT
- Assignee: Muse Â· Level: L3 Â· Status: DONE
- Branch: be/BE-005-crm-lead Â· PR: â€”
- Blocked by: PR #19 merge (há»£p Ä‘á»“ng CRM_CONTRACT + DEC-014 chÃ­nh thá»©c trÃªn main)
- Acceptance Criteria: Äá»§ endpoints vÃ  quy táº¯c trong docs/CRM_CONTRACT.md: leads CRUD + lá»c, pipeline-summary, convert Lead â†’ Client (táº¡o Client + Organization + Contact, ná»‘i láº¡i contacts, khoÃ¡ sá»­a lead, 409 khi convert láº¡i, 422 chá»‘ng trÃ¹ng kÃ¨m force), lead notes, lead activities + due list, contacts dÃ¹ng chung (lead_id), ma tráº­n quyá»n leads.* theo DEC-014, cÃ¡ch ly tenant. Test: bá»™ test Feature cho module Lead Ä‘áº¡t, Pint PASS, OpenAPI cáº­p nháº­t.
- Progress: Há»£p Ä‘á»“ng Ä‘Ã£ Ä‘Æ°á»£c Nguyen duyá»‡t vÃ  cÃ´ng bá»‘ trong PR #19 (DEC-014). Muse Ä‘Ã£ triá»ƒn khai xong trong PR nÃ y: 5 migration, leads CRUD + pipeline-summary + convert, notes, activities + due list, contacts dÃ¹ng chung; bá»™ test toÃ n cá»¥c 52 passed, Pint PASS, OpenAPI 32 paths.
- Handoff: OpenCode review theo ma tráº­n G.3.

## FIX-005 â€” Response táº¡o má»›i khÃ´ng pháº£n Ã¡nh giÃ¡ trá»‹ máº·c Ä‘á»‹nh cá»§a DB (status/author/is_active trá»‘ng)
- Assignee: Muse Â· Level: L1 Â· Status: IN_REVIEW
- Branch: fix/FIX-005-response-defaults Â· PR: â€”
- Blocked by: â€”
- Acceptance Criteria: CÃ¡c response POST (táº¡o client, client note, portal account â€” vÃ  rÃ  soÃ¡t toÃ n bá»™ module BE-003/BE-004) tráº£ vá» Ä‘Ãºng giÃ¡ trá»‹ thá»±c trong DB (status=active, author, locale, is_active) báº±ng cÃ¡ch náº¡p láº¡i model/quan há»‡ trÆ°á»›c khi tráº£ resource. PhÃ¡t hiá»‡n khi Nguyen nghiá»‡m thu Má»‘c 1 Luá»“ng C: dá»¯ liá»‡u DB Ä‘Ãºng, chá»‰ response hiá»ƒn thá»‹ trá»‘ng. KÃ¨m test há»“i quy cho Ã­t nháº¥t endpoint táº¡o client.
- Progress: Muse hoÃ n thÃ nh: refresh model sau khi táº¡o á»Ÿ ClientController, ClientPortalAccountController, ClientContactController, ClientNoteController; test há»“i quy CreateResponseDefaultsTest (4 test) â€” trÆ°á»›c fix fail 3/4, sau fix Ä‘áº¡t cáº£ bá»™ 52 test.
- Handoff: OpenCode review theo ma tráº­n G.3.
## FIX-004 â€” Web container thiáº¿u INTERNAL_API_URL â€” má»i login qua BFF Ä‘á»u "fetch failed" / 500
- Assignee: Muse Â· Level: L2 Â· Status: IN_REVIEW
- Branch: fix/FIX-004-web-internal-api-url Â· PR: #21
- Blocked by: â€”
- Acceptance Criteria: Trong Docker, Ä‘Äƒng nháº­p ná»™i bá»™ (Ä‘Ãºng vÃ  sai máº­t kháº©u) tráº£ Ä‘Ãºng káº¿t quáº£ cá»§a API (200 / 401 kÃ¨m mÃ£ lá»—i) thay vÃ¬ 500 "fetch failed": thÃªm `INTERNAL_API_URL: http://api:8000/api` vÃ o environment cá»§a service web trong docker-compose.yml. NguyÃªn nhÃ¢n: `getBackendApiUrl()` (FE-004) Æ°u tiÃªn INTERNAL_API_URL nhÆ°ng compose chÆ°a há» set biáº¿n nÃ y, nÃªn BFF rÆ¡i vá» NEXT_PUBLIC_API_URL/localhost â€” bÃªn trong container web, localhost lÃ  chÃ­nh container web, káº¿t ná»‘i bá»‹ tá»« chá»‘i trÆ°á»›c khi API ká»‹p kiá»ƒm tra máº­t kháº©u. PhÃ¡t hiá»‡n khi Nguyen nghiá»‡m thu Má»‘c 1 (A1/A2 Ä‘á»u 500 ká»ƒ cáº£ máº­t kháº©u Ä‘Ãºng). Ghi chÃº review: nháº­n xÃ©t cá»§a OpenCode á»Ÿ PR #14 cho ráº±ng INTERNAL_API_URL "Ä‘Ã£ set" lÃ  chÆ°a chÃ­nh xÃ¡c â€” biáº¿n nÃ y khÃ´ng tá»“n táº¡i á»Ÿ cáº£ compose láº«n code ngoÃ i hÃ m Ä‘á»c.
- Progress: Muse sá»­a trong PR nÃ y. PR Ä‘Æ°á»£c merge theo NGOáº I Lá»† L5 do Nguyen duyá»‡t ngÃ y 2026-11-21 (Ä‘á»ƒ gá»¡ cháº·n nghiá»‡m thu Má»‘c 1; OpenCode review bÃ¹ sau merge).
- Handoff: OpenCode review bÃ¹ theo ma tráº­n G.3.

---

## FIX-006 â€” Compose hardening: á»• Ä‘Ä©a máº·c Ä‘á»‹nh local + web chá» api khoáº» (tá»« review bÃ¹ FIX-003/FIX-004)
- Status: DONE
- Assignee: Muse Â· Reviewer: OpenCode
- MÃ´ táº£: Hai finding háº¡ táº§ng tá»« Ä‘á»£t review bÃ¹ cá»§a OpenCode: (1) compose máº·c Ä‘á»‹nh Ä‘á»ƒ `FILESYSTEM_DISK: s3` + env AWS trá» MinIO trong khi MinIO khÃ´ng cháº¡y á»Ÿ stack máº·c Ä‘á»‹nh (FIX-003) â€” báº¥t ká»³ luá»“ng ghi file nÃ o trong tÆ°Æ¡ng lai sáº½ lá»—i khÃ³ hiá»ƒu; Ä‘á»•i máº·c Ä‘á»‹nh sang `local`, S3 quay láº¡i cÃ¹ng quyáº¿t Ä‘á»‹nh storage á»Ÿ NhÃ³m 7. (2) `web depends_on: api` chÆ°a cÃ³ Ä‘iá»u kiá»‡n sáºµn sÃ ng (FIX-004) â€” thÃªm healthcheck cho api (Ä‘Ã¡nh `/api/v1/health` báº±ng php) vÃ  Ä‘á»ƒ web chá» `condition: service_healthy`.
- Acceptance Criteria: `docker compose up -d --build` cháº¡y nhÆ° cÅ© trÃªn mÃ¡y Nguyen; web chá»‰ start sau khi api tráº£ health 200; khÃ´ng Ä‘á»•i hÃ nh vi nÃ o khÃ¡c.
- Progress: 2026-11-21 â€” Muse triá»ƒn khai (docker-compose.yml) sau khi Nguyen merge xong 4 PR #24â€“#27; chá» OpenCode review.
- Blockers: KhÃ´ng cÃ³.

## FIX-007 â€” Dá»n file rÃ¡c Blade compiled view lá»t vÃ o main qua PR #29
- Status: DONE
- Assignee: Muse Â· Reviewer: Nguyen
- MÃ´ táº£: File sinh tá»± Ä‘á»™ng `apps/api/storage/framework/views/275c7c02e2528e6029079c885e2d2418.php` (Blade view Ä‘Ã£ biÃªn dá»‹ch) bá»‹ mÃ´i trÆ°á»ng cá»§a OpenCode commit nháº§m vÃ o branch FE-005 vÃ  Ä‘Ã£ vÃ o main khi PR #29 merge. XoÃ¡ khá»i repo; thÆ° má»¥c views chá»‰ giá»¯ `.gitkeep` nhÆ° thiáº¿t káº¿ (FIX-002). File nÃ y vÃ´ háº¡i khi cháº¡y (Laravel tá»± biÃªn dá»‹ch láº¡i) â€” Ä‘Ã¢y thuáº§n tuÃ½ lÃ  vá»‡ sinh repo theo Ä‘á» xuáº¥t cá»§a Muse, Ä‘Æ°á»£c Nguyen duyá»‡t sau merge.
- Acceptance Criteria: File khÃ´ng cÃ²n trÃªn main sau khi PR nÃ y merge; `storage/framework/views/` chá»‰ cÃ²n `.gitkeep`.
- Progress: 2026-11-21 â€” Muse Ä‘Ã£ xoÃ¡ trÃªn branch `fix/FIX-007-cleanup-compiled-view`; chá» Nguyen merge.
- Blockers: KhÃ´ng cÃ³.

## QA-003 â€” Bá»™ test CRM/Lead theo CRM_CONTRACT + cháº¡y tháº­t trÃªn BE-005
- Status: DONE
- Assignee: OpenCode Â· Reviewer: Muse
- MÃ´ táº£: Viáº¿t test case cho module CRM/Lead tá»« Acceptance Criteria cá»§a `docs/CRM_CONTRACT.md` (CRUD + filter, ma tráº­n quyá»n `leads.*`, chuyá»ƒn Ä‘á»•i Lead â†’ Client gá»“m guard 409/422, notes, activities + due list, pipeline summary, contacts dÃ¹ng chung, cÃ´ láº­p tenant) táº¡i `tests/e2e/crm-lead.spec.ts`, rá»“i cháº¡y tháº­t sau khi BE-005 merge.
- Káº¿t quáº£: Migrations BE-005 trÃªn MySQL 8 (Docker) Ä‘áº¡t; LeadModuleTest 16/16 PASS; Playwright 10 passed / 8 skipped â€” cÃ¡c skip do thiáº¿u dá»¯ liá»‡u seed (user Ä‘a vai trÃ², agency thá»© hai, lead Ä‘Ã£ convert sáºµn), ghi nháº­n thÃ nh backlog má»Ÿ rá»™ng seed, khÃ´ng pháº£i lá»—i. KÃ¨m verdict review bÃ¹ BE-005: PASS â†’ BE-005 chuyá»ƒn DONE.
- Progress: PR #30 Ä‘Ã£ merge (2026-11-21); Muse review chÃ©o Äáº T; Ä‘Ã³ng DONE trong release 0.3.0 theo ngoáº¡i lá»‡ F.2 (Muse bá»• sung má»¥c nÃ y vÃ¬ OpenCode chÆ°a tá»«ng táº¡o má»¥c QA-003 trong TASK.md).

## FE-006 â€” Sá»­a lá»—i double `/v1` trong getBackendApiUrl() (tá»« review bÃ¹ FIX-004)
- Status: DONE
- Assignee: OpenCode Â· Reviewer: Muse
- MÃ´ táº£: Fallback `NEXT_PUBLIC_API_URL` (Ä‘ang chá»©a `/v1`) bá»‹ ná»‘i thÃªm `/v1` khi gá»i API khiáº¿n dev FE ngoÃ i Docker sai path. Chuáº©n hoÃ¡ báº±ng `normalizeBackendBaseUrl()` (bá» slash cuá»‘i + bá» Ä‘Ãºng má»™t Ä‘oáº¡n `/v1` cuá»‘i), giá»¯ thá»© tá»± Æ°u tiÃªn INTERNAL_API_URL > NEXT_PUBLIC_API_URL > localhost; kÃ¨m 3 test há»“i quy.
- Progress: PR #31 Ä‘Ã£ merge (2026-11-21); suite web 27/27 PASS, typecheck PASS; Muse review chÃ©o Äáº T; Ä‘Ã³ng DONE trong release 0.3.0 theo ngoáº¡i lá»‡ F.2 (Muse bá»• sung má»¥c nÃ y vÃ¬ OpenCode chÆ°a tá»«ng táº¡o má»¥c FE-006 trong TASK.md).

## BE-006 â€” Module Project Management (NhÃ³m 3) theo há»£p Ä‘á»“ng PROJECT_CONTRACT
- Assignee: Muse Â· Level: L3 Â· Status: DONE
- Branch: be/BE-006-project-management Â· PR: (PR triá»ƒn khai BE-006)
- Blocked by: â€”
- Acceptance Criteria: Äá»§ endpoints vÃ  quy táº¯c trong docs/PROJECT_CONTRACT.md: projects CRUD + lá»c, project members, milestones, tasks CRUD + lá»c + due list, task comments, checklist items, progress % tÃ­nh lÃºc Ä‘á»c, timeline dáº¡ng list, endpoint Portal chá»‰-Ä‘á»c, ma tráº­n quyá»n projects.*/tasks.* theo DEC-016, cÃ¡ch ly tenant. Test: bá»™ test Feature cho module Project Ä‘áº¡t, Pint PASS, OpenAPI cáº­p nháº­t.
- Progress: Há»£p Ä‘á»“ng Ä‘Ã£ Ä‘Æ°á»£c Nguyen duyá»‡t theo Ä‘á» xuáº¥t ngÃ y 2026-11-22 vÃ  cÃ´ng bá»‘ trong PR #35 (DEC-016, Ä‘Ã£ merge). Muse Ä‘Ã£ triá»ƒn khai xong trong PR nÃ y: 6 migration (projects, project_members, milestones, tasks, task_comments, task_checklist_items), projects/milestones/tasks CRUD + bá»™ lá»c, members, timeline dáº¡ng list, progress % tÃ­nh lÃºc Ä‘á»c, task comments + checklist, endpoint Portal chá»‰-Ä‘á»c, ma tráº­n quyá»n projects.*/tasks.* theo DEC-016 kÃ¨m scope Team Member (chá»‰ tháº¥y project tham gia, chá»‰ sá»­a task Ä‘Æ°á»£c gÃ¡n); bá»™ test toÃ n cá»¥c 72 passed, Pint PASS, OpenAPI 48 paths.
- Handoff: OpenCode review theo ma tráº­n G.3 sau khi Muse má»Ÿ PR triá»ƒn khai. Task FE/QA cho NhÃ³m 3: â¸ chá» BE-006 merge.

---
- ÄÃ³ng task: DONE 2026-11-22 â€” QA-004 cháº¡y tháº­t PASS: `tests/e2e/project.spec.ts` (29 ca) trÃªn Docker/MySQL 8 + seed demo. Minimal seed: 17 PASS / 12 SKIP (thiáº¿u dá»¯ liá»‡u seed Ä‘a vai trÃ²/agency thá»© hai â€” ghi nháº­n backlog seed, khÃ´ng pháº£i lá»—i sáº£n pháº©m). Báº­t seed QA Ä‘áº§y Ä‘á»§ 7 vai: 29 PASS / 0 SKIP trong cÃ¡c lÃ´ an toÃ n rate-limit. Verdict review bÃ¹ BE-006: PASS â†’ BE-006 chuyá»ƒn DONE theo tháº©m quyá»n QA.

- Assignee: OpenCode · Level: L3 · Status: DONE
- Branch: fe/FE-008-project-management Â· PR: (má»Ÿ PR vÃ o main)
- Blocked by: BE-006 (Ä‘Ã£ merge)
- Acceptance Criteria: Báº­t má»¥c Projects trÃªn sidebar; mÃ n hÃ¬nh danh sÃ¡ch Projects vá»›i bá»™ lá»c client/tráº¡ng thÃ¡i/ngÆ°á»i phá»¥ trÃ¡ch/tÃ¬m kiáº¿m, hiá»ƒn thá»‹ client, tráº¡ng thÃ¡i, % tiáº¿n Ä‘á»™ kÃ¨m sá»‘ task done/tá»•ng; empty state; mÃ n hÃ¬nh chi tiáº¿t Project vá»›i tá»•ng quan, thanh tiáº¿n Ä‘á»™, Milestones kÃ¨m %, Members thÃªm/gá»¡, Tasks lá»c theo tráº¡ng thÃ¡i/Æ°u tiÃªn/ngÆ°á»i gÃ¡n/milestone; chi tiáº¿t Task vá»›i mÃ´ táº£/tráº¡ng thÃ¡i/Æ°u tiÃªn/háº¡n/ngÆ°á»i gÃ¡n, checklist thÃªm/tick/xÃ³a, comments thÃªm/xÃ³a theo quyá»n; BFF route proxy tá»›i /projects,/tasks; i18n namespace Projects EN/VI; quyá»n hiá»ƒn thá»‹ theo DEC-016.
- Progress: OpenCode hoÃ n thÃ nh 2026-11-22: báº­t nav Projects, trang danh sÃ¡ch + chi tiáº¿t dá»± Ã¡n + chi tiáº¿t cÃ´ng viá»‡c, BFF proxy routes, i18n Projects (U+FFFD vi.json = 0). Tá»± kiá»ƒm: pnpm typecheck PASS, pnpm build PASS (en/vi), pnpm test PASS (27). Responsive rÃ  soÃ¡t class cho 3 bá» rá»™ng (mobile 390, tablet 768, desktop 1280): sidebar drawer, grid sm:2 lg:3, form grid sm:2, filter wrap; chip/badge whitespace-nowrap; min-height vÃ¹ng ná»™i dung + empty state.
- Handoff: Chá» Muse review chÃ©o (DEC-011); khÃ´ng tá»± merge.

---

## QA-004 â€” Bá»™ test Project Management theo PROJECT_CONTRACT + cháº¡y tháº­t trÃªn BE-006
- Status: DONE
- Assignee: OpenCode Â· Reviewer: Muse
- MÃ´ táº£: Viáº¿t test case cho module Project Management tá»« Acceptance Criteria cá»§a `docs/PROJECT_CONTRACT.md` (CRUD project/milestone/task + bá»™ lá»c, ma tráº­n quyá»n 7 vai, cÃ´ láº­p tenant 404/422, progress %, timeline ordering, soft delete cascade, completed_at, endpoint Portal chá»‰-Ä‘á»c, token app/portal khÃ´ng dÃ¹ng chÃ©o) táº¡i `tests/e2e/project.spec.ts`, rá»“i cháº¡y tháº­t sau khi BE-006 merge; bá»• sung `tests/e2e/project-ui.spec.ts` cho UI FE-008.
- Káº¿t quáº£: Migrations BE-006 trÃªn MySQL 8 (Docker) Ä‘áº¡t; Playwright API 29 ca â€” minimal demo seed 17 PASS / 12 SKIP (thiáº¿u dá»¯ liá»‡u seed Ä‘a vai trÃ²/agency thá»© hai, ghi nháº­n backlog seed, khÃ´ng pháº£i lá»—i); seed QA Ä‘áº§y Ä‘á»§ 29 PASS / 0 SKIP trong cÃ¡c lÃ´ an toÃ n rate-limit. UI FE-008: `tests/e2e/project-ui.spec.ts` 5/5 PASS trÃªn stack Docker (owner@demo.test). KÃ¨m verdict review bÃ¹ BE-006: PASS â†’ BE-006 chuyá»ƒn DONE.
- Progress: PR má»Ÿ vÃ o main chá» Muse review; CHANGELOG [Unreleased] QA & Fixes cáº­p nháº­t.

---

## Inbox
*Má»i agent Ä‘Æ°á»£c thÃªm má»¥c má»›i á»Ÿ Ä‘Ã¢y, khÃ´ng sá»­a má»¥c cá»§a ngÆ°á»i khÃ¡c. (Hiá»‡n chÆ°a cÃ³ má»¥c nÃ o.)*

- [QA-001 Â· 2026-11-20] `docs/CONVENTIONS.md:252` â€” dÃ²ng cuá»‘i "chá»‘t stack backend + scope MVP â€” váº«n Ä‘ang chá», chÆ°a báº¯t Ä‘áº§u code" Ä‘Ã£ lá»—i thá»i sau DEC-001/DEC-004 vÃ  cÃ¡c PR #1â€“#4. Äá» xuáº¥t Nguyen/Muse sá»­a hoáº·c xoÃ¡ dÃ²ng nÃ y qua PR `docs/` theo DEC-002; QA khÃ´ng tá»± sá»­a quy Æ°á»›c.
- [QA-001 Â· 2026-11-20] `docs/AUTH_CONTRACT.md:37-43,81-85` â€” DEC-008.3 chá»‘t "Portal cÃ³ quÃªn máº­t kháº©u, dÃ¹ng chung cÆ¡ cháº¿ email" nhÆ°ng báº£ng endpoint Portal thiáº¿u `POST /portal/auth/forgot-password` vÃ  `POST /portal/auth/reset-password`. Äá» xuáº¥t Muse + Nguyen chá»‘t method/path/request/response + mÃ£ lá»—i trÆ°á»›c khi QA cháº¡y test tháº­t QA-002.
- [QA-002 Â· 2026-11-20] `apps/api/bootstrap/app.php` / `auth:sanctum`: sau logout hoáº·c Ä‘á»•i máº­t kháº©u, token bá»‹ xoÃ¡ khiáº¿n `GET /api/v1/auth/me` tráº£ **500** (`Route [login] not defined`) thay vÃ¬ 401 `UNAUTHENTICATED`. Cáº§n cáº¥u hÃ¬nh `redirectTo` tráº£ null cho API hoáº·c xá»­ lÃ½ unauthenticated JSON trong Authenticate middleware. áº¢nh hÆ°á»Ÿng TC-AUTH-14, 15 (FAIL).
- [QA-002 Â· 2026-11-20] `apps/api` setup: thiáº¿u `storage/framework/views` trÃªn checkout sáº¡ch khiáº¿n forgot-password/reset-password (gá»­i mail markdown) tráº£ 500 "Please provide a valid cache path"; cáº§n táº¡o thÆ° má»¥c hoáº·c cháº¡y `php artisan view:cache` trong entrypoint Docker.
- [QA-002 Â· 2026-11-20] `docs/AUTH_CONTRACT.md` vs `apps/api`: contract ná»™i bá»™ ghi reset password dÃ¹ng `new_password`, nhÆ°ng implementation/tests dÃ¹ng `password` (Portal cÅ©ng dÃ¹ng `password`). Cáº§n Muse + Nguyen thá»‘ng nháº¥t tÃªn field.
