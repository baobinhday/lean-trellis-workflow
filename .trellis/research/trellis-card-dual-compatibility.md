# Research: Dual Compatibility with Trellis Card Desktop

**Status:** Confirmed & Implemented  
**Date:** 2026-11-06  
**Topic:** `trellis-card-dual-compatibility`

---

## 1. Context

`trellis-card` is a Tauri v2 + React 19 desktop observer that provides a real-time Kanban board of tasks. Originally, it only recognized `.trellis/tasks/**/task.json`. When projects adopted Lean Trellis, `trellis-card` showed 0 tasks.

---

## 2. Dual Scanner Contract

To bridge both ecosystems with zero regressions:
1. **Discovery:** A repository is recognized as a valid project if either `.trellis/tasks` OR `.trellis/research` exists.
2. **Lean Task Detection:** Any subdirectory in `.trellis/research/<slug>/` containing `prd.md`, `design.md`, or `implement.md` is scanned as an active task.
3. **Markdown Heading Extraction:** Titles are parsed from `# PRD: <Title>` / `# <Title>` or frontmatter `title:`.
4. **Lane & Progress Mapping:**
   - **Done / Archived (Lane 4):** Located under `archive/` OR 100% of subtasks are `- [x]`.
   - **In Progress (Lane 2):** Has `- [x]` completed subtasks or status `in_progress`.
   - **Review / Blocked (Lane 3):** Status declared `review` or `blocked`.
   - **Planning (Lane 1):** Only `prd.md`/`design.md` or 0 subtasks completed.
5. **Real-time Watcher:** `watch.rs` listens for file changes in `.trellis/research/**` so ticking a box immediately updates the Kanban UI.
6. **IPC Document Resolver:** Slide-over modal loads docs from `.trellis/research/<slug>/` when `task.dir` begins with `research/`.
