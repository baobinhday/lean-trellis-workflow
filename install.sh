#!/usr/bin/env bash
# install.sh - Cài đặt TOÀN DIỆN Lean Trellis Workflow (All-in-One: Bộ nhớ + Quy trình)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"
DEV_NAME="${2:-$(git config user.name 2>/dev/null || whoami || echo "developer")}"
# Chuẩn hóa tên developer không dấu/khoảng trắng
DEV_NAME="$(echo "$DEV_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

# Resolve target directory to absolute path
mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo "🚀 Bắt đầu cài đặt trọn gói Lean Trellis Workflow vào:"
echo "   Dự án:     $TARGET_DIR"
echo "   Developer: $DEV_NAME"
echo ""

TRELLIS_TEMPLATES="$SCRIPT_DIR/templates/trellis"
SKILLS_SRC="$SCRIPT_DIR/skills"

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
if [ ! -f "$TARGET_DIR/.trellis/spec/guides/index.md" ]; then
  cp -r "$TRELLIS_TEMPLATES/spec/guides/"* "$TARGET_DIR/.trellis/spec/guides/"
fi
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
# BƯỚC 2: THIẾT LẬP HOOKS KHỞI ĐỘNG (Claude, Cursor, Codex, OpenCode)
# ==============================================================================
echo "🔗 2. Thiết lập SessionStart Hooks..."

HOOK_FILE="$TRELLIS_TEMPLATES/hooks/session-start.py"

# Claude Code
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

# Cursor
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

# Codex
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

echo "  ✓ Đã thiết lập xong SessionStart hooks cho Claude Code, Cursor, Codex"

# ==============================================================================
# BƯỚC 3: CÀI ĐẶT TRỌN BỘ SKILLS
# ==============================================================================
echo "🧠 3. Cài đặt các kỹ năng (Skills)..."

install_all_skills_to() {
  local base_dir="$1"
  mkdir -p "$base_dir"
  # Dọn dẹp skill cũ có tiền tố mini-trellis- nếu có
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

# Cài vào tất cả các nền tảng agent
install_all_skills_to "$TARGET_DIR/.agent/skills"
install_all_skills_to "$TARGET_DIR/.agents/skills"
install_all_skills_to "$TARGET_DIR/.claude/skills"
install_all_skills_to "$TARGET_DIR/.cursor/skills"
if [ -d "$TARGET_DIR/.opencode" ]; then
  install_all_skills_to "$TARGET_DIR/.opencode/skills"
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
if [ ! -f "$AGENTS_FILE" ]; then
  cat > "$AGENTS_FILE" << 'EOF'
# AI Assistant Instructions

This project is managed by Lean Trellis Workflow & Memory Layer.

<!-- TRELLIS:START -->
# mini-trellis

This project uses mini-trellis as a memory layer. Working knowledge lives under `.trellis/`:

- `.trellis/spec/` — durable contracts (short markdown; read `index.md` first)
- `.trellis/research/` — topic inbox (`<topic>.md`; `README.md` is not a topic)
- `.trellis/workspace/` — per-developer journals

Record a session with the `lean-trellis-remember` skill, `/lean-trellis-remember`, or `$lean-trellis-remember`. When earlier decisions or relevant project rules are needed, use `mini-trellis mem recall "<topic or path>"`; expand evidence with `mini-trellis mem read "<ref>"`. Promote lasting boundaries into spec with `lean-trellis-update-spec`.

For a confirmed update, follow this short order: read the existing topic; edit that file; read it back and check the new rule; run `python3 ./.trellis/scripts/add_session.py --title "..." --summary "..." --topic <actual-topic-path>`.
<!-- TRELLIS:END -->

<!-- LEAN_TRELLIS_WORKFLOW:START -->
## Large Feature Development Workflow (Lean Trellis Workflow)
100% Conversational UX via Natural Chat (no manual terminal commands required by user):
1. When user chats: "Create task/feature <name>", "Plan <name>", "/plan <name>", "Tạo task <tên>", or "Lập kế hoạch <tên>":
   - Automatically initialize `.trellis/research/<slug>/` with `prd.md`, `design.md`, `implement.md`.
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
2. When user chats: "Implement task <name>", "Triển khai task <tên>":
   - Read `implement.md`, execute step-by-step directly in the current session.
   - Test each step and check off `[x]` upon completion.
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in `prd.md`, run test suite, update specs, and log session with `add_session.py`.
<!-- LEAN_TRELLIS_WORKFLOW:END -->
EOF
  echo "  ✓ Đã tạo mới file hướng dẫn: $AGENTS_FILE"
else
  # Cập nhật block nếu AGENTS.md đã có sẵn
  if grep -q "LEAN_TRELLIS_WORKFLOW:START" "$AGENTS_FILE"; then
    sed -i '/<!-- LEAN_TRELLIS_WORKFLOW:START -->/,/<!-- LEAN_TRELLIS_WORKFLOW:END -->/d' "$AGENTS_FILE"
  fi
  cat >> "$AGENTS_FILE" << 'EOF'

<!-- LEAN_TRELLIS_WORKFLOW:START -->
## Large Feature Development Workflow (Lean Trellis Workflow)
100% Conversational UX via Natural Chat (no manual terminal commands required by user):
1. When user chats: "Create task/feature <name>", "Plan <name>", "/plan <name>", "Tạo task <tên>", or "Lập kế hoạch <tên>":
   - Automatically initialize `.trellis/research/<slug>/` with `prd.md`, `design.md`, `implement.md`.
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
2. When user chats: "Implement task <name>", "Triển khai task <tên>":
   - Read `implement.md`, execute step-by-step directly in the current session.
   - Test each step and check off `[x]` upon completion.
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in `prd.md`, run test suite, update specs, and log session with `add_session.py`.
<!-- LEAN_TRELLIS_WORKFLOW:END -->
EOF
  echo "  ✓ Đã cập nhật hướng dẫn vào: $AGENTS_FILE"
fi

echo ""
echo "🎉 CÀI ĐẶT TRỌN GÓI HOÀN TẤT!"
echo "Bộ nhớ (.trellis/), Hooks, và 4 Kỹ năng đã sẵn sàng trong dự án của bạn."
echo ""
echo "Bây giờ bạn chỉ cần mở IDE và Chat tự nhiên với AI:"
echo "  • Lập task:   \"Tạo task <tên>\" hoặc \"/plan <tên>\""
echo "  • Triển khai: \"Implement task <tên>\""
echo "  • Nghiệm thu: \"Check task <tên>\""
echo ""
