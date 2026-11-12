# Technical Design: Scoped Code Graph Engine & CLI Reader (`lean-trellis graph`)

**Status:** Approved
<!-- Lifecycle: Draft -> Approved -> Completed -->
**Topic Path:** `.trellis/research/scoped-code-graph/`  
**PRD Reference:** [prd.md](./prd.md)  

---

## 1. Architecture & Component Boundaries

Kiến trúc phân tách rõ **Producer** (`trellis-card` Rust backend, xem task `ast-scoped-code-graph` tại repo `trellis-card`) và **Consumer/Reader** (`lean-trellis-workflow` zero-dependency CLI):

```
[trellis-card (Optional Rust AST + Co-Change Indexer)]
        │  atomic write (only when .trellis/ exists)
        ▼
[.trellis/.runtime/codegraph.json]  (auto-gitignored via .trellis/.gitignore)
        │  read-only query + mtime/gitHead check
        ▼
[lean-trellis graph explore|summary]  (lib/graph.js + bin/cli.js, 0 npm deps)
        │  scoped subgraph + disk source snippets (within --max-chars)
        ▼
[AI Agent in IDE/CLI] ──(if absent/stale)──► fallback to grep/read_file
```

- **Ownership Boundary:**
  - `lib/graph.js`: Đọc & validate schema `.trellis/.runtime/codegraph.json`, kiểm tra độ tươi (`gitHead` / `mtimeMs`), BFS mở rộng **Scoped Subgraph** theo `hops`, xếp hạng lân cận theo `edge.weight`, đọc snippet nguồn trên đĩa theo `startLine..endLine`, và format text/JSON theo `--max-chars`.
  - `bin/cli.js`: Parse subcommand `lean-trellis graph <explore|summary|status>` và flags (`--hops`, `--max-chars`, `--json`, `--cwd`).
  - `lib/installer.js`: Mở rộng `doctor()` kiểm tra trạng thái cache optional.
  - `skills/`: Cập nhật hướng dẫn sử dụng `lean-trellis graph` ở Phase 1 và `Bootstrap specs`.

---

## 2. Contracts & Interfaces

### 2.1. Shared Cache Schema (`.trellis/.runtime/codegraph.json`)

```typescript
export interface CodeGraphCache {
  version: 1;
  generatedAt: string; // ISO-8601
  gitHead?: string;
  generator: 'trellis-card-ast' | 'lean-trellis-lite';
  languages: string[];
  files: Record<string, CodeGraphFileNode>; // key = repo-relative posix path
  symbols: CodeGraphSymbolNode[];
  edges: CodeGraphEdge[];
}

export interface CodeGraphFileNode {
  language: string;
  mtimeMs: number;
  hubScore: number; // incoming edges count
  module?: string;
}

export interface CodeGraphSymbolNode {
  id: string; // e.g. "src/lib/auth.ts#verifyToken:14"
  name: string;
  qualifiedName: string;
  kind: 'function' | 'class' | 'method' | 'interface' | 'type' | 'struct' | 'enum' | 'const' | 'command';
  file: string;
  startLine: number;
  endLine: number;
  signature?: string;
  exported: boolean;
}

export interface CodeGraphEdge {
  source: string; // file path or symbol id
  target: string; // file path or symbol id
  kind: 'imports' | 'calls' | 'co_change' | 'task_link';
  weight: number; // AST edges >= 1.0; co_change/task_link weighted by frequency/recency
  provenance?: string; // e.g. "ast" | "git:4_commits" | "task:user-auth"
}
```

### 2.2. CLI Contract (`bin/cli.js` & `lib/graph.js`)

```javascript
// lib/graph.js
function loadGraphCache(projectRoot) {}
function checkFreshness(projectRoot, cache) {} // returns { status: 'fresh'|'stale'|'missing', staleFiles: string[] }
function exploreSubgraph(query, opts) {}       // opts: { cwd, hops = 1, maxChars = 6000, json = false }
function summarizeGraph(opts) {}               // opts: { cwd, limit = 15, json = false }
```

- **Scoped Subgraph Ranking Rule (học từ `superopen`):**
  1. Match target theo exact symbol `name` / `qualifiedName` / `file` path, fallback substring match.
  2. Lấy `1..hops` lân cận: tách rõ nhóm **Incoming (`callers` / `importers`)**, **Outgoing (`callees` / `imports`)**, và **Learned Co-Changes (`co_change` / `task_link`)** sắp xếp giảm dần theo `weight`.
  3. Đọc trực tiếp source block từ `file` tại `[startLine..endLine]` trên đĩa (tránh lưu full source code vào `codegraph.json` làm phình file cache) và cắt theo `--max-chars`.

---

## 3. Alternatives Considered & Trade-offs

### Option A: Pure-JSON Shared Cache Reader + Optional Lightweight Fallback (CHOSEN)
- **Description:** `trellis-card` (Rust) đảm nhiệm parse `tree-sitter` AST và xuất `.trellis/.runtime/codegraph.json`; `lean-trellis-workflow` đọc cache đó bằng Node built-in, không cài `sqlite` hay `tree-sitter`.
- **Why chosen:** Giữ nguyên `"dependencies": {}` trong `package.json`, chạy được mọi phiên bản Node và `install.sh`, tận dụng thư mục `.trellis/.runtime/` đã được gitignore sẵn.
- **Trade-offs & Costs:** Khi user chưa mở `trellis-card` hoặc chạy trên máy headless, dữ liệu AST chi tiết chưa có (trừ khi bật lightweight import+git fallback).

### Option B: Port/Nhúng SQLite + `web-tree-sitter` vào `lean-trellis-workflow` (REJECTED)
- **Description:** Clone kiến trúc `colbymchenry/codegraph` hoặc `superopen` (`tree-sitter` + SQLite) trực tiếp vào `lean-trellis-workflow`.
- **Strongest argument for this option:** `lean-trellis` sẽ tự chủ 100% AST trên mọi máy kể cả khi không cài `trellis-card`, không bao giờ bị stale cache giữa chừng.
- **Why rejected:** Phá vỡ cam kết zero-dependency (`tree-sitter-wasms` nặng hàng chục MB, `node:sqlite` đòi Node 22+ hoặc native build dễ lỗi), làm hỏng cơ chế cài bash thuần của `install.sh`, và trùng lặp công sức với Rust `tree-sitter` ở `trellis-card`.

### Option C: Cài thêm `ishanjainn/superopen` (`so` CLI) làm dependency ngoài (REJECTED)
- **Description:** Gọi `so init` và `so sessions hook` từ `lean-trellis init`.
- **Strongest argument for this option:** Tận dụng sẵn binary Go biên dịch sẵn, SQLite graph, và cơ chế session learning đã có người viết.
- **Why rejected:** User không muốn cài thêm công cụ ngoài; hơn nữa `superopen` là một agent harness có hooks và session telemetry riêng nên sẽ xung đột trực tiếp với `.trellis/hooks/session-start.py` và `lean-trellis mem`.

---

## 4. Compatibility, Migration & Rollback Strategy
- **Backward Compatibility:** Không thay đổi format `.trellis/research/<slug>/` hay `mem recall`. Project không có `.trellis/.runtime/codegraph.json` vẫn dùng workflow cũ bình thường.
- **Key Risks:**
  - Cache JSON quá lớn trên monorepo (>50MB) làm chậm `JSON.parse`: giảm thiểu bằng cách **không lưu source code body** trong JSON và giới hạn `symbols`/`edges` ở top-level declarations + import-scoped calls.
  - Cache stale khi user sửa code ngoài `trellis-card`: giải quyết bằng `checkFreshness` (`gitHead` + `mtimeMs`) in rõ danh sách file bị thay đổi.
- **Rollback Plan:** Xóa `lib/graph.js`, bỏ nhánh `args[0] === 'graph'` trong `bin/cli.js` và revert hướng dẫn skill; xóa `.trellis/.runtime/codegraph.json` không ảnh hưởng tới bất kỳ dữ liệu task/spec nào.
