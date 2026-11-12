'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { resolveProject, loadPlan, frozenBlock, sha256 } = require('../lib/plan');

/** Set (or replace) `frozen_sha256:` in a markdown file's frontmatter, keeping everything else byte-for-byte. */
function writeHash(text, hash) {
  const end = text.indexOf('\n---', 4);
  if (!text.startsWith('---\n') || end < 0) throw new Error('the file has no frontmatter');
  let fm = text.slice(0, end);
  if (/^frozen_sha256:.*$/m.test(fm)) fm = fm.replace(/^frozen_sha256:.*$/m, `frozen_sha256: '${hash}'`);
  else fm += `\nfrozen_sha256: '${hash}'   # set by \`lean-method freeze\`; check fails if the frozen block changes`;
  return fm + text.slice(end);
}

module.exports = {
  command: 'freeze',
  description: "Record the hash of a story's <frozen-after-approval> block, so `check` catches any later edit to frozen intent",
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: from _lean/ config, else plan/)'],
    ['--story <id>', 'Story id (e.g. E2-3)'],
    ['--file <path>', 'Spec file path instead of a story id (ad-hoc specs)'],
  ],
  action: async (opts) => {
    const root = path.resolve(opts.directory || process.cwd());
    let file = opts.file && path.resolve(root, opts.file);
    if (!file) {
      if (!opts.story) throw new Error('give --story <id> or --file <path>');
      const s = loadPlan(resolveProject(root, opts.plan)).stories.get(opts.story);
      if (!s || !s.exists) throw new Error(`story ${opts.story} not found`);
      file = s.file;
    }
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const block = frozenBlock(text);
    if (block == null) throw new Error(`${path.relative(root, file)} has no <frozen-after-approval> block`);
    const hash = sha256(block);
    fs.writeFileSync(file, writeHash(text, hash));
    process.stdout.write(`frozen ${path.relative(root, file)} — sha256 ${hash.slice(0, 12)}…\n`);
  },
  writeHash,
};
