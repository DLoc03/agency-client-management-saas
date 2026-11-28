# Hướng dẫn chạy Brewbase ở local — theo hệ điều hành

Tài liệu tham chiếu cố định: chạy dự án, khởi động lại, và xử lý các sự cố đã từng gặp.
Chọn đúng phần theo hệ điều hành đang dùng. Mọi lệnh đều chạy tại thư mục gốc của dự án.

| | Ubuntu / Linux | Windows |
|---|---|---|
| Thư mục dự án | `~/Sources/agency-client-management-saas` | `D:\Personal Project\agency-client-management-saas` |
| Terminal | bash | PowerShell |
| Web | `http://localhost:3100` | `http://localhost:3000` |
| API | `http://localhost:8001` | `http://localhost:8000` |
| Tài khoản demo | `owner@demo.test` / `password` (nội bộ), `client@demo.test` / `password` (Portal) | như bên Linux (nhưng dữ liệu mỗi máy một DB riêng) |

Bảng trên là cấu hình hiện tại của chiếc máy đang chạy hệ điều hành tương ứng (máy công ty chạy Ubuntu, máy nhà chạy Windows); thư mục và cổng do cấu hình local của từng máy quyết định, còn cách chạy thì theo hệ điều hành.

Nguyên tắc chung cho cả hai hệ điều hành:
- Luôn chạy web ở **chế độ prod** khi nghiệm thu/sử dụng (build một lần lúc khởi động, duyệt trang tức thì). Dev mode biên dịch lại từng trang mỗi lần mở — chỉ dùng khi đang code FE và cần hot-reload.
- Sau khi pull code mới: có migration mới thì **chạy migrate**, có thay đổi `composer.lock` thì **restart api**, và **dựng lại container web** — container không tự cập nhật code đang phục vụ.
- Chỉ coi web là sẵn sàng khi log hiện dòng **Ready**. Mở trang lần đầu sau khi dựng lại thì hard-refresh (Ctrl+Shift+R) vì cache trình duyệt chậm hơn bản build.

---

## Phần A — Ubuntu / Linux (bash)

### A1. Chạy nghiệm thu chuẩn (sau khi pull code mới)

```bash
git checkout main && git pull
git log --oneline -1
docker compose exec api php artisan migrate
docker compose restart api
docker compose stop web
sudo rm -rf apps/web/.next
WEB_MODE=prod docker compose up -d web
docker compose logs -f web
```

- `git log` phải hiện đúng commit merge mới nhất (đối chiếu với mã PR Loc Jr. báo).
- `migrate` hiện DONE cho các migration mới, hoặc "Nothing to migrate" nếu đã chạy — cả hai đều bình thường.
- Chờ log web hiện **Ready** rồi nhấn Ctrl+C thoát xem log, mở `http://localhost:3100`, hard-refresh.
- `.next` trên Linux do container chạy bằng root tạo ra nên phải có `sudo` khi xoá.

### A2. Khởi động lại bình thường (không có code mới)

```bash
WEB_MODE=prod docker compose up -d
docker compose logs -f web
```

### A3. Dừng toàn bộ

```bash
docker compose down
```

---

## Phần B — Windows (PowerShell)

### B0. Điều kiện riêng trên Windows (chỉ cần biết, đã cấu hình sẵn)

- **Docker Desktop phải được mở trước** khi chạy bất kỳ lệnh `docker compose` nào.
- MySQL cài sẵn trên Windows chiếm cổng 3306, nên dự án có file local `docker-compose.override.yml` (không commit) ánh xạ MySQL sang cổng **3307**. Nếu 3307 cũng bị chiếm thì đổi sang 3308 — xem sự cố C2.
- Chế độ prod đã được ghim bằng dòng `WEB_MODE=prod` trong file `.env` ở thư mục gốc dự án — `docker compose up -d` là tự chạy prod, không cần đặt biến mỗi lần. Kiểm tra khi cần: `docker compose config | findstr WEB_MODE` phải in `WEB_MODE: prod`.

### B1. Chạy nghiệm thu chuẩn (sau khi pull code mới)

```powershell
git checkout main
git pull
git log --oneline -1
docker compose exec api php artisan migrate
docker compose restart api
docker compose stop web
Remove-Item -Recurse -Force apps\web\.next -ErrorAction SilentlyContinue
docker compose up -d web
docker compose logs -f web
```

- Chờ log hiện **Ready**, mở `http://localhost:3000`, hard-refresh (Ctrl+Shift+R).

### B2. Khởi động lại bình thường (không có code mới)

```powershell
docker compose up -d
docker compose logs -f web
```

### B3. Dừng toàn bộ

```powershell
docker compose down
```

---

## Phần C — Sự cố thường gặp

### C1. Web "compiling" liên tục, mở trang nào cũng chậm

- **Triệu chứng:** log web hiện Compiling liên tục khi duyệt trang; trang tải rất chậm.
- **Nguyên nhân:** web đang chạy dev mode (mặc định khi không đặt WEB_MODE) — chế độ này biên dịch từng trang theo yêu cầu.
- **Xử lý:** chuyển sang prod. Trên Ubuntu/Linux: `docker compose stop web` rồi `WEB_MODE=prod docker compose up -d web`. Trên Windows: kiểm tra file `.env` ở gốc dự án có dòng `WEB_MODE=prod` chưa (chưa có thì thêm bằng `Add-Content .env "`nWEB_MODE=prod"`), rồi `docker compose stop web` và `docker compose up -d web`. Chờ **Ready** — từ đó duyệt trang tức thì.

### C2. Lỗi cổng đã bị chiếm khi `docker compose up`

- **Triệu chứng:** `Error response from daemon: Ports are not available: ... bind: Only one usage of each socket address...` kèm số cổng (ví dụ 3307).
- **Nguyên nhân:** một tiến trình hoặc container khác đang giữ cổng đó.
- **Xử lý trên Windows (PowerShell):**
  1. Tìm thủ phạm: `netstat -ano | findstr :3307` (thay số cổng theo lỗi) — cột cuối là PID; xem nó là gì: `Get-Process -Id <PID>`. Kiểm tra thêm `docker ps` — nếu thủ phạm là container của chính dự án từ một lần chạy khác thì `docker rm -f <tên-container>` rồi `docker compose up -d` lại.
  2. Nếu thủ phạm là tiến trình Windows đang cần dùng (MySQL hệ thống, dịch vụ khác…): đừng tắt nó — **đổi cổng trong file override**: mở `notepad docker-compose.override.yml`, đổi `"3307:3306"` thành `"3308:3306"` (kiểm tra 3308 trống bằng `netstat -ano | findstr :3308` — không in gì là trống), lưu rồi `docker compose up -d`. Đổi cổng host không ảnh hưởng ứng dụng vì các container nói chuyện với nhau qua cổng nội bộ.
- **Xử lý trên Ubuntu/Linux (bash):** tìm thủ phạm bằng `sudo lsof -i :<cổng>` hoặc `docker ps`; cổng web/API trên Linux (3100/8001) do file override đặt — đổi số trong `docker-compose.override.yml` tương tự nếu cần.

### C3. Trang vẫn hiện giao diện/dữ liệu cũ sau khi pull code mới

- **Nguyên nhân:** container web đang phục vụ bản build cũ trong `.next`; hoặc cache trình duyệt.
- **Xử lý:** dựng lại web đúng quy trình nghiệm thu (Phần A1/B1): stop web → xoá `.next` → up ở prod → chờ **Ready** → hard-refresh Ctrl+Shift+R. Nếu vừa pull thay đổi backend: `docker compose restart api` và chạy `migrate` nếu có migration mới.

### C4. Lỗi Next.js "different slug names for the same dynamic path ('id' !== 'projectId')"

- **Nguyên nhân:** trong cây `apps/web/src/app` tồn tại hai thư mục segment động khác tên cho cùng một vị trí (ví dụ `[id]` cạnh `[projectId]`) — có thể do code trong repo, cũng có thể do thư mục thừa không thuộc git sót lại từ một phiên làm việc khác.
- **Xử lý:** KHÔNG tự xoá thư mục nào. Chụp lại thông báo lỗi và báo Loc Jr. — việc xoá nhầm thư mục có trong git sẽ làm mất route (đã từng xảy ra: xoá `[id]` làm trang chi tiết Portal không tải được). Nếu cần tự kiểm tra trước: `git status` — thư mục nào hiện `??` (untracked) mới là ứng viên thư mục thừa.

### C5. Đăng nhập/HTTP báo lỗi thiếu APP_KEY (MissingAppKeyException)

- **Nguyên nhân:** clone mới chưa có file `.env` cho API.
- **Xử lý:**
  ```bash
  docker compose exec api cp .env.example .env
  docker compose exec api php artisan key:generate
  ```
  (Trên Windows dùng cùng hai lệnh này trong PowerShell.)

### C6. Lệnh `docker compose exec api ...` báo thiếu `vendor/autoload.php`

- **Nguyên nhân:** container api vừa khởi động, `composer install` chạy ở đầu chưa xong.
- **Xử lý:** chờ 30–60 giây rồi chạy lại lệnh. Sau khi pull bản có thay đổi `composer.lock`: `docker compose restart api` để nó cài lại gói mới.

### C7. API trả 500 sau khi có tính năng mới dùng bảng/cột mới

- **Nguyên nhân:** chưa chạy migration cho DB local.
- **Xử lý:** `docker compose exec api php artisan migrate` rồi `docker compose restart api`. "Nothing to migrate" nghĩa là DB đã đủ — lỗi nằm ở chỗ khác, báo Loc Jr. kèm trang/cách tái hiện.

### C8. Kiểm tra nhanh trạng thái các container

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
```

- `docker compose ps`: container nào `Up` là đang chạy; web phải ở trạng thái Up và log có **Ready** mới mở trang được.
- Xem log xong nhấn Ctrl+C để thoát (container vẫn chạy nền).

---

## Phần D — Việc cần nhớ theo thói quen

1. Pull code mới → migrate → restart api → dựng lại web (prod) → chờ Ready → hard-refresh. Thiếu một bước là triệu chứng giống "lỗi khó hiểu" ở các mục C3/C7.
2. Không commit các file local: `docker-compose.override.yml`, `.env`, `.next/` — chúng chỉ thuộc về từng máy.
3. Gặp lỗi lạ ngoài danh sách này: chụp màn hình/log + ghi lại lệnh vừa chạy, gửi Loc Jr. — đừng tự xoá thư mục hay sửa file cấu hình ngoài các bước đã ghi ở đây.
