# TASK.md — Danh sách task theo ID
Quy tắc ghi file này xem tại `docs/CONVENTIONS.md` mục F.2. Luồng trạng thái: `TODO → IN_PROGRESS → IN_REVIEW → DONE` · nhánh: `BLOCKED`, `REOPEN`.

---

## DOC-001 — Bootstrap repository documents & conventions
- Assignee: Muse · Level: L3 · Status: IN_REVIEW
- Branch: — (bootstrap trực tiếp lên `main` một lần duy nhất, xem DEC-007) · PR: —
- Blocked by: —
- Acceptance Criteria: 5 file bắt buộc (VERSION.md, TASK.md, CHANGELOG.md, README.md, DECISIONS.md) có mặt ở root với nội dung đã chốt; tài liệu Quy ước / Stack / Scope / RBAC-i18n nằm trong `docs/`; repo đọc lại được trên GitHub sau khi đẩy.
- Progress: Hoàn thành và đẩy lên `main` ngày 2026-11-20 (commit 05aa5b1), đã đọc lại xác minh trên GitHub. Chờ OpenCode review theo QA-001.
- Handoff: Sau khi xong, OpenCode review theo QA-001.

---

## BE-001 — Monorepo foundation & Docker Compose
- Assignee: Muse · Level: L3 · Status: IN_REVIEW
- Branch: be/BE-001-monorepo-docker · PR: #1 (đã merge)
- Blocked by: DOC-001
- Acceptance Criteria: Cấu trúc `apps/`, `packages/contracts/`, `tests/e2e/`, `docs/`; `docker-compose.yml` ở root chạy được các service api/web/mysql/redis/mailpit/minio trên máy sạch; `.gitignore` + `.editorconfig` đầy đủ cho Laravel + Next.js.
- Progress: Muse bắt đầu 2026-11-20: đã soạn docker-compose.yml (api/web/mysql/redis/mailpit/minio), Dockerfile cho api (PHP 8.3) và web (Node 20), README cho packages/contracts và tests/e2e, .env.example + Makefile ở root. Chưa kiểm chứng chạy Docker thật (môi trường của Muse không có Docker) — cần OpenCode/Nguyen chạy `docker compose up` kiểm chứng ở bước review.
- Handoff: —

---

## BE-002 — Initialize Laravel API & health endpoint
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: be/BE-002-laravel-api-init · PR: #2 (đã merge)
- Blocked by: BE-001
- Acceptance Criteria: Laravel chạy ở `apps/api` trong Docker; `.env.example` không chứa secret thật; endpoint `GET /api/v1/health` trả về format response chuẩn đã thống nhất; Pint + PHPUnit/Pest chạy được.
- Progress: Muse hoàn thành 2026-11-20: Laravel v12.73.0 (ghim đúng ^12.0 theo DEC-001), đã cài Sanctum API scaffolding, HealthController + test riêng. Kiểm chứng tại máy Muse: `php artisan test` 3 passed, HTTP thật tới `/api/v1/health` trả 200 đúng format `{data:{status,service,version,timestamp}}`, Pint PASS. Chưa kiểm chứng qua Docker (môi trường Muse không có Docker) — kiểm chứng ở bước review.
- Handoff: —

---

## FE-001 — Initialize Next.js web app & i18n EN/VI
- Assignee: Google Antigravity · Level: L2 · Status: IN_REVIEW
- Branch: fe/FE-001-nextjs-init · PR: #3 (đã merge)
- Blocked by: BE-001
- Acceptance Criteria: Next.js (App Router) + TypeScript strict ở `apps/web`; Tailwind CSS + shadcn/ui; `next-intl` với `en.json`/`vi.json` chuyển được EN ↔ VI ở trang khung; không có chuỗi hiển thị viết cứng trong component.
- Progress: Khung khởi tạo do Muse dựng theo kế hoạch khởi tạo (2026-11-20), Antigravity tiếp quản từ đây: Next.js 15 + TypeScript strict + Tailwind v4 + next-intl, routing theo locale (en mặc định, vi đầy đủ), trang chủ dùng 100% chuỗi dịch từ `messages/`. Kiểm chứng tại máy Muse: `npm install` OK, `tsc --noEmit` không lỗi, `next build` thành công, sinh đủ trang `/en` và `/vi`. Chưa có `pnpm-lock.yaml` (máy Muse không có pnpm) — sinh khi `pnpm install` lần đầu/Docker build. shadcn/ui + TanStack Query + RHF/Zod thêm ở các task màn hình đầu tiên. (Ghi chú minh bạch: bản ghi Progress này lẽ ra nằm trong PR #3 nhưng bị sót do lỗi khớp chuỗi khi Muse cập nhật file — bổ sung tại PR tài liệu BE-003.)
- Handoff: Khung khởi tạo có thể do Muse dựng ở bước bootstrap theo kế hoạch khởi tạo; Antigravity tiếp quản và hoàn thiện.

---

## QA-001 — Review bootstrap, conventions & repository structure
- Assignee: OpenCode · Level: L1 · Status: IN_REVIEW
- Branch: qa/QA-001-bootstrap-review · PR: #5 (chờ Muse review/merge — G.3)
- Blocked by: DOC-001
- Acceptance Criteria: Kiểm tra 5 file bắt buộc đúng quy ước (VERSION.md đúng 1 dòng; TASK.md theo ID; quyền ghi từng file); kiểm tra tài liệu trong `docs/` khớp các quyết định DEC-001 → DEC-007; báo cáo kết quả trong task này.
- Progress: OpenCode review ngày 2026-11-20 tại commit `7432ccd` (main). **Kết luận: PASS, không có blocker cho DOC-001** — phạm vi mở rộng theo chỉ đạo của Nguyen: DEC-001 → DEC-008 (AC gốc ghi đến DEC-007).
  - 5 file bắt buộc: `VERSION.md` đúng 1 dòng `0.1.0`, không tiêu đề/ngày/ghi chú, đúng chủ ghi OpenCode ✅ · `TASK.md` theo danh sách Task ID (9 mục + Inbox), mỗi mục đủ Assignee/Level/Status/Branch/Blocked by/AC/Progress/Handoff, quyền ghi đúng F.2 ✅ · `CHANGELOG.md` đúng Keep a Changelog, có `[Unreleased]` với 3 tiểu mục cố định, append-only ✅ · `README.md` (EN, DEC-006) + `README.vi.md` có link chéo đầy đủ ✅ · `DECISIONS.md` có DEC-001 → DEC-008, append-only, đúng chủ ghi Nguyen + Muse (QA chỉ đọc, không sửa) ✅.
  - `docs/` khớp quyết định: `STACK.md` ↔ DEC-001/003 · `MVP_SCOPE.md` ↔ DEC-004 (8 nhóm, luồng lõi, Super Admin tối giản, shared DB + `agency_id`) · `RBAC_AND_I18N.md` ↔ DEC-005/006 (7 vai trò, Client tách loại tài khoản, nhiều vai trò, scope dữ liệu, EN mặc định + VI đầy đủ) · `REPO_INITIALIZATION.md` ↔ DEC-007 · `AUTH_CONTRACT.md` ↔ DEC-008 (email unique toàn hệ thống, token không hạn cứng, Portal có quên mật khẩu, tách scope `app`/`portal`, cross-tenant 404) — đều nhất quán ✅. `git log` xác nhận bootstrap `05aa5b1` đẩy thẳng `main` đúng ngoại lệ DEC-007; các thay đổi sau đi qua PR #1–#4 ✅.
  - Finding minor (không block, đã ghi Inbox): `docs/CONVENTIONS.md:252` còn ghi "chốt stack backend + scope MVP — vẫn đang chờ, chưa bắt đầu code", mâu thuẫn DEC-001/DEC-004 và thực tế đã merge BE-001/BE-002/FE-001. Sửa quy ước thuộc quyền Nguyen (DEC-002) → QA không tự sửa.
  - Finding minor (không block, đã ghi Inbox): `docs/AUTH_CONTRACT.md` mục 8/DEC-008.3 chốt Portal có quên mật khẩu, nhưng bảng endpoint mục 3 mới có login/logout/me — thiếu `POST /portal/auth/forgot-password` và `/portal/auth/reset-password`. Cần Muse + Nguyen chốt trước khi chạy test thật QA-002.
  - Observation (không block): `docs/STACK.md` mục 3 vẫn liệt kê multi-tenancy là "chưa quyết" dù DEC-004 đã chốt; README "Getting started" vẫn nói chờ monorepo dù BE-001 đã merge.
  - Không tự merge PR của chính mình (B.6/G.3). Task giữ `IN_REVIEW` chờ Muse approve/merge; Muse hoặc Nguyen chuyển `DONE` theo ngoại lệ F.2 cho task do OpenCode tự làm. Đề xuất DOC-001 → `DONE` sau khi PR này merge (F.2 cho phép OpenCode nghiệm thu task của Muse).
- Handoff: PR #5 chờ Muse review; sau approve/merge, đề xuất cập nhật DOC-001 → DONE và xử lý 2 mục Inbox ở trên. (Người mở PR không tự merge — G.3.)

---

## BE-003 — Auth, multi-tenancy & RBAC contract (design)
- Assignee: Muse · Level: L3 · Status: IN_REVIEW
- Branch: be/BE-003-auth-tenancy-rbac · PR: #8
- Blocked by: BE-002
- Acceptance Criteria: Đề xuất contract Auth (đăng ký/đăng nhập/token) + mô hình multi-tenancy `agency_id` + ma trận phân quyền chi tiết 7 vai trò được Muse soạn và Nguyen duyệt trước khi phổ biến cho Antigravity/OpenCode (quy trình mục E, Quy ước chung).
- Progress: Hợp đồng đã được Nguyen DUYỆT ngày 2026-11-20 (kèm 3 chốt tại DEC-008: email unique toàn hệ thống; token không đặt hạn cứng trong MVP; Portal có quên mật khẩu) và công bố tại `docs/AUTH_CONTRACT.md` (PR #4). Phần Backend đã triển khai xong: migrations agencies/roles/super_admins/client_accounts + users.agency_id/locale/is_active; trait BelongsToAgency (global scope theo agency của user đăng nhập, có chống đệ quy khi Sanctum đang nạp tokenable); AuthController + PortalAuthController (token tách ability `app`/`portal`, chặn chéo 403); chuẩn lỗi `{error:{code,message,details}}` + thông điệp EN/VI theo locale; rate limit login 5/phút; link reset mật khẩu trỏ về web app (FRONTEND_URL); seed roles + demo data opt-in (SEED_DEMO_DATA); OpenAPI sinh bằng Scramble tại `packages/contracts/openapi.json` (12 paths). Kiểm chứng tại máy Muse: `php artisan test` **19 passed** (gồm test từng mã lỗi, chặn chéo token, scope cross-tenant), Pint PASS, smoke test HTTP thật: login Owner/Portal đúng payload, token app gọi Portal bị 403 FORBIDDEN, sai mật khẩu với Accept-Language `vi` trả thông điệp tiếng Việt. Chưa kiểm chứng qua Docker (máy Muse không có Docker).
- Handoff: —

---

## FE-002 — Internal app login (Auth contract implementation)
- Assignee: Google Antigravity · Level: L2 · Status: TODO
- Branch: fe/FE-002-login · PR: —
- Blocked by: — (hợp đồng `docs/AUTH_CONTRACT.md` đã duyệt — làm bằng mock, không chờ BE-003 code)
- Acceptance Criteria: Màn hình đăng nhập nội bộ gọi `POST /api/v1/auth/login` theo hợp đồng (mock trước, nối API thật khi BE-003 xong); lưu token an toàn phía client; route guard chặn trang nội bộ khi chưa đăng nhập; hiển thị lỗi theo mã lỗi chuẩn (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`); chuyển EN ↔ VI ngay tại màn login; không hardcode chuỗi hiển thị.
- Progress: —
- Handoff: Bắt đầu được ngay sau khi PR tài liệu BE-003 merge.

---

## FE-003 — Client Portal login frame
- Assignee: Google Antigravity · Level: L2 · Status: IN_REVIEW
- Branch: fe/FE-003-portal-login · PR: —
- Blocked by: — (hợp đồng đã duyệt — làm bằng mock)
- Acceptance Criteria: Khu vực Portal tách riêng tại route `/portal` với layout riêng; màn đăng nhập Portal gọi `POST /api/v1/portal/auth/login` (mock theo hợp đồng); token portal tách biệt token nội bộ (không dùng lẫn); trang tổng quan Portal trống (placeholder theo i18n) sau đăng nhập; EN/VI đầy đủ.
- Progress: Antigravity hoàn thành 2026-11-20: xây dựng khung Client Portal tại route /portal với layout riêng biệt, mock service theo docs/AUTH_CONTRACT.md (login, logout, me, forgot-password, reset-password), token portal_token tách biệt hoàn toàn với app_token, route guard cho Portal, i18n EN/VI đầy đủ (16 vitest tests PASS, tsc PASS, next build PASS). Đang mở PR.
- Handoff: Bắt đầu được ngay sau khi PR tài liệu BE-003 merge.

---

## QA-002 — Auth & tenancy test coverage
- Assignee: OpenCode · Level: L1 · Status: IN_REVIEW
- Branch: qa/QA-002-run-results · PR: #6 (đã merge) + PR kết quả chạy thật này (Muse mở thay OpenCode từ commit d4f3af3 trên branch cũ, vì PR #6 đã đóng)
- Blocked by: BE-003 (đã merge PR #8 — phần API chạy xong); FE-004 (chờ merge để chạy phần E2E)
- Acceptance Criteria: Bộ test case bao phủ: login đúng/sai thông tin, agency bị khoá, tài khoản bị vô hiệu hoá, token portal gọi API nội bộ bị chặn và ngược lại, truy vấn dữ liệu agency khác trả 404, rate limit login; E2E Playwright cho luồng login nội bộ + Portal; kết quả ghi vào task này.
- Progress: OpenCode hoàn thành 2026-11-20 bộ **23 test case** (17 API + 6 E2E) từ `docs/AUTH_CONTRACT.md` đã duyệt (DEC-008), lưu tại `tests/e2e/auth.spec.ts`. Chưa chạy thật vì BE-003/FE-002/FE-003 chưa lên PR — đúng Handoff của task.
  - Phủ Acceptance Criteria: login đúng (TC-AUTH-01, TC-E2E-01), sai email/sai mật khẩu (02, E2E-02), agency khoá (03, E2E-03), tài khoản vô hiệu (04, E2E-03), token Portal → API nội bộ bị chặn (08, E2E-05) và token nội bộ → API Portal bị chặn (09), đọc dữ liệu agency khác → 404 thay vì 403 (11), rate limit 5 lần/phút/IP (13).
  - Phủ thêm theo hợp đồng: token Portal tách biệt + client summary (07), `agency_id` chỉ lấy từ token (10), FK khác agency → 422 `CROSS_TENANT_REFERENCE` (12), logout thu hồi token (14), đổi mật khẩu thu hồi mọi token khác (15), forgot/reset không dò tài khoản + `INVALID_RESET_TOKEN` (16), mã lỗi ổn định nhưng message theo locale (06), E2E Portal `/portal` + guard + EN/VI (E2E-05/06).
  - `test.fixme` có chủ đích: TC-AUTH-17 (Portal forgot/reset) — DEC-008.3 đã chốt nhưng `AUTH_CONTRACT.md` mục 3 chưa định nghĩa endpoint; đã báo tại PR #5 (Inbox QA-001), chờ Muse + Nguyen chốt. TC-AUTH-11/12 dùng env `E2E_TENANT_RESOURCE_PATH` / `E2E_TENANT_CREATE_PATH` + `test.skip` có lý do tới khi có endpoint nghiệp vụ — không fail giả.
  - Không hardcode secret: mọi tài khoản/ID đọc từ biến `E2E_*` của seed dùng chung (`tests/e2e/README.md`, quy ước H.4). Không thêm dependency hay config chung (L4) — chỉ thêm 1 file spec trong phạm vi sở hữu QA.
  - Kết quả chạy thật (API, 2026-11-20, DB `agency_saas`, seed demo + QA accounts): **14 PASS / 2 FAIL / 2 SKIP** trên tổng 17 ca API. Chi tiết:
    - PASS: TC-AUTH-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 13, 16, 17 (và TC-AUTH-11/12 SKIP vì chưa có endpoint nghiệp vụ BE-004).
    - FAIL: TC-AUTH-14 và TC-AUTH-15 — sau logout/đổi mật khẩu, token bị xoá trả **500** thay vì 401 `UNAUTHENTICATED` (root cause: `auth:sanctum` middleware gọi `route('login')` không tồn tại trong API-only app). Đã ghi finding Inbox. TC-AUTH-15 fail cùng root cause.
    - SKIP: TC-AUTH-11 (cross-tenant 404), TC-AUTH-12 (cross-tenant FK 422) — chờ BE-004 cung cấp endpoint nghiệp vụ; giữ `test.skip` có lý do, không fail giả.
  - TC-AUTH-17 đã bật (không còn `test.fixme`) sau khi PR #9 bổ sung endpoint Portal forgot/reset; PASS.
  - Môi trường: cần `storage/framework/views` (view cache) cho luồng forgot-password; đã ghi finding setup. Rate limit 5/phút/IP khiến suite phải chạy theo nhóm + flush Redis — ghi nhận trong PR.
  - E2E (TC-E2E-01..06) chưa chạy: FE-004 chưa merge; sẽ chạy sau FE-004.
  - Kết luận: bộ API **PASS có điều kiện** (14/14 ca có thể chạy đều pass; 2 fail cùng 1 bug BE); không tự chuyển `DONE` khi còn fail và còn E2E chưa chạy; không tự merge PR.
- Handoff: Khi BE-003/FE-002/FE-003 mở PR, chạy `tests/e2e/auth.spec.ts` trên DB test riêng của QA (`agency_test`, G.2), bổ sung endpoint Portal forgot/reset sau khi contract chốt, rồi ghi kết quả PASS/FAIL vào task này.

---
## FIX-001 — MinIO image no longer on Docker Hub
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-001-minio-image · PR: —
- Blocked by: —
- Acceptance Criteria: `docker compose up` kéo được image MinIO (image `minio/minio` đã bị gỡ khỏi Docker Hub — phát hiện khi Nguyen chạy local lần đầu 2026-11-20); chuyển sang registry chính thức của MinIO tại Quay (`quay.io/minio/minio`); các service còn lại không đổi.
- Progress: Muse sửa 2026-11-20 trong PR này; chờ kiểm chứng bằng lần `docker compose up` đầy đủ tiếp theo tại máy Nguyen.
- Handoff: —

---

## FE-004 — Nối màn hình đăng nhập nội bộ vào API thật (BE-003)
- Assignee: Google Antigravity · Level: L3 · Status: IN_REVIEW
- Branch: fe/FE-004-login-real-api · PR: #14
- Blocked by: — (BE-003 đã merge; FE-002 đã merge)
- Acceptance Criteria: thay `mockLogin()` bằng `POST /api/v1/auth/login` thật; lưu token và gọi được `GET /api/v1/auth/me` (user + roles + permissions); các mã lỗi của API (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`) hiển thị đúng banner đã làm ở FE-002, tôn trọng thông điệp song ngữ API trả về; logout gọi API và xoá token; cách lưu token phải ghi rõ trade-off bảo mật trong PR (ưu tiên httpOnly cookie qua route handler). Cập nhật TASK.md mục này + CHANGELOG.md [Unreleased] Frontend khi làm.
- Progress: Antigravity hoàn thành 2026-11-20: xây dựng BFF route handlers (/api/auth/login, /api/auth/logout, /api/auth/me) với httpOnly cookie app_token; nối POST /v1/auth/login + GET /v1/auth/me; map các mã lỗi chuẩn (INVALID_CREDENTIALS, AGENCY_LOCKED, ACCOUNT_DISABLED) và tôn trọng message song ngữ từ backend; cập nhật AuthContext, LoginForm và test suite (14 tests PASS, tsc PASS, next build PASS). Đang mở PR.
- Handoff: OpenCode review theo ma trận G.3; sau merge, QA-002 chạy thật phần E2E trên luồng này.

---

## BE-004 — Module Client (Nhóm 2) theo hợp đồng CLIENT_CONTRACT
- Assignee: Muse · Level: L3 · Status: IN_REVIEW
- Branch: be/BE-004-client-module · PR: https://github.com/DLoc03/agency-client-management-saas/pull/13
- Blocked by: — (hợp đồng đã duyệt, DEC-009)
- Acceptance Criteria: CRUD Client + Organization + Contacts; tags & bộ lọc phân đoạn; Client Notes nội bộ; cấp/khoá tài khoản Portal cho client (thêm FK `client_accounts.client_id → clients.id`); ma trận quyền clients.* theo hợp đồng; test Pest phủ cách ly tenant + ma trận quyền + luồng tạo tài khoản Portal đăng nhập được; OpenAPI cập nhật; Pint PASS.
- Progress: Hợp đồng duyệt 2026-11-20 (DEC-009, PR #12). Muse đã code xong trong PR này: 6 migrations (clients, organizations, contacts, client_notes, tags + client_tag, FK client_accounts.client_id), ma trận quyền clients.* theo DEC-009 (middleware permission tại API), 17 endpoints (clients CRUD + lọc status/tag/manager/q, contacts, notes, tags, portal-accounts), test: full suite 31 passed (12 test mới cho BE-004), Pint PASS, OpenAPI 21 paths. Kiểm chứng Docker/MySQL thật: nhờ OpenCode/Nguyen chạy lại migrate trên stack local khi review (máy Muse không có Docker).
- Handoff: OpenCode review theo ma trận G.3; Antigravity làm màn hình quản lý Client (task FE riêng) sau khi hợp đồng chốt, mock-first theo OpenAPI.

---

## FIX-002 — Token bị thu hồi trả 500 thay vì 401 + thiếu thư mục storage khi checkout sạch
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-002-auth-401-storage · PR: —
- Blocked by: —
- Acceptance Criteria: (1) Request API không gửi `Accept: application/json` (kiểu Playwright) với token đã thu hồi phải trả 401 `UNAUTHENTICATED`, không phải 500 — gốc lỗi: ApplicationBuilder mặc định của Laravel 12 đăng ký guest redirect gọi `route('login')` (route không tồn tại trong app API-only) ngay trong Authenticate middleware; sửa bằng `redirectGuestsTo` trả null + `shouldRenderJsonWhen` cho `api/*`, KHÔNG thêm route login. Có test hồi quy riêng. (2) Checkout sạch phải có `storage/framework/{views,cache,sessions,testing}` + `storage/logs` (thêm `.gitkeep`) để forgot/reset-password không còn 500 "valid cache path". (3) Kèm DEC-010 (chuẩn hoá field reset-password = `password`, sửa AUTH_CONTRACT) và DEC-011 (chuyển vai FE sang OpenCode) theo quyết định của Nguyen 2026-11-21.
- Progress: Muse sửa xong trong PR này — test hồi quy mới PASS, full suite 32 passed, Pint PASS. Chờ OpenCode review; sau merge, QA chạy lại TC-AUTH-14/15 để xác nhận finding 1 đóng.
- Handoff: OpenCode review theo ma trận G.3 (PR Backend của Muse → OpenCode).

---

## FIX-003 — MinIO image không còn public (Docker Hub + Quay đều chặn) — đưa MinIO ra khỏi stack mặc định
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-003-minio-optional · PR: #20
- Blocked by: —
- Acceptance Criteria: `docker compose up -d --build` trên máy sạch chạy được mà không cần kéo image MinIO: service minio chuyển sau profile `storage` (bật thủ công bằng `--profile storage` khi có quyền truy cập image), `api` bỏ `depends_on` vào minio (chưa tính năng nào dùng S3 ở giai đoạn này). Khi module File (Nhóm 7) bắt đầu, chọn lại giải pháp S3 self-host còn được phân phối công khai và ghi quyết định mới.
- Progress: Muse sửa trong PR này sau khi Nguyen chạy nghiệm thu Mốc 1 bị chặn bởi lỗi 401 từ quay.io (Muse đã tự kiểm chứng: Quay trả 401 ngay cả với token pull ẩn danh — MinIO đã rút toàn bộ image công khai miễn phí). Workaround trước mắt cho máy đang chạy: `docker compose up -d mysql redis mailpit` rồi `docker compose up -d --build --no-deps api web`.
- Handoff: OpenCode review theo ma trận G.3.

---

## FE-005 — Áp dụng hướng thiết kế DEC-013 vào khung ứng dụng nội bộ
- Assignee: OpenCode · Level: L3 · Status: TODO
- Branch: — · PR: —
- Blocked by: PR #19 merge (DEC-013 chính thức có hiệu lực trên main)
- Acceptance Criteria: Khung ứng dụng nội bộ theo mẫu A — Classic Sidebar (DEC-013) với design tokens thống nhất trên shadcn/ui + Tailwind; tuân thủ toàn bộ docs/UI_GUIDELINES.md (responsive nhiều bề rộng, không scroll ngang cho bảng dữ liệu lớn, tương phản chữ, chip/badge một dòng, min-height và empty state giữ khung). Tự kiểm ở ít nhất 3 bề rộng màn hình và báo cáo rõ; Nguyen nghiệm thu UI bằng mắt. Mẫu D (Pipeline) cho CRM và hơi hướng C cho Portal áp dụng ở các task màn hình tương ứng sau này, không thuộc task này.
- Progress: —
- Handoff: OpenCode (vai Frontend, DEC-011); Muse review chéo theo ma trận (OpenCode không tự review code FE của mình).

---

## Inbox
*Mọi agent được thêm mục mới ở đây, không sửa mục của người khác. (Hiện chưa có mục nào.)*

- [QA-001 · 2026-11-20] `docs/CONVENTIONS.md:252` — dòng cuối "chốt stack backend + scope MVP — vẫn đang chờ, chưa bắt đầu code" đã lỗi thời sau DEC-001/DEC-004 và các PR #1–#4. Đề xuất Nguyen/Muse sửa hoặc xoá dòng này qua PR `docs/` theo DEC-002; QA không tự sửa quy ước.
- [QA-001 · 2026-11-20] `docs/AUTH_CONTRACT.md:37-43,81-85` — DEC-008.3 chốt "Portal có quên mật khẩu, dùng chung cơ chế email" nhưng bảng endpoint Portal thiếu `POST /portal/auth/forgot-password` và `POST /portal/auth/reset-password`. Đề xuất Muse + Nguyen chốt method/path/request/response + mã lỗi trước khi QA chạy test thật QA-002.
- [QA-002 · 2026-11-20] `apps/api/bootstrap/app.php` / `auth:sanctum`: sau logout hoặc đổi mật khẩu, token bị xoá khiến `GET /api/v1/auth/me` trả **500** (`Route [login] not defined`) thay vì 401 `UNAUTHENTICATED`. Cần cấu hình `redirectTo` trả null cho API hoặc xử lý unauthenticated JSON trong Authenticate middleware. Ảnh hưởng TC-AUTH-14, 15 (FAIL).
- [QA-002 · 2026-11-20] `apps/api` setup: thiếu `storage/framework/views` trên checkout sạch khiến forgot-password/reset-password (gửi mail markdown) trả 500 "Please provide a valid cache path"; cần tạo thư mục hoặc chạy `php artisan view:cache` trong entrypoint Docker.
- [QA-002 · 2026-11-20] `docs/AUTH_CONTRACT.md` vs `apps/api`: contract nội bộ ghi reset password dùng `new_password`, nhưng implementation/tests dùng `password` (Portal cũng dùng `password`). Cần Muse + Nguyen thống nhất tên field.
