# PROMPT DI CHUYỂN DỰ ÁN TỪ TRELLIS CŨ SANG LEAN TRELLIS WORKFLOW

> **Cách dùng:** Copy toàn bộ nội dung prompt bên dưới và dán vào cửa sổ chat với AI Agent (trong Claude Code, Cursor, Codex hoặc bất kỳ AI Assistant nào) ngay tại thư mục gốc của dự án cần migrate.

---

```markdown
Bạn là một kỹ sư phần mềm cao cấp và là chuyên gia về Lean Trellis Workflow. 
Nhiệm vụ của bạn là thực hiện di chuyển toàn diện và an toàn dự án hiện tại từ Trellis cũ (Trellis 1.0) sang **Lean Trellis Workflow (All-in-One)**.

Hãy thực hiện tuần tự và cẩn trọng theo các giai đoạn sau:

---

### GIAI ĐOẠN 1: CÀI ĐẶT & KHỞI TẠO HỆ THỐNG
1. Chạy lệnh cài đặt toàn cục công cụ Lean Trellis:
   `npm i -g baobinhday/lean-trellis-workflow`
2. Chạy lệnh khởi tạo Lean Trellis vào dự án:
   `lean-trellis init`
3. Dọn dẹp triệt để các cấu hình Sub-agent, Rule và Command cũ của Trellis 1.0 trên TẤT CẢ các CLI/IDE (loại bỏ tràn token và xung đột hành vi):
   - **Claude Code:** Xóa `.claude/commands/trellis*`, `.claude/agents/trellis*`, `.claude/commands/mini-trellis*`.
   - **Cursor:** Xóa `.cursor/rules/*trellis*`, `.cursor/commands/*trellis*`.
   - **OpenCode:** Xóa `.opencode/commands/*trellis*`, `.opencode/plugins/*trellis*`, `.opencode/commands/mini-trellis*`, `.opencode/plugins/mini-trellis*`.
   - **Codex:** Xóa `.codex/hooks/*trellis*` (nếu có file hook riêng của trellis cũ).
   - **Cline / Roo Code / Windsurf:** Xóa các file rules cũ liên quan đến trellis trong `.clinerules/` hoặc `.windsurfrules`.
   - **Dọn dẹp manifest cũ:** Xóa `.trellis/.mini-trellis-manifest.json` (nếu có).
   *(Gợi ý lệnh dọn sạch một lần: `rm -rf .claude/commands/*trellis* .claude/agents/*trellis* .cursor/rules/*trellis* .cursor/commands/*trellis* .opencode/commands/*trellis* .opencode/plugins/*trellis* .trellis/.mini-trellis-manifest.json 2>/dev/null || true`)*
4. Kiểm tra file `AGENTS.md`: Đảm bảo block `<!-- TRELLIS:START -->` và `<!-- LEAN_TRELLIS_WORKFLOW:START -->` đã được cập nhật chuẩn xác.

---

### GIAI ĐOẠN 2: DI CHUYỂN & CHUẨN HÓA CÁC TASK CŨ (CẢ ĐÃ XONG VÀ ĐANG LÀM)
Trellis 1.0 lưu task phân mảnh ở `.trellis/tasks/<task-slug>/` kèm file `task.json`.
Lean Trellis lưu trữ tập trung tại `.trellis/research/<slug>/` với bộ 3 file: `prd.md`, `design.md`, `implement.md` (không còn dùng `task.json`).

Hãy quét toàn bộ thư mục `.trellis/tasks/` (nếu tồn tại) và di chuyển từng task theo quy tắc:

1. **Xác định thông tin task:**
   - Đọc `task.json` (nếu có) để lấy tiêu đề (`title`), trạng thái (`status`: `completed`, `in-progress`, `pending`, `draft`, v.v.).
   - Tạo thư mục đích: `.trellis/research/<slug>/`.

2. **Chuẩn hóa `prd.md`:**
   - Di chuyển hoặc copy `prd.md` sang `.trellis/research/<slug>/prd.md`.
   - Chuẩn hóa Header:
     - Nếu task đã xong: `**Status:** Completed`
     - Nếu task đang làm: `**Status:** Approved`
     - Nếu task đang lên kế hoạch: `**Status:** Draft`
   - Đảm bảo có liên kết Topic Path: `**Topic Path:** .trellis/research/<slug>/`.

3. **Chuẩn hóa `design.md`:**
   - Nếu trong task cũ có `design.md` hoặc `tech-spec.md`: chuyển đổi thành `.trellis/research/<slug>/design.md`.
   - Cập nhật header: `**Status:** Completed` (nếu task đã xong) hoặc `**Status:** Approved` / `Draft`.

4. **Chuẩn hóa `implement.md`:**
   - Nếu trong task cũ có `implement.md`, `plan.md` hoặc `checklist.md`: hợp nhất thành `.trellis/research/<slug>/implement.md`.
   - Header Status:
     - Nếu task đã xong: `**Status:** Completed`
     - Nếu task đang làm dở: `**Status:** In Progress`
     - Nếu task chưa làm: `**Status:** Planning`
   - Format Checklist: Toàn bộ công việc thực thi phải nằm ở **Section 1: Ordered Implementation Checklist**:
     - Các việc đã hoàn thành: đánh dấu `- [x]`.
     - Các việc chưa xong/đang làm dở: giữ nguyên `- [ ]`.
     - Lưu ý: Phần Risk Watchlist bên dưới tuyệt đối không dùng checkbox `- [ ]`, chỉ dùng gạch đầu dòng `-` để tránh gây sai lệch đếm tiến độ Kanban.

5. **Lưu trữ / Dọn dẹp:**
   - Sau khi migrate đầy đủ nội dung từ `.trellis/tasks/<slug>/` sang `.trellis/research/<slug>/`, hãy đổi tên thư mục cũ thành `.trellis/tasks.archived/` để tránh xung đột nhưng vẫn giữ lại làm dữ liệu dự phòng.

---

### GIAI ĐOẠN 3: KIỂM TRA MÔI TRƯỜNG & BÁO CÁO KẾT QUẢ
1. Chạy lệnh chẩn đoán hệ thống:
   `lean-trellis doctor`
2. Xuất báo cáo ngắn gọn cho tôi:
   - Danh sách các task đã migrate từ `.trellis/tasks/` sang `.trellis/research/` (kèm trạng thái: Completed / In Progress / Planning).
   - Tỷ lệ hoàn thành (% checklist `- [x]`) của từng task đang làm dở.
   - Kết quả kiểm tra của `lean-trellis doctor`.
```
