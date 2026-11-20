# BE-003 — Hợp đồng: Auth + Multi-tenancy + RBAC

> Trạng thái: **ĐÃ DUYỆT** bởi Nguyen (Product Owner) ngày 2026-11-20 — ghi tại DEC-008. Đây là bản chính thức phổ biến cho Antigravity và OpenCode. OpenAPI sinh từ code (Scramble) sẽ vào `packages/contracts/` khi BE-003 triển khai; khi có mâu thuẫn, tài liệu này là căn cứ nghiệp vụ, OpenAPI là căn cứ kỹ thuật.
> Căn cứ: DEC-001 (stack), DEC-004 (shared DB + agency_id), DEC-005 (RBAC 7 vai trò + 5 điều chỉnh), DEC-006 (i18n).

## 1. Mô hình dữ liệu cốt lõi (phần Auth/Tenancy)

- `agencies`: id, name, slug (unique), base_currency (mã ISO, ví dụ VND/USD), timezone, is_locked (Super Admin khoá), timestamps, soft delete.
- `users` (tài khoản nội bộ): id, agency_id (FK, NOT NULL), name, email (**unique toàn hệ thống** — DEC-008), password hash, locale (`en`|`vi`, mặc định `en`), is_active, last_login_at, timestamps, soft delete.
- `roles` / `user_roles`: vai trò nội bộ = agency_owner, admin, sales_manager, project_manager, team_member, accountant. Một user giữ nhiều vai trò (trừ Owner là duy nhất & độc quyền). Quyền hiệu lực = hợp nhất (union).
- `client_accounts` (tài khoản Portal, LOẠI RIÊNG — không phải role): id, agency_id, client_id (FK tới clients — bảng thuộc module Client, BE-004), name, email, password hash, locale, is_active. Đăng nhập qua route riêng, token mang scope `portal`.
- `personal_access_tokens` (Sanctum): token nội bộ và token portal PHẢI phân biệt bằng abilities/scope: `app` cho nội bộ, `portal` cho Client. Middleware chặn chéo: token portal không gọi được API nội bộ và ngược lại.
- Mọi bảng nghiệp vụ từ nay về sau đều có `agency_id` (trừ bảng hệ thống như agencies, super_admins).
- `super_admins`: tài khoản hệ thống riêng (không thuộc agency nào), chỉ phục vụ màn Super Admin tối thiểu (tạo/khoá agency).

## 2. Nguyên tắc multi-tenancy (bắt buộc ở API layer)

1. `agency_id` LUÔN lấy từ token của user đang đăng nhập — KHÔNG BAO GIỜ nhận `agency_id` từ request (body/query/header đều bỏ qua hoặc trả lỗi).
2. Mọi query tới bảng nghiệp vụ đều bị scope theo `agency_id` (global scope / base repository). Truy vấn bản ghi của agency khác → trả **404** (không lộ sự tồn tại), không phải 403.
3. Mọi FK khi tạo/sửa (ví dụ gán project cho client) đều phải kiểm tra cùng `agency_id`; khác agency → 422 `CROSS_TENANT_REFERENCE`.
4. File upload (module sau) cũng scope theo agency; đường dẫn chứa tiền tố agency.

## 3. Endpoints Auth (base `/api/v1`)

### Nội bộ (scope `app`)
| Method | Path | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/login` | public | {email, password} → {token, user{...roles, permissions, locale}, agency{...}}. Sai thông tin → 401 `INVALID_CREDENTIALS` (không phân biệt sai email hay sai mật khẩu). Agency bị khoá → 403 `AGENCY_LOCKED`. |
| POST | `/auth/logout` | đã đăng nhập | Thu hồi token hiện tại. |
| GET | `/auth/me` | đã đăng nhập | Hồ sơ + roles + permissions hiệu lực + agency. |
| POST | `/auth/change-password` | đã đăng nhập | {current_password, new_password}; sai mật khẩu hiện tại → 422 `CURRENT_PASSWORD_MISMATCH`. |
| POST | `/auth/forgot-password` | public | Gửi email đặt lại mật khẩu (link hết hạn 60 phút). Luôn trả 200 kể cả email không tồn tại (chống dò tài khoản). |
| POST | `/auth/reset-password` | public | {token, email, new_password}. Token sai/hết hạn → 422 `INVALID_RESET_TOKEN`. |

- Đăng ký tài khoản: KHÔNG có đăng ký công khai trong MVP. Agency do Super Admin tạo (kèm user Owner đầu tiên); thành viên nội bộ do Owner/Admin mời (module Team — BE-005): POST `/team/invitations` + POST `/auth/accept-invitation`. Phần invitation nằm ở BE-005, BE-003 chỉ gồm login/logout/me/password + forgot/reset.

### Portal (scope `portal`)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/portal/auth/login` | Như login nội bộ nhưng xác thực trên `client_accounts`, token scope `portal`, response kèm `client` tóm tắt. |
| POST | `/portal/auth/logout` | Thu hồi token. |
| GET | `/portal/auth/me` | Hồ sơ client + agency tóm tắt. |
| POST | `/portal/auth/forgot-password` | Gửi email đặt lại mật khẩu (DEC-008 mục 3 — dùng chung cơ chế với nội bộ, link trỏ về web app, hết hạn 60 phút). Luôn trả 200 kể cả email không tồn tại (chống dò tài khoản). |
| POST | `/portal/auth/reset-password` | `{token, email, password}`. Token sai/hết hạn → 422 `INVALID_RESET_TOKEN`. Đặt lại thành công → thu hồi mọi token `portal` của tài khoản. |

- Tài khoản Client do phía Agency tạo/cấp (module Client Portal sau), không tự đăng ký.

## 4. Chuẩn response & lỗi (áp cho mọi module)

- Thành công: `{ "data": ... , "meta": { pagination... } }` (meta chỉ khi có phân trang).
- Lỗi: `{ "error": { "code": "MACHINE_CODE", "message": "Human message (theo locale của user)", "details": { field: [messages] } } }`.
- HTTP status: 200/201/204 thành công · 400 request sai định dạng · 401 chưa đăng nhập/token hết hạn (`UNAUTHENTICATED`) · 403 thiếu quyền (`FORBIDDEN`) · 404 không tồn tại hoặc khác tenant · 422 validation (`VALIDATION_FAILED` + details từng field, hoặc mã nghiệp vụ riêng) · 429 rate limit · 500 `SERVER_ERROR` (không lộ stack trace).
- Mã lỗi nghiệp vụ của đợt này: `INVALID_CREDENTIALS`, `AGENCY_LOCKED`, `ACCOUNT_DISABLED`, `CURRENT_PASSWORD_MISMATCH`, `INVALID_RESET_TOKEN`, `CROSS_TENANT_REFERENCE`, `OWNER_REQUIRED` (thao tác chỉ Owner), `CANNOT_MODIFY_OWNER` (Admin không sửa/xoá Owner).

## 5. Phân quyền đợt này (phần còn lại của ma trận nằm ở từng module)

| Hành động | Owner | Admin | Sales Mgr | PM | Team Member | Accountant |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Xem thông tin workspace (agency) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sửa cài đặt workspace (tên, tiền tệ gốc, timezone) | ✓ | — | — | — | — | — |
| Khoá/mở thành viên (is_active) | ✓ | ✓ (trừ Owner & Admin khác) | — | — | — | — |
| Gán/gỡ vai trò Admin | ✓ | — | — | — | — | — |
| Gán/gỡ các vai trò còn lại | ✓ | ✓ | — | — | — | — |
| Chuyển quyền Owner | ✓ (chỉ Owner hiện tại) | — | — | — | — | — |
| Xoá workspace | ✓ | — | — | — | — | — |

- `GET /auth/me` trả kèm danh sách `permissions` dạng mã chuỗi (ví dụ `workspace.settings.update`) để FE ẩn/hiện UI — nhưng API vẫn là nơi chặn thật (điều chỉnh #4 của DEC-005).

## 6. Bảo mật & giới hạn

- Rate limit login: 5 lần/phút/IP (cả nội bộ và portal).
- Mật khẩu: tối thiểu 8 ký tự; hash bcrypt (mặc định Laravel).
- Token: Sanctum personal access token; MVP chưa đặt thời hạn cứng, thu hồi khi logout/đổi mật khẩu (đổi mật khẩu → thu hồi mọi token khác).
- Mọi response lỗi/message hệ thống theo `locale` của user (khách chưa đăng nhập: theo header `Accept-Language`, mặc định `en`).

## 7. Chia task từ hợp đồng này (sau khi duyệt)

- **BE-003** (Muse): migrations agencies/users/roles/super_admins/client_accounts + tenancy scope + auth nội bộ + portal auth + `/auth/me` kèm permissions + bộ mã lỗi chuẩn + test PHPUnit cho từng mã lỗi & cross-tenant 404.
- **FE-002** (Antigravity): màn Login nội bộ + lưu token + guard route + chuyển EN/VI ở màn login (dùng mock theo hợp đồng này, không chờ BE).
- **FE-003** (Antigravity): khung Portal login (route riêng `/portal`), tách layout khỏi app nội bộ.
- **QA-002** (OpenCode): test case từ Acceptance Criteria của BE-003/FE-002/FE-003 + E2E Playwright cho luồng login đúng/sai/khoá agency/token portal gọi API nội bộ bị chặn.

## 8. Các chốt chi tiết (DEC-008, đã duyệt 2026-11-20)

1. **Email unique toàn hệ thống** trong MVP — đăng nhập 1 bước, không cần mã/slug workspace. (Xem xét lại mô hình email-theo-agency khi phát sinh nhu cầu một người thuộc nhiều workspace.)
2. **Token không đặt hạn cứng** trong MVP — thu hồi khi logout hoặc đổi mật khẩu (đổi mật khẩu thu hồi mọi token khác).
3. **Portal có quên mật khẩu**, dùng chung cơ chế email đặt lại như tài khoản nội bộ.
