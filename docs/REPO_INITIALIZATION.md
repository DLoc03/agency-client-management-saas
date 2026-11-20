# KẾ HOẠCH KHỞI TẠO REPO — chờ link repo từ Nguyen
**Trạng thái:** Đã sẵn sàng. Toàn bộ quyết định nền tảng đã chốt ngày 2026-11-20 (Quy ước v2, Stack A, Scope MVP, RBAC 7 vai trò, i18n EN+VI, 1 repo chung).
**Việc còn lại duy nhất:** Nguyen tạo repo và gửi link. Muse không tự tạo repo thay.

## Gợi ý cho Nguyen khi tạo repo (để khởi tạo không bị vướng)
- Tạo **repo trống hoàn toàn**: không tick "Add a README", không chọn .gitignore/license mẫu — các file này sẽ được đưa vào có chủ đích ở bước khởi tạo, tránh file rác phải xoá ngay commit đầu.
- Branch mặc định: `main`.
- Tên repo: tuỳ anh (vd `agency-client-saas`). Tên sản phẩm hiển thị có thể đặt sau, không bị khoá theo tên repo.
- Public/Private: tuỳ anh. Gợi ý của em: để **Private trong lúc xây MVP**, chuyển Public khi có bản demo chạy được — lúc đó lịch sử commit/PR vẫn giữ nguyên để nhà tuyển dụng xem. Nếu anh muốn minh bạch tiến trình ngay từ đầu thì Public từ đầu cũng không có trở ngại kỹ thuật (repo không chứa secret theo quy ước).

## Muse sẽ làm gì ngay khi nhận link (theo thứ tự, mỗi bước là 1 PR trừ bước 0)
0. Kiểm tra quyền truy cập repo, trạng thái repo trống, branch mặc định. Báo lại cho Nguyen trước khi ghi bất cứ thứ gì.
1. **PR khởi tạo tài liệu (bootstrap):** đưa 5 file bắt buộc vào root với nội dung thật đã chốt — `VERSION.md` (1 dòng: `0.1.0`), `TASK.md` (danh sách task khởi tạo theo ID), `CHANGELOG.md` (mục [Unreleased]), `README.md` (tiếng Anh, theo khung đã duyệt) + `README.vi.md`, `DECISIONS.md` (DEC-001 → DEC-006 đã soạn sẵn); đưa Quy ước chung + tài liệu Stack/Scope/RBAC-i18n vào `docs/`.
   - Lưu ý quy ước: lần bootstrap đầu tiên này, nếu repo trống chưa có gì để PR vào, Nguyen duyệt cho commit thẳng vào `main` **một lần duy nhất** và ghi nhận ngoại lệ này vào `DECISIONS.md`. Từ PR thứ hai trở đi, mọi việc tuân thủ tuyệt đối quy trình PR.
2. **PR khung monorepo:** cấu trúc `apps/`, `packages/contracts/`, `tests/e2e/`, `docs/` + `.gitignore`, `.editorconfig`, `docker-compose.yml` (api/web/mysql/redis/mailpit/minio) + script chạy local ở root.
3. **PR khởi tạo Backend:** Laravel ở `apps/api`, cấu hình `.env.example`, kết nối MySQL/Redis trong Docker, kiểm tra health endpoint `/api/v1/health`.
4. **PR khởi tạo Frontend:** Next.js ở `apps/web`, TypeScript strict, Tailwind + shadcn/ui, `next-intl` với `en.json`/`vi.json` ngay từ đầu (theo DEC-006), trang khung đăng nhập.
5. Sau 4 bước trên: Muse + Nguyen phân đợt task đầu tiên (Auth + Multi-tenancy + RBAC) vào `TASK.md` và phổ biến cho Antigravity + OpenCode bắt đầu phần của họ.

## Điểm kiểm tra trước khi phổ biến cho 2 agent còn lại
- [ ] 5 file bắt buộc đã ở root, đúng chủ sở hữu theo Quy ước
- [ ] `docker compose up` chạy được toàn hệ thống ở máy sạch
- [ ] Health endpoint trả về đúng format response chuẩn
- [ ] FE chuyển được EN ↔ VI ở trang khung
- [ ] TASK.md đã có đợt task đầu tiên, ghi rõ Assignee + Level cho từng task
