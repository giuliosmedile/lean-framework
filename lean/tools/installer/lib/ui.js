'use strict';
// Thin wrapper over @clack/prompts (BMAD uses the same library) plus the report renderers.
const p = require('@clack/prompts');
const pc = require('picocolors');
const { resolveModel } = require('./role-agents');

function guard(v) {
  if (p.isCancel(v)) {
    p.cancel('Cancelled — nothing changed.');
    process.exit(0);
  }
  return v;
}

const intro = async (t) => p.intro(pc.bgCyan(pc.black(` ${t} `)));
const outro = async (t) => p.outro(t);
const note = (body, title) => p.note(body, title);
const info = (t) => p.log.info(t);
const text = async (message, initialValue) => guard(await p.text({ message, initialValue, defaultValue: initialValue }));
const confirm = async (message, initialValue = false) => guard(await p.confirm({ message, initialValue }));
const select = async (message, options, initialValue) => guard(await p.select({ message, options, initialValue }));
const multiselect = async (message, options, initialValues) => guard(await p.multiselect({ message, options, initialValues, required: true, maxItems: 12 }));

async function spin(label, fn) {
  const s = p.spinner();
  s.start(label);
  try {
    const out = await fn();
    s.stop(label.replace(/…$/, ' — done'));
    return out;
  } catch (e) {
    s.stop(pc.red(label.replace(/…$/, ' — failed')));
    throw e;
  }
}

// Pad by visible width — colour codes don't count.
const visible = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '').length;
const pad = (s, n) => String(s ?? '') + ' '.repeat(Math.max(0, n - visible(s)));

function scoutTable(results) {
  const w = Math.max(14, ...results.map((h) => visible(h.current)));
  const rows = results.map((h) => {
    const status = h.found ? pc.green('found') : pc.dim('—');
    const model = h.found ? h.current || pc.dim('default') : '';
    const sub = !h.found ? '' : h.perAgentModel ? pc.green('yes') : pc.yellow('no → inherit');
    const sugg = h.found && h.perAgentModel ? `mid ${h.suggestion.mid} · low ${h.suggestion.low}` : '';
    return `${pad(h.name, 12)} ${pad(status, 6)} ${pad(model, w)} ${pad(sub, 18)} ${sugg}`;
  });
  const head = pc.bold(`${pad('Tool', 12)} ${pad('Status', 6)} ${pad('Session model', w)} ${pad('Per-subagent', 18)} Suggested workers`);
  const warns = results.flatMap((h) => h.warnings.map((w) => pc.yellow(`! ${h.name}: ${w}`)));
  return [head, ...rows, ...warns].join('\n');
}

function summary(res, { tools, orchestration, platforms }) {
  const lines = [
    `${pc.bold('Version')}   ${res.previousVersion ? `${res.previousVersion} → ` : ''}${res.version}`,
    `${pc.bold('Tools')}     ${tools.map((t) => platforms[t]?.name || t).join(', ')}`,
    `${pc.bold('Skills')}    ${res.skills} → ${res.targetDirs.join(', ')}`,
  ];
  if (res.commands) lines.push(`${pc.bold('Commands')}  ${res.commands} pointer files`);
  if (res.agents.length) lines.push(`${pc.bold('Agents')}    ${res.agents.length} role agents (${[...new Set(res.agents.map((a) => a.split('/').slice(0, 2).join('/')))].join(', ')})`);
  lines.push(`${pc.bold('Plan CLI')}  node _lean/bin/lean.js check | next | freeze | metrics | claim`);
  if (res.hooks?.length) lines.push(`${pc.bold('Hooks')}     ${res.hooks.join(', ')}`);
  lines.push('', pc.bold('Role → model'));
  for (const t of tools) {
    const per = Object.entries(orchestration.roles).map(([r, tier]) => `${r}=${resolveModel(tier, orchestration.tiers[t] || {})}`).join(' · ');
    lines.push(`  ${pad(platforms[t]?.name || t, 12)} orchestrator=session · ${per}`);
  }
  if (res.removed.length) lines.push('', pc.yellow(`Removed ${res.removed.length} files no longer installed.`));
  if (res.backupDir) lines.push('', pc.yellow(`${res.edited.length} files you had edited were backed up to ${res.backupDir}`));
  lines.push('', pc.dim('Config: _lean/config.toml (team) · _lean/config.user.toml (you) · overrides in _lean/custom/'));
  return lines.join('\n');
}

module.exports = { intro, outro, note, info, text, confirm, select, multiselect, spin, scoutTable, summary };
