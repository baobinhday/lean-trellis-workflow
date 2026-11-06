# Lean Trellis Workflow (All-in-One)

> **Bộ công cụ phát triển tính năng lớn & Tầng bộ nhớ trọn gói cho AI Coding Assistants.**  
> **Cài đặt 1 bước duy nhất (All-in-One) · Trải nghiệm 100% qua Chat tự nhiên.**  
> 
> **Kiến trúc kiềng ba chân (The Triad Architecture):**  
> 1. 🏗️ **Quy trình Trellis:** Vòng đời tính năng lớn bài bản (PRD ➔ Technical Design ➔ Implementation Checklist ➔ Verification).  
> 2. ⚡ **Kiến trúc mini-trellis:** Tầng bộ nhớ tinh gọn (Spec, Research, Journal, `mem recall`), loại bỏ hoàn toàn sub-agent gây tốn token.  
> 3. 🧠 **Kỷ luật DeepSeek (`write-notes-like-deepseek`):** Tư duy tri thức phủ định (Negative Knowledge / Rejected paths), phân tách rạch ròi Fact vs. Hypothesis, nguyên tắc Evidence-First và chống thối rữa ngữ cảnh (Anti-Context Rot).

---

## 1. Trải nghiệm hội thoại: Bạn chỉ cần Chat, AI tự làm hết!

Sau khi cài đặt, **bạn KHÔNG CẦN phải mở terminal gõ lệnh bash hay chạy tool nào khác**. Mọi thao tác lập PRD, thiết kế kỹ thuật, viết code, kiểm thử và nghiệm thu đều được điều khiển bằng ngôn ngữ tự nhiên:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BA LỆNH CHAT CHÍNH                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. LẬP KẾ HOẠCH:   "Tạo task <tên>", "Lập kế hoạch <tên>", hoặc "/plan <tên>"          │
│    ➔ AI TỰ ĐỘNG tạo thư mục .trellis/research/<slug>/, sinh prd.md, design.md, implement│
│    ➔ AI TỰ ĐỘNG khảo sát code trước, rồi hỏi phỏng vấn bạn 1 câu quan trọng nhất.      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. TRIỂN KHAI:     "Implement task <tên>", "Triển khai task <tên>"                     │
│    ➔ AI TỰ ĐỘNG đọc implement.md, thông báo bước làm, viết code trực tiếp, test & tick  │
│    ➔ Bạn can thiệp, phản hồi và góp ý trực tiếp ngay trong hội thoại hiện tại.         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. NGHIỆM THU:     "Check task <tên>", "Nghiệm thu task <tên>", "Hoàn thành task"      │
│    ➔ AI TỰ ĐỘNG đối chiếu Acceptance Criteria trong prd.md, chạy full test suite       │
│    ➔ AI TỰ ĐỘNG cập nhật spec và ghi nhật ký hoàn tất qua add_session.py.             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Bản đồ & Vai trò của các Skill trọn gói

Gói `lean-trellis-workflow` đóng gói sẵn **toàn bộ 4 kỹ năng cốt lõi**, bạn không cần cài thêm `mini-trellis` riêng lẻ:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TẦNG ĐIỀU PHỐI QUY TRÌNH                        │
│                   skill: lean-trellis-workflow                         │
│  • Quản lý vòng đời tính năng lớn: PRD ➔ Design ➔ Checklist ➔ Verify  │
│  • Tự động tạo file quy hoạch, bẻ nhỏ công việc thành checklist        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
【TẦNG LƯU TRỮ & HỒI TƯỞNG】                         【TẦNG QUY ƯỚC BỀN VỮNG】
 (Tích hợp sẵn trong gói)                           (Tích hợp sẵn trong gói)
 ------------------------------------               ------------------------------------
 • lean-trellis-session-insight:                    • lean-trellis-update-spec:
   Tra cứu chat cũ & docs qua `mem recall`            Ghi quy ước bền vững vào `.trellis/spec/`
 • lean-trellis-remember:                           
   Ghi nhật ký hoàn thành vào `.trellis/workspace/`   
```

### Chi tiết 4 Skill có sẵn:

| Tên Skill | Vị trí cài đặt | Vai trò chính | Khi nào kích hoạt? |
| :--- | :--- | :--- | :--- |
| **`lean-trellis-workflow`** | `.agent/skills/`<br>`.agents/skills/`<br>`.claude/skills/`<br>`.cursor/skills/` | **Nhạc trưởng quy trình**: Tự động tạo thư mục, lập `prd.md`, thiết kế `design.md`, lập checklist `implement.md` và nghiệm thu trực tiếp. | Khi chat: "Tạo task...", "Implement task...", "Check task..." hoặc `/plan`. |
| **`lean-trellis-remember`** | Đã đóng gói sẵn | **Thư ký ghi chép**: Lưu các quyết định đã chốt, hướng tiếp cận bị từ chối vào nhật ký developer (`.trellis/workspace/`). | Khi xong một feature hoặc kết thúc phiên làm việc có quyết định quan trọng. |
| **`lean-trellis-update-spec`** | Đã đóng gói sẵn | **Người gác cổng quy ước**: Cập nhật các ranh giới kiến trúc và hợp đồng bền vững vào `.trellis/spec/`. | Khi kiến trúc hệ thống, API contract hoặc quy tắc code thay đổi lâu dài. |
| **`lean-trellis-session-insight`** | Đã đóng gói sẵn | **Thám tử tìm kiếm**: Dùng CLI `lean-trellis mem recall` (hoặc `lean-trellis recall`) để bới tìm cách giải quyết trong tài liệu và lịch sử chat cũ. | Trước khi code, khi cần kiểm tra xem "vấn đề này trước đây giải quyết ra sao". |

---

## 3. Cài đặt 1 Bước duy nhất (All-in-One Installation)

**Không cần chạy `mini-trellis init` riêng.** Bạn có thể chọn 1 trong các cách sau:

### Cách 1: Cài đặt toàn cục qua NPM (Khuyến nghị)
Sau khi cài đặt toàn cục, lệnh `lean-trellis` có thể dùng ở bất kỳ dự án nào:

```bash
# Cài đặt trực tiếp từ GitHub repository:
npm install -g baobinhday/lean-trellis-workflow

# (Hoặc cài đặt từ thư mục mã nguồn cục bộ):
# npm install -g /path/to/lean-trellis-workflow

# Khởi tạo dự án hiện tại:
lean-trellis init

# Hoặc chỉ định đường dẫn và tên developer:
lean-trellis init /home/user/my-project -u alice

# Kiểm tra sức khỏe môi trường dự án:
lean-trellis doctor
```

> 💡 **Mẹo (Không cần cài đặt trước):** Bạn cũng có thể dùng `npx` để khởi tạo tức thì từ GitHub:
> ```bash
> npx -y github:baobinhday/lean-trellis-workflow init
> ```

---

### Cách 2: Chạy trực tiếp qua Bash Script
Nếu bạn không muốn cài npm global:

```bash
# Cài đặt vào dự án hiện tại:
bash /path/to/lean-trellis-workflow/install.sh .

# Hoặc chỉ định đường dẫn và tên developer:
bash /path/to/lean-trellis-workflow/install.sh /home/user/my-project alice
```

### Những gì script tự động thiết lập:
1. **Khởi tạo tầng bộ nhớ `.trellis/`**:
   - `.trellis/config.yaml` & `.trellis/.gitignore`.
   - `.trellis/scripts/` (chứa `add_session.py`, `get_context.py`, thư viện `common/`).
   - `.trellis/spec/guides/` (chứa hướng dẫn viết spec chuẩn).
   - `.trellis/research/` (chứa topic inbox).
   - `.trellis/workspace/<dev>/` (nhật ký và chỉ mục phiên của bạn).
2. **Cài đặt SessionStart Hooks nhẹ nhàng**:
   - Claude Code (`.claude/hooks/session-start.py` & `.claude/settings.json`).
   - Cursor (`.cursor/hooks/session-start.py` & `.cursor/hooks.json`).
   - Codex (`.codex/hooks/session-start.py`, `.codex/hooks.json` & `config.toml`).
   - OpenCode (`.opencode/`).
3. **Cài đặt trọn bộ 4 Skills** vào tất cả các nền tảng agent active trong dự án.
4. **Cập nhật `AGENTS.md`**: Ghi rõ chỉ dẫn nhận lệnh bằng Chat tự nhiên.

---

## 4. Hai kịch bản thực chiến (Real-World Scenarios)

Dựa trên thực tiễn áp dụng từ Trellis ([docs.trytrellis.app/start/real-world-scenarios](https://docs.trytrellis.app/start/real-world-scenarios)), dưới đây là 2 kịch bản phổ biến nhất:

---

### Kịch bản 1: Dự án mới (Greenfield) ➔ Thêm tính năng đầu tiên qua Chat

> **Bối cảnh:** Bạn vừa tạo repository ứng dụng `task-manager`. Bạn muốn làm tính năng lớn đầu tiên: **Hệ thống xác thực người dùng (Auth System)**.

#### 1. Khởi tạo ban đầu (1 lệnh duy nhất):
```bash
mkdir task-manager && cd task-manager && git init
lean-trellis init
# Hoặc nếu chưa cài npm global: bash /path/to/lean-trellis-workflow/install.sh .
```
*(Xong! Dự án đã có đủ `.trellis/`, hooks, và 4 skills. Đóng terminal và mở IDE lên chat!)*

#### 2. Chat với AI từ đầu đến cuối:

##### Lượt 1: Tạo Task & Lập PRD
> **Bạn:** *"Tạo task user-auth: Xây dựng hệ thống xác thực người dùng bằng JWT."*  
> **AI:** 
> - Tự động tạo thư mục `.trellis/research/user-auth/` và sinh các tệp `prd.md`, `design.md`, `implement.md`.
> - Tự đọc các tệp hiện tại trong repo.
> - Phỏng vấn bạn đúng 1 câu giá trị nhất:  
>   *"Để chốt kiến trúc bảo mật cho `user-auth`, bạn muốn lưu Refresh Token ở đâu?*  
>   *➡️ Khuyến nghị: Dùng HttpOnly Secure Cookie để chống tấn công XSS.*  
>   *⚠️ Đánh đổi: Nếu lưu ở LocalStorage, code frontend dễ làm hơn nhưng có nguy cơ rò rỉ token."*

##### Lượt 2: Chốt PRD & Thiết kế
> **Bạn:** *"Duyệt dùng HttpOnly Cookie. Hoàn thiện PRD và viết design.md giúp tôi."*  
> **AI:**
> - Cập nhật `prd.md` với đầy đủ In-Scope, Out-of-Scope và Acceptance Criteria.
> - Soạn thảo `design.md` (Schema bảng User, băm mật khẩu Argon2id, phân tích phương án thay thế trong `Alternatives considered`).
> - Bẻ nhỏ kế hoạch vào `implement.md` thành 4 subtask có checkbox `[ ]`.

##### Lượt 3: Triển khai trực tiếp
> **Bạn:** *"Implement task user-auth."*  
> **AI:**
> - Bắt đầu thực thi trực tiếp trong chat chính:
>   - Tạo Prisma schema & migration.
>   - Viết hàm hash mật khẩu & unit test (Pass).
>   - Viết controller login/register & integration test (Pass).
>   - Đánh dấu `[x]` vào `implement.md` sau mỗi bước.
> - Báo cáo: *"Đã hoàn thành 4/4 tasks trong checklist. Mọi unit test đều pass."*

##### Lượt 4: Nghiệm thu & Chốt task
> **Bạn:** *"Check task user-auth."*  
> **AI:**
> - Chạy kiểm tra toàn bộ Acceptance Criteria trong `prd.md`.
> - Chạy full test suite dự án (`npm test`).
> - Tự động cập nhật `.trellis/spec/backend/auth.md`.
> - Tự động gọi `add_session.py` ghi nhận nhật ký hoàn tất. Báo cáo nghiệm thu hoàn tất!

---

### Kịch bản 2: Thêm Workflow vào Dự án cũ đang chạy (Brownfield)

> **Bối cảnh:** Bạn có dự án backend NodeJS 20,000 dòng code đang chạy trên production. Bạn cần làm tính năng lớn: **Chuyển đổi toàn bộ việc gọi REST API bên thứ 3 sang cơ chế Retry tự động với Exponential Backoff**.

#### 1. Cài đặt vào repo cũ (1 lệnh duy nhất):
```bash
cd /path/to/legacy-backend
lean-trellis init
# Hoặc nếu chưa cài npm global: bash /path/to/lean-trellis-workflow/install.sh .
```

#### 2. Chat với AI:

##### Lượt 1: Đảo ngược phân tích để lập Spec (Reverse-Engineering Specs)
Vì dự án cũ không có tài liệu, AI mới vào rất dễ phá vỡ "luật ngầm". Bạn bảo:
> **Bạn:** *"Dự án này là backend legacy. Hãy khảo sát codebase hiện tại và tạo cho tôi các file spec trong `.trellis/spec/` mô tả: cách dự án đang gọi API bên thứ 3, cấu trúc service layer và quy ước test hiện hữu."*  
> **AI:** Quét toàn bộ repo, tạo `.trellis/spec/external-api/conventions.md` lưu lại các quy ước ngầm hiện có.

##### Lượt 2: Tạo Task Refactor
> **Bạn:** *"Tạo task api-retry-backoff: Thêm cơ chế tự động thử lại khi gọi API đối tác thất bại."*  
> **AI:**
> - Tự động tạo `.trellis/research/api-retry-backoff/`.
> - **Nguyên tắc Evidence First:** Tự động quét toàn bộ codebase, thống kê ra 12 file service đang gọi HTTP mà **không hỏi bạn những điều code đã thể hiện rõ**.
> - Xác định vùng ảnh hưởng (Blast Radius) trong `design.md`: Chỉ áp dụng retry cho Idempotent requests (GET, PUT), tuyệt đối không retry POST thanh toán.
> - Lập danh sách checklist trong `implement.md`.

##### Lượt 3: Triển khai & Kiểm thử hồi quy
> **Bạn:** *"Implement task api-retry-backoff."*  
> **AI:**
> - Tạo wrapper client với Retry logic và backoff exponential.
> - Viết unit test mock lỗi mạng 503, 429.
> - Chuyển đổi từng service một cách an toàn, chạy test hồi quy để đảm bảo code cũ không bị gãy.

##### Lượt 4: Nghiệm thu & Lưu nhớ
> **Bạn:** *"Check task api-retry-backoff."*  
> **AI:**
> - Chạy kiểm thử: 100% test cũ pass + các test case retry mới pass.
> - Cập nhật quy tắc retry vào `.trellis/spec/external-api/conventions.md`.
> - Ghi nhật ký session. Từ nay về sau, mọi AI làm việc trong repo đều biết rõ quy tắc này.

---

## 5. Hướng dẫn Nâng cấp & Cập nhật (Upgrade Guide)

### 5.1. Cập nhật CLI toàn cục lên phiên bản mới nhất
Khi repository GitHub có cập nhật tính năng mới:
```bash
npm install -g baobinhday/lean-trellis-workflow
```

### 5.2. Cập nhật dự án đang sử dụng Lean Trellis
Khi đã cập nhật CLI, bạn có thể làm mới bộ kỹ năng và hooks trong dự án hiện tại:
```bash
cd /path/to/my-project
lean-trellis upgrade
# (hoặc: lean-trellis init)
```

> 🛡️ **Tính an toàn tuyệt đối (Non-Destructive Upgrade):**  
> Lệnh `upgrade` / `init` được thiết kế an toàn:
> - ✅ **Bảo toàn 100% dữ liệu dự án:** Tuyệt đối không ghi đè nhật ký developer (`.trellis/workspace/`), không đụng vào các topic đã có trong `.trellis/research/`, không xóa các file spec trong `.trellis/spec/`.
> - 🔄 **Cập nhật hệ thống:** Tự động đồng bộ 4 bộ skills mới nhất (`.agent/skills/`, `.claude/skills/`, `.cursor/skills/`, `.opencode/skills/`), SessionStart hooks và các template tài liệu.
> - 🩺 **Kiểm tra sau nâng cấp:** Chạy `lean-trellis doctor` để xác nhận mọi thành phần hoạt động trơn tru.

### 5.3. Di chuyển từ Trellis cũ (Trellis 1.0) sang Lean Trellis
Nếu bạn có một dự án đang dùng Trellis cũ (có sub-agents, tasks phân mảnh, forum channel):
```bash
cd /path/to/legacy-trellis-project

# Bước 1: Dọn sạch sub-agents cũ và gộp tasks về research
mini-trellis migrate -y

# Bước 2: Cài đặt Lean Trellis Workflow & Bộ nhớ
lean-trellis init

# Bước 3: Kiểm tra môi trường hoàn tất
lean-trellis doctor
```

---

## 6. So sánh tổng kết: Trellis cũ vs Lean Trellis Workflow

| Tiêu chí | Trellis cũ | Lean Trellis Workflow (All-in-One) |
| :--- | :--- | :--- |
| **Cài đặt** | Phải cài npm CLI, setup nhiều công cụ rời rạc | **1 bước duy nhất**: `bash install.sh .` |
| **Cách dùng** | Phải nhớ lệnh CLI của `task.py` | **100% qua Chat tự nhiên**: "Tạo task...", "Implement task...", "Check task..." |
| **Mô hình Agent** | Ép dùng Sub-agents (`trellis-implement`, `trellis-check`) | **In-Session Direct**: Làm trực tiếp trong chat chính, không đứt đoạn |
| **Áp dụng** | Bắt buộc cho mọi việc, ngay cả sửa 1 dòng code | **Theo nhu cầu**: Chỉ kích hoạt khi gặp tính năng lớn |
| **Độ ngốn Token** | Rất nặng (~37k+ ký tự context cho 10 lượt) | Cực nhẹ (~4.9k ký tự context, 0 per-turn injection) |
| **Tệp quy hoạch** | Rải rác trong `.trellis/tasks/<name>/` kèm `task.json` | Nằm gọn trong `.trellis/research/<slug>/` (`prd.md`, `design.md`, `implement.md`) |
| **Khả năng tra cứu** | Khó tìm kiếm xuyên các phiên chat cũ | Tích hợp sẵn `lean-trellis mem recall` |

---

## Giấy phép (License)
Phát hành theo giấy phép [MIT](LICENSE). Tự do sử dụng và tích hợp vào bất kỳ dự án phần mềm nào của bạn.
