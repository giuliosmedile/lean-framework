#!/usr/bin/env node
'use strict';
// Plan tooling entry, dependency-light: the installer copies it to _lean/bin/lean.js together with
// lib/{plan,plan-check,metrics,claims,config}.js, the five plan commands and the three runtime
// dependencies they need, so `node _lean/bin/lean.js check` works in any installed project — no npm.
const { parseArgs } = require('node:util');
const path = require('node:path');

const COMMANDS = ['check', 'next', 'freeze', 'metrics', 'claim'];
const load = (name) => require(path.join(__dirname, 'commands', `${name}.js`));

function usage() {
  const lines = ['usage: lean <command> [options]', ''];
  for (const n of COMMANDS) {
    const c = load(n);
    lines.push(`  ${n.padEnd(8)} ${c.description}`);
    for (const [flag, desc] of c.options || []) lines.push(`      ${flag.padEnd(22)} ${desc}`);
  }
  return lines.join('\n') + '\n';
}

/** commander-style option specs → node:util parseArgs config. */
function toParseArgs(options) {
  const out = {};
  for (const [flag] of options || []) {
    const m = flag.match(/--([a-z0-9-]+)(\s+<[^>]+>)?/);
    if (m) out[m[1]] = { type: m[2] ? 'string' : 'boolean' };
  }
  return out;
}
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || name === '-h' || name === '--help') return void process.stdout.write(usage());
  if (!COMMANDS.includes(name)) {
    process.stderr.write(`unknown command "${name}"\n\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  const c = load(name);
  const { values } = parseArgs({ args: rest, options: toParseArgs(c.options), strict: true });
  const opts = Object.fromEntries(Object.entries(values).map(([k, v]) => [camel(k), v]));
  try {
    await c.action(opts);
  } catch (e) {
    process.stderr.write(`lean ${name}: ${e.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => {
  process.stderr.write(`lean: ${e.message}\n`);
  process.exitCode = 2;
});
module.exports = { main, COMMANDS };
