# Agency & Client Management SaaS

Hệ thống SaaS giúp agency quản lý toàn bộ hoạt động kinh doanh và vận hành — từ tiếp cận khách hàng tiềm năng, triển khai dự án và bàn giao sản phẩm, đến chăm sóc quan hệ khách hàng lâu dài.

> **Trạng thái:** v0.1.0 — giai đoạn nền tảng. Quy ước, stack, Scope MVP, phân quyền và chiến lược đa ngôn ngữ đã chốt xong (xem `docs/` và `DECISIONS.md`). Mã nguồn ứng dụng đang được khởi tạo.

[🇬🇧 Read in English](README.md)

## Dự án này là gì?

Agency thường vận hành công việc rải rác qua ứng dụng chat, bảng tính và email: lead một nơi, thông tin khách hàng một nơi, tiến độ dự án một nơi, hoá đơn lại một nơi khác. Sản phẩm này gom toàn bộ luồng vào một hệ thống với ba bề mặt:

- **Agency App** — cho chủ agency và nhân viên vận hành công việc hằng ngày.
- **Client Portal** — không gian riêng, bị giới hạn quyền, nơi mỗi khách hàng theo dõi dự án của chính mình, nhận file, phản hồi và duyệt bàn giao.
- **Platform Admin (tối giản)** — cho chủ sản phẩm tạo và quản lý các workspace agency.

Luồng lõi: **Lead → Client → Project → Task & Milestone → Client Portal xem & duyệt → Invoice → Theo dõi thanh toán → Dashboard & Báo cáo.**

## Các nhóm nghiệp vụ

1. **CRM** — Quản lý Lead, quản lý Contact, Sales Pipeline, hoạt động Follow-up, lịch sử tương tác khách hàng.
2. **Client Management** — Hồ sơ khách hàng, Organizations & Contacts, phân đoạn khách hàng, ghi chú, lịch sử khách hàng.
3. **Project Management** — Tổng quan dự án, quản lý Task, Milestones, Timeline, gán đội ngũ, theo dõi tiến độ.
4. **Team & Resource Management** — Quản lý nhân viên, quản lý team, Roles & Permissions, Workload, Timesheets, Availability.
5. **Finance & Billing** — Quotations, Contracts, Invoices, theo dõi thanh toán, ngân sách dự án, chi phí & lợi nhuận.
6. **Workflow & Automation** — Tự động hoá task, quy trình phê duyệt, thông báo trạng thái, task định kỳ, nhắc hạn.
7. **Client Portal & Collaboration** — Client Dashboard, tiến độ dự án, chia sẻ file, Feedback & Comments, yêu cầu phê duyệt, lịch sử trao đổi.
8. **Analytics & Reporting** — Báo cáo doanh thu, hiệu quả dự án, hiệu quả khách hàng, năng suất đội ngũ, báo cáo lợi nhuận.

MVP triển khai phần lõi của mọi nhóm để luồng trên chạy trọn vẹn từ đầu đến cuối; tính năng nâng cao thuộc Phase 2. Scope chi tiết theo từng tính năng nằm ở [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md).

## Phân quyền

Bảy vai trò, đã chốt tại [`docs/RBAC_AND_I18N.md`](docs/RBAC_AND_I18N.md): **Agency Owner** (chủ sở hữu duy nhất của workspace), **Admin**, **Sales Manager**, **Project Manager**, **Team Member**, **Accountant**, và **Client** (loại tài khoản Portal riêng, chỉ thấy dữ liệu của chính mình). Người nội bộ được giữ nhiều vai trò cùng lúc. Quyền luôn được thực thi ở tầng API kèm phạm vi dữ liệu — không bao giờ chỉ ẩn giao diện.

## Đa ngôn ngữ

**Tiếng Anh là ngôn ngữ chính; tiếng Việt được hỗ trợ đầy đủ — cả hai có ngay trong MVP.** Chỉ dịch chữ của hệ thống (giao diện, email, hoá đơn PDF, thông báo lỗi); dữ liệu người dùng nhập không bao giờ bị dịch. Mỗi người dùng có locale riêng, mỗi workspace có một tiền tệ gốc và múi giờ riêng.

## Stack

| Lớp | Công nghệ |
|---|---|
| Backend | PHP 8.3 · Laravel 12 · MySQL 8 · Redis · Laravel Sanctum (Bearer token) |
| API contract | OpenAPI sinh bằng Scramble; sinh TypeScript types cho frontend |
| Frontend | Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form + Zod · next-intl |
| Testing | Playwright (E2E) · Pest / PHPUnit (backend) · Vitest (frontend) |
| Môi trường local | Docker Compose — `api`, `web`, `mysql`, `redis`, `mailpit`, `minio` |
| CI | GitHub Actions — 3 job song song: backend, frontend, e2e |

Lý do chọn đầy đủ: [`docs/STACK.md`](docs/STACK.md).

## Cấu trúc repo

```
apps/api/            Laravel API — Backend Developer sở hữu
apps/web/            Next.js web app — Frontend Developer sở hữu
packages/contracts/  OpenAPI & TypeScript types đã sinh (chỉ đổi qua quy trình contract)
tests/e2e/           Playwright E2E — QA sở hữu
docs/                Quy ước, stack, scope, phân quyền & i18n
```

## Cách dự án này được xây dựng

Dự án do một Product Owner (con người) phối hợp với ba AI coding agent, mỗi bên có phạm vi tách bạch nghiêm ngặt — quy trình này được công khai vì bản thân nó cũng là một phần của dự án:

- **Nguyen** — Product Owner, quyền quyết định cuối về scope và mọi quyết định.
- **Muse** — Backend Developer, đồng thời cùng Product Owner phân chia nhiệm vụ.
- **Google Antigravity** — Frontend Developer.
- **OpenCode** — QA Review & Tester, và Frontend Developer dự bị.

Toàn bộ quy ước phối hợp (quyền sở hữu file, thang 5 mức quyết định, quy ước branch & worktree, review qua Pull Request) nằm tại [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## Chạy local

Hướng dẫn cài đặt sẽ được bổ sung tại đây khi khung monorepo (Docker Compose) hoàn thành. Mục tiêu là một lệnh duy nhất:

```bash
docker compose up
```

## Tài liệu dự án

- [`TASK.md`](TASK.md) — danh sách task theo ID và trạng thái
- [`CHANGELOG.md`](CHANGELOG.md) — lịch sử thay đổi theo phiên bản
- [`VERSION.md`](VERSION.md) — phiên bản hiện tại (đúng một dòng)
- [`DECISIONS.md`](DECISIONS.md) — nhật ký quyết định
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — quy ước phối hợp bắt buộc
- [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) — Scope MVP đã chốt
