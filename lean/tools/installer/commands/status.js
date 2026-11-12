'use strict';
const path = require('node:path');
const { readManifest, modifiedFiles } = require('../lib/installer');
const { readMerged } = require('../lib/config');
const { resolveModel } = require('../lib/role-agents');

module.exports = {
  command: 'status',
  description: 'Show the installed LEAN version, tools, effective config and edited files',
  options: [['--directory <path>', 'Project directory (default: current directory)']],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    const m = readManifest(root);
    if (!m) return void process.stdout.write('LEAN is not installed here. Run: npx lean-method install\n');
    const cfg = readMerged(root);
    const out = [
      `LEAN ${m.installation.version} — installed ${m.installation.installDate}, updated ${m.installation.lastUpdated}`,
      `tools: ${m.tools.join(', ')}   skills: ${m.skills.length}   role agents: ${m.roleAgents.length}`,
      `style: ${cfg.lean?.style}   input: ${cfg.core?.input_folder}   output: ${cfg.core?.output_folder}   primary: ${cfg.orchestration?.primary}`,
    ];
    for (const [tool, tiers] of Object.entries(cfg.orchestration?.tiers || {})) {
      out.push(`  ${tool}: ` + Object.entries(cfg.orchestration.roles || {}).map(([r, t]) => `${r}=${resolveModel(t, tiers)}`).join(' · '));
    }
    const edited = modifiedFiles(root);
    out.push(edited.length ? `edited since install (${edited.length}) — backed up on next update:\n  ${edited.join('\n  ')}` : 'no installed files edited');
    process.stdout.write(out.join('\n') + '\n');
  },
};
