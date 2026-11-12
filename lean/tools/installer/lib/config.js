'use strict';
// _lean/ config files — same layering as BMAD's _bmad/:
//   _lean/config.toml               installer-managed, team scope (committed)
//   _lean/config.user.toml          installer-managed, user scope (gitignored)
//   _lean/custom/config.toml        team overrides — never touched by the installer
//   _lean/custom/config.user.toml   personal overrides — never touched by the installer
// Later files win. Skills read the four files in this order.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');
const TOML = require('smol-toml');

const PKG_ROOT = path.resolve(__dirname, '../../..');
const MODULE_YAML = path.join(PKG_ROOT, 'src/module.yaml');

const ROLES = { scout: 'low', research: 'mid', implement: 'mid', review: 'mid', check: 'mid' };

const HEADER = (scope) => `# ─────────────────────────────────────────────────────────────────
# Installer-managed (${scope} scope). Regenerated on every install — treat as read-only.
# To change an answer, re-run \`npx lean-method install\` (prior answers become defaults).
# For pinned overrides use _lean/custom/config${scope === 'user' ? '.user' : ''}.toml — never touched.
# ─────────────────────────────────────────────────────────────────

`;

const CUSTOM_TEAM = `# Team overrides for _lean/config.toml. Committed; applies to every developer.
# Tables deep-merge over the base config. Examples:
#
# [lean]
# style = "standard"
#
# [orchestration.roles]
# review = "top"      # run reviewers on the session model
`;

const CUSTOM_USER = `# Personal overrides (gitignored). Wins over everything else. Examples:
#
# [orchestration.tiers.claude-code]
# low = "sonnet"
`;

function loadModule() {
  return YAML.parse(fs.readFileSync(MODULE_YAML, 'utf8'));
}

function readToml(file) {
  try {
    return TOML.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' ? deepMerge(out[k], v) : v;
  }
  return out;
}

function leanPaths(projectRoot) {
  const dir = path.join(projectRoot, '_lean');
  return {
    dir,
    team: path.join(dir, 'config.toml'),
    user: path.join(dir, 'config.user.toml'),
    customDir: path.join(dir, 'custom'),
    customTeam: path.join(dir, 'custom', 'config.toml'),
    customUser: path.join(dir, 'custom', 'config.user.toml'),
    configDir: path.join(dir, '_config'),
    manifest: path.join(dir, '_config', 'manifest.yaml'),
    skillManifest: path.join(dir, '_config', 'skill-manifest.csv'),
    filesManifest: path.join(dir, '_config', 'files-manifest.csv'),
    backups: path.join(dir, '_backups'),
  };
}

/** Merged view of all four layers (what the skills see). */
function readMerged(projectRoot) {
  const p = leanPaths(projectRoot);
  return [p.team, p.user, p.customTeam, p.customUser].map(readToml).reduce(deepMerge, {});
}

/** Previous installer answers only (base + user), used as prompt defaults on re-install. */
function readPrevious(projectRoot) {
  const p = leanPaths(projectRoot);
  return deepMerge(readToml(p.team), readToml(p.user));
}

function defaultFor(q, projectRoot, previous) {
  const prev = previous?.[q.section]?.[q.key];
  if (prev !== undefined) return q.result ? stripResult(q.result, String(prev)) : String(prev);
  return String(q.default ?? '')
    .replace('{directory_name}', path.basename(projectRoot))
    .replace('{system_user}', os.userInfo().username);
}

// Inverse of the result template, so "{project-root}/plan" re-prompts as "plan".
function stripResult(template, stored) {
  const [pre, post] = template.split('{value}');
  return stored.startsWith(pre) && stored.endsWith(post) ? stored.slice(pre.length, stored.length - post.length) : stored;
}

/**
 * Build the two installer-managed documents.
 * answers: { key: value } from module questions
 * orchestration: { tiers: { <harness>: {top,mid,low} }, roles: {...}, escalate, primary }
 */
function buildConfigs(answers, orchestration, mod = loadModule()) {
  const team = {};
  const user = {};
  for (const q of mod.questions) {
    if (answers[q.key] === undefined) continue;
    const value = q.result ? q.result.replace('{value}', answers[q.key]) : answers[q.key];
    const target = q.scope === 'user' ? user : team;
    (target[q.section] ||= {})[q.key] = value;
  }
  team.orchestration = {
    primary: orchestration.primary || 'claude-code',
    escalate: orchestration.escalate !== false,
    roles: { ...ROLES, ...(orchestration.roles || {}) },
  };
  // Model availability is per machine (credentials, subscriptions) → user scope.
  user.orchestration = { tiers: orchestration.tiers || {} };
  return { team, user };
}

function writeConfigs(projectRoot, { team, user }) {
  const p = leanPaths(projectRoot);
  fs.mkdirSync(p.customDir, { recursive: true });
  fs.writeFileSync(p.team, HEADER('team') + TOML.stringify(team) + '\n');
  fs.writeFileSync(p.user, HEADER('user') + TOML.stringify(user) + '\n');
  if (!fs.existsSync(p.customTeam)) fs.writeFileSync(p.customTeam, CUSTOM_TEAM);
  if (!fs.existsSync(p.customUser)) fs.writeFileSync(p.customUser, CUSTOM_USER);
  fs.writeFileSync(path.join(p.dir, '.gitignore'), '*.user.toml\n_backups/\n');
}

/** Apply `--set section.key=value` (or orchestration.tiers.<h>.<tier>=model) onto answers/orchestration. */
function applySets(sets, answers, orchestration, mod = loadModule()) {
  for (const spec of sets || []) {
    const eq = spec.indexOf('=');
    if (eq < 1) throw new Error(`--set expects key=value, got "${spec}"`);
    const key = spec.slice(0, eq).trim();
    const value = spec.slice(eq + 1).trim();
    const parts = key.split('.');
    if (parts[0] === 'orchestration') {
      let node = orchestration;
      for (const part of parts.slice(1, -1)) node = node[part] ||= {};
      node[parts.at(-1)] = value === 'true' ? true : value === 'false' ? false : value;
      continue;
    }
    const q = mod.questions.find((x) => x.key === parts.at(-1) && (parts.length === 1 || x.section === parts[0]));
    if (!q) throw new Error(`Unknown --set key "${key}". Run \`lean-method install --list-options\`.`);
    answers[q.key] = value;
  }
}

module.exports = { loadModule, leanPaths, readMerged, readPrevious, defaultFor, buildConfigs, writeConfigs, applySets, deepMerge, ROLES, PKG_ROOT };
