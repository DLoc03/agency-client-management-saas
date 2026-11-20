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
- Assignee: Muse · Level: L3 · Status: IN_PROGRESS
- Branch: be/BE-001-monorepo-docker · PR: —
- Blocked by: DOC-001
- Acceptance Criteria: Cấu trúc `apps/`, `packages/contracts/`, `tests/e2e/`, `docs/`; `docker-compose.yml` ở root chạy được các service api/web/mysql/redis/mailpit/minio trên máy sạch; `.gitignore` + `.editorconfig` đầy đủ cho Laravel + Next.js.
- Progress: Muse bắt đầu 2026-11-20: đã soạn docker-compose.yml (api/web/mysql/redis/mailpit/minio), Dockerfile cho api (PHP 8.3) và web (Node 20), README cho packages/contracts và tests/e2e, .env.example + Makefile ở root. Chưa kiểm chứng chạy Docker thật (môi trường của Muse không có Docker) — cần OpenCode/Nguyen chạy `docker compose up` kiểm chứng ở bước review.
- Handoff: —

---

## BE-002 — Initialize Laravel API & health endpoint
- Assignee: Muse · Level: L2 · Status: TODO
- Branch: be/BE-002-laravel-api-init · PR: —
- Blocked by: BE-001
- Acceptance Criteria: Laravel chạy ở `apps/api` trong Docker; `.env.example` không chứa secret thật; endpoint `GET /api/v1/health` trả về format response chuẩn đã thống nhất; Pint + Pest chạy được.
- Progress: —
- Handoff: —

---

## FE-001 — Initialize Next.js web app & i18n EN/VI
- Assignee: Google Antigravity · Level: L2 · Status: TODO
- Branch: fe/FE-001-nextjs-init · PR: —
- Blocked by: BE-001
- Acceptance Criteria: Next.js (App Router) + TypeScript strict ở `apps/web`; Tailwind CSS + shadcn/ui; `next-intl` với `en.json`/`vi.json` chuyển được EN ↔ VI ở trang khung; không có chuỗi hiển thị viết cứng trong component.
- Progress: —
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
- Assignee: Muse · Level: L3 · Status: TODO
- Branch: be/BE-003-auth-contract · PR: —
- Blocked by: BE-002
- Acceptance Criteria: Đề xuất contract Auth (đăng ký/đăng nhập/token) + mô hình multi-tenancy `agency_id` + ma trận phân quyền chi tiết 7 vai trò được Muse soạn và Nguyen duyệt trước khi phổ biến cho Antigravity/OpenCode (quy trình mục E, Quy ước chung).
- Progress: —
- Handoff: —

---

## Inbox
*Mọi agent được thêm mục mới ở đây, không sửa mục của người khác. (Hiện chưa có mục nào.)*
