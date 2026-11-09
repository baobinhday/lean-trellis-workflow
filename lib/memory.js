const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function resolveProjectRoot(start = process.cwd()) {
  const abs = path.resolve(start);
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: abs,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    if (out) return out;
  } catch (_) {}
  return abs;
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.runtime',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.venv',
  'venv'
]);

const SYSTEM_TAG_REGEX = /<(system-reminder|workflow-state|INSTRUCTIONS|environment_context|permissions instructions|collaboration_mode|ADDITIONAL_METADATA|USER_SETTINGS_CHANGE)\b[^>]*>[\s\S]*?<\/\1>/gi;
const USER_REQUEST_WRAPPER = /<\/?USER_REQUEST>/gi;

function cleanDialogueText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(SYSTEM_TAG_REGEX, '')
    .replace(USER_REQUEST_WRAPPER, '')
    .trim();
  // Drop Codex bootstrap AGENTS.md preamble turns
  if (text.startsWith('# AI Assistant Instructions') && text.includes('TRELLIS:START')) {
    return '';
  }
  return text.trim();
}

function discoverMarkdownFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.trellis') continue;
      if (EXCLUDED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath);
      }
    }
  }

  const trellisDir = path.join(rootDir, '.trellis');
  if (fs.existsSync(trellisDir)) {
    const targets = ['spec', 'research', 'workspace'];
    for (const t of targets) {
      const sub = path.join(trellisDir, t);
      if (fs.existsSync(sub)) walk(sub);
    }
  }

  try {
    const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(path.join(rootDir, entry.name));
      } else if (entry.isDirectory() && (entry.name === 'docs' || entry.name === 'doc')) {
        walk(path.join(rootDir, entry.name));
      }
    }
  } catch (_) {}

  return [...new Set(files)];
}

function parseMarkdownSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = {
    heading: 'Document Top',
    startLine: 1,
    lines: []
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^#{1,4}\s+(.*)/);
    if (headerMatch) {
      if (currentSection.lines.length > 0 || currentSection.heading !== 'Document Top') {
        sections.push(currentSection);
      }
      currentSection = {
        heading: headerMatch[1].trim(),
        startLine: i + 1,
        lines: [line]
      };
    } else {
      currentSection.lines.push(line);
    }
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

function encodeRef(payload) {
  const jsonStr = JSON.stringify(payload);
  const base64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const prefix = payload.kind === 'session' ? 'session:v1:' : 'doc:v1:';
  return `${prefix}${base64}`;
}

function decodeRef(refStr) {
  if (!refStr || typeof refStr !== 'string') return null;
  let base64 = null;
  if (refStr.startsWith('doc:v1:')) base64 = refStr.slice(7);
  else if (refStr.startsWith('session:v1:')) base64 = refStr.slice(11);
  if (!base64) return null;
  try {
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

// ============================================================================
// Cross-Platform Session Discovery & Parsing (Claude, Codex, Devin, Grok, Pi, OpenCode, Antigravity)
// ============================================================================

function sanitizeClaudeCwd(cwdPath) {
  return cwdPath.replace(/[/_]/g, '-');
}

function extractTextFromContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return cleanDialogueText(content);
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (typeof block === 'string') {
        parts.push(block);
      } else if (block && block.type === 'text' && typeof block.text === 'string') {
        parts.push(block.text);
      } else if (block && block.type === 'input_text' && typeof block.text === 'string') {
        parts.push(block.text);
      } else if (block && block.type === 'output_text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
    }
    return cleanDialogueText(parts.join('\n'));
  }
  return '';
}

function detectPhaseBoundary(rawLine) {
  if (!rawLine) return null;
  if (/task\.py\s+create\b|new-feature\.sh\b|\.trellis\/research\/[^/\s]+\/prd\.md/.test(rawLine)) {
    const slugMatch = rawLine.match(/(?:--slug\s+|new-feature\.sh\s+|\.trellis\/research\/)([a-z0-9_-]+)/i);
    return { type: 'create', label: slugMatch ? slugMatch[1] : 'task' };
  }
  if (/task\.py\s+start\b|\*\*Status:\*\*\s*In Progress/i.test(rawLine)) {
    return { type: 'start' };
  }
  return null;
}

function parseJsonlSession(filePath, platform, defaultCwd) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_) {
    return null;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }

  const lines = content.split('\n').filter(Boolean);
  const turns = [];
  const boundaries = [];
  let sessionCwd = defaultCwd || '';
  let sessionId = path.basename(filePath, path.extname(filePath));
  let timestamp = stat.mtime.toISOString();

  for (const line of lines) {
    const b = detectPhaseBoundary(line);
    if (b) {
      boundaries.push({ ...b, turnIndex: turns.length });
    }

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (_) {
      continue;
    }

    if (obj.cwd && !sessionCwd) sessionCwd = obj.cwd;
    if (obj.sessionId && sessionId.startsWith('rollout-')) sessionId = obj.sessionId;
    if (obj.timestamp && turns.length === 0) timestamp = obj.timestamp;
    if (obj.created_at && turns.length === 0) timestamp = obj.created_at;

    if (platform === 'claude') {
      if (obj.type === 'summary' || obj.isCompactSummary) {
        turns.push({ role: 'system', text: '[compaction summary]' });
        continue;
      }
      const role = obj.type === 'user' ? 'user' : obj.type === 'assistant' ? 'assistant' : (obj.message && obj.message.role);
      if (role === 'user' || role === 'assistant') {
        const msgContent = obj.message ? obj.message.content : obj.content;
        const text = extractTextFromContent(msgContent);
        if (text) turns.push({ role, text });
      }
    } else if (platform === 'codex') {
      if (obj.type === 'session_meta' && obj.payload && obj.payload.cwd) {
        sessionCwd = obj.payload.cwd;
        if (obj.payload.id) sessionId = obj.payload.id;
      } else if (obj.type === 'response_item' && obj.payload && (obj.payload.role === 'user' || obj.payload.role === 'assistant')) {
        const text = extractTextFromContent(obj.payload.content);
        if (text) turns.push({ role: obj.payload.role, text });
      } else if (obj.role === 'user' || obj.role === 'assistant') {
        const text = extractTextFromContent(obj.content);
        if (text) turns.push({ role: obj.role, text });
      }
    } else if (platform === 'antigravity') {
      if (obj.type === 'USER_INPUT' && obj.content) {
        const text = cleanDialogueText(obj.content);
        if (text) turns.push({ role: 'user', text });
      } else if (obj.type === 'PLANNER_RESPONSE' && obj.content) {
        const text = cleanDialogueText(obj.content);
        if (text) turns.push({ role: 'assistant', text });
      }
    } else {
      // Grok, Pi, ZCode generic JSONL message format
      const role = obj.role || (obj.message && obj.message.role);
      if (role === 'user' || role === 'assistant') {
        const text = extractTextFromContent(obj.content || (obj.message && obj.message.content) || obj.text);
        if (text) turns.push({ role, text });
      }
    }
  }

  if (turns.length === 0) return null;

  return {
    id: sessionId.slice(0, 12),
    fullId: sessionId,
    platform,
    cwd: sessionCwd,
    timestamp,
    mtimeMs: stat.mtimeMs,
    filePath,
    turns,
    boundaries
  };
}

function discoverSqliteSessions(dbPath, platform) {
  if (!fs.existsSync(dbPath)) return [];
  try {
    if (platform === 'devin') {
      // Cognition Devin CLI (~/.local/share/devin/cli/sessions.db)
      const sql = "SELECT s.id, s.cwd, s.updated_at, m.role, m.content FROM sessions s JOIN message_nodes m ON m.session_id = s.id WHERE m.role IN ('user', 'assistant') ORDER BY s.updated_at DESC, m.created_at ASC LIMIT 2000;";
      const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2500
      }).trim();
      if (!out) return [];
      const rows = JSON.parse(out);
      const map = new Map();
      for (const r of rows) {
        if (!map.has(r.id)) {
          map.set(r.id, {
            id: String(r.id).slice(0, 12),
            fullId: String(r.id),
            platform: 'devin',
            cwd: r.cwd || '',
            timestamp: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
            mtimeMs: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
            filePath: dbPath,
            turns: [],
            boundaries: []
          });
        }
        const text = cleanDialogueText(typeof r.content === 'string' ? r.content : '');
        if (text) map.get(r.id).turns.push({ role: r.role, text });
      }
      return [...map.values()].filter(s => s.turns.length > 0);
    }
  } catch (_) {}
  return [];
}

function discoverSessions(options = {}) {
  const home = os.homedir();
  const rootDir = resolveProjectRoot(options.cwd || process.cwd());
  const globalMode = Boolean(options.global);
  const platformFilter = (options.platform || 'all').toLowerCase();
  const sinceDate = options.since ? new Date(options.since).getTime() : 0;
  const untilDate = options.until ? new Date(options.until + 'T23:59:59Z').getTime() : Infinity;

  const sessions = [];

  function walkJsonl(dir, maxDepth = 4, depth = 0) {
    if (depth > maxDepth || !fs.existsSync(dir)) return [];
    const results = [];
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return [];
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        results.push(...walkJsonl(p, maxDepth, depth + 1));
      } else if (e.isFile() && e.name.endsWith('.jsonl') && !e.name.endsWith('_full.jsonl')) {
        results.push(p);
      }
    }
    return results;
  }

  // 1. Claude Code (~/.claude/projects/)
  if (platformFilter === 'all' || platformFilter === 'claude') {
    const claudeBase = path.join(home, '.claude', 'projects');
    if (fs.existsSync(claudeBase)) {
      const targetSanitized = sanitizeClaudeCwd(rootDir);
      const dirs = globalMode
        ? fs.readdirSync(claudeBase).map(d => path.join(claudeBase, d))
        : [path.join(claudeBase, targetSanitized)];
      for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        for (const f of walkJsonl(d, 1)) {
          const s = parseJsonlSession(f, 'claude', globalMode ? path.basename(d) : rootDir);
          if (s) sessions.push(s);
        }
      }
    }
  }

  // 2. Codex CLI (~/.codex/sessions/)
  if (platformFilter === 'all' || platformFilter === 'codex') {
    const codexBase = path.join(home, '.codex', 'sessions');
    if (fs.existsSync(codexBase)) {
      for (const f of walkJsonl(codexBase, 4)) {
        const s = parseJsonlSession(f, 'codex', '');
        if (s && (globalMode || !s.cwd || s.cwd.startsWith(rootDir))) {
          sessions.push(s);
        }
      }
    }
  }

  // 3. Devin CLI (~/.local/share/devin/cli/sessions.db)
  if (platformFilter === 'all' || platformFilter === 'devin') {
    const devinDb = path.join(home, '.local', 'share', 'devin', 'cli', 'sessions.db');
    for (const s of discoverSqliteSessions(devinDb, 'devin')) {
      if (globalMode || !s.cwd || s.cwd.startsWith(rootDir)) {
        sessions.push(s);
      }
    }
  }

  // 4. Grok CLI (~/.grok/sessions/)
  if (platformFilter === 'all' || platformFilter === 'grok') {
    const grokBase = path.join(home, '.grok', 'sessions');
    if (fs.existsSync(grokBase)) {
      for (const f of walkJsonl(grokBase, 3)) {
        const rel = path.relative(grokBase, f);
        const encodedCwd = rel.split(path.sep)[0] || '';
        let decodedCwd = '';
        try { decodedCwd = decodeURIComponent(encodedCwd); } catch (_) {}
        if (globalMode || !decodedCwd || decodedCwd.startsWith(rootDir)) {
          const s = parseJsonlSession(f, 'grok', decodedCwd || rootDir);
          if (s) sessions.push(s);
        }
      }
    }
  }

  // 5. Pi (~/.pi/agent/sessions/)
  if (platformFilter === 'all' || platformFilter === 'pi') {
    const piBase = path.join(home, '.pi', 'agent', 'sessions');
    if (fs.existsSync(piBase)) {
      for (const f of walkJsonl(piBase, 3)) {
        const s = parseJsonlSession(f, 'pi', rootDir);
        if (s && (globalMode || !s.cwd || s.cwd.startsWith(rootDir))) {
          sessions.push(s);
        }
      }
    }
  }

  // 6. Antigravity (~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl)
  if (platformFilter === 'all' || platformFilter === 'antigravity') {
    const agyBase = path.join(home, '.gemini', 'antigravity', 'brain');
    if (fs.existsSync(agyBase)) {
      for (const f of walkJsonl(agyBase, 4)) {
        if (path.basename(f) !== 'transcript.jsonl') continue;
        const parts = f.split(path.sep);
        const brainIdx = parts.indexOf('brain');
        const convId = brainIdx >= 0 && parts[brainIdx + 1] ? parts[brainIdx + 1] : path.basename(f);
        const s = parseJsonlSession(f, 'antigravity', rootDir);
        if (s) {
          s.fullId = convId;
          s.id = convId.slice(0, 12);
          sessions.push(s);
        }
      }
    }
  }

  return sessions
    .filter(s => s.mtimeMs >= sinceDate && s.mtimeMs <= untilDate)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function scoreSession(session, queryWords) {
  let userHits = 0;
  let asstHits = 0;
  const matchingTurns = [];

  for (let i = 0; i < session.turns.length; i++) {
    const t = session.turns[i];
    const lower = t.text.toLowerCase();
    let turnHits = 0;
    let matchedTokens = 0;

    for (const w of queryWords) {
      if (lower.includes(w)) {
        matchedTokens++;
        let idx = 0;
        while ((idx = lower.indexOf(w, idx)) !== -1) {
          turnHits++;
          idx += w.length;
        }
      }
    }

    if (turnHits > 0) {
      if (t.role === 'user') userHits += turnHits;
      else if (t.role === 'assistant') asstHits += turnHits;
      matchingTurns.push({ index: i, role: t.role, text: t.text, turnHits, matchedTokens });
    }
  }

  if (userHits === 0 && asstHits === 0) return null;

  // Trellis canonical score formula: (3 * user_hits + asst_hits) / total_turns
  const totalTurns = Math.max(1, session.turns.length);
  const score = (3 * userHits + asstHits) / totalTurns;

  matchingTurns.sort((a, b) => (b.matchedTokens - a.matchedTokens) || (b.turnHits - a.turnHits));

  return {
    session,
    score,
    userHits,
    asstHits,
    totalHits: userHits + asstHits,
    matchingTurns
  };
}

function sliceTurnsByPhase(session, phase = 'all') {
  if (!phase || phase === 'all' || !session.boundaries || session.boundaries.length === 0) {
    return session.turns;
  }

  const windows = [];
  let currentWindow = null;

  for (const b of session.boundaries) {
    if (b.type === 'create') {
      if (currentWindow) {
        currentWindow.end = b.turnIndex;
        windows.push(currentWindow);
      }
      currentWindow = { label: b.label || 'task', start: b.turnIndex, end: session.turns.length };
    } else if (b.type === 'start') {
      if (currentWindow) {
        currentWindow.end = b.turnIndex;
        windows.push(currentWindow);
        currentWindow = null;
      } else {
        windows.push({ label: 'task', start: 0, end: b.turnIndex });
      }
    }
  }
  if (currentWindow) windows.push(currentWindow);

  if (windows.length === 0) return session.turns;

  const inBrainstorm = new Set();
  for (const w of windows) {
    for (let i = w.start; i < w.end; i++) inBrainstorm.add(i);
  }

  if (phase === 'brainstorm') {
    return session.turns.filter((_, idx) => inBrainstorm.has(idx));
  } else if (phase === 'implement') {
    return session.turns.filter((_, idx) => !inBrainstorm.has(idx));
  }
  return session.turns;
}

// ============================================================================
// CLI Commands: recall, read, search, context, extract, projects, list
// ============================================================================

function recall(query, options = {}) {
  const rootDir = resolveProjectRoot(options.cwd || process.cwd());
  const maxHits = Number(options.limit || options.maxHits || 10);
  if (!query || typeof query !== 'string' || !query.trim()) {
    console.log('0 hit(s)');
    return;
  }

  const queryClean = query.trim().toLowerCase();
  const queryWords = queryClean.split(/\s+/).filter(Boolean);
  const files = discoverMarkdownFiles(rootDir);
  const hits = [];

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (_) {
      continue;
    }

    const relPath = path.relative(rootDir, file);
    const sections = parseMarkdownSections(content);

    for (const sec of sections) {
      const headingLower = sec.heading.toLowerCase();
      const text = sec.lines.join('\n');
      const textLower = text.toLowerCase();

      let score = 0;
      let matches = 0;

      if (headingLower.includes(queryClean)) {
        score += 100;
        matches = queryWords.length;
      } else if (textLower.includes(queryClean)) {
        score += 50;
        matches = queryWords.length;
      } else {
        for (const w of queryWords) {
          if (headingLower.includes(w)) {
            score += 20;
            matches++;
          } else if (textLower.includes(w)) {
            score += 5;
            matches++;
          }
        }
      }

      if (score > 0) {
        const strength = (score >= 50 || matches === queryWords.length) ? 'strong' : 'moderate';
        const ref = encodeRef({
          kind: 'doc',
          path: relPath,
          start: sec.startLine,
          title: sec.heading
        });

        let snippet = text.trim();
        if (snippet.length > 400) {
          snippet = snippet.slice(0, 397) + '…';
        }

        hits.push({
          kind: 'doc',
          relPath,
          line: sec.startLine,
          heading: sec.heading,
          strength,
          ref,
          snippet,
          score
        });
      }
    }
  }

  // Also search local conversation sessions
  const sessions = discoverSessions(options);
  for (const s of sessions) {
    const scored = scoreSession(s, queryWords);
    if (scored && scored.matchingTurns.length > 0) {
      const topTurn = scored.matchingTurns[0];
      const ref = encodeRef({
        kind: 'session',
        sessionId: s.fullId,
        platform: s.platform,
        turn: topTurn.index,
        filePath: s.filePath
      });
      let snippet = `[${topTurn.role}] ${topTurn.text.trim()}`;
      if (snippet.length > 400) snippet = snippet.slice(0, 397) + '…';

      hits.push({
        kind: 'session',
        platform: s.platform,
        sessionId: s.id,
        timestamp: s.timestamp.slice(0, 16).replace('T', ' '),
        strength: scored.score >= 1.5 ? 'strong' : 'moderate',
        ref,
        snippet,
        score: scored.score * 25
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  const selectedHits = hits.slice(0, maxHits);

  if (options.json) {
    console.log(JSON.stringify(selectedHits, null, 2));
    return;
  }

  if (selectedHits.length === 0) {
    console.log('\n0 hit(s)');
    return;
  }

  for (const hit of selectedHits) {
    if (hit.kind === 'doc') {
      console.log(`\n[doc] ${hit.relPath}:${hit.line}  § ${hit.heading}  ${hit.strength}`);
    } else {
      console.log(`\n[${hit.platform}] ${hit.timestamp}  session:${hit.sessionId}  ${hit.strength}`);
    }
    console.log(`  ref: ${hit.ref}`);
    console.log(`  ${hit.snippet.split('\n').join('\n  ')}`);
  }

  console.log(`\n${selectedHits.length} hit(s)\n`);
}

function read(refs = [], options = {}) {
  const rootDir = resolveProjectRoot(options.cwd || process.cwd());
  if (!refs || refs.length === 0) {
    console.error('Error: Please provide at least one ref or file path to read.');
    process.exit(1);
  }

  for (const ref of refs) {
    const decoded = decodeRef(ref);
    if (decoded && decoded.kind === 'session') {
      console.log(`\n--- ${ref} (${decoded.platform} session ${decoded.sessionId})`);
      if (decoded.filePath && fs.existsSync(decoded.filePath)) {
        const s = parseJsonlSession(decoded.filePath, decoded.platform, rootDir);
        if (s) {
          const center = decoded.turn || 0;
          const start = Math.max(0, center - 1);
          const end = Math.min(s.turns.length - 1, center + 1);
          for (let i = start; i <= end; i++) {
            console.log(`\n[Turn ${i + 1} · ${s.turns[i].role}]\n${s.turns[i].text}`);
          }
          continue;
        }
      }
      console.error(`[Error: Session log not accessible]`);
      continue;
    }

    let filePath = '';
    if (decoded && decoded.path) {
      filePath = path.join(rootDir, decoded.path);
    } else {
      filePath = path.resolve(rootDir, ref);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`\n--- ${ref}`);
      console.error(`[Error: File not found: ${filePath}]`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\n--- ${ref}`);
    console.log(content.trimEnd());
  }
}

function search(query, options = {}) {
  if (!query || !query.trim()) {
    console.log('0 session(s)');
    return;
  }
  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sessions = discoverSessions(options);
  const results = [];

  for (const s of sessions) {
    const scored = scoreSession(s, queryWords);
    if (scored) results.push(scored);
  }

  results.sort((a, b) => b.score - a.score);
  const limit = Number(options.limit || 20);
  const selected = results.slice(0, limit);

  if (options.json) {
    console.log(JSON.stringify(selected.map(r => ({
      id: r.session.id,
      fullId: r.session.fullId,
      platform: r.session.platform,
      timestamp: r.session.timestamp,
      cwd: r.session.cwd,
      score: Number(r.score.toFixed(3)),
      hits: r.totalHits,
      userHits: r.userHits,
      asstHits: r.asstHits,
      turns: r.session.turns.length
    })), null, 2));
    return;
  }

  if (selected.length === 0) {
    console.log('\n0 session(s) matched.\n');
    return;
  }

  for (const r of selected) {
    const s = r.session;
    const dateStr = s.timestamp.slice(0, 16).replace('T', ' ');
    console.log(`\n[${s.platform.padEnd(8)}] ${dateStr}  ${s.id}  ${s.cwd || '.'}  score=${r.score.toFixed(3)}  hits=${r.totalHits} (u=${r.userHits},a=${r.asstHits})  turns=${s.turns.length}`);
    for (const m of r.matchingTurns.slice(0, 2)) {
      const preview = m.text.replace(/\s+/g, ' ').slice(0, 160);
      console.log(`    [${m.role}] ${preview}${m.text.length > 160 ? '…' : ''}`);
    }
  }
  console.log('');
}

function context(sessionId, options = {}) {
  if (!sessionId) {
    console.error('Error: Please provide a <session-id>.');
    process.exit(1);
  }
  const sessions = discoverSessions({ ...options, global: true });
  const target = sessions.find(s => s.fullId.startsWith(sessionId) || s.id.startsWith(sessionId));
  if (!target) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const maxTurns = Number(options.turns || 3);
  const around = Number(options.around !== undefined ? options.around : 1);
  const maxChars = Number(options.maxChars || 6000);
  const grepKw = (options.grep || '').trim().toLowerCase();

  let centerIndices = [];
  if (grepKw) {
    const words = grepKw.split(/\s+/).filter(Boolean);
    const scored = scoreSession(target, words);
    if (scored) {
      centerIndices = scored.matchingTurns.slice(0, maxTurns).map(t => t.index);
    }
  } else {
    centerIndices = Array.from({ length: Math.min(maxTurns, target.turns.length) }, (_, i) => i);
  }

  const selectedIndices = new Set();
  for (const c of centerIndices) {
    for (let i = Math.max(0, c - around); i <= Math.min(target.turns.length - 1, c + around); i++) {
      selectedIndices.add(i);
    }
  }

  const ordered = [...selectedIndices].sort((a, b) => a - b);
  let usedChars = 0;
  console.log(`\n=== Session ${target.id} (${target.platform}, ${target.timestamp.slice(0, 16).replace('T', ' ')}) ===`);
  for (const idx of ordered) {
    const t = target.turns[idx];
    let text = t.text;
    const perTurnCap = Math.floor(maxChars / 2);
    if (text.length > perTurnCap) text = text.slice(0, perTurnCap) + '… [truncated]';
    if (usedChars + text.length > maxChars) break;
    usedChars += text.length;
    console.log(`\n--- Turn ${idx + 1}/${target.turns.length} [${t.role}] ---\n${text}`);
  }
  console.log('');
}

function extract(sessionId, options = {}) {
  if (!sessionId) {
    console.error('Error: Please provide a <session-id>.');
    process.exit(1);
  }
  const sessions = discoverSessions({ ...options, global: true });
  const target = sessions.find(s => s.fullId.startsWith(sessionId) || s.id.startsWith(sessionId));
  if (!target) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const phase = options.phase || 'all';
  let turns = sliceTurnsByPhase(target, phase);
  if (options.grep) {
    const kw = options.grep.toLowerCase();
    turns = turns.filter(t => t.text.toLowerCase().includes(kw));
  }

  if (options.json) {
    console.log(JSON.stringify({
      id: target.fullId,
      platform: target.platform,
      cwd: target.cwd,
      phase,
      turns
    }, null, 2));
    return;
  }

  console.log(`\n=== Extracted Dialogue: ${target.id} (${target.platform}, phase=${phase}) ===\n`);
  for (const t of turns) {
    console.log(`## ${t.role === 'user' ? 'Human' : 'Assistant'}\n\n${t.text}\n`);
  }
}

function projects(options = {}) {
  const sessions = discoverSessions({ ...options, global: true });
  const map = new Map();
  for (const s of sessions) {
    const key = s.cwd || '(unknown)';
    if (!map.has(key)) {
      map.set(key, { cwd: key, mtimeMs: s.mtimeMs, timestamp: s.timestamp, count: 0, platforms: {} });
    }
    const entry = map.get(key);
    entry.count++;
    entry.platforms[s.platform] = (entry.platforms[s.platform] || 0) + 1;
    if (s.mtimeMs > entry.mtimeMs) {
      entry.mtimeMs = s.mtimeMs;
      entry.timestamp = s.timestamp;
    }
  }

  const list = [...map.values()].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, Number(options.limit || 20));
  if (options.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  for (const item of list) {
    const platStr = Object.entries(item.platforms).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`${item.timestamp.slice(0, 16).replace('T', ' ')}  sessions=${String(item.count).padStart(3)} (${platStr})  ${item.cwd}`);
  }
}

function list(options = {}) {
  const rootDir = resolveProjectRoot(options.cwd || process.cwd());
  const trellisDir = path.join(rootDir, '.trellis');
  console.log(`\n📚 Lean Trellis Memory Overview (${rootDir}):\n`);

  const specDir = path.join(trellisDir, 'spec');
  if (fs.existsSync(specDir)) {
    console.log('📌 Durable Specifications (.trellis/spec/):');
    const files = discoverMarkdownFiles(specDir);
    for (const f of files) {
      console.log(`  • ${path.relative(rootDir, f)}`);
    }
    console.log('');
  }

  const researchDir = path.join(trellisDir, 'research');
  if (fs.existsSync(researchDir)) {
    console.log('🔬 Research Topics & Tasks (.trellis/research/):');
    const files = discoverMarkdownFiles(researchDir);
    for (const f of files) {
      console.log(`  • ${path.relative(rootDir, f)}`);
    }
    console.log('');
  }

  const workspaceDir = path.join(trellisDir, 'workspace');
  if (fs.existsSync(workspaceDir)) {
    console.log('📝 Developer Journals (.trellis/workspace/):');
    const files = discoverMarkdownFiles(workspaceDir);
    for (const f of files) {
      console.log(`  • ${path.relative(rootDir, f)}`);
    }
    console.log('');
  }

  const sessions = discoverSessions(options).slice(0, Number(options.limit || 10));
  if (sessions.length > 0) {
    console.log('💬 Recent AI Conversation Sessions:');
    for (const s of sessions) {
      console.log(`  • [${s.platform}] ${s.timestamp.slice(0, 16).replace('T', ' ')}  id=${s.id}  turns=${s.turns.length}`);
    }
    console.log('');
  }
}

module.exports = {
  recall,
  read,
  search,
  context,
  extract,
  projects,
  list,
  resolveProjectRoot
};
