# PRD: Scoped Code Graph Engine & CLI Reader (`lean-trellis graph`)

**Status:** Completed
<!-- Lifecycle: Draft -> In Review -> Approved -> Completed -->
**Topic Path:** `.trellis/research/scoped-code-graph/`  
**Date:** 2026-11-12  

---

## 1. Goal & Context
- **Problem Statement:**
  Trong giai đoạn `Repository Evidence First` (khi lập PRD, `design.md`, hoặc chạy `Bootstrap specs`), AI agent hiện phải dùng nhiều lượt `grep`, `glob`, và `read_file` lặp lại để tìm định nghĩa symbol, luồng gọi hàm, và vùng ảnh hưởng (Blast Radius). Việc này gây tốn token, dễ bỏ sót caller/consumer gián tiếp, và không tận dụng được cấu trúc AST hay lịch sử đồng biến của dự án.
  Trong khi đó, người dùng không muốn cài thêm công cụ ngoài (`colbymchenry/codegraph` hay `ishanjainn/superopen` CLI `so`) vốn gây nặng môi trường hoặc xung đột hooks/session với `lean-trellis-workflow`.
- **User Outcome & Value:**
  - `lean-trellis-workflow` giữ nguyên kiến trúc **0 runtime npm dependencies**, 0 daemon nền, 100% tương thích `install.sh` và Windows/macOS/Linux.
  - Tham khảo triết lý **Scoped Subgraph + Session/History-weighted Edges** của `superopen`: AI chỉ cần gọi 1 lệnh CLI (`lean-trellis graph explore` hoặc `lean-trellis graph summary`) để nhận đúng tiểu đồ thị 1–2 hop quanh mục tiêu (định nghĩa + callers + callees + co-change weights) nằm gọn trong ngân sách token.
  - Tích hợp lỏng (loose coupling) với `trellis-card` (task song song `ast-scoped-code-graph` bên repo `trellis-card`): khi `trellis-card` xuất cache AST Rust `tree-sitter` tại `.trellis/.runtime/codegraph.json`, `lean-trellis graph` đọc trực tiếp; khi không có `trellis-card`, `lean-trellis` vẫn hoạt động bình thường 100%.

---

## 2. Repository Evidence & Current State
- **Zero-Dependency CLI & Package ([`package.json#L24`](file:///home/b560/Project/test/lean-trellis-workflow/package.json#L24), [`bin/cli.js`](file:///home/b560/Project/test/lean-trellis-workflow/bin/cli.js)):** `"dependencies": {}` — toàn bộ CLI (`init`, `upgrade`, `doctor`, `mem`) chạy bằng Node.js built-in modules.
- **Native Memory Engine ([`lib/memory.js`](file:///home/b560/Project/test/lean-trellis-workflow/lib/memory.js)):** Đã có pattern `resolveProjectRoot`, `EXCLUDED_DIRS`, token-budget truncation (`--max-chars`), và `--json` output để AI agent gọi trực tiếp qua CLI.
- **Gitignore Runtime Boundary ([`templates/trellis/gitignore.txt#L8`](file:///home/b560/Project/test/lean-trellis-workflow/templates/trellis/gitignore.txt#L8)):** Thư mục `.trellis/.runtime/` đã được gitignore mặc định trên mọi repo cài Lean Trellis, không làm bẩn `git status --porcelain`.
- **Architecture Contract ([`.trellis/spec/architecture.md#L5-L18`](file:///home/b560/Project/test/lean-trellis-workflow/.trellis/spec/architecture.md#L5-L18)):** Quy định rõ *"No `task.json`, no runtime database daemons"* và giữ context khởi đầu nhẹ (~4.9k ký tự, [`templates/trellis/hooks/session-start.py#L73`](file:///home/b560/Project/test/lean-trellis-workflow/templates/trellis/hooks/session-start.py#L73) đặt `MAX_CONTEXT_CHARS = 4000`).
- **Discovery Workflow ([`skills/lean-trellis-workflow/SKILL.md#L28-L32`](file:///home/b560/Project/test/lean-trellis-workflow/skills/lean-trellis-workflow/SKILL.md#L28-L32), [`references/01-brainstorming.md#L7-L13`](file:///home/b560/Project/test/lean-trellis-workflow/skills/lean-trellis-workflow/references/01-brainstorming.md#L7-L13), [`bootstrap-codebase-specs.md#L13-L23`](file:///home/b560/Project/test/lean-trellis-workflow/skills/lean-trellis-update-spec/references/bootstrap-codebase-specs.md#L13-L23)):** Hiện yêu cầu khảo sát codebase trước khi hỏi user nhưng chưa có công cụ graph để lấy nhanh Blast Radius.

---

## 3. Requirements

### 3.1. Functional Requirements
- **REQ-1 (Shared Cache Contract `.trellis/.runtime/codegraph.json`):**
  - Chuẩn hóa schema JSON cho cache đồ thị dùng chung giữa `trellis-card` (Producer AST `tree-sitter`) và `lean-trellis` (Reader/Fallback), bao gồm: `version`, `generatedAt`, `gitHead`, `generator`, `files`, `symbols`, và `edges` (`imports`, `calls`, `co_change`, `task_link` kèm `weight`).
- **REQ-2 (Scoped Subgraph Query CLI — `lean-trellis graph explore`):**
  - Hỗ trợ `lean-trellis graph explore "<symbol-or-file>" [--hops 1|2] [--max-chars N] [--json]`.
  - Trả về đúng **scoped subgraph** (theo mô hình `superopen`):
    1. Vị trí định nghĩa symbol/file kèm trích đoạn code đọc trực tiếp từ đĩa (`startLine..endLine`).
    2. Callers / Importers (ai phụ thuộc vào mục tiêu) và Callees / Imports (mục tiêu phụ thuộc vào đâu).
    3. Co-change / Task-linked neighbors sắp xếp giảm dần theo `weight` (giúp phát hiện liên kết xuyên ngôn ngữ như Frontend IPC ➔ Backend).
- **REQ-3 (Architecture Summary CLI — `lean-trellis graph summary`):**
  - Hỗ trợ `lean-trellis graph summary [--limit N] [--json]` phục vụ `Bootstrap specs` và đầu Phase 1: liệt kê top Hub files (fan-in cao), module clusters, entry points, và các cặp file co-change mạnh nhất.
- **REQ-4 (Staleness Detection & Standalone Safety):**
  - Tự động đối chiếu `gitHead` và `mtimeMs` của file nguồn so với `generatedAt` trong `.trellis/.runtime/codegraph.json`. Nếu phát hiện file đã sửa sau lần index cuối, in danh sách file stale ở đầu output để AI biết cần `read_file`/`grep` bổ sung đúng các file đó.
  - Nếu `.trellis/.runtime/codegraph.json` chưa tồn tại, CLI trả về thông báo/exit rõ ràng (hoặc chạy fallback nhẹ tùy quyết định ở Mục 6) mà không làm gãy workflow Lean Trellis.
- **REQ-5 (`doctor` & Skill Integration):**
  - Cập nhật `doctor()` trong `lib/installer.js` hiển thị trạng thái optional của `CodeGraph Cache` (`Fresh`, `Stale`, hoặc `Not indexed (optional)` — không báo lỗi đỏ).
  - Cập nhật `skills/lean-trellis-workflow/` và `skills/lean-trellis-update-spec/` hướng dẫn AI ưu tiên chạy `lean-trellis graph` (nếu có cache) ở bước `Repository Evidence First` và `Bootstrap specs`, vẫn giữ `session-start.py` gọn nhẹ không phình prompt.

### 3.2. Non-Functional Requirements
- **Zero External Dependencies:** Không thêm thư viện npm ngoài vào `package.json`; tương thích 100% với Node.js hiện tại và `install.sh`.
- **Token Budget Control:** Mặc định cắt gọn output trong `--max-chars` (ví dụ `6000` ký tự) tương tự `lib/memory.js`, ưu tiên cạnh có `weight` cao trước.
- **Backward Compatibility:** Các dự án không dùng `trellis-card` hoặc chưa có graph cache hoạt động không đổi.

---

## 4. Scope Boundaries

### In-Scope
- Định nghĩa contract `.trellis/.runtime/codegraph.json` trong `.trellis/spec/architecture.md` (hoặc spec riêng).
- Tạo module `lib/graph.js` và nối subcommand `graph` trong `bin/cli.js`.
- Cập nhật `doctor()` trong `lib/installer.js`.
- Cập nhật skill docs (`SKILL.md`, `01-brainstorming.md`, `bootstrap-codebase-specs.md`) và template markdown để tách biệt target files khỏi `Out-of-Scope`.
- Viết unit test bằng `node:test` cho parser/query scoped subgraph, stale detection, và token budget.

### ❌ Out-of-Scope
- Không nhúng `web-tree-sitter`, `tree-sitter-wasms`, `sqlite`, hay MCP daemon vào `lean-trellis-workflow`.
- Không cài đặt hay gọi CLI của `colbymchenry/codegraph` hoặc `ishanjainn/superopen`.
- Không thêm OpenTelemetry hay ghi đè hooks của agent bên ngoài `.trellis/`.

---

## 5. Acceptance Criteria
- [x] **AC-1:** `package.json` giữ nguyên `"dependencies": {}` và `bash install.sh` không phát sinh bước cài npm ngoài.
- [x] **AC-2:** Với fixture `.trellis/.runtime/codegraph.json` hợp lệ, `lean-trellis graph explore "<symbol>"` trả về định nghĩa + snippet + callers/callees + weighted co-change neighbors trong 1 lần gọi, tôn trọng `--hops` và `--max-chars`.
- [x] **AC-3:** Khi một file nguồn có `mtimeMs` mới hơn `generatedAt` trong cache, `lean-trellis graph explore` cảnh báo chính xác file bị stale.
- [x] **AC-4:** `lean-trellis doctor` báo trạng thái `CodeGraph Cache` chính xác ở cả 3 trường hợp (`Fresh`, `Stale`, `Not indexed (optional)`) mà không đánh dấu WARN/FAIL cho dự án chưa bật graph.
- [x] **AC-5:** Bộ test `node --test` cho `lib/graph.js` và `bin/cli.js` pass 100%.

---

## 6. Key Decisions & User Consensus
| Date | Question / Decision Needed | Chosen Resolution | Rationale |
| :--- | :--- | :--- | :--- |
| 2026-11-12 | Nguồn tạo AST graph chính | `trellis-card` (Rust native `tree-sitter` + git/task co-change) xuất sang `.trellis/.runtime/codegraph.json` | Giữ `lean-trellis-workflow` 0 dependency, tránh cài `codegraph`/`superopen` ngoài. |
| 2026-11-12 | Hành vi khi chưa có `.trellis/.runtime/codegraph.json` | **Reader-only + Fallback về `grep`/`read_file`:** Chỉ đọc cache từ `trellis-card`, không tự parse lại bằng JS | Giữ `lean-trellis` siêu nhẹ (`0` deps), tránh duy trì song song 2 parser Rust & JS dễ lệch kết quả. |
