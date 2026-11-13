'use strict';
const path = require('node:path');
const { claim, release, listClaims } = require('../lib/claims');
const { resolveProject, loadPlan } = require('../lib/plan');

module.exports = {
  command: 'claim',
  description: 'Claim a story before building it, so parallel agents never take the same one (atomic git ref, shared by all worktrees). Exit 1 if someone else holds it',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: from _lean/ config, else plan/)'],
    ['--story <id>', 'Story id to claim or release'],
    ['--owner <name>', 'Who claims it (agent or person); default: $USER'],
    ['--release', 'Release the claim (at done, or to hand the story back)'],
    ['--list', 'List current claims'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    if (opts.list) {
      const all = [...listClaims(root)];
      return void process.stdout.write((all.map(([id, c]) => `${id}  ${c.owner}  ${c.at}`).join('\n') || 'no claims') + '\n');
    }
    if (!opts.story) throw new Error('give --story <id> (or --list)');
    if (opts.release) {
      process.stdout.write(release(root, opts.story) ? `released ${opts.story}\n` : `${opts.story} was not claimed\n`);
      return;
    }
    if (!loadPlan(resolveProject(root, opts.plan)).stories.has(opts.story)) throw new Error(`${opts.story} is not in any stories.yaml`);
    const owner = opts.owner || process.env.USER || process.env.USERNAME || 'unknown';
    const r = claim(root, opts.story, owner);
    if (r.nogit) process.stdout.write(`no git here — ${opts.story} not locked (claims need a git repo)\n`);
    else if (r.ok) process.stdout.write(`${r.already ? 'already yours' : 'claimed'}: ${opts.story} → ${owner}\n`);
    else {
      process.stdout.write(`taken: ${opts.story} is claimed by ${r.holder?.owner || '?'} since ${r.holder?.at || '?'}\n`);
      process.exitCode = 1;
    }
  },
};
