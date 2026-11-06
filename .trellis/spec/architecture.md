# Lean Trellis Architecture & Contracts

> Durable technical specification for the `lean-trellis-workflow` package and CLI ecosystem.

## 1. Core Principles

1. **Pure Markdown Simplicity:** No `task.json`, no runtime database daemons. Features live under `.trellis/research/<slug>/` with `prd.md`, `design.md`, and `implement.md`.
2. **100% Conversational UX:** The user interacts entirely via natural chat in their IDE (`Plan <name>`, `Implement task <name>`, `Check task <name>`). No manual terminal commands required.
3. **Single Unified CLI (`lean-trellis`):**
   - `lean-trellis init [target-dir] [-u user]`: Set up memory layer, hooks, and skills.
   - `lean-trellis upgrade [target-dir]`: Refresh skills, hooks, and templates in-place without touching user data.
   - `lean-trellis doctor [target-dir]`: Validate runtime prerequisites, memory health, and skill configurations.
   - `lean-trellis mem recall "<query>"` / `lean-trellis recall "<query>"`: Contextual project memory recall.
   - `lean-trellis mem read "<ref>"` / `lean-trellis read "<ref>"`: Expand cited memory excerpts.
4. **DeepSeek Note Discipline:**
   - Inspect codebase first; ask at most 1 high-value question with recommendation & trade-off.
   - Always state the strongest argument for a rejected option before rejecting it.

## 2. Skill Suite Contract

| Skill Name | Role | Location |
|:---|:---|:---|
| `lean-trellis-workflow` | Structured single-agent lifecycle (Plan → Implement → Verify) | `.agent/skills/lean-trellis-workflow/` |
| `lean-trellis-remember` | Record confirmed decisions and learnings into journal & research | `.agent/skills/lean-trellis-remember/` |
| `lean-trellis-update-spec` | Promote durable boundaries into `.trellis/spec/` | `.agent/skills/lean-trellis-update-spec/` |
| `lean-trellis-session-insight` | Search past decisions & AI sessions via `lean-trellis mem` | `.agent/skills/lean-trellis-session-insight/` |

All skills are mirrored across `.agent/`, `.agents/`, `.claude/`, and `.cursor/` for cross-IDE compatibility.

## 3. Desktop Observer Compatibility

The `trellis-card` Desktop App (Tauri v2 + React 19) observes Lean Trellis projects:
- Detects project root if `.trellis/research` exists.
- Infers task titles from `# PRD: <Title>` or frontmatter.
- Computes progress and Kanban lanes directly from `- [x]` checklist items in `implement.md`.
