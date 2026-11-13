#!/usr/bin/env node
'use strict';
// Claude Code PreToolUse hook (Edit | MultiEdit | Write), installed to _lean/hooks/frozen-guard.js.
// Refuses an edit that would change a story's frozen intent (frozen_sha256) or a frozen acceptance test
// (frozen_tests) while that story is being built. No dependencies: it must run in any project.
// Exit 0 = allow; exit 2 = block, and stderr is shown to the agent.

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

function check(evt) {
  const tool = evt.tool_name;
  const input = evt.tool_input || {};
  if (!['Edit', 'MultiEdit', 'Write'].includes(tool) || !input.file_path) return null;
  const root = process.env.CLAUDE_PROJECT_DIR || evt.cwd || process.cwd();
  const file = path.resolve(root, input.file_path);
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

  // 1. frozen intent inside a spec file
  const hash = current && unquote(fmValue(current, 'frozen_sha256'));
  if (hash) {
    const next = after(tool, input, current);
    const block = frozenBlock(next);
    if (!block || sha256(block) !== hash || unquote(fmValue(next, 'frozen_sha256')) !== hash)
      return `${path.relative(root, file)}: this edit would change frozen intent (the <frozen-after-approval> block or its hash). Frozen intent belongs to the human. If they renegotiated it, run \`node _lean/bin/lean.js freeze --file ${path.relative(root, file)} --unlock\`, make the agreed edit, then freeze again. Otherwise edit only the sections outside the block.`;
  }

  // 2. frozen acceptance tests of a story in progress
  const rel = path.relative(root, file).split(path.sep).join('/');
  for (const story of storyFiles(planDir(root))) {
    const text = fs.readFileSync(story, 'utf8');
    if (!LOCKING.includes(unquote(fmValue(text, 'status')))) continue;
    const list = fmValue(text, 'frozen_tests');
    if (list && list.includes(`${rel}#`))
      return `${rel} is a frozen acceptance test of ${path.relative(root, story)}. Make the code pass it; don't change it. If the test itself is wrong, stop and report why — the orchestrator decides (freeze --unlock-tests).`;
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
module.exports = { check, after, frozenBlock };
