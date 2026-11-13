'use strict';
const path = require('node:path');
const { resolveProject, loadPlan } = require('../lib/plan');
const { nextStories } = require('../lib/plan-check');

module.exports = {
  command: 'next',
  description: 'Show in-flight stories, blocked stories, and the next ready story per active epic and lane',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: from _lean/ config, else plan/)'],
    ['--lane <id>', 'Only this lane (plus shared stories)'],
    ['--json', 'Print as JSON'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    const plan = loadPlan(resolveProject(root, opts.plan));
    const r = nextStories(plan, { lane: opts.lane });
    const rel = (f) => (f ? path.relative(root, f) : '');
    if (opts.json) {
      for (const k of Object.keys(r)) r[k] = r[k].map((x) => ({ ...x, file: rel(x.file) }));
      return void process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    }
    const lane = (l) => (l ? ` [${l}]` : '');
    const out = [];
    for (const s of r.inFlight) out.push(`resume   ${s.id}${lane(s.lane)} ${s.status} — ${rel(s.file)}`);
    for (const s of r.claimed) out.push(`claimed  ${s.id}${lane(s.lane)} by ${s.owner}`);
    for (const s of r.blocked) out.push(`blocked  ${s.id}${lane(s.lane)} — ${s.reason || '(no reason)'}`);
    for (const s of r.next) out.push(`next     ${s.id}${lane(s.lane)} ${s.title} — ${rel(s.file)}`);
    if (!out.length) out.push('nothing ready — plan the next epic (lean-plan) or unblock a story');
    process.stdout.write(out.join('\n') + '\n');
  },
};
