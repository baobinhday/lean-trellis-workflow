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
   - Automatically initialize `.trellis/research/<slug>/` with `prd.md`, `design.md`, `implement.md`.
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
2. When user chats: "Implement task <name>", "Triển khai task <tên>":
   - Read `implement.md`, execute step-by-step directly in the current session.
   - Test each step and check off `[x]` upon completion.
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in `prd.md`, run test suite, update specs, and log session with `add_session.py`.
<!-- LEAN_TRELLIS_WORKFLOW:END -->
