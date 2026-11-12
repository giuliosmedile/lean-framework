#!/usr/bin/env node
'use strict';
// LEAN CLI — `npx lean-method <command>`. Same shape as BMAD's bmad-cli.js.
const fs = require('node:fs');
const path = require('node:path');
const { program } = require('commander');
const { VERSION } = require('./lib/installer');

if (process.stdin?.setMaxListeners) process.stdin.setMaxListeners(50);

program.name('lean-method').description('LEAN — streamlined, orchestrator-first AI development method').version(VERSION);

for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const c = require(path.join(__dirname, 'commands', file));
  const cmd = program.command(c.command).description(c.description);
  for (const o of c.options || []) cmd.option(...o);
  cmd.action(async (opts) => {
    try {
      await c.action(opts);
    } catch (e) {
      process.stderr.write(`\nlean-method ${c.command}: ${e.message}\n`);
      if (process.env.LEAN_DEBUG) process.stderr.write(e.stack + '\n');
      process.exitCode = 1;
    }
  });
}

program.parse(process.argv);
