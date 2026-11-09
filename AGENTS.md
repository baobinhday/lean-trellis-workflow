# AI Assistant Instructions

This project is managed by Lean Trellis Workflow & Memory Layer.

<!-- TRELLIS:START -->
# Lean Trellis Memory Layer

This project uses Lean Trellis as a memory layer. Working knowledge lives under `.trellis/`:

- `.trellis/spec/` — durable contracts (short markdown; read `index.md` first)
- `.trellis/research/` — topic inbox (`<topic>.md`; `README.md` is not a topic)
- `.trellis/workspace/` — per-developer journals

Record a session with the `lean-trellis-remember` skill, `/lean-trellis-remember`, or `$lean-trellis-remember`. When earlier decisions or relevant project rules are needed, use `lean-trellis mem recall "<topic or path>"`; expand evidence with `lean-trellis mem read "<ref>"`. Promote lasting boundaries into spec with `lean-trellis-update-spec`.

For a confirmed update, follow this short order: read the existing topic; edit that file; read it back and check the new rule; run `python3 ./.trellis/scripts/add_session.py --title "..." --summary "..." --topic <actual-topic-path>`.
<!-- TRELLIS:END -->

<!-- LEAN_TRELLIS_WORKFLOW:START -->
## Large Feature Development Workflow (Lean Trellis Workflow)
100% Conversational UX via Natural Chat (no manual terminal commands required by user):
1. When user chats: "Create task/feature <name>", "Plan <name>", "/plan <name>", "Tạo task <tên>", or "Lập kế hoạch <tên>":
   - Automatically initialize `.trellis/research/<slug>/` with `prd.md` (Status: Draft), `design.md` (Status: Draft), `implement.md` (Status: Planning).
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
   - Upon user confirmation of PRD, promote `prd.md` and `design.md` to Status: Approved.
2. When user chats: "Implement task <name>", "Triển khai task <tên>" (or "... theo TDD"):
   - Update `implement.md` header to Status: In Progress.
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
<!-- LEAN_TRELLIS_WORKFLOW:END -->
