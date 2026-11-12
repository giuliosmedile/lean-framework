'use strict';
const path = require('node:path');
const { uninstall, readManifest } = require('../lib/installer');
const ui = require('../lib/ui');

module.exports = {
  command: 'uninstall',
  description: 'Remove LEAN skills, role agents, command pointers and _lean/ (keeps _lean/custom and your plans)',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--all', 'Also remove _lean/custom overrides'],
    ['-y, --yes', 'Do not ask for confirmation'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    const m = readManifest(root);
    if (!m) return void process.stdout.write('LEAN is not installed here.\n');
    if (!opts.yes) {
      const ok = await ui.confirm(`Remove LEAN ${m.installation.version} from ${root}? Plans in the output folder are kept${opts.all ? '' : ', and so is _lean/custom'}.`, false);
      if (!ok) return void process.stdout.write('Nothing removed.\n');
    }
    const r = uninstall(root, { keepCustom: !opts.all });
    process.stdout.write(`Removed ${r.removed} files${r.keptCustom ? '; kept _lean/custom/' : ''}.\n`);
  },
};
