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
- Assignee: OpenCode · Level: L1 · Status: TODO
- Branch: qa/QA-001-bootstrap-review · PR: —
- Blocked by: DOC-001
- Acceptance Criteria: Kiểm tra 5 file bắt buộc đúng quy ước (VERSION.md đúng 1 dòng; TASK.md theo ID; quyền ghi từng file); kiểm tra tài liệu trong `docs/` khớp các quyết định DEC-001 → DEC-007; báo cáo kết quả trong task này.
- Progress: —
- Handoff: —

---

## BE-003 — Auth, multi-tenancy & RBAC contract (design)
- Assignee: Muse · Level: L3 · Status: IN_PROGRESS
- Branch: be/BE-003-auth-contract · PR: —
- Blocked by: BE-002
- Acceptance Criteria: Đề xuất contract Auth (đăng ký/đăng nhập/token) + mô hình multi-tenancy `agency_id` + ma trận phân quyền chi tiết 7 vai trò được Muse soạn và Nguyen duyệt trước khi phổ biến cho Antigravity/OpenCode (quy trình mục E, Quy ước chung).
- Progress: Hợp đồng đã được Nguyen DUYỆT ngày 2026-11-20 (kèm 3 chốt tại DEC-008: email unique toàn hệ thống; token không đặt hạn cứng trong MVP; Portal có quên mật khẩu) và công bố tại `docs/AUTH_CONTRACT.md`. Đang triển khai phần Backend.
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
- Assignee: Google Antigravity · Level: L2 · Status: TODO
- Branch: fe/FE-003-portal-login · PR: —
- Blocked by: — (hợp đồng đã duyệt — làm bằng mock)
- Acceptance Criteria: Khu vực Portal tách riêng tại route `/portal` với layout riêng; màn đăng nhập Portal gọi `POST /api/v1/portal/auth/login` (mock theo hợp đồng); token portal tách biệt token nội bộ (không dùng lẫn); trang tổng quan Portal trống (placeholder theo i18n) sau đăng nhập; EN/VI đầy đủ.
- Progress: —
- Handoff: Bắt đầu được ngay sau khi PR tài liệu BE-003 merge.

---

## QA-002 — Auth & tenancy test coverage
- Assignee: OpenCode · Level: L1 · Status: IN_REVIEW
- Branch: qa/QA-002-auth-tests · PR: #6 (chờ Muse review/merge — G.3)
- Blocked by: BE-003 (chờ code Backend để chạy kiểm thử thật; viết test case từ Acceptance Criteria ngay được)
- Acceptance Criteria: Bộ test case bao phủ: login đúng/sai thông tin, agency bị khoá, tài khoản bị vô hiệu hoá, token portal gọi API nội bộ bị chặn và ngược lại, truy vấn dữ liệu agency khác trả 404, rate limit login; E2E Playwright cho luồng login nội bộ + Portal; kết quả ghi vào task này.
- Progress: OpenCode hoàn thành 2026-11-20 bộ **23 test case** (17 API + 6 E2E) từ `docs/AUTH_CONTRACT.md` đã duyệt (DEC-008), lưu tại `tests/e2e/auth.spec.ts`. Chưa chạy thật vì BE-003/FE-002/FE-003 chưa lên PR — đúng Handoff của task.
  - Phủ Acceptance Criteria: login đúng (TC-AUTH-01, TC-E2E-01), sai email/sai mật khẩu (02, E2E-02), agency khoá (03, E2E-03), tài khoản vô hiệu (04, E2E-03), token Portal → API nội bộ bị chặn (08, E2E-05) và token nội bộ → API Portal bị chặn (09), đọc dữ liệu agency khác → 404 thay vì 403 (11), rate limit 5 lần/phút/IP (13).
  - Phủ thêm theo hợp đồng: token Portal tách biệt + client summary (07), `agency_id` chỉ lấy từ token (10), FK khác agency → 422 `CROSS_TENANT_REFERENCE` (12), logout thu hồi token (14), đổi mật khẩu thu hồi mọi token khác (15), forgot/reset không dò tài khoản + `INVALID_RESET_TOKEN` (16), mã lỗi ổn định nhưng message theo locale (06), E2E Portal `/portal` + guard + EN/VI (E2E-05/06).
  - `test.fixme` có chủ đích: TC-AUTH-17 (Portal forgot/reset) — DEC-008.3 đã chốt nhưng `AUTH_CONTRACT.md` mục 3 chưa định nghĩa endpoint; đã báo tại PR #5 (Inbox QA-001), chờ Muse + Nguyen chốt. TC-AUTH-11/12 dùng env `E2E_TENANT_RESOURCE_PATH` / `E2E_TENANT_CREATE_PATH` + `test.skip` có lý do tới khi có endpoint nghiệp vụ — không fail giả.
  - Không hardcode secret: mọi tài khoản/ID đọc từ biến `E2E_*` của seed dùng chung (`tests/e2e/README.md`, quy ước H.4). Không thêm dependency hay config chung (L4) — chỉ thêm 1 file spec trong phạm vi sở hữu QA.
  - Kết quả: **bộ test case HOÀN THÀNH ở mức viết; chưa có kết quả chạy thật.** Chuyển `IN_REVIEW` chờ Muse approve/merge; không tự merge PR của chính mình.
- Handoff: Khi BE-003/FE-002/FE-003 mở PR, chạy `tests/e2e/auth.spec.ts` trên DB test riêng của QA (`agency_test`, G.2), bổ sung endpoint Portal forgot/reset sau khi contract chốt, rồi ghi kết quả PASS/FAIL vào task này.

---

## Inbox
*Mọi agent được thêm mục mới ở đây, không sửa mục của người khác. (Hiện chưa có mục nào.)*
