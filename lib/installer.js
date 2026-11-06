const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function install(options = {}) {
  const rootDir = path.resolve(__dirname, '..');
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const devName = sanitizeName(options.user || detectDevName(targetDir));
  const templatesDir = path.join(rootDir, 'templates');
  const trellisTemplates = path.join(templatesDir, 'trellis');
  const skillsSrc = path.join(rootDir, 'skills');

  console.log(`🚀 Installing Lean Trellis Workflow (All-in-One):`);
  console.log(`   Target:    ${targetDir}`);
  console.log(`   Developer: ${devName}\n`);

  fs.mkdirSync(targetDir, { recursive: true });

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
  const specIndex = path.join(trellisDir, 'spec', 'guides', 'index.md');
  if (!fs.existsSync(specIndex)) {
    copyRecursive(path.join(trellisTemplates, 'spec', 'guides'), path.join(trellisDir, 'spec', 'guides'));
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

  // Claude
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

  // Cursor
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

  // Codex
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
  console.log('  ✓ Configured SessionStart hooks for Claude Code, Cursor, Codex');

  // 3. Skills Installation
  console.log('🧠 3. Installing Skills...');
  const skillDirs = [
    path.join(targetDir, '.agent', 'skills'),
    path.join(targetDir, '.agents', 'skills'),
    path.join(targetDir, '.claude', 'skills'),
    path.join(targetDir, '.cursor', 'skills')
  ];
  if (fs.existsSync(path.join(targetDir, '.opencode'))) {
    skillDirs.push(path.join(targetDir, '.opencode', 'skills'));
  }

  for (const baseDir of skillDirs) {
    fs.mkdirSync(baseDir, { recursive: true });
    // Remove stale mini-trellis-* skills
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
   - Automatically initialize \`.trellis/research/<slug>/\` with \`prd.md\`, \`design.md\`, \`implement.md\`.
   - Inspect codebase before asking questions; ask at most 1 high-value question with recommendation & trade-off.
2. When user chats: "Implement task <name>", "Triển khai task <tên>":
   - Read \`implement.md\`, execute step-by-step directly in the current session.
   - Test each step and check off \`[x]\` upon completion.
3. When user chats: "Check task <name>", "Verify task <name>", "Nghiệm thu task <tên>":
   - Verify Acceptance Criteria in \`prd.md\`, run test suite, update specs, and log session with \`add_session.py\`.
<!-- LEAN_TRELLIS_WORKFLOW:END -->`;

  const memoryBlock = `<!-- TRELLIS:START -->
# mini-trellis

This project uses mini-trellis as a memory layer. Working knowledge lives under \`.trellis/\`:

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
    if (content.includes('<!-- LEAN_TRELLIS_WORKFLOW:START -->')) {
      content = content.replace(/<!-- LEAN_TRELLIS_WORKFLOW:START -->[\s\S]*?<!-- LEAN_TRELLIS_WORKFLOW:END -->/, workflowBlock);
    } else {
      content += '\n\n' + workflowBlock + '\n';
    }
    fs.writeFileSync(agentsFile, content);
    console.log('  ✓ Updated AGENTS.md');
  }

  console.log('\n🎉 Lean Trellis Workflow successfully installed!');
  console.log('Now you can interact directly via natural chat prompts in your IDE:');
  console.log('  • Plan:      "Plan <feature>" or "Tạo task <tên>"');
  console.log('  • Implement: "Implement task <feature>" or "Triển khai task <tên>"');
  console.log('  • Verify:    "Check task <feature>" or "Nghiệm thu task <tên>"\n');
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

  // Check mini-trellis CLI
  try {
    const mtVer = execSync('mini-trellis --version', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    checks.push({ name: 'mini-trellis CLI', status: true, detail: mtVer });
  } catch (_) {
    checks.push({ name: 'mini-trellis CLI', status: false, detail: 'Optional (run: npm i -g mini-trellis for `mem recall`)' });
  }

  // Check .trellis/
  const trellisDir = path.join(resolvedDir, '.trellis');
  const trellisExists = fs.existsSync(trellisDir);
  checks.push({
    name: 'Memory layer (.trellis/)',
    status: trellisExists,
    detail: trellisExists ? 'Present' : 'Missing (run: lean-trellis init)'
  });

  // Check Skills
  const agentSkills = path.join(resolvedDir, '.agent', 'skills');
  const hasSkills = fs.existsSync(path.join(agentSkills, 'lean-trellis-workflow'));
  checks.push({
    name: 'Lean Trellis Skills',
    status: hasSkills,
    detail: hasSkills ? 'Installed (.agent/skills)' : 'Missing'
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
