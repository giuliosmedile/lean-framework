'use strict';
const path = require('node:path');
const { scout } = require('../lib/scout');
const ui = require('../lib/ui');

module.exports = {
  command: 'scout',
  description: 'Detect coding agents and their models, and suggest orchestrator tiers (read-only)',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--json', 'Print the full scout result as JSON'],
    ['--no-models', 'Skip listing available models (faster)'],
  ],
  action: async (opts) => {
    const results = scout(path.resolve(opts.directory || process.cwd()), { listModels: opts.models !== false });
    if (opts.json) return void process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    process.stdout.write(ui.scoutTable(results) + '\n\n');
    for (const h of results.filter((r) => r.found && r.perAgentModel)) {
      const g = (h.suggestion.guessed || []).length ? ` (guessed: ${h.suggestion.guessed.join(', ')} — verify)` : '';
      process.stdout.write(`${h.name}: ${h.suggestion.why}${g}\n  models reachable: ${opts.models === false ? 'not listed (--no-models)' : h.models.length}${h.models.length ? ` — e.g. ${h.models.slice(0, 5).join(', ')}` : ''}\n`);
    }
    process.stdout.write('\nApply with: npx lean-method install  (interactive)  or  --set orchestration.tiers.<tool>.<mid|low>=<model>\n');
  },
};
