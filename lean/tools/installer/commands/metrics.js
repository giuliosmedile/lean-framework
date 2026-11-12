'use strict';
const path = require('node:path');
const { resolveProject, loadPlan } = require('../lib/plan');
const { aggregate } = require('../lib/metrics');

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '—');

function render(name, b) {
  const f = b.findings;
  const lines = [
    `${name}: ${b.done}/${b.stories} done · routes small ${b.routes.small} / full ${b.routes.full} · loops ${b.review_loops} (${b.looped_stories} stories) · escalations ${b.escalations} · deferred ${b.deferred}` +
      (b.median_minutes != null ? ` · median ${b.median_minutes} min/story` : ''),
    `  findings ${f.total}: high ${f.high} · medium ${f.medium} · low ${f.low} · false ${f.false} (${pct(f.false, f.total)}) · maybe-false ${f['maybe-false']}` + (f.other ? ` · unparsed ${f.other}` : ''),
    `  routed: ${Object.entries(b.triage_routes).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`,
  ];
  for (const [lens, L] of Object.entries(b.by_lens))
    lines.push(`  ${lens.padEnd(17)} ${L.total} findings, ${pct(L.false, L.total)} false · ` + Object.entries(L.by_model).map(([m, v]) => `${m}: ${v.total}/${pct(v.false, v.total)} false`).join(' · '));
  const tok = [];
  if (b.worker_tokens_reported) tok.push(`workers ${b.worker_tokens.toLocaleString('en')} (${b.worker_tokens_reported} stories)`);
  if (b.orchestrator_tokens_reported) tok.push(`orchestrator ${b.orchestrator_tokens.toLocaleString('en')} (${b.orchestrator_tokens_reported} stories)`);
  lines.push(`  tokens: ${tok.join(' · ') || 'not reported'}`);
  const models = Object.entries(b.models).map(([r, ms]) => `${r}=${Object.entries(ms).map(([m, n]) => (n > 1 ? `${m}×${n}` : m)).join('/')}`);
  if (models.length) lines.push(`  models: ${models.join(' · ')}`);
  return lines.join('\n');
}

module.exports = {
  command: 'metrics',
  description: 'Aggregate build metrics from story files: routes, review loops, escalations, findings by verdict/lens/model, tokens, time',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: from _lean/ config, else plan/)'],
    ['--epic <id>', 'One epic only'],
    ['--json', 'Print as JSON (for comparing runs)'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    const r = aggregate(loadPlan(resolveProject(root, opts.plan)), { epic: opts.epic });
    if (opts.json) return void process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    const out = r.epics.filter((e) => e.stories).map((e) => render(`${e.id} ${e.title || ''}`.trim(), e));
    if (!opts.epic && r.epics.length > 1) out.push(render('TOTAL', r.total));
    process.stdout.write((out.join('\n\n') || 'no stories yet') + '\n');
  },
};
