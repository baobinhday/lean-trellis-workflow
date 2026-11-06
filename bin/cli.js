#!/usr/bin/env node

const path = require('path');
const pkg = require('../package.json');
const { install, doctor } = require('../lib/installer');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
${pkg.name} v${pkg.version}
${pkg.description}

USAGE:
  $ lean-trellis [command] [options] [target-directory]

COMMANDS:
  init, install    Initialize Lean Trellis Workflow & memory layer in the target project (Default)
  doctor           Check prerequisites, memory layer, and skills configuration
  help             Show this help message
  version          Show version

OPTIONS:
  -u, --user <name>   Developer username for .trellis/workspace/<name>
  -h, --help          Show help
  -v, --version       Show version

EXAMPLES:
  # Initialize in current directory:
  $ lean-trellis init
  $ lean-trellis .

  # Initialize in a specific project:
  $ lean-trellis init /path/to/my-project -u my-name

  # Run via npx without global install:
  $ npx ${pkg.name} init

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
