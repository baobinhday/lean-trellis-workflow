const fs = require('fs');
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

  // Always scan .trellis explicitly
  const trellisDir = path.join(rootDir, '.trellis');
  if (fs.existsSync(trellisDir)) {
    const targets = ['spec', 'research', 'workspace'];
    for (const t of targets) {
      const sub = path.join(trellisDir, t);
      if (fs.existsSync(sub)) walk(sub);
    }
  }

  // Scan root docs, READMEs, AGENTS.md, etc.
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
  return `doc:v1:${base64}`;
}

function decodeRef(refStr) {
  if (!refStr.startsWith('doc:v1:')) return null;
  try {
    const base64 = refStr.slice(7);
    const jsonStr = Buffer.from(base64, 'base64url').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (_) {
    return null;
  }
}

function recall(query, options = {}) {
  const rootDir = resolveProjectRoot(options.cwd || process.cwd());
  const maxHits = options.maxHits || 10;
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

      // Exact phrase match
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

        // Extract a clean snippet (up to 400 chars)
        let snippet = text.trim();
        if (snippet.length > 400) {
          snippet = snippet.slice(0, 397) + '…';
        }

        hits.push({
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

  hits.sort((a, b) => b.score - a.score);
  const selectedHits = hits.slice(0, maxHits);

  if (selectedHits.length === 0) {
    console.log('\n0 hit(s)');
    return;
  }

  for (const hit of selectedHits) {
    console.log(`\n[doc] ${hit.relPath}:${hit.line}  § ${hit.heading}  ${hit.strength}`);
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
    let filePath = '';
    let startLine = 1;

    if (decoded && decoded.path) {
      filePath = path.join(rootDir, decoded.path);
      startLine = decoded.start || 1;
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
}

module.exports = {
  recall,
  read,
  list,
  resolveProjectRoot
};
