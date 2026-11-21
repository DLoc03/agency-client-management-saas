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

## DEC-008 — Hợp đồng Auth + Multi-tenancy + RBAC (BE-003) và 3 chốt chi tiết · 2026-11-20 · Mức: L3/L5
- Decision: Duyệt hợp đồng tại `docs/AUTH_CONTRACT.md`: agency_id chỉ lấy từ token, dữ liệu agency khác trả 404, token Sanctum tách scope `app`/`portal` và chặn chéo, client_accounts là loại tài khoản riêng, chuẩn mã lỗi máy ổn định. Ba chốt chi tiết theo đề xuất của Muse được Nguyen duyệt: (1) email unique TOÀN HỆ THỐNG trong MVP (login 1 bước, không cần mã workspace); (2) token KHÔNG đặt hạn cứng trong MVP — thu hồi khi logout/đổi mật khẩu; (3) Portal CÓ quên mật khẩu, dùng chung cơ chế email với nội bộ.
- Reason: Email toàn cục đơn giản hoá UX đăng nhập cho MVP; hạn token cứng chưa cần thiết ở quy mô MVP nhưng thu hồi chủ động thì bắt buộc; Portal là mặt tiền với khách hàng nên quên mật khẩu là tối thiểu phải có.
- Scope / Expiry: Toàn bộ MVP; xem xét lại email-theo-agency và hạn token khi có nhu cầu đa workspace cho một người dùng.

## DEC-009 — Hợp đồng Module Client (BE-004) và 6 chốt chi tiết · 2026-11-20 · Mức: L3
- Decision: Duyệt hợp đồng tại `docs/CLIENT_CONTRACT.md`: module Client gồm hồ sơ client, organization tách bảng riêng (1–1), contacts, tags phân đoạn, client notes nội bộ, và cấp/khoá tài khoản Portal (thêm FK `client_accounts.client_id → clients.id`). Sáu chốt chi tiết theo đề xuất của Muse được Nguyen duyệt toàn bộ: (1) organization tách bảng riêng; (2) data scope của Sales Manager = toàn agency trong MVP; (3) Team Member không có quyền clients.* ở MVP; (4) xoá client = soft delete + vô hiệu hoá tài khoản Portal liên kết; (5) Admin không có quyền xoá client — chỉ Owner; (6) mật khẩu tài khoản Portal do agency đặt khi tạo, luồng email tự đặt mật khẩu để Phase 2.
- Reason: Giữ mô hình dữ liệu khớp luồng Convert Lead → Client về sau; scope đơn giản ở MVP để không chặn tiến độ; quyền xoá (thao tác phá huỷ) tập trung ở Owner nhất quán với nguyên tắc quản trị cấp cao nhất của RBAC đã chốt.
- Scope / Expiry: Toàn bộ MVP; xem xét lại scope của Sales và luồng mật khẩu Portal khi vào Phase 2.

## DEC-010 — Chuẩn hoá field reset-password là `password` · 2026-11-21 · Mức: L3
- Decision: Field đặt lại mật khẩu trong `POST /auth/reset-password` và `POST /portal/auth/reset-password` là `password` (không phải `new_password` như bản hợp đồng Auth ban đầu ghi). `docs/AUTH_CONTRACT.md` được sửa cho khớp; implementation, test Backend và Portal FE-003 vốn đã dùng `password` nên không phải sửa code. Riêng change-password giữ nguyên `current_password` + `new_password` (hợp đồng và code đã thống nhất từ đầu).
- Reason: Đúng quy ước Laravel cho luồng reset (form đặt mật khẩu mới tại trang reset), và là lựa chọn ít thay đổi nhất: chỉ sửa 1 dòng tài liệu thay vì sửa code + test + FE. Phát hiện qua QA-002 finding 3.
- Scope / Expiry: Áp dụng cho cả reset nội bộ và Portal trong toàn bộ MVP.

## DEC-011 — Chuyển vai trò Frontend Developer từ Google Antigravity sang OpenCode · 2026-11-21 · Mức: L5 (ngoại lệ do Nguyen quyết)
- Decision: OpenCode đảm nhiệm thêm vai trò Frontend Developer (vai trò chính QA Review & Tester giữ nguyên), thay Google Antigravity kể từ quyết định này. Mọi task FE từ thời điểm này được giao cho OpenCode trừ khi Nguyen chỉ định khác.
- Reason: Antigravity tạm ngưng hoạt động; cần giữ tiến độ Frontend không bị chặn (lý do chi tiết do Nguyen nắm).
- Scope / Expiry: Áp dụng cho mọi task FE mở sau thời điểm quyết định (FE-004/FE-003 đã hoàn thành trước đó không bị ảnh hưởng). Ràng buộc bất biến theo quy ước: **OpenCode không bao giờ được tự review/accept code FE của chính mình** — PR FE của OpenCode do Muse review chéo hoặc Nguyen duyệt. Quyết định hết hiệu lực khi Nguyen thông báo Antigravity quay lại hoặc chỉ định khác.

## DEC-012 — Loại Google Antigravity khỏi danh sách Agents Coding · 2026-11-21 · Mức: L5 (Nguyen quyết)
- Decision: Google Antigravity chính thức rời danh sách Agents Coding của dự án (bổ sung/thay thế khung tạm thời của DEC-011). Đội hình tạm thời còn: Nguyen (Product Owner) · Muse (Backend chính + điều phối phân task + review chéo code FE của OpenCode) · OpenCode (QA Review & Tester + Frontend Developer theo DEC-011, không tự review code FE của mình). Khi Nguyen tìm được AI Coding Agent mới tham gia, vai trò sẽ được phân chia lại và ghi quyết định mới.
- Reason: Antigravity không còn đủ quota để tiếp tục tham gia hiệu quả (theo thông báo của Nguyen).
- Scope / Expiry: Áp dụng ngay; các đóng góp đã merge của Antigravity (FE-001, FE-002, FE-003, FE-004) giữ nguyên giá trị và lịch sử. Hết hiệu lực khi có quyết định nhân sự mới.

## DEC-013 — Hướng thiết kế UI: khung Classic Sidebar (A) + Pipeline CRM (D) + hơi hướng Bento (C) cho Portal · 2026-11-21 · Mức: L3 (Muse đề xuất, Nguyen duyệt)
- Decision: Chốt sớm hướng giao diện ở mức khung và ngôn ngữ thị giác (chưa trau chuốt chi tiết từng màn): (1) Mẫu A "Classic Sidebar" là style chính của ứng dụng nội bộ, xây trên shadcn/ui + Tailwind với design tokens thống nhất. (2) Các màn CRM dùng mẫu D "Pipeline" (Kanban theo giai đoạn lead). (3) Khu Client Portal lấy hơi hướng mẫu C "Bento Thân Thiện" (thoáng, thân thiện với khách hàng). Toàn bộ quy ước giao diện ràng buộc nằm tại `docs/UI_GUIDELINES.md` — mọi agent làm Frontend (OpenCode, Muse khi kiêm nhiệm, hoặc agent mới) đều phải tuân thủ, và Nguyen nghiệm thu UI trực tiếp bằng mắt.
- Reason: Các màn hình nghiệp vụ sắp nhân lên (CRM, Projects, Finance); chốt khung + tokens sớm tránh phải sửa lại toàn bộ về sau. Nguyen có kinh nghiệm Frontend ở các dự án trước và đặt yêu cầu cao về UI/UX cho người dùng cuối.
- Scope / Expiry: Áp dụng cho mọi màn hình Frontend từ FE-005 trở đi. Đổi hướng thiết kế là quyết định L3 trở lên.

## DEC-014 — Duyệt hợp đồng BE-005 (CRM/Lead) theo đề xuất của Muse · 2026-11-21 · Mức: L3 (Muse + Nguyen)
- Decision: Công bố `docs/CRM_CONTRACT.md` với cả 6 điểm theo đề xuất: (1) trạng thái pipeline cố định new/contacted/qualified/unqualified, không stages tuỳ biến ở MVP; (2) mở rộng bảng contacts dùng chung Lead/Client (thêm lead_id, client_id nullable, contact thuộc đúng một chủ) và thêm clients.source_lead_id; (3) Follow-up Activities ở mức bảng lead_activities + endpoint due, thông báo đẩy để Nhóm 0; (4) lịch sử tương tác = notes + activities trong MVP, Activity Log tích hợp sau; (5) ma trận quyền leads.* (Sales toàn quyền trừ xoá; xoá lead = Owner + Admin; PM/Accountant chỉ xem; Team Member không có); (6) convert khoá sửa lead, chống trùng client 422 kèm cờ force, convert lại trả 409.
- Reason: Giữ đúng phạm vi MVP Nhóm 1 đã chốt trong docs/MVP_SCOPE.md và nhất quán với các quyết định của module Client (DEC-009).
- Scope / Expiry: Áp dụng cho BE-005 và các task CRM liên quan; thay đổi hợp đồng sau khi công bố cần quyết định mới.
