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

## 3. Hiển thị dữ liệu danh sách: table trên desktop, card trên mobile (DEC-021, PO chốt 2026-11-26)

- **Desktop — ưu tiên table** khi đủ cả 3 điều kiện: (a) số cột cốt lõi ≤ 6 (không tính cột menu kebab hành động); (b) nội dung từng ô ngắn (mã, tên, ngày, số tiền, chip trạng thái); (c) dữ liệu mang tính quét / so sánh giữa các dòng. Table theo phong cách hiện đại: chỉ kẻ ngang mảnh giữa các dòng, header dính khi danh sách dài, hover sáng dòng; hành động của từng dòng thu vào menu kebab theo §7 (áp dụng cho cả dòng table).
- **Chiều ngang bị khống chế tuyệt đối**: mỗi cột có max-width rõ ràng, nội dung dài phải rút gọn bằng ellipsis trong một dòng. Table KHÔNG bao giờ tràn hay phải cuộn ngang trên desktop. Nếu có cột phụ vượt ngưỡng: hoặc đưa cột phụ sang vùng chi tiết / dòng mở rộng, hoặc toàn bộ danh sách chuyển sang card.
- **Desktop — dùng card** khi: số cột cốt lõi vượt 6, nội dung dài hoặc không đồng nhất (mô tả, ghi chú), hoặc bản ghi cần trình bày trực quan riêng (thanh tiến độ, ảnh). Nấc trung gian: table giữ cột cốt lõi + dòng mở rộng để xem phần còn lại.
- **Mobile: luôn hiển thị card** cho mọi danh sách — cùng một dữ liệu, hai cách trình bày theo breakpoint.
- Mục này thay thế cách tiếp cận "card là mặc định" trước đây. Ngưỡng 6 cột là mức tạm: PO nghiệm thu thực tế rồi quyết định chỉnh sau. Quy ước áp dụng ngược cho mọi màn danh sách đã làm (task FE-019) và là chuẩn cho mọi màn mới.

## 4. Độ tương phản của chữ

- Chữ trong các section, card và button phải hiển thị rõ, dễ đọc, tương phản tốt với nền.
- Không để chữ quá chìm/quá nhạt; kiểm tra cả trạng thái hover, disabled và chữ phụ — vẫn phải đọc được.

## 5. Chip và badge trạng thái/danh mục

- Nội dung trong chip/badge luôn nằm trên **một dòng duy nhất**, không được xuống dòng làm chip cao lên, vì sẽ phá vỡ sự cân đối chiều cao giữa các hàng dữ liệu.
- Nhãn dài phải được đặt tên ngắn lại hoặc cắt bằng ellipsis; chiều cao chip đồng nhất trong cùng một danh sách.

## 6. Ổn định chiều cao và trạng thái rỗng

- Khu vực nội dung cần có chiều cao tối thiểu (min-height) hợp lý để khi dữ liệu chưa có, footer/khung trang **không bị nhảy lên**.
- Màn hình chưa có dữ liệu phải hiển thị empty state có chủ đích, giữ nguyên khung, thay vì trang trắng sụp khung.

## 7. Hành động trên card dữ liệu (FIX-013, PO chốt 2026-11-25)
- Mọi hành động của một card dữ liệu (Sửa, Xoá, Đánh dấu xong, ...) phải thu gọn vào **một nút icon three-dot (kebab menu)** ở góc card — dùng component dùng chung `ActionMenu` (`components/ui/ActionMenu.tsx`) — bấm vào mới hiện danh sách hành động. KHÔNG hiển thị các nút chữ Sửa/Xoá trực tiếp trên card: khi số hành động tăng lên, card sẽ rối và thay đổi kích thước.
- Quy ước áp dụng cho toàn bộ card dữ liệu (danh sách dự án/khách hàng/nhóm/thành viên, cột mốc, công việc, checklist, bình luận, người liên hệ, hoạt động, ghi chú). Hành động cấp trang (nút Xoá ở header trang chi tiết, nút Sửa mở form của section) không thuộc quy ước này.
- Mục hành động nguy hiểm (Xoá) hiển thị chữ đỏ trong menu.

## 8. Quy trình nghiệm thu UI

- Các điểm 2–6 chỉ kiểm chứng đáng tin bằng mắt: agent làm FE tự kiểm ở nhiều bề rộng và nhiều trạng thái dữ liệu (có dữ liệu, rỗng, lỗi) trước khi báo cáo, và nêu rõ đã kiểm ở những bề rộng/trạng thái nào.
- Nguyen nghiệm thu UI trực tiếp; phản hồi của Nguyen tại nghiệm thu là tín hiệu chính để sửa các vấn đề thị giác mà kiểm thử tự động không bắt được.

## 9. Trạng thái tải và skeleton (DEC-021, PO chốt 2026-11-26)

- Mọi vùng render dữ liệu từ API phải có skeleton khi tải lần đầu hoặc chuyển trang lạnh. Skeleton là **bản sao hình học** của nội dung thật (cùng khung thẻ / dòng, cùng chiều cao, cùng vị trí avatar và chip) để khi dữ liệu về, nội dung thay tại chỗ và layout không xê dịch.
- Số lượng skeleton **cố định theo thiết kế** (bằng pageSize của danh sách, hoặc đủ lấp màn hình đầu tiên) — không phụ thuộc vào số bản ghi response trả về.
- Thời điểm hiển thị: chỉ hiện skeleton khi việc tải kéo dài hơn ~200ms (tránh "nháy skeleton" khi dữ liệu về nhanh); một khi đã hiện thì giữ tối thiểu ~300–400ms trước khi thay bằng dữ liệu (tránh chớp tắt). KHÔNG giữ dữ liệu thật lại thêm sau khi dữ liệu đã về.
- Đổi filter, phân trang, tải lại tại chỗ: **giữ dữ liệu cũ hiển thị** (cơ chế placeholderData của TanStack Query) kèm một chỉ dấu tải nhẹ — không thay toàn bộ bằng skeleton.
- Hiệu ứng shimmer / pulse của skeleton phải tắt theo `prefers-reduced-motion`.
