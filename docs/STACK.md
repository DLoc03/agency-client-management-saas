# STACK ĐÃ CHỐT — Agency & Client Management SaaS
**Trạng thái:** ✅ ĐÃ CHỐT — Nguyen duyệt Phương án A ngày 2026-11-20. Đây là stack chính thức cho mọi vai trò; thay đổi stack thuộc mức L5 (chỉ Nguyen quyết) và phải ghi vào DECISIONS.md.
**Ngày:** 2026-11-20 · Nguyên tắc chọn: (1) Nguyen phải tự đọc, tự kiểm tra và tự sửa được backend khi AI sai — không chọn stack mà chủ dự án không kiểm soát được; (2) mỗi agent làm việc với stack chuẩn nhất của vai trò đó, để output ít lỗi nhất; (3) 1 repo chung, chạy local bằng 1 lệnh.

---

## 1. KHUYẾN NGHỊ CHÍNH — Phương án A: Laravel + Next.js (2 ngôn ngữ, 1 repo)

| Lớp | Chốt đề xuất | Vai trò sở hữu | Lý do chọn |
|---|---|---|---|
| **Repo** | **1 GitHub repo duy nhất (monorepo dạng thư mục thường, không dùng Turborepo/Nx)** | Cả 3 | Anh đã chốt 1 repo chung. Backend là PHP nên workspace của npm không bao quát được cả repo — dùng thư mục + Docker Compose + script ở root để điều phối là đủ, thêm Turborepo chỉ thêm phức tạp không cần thiết |
| **Backend** | **PHP 8.3 + Laravel 12** | Muse | Đúng sở trường của anh (PHP, CodeIgniter, Perfex CRM đều cùng họ tư duy MVC/Active Record). Anh đọc/sửa/debug được code em viết bất cứ lúc nào. Laravel có sẵn gần như mọi thứ SaaS này cần: auth, policy/RBAC, queue, mail, notification, scheduler, validation — không phải tự lắp |
| **Database** | **MySQL 8** | Muse | Anh đang dùng MySQL hằng ngày ở Moma; hosting/VPS cho MySQL rẻ và phổ biến ở VN. Nghiệp vụ Agency/Client là dữ liệu quan hệ thuần (agency–client–project–task–invoice), chưa có nhu cầu buộc phải sang PostgreSQL |
| **ORM / Migration** | Eloquent + Laravel Migrations | Muse | Đi kèm Laravel, quy ước ở Quy ước chung: chỉ BE tạo migration |
| **Auth BE↔FE** | **Laravel Sanctum — Bearer token** | Muse + Nguyen chốt ở contract | FE và BE là 2 app riêng (khác subdomain khi deploy: `app.` / `api.`). Bearer token đơn giản, dễ test bằng Postman/curl, dễ cho QA viết test tự động hơn cơ chế cookie SPA của Sanctum (đòi hỏi cùng domain và xử lý CSRF phức tạp hơn). Cách refresh/lưu token sẽ chốt cụ thể khi soạn contract Auth |
| **Cache / Queue** | **Redis** (queue cho email/thông báo + cache) | Muse | Chuẩn của Laravel (Horizon quản lý queue khi cần). Local chạy bằng Docker |
| **API Contract** | **OpenAPI tự sinh từ code bằng Scramble + viết tay phần mô tả nghiệp vụ**; FE sinh TypeScript types/client bằng `openapi-typescript` | Muse viết, Nguyen duyệt | Đây là cơ chế chống "contract bị trôi": contract không phải file Word viết riêng dễ lệch, mà sinh ra từ chính code BE đã chạy. FE không tự khai báo type bằng tay |
| **File / Upload** | Laravel Filesystem — local disk khi dev, **S3-compatible (MinIO khi local, S3/R2 khi prod)** | Muse | Đổi nơi lưu chỉ bằng biến môi trường, không sửa code |
| **Mail** | Laravel Mail + **Mailpit** khi local (không gửi mail thật) | Muse | QA test được luồng mời thành viên / quên mật khẩu mà không spam hộp thư thật |
| **Frontend** | **Next.js (App Router) + TypeScript (strict)** | Antigravity | Chuẩn mạnh nhất hiện nay cho SaaS dashboard, và là stack Antigravity sinh code tốt nhất — ít lỗi vặt nhất cho vai FE. App Router hợp với cấu trúc Agency → Client → Project nhiều cấp |
| **UI** | **Tailwind CSS + shadcn/ui** + lucide icons | Antigravity | shadcn/ui cho component copy-vào-project (không khoá vào thư viện đóng gói), Antigravity và cả OpenCode/Muse khi làm FE dự bị đều quen pattern này — bàn giao FE qua lại không bị lệch hệ component |
| **FE data/state** | **TanStack Query** (server state) + **React Hook Form + Zod** (form/validation) | Antigravity | TanStack Query xử lý cache/refetch/pagination của API; Zod validate form khớp với validation phía BE. State toàn cục giữ tối thiểu (chỉ auth + UI), không thêm Redux khi chưa cần |
| **QA — E2E** | **Playwright (TypeScript)** | OpenCode | Cùng ngôn ngữ với FE nên OpenCode vừa viết E2E vừa làm FE dự bị không phải đổi hệ. Playwright chạy được luồng thật: đăng nhập → tạo client → tạo project |
| **QA — API/Unit BE** | **Pest / PHPUnit** (feature + unit test phía BE) | Muse viết test nền, OpenCode mở rộng & nghiệm thu | Test BE phải viết bằng PHP mới chạm được vào model/policy/tenant isolation — phần rủi ro nhất (rò dữ liệu giữa 2 agency) bắt buộc có test tự động ở lớp này, không chỉ test qua giao diện |
| **QA — FE unit** | **Vitest + Testing Library** | Antigravity viết cho component của mình, OpenCode review | Chỉ test component/logic khó, không chạy theo độ phủ % |
| **Chất lượng code** | BE: **Laravel Pint** · FE: **ESLint + Prettier** · Root: `.editorconfig` | Mỗi vai tự áp dụng cho phần mình | Chốt 1 formatter mỗi phía để 3 agents không tạo diff rác vì format khác nhau |
| **Môi trường local** | **Docker Compose ở root repo**: `api`, `web`, `mysql`, `redis`, `mailpit`, `minio` — chạy toàn hệ thống bằng `docker compose up` | Muse dựng, cả 3 dùng chung | Giải quyết triệt để lỗi "máy tôi chạy được": cả 3 agents và anh đều chạy đúng cùng một môi trường, cùng version |
| **Version runtime (ghim cứng)** | PHP 8.3 · Node 20 LTS · Composer 2 · pnpm 10 · MySQL 8 · Redis 7 | Cả 3 | Ghim trong Docker + `.nvmrc` + README. Không agent nào tự nâng version (mức L4 trong Quy ước chung) |
| **CI** | **GitHub Actions — 3 job song song**: `backend` (Pint check + Pest), `frontend` (lint + typecheck + build), `e2e` (Playwright, chạy khi 2 job kia xanh) | OpenCode sở hữu file workflow, Muse/Antigravity sửa job của mình qua PR | PR nào làm vỡ phần nào thì job đó đỏ rõ ràng — đúng tinh thần "review thật" đã chốt |
| **Deploy (dự kiến MVP, chưa chốt)** | VPS + Docker Compose + reverse proxy (Caddy/Nginx), `app.` cho FE, `api.` cho BE | Nguyen quyết khi tới giai đoạn deploy | MVP chưa cần Kubernetes/serverless. Giữ chi phí thấp, đúng quy mô agency VN nếu đó là thị trường đầu tiên — mục này để mở, quyết sau khi chốt Scope |

### Cấu trúc 1 repo theo phương án A
```
agency-client-saas/            ← repo duy nhất
├─ README.md  VERSION.md  TASK.md  CHANGELOG.md  DECISIONS.md
├─ docker-compose.yml           ← Muse sở hữu
├─ apps/
│  ├─ api/                      ← Laravel — Muse sở hữu duy nhất
│  └─ web/                      ← Next.js — Antigravity sở hữu chính
├─ packages/
│  └─ contracts/                ← OpenAPI đã sinh + TS types đã sinh — chỉ sửa qua quy trình contract (mục E, Quy ước chung)
├─ tests/
│  └─ e2e/                      ← Playwright — OpenCode sở hữu duy nhất
└─ docs/                        ← Quy ước chung, đề xuất stack, ghi chú nghiệp vụ
```

---

## 2. PHƯƠNG ÁN B — Full TypeScript (chỉ để anh so sánh, em KHÔNG khuyến nghị làm chính)

| Lớp | Phương án B |
|---|---|
| Backend | NestJS + TypeScript + Prisma + PostgreSQL, chung pnpm workspace/Turborepo với FE |
| Ưu điểm thật | 1 ngôn ngữ duy nhất cho cả 3 vai trò; FE/BE dùng chung type trực tiếp, contract khó trôi nhất; hệ sinh thái SaaS quốc tế lớn |
| Vì sao em không khuyến nghị | (1) Anh không kiểm soát backend tốt bằng Laravel — khi AI viết sai nghiệp vụ, anh khó phát hiện và khó tự sửa, dự án thành phụ thuộc hoàn toàn vào agent. (2) NestJS + Prisma cho nghiệp vụ CRUD/RBAC/invoice nặng như SaaS này thường phải viết tay nhiều thứ Laravel cho sẵn (auth, policy, queue, mail, scheduler). (3) PostgreSQL/MySQL không phải vấn đề, nhưng đổi cả DB lẫn framework cùng lúc là đổi toàn bộ vùng an toàn của anh trong 1 dự án mới |
| Khi nào nên chọn B | Nếu anh xác định đây là dự án để **học sâu TypeScript/NestJS** và chấp nhận MVP chậm hơn, hoặc định hướng bán cho thị trường quốc tế và tuyển dev TS sau này — khi đó B là lựa chọn chiến lược, không phải lựa chọn kỹ thuật sai |

**Kết luận của em:** Chốt **Phương án A** cho MVP. Giữ đúng thế mạnh của anh ở tầng quan trọng nhất (backend + dữ liệu), và để FE/QA dùng stack chuẩn nhất của thời điểm hiện tại. Nếu sau MVP anh muốn chuyển hướng, đó là quyết định L5 ghi vào `DECISIONS.md`, không phải việc phải quyết lại từ đầu bây giờ.

---

## 3. NHỮNG GÌ STACK NÀY CHƯA QUYẾT (để mở có chủ đích)
1. **Thị trường đầu tiên** (VN hay quốc tế) → ảnh hưởng cổng thanh toán cho Invoice (VietQR/chuyển khoản vs Stripe) — chờ anh mô tả 8 nhóm nghiệp vụ + chốt Scope.
2. **Multi-tenancy kiểu nào:** chung DB + cột `agency_id` (đề xuất cho MVP — đơn giản, rẻ) hay tách DB theo tenant (chưa cần ở MVP).
3. **Deploy thật + domain** — quyết khi MVP gần xong, không chặn việc bắt đầu.
