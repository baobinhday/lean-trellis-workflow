#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');
const { install, doctor } = require('../lib/installer');

const args = process.argv.slice(2);

function resolveMiniTrellisBin() {
  const localBin = path.join(__dirname, '..', 'node_modules', '.bin', 'mini-trellis');
  if (fs.existsSync(localBin)) return localBin;
  return 'mini-trellis';
}

// Memory recall / read delegation
if (args[0] === 'mem') {
  const bin = resolveMiniTrellisBin();
  const result = spawnSync(bin, ['mem', ...args.slice(1)], { stdio: 'inherit' });
  process.exit(result.status !== null ? result.status : 0);
} else if (args[0] === 'recall') {
  const bin = resolveMiniTrellisBin();
  const result = spawnSync(bin, ['mem', 'recall', ...args.slice(1)], { stdio: 'inherit' });
  process.exit(result.status !== null ? result.status : 0);
} else if (args[0] === 'read') {
  const bin = resolveMiniTrellisBin();
  const result = spawnSync(bin, ['mem', 'read', ...args.slice(1)], { stdio: 'inherit' });
  process.exit(result.status !== null ? result.status : 0);
}

function showHelp() {
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

USAGE:
  $ lean-trellis [command] [options] [target-directory]

COMMANDS:
  init, install            Initialize Lean Trellis Workflow & memory layer in target project (Default)
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
  # Initialize in current directory:
  $ lean-trellis init
  $ lean-trellis .

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
  } else {
    install({ targetDir, user });
  }
} catch (err) {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
}
