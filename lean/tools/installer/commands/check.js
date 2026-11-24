'use strict';
const path = require('node:path');
const pc = require('picocolors');
const { resolveProject, loadPlan } = require('../lib/plan');
const { checkPlan, checkStory, reviewWindow } = require('../lib/plan-check');

module.exports = {
  command: 'check',
  description: 'Lint the plan tree deterministically (ids, status, dependencies, coverage, lanes, seams, frozen intent, spec size, trespass). Exit 1 on errors',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: core.output_folder from _lean/ config, else plan/)'],
    ['--epic <id>', 'Check one epic only (e.g. E2)'],
    ['--story <id>', 'Check one story for lean-build: its file, frozen block, size, open dependencies, lane trespass since baseline_commit, the review window, and tests for its numbered acceptance criteria'],
    ['--strict', 'Exit 1 on warnings too'],
    ['--json', 'Print findings as JSON'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    const plan = loadPlan(resolveProject(root, opts.plan));
    const findings = opts.story ? checkStory(plan, opts.story) : checkPlan(plan, { epic: opts.epic });
    const errors = findings.filter((f) => f.level === 'error').length;
    const warns = findings.length - errors;
    const review = opts.story ? reviewWindow(plan, opts.story) : null;
    if (opts.json) process.stdout.write(JSON.stringify({ errors, warnings: warns, findings, ...(opts.story ? { review } : {}) }, null, 2) + '\n');
    else {
      if (review)
        process.stdout.write(`${pc.dim('review window')} since ${review.base} (${review.from}): ${review.lines} changed lines, cap ${review.cap}${review.final ? ' · final story' : ''} → ${review.due ? 'feature review due' : 'feature review not due'}\n`);
      for (const f of findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1)))
        process.stdout.write(`${f.level === 'error' ? pc.red('✖') : pc.yellow('▲')} ${pc.dim(f.code.padEnd(24))} ${f.where} — ${f.msg}\n`);
      const scope = opts.story || opts.epic || path.relative(root, plan.planDir) || '.';
      process.stdout.write(`${errors ? pc.red('FAIL') : warns ? pc.yellow('PASS with warnings') : pc.green('PASS')} — ${scope}: ${errors} error(s), ${warns} warning(s)\n`);
    }
    if (errors || (opts.strict && warns)) process.exitCode = 1;
  },
};
