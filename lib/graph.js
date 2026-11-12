const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveProjectRoot } = require('./memory');

const DEFAULT_MAX_CHARS = 6000;
const DEFAULT_SUMMARY_LIMIT = 15;
const MAX_SNIPPET_LINES = 45;
const MTIME_TOLERANCE_MS = 1000;
const CODE_EXT_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|rs|py)$/i;

function toPosix(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function getCachePath(projectRoot) {
  return path.join(projectRoot, '.trellis', '.runtime', 'codegraph.json');
}

function loadGraphCache(projectRoot) {
  const cachePath = getCachePath(projectRoot);
  if (!fs.existsSync(cachePath)) {
    return { ok: false, reason: 'missing', cachePath };
  }

  let parsed;
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: 'invalid', error: err.message, cachePath };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.version !== 1 ||
    !parsed.files ||
    typeof parsed.files !== 'object' ||
    !Array.isArray(parsed.symbols) ||
    !Array.isArray(parsed.edges)
  ) {
    return {
      ok: false,
      reason: 'invalid',
      error: 'Unsupported or malformed codegraph.json schema (expected v1)',
      cachePath,
    };
  }

  const normalizedFiles = {};
  for (const [k, v] of Object.entries(parsed.files)) {
    normalizedFiles[toPosix(k)] = v;
  }

  const cache = {
    version: parsed.version,
    generatedAt: parsed.generatedAt || '',
    gitHead: parsed.gitHead || null,
    generator: parsed.generator || 'unknown',
    languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    files: normalizedFiles,
    symbols: parsed.symbols.map((s) => ({ ...s, file: toPosix(s.file) })),
    edges: parsed.edges.map((e) => ({
      ...e,
      source: toPosix(e.source),
      target: toPosix(e.target),
      weight: typeof e.weight === 'number' ? e.weight : 1.0,
    })),
  };

  return { ok: true, cache, cachePath };
}

function runGit(projectRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500,
    }).trim();
  } catch (_) {
    return '';
  }
}

function checkFreshness(projectRoot, cache) {
  const staleFiles = [];
  const deletedFiles = [];
  const untrackedCodeFiles = [];

  for (const [relPath, node] of Object.entries(cache.files || {})) {
    const absPath = path.join(projectRoot, relPath);
    try {
      const stat = fs.statSync(absPath);
      if (!stat.isFile()) {
        deletedFiles.push(relPath);
      } else if (typeof node.mtimeMs === 'number' && Math.floor(stat.mtimeMs) > Math.floor(node.mtimeMs) + MTIME_TOLERANCE_MS) {
        staleFiles.push(relPath);
      }
    } catch (_) {
      deletedFiles.push(relPath);
    }
  }

  const currentGitHead = runGit(projectRoot, ['rev-parse', '--short', 'HEAD']) || null;
  let gitHeadChanged = false;
  if (cache.gitHead && currentGitHead) {
    const a = String(cache.gitHead).toLowerCase();
    const b = String(currentGitHead).toLowerCase();
    gitHeadChanged = !(a.startsWith(b) || b.startsWith(a));
  }

  const porcelain = runGit(projectRoot, ['status', '--porcelain']);
  if (porcelain) {
    for (const line of porcelain.split('\n')) {
      if (line.length < 4) continue;
      const rawPath = line.slice(3).trim().split(' -> ').pop();
      const rel = toPosix(rawPath);
      if (!rel || rel.startsWith('.trellis/') || !CODE_EXT_RE.test(rel)) continue;
      if (!cache.files[rel] && fs.existsSync(path.join(projectRoot, rel))) {
        untrackedCodeFiles.push(rel);
      } else if (cache.files[rel] && !staleFiles.includes(rel) && !deletedFiles.includes(rel)) {
        // Double-check dirty tracked files in case mtime matched within tolerance
        const abs = path.join(projectRoot, rel);
        try {
          const stat = fs.statSync(abs);
          if (stat.isFile() && Math.floor(stat.mtimeMs) > Math.floor(cache.files[rel].mtimeMs)) {
            staleFiles.push(rel);
          }
        } catch (_) {}
      }
    }
  }

  const isStale =
    staleFiles.length > 0 ||
    deletedFiles.length > 0 ||
    untrackedCodeFiles.length > 0 ||
    gitHeadChanged;

  return {
    status: isStale ? 'stale' : 'fresh',
    gitHeadChanged,
    currentGitHead,
    staleFiles: staleFiles.sort(),
    deletedFiles: deletedFiles.sort(),
    untrackedCodeFiles: untrackedCodeFiles.sort(),
  };
}

function safeReadSnippet(projectRoot, relFile, startLine = 1, endLine = 30) {
  const resolvedRoot = path.resolve(projectRoot);
  const absFile = path.resolve(resolvedRoot, relFile);
  if (absFile !== resolvedRoot && !absFile.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  try {
    const content = fs.readFileSync(absFile, 'utf8');
    const lines = content.split('\n');
    const start = Math.max(1, Number(startLine) || 1);
    const requestedEnd = Math.max(start, Number(endLine) || start + 25);
    const cappedEnd = Math.min(lines.length, start + MAX_SNIPPET_LINES - 1, requestedEnd);
    const slice = lines.slice(start - 1, cappedEnd);
    const truncatedLines = requestedEnd > cappedEnd;
    return {
      file: relFile,
      startLine: start,
      endLine: cappedEnd,
      truncatedLines,
      code: slice.map((l, idx) => `${String(start + idx).padStart(4)} | ${l}`).join('\n'),
    };
  } catch (_) {
    return null;
  }
}

function findMatchingSeeds(cache, rawQuery) {
  const q = toPosix(rawQuery).trim();
  const ql = q.toLowerCase();
  if (!ql) return [];

  const fileMatches = [];
  for (const filePath of Object.keys(cache.files)) {
    const fl = filePath.toLowerCase();
    const base = path.posix.basename(fl);
    let score = 0;
    if (fl === ql) score = 120;
    else if (base === ql) score = 105;
    else if (fl.endsWith('/' + ql)) score = 95;
    else if (base.includes(ql)) score = 70;
    else if (fl.includes(ql)) score = 55;
    if (score > 0) {
      fileMatches.push({ kind: 'file', id: filePath, label: filePath, file: filePath, score });
    }
  }

  const symbolMatches = [];
  for (const sym of cache.symbols) {
    const nameL = (sym.name || '').toLowerCase();
    const qualL = (sym.qualifiedName || '').toLowerCase();
    const idL = (sym.id || '').toLowerCase();
    let score = 0;
    if (idL === ql) score = 130;
    else if (nameL === ql) score = 115;
    else if (qualL === ql) score = 110;
    else if (nameL.startsWith(ql)) score = 85;
    else if (nameL.includes(ql)) score = 65;
    else if (qualL.includes(ql)) score = 50;
    if (score > 0) {
      const exportBonus = sym.exported ? 5 : 0;
      symbolMatches.push({
        kind: 'symbol',
        id: sym.id,
        label: `${sym.name} (${sym.kind})`,
        file: sym.file,
        symbol: sym,
        score: score + exportBonus,
      });
    }
  }

  const taskMatches = [];
  const taskSlug = ql.startsWith('task:') ? ql.slice(5) : ql;
  const seenTasks = new Set();
  for (const e of cache.edges) {
    if (e.kind === 'task_link' && e.source.startsWith('task:')) {
      const tid = e.source;
      const slugL = tid.slice(5).toLowerCase();
      if (!seenTasks.has(tid) && (slugL === taskSlug || slugL.includes(taskSlug))) {
        seenTasks.add(tid);
        taskMatches.push({
          kind: 'task',
          id: tid,
          label: tid,
          file: null,
          score: slugL === taskSlug ? 112 : 60,
        });
      }
    }
  }

  return [...symbolMatches, ...fileMatches, ...taskMatches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id.localeCompare(b.id);
  });
}

function buildScopedSubgraph(projectRoot, cache, query, opts = {}) {
  const hops = Math.min(Math.max(Number(opts.hops) || 1, 1), 2);
  const maxChars = Math.max(Number(opts.maxChars) || DEFAULT_MAX_CHARS, 400);
  const freshness = checkFreshness(projectRoot, cache);

  const symById = new Map();
  const symbolsByFile = new Map();
  for (const sym of cache.symbols) {
    symById.set(sym.id, sym);
    if (!symbolsByFile.has(sym.file)) symbolsByFile.set(sym.file, []);
    symbolsByFile.get(sym.file).push(sym);
  }

  const matches = findMatchingSeeds(cache, query);
  if (matches.length === 0) {
    return {
      found: false,
      query,
      hops,
      maxChars,
      freshness,
      matches: [],
      incoming: [],
      outgoing: [],
      coChanges: [],
      taskLinks: [],
      snippets: [],
    };
  }

  // Pick top seed(s): if exact match exists keep top 3, else top 2
  const primary = matches[0];
  const seedIds = new Set();
  for (const m of matches.slice(0, 3)) {
    if (m.score >= primary.score - 15) {
      seedIds.add(m.id);
    }
  }
  if (primary.kind === 'file') {
    for (const sym of (symbolsByFile.get(primary.file) || []).slice(0, 12)) {
      seedIds.add(sym.id);
    }
  }

  const incoming = [];
  const outgoing = [];
  const coChanges = [];
  const taskLinks = [];
  const seenEdgeKey = new Set();

  // BFS expansion up to `hops`
  let frontier = new Set(seedIds);
  const visitedNodes = new Set(seedIds);

  for (let depth = 1; depth <= hops; depth++) {
    const nextFrontier = new Set();
    for (const edge of cache.edges) {
      const touchesSrc = frontier.has(edge.source);
      const touchesTgt = frontier.has(edge.target);
      if (!touchesSrc && !touchesTgt) continue;

      const edgeKey = `${edge.kind}|${edge.source}|${edge.target}`;
      if (seenEdgeKey.has(edgeKey)) continue;
      seenEdgeKey.add(edgeKey);

      const enriched = { ...edge, hop: depth };
      if (edge.kind === 'task_link') {
        taskLinks.push(enriched);
      } else if (edge.kind === 'co_change') {
        coChanges.push(enriched);
      } else if (touchesTgt && !touchesSrc) {
        incoming.push(enriched);
      } else if (touchesSrc && !touchesTgt) {
        outgoing.push(enriched);
      } else {
        // Internal edge between seeds
        outgoing.push(enriched);
      }

      if (!visitedNodes.has(edge.source)) {
        visitedNodes.add(edge.source);
        nextFrontier.add(edge.source);
      }
      if (!visitedNodes.has(edge.target)) {
        visitedNodes.add(edge.target);
        nextFrontier.add(edge.target);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const byWeightDesc = (a, b) => (b.weight - a.weight) || a.source.localeCompare(b.source);
  incoming.sort(byWeightDesc);
  outgoing.sort(byWeightDesc);
  coChanges.sort(byWeightDesc);
  taskLinks.sort(byWeightDesc);

  // Also gather task_links on any touched files of primary seed
  if (primary.file) {
    for (const edge of cache.edges) {
      if (edge.kind === 'task_link' && edge.target === primary.file) {
        const key = `${edge.kind}|${edge.source}|${edge.target}`;
        if (!seenEdgeKey.has(key)) {
          seenEdgeKey.add(key);
          taskLinks.push({ ...edge, hop: 1 });
        }
      }
    }
  }

  // Build snippets for primary match(es)
  const snippets = [];
  const snippetFilesSeen = new Set();
  for (const m of matches.slice(0, 2)) {
    if (m.kind === 'symbol' && m.symbol) {
      const snip = safeReadSnippet(projectRoot, m.symbol.file, m.symbol.startLine, m.symbol.endLine);
      if (snip) snippets.push({ title: `${m.symbol.qualifiedName} (${m.symbol.kind})`, ...snip });
      snippetFilesSeen.add(m.symbol.file);
    } else if (m.kind === 'file' && !snippetFilesSeen.has(m.file)) {
      const fileSyms = (symbolsByFile.get(m.file) || []).slice(0, 8);
      if (fileSyms.length > 0) {
        snippets.push({
          title: `Exported/Top Symbols in ${m.file}`,
          file: m.file,
          startLine: fileSyms[0].startLine,
          endLine: fileSyms[fileSyms.length - 1].endLine,
          truncatedLines: false,
          code: fileSyms
            .map((s) => `L${s.startLine}-${s.endLine} [${s.kind}${s.exported ? ', exported' : ''}] ${s.signature || s.name}`)
            .join('\n'),
        });
      } else {
        const snip = safeReadSnippet(projectRoot, m.file, 1, 30);
        if (snip) snippets.push({ title: m.file, ...snip });
      }
      snippetFilesSeen.add(m.file);
    }
  }

  // Format symbol label helper
  const describeNode = (id) => {
    const sym = symById.get(id);
    if (sym) return `${sym.file}:${sym.startLine} (${sym.name} [${sym.kind}])`;
    return id;
  };

  return {
    found: true,
    query,
    hops,
    maxChars,
    generator: cache.generator,
    generatedAt: cache.generatedAt,
    freshness,
    matches: matches.slice(0, 5).map(({ id, kind, file, label, score }) => ({ id, kind, file, label, score })),
    snippets,
    incoming: incoming.map((e) => ({ ...e, label: describeNode(e.source) })),
    outgoing: outgoing.map((e) => ({ ...e, label: describeNode(e.target) })),
    coChanges: coChanges.map((e) => ({
      ...e,
      peer: seedIds.has(e.source) ? e.target : e.source,
    })),
    taskLinks,
  };
}

function buildSummary(cache, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_SUMMARY_LIMIT, 1), 50);

  const symCountByFile = new Map();
  for (const s of cache.symbols) {
    symCountByFile.set(s.file, (symCountByFile.get(s.file) || 0) + 1);
  }

  const hubFiles = Object.entries(cache.files)
    .map(([file, meta]) => ({
      file,
      language: meta.language,
      module: meta.module || '(root)',
      hubScore: Number(meta.hubScore || 0),
      symbolCount: symCountByFile.get(file) || 0,
    }))
    .sort((a, b) => b.hubScore - a.hubScore || b.symbolCount - a.symbolCount || a.file.localeCompare(b.file))
    .slice(0, limit);

  const moduleMap = new Map();
  for (const [file, meta] of Object.entries(cache.files)) {
    const mod = meta.module || '(root)';
    if (!moduleMap.has(mod)) moduleMap.set(mod, { module: mod, files: 0, symbols: 0 });
    const entry = moduleMap.get(mod);
    entry.files += 1;
    entry.symbols += symCountByFile.get(file) || 0;
  }
  const modules = [...moduleMap.values()]
    .sort((a, b) => b.files - a.files || b.symbols - a.symbols)
    .slice(0, limit);

  const topCoChanges = cache.edges
    .filter((e) => e.kind === 'co_change')
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);

  const crossLangCalls = cache.edges
    .filter((e) => e.kind === 'calls' && String(e.provenance || '').includes('ipc'))
    .slice(0, limit);

  const taskMap = new Map();
  for (const e of cache.edges) {
    if (e.kind === 'task_link' && e.source.startsWith('task:')) {
      if (!taskMap.has(e.source)) taskMap.set(e.source, []);
      taskMap.get(e.source).push(e.target);
    }
  }
  const taskLinks = [...taskMap.entries()]
    .map(([taskId, files]) => ({ taskId, fileCount: files.length, files: files.slice(0, 6) }))
    .sort((a, b) => b.fileCount - a.fileCount)
    .slice(0, limit);

  return {
    generatedAt: cache.generatedAt,
    gitHead: cache.gitHead,
    generator: cache.generator,
    languages: cache.languages,
    totals: {
      files: Object.keys(cache.files).length,
      symbols: cache.symbols.length,
      edges: cache.edges.length,
    },
    hubFiles,
    modules,
    topCoChanges,
    crossLangCalls,
    taskLinks,
  };
}

function truncateBudget(text, maxChars) {
  if (text.length <= maxChars) return text;
  const suffix = `\n... [truncated at ${maxChars} chars; pass --max-chars <N> or narrow query]`;
  return text.slice(0, Math.max(100, maxChars - suffix.length)) + suffix;
}

function formatFreshnessNotice(freshness) {
  if (!freshness || freshness.status === 'fresh') return '';
  const parts = [];
  if (freshness.gitHeadChanged) {
    parts.push(`git HEAD changed (now ${freshness.currentGitHead || 'unknown'})`);
  }
  if (freshness.staleFiles.length > 0) {
    const sample = freshness.staleFiles.slice(0, 6).join(', ');
    const more = freshness.staleFiles.length > 6 ? ` (+${freshness.staleFiles.length - 6} more)` : '';
    parts.push(`modified since index: ${sample}${more}`);
  }
  if (freshness.untrackedCodeFiles.length > 0) {
    const sample = freshness.untrackedCodeFiles.slice(0, 5).join(', ');
    parts.push(`unindexed new files: ${sample}`);
  }
  if (freshness.deletedFiles.length > 0) {
    parts.push(`deleted files: ${freshness.deletedFiles.slice(0, 4).join(', ')}`);
  }
  return `⚠️  [STALE CACHE] ${parts.join(' | ')} — verify modified files directly with read_file/grep.\n`;
}

function formatExploreText(result) {
  const lines = [];
  const staleBanner = formatFreshnessNotice(result.freshness);
  if (staleBanner) lines.push(staleBanner.trimEnd());

  if (!result.found) {
    lines.push(`No matching file, symbol, or task found in codegraph for "${result.query}".`);
    lines.push('Fallback: use grep/glob/read_file directly.');
    return lines.join('\n');
  }

  lines.push(`🔍 Scoped Subgraph for "${result.query}" (hops=${result.hops}, source=${result.generator}):`);
  lines.push('Matches:');
  for (const m of result.matches) {
    lines.push(`  • [${m.kind}] ${m.id}`);
  }

  if (result.snippets.length > 0) {
    lines.push('\nDefinitions / Source:');
    for (const s of result.snippets) {
      lines.push(`--- ${s.title} (${s.file}:${s.startLine}-${s.endLine}) ---`);
      lines.push(s.code);
    }
  }

  if (result.incoming.length > 0) {
    lines.push(`\nIncoming Callers / Importers (${result.incoming.length}):`);
    for (const e of result.incoming.slice(0, 20)) {
      lines.push(`  ← [${e.kind}, w=${e.weight}] ${e.label} (${e.provenance || 'ast'})`);
    }
  }

  if (result.outgoing.length > 0) {
    lines.push(`\nOutgoing Callees / Imports (${result.outgoing.length}):`);
    for (const e of result.outgoing.slice(0, 20)) {
      lines.push(`  → [${e.kind}, w=${e.weight}] ${e.label} (${e.provenance || 'ast'})`);
    }
  }

  if (result.coChanges.length > 0) {
    lines.push(`\nLearned Co-Change Neighbors (${result.coChanges.length}):`);
    for (const e of result.coChanges.slice(0, 12)) {
      lines.push(`  ↔ [co_change, w=${e.weight}] ${e.peer} (${e.provenance || 'git'})`);
    }
  }

  if (result.taskLinks.length > 0) {
    lines.push(`\nLinked Trellis Tasks (${result.taskLinks.length}):`);
    for (const e of result.taskLinks.slice(0, 10)) {
      lines.push(`  • ${e.source} ↔ ${e.target}`);
    }
  }

  return truncateBudget(lines.join('\n'), result.maxChars || DEFAULT_MAX_CHARS);
}

function formatSummaryText(summaryData, freshness, maxChars = DEFAULT_MAX_CHARS) {
  const lines = [];
  const staleBanner = formatFreshnessNotice(freshness);
  if (staleBanner) lines.push(staleBanner.trimEnd());

  lines.push(
    `🗺️  CodeGraph Summary (${summaryData.totals.files} files, ${summaryData.totals.symbols} symbols, ${summaryData.totals.edges} edges | langs: ${summaryData.languages.join(', ') || 'none'})`
  );

  if (summaryData.modules.length > 0) {
    lines.push('\nModules:');
    for (const m of summaryData.modules) {
      lines.push(`  • ${m.module}: ${m.files} files, ${m.symbols} symbols`);
    }
  }

  if (summaryData.hubFiles.length > 0) {
    lines.push('\nTop Hub Files (by incoming edges):');
    for (const h of summaryData.hubFiles) {
      lines.push(`  • ${h.file} [${h.language}] hubScore=${h.hubScore} symbols=${h.symbolCount}`);
    }
  }

  if (summaryData.topCoChanges.length > 0) {
    lines.push('\nStrongest Co-Change Pairs (Git + Task history):');
    for (const c of summaryData.topCoChanges) {
      lines.push(`  ↔ ${c.source} ↔ ${c.target} (w=${c.weight}, ${c.provenance})`);
    }
  }

  if (summaryData.crossLangCalls.length > 0) {
    lines.push('\nCross-Language IPC Calls:');
    for (const c of summaryData.crossLangCalls) {
      lines.push(`  → ${c.source} → ${c.target} (${c.provenance})`);
    }
  }

  if (summaryData.taskLinks.length > 0) {
    lines.push('\nTask File Overlays:');
    for (const t of summaryData.taskLinks) {
      lines.push(`  • ${t.taskId}: ${t.fileCount} files (${t.files.join(', ')})`);
    }
  }

  return truncateBudget(lines.join('\n'), maxChars);
}

function inspectCacheStatus(projectDir = process.cwd()) {
  const rootDir = resolveProjectRoot(projectDir);
  const loaded = loadGraphCache(rootDir);
  if (!loaded.ok) {
    return {
      projectRoot: rootDir,
      cachePath: loaded.cachePath,
      state: loaded.reason, // 'missing' | 'invalid'
      error: loaded.error || null,
    };
  }
  const freshness = checkFreshness(rootDir, loaded.cache);
  return {
    projectRoot: rootDir,
    cachePath: loaded.cachePath,
    state: freshness.status, // 'fresh' | 'stale'
    generatedAt: loaded.cache.generatedAt,
    generator: loaded.cache.generator,
    languages: loaded.cache.languages,
    totals: {
      files: Object.keys(loaded.cache.files).length,
      symbols: loaded.cache.symbols.length,
      edges: loaded.cache.edges.length,
    },
    freshness,
  };
}

function explore(query, opts = {}) {
  const rootDir = resolveProjectRoot(opts.cwd || process.cwd());
  if (!query || !String(query).trim()) {
    console.error('Usage: lean-trellis graph explore "<symbol-or-file>" [--hops 1|2] [--max-chars N] [--json]');
    process.exitCode = 1;
    return null;
  }

  const loaded = loadGraphCache(rootDir);
  if (!loaded.ok) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, reason: loaded.reason, error: loaded.error || null, cachePath: loaded.cachePath }, null, 2));
    } else {
      console.log(`ℹ️  CodeGraph cache not available (${loaded.reason}) at ${path.relative(rootDir, loaded.cachePath)}.`);
      console.log('   Open this project in trellis-card to generate AST cache, or fallback to grep/read_file.');
    }
    return null;
  }

  const result = buildScopedSubgraph(rootDir, loaded.cache, query, opts);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatExploreText(result));
  }
  return result;
}

function summary(opts = {}) {
  const rootDir = resolveProjectRoot(opts.cwd || process.cwd());
  const loaded = loadGraphCache(rootDir);
  if (!loaded.ok) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, reason: loaded.reason, error: loaded.error || null, cachePath: loaded.cachePath }, null, 2));
    } else {
      console.log(`ℹ️  CodeGraph cache not available (${loaded.reason}) at ${path.relative(rootDir, loaded.cachePath)}.`);
      console.log('   Open this project in trellis-card to generate AST cache, or fallback to ls/grep.');
    }
    return null;
  }

  const freshness = checkFreshness(rootDir, loaded.cache);
  const summaryData = buildSummary(loaded.cache, opts);
  if (opts.json) {
    console.log(JSON.stringify({ ...summaryData, freshness }, null, 2));
  } else {
    console.log(formatSummaryText(summaryData, freshness, Number(opts.maxChars) || DEFAULT_MAX_CHARS));
  }
  return { summaryData, freshness };
}

function status(opts = {}) {
  const info = inspectCacheStatus(opts.cwd || process.cwd());
  if (opts.json) {
    console.log(JSON.stringify(info, null, 2));
    return info;
  }

  if (info.state === 'missing') {
    console.log(`ℹ️  CodeGraph Cache: Not indexed yet (optional) — expected at ${info.cachePath}`);
  } else if (info.state === 'invalid') {
    console.log(`⚠️  CodeGraph Cache: Invalid (${info.error}) at ${info.cachePath}`);
  } else {
    const { files, symbols, edges } = info.totals;
    console.log(`✅ CodeGraph Cache: ${info.state.toUpperCase()} (${files} files, ${symbols} symbols, ${edges} edges)`);
    console.log(`   Generator: ${info.generator} | Generated: ${info.generatedAt} | Languages: ${info.languages.join(', ') || 'none'}`);
    const notice = formatFreshnessNotice(info.freshness);
    if (notice) console.log(notice.trimEnd());
  }
  return info;
}

module.exports = {
  getCachePath,
  loadGraphCache,
  checkFreshness,
  buildScopedSubgraph,
  buildSummary,
  inspectCacheStatus,
  explore,
  summary,
  status,
};
