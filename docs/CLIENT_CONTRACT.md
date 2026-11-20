# HỢP ĐỒNG BE-004 — Module Client (Nhóm 2: Client Management, phần nội bộ)

**Trạng thái:** ✅ ĐÃ DUYỆT — Nguyen duyệt toàn bộ theo đề xuất của Muse ngày 2026-11-20 (DEC-009). Đây là bản chính thức; mọi thay đổi sau này phải qua quyết định mới trong `DECISIONS.md`.
**Căn cứ:** `docs/MVP_SCOPE.md` Nhóm 2 · `docs/RBAC_AND_I18N.md` · `docs/AUTH_CONTRACT.md` (chuẩn response/lỗi dùng chung) · BE-003 đã merge (bảng `client_accounts` đang chờ FK `client_id` trỏ vào module này).

---

## 1. Mục tiêu & phạm vi

Xây module quản lý Client phía nội bộ agency: hồ sơ client, tổ chức & người liên hệ, tags phân đoạn, ghi chú nội bộ, và **cấp tài khoản Portal cho client** (khép kín vòng đời: tạo client → cấp tài khoản → client đăng nhập Portal bằng API đã có ở BE-003).

**Trong phạm vi:**
- CRUD Client (hồ sơ + trạng thái + người phụ trách)
- Organization & Contacts gắn với client
- Tags + lọc/ phân đoạn đơn giản (theo tag, trạng thái, người phụ trách, tìm kiếm)
- Client Notes (nội bộ, client không bao giờ thấy)
- Quản lý tài khoản Portal của client (tạo, khoá/mở) — liên kết `client_accounts.client_id`
- Thêm FK `client_accounts.client_id → clients.id` (đã hẹn từ migration BE-003)

**Ngoài phạm vi (task khác):**
- Convert Lead → Client (thuộc module CRM Nhóm 1, task riêng; khi làm sẽ tái dùng đúng cấu trúc dữ liệu của module này)
- Client History tổng hợp (chỉ làm được sau khi có Project/Invoice)
- Mọi màn hình phía Portal (Nhóm 7)
- Import/export CSV, phân đoạn tự động theo điều kiện (Phase 2)

## 2. Mô hình dữ liệu (migration mới, chỉ Backend tạo)

### `clients`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | bigint PK | |
| agency_id | FK → agencies | bắt buộc, scope tenancy như BE-003 |
| name | string | tên hiển thị của client |
| type | enum key: `company` / `individual` | lưu key, không lưu text hiển thị |
| status | enum key: `active` / `paused` / `churned` | mặc định `active` |
| account_manager_id | FK → users, nullable | người phụ trách (phải cùng agency, kiểm tra chéo tenant) |
| email / phone / website / address / tax_code | nullable | thông tin liên hệ chung |
| softDeletes, timestamps | | |

### `organizations`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id, agency_id | | |
| client_id | FK → clients, unique | 1 client có tối đa 1 organization (khi type=company) |
| legal_name, industry, size, address, tax_code, website | nullable | thông tin pháp nhân |
| softDeletes, timestamps | | |

### `contacts`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id, agency_id | | |
| client_id | FK → clients | bắt buộc |
| organization_id | FK → organizations, nullable | |
| full_name | string | bắt buộc |
| email / phone / position | nullable | position = chức vụ (text tự do phía người dùng nhập, không dịch) |
| is_primary | bool, mặc định false | người liên hệ chính |
| softDeletes, timestamps | | |

### `client_notes`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id, agency_id, client_id | | |
| author_id | FK → users | tác giả ghi chú |
| body | text | nội dung ghi chú nội bộ |
| softDeletes, timestamps | | |

### `tags` + `client_tag`
- `tags`: id, agency_id, name (duy nhất trong 1 agency), color nullable.
- `client_tag`: pivot client_id ↔ tag_id. (Bảng `tags` thiết kế để sau này Lead/Project dùng chung qua pivot riêng của chúng.)

### Thay đổi bảng có sẵn
- Migration thêm FK: `client_accounts.client_id → clients.id` (cột đã tồn tại từ BE-003, đang nullable chưa FK).

## 3. Phân quyền (mở rộng `config/rbac.php`, thực thi tại API)

Quyền mới: `clients.view`, `clients.create`, `clients.update`, `clients.delete`, `clients.notes.manage`, `clients.portal_accounts.manage`.

| Vai trò | Quyền |
|---|---|
| Agency Owner | tất cả |
| Admin | tất cả trừ `clients.delete` (xoá thuộc Owner — nhất quán nguyên tắc Owner quản trị cấp cao nhất) (DEC-009.5) |
| Sales Manager | view / create / update / notes.manage / portal_accounts.manage (không delete) |
| Project Manager | view (phục vụ việc tạo & gán project sau này) |
| Accountant | view (chỉ đọc, phục vụ invoice sau này) |
| Team Member | không có quyền clients.* ở MVP (DEC-009.3) |

Data scope: mọi truy vấn qua `BelongsToAgency` như BE-003; ID tham chiếu chéo (account_manager_id, tag_id, organization_id) thuộc agency khác → lỗi `CROSS_TENANT_REFERENCE` (422) như hợp đồng Auth.

## 4. Endpoints (nội bộ, tiền tố `/api/v1`, Bearer token ability `app`)

Chuẩn response, phân trang, format lỗi: y hệt `AUTH_CONTRACT.md` mục 1–2 (không lặp lại ở đây).

| Method & Path | Quyền | Mô tả |
|---|---|---|
| GET `/clients` | clients.view | Danh sách; lọc: `status`, `tag_id`, `account_manager_id`, `q` (tìm theo name/email); sắp xếp mặc định mới nhất |
| POST `/clients` | clients.create | Tạo client (kèm organization nếu type=company, kèm `tag_ids` nếu có) |
| GET `/clients/{id}` | clients.view | Chi tiết: client + organization + contacts + tags + số tài khoản Portal |
| PATCH `/clients/{id}` | clients.update | Sửa hồ sơ/trạng thái/người phụ trách/tags |
| DELETE `/clients/{id}` | clients.delete | Soft delete; đồng thời vô hiệu hoá (`is_active=false`) mọi tài khoản Portal liên kết (DEC-009.4) |
| GET `/clients/{id}/contacts` | clients.view | |
| POST `/clients/{id}/contacts` | clients.update | |
| PATCH `/clients/{id}/contacts/{contactId}` | clients.update | contact không thuộc client → 404 |
| DELETE `/clients/{id}/contacts/{contactId}` | clients.update | soft delete |
| GET `/clients/{id}/notes` | clients.view | ghi chú nội bộ, mới nhất trước |
| POST `/clients/{id}/notes` | clients.notes.manage | |
| DELETE `/clients/{id}/notes/{noteId}` | clients.notes.manage | chỉ tác giả hoặc Owner/Admin |
| GET `/tags` | clients.view | tags của agency |
| POST `/tags` | clients.create | tạo tag (trùng tên trong agency → 422 `VALIDATION_FAILED`) |
| GET `/clients/{id}/portal-accounts` | clients.view | danh sách tài khoản Portal của client (không lộ password/hash) |
| POST `/clients/{id}/portal-accounts` | clients.portal_accounts.manage | tạo tài khoản Portal: name, email (duy nhất toàn hệ thống như DEC-008), mật khẩu do agency đặt hoặc để hệ thống sinh + gửi email đặt mật khẩu (DEC-009.6) |
| PATCH `/clients/{id}/portal-accounts/{accountId}` | clients.portal_accounts.manage | khoá/mở (`is_active`) |

Mã lỗi bổ sung (song ngữ EN/VI như chuẩn): dùng lại `NOT_FOUND`, `VALIDATION_FAILED`, `CROSS_TENANT_REFERENCE`, `FORBIDDEN`; không thêm mã mới ở module này.

## 5. Tiêu chí nghiệm thu (Acceptance Criteria)

1. Toàn bộ endpoint trên hoạt động đúng quyền theo bảng mục 3 (test ma trận vai trò).
2. Cách ly tenant: user agency A không thấy/không sửa được client của agency B (404), tham chiếu chéo bị chặn 422.
3. Tạo client company kèm organization + contacts + tags trong 1 luồng; lọc danh sách theo status/tag/manager/q cho kết quả đúng.
4. Tạo tài khoản Portal cho client → đăng nhập được ngay tại `/portal/auth/login` (khép kín với BE-003); khoá tài khoản → đăng nhập bị chặn `ACCOUNT_DISABLED`.
5. Xoá client → tài khoản Portal liên kết bị vô hiệu hoá; dữ liệu vẫn truy vết được (soft delete).
6. OpenAPI cập nhật vào `packages/contracts/openapi.json`; test Pest phủ các case trên; Pint PASS.

## 6. Các quyết định đã chốt (DEC-009, Nguyen duyệt 2026-11-20)

1. **Organization tách bảng riêng**, quan hệ 1–1 với Client (khớp cách Convert Lead tạo Client + Organization + Contact).
2. **Data scope của Sales Manager = toàn agency** trong MVP (xem/sửa mọi client của agency, không xoá).
3. **Team Member không có quyền clients.\*** ở MVP.
4. **Xoá client = soft delete + tự động vô hiệu hoá** mọi tài khoản Portal liên kết.
5. **Admin KHÔNG có `clients.delete`** — quyền xoá client chỉ thuộc Agency Owner.
6. **Mật khẩu tài khoản Portal do agency đặt** khi tạo (MVP); luồng email để client tự đặt mật khẩu để Phase 2.
