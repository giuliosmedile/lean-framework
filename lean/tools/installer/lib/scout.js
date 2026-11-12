'use strict';
// Agent scouting for the orchestrator pattern.
// Finds which coding-agent tools are on this machine, what model each one runs,
// whether it can give a subagent its own model, which models it can reach,
// and suggests a top / mid / low tier mapping. Read-only: never writes anything.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const home = (p) => p.replace(/^~(?=$|\/)/, os.homedir());

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(home(file), 'utf8'));
  } catch {
    return null;
  }
}

function readTomlKey(file, key) {
  try {
    const m = fs.readFileSync(home(file), 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, 'm'));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function which(bin) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    const full = path.join(dir, bin);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function run(bin, args, timeout = 15000) {
  try {
    return execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout }).trim();
  } catch {
    return null;
  }
}

// ── Model classification ────────────────────────────────────────────────
// Name-based and deliberately conservative: anything it can't place is `unknown`
// and the user decides. Free models are flagged separately (cost 0, quality varies).
const FAMILY_RULES = [
  { re: /opus/i, family: 'opus', tier: 'top' },
  { re: /sonnet/i, family: 'sonnet', tier: 'mid' },
  { re: /haiku/i, family: 'haiku', tier: 'low' },
  { re: /(^|[-/._])(nano|mini|lite|flash|small|lightning|tiny|8b|7b|3b)([-._#]|$)/i, family: 'small', tier: 'low' },
  { re: /(^|[-/._])(pro|ultra|max|large|405b)([-._#]|$)/i, family: 'large', tier: 'top' },
];

function classify(model) {
  if (!model || model === 'inherit') return { family: 'inherit', tier: null, free: false };
  const free = /(^|[-/._])free([-._]|$)/i.test(model);
  for (const r of FAMILY_RULES) if (r.re.test(model)) return { family: r.family, tier: r.tier, free };
  return { family: 'unknown', tier: null, free };
}

const providerOf = (m) => (m && m.includes('/') ? m.split('/')[0] : null);

// ── Harness definitions ─────────────────────────────────────────────────
// perAgentModel: the tool can run a subagent on a different model than the session.
// agentsDir: where LEAN writes its role-agent definitions for that tool.
const HARNESSES = {
  'claude-code': {
    name: 'Claude Code',
    bin: 'claude',
    configDir: '~/.claude',
    perAgentModel: true,
    agentsDir: '.claude/agents',
    modelFormat: 'alias (opus · sonnet · haiku · fable) or a full model id',
    current(projectDir) {
      const project = readJson(path.join(projectDir, '.claude/settings.json'))?.model;
      const local = readJson(path.join(projectDir, '.claude/settings.local.json'))?.model;
      const user = readJson('~/.claude/settings.json')?.model;
      return process.env.ANTHROPIC_MODEL || local || project || user || null;
    },
    models() {
      return ['opus', 'sonnet', 'haiku', 'fable'];
    },
    warnings() {
      const w = [];
      if (process.env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1')
        w.push('CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 forces one model on every subagent: LEAN tiers will be ignored.');
      else if (process.env.CLAUDE_CODE_SUBAGENT_MODEL)
        w.push(`CLAUDE_CODE_SUBAGENT_MODEL=${process.env.CLAUDE_CODE_SUBAGENT_MODEL} is a fallback only; LEAN role agents override it.`);
      if (process.env.CLAUDE_CODE_USE_BEDROCK || process.env.CLAUDE_CODE_USE_VERTEX)
        w.push('Bedrock/Vertex in use: aliases resolve to that provider\'s model ids — check them with your admin.');
      return w;
    },
  },
  opencode: {
    name: 'OpenCode',
    bin: 'opencode',
    configDir: '~/.config/opencode',
    perAgentModel: true,
    agentsDir: '.opencode/agents',
    modelFormat: 'provider/model[#variant]',
    current(projectDir) {
      return readJson(path.join(projectDir, 'opencode.json'))?.model || readJson('~/.config/opencode/opencode.json')?.model || null;
    },
    models(binPath) {
      const out = binPath ? run(binPath, ['models'], 60000) : null;
      return out ? out.split('\n').map((l) => l.trim()).filter((l) => /^[\w.-]+\/\S+$/.test(l)) : [];
    },
    warnings: () => [],
  },
  codex: {
    name: 'Codex',
    bin: 'codex',
    configDir: '~/.codex',
    perAgentModel: false,
    current: () => readTomlKey('~/.codex/config.toml', 'model'),
    models: () => [],
    warnings: () => [],
  },
  gemini: {
    name: 'Gemini CLI',
    bin: 'gemini',
    configDir: '~/.gemini',
    perAgentModel: false,
    current() {
      const s = readJson('~/.gemini/settings.json');
      return s?.model?.name || (typeof s?.model === 'string' ? s.model : null);
    },
    models: () => [],
    warnings: () => [],
  },
  cursor: {
    name: 'Cursor',
    bin: 'cursor-agent',
    configDir: '~/.cursor',
    perAgentModel: false,
    current: () => null,
    models: () => [],
    warnings: () => [],
  },
};

// ── Tier suggestion ─────────────────────────────────────────────────────
function pick(models, tier, provider) {
  const sameProvider = provider ? models.filter((m) => providerOf(m) === provider) : models;
  const byTier = (list) => list.filter((m) => classify(m).tier === tier && !classify(m).free);
  return byTier(sameProvider)[0] || byTier(models)[0] || null;
}

// The model listing may not include the provider the session actually uses (e.g. Bedrock
// in OpenCode). For Claude-family ids, derive cheaper siblings by swapping the family name.
// These are guesses: the UI marks them "verify".
const SIBLINGS = { opus: { mid: 'sonnet', low: 'haiku' }, sonnet: { low: 'haiku' } };
function sibling(current, tier) {
  const fam = classify(current).family;
  const target = SIBLINGS[fam]?.[tier];
  return target ? current.replace(new RegExp(fam, 'i'), target) : null;
}

function suggestTiers(code, current, models) {
  const fam = classify(current).family;
  if (code === 'claude-code') {
    if (fam === 'opus' || !current) return { top: 'inherit', mid: 'sonnet', low: 'haiku', why: current ? 'session on Opus' : 'Claude Code default session (Opus or Sonnet): Sonnet + Haiku workers' };
    if (fam === 'sonnet') return { top: 'inherit', mid: 'inherit', low: 'haiku', why: 'session on Sonnet: only scouts move down' };
    if (fam === 'haiku') return { top: 'inherit', mid: 'inherit', low: 'inherit', why: 'session already on the cheapest tier' };
    return { top: 'inherit', mid: 'inherit', low: 'inherit', why: `can't place "${current}" — choose manually` };
  }
  if (!HARNESSES[code]?.perAgentModel) return { top: 'inherit', mid: 'inherit', low: 'inherit', why: 'no per-subagent model: everything runs on the session model' };
  const provider = providerOf(current);
  const topTier = classify(current).tier;
  const guessed = [];
  const choose = (tier) => {
    const listed = pick(models, tier, provider);
    if (listed && providerOf(listed) === provider) return listed;
    const sib = current ? sibling(current, tier) : null;
    if (sib) {
      guessed.push(tier);
      return sib;
    }
    return listed;
  };
  const mid = topTier === 'top' ? choose('mid') : null;
  const low = topTier === 'low' ? null : choose('low');
  return {
    top: 'inherit',
    mid: mid || 'inherit',
    low: low || 'inherit',
    guessed,
    why: current ? `session on ${current}; workers from ${provider || 'the same provider'}` : 'no session model found — choose manually',
  };
}

// ── Scout ───────────────────────────────────────────────────────────────
function scout(projectDir = process.cwd(), { listModels = true } = {}) {
  const results = [];
  for (const [code, h] of Object.entries(HARNESSES)) {
    const binPath = which(h.bin);
    const configFound = fs.existsSync(home(h.configDir));
    const found = Boolean(binPath || configFound);
    const version = binPath ? (run(binPath, ['--version']) || '').split('\n')[0] : null;
    const current = found ? h.current(projectDir) : null;
    const models = found && listModels ? h.models(binPath) : code === 'claude-code' ? h.models() : [];
    results.push({
      code,
      name: h.name,
      found,
      binPath,
      version,
      configFound,
      current,
      currentClass: classify(current),
      perAgentModel: h.perAgentModel,
      agentsDir: h.agentsDir || null,
      modelFormat: h.modelFormat || null,
      models,
      suggestion: suggestTiers(code, current, models),
      warnings: found ? h.warnings() : [],
    });
  }
  return results;
}

module.exports = { scout, classify, suggestTiers, HARNESSES };
