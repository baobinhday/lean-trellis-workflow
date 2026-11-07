# Research: Genesis and Evolution of Lean Trellis Workflow

**Status:** Confirmed  
**Date:** 2026-11-06  
**Topic:** `lean-trellis-evolution`

---

## 1. Context & Genesis

Traditional Trellis 1.0 relied on a heavy structure centered around `.trellis/tasks/**/task.json`, Python management scripts (`task.py`), and multi-agent loops. While powerful for large teams, it introduced friction for single developers and solo AI pair programming:
- Managing `task.json` required manual commands or sync daemons.
- Status drift occurred when checklist items in Markdown diverged from JSON status fields.
- Terminal commands (`trellis task create`, etc.) broke the fluid conversational IDE experience.

**Lean Trellis** was designed as a hybrid combining the durable memory layer of Trellis with the radical simplicity of pure Markdown:
- Feature tasks live under `.trellis/research/<slug>/` (`prd.md`, `design.md`, `implement.md`).
- Progress and status are derived directly from markdown checklists (`- [x]` vs `- [ ]`).
- 100% conversational flow in chat without terminal commands.

---

## 2. Decision Log & Alternatives Considered

### Decision 1: Unification under `lean-trellis` Prefix
- **Alternatives Considered:** Keeping `mini-trellis` prefix for CLI and `lean-trellis` for workflow.
  - *Strongest argument for alternative:* Preserved backward compatibility with older command aliases.
  - *Why rejected:* Fragmented user mental model. Users were confused seeing `mini-trellis mem recall` while using `lean-trellis-workflow`.
- **Chosen:** Cleanly rename everything to `lean-trellis` (`lean-trellis-workflow`, `lean-trellis-remember`, `lean-trellis-update-spec`, `lean-trellis-session-insight`, binary `bin/cli.js` as `lean-trellis`).

### Decision 2: DeepSeek Thinking & Note Discipline Integration
- **Context:** Ensuring rigorous engineering quality in AI agents without endless questioning.
- **Rules Integrated:**
  - Codebase inspection first before asking questions.
  - At most 1 high-value question with recommendation & trade-off.
  - Always articulate the strongest argument for a rejected option before rejecting it.

### Decision 3: 100% Self-Contained CLI with Built-In Native Memory Engine
- **Resolution:** `bin/cli.js` directly implements `init`, `upgrade`, `check-update`, `doctor`, and native `mem recall` / `recall` and `mem read` / `read` via `lib/memory.js`. Completely eliminated all auxiliary dependencies, making `lean-trellis` 100% standalone, self-sufficient, and zero-dependency.
