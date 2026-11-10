#!/usr/bin/env bash
# install.sh - Cài đặt TOÀN DIỆN Lean Trellis Workflow (All-in-One: Bộ nhớ + Quy trình + Tùy chọn Agent & UIUX)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="."
DEV_NAME="$(git config user.name 2>/dev/null || whoami || echo "developer")"
SELECTED_AGENTS=""
WITH_UIUX=false

# Phân tích cờ lệnh & đối số vị trí
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      echo "Cách dùng: ./install.sh [thư_mục_đích] [tên_developer] [tùy_chọn]"
      echo ""
      echo "Tùy chọn:"
      echo "  -a, --agent <agents>   Chọn agents cài đặt: claude, cursor, antigravity, codex, opencode, windsurf, all"
      echo "                         (phân tách bằng dấu phẩy hoặc lặp lại cờ, mặc định: hỏi tương tác hoặc all)"
      echo "  --with-uiux, --uiux    Cài đặt thêm UIUX Orchestrator & Specialist Skills (Taste, Impeccable, Motion...)"
      echo "  -u, --user <name>      Tên định danh developer"
      echo "  -d, --dir <path>       Thư mục dự án đích"
      echo "  -h, --help             Hiển thị trợ giúp này"
      exit 0
      ;;
    -a|--agent)
      if [[ -z "$SELECTED_AGENTS" ]]; then
        SELECTED_AGENTS="$2"
      else
        SELECTED_AGENTS="$SELECTED_AGENTS,$2"
      fi
      shift 2
      ;;
    --with-uiux|--uiux)
      WITH_UIUX=true
      shift
      ;;
    -u|--user)
      DEV_NAME="$2"
      shift 2
      ;;
    -d|--dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    *)
      if [[ "$1" != -* ]]; then
        if [[ "$TARGET_DIR" == "." ]]; then
          TARGET_DIR="$1"
        else
          DEV_NAME="$1"
        fi
      fi
      shift
      ;;
  esac
done

# Chuẩn hóa tên developer không dấu/khoảng trắng
DEV_NAME="$(echo "$DEV_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

# Nếu chưa chọn agents qua cờ: hỏi tương tác nếu có terminal, hoặc chọn all nếu chạy nền
if [[ -z "$SELECTED_AGENTS" ]]; then
  if [ -t 0 ]; then
    echo "🤖 Chọn coding agents bạn đang sử dụng:"
    echo "  1) Tất cả (All: Claude, Cursor, Antigravity, Codex, OpenCode, Windsurf) [Mặc định]"
    echo "  2) Cursor (.cursor/)"
    echo "  3) Claude Code (.claude/)"
    echo "  4) Google Antigravity / Gemini CLI (.agent/)"
    echo "  5) Codex (.codex/ & .agents/)"
    echo "  6) Tùy chỉnh (ví dụ: cursor,claude hoặc cursor,antigravity)"
    read -rp "Nhập lựa chọn [1-6, Enter để chọn 1]: " agent_choice
    case "$agent_choice" in
      2) SELECTED_AGENTS="cursor" ;;
      3) SELECTED_AGENTS="claude" ;;
      4) SELECTED_AGENTS="antigravity" ;;
      5) SELECTED_AGENTS="codex" ;;
      6)
        read -rp "Nhập danh sách agents (cách nhau bởi dấu phẩy): " custom_agents
        SELECTED_AGENTS="${custom_agents:-all}"
        ;;
      *) SELECTED_AGENTS="all" ;;
    esac
  else
    SELECTED_AGENTS="all"
  fi
fi

# Chuẩn hóa agents thành chữ thường
SELECTED_AGENTS="$(echo "$SELECTED_AGENTS" | tr '[:upper:]' '[:lower:]')"

has_agent() {
  local agent="$1"
  if [[ "$SELECTED_AGENTS" == *"all"* ]] || [[ "$SELECTED_AGENTS" == *"$agent"* ]]; then
    return 0
  fi
  return 1
}

# Resolve target directory to absolute path
mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo "🚀 Bắt đầu cài đặt Lean Trellis Workflow vào:"
echo "   Dự án:     $TARGET_DIR"
echo "   Developer: $DEV_NAME"
echo "   Agents:    $SELECTED_AGENTS"
echo ""

TRELLIS_TEMPLATES="$SCRIPT_DIR/templates/trellis"
SKILLS_SRC="$SCRIPT_DIR/skills"

# Dọn dẹp các tệp/thư mục tàn dư cũ nếu có
rm -rf "$TARGET_DIR/.claude/commands/mini-trellis" \
       "$TARGET_DIR/.opencode/commands/mini-trellis" \
       "$TARGET_DIR/.opencode/plugins/mini-trellis" \
       "$TARGET_DIR/.trellis/.mini-trellis-manifest.json" 2>/dev/null || true

# ==============================================================================
# BƯỚC 1: KHỞI TẠO TẦNG BỘ NHỚ (.trellis/)
# ==============================================================================
echo "📦 1. Thiết lập tầng bộ nhớ (.trellis/)..."

mkdir -p "$TARGET_DIR/.trellis/scripts/common"
mkdir -p "$TARGET_DIR/.trellis/spec/guides"
mkdir -p "$TARGET_DIR/.trellis/research"
mkdir -p "$TARGET_DIR/.trellis/workspace/$DEV_NAME"

# Copy scripts & common libraries
cp -r "$TRELLIS_TEMPLATES/scripts/"* "$TARGET_DIR/.trellis/scripts/"
chmod +x "$TARGET_DIR/.trellis/scripts/"*.py 2>/dev/null || true

# Config & gitignore
if [ ! -f "$TARGET_DIR/.trellis/config.yaml" ]; then
  cp "$TRELLIS_TEMPLATES/config.yaml" "$TARGET_DIR/.trellis/config.yaml"
fi
if [ ! -f "$TARGET_DIR/.trellis/.gitignore" ]; then
  cp "$TRELLIS_TEMPLATES/gitignore.txt" "$TARGET_DIR/.trellis/.gitignore"
fi

# Spec guides & Research README
for guide_file in "$TRELLIS_TEMPLATES/spec/guides/"*; do
  if [ -f "$guide_file" ]; then
    guide_name="$(basename "$guide_file")"
    if [ "$guide_name" = "mini-memory.md" ] && [ -f "$TARGET_DIR/.trellis/spec/guides/lean-memory.md" ]; then
      continue
    fi
    if [ "$guide_name" = "index.md" ] || [ "$guide_name" = "lean-trellis-lifecycle.md" ] || [ ! -f "$TARGET_DIR/.trellis/spec/guides/$guide_name" ]; then
      cp "$guide_file" "$TARGET_DIR/.trellis/spec/guides/$guide_name"
    fi
  fi
done
if [ ! -f "$TARGET_DIR/.trellis/research/README.md" ]; then
  cp "$TRELLIS_TEMPLATES/research/README.md" "$TARGET_DIR/.trellis/research/README.md"
fi

# Developer workspace & identity
echo "$DEV_NAME" > "$TARGET_DIR/.trellis/.developer"
if [ ! -f "$TARGET_DIR/.trellis/workspace/$DEV_NAME/index.md" ]; then
  cat > "$TARGET_DIR/.trellis/workspace/$DEV_NAME/index.md" << EOF
# Developer Journal: $DEV_NAME

| Session | Date | Title | Commit | Branch |
|---|---|---|---|---|
<!-- @@@/auto:session-history -->
EOF
fi
if [ ! -f "$TARGET_DIR/.trellis/workspace/$DEV_NAME/journal-1.md" ]; then
  cat > "$TARGET_DIR/.trellis/workspace/$DEV_NAME/journal-1.md" << EOF
# Journal: $DEV_NAME (Part 1)

EOF
fi
echo "  ✓ Đã khởi tạo hoàn tất cấu trúc .trellis/"

# ==============================================================================
# BƯỚC 2: THIẾT LẬP HOOKS KHỞI ĐỘNG (THEO AGENTS ĐÃ CHỌN)
# ==============================================================================
echo "🔗 2. Thiết lập SessionStart Hooks..."
HOOK_FILE="$TRELLIS_TEMPLATES/hooks/session-start.py"
HOOKS_CONFIGURED=()

# Claude Code
if has_agent "claude"; then
  mkdir -p "$TARGET_DIR/.claude/hooks"
  cp "$HOOK_FILE" "$TARGET_DIR/.claude/hooks/session-start.py"
  if [ ! -f "$TARGET_DIR/.claude/settings.json" ]; then
    cat > "$TARGET_DIR/.claude/settings.json" << 'EOF'
{
  "env": {
    "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "1"
  },
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "python3 .claude/hooks/session-start.py", "timeout": 30 }]
      },
      {
        "matcher": "clear",
        "hooks": [{ "type": "command", "command": "python3 .claude/hooks/session-start.py", "timeout": 30 }]
      },
      {
        "matcher": "compact",
        "hooks": [{ "type": "command", "command": "python3 .claude/hooks/session-start.py", "timeout": 30 }]
      }
    ]
  }
}
EOF
  fi
  HOOKS_CONFIGURED+=("Claude Code")
fi

# Cursor
if has_agent "cursor"; then
  mkdir -p "$TARGET_DIR/.cursor/hooks"
  cp "$HOOK_FILE" "$TARGET_DIR/.cursor/hooks/session-start.py"
  if [ ! -f "$TARGET_DIR/.cursor/hooks.json" ]; then
    cat > "$TARGET_DIR/.cursor/hooks.json" << 'EOF'
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "command": "python3 .cursor/hooks/session-start.py" }]
  }
}
EOF
  fi
  HOOKS_CONFIGURED+=("Cursor")
fi

# Codex
if has_agent "codex"; then
  mkdir -p "$TARGET_DIR/.codex/hooks"
  cp "$HOOK_FILE" "$TARGET_DIR/.codex/hooks/session-start.py"
  if [ ! -f "$TARGET_DIR/.codex/hooks.json" ]; then
    cat > "$TARGET_DIR/.codex/hooks.json" << 'EOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": "python3 .codex/hooks/session-start.py", "timeout": 30 }]
      }
    ]
  }
}
EOF
  fi
  if [ ! -f "$TARGET_DIR/.codex/config.toml" ]; then
    cat > "$TARGET_DIR/.codex/config.toml" << 'EOF'
[hooks]
enabled = true
EOF
  fi
  HOOKS_CONFIGURED+=("Codex")
fi

if [ ${#HOOKS_CONFIGURED[@]} -gt 0 ]; then
  echo "  ✓ Đã thiết lập xong SessionStart hooks cho: $(IFS=, ; echo "${HOOKS_CONFIGURED[*]}")"
else
  echo "  ℹ️  Không có SessionStart hooks cần thiết cho agent đã chọn"
fi

# ==============================================================================
# BƯỚC 3: CÀI ĐẶT TRỌN BỘ SKILLS (THEO AGENTS ĐÃ CHỌN)
# ==============================================================================
echo "🧠 3. Cài đặt các kỹ năng (Skills)..."

install_all_skills_to() {
  local base_dir="$1"
  mkdir -p "$base_dir"
  # Dọn dẹp skill tàn dư cũ nếu có
  rm -rf "$base_dir"/mini-trellis-* 2>/dev/null || true
  for skill_dir in "$SKILLS_SRC"/*; do
    if [ -d "$skill_dir" ]; then
      local skill_name="$(basename "$skill_dir")"
      mkdir -p "$base_dir/$skill_name"
      cp -r "$skill_dir/"* "$base_dir/$skill_name/"
    fi
  done
  echo "  ✓ Đã nạp 4 skills vào: $base_dir"
}

if has_agent "antigravity"; then
  install_all_skills_to "$TARGET_DIR/.agent/skills"
fi
if has_agent "cursor"; then
  install_all_skills_to "$TARGET_DIR/.cursor/skills"
fi
if has_agent "claude"; then
  install_all_skills_to "$TARGET_DIR/.claude/skills"
fi
if has_agent "codex"; then
  install_all_skills_to "$TARGET_DIR/.agents/skills"
fi
if has_agent "opencode" || ([ -d "$TARGET_DIR/.opencode" ] && has_agent "all"); then
  install_all_skills_to "$TARGET_DIR/.opencode/skills"
fi
if has_agent "windsurf"; then
  install_all_skills_to "$TARGET_DIR/.windsurf/skills"
fi

# ==============================================================================
# BƯỚC 4: TIỆN ÍCH NGẦM HỖ TRỢ AI
# ==============================================================================
mkdir -p "$TARGET_DIR/scripts"
cp "$SCRIPT_DIR/scripts/new-feature.sh" "$TARGET_DIR/scripts/new-feature.sh"
chmod +x "$TARGET_DIR/scripts/new-feature.sh"
echo "  ✓ Đã cấu hình công cụ tạo task tự động cho AI: $TARGET_DIR/scripts/new-feature.sh"

# ==============================================================================
# BƯỚC 5: HƯỚNG DẪN ĐIỀU PHỐI (AGENTS.md)
# ==============================================================================
AGENTS_FILE="$TARGET_DIR/AGENTS.md"
WORKFLOW_BLOCK='<!-- LEAN_TRELLIS_WORKFLOW:START -->
## Large Feature Development Workflow (Lean Trellis Workflow)
100% Conversational UX via Natural Chat (no manual terminal commands required by user):
1. When user chats: "Create task/feature <name>", "Plan <name>", "/plan <name>", "Tạo task <tên>", or "Lập kế hoạch <tên>":
   - Automatically initialize `.trellis/research/<slug>/` with `prd.md` (Status: Draft), `design.md` (Status: Draft), `implement.md` (Status: Planning).
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
   - Upon user confirmation of PRD, promote `prd.md` and `design.md` to Status: Approved.
2. When user chats: "Implement task <name>", "Triển khai task <tên>" (or "... theo TDD", "... kèm UI", "... dùng UIUX skill"):
   - Update `implement.md` header to Status: In Progress.
   - If the task involves Frontend / UI:
     - Read `.trellis/spec/design-system.md` as the authoritative source of truth for tokens and styling primitives.
     - Strictly enforce **The 6 Mandatory UI States**: Normal, Loading (Skeleton), Empty, Error, Validation, Responsive (Mobile 390px / Desktop 1280px).
     - If `uiux-orchestrator` / UIUX skills are installed, route capability slots to specialist skills (e.g. UI UX Pro Max for data table/form UX, Emil Kowalski for motion physics, Impeccable for contrast/polish).
   - Read `implement.md`, execute step-by-step directly in the current session (use Behavior-Slice TDD — Red test on public interface ➔ Green ➔ Refactor — when requested).
   - Test each step and check off `[x]` upon completion (strictly in Section 1 checklist; keep Risk Watchlist as plain bullet points).
   - Once all tasks are checked off (before verification/nghiệm thu):
     - Update `implement.md` header to Status: Verification.
     - Inspect `git status --porcelain` and `git log --oneline -5`; separate AI-edited files from unrecognized dirty files (never silently stage unrelated WIP).
     - Output 2 ready-to-run Git commands:
       1. `git add <specific AI-edited files>` (list specific files, avoid `git add .`)
       2. `git commit -m "<conventional commit message>"`
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in `prd.md`, run test suite.
   - Upon successful verification, update `prd.md`, `design.md`, and `implement.md` to Status: Completed.
   - Update specs and log session with `add_session.py` (referencing the commit hash if committed).
4. When user chats: "Bootstrap specs", "Khởi tạo spec cho dự án":
   - Follow `lean-trellis-update-spec` (`references/bootstrap-codebase-specs.md`) to analyze repository architecture and write source-backed specs into `.trellis/spec/` with zero template placeholders.
5. When user chats: "Tạo spec design cho dự án", "Khởi tạo design spec", "Bootstrap design spec":
   - Follow `lean-trellis-update-spec` (`references/bootstrap-design-system-spec.md`) to scan repository styling, tokens, and write `.trellis/spec/design-system.md` with zero template placeholders.
<!-- LEAN_TRELLIS_WORKFLOW:END -->'

MEMORY_BLOCK='<!-- TRELLIS:START -->
# Lean Trellis Memory Layer

This project uses Lean Trellis as a memory layer. Working knowledge lives under `.trellis/`:

- `.trellis/spec/` — durable contracts (short markdown; read `index.md` first)
- `.trellis/research/` — topic inbox (`<topic>.md`; `README.md` is not a topic)
- `.trellis/workspace/` — per-developer journals

Record a session with the `lean-trellis-remember` skill, `/lean-trellis-remember`, or `$lean-trellis-remember`. When earlier decisions or relevant project rules are needed, use `lean-trellis mem recall "<topic or path>"`; expand evidence with `lean-trellis mem read "<ref>"`. Promote lasting boundaries into spec with `lean-trellis-update-spec`.

For a confirmed update, follow this short order: read the existing topic; edit that file; read it back and check the new rule; run `python3 ./.trellis/scripts/add_session.py --title "..." --summary "..." --topic <actual-topic-path>`.
<!-- TRELLIS:END -->'

if [ ! -f "$AGENTS_FILE" ]; then
  cat > "$AGENTS_FILE" << EOF
# AI Assistant Instructions

This project is managed by Lean Trellis Workflow & Memory Layer.

${MEMORY_BLOCK}

${WORKFLOW_BLOCK}
EOF
  echo "  ✓ Đã tạo mới file hướng dẫn: $AGENTS_FILE"
else
  # Cập nhật block nếu AGENTS.md đã có sẵn
  if grep -q "TRELLIS:START" "$AGENTS_FILE"; then
    sed -i '/<!-- TRELLIS:START -->/,/<!-- TRELLIS:END -->/d' "$AGENTS_FILE"
  fi
  cat >> "$AGENTS_FILE" << EOF

${MEMORY_BLOCK}
EOF

  if grep -q "LEAN_TRELLIS_WORKFLOW:START" "$AGENTS_FILE"; then
    sed -i '/<!-- LEAN_TRELLIS_WORKFLOW:START -->/,/<!-- LEAN_TRELLIS_WORKFLOW:END -->/d' "$AGENTS_FILE"
  fi
  cat >> "$AGENTS_FILE" << EOF

${WORKFLOW_BLOCK}
EOF
  echo "  ✓ Đã cập nhật hướng dẫn vào: $AGENTS_FILE"
fi

# ==============================================================================
# BƯỚC 6: TÙY CHỌN UIUX ORCHESTRATOR & SPECIALIST SKILLS
# ==============================================================================
if [ "$WITH_UIUX" = true ]; then
  echo ""
  echo "🎨 6. Cài đặt UIUX Orchestrator & Specialist Skills..."
  UIUX_AGENT_ARGS=""
  if [[ "$SELECTED_AGENTS" != *"all"* ]]; then
    if has_agent "claude"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent claude-code"; fi
    if has_agent "cursor"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent cursor"; fi
    if has_agent "codex"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent codex"; fi
    if has_agent "antigravity"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent gemini-cli"; fi
    if has_agent "opencode"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent opencode"; fi
    if has_agent "windsurf"; then UIUX_AGENT_ARGS="$UIUX_AGENT_ARGS --agent windsurf"; fi
  fi
  (cd "$TARGET_DIR" && npx -y uiux-orchestrator install --project $UIUX_AGENT_ARGS) || {
    echo "  ⚠️  Lưu ý: Không thể hoàn tất cài đặt specialist skills qua npx."
    echo "     (Design spec chuẩn tích hợp sẵn vẫn hoạt động trong .trellis/)"
  }
  if has_agent "antigravity" || has_agent "all"; then
    if [ -d "$TARGET_DIR/.agents/skills/uiux-orchestrator" ] && [ ! -d "$TARGET_DIR/.agent/skills/uiux-orchestrator" ]; then
      mkdir -p "$TARGET_DIR/.agent/skills"
      cp -r "$TARGET_DIR/.agents/skills/uiux-orchestrator" "$TARGET_DIR/.agent/skills/"
    fi
  fi
  echo "  ✓ Đã kích hoạt bộ kỹ năng UIUX Orchestrator"
fi

echo ""
echo "🎉 CÀI ĐẶT TRỌN GÓI HOÀN TẤT!"
echo "Bộ nhớ (.trellis/), Hooks, và Kỹ năng đã sẵn sàng cho: $SELECTED_AGENTS"
echo ""
echo "Bây giờ bạn chỉ cần mở IDE và Chat tự nhiên với AI:"
echo "  • Lập task:      \"Tạo task <tên>\" hoặc \"/plan <tên>\""
echo "  • Triển khai UI: \"Implement task <tên> kèm UI\" (áp dụng Design Spec + 6 UI States)"
echo "  • Spec Design:   \"Tạo spec design cho dự án\""
echo "  • Nghiệm thu:    \"Check task <tên>\""
echo ""
