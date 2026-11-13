#!/usr/bin/env node
'use strict';
// PreToolUse hook, installed to _lean/hooks/frozen-guard.js. Two hosts, one script:
//   Claude Code: tool_name Edit | MultiEdit | Write, tool_input.file_path (+ content / old_string …)
//   Codex:       tool_name apply_patch, tool_input.command = the patch text (*** Begin Patch …)
// Refuses an edit that would change a story's frozen intent (frozen_sha256) or a frozen acceptance test
// (frozen_tests) while that story is being built. No dependencies: it must run in any project.
// Exit 0 = allow; exit 2 = block, and stderr is shown to the agent (both hosts).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const LOCKING = ['ready', 'in-progress', 'in-review'];

function frozenBlock(text) {
  const m = (text || '').replace(/\r\n/g, '\n').match(/<frozen-after-approval[^>]*>([\s\S]*?)<\/frozen-after-approval>/);
  if (!m) return null;
  return m[1].replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}
function fmValue(text, key) {
  const fm = (text || '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  const m = fm && fm[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return m ? m[1].replace(/\s+#.*$/, '').trim() : null;
}
const unquote = (v) => (v || '').replace(/^['"]|['"]$/g, '');

/** The file content the tool call would produce. */
function after(tool, input, current) {
  if (tool === 'Write') return input.content ?? '';
  const edits = tool === 'MultiEdit' ? input.edits || [] : [input];
  let text = current;
  for (const e of edits) text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  return text;
}

function storyFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) storyFiles(p, out);
    else if (e.name.endsWith('.md') && (path.basename(dir) === 'stories' || path.basename(dir) === 'adhoc')) out.push(p);
  }
  return out;
}

function planDir(root) {
  for (const f of ['custom/config.user.toml', 'custom/config.toml', 'config.user.toml', 'config.toml'].map((x) => path.join(root, '_lean', x))) {
    const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/^output_folder\s*=\s*"([^"]+)"/m);
    if (m) return path.resolve(root, m[1].replace('{project-root}', root));
  }
  return path.join(root, 'plan');
}

/** Parse a Codex apply_patch body into [{ op: add|update|delete, path, moveTo, add: [lines], hunks: [{ ctx, old, new }] }]. */
function parsePatch(text) {
  const files = [];
  let cur = null;
  let hunk = null;
  for (const line of (text || '').replace(/\r\n/g, '\n').split('\n')) {
    let m;
    if ((m = line.match(/^\*\*\* (Add|Update|Delete) File: (.+)$/))) {
      cur = { op: m[1].toLowerCase(), path: m[2].trim(), moveTo: null, add: [], hunks: [] };
      files.push(cur);
      hunk = null;
    } else if (!cur || /^\*\*\* (Begin|End) Patch/.test(line) || line === '*** End of File') {
      continue;
    } else if ((m = line.match(/^\*\*\* Move to: (.+)$/))) {
      cur.moveTo = m[1].trim();
    } else if (cur.op === 'add') {
      if (line.startsWith('+')) cur.add.push(line.slice(1));
    } else if (cur.op === 'update') {
      if (line.startsWith('@@')) {
        hunk = { ctx: line.replace(/^@@\s?/, '').trim(), old: [], new: [] };
        cur.hunks.push(hunk);
        continue;
      }
      if (!hunk) cur.hunks.push((hunk = { ctx: '', old: [], new: [] }));
      const tag = line[0];
      const body = line.slice(1);
      if (tag === '-') hunk.old.push(body);
      else if (tag === '+') hunk.new.push(body);
      else {
        hunk.old.push(tag === ' ' ? body : line);
        hunk.new.push(tag === ' ' ? body : line);
      }
    }
  }
  return files;
}

/** Apply one update entry to `current`; null when a hunk can't be located (Codex would reject the patch too). */
function applyUpdate(current, entry) {
  const lines = current.split('\n');
  let at = 0;
  const norms = [(x) => x, (x) => x.trimEnd(), (x) => x.trim()];
  const find = (seq, from) => {
    for (const n of norms)
      for (let i = from; i + seq.length <= lines.length; i++) if (seq.every((l, k) => n(lines[i + k]) === n(l))) return i;
    return -1;
  };
  for (const h of entry.hunks) {
    if (h.ctx) {
      const c = find([h.ctx], at);
      if (c >= 0) at = c + 1;
    }
    if (!h.old.length) {
      const end = lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
      lines.splice(end, 0, ...h.new);
      at = end + h.new.length;
      continue;
    }
    const i = find(h.old, at);
    if (i < 0) return null;
    lines.splice(i, h.old.length, ...h.new);
    at = i + h.new.length;
  }
  return lines.join('\n');
}

/** [{ file, current, next }] for every file the tool call touches; next === null means deleted. */
function changes(evt, root) {
  const tool = evt.tool_name;
  const input = evt.tool_input || {};
  const readAt = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  if (['Edit', 'MultiEdit', 'Write'].includes(tool) && input.file_path) {
    const file = path.resolve(root, input.file_path);
    const current = readAt(file);
    return [{ file, current, next: tool !== 'Write' && current == null ? null : after(tool, input, current || '') }];
  }
  if (tool === 'apply_patch' && typeof input.command === 'string') {
    const base = evt.cwd || root;
    const out = [];
    for (const e of parsePatch(input.command)) {
      const file = path.resolve(base, e.path);
      const current = readAt(file);
      if (e.op === 'add') out.push({ file, current, next: e.add.join('\n') + '\n' });
      else if (e.op === 'delete') out.push({ file, current, next: null });
      else {
        const next = current == null ? null : applyUpdate(current, e);
        if (current == null || next == null) continue; // the patch itself will fail
        if (e.moveTo) {
          out.push({ file, current, next: null });
          out.push({ file: path.resolve(base, e.moveTo), current: readAt(path.resolve(base, e.moveTo)), next });
        } else out.push({ file, current, next });
      }
    }
    return out;
  }
  return [];
}

/** Project root: the hook's own install location (<root>/_lean/hooks), else the host's project dir, else cwd. */
function projectRoot(evt) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  if (path.basename(__dirname) === 'hooks' && path.basename(path.dirname(__dirname)) === '_lean') return path.resolve(__dirname, '../..');
  return evt.cwd || process.cwd();
}

function checkFile(root, { file, current, next }, stories) {
  const rel = path.relative(root, file).split(path.sep).join('/');

  // 1. frozen intent inside a spec file
  const hash = current && unquote(fmValue(current, 'frozen_sha256'));
  if (hash) {
    const block = next == null ? null : frozenBlock(next);
    if (!block || sha256(block) !== hash || unquote(fmValue(next, 'frozen_sha256')) !== hash)
      return `${rel}: this edit would change frozen intent (the <frozen-after-approval> block or its hash). Frozen intent belongs to the human. If they renegotiated it, run \`node _lean/bin/lean.js freeze --file ${rel} --unlock\`, make the agreed edit, then freeze again. Otherwise edit only the sections outside the block.`;
  }

  // 2. frozen acceptance tests of a story in progress
  for (const story of stories()) {
    const text = fs.readFileSync(story, 'utf8');
    if (!LOCKING.includes(unquote(fmValue(text, 'status')))) continue;
    const list = fmValue(text, 'frozen_tests');
    if (list && list.includes(`${rel}#`))
      return `${rel} is a frozen acceptance test of ${path.relative(root, story)}. Make the code pass it; don't change it. If the test itself is wrong, stop and report why — the orchestrator decides (freeze --unlock-tests).`;
  }
  return null;
}

function check(evt) {
  const root = projectRoot(evt);
  let cache = null;
  const stories = () => (cache = cache || storyFiles(planDir(root)));
  for (const c of changes(evt, root)) {
    const reason = checkFile(root, c, stories);
    if (reason) return reason;
  }
  return null;
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    let reason = null;
    try {
      reason = check(JSON.parse(raw || '{}'));
    } catch {
      reason = null; // never block on the guard's own failure
    }
    if (reason) {
      process.stderr.write(`LEAN guard: ${reason}\n`);
      process.exit(2);
    }
  });
}
module.exports = { check, after, frozenBlock, parsePatch, applyUpdate };
