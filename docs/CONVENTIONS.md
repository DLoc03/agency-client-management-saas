# QUY ƯỚC CHUNG — 3 AI CODING AGENTS LÀM CHUNG 1 DỰ ÁN
**Dự án:** Agency & Client Management SaaS
**Trạng thái:** ✅ CHÍNH THỨC — áp dụng từ 2026-11-20 theo DEC-002 (xem DECISIONS.md)
**Ngày cập nhật:** 2026-11-20 · Người có quyền cao nhất: Nguyen (Product Owner)

> Nguyên tắc gốc: 3 agents không có trí nhớ chung. Thứ duy nhất cả 3 cùng nhìn thấy là repo + các file markdown trong repo. Quy ước này là cơ chế thay thế trí nhớ chung. File nào không có chủ duy nhất thì file đó chắc chắn conflict.

---

## A. VAI TRÒ CHÍNH THỨC & QUYỀN HẠN TỐI CAO

| Vai trò | Người / Công cụ | Chức năng |
|---|---|---|
| **Product Owner — quyền cao nhất** | **Nguyen** | Quyết định scope, stack, ưu tiên, phê duyệt MAJOR, merge ngoại lệ, và là **người duy nhất được phá lệ** (mục A.1) |
| **Backend Developer chính + Đồng phân chia nhiệm vụ** | **Muse AI (Loc Jr.)** | (1) Backend Developer chính: API, DB, auth, business logic. (2) Là agent **duy nhất** cùng Nguyen phân chia nhiệm vụ cho các công cụ khác và cùng Nguyen chốt contract FE–BE trước khi phổ biến (mục E) |
| **Frontend Developer** | **Google Antigravity** | UI, page, component, routing, state phía client — theo contract đã phổ biến |
| **QA Review & Tester + Frontend Developer dự bị** | **OpenCode** | Review + test qua PR, báo bug, đóng version PATCH/MINOR. Chỉ làm Frontend khi được giao làm dự bị cho Antigravity |

**Điều cấm suy ra từ bảng trên:**
- Antigravity và OpenCode **không tự phân chia / tự giao nhiệm vụ cho nhau hoặc cho chính mình**. Việc phân task do Nguyen + Muse soạn, Nguyen duyệt, rồi mới ghi vào `TASK.md` và phổ biến.
- Antigravity và OpenCode **không tự chốt contract** với nhau và không tự thoả thuận thay đổi API ở kênh riêng. Mọi đề xuất đi qua `TASK.md` mục `Inbox` → Muse + Nguyen chốt (mục E).

### A.1. Phá lệ — quyền riêng của Nguyen
Trong quá trình thực hiện sẽ có phá lệ, và quy ước phải chấp nhận điều đó thay vì giả vờ không có:
- Ví dụ điển hình: Antigravity hết quotas, OpenCode gặp trục trặc → Nguyen gán thêm vai trò/task của thành viên khác cho Muse (vd giao task FE cho Muse), hoặc giao chéo tương tự cho agent còn hoạt động.
- **Chỉ Nguyen mới được tuyên bố phá lệ.** Không agent nào — kể cả Muse — được tự phá lệ, tự nhận task của người khác, hay tự miễn trừ một quy định trong tài liệu này vì "tình huống gấp".
- Mỗi lần phá lệ bắt buộc ghi vào `DECISIONS.md` dạng quyết định ngoại lệ, gồm: **task/vai trò được gán chéo, lý do, phạm vi áp dụng, thời điểm kết thúc** (task DONE thì hết hiệu lực, hoặc ngày cụ thể, hoặc khi Nguyen thu hồi). Hết hiệu lực thì vai trò tự động quay về mặc định ở bảng trên, không cần quyết định mới.
- Khi Muse nhận task FE do phá lệ: người review PR đó là **OpenCode** (đúng vai QA). Khi Muse nhận cả task QA do phá lệ (OpenCode trục trặc): Muse **không tự nghiệm thu việc của mình** — PR/task đó chờ Nguyen review trực tiếp. Nguyên tắc "không ai tự nghiệm thu việc mình làm" **không bao giờ bị phá lệ**, kể cả khi phá lệ các điều khác.

---

## B. QUY ƯỚC CHUNG BẮT BUỘC — cả 3 vai trò đều phải tuân theo

1. **Single Source of Truth:** Mọi quyết định, trạng thái task, phiên bản, thay đổi đều phải nằm trong repo (5 file ở mục F + API contract). Nói trong chat mà không ghi vào file = chưa xảy ra.
2. **Không sửa phần của người khác:** Chỉ sửa code/file thuộc phạm vi sở hữu (mục C). Thấy lỗi ở phần người khác → ghi vào `TASK.md` mục `Inbox` kèm file/dòng/lỗi, không tự sửa.
3. **Đọc trước khi làm:** Trước mỗi phiên, đọc theo thứ tự: `VERSION.md` → `TASK.md` (task của mình) → `CHANGELOG.md` [Unreleased] → `DECISIONS.md` (các quyết định còn hiệu lực, đặc biệt là ngoại lệ đang áp dụng) → API contract.
4. **Claim trước khi code:** Chuyển task của mình sang `IN_PROGRESS` + ghi tên agent + ngày bắt đầu TRƯỚC khi sửa code. Task đã có người claim thì agent khác không đụng vào.
5. **API-first, không bịa endpoint:** Frontend chỉ gọi endpoint đã có trong contract đã phổ biến (mục E). Cần endpoint mới → đề xuất ở `Inbox`, chờ Muse + Nguyen chốt.
6. **Làm việc qua PR có review thật (đã chốt):** Không push thẳng lên `main`, không force-push, không sửa lịch sử git, không tự merge PR của chính mình. Chi tiết ở mục G.
7. **Definition of Done chung (thiếu 1 là chưa xong):** (1) Code chạy được ở local sạch, (2) Có test hoặc cách test tay rõ ràng, (3) Đã ghi `CHANGELOG.md` [Unreleased] ở mục của mình, (4) Đã cập nhật `TASK.md` sang `IN_REVIEW`, (5) PR đã được reviewer Approve theo bảng ở G.3.
8. **Không tự ý thêm thư viện / đổi cấu hình chung:** Thuộc mức L4 ở thang quyết định (mục D) — phải hỏi Nguyen trước.
9. **Không chứa secret trong repo:** Chỉ commit `.env.example` (không có giá trị thật). Không dán API key/token/mật khẩu vào bất kỳ file markdown nào.
10. **Dừng khi conflict, không ghi đè:** Gặp conflict ở file không thuộc quyền sở hữu của mình → DỪNG, báo Nguyen, không tự resolve bằng cách lấy bản của mình đè lên.
11. **Ngôn ngữ thống nhất:** Code + tên biến + commit + tên branch + API = tiếng Anh, không dấu. Ghi chú trong `TASK.md`/`CHANGELOG.md`/`DECISIONS.md` dùng tiếng Việt được, tên task/module giữ tiếng Anh.
12. **Drive-by refactor bị cấm:** Sửa task nào chỉ sửa đúng phạm vi task đó. Thấy code xấu ở chỗ khác → ghi vào `Inbox`, không tiện tay refactor.

---

## C. PHẠM VI SỞ HỮU — ai sở hữu gì, ai bị cấm gì

| Hạng mục | Nguyen | Muse — BE + Điều phối | Antigravity — FE | OpenCode — QA + FE dự bị |
|---|---|---|---|---|
| Scope / ưu tiên / stack | ✅ Duy nhất | Đề xuất cùng Nguyen | Đề xuất qua Inbox | Đề xuất qua Inbox |
| Phân chia nhiệm vụ cho các công cụ | ✅ Duyệt cuối | ✅ **Duy nhất cùng Nguyen soạn & giao** | ❌ Nhận task qua TASK.md | ❌ Nhận task qua TASK.md |
| Chốt contract FE–BE | ✅ Duyệt cuối | ✅ **Duy nhất cùng Nguyen soạn & chốt** | ❌ Chỉ nhận bản đã phổ biến | ❌ Chỉ nhận bản đã phổ biến, kiểm chứng khi test |
| API, DB schema, migration, auth, business logic | Duyệt khi L4/L5 | ✅ **Sở hữu duy nhất** | ❌ Cấm sửa | ❌ Cấm sửa (chỉ đọc để test) |
| UI, page, component, routing, state client | Duyệt mẫu | ❌ Cấm sửa (trừ phá lệ A.1) | ✅ **Sở hữu chính** | ✅ Chỉ khi được giao dự bị |
| Test case, E2E, review PR, báo bug | Xem kết quả | Sửa bug BE do QA báo | Sửa bug FE do QA báo | ✅ **Sở hữu duy nhất** |
| File khoá dùng chung: `package.json`, lockfile, `.env.example`, docker, CI | Duyệt (L4) | Sửa phần backend khi có task riêng | Sửa phần frontend khi có task riêng | ❌ Cấm sửa (trừ config test) |
| Bump version | Duyệt MAJOR (L5) | ❌ Cấm | ❌ Cấm | ✅ PATCH/MINOR tự quyết, xem F.1 |

### C.1. Quy tắc riêng cho OpenCode (vai trò kép)
- Chỉ làm FE khi task ghi rõ Assignee = OpenCode (dự bị khi Antigravity hết quota). Không tự nhảy vào làm FE vì "thấy còn trống".
- **Không tự review / tự nghiệm thu code FE do chính mình viết** — phần đó do Muse review chéo hoặc Nguyen duyệt thẳng. Task dừng ở `IN_REVIEW`, không tự chuyển `DONE`.
- Bàn giao FE Antigravity ↔ OpenCode: người cũ bắt buộc ghi mục **Handoff** trong task (đã làm tới đâu, file nào đang dở, quyết định UI đã chốt, còn thiếu gì). Người mới đọc Handoff trước, không làm lại từ đầu, không đổi style/component pattern đang dùng.

---

## D. THANG 5 MỨC QUYẾT ĐỊNH — việc nào tự quyết, việc nào phải hỏi Nguyen
*Mỗi task trong `TASK.md` phải ghi rõ thuộc mức nào. Agent không tự hạ mức của một việc để khỏi phải hỏi.*

| Mức | Tên | Ai quyết | Áp dụng cho (ví dụ) | Cách xử lý |
|---|---|---|---|---|
| **L1** | **Tự quyết, không cần báo trước** | Agent sở hữu task | Cách triển khai nội bộ trong phạm vi task; đặt tên biến/hàm nội bộ; viết test cho code của mình; sửa typo; refactor nội bộ **không đổi** interface/contract | Làm luôn, ghi tiến độ ở TASK như bình thường |
| **L2** | **Tự quyết, phải ghi lại** | Agent sở hữu task | Thêm field tuỳ chọn không phá contract đã chốt; đổi wording thông báo lỗi; tối ưu query không đổi schema; **OpenCode bump PATCH/MINOR sau QA PASS** | Làm luôn + ghi `CHANGELOG.md` và, nếu là quyết định kỹ thuật đáng nhớ, đề xuất ghi `DECISIONS.md` |
| **L3** | **Muse + Nguyen chốt, rồi phổ biến** | Nguyen + Muse | **Contract FE–BE** (endpoint mới, request/response, mã lỗi); **phân chia task cho Antigravity/OpenCode**; làm rõ Acceptance Criteria; thứ tự ưu tiên khi có task bị BLOCKED | Muse soạn đề xuất → Nguyen duyệt/sửa → Muse ghi vào contract + `TASK.md` + `DECISIONS.md` → đó mới là bản chính thức để 2 vai trò còn lại làm theo |
| **L4** | **Phải hỏi Nguyen trước khi làm** | Nguyen duyệt trước | Thêm thư viện/dependency mới; đổi schema/migration trên model đã công bố (không phá tương thích); sửa file khoá dùng chung; đổi biến môi trường/port/config deploy; đổi chiến lược test; đổi cấu trúc thư mục | Đề xuất ở `Inbox` kèm lý do + ảnh hưởng → chờ Nguyen trả lời mới làm. Chưa trả lời = chưa làm |
| **L5** | **Chỉ Nguyen quyết — gồm mọi phá lệ** | Nguyen, duy nhất | Đổi scope/stack; **bump MAJOR**; gán chéo vai trò/task (phá lệ A.1); bypass PR review / merge thẳng `main`; force-push; xoá dữ liệu / migration phá huỷ; release production; huỷ task người khác đang làm | Agent chỉ được **đề xuất**, không được thực hiện khi chưa có câu duyệt rõ ràng của Nguyen. Quyết định L5 phải ghi vào `DECISIONS.md` |

Nguyên tắc đọc thang: **phạm vi ảnh hưởng càng vượt ra khỏi task của mình, mức càng cao.** Việc gì phân vân giữa 2 mức → lấy mức cao hơn.

---

## E. QUY TRÌNH CHỐT CONTRACT FE–BE (Muse + Nguyen)
*Đây là khâu khó nhất lúc ban đầu, nên quy trình phải rõ từng bước. FE/QA bị chặn vì chờ BE sẽ vẫn xảy ra thường xuyên — quy trình này giảm thời gian chờ chứ không hứa xoá hết.*

1. **Phát sinh nhu cầu:** Antigravity/OpenCode ghi đề xuất vào `TASK.md` mục `Inbox` (cần dữ liệu gì, cho màn hình/luồng nào). Muse cũng tự đề xuất khi thiết kế BE.
2. **Muse soạn đề xuất contract:** method + path, request (field, kiểu, bắt buộc/tuỳ chọn), response mẫu (JSON thật), mã lỗi + ý nghĩa, yêu cầu auth/quyền, phân trang/sắp xếp/lọc nếu có.
3. **Nguyen + Muse chốt:** Nguyen duyệt hoặc sửa đề xuất. Chưa chốt = FE/QA chưa dựa vào để code phần thật, chỉ được dựng khung/màn hình tĩnh.
4. **Phổ biến chính thức:** Muse ghi contract vào file contract trong repo, đồng thời tách thành các task `BE-*` / `FE-*` / `QA-*` trong `TASK.md` và ghi quyết định vào `DECISIONS.md` nếu contract có lựa chọn đáng nhớ. **Thời điểm ghi vào `TASK.md` mới tính là đã phổ biến** — bản thảo trong chat chưa tính.
5. **FE/QA làm việc trên bản đã phổ biến:** FE code với dữ liệu mock đúng y hệt response mẫu trong contract (không chờ API thật), QA viết test case từ contract + Acceptance Criteria (không chờ cả hai bên xong).
6. **Đổi contract đã phổ biến:** quay lại bước 2. Muse phân loại: thay đổi **không phá vỡ** (thêm field tuỳ chọn...) = L2/L3, thay đổi **phá vỡ** (đổi tên/bỏ field, đổi kiểu, đổi mã lỗi) = L4, phải báo rõ FE/QA task nào bị ảnh hưởng trong `TASK.md` trước khi áp dụng.

### E.1. Khi bị BLOCKED vì chờ BE
- Task bị chặn phải ghi rõ trong mục của nó ở `TASK.md`: `Status: BLOCKED` · `Blocked by: <BE-task ID / contract mục nào>` · `Need: <thiếu chính xác cái gì>` · ngày bắt đầu bị chặn.
- Muse + Nguyen ưu tiên xử lý task gây chặn **trước** task tính năng mới khi phân chia đợt việc tiếp theo (đây là việc L3).
- Deliverable đầu tiên của BE cho mỗi contract là **contract + mock response**, không phải code hoàn chỉnh — FE/QA nhận được 2 thứ này là hết bị chặn về mặt hình thức, dù API thật chưa xong.

---

## F. 5 FILE MARKDOWN BẮT BUỘC — quyền ghi chống conflict
*Tất cả đều là file `.md` (đã chốt). Nguyên lý: mỗi file / mỗi mục trong file chỉ có ĐÚNG 1 chủ được ghi. Người khác muốn sửa → đề xuất ở `TASK.md` mục `Inbox`, chủ file tự tay ghi vào.*

### F.1. `VERSION.md` — Chủ duy nhất: **OpenCode** · Nội dung: **đúng 1 dòng duy nhất**
```md
0.1.0
```
- File chỉ chứa 1 dòng phiên bản SemVer, **không** tiêu đề, không ngày tháng, không ghi chú (ngày release nằm ở `CHANGELOG.md`).
- **Chỉ OpenCode được ghi**, và chỉ khi: toàn bộ task của đợt release đã qua review + test PASS, không còn bug `critical/high` mở.
- `PATCH` (sửa bug) và `MINOR` (thêm tính năng, không phá API cũ): **OpenCode tự quyết** sau QA PASS (mức L2).
- `MAJOR` (phá API / đổi schema không tương thích): **phải chờ Nguyen phê duyệt** trước khi bump (mức L5).
- Muse & Antigravity tuyệt đối không sửa file này. Xong việc ≠ lên version.

### F.2. `TASK.md` — Theo **danh sách từng Task ID** (đã chốt, không dùng bảng)
Cấu trúc: mỗi task là 1 mục riêng, ngăn cách bằng `---`, để sửa task nào chỉ chạm đúng vùng đó (bảng chung rất dễ conflict khi 2 người sửa 2 dòng cùng lúc).
```md
## BE-001 — <Tên task>
- Assignee: Muse · Level: L1 · Status: TODO
- Branch: be/BE-001-<slug> · PR: —
- Blocked by: —
- Acceptance Criteria: <Nguyen + Muse viết khi giao task>
- Progress: <chủ task ghi>
- Handoff: <khi bàn giao / phá lệ mới ghi>
```
Quyền ghi:
| Hành động | Người được ghi |
|---|---|
| Tạo task, giao Assignee, đặt Level + Acceptance Criteria | Nguyen + Muse (L3) — đây là đầu ra của việc phân chia nhiệm vụ |
| Cập nhật Status/Progress của task `BE-*` / `FE-*` / `QA-*` | Chỉ Assignee của task đó |
| Chuyển task sang `DONE` / `REOPEN` | Chỉ OpenCode (sau review/test) — Assignee chỉ được chuyển tới `IN_REVIEW`. Ngoại lệ: task do OpenCode tự làm thì Muse hoặc Nguyen chuyển |
| Đánh dấu `BLOCKED` + lý do | Assignee của task |
| Mục `Inbox` ở cuối file | Cả 3 agent được **thêm** mục mới, không sửa mục của người khác |

Luồng trạng thái: `TODO → IN_PROGRESS → IN_REVIEW → DONE` · nhánh: `→ BLOCKED`, `→ REOPEN → IN_PROGRESS`.

### F.3. `CHANGELOG.md` — Cả 3 được **thêm**, chỉ OpenCode được **đóng gói**
- Cấu trúc *Keep a Changelog*: trên cùng `## [Unreleased]` với 3 tiểu mục cố định `### Backend` / `### Frontend` / `### QA & Fixes`; bên dưới là các bản đã release `## [0.3.1] - <ngày>`.
- Mỗi agent chỉ **append** vào đúng tiểu mục của mình trong `[Unreleased]`. Append-only: cấm sửa/xoá dòng của agent khác.
- Khi release, **chỉ OpenCode**: đổi `[Unreleased]` thành `## [x.y.z] - <ngày>` khớp đúng số ở `VERSION.md`, tạo lại `[Unreleased]` trống, và bump `VERSION.md` — cả hai việc trong **cùng 1 commit** của PR release (mục G).

### F.4. `README.md` — Chia mục sở hữu, Nguyen duyệt bản cuối
| Mục trong README | Chủ mục |
|---|---|
| Giới thiệu, tính năng, roadmap | Nguyen |
| Cài đặt & chạy Backend, biến môi trường, database, API docs | Muse |
| Cài đặt & chạy Frontend, cấu trúc thư mục UI | Antigravity (OpenCode chỉ khi đang giữ vai FE cho phần mình làm) |
| Cách chạy test, quy trình QA, cách báo bug | OpenCode |

Không ai được viết lại toàn bộ README — chỉ sửa mục của mình. Đổi cấu trúc mục lục = task riêng mức L3/L4.

### F.5. `DECISIONS.md` — Chủ ghi: **Nguyen + Muse** (đã chốt thêm file này)
Mục đích: ổn định quy trình — sau vài tuần không ai (và không agent nào) nhớ "vì sao đã chọn cách này", agent sẽ đề xuất đổi ngược lại nếu không có nhật ký.
- Cấu trúc theo từng quyết định, **append-only, không sửa quyết định cũ**; quyết định mới thay thế quyết định cũ thì ghi quyết định mới và ghi rõ `Supersedes: DEC-xxx`:
```md
## DEC-001 — <Tên quyết định> · <ngày> · Mức: L3/L4/L5
- Decision: <chốt cái gì>
- Reason: <vì sao>
- Alternatives rejected: <phương án đã loại, nếu có>
- Scope / Expiry: <phạm vi áp dụng; riêng quyết định phá lệ phải có thời điểm kết thúc>
```
- **Chỉ Nguyen + Muse được ghi** (vì đây là cặp cùng chốt contract và phân task). Antigravity/OpenCode đề xuất quyết định qua `Inbox`, không tự ghi.
- Mọi quyết định **L5 và mọi phá lệ (A.1) bắt buộc** có 1 mục ở đây. Quyết định L3 về contract quan trọng cũng ghi vào đây.

### F.6. Quy tắc ghi chung cho 5 file
1. Trước khi sửa: pull bản mới nhất + kiểm tra `git status`. Sửa trên bản cũ là nguồn conflict phổ biến nhất.
2. Sửa các file này qua PR như code (mục G), commit riêng không gộp với commit code lớn — trừ commit release ở F.3.
3. Nếu vẫn conflict: giữ nguyên cả hai phía, báo Nguyen quyết, không agent nào tự chọn bản thắng.

---

## G. QUY ƯỚC KỸ THUẬT — BRANCH, WORKTREE, COMMIT, PR

### G.1. Branch
- `main` là branch được bảo vệ: **không ai push thẳng**, mọi thay đổi vào `main` đều qua PR. `main` phải luôn ở trạng thái chạy được và khớp với `VERSION.md`.
- **Format tên branch (bắt buộc):** `<prefix>/<TASK-ID>-<slug>` — slug là tiếng Anh không dấu, kebab-case, ngắn gọn (tối đa ~40 ký tự), mô tả đúng việc:
  | Prefix | Dùng cho | Ví dụ |
  |---|---|---|
  | `be/` | Task Backend của Muse | `be/BE-001-auth-login-api` |
  | `fe/` | Task Frontend (Antigravity, hoặc OpenCode/Muse khi được giao FE) | `fe/FE-002-clients-list-page` |
  | `qa/` | Task test/review tooling của OpenCode | `qa/QA-001-e2e-clients-flow` |
  | `fix/` | Sửa bug (kèm ID của vai sở hữu: `fix/be-`, `fix/fe-`) | `fix/fe-FE-002-pagination-overflow` |
  | `docs/` | Sửa tài liệu / quy ước / 5 file markdown | `docs/DOC-001-update-conventions` |
  | `chore/` | Cấu hình, dependency (chỉ khi đã duyệt L4) | `chore/CHORE-001-bump-dependencies` |
  | `release/` | **Chỉ OpenCode tạo** khi đóng version | `release/v0.2.0` |
  | `hotfix/` | Sửa khẩn trên bản đang chạy — **chỉ khi Nguyen tuyên bố (L5)**, branch từ `main` | `hotfix/HF-001-login-crash` |
- **Không có Task ID thì không tạo branch** (trừ `hotfix/` theo lệnh Nguyen, và phải bổ sung task vào `TASK.md` ngay trong PR đó).
- **1 branch = 1 task = 1 PR.** Branch sống ngắn (hướng tới ≤ 3 ngày), xong việc thì xoá sau khi merge, **không tái sử dụng** branch cũ cho task khác, không gộp 2 task vào 1 branch.
- Đồng bộ `main` vào branch của mình **ít nhất 1 lần/ngày** khi branch còn sống, để conflict lộ sớm khi còn nhỏ.
- Cấm: force-push lên branch đã có PR đang được review (trừ khi reviewer đồng ý), đặt tên branch bằng tiếng Việt/có dấu/có khoảng trắng, dùng branch của agent khác để commit tiếp việc của mình.

### G.2. Git Worktree (khi nhiều agent chạy song song trên cùng 1 máy / cùng 1 repo)
*Phát sinh gần như chắc chắn vì 3 agents có thể làm 3 task cùng lúc. Nếu mỗi agent ở một máy/cloud riêng hoàn toàn thì mục này chỉ áp dụng phần "không dùng chung thư mục làm việc".*
- **Mỗi agent 1 worktree riêng, không bao giờ dùng chung 1 thư mục checkout.** Thư mục chuẩn:
  ```
  agency-saas/            ← worktree chính, Nguyen giữ / chỉ để xem & merge, không agent nào code trực tiếp ở đây
  agency-saas--be/        ← Muse
  agency-saas--fe/        ← Antigravity (OpenCode dùng khi được giao FE dự bị thì tạo agency-saas--fe2/ hoặc dùng lại sau khi Antigravity đã bàn giao — không dùng đồng thời)
  agency-saas--qa/        ← OpenCode
  ```
- **1 worktree chỉ checkout 1 branch tại 1 thời điểm**, và 1 branch không được checkout ở 2 worktree cùng lúc (git cũng sẽ chặn, nhưng agent không được tìm cách lách bằng `--force`).
- Trước khi tạo worktree: chạy `git worktree list` để kiểm tra cái nào đang tồn tại, ai đang dùng. Tạo mới bằng `git worktree add ../agency-saas--<role> <branch>`.
- **Tài nguyên riêng theo worktree để không giẫm nhau khi chạy thử:** mỗi worktree có `.env.local` riêng (không commit), port riêng và database riêng theo hậu tố vai trò — vd BE: API `8001` / DB `agency_be`; FE: `5173`; QA: DB test `agency_test`. Chỉ worktree BE được chạy migration lên DB dev dùng chung; QA chỉ chạy migration lên DB test của mình.
- Không agent nào được sửa file trong worktree của agent khác, kể cả "sửa giúp một dòng".
- **Dọn dẹp:** PR merge xong → `git worktree remove <path>` + xoá branch. Trước khi remove phải kiểm tra worktree đó không còn thay đổi chưa commit (`git -C <path> status` sạch) — còn thay đổi thì báo Nguyen, không remove cưỡng bức (`--force`) khi chưa được duyệt.

### G.3. Pull Request & Review thật (đã chốt)
- **Tiêu đề PR:** `[<TASK-ID>] <type>(<scope>): <mô tả ngắn>` — vd `[BE-001] feat(auth): add login API`.
- **Mô tả PR bắt buộc có đủ:** link/mã task ở `TASK.md` · tóm tắt thay đổi · **ảnh hưởng tới contract (có/không, mục nào)** · cách test đã làm + kết quả · ảnh chụp màn hình nếu là FE · checklist Definition of Done (B.7).
- **Ai review ai (cứng, theo nguyên tắc không tự nghiệm thu):**
  | PR của | Reviewer chính | Người merge |
  |---|---|---|
  | Muse (Backend) | OpenCode | OpenCode sau khi Approve (trừ PR thuộc L4/L5 → Nguyen merge) |
  | Antigravity (Frontend) | OpenCode | OpenCode sau khi Approve |
  | OpenCode (Frontend dự bị) | **Muse** | Muse sau khi Approve |
  | OpenCode (QA/test) | Muse | Muse sau khi Approve |
  | Muse (Frontend do phá lệ) | OpenCode | OpenCode sau khi Approve |
  | Tài liệu / quy ước / release MAJOR | Nguyen | Nguyen |
- Reviewer góp ý bằng **comment/suggestion trên PR, không tự commit vào branch của tác giả**. Tác giả tự sửa theo góp ý rồi đẩy commit mới. (Ngoại lệ duy nhất: Nguyen can thiệp trực tiếp.)
- Điều kiện merge: ≥ 1 Approve của reviewer chính + mọi conversation đã resolved + các kiểm tra tự động (nếu có CI) PASS + `TASK.md`/`CHANGELOG.md` đã cập nhật. Thiếu 1 điều kiện thì không merge.
- Merge theo **squash merge** để `main` gọn, 1 task = 1 commit trên `main`; xoá branch ngay sau merge.
- PR bị chặn (chờ contract, chờ task khác) thì gắn nhãn/ghi rõ `BLOCKED` trong PR và trong `TASK.md` theo E.1, không để PR treo im lặng quá 1 đợt phân việc.

### G.4. Commit
- Format: `type(scope): mô tả` — `type` ∈ `feat | fix | refactor | test | docs | chore`. Vd: `feat(be-clients): add list clients API`.
- 1 commit = 1 ý đồ rõ ràng; không commit gộp việc của 2 task; không commit code đang chạy dở lên branch đã có PR trừ khi ghi rõ `wip:` và chưa xin review.

---

## H. CÁC RỦI RO KHÁC ĐÃ LƯỜNG TRƯỚC
1. **Contract bị trôi (drift):** phòng bằng mục E — contract chỉ có 1 nguồn chốt là Muse + Nguyen.
2. **File khoá dùng chung bị giẫm:** danh sách ở mục C — sửa phải có task riêng, mức L4.
3. **Migration trùng / bị sửa ngược:** chỉ Backend tạo migration, đánh số theo timestamp, migration đã chạy thì không sửa — chỉ tạo migration mới bù.
4. **Môi trường không đồng nhất:** chốt bảng version runtime + Docker (khi bắt đầu code) và 1 bộ seed data dùng chung cho cả 3 bên; QA test trên đúng seed đó.
5. **Làm trùng / làm thiếu:** cơ chế claim (B.4) + 1 tính năng chỉ có 1 Task ID duy nhất.
6. **Nguyen thành nút thắt:** thang 5 mức (mục D) là để giảm việc này — L1/L2 agents tự xử, chỉ L3 trở lên mới cần tới Nguyen, và L3 đã có Muse phụ trách soạn sẵn đề xuất để Nguyen chỉ cần duyệt/sửa.

---

## I. LUỒNG 1 TASK ĐI QUA HỆ THỐNG (chuẩn, gồm cả PR)
```
Nguyen + Muse phân task (L3) → ghi vào TASK.md (TODO, có Acceptance Criteria + Level)
  → Assignee claim (IN_PROGRESS), tạo branch đúng G.1 (trong worktree của mình nếu có, G.2)
  → Code → mở PR theo G.3 → reviewer review thật
      ├─ Request changes → Assignee sửa trên cùng branch → review lại
      └─ Approve → merge (squash) → xoá branch → Assignee ghi CHANGELOG [Unreleased]
  → OpenCode nghiệm thu trên main: PASS → DONE | FAIL → REOPEN + tạo task fix
  → Đủ 1 đợt release: OpenCode tạo branch release/, đóng CHANGELOG + bump VERSION.md
      (PATCH/MINOR tự quyết · MAJOR chờ Nguyen duyệt) → PR release → merge
```

---
**Việc còn mở (không thuộc tài liệu này):** chốt stack backend + scope MVP — vẫn đang chờ, chưa bắt đầu code theo đúng chỉ đạo của Nguyen.
