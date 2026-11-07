#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pkg = require('../package.json');
const { install, doctor } = require('../lib/installer');
const memory = require('../lib/memory');

const args = process.argv.slice(2);

function checkForUpdate(silent = false) {
  try {
    const latest = execSync(`npm view ${pkg.name} version`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 3000
    }).trim();
    if (latest && latest !== pkg.version) {
      console.log(`\n💡 A newer version of ${pkg.name} is available: v${latest} (installed: v${pkg.version})`);
      console.log(`   To update global CLI: npm i -g ${pkg.name}\n`);
      return true;
    } else if (!silent) {
      console.log(`\n✅ ${pkg.name} is up to date (v${pkg.version})\n`);
    }
  } catch (_) {
    if (!silent) {
      console.log(`\nℹ️  Unable to check remote registry (offline or network timeout). Current version: v${pkg.version}\n`);
    }
  }
  return false;
}

// Memory recall / read / list handling (Native Lean Trellis Memory Engine)
if (args[0] === 'mem') {
  const sub = args[1];
  if (sub === 'recall') {
    memory.recall(args[2], { cwd: process.cwd() });
    process.exit(0);
  } else if (sub === 'read') {
    memory.read(args.slice(2), { cwd: process.cwd() });
    process.exit(0);
  } else if (sub === 'list' || sub === 'ls') {
    memory.list({ cwd: process.cwd() });
    process.exit(0);
  } else if (sub === 'help' || !sub) {
    console.log(`
Lean Trellis Memory Engine (mem):

USAGE:
  $ lean-trellis mem recall "<query>"    Search past project decisions and documents
  $ lean-trellis mem read "<ref>"...     Read full excerpt referenced from recall
  $ lean-trellis mem list                List all specs, research topics, and journals
`);
    process.exit(0);
  } else {
    // Treat as query for recall
    memory.recall(args.slice(1).join(' '), { cwd: process.cwd() });
    process.exit(0);
  }
} else if (args[0] === 'recall') {
  memory.recall(args.slice(1).join(' '), { cwd: process.cwd() });
  process.exit(0);
} else if (args[0] === 'read') {
  memory.read(args.slice(1), { cwd: process.cwd() });
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
  -u, --user <name>   Developer username for .trellis/workspace/<name>
  -h, --help          Show help
  -v, --version       Show version

EXAMPLES:
  # Initialize or upgrade in current directory:
  $ lean-trellis init
  $ lean-trellis upgrade

  # Check for package updates:
  $ lean-trellis check-update

  # Initialize in a specific project:
  $ lean-trellis init /path/to/my-project -u my-name

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
    checkForUpdate(true);
    install({ targetDir, user });
  } else {
    install({ targetDir, user });
  }
} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
