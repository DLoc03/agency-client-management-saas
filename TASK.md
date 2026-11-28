# TASK.md — Danh sách task theo ID
Quy tắc ghi file này xem tại `docs/CONVENTIONS.md` mục F.2. Luồng trạng thái: `TODO → IN_PROGRESS → IN_REVIEW → DONE` · nhánh: `BLOCKED`, `REOPEN`.

## BE-014 — Endpoint danh mục vai trò (GET /roles)
- Assignee: Backend (Muse) · Level: L2 · Status: IN_PROGRESS
- Branch: be/BE-014-roles-catalogue
- Contract: —
- Progress: Thêm `GET /v1/roles` trong nhóm staff (auth:sanctum + ability:app + tenant) trả toàn bộ vai trò toàn cục từ bảng roles (RoleResource: id/key/name, sắp theo id tăng dần = thứ tự seed) — nguồn dữ liệu chuẩn cho modal mời và form vai trò ở chi tiết member, thay cách FE tự gom vai trò từ danh sách member hiện có (agency mới chỉ có Owner thì gom được 0 vai trò chọn được, không mời nổi thành viên đầu tiên). Quyền truy cập: membership hiện tại phải có `invitations.manage` HOẶC `users.roles.manage`; middleware `permission:` chỉ nhận một key nên RoleController tự kiểm tra either và ném AuthorizationException (vẫn ra shape 403 FORBIDDEN chuẩn). Lưu ý dữ kiện: RoleSeeder chỉ seed 6 vai trò nội bộ (agency_owner, admin, sales_manager, project_manager, team_member, accountant) — client KHÔNG phải một role (là loại membership, DEC-018) nên danh mục có 6 mục. Thêm `RolesCatalogueTest` (6 test: Owner nhận đủ 6 vai trò đúng thứ tự seed; membership chỉ có một trong hai quyền vẫn xem được — không role gốc nào tách riêng hai quyền này nên test thu hẹp danh sách quyền của một role gốc qua config để kiểm nhánh either; Team Member không có quyền nào → 403 FORBIDDEN; token Portal → 403; guest → 401).
- Blocked by: —
- Acceptance Criteria: GET /roles với Owner → 200 + đủ vai trò theo thứ tự seed; chỉ có một trong hai quyền (invitations.manage / users.roles.manage) → 200; không có quyền nào → 403 FORBIDDEN; token Portal → 403; guest → 401; toàn bộ PHPUnit xanh trên SQLite + MySQL; Pint PASS.
- Handoff: OpenCode QA review, KHÔNG tự review, KHÔNG merge. FE theo sau là FIX-048 (modal mời + form vai trò ở chi tiết member chuyển sang dùng endpoint này) — phụ thuộc BE-014 merge.

---

## BE-013 — Endpoint cập nhật locale theo tài khoản (PATCH /auth/profile + bản Portal)
- Assignee: Backend (Muse) · Level: L2 · Status: IN_PROGRESS
- Branch: be/BE-013-profile-locale
- Contract: DEC-031
- Progress: Thêm `PATCH /v1/auth/profile` (staff) và `PATCH /v1/portal/auth/profile` (Portal) — endpoint cấp danh tính (identity-level, không qua tenant middleware, cùng vị trí với logout trong nhóm ability tương ứng) nhận `{ locale }`, validate theo nguồn sự thật locale hiện có (`Rule::in(['en', 'vi'])` như SetApiLocale và các FormRequest khác, sai → 422 VALIDATION_FAILED), ghi vào `users.locale` của chính người gọi và trả identity payload đúng khuôn login (`identityPayload` của từng bề mặt). Guard ability của nhóm route chặn sẵn token `select` / `invitation` và token khác bề mặt bằng 403. Thêm `ProfileLocaleTest` (7 test: staff cập nhật + thông điệp API sau đó theo locale mới, Portal cập nhật, locale sai/thiếu → 422, guest → 401, token chéo bề mặt → 403, token select/invitation → 403). Toàn bộ PHPUnit 252 test / 1526 assertions xanh trên SQLite + MySQL 8; Pint PASS.
- Blocked by: —
- Acceptance Criteria: PATCH locale hợp lệ → 200 + locale được lưu + response đúng khuôn identity payload; locale không hỗ trợ hoặc thiếu → 422 VALIDATION_FAILED; token phạm vi hẹp (select/invitation) và token khác bề mặt bị chặn 403; toàn bộ PHPUnit xanh trên SQLite + MySQL; Pint PASS.
- Handoff: OpenCode QA review, KHÔNG tự review, KHÔNG merge. FE-025 (toggle ghi xuyên + đăng nhập áp locale đã lưu) soạn prompt sau khi BE-013 merge.

---

## FIX-045 — Email lời mời chịu lỗi transport (không 500 thao tác chính)
- Assignee: Backend (Muse) · Level: L2 · Status: IN_PROGRESS
- Branch: fix/FIX-045-invitation-mail-resilience
- Progress: Bọc try/catch quanh điểm gửi mail dùng chung `InvitationController::sendMail` (áp cho cả store + resend) và điểm gửi inline trong `ClientPortalAccountController::store` (cấp Portal qua lời mời): lỗi transport bị nuốt + ghi `Log::warning` kèm invitation_id/recipient/error theo mẫu Notifier; thao tác chính trả response thành công như cũ, lời mời giữ trạng thái pending để gửi lại khi mail hồi phục. Thêm `InvitationMailResilienceTest` (3 test: store staff, resend, portal grant — mail hỏng vẫn 201/200 và lời mời tồn tại ở trạng thái pending).
- Blocked by: —
- Acceptance Criteria: Gửi lời mời / gửi lại / cấp Portal khi mail transport hỏng vẫn trả response thành công và lời mời tồn tại; toàn bộ PHPUnit xanh trên SQLite + MySQL; Pint PASS.
- Handoff: OpenCode QA review, KHÔNG tự review, KHÔNG merge.

---

## FIX-044 — Gửi hoá đơn từ danh sách bị chặn sai + vị trí báo lỗi (Nhóm 8, vòng cuối)
- Assignee: Frontend (Muse thay vai theo convention 2026-11-23) · Level: L2 · Status: DONE
- Branch: fix/FIX-044-invoice-send-list-fix
- Nguồn: nghiệm thu vòng cuối của PO (2026-11-28): FIX-043 đạt 3/4, mục Invoices chưa đạt. Nguyên nhân gốc tìm thấy khi PO chất vấn: trang danh sách Invoices có bước kiểm tra trước phía client dựa vào `invoice.items`, nhưng API danh sách (`InvoiceController::index`) KHÔNG nạp items (chỉ `client/project/agency`; `InvoiceResource` chỉ xuất items khi đã nạp — vốn chỉ có ở trang chi tiết) → `items` rỗng với MỌI dòng → bước kiểm tra chặn Send của mọi hoá đơn ngay tại client, API không bao giờ được gọi; trang chi tiết gọi thẳng API (API đếm items thật trong DB) nên gửi bình thường. FIX-043 mới sửa lớp hiển thị nên chưa chạm tới lỗi này. PO chốt thêm quy ước: lỗi thao tác ở trang danh sách hiện ở vùng báo lỗi PHÍA TRÊN bảng, không inline trong dòng/bảng (gây xê dịch UI).
- Nội dung: (1) bỏ hẳn bước kiểm tra items phía client ở danh sách — API là nguồn sự thật duy nhất; (2) xoá cơ chế inlineErrors trong bảng/thẻ — lỗi Send/Cancel/Delete hiện ở vùng lỗi đầu trang, map theo mã lỗi sang thông điệp bản địa hoá (INVOICE_EMPTY, INVOICE_NOT_EDITABLE, CANNOT_CANCEL_INVOICE, CANNOT_DELETE_INVOICE), fallback dùng khóa *Failed bản địa hoá; (3) trang chi tiết hoá đơn: các catch Send/Cancel/Delete (và load/xoá payment/PDF) cũng map mã lỗi/fallback bản địa hoá thay vì để lọt message thô của API.
- Acceptance Criteria: tsc/build/Vitest xanh; i18n parity + quét khóa lơ lửng bản đúng NONE missing (không thêm khóa mới — dùng lại Finance.errors hiện có); PO kiểm lại: Send từ danh sách chạy được với hoá đơn có dòng hàng; hoá đơn trống thật thì lỗi bản địa hoá hiện phía trên bảng, bảng không xê dịch.

## FIX-043 — Sửa nghiệm thu Nhóm 8 vòng 1 (raw error code ở Invoices, Reports)
- Assignee: Frontend (Muse thay vai theo convention 2026-11-23) · Level: L2 · Status: DONE
- Branch: fix/FIX-043-group8-acceptance-fixes
- Nguồn: nghiệm thu Nhóm 8 vòng 1 của PO (2026-11-28, đạt 90%) — 4 mục: (1) danh sách Invoices hiện lỗi dạng `INVOICE_EMPTY: <message>` (rò mã lỗi thô trước thông điệp đã bản địa hoá ở cả desktop + mobile; nhánh API của Send và fallback Delete/Cancel còn để lộ message thô của API); (2) Reports tab Revenue chọn From sau To thì hiện message validation tiếng Anh chung chung của API; (3) mở thẳng `/reports?tab=clients` vẫn vào tab Revenue (tab khởi tạo bị chốt trước khi session/quyền tải xong); (4) card mobile ở tab Projects của Reports tràn ngang (thiếu `min-w-0` ở card + hàng tiêu đề như card trang Projects; tab Clients cùng khuôn nên sửa luôn).
- Nội dung: bỏ tiền tố mã lỗi khi render inline error ở Invoices + map INVOICE_EMPTY ở nhánh catch của Send + fallback bản địa hoá cho Delete/Cancel; Reports — chặn From > To và khoảng > 24 tháng ngay phía client với thông điệp cụ thể đã bản địa hoá (khóa mới `Reports.revenue.errors.fromAfterTo` / `rangeTooLong`), 422 từ server cũng hiện bản địa hoá; khởi tạo tab Reports sau khi session sẵn sàng để tôn trọng `?tab=`; bổ sung `min-w-0`/`shrink-0` cho card mobile Projects + Clients của Reports.
- Acceptance Criteria: tsc/build/Vitest xanh; i18n parity + quét khóa lơ lửng bản đúng NONE missing; PO nghiệm thu nhanh vòng cuối trên 4 điểm đã sửa.

## FIX-042 — Sửa findings QA-009 vòng 1 cho BE-012 (Nhóm 8)
- Assignee: Backend (Muse) · Level: L2 · Status: DONE
- Branch: fix/FIX-042-analytics-qa-fixes
- Contract: docs/ANALYTICS_CONTRACT.md (DEC-029)
- Progress: QA-009 vòng 1 kết luận FAIL với 2 finding blocking; task này sửa cả hai, kèm finding non-blocking N1 và các test còn thiếu theo §7 của hợp đồng. (B1) Tràn tháng Carbon: phép cộng/trừ tháng chưa neo `startOfMonth()` tại AnalyticsController (biên tháng này/tháng trước của section sales; cửa sổ 6 tháng của section finance) và ReportController (cửa sổ mặc định của báo cáo doanh thu) khiến ngày 29–31 tràn sang tháng sai — cửa sổ 6 tháng co còn 5 tháng và overview trả 500 vì thiếu phần tử series; nay neo `startOfMonth()` trước mọi phép dịch tháng, kèm test travelTo tại 2026-01-31, 2026-03-31, 2026-07-31 cho cả overview và cửa sổ mặc định của revenue report. (B2) `/reports/projects` chưa áp phạm vi dữ liệu: Team Member nhận toàn bộ dự án kèm budget/invoiced/collected của agency; nay áp scope `visibleTo` như danh sách dự án (DEC-016), eager-load thêm quan hệ `agency` cho resource (khử N+1 ở is_overdue), kèm test hai chiều — Team Member chỉ thấy dự án mình tham gia, Owner thấy tất cả. (N1) collected tại báo cáo clients từng loại payment trên invoice cancelled, lệch định nghĩa §2; nay bỏ bộ lọc trạng thái invoice để khớp RevenueReport, kèm test biên dựng bằng factory (trạng thái cancelled-có-payment không tạo được qua API theo FINANCE_CONTRACT §4.3). Bổ sung test còn thiếu: Portal token (ability `portal`) gọi overview và một endpoint reports bị 403. Cần QA-009 rà soát lại vòng 2 trên PR của task này mới tính là PASS.
- Acceptance Criteria: PHPUnit xanh trên SQLite và MySQL 8, gồm các test mới (biên tràn tháng 29–31, phạm vi `/reports/projects`, nhất quán collected với invoice cancelled có payment, Portal token 403); Pint sạch trên các file chạm vào.
- Handoff: Mở PR ghi rõ số test; QA-009 vòng 2 rà soát trên PR này.
## FIX-041 — Chip trạng thái Portal + nền mềm cho comment và thành viên (UI)
- Assignee: Frontend (Muse thay vai FE theo convention 2026-11-23) · Level: L2 · Status: DONE
- Branch: fix/FIX-041-soft-ui-chips
- Progress: Theo rà soát của PO: (1) chip trạng thái ở section Tài khoản Portal (chi tiết khách hàng) đang dùng màu trơn `border-border` cho cả hai trạng thái — đổi sang màu ngữ nghĩa dùng chung `statusBadgeClass` (active = xanh lá mềm, inactive = đỏ mềm như bản đồ màu hiện có); (2) comment trong chi tiết công việc còn viền lồng viền và thiếu avatar — bỏ viền từng comment, dùng một nền mềm thống nhất `bg-muted/50` cho mọi comment (PO chốt: không tô màu theo từng người vì Owner/Admin/PM cùng comment sẽ rối), thêm Avatar + tên người comment và ngày cạnh tên; (3) tương tự ở danh sách thành viên trong chi tiết Nhóm: bỏ viền từng dòng, nền mềm `bg-muted/50`, thêm Avatar + tên/email, nút Gỡ thành viên đổi từ chữ đỏ trơn sang nút danger-soft (nền đỏ nhạt, viền đỏ, chữ đỏ đậm, icon x) đúng quy tắc nút nguy hiểm.
- Acceptance Criteria: tsc/build/Vitest xanh, i18n parity giữ nguyên (không thêm khoá); PO nghiệm thu trực quan.
- Handoff: Mở PR, chờ PO merge (QA-009 đang chạy độc lập trên BE-012, không liên quan).

## BE-012 — Analytics & Reporting API (Nhóm 8)
- Assignee: Backend (Muse) · Level: L3 · Status: DONE
- Branch: be/BE-012-analytics-api
- Contract: docs/ANALYTICS_CONTRACT.md (DEC-029)
- Progress: Đã triển khai xong cả 5 endpoint theo hợp đồng, chờ QA-009 rà soát: `GET /analytics/overview` (payload theo section sales/projects/finance, section không có quyền thì bỏ hẳn khỏi payload; khi không có section nào thì chỉ trả section `personal` với số task của chính mình), `GET /reports/revenue` (theo tháng, lọc khoảng ngày, mặc định 6 tháng, tối đa 24 tháng), `GET /reports/projects` (tiến độ %, quá hạn, đã thu so với ngân sách — dùng lại phép tính của ProjectResource qua các method trên model Project), `GET /reports/clients` (doanh thu theo client), `GET /reports/revenue/export` (CSV phía server, cùng một đường truy vấn `App\Support\RevenueReport` với báo cáo JSON và section finance của overview). Định nghĩa doanh thu theo §2 của hợp đồng: đã thu theo `payments.paid_on`, đã xuất hoá đơn trừ cancelled (draft vẫn tính theo §7), công nợ là snapshot trên invoice Sent/Overdue; không thêm khoá quyền mới, không cache, không migration. Test: 15 test mới trong `tests/Feature/Analytics/`; toàn bộ suite 228 test PASS trên cả SQLite và MySQL 8 (1377 assertions), `migrate:fresh` sạch trên MySQL, Pint sạch. Hai điểm kỹ thuật đáng lưu ý: (1) section được quyết bằng `hasPermission` đúng §4 của hợp đồng, và phạm vi của section `projects` đi theo phạm vi dữ liệu của vai trò (điểm mở về Team Member đã được PO chốt theo bản bổ sung DEC-029 ngày 2026-11-28): section mang trường `scope` — người xem không bị giới hạn (cơ sở `Project::scopeVisibleTo`) nhận `scope: "agency"` với số liệu toàn agency, Team Member nhận section projects với `scope: "mine"`, mọi con số chỉ tính trên các dự án mình là thành viên (`project_members`); chỉ membership không có cả ba quyền xem mới rơi vào `personal`; (2) lỗi validation của khoảng ngày đi qua ValidationException nên mang mã chuẩn của hệ thống là `VALIDATION_FAILED` (hợp đồng viết `VALIDATION_ERROR` nhưng ghi chú "standard shape" — shape và HTTP 422 giữ nguyên).
- Acceptance Criteria: PHPUnit xanh trên SQLite và MySQL 8, gồm test: bỏ section theo từng tập quyền, trường hợp chỉ có `personal`, biên tháng theo múi giờ agency khác UTC, delta null khi tháng trước bằng 0, nội dung CSV (header, tháng điền 0, dòng total), 403 trên các endpoint reports, cô lập cross-tenant. Pint sạch.
- Handoff: Mở PR, ghi rõ số test; QA-009 rà soát sau khi PR mở.

## QA-009 — Rà soát BE-012 Analytics & Reporting (Nhóm 8)
- Assignee: QA Review & Tester (OpenCode) · Level: L2 · Status: DONE
- Branch: qa/QA-009-analytics-review
- Contract: docs/ANALYTICS_CONTRACT.md (DEC-029)
- Progress: ⏸ chờ BE-012 mở PR. Rà soát độc lập theo hợp đồng: đối chiếu định nghĩa số liệu §2 với code (đặc biệt: draft được tính vào invoiced là hành vi đã tài liệu hoá, không phải bug), section bị bỏ theo quyền, `personal` chỉ xuất hiện khi không có section thật nào, CSV khớp số liệu JSON trên cùng dữ liệu, cô lập tenant.
- Acceptance Criteria: Báo cáo PASS/FAIL có bằng chứng (test tự chạy lại trên SQLite + MySQL, kiểm tra tay bằng curl với các tài khoản demo khác vai trò); mọi finding phân loại blocking / non-blocking rõ ràng.
- Handoff: PASS là điều kiện để soạn prompt FE-024.

## FE-024 — Dashboard số liệu + trang Reports (Nhóm 8)
- Assignee: Frontend (OpenCode; Muse thay vai khi cần theo convention 2026-11-23) · Level: L3 · Status: DONE
- Branch: fe/FE-024-analytics-ui
- Contract: docs/ANALYTICS_CONTRACT.md (DEC-029)
- Progress: ✅ FE-024 implemented: dashboard sections from /analytics/overview (sales/projects/finance/personal), CSS bar chart, /reports with 3 tabs, Revenue/Projects/Clients reports, CSV export via BFF, nav item Reports, i18n EN+VI. tsc/build/Vitest pass.
  (legacy note) ⏸ chờ BE-012 merge + QA-009 PASS. Phạm vi: `/dashboard` thành dashboard số liệu (header chào gọn, thẻ số liệu + biểu đồ cột CSS vẽ tay cho chuỗi 6 tháng, section nào API không trả thì không render, skeleton đúng khuôn lưới thẻ); trang `/reports` (mục Reports ở sidebar) với 3 tab Revenue / Projects / Clients — tab nào 403 thì ẩn, không tab nào dùng được thì hiện trạng thái Forbidden dùng chung; tab Revenue có lọc khoảng ngày + nút xuất CSV; mọi chuỗi qua i18n EN + VI (namespace `Analytics` / `Reports`), trạng thái project hiển thị bằng chip đã bản địa hoá như hiện tại.
- Acceptance Criteria: tsc/build/Vitest xanh, i18n parity và quét khoá lơ lửng (bản quét đúng, khớp cả lời gọi có tham số) không thiếu khoá; đối chiếu UI_GUIDELINES (một cấp viền, chip một dòng, nút có icon dẫn đầu, skeleton §9); nghiệm thu trực quan của PO trên dữ liệu demo.
- Handoff: Mở PR kèm ảnh chụp các section theo từng vai trò (Owner, Sales, PM, Accountant, Member) để PO đối chiếu phân quyền bằng mắt.

## FIX-040 — Bố cục header chi tiết & căn hàng icon thao tác (Nhóm 7)
- Assignee: Frontend (Muse thay vai FE theo convention 2026-11-23) · Level: L3 · Status: DONE
- Branch: fix/FIX-040-detail-actions-layout
- Progress: Theo feedback nghiệm thu của PO trên FIX-039: (1) dòng Milestone: khối tên thành flex-1 và cụm mắt + kebab gom về cạnh phải trong một flex chung, nút mắt dùng đúng khuôn nút của ActionMenu (p-1.5, icon 16px) — hết cảnh icon Eye trôi giữa card do justify-between; (2) trang chi tiết công việc bỏ hẳn kebab ở header (dropdown chỉ dành cho row/card dữ liệu) — thao tác hiện đầy đủ thành nút: nút bật/tắt hiển thị Portal (icon + nhãn theo trạng thái) và nút Xoá danger-soft (nền đỏ nhạt, viền đỏ, chữ đỏ đậm, icon thùng rác); header xếp lại theo tầng: hàng nút Quay lại, hàng tiêu đề + chip trạng thái, hàng nút thao tác — hết vỡ bố cục mobile; (3) dòng file ở Portal Section: nút mắt và nút ba chấm nằm chung một flex items-center, nút mắt dùng đúng khuôn p-1.5 như nút mở menu nên hai icon ngang hàng tuyệt đối trên desktop (mobile giữ nguyên như FIX-039); (4) hai quy ước mới của PO ghi vào UI_GUIDELINES §14 (đối xứng thao tác row/card ↔ chi tiết, chi tiết hiện nút đầy đủ) và §15 (nút Back ở trang chi tiết chỉ là nút dạng chữ) — đồng thời chuẩn hoá ngay các nút Back còn dạng hộp viền theo §15: chi tiết thành viên, chi tiết nhóm, chi tiết công việc, form hoá đơn (các trang chi tiết còn lại đã là nút chữ).
- Blocked by: —
- Acceptance Criteria: Icon Eye ở Milestone dính cạnh phải cùng kebab; header chi tiết công việc hiển thị đủ nút thao tác, mobile không vỡ; icon Eye ở dòng file ngang hàng với nút ba chấm trên desktop.
- Handoff: Muse tự làm theo convention thay vai FE; PO nghiệm thu trực quan + merge, Muse không tự merge.

---
## FIX-039 — Đồng bộ trạng thái hiển thị Portal & thẻ card mobile (Nhóm 7)
- Assignee: Frontend (Muse thay vai FE theo convention 2026-11-23) · Level: L3 · Status: DONE
- Branch: fix/FIX-039-visibility-sync
- Progress: Theo feedback nghiệm thu cuối của PO trên FIX-038: (1) thêm khoá `Projects.portal.clientHidden` EN+VI — chip trạng thái Portal hết lệch icon/nhãn (trước đây trạng thái ẩn hiện "—"); nhãn mục bật/tắt trong mọi dropdown nay theo trạng thái (đang hiện → "Ẩn trên Portal" + icon eye-off, đang ẩn → "Hiển thị trên Portal" + icon eye); (2) thẻ công việc mobile sắp xếp lại theo khuôn dòng file của Portal Section — tiêu đề, dòng meta avatar + tên người được gán đậm + hạn, hàng chip gọn bên dưới; bảng desktop giữ nguyên; (3) trang chi tiết công việc thêm chip trạng thái hiển thị Portal cạnh tiêu đề, bên cạnh kebab đã có từ FIX-038; (4) dòng file ở Portal Section: nhãn trạng thái luôn hiển thị kèm icon đồng bộ, nút mắt chỉ còn ở desktop (lg+), trên mobile thao tác ẩn/hiện nằm trong dropdown; (5) rà soát toàn bộ dropdown menu theo yêu cầu PO — menu thao tác của danh sách Hoá đơn (buildActions động theo trạng thái) là nơi duy nhất còn thiếu icon: bổ sung eye/send/x/trash-2/download cho Xem/Gửi/Huỷ/Xoá/Tải PDF; các menu còn lại đã có đủ icon từ FIX-037.
- Blocked by: —
- Acceptance Criteria: Chip Portal ở card task mobile và dòng file luôn khớp icon + nhãn với trạng thái thật; dropdown bật/tắt ghi rõ hành động theo trạng thái; chi tiết công việc thấy trạng thái Portal ngay ở header; mobile không còn nút mắt lệch hàng ở tab File.
- Handoff: Muse tự làm theo convention thay vai FE; PO nghiệm thu trực quan + merge, Muse không tự merge.

---
## FIX-038 — Hoàn thiện nghiệm thu vòng 2 (Nhóm 7) + phân trang danh sách
- Assignee: Frontend (Muse thay vai FE theo convention 2026-11-23) · Level: L3 · Status: DONE
- Branch: fix/FIX-038-acceptance-polish
- Progress: Ba điểm nghiệm thu vòng 2 của PO: (1) trang chi tiết công việc có đủ thao tác như row bên ngoài (menu kebab ở header: bật/tắt hiển thị Portal + Xoá, gate theo can_act + quyền tasks.update/tasks.delete); (2) tab File ở mobile hết vỡ layout — tên file truncate trong cột min-w-0, tên người tải font-semibold, thao tác Tải xuống/Xoá đưa vào menu dropdown, nút mắt ẩn/hiện Portal giữ nguyên trên card (áp dụng cả Portal); (3) tab Phê duyệt bỏ lồng viền — form tạo chuyển nền mềm bg-muted/30, danh sách phê duyệt chuyển divide-y không khung. Cộng yêu cầu bổ sung của PO: phân trang đầy đủ cho các danh sách — Clients/Members/Teams/Invitations có Pagination hoàn chỉnh (helper Page-variant trả meta, reset về trang 1 khi đổi bộ lọc), bảng Kanban Leads tải per_page=100 (board gom theo stage nên không dùng page controls), toàn bộ danh sách con (tasks, milestones, files/comments/approvals/history ở cả hai phía, checklist, task comments, contacts, notes, activities, payments, portal invoices, tags, directory users) tải per_page=100 thay vì bị cắt ở mặc định 15 của API.
- Blocked by: —
- Acceptance Criteria: Chi tiết công việc có kebab Xoá + ẩn/hiện Portal; tab File hiển thị đúng ở 375px ở cả hai phía; tab Phê duyệt không còn viền lồng; Clients/Members/Teams/Invitations chuyển trang được và không mất bản ghi sau trang 1; không còn danh sách nào bị cắt ở 15 bản ghi.
- Handoff: Muse tự làm theo convention thay vai FE; PO nghiệm thu trực quan + merge, Muse không tự merge.

---
## FIX-049 — Ngôn ngữ đã lưu thua cuộc đua điều hướng sau đăng nhập
- Assignee: Frontend (OpenCode) · Level: L2 · Status: IN_PROGRESS
- Branch: fix/FIX-049-stored-locale-navigation
- Nguyên nhân gốc: applyStoredLocale fires router.replace locale inside login context, then form login fires router.replace(target) without locale → second wins; nothing reapplies saved locale after landing.
- Progress: S1 — LoginForm/PortalLoginForm pass locale from login payload on post-login replace; select-agency passes locale from returned session; keep applyStoredLocale; added loginNavOptions helper + test. S2 — test for navigation options.
- Blocked by: FE-025 (PR #132 merged 6994b4b)
- Acceptance Criteria: TH1/TH2 correct; locale source documented; no behavior break; tsc/build/vitest PASS.
- Handoff: Muse review + open PR; PO retests TH1/TH2. KHÔNG tự merge.

---

## FE-025 — Ngôn ngữ đi theo tài khoản (persist locale + apply on session start)
- Assignee: Frontend (OpenCode) · Level: L2 · Status: IN_PROGRESS
- Branch: fe/FE-025-locale-persistence
- Progress: S1 — BFF PATCH profile routes + updateProfileLocale helpers; S2 — LanguageToggle ghi xuyên khi có session; S3 — auth context áp locale đã lưu khi session set.
- Blocked by: BE-013 (PR #131 merged)
- Acceptance Criteria: toggle ghi về account; login/khôi phục session áp locale đã lưu; chỉ replace khi khác; giữ pathname+query; không phá accept/returnTo; unauth không áp; tsc/build/vitest PASS.
- Handoff: Muse review, KHÔNG tự review, KHÔNG merge, KHÔNG mở PR.

---

## FIX-047 — Portal accept refetch dứt điểm (refetch invitation preview sau login nhúng)
- Assignee: Frontend (OpenCode) · Level: L2 · Status: IN_PROGRESS
- Branch: fe/FIX-047-portal-accept-refetch
- Progress: S1 — thêm prop onInvitationLogin cho LoginForm/PortalLoginForm, gọi trong nhánh invitationOnly; trang accept Portal + nội bộ tăng refreshKey và đưa vào deps của effect fetch preview. S2 — sửa interpolation subtitle Portal accept (truyền agency từ preview).
- Blocked by: —
- Acceptance Criteria: Portal accept tự chuyển trạng thái sau login nhúng; subtitle không hiện thô; tsc/build/vitest PASS; parity i18n; JSON parse OK.
- Handoff: Muse review, KHÔNG tự review, KHÔNG merge, KHÔNG mở PR.

---

## FIX-046 — Post-acceptance fixes (Portal accept state, localized validation, login trim, invite pending state)
- Assignee: Frontend (OpenCode) · Level: L2 · Status: IN_PROGRESS
- Branch: fe/FIX-046-acceptance-followups
- Progress: Đang thực hiện S1–S4: (1) Portal accept auto-refetch on session change, (2) localized validation errors + Common.errors.validationFailed, (3) trim email/password on login, (4) invite modal pending state.
- Blocked by: —
- Acceptance Criteria: Portal accept tự chuyển trạng thái sau login; lỗi validation bản địa hoá; login trim khoảng trắng; nút mời có pending state; tsc/build/vitest PASS; parity i18n.
- Handoff: Muse review, KHÔNG tự review, KHÔNG merge, KHÔNG mở PR.

---

## FIX-037 — Polish UI Portal & icon hệ thống (Nhóm 7)
- Assignee: Frontend (OpenCode) · Level: L3 · Status: DONE
- Branch: fix/FIX-037-portal-ui-polish
- Progress: Đang thực hiện S1–S10: (1) Thêm Portal.tasksDone, (2) Approval card status chip + response block, (3) Discussion tab avatar + tên thật + tông nền, (4) History tab avatar + tên + fix "đã đã" + truncate, (5) Files tab dropzone + icon + uploader, (6) Section description, (7) Mobile toggle visibility, (8) Icon send, (9) Icon sweep, (10) Paperwork.
- Blocked by: —
- Acceptance Criteria: Approval card có chip trạng thái màu + khối phản hồi; Discussion/History dùng avatar + tên thật; Files có dropzone + icon + uploader; section description; mobile toggle; icon send; system-wide icon sweep; parity i18n.
- Handoff: Muse review, Không tự review, KHÔNG merge, KHÔNG mở PR.

---

## FIX-036 — Sửa lỗi nghiệm thu Nhóm 7 vòng 1
- Assignee: Frontend (OpenCode) · Level: L3 · Status: DONE
- Branch: fix/FIX-036-portal-acceptance-fixes
- Progress: Đang thực hiện các sửa S1–S5: (1) Hợp nhất route slug BFF Portal, (2) Bổ sung khoá i18n thiếu, (3) Sửa responsive section Client Portal, (4) Fix card team name ellipsis, (5) Quy ước nút mobile center. Kiểm chứng: tsc PASS, next build PASS, vitest PASS, i18n EN=VI, byte-check, manual 375px check.
- Blocked by: —
- Acceptance Criteria: Không còn cặp thư mục dynamic segment đồng tên, đủ 20 khoá i18n EN+VI, section Client Portal không tràn ngang 375px, tên nhóm ellipsis 1 dòng, nút full-width mobile có label centered, quy ước ghi trong UI_GUIDELINES.
- Handoff: Muse review, Không tự review, KHÔNG merge, KHÔNG mở PR.

---

## DOC-001 — Bootstrap repository documents & conventions
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: — (bootstrap trực tiếp lên `main` một lần duy nhất, xem DEC-007) · PR: —
- Blocked by: —
- Acceptance Criteria: 5 file bắt buộc (VERSION.md, TASK.md, CHANGELOG.md, README.md, DECISIONS.md) có mặt ở root với nội dung đã chốt; tài liệu Quy ước / Stack / Scope / RBAC-i18n nằm trong `docs/`; repo đọc lại được trên GitHub sau khi đẩy.
- Progress: Hoàn thành và đẩy lên `main` ngày 2026-11-20 (commit 05aa5b1), đã đọc lại xác minh trên GitHub. Chờ OpenCode review theo QA-001.
- Handoff: Sau khi xong, OpenCode review theo QA-001.

---
- Đóng task: DONE 2026-11-21 — QA PASS toàn phần, đóng cùng release 0.2.0 (OpenCode theo thẩm quyền QA).

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
- Assignee: OpenCode · Level: L1 · Status: DONE
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
- Đóng task: DONE 2026-11-21 — do Muse chuyển theo ngoại lệ F.2 (task của chính QA, QA không tự đóng); 2 finding đã xử lý ở PR #9.

## BE-003 — Auth, multi-tenancy & RBAC contract (design)
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: be/BE-003-auth-tenancy-rbac · PR: #8
- Blocked by: BE-002
- Acceptance Criteria: Đề xuất contract Auth (đăng ký/đăng nhập/token) + mô hình multi-tenancy `agency_id` + ma trận phân quyền chi tiết 7 vai trò được Muse soạn và Nguyen duyệt trước khi phổ biến cho Antigravity/OpenCode (quy trình mục E, Quy ước chung).
- Progress: Hợp đồng đã được Nguyen DUYỆT ngày 2026-11-20 (kèm 3 chốt tại DEC-008: email unique toàn hệ thống; token không đặt hạn cứng trong MVP; Portal có quên mật khẩu) và công bố tại `docs/AUTH_CONTRACT.md` (PR #4). Phần Backend đã triển khai xong: migrations agencies/roles/super_admins/client_accounts + users.agency_id/locale/is_active; trait BelongsToAgency (global scope theo agency của user đăng nhập, có chống đệ quy khi Sanctum đang nạp tokenable); AuthController + PortalAuthController (token tách ability `app`/`portal`, chặn chéo 403); chuẩn lỗi `{error:{code,message,details}}` + thông điệp EN/VI theo locale; rate limit login 5/phút; link reset mật khẩu trỏ về web app (FRONTEND_URL); seed roles + demo data opt-in (SEED_DEMO_DATA); OpenAPI sinh bằng Scramble tại `packages/contracts/openapi.json` (12 paths). Kiểm chứng tại máy Muse: `php artisan test` **19 passed** (gồm test từng mã lỗi, chặn chéo token, scope cross-tenant), Pint PASS, smoke test HTTP thật: login Owner/Portal đúng payload, token app gọi Portal bị 403 FORBIDDEN, sai mật khẩu với Accept-Language `vi` trả thông điệp tiếng Việt. Chưa kiểm chứng qua Docker (máy Muse không có Docker).
- Handoff: —

---
- Đóng task: DONE 2026-11-21 — QA-002 chạy thật PASS 17/17 API (gồm TC-AUTH-14/15 sau FIX-002); đóng cùng release 0.2.0.

## FE-002 — Internal app login (Auth contract implementation)
- Assignee: Google Antigravity · Level: L2 · Status: DONE
- Branch: fe/FE-002-login · PR: —
- Blocked by: — (hợp đồng `docs/AUTH_CONTRACT.md` đã duyệt — làm bằng mock, không chờ BE-003 code)
- Acceptance Criteria: Màn hình đăng nhập nội bộ gọi `POST /api/v1/auth/login` theo hợp đồng (mock trước, nối API thật khi BE-003 xong); lưu token an toàn phía client; route guard chặn trang nội bộ khi chưa đăng nhập; hiển thị lỗi theo mã lỗi chuẩn (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`); chuyển EN ↔ VI ngay tại màn login; không hardcode chuỗi hiển thị.
- Progress: —
- Handoff: Bắt đầu được ngay sau khi PR tài liệu BE-003 merge.

---
- Đóng task: DONE 2026-11-21 — luồng login đã được FE-004 nối API thật thay mock; QA E2E PASS; đóng cùng release 0.2.0.

## FE-003 — Client Portal login frame
- Assignee: Google Antigravity · Level: L2 · Status: DONE
- Branch: fe/FE-003-portal-login · PR: —
- Blocked by: — (hợp đồng đã duyệt — làm bằng mock)
- Acceptance Criteria: Khu vực Portal tách riêng tại route `/portal` với layout riêng; màn đăng nhập Portal gọi `POST /api/v1/portal/auth/login` (mock theo hợp đồng); token portal tách biệt token nội bộ (không dùng lẫn); trang tổng quan Portal trống (placeholder theo i18n) sau đăng nhập; EN/VI đầy đủ.
- Progress: Antigravity hoàn thành 2026-11-20: xây dựng khung Client Portal tại route /portal với layout riêng biệt, mock service theo docs/AUTH_CONTRACT.md (login, logout, me, forgot-password, reset-password), token portal_token tách biệt hoàn toàn với app_token, route guard cho Portal, i18n EN/VI đầy đủ (16 vitest tests PASS, tsc PASS, next build PASS). Đang mở PR.
- Handoff: Bắt đầu được ngay sau khi PR tài liệu BE-003 merge.

---
- Đóng task: DONE 2026-11-21 — QA E2E PASS trên bản mock theo hợp đồng Portal; đóng cùng release 0.2.0. (Nối API thật là task riêng sau này.)

## QA-002 — Auth & tenancy test coverage
- Assignee: OpenCode · Level: L1 · Status: DONE
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
- Đóng task: DONE 2026-11-21 — do Muse chuyển theo ngoại lệ F.2 (task của chính QA); kết quả chạy thật PASS 23/23 (API 17/17 + E2E 6/6) theo báo cáo OpenCode 2026-11-21.

## FIX-001 — MinIO image no longer on Docker Hub
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-001-minio-image · PR: —
- Blocked by: —
- Acceptance Criteria: `docker compose up` kéo được image MinIO (image `minio/minio` đã bị gỡ khỏi Docker Hub — phát hiện khi Nguyen chạy local lần đầu 2026-11-20); chuyển sang registry chính thức của MinIO tại Quay (`quay.io/minio/minio`); các service còn lại không đổi.
- Progress: Muse sửa 2026-11-20 trong PR này; chờ kiểm chứng bằng lần `docker compose up` đầy đủ tiếp theo tại máy Nguyen.
- Handoff: —

---

## FE-004 — Nối màn hình đăng nhập nội bộ vào API thật (BE-003)
- Assignee: Google Antigravity · Level: L3 · Status: DONE
- Branch: fe/FE-004-login-real-api · PR: #14
- Blocked by: — (BE-003 đã merge; FE-002 đã merge)
- Acceptance Criteria: thay `mockLogin()` bằng `POST /api/v1/auth/login` thật; lưu token và gọi được `GET /api/v1/auth/me` (user + roles + permissions); các mã lỗi của API (`INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`) hiển thị đúng banner đã làm ở FE-002, tôn trọng thông điệp song ngữ API trả về; logout gọi API và xoá token; cách lưu token phải ghi rõ trade-off bảo mật trong PR (ưu tiên httpOnly cookie qua route handler). Cập nhật TASK.md mục này + CHANGELOG.md [Unreleased] Frontend khi làm.
- Progress: Antigravity hoàn thành 2026-11-20: xây dựng BFF route handlers (/api/auth/login, /api/auth/logout, /api/auth/me) với httpOnly cookie app_token; nối POST /v1/auth/login + GET /v1/auth/me; map các mã lỗi chuẩn (INVALID_CREDENTIALS, AGENCY_LOCKED, ACCOUNT_DISABLED) và tôn trọng message song ngữ từ backend; cập nhật AuthContext, LoginForm và test suite (14 tests PASS, tsc PASS, next build PASS). Đang mở PR.
- Handoff: OpenCode review theo ma trận G.3; sau merge, QA-002 chạy thật phần E2E trên luồng này.

---
- Đóng task: DONE 2026-11-21 — QA E2E PASS + Nguyen nghiệm thu Luồng A ĐẠT 2026-11-21; đóng cùng release 0.2.0.

## BE-004 — Module Client (Nhóm 2) theo hợp đồng CLIENT_CONTRACT
- Assignee: Muse · Level: L3 · Status: IN_REVIEW
- Branch: be/BE-004-client-module · PR: https://github.com/DLoc03/agency-client-management-saas/pull/13
- Blocked by: — (hợp đồng đã duyệt, DEC-009)
- Acceptance Criteria: CRUD Client + Organization + Contacts; tags & bộ lọc phân đoạn; Client Notes nội bộ; cấp/khoá tài khoản Portal cho client (thêm FK `client_accounts.client_id → clients.id`); ma trận quyền clients.* theo hợp đồng; test Pest phủ cách ly tenant + ma trận quyền + luồng tạo tài khoản Portal đăng nhập được; OpenAPI cập nhật; Pint PASS.
- Progress: Hợp đồng duyệt 2026-11-20 (DEC-009, PR #12). Muse đã code xong trong PR này: 6 migrations (clients, organizations, contacts, client_notes, tags + client_tag, FK client_accounts.client_id), ma trận quyền clients.* theo DEC-009 (middleware permission tại API), 17 endpoints (clients CRUD + lọc status/tag/manager/q, contacts, notes, tags, portal-accounts), test: full suite 31 passed (12 test mới cho BE-004), Pint PASS, OpenAPI 21 paths. Kiểm chứng Docker/MySQL thật: nhờ OpenCode/Nguyen chạy lại migrate trên stack local khi review (máy Muse không có Docker).
- Handoff: OpenCode review theo ma trận G.3; Antigravity làm màn hình quản lý Client (task FE riêng) sau khi hợp đồng chốt, mock-first theo OpenAPI.

---

## FIX-002 — Token bị thu hồi trả 500 thay vì 401 + thiếu thư mục storage khi checkout sạch
- Assignee: Muse · Level: L2 · Status: DONE
- Branch: fix/FIX-002-auth-401-storage · PR: —
- Blocked by: —
- Acceptance Criteria: (1) Request API không gửi `Accept: application/json` (kiểu Playwright) với token đã thu hồi phải trả 401 `UNAUTHENTICATED`, không phải 500 — gốc lỗi: ApplicationBuilder mặc định của Laravel 12 đăng ký guest redirect gọi `route('login')` (route không tồn tại trong app API-only) ngay trong Authenticate middleware; sửa bằng `redirectGuestsTo` trả null + `shouldRenderJsonWhen` cho `api/*`, KHÔNG thêm route login. Có test hồi quy riêng. (2) Checkout sạch phải có `storage/framework/{views,cache,sessions,testing}` + `storage/logs` (thêm `.gitkeep`) để forgot/reset-password không còn 500 "valid cache path". (3) Kèm DEC-010 (chuẩn hoá field reset-password = `password`, sửa AUTH_CONTRACT) và DEC-011 (chuyển vai FE sang OpenCode) theo quyết định của Nguyen 2026-11-21.
- Progress: Muse sửa xong trong PR này — test hồi quy mới PASS, full suite 32 passed, Pint PASS. Chờ OpenCode review; sau merge, QA chạy lại TC-AUTH-14/15 để xác nhận finding 1 đóng.
- Handoff: OpenCode review theo ma trận G.3 (PR Backend của Muse → OpenCode).

---
- Đóng task: DONE 2026-11-21 — TC-AUTH-14/15 chạy lại PASS; đóng cùng release 0.2.0.

## FIX-003 — MinIO image không còn public (Docker Hub + Quay đều chặn) — đưa MinIO ra khỏi stack mặc định
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-003-minio-optional · PR: #20
- Blocked by: —
- Acceptance Criteria: `docker compose up -d --build` trên máy sạch chạy được mà không cần kéo image MinIO: service minio chuyển sau profile `storage` (bật thủ công bằng `--profile storage` khi có quyền truy cập image), `api` bỏ `depends_on` vào minio (chưa tính năng nào dùng S3 ở giai đoạn này). Khi module File (Nhóm 7) bắt đầu, chọn lại giải pháp S3 self-host còn được phân phối công khai và ghi quyết định mới.
- Progress: Muse sửa trong PR này sau khi Nguyen chạy nghiệm thu Mốc 1 bị chặn bởi lỗi 401 từ quay.io (Muse đã tự kiểm chứng: Quay trả 401 ngay cả với token pull ẩn danh — MinIO đã rút toàn bộ image công khai miễn phí). Workaround trước mắt cho máy đang chạy: `docker compose up -d mysql redis mailpit` rồi `docker compose up -d --build --no-deps api web`.
- Handoff: OpenCode review theo ma trận G.3.

---

## FE-005 — Áp dụng hướng thiết kế DEC-013 vào khung ứng dụng nội bộ
- Assignee: OpenCode · Level: L3 · Status: DONE
- Branch: — · PR: —
- Blocked by: PR #19 merge (DEC-013 chính thức có hiệu lực trên main)
- Acceptance Criteria: Khung ứng dụng nội bộ theo mẫu A — Classic Sidebar (DEC-013) với design tokens thống nhất trên shadcn/ui + Tailwind; tuân thủ toàn bộ docs/UI_GUIDELINES.md (responsive nhiều bề rộng, không scroll ngang cho bảng dữ liệu lớn, tương phản chữ, chip/badge một dòng, min-height và empty state giữ khung). Tự kiểm ở ít nhất 3 bề rộng màn hình và báo cáo rõ; Nguyen nghiệm thu UI bằng mắt. Mẫu D (Pipeline) cho CRM và hơi hướng C cho Portal áp dụng ở các task màn hình tương ứng sau này, không thuộc task này.
- Progress: Implemented internal app shell (route group (app)/dashboard) with Classic Sidebar, design tokens in globals.css (shadcn-style CSS variables + Tailwind v4 theme), responsive AppShell (desktop sidebar + mobile drawer), Topbar, role chips (single line), stat cards with min-height, empty state. Self-check: tsc --noEmit PASS; pnpm build PASS (en/vi dashboard routes); vitest 24/24 PASS. Responsive classes reviewed for 3 representative widths (mobile 390px drawer, tablet 768px, desktop 1280px) - sidebar collapses to hamburger below md, content grid adapts sm:grid-cols-2 lg:grid-cols-4, no horizontal overflow at shell level. Browser screenshot not available in this environment; verified via build + class review.
- Handoff: OpenCode (vai Frontend, DEC-011); Muse review chéo theo ma trận (OpenCode không tự review code FE của mình).

---

## BE-005 — Module CRM/Lead (Nhóm 1) theo hợp đồng CRM_CONTRACT
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: be/BE-005-crm-lead · PR: —
- Blocked by: PR #19 merge (hợp đồng CRM_CONTRACT + DEC-014 chính thức trên main)
- Acceptance Criteria: Đủ endpoints và quy tắc trong docs/CRM_CONTRACT.md: leads CRUD + lọc, pipeline-summary, convert Lead → Client (tạo Client + Organization + Contact, nối lại contacts, khoá sửa lead, 409 khi convert lại, 422 chống trùng kèm force), lead notes, lead activities + due list, contacts dùng chung (lead_id), ma trận quyền leads.* theo DEC-014, cách ly tenant. Test: bộ test Feature cho module Lead đạt, Pint PASS, OpenAPI cập nhật.
- Progress: Hợp đồng đã được Nguyen duyệt và công bố trong PR #19 (DEC-014). Muse đã triển khai xong trong PR này: 5 migration, leads CRUD + pipeline-summary + convert, notes, activities + due list, contacts dùng chung; bộ test toàn cục 52 passed, Pint PASS, OpenAPI 32 paths.
- Handoff: OpenCode review theo ma trận G.3.

## FIX-005 — Response tạo mới không phản ánh giá trị mặc định của DB (status/author/is_active trống)
- Assignee: Muse · Level: L1 · Status: IN_REVIEW
- Branch: fix/FIX-005-response-defaults · PR: —
- Blocked by: —
- Acceptance Criteria: Các response POST (tạo client, client note, portal account — và rà soát toàn bộ module BE-003/BE-004) trả về đúng giá trị thực trong DB (status=active, author, locale, is_active) bằng cách nạp lại model/quan hệ trước khi trả resource. Phát hiện khi Nguyen nghiệm thu Mốc 1 Luồng C: dữ liệu DB đúng, chỉ response hiển thị trống. Kèm test hồi quy cho ít nhất endpoint tạo client.
- Progress: Muse hoàn thành: refresh model sau khi tạo ở ClientController, ClientPortalAccountController, ClientContactController, ClientNoteController; test hồi quy CreateResponseDefaultsTest (4 test) — trước fix fail 3/4, sau fix đạt cả bộ 52 test.
- Handoff: OpenCode review theo ma trận G.3.
## FIX-004 — Web container thiếu INTERNAL_API_URL — mọi login qua BFF đều "fetch failed" / 500
- Assignee: Muse · Level: L2 · Status: IN_REVIEW
- Branch: fix/FIX-004-web-internal-api-url · PR: #21
- Blocked by: —
- Acceptance Criteria: Trong Docker, đăng nhập nội bộ (đúng và sai mật khẩu) trả đúng kết quả của API (200 / 401 kèm mã lỗi) thay vì 500 "fetch failed": thêm `INTERNAL_API_URL: http://api:8000/api` vào environment của service web trong docker-compose.yml. Nguyên nhân: `getBackendApiUrl()` (FE-004) ưu tiên INTERNAL_API_URL nhưng compose chưa hề set biến này, nên BFF rơi về NEXT_PUBLIC_API_URL/localhost — bên trong container web, localhost là chính container web, kết nối bị từ chối trước khi API kịp kiểm tra mật khẩu. Phát hiện khi Nguyen nghiệm thu Mốc 1 (A1/A2 đều 500 kể cả mật khẩu đúng). Ghi chú review: nhận xét của OpenCode ở PR #14 cho rằng INTERNAL_API_URL "đã set" là chưa chính xác — biến này không tồn tại ở cả compose lẫn code ngoài hàm đọc.
- Progress: Muse sửa trong PR này. PR được merge theo NGOẠI LỆ L5 do Nguyen duyệt ngày 2026-11-21 (để gỡ chặn nghiệm thu Mốc 1; OpenCode review bù sau merge).
- Handoff: OpenCode review bù theo ma trận G.3.

---

## FIX-006 — Compose hardening: ổ đĩa mặc định local + web chờ api khoẻ (từ review bù FIX-003/FIX-004)
- Status: DONE
- Assignee: Muse · Reviewer: OpenCode
- Mô tả: Hai finding hạ tầng từ đợt review bù của OpenCode: (1) compose mặc định để `FILESYSTEM_DISK: s3` + env AWS trỏ MinIO trong khi MinIO không chạy ở stack mặc định (FIX-003) — bất kỳ luồng ghi file nào trong tương lai sẽ lỗi khó hiểu; đổi mặc định sang `local`, S3 quay lại cùng quyết định storage ở Nhóm 7. (2) `web depends_on: api` chưa có điều kiện sẵn sàng (FIX-004) — thêm healthcheck cho api (đánh `/api/v1/health` bằng php) và để web chờ `condition: service_healthy`.
- Acceptance Criteria: `docker compose up -d --build` chạy như cũ trên máy Nguyen; web chỉ start sau khi api trả health 200; không đổi hành vi nào khác.
- Progress: 2026-11-21 — Muse triển khai (docker-compose.yml) sau khi Nguyen merge xong 4 PR #24–#27; chờ OpenCode review.
- Blockers: Không có.

## FIX-007 — Dọn file rác Blade compiled view lọt vào main qua PR #29
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: File sinh tự động `apps/api/storage/framework/views/275c7c02e2528e6029079c885e2d2418.php` (Blade view đã biên dịch) bị môi trường của OpenCode commit nhầm vào branch FE-005 và đã vào main khi PR #29 merge. Xoá khỏi repo; thư mục views chỉ giữ `.gitkeep` như thiết kế (FIX-002). File này vô hại khi chạy (Laravel tự biên dịch lại) — đây thuần tuý là vệ sinh repo theo đề xuất của Muse, được Nguyen duyệt sau merge.
- Acceptance Criteria: File không còn trên main sau khi PR này merge; `storage/framework/views/` chỉ còn `.gitkeep`.
- Progress: 2026-11-21 — Muse đã xoá trên branch `fix/FIX-007-cleanup-compiled-view`; chờ Nguyen merge.
- Blockers: Không có.

## FIX-008 — Hai finding FE-009 từ QA-005: thiếu key `Shell.nav.team` + label accept-invitation chưa gắn input
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: QA-005 ghi nhận 2 lỗi nhỏ không chặn của FE-009: (1) `apps/web/messages/{en,vi}.json` thiếu key `Shell.nav.team` khiến Sidebar log `MISSING_MESSAGE` trên mọi trang Team; (2) form `accept-invitation` dùng `<label>` rời không `htmlFor`/id, phá truy cập theo label (accessibility + E2E `getByLabel`). Muse xử lý theo quy ước thay vai FE (PO chốt 2026-11-23): bổ sung `Shell.nav.team` (EN "Team" / VI "Nhóm"), gắn `htmlFor` + `id` cho 2 cặp label/input (accept-name, accept-password).
- Acceptance Criteria: Mở trang Team không còn log MISSING_MESSAGE cho `Shell.nav.team`; `getByLabel` truy cập được 2 ô nhập của form accept-invitation; typecheck/build/test đạt; vi.json U+FFFD = 0 và không thêm dấu hiệu mã hoá đôi.
- Progress: 2026-11-24 — Muse đã sửa trên branch `fix/FIX-008-qa005-findings`; chờ Nguyen nghiệm thu + merge (Muse không tự duyệt FE của chính mình).
- Progress: Đã merge vào main và đóng gói trong bản 0.5.0.
- Blockers: Không có.

## FIX-009 — Lô sửa nghiệm thu tổng hợp vòng 1: crash Invitations + sidebar + điều hướng Team + Select shadcn + seed demo đầy đủ
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: Từ buổi nghiệm thu tổng hợp vòng 1 (2026-11-24, chưa đạt, gián đoạn tại mục C3): (1) Trang `/team/invitations` crash "Rendered fewer hooks than expected" vì `useTranslations` bị gọi trong JSX (2 chỗ) — sửa dùng hook đã khai báo ở đầu component; đã rà soát toàn bộ khu vực (app), chỉ file này dính mẫu lỗi này. (2) Sidebar không giữ hết chiều cao khi cuộn trang dài — cấu trúc lại AppShell: khung `h-dvh`, chỉ cột nội dung cuộn, Sidebar cao theo khung. (3) Điều hướng khu vực Team gây hiểu nhầm Member/Team (PO đối chiếu prompt: prompt FE-009 của Muse thiếu đặc tả điều hướng — lỗi chính ở phía Muse): thêm `team/layout.tsx` với thanh tab chung [Nhóm | Thành viên | Lời mời | Khối lượng công việc] cho mọi trang `/team/*`, mục sidebar "Nhóm" vào trang danh sách team trước (PO chốt 2026-11-24). (4) Dropdown `<select>` HTML thô tại Projects/Clients/Leads/Team (38 chỗ, 9 file) → component `components/ui/Select.tsx` kiểu shadcn/ui (button + listbox theo design token, hỗ trợ bàn phím và đóng khi bấm ra ngoài). (5) Mở rộng `DemoDataSeeder`: thêm 5 tài khoản theo vai trò (admin/sales/pm/accountant/member@demo.test, mật khẩu "password"), client demo + gắn `client_id` cho tài khoản portal demo, 1 team demo, 2 project demo kèm milestone + task (có task quá hạn để kiểm tra workload) — seeder idempotent. (6) Thêm `docker-compose.acceptance.yml` để chạy web ở bản production khi nghiệm thu (bản dev biên dịch từng route theo từng ngôn ngữ ở lần mở đầu tiên nên có cảm giác lag như PO phản ánh — không phải lỗi của i18n).
- Acceptance Criteria: Trang Invitations mở bình thường không crash; sidebar phủ hết chiều cao viewport ở trang dài; sidebar "Nhóm" vào danh sách team và có thanh tab chuyển đủ 4 trang con; không còn `<select>` HTML thô trong khu vực (app); seed lại trên DB cũ tạo đủ tài khoản vai trò + 2 project demo mà không trùng lặp; web typecheck/test/build đạt, suite API không hồi quy.
- Progress: 2026-11-24 — Muse đã làm trên branch `fix/FIX-009-acceptance-round1` (theo quy ước thay vai FE, PO chốt 2026-11-23): web typecheck PASS, test 27/27, build 48 trang PASS; seeder chạy thử bằng test tạm (seed 2 lần: 6 user đúng vai trò, portal có client_id, 2 project, 5 task, team 3 thành viên), suite API 86/86 PASS (4 test auth báo lỗi khi thiếu APP_KEY trong worktree mới — lỗi môi trường, đã xác nhận đạt khi có APP_KEY); chờ Nguyen nghiệm thu + merge (Muse không tự duyệt FE của chính mình).
- Blockers: Không có.

## FE-013 — Nối Client Portal vào API thật (thay bản mock của FE-003)
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: Nghiệm thu vòng 2 mục D4 phát hiện tài khoản portal tạo ở Clients không đăng nhập được ở cổng Portal — nguyên nhân: Portal vẫn là bản mock của FE-003 (đăng nhập đối chiếu tài khoản cứng trong `lib/portal-auth/mock.ts`, token giữ ở sessionStorage + cookie JS), chưa từng nối API thật. Task này nối Portal vào API thật đã có sẵn từ BE-003 (portal auth) và BE-006 (portal projects read-only): (1) BFF routes `/api/portal/auth/login|logout|me|forgot-password|reset-password` — token Sanctum lưu trong httpOnly cookie `portal_token` đúng mẫu FE-004 của app nội bộ, tách biệt hoàn toàn với `app_token`; proxy portal riêng `lib/bff/portal-proxy.ts` (kèm xử lý status không body 204/205/304). (2) `portal-auth` viết lại: context gọi BFF (bootstrap phiên bằng `/me`), session chỉ giữ danh tính client + agency, xoá hẳn `mock.ts`, `storage.ts` và bộ test mock (web test 27 → 17 vì 10 test mock bị xoá theo). (3) Trang chủ Portal thay khối placeholder bằng danh sách dự án thật của chính khách hàng đó (trạng thái, % tiến độ, số task xong/tổng, hạn) và thêm trang chi tiết `/portal/projects/[id]` chỉ-đọc (mô tả, mốc thời gian, cột mốc, công việc) — dữ liệu từ PortalProjectResource, không lộ ngân sách/hồ sơ nội bộ. Điều hướng: đăng nhập → `/portal` (danh sách) → bấm thẻ dự án → chi tiết → link quay lại danh sách. Thêm namespace i18n `Portal.projects` EN/VI và gỡ 2 key placeholder `dashboard.mockNotice`/`emptyNotice`; màu chip trạng thái dùng chung bản đồ `lib/status-colors.ts` của FIX-010 (nội dung giống hệt, chờ hợp nhất khi cả hai PR vào main).
- Acceptance Criteria: Tài khoản portal tạo ở Clients (kể cả tài khoản seed `client@demo.test`) đăng nhập được ở Portal cả EN lẫn VI; đăng nhập sai báo đúng mã lỗi; quên/đặt lại mật khẩu chạy qua API thật (mail ở Mailpit); danh sách + chi tiết dự án khớp dữ liệu của client đó (client khác không thấy); token không xuất hiện trong JS storage; typecheck/test/build đạt; file tiếng Việt sạch 2 lớp kiểm tra byte.
- Progress: 2026-11-24 — Muse đã làm trên branch `fe/FE-013-portal-real-api` (theo quy ước thay vai FE, PO chốt thứ tự 2026-11-24): web typecheck PASS, test 17/17 (sau khi xoá 10 test mock), build 54 trang PASS; chờ Nguyen nghiệm thu + merge (Muse không tự duyệt FE của chính mình). Nên merge PR #51 (FIX-010) trước; nếu TASK.md/CHANGELOG.md xung đột khi merge PR này thì chỉ là xung đột sổ sách, Muse sẽ phát hành lại PR sạch.
- Blockers: Không có.
## FIX-010 — Lô sửa nghiệm thu tổng hợp vòng 2: lỗi 204 ở BFF proxy + picker thành viên + validation form Mời + polish UI theo feedback PO
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: Từ buổi nghiệm thu vòng 2 (2026-11-24; R1/R2/R4/R5, B2/B4/B5, D1–D3, E2–E4 đạt; R5 xác nhận bản production nhanh và ổn định hơn hẳn bản dev — cảm giác "lag đa ngôn ngữ" là do dev mode biên dịch theo route/locale, không phải lỗi i18n): (1) Tab thứ 4 của khu vực Team hiện key thô `Teams.workload` vì key đó là nhóm key con — tab chuyển sang dùng `workload.title`. (2) Thu hồi lời mời (và mọi thao tác API trả 204) báo lỗi "Invalid response status code 204": BFF proxy gắn body vào Response có status 204 — sửa proxy trả body rỗng đúng chuẩn cho 204/205/304, hết toàn cục cho mọi endpoint DELETE trả 204. (3) Badge loại trong Dòng thời gian của project hiện chuỗi thô "task"/"milestone" — bổ sung key `Projects.timelineTypes` EN/VI và hiển thị nhãn đã dịch. (4) Gốc rễ B3/C1/C2 — các ô nhập userID/số còn sót: lọc task theo người được gán, người được gán trong form task, thêm thành viên vào project, người phụ trách khi tạo project, trưởng nhóm khi tạo/sửa team — tất cả chuyển thành dropdown chọn từ danh sách thành viên (Select của FIX-009). Chỉ còn 2 ô số hợp lệ: ngân sách và ID khách hàng dự phòng khi chưa có khách hàng nào. (5) Form Mời thành viên: thiếu vai trò/email nay báo lỗi ngay trong form thay vì banner ngoài trang (key `Teams.invitationsForm.validation`). (6) Polish theo feedback: chip trạng thái có màu ngữ nghĩa dùng chung (`lib/status-colors.ts`: Active xanh lá, Đang xử lý xanh dương, Đủ điều kiện tím, Chờ xám, Tạm dừng vàng, Quá hạn/ huỷ đỏ) áp cho Clients/Projects/Leads; card Client bấm cả card để vào chi tiết (nút Xoá không bị ảnh hưởng); thẻ Kanban có cursor grab/grabbing khi kéo được; hàng Workload thêm avatar chữ cái + ô số liệu riêng, quá hạn tô đỏ; nút chính có icon (user-plus/plus qua bộ Icon), nút Quay lại dạng text kèm icon chevron, nút × gỡ thành viên có vùng bấm tròn lớn hơn; cursor pointer cho mọi phần tử bấm được (globals.css — Tailwind v4 mặc định bỏ pointer ở button); dấu * cho trường bắt buộc ở các form chính (một số form Clients/Leads đã có sẵn từ FE-010/FE-011, nay đồng bộ thêm Projects/Team/Mời + placeholder của form liên hệ/tài khoản portal).
- Acceptance Criteria: Tab Workload hiện đúng nhãn; thu hồi lời mời và các thao tác xoá trả 204 không còn báo lỗi; không còn ô nhập userID ở các luồng thành viên (trừ 2 ngoại lệ đã ghi); badge timeline hiển thị "Công việc/Cột mốc"; các polish ở mục (6) hiện diện trên các màn hình đã liệt kê; typecheck/test/build đạt; file tiếng Việt sạch 2 lớp kiểm tra byte.
- Progress: 2026-11-24 — Muse đã làm trên branch `fix/FIX-010-round2-findings` (theo quy ước thay vai FE, PO chốt 2026-11-23): web typecheck PASS, test 27/27, build 48 trang PASS; chờ Nguyen nghiệm thu + merge (Muse không tự duyệt FE của chính mình).
- Blockers: Không có. (Riêng D4 vòng 2 — tài khoản portal tạo ở Clients không đăng nhập được ở cổng Portal — nguyên nhân là cổng Portal vẫn là bản mock của FE-003, chưa từng nối API thật; xử lý ở task riêng FE-013 nối Portal vào API thật, chờ PO chốt thứ tự.)

## FIX-011 — Đăng xuất Portal kẹt ở trang trắng (nghiệm thu vòng 3, mục P6)
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: Vòng 3 đạt mọi mục trừ P6: bấm Đăng xuất ở Portal thì phiên đăng xuất nhưng không về được trang đăng nhập, phải tải lại trang. Nguyên nhân: `logout()` của portal (từ thời mock) gọi BFF xoá cookie kiểu "bắn rồi quên" rồi chuyển trang ngay; middleware thấy cookie `portal_token` vẫn còn nên đá `/portal/login` ngược về `/portal`, trong khi trang chủ Portal lúc đó không còn phiên nên render trắng và hiệu ứng chuyển trang không chạy lại. App nội bộ không dính vì logout của FE-004 vốn là async. Sửa: `logout()` của portal chuyển thành async — chờ BFF xoá cookie xong mới `setSession(null)`, nút Đăng xuất ở trang chủ Portal `await logout()` rồi mới chuyển trang.
- Acceptance Criteria: Bấm Đăng xuất ở Portal về thẳng trang đăng nhập, không cần tải lại; các mục vòng 3 còn lại không hồi quy; typecheck/test/build đạt.

## FE-012 — Branding Brewbase: tên site, logo + biến thể màu, nút hiện mật khẩu, avatar mặc định
- Status: DONE
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: Lô branding để dành sau nghiệm thu (PO nhắc lại 2026-11-24): (1) Tên site: tiêu đề trang (tab trình duyệt) "Brewbase - Agency & Client Management" / "Brewbase - Quản lý Agency & Khách hàng" qua metadata theo locale (key `Shell.siteTitle`), brand ở sidebar và Portal đổi thành "Brewbase", favicon là logo. (2) Logo nền tảng mới: ký hiệu chữ B hình học trên nền ô bo góc (`components/shell/Logo.tsx` + file SVG ở `apps/web/public/`), 4 biến thể màu theo bề mặt: violet (chính, dùng ở sidebar app nội bộ), emerald (Portal), dark, light. (3) Nút Eye/EyeClosed hiện/ẩn mật khẩu: component dùng chung `components/ui/PasswordInput.tsx` (kèm nhãn i18n `Common.showPassword`/`hidePassword`), gắn ở cả 5 ô mật khẩu: đăng nhập nội bộ, đăng nhập Portal, đặt lại mật khẩu Portal, chấp nhận lời mời, tạo tài khoản portal ở Clients. (4) Avatar mặc định cho người dùng: component `components/ui/Avatar.tsx` — chữ cái đầu của TỪ CUỐI trong họ tên (tên gọi theo thứ tự tên Việt) trên nền tròn, màu chọn xác định theo id người dùng (8 màu, cùng một người luôn cùng màu) để nhận diện nhanh cạnh các tên hiển thị nhỏ; gắn ở khối người dùng dưới sidebar, thẻ thành viên ở Danh bạ, hàng Workload (thay vòng tròn cũ) và chip thành viên trong chi tiết dự án. Màu primary của UI: PO chốt tím thương hiệu #7B61FF (2026-11-24) — token `--primary`/`--ring` ở globals.css đổi sang HSL 250 100% 69% cho cả light và dark, chữ trên nền primary là trắng; Portal giữ emerald theo DEC-013.
- Acceptance Criteria: Tab trình duyệt hiện đúng tiêu đề Brewbase theo ngôn ngữ; sidebar/Portal hiện logo mới đúng biến thể; cả 5 ô mật khẩu có nút con mắt bấm đổi qua lại được; avatar hiển thị đúng chữ cái tên cuối + màu ổn định theo từng người ở 4 vị trí đã gắn; typecheck/test/build đạt; file tiếng Việt sạch 2 lớp kiểm tra byte.
- Progress: 2026-11-24 — Muse đã làm cả FIX-011 + FE-012 trên branch `fix/FIX-011-logout-branding` (theo quy ước thay vai FE): web typecheck PASS, test 17/17, build 54 trang PASS; chờ Nguyen nghiệm thu + merge (Muse không tự duyệt FE của chính mình).
- Blockers: Không có.

## FIX-012 — Polish UI theo feedback nghiệm thu của PO (2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Ba chỉnh sửa từ feedback của PO khi nghiệm thu tại công ty: (1) PasswordInput — nút Eye/EyeClosed phải nằm TRONG ô input: nguyên nhân nút nằm ngoài là input thiếu `w-full` (wrapper `relative` rộng hết cột, input co theo nội dung nên nút absolute ở mép phải của wrapper rơi ra ngoài khung input); sửa ở component dùng chung — wrapper `w-full`, input luôn `w-full pr-10` — áp cho cả 5 ô mật khẩu. (2) Màu primary dùng cho CHỮ hơi sáng khó đọc: thêm token `--primary-text` (250 84% 60% ở light, 250 100% 76% ở dark) và class `text-primary-text` cho các chữ/link màu primary; màu primary cho nền/nút giữ nguyên #7B61FF. (3) Sidebar: đổi nền từ nâu đen ấm (240 5.9% 10%) sang tím than lạnh (250 24% 11%, accent/border/muted cùng tông tím) cho hợp tông logo violet và không lệch tông với dashboard nhiều màu về sau; logo trên sidebar đổi sang biến thể `light` (màu logo gốc giữ nguyên ở mọi nơi khác).
- Acceptance Criteria: Nguyen mở app kiểm tra bằng mắt: icon Eye nằm trong khung input ở trang đăng nhập; chữ màu primary đậm dễ đọc hơn; sidebar tông tím than + logo biến thể light hài hoà. Typecheck + build PASS.
- Blockers: Không có.
## BE-008 — Module Finance & Billing (Nhóm 5) theo hợp đồng FINANCE_CONTRACT
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: OpenCode
- Mô tả: Triển khai module Finance & Billing theo `docs/FINANCE_CONTRACT.md` (DEC-019, Nguyen duyệt theo đề xuất 2026-11-25): invoices + invoice_items + payments (BelongsToAgency), số hoá đơn tự sinh INV-{YYYY}-{4 số} theo agency cấp lúc tạo và bất biến, tổng tiền lưu sẵn, trạng thái draft/sent/paid/cancelled + Overdue suy ra lúc đọc, thanh toán thủ công nhiều lần (không trả thừa), PDF qua barryvdh/laravel-dompdf, endpoint sửa thông tin chuyển khoản/VietQR của agency, Portal chỉ đọc invoice của client mình, ProjectResource thêm invoiced_total/collected_total tính lúc đọc. Ma trận quyền invoices.*/payments.* theo hợp đồng (Accountant toàn quyền Finance; Sales/PM chỉ xem; delete chỉ Owner + chỉ Draft).
- Acceptance Criteria: Toàn bộ tiêu chí mục 7 của FINANCE_CONTRACT; test PHPUnit cho CRUD + tiền/thuế + trạng thái + thanh toán + PDF + Portal scope + cách ly tenant; Pint PASS; xác minh migration trên MySQL 8 (bài học PR #57).
- Progress (2026-11-26): Triển khai xong trên branch be/BE-008-finance, chờ OpenCode review: migrations invoices + invoice_items + payments + 4 cột payment details ở agencies; models Invoice/InvoiceItem/Payment (BelongsToAgency); số hoá đơn INV-{YYYY}-{seq} đếm cả bản ghi đã xoá mềm nên không tái dùng số; tổng tiền lưu sẵn, Overdue suy ra lúc đọc kèm stored_status và bộ lọc ?status=overdue; thanh toán thủ công (PAYMENT_NOT_ALLOWED / OVERPAYMENT_NOT_ALLOWED, trả đủ tự chuyển Paid + paid_at, xoá thanh toán tính lại trạng thái); PDF qua dompdf có watermark DRAFT/CANCELLED; PATCH /agencies/{id}/payment-details (Owner/Admin, agency khác trả 404); Portal chỉ đọc invoice của client mình; ProjectResource thêm invoiced_total / collected_total / remaining_budget; RBAC invoices.* / payments.* / agencies.payment-details.update theo ma trận hợp đồng; mã lỗi mới INVOICE_EMPTY, INVOICE_NOT_EDITABLE, CANNOT_CANCEL_INVOICE, CANNOT_DELETE_INVOICE, PAYMENT_NOT_ALLOWED, OVERPAYMENT_NOT_ALLOWED (en + vi). Kiểm chứng: 30 test mới trong tests/Feature/Finance, toàn suite 159 PASS trên cả SQLite và MySQL 8, migrate:fresh --seed sạch trên MySQL 8, Pint PASS.
- Ghi chú: Task FE/QA cho Nhóm 5 chỉ soạn SAU khi BE-008 merge (kỷ luật prompt — không soạn prompt phụ thuộc trước).

## FE-016 — Landing page theo mẫu Editorial (PO duyệt mẫu 4, 2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Thay trang gốc tạm thời ("Giai đoạn nền tảng") bằng landing page theo mẫu 4 "Editorial" do PO chọn trong 6 mẫu Muse sinh (3 mẫu đầu bị chê hơi trẻ con; hướng chốt: chững chạc kiểu SaaS B2B, không emoji/hiệu ứng, tím chỉ làm điểm nhấn, có mô phỏng giao diện app thật). Gồm: header (logo + chuyển ngữ EN/VI + nút Đăng nhập), khối giới thiệu + 3 số liệu (8 nhóm nghiệp vụ, song ngữ, đa agency), nút Đăng nhập vào `/login` và liên kết Cổng khách hàng vào `/portal/login` (trước đây phải gõ tay URL), mô phỏng sản phẩm bằng CSS thuần (sidebar tím than + card dự án), footer. Toàn bộ chuỗi qua i18n namespace Home (EN + VI đầy đủ).
- Acceptance Criteria: Nguyen mở trang gốc ở cả 2 ngôn ngữ kiểm tra bằng mắt; nút Đăng nhập/Portal chuyển đúng trang. Typecheck + build PASS.
- Blockers: Không có.

## FIX-015 — Thiếu khóa i18n `actions.detail` khiến menu hiện mã khóa (PO báo 2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: FIX-014 đổi nhãn action mở xem thành Chi tiết/Detail và code tham chiếu `t("actions.detail")` ở 3 nơi (danh sách dự án, danh sách nhóm, danh sách thành viên) nhưng khóa `detail` chưa từng được thêm vào `Projects.actions` và `Teams.actions` — next-intl hiển thị nguyên mã khóa trong menu. Lỗi ở khâu triển khai FIX-014 của Muse (báo cáo PR lúc đó ghi đã thêm khóa nhưng thực tế không có). Sửa: thêm `detail` = "Detail" / "Chi tiết" vào cả 2 namespace, EN + VI; đã quét lại toàn bộ khóa `actions.*` mà 3 file trên tham chiếu — tất cả đều phân giải được.
- Acceptance Criteria: Nguyen mở menu ⋮ ở danh sách dự án/nhóm/thành viên, mục đầu tiên hiện "Chi tiết" (VI) / "Detail" (EN) kèm icon mắt, không còn mã khóa. Typecheck + build PASS.
- Blockers: Không có.

## FE-018 — UI đăng nhập Portal theo mẫu P2 Bento kính mờ (PO duyệt 2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Trang `/portal/login` làm lại theo mẫu P2 "Bento kính mờ" do PO chọn trong 3 mẫu Muse sinh (P1 Card Emerald, P2 Bento kính mờ, P3 Chia đôi): nền panel gradient xanh ngọc, card đăng nhập kính mờ (logo emerald + tiêu đề chào mừng), 3 ô bento dưới card giới thiệu Dự án/Công việc/Hoá đơn, liên kết quay về đăng nhập nội bộ cho nhân viên agency. Header/footer của portal layout giữ nguyên (áp dụng cho mọi trang Portal). Form đăng nhập Portal giữ nguyên logic và palette emerald sẵn có. Thêm 9 khóa i18n vào `Portal.login` EN + VI.
- Acceptance Criteria: Nguyen mở `/portal/login` ở 2 ngôn ngữ kiểm tra bằng mắt; đăng nhập bằng tài khoản client demo vẫn vào Portal như cũ; link Đăng nhập nội bộ hoạt động. Typecheck + build PASS.
- Blockers: Không có.

## FIX-014 — Feedback UI vòng 2 của PO (2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Bốn chỉnh sửa từ ảnh nghiệm thu của PO sau FIX-013: (1) Trang chi tiết dự án: nút "Về danh sách" đứng một hàng riêng ở trên, tên dự án + tên khách + trạng thái xuống dưới nút (trước đây nằm cùng hàng). (2) Tiêu đề card công việc: màu primary vẫn hơi sáng — đổi sang màu chữ chính (foreground, gần đen) cho dễ đọc. (3) Menu three-dot thêm icon cho từng mục (mắt = Chi tiết, bút chì = Sửa thật, thùng rác = Xoá, check = Đánh dấu xong, xoay ngược = Mở lại); các nút "Sửa" trên card danh sách thực chất là vào xem chi tiết nên đổi tên thành "Chi tiết/Detail" (khoá i18n mới `actions.detail` ở namespace Projects + Teams) — mục Sửa mở form thật (cột mốc, người liên hệ) giữ nguyên nhãn Sửa. (4) Trang vào app đầu tiên (landing): PO yêu cầu Muse sinh vài mẫu thiết kế để duyệt chọn trước, mẫu được chọn mới triển khai kèm nút chuyển sang trang đăng nhập — phần này làm riêng sau khi PO chọn mẫu.
- Acceptance Criteria: Nguyen mở app kiểm tra bằng mắt các điểm trên. Typecheck + build PASS.
- Blockers: Không có.

## FE-017 — UI trang đăng nhập theo mẫu L2 Card trung tâm (PO duyệt 2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Trang `/login` làm lại theo mẫu L2 "Card trung tâm" do PO chọn trong 3 mẫu Muse sinh (L1 Chia đôi Editorial, L2 Card trung tâm, L3 Panel tối): header mảnh (liên kết Về trang chủ + chuyển ngữ EN/VI), một card giữa trang (logo Brewbase ở trên, tiêu đề, form), cuối card có lối sang Cổng khách hàng; footer tối giản. Đồng thời `LoginForm` chuyển từ palette indigo/neutral cũ (từ FE-002, chưa từng qua design token) sang design token hiện hành (primary/border-input/muted) cho đồng bộ app — chỉ đổi class trình bày, không đổi logic/validate/luồng đăng nhập. Thêm 4 khóa i18n vào `Auth.login` (heading, backHome, portalPrompt, portalLink) EN + VI. Trang đăng nhập Portal giữ nguyên bản sắc emerald riêng.
- Acceptance Criteria: Nguyen mở `/login` ở 2 ngôn ngữ kiểm tra bằng mắt; đăng nhập bằng tài khoản demo vẫn vào thẳng dashboard; link Quên mật khẩu, chuyển ngữ, Về trang chủ và lối sang Portal hoạt động. Typecheck + build PASS.
- Blockers: Không có.

## BE-011 — Client Portal & Collaboration (Nhóm 7) theo hợp đồng PORTAL_CONTRACT
- Status: DONE
- Assignee: Muse (BE) · Reviewer: OpenCode (QA) + Nguyen
- Mô tả: Triển khai Nhóm 7 theo `docs/PORTAL_CONTRACT.md` (DEC-028, Nguyen duyệt cả 12 điểm Q1–Q12 theo đề xuất 2026-11-27): cột `client_visible` cho milestones/tasks (mặc định hiện, sửa qua PATCH sẵn có) và Portal chỉ tính tiến độ trên phần hiển thị; project draft/cancelled ẩn khỏi Portal; bảng `project_files` hai chiều trên disk private (giới hạn 20 MB + allowlist đuôi trong config/portal.php, tải qua endpoint stream có xác thực); bảng `portal_comments` — một luồng trao đổi duy nhất theo project, tách hẳn task_comments nội bộ; bảng `approval_requests` (pending/approved/changes_requested, comment bắt buộc khi yêu cầu sửa, phản hồi một lần và bất biến, account bất kỳ của cùng client record đều phản hồi được, ghi responded_by); `GET /portal/dashboard` tổng hợp một lần gọi; history tổng hợp lúc đọc từ comment + approval + sự kiện invoice công khai (không bảng activity); Notifier thêm `portal.comment` (→ quản lý dự án + thành viên dự án) và `portal.approval_response` (→ người tạo request + quản lý dự án), in-app only, MVP không email cho client; 2 khóa quyền mới `portal.files.manage` + `portal.approvals.manage` (Owner/Admin/PM), trả lời luồng trao đổi chỉ cần `projects.view`.
- Acceptance Criteria: Toàn bộ tiêu chí mục 8 của PORTAL_CONTRACT; test PHPUnit trong `tests/Feature/Portal/` (lọc hiển thị + mẫu số tiến độ, draft/cancelled 404, ghim client trên mọi endpoint mới kể cả download/respond, giới hạn upload, vòng đời approval + thông báo đúng người nhận, dashboard, thứ tự history trộn 3 nguồn); toàn suite PASS trên SQLite và MySQL 8; Pint PASS.
- Progress: 2026-11-27 — Muse triển khai trên branch `be/BE-011-portal-collaboration` từ `origin/main` (`bb2d63d`).
- Progress: 2026-11-27 — Vòng sửa theo QA-008 (F0–F5): Pint sạch toàn bộ file PHP thay đổi (F0); kiểm tra đuôi file upload theo file thật thay vì tên client gửi (F1, kèm test bằng UploadedFile thật); bổ sung comment lý do bypass ở StoreApprovalRequest (F2); phản hồi approval thành thao tác nguyên tử có điều kiện `status = pending` (F3); dashboard loại invoice thuộc project draft/cancelled khỏi tổng nợ (F4); bổ sung comment lý do bypass trong PortalCollaborationTest (F5). Suite 213 PASS trên SQLite, Pint PASS.
- Blockers: Không có.

## QA-008 — Rà soát BE-011 Nhóm 7 (Portal & Collaboration)
- Status: DONE
- Assignee: OpenCode (QA) · Reviewer: Muse + Nguyen
- Mô tả: Review chéo BE-011 theo mục 8 của `docs/PORTAL_CONTRACT.md`: lọc hiển thị và mẫu số tiến độ phía Portal, ẩn project draft/cancelled, ghim client_id trên mọi endpoint Portal mới (file/comment/approval/history/dashboard), giới hạn upload + mime/size theo file thật, vòng đời approval (bất biến sau phản hồi, APPROVAL_ALREADY_RESPONDED, comment bắt buộc khi changes_requested), người nhận hai thông báo mới, suite chạy trên MySQL 8.
- Blocked by: BE-011 (chỉ bắt đầu sau khi PR BE-011 mở).
- Acceptance Criteria: Báo cáo PASS/FAIL theo từng mục của hợp đồng kèm bằng chứng chạy test; không tự sửa code BE trong task này.
- Blockers: Chờ BE-011.

## FE-023 — Portal & Collaboration UI (Nhóm 7): Portal + section Client Portal nội bộ
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: FE cho Nhóm 7 theo `docs/PORTAL_CONTRACT.md` mục 7: Portal (dashboard thêm khối Cần bạn duyệt + invoice chưa thanh toán + File mới; chi tiết project thêm Files / Trao đổi / Duyệt bàn giao / Lịch sử; giữ phong cách Bento emerald DEC-013) và phía nội bộ (section "Client Portal" trong chi tiết project: công tắc client_visible, quản lý Files, Approvals, luồng Trao đổi, Lịch sử; chuông thông báo render thêm `portal.comment` / `portal.approval_response`). Ghi chú hướng UI của PO (DEC-028): Portal là bề mặt phía khách — khách ít thao tác và thao tác đơn giản, chất lượng trình bày quan trọng hơn mật độ thông tin; FE-023 bắt đầu bằng các trang mẫu thiết kế để PO duyệt trước khi triển khai, như quy trình mẫu của các đợt UI trước.
- Blocked by: QA-008 (chỉ soạn prompt sau khi BE-011 merge và QA-008 PASS — kỷ luật prompt).
- Acceptance Criteria: Chốt khi soạn prompt sau QA-008; tuân thủ DEC-013 (Portal Bento emerald), DEC-021/023/025 và quy ước i18n EN + VI đầy đủ.
- Blockers: Không có (BE-011 + QA-008 đã qua).
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fe/FE-023-portal-collaboration-ui` từ `origin/main` (`bfdc0f3`). Hướng thiết kế theo mẫu PO duyệt: bố cục A (Bento kính mờ) + diện mạo C (tiến độ nổi bật) cho Portal; nội bộ giữ phong cách workspace.
- Progress: 2026-11-27 — Vòng sửa R1–R3: lịch sử địa phương hoá (Portal.historyTypes + Projects.portal.historyTypes), lỗi file/bình luận/phê duyệt hiển thị tại chỗ (DEC-025), bỏ { default } khỏi t(); thêm khoá historyDecisionApproved/Changes.

## FIX-031 — Batch BE nhỏ tồn đọng Nhóm 5: GET payment-details + validate project cùng client (mục 4 trong thứ tự PO duyệt 2026-11-27)
- Status: DONE
- Assignee: Muse (BE) · Reviewer: OpenCode (QA) + Nguyen
- Mô tả: (a) Thêm `GET /agencies/{id}/payment-details` — cùng quyền `agencies.payment-details.update` (Owner/Admin) và cùng response shape với PATCH, để form cài đặt prefill dữ liệu đã lưu thay vì mở trống (hạn chế đã ghi trong PR #89; không thêm khóa quyền mới). (b) Validate `invoice.project_id` phải thuộc cùng client với `invoice.client_id` trên cả create và update — khi update chỉ đổi client hoặc chỉ đổi project thì cặp (client, project) sau cập nhật vẫn được kiểm; project của client khác cùng workspace → 422 `PROJECT_CLIENT_MISMATCH`, project của workspace khác vẫn 422 `CROSS_TENANT_REFERENCE`; mã lỗi mới có trong `lang/en|vi/api.php`; `docs/FINANCE_CONTRACT.md` §4.3 + §5 bổ sung quy tắc theo mẫu amendment `INVOICE_NOT_EDITABLE` (PR #80).
- Acceptance Criteria: GET trả đúng 4 trường đã lưu (agency chưa lưu gì trả null), Sales Manager 403, agency khác 404; create/update với project của client khác → 422 `PROJECT_CLIENT_MISMATCH` (kể cả update chỉ đổi client), cùng client và không có project → OK, project cross-agency vẫn `CROSS_TENANT_REFERENCE`; toàn suite PHPUnit PASS trên SQLite + test Finance PASS trên MySQL 8; Pint PASS.
- Progress: 2026-11-27 — Muse triển khai trên branch `fix/FIX-031-group5-leftovers` từ `origin/main` (`c7b2157`, merge PR #96).
- Blockers: Không có.

## BE-009 — Workflow & Notifications (Nhóm 6) theo hợp đồng WORKFLOW_CONTRACT
- Status: DONE
- Assignee: Muse (BE) · Reviewer: OpenCode (QA) + Nguyen
- Mô tả: Triển khai Nhóm 6 theo `docs/WORKFLOW_CONTRACT.md` (DEC-026, Nguyen duyệt nguyên văn theo đề xuất 2026-11-27): bảng `notifications` tự xây (BelongsToAgency, `dedupe_key` duy nhất chống nhắc trùng) + cột `created_by` bổ sung cho `tasks`/`invoices`; service `App\Support\Notifier` là điểm tạo thông báo duy nhất (chỉ tạo cho membership staff đang hoạt động trong agency của token, không bao giờ báo cho chính người thực hiện hành động, lỗi thông báo không làm hỏng hành động nghiệp vụ); API đọc/đánh dấu đã đọc (list + `unread` filter, unread-count, read, read-all — ghim theo danh tính + agency của token, id lạ trả 404, không thêm khóa quyền mới); sự kiện `task.assigned` / `task.status_changed` / `task.commented` / `invoice.status_changed` gắn tại controller task/comment/invoice và tại `Invoice::refreshStatusFromPayments()` cho các chuyển trạng thái do thanh toán (gồm cả Paid quay về Sent khi xoá thanh toán); email chỉ cho `task.assigned` + invoice sang Paid qua job `SendNotificationMail` (payload mang agency_id, chạy trong Tenant::run, render theo locale lưu trên tài khoản, mẫu `NotificationMail` + `lang/en|vi/mail.php`); lệnh `reminders:run` chạy lịch 01:00 UTC, đánh giá theo múi giờ từng agency — task/milestone sắp hạn + quá hạn, lead quá 3 ngày chưa liên hệ, invoice quá hạn chỉ nhắc nội bộ (Accountant + Owner, không bao giờ gửi khách) — kèm xoá thông báo quá 90 ngày.
- Acceptance Criteria: Toàn bộ tiêu chí mục 8 của WORKFLOW_CONTRACT; test PHPUnit trong `tests/Feature/Workflow/` cho từng trigger sự kiện (kèm loại trừ actor + membership đã vô hiệu), cách ly chéo user/agency của API thông báo, từng rule reminders + dedupe chạy 2 lần trong ngày + ca biên múi giờ agency + dọn dẹp 90 ngày; toàn suite PASS trên SQLite và MySQL 8; Pint PASS.
- Progress: 2026-11-27 — Muse triển khai trên branch `be/BE-009-workflow-notifications` từ `origin/main` (`3001fd6`, release 0.7.0).
- Blockers: Không có.

## FE-021 — Chuông thông báo + trang thông báo (Nhóm 6)
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: FE cho Nhóm 6 theo `docs/WORKFLOW_CONTRACT.md` mục 9: icon chuông kèm badge số chưa đọc ở khung app, panel dropdown (khoảng 10 thông báo mới nhất, nút đánh dấu tất cả đã đọc), trang `/notifications` đầy đủ dùng lại component Pagination dùng chung, liên kết sâu từ thông báo tới task/invoice/dự án tương ứng; toàn bộ chuỗi hiển thị qua namespace i18n `Notifications.*` (EN + VI) render từ `type` + `data` của API.
- Blocked by: BE-009 — chỉ soạn prompt chi tiết sau khi BE-009 merge (kỷ luật prompt, đúng nhịp FE-020 của Nhóm 5).
- Acceptance Criteria: Chốt khi soạn prompt sau BE-009; tuân thủ DEC-021/023/024/025 và quy ước skeleton/phân trang hiện hành.
- Blockers: Không có (BE-009 đã merge).
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fe/FE-021-notifications-ui` từ `origin/main` (`c7b2157`).

## FIX-035 — Gọn lại giao diện mục Tài khoản Portal ở chi tiết khách hàng (phát hiện khi nghiệm thu, 2026-11-27)
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: Mục Tài khoản Portal ở trang chi tiết khách hàng (phía Workspace) dàn hàng ngang quá sơ sài. Sắp xếp lại mỗi hàng tài khoản thành 3 vùng (khối danh tính hai dòng tên/email + Avatar; chip trạng thái + dòng meta đăng nhập gần nhất text-xs; hành động), cỡ chữ nhỏ lại một nấc (nội dung text-sm, meta text-xs), và nút Vô hiệu hóa thành nút danger-soft nổi bật (nền đỏ nhạt + viền đỏ + chữ đỏ đậm + icon khoá) theo quy tắc chung mới của PO cho nút nguy hiểm — đồng thời ghi quy tắc vào docs/UI_GUIDELINES.md mục 7. Chỉ trình bày: không đổi API/logic/i18n keys.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fix/FIX-035-portal-accounts-ui` từ `origin/main` (`bb2d63d`); Muse bổ sung khi review: icon `lock` còn thiếu trong bộ Icon dùng chung và hồ sơ TASK/CHANGELOG chưa được push kèm.
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n 725 = 725; byte-check OK; nhìn bằng mắt: hàng tài khoản gọn hai dòng, nút Vô hiệu hóa nổi bật có icon khoá và vẫn mở đúng hộp thoại xác nhận, form cấp tài khoản hoạt động, 375px không vỡ layout.
- Blockers: Không có.

## FE-022 — Nút chuyển ngôn ngữ bằng cờ quốc gia ở Topbar (Nhóm 6/7, 2026-11-27)
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: Thêm nút cờ tròn (VN/UK) cạnh chuông thông báo ở Topbar khu vực staff; bấm chuyển locale giữ nguyên trang; tái sử dụng logic `router.replace(pathname, { locale })` của `LocaleSwitcher`; vẽ cờ bằng SVG inline (`FlagIcon`), không emoji/ảnh ngoài. Thêm key `Common.switchLanguage`.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fe/FE-022-language-toggle` từ `origin/main` (`27484cd`).
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n parity 725 = 725; byte-check OK.
- Blockers: Không có.

## FIX-033 — Phạm vi thao tác trên task: chỉ assignee / quản lý dự án / vai trò quản lý (phát hiện khi nghiệm thu FE-021, 2026-11-27)
- Status: DONE
- Assignee: Muse (BE) + OpenCode (FE) · Reviewer: Nguyen
- Mô tả: Theo DEC-027 (PO chốt theo đề xuất của Muse tại nghiệm thu FE-021): API trước nay chỉ chặn thao tác trên task theo quyền vai trò, thiếu kiểm tra phạm vi — staff không được giao vẫn sửa/comment/checklist được task của người khác (mâu thuẫn DEC-005), FE lại render đủ nút thao tác rồi để user ăn banner 403 thô (trái DEC-025). Phần BE: quy tắc một điểm tại Task::canBeActedOnBy() (assignee, hoặc quản lý dự án qua projects.project_manager_id, hoặc membership hiện tại là Owner / giữ vai trò Admin / Project Manager); guard áp cho PATCH + DELETE task, tạo comment, tạo/sửa/xoá checklist — vi phạm trả 403 TASK_ACTION_FORBIDDEN (lang EN/VI); TaskResource thêm cờ can_act tính theo cùng quy tắc. Phần FE (làm sau, chờ PR BE merge): khoá các control theo can_act kèm ghi chú tại chỗ trên trang chi tiết task, bỏ banner 403 thô.
- Acceptance Criteria: Test PHPUnit mới tests/Feature/Projects/TaskActionScopeTest.php — assignee thao tác được (đổi trạng thái, comment, thêm + tick checklist); Team Member không được giao (vẫn xem được task qua tư cách thành viên dự án) bị 403 TASK_ACTION_FORBIDDEN ở PATCH task / POST comment / POST + PATCH + DELETE checklist; quản lý dự án (chỉ giữ vai trò Team Member) thao tác được; vai trò Project Manager / Admin / Owner thao tác được mọi task; payload GET task có can_act đúng (true cho assignee + Owner, false cho thành viên không được giao). Toàn suite PASS; Pint PASS; byte-check OK.
- Progress: 2026-11-27 — Muse triển khai phần BE trên branch `fix/FIX-033-task-action-scope` từ `origin/main` (`472d0e7`). Phần FE ⏸ chờ PR BE này merge mới soạn prompt (kỷ luật prompt).
- Progress: 2026-11-27 — OpenCode triển khai phần FE trên branch `fe/FIX-033-task-detail-gating` từ `origin/main` (`e705717`): khoá control theo `can_act`, ghi chú tại chỗ, bỏ banner 403 thô, deep-link thông báo task → chi tiết task, description có vùng nền.
- Blockers: Không có ở phần BE; phần FE chờ PR BE merge.
## FIX-032 — Nhãn trường Thuế và hàng nhãn mục hoá đơn (phát hiện khi nghiệm thu FE-020, 2026-11-27)
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: (1) Đổi giá trị VI của `Finance.fields.taxRate` từ "Thuế (%)" thành "Thuế" để tránh nhân đôi "(%)" với component. (2) Thêm hàng nhãn (Mô tả/Số lượng/Đơn giá) trên lưới mục trong `InvoiceForm`, nhãn nhỏ riêng trên mobile (`sm:sr-only`), đổi placeholder Số lượng/Đơn giá thành tên trường.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fix/FIX-032-invoice-form-labels` từ `origin/main` (`472d0e7`).
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n 723 = 723; byte-check OK.
## FIX-034 — Thanh cuộn dọc thừa ở tab Team + khung viền nút chuông thông báo (phát hiện khi nghiệm thu FE-021, 2026-11-27)
- Status: DONE
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: (1) Thêm `overflow-y-hidden` vào nav tab Team (giữ `overflow-x-auto`) để loại bỏ thanh cuộn dọc thừa; quét pattern tương tự → không có chỗ khác. (2) Bỏ khung viền/nền hộp của nút chuông ở Topbar, giữ icon, badge, vùng bấm và hover nền mờ.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fix/FIX-034-team-tab-scrollbar` từ `origin/main` (`472d0e7`).
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n 723 = 723; byte-check OK; nhìn bằng mắt trang Team không còn cuộn dọc, chuông không khung viền.
- Blockers: Không có.

## FIX-030 — Icon mũi tên cho nút Previous/Next của phân trang (phát hiện khi nghiệm thu FIX-029, 2026-11-27)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: Thay chữ Previous/Next trên component dùng chung `Pagination` bằng icon `chevron-left` (Next dùng `chevron-left` xoay 180° vì Icon chưa có `chevron-right`); thêm `aria-label` từ `Common.prev`/`Common.next`, giữ kích thước nút `h-9 min-w-9` và logic disabled/click/dropdown/số trang không đổi.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fix/FIX-030-pagination-icons` từ `origin/main` (`e5c5e71`).
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n EN = VI 707 = 707; byte-check OK; nhìn bằng mắt ở Invoices/Projects hai nút mũi tên đều kích thước với nút số trang, disabled đúng ở trang đầu/cuối.
- Blockers: Không có.

## FIX-029 — Mobile hoá danh sách/chi tiết hoá đơn, chống tràn ngang, phân trang hiện đại (phát hiện khi nghiệm thu FE-020, 2026-11-27)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: (1) Danh sách Invoices render trùng bảng + card ở mobile: bọc bảng trong `hidden lg:block`, card mobile đổi sang `lg:hidden`, thống nhất breakpoint `lg` như Projects/Clients; bộ lọc xếp dọc full-width ở mobile. (2) Sửa tràn ngang ở 375px cho card danh sách Projects và Invoices (truncate/min-w-0/break-words, bỏ chiều rộng cứng vượt viewport), desktop không đổi. (3) Trang chi tiết hoá đơn: chip trạng thái `self-start` để không kéo full chiều ngang, bảng Payments và Line items có bản card mobile theo DEC-021, thêm nút Back về `/invoices` ở đầu trang. (4) Component dùng chung `Pagination` (số trang + Previous/Next + chọn 10/20/30/50/100 dòng/trang, reset trang 1 khi đổi filter/số dòng), áp dụng cho Invoices và Projects; thêm khoá i18n `Common.pagination.*` EN/VI. (5) Bỏ ký tự "+" text trùng icon Plus ở nút Add item trong `InvoiceForm`, quét các nút khác trong phạm vi Invoices.
- Progress: 2026-11-27 — OpenCode triển khai trên branch `fix/FIX-029-mobile-pagination` từ `origin/main` (`ad3c6e7`).
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n EN = VI khớp tuyệt đối, không khóa lơ lửng; byte-check OK; kiểm tra bằng mắt ở 375px: Invoices chỉ còn card, Projects/Invoices không tràn ngang, chip chi tiết không tràn, Payments dạng card, nút Back hoạt động.
- Blockers: Không có.

## FIX-028 — Layout hoá đơn: i18n validation, header danh sách, chi tiết hoá đơn (phát hiện khi nghiệm thu FE-020, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen
- Mô tả: (1) Loại bỏ chuỗi tiếng Việt hardcode trong `InvoiceForm.validate()` và các fallback trong phạm vi invoices/finance, thêm nhóm khoá `Finance.validation.*` + `Finance.hints.*` + `Finance.errors.pdfFailed` (EN/VI). (2) Gom hai nút hành động trang danh sách hoá đơn vào một container bên phải, tiêu đề bên trái, nhãn một dòng. (3) Làm lại trang chi tiết: header chỉ số hoá đơn + chip, lưới thông tin 2/4 cột, notes dưới lưới, footer bảng colSpan đúng cột Amount, header bảng 11px, hàng nút hành động ngay dưới lưới với nhãn một dòng và thứ tự Send/Download PDF/Cancel/Delete.
- Progress: 2026-11-26 — OpenCode triển khai trên branch `fix/FIX-028-invoice-layout` từ `origin/main`.
- Acceptance Criteria: `npx -y pnpm@10.0.0 exec tsc --noEmit` PASS; `npx -y pnpm@10.0.0 build` PASS; `npx -y pnpm@10.0.0 vitest run` PASS (22/22); i18n EN = VI khớp tuyệt đối, không khóa lơ lửng; byte-check OK; không còn chuỗi tiếng Việt hardcode trong phạm vi việc 1.
- Blockers: Không có.

## FIX-027 — Vòng lặp render vô hạn ở trang danh sách hoá đơn (phát hiện khi nghiệm thu FE-020, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse (thay vai FE theo quy ước) · Reviewer: Nguyen (nghiệm thu bằng mắt)
- Mô tả: Trang `/invoices` (FE-020) cho `useEffect` nạp dữ liệu phụ thuộc vào chính state `loading` mà `load()` thay đổi (deps `[session, firstLoad, loading, load]`), nên mỗi lần nạp xong lại kích hoạt nạp tiếp — trang render/fetch liên tục, dropdown filter nhảy focus và giật lag; chỉ xảy ra ở Invoices vì các trang danh sách khác dùng mẫu FE-019. Sửa theo đúng mẫu Clients/Projects: bỏ state `firstLoad`/`showSkeleton` tự chế, dùng `hasLoaded` + hook dùng chung `useDelayedSkeleton(loading && !hasLoaded)` (DEC-021 §9), effect nạp dữ liệu chỉ còn deps `[session, load]`. Không đổi giao diện, không đổi API.
- Progress: 2026-11-26 — Muse sửa trên branch `fix/FIX-027-invoice-list-loop` từ main `2a5c97c`; chờ build/test và PR, Nguyen merge rồi nghiệm thu lại mục A.
- Acceptance Criteria: Mở `/invoices` không còn render/fetch lặp (Network chỉ gọi 1 lần khi đổi filter/trang), dropdown filter thao tác mượt, skeleton chỉ hiện ở lần tải đầu; `build` + `vitest` PASS.
- Blockers: Không có.

## FIX-026 — Thay hộp confirm mặc định bằng dialog dùng chung kiểu shadcn/ui (PO yêu cầu sau nghiệm thu FIX-023, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode (FE) · Reviewer: Muse + Nguyen (nghiệm thu bằng mắt)
- Mô tả: Thay toàn bộ 11 điểm xác nhận native trong app nội bộ bằng component/hook dùng chung `ConfirmDialog` / `useConfirm` (không thêm dependency, không dùng Radix): 7 điểm `confirm()` đã liệt kê (Projects list + detail với milestone/task, Teams list + detail, Thu hồi lời mời) và 4 điểm `window.confirm()` phát hiện thêm khi quét (Clients list + detail, Leads detail — xoá khách/lead/contact). Dialog tự dựng theo mẫu `ActionMenu` (DEC-024): portal ra `document.body`, overlay mờ, panel giữa màn hình, Escape/click ngoài = Huỷ, nút xác nhận phá huỷ màu đỏ, mặc định focus nút Huỷ, con trỏ pointer, không animation khi người dùng giảm chuyển động. Provider đặt tại `apps/web/src/app/[locale]/(app)/layout.tsx`. Nhãn nút lấy từ `Common.actions.{cancel,delete,revoke}` (EN + VI; namespace `Common` trước đây chưa có `actions` nên thêm 3 khóa mỗi ngôn ngữ), câu hỏi vẫn dùng nguyên khóa i18n cũ của từng màn. Không đụng BE, không đụng Portal, không đổi handler hay kết quả nghiệp vụ — chỉ đổi cơ chế xác nhận.
- Progress: 2026-11-26 — OpenCode triển khai xong trên branch `fix/FIX-026-confirm-dialog` (từ `origin/main` e832108): component/hook `ConfirmDialog` + provider ở layout app, 11 call site chuyển sang `confirmAction(...)`, bổ sung `Common.actions` EN/VI. Kiểm chứng: `npx -y pnpm@10.0.0 build` PASS (dùng `distDir` tạm vì thư mục `.next` cũ thuộc root, đã khôi phục cấu hình), `npx -y pnpm@10.0.0 vitest run` 22/22 PASS, `typecheck` PASS, i18n 572 khóa EN = VI không lơ lửng, byte-check OK, grep không còn native confirm. Chờ Muse + Nguyen nghiệm thu; KHÔNG mở PR.
- Acceptance Criteria: Mười một call site trên dùng dialog mới, xác nhận thì giữ nguyên thao tác xoá/thu hồi, Huỷ/Escape/click ngoài thì không thay đổi dữ liệu; `grep -rn "confirm(" apps/web/src` không còn lời gọi native; Nguyen + Muse nghiệm thu bằng mắt ít nhất một ca xoá và ca thu hồi lời mời ở EN/VI; `npx -y pnpm@10.0.0 build` + `npx -y pnpm@10.0.0 vitest run` PASS; khóa i18n EN = VI, không khóa lơ lửng, byte-check `TASK.md`/`CHANGELOG.md` không tăng dấu mã hoá đôi và không có U+FFFD.
- Blockers: Không có.

## FIX-025 — Bản địa hoá cảnh báo theo mã lỗi ở modal Mời thành viên (PO phát hiện tại nghiệm thu FIX-023, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Tại nghiệm thu FIX-023, vị trí cảnh báo trong modal Mời đã đúng (nằm trong modal) nhưng nội dung vẫn là message thô tiếng Anh của API (API trả theo locale lưu trên tài khoản, lệch ngôn ngữ giao diện — cùng gốc rễ DEC-025 đã xử lý cho trạng thái 403). Modal Mời nay ánh xạ các mã lỗi nghiệp vụ sang khóa i18n `Teams.errors.*` (EN + VI, câu chữ khớp lang của BE): `INVITATION_PENDING` (mời trùng email đang chờ), `ALREADY_MEMBER` (email đã là thành viên); nút Gửi lại cũng ánh xạ `INVITATION_ALREADY_ACCEPTED`. Mã lạ vẫn fall back về message API như cũ.
- Acceptance Criteria: Nguyen mở Team → Lời mời ở giao diện VI: mời trùng email đang chờ → cảnh báo tiếng Việt ngay trong modal; mời email đã là thành viên → cảnh báo tiếng Việt tương ứng; web build PASS; khóa i18n EN = VI, không khóa lơ lửng (kiểm cả khóa động `errors.${code}`).

## FE-020 — Finance & Billing UI (Group 5)
- Assignee: OpenCode · Reviewer: Muse + Nguyen (Muse+Nguyen) · Level: L3 · Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Branch: fe/FE-020-finance-ui · PR: —
- Blocked by: —
- Acceptance Criteria: Sidebar có mục Invoices; danh sách hiển thị hoá đơn mẫu, filter Overdue chỉ ra hoá đơn quá hạn, bấm dòng vào chi tiết. Tạo hoá đơn: dropdown dự án chỉ hiện dự án của khách hàng đã chọn, số INV-2026-… tự sinh, sửa Draft tính lại tổng. Gửi Draft không có item cảnh báo tại nút; ghi payment vượt số dư cảnh báo ngay trong form; ghi đủ tiền → Paid. Member mở /invoices thấy Forbidden ngôn ngữ hiện tại; Sales xem + tải PDF, không thấy nút Gửi/Xoá. Portal (client@demo.test) xem hoá đơn + thông tin chuyển khoản, không tạo payment. Trang /finance/payment-details chỉ Owner/Admin. Đối soát ngân sách ở chi tiết dự án. next build PASS, vitest run PASS, i18n EN=VI, không có `confirm(` native mới.
- Progress: OpenCode bắt đầu 2026-11-26: tạo nhánh fe/FE-020-finance-ui từ main, khám phá cấu trúc web, bắt đầu triển khai.
- Handoff: —

## FIX-024 — (Tạm hoãn) Token giới hạn cho người được mời có danh tính nhưng chưa có membership nào
- Status: IN_PROGRESS — PO chốt 2026-11-26: ghi nhận là giới hạn đã biết, hoãn triển khai, chỉ mở lại khi PO yêu cầu (đã mở lại theo Đợt 1 được PO duyệt 2026-11-28)
- Assignee: Muse (BE) · Reviewer: OpenCode (QA) + Nguyen
- Progress: 2026-11-28 — BE xong theo hướng đã thống nhất 2026-11-26 (DEC-030): login có 0 membership nhưng có lời mời đang chờ (khớp user_id hoặc email, đúng loại bề mặt staff/portal, chưa chấp nhận/thu hồi/hết hạn) trả payload `invitation_only` + token ability `invitation` (60 phút, không gắn membership/agency) kèm tóm tắt lời mời; token bị xoá ngay khi accept thành công; không có lời mời thì vẫn 403 `NO_ACTIVE_MEMBERSHIP` như cũ. Test mới `InvitationLoginTest` (7 test) phủ: cấp token + shape token, accept bằng token đó rồi login bình thường, token bị xoá sau accept, không lời mời thì từ chối, lời mời hết hạn/thu hồi/đã nhận thì từ chối, lệch loại (client vs staff), token bị chặn ở endpoint nghiệp vụ và select-agency, accept lời mời của người khác thì 403 INVITATION_IDENTITY_MISMATCH. Chờ QA (OpenCode) rà soát; phần FE xử lý cờ `invitation_only` làm tiếp sau khi BE merge.
- Mô tả: Giới hạn của luồng chấp nhận lời mời (BE-010/DEC-020): người được mời đã có danh tính nhưng đang có 0 membership đang hoạt động (ví dụ khách bị xoá khỏi hệ thống khiến membership bị vô hiệu hoá, sau đó được mời làm nhân viên) rơi vào vòng lặp chết — accept trả 403 `INVITATION_LOGIN_REQUIRED` nhưng đăng nhập lại bị từ chối `NO_ACTIVE_MEMBERSHIP` vì chưa có membership nào, không còn đường hoàn tất. Hướng fix đã thống nhất: khi đăng nhập có 0 membership nhưng tồn tại lời mời đang chờ cho email đó, BE cấp token giới hạn chỉ dùng cho việc xem/xác nhận lời mời (không gắn membership, không vào được app — ResolveTenant chặn), FE đi tiếp `returnTo` về trang accept như bình thường.
- Acceptance Criteria: Chưa áp dụng (task hoãn). Khi mở lại: identity có 0 membership + lời mời đang chờ đăng nhập được tại trang accept và xác nhận thành công; token giới hạn gọi mọi endpoint nghiệp vụ đều bị chặn; bộ test BE xanh trên cả SQLite và MySQL.

## FIX-023 — Phản hồi tại vị trí tương tác + trạng thái không có quyền (PO yêu cầu tại nghiệm thu FE-015, 2026-11-26; DEC-025)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Bốn điểm. (1) Hai trang accept (nội bộ + Portal) tự chuyển hướng sang trang accept đúng loại lời mời khi mở nhầm bề mặt, giữ nguyên token. (2) Ưu tiên tuyệt đối trạng thái sai tài khoản ở trang accept: đang đăng nhập bằng danh tính khác thì chỉ hiện cảnh báo, không hiện form đặt mật khẩu/nút nhận lời mời (lỗi nghiệm thu mục B4 — trước đây form email mới và khối cảnh báo hiện đồng thời). (3) Quét toàn app theo DEC-025: lỗi của form/section hiển thị ngay trong form/section đó — chi tiết khách hàng (gồm form cấp quyền Portal), chi tiết lead (gồm khối chuyển đổi), chi tiết dự án (gồm các modal thêm thành viên/cột mốc/task và section gán team), chi tiết task (checklist, bình luận), chi tiết thành viên (hồ sơ, vai trò) và nhóm, các form tạo ở trang danh sách (khách hàng gồm cả form thẻ, lead, dự án) và các modal (mời thành viên, tạo nhóm); banner đầu trang chỉ còn cho lỗi tải trang và hành động cấp trang. (4) Trang không có quyền (API 403 `FORBIDDEN`) hiển thị trạng thái bản địa hoá theo ngôn ngữ giao diện (component `Forbidden` dùng chung, khóa `Common.forbidden`) ở mọi trang danh sách/chi tiết; bản địa hoá các chuỗi hardcode còn sót (confirm xoá ở Projects, ghi chú giới hạn Admin ở chi tiết thành viên). `lib/projects/api` từ nay đính kèm code/status vào lỗi như các lib khác.
- Acceptance Criteria: Nguyen nghiệm thu ở production: cấp quyền Portal trùng email → cảnh báo đỏ hiện ngay trong section Portal; đăng nhập bằng member@demo.test mở Khách hàng/Dự án → trang "không có quyền truy cập" đúng ngôn ngữ đang chọn (EN/VI); mở link mời khách ở trang accept nội bộ → tự sang trang accept Portal; mở link mời email mới khi đang đăng nhập tài khoản khác → chỉ thấy cảnh báo sai tài khoản, không thấy form/nút nhận lời mời; web build PASS, vitest PASS, không khóa i18n lơ lửng.

## FIX-022 — Chú thích semantics gỡ team trong chi tiết dự án (PO yêu cầu tại nghiệm thu FIX-021, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Tại nghiệm thu FIX-021, PO xác nhận hành vi gỡ team hiện tại là đúng thiết kế TEAM_CONTRACT §4 (chỉ gỡ thành viên vào qua team và chưa có task; thành viên có task được giữ thành thành viên trực tiếp; thành viên thêm riêng không bị ảnh hưởng) nhưng yêu cầu thêm một chú thích nhỏ để người dùng không hiểu lầm. Bổ sung đúng một dòng chú thích tĩnh (khóa i18n `Projects.teamAssignment.note`, EN + VI) ngay dưới hàng nút Gán/Gỡ trong section gán team của trang chi tiết dự án. Không đổi hành vi, không đổi API.
- Acceptance Criteria: Nguyen mở chi tiết dự án ở production: dòng chú thích hiển thị đúng nội dung EN/VI dưới hàng nút Gán/Gỡ; web build PASS; không khóa i18n lơ lửng.

## FIX-021 — Hiển thị team đã gán trong chi tiết dự án (góp ý PO 2026-11-26, PO duyệt phương án A qua trang mẫu)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Trước đây trang chi tiết dự án không hiển thị bền vững team nào đã được gán: section gán team chỉ có ô chọn + nút Gán/Gỡ + dòng kết quả tạm, chip thành viên không ghi nguồn team, tải lại trang là mất dấu vết. PO duyệt phương án A từ trang mẫu "Preview 3 phương án hiển thị team đã gán": (1) BE bổ sung trường via_team_id vào danh sách thành viên ở ProjectMemberController (endpoint mà trang chi tiết đang dùng) và vào ProjectResource cho nhất quán bề mặt API — dữ liệu gốc đã có sẵn ở pivot project_members. (2) FE: section Gán team thêm hàng "Team đã gán" dạng chip (tên team + số thành viên team đóng góp, suy ra từ via_team_id của các thành viên hiện tại — đúng ngữ nghĩa snapshot: team chỉ còn được tính là đã gán khi còn ít nhất một thành viên trong dự án), trạng thái rỗng hiện "Chưa gán team nào"; chip của thành viên đến từ team có thêm nhãn nhỏ tên team; team đã bị xoá thì nhãn hiện "Team đã xoá". Danh sách team nay tải cho mọi người xem (không chỉ người có quyền sửa dự án) để phân giải tên team cho nhãn, lỗi tải thì nhãn tự ẩn. Thêm 4 khóa i18n Projects.teamAssignment (EN + VI).
- Acceptance Criteria: Nguyen mở chi tiết dự án "Website Redesign for Demo Client" ở production, gán Demo Delivery Team rồi tải lại trang: hàng "Team đã gán" còn nguyên chip team kèm số thành viên, các thành viên đến từ team có nhãn tên team trên chip; gỡ team thì hàng chip biến mất tương ứng. API: suite 129 test PASS, Pint PASS; web build PASS.

## FIX-020 — Menu kebab bị khung bảng cắt + thống nhất click dòng/card (feedback PO tại nghiệm thu FIX-019, 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Hai phần. PHẦN 1 (đã làm, PR riêng): thống nhất điều hướng theo DEC-023 — PO chốt Cách 1 "click dòng/card vào chi tiết" cho toàn bộ table row và card data: bảng Tasks trong chi tiết dự án thêm click dòng (tiêu đề chuyển thành chữ thường), card task mobile click toàn card; card mobile của Projects/Members và card Teams thêm click toàn card; Workload thêm click dòng/card vào chi tiết thành viên; bỏ mục "Chi tiết" khỏi kebab ở Projects/Members/Teams (kebab chỉ còn hành động thật), riêng bảng Members hết hành động trên dòng nên bỏ hẳn cột kebab và phân bổ lại bề rộng cột; Kanban CRM là ngoại lệ có chủ đích (card kéo–thả đổi giai đoạn). PHẦN 2 (đã làm, gộp cùng PR): menu kebab bị khung bảng cắt ở các dòng cuối (DataTable framed bọc overflow-hidden, menu absolute mở xuống bị cắt — bằng chứng là ảnh của PO tại trang Projects; bảng không khung không bị). PO chốt hướng (c) kèm nguyên tắc dùng shadcn/ui linh động theo từng component (DEC-024): ActionMenu render menu qua portal với position fixed bám theo vị trí nút bấm, tự lật lên trên khi sát đáy viewport và giữ vị trí khi cuộn trang — menu không còn bị bất kỳ khung chứa nào cắt.
- Acceptance Criteria: Phần 1 — Nguyen chạy production, bấm thử từng danh sách (Clients, Projects, Members, Teams, Workload, Tasks trong chi tiết dự án) ở cả desktop và bề rộng mobile: click dòng/card đều vào đúng trang chi tiết, kebab chỉ còn hành động. Phần 2 — mở menu ở dòng cuối của bảng có khung (trang Projects) và thử cuộn trang khi menu đang mở: menu hiển thị trọn vẹn, không bị cắt. Typecheck + build PASS.

## FIX-019 — Tinh chỉnh hiển thị dữ liệu sau nghiệm thu FE-019 (DEC-022, PO duyệt mẫu 2026-11-26)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Áp dụng DEC-022 từ feedback nghiệm thu FE-019 của PO (kèm ảnh chụp trang chi tiết dự án): (1) header table giảm còn 11px + khóa một dòng + ellipsis (component DataTable dùng chung, mọi bảng hưởng lợi); (2) Priority hiển thị dạng chip màu ngữ nghĩa ở bảng Tasks trong chi tiết dự án, card mobile của task và trường priority ở chi tiết task (helper mới `priorityBadgeClass`: urgent đỏ, high đỏ hồng, medium hổ phách, low xám); (3) bỏ viền lồng nhau ở trang chi tiết dự án theo nguyên tắc "một khối dữ liệu = một cấp viền": DataTable thêm prop `framed` — bảng Tasks nằm trong section thì bỏ khung riêng, chỉ giữ kẻ dòng, ô ở mép áp sát padding của section; milestone và card task mobile bỏ viền từng item, phân tách bằng divider; (4) skeleton lần tải đầu của trang chi tiết dự án làm lại đúng hình học: section Tasks dùng skeleton dạng table đúng 6 cột và tuân thủ quy tắc hiện sau ~200ms như các trang danh sách (trước đây là thanh xám chung chung và hiện ngay lập tức). Ngoài phạm vi: checkbox chọn nhiều dòng cho thao tác hàng loạt — PO chủ động hoãn 2026-11-26, chỉ làm khi PO chỉ định màn hình cụ thể.
- Acceptance Criteria: Nguyen chạy app ở chế độ production (WEB_MODE=prod) kiểm tra bằng mắt trang chi tiết dự án: header bảng Tasks một dòng, không phình; Priority là chip màu; section Milestones/Tasks chỉ còn một cấp viền; mở trang chi tiết với mạng chậm (hoặc throttle trong DevTools) thấy skeleton dạng bảng. Typecheck + build PASS.
- Blockers: Không có.

## FIX-017 — Portal login: gradient chưa phủ hết chiều cao trang (PO báo 2026-11-26)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Sau FIX-016, gradient đã phủ kín chiều ngang nhưng còn một dải nền xám dưới chân trang trên màn hình cao: `h-full` trên thẻ main không giãn hết vùng nội dung. Sửa cơ chế giãn chiều cao: wrapper nội dung của Portal layout chuyển thành flex column, main của trang đăng nhập dùng `flex-1` để gradient phủ kín toàn bộ chiều cao giữa header và footer. Các trang Portal khác không đổi giao diện (main của chúng giữ chiều cao theo nội dung như trước).
- Acceptance Criteria: Nguyen mở `/portal/login` trên màn hình cao: gradient phủ kín từ dưới header tới sát footer, không còn dải xám; các trang Portal khác (danh sách dự án, chi tiết) hiển thị như cũ. Typecheck + build PASS.
- Blockers: Không có.

## FIX-016 — Mất 4 khóa Auth.login khi merge PR #63 + Portal login fill nền toàn trang (PO báo 2026-11-26)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: Hai việc. (1) Trang đăng nhập nội bộ hiện mã khóa `Auth.login.heading/backHome/portalPrompt/portalLink`: 4 khóa FE-017 thêm vào đã bị mất khỏi main khi squash merge PR #63 (cùng cơ chế mất mục tài liệu đã xử lý ở PR #66 — đợt khôi phục đó chỉ rà TASK.md/CHANGELOG.md, chưa rà file messages sau merge #63; đây là thiếu sót rà soát của Muse). Khôi phục nguyên văn 4 khóa EN + VI. Muse đã chạy rà soát toàn app: 642 tham chiếu khóa i18n, chỉ đúng 4 khóa này bị treo, mọi khóa khác (Home của FE-016, Portal.login của FE-018, actions.detail của FIX-014) đều nguyên vẹn. Từ nay sau MỖI lần merge PR đụng file messages, Muse chạy lại rà soát khóa treo trước khi báo cáo. (2) Theo feedback của PO: nền gradient của trang đăng nhập Portal trước đây chỉ là một panel bo góc nổi giữa trang — nay gradient fill toàn bộ vùng trang từ mép này sang mép kia (bỏ khung panel), header/footer Portal giữ nguyên.
- Acceptance Criteria: Nguyen mở `/login`: tiêu đề "Đăng nhập Brewbase", link "← Về trang chủ", dòng "Bạn là khách hàng? Vào Cổng khách hàng →" hiển thị đúng chữ ở cả EN/VI, không còn mã khóa. Mở `/portal/login`: gradient phủ kín toàn trang, không còn panel nổi. Typecheck + build PASS; rà soát khóa treo = 0.
- Blockers: Không có.

## FIX-013 — Menu three-dot cho card dữ liệu + sửa tràn ngang mobile (feedback PO 2026-11-25)
- Status: DONE
- Assignee: Muse (thay vai FE theo quy ước 2026-11-23) · Reviewer: Nguyen (nghiệm thu bằng mắt + merge)
- Mô tả: (1) Quy ước mới của PO: mọi hành động trên card dữ liệu (Sửa/Xoá/Đánh dấu xong...) thu gọn vào một nút icon three-dot (component dùng chung mới `ActionMenu` + icon `more-vertical`, đóng khi bấm ra ngoài/Esc), bấm mới hiện danh sách hành động — không hiển thị nút chữ trực tiếp trên card nữa; đã áp cho card danh sách Projects/Clients/Teams/Members, cột mốc + công việc (chi tiết dự án), checklist + bình luận (chi tiết công việc), người liên hệ + hoạt động + ghi chú (chi tiết Lead/Client). Hành động cấp trang giữ nguyên. Quy ước đã ghi vào `docs/UI_GUIDELINES.md` mục 7. (2) Sửa tràn ngang trên mobile ở trang chi tiết dự án: tiêu đề dự án thiếu `min-w-0`/ngắt chữ khiến hàng header bị đẩy rộng hơn màn hình; thêm `min-w-0` + `break-words` cho tiêu đề và các giá trị ở khối tổng quan, nút tiêu đề công việc chặn rộng tối đa. (3) Ghi chú kèm theo: bản FIX-012 đã có trên main (PR #59) — nếu máy chạy không thấy thay đổi thì kiểm tra `git pull` đã cập nhật chưa và recreate container web (xem hướng dẫn trong PR).
- Acceptance Criteria: Nguyen mở app kiểm tra bằng mắt: mọi card có nút three-dot mở menu hành động đúng chức năng; trang chi tiết dự án trên mobile không còn thanh cuộn ngang. Typecheck + build PASS.
- Blockers: Không có.

## QA-006 — Bộ test quét cách ly dữ liệu giữa các agency (cross-tenant isolation sweep)
- Status: DONE
- Assignee: OpenCode · Reviewer: Nguyen
- Mô tả: Từ yêu cầu rà soát cơ chế cách ly tenant của PO (2026-11-25): các module test hiện có chỉ kiểm tra truy cập chéo ở vài endpoint chính (client/lead/project show + tham chiếu lạ khi tạo). QA-006 bổ sung `tests/Feature/Security/CrossTenantIsolationTest.php` quét TOÀN BỘ endpoint có nhận ID: đăng nhập bằng Owner của agency A rồi gọi mọi route theo ID của agency B (clients + contacts/notes/portal-accounts, leads + contacts/notes/activities/convert, projects + timeline/members/milestones/tasks/teams, tasks + comments/checklist, teams + members, users + roles/activation, invitations resend/revoke) — kỳ vọng 404; các ID con của B đặt dưới ID cha của A — kỳ vọng 404; tham chiếu bản ghi của B trong body — kỳ vọng 422 CROSS_TENANT_REFERENCE; danh sách không rò bản ghi của agency khác; Portal chỉ thấy project của đúng client mình. Kết quả chạy đầu: 10 test / 106 assertion PASS, toàn bộ suite 96 test PASS, Pint PASS — không phát hiện rò rỉ nào.
- Acceptance Criteria: File test nằm trong repo, chạy PASS trong suite; mọi endpoint có ID đều có ít nhất một probe truy cập chéo.
- Progress: 2026-11-25 — Muse đã viết + chạy PASS trên branch `qa/QA-006-cross-tenant-isolation`; chờ Nguyen review + merge.
- Progress: 2026-11-25 — PR #54 đã merge SAU PR #55 (BE-009/DEC-018) nên file test v1 (viết theo mô hình cũ: `client_accounts`, `users.agency_id`) không còn chạy được trên main. PR dọn dẹp `fix/QA-006-remove-superseded-test` xoá file test v1 khỏi main; QA-006 v2 sẽ viết lại sweep theo mô hình membership (đọc route từ router) đúng thứ tự task đã duyệt. Kết quả quét v1 (không rò rỉ) vẫn là bằng chứng lịch sử của cơ chế cũ.
- Progress: 2026-11-26 — OpenCode viết QA-006 v2 theo mô hình membership (DEC-018/DEC-020): `tests/Feature/Security/CrossTenantIsolationTest.php`, 22 test / 98 assertion, toàn bộ suite 129 PASS, Pint PASS; không phát hiện rò rỉ.
- Blockers: Không có.

## QA-003 — Bộ test CRM/Lead theo CRM_CONTRACT + chạy thật trên BE-005
- Status: DONE
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Viết test case cho module CRM/Lead từ Acceptance Criteria của `docs/CRM_CONTRACT.md` (CRUD + filter, ma trận quyền `leads.*`, chuyển đổi Lead → Client gồm guard 409/422, notes, activities + due list, pipeline summary, contacts dùng chung, cô lập tenant) tại `tests/e2e/crm-lead.spec.ts`, rồi chạy thật sau khi BE-005 merge.
- Kết quả: Migrations BE-005 trên MySQL 8 (Docker) đạt; LeadModuleTest 16/16 PASS; Playwright 10 passed / 8 skipped — các skip do thiếu dữ liệu seed (user đa vai trò, agency thứ hai, lead đã convert sẵn), ghi nhận thành backlog mở rộng seed, không phải lỗi. Kèm verdict review bù BE-005: PASS → BE-005 chuyển DONE.
- Progress: PR #30 đã merge (2026-11-21); Muse review chéo ĐẠT; đóng DONE trong release 0.3.0 theo ngoại lệ F.2 (Muse bổ sung mục này vì OpenCode chưa từng tạo mục QA-003 trong TASK.md).

## FE-006 — Sửa lỗi double `/v1` trong getBackendApiUrl() (từ review bù FIX-004)
- Status: DONE
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Fallback `NEXT_PUBLIC_API_URL` (đang chứa `/v1`) bị nối thêm `/v1` khi gọi API khiến dev FE ngoài Docker sai path. Chuẩn hoá bằng `normalizeBackendBaseUrl()` (bỏ slash cuối + bỏ đúng một đoạn `/v1` cuối), giữ thứ tự ưu tiên INTERNAL_API_URL > NEXT_PUBLIC_API_URL > localhost; kèm 3 test hồi quy.
- Progress: PR #31 đã merge (2026-11-21); suite web 27/27 PASS, typecheck PASS; Muse review chéo ĐẠT; đóng DONE trong release 0.3.0 theo ngoại lệ F.2 (Muse bổ sung mục này vì OpenCode chưa từng tạo mục FE-006 trong TASK.md).

## BE-006 — Module Project Management (Nhóm 3) theo hợp đồng PROJECT_CONTRACT
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: be/BE-006-project-management · PR: (PR triển khai BE-006)
- Blocked by: —
- Acceptance Criteria: Đủ endpoints và quy tắc trong docs/PROJECT_CONTRACT.md: projects CRUD + lọc, project members, milestones, tasks CRUD + lọc + due list, task comments, checklist items, progress % tính lúc đọc, timeline dạng list, endpoint Portal chỉ-đọc, ma trận quyền projects.*/tasks.* theo DEC-016, cách ly tenant. Test: bộ test Feature cho module Project đạt, Pint PASS, OpenAPI cập nhật.
- Progress: Hợp đồng đã được Nguyen duyệt theo đề xuất ngày 2026-11-22 và công bố trong PR #35 (DEC-016, đã merge). Muse đã triển khai xong trong PR này: 6 migration (projects, project_members, milestones, tasks, task_comments, task_checklist_items), projects/milestones/tasks CRUD + bộ lọc, members, timeline dạng list, progress % tính lúc đọc, task comments + checklist, endpoint Portal chỉ-đọc, ma trận quyền projects.*/tasks.* theo DEC-016 kèm scope Team Member (chỉ thấy project tham gia, chỉ sửa task được gán); bộ test toàn cục 72 passed, Pint PASS, OpenAPI 48 paths.
- Handoff: OpenCode review theo ma trận G.3 sau khi Muse mở PR triển khai. Task FE/QA cho Nhóm 3: ⏸ chờ BE-006 merge.

---
- Đóng task: DONE 2026-11-22 — QA-004 chạy thật PASS: `tests/e2e/project.spec.ts` (29 ca) trên Docker/MySQL 8 + seed demo. Minimal seed: 17 PASS / 12 SKIP (thiếu dữ liệu seed đa vai trò/agency thứ hai — ghi nhận backlog seed, không phải lỗi sản phẩm). Bật seed QA đầy đủ 7 vai: 29 PASS / 0 SKIP trong các lô an toàn rate-limit. Verdict review bù BE-006: PASS → BE-006 chuyển DONE theo thẩm quyền QA.

## FE-008 — Màn hình Project Management (Nhóm 3) theo PROJECT_CONTRACT
- Assignee: OpenCode · Level: L3 · Status: DONE
- Branch: fe/FE-008-project-management · PR: (mở PR vào main)
- Blocked by: BE-006 (đã merge)
- Acceptance Criteria: Bật mục Projects trên sidebar; màn hình danh sách Projects với bộ lọc client/trạng thái/người phụ trách/tìm kiếm, hiển thị client, trạng thái, % tiến độ kèm số task done/tổng; empty state; màn hình chi tiết Project với tổng quan, thanh tiến độ, Milestones kèm %, Members thêm/gỡ, Tasks lọc theo trạng thái/ưu tiên/người gán/milestone; chi tiết Task với mô tả/trạng thái/ưu tiên/hạn/người gán, checklist thêm/tick/xóa, comments thêm/xóa theo quyền; BFF route proxy tới /projects,/tasks; i18n namespace Projects EN/VI; quyền hiển thị theo DEC-016.
- Progress: OpenCode hoàn thành 2026-11-22: bật nav Projects, trang danh sách + chi tiết dự án + chi tiết công việc, BFF proxy routes, i18n Projects (U+FFFD vi.json = 0). Tự kiểm: pnpm typecheck PASS, pnpm build PASS (en/vi), pnpm test PASS (27). Responsive rà soát class cho 3 bề rộng (mobile 390, tablet 768, desktop 1280): sidebar drawer, grid sm:2 lg:3, form grid sm:2, filter wrap; chip/badge whitespace-nowrap; min-height vùng nội dung + empty state.
- Handoff: Chờ Muse review chéo (DEC-011); không tự merge.

## FE-010 — Màn hình Client Management (Nhóm 2) theo CLIENT_CONTRACT
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: fe/FE-010-client-screens · PR: (mở PR vào main)
- Blocked by: BE-004 (đã merge)
- Acceptance Criteria: Bật mục Clients trên sidebar + route guard; danh sách Clients với bộ lọc trạng thái/tag/người phụ trách/tìm kiếm, thẻ hiển thị trạng thái/loại/tag/người phụ trách/số tài khoản Portal, empty state; tạo Client (kèm Organization khi type=company, kèm tag_ids) và tạo Tag; chi tiết Client gồm tổng quan + sửa hồ sơ/trạng thái/người phụ trách/tags/organization, Contacts thêm/sửa/xoá + cờ người liên hệ chính, Notes nội bộ thêm/xoá theo quy tắc tác giả (hoặc Owner/Admin), Portal accounts tạo mới + khoá/mở; xoá Client chỉ Agency Owner; BFF proxy tới /clients, /tags, /users; i18n namespace Clients EN/VI; quyền hiển thị theo ma trận DEC-009.
- Progress: Muse hoàn thành 2026-11-24 (theo quy ước PO chốt 2026-11-23: Muse thay vai FE khi cần, OpenCode ưu tiên QA): bật nav Clients + route guard, trang danh sách + chi tiết Client, BFF routes, i18n Clients (vi.json U+FFFD = 0, dấu hiệu mã hoá đôi Ã = 0, đủ 70/70 key EN/VI). Tự kiểm: pnpm typecheck PASS, pnpm build PASS (en+vi), pnpm test PASS (27/27). Responsive rà soát class cho 3 bề rộng (mobile 390, tablet 768, desktop 1280): lưới thẻ sm:2 xl:3, form grid sm:2, filter wrap; chip/badge whitespace-nowrap; min-height vùng nội dung + empty state.
- Progress: Đã merge vào main và đóng gói trong bản 0.5.0.
- Handoff: Chờ Nguyen nghiệm thu trực quan + merge (Muse không tự duyệt FE của chính mình); ca UI QA bổ sung khi OpenCode có quota.


---

## QA-004 — Bộ test Project Management theo PROJECT_CONTRACT + chạy thật trên BE-006
- Status: DONE
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Viết test case cho module Project Management từ Acceptance Criteria của `docs/PROJECT_CONTRACT.md` (CRUD project/milestone/task + bộ lọc, ma trận quyền 7 vai, cô lập tenant 404/422, progress %, timeline ordering, soft delete cascade, completed_at, endpoint Portal chỉ-đọc, token app/portal không dùng chéo) tại `tests/e2e/project.spec.ts`, rồi chạy thật sau khi BE-006 merge; bổ sung `tests/e2e/project-ui.spec.ts` cho UI FE-008.
- Kết quả: Migrations BE-006 trên MySQL 8 (Docker) đạt; Playwright API 29 ca — minimal demo seed 17 PASS / 12 SKIP (thiếu dữ liệu seed đa vai trò/agency thứ hai, ghi nhận backlog seed, không phải lỗi); seed QA đầy đủ 29 PASS / 0 SKIP trong các lô an toàn rate-limit. UI FE-008: `tests/e2e/project-ui.spec.ts` 5/5 PASS trên stack Docker (owner@demo.test). Kèm verdict review bù BE-006: PASS → BE-006 chuyển DONE.
- Progress: PR mở vào main chờ Muse review; CHANGELOG [Unreleased] QA & Fixes cập nhật.

---

## Inbox
*Mọi agent được thêm mục mới ở đây, không sửa mục của người khác. (Hiện chưa có mục nào.)*

- [QA-001 · 2026-11-20] `docs/CONVENTIONS.md:252` — dòng cuối "chốt stack backend + scope MVP — vẫn đang chờ, chưa bắt đầu code" đã lỗi thời sau DEC-001/DEC-004 và các PR #1–#4. Đề xuất Nguyen/Muse sửa hoặc xoá dòng này qua PR `docs/` theo DEC-002; QA không tự sửa quy ước.
- [QA-001 · 2026-11-20] `docs/AUTH_CONTRACT.md:37-43,81-85` — DEC-008.3 chốt "Portal có quên mật khẩu, dùng chung cơ chế email" nhưng bảng endpoint Portal thiếu `POST /portal/auth/forgot-password` và `POST /portal/auth/reset-password`. Đề xuất Muse + Nguyen chốt method/path/request/response + mã lỗi trước khi QA chạy test thật QA-002.
- [QA-002 · 2026-11-20] `apps/api/bootstrap/app.php` / `auth:sanctum`: sau logout hoặc đổi mật khẩu, token bị xoá khiến `GET /api/v1/auth/me` trả **500** (`Route [login] not defined`) thay vì 401 `UNAUTHENTICATED`. Cần cấu hình `redirectTo` trả null cho API hoặc xử lý unauthenticated JSON trong Authenticate middleware. Ảnh hưởng TC-AUTH-14, 15 (FAIL).
- [QA-002 · 2026-11-20] `apps/api` setup: thiếu `storage/framework/views` trên checkout sạch khiến forgot-password/reset-password (gửi mail markdown) trả 500 "Please provide a valid cache path"; cần tạo thư mục hoặc chạy `php artisan view:cache` trong entrypoint Docker.
- [QA-002 · 2026-11-20] `docs/AUTH_CONTRACT.md` vs `apps/api`: contract nội bộ ghi reset password dùng `new_password`, nhưng implementation/tests dùng `password` (Portal cũng dùng `password`). Cần Muse + Nguyen thống nhất tên field.
- [QA-005 · 2026-11-24] FE-009: `apps/web/messages/{en,vi}.json` thiếu key `Shell.nav.team`, nên mở bất kỳ trang Team nào cũng log `MISSING_MESSAGE: Could not resolve 'Shell.nav.team'` (Sidebar). Cần bổ sung nhãn Team EN/VI và kiểm tra lại sidebar. Không chặn BE-007 (QA-005 UI vẫn PASS).
- [QA-005 · 2026-11-24] FE-009: form `accept-invitation` dùng `<label>` rời, không `htmlFor`/id nên `getByLabel` không truy cập được (lỗi accessibility + E2E). Cần gắn id/`htmlFor` (hoặc bọc input trong label). QA-005 tạm dùng selector vị trí.

## BE-007 — Module Team & Resource Management (Nhóm 4) theo hợp đồng TEAM_CONTRACT
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: be/BE-007-team-resource · PR: (PR triển khai BE-007)
- Blocked by: —
- Acceptance Criteria: Đủ endpoints và quy tắc trong docs/TEAM_CONTRACT.md: teams CRUD + thành viên, danh bạ nhân viên (users) + hồ sơ, gán/đổi vai, khoá/mở tài khoản (thu hồi token), invitations (mời/accept/resend/thu hồi, token hash, hạn 7 ngày), gán project theo team kiểu snapshot (via_team_id), GET /workload-lite, ma trận quyền teams.*/users.*/invitations.* theo DEC-017 kèm giới hạn Admin, cách ly tenant. Test: bộ test Feature cho module Team đạt, Pint PASS, OpenAPI cập nhật.
- Progress: Hợp đồng đã được Nguyen duyệt theo đề xuất ngày 2026-11-22 và công bố trong PR #40 (DEC-017, đã merge). Muse đã triển khai xong trong PR này: 4 migration (teams + team_user, invitations, users.job_title/phone, project_members.via_team_id), teams CRUD + thành viên, danh bạ nhân viên + quản trị tài khoản (đổi vai, khoá/mở kèm thu hồi token, giới hạn Admin theo DEC-017), invitations (token hash, hạn 7 ngày, accept công khai, resend/thu hồi), gán project theo team kiểu snapshot, GET /workload-lite; bộ test toàn cục 86 passed, Pint PASS, OpenAPI 63 paths.
- QA: QA-005 chạy thật 2026-11-24 trên Docker/MySQL 8 + seed demo đầy đủ — 21/21 PASS (16 API + 5 UI), 0 SKIP, 0 FAIL. Verdict PASS → BE-007 chuyển DONE theo thẩm quyền QA.
- Handoff: OpenCode review theo ma trận G.3 sau khi Muse mở PR triển khai. Task FE/QA cho Nhóm 4: BE-007 đã merge và QA-005 PASS.

---

## FE-009 - Màn hình Team & Resource (Nhóm 4) theo TEAM_CONTRACT
- Assignee: OpenCode · Level: L3 · Status: DONE
- Branch: fe/FE-009-team-resource · PR: (mở PR vào main)
- Blocked by: BE-007 (đã merge)
- Acceptance Criteria: Thêm mục Team sidebar + route guard; Members danh bạ với lọc vai trò/team/trạng thái/tìm kiếm, chi tiết nhân viên với sửa hồ sơ, đổi vai, khoá/mở; Teams CRUD + thành viên; Invitations danh sách + form mời mới (email + vai trò, ẩn Owner/Admin theo quyền) + resend/revoke; Workload theo người; trang công khai nhận lời mời; bổ sung team assignment vào chi tiết Project (added/removed/kept); BFF proxy; i18n Teams EN/VI.
- Progress: OpenCode hoàn thành 2026-11-22: trang members/teams/invitations/workload, chi tiết member/team, accept-invitation công khai, BFF routes, i18n Teams (U+FFFD=0, Ã=0). Tự kiểm: typecheck PASS, build PASS (en+vi), tests PASS. Responsive rà soát class ở 3 bề rộng (390/768/1280).
- Progress: Muse hoàn thiện + review chéo 2026-11-23 (theo quy ước PO: Muse thay vai FE khi cần, OpenCode ưu tiên QA): thay ô nhập ID thô bằng ô chọn team (chi tiết Project) và ô chọn thành viên (chi tiết Team), i18n toàn bộ chuỗi cứng còn lại (Projects.teamAssignment, confirm xoá team/thu hồi lời mời), map lỗi accept-invitation theo error.code thay vì dò chuỗi message, xoá file tạm apps/api/seed_qa_tmp.php khỏi branch. Tự kiểm lại: typecheck PASS, build PASS (en+vi), test PASS; vi.json U+FFFD=0, Ã=0.
- Handoff: Chờ Muse review chéo (DEC-011); không tự merge.

---

## FE-011 — Màn hình CRM / Lead (Nhóm 1) theo CRM_CONTRACT
- Assignee: Muse · Level: L3 · Status: DONE
- Branch: fe/FE-011-lead-screens-v2 · PR: (mở PR vào main; phát hành lại từ main sau khi PR #44 merge, thay thế PR #45)
- Blocked by: BE-005 (đã merge)
- Acceptance Criteria: Bật mục Leads trên sidebar + route guard; board Pipeline Kanban theo DEC-013 (4 cột trạng thái cố định new/contacted/qualified/unqualified, kéo-thả đổi trạng thái, thẻ lead có giá trị ước tính/nguồn/người phụ trách) + dải tổng hợp pipeline (số lead + tổng giá trị theo trạng thái, từ /leads/pipeline-summary) + danh sách follow-up đến hạn (/lead-activities/due); bộ lọc tìm kiếm/nguồn/người phụ trách; tạo Lead; chi tiết Lead gồm tổng quan + sửa hồ sơ (khoá trường chính sau khi convert), Contacts dùng chung thêm/sửa/xoá + cờ chính, Notes nội bộ theo quy tắc tác giả, Activities thêm/đánh dấu xong/mở lại/xoá, chuyển đổi Lead → Client (chọn người phụ trách; gặp 422 DUPLICATE_CLIENT_CANDIDATE thì cảnh báo + nút force convert; 409 hiển thị đã chuyển đổi; thành công chuyển sang trang Client); BFF proxy tới /leads, /lead-activities; i18n namespace Leads EN/VI; quyền hiển thị theo ma trận DEC-014 (leads.*).
- Progress: Muse hoàn thành 2026-11-24 (theo quy ước PO chốt 2026-11-23: Muse thay vai FE khi cần, OpenCode ưu tiên QA): bật nav Leads + route guard, board Kanban + chi tiết Lead, BFF routes, i18n Leads (vi.json U+FFFD = 0, dấu hiệu mã hoá đôi Ã = 0, đủ 82/82 key EN/VI). Tự kiểm: pnpm typecheck PASS, pnpm build PASS (en+vi), pnpm test PASS (27/27). Responsive rà soát class cho 3 bề rộng (mobile 390, tablet 768, desktop 1280): board grid md:2 xl:4, form grid sm:2, filter wrap; chip/badge whitespace-nowrap; min-height vùng nội dung + empty state.
- Progress: Đã merge vào main và đóng gói trong bản 0.5.0.
- Handoff: Chờ Nguyen nghiệm thu trực quan + merge (Muse không tự duyệt FE của chính mình); ca UI QA bổ sung khi OpenCode có quota.
## QA-005 — Bộ test Team & Resource theo TEAM_CONTRACT + chạy thật trên BE-007
- Status: DONE
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Viết test case từ Acceptance Criteria của `docs/TEAM_CONTRACT.md` (teams CRUD + thành viên + ma trận quyền, directory/hồ sơ/lọc, đổi vai hiệu lực ngay + giới hạn Admin/Owner, activation thu hồi token, invitation lifecycle gồm expired/resend/revoke, snapshot team→project added/removed/kept, workload-lite, cô lập tenant 404/422) tại `tests/e2e/team.spec.ts`; bổ sung `tests/e2e/team-ui.spec.ts` cho UI FE-009 (Members + lọc, Teams list, chi tiết team + members, Workload, accept-invitation token sai). Chạy thật trên Docker/MySQL 8 với seed demo đầy đủ (owner/admin/sales/PM/accountant/team member + agency thứ hai, Mailpit bật).
- Kết quả: API **16/16 PASS**, UI **5/5 PASS** — tổng **21 PASS / 0 SKIP / 0 FAIL**. Các ca API gồm TC-TEAM-01…16 (duplicate name 422, PM tạo nhưng không xoá được team, Sales chỉ đọc, Team Member chỉ thấy team của mình + team khác 404, member idempotent + cross-tenant 422/404, lọc directory + open task count, đổi vai hiệu lực ngay trên token cũ, Admin không quản Admin, Owner invariant 403/422, deactivate thu hồi token + `ACCOUNT_DISABLED` + reactivate, invitation pending/registered/Owner-role/Admin guards, accept + login đúng vai, second accept 422, invalid token 404, expired 422 `INVITATION_EXPIRED`, resend vô hiệu token cũ, revoke giết link, snapshot không lan truyền thành viên mới, detach giữ người có task + `via_team_id=null`, workload + Team Member chỉ thấy dòng mình, cô lập tenant). Mail invitation token lấy qua Mailpit; tài khoản mời là disposable, không sửa tài khoản seed dùng chung. Verdict: PASS → BE-007 DONE.
- Ghi nhận ngoài phạm vi (FE-009, không chặn BE-007): thiếu message `Shell.nav.team` khiến web log `MISSING_MESSAGE` trên các trang Team; label form accept-invitation không gắn với input (test dùng selector vị trí). Đã ghi Inbox.
- Progress: PR mở vào main chờ Muse review; CHANGELOG `[Unreleased]` → QA & Fixes đã cập nhật; không bump VERSION (0.5.0 do prompt đóng gói riêng).
- Progress: Đã merge vào main và đóng gói trong bản 0.5.0.
- Handoff: Muse review PR; không tự merge.

---

## BE-009 — Tái cấu trúc danh tính: một identity cho nhiều agency (DEC-018)
- Assignee: Muse · Level: L5 (DEC-018) · Status: DONE
- Branch: be/BE-009-identity-memberships · PR: (Muse mở PR vào main, chờ Nguyen review)
- Blocked by: —
- Acceptance Criteria: Schema memberships + membership_role (CHECK constraint kind/client_id, unique theo agency/user/kind/client); users bỏ agency_id/job_title/phone, thêm last_membership_id; bỏ role_user + client_accounts; token gắn agency_id + membership_id; Tenant context fail-closed (TenantContextMissing) + ResolveTenant kiểm tra membership mỗi request (MEMBERSHIP_INACTIVE, AGENCY_LOCKED); login/select-agency/switch-agency cho cả app và Portal trên một danh tính; selection token chỉ dùng được cho select/switch; Portal gộp vào identity (bỏ provider clients); invitations liên kết identity có sẵn (ALREADY_MEMBER, STAFF_CLIENT_MEMBERSHIP_CONFLICT); xoá client vô hiệu hoá client memberships + thu hồi token; toàn bộ test cũ thích ứng + test mới cho các kịch bản DEC-018; Pint PASS; DEC-018 ghi vào DECISIONS.md; AGENTS.md bổ sung quy tắc tenant.
- Progress: Muse triển khai xong 2026-11-25: 5 migration mới, Tenant v2 fail-closed, ResolveTenant + ưu tiên middleware trước SubstituteBindings, auth app/Portal viết lại theo login/select/switch, directory/workload/invitations/portal-accounts thích ứng theo membership, DemoDataSeeder + factory viết lại (giữ nguyên tài khoản demo). Tự kiểm: toàn bộ suite 94 passed (87 cũ đã thích ứng + 7 test mới MultiAgencyIdentityTest), Pint PASS.
- Handoff: DỪNG chờ Nguyen review PR này; không bắt đầu BE-010 trước khi BE-009 được merge.

---

## BE-010 — Hoàn thiện membership: invitations v2 + portal invite-link + Owner-invariant tests
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: OpenCode (QA)
- Mô tả: Ba luồng theo kế hoạch đã được PO duyệt 2026-11-25, hiệu lệnh bắt đầu + chốt mẫu email 2026-11-26 (DEC-020). (1) Invitations v2: người được mời đã có danh tính thì chấp nhận bằng cách đăng nhập rồi xác nhận (không đặt mật khẩu lần hai) — chưa đăng nhập trả 403 INVITATION_LOGIN_REQUIRED, đăng nhập bằng danh tính khác trả 403 INVITATION_IDENTITY_MISMATCH; email mới giữ luồng công khai đặt tên + mật khẩu; thêm GET /invitations/preview cho màn hình xác nhận. (2) Portal invite-link thay DEC-009 điểm 6: cấp quyền Portal cho email mới = gửi invitation kind=client (link tự đặt mật khẩu, dùng lại mẫu email lời mời, câu chữ link đổi cho Portal); email đã có danh tính = tạo membership client ngay như cũ; Q3 chặn ở mọi điểm tạo membership. (3) Bất biến Owner: thêm POST /ownership/transfer (chỉ Owner; gỡ vai Owner khỏi membership cũ + gán cho membership mới trong MỘT transaction, thu hồi token cả hai); test bao phủ transfer, giới hạn Admin, và cascade xoá client → vô hiệu membership Portal + thu hồi token.
- Acceptance Criteria: toàn bộ suite PASS trên SQLite VÀ MySQL (107 test sau BE-010); migrate:fresh sạch trên MySQL 8; Pint PASS; các ca cốt lõi trong InvitationV2Test + OwnerInvarianceTest đều xanh; hợp đồng bổ sung ghi ở docs/TEAM_CONTRACT.md §8; DEC-020 ghi vào DECISIONS.md. Không bump VERSION.md.
- Blockers: Không có.

- Assignee: Muse · Level: L3 · Status: BLOCKED
- Branch: (chưa tạo)
- Blocked by: ⏸ chờ BE-009 merge
- Acceptance Criteria: Luồng invitation khớp danh tính đầy đủ (mời người đã có identity ở agency khác, ALREADY_MEMBER xử lý trọn vẹn); Portal chuyển sang link mời đặt mật khẩu thay cho agency đặt mật khẩu (thay đường parity của BE-009); bộ test Owner-invariant (Owner duy nhất, không tự hạ/xoá Owner qua membership); trau chuốt directory (job_title/phone theo membership hiển thị đủ các màn phụ).
- Handoff: Chỉ bắt đầu sau khi BE-009 merge và Nguyen ra hiệu.
## FE-019 — Chuẩn hoá hiển thị dữ liệu: table desktop + skeleton (DEC-021)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen (nghiệm thu trực quan)
- Mô tả: Áp dụng quy ước DEC-021 (docs/UI_GUIDELINES.md §3 + §9) cho toàn bộ màn danh sách hiện có, làm TRƯỚC FE-014/FE-015 để các màn mới sinh ra đúng chuẩn. Phần table: dựng component table dùng chung (kẻ ngang mảnh, header dính, hover dòng, max-width + ellipsis từng cột, menu kebab cho hành động của dòng) và chuyển các màn đủ điều kiện (≤6 cột cốt lõi, nội dung ngắn): danh bạ Members, Workload, danh sách Clients, danh sách Projects, danh sách Task trong trang chi tiết project. Giữ card: Portal phía khách, thẻ Team, timeline hoạt động/ghi chú, Kanban CRM. Mobile giữ nguyên card ở mọi màn (hai cách trình bày theo breakpoint, tái dùng component card hiện có). Phần skeleton: dựng component Skeleton dùng chung + bản sao skeleton cho từng loại thẻ/dòng; áp dụng cho tải lần đầu/chuyển trang ở mọi vùng dữ liệu; đổi filter/phân trang giữ dữ liệu cũ (placeholderData) kèm chỉ dấu tải nhẹ; tôn trọng prefers-reduced-motion.
- Acceptance Criteria: Không màn danh sách nào tràn/cuộn ngang trên desktop ở các bề rộng nghiệm thu (1280/1024); mọi vùng dữ liệu có skeleton khớp hình học nội dung thật (layout không xê dịch khi dữ liệu về); typecheck + build PASS; Nguyen nghiệm thu trực quan từng màn.
- Progress: 2026-11-26 — PR #71 + #72 đã merge; Muse hoàn thành FE-019 trên branch fe/FE-019-data-display (component DataTable + Skeleton dùng chung, chuyển 5 bề mặt: Clients, Projects, Members, Workload, Tasks trong chi tiết project); PR #73 đã merge vào main, PO đang nghiệm thu lại ở chế độ production (WEB_MODE).
## CHORE-001 — Chuyển chế độ dev/production cho web bằng biến môi trường WEB_MODE
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: Muse · Reviewer: Nguyen
- Mô tả: `docker-compose.yml` trước đây hard-code service web chạy `pnpm dev` — chế độ dev biên dịch từng trang theo từng locale ngay khi điều hướng nên nghiệm thu luôn thấy chuyển trang chậm (PO phản ánh nhiều lần, log lúc nghiệm thu FE-019 xác nhận `next dev` + Compiling liên tục). Nay web nhận biến `WEB_MODE` (mặc định `dev`): `WEB_MODE=prod docker compose up -d web` sẽ build production + `pnpm start` phục vụ nghiệm thu; không đặt biến thì giữ nguyên hành vi dev cũ. PO duyệt mở chore 2026-11-26.
- Acceptance Criteria: `docker compose config` render đúng cả hai chế độ; chạy prod thì log không còn Compiling khi chuyển trang; mặc định (không biến) vẫn là dev như cũ.

## FE-014 — Màn hình chọn agency + bộ chuyển agency (DEC-018)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode · Reviewer: Muse
- Progress: 2026-11-26 — OpenCode hoàn thành trên branch `fe/FE-014-agency-selection` (commit f6985eb, 19 files): `LoginResult` dạng `requiresSelection`; BFF route `select-agency` / `switch-agency` / `memberships` theo mẫu proxy hiện có; selection token lưu riêng ở sessionStorage (`auth_selection`), không bao giờ ghi vào cookie `app_token`, BFF login chỉ set cookie ở kết cục có session thật; trang `/select-agency` khung L2 Card trung tâm (tự về `/login` khi không có selection token; token hết hạn/API lỗi thì hiện thông báo rồi về `/login`); `AgencySwitcher` ngay dưới logo sidebar (1 membership = tên tĩnh; 2+ = menu, chip vai trò một dòng, đánh dấu agency hiện tại, chuyển xong tải lại `/dashboard`); thông báo `NO_ACTIVE_MEMBERSHIP` và i18n EN/VI đầy đủ. Kiểm chứng phía OpenCode: build + typecheck PASS, vitest 17/17 PASS, tinker kiểm chứng 3 kết cục đăng nhập + switch rotate/revoke token. Muse đã review code trên branch và hợp nhất thủ công TASK/CHANGELOG/messages với main hiện tại (branch dựa trên main cũ trước PR #78/#79/#80 — entry FE-014 tự tạo của OpenCode được thay bằng entry chính thức này, giữ nguyên nội dung Progress). Chờ Nguyen nghiệm thu bằng mắt (gộp cùng đợt nghiệm thu FIX-021) và merge.
- Status: TODO
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Bổ sung phía FE cho các luồng danh tính đa agency đã có ở BE-009 mà FE chưa có giao diện. (1) Màn hình chọn agency: khi đăng nhập trả về selection token (identity có nhiều membership staff và chưa có agency dùng gần nhất để tự chọn), hiển thị danh sách membership (tên agency + vai trò) để người dùng chọn, gọi POST /auth/select-agency rồi vào app; selection token hết hạn (30 phút) hoặc vào thẳng route khi không có selection token thì quay về đăng nhập. (2) Bộ chuyển agency trong khung app: hiển thị agency hiện tại ở khu vực sidebar/user, mở danh sách từ GET /auth/memberships, chọn agency khác gọi POST /auth/switch-agency, thay token và tải lại dữ liệu theo agency mới; identity chỉ có 1 membership thì chỉ hiện tên agency, không có menu chuyển. (3) Đăng nhập gặp 403 NO_ACTIVE_MEMBERSHIP phải hiện thông báo rõ ràng trên form (khóa i18n mới, EN + VI). Portal không thuộc task này (luồng chọn agency phía Portal để task sau nếu PO yêu cầu).
- Acceptance Criteria: identity có 2 membership staff đăng nhập thấy màn hình chọn agency, chọn xong vào đúng dữ liệu của agency đã chọn; chuyển agency bằng switcher thì toàn bộ dữ liệu đổi theo, không còn dữ liệu của agency cũ; các tài khoản demo (1 membership) đăng nhập thẳng như hiện tại, không thấy màn hình chọn; khóa i18n EN/VI đầy đủ, không khóa lơ lửng; typecheck + build PASS.

## FE-015 — Màn hình chấp nhận lời mời v2 + quản lý truy cập Portal (DEC-020)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode · Reviewer: Muse
- Progress: 2026-11-26 — OpenCode hoàn thành trên branch `fe/FE-015-invitation-accept-v2` (từ main sau PR #81): BFF proxy `preview` nội bộ + Portal; trang `/accept-invitation` và `/portal/accept-invitation` đều preview token rồi rẽ 4 trạng thái (email mới đặt mật khẩu + tự đăng nhập, identity có sẵn yêu cầu đăng nhập qua `redirectTo`, identity trùng xác nhận không hỏi password, identity khác báo lỗi rõ ràng); login nội bộ/Portal nhận `returnTo` đã sanitize; middleware cho phép mở trang mời Portal mà không bị redirect; chi tiết khách hàng bỏ form password ban đầu, cấp cho email mới → lời mời pending, email có identity → tài khoản active ngay, xử lý `INVITATION_PENDING` / `EMAIL_ALREADY_REGISTERED`. Kiểm chứng: typecheck PASS, vitest 22/22 PASS, next build PASS (64 routes), i18n EN/VI 558 khóa khớp + không khóa lơ lửng, 19 ca HTTP/tinker qua BFF (4 trạng thái nội bộ + 4 trạng thái Portal + cấp lại pending + identity có sẵn active). Chờ review/merge; KHÔNG đụng BE/migration/seed/contract, không làm ownership transfer.
- Mô tả: Cập nhật phía FE theo hợp đồng invitations v2 của BE-010 (DEC-020). (1) Trang chấp nhận lời mời (nội bộ + Portal): đọc GET /invitations/preview theo token và hiển thị đúng theo trạng thái — email mới: form tên + mật khẩu như hiện tại; email đã có identity nhưng chưa đăng nhập: hướng dẫn đăng nhập rồi quay lại xác nhận (API trả 403 INVITATION_LOGIN_REQUIRED nếu accept trực tiếp); đã đăng nhập đúng identity: màn hình xác nhận tham gia agency (không hỏi mật khẩu); đăng nhập bằng identity khác: thông báo lỗi INVITATION_IDENTITY_MISMATCH rõ ràng. (2) Quản lý truy cập Portal ở trang chi tiết khách hàng: khớp với hành vi mới của BE-010 — cấp quyền cho email mới tạo lời mời đang chờ (hiển thị trạng thái pending thay vì tài khoản đã kích hoạt), cấp cho email đã có identity thì thành viên Portal xuất hiện ngay; thông điệp EN + VI cho các trạng thái. Luồng chuyển quyền Owner (POST /ownership/transfer) chưa có giao diện — chỉ bổ sung vào task này nếu PO chỉ định vị trí hiển thị.
- Acceptance Criteria: cả 4 trạng thái chấp nhận lời mời hiển thị đúng ở trang nội bộ và trang Portal; cấp quyền Portal cho email mới thấy trạng thái lời mời đang chờ, cho email có sẵn thấy truy cập hiệu lực ngay; không còn luồng đặt mật khẩu ban đầu cho khách ở phía FE; khóa i18n EN/VI đầy đủ; typecheck + build PASS.
- Blockers: none (FE-014 đã merge qua PR #81).

## QA-007 — Kiểm thử hồi quy các luồng danh tính đa agency (DEC-018 + DEC-020)
- Status: DONE
Progress: 2026-11-27 — Đóng gói trong release 0.7.0.
- Assignee: OpenCode · Reviewer: Muse
- Mô tả: Bộ test cho các luồng danh tính đã lên FE ở FE-014/FE-015: đăng nhập identity nhiều membership (màn hình chọn agency, tự chọn theo agency dùng gần nhất), chuyển agency không rò rỉ dữ liệu chéo trên giao diện và API, 4 trạng thái chấp nhận lời mời v2, cấp quyền Portal bằng liên kết mời. Ưu tiên test API/PHPUnit cho logic BE đã có và bổ sung ca UI (Playwright hoặc Vitest theo hạ tầng hiện có) cho các màn hình mới ở mức khả thi; phát hiện rò rỉ dữ liệu chéo thì DỪNG và báo cáo, không tự sửa BE.
- Acceptance Criteria: bộ test chạy PASS toàn bộ cùng suite hiện tại; báo cáo liệt kê đủ các ca theo từng luồng; không sửa code BE/FE trong task này.
- Progress: 2026-11-26 — OpenCode thêm `tests/e2e/multi-agency-identity.spec.ts` (5 ca API: login đa membership trả selection token, select-agency cấp token đúng membership, select membership không thuộc identity -> 404, switch-agency thu hồi token cũ, Portal login client membership); chạy PASS cùng suite Playwright. Không sửa code BE/FE.
- Progress: 2026-11-26 — Bổ sung QA-007: tách 5 ca API thành test() độc lập; kiểm tra bao phủ PHPUnit hiện có (MultiAgencyIdentityTest, InvitationV2Test, ClientModuleTest, CrossTenantIsolationTest) — các ca còn lại đã được phủ ở tầng PHPUnit, không viết trùng; thêm Playwright ca không cần token thô. Playwright suite PASS (5/5) khi chạy tuần tự; PHPUnit 129 PASS; Pint PASS.
- Progress: 2026-11-26 — Bổ sung cuối QA-007: thêm PHPUnit `LastMembershipAutoSelectTest` (đăng nhập lại tự chọn agency theo last_membership_id); thêm guard skip trong spec Playwright khi identity chưa đủ 2 membership. PHPUnit PASS; Playwright PASS trên môi trường có fixture.
- Blockers: chờ FE-014 + FE-015 merge.
