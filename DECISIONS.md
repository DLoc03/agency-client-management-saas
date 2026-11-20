# DECISIONS.md — Nhật ký quyết định
> Quyền ghi theo Quy ước chung (docs/CONVENTIONS.md) mục F.5: chỉ Nguyen + Muse, append-only, không sửa quyết định cũ.

## DEC-001 — Chốt stack Phương án A: Laravel + Next.js · 2026-11-20 · Mức: L5
- Decision: Backend PHP 8.3 + Laravel 12 + MySQL 8 + Redis, Sanctum Bearer token, OpenAPI sinh bằng Scramble; Frontend Next.js (App Router) + TypeScript strict + Tailwind CSS + shadcn/ui, TanStack Query, React Hook Form + Zod; QA Playwright + Pest/PHPUnit + Vitest; Docker Compose cho local, GitHub Actions 3 job song song; runtime ghim PHP 8.3 / Node 20 LTS / MySQL 8 / Redis 7.
- Reason: Nguyen kiểm soát và tự sửa được backend Laravel (sở trường PHP/Perfex/MySQL); Laravel cho sẵn auth/policy/queue/mail/scheduler cho nghiệp vụ SaaS; FE/QA dùng stack TypeScript chuẩn nhất cho vai trò của họ.
- Alternatives rejected: Phương án B full TypeScript (NestJS + Prisma + PostgreSQL) — Nguyen khó kiểm tra backend hơn, phải viết tay nhiều thứ Laravel cho sẵn, MVP chậm hơn. Chỉ xét lại nếu định hướng dự án thay đổi (quyết định L5 mới).
- Scope / Expiry: Áp dụng từ MVP cho tới khi có DEC mới thay thế (Supersedes).

## DEC-002 — Quy ước làm việc 3 agents · 2026-11-20 · Mức: L5
- Decision: Áp dụng Quy ước chung v2 — 5 file markdown bắt buộc (VERSION.md chỉ 1 dòng, TASK.md theo danh sách Task ID, CHANGELOG.md, README.md, DECISIONS.md), thang 5 mức quyết định L1–L5, contract FE–BE do Muse + Nguyen chốt rồi mới phổ biến, làm việc qua PR có review thật, quy ước branch + worktree.
- Reason: 3 agents không có trí nhớ chung; cần chủ sở hữu duy nhất cho từng file/hạng mục để tránh conflict và can thiệp chéo.
- Scope / Expiry: Áp dụng cho toàn dự án; sửa quy ước phải qua PR docs/ và Nguyen duyệt.

## DEC-003 — Source code dùng 1 repo chung duy nhất · 2026-11-20 · Mức: L5
- Decision: Toàn bộ source (api, web, contracts, e2e tests, tài liệu) nằm trong 1 GitHub repo monorepo duy nhất, cấu trúc `apps/api`, `apps/web`, `packages/contracts`, `tests/e2e`, `docs/`.
- Reason: Phân task, PR review, version và release đều quản lý ở 1 nơi; tránh lệch version giữa repo FE và BE.
- Scope / Expiry: Toàn dự án.

## DEC-004 — Chốt Scope MVP theo 8 nhóm nghiệp vụ · 2026-11-20 · Mức: L5
- Decision: MVP chạy trọn luồng Lead → Client → Project → Task → Portal → Invoice (ghi nhận thanh toán thủ công) → Dashboard; cả 8 nhóm nghiệp vụ đều có mặt ở phần lõi, phần nâng cao (Kanban/Gantt, Timesheets/Workload, Quotations/Contracts/Profitability, rule engine automation, cổng thanh toán online, white-label, báo cáo sâu) để Phase 2. Super Admin chỉ làm bản tối giản (tạo/khoá agency thủ công, không tự thu tiền gói, không khoá giới hạn theo gói). Multi-tenancy: chung 1 DB + `agency_id`.
- Reason: Cắt theo tính năng con thay vì cắt nguyên nhóm để luồng sản phẩm không bị đứt; các module Phase 2 đều phụ thuộc dữ liệu của luồng lõi.
- Scope / Expiry: Toàn bộ MVP.

## DEC-005 — Mô hình phân quyền 7 vai trò · 2026-11-20 · Mức: L5
- Decision: Owner (độc quyền: xoá workspace, chuyển sở hữu, quản lý Admin; đúng 1 Owner/workspace) / Admin / Sales Manager / Project Manager / Team Member / Accountant / Client. Client là loại tài khoản Portal riêng, không phải vai trò nội bộ. Người nội bộ được giữ nhiều vai trò cùng lúc (quyền = hợp, Owner ngoại lệ). Mọi quyền đều kèm phạm vi dữ liệu và thực thi ở tầng API.
- Reason: Bộ vai trò đúng ngôn ngữ agency thật; đa vai trò phù hợp agency nhỏ; tách Client khỏi nội bộ là yêu cầu bảo mật.
- Scope / Expiry: Toàn bộ MVP.

## DEC-006 — Đa ngôn ngữ EN (chính) + VI ngay trong MVP · 2026-11-20 · Mức: L5
- Decision: Tiếng Anh mặc định/chính, tiếng Việt thứ hai, cả hai hoàn chỉnh trong MVP. Chỉ dịch chữ hệ thống, không dịch dữ liệu người dùng nhập; DB chỉ lưu enum/key; FE cấm hardcode chuỗi hiển thị; mỗi user có locale riêng; mỗi workspace 1 tiền tệ gốc + múi giờ; seed/demo bằng tiếng Anh; README.md bằng tiếng Anh + README.vi.md, tài liệu nội bộ giữ tiếng Việt.
- Reason: Dự án là sản phẩm tiêu biểu để Nguyen tìm 2nd job remote global; i18n làm từ đầu rẻ hơn rất nhiều so với vá về sau và là bằng chứng năng lực với nhà tuyển dụng.
- Scope / Expiry: Toàn bộ MVP.

## DEC-007 — Bootstrap repo một lần trực tiếp lên main · 2026-11-20 · Mức: L5
- Decision: Lần khởi tạo đầu tiên của repo (5 file bắt buộc + tài liệu đã chốt trong `docs/`) được đẩy trực tiếp lên `main` một lần duy nhất, thay vì qua PR — vì repo trống chưa có nội dung để mở PR vào. Ngoại lệ này nằm trong Kế hoạch khởi tạo repo đã trình Nguyen trước khi Nguyen gửi link repo.
- Reason: Không thể áp dụng quy trình PR cho commit đầu tiên của một repo rỗng.
- Scope / Expiry: Chỉ áp dụng cho commit bootstrap DOC-001. Mọi thay đổi từ sau đó tuân thủ tuyệt đối quy trình PR có review thật.
