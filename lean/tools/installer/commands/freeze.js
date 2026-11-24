'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { resolveProject, loadPlan, frozenBlock, sha256, contractHash, fmRaw, APPROVED_VIA } = require('../lib/plan');

/** Set, replace, or (value == null) remove one top-level frontmatter key, keeping everything else byte-for-byte. */
function setKey(text, key, value, comment = '') {
  const end = text.indexOf('\n---', 4);
  if (!text.startsWith('---\n') || end < 0) throw new Error('the file has no frontmatter');
  let fm = text.slice(0, end);
  const re = new RegExp(`^${key}:.*$`, 'm');
  if (value == null) fm = fm.replace(new RegExp(`\\n${key}:.*$`, 'm'), '');
  else if (re.test(fm)) fm = fm.replace(re, `${key}: ${value}`);
  else fm += `\n${key}: ${value}${comment ? `   # ${comment}` : ''}`;
  return fm + text.slice(end);
}
const writeHash = (text, hash) => setKey(text, 'frozen_sha256', `'${hash}'`, 'set by `lean-method freeze`; check fails if the frozen block changes');
const writeContract = (text) =>
  setKey(text, 'contract_sha256', `'${contractHash(text)}'`, 'set by `lean-method freeze`; check fails if caps, rules, seams, checkpoint, security, frozen_tests or approved_via change');

module.exports = {
  command: 'freeze',
  description: "Record the hash of a story's <frozen-after-approval> block and of its contract fields, so `check` catches any later edit to frozen intent",
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--plan <path>', 'Plan folder (default: from _lean/ config, else plan/)'],
    ['--story <id>', 'Story id (e.g. E2-3)'],
    ['--file <path>', 'Spec file path instead of a story id (ad-hoc specs)'],
    ['--via <how>', 'Who approved the block: checkpoint (a human saw it) | plan (only the plan stub was approved; default when not yet recorded)'],
    ['--tests <paths>', 'Also freeze these acceptance-test files (comma-separated, relative to the project root): the implementer must make them pass, never edit them'],
    ['--unlock', 'Remove the frozen-intent and contract hashes — only after the human renegotiated intent; freeze again afterwards'],
    ['--unlock-tests', 'Remove the frozen-test list — only when a frozen test is judged wrong; freeze again afterwards'],
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
    let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const name = path.relative(root, file);
    if (opts.unlock || opts.unlockTests) {
      if (opts.unlock) text = setKey(setKey(text, 'frozen_sha256', null), 'contract_sha256', null);
      if (opts.unlockTests) text = setKey(text, 'frozen_tests', null);
      fs.writeFileSync(file, text);
      return void process.stdout.write(`unlocked ${name}${opts.unlock ? ' — intent' : ''}${opts.unlockTests ? ' — tests' : ''}. Freeze again once the change is agreed.\n`);
    }
    if (opts.via != null && !APPROVED_VIA.includes(opts.via)) throw new Error(`--via must be one of ${APPROVED_VIA.join(' | ')}`);
    if (frozenBlock(text) == null) throw new Error(`${name} has no <frozen-after-approval> block`);
    if (opts.via || /^(''|"")?$/.test(fmRaw(text, 'approved_via')))
      text = setKey(text, 'approved_via', opts.via || 'plan', 'checkpoint: a human saw the frozen block · plan: only the plan stub was approved');
    if (opts.tests) {
      const list = opts.tests.split(',').map((s) => s.trim()).filter(Boolean).map((rel) => {
        const abs = path.resolve(root, rel);
        if (!fs.existsSync(abs)) throw new Error(`test file ${rel} does not exist`);
        return `'${path.relative(root, abs).split(path.sep).join('/')}#${sha256(fs.readFileSync(abs))}'`;
      });
      text = setKey(text, 'frozen_tests', `[${list.join(', ')}]`, 'set by `lean-method freeze --tests`; the implementer may not edit these');
      process.stdout.write(`froze ${list.length} test file(s) in ${name}\n`);
    }
    const hash = sha256(frozenBlock(text));
    text = writeContract(writeHash(text, hash));
    fs.writeFileSync(file, text);
    process.stdout.write(`frozen ${name} — sha256 ${hash.slice(0, 12)}…, approved via ${fmRaw(text, 'approved_via')}\n`);
  },
  writeHash,
  setKey,
};
