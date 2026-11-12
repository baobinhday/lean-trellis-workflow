const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const graph = require('../lib/graph');

function makeTempProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-trellis-graph-'));
  fs.mkdirSync(path.join(dir, '.trellis', '.runtime'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'components'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src-tauri', 'src'), { recursive: true });

  const serviceCode = [
    'export function fetchRelations(project: string) {',
    '  return { project, items: [] };',
    '}',
    '',
    'export function helperUnused() {',
    '  return 1;',
    '}',
  ].join('\n');

  const viewCode = [
    'import { fetchRelations } from "../services/api";',
    '',
    'export function GraphPanel() {',
    '  return fetchRelations("demo");',
    '}',
  ].join('\n');

  const rustCode = [
    '#[tauri::command]',
    'pub fn get_code_graph() -> String {',
    '    String::from("ok")',
    '}',
  ].join('\n');

  fs.writeFileSync(path.join(dir, 'src/services/api.ts'), serviceCode);
  fs.writeFileSync(path.join(dir, 'src/components/GraphPanel.tsx'), viewCode);
  fs.writeFileSync(path.join(dir, 'src-tauri/src/lib.rs'), rustCode);

  const statApi = fs.statSync(path.join(dir, 'src/services/api.ts'));
  const statView = fs.statSync(path.join(dir, 'src/components/GraphPanel.tsx'));
  const statRust = fs.statSync(path.join(dir, 'src-tauri/src/lib.rs'));

  const cache = {
    version: 1,
    generatedAt: new Date().toISOString(),
    gitHead: null,
    generator: 'trellis-card-ast',
    languages: ['rust', 'typescript'],
    files: {
      'src/services/api.ts': {
        language: 'typescript',
        mtimeMs: Math.floor(statApi.mtimeMs),
        hubScore: 2,
        module: 'src/services',
      },
      'src/components/GraphPanel.tsx': {
        language: 'typescript',
        mtimeMs: Math.floor(statView.mtimeMs),
        hubScore: 0,
        module: 'src/components',
      },
      'src-tauri/src/lib.rs': {
        language: 'rust',
        mtimeMs: Math.floor(statRust.mtimeMs),
        hubScore: 1,
        module: 'src-tauri/src',
      },
    },
    symbols: [
      {
        id: 'src/services/api.ts#fetchRelations:1',
        name: 'fetchRelations',
        qualifiedName: 'fetchRelations',
        kind: 'function',
        file: 'src/services/api.ts',
        startLine: 1,
        endLine: 3,
        signature: 'export function fetchRelations(project: string)',
        exported: true,
      },
      {
        id: 'src/components/GraphPanel.tsx#GraphPanel:3',
        name: 'GraphPanel',
        qualifiedName: 'GraphPanel',
        kind: 'function',
        file: 'src/components/GraphPanel.tsx',
        startLine: 3,
        endLine: 5,
        signature: 'export function GraphPanel()',
        exported: true,
      },
      {
        id: 'src-tauri/src/lib.rs#get_code_graph:2',
        name: 'get_code_graph',
        qualifiedName: 'get_code_graph',
        kind: 'command',
        file: 'src-tauri/src/lib.rs',
        startLine: 1,
        endLine: 4,
        signature: 'pub fn get_code_graph() -> String',
        exported: true,
      },
    ],
    edges: [
      {
        source: 'src/components/GraphPanel.tsx',
        target: 'src/services/api.ts',
        kind: 'imports',
        weight: 1.0,
        provenance: 'ast',
      },
      {
        source: 'src/components/GraphPanel.tsx#GraphPanel:3',
        target: 'src/services/api.ts#fetchRelations:1',
        kind: 'calls',
        weight: 1.0,
        provenance: 'ast_call',
      },
      {
        source: 'src/services/api.ts#fetchRelations:1',
        target: 'src-tauri/src/lib.rs#get_code_graph:2',
        kind: 'calls',
        weight: 1.0,
        provenance: 'ast_tauri_ipc',
      },
      {
        source: 'src/components/GraphPanel.tsx',
        target: 'src-tauri/src/lib.rs',
        kind: 'co_change',
        weight: 1.75,
        provenance: 'git:3_commits',
      },
      {
        source: 'task:scoped-code-graph',
        target: 'src/services/api.ts',
        kind: 'task_link',
        weight: 1.0,
        provenance: 'task:scoped-code-graph',
      },
    ],
  };

  fs.writeFileSync(
    path.join(dir, '.trellis', '.runtime', 'codegraph.json'),
    JSON.stringify(cache, null, 2)
  );
  return dir;
}

test('loadGraphCache handles missing and malformed files gracefully', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-trellis-cg-empty-'));
  try {
    const missing = graph.loadGraphCache(dir);
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'missing');

    fs.mkdirSync(path.join(dir, '.trellis', '.runtime'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.trellis', '.runtime', 'codegraph.json'), '{bad json');
    const invalid = graph.loadGraphCache(dir);
    assert.equal(invalid.ok, false);
    assert.equal(invalid.reason, 'invalid');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildScopedSubgraph returns definition snippet, callers/callees, co-change, and task links', () => {
  const dir = makeTempProject();
  try {
    const loaded = graph.loadGraphCache(dir);
    assert.equal(loaded.ok, true);

    const res = graph.buildScopedSubgraph(dir, loaded.cache, 'fetchRelations', { hops: 1 });
    assert.equal(res.found, true);
    assert.equal(res.freshness.status, 'fresh');
    assert.equal(res.snippets.length, 1);
    assert.match(res.snippets[0].code, /export function fetchRelations/);
    assert.ok(res.incoming.some((e) => e.source.includes('GraphPanel')));
    assert.ok(res.outgoing.some((e) => e.target.includes('get_code_graph')));
    assert.ok(res.taskLinks.some((e) => e.source === 'task:scoped-code-graph'));

    // Multi-hop (hops=2) also picks up co-change neighbor via GraphPanel.tsx
    const res2 = graph.buildScopedSubgraph(dir, loaded.cache, 'GraphPanel.tsx', { hops: 1 });
    assert.ok(res2.coChanges.some((e) => e.peer === 'src-tauri/src/lib.rs'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('checkFreshness flags modified and deleted files', () => {
  const dir = makeTempProject();
  try {
    const loaded = graph.loadGraphCache(dir);
    assert.equal(loaded.ok, true);
    assert.equal(graph.checkFreshness(dir, loaded.cache).status, 'fresh');

    // Simulate file modified 5s later
    const apiPath = path.join(dir, 'src/services/api.ts');
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(apiPath, future, future);

    const stale = graph.checkFreshness(dir, loaded.cache);
    assert.equal(stale.status, 'stale');
    assert.deepEqual(stale.staleFiles, ['src/services/api.ts']);

    // Simulate deleted file
    fs.unlinkSync(path.join(dir, 'src-tauri/src/lib.rs'));
    const deleted = graph.checkFreshness(dir, loaded.cache);
    assert.deepEqual(deleted.deletedFiles, ['src-tauri/src/lib.rs']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildSummary and CLI commands respect max-chars and json output', () => {
  const dir = makeTempProject();
  try {
    const loaded = graph.loadGraphCache(dir);
    const sum = graph.buildSummary(loaded.cache, { limit: 5 });
    assert.equal(sum.hubFiles[0].file, 'src/services/api.ts');
    assert.equal(sum.crossLangCalls.length, 1);
    assert.equal(sum.taskLinks[0].taskId, 'task:scoped-code-graph');

    const cliPath = path.resolve(__dirname, '..', 'bin', 'cli.js');
    const out = execFileSync(process.execPath, [cliPath, 'graph', 'explore', 'fetchRelations', '--cwd', dir, '--max-chars', '420'], {
      encoding: 'utf8',
    });
    assert.ok(out.length <= 425);
    assert.match(out, /truncated at 420 chars/);

    const statusOut = execFileSync(process.execPath, [cliPath, 'graph', 'status', '--cwd', dir, '--json'], {
      encoding: 'utf8',
    });
    const statusJson = JSON.parse(statusOut);
    assert.equal(statusJson.state, 'fresh');

    const summaryOut = execFileSync(process.execPath, [cliPath, 'graph', 'summary', '--cwd', dir, '--limit', '5'], {
      encoding: 'utf8',
    });
    assert.match(summaryOut, /CodeGraph Summary/);
    assert.match(summaryOut, /src\/services\/api\.ts/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildScopedSubgraph blocks path traversal outside project root', () => {
  const dir = makeTempProject();
  try {
    const loaded = graph.loadGraphCache(dir);
    loaded.cache.files['../../etc/passwd'] = {
      language: 'text',
      mtimeMs: 0,
      hubScore: 0,
      module: 'etc',
    };
    loaded.cache.symbols.push({
      id: '../../etc/passwd#root:1',
      name: 'traversalSecret',
      qualifiedName: 'traversalSecret',
      kind: 'const',
      file: '../../etc/passwd',
      startLine: 1,
      endLine: 5,
      exported: true,
    });
    const res = graph.buildScopedSubgraph(dir, loaded.cache, 'traversalSecret');
    assert.equal(res.found, true);
    assert.equal(res.snippets.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
