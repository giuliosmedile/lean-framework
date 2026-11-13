'use strict';
// Core install / uninstall. No prompts here — commands/ collect answers, this does the I/O.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const { PKG_ROOT, leanPaths, buildConfigs, writeConfigs, loadModule } = require('./config');
const { renderRoleAgents } = require('./role-agents');

const VERSION = require(path.join(PKG_ROOT, 'package.json')).version;
const SKILLS_ROOT = path.join(PKG_ROOT, 'skills');
const INSTALLER_ROOT = path.join(__dirname, '..');

// ── Vendored plan CLI: _lean/bin/lean.js runs check/next/freeze/metrics/claim with no npm install ──
const CLI_LIBS = ['plan', 'plan-check', 'metrics', 'claims', 'config'];
const CLI_COMMANDS = ['check', 'next', 'freeze', 'metrics', 'claim'];
const CLI_DEPS = {
  yaml: (f) => f === 'package.json' || f === 'LICENSE' || (f.startsWith('dist/') && f.endsWith('.js')),
  'smol-toml': (f) => f === 'package.json' || f === 'LICENSE' || (f.startsWith('dist/') && /\.(c?js)$/.test(f)),
  picocolors: (f) => ['package.json', 'LICENSE', 'picocolors.js'].includes(f),
};
const GUARD_REL = '_lean/hooks/frozen-guard.js';

/** A dependency's package root: walk up from its resolved entry (some packages don't export package.json). */
function resolveDep(name) {
  let dir = path.dirname(require.resolve(name, { paths: [INSTALLER_ROOT, PKG_ROOT] }));
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== name) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`can't find the ${name} package root`);
    dir = up;
  }
  return dir;
}

function cliFiles() {
  const out = new Map();
  out.set('_lean/bin/lean.js', fs.readFileSync(path.join(INSTALLER_ROOT, 'plan-cli.js')));
  for (const l of CLI_LIBS) out.set(`_lean/bin/lib/${l}.js`, fs.readFileSync(path.join(__dirname, `${l}.js`)));
  for (const c of CLI_COMMANDS) out.set(`_lean/bin/commands/${c}.js`, fs.readFileSync(path.join(INSTALLER_ROOT, 'commands', `${c}.js`)));
  for (const [dep, keep] of Object.entries(CLI_DEPS)) {
    const dir = resolveDep(dep);
    for (const abs of walk(dir)) {
      const rel = posix(path.relative(dir, abs));
      if (keep(rel)) out.set(`_lean/bin/node_modules/${dep}/${rel}`, fs.readFileSync(abs));
    }
  }
  out.set(GUARD_REL, fs.readFileSync(path.join(INSTALLER_ROOT, 'hooks', 'frozen-guard.js')));
  return out;
}

// ── Platforms ───────────────────────────────────────────────────────────
function loadPlatforms() {
  const doc = YAML.parse(fs.readFileSync(path.join(__dirname, 'platform-codes.yaml'), 'utf8'));
  return doc.platforms;
}

function formatPlatformList() {
  const p = loadPlatforms();
  return Object.entries(p)
    .map(([code, v]) => `${code.padEnd(18)} ${v.name.padEnd(26)} ${(v.support === 'full' ? 'full ' : 'basic').padEnd(6)} → ${v.installer.target_dir}${v.installer.commands_target_dir ? ` + ${v.installer.commands_target_dir}` : ''}${v.preferred ? '  (preferred)' : ''}`)
    .join('\n');
}

// ── Skills ──────────────────────────────────────────────────────────────
function listSkills() {
  return fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('lean-'))
    .map((d) => {
      const md = fs.readFileSync(path.join(SKILLS_ROOT, d.name, 'SKILL.md'), 'utf8');
      const fm = YAML.parse(md.split(/^---\s*$/m)[1] || '') || {};
      return { id: d.name, name: fm.name || d.name, description: fm.description || '' };
    });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const posix = (p) => p.split(path.sep).join('/');
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;

// ── Plan: every file the install will own, with its content ────────────
function planFiles({ tools, orchestration }) {
  const platforms = loadPlatforms();
  const files = new Map(); // relPath → { content, type }
  const skills = listSkills();

  const targetDirs = new Set();
  for (const code of tools) {
    const p = platforms[code];
    if (!p) throw new Error(`Unknown tool "${code}". Run \`lean-method install --list-tools\`.`);
    if (p.suspended) throw new Error(`${p.name}: ${p.suspended}`);
    targetDirs.add(p.installer.target_dir);

    if (p.installer.commands_target_dir) {
      for (const s of skills) {
        files.set(posix(path.join(p.installer.commands_target_dir, `${s.id}.md`)), {
          type: 'command',
          content: `---\ndescription: ${JSON.stringify(s.description)}\n---\n\n@skills/${s.id}\n`,
        });
      }
    }
    for (const a of renderRoleAgents(code, orchestration.roles, orchestration.tiers?.[code])) {
      files.set(a.relPath, { type: 'agent', content: a.content });
    }
  }

  for (const [rel, content] of cliFiles()) files.set(rel, { type: 'cli', content });

  for (const dir of targetDirs) {
    for (const s of skills) {
      for (const abs of walk(path.join(SKILLS_ROOT, s.id))) {
        files.set(posix(path.join(dir, s.id, path.relative(path.join(SKILLS_ROOT, s.id), abs))), { type: 'skill', content: fs.readFileSync(abs) });
      }
    }
  }
  return { files, skills, targetDirs: [...targetDirs] };
}

function readFilesManifest(file) {
  if (!fs.existsSync(file)) return new Map();
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1);
  return new Map(rows.filter(Boolean).map((r) => {
    const [type, rel, hash] = r.split(',').map((c) => c.replace(/^"|"$/g, ''));
    return [rel, { type, hash }];
  }));
}

function readManifest(projectRoot) {
  const f = leanPaths(projectRoot).manifest;
  return fs.existsSync(f) ? YAML.parse(fs.readFileSync(f, 'utf8')) : null;
}

/** Files the user changed since the last install (hash differs from the manifest). */
function modifiedFiles(projectRoot) {
  const prev = readFilesManifest(leanPaths(projectRoot).filesManifest);
  const out = [];
  for (const [rel, { hash }] of prev) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs) && sha(fs.readFileSync(abs)) !== hash) out.push(rel);
  }
  return out;
}

function removeEmptyParents(projectRoot, rel) {
  let dir = path.dirname(path.join(projectRoot, rel));
  while (dir.startsWith(projectRoot) && dir !== projectRoot) {
    try {
      if (fs.readdirSync(dir).length) return;
      fs.rmdirSync(dir);
    } catch {
      return;
    }
    dir = path.dirname(dir);
  }
}

// ── Install ─────────────────────────────────────────────────────────────
function install({ projectRoot, tools, answers, orchestration, guardHook = true, gitHook = false }) {
  const lp = leanPaths(projectRoot);
  const previous = readManifest(projectRoot);
  const prevFiles = readFilesManifest(lp.filesManifest);
  const { files, skills, targetDirs } = planFiles({ tools, orchestration });

  // 1. Back up files the user edited, so the update never silently discards their work.
  const edited = modifiedFiles(projectRoot);
  let backupDir = null;
  if (edited.length) {
    backupDir = path.join(lp.backups, new Date().toISOString().replace(/[:.]/g, '-'));
    for (const rel of edited) {
      fs.mkdirSync(path.dirname(path.join(backupDir, rel)), { recursive: true });
      fs.copyFileSync(path.join(projectRoot, rel), path.join(backupDir, rel));
    }
  }

  // 2. Remove files from the previous install that this one no longer owns (deselected tools, retired skills).
  const removed = [];
  for (const rel of prevFiles.keys()) {
    if (files.has(rel)) continue;
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs);
      removed.push(rel);
      removeEmptyParents(projectRoot, rel);
    }
  }

  // 3. Write everything.
  const manifestRows = ['type,path,hash'];
  for (const [rel, f] of files) {
    const abs = path.join(projectRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content);
    manifestRows.push([f.type, rel, sha(Buffer.from(f.content))].map(csv).join(','));
  }

  // 4. Config + folders.
  const mod = loadModule();
  writeConfigs(projectRoot, buildConfigs(answers, orchestration, mod));
  for (const key of ['input_folder', 'output_folder']) {
    if (answers[key]) fs.mkdirSync(path.join(projectRoot, answers[key]), { recursive: true });
  }

  // 4b. Hooks: the Claude Code guard (merged into .claude/settings.json) and the optional git pre-commit.
  const hooks = [];
  removeClaudeHook(projectRoot);
  if (guardHook && tools.includes('claude-code')) {
    addClaudeHook(projectRoot);
    hooks.push('claude-code:frozen-guard');
  }
  if (gitHook) {
    const r = writeGitHook(projectRoot);
    hooks.push(r.ok ? 'git:pre-commit' : `git:pre-commit skipped (${r.reason})`);
  } else removeGitHook(projectRoot);

  // 5. Manifests.
  fs.mkdirSync(lp.configDir, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(
    lp.manifest,
    YAML.stringify({
      installation: { version: VERSION, installDate: previous?.installation?.installDate || now, lastUpdated: now },
      tools,
      targetDirs,
      skills: skills.map((s) => s.id),
      roleAgents: [...files].filter(([, f]) => f.type === 'agent').map(([rel]) => rel),
      hooks,
    }),
  );
  fs.writeFileSync(lp.filesManifest, manifestRows.join('\n') + '\n');
  fs.writeFileSync(
    lp.skillManifest,
    ['canonicalId,name,description,path', ...skills.map((s) => [s.id, s.name, s.description, `${targetDirs[0]}/${s.id}/SKILL.md`].map(csv).join(','))].join('\n') + '\n',
  );

  return {
    version: VERSION,
    previousVersion: previous?.installation?.version || null,
    files: files.size,
    skills: skills.length,
    targetDirs,
    agents: [...files].filter(([, f]) => f.type === 'agent').map(([rel]) => rel),
    commands: [...files].filter(([, f]) => f.type === 'command').length,
    removed,
    backupDir,
    edited,
    hooks,
  };
}

// ── Hooks ───────────────────────────────────────────────────────────────
const GUARD_CMD = `node "$CLAUDE_PROJECT_DIR/${GUARD_REL}"`;
const settingsPath = (root) => path.join(root, '.claude', 'settings.json');
const isOurs = (h) => typeof h?.command === 'string' && h.command.includes('_lean/hooks/');

function readSettings(root) {
  const f = settingsPath(root);
  if (!fs.existsSync(f)) return {};
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    throw new Error(`${f} is not valid JSON — fix it or pass --no-guard-hook`);
  }
}

/** Add the frozen-intent guard as a PreToolUse hook, keeping every other setting and hook. */
function addClaudeHook(root) {
  const s = readSettings(root);
  s.hooks = s.hooks || {};
  s.hooks.PreToolUse = s.hooks.PreToolUse || [];
  s.hooks.PreToolUse.push({ matcher: 'Edit|MultiEdit|Write', hooks: [{ type: 'command', command: GUARD_CMD, timeout: 10 }] });
  fs.mkdirSync(path.dirname(settingsPath(root)), { recursive: true });
  fs.writeFileSync(settingsPath(root), JSON.stringify(s, null, 2) + '\n');
}

/** Remove only LEAN's hook entries; delete settings.json only if LEAN's hook was all it held. */
function removeClaudeHook(root) {
  const f = settingsPath(root);
  if (!fs.existsSync(f)) return;
  let s;
  try {
    s = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return;
  }
  const pre = s.hooks?.PreToolUse;
  if (!Array.isArray(pre)) return;
  const kept = pre.map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurs(h)) })).filter((m) => m.hooks.length);
  if (kept.length === pre.length && kept.every((m, i) => m.hooks.length === pre[i].hooks.length)) return;
  if (kept.length) s.hooks.PreToolUse = kept;
  else delete s.hooks.PreToolUse;
  if (!Object.keys(s.hooks).length) delete s.hooks;
  if (!Object.keys(s).length) {
    fs.rmSync(f);
    removeEmptyParents(root, '.claude/settings.json');
  } else fs.writeFileSync(f, JSON.stringify(s, null, 2) + '\n');
}

const GIT_MARK = '# lean-method pre-commit hook';
function gitHookPath(root) {
  const { execFileSync } = require('node:child_process');
  const run = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const top = run('rev-parse', '--show-toplevel');
    return { file: path.resolve(root, run('rev-parse', '--git-path', 'hooks/pre-commit')), rel: posix(path.relative(top, root)) || '.' };
  } catch {
    return null;
  }
}

function writeGitHook(root) {
  const g = gitHookPath(root);
  if (!g) return { ok: false, reason: 'not a git repository' };
  if (fs.existsSync(g.file) && !fs.readFileSync(g.file, 'utf8').includes(GIT_MARK)) return { ok: false, reason: 'a pre-commit hook already exists' };
  fs.mkdirSync(path.dirname(g.file), { recursive: true });
  fs.writeFileSync(
    g.file,
    `#!/bin/sh\n${GIT_MARK} — blocks a commit that leaves the plan inconsistent. Bypass once with --no-verify.\ncd "$(git rev-parse --show-toplevel)" || exit 0\nnode "${g.rel}/_lean/bin/lean.js" check --directory "${g.rel}" || { echo "lean check failed — fix the plan, or commit with --no-verify"; exit 1; }\n`,
    { mode: 0o755 },
  );
  return { ok: true };
}

function removeGitHook(root) {
  const g = gitHookPath(root);
  if (g && fs.existsSync(g.file) && fs.readFileSync(g.file, 'utf8').includes(GIT_MARK)) fs.rmSync(g.file);
}

// ── Uninstall ───────────────────────────────────────────────────────────
function uninstall(projectRoot, { keepCustom = true } = {}) {
  const lp = leanPaths(projectRoot);
  const files = readFilesManifest(lp.filesManifest);
  if (!files.size && !fs.existsSync(lp.dir)) return { removed: 0, found: false };
  removeClaudeHook(projectRoot);
  removeGitHook(projectRoot);
  let removed = 0;
  for (const rel of files.keys()) {
    const abs = path.join(projectRoot, rel);
    if (fs.existsSync(abs)) {
      fs.rmSync(abs);
      removed++;
      removeEmptyParents(projectRoot, rel);
    }
  }
  for (const entry of fs.existsSync(lp.dir) ? fs.readdirSync(lp.dir) : []) {
    if (keepCustom && entry === 'custom') continue;
    fs.rmSync(path.join(lp.dir, entry), { recursive: true, force: true });
  }
  if (!keepCustom || !fs.existsSync(lp.customDir)) fs.rmSync(lp.dir, { recursive: true, force: true });
  return { removed, found: true, keptCustom: keepCustom && fs.existsSync(lp.customDir) };
}

module.exports = { install, uninstall, loadPlatforms, formatPlatformList, listSkills, readManifest, modifiedFiles, VERSION };
