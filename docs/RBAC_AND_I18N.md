# PHÂN QUYỀN (RBAC) & ĐA NGÔN NGỮ (i18n) — Ý KIẾN + ĐỀ XUẤT CHỐT
**Ngày:** 2026-11-20 · **Trạng thái:** ✅ ĐÃ CHỐT — Nguyen duyệt toàn bộ ngày 2026-11-20
**Đã chốt trước (không bàn lại):** Mục 1 — Super Admin tối giản, tạo/khoá agency thủ công, MVP không làm tự thu tiền gói cước / không khoá giới hạn theo gói. Mục 3 — Multi-tenancy chung 1 DB + `agency_id` như tài liệu stack.

---

# PHẦN 1 — Ý KIẾN VỀ MÔ HÌNH PHÂN QUYỀN 7 VAI TRÒ ANH THAM KHẢO

## 1.1. Đánh giá chung: ĐÚNG HƯỚNG, dùng được — đây là bộ vai trò chuẩn của agency thật
Bộ 7 vai trò này khớp gần như 1-1 với 8 nhóm nghiệp vụ: Sales Manager ↔ CRM/Client, Project Manager ↔ Project, Accountant ↔ Finance, Client ↔ Portal. Nó tốt hơn bộ vai trò chung chung em đề xuất lúc đầu (Owner/Admin/Manager/Member) vì nó nói đúng ngôn ngữ của agency — nhà tuyển dụng global đọc vào cũng hiểu ngay nghiệp vụ, rất có lợi cho mục tiêu hồ sơ của anh. **Em đề xuất chốt bộ 7 vai trò này làm chính thức**, với 5 điều chỉnh dưới đây.

## 1.2. Năm điều chỉnh em đề xuất (kèm lý do)

**① Owner và Admin phải khác nhau ở đúng 3 quyền — nếu không sẽ thành 2 vai trò trùng nhau:**
- Chỉ **Owner**: (a) xoá workspace, (b) chuyển quyền sở hữu (transfer ownership) cho người khác, (c) quản lý cài đặt cấp workspace + tạo/khoá Admin.
- **Admin** làm mọi việc vận hành nội bộ còn lại (mời/khoá thành viên, gán vai trò trừ Owner, cài đặt chung) nhưng **không** xoá được workspace, **không** tự phong mình thành Owner, **không** gỡ được Owner.
- Mỗi workspace có **đúng 1 Owner** tại một thời điểm. Đây là quy ước của hầu hết SaaS (Slack, Notion, Linear đều vậy) và giúp QA có ca kiểm tra rõ ràng.

**② Client KHÔNG phải là một "vai trò" cùng loại với 6 vai trò còn lại — phải tách thành loại tài khoản riêng:**
- 6 vai trò kia là **người nội bộ**, đăng nhập vào Agency App, dữ liệu scope theo `agency_id`.
- **Client là người ngoài**, đăng nhập vào Client Portal, dữ liệu scope theo `agency_id` + `client_id` của chính họ. Client không bao giờ nhìn thấy giao diện nội bộ, dù chỉ là ở chế độ xem.
- Về kỹ thuật (em xử lý phía BE): dùng chung bảng users nhưng tách bằng `user_type` + guard/policy riêng cho Portal. Nếu để Client lẫn vào ma trận quyền nội bộ, chỉ cần 1 policy viết sót là rò dữ liệu của client khác — rủi ro bảo mật lớn nhất của toàn dự án.

**③ Một người nội bộ được giữ NHIỀU vai trò cùng lúc (trừ Owner):**
- Agency nhỏ là đối tượng dùng chính: 1 người vừa là Sales vừa là PM là chuyện thường. Nếu MVP ép mỗi người đúng 1 vai trò, người dùng thật sẽ bị chặn việc liên tục và quay sang dùng tài khoản Owner cho mọi thứ — lúc đó phân quyền thành vô nghĩa.
- Quy tắc: quyền của người dùng = **hợp (union)** của các vai trò họ giữ. Owner là vai trò độc quyền, không gộp. Admin gần như bao trùm các vai trò vận hành nhưng vẫn **không** có 3 quyền riêng của Owner ở ①.
- Chi phí: ma trận test của QA lớn hơn một chút, nhưng Laravel Policy xử lý việc này gọn và đây là quyết định **rất khó đổi ngược sau khi đã có dữ liệu** — nên chốt đa vai trò ngay từ MVP.

**④ Quyền phải đi kèm PHẠM VI DỮ LIỆU (scope), không chỉ là "được bấm nút nào":**
Cùng là quyền "xem project" nhưng khác nhau hoàn toàn tuỳ vai trò:
- Owner / Admin / Accountant (chỉ đọc): xem **toàn bộ** project trong agency.
- Project Manager: xem toàn bộ, nhưng **sửa** chỉ project mình quản lý (hoặc được gán).
- Sales Manager: xem project **của client mình phụ trách** ở mức tổng quan (tiến độ/trạng thái), không xem task nội bộ chi tiết.
- Team Member: **chỉ** xem project/task mình được gán. Không được gán = không thấy tồn tại.
- Client: chỉ dữ liệu của chính organization của mình và chỉ phần agency đã bật "hiển thị cho client".
Em sẽ cài scope này ở tầng BE (policy + query scope) chứ không chỉ ẩn nút ở FE — ẩn nút ở FE mà API vẫn trả dữ liệu là lỗi bảo mật, và đây là điểm nhà tuyển dụng kỹ thuật rất hay soi khi xem code.

**⑤ Hai vai trò dễ bị hiểu nhầm cần viết rõ ranh giới:**
- **Sales Manager**: quản Lead/Client/Follow-up và xem doanh thu của client mình ở mức tổng. **Không** tạo/sửa Invoice, **không** xem chi phí/lợi nhuận. Báo giá (Quotations — Phase 2) sẽ thuộc Sales soạn thảo + Accountant/Owner duyệt — ghi trước ở đây để Phase 2 không tranh quyền.
- **Accountant**: toàn quyền Finance (Invoice, Payment, Revenue) và **chỉ đọc** Client/Project để đối chiếu. Không sửa task/project, không quản lý thành viên.

## 1.3. Ma trận quyền MVP đề xuất (bản rút gọn để thảo luận)
`✅` toàn quyền trong agency · `✏️` chỉ với dữ liệu của mình/được gán · `👁` chỉ đọc · `—` không truy cập

| Nhóm nghiệp vụ | Owner | Admin | Sales Mgr | PM | Member | Accountant | Client |
|---|---|---|---|---|---|---|---|
| CRM (Lead) | ✅ | ✅ | ✅ | 👁 | — | — | — |
| Client Management | ✅ | ✅ | ✅ | 👁 | 👁 (client của project mình) | 👁 | — (nội bộ) |
| Project & Task | ✅ | ✅ | 👁 (tổng quan) | ✅ (project mình QL) | ✏️ (task được gán) | 👁 | 👁 (phần công khai, Portal) |
| Team & Roles | ✅ (+3 quyền riêng) | ✅ (trừ Owner) | — | 👁 (xem team của project) | 👁 (xem team của project) | — | — |
| Finance & Billing | ✅ | 👁 | 👁 (doanh thu client mình, tổng) | 👁 (ngân sách project mình) | — | ✅ | 👁 (invoice của mình, Portal) |
| Automation/Notifications | ✅ | ✅ (cài đặt) | ✏️ (nhắc của mình) | ✏️ | ✏️ | ✏️ | ✏️ (thông báo Portal) |
| Portal & Collaboration | ✅ | ✅ | ✏️ (với client mình) | ✏️ (với project mình) | ✏️ (khi được gán) | ✏️ (invoice) | ✅ (trong phạm vi của mình) |
| Analytics & Reports | ✅ | ✅ | ✏️ (phần Sales) | ✏️ (phần Project) | — | ✏️ (phần Finance) | — |

*Ma trận chi tiết theo từng hành động (tạo/sửa/xoá) sẽ được em soạn thành tài liệu riêng khi chốt contract phân quyền — ở bước này chỉ cần anh duyệt hướng và 5 điều chỉnh trên.*

## 1.4. Việc liên quan đã rõ, không cần chốt thêm
Super Admin (quản trị nền tảng SaaS của chính anh) **không nằm trong 7 vai trò này** — đó là tài khoản cấp hệ thống riêng, tách khỏi mọi workspace, theo quyết định "Super Admin tối giản" đã chốt.

---

# PHẦN 2 — ĐA NGÔN NGỮ (i18n): PHẢI CHỐT SỚM, VÀ ĐÂY LÀ CÁCH CHỐT

## 2.1. Vì sao anh đúng khi nói phải chốt sớm
i18n là loại việc **làm ngay từ đầu thì rẻ, vá về sau thì đắt bậc nhất**: nếu FE viết cứng chữ tiếng Việt/Anh vào hàng trăm component và BE trả message cứng, sau này quốc tế hoá nghĩa là sửa lại gần như mọi màn hình + mọi email + file PDF invoice. Với mục tiêu của anh — đưa dự án này vào dự án tiêu biểu để tìm 2nd job remote global — i18n còn là **bằng chứng năng lực** nhà tuyển dụng nhìn thấy được: repo + demo chạy được bằng tiếng Anh chuẩn là điều kiện gần như bắt buộc.

## 2.2. Đề xuất chốt (em khuyến nghị duyệt nguyên gói này)
| Hạng mục | Đề xuất |
|---|---|
| Ngôn ngữ hệ thống | **Tiếng Anh là ngôn ngữ chính (mặc định), tiếng Việt là ngôn ngữ thứ hai — cả hai hoàn chỉnh ngay trong MVP**, không để VI sang Phase 2 |
| Phạm vi dịch | **Chỉ dịch chữ của hệ thống**: menu, nút, nhãn, thông báo, email, PDF invoice, thông báo lỗi. **Không dịch dữ liệu người dùng nhập** (tên project, ghi chú, comment giữ nguyên ngôn ngữ người viết) |
| Cách lưu trữ thái (rất quan trọng) | Mọi trạng thái trong DB lưu bằng **enum/key** (vd `in_progress`), tuyệt đối không lưu chữ hiển thị ("Đang làm"). Chữ hiển thị tra từ file dịch theo key. Đây là quy tắc BE/FE bắt buộc, OpenCode kiểm tra khi review |
| Frontend | `next-intl`, file dịch `en.json` / `vi.json`; **cấm viết cứng chuỗi hiển thị trong component** — vi phạm này OpenCode bắt ở PR review như một lỗi thật, không phải nhắc nhở |
| Backend | Laravel Localization `lang/en` + `lang/vi` cho validation message, API error, email, PDF; API trả về **error code ổn định** (vd `INVOICE_ALREADY_PAID`) kèm message đã dịch theo ngôn ngữ người nhận — FE cũng có thể tự dịch theo code |
| Tuỳ chọn người dùng | Mỗi user có `locale` riêng; mỗi workspace có ngôn ngữ mặc định. **Client ở Portal có thể dùng ngôn ngữ khác nhân viên agency** (agency dùng VI, client dùng EN là trường hợp có thật) — email/thông báo gửi theo `locale` của **người nhận** |
| Tiền tệ & múi giờ (đi cùng gói này) | Mỗi workspace chọn **1 tiền tệ gốc** (USD/VND/…) + múi giờ khi thiết lập; mỗi invoice lưu kèm mã tiền tệ tại thời điểm tạo. Định dạng ngày/số/tiền dùng `Intl` ở FE và cơ chế tương ứng ở BE — không tự format bằng tay. MVP chưa làm đa tiền tệ trong cùng 1 workspace |
| Dữ liệu mẫu (seed/demo) | Bộ dữ liệu demo cho hồ sơ/tuyển dụng dựng bằng **tiếng Anh** (agency mẫu, client mẫu, project mẫu) để nhà tuyển dụng global mở lên là dùng được ngay |
| README của repo | **README.md viết bằng tiếng Anh** (mặt tiền cho tuyển dụng global), có `README.vi.md` tiếng Việt đi kèm. Các tài liệu nội bộ (TASK, DECISIONS, Quy ước) giữ tiếng Việt như hiện tại — hai việc này không mâu thuẫn: tài liệu cho người ngoài ≠ tài liệu vận hành nội bộ |
| Chi phí scope | Thêm khoảng **10–15% công sức FE** và một ít ở BE (email/PDF). Đổi lại: không phải quốc tế hoá lại về sau, và demo song ngữ là điểm cộng hồ sơ rất rõ. Em đánh giá đáng làm ngay trong MVP |

## 2.3. Việc chưa cần quyết bây giờ
Thêm ngôn ngữ thứ ba (Phase 2+, kiến trúc ở trên đã sẵn sàng — chỉ thêm 1 file dịch), dịch giao diện Super Admin (làm sau cùng, ưu tiên thấp), và RTL (tiếng Ả Rập…) — ngoài định hướng, không làm.
