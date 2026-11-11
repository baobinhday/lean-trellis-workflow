const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const DEFAULT_AGENTS = ['claude', 'codex', 'opencode'];

const AGENT_CHOICES = [
  { id: 'claude', label: 'claude', desc: 'Claude Code (.claude/)', defaultSelected: true },
  { id: 'codex', label: 'codex', desc: 'Codex (.codex/ & .agents/)', defaultSelected: true },
  { id: 'opencode', label: 'opencode', desc: 'OpenCode (.opencode/)', defaultSelected: true },
  { id: 'cursor', label: 'cursor', desc: 'Cursor (.cursor/)', defaultSelected: false },
  { id: 'antigravity', label: 'antigravity', desc: 'Google Antigravity / Gemini CLI (.agent/)', defaultSelected: false },
  { id: 'windsurf', label: 'windsurf', desc: 'Windsurf (.windsurf/)', defaultSelected: false }
];

function sanitizeName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-');
}

function detectDevName(targetDir) {
  try {
    const gitUser = execSync('git config user.name', { cwd: targetDir, stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (gitUser) return sanitizeName(gitUser);
  } catch (_) {}

  const envUser = process.env.USER || process.env.USERNAME || 'developer';
  return sanitizeName(envUser);
}

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dst, file));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function hasExplicitAgents(agentsInput) {
  if (Array.isArray(agentsInput)) {
    return agentsInput.some(a => String(a).trim().length > 0);
  }
  if (typeof agentsInput === 'string') {
    return agentsInput.trim().length > 0;
  }
  return false;
}

function resolveAgents(agentsInput) {
  let list = [];
  if (Array.isArray(agentsInput)) {
    list = agentsInput.flatMap(a => String(a).split(','));
  } else if (typeof agentsInput === 'string' && agentsInput.trim()) {
    list = agentsInput.split(',');
  }
  const normalized = list.map(a => a.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) {
    return new Set(DEFAULT_AGENTS);
  }
  if (normalized.includes('all')) {
    return new Set(['all', 'claude', 'cursor', 'antigravity', 'codex', 'opencode', 'windsurf']);
  }
  return new Set(normalized);
}

function promptAgentsInteractive() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve([...DEFAULT_AGENTS]);
  }

  if (typeof process.stdin.setRawMode !== 'function') {
    return new Promise((resolve) => {
      console.log('\n🤖 Chọn coding agents cần cài đặt (Mặc định: claude, codex, opencode):');
      AGENT_CHOICES.forEach((item, idx) => {
        const mark = item.defaultSelected ? '[x]' : '[ ]';
        console.log(`  ${mark} ${idx + 1}) ${item.label.padEnd(12)} — ${item.desc}`);
      });
      console.log(`  [ ] 7) all          — Tất cả các agents trên`);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('\nNhập số thứ tự hoặc tên agent (cách nhau bởi dấu phẩy, Enter để chọn mặc định): ', (answer) => {
        rl.close();
        const trimmed = (answer || '').trim().toLowerCase();
        if (!trimmed) return resolve([...DEFAULT_AGENTS]);
        const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
        const chosen = [];
        for (const t of tokens) {
          if (t === '7' || t === 'all') return resolve(['all']);
          const num = Number(t);
          if (Number.isInteger(num) && num >= 1 && num <= AGENT_CHOICES.length) {
            chosen.push(AGENT_CHOICES[num - 1].id);
          } else {
            chosen.push(t);
          }
        }
        resolve(chosen.length > 0 ? chosen : [...DEFAULT_AGENTS]);
      });
    });
  }

  return new Promise((resolve) => {
    let cursor = 0;
    const selected = new Set(DEFAULT_AGENTS);
    const totalLines = AGENT_CHOICES.length + 2;
    let renderedOnce = false;

    const getOrderedSelected = () => AGENT_CHOICES.map(c => c.id).filter(id => selected.has(id));

    const render = () => {
      if (renderedOnce) {
        process.stdout.write(`\x1b[${totalLines}A\x1b[J`);
      }
      const lines = [
        '🤖 Chọn coding agents cần cài đặt (↑/↓ di chuyển, Space/1-6 chọn, a chọn hết, Enter xác nhận):'
      ];
      AGENT_CHOICES.forEach((item, idx) => {
        const pointer = idx === cursor ? '❯' : ' ';
        const check = selected.has(item.id) ? '[x]' : '[ ]';
        lines.push(`  ${pointer} ${check} ${idx + 1}) ${item.label.padEnd(12)} — ${item.desc}`);
      });
      const currentList = getOrderedSelected();
      lines.push(
        currentList.length > 0
          ? `   Đang chọn: ${currentList.join(', ')}`
          : `   Đang chọn: (trống — nhấn Enter sẽ dùng mặc định: ${DEFAULT_AGENTS.join(', ')})`
      );
      process.stdout.write(lines.join('\n') + '\n');
      renderedOnce = true;
    };

    const cleanup = () => {
      process.stdout.write('\x1b[?25h');
      try {
        process.stdin.setRawMode(false);
      } catch (_) {}
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    };

    const onData = (buf) => {
      const str = buf.toString('utf8');

      if (str === '\u0003') {
        cleanup();
        process.stdout.write('\n');
        process.exit(130);
      }

      if (str === '\r' || str === '\n') {
        cleanup();
        const finalAgents = getOrderedSelected();
        const result = finalAgents.length > 0 ? finalAgents : [...DEFAULT_AGENTS];
        console.log(`  ✓ Đã chọn agents: ${result.join(', ')}\n`);
        resolve(result);
        return;
      }

      if (str === '\u001b[A' || str === 'k' || str === 'K') {
        cursor = (cursor - 1 + AGENT_CHOICES.length) % AGENT_CHOICES.length;
        render();
        return;
      }

      if (str === '\u001b[B' || str === 'j' || str === 'J') {
        cursor = (cursor + 1) % AGENT_CHOICES.length;
        render();
        return;
      }

      if (str === ' ') {
        const id = AGENT_CHOICES[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
        return;
      }

      if (str >= '1' && str <= String(AGENT_CHOICES.length)) {
        const idx = Number(str) - 1;
        cursor = idx;
        const id = AGENT_CHOICES[idx].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
        return;
      }

      if (str === 'a' || str === 'A') {
        if (selected.size === AGENT_CHOICES.length) {
          selected.clear();
        } else {
          AGENT_CHOICES.forEach(c => selected.add(c.id));
        }
        render();
      }
    };

    process.stdout.write('\x1b[?25l');
    render();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function install(options = {}) {
  const rootDir = path.resolve(__dirname, '..');
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const devName = sanitizeName(options.user || detectDevName(targetDir));
  let agentsInput = options.agents;
  if (!hasExplicitAgents(agentsInput)) {
    agentsInput = await promptAgentsInteractive();
  }
  const selectedAgents = resolveAgents(agentsInput);
  const isAllAgents = selectedAgents.has('all');
  const templatesDir = path.join(rootDir, 'templates');
  const trellisTemplates = path.join(templatesDir, 'trellis');
  const skillsSrc = path.join(rootDir, 'skills');

  const activeAgentsList = isAllAgents ? ['all (claude, cursor, antigravity, codex, opencode, windsurf)'] : [...selectedAgents];

  const isUpgrade = fs.existsSync(path.join(targetDir, '.trellis'));
  if (isUpgrade) {
    console.log(`🔄 Upgrading / Refreshing Lean Trellis Workflow:`);
    console.log(`   Target:    ${targetDir}`);
    console.log(`   Developer: ${devName}`);
    console.log(`   Agents:    ${activeAgentsList.join(', ')}`);
    console.log(`   (Existing journals, research topics, and specs are safely preserved)\n`);
  } else {
    console.log(`🚀 Installing Lean Trellis Workflow (All-in-One):`);
    console.log(`   Target:    ${targetDir}`);
    console.log(`   Developer: ${devName}`);
    console.log(`   Agents:    ${activeAgentsList.join(', ')}\n`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // Clean up legacy commands/manifests if present
  const staleItems = [
    path.join(targetDir, '.claude', 'commands', 'mini-trellis'),
    path.join(targetDir, '.opencode', 'commands', 'mini-trellis'),
    path.join(targetDir, '.opencode', 'plugins', 'mini-trellis'),
    path.join(targetDir, '.trellis', '.mini-trellis-manifest.json')
  ];
  for (const item of staleItems) {
    try { fs.rmSync(item, { recursive: true, force: true }); } catch (_) {}
  }

  // 1. Memory Layer (.trellis/)
  console.log('📦 1. Setting up memory layer (.trellis/)...');
  const trellisDir = path.join(targetDir, '.trellis');
  fs.mkdirSync(path.join(trellisDir, 'scripts', 'common'), { recursive: true });
  fs.mkdirSync(path.join(trellisDir, 'spec', 'guides'), { recursive: true });
  fs.mkdirSync(path.join(trellisDir, 'research'), { recursive: true });
  fs.mkdirSync(path.join(trellisDir, 'workspace', devName), { recursive: true });

  // Copy scripts
  copyRecursive(path.join(trellisTemplates, 'scripts'), path.join(trellisDir, 'scripts'));
  try {
    const scripts = fs.readdirSync(path.join(trellisDir, 'scripts'));
    for (const s of scripts) {
      if (s.endsWith('.py')) {
        fs.chmodSync(path.join(trellisDir, 'scripts', s), 0o755);
      }
    }
  } catch (_) {}

  // Config & gitignore
  const configDest = path.join(trellisDir, 'config.yaml');
  if (!fs.existsSync(configDest)) {
    fs.copyFileSync(path.join(trellisTemplates, 'config.yaml'), configDest);
  }
  const gitignoreDest = path.join(trellisDir, '.gitignore');
  if (!fs.existsSync(gitignoreDest)) {
    fs.copyFileSync(path.join(trellisTemplates, 'gitignore.txt'), gitignoreDest);
  }

  // Spec guides & Research README
  const guidesSrcDir = path.join(trellisTemplates, 'spec', 'guides');
  const guidesDstDir = path.join(trellisDir, 'spec', 'guides');
  if (fs.existsSync(guidesSrcDir)) {
    fs.mkdirSync(guidesDstDir, { recursive: true });
    for (const gf of fs.readdirSync(guidesSrcDir)) {
      if (gf === 'mini-memory.md' && fs.existsSync(path.join(guidesDstDir, 'lean-memory.md'))) continue;
      const dstFile = path.join(guidesDstDir, gf);
      // Always sync index.md and any missing standard thinking guides
      if (gf === 'index.md' || gf === 'lean-trellis-lifecycle.md' || !fs.existsSync(dstFile)) {
        fs.copyFileSync(path.join(guidesSrcDir, gf), dstFile);
      }
    }
  }
  const researchReadme = path.join(trellisDir, 'research', 'README.md');
  if (!fs.existsSync(researchReadme)) {
    fs.copyFileSync(path.join(trellisTemplates, 'research', 'README.md'), researchReadme);
  }

  // Developer info
  fs.writeFileSync(path.join(trellisDir, '.developer'), devName + '\n');
  const devIndex = path.join(trellisDir, 'workspace', devName, 'index.md');
  if (!fs.existsSync(devIndex)) {
    fs.writeFileSync(devIndex, `# Developer Journal: ${devName}\n\n| Session | Date | Title | Commit | Branch |\n|---|---|---|---|---|\n<!-- @@@/auto:session-history -->\n`);
  }
  const devJournal = path.join(trellisDir, 'workspace', devName, 'journal-1.md');
  if (!fs.existsSync(devJournal)) {
    fs.writeFileSync(devJournal, `# Journal: ${devName} (Part 1)\n\n`);
  }
  console.log('  ✓ Initialized .trellis/ structure');

  // 2. SessionStart Hooks
  console.log('🔗 2. Setting up SessionStart hooks...');
  const hookFile = path.join(trellisTemplates, 'hooks', 'session-start.py');
  const configuredHooks = [];

  // Claude
  if (selectedAgents.has('claude') || isAllAgents) {
    const claudeHooksDir = path.join(targetDir, '.claude', 'hooks');
    fs.mkdirSync(claudeHooksDir, { recursive: true });
    fs.copyFileSync(hookFile, path.join(claudeHooksDir, 'session-start.py'));
    const claudeSettings = path.join(targetDir, '.claude', 'settings.json');
    if (!fs.existsSync(claudeSettings)) {
      const settingsContent = {
        env: { CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: '1' },
        hooks: {
          SessionStart: [
            { matcher: 'startup', hooks: [{ type: 'command', command: 'python3 .claude/hooks/session-start.py', timeout: 30 }] },
            { matcher: 'clear', hooks: [{ type: 'command', command: 'python3 .claude/hooks/session-start.py', timeout: 30 }] },
            { matcher: 'compact', hooks: [{ type: 'command', command: 'python3 .claude/hooks/session-start.py', timeout: 30 }] }
          ]
        }
      };
      fs.writeFileSync(claudeSettings, JSON.stringify(settingsContent, null, 2) + '\n');
    }
    configuredHooks.push('Claude Code');
  }

  // Cursor
  if (selectedAgents.has('cursor') || isAllAgents) {
    const cursorHooksDir = path.join(targetDir, '.cursor', 'hooks');
    fs.mkdirSync(cursorHooksDir, { recursive: true });
    fs.copyFileSync(hookFile, path.join(cursorHooksDir, 'session-start.py'));
    const cursorHooks = path.join(targetDir, '.cursor', 'hooks.json');
    if (!fs.existsSync(cursorHooks)) {
      const hooksContent = {
        version: 1,
        hooks: { sessionStart: [{ command: 'python3 .cursor/hooks/session-start.py' }] }
      };
      fs.writeFileSync(cursorHooks, JSON.stringify(hooksContent, null, 2) + '\n');
    }
    configuredHooks.push('Cursor');
  }

  // Codex
  if (selectedAgents.has('codex') || isAllAgents) {
    const codexHooksDir = path.join(targetDir, '.codex', 'hooks');
    fs.mkdirSync(codexHooksDir, { recursive: true });
    fs.copyFileSync(hookFile, path.join(codexHooksDir, 'session-start.py'));
    const codexHooks = path.join(targetDir, '.codex', 'hooks.json');
    if (!fs.existsSync(codexHooks)) {
      const codexContent = {
        hooks: {
          SessionStart: [
            { matcher: 'startup', hooks: [{ type: 'command', command: 'python3 .codex/hooks/session-start.py', timeout: 30 }] }
          ]
        }
      };
      fs.writeFileSync(codexHooks, JSON.stringify(codexContent, null, 2) + '\n');
    }
    const codexConfig = path.join(targetDir, '.codex', 'config.toml');
    if (!fs.existsSync(codexConfig)) {
      fs.writeFileSync(codexConfig, '[hooks]\nenabled = true\n');
    }
    configuredHooks.push('Codex');
  }
  if (configuredHooks.length > 0) {
    console.log(`  ✓ Configured SessionStart hooks for: ${configuredHooks.join(', ')}`);
  } else {
    console.log('  ℹ️  No specific SessionStart hooks required for selected agents');
  }

  // 3. Skills Installation
  console.log('🧠 3. Installing Skills...');
  const skillDirs = [];
  if (selectedAgents.has('antigravity') || isAllAgents) {
    skillDirs.push(path.join(targetDir, '.agent', 'skills'));
  }
  if (selectedAgents.has('cursor') || isAllAgents) {
    skillDirs.push(path.join(targetDir, '.cursor', 'skills'));
  }
  if (selectedAgents.has('claude') || isAllAgents) {
    skillDirs.push(path.join(targetDir, '.claude', 'skills'));
  }
  if (selectedAgents.has('codex') || isAllAgents) {
    skillDirs.push(path.join(targetDir, '.agents', 'skills'));
  }
  if (selectedAgents.has('opencode') || (isAllAgents && fs.existsSync(path.join(targetDir, '.opencode')))) {
    skillDirs.push(path.join(targetDir, '.opencode', 'skills'));
  }
  if (selectedAgents.has('windsurf') || isAllAgents) {
    skillDirs.push(path.join(targetDir, '.windsurf', 'skills'));
  }
  const uniqueSkillDirs = [...new Set(skillDirs)];

  for (const baseDir of uniqueSkillDirs) {
    fs.mkdirSync(baseDir, { recursive: true });
    // Remove stale legacy skills
    try {
      for (const item of fs.readdirSync(baseDir)) {
        if (item.startsWith('mini-trellis-')) {
          fs.rmSync(path.join(baseDir, item), { recursive: true, force: true });
        }
      }
    } catch (_) {}

    // Copy new lean-trellis-* skills
    if (fs.existsSync(skillsSrc)) {
      for (const skill of fs.readdirSync(skillsSrc)) {
        const srcPath = path.join(skillsSrc, skill);
        if (fs.statSync(srcPath).isDirectory()) {
          copyRecursive(srcPath, path.join(baseDir, skill));
        }
      }
    }
    console.log(`  ✓ Synced 4 skills to: ${path.relative(targetDir, baseDir)}`);
  }

  // 4. Supporting CLI helper
  const scriptsDir = path.join(targetDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const newFeatureSrc = path.join(rootDir, 'scripts', 'new-feature.sh');
  const newFeatureDst = path.join(scriptsDir, 'new-feature.sh');
  if (fs.existsSync(newFeatureSrc)) {
    fs.copyFileSync(newFeatureSrc, newFeatureDst);
    try { fs.chmodSync(newFeatureDst, 0o755); } catch (_) {}
    console.log('  ✓ Configured task automation helper: scripts/new-feature.sh');
  }

  // 5. AGENTS.md
  console.log('📝 4. Configuring AGENTS.md instructions...');
  const agentsFile = path.join(targetDir, 'AGENTS.md');
  const workflowBlock = `<!-- LEAN_TRELLIS_WORKFLOW:START -->
## Large Feature Development Workflow (Lean Trellis Workflow)
100% Conversational UX via Natural Chat (no manual terminal commands required by user):
1. When user chats: "Create task/feature <name>", "Plan <name>", "/plan <name>", "Tạo task <tên>", or "Lập kế hoạch <tên>":
   - Automatically initialize \`.trellis/research/<slug>/\` with \`prd.md\` (Status: Draft), \`design.md\` (Status: Draft), \`implement.md\` (Status: Planning).
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
   - Upon user confirmation of PRD, promote \`prd.md\` and \`design.md\` to Status: Approved.
2. When user chats: "Implement task <name>", "Triển khai task <tên>" (or "... theo TDD", "... kèm UI", "... dùng UIUX skill"):
   - Update \`implement.md\` header to Status: In Progress.
   - If the task involves Frontend / UI:
     - Read \`.trellis/spec/design-system.md\` as the authoritative source of truth for tokens and styling primitives.
     - Strictly enforce **The 6 Mandatory UI States**: Normal, Loading (Skeleton), Empty, Error, Validation, Responsive (Mobile 390px / Desktop 1280px).
     - If \`uiux-orchestrator\` / UIUX skills are installed, route capability slots to specialist skills (e.g. UI UX Pro Max for data table/form UX, Emil Kowalski for motion physics, Impeccable for contrast/polish).
   - Read \`implement.md\`, execute step-by-step directly in the current session (use Behavior-Slice TDD — Red test on public interface ➔ Green ➔ Refactor — when requested).
   - Test each step and check off \`[x]\` upon completion (strictly in Section 1 checklist; keep Risk Watchlist as plain bullet points).
   - Once all tasks are checked off (before verification/nghiệm thu):
     - Update \`implement.md\` header to Status: Verification.
     - Inspect \`git status --porcelain\` and \`git log --oneline -5\`; separate AI-edited files from unrecognized dirty files (never silently stage unrelated WIP).
     - Output 2 ready-to-run Git commands:
       1. \`git add <specific AI-edited files>\` (list specific files, avoid \`git add .\`)
       2. \`git commit -m "<conventional commit message>"\`
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in \`prd.md\`, run test suite.
   - Upon successful verification, update \`prd.md\`, \`design.md\`, and \`implement.md\` to Status: Completed.
   - Update specs and log session with \`add_session.py\` (referencing the commit hash if committed).
4. When user chats: "Bootstrap specs", "Khởi tạo spec cho dự án":
   - Follow \`lean-trellis-update-spec\` (\`references/bootstrap-codebase-specs.md\`) to analyze repository architecture and write source-backed specs into \`.trellis/spec/\` with zero template placeholders.
5. When user chats: "Tạo spec design cho dự án", "Khởi tạo design spec", "Bootstrap design spec":
   - Follow \`lean-trellis-update-spec\` (\`references/bootstrap-design-system-spec.md\`) to scan repository styling, tokens, and write \`.trellis/spec/design-system.md\` with zero template placeholders.
<!-- LEAN_TRELLIS_WORKFLOW:END -->`;

  const memoryBlock = `<!-- TRELLIS:START -->
# Lean Trellis Memory Layer

This project uses Lean Trellis as a memory layer. Working knowledge lives under \`.trellis/\`:

- \`.trellis/spec/\` — durable contracts (short markdown; read \`index.md\` first)
- \`.trellis/research/\` — topic inbox (\`<topic>.md\`; \`README.md\` is not a topic)
- \`.trellis/workspace/\` — per-developer journals

Record a session with the \`lean-trellis-remember\` skill, \`/lean-trellis-remember\`, or \`$lean-trellis-remember\`. When earlier decisions or relevant project rules are needed, use \`lean-trellis mem recall "<topic or path>"\`; expand evidence with \`lean-trellis mem read "<ref>"\`. Promote lasting boundaries into spec with \`lean-trellis-update-spec\`.

For a confirmed update, follow this short order: read the existing topic; edit that file; read it back and check the new rule; run \`python3 ./.trellis/scripts/add_session.py --title "..." --summary "..." --topic <actual-topic-path>\`.
<!-- TRELLIS:END -->`;

  if (!fs.existsSync(agentsFile)) {
    const fullContent = `# AI Assistant Instructions\n\nThis project is managed by Lean Trellis Workflow & Memory Layer.\n\n${memoryBlock}\n\n${workflowBlock}\n`;
    fs.writeFileSync(agentsFile, fullContent);
    console.log('  ✓ Created AGENTS.md');
  } else {
    let content = fs.readFileSync(agentsFile, 'utf8');
    if (content.includes('<!-- TRELLIS:START -->')) {
      content = content.replace(/<!-- TRELLIS:START -->[\s\S]*?<!-- TRELLIS:END -->/, memoryBlock);
    } else {
      content = memoryBlock + '\n\n' + content;
    }
    if (content.includes('<!-- LEAN_TRELLIS_WORKFLOW:START -->')) {
      content = content.replace(/<!-- LEAN_TRELLIS_WORKFLOW:START -->[\s\S]*?<!-- LEAN_TRELLIS_WORKFLOW:END -->/, workflowBlock);
    } else {
      content += '\n\n' + workflowBlock + '\n';
    }
    fs.writeFileSync(agentsFile, content);
    console.log('  ✓ Updated AGENTS.md');
  }

  // 6. Optional: UIUX Orchestrator & Specialist Skills
  if (options.withUiux) {
    console.log('🎨 5. Installing UIUX Orchestrator & Specialist Skills...');
    try {
      const uiuxAgentArgs = [];
      if (!isAllAgents) {
        const agentMap = {
          'claude': 'claude-code',
          'cursor': 'cursor',
          'codex': 'codex',
          'antigravity': 'gemini-cli',
          'opencode': 'opencode',
          'windsurf': 'windsurf'
        };
        for (const [ourAgent, uiuxAgent] of Object.entries(agentMap)) {
          if (selectedAgents.has(ourAgent)) {
            uiuxAgentArgs.push(`--agent ${uiuxAgent}`);
          }
        }
      }
      const agentFlags = uiuxAgentArgs.join(' ');
      const cmd = `npx -y uiux-orchestrator install --project ${agentFlags}`.trim();
      console.log(`   Running: ${cmd}`);
      execSync(cmd, { cwd: targetDir, stdio: 'inherit' });

      if (selectedAgents.has('antigravity') || isAllAgents) {
        const srcUiux = path.join(targetDir, '.agents', 'skills', 'uiux-orchestrator');
        const dstUiux = path.join(targetDir, '.agent', 'skills', 'uiux-orchestrator');
        if (fs.existsSync(srcUiux) && !fs.existsSync(dstUiux)) {
          copyRecursive(srcUiux, dstUiux);
        }
      }
      console.log('  ✓ UIUX Orchestrator & Specialist Skills ready');
    } catch (err) {
      console.warn(`  ⚠️  Note: Could not run 'npx uiux-orchestrator install': ${err.message}`);
      console.warn(`     (Built-in Design System Spec is active in .trellis/)`);
    }
  }

  if (isUpgrade) {
    console.log('\n🎉 Lean Trellis Workflow successfully upgraded / refreshed!');
    console.log('All skills, hooks, and automation helpers have been updated to the latest version.\n');
  } else {
    console.log('\n🎉 Lean Trellis Workflow successfully installed!');
    console.log('Now you can interact directly via natural chat prompts in your IDE:');
    console.log('  • Plan:      "Plan <feature>" or "Tạo task <tên>"');
    console.log('  • Implement: "Implement task <feature>" or "Triển khai task <tên>"');
    console.log('  • Verify:    "Check task <feature>" or "Nghiệm thu task <tên>"\n');
  }
}

function doctor(targetDir = process.cwd()) {
  const resolvedDir = path.resolve(targetDir);
  console.log(`🩺 Checking Lean Trellis Environment in: ${resolvedDir}\n`);

  const checks = [];

  // Check Node.js
  checks.push({ name: 'Node.js runtime', status: true, detail: process.version });

  // Check Python 3
  try {
    const pyVer = execSync('python3 --version', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    checks.push({ name: 'Python 3', status: true, detail: pyVer });
  } catch (_) {
    checks.push({ name: 'Python 3', status: false, detail: 'Not found (required for memory scripts)' });
  }

  // Check Git
  try {
    const gitVer = execSync('git --version', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    checks.push({ name: 'Git CLI', status: true, detail: gitVer });
  } catch (_) {
    checks.push({ name: 'Git CLI', status: false, detail: 'Not found' });
  }

  // Check memory recall engine (Built-in Native)
  checks.push({
    name: 'Memory recall engine',
    status: true,
    detail: 'Ready (lean-trellis native)'
  });

  // Check .trellis/
  const trellisDir = path.join(resolvedDir, '.trellis');
  const trellisExists = fs.existsSync(trellisDir);
  checks.push({
    name: 'Memory layer (.trellis/)',
    status: trellisExists,
    detail: trellisExists ? 'Present' : 'Missing (run: lean-trellis init)'
  });

  // Check Skills across supported agent directories
  const candidateSkillDirs = [
    '.claude/skills',
    '.agents/skills',
    '.opencode/skills',
    '.cursor/skills',
    '.agent/skills',
    '.windsurf/skills'
  ];
  const installedSkillDirs = candidateSkillDirs.filter(rel =>
    fs.existsSync(path.join(resolvedDir, rel, 'lean-trellis-workflow'))
  );
  const hasSkills = installedSkillDirs.length > 0;
  checks.push({
    name: 'Lean Trellis Skills',
    status: hasSkills,
    detail: hasSkills ? `Installed (${installedSkillDirs.join(', ')})` : 'Missing'
  });

  // Check AGENTS.md
  const agentsFile = path.join(resolvedDir, 'AGENTS.md');
  const hasAgents = fs.existsSync(agentsFile) && fs.readFileSync(agentsFile, 'utf8').includes('LEAN_TRELLIS_WORKFLOW');
  checks.push({
    name: 'AGENTS.md instructions',
    status: hasAgents,
    detail: hasAgents ? 'Configured' : 'Missing'
  });

  console.log('| Component | Status | Details |');
  console.log('|:---|:---:|:---|');
  for (const c of checks) {
    console.log(`| ${c.name.padEnd(25)} | ${c.status ? '✅ PASS' : '⚠️ WARN'} | ${c.detail} |`);
  }
  console.log('');
}

module.exports = {
  install,
  doctor,
  detectDevName
};
