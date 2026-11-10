#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pkg = require('../package.json');
const { install, doctor } = require('../lib/installer');
const memory = require('../lib/memory');

const args = process.argv.slice(2);

function isLocalDevLink() {
  try {
    const globalPath = execSync('npm root -g', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const pkgPath = path.join(globalPath, pkg.name);
    if (fs.existsSync(pkgPath) && fs.lstatSync(pkgPath).isSymbolicLink()) {
      return true;
    }
  } catch (_) {}
  return false;
}

function upgradeGlobalCLI() {
  if (isLocalDevLink()) {
    console.log(`ℹ️  Running in local development mode (linked via npm link).`);
    console.log(`   Skipping remote npm install to preserve local workspace symlink.\n`);
    return;
  }

  console.log(`\n📦 Upgrading global CLI (${pkg.name}) from GitHub...`);
  const repo = 'baobinhday/lean-trellis-workflow';
  try {
    execSync(`npm install -g ${repo}`, { stdio: 'inherit' });
    console.log(`✅ Global CLI upgraded successfully!\n`);
  } catch (err) {
    console.warn(`⚠️  Could not automatically update global npm package: ${err.message}`);
    console.warn(`   You can update manually by running: npm install -g ${repo}\n`);
  }
}

function parseMemFlags(rawArgs) {
  const opts = { cwd: process.cwd() };
  const positional = [];
  for (let idx = 0; idx < rawArgs.length; idx++) {
    const a = rawArgs[idx];
    if (a === '--platform' && rawArgs[idx + 1]) opts.platform = rawArgs[++idx];
    else if (a === '--since' && rawArgs[idx + 1]) opts.since = rawArgs[++idx];
    else if (a === '--until' && rawArgs[idx + 1]) opts.until = rawArgs[++idx];
    else if (a === '--cwd' && rawArgs[idx + 1]) opts.cwd = rawArgs[++idx];
    else if (a === '--limit' && rawArgs[idx + 1]) opts.limit = Number(rawArgs[++idx]);
    else if (a === '--grep' && rawArgs[idx + 1]) opts.grep = rawArgs[++idx];
    else if (a === '--turns' && rawArgs[idx + 1]) opts.turns = Number(rawArgs[++idx]);
    else if (a === '--around' && rawArgs[idx + 1]) opts.around = Number(rawArgs[++idx]);
    else if (a === '--max-chars' && rawArgs[idx + 1]) opts.maxChars = Number(rawArgs[++idx]);
    else if (a === '--phase' && rawArgs[idx + 1]) opts.phase = rawArgs[++idx];
    else if (a === '--global') opts.global = true;
    else if (a === '--json') opts.json = true;
    else positional.push(a);
  }
  return { opts, positional };
}

// Memory recall / read / search / context / extract / projects / list handling
if (args[0] === 'mem') {
  const sub = args[1];
  const { opts, positional } = parseMemFlags(args.slice(2));
  if (sub === 'recall') {
    memory.recall(positional.join(' '), opts);
    process.exit(0);
  } else if (sub === 'read') {
    memory.read(positional, opts);
    process.exit(0);
  } else if (sub === 'search') {
    memory.search(positional.join(' '), opts);
    process.exit(0);
  } else if (sub === 'context') {
    memory.context(positional[0], opts);
    process.exit(0);
  } else if (sub === 'extract') {
    memory.extract(positional[0], opts);
    process.exit(0);
  } else if (sub === 'projects') {
    memory.projects(opts);
    process.exit(0);
  } else if (sub === 'list' || sub === 'ls') {
    memory.list(opts);
    process.exit(0);
  } else if (sub === 'help' || sub === '--help' || sub === '-h' || !sub) {
    console.log(`
Lean Trellis Memory Engine (mem):

USAGE:
  $ lean-trellis mem recall "<query>"                     Search project Markdown & past AI sessions together
  $ lean-trellis mem read "<ref>"...                      Expand one or more doc/session refs from recall
  $ lean-trellis mem search "<keyword>" [flags]           Search cleaned AI dialogue across platforms
  $ lean-trellis mem context <session-id> [--grep <kw>]   Drill into top hit turns + surrounding turns
  $ lean-trellis mem extract <session-id> [--phase <p>]   Dump cleaned dialogue (all | brainstorm | implement)
  $ lean-trellis mem projects [--since YYYY-MM-DD]        List active project cwds across platforms
  $ lean-trellis mem list                                 List specs, research topics, journals & sessions

FLAGS:
  --platform claude|codex|devin|grok|pi|antigravity|all   Filter conversation platform (default: all)
  --since YYYY-MM-DD / --until YYYY-MM-DD                 Date range filter
  --cwd <path> / --global                                 Project scope or all-project search
  --grep <kw> / --turns N / --around N / --max-chars N    Context/extract filtering & token budget
  --phase brainstorm|implement|all                        Slice session by planning vs implementation phase
  --limit N / --json                                      Result cap & JSON output
`);
    process.exit(0);
  } else {
    const allParsed = parseMemFlags(args.slice(1));
    memory.recall(allParsed.positional.join(' '), allParsed.opts);
    process.exit(0);
  }
} else if (args[0] === 'recall') {
  const { opts, positional } = parseMemFlags(args.slice(1));
  memory.recall(positional.join(' '), opts);
  process.exit(0);
} else if (args[0] === 'read') {
  const { opts, positional } = parseMemFlags(args.slice(1));
  memory.read(positional, opts);
  process.exit(0);
} else if (args[0] === 'check-update') {
  checkForUpdate(false);
  process.exit(0);
}

function showHelp() {
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

USAGE:
  $ lean-trellis [command] [options] [target-directory]

COMMANDS:
  init, install            Initialize Lean Trellis Workflow & memory layer in target project (Default)
  upgrade, refresh         Upgrade skills, hooks, and scripts in an existing project
  check-update             Check npm registry for newer CLI package versions
  doctor                   Check prerequisites, memory layer, and skills configuration
  mem recall "<query>"     Search past project decisions and dialogue history
  mem read "<ref>"         Read detailed excerpt referenced from recall
  recall "<query>"         Short alias for mem recall
  help                     Show this help message
  version                  Show version

OPTIONS:
  -u, --user <name>       Developer username for .trellis/workspace/<name>
  -a, --agent <agents>    Select target coding agents (claude, cursor, antigravity, codex, opencode, windsurf, all)
                          (repeatable or comma-separated, default: all)
  --with-uiux, --uiux     Also install UIUX Orchestrator & specialist skills (Taste, Impeccable, Motion, etc.)
  -h, --help              Show help
  -v, --version           Show version

EXAMPLES:
  # Initialize or upgrade in current directory:
  $ lean-trellis init
  $ lean-trellis upgrade

  # Initialize only for specific agents (e.g. Cursor & Claude Code):
  $ lean-trellis init -a cursor,claude

  # Initialize with full UI/UX specialist skills:
  $ lean-trellis init -a cursor --with-uiux

  # Check for package updates:
  $ lean-trellis check-update

  # Initialize in a specific project:
  $ lean-trellis init /path/to/my-project -u my-name -a antigravity

  # Recall past project decisions & history:
  $ lean-trellis mem recall "authentication"
  $ lean-trellis recall "database schema"

  # Check configuration:
  $ lean-trellis doctor
`);
}

let command = 'init';
let targetDir = process.cwd();
let user = null;
const agents = [];
let withUiux = false;

let i = 0;
while (i < args.length) {
  const arg = args[i];
  if (arg === '-h' || arg === '--help' || arg === 'help') {
    showHelp();
    process.exit(0);
  } else if (arg === '-v' || arg === '--version' || arg === 'version') {
    console.log(`${pkg.name} v${pkg.version}`);
    process.exit(0);
  } else if (arg === '-u' || arg === '--user') {
    user = args[++i];
  } else if (arg === '-a' || arg === '--agent') {
    agents.push(args[++i]);
  } else if (arg === '--with-uiux' || arg === '--uiux') {
    withUiux = true;
  } else if (arg === 'init' || arg === 'install') {
    command = 'init';
  } else if (arg === 'upgrade' || arg === 'refresh') {
    command = 'upgrade';
  } else if (arg === 'doctor') {
    command = 'doctor';
  } else if (!arg.startsWith('-')) {
    targetDir = arg;
  }
  i++;
}

try {
  if (command === 'doctor') {
    doctor(targetDir);
  } else if (command === 'upgrade') {
    upgradeGlobalCLI();
    install({ targetDir, user, agents, withUiux });
  } else {
    install({ targetDir, user, agents, withUiux });
  }
} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
