# Quy ước giao diện (UI Guidelines) — Agency & Client Management SaaS

Tài liệu ràng buộc cho mọi công việc Frontend của dự án, theo DEC-013. Mọi agent làm Frontend (OpenCode, Muse khi kiêm nhiệm, hoặc agent mới tham gia sau này) phải đọc và tuân thủ tài liệu này trước khi dựng hoặc sửa bất kỳ màn hình nào. Nguyen là người nghiệm thu UI trực tiếp bằng mắt — phần lớn các lỗi dưới đây chỉ nhìn thấy khi nghiệm thu, nên agent phải tự kiểm trước ở nhiều bề rộng màn hình rồi mới báo cáo.

## 1. Hướng thiết kế đã chốt (DEC-013)

- Style chính của ứng dụng nội bộ: mẫu **A — Classic Sidebar** (sidebar điều hướng + nội dung sáng, trên nền shadcn/ui + Tailwind, design tokens thống nhất toàn app).
- Màn hình CRM: mẫu **D — Pipeline** (Kanban theo giai đoạn lead).
- Khu Client Portal: hơi hướng mẫu **C — Bento Thân Thiện** (thoáng, bo góc lớn, thân thiện với khách hàng).
- Không tự ý đổi bố cục khung, mật độ hiển thị hay phong cách component theo từng màn hình; cần thay đổi thì đề xuất lên Nguyen + Muse chốt (L3).
- Component UI mặc định là bản tự chế trong `apps/web/src/components/ui/` theo phong cách shadcn (design tokens của app); shadcn/ui (Radix) chỉ là lựa chọn theo từng component khi bản tự chế không đạt yêu cầu — dùng "linh động", không chuyển đổi hàng loạt, và trình Nguyen duyệt theo từng trường hợp (DEC-024).

## 2. Tương thích nhiều loại màn hình (responsive)

- Mọi màn hình phải dùng tốt ở các bề rộng phổ biến, từ điện thoại tới desktop: không vỡ bố cục, không tràn ngang ngoài ý muốn, không che khuất nội dung.
- **Trên mobile, nút bấm chiếm toàn chiều rộng → nhãn phải CĂN GIỮA**: khi một button có `width: 100%` (full-width) trên mobile, nội dung chữ (label) phải được căn giữa theo trục ngang ( `text-center` hoặc `justify-center`). Áp dụng cho các nút submit, nút xác nhận, và các nút hành động chính trong giao diện Client Portal và Portal.
- Tự kiểm tra ít nhất ở 3 bề rộng đại diện (nhỏ, trung bình, lớn) trước khi báo cáo hoàn thành.

## 3. Hiển thị dữ liệu danh sách: table trên desktop, card trên mobile (DEC-021, PO chốt 2026-11-26)

- **Desktop — ưu tiên table** khi đủ cả 3 điều kiện: (a) số cột cốt lõi ≤ 6 (không tính cột menu kebab hành động); (b) nội dung từng ô ngắn (mã, tên, ngày, số tiền, chip trạng thái); (c) dữ liệu mang tính quét / so sánh giữa các dòng. Table theo phong cách hiện đại: chỉ kẻ ngang mảnh giữa các dòng, header dính khi danh sách dài, hover sáng dòng; hành động của từng dòng thu vào menu kebab theo §7 (áp dụng cho cả dòng table).
- **Chiều ngang bị khống chế tuyệt đối**: mỗi cột có max-width rõ ràng, nội dung dài phải rút gọn bằng ellipsis trong một dòng. Table KHÔNG bao giờ tràn hay phải cuộn ngang trên desktop. Nếu có cột phụ vượt ngưỡng: hoặc đưa cột phụ sang vùng chi tiết / dòng mở rộng, hoặc toàn bộ danh sách chuyển sang card.
- **Desktop — dùng card** khi: số cột cốt lõi vượt 6, nội dung dài hoặc không đồng nhất (mô tả, ghi chú), hoặc bản ghi cần trình bày trực quan riêng (thanh tiến độ, ảnh). Nấc trung gian: table giữ cột cốt lõi + dòng mở rộng để xem phần còn lại.
- **Mobile: luôn hiển thị card** cho mọi danh sách — cùng một dữ liệu, hai cách trình bày theo breakpoint.
- **Header của table** (DEC-022): cỡ chữ 11px, in hoa, khóa đúng một dòng (nowrap) và cắt ellipsis khi vượt bề rộng cột — tiêu đề cột dài không được xuống dòng làm phình chiều cao hàng header.
- **Một khối dữ liệu = một cấp viền** (DEC-022): khi table hoặc card nằm bên trong một section đã có khung viền, phần tử bên trong phải bỏ khung riêng — table chỉ giữ đường kẻ ngang mảnh giữa các dòng (DataTable với `framed={false}`), các item trong section phân tách bằng divider mảnh thay vì bọc viền từng item. Nút bấm và ô nhập liệu giữ viền vì là control nhập liệu, không phải khối dữ liệu.
- **Click dòng/card vào chi tiết** (DEC-023): mọi dòng table và card dữ liệu có trang chi tiết đều click toàn bộ dòng/card để vào chi tiết; tiêu đề là chữ thường, không dựng nút/link riêng trong dòng. Ngoại lệ: card Kanban CRM (kéo–thả đổi giai đoạn) giữ điều hướng qua tiêu đề.
- Mục này thay thế cách tiếp cận "card là mặc định" trước đây. Ngưỡng 6 cột là mức tạm: PO nghiệm thu thực tế rồi quyết định chỉnh sau. Quy ước áp dụng ngược cho mọi màn danh sách đã làm (task FE-019) và là chuẩn cho mọi màn mới.

## 4. Độ tương phản của chữ

- Chữ trong các section, card và button phải hiển thị rõ, dễ đọc, tương phản tốt với nền.
- Không để chữ quá chìm/quá nhạt; kiểm tra cả trạng thái hover, disabled và chữ phụ — vẫn phải đọc được.

## 5. Chip và badge trạng thái/danh mục

- Nội dung trong chip/badge luôn nằm trên **một dòng duy nhất**, không được xuống dòng làm chip cao lên, vì sẽ phá vỡ sự cân đối chiều cao giữa các hàng dữ liệu.
- Nhãn dài phải được đặt tên ngắn lại hoặc cắt bằng ellipsis; chiều cao chip đồng nhất trong cùng một danh sách.
- Không chỉ trạng thái: **mức độ ưu tiên** (priority) và mọi giá trị phân mức tương tự cũng hiển thị dạng chip màu ngữ nghĩa (DEC-022) — dùng helper `priorityBadgeClass` trong `lib/status-colors.ts` (urgent đỏ, high đỏ hồng, medium hổ phách, low xám), cùng vỏ chip với chip trạng thái.
- Mọi giá trị trạng thái hiển thị cho người dùng phải là **nhãn đã dịch qua khóa i18n** và trình bày dạng chip màu — KHÔNG bao giờ hiện enum thô của API (ví dụ `changes_requested`, `in_progress`) hay khóa i18n thô lên màn hình.

## 6. Ổn định chiều cao và trạng thái rỗng

- Khu vực nội dung cần có chiều cao tối thiểu (min-height) hợp lý để khi dữ liệu chưa có, footer/khung trang **không bị nhảy lên**.
- Màn hình chưa có dữ liệu phải hiển thị empty state có chủ đích, giữ nguyên khung, thay vì trang trắng sụp khung.

## 7. Hành động trên card dữ liệu (FIX-013, PO chốt 2026-11-25)
- Mọi hành động của một card dữ liệu (Sửa, Xoá, Đánh dấu xong, ...) phải thu gọn vào **một nút icon three-dot (kebab menu)** ở góc card — dùng component dùng chung `ActionMenu` (`components/ui/ActionMenu.tsx`) — bấm vào mới hiện danh sách hành động. KHÔNG hiển thị các nút chữ Sửa/Xoá trực tiếp trên card: khi số hành động tăng lên, card sẽ rối và thay đổi kích thước.
- Quy ước áp dụng cho toàn bộ card dữ liệu (danh sách dự án/khách hàng/nhóm/thành viên, cột mốc, công việc, checklist, bình luận, người liên hệ, hoạt động, ghi chú). Hành động cấp trang (nút Xoá ở header trang chi tiết, nút Sửa mở form của section) không thuộc quy ước này.
- Menu kebab chỉ chứa hành động thật (Sửa, Xoá, ...), KHÔNG chứa mục điều hướng "Chi tiết" — điều hướng vào chi tiết đi bằng click toàn bộ dòng/card theo §3 (DEC-023). Danh sách không còn hành động nào trên dòng thì bỏ hẳn cột kebab.
- Mục hành động nguy hiểm (Xoá) hiển thị chữ đỏ trong menu.

- **Nút nguy hiểm mềm (danger soft)**: khi một thao tác huỷ/vô hiệu hoá được trình bày trực tiếp bằng nút (không thu vào menu kebab), nút dùng nền đỏ nhạt (`bg-red-50`) + viền đỏ (`border-red-200`) + chữ đỏ đậm (`text-red-700`, `font-semibold`) + icon khoá/trash đi kèm, hover làm đậm nền (`hover:bg-red-100`). Áp dụng cho các nút như "Vô hiệu hoá tài khoản Portal".

## 8. Quy trình nghiệm thu UI

- Các điểm 2–6 chỉ kiểm chứng đáng tin bằng mắt: agent làm FE tự kiểm ở nhiều bề rộng và nhiều trạng thái dữ liệu (có dữ liệu, rỗng, lỗi) trước khi báo cáo, và nêu rõ đã kiểm ở những bề rộng/trạng thái nào.
- Nguyen nghiệm thu UI trực tiếp; phản hồi của Nguyen tại nghiệm thu là tín hiệu chính để sửa các vấn đề thị giác mà kiểm thử tự động không bắt được.

## 9. Trạng thái tải và skeleton (DEC-021, PO chốt 2026-11-26)

- Mọi vùng render dữ liệu từ API phải có skeleton khi tải lần đầu hoặc chuyển trang lạnh. Skeleton là **bản sao hình học** của nội dung thật (cùng khung thẻ / dòng, cùng chiều cao, cùng vị trí avatar và chip) để khi dữ liệu về, nội dung thay tại chỗ và layout không xê dịch.
- Số lượng skeleton **cố định theo thiết kế** (bằng pageSize của danh sách, hoặc đủ lấp màn hình đầu tiên) — không phụ thuộc vào số bản ghi response trả về.
- Thời điểm hiển thị: chỉ hiện skeleton khi việc tải kéo dài hơn ~200ms (tránh "nháy skeleton" khi dữ liệu về nhanh); một khi đã hiện thì giữ tối thiểu ~300–400ms trước khi thay bằng dữ liệu (tránh chớp tắt). KHÔNG giữ dữ liệu thật lại thêm sau khi dữ liệu đã về.
- Đổi filter, phân trang, tải lại tại chỗ: **giữ dữ liệu cũ hiển thị** (cơ chế placeholderData của TanStack Query) kèm một chỉ dấu tải nhẹ — không thay toàn bộ bằng skeleton.
- Hiệu ứng shimmer / pulse của skeleton phải tắt theo `prefers-reduced-motion`.
- Trang chi tiết cũng phải có skeleton đúng hình khối dữ liệu chính của nó (DEC-022): section chứa table thì dùng skeleton dạng table đúng số cột và bề rộng cột, section chứa item có thanh tiến độ thì skeleton có thanh tiến độ — không dùng các thanh xám chung chung thay cho cấu trúc thật; quy tắc thời gian ~200ms áp dụng như nhau.

## 10. Vị trí hiển thị lỗi và trạng thái không có quyền (DEC-025, PO chốt 2026-11-26)

- Lỗi/cảnh báo của một thao tác hiển thị **ngay tại vị trí tương tác**: form nào báo lỗi trong form đó (modal thì trong modal, section thì đầu section), không gom về banner chung ở đầu trang. Người dùng không phải cuộn đi tìm cảnh báo.
- Banner đầu trang chỉ dành cho: lỗi tải dữ liệu lần đầu của cả trang, và hành động cấp trang (ví dụ xoá bản ghi từ nút ở header trang chi tiết).
- Khi API trả 403 `FORBIDDEN` lúc tải trang, hiển thị trạng thái toàn trang "không có quyền truy cập" bằng ngôn ngữ giao diện đang chọn (component dùng chung `Forbidden`, khóa `Common.forbidden`) — không hiển thị nguyên văn message của API (message API đi theo locale của tài khoản, có thể khác ngôn ngữ giao diện).
- Mọi chuỗi hiển thị cho người dùng (kể cả hộp thoại confirm) đều qua khóa i18n EN + VI; không để chuỗi hardcode trong JSX.

## 11. Nút bấm và icon (PO chốt 2026-11-27)

- Nút chính và nút hành động (Tạo, Lưu, Sửa, Xoá cấp trang, Thêm, Gửi, Tải lên, Duyệt, ...) luôn có **icon dẫn đầu** (leading icon) lấy từ bộ icon dùng chung `components/shell/Icon.tsx`; thiếu icon thì thêm vào bộ dùng chung theo cùng phong cách SVG, không vẽ icon riêng từng chỗ. Nút gửi bình luận/tin nhắn dùng icon **send**.
- Miễn trừ: tab, nút phân trang, mục trong menu, và các dòng/card bấm toàn bộ để mở chi tiết — các control điều hướng này không cần icon. Nút phụ Huỷ/Đóng trong form và modal được để chữ trơn.
- Icon đi kèm nhãn chữ, không thay thế nhãn (trừ các nút icon-only đã có quy ước riêng như kebab, chuông thông báo, nút trước/sau của phân trang), và không làm nút thay đổi kích thước giữa các trạng thái.

## 12. Nội dung do người dùng tạo (PO chốt 2026-11-27)

- Mọi nội dung do người dùng tạo — bình luận, file tải lên, yêu cầu và phản hồi phê duyệt, dòng lịch sử — luôn hiển thị kèm **tên và avatar** của người thực hiện (avatar ký tự đầu + màu theo người dùng như quy ước avatar hiện có). API đã trả các field này (`author`, `uploaded_by`, `responded_by`, `actor`/`author` của history); thiếu tên/avatar trên màn hình là lỗi hiển thị của FE.
- Luồng trao đổi hai phía (agency ↔ khách): hai phía dùng **hai tông nền mềm khác nhau** để phân biệt; khối nội dung dùng nền mềm thay cho viền lồng nhau (theo nguyên tắc một cấp viền ở §3).
- Phản hồi phê duyệt hiển thị thành **khối riêng** tách khỏi phần yêu cầu: avatar + tên người phản hồi, thời gian phản hồi, nội dung phản hồi, kèm icon Reply ở đầu khối.
- Tải file dùng vùng **dropzone** (viền dashed, có trạng thái khi kéo file qua, click để chọn file, hiện tên file đã chọn trước khi tải lên); mỗi dòng file có **icon theo định dạng** (ảnh / tài liệu / bảng tính / file nén / file chung).

## 13. Mô tả cho section (PO chốt 2026-11-27)

- Section mà mục đích chưa rõ ngay từ tiêu đề thì có thêm **một dòng mô tả nhỏ chữ xám** (text-sm, màu muted) ngay dưới tiêu đề, qua khóa i18n như mọi chuỗi hiển thị khác. Áp dụng đầu tiên cho section Cổng khách hàng trong trang chi tiết dự án.
