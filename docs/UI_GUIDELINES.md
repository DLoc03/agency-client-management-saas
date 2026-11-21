# Quy ước giao diện (UI Guidelines) — Agency & Client Management SaaS

Tài liệu ràng buộc cho mọi công việc Frontend của dự án, theo DEC-013. Mọi agent làm Frontend (OpenCode, Muse khi kiêm nhiệm, hoặc agent mới tham gia sau này) phải đọc và tuân thủ tài liệu này trước khi dựng hoặc sửa bất kỳ màn hình nào. Nguyen là người nghiệm thu UI trực tiếp bằng mắt — phần lớn các lỗi dưới đây chỉ nhìn thấy khi nghiệm thu, nên agent phải tự kiểm trước ở nhiều bề rộng màn hình rồi mới báo cáo.

## 1. Hướng thiết kế đã chốt (DEC-013)

- Style chính của ứng dụng nội bộ: mẫu **A — Classic Sidebar** (sidebar điều hướng + nội dung sáng, trên nền shadcn/ui + Tailwind, design tokens thống nhất toàn app).
- Màn hình CRM: mẫu **D — Pipeline** (Kanban theo giai đoạn lead).
- Khu Client Portal: hơi hướng mẫu **C — Bento Thân Thiện** (thoáng, bo góc lớn, thân thiện với khách hàng).
- Không tự ý đổi bố cục khung, mật độ hiển thị hay phong cách component theo từng màn hình; cần thay đổi thì đề xuất lên Nguyen + Muse chốt (L3).

## 2. Tương thích nhiều loại màn hình (responsive)

- Mọi màn hình phải dùng tốt ở các bề rộng phổ biến, từ điện thoại tới desktop: không vỡ bố cục, không tràn ngang ngoài ý muốn, không che khuất nội dung.
- Tự kiểm tra ít nhất ở 3 bề rộng đại diện (nhỏ, trung bình, lớn) trước khi báo cáo hoàn thành.

## 3. Bảng dữ liệu nhiều cột — không dùng scroll ngang làm giải pháp chính

- Khi bảng có quá nhiều dữ liệu/cột, **không** thiết kế để người dùng phải kéo ngang (scroll ngang) mới xem hết dữ liệu. Nguyen đánh giá cách này thiếu chỉn chu và gây khó chịu, nhất là trên cảm ứng.
- Giải pháp ưu tiên, theo thứ tự:
  1. Chuyển mỗi hàng thành **card dữ liệu ngang** ở bề rộng hẹp.
  2. Dùng **lưới card thu gọn**, nhiều card trên cùng một hàng.
  3. Chỉ giữ các cột cốt lõi trên bảng, phần còn lại đưa vào vùng mở rộng/xem chi tiết.
- Scroll ngang chỉ chấp nhận khi thật sự không còn cách khác, và khi đó phải có chỉ dấu trực quan rõ ràng là còn nội dung ngoài màn hình.

## 4. Độ tương phản của chữ

- Chữ trong các section, card và button phải hiển thị rõ, dễ đọc, tương phản tốt với nền.
- Không để chữ quá chìm/quá nhạt; kiểm tra cả trạng thái hover, disabled và chữ phụ — vẫn phải đọc được.

## 5. Chip và badge trạng thái/danh mục

- Nội dung trong chip/badge luôn nằm trên **một dòng duy nhất**, không được xuống dòng làm chip cao lên, vì sẽ phá vỡ sự cân đối chiều cao giữa các hàng dữ liệu.
- Nhãn dài phải được đặt tên ngắn lại hoặc cắt bằng ellipsis; chiều cao chip đồng nhất trong cùng một danh sách.

## 6. Ổn định chiều cao và trạng thái rỗng

- Khu vực nội dung cần có chiều cao tối thiểu (min-height) hợp lý để khi dữ liệu chưa có, footer/khung trang **không bị nhảy lên**.
- Màn hình chưa có dữ liệu phải hiển thị empty state có chủ đích, giữ nguyên khung, thay vì trang trắng sụp khung.

## 7. Quy trình nghiệm thu UI

- Các điểm 2–6 chỉ kiểm chứng đáng tin bằng mắt: agent làm FE tự kiểm ở nhiều bề rộng và nhiều trạng thái dữ liệu (có dữ liệu, rỗng, lỗi) trước khi báo cáo, và nêu rõ đã kiểm ở những bề rộng/trạng thái nào.
- Nguyen nghiệm thu UI trực tiếp; phản hồi của Nguyen tại nghiệm thu là tín hiệu chính để sửa các vấn đề thị giác mà kiểm thử tự động không bắt được.
