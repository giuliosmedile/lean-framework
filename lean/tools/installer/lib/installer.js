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

// ── Platforms ───────────────────────────────────────────────────────────
function loadPlatforms() {
  const doc = YAML.parse(fs.readFileSync(path.join(__dirname, 'platform-codes.yaml'), 'utf8'));
  return doc.platforms;
}

function formatPlatformList() {
  const p = loadPlatforms();
  return Object.entries(p)
    .map(([code, v]) => `${code.padEnd(18)} ${v.name.padEnd(26)} → ${v.installer.target_dir}${v.installer.commands_target_dir ? ` + ${v.installer.commands_target_dir}` : ''}${v.preferred ? '  (preferred)' : ''}`)
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
function install({ projectRoot, tools, answers, orchestration }) {
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
  };
}

// ── Uninstall ───────────────────────────────────────────────────────────
function uninstall(projectRoot, { keepCustom = true } = {}) {
  const lp = leanPaths(projectRoot);
  const files = readFilesManifest(lp.filesManifest);
  if (!files.size && !fs.existsSync(lp.dir)) return { removed: 0, found: false };
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
