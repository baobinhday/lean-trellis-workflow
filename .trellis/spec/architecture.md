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
   - `lean-trellis graph explore "<symbol-or-file>"` / `summary` / `status`: Query scoped AST + co-change subgraph from `.trellis/.runtime/codegraph.json` when available.
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

## 4. Optional CodeGraph Cache Contract (`.trellis/.runtime/codegraph.json`)

- **Loose Coupling:** `trellis-card` optionally generates `<project>/.trellis/.runtime/codegraph.json` (v1) using native Rust `tree-sitter` AST + Git/Task co-change scoring when `.trellis/` exists. `lean-trellis-workflow` remains 100% standalone and zero-dependency; `lean-trellis graph` acts strictly as a read-only consumer and degrades gracefully when the cache is missing or stale.
- **Gitignore Invariant:** `.runtime/` is excluded in `templates/trellis/gitignore.txt`, preventing cache writes from polluting `git status`.
- **Schema v1 (`camelCase`):**
  - Top-level: `version` (`1`), `generatedAt` (ISO-8601), `gitHead` (optional), `generator`, `languages`, `files`, `symbols`, `edges`.
  - `files`: map keyed by repo-relative POSIX path `{ language, mtimeMs, hubScore, module }`.
  - `symbols`: `{ id, name, qualifiedName, kind, file, startLine, endLine, signature?, exported }`.
  - `edges`: `{ source, target, kind ("imports" | "calls" | "co_change" | "task_link"), weight, provenance }`.
