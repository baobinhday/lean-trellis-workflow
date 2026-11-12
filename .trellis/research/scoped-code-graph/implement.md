# Implementation Plan: Scoped Code Graph Engine & CLI Reader (`lean-trellis graph`)

**Status:** Completed
<!-- Lifecycle: Planning -> In Progress -> Verification -> Completed (or Blocked) -->
**PRD Reference:** [prd.md](./prd.md)  
**Design Reference:** [design.md](./design.md)  

---

## 1. Ordered Implementation Checklist
*(Execute directly in the active session: verify each step and tick `[x]` as progress is made)*

- [x] **Phase 1: Shared Contract & Spec Documentation**
  - [x] Document `.trellis/.runtime/codegraph.json` v1 schema and one-way optional integration contract in `.trellis/spec/architecture.md` (and link from `.trellis/spec/index.md` if needed)
  - [x] Ensure `templates/trellis/gitignore.txt` continues to ignore `.runtime/` cleanly
  - *Validation command:* `grep -n "codegraph.json" .trellis/spec/architecture.md`

- [x] **Phase 2: Zero-Dependency Graph Reader (`lib/graph.js`)**
  - [x] Implement `loadGraphCache`, `checkFreshness` (`gitHead` + file `mtimeMs`), and graceful missing/corrupt JSON handling in `lib/graph.js`
  - [x] Implement `exploreSubgraph` (1-2 hop BFS, weighted ranking for `imports`/`calls`/`co_change`/`task_link`, on-disk line-range snippet reader, `--max-chars` budget, `--json`)
  - [x] Implement `summarizeGraph` (top Hub files, module breakdown, strongest co-change pairs)
  - *Validation command:* `node --test test/graph.test.js`

- [x] **Phase 3: CLI Wiring & `doctor` Diagnostics**
  - [x] Wire `lean-trellis graph <explore|summary|status>` and flags (`--hops`, `--max-chars`, `--limit`, `--json`, `--cwd`) into `bin/cli.js` and help output
  - [x] Update `doctor()` in `lib/installer.js` to report optional `CodeGraph Cache` status (`Fresh`, `Stale`, `Not indexed (optional)`)
  - *Validation command:* `node ./bin/cli.js doctor && node ./bin/cli.js graph --help`

- [x] **Phase 4: Skills & Templates Sync**
  - [x] Update `skills/lean-trellis-workflow/SKILL.md` and `skills/lean-trellis-workflow/references/01-brainstorming.md` to use `lean-trellis graph` (when available) during `Repository Evidence First`
  - [x] Update `skills/lean-trellis-update-spec/references/bootstrap-codebase-specs.md` to leverage `lean-trellis graph summary`
  - [x] Refine target file listing clarity in `templates/prd.template.md` / `templates/implement.template.md` (keeping `Out-of-Scope` distinct)
  - *Validation command:* `node --test test/*.test.js`

---

## 2. Verification Commands
```bash
# 1. Run unit & CLI tests
node --test

# 2. Verify CLI commands & doctor output
node ./bin/cli.js doctor
node ./bin/cli.js graph --help

# 3. Verify zero external dependencies in package.json
node -e "const p = require('./package.json'); if (Object.keys(p.dependencies || {}).length) process.exit(1)"
```

---

## 3. Risk Watchlist
*(Non-task reference watchlist. Use plain bullet points, never `- [ ]` checkboxes to prevent checklist confusion)*
- Keep `.trellis/hooks/session-start.py` under `MAX_CONTEXT_CHARS = 4000` so graph features add zero per-turn token bloat.
- Never allow `lib/graph.js` to crash `lean-trellis doctor` or AI workflows when `.trellis/.runtime/codegraph.json` is missing, partial during write, or from an incompatible schema version.
- Ensure Windows and POSIX paths normalize consistently to forward slashes `/` when matching `files` keys against `git status` or user queries.
