# SCOPE MVP — ĐỀ XUẤT ĐỂ THẢO LUẬN & CHỐT
**Dự án:** Agency & Client Management SaaS
**Trạng thái:** ✅ ĐÃ CHỐT — Nguyen duyệt toàn bộ ngày 2026-11-20 (gồm Super Admin tối giản, multi-tenancy shared DB, phân quyền 7 vai trò và i18n EN+VI)
**Ngày:** 2026-11-20 · Căn cứ: 8 nhóm nghiệp vụ do Nguyen cung cấp ngày 2026-11-20

> **Nguyên tắc cắt Scope của em (xin anh duyệt nguyên tắc này trước khi duyệt từng dòng):**
> 1. MVP phải chạy được **một luồng trọn vẹn từ đầu đến cuối**: Lead → Client → Project → Task → Client Portal xem/duyệt → Invoice → ghi nhận thanh toán → Dashboard. Thiếu một mắt xích là sản phẩm demo bị đứt, dù tính năng lẻ có đẹp tới đâu.
> 2. Vì vậy Scope được cắt **theo từng tính năng con**, không cắt nguyên nhóm: cả 8 nhóm đều xuất hiện trong MVP, nhưng mỗi nhóm chỉ lấy phần lõi. Cắt nguyên nhóm (vd bỏ hẳn Finance) sẽ làm đứt luồng ở nguyên tắc 1.
> 3. Mọi tính năng "tự động / nâng cao / báo cáo sâu" mặc định về Phase 2, trừ khi không có nó thì luồng lõi không chạy được (vd Roles & Permissions, Status Notifications là phải có ngay).
> 4. Trùng lặp trong danh sách gốc: **Client Portal xuất hiện ở cả Nhóm 2 và Nhóm 7** — em gộp toàn bộ Portal vào Nhóm 7, Nhóm 2 chỉ còn quản lý client ở phía nội bộ agency.
> Ký hiệu: ✅ **MVP** = làm trong bản đầu · 🔜 **Phase 2** = để sau, đã ghi rõ · ⛔ **Không làm** = ngoài định hướng (hiện tại chưa có mục nào bị loại hẳn — nếu anh muốn loại, đánh dấu ở đây).

---

## NHÓM 0 — NỀN TẢNG (không nằm trong 8 nhóm anh liệt kê, nhưng thiếu là không có SaaS)
*Em bổ sung nhóm này vì 8 nhóm trên đều đứng trên nó. Đây là phần em + anh phải chốt cùng Scope, không phải tính năng tuỳ chọn.*

| Tính năng | Nhãn | Ghi chú |
|---|---|---|
| Đăng ký / đăng nhập / quên mật khẩu cho người dùng agency | ✅ MVP | Qua Sanctum token như stack đã chốt |
| Multi-tenancy: mỗi Agency là 1 workspace, dữ liệu cách ly tuyệt đối bằng `agency_id` | ✅ MVP | Rủi ro số 1 của SaaS — có test tự động riêng cho việc rò rỉ dữ liệu giữa 2 agency |
| Mời thành viên vào workspace qua email, kích hoạt tài khoản | ✅ MVP | Không có thì Team Management (Nhóm 4) không hoạt động |
| Đăng nhập riêng cho Client vào Portal (tài khoản client, chỉ thấy dữ liệu của mình) | ✅ MVP | Khác hoàn toàn tài khoản nhân viên — phân quyền tách bạch ngay từ schema |
| Activity Log / Audit (ai làm gì, lúc nào) | ✅ MVP (bản đơn giản) | Là dữ liệu gốc cho Client History, Interaction History và Communication History ở các nhóm dưới — làm 1 lần, dùng 3 nơi |
| Thông báo trong app (chuông) + email cho sự kiện chính | ✅ MVP | Chi tiết ở Nhóm 6 |
| Cài đặt workspace (tên agency, logo, thông tin liên hệ, thông tin thanh toán hiển thị trên invoice) | ✅ MVP (bản đơn giản) | Cần cho Invoice và Portal |
| Quản trị nền tảng SaaS (Super Admin) | ✅ MVP (bản tối giản — **ĐÃ CHỐT 2026-11-20**) | Chỉ để Nguyen tạo/khoá agency thủ công. MVP **không** làm tự thu tiền gói cước, không khoá giới hạn theo gói (plans/trial/limit để Phase 2 nếu cần) |
| Đa ngôn ngữ EN (chính) + VI, tiền tệ/múi giờ theo workspace | ✅ MVP — **đề xuất chốt, xem tài liệu Phân quyền & i18n** | Nguyen yêu cầu xem xét vì dự án dùng làm hồ sơ tìm 2nd job remote global — i18n phải làm từ đầu, vá sau rất đắt |

---

## NHÓM 1 — CRM
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Lead Management | ✅ MVP | CRUD lead (tên, công ty, liên hệ, nguồn, giá trị dự kiến, người phụ trách), trạng thái: New / Contacted / Qualified / Unqualified |
| Contact Management | ✅ MVP | Danh bạ người liên hệ gắn với Lead/Client — thực chất dùng chung bảng Contacts với Nhóm 2, không xây 2 lần |
| Sales Pipeline | ✅ MVP (bản đơn giản) | Pipeline = các trạng thái lead ở trên, hiển thị dạng danh sách lọc theo trạng thái. **Kanban kéo-thả để Phase 2** |
| Follow-up Activities | ✅ MVP (bản đơn giản) | Tạo hoạt động hẹn follow-up (gọi/nhắn/họp, ngày hẹn, ghi chú), nhắc khi tới hạn qua thông báo |
| Customer Interaction History | ✅ MVP | Dòng thời gian tương tác lấy từ Activity Log + ghi chú thủ công — không xây module riêng |
| Chuyển Lead → Client (Convert) | ✅ MVP | 1 nút chuyển: tạo Client + Organization + Contact từ Lead, giữ nguyên lịch sử. Đây là mắt xích nối Nhóm 1 → Nhóm 2 trong luồng lõi |
| Import lead hàng loạt, tích hợp form website/Facebook vào lead | 🔜 Phase 2 | |

## NHÓM 2 — Client Management (phần nội bộ agency)
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Client Profiles | ✅ MVP | Hồ sơ client: thông tin chung, trạng thái Active/Paused/Churned, người phụ trách |
| Organizations & Contacts | ✅ MVP | 1 client thuộc 1 organization (công ty) hoặc là cá nhân; nhiều contacts dưới organization |
| Client Segmentation | ✅ MVP (bản đơn giản) | Phân đoạn bằng **tags + trạng thái + người phụ trách**, lọc được theo các tiêu chí đó. Phân đoạn tự động theo điều kiện (rule-based) để Phase 2 |
| Client Notes | ✅ MVP | Ghi chú nội bộ (client không thấy) — phân biệt rõ với comment công khai ở Portal |
| Client History | ✅ MVP | Lịch sử dự án/invoice/tương tác của client, tổng hợp từ dữ liệu đã có — là màn hình xem, không phải module dữ liệu mới |
| Client Portal | ➡️ Gộp sang Nhóm 7 | Không làm trùng |

## NHÓM 3 — Project Management
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Project Overview | ✅ MVP | CRUD project gắn với client: tên, mô tả, trạng thái (Draft/In Progress/On Hold/Completed/Cancelled), ngày bắt đầu/hạn, ngân sách (liên kết Nhóm 5), người phụ trách |
| Task Management | ✅ MVP | CRUD task trong project: assignee, priority, due date, trạng thái (To Do/In Progress/In Review/Done), mô tả, checklist con đơn giản, comment nội bộ |
| Milestones | ✅ MVP (bản đơn giản) | Mốc dự án có tên + ngày hạn + trạng thái; task gắn được vào milestone |
| Project Timeline | ✅ MVP (bản đơn giản) | Xem dạng danh sách mốc + hạn theo thời gian. **Biểu đồ Gantt để Phase 2** |
| Team Assignment | ✅ MVP | Gán thành viên vào project và vào task (dùng dữ liệu Nhóm 4) |
| Progress Tracking | ✅ MVP | % hoàn thành = task Done / tổng task + trạng thái milestone; hiển thị ở cả nội bộ và Portal |
| Project template, nhân bản project, task phụ thuộc nhau (dependency) | 🔜 Phase 2 | |

## NHÓM 4 — Team & Resource Management
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Employee Management | ✅ MVP (bản đơn giản) | Danh sách nhân viên trong workspace: hồ sơ cơ bản, mời/kích hoạt, khoá tài khoản (deactivate) |
| Team Management | ✅ MVP (bản đơn giản) | Tạo nhóm (team) và gán thành viên — chỉ phục vụ việc gán project/task theo nhóm |
| Roles & Permissions | ✅ MVP — **bắt buộc, không cắt được** | Bộ 7 vai trò do Nguyen tham khảo và Muse đã góp ý (xem tài liệu Phân quyền & i18n): Agency Owner / Admin / Sales Manager / Project Manager / Team Member / Accountant / Client (Client là loại tài khoản Portal riêng). Một người nội bộ được giữ nhiều vai trò (trừ Owner độc quyền). Chưa làm bộ phân quyền tuỳ chỉnh từng ô |
| Workload Management | 🔜 Phase 2 | Cần dữ liệu task + timesheet đủ lâu mới có ý nghĩa; MVP chỉ có số task đang mở theo người ở Dashboard nội bộ |
| Timesheets | 🔜 Phase 2 | Là một module lớn độc lập (chấm công/ghi giờ) — đưa vào MVP sẽ nuốt ngân sách của luồng lõi |
| Availability | 🔜 Phase 2 | Trạng thái nghỉ/bận để Phase 2 cùng Workload |
| Phân quyền tuỳ chỉnh (custom roles, tick từng quyền) | 🔜 Phase 2 | |

## NHÓM 5 — Finance & Billing
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Invoices | ✅ MVP (bản đơn giản) | Tạo invoice gắn client + project: dòng hạng mục (mô tả, số lượng, đơn giá), thuế % đơn giản, tổng tiền, trạng thái Draft/Sent/Paid/Overdue/Cancelled, xuất PDF |
| Payment Tracking | ✅ MVP (bản đơn giản) | **Ghi nhận thanh toán thủ công**: số tiền, ngày, phương thức (chuyển khoản/tiền mặt), ghi chú; hỗ trợ thanh toán nhiều lần cho 1 invoice (còn nợ bao nhiêu tự tính). Hiển thị thông tin chuyển khoản/VietQR tĩnh của agency trên invoice |
| Project Budget | ✅ MVP (bản đơn giản) | 1 con số ngân sách trên project + tổng đã xuất invoice/đã thu — chỉ để đối chiếu, chưa phải quản lý ngân sách chi tiết |
| Quotations | 🔜 Phase 2 | Luồng báo giá → duyệt → chuyển invoice rất đáng làm nhưng không nằm trên luồng lõi tối thiểu (có thể báo giá ngoài hệ thống ở giai đoạn MVP) |
| Contracts | 🔜 Phase 2 | MVP thay tạm bằng: upload file hợp đồng đính kèm vào client/project qua File Sharing (Nhóm 7). Module hợp đồng riêng (mẫu, trạng thái ký, e-sign) để Phase 2 |
| Expenses & Profitability | 🔜 Phase 2 | Cần Timesheets + chi phí đầy đủ mới tính lợi nhuận đúng; làm sớm sẽ ra số liệu sai và gây mất niềm tin |
| Cổng thanh toán online (Stripe/VNPay/MoMo tự động đối soát) | 🔜 Phase 2 | MVP ghi nhận thủ công như trên — xem thêm mục Chưa chốt C.2 |

## NHÓM 6 — Workflow & Automation
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Status Notifications | ✅ MVP | Thông báo (in-app + email) khi: được gán task, task đổi trạng thái, có comment liên quan, invoice đổi trạng thái, client phản hồi/duyệt ở Portal |
| Deadline Reminders | ✅ MVP (bản đơn giản) | Job chạy theo lịch (Laravel Scheduler): nhắc task/milestone sắp tới hạn và quá hạn, nhắc follow-up lead, nhắc invoice quá hạn — dùng chung 1 cơ chế nhắc |
| Approval Workflow | ✅ MVP (chỉ trong Portal) | Chính là Approval Requests ở Nhóm 7 (client duyệt/từ chối bàn giao) — không xây engine phê duyệt nội bộ nhiều cấp ở MVP |
| Task Automation (rule engine: "khi A thì tự làm B") | 🔜 Phase 2 | Engine tự động hoá là module nền riêng, rủi ro cao, không chặn luồng lõi |
| Recurring Tasks | 🔜 Phase 2 | |
| Approval Workflow nội bộ nhiều cấp (xin duyệt chi, duyệt nghỉ...) | 🔜 Phase 2 | |

## NHÓM 7 — Client Portal & Collaboration
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Client Dashboard | ✅ MVP | Client đăng nhập thấy: dự án của mình, tiến độ, việc cần mình duyệt, invoice chưa thanh toán, file mới |
| Project Progress | ✅ MVP | Xem (chỉ đọc) tiến độ project/milestone/task công khai — agency chọn được task/milestone nào **hiển thị** cho client, việc nội bộ không lộ ra Portal |
| File Sharing | ✅ MVP | Agency upload file bàn giao/tài liệu lên project, client tải xuống (và upload ngược file cung cấp cho agency); có phân quyền theo client/project; giới hạn dung lượng/loại file cấu hình được |
| Feedback & Comments | ✅ MVP | Client comment được trên project / file / hạng mục bàn giao; agency trả lời — 1 luồng trao đổi duy nhất, không làm chat realtime |
| Approval Requests | ✅ MVP (bản đơn giản) | Agency tạo yêu cầu duyệt (cho file/milestone/bàn giao) → client Approve / Request Changes kèm comment → trạng thái + lịch sử được lưu, có thông báo 2 chiều |
| Communication History | ✅ MVP | Toàn bộ comment + approval + hoạt động công khai của client đó hợp thành 1 dòng lịch sử — tổng hợp từ Activity Log, không xây hệ thống nhắn tin riêng |
| Chat realtime, Portal mang thương hiệu riêng của agency (white-label, custom domain) | 🔜 Phase 2 | White-label là tính năng bán hàng tốt nhưng không chặn luồng lõi |

## NHÓM 8 — Analytics & Reporting
| Tính năng con | Nhãn | Phạm vi MVP cụ thể |
|---|---|---|
| Dashboard tổng quan agency | ✅ MVP | Thẻ số liệu + biểu đồ đơn giản: lead mới, client đang active, project theo trạng thái, task quá hạn, doanh thu đã thu trong tháng |
| Revenue Reports | ✅ MVP (bản đơn giản) | Doanh thu theo tháng từ invoice Paid, công nợ chưa thu — lọc theo khoảng ngày, xuất CSV |
| Project Performance | ✅ MVP (bản đơn giản) | Danh sách project: tiến độ %, đúng hạn/quá hạn, đã thu / ngân sách |
| Client Performance | 🔜 Phase 2 (MVP chỉ có doanh thu theo client ở mức danh sách đơn giản) | Xếp hạng/đánh giá client cần định nghĩa tiêu chí riêng |
| Team Productivity | 🔜 Phase 2 | Phụ thuộc Timesheets/Workload (Nhóm 4, Phase 2) |
| Profitability Reports | 🔜 Phase 2 | Phụ thuộc Expenses (Nhóm 5, Phase 2) |
| Bộ báo cáo tuỳ chỉnh, export PDF báo cáo, gửi báo cáo tự động | 🔜 Phase 2 | MVP chỉ export CSV ở Revenue |

---

## LUỒNG LÕI MVP (kiểm chứng Scope ở trên có khép kín không)
```
Owner đăng ký → tạo Agency workspace → mời Team (Nhóm 0+4)
  → tạo Lead, follow-up (Nhóm 1) → Convert thành Client (Nhóm 1→2)
  → tạo Project, Milestone, Task, gán người (Nhóm 3) — thông báo + nhắc hạn tự chạy (Nhóm 6)
  → Client đăng nhập Portal: xem tiến độ, nhận file, comment, duyệt bàn giao (Nhóm 7)
  → Agency tạo Invoice, ghi nhận thanh toán thủ công (Nhóm 5)
  → Owner xem Dashboard + Revenue (Nhóm 8)
```
Luồng này chạy trọn với Scope ở trên — không mắt xích nào phụ thuộc vào tính năng Phase 2.

## ƯỚC LƯỢNG ĐỘ LỚN (để anh hình dung, không phải cam kết thời gian)
MVP ở trên tương đương khoảng **10 thực thể dữ liệu chính** (Agency, User, Lead, Organization/Client, Contact, Project, Milestone, Task, File, Invoice/Payment, Notification, Activity Log) và **3 bề mặt giao diện** (Agency App, Client Portal, trang Auth/Onboarding). Đây là MVP ở mức "bán/dùng thử thật được", không phải bản demo cắt xén — nếu anh muốn MVP nhỏ hơn nữa để ra mắt nhanh hơn, chỗ cắt tiếp theo em đề xuất là: bỏ Lead/CRM (Nhóm 1) khỏi MVP, bắt đầu thẳng từ Client. Anh cân nhắc điểm này khi duyệt.
