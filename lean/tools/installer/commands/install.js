'use strict';
const path = require('node:path');
const fs = require('node:fs');
const pc = require('picocolors');
const { scout } = require('../lib/scout');
const { install, loadPlatforms, formatPlatformList, readManifest, VERSION } = require('../lib/installer');
const { loadModule, readPrevious, readCustom, deepMerge, defaultFor, applySets, ROLES } = require('../lib/config');
const { resolveModel } = require('../lib/role-agents');
const ui = require('../lib/ui');

module.exports = {
  command: 'install',
  description: 'Install or update LEAN skills, config and role agents in a project',
  options: [
    ['--directory <path>', 'Project directory (default: current directory)'],
    ['--tools <tools>', 'Comma-separated tool IDs (e.g. "claude-code,opencode"). Required for a fresh --yes install unless tools are detected.'],
    ['--list-tools', 'Print all supported tool IDs with their target directories, then exit'],
    ['--list-options', 'Print the keys accepted by --set, then exit'],
    ['--set <spec>', 'Set a value non-interactively: <key>=<value>, e.g. style=standard, orchestration.tiers.claude-code.low=haiku, orchestration.roles.review=top. Repeatable.', (v, prev) => [...(prev || []), v], []],
    ['--action <type>', 'For an existing install: update (re-ask, prior answers as defaults) or quick-update (keep all answers)'],
    ['--user-name <name>', 'Name the skills call you (default: system user)'],
    ['--communication-language <lang>', 'Language for talking with you (default: English)'],
    ['--document-output-language <lang>', 'Language for documents (default: English)'],
    ['--input-folder <path>', 'Source-documents folder relative to project root (default: docs)'],
    ['--output-folder <path>', 'Plans folder relative to project root (default: plan)'],
    ['--style <style>', 'kiss | standard (default: kiss)'],
    ['--no-scout', 'Skip agent scouting (tiers default to inherit unless set with --set)'],
    ['--no-guard-hook', 'Claude Code: don\'t add the frozen-intent guard hook to .claude/settings.json'],
    ['--git-hook', 'Add a git pre-commit hook that runs the plan check (only if no other pre-commit hook exists)'],
    ['-y, --yes', 'Accept defaults and skip prompts'],
  ],
  action: async (opts) => {
    if (opts.listTools) return void process.stdout.write(formatPlatformList() + '\n');
    if (opts.listOptions) return void process.stdout.write(listOptions() + '\n');

    const interactive = !opts.yes && process.stdin.isTTY;
    const projectRoot = path.resolve(opts.directory || process.cwd());
    const mod = loadModule();
    const platforms = loadPlatforms();

    if (interactive) await ui.intro(`LEAN Method v${VERSION}`);

    const existing = readManifest(projectRoot);
    let action = opts.action || (existing ? 'update' : 'install');
    if (existing && interactive && !opts.action) {
      action = await ui.select(`LEAN v${existing.installation.version} is installed here. What now?`, [
        { value: 'update', label: 'Update — re-ask, previous answers as defaults' },
        { value: 'quick-update', label: 'Quick update — keep every answer, refresh files' },
        { value: 'cancel', label: 'Cancel' },
      ]);
      if (action === 'cancel') return ui.outro('Nothing changed.');
    }
    const previous = existing ? readPrevious(projectRoot) : {};
    const quick = action === 'quick-update';

    // ── Scout ────────────────────────────────────────────────────────
    let scouted = [];
    if (opts.scout !== false && !quick) {
      scouted = interactive ? await ui.spin('Scouting coding agents on this machine…', () => scout(projectRoot)) : scout(projectRoot);
      if (interactive) ui.note(ui.scoutTable(scouted), 'Agents found');
    }
    const detected = scouted.filter((h) => h.found).map((h) => h.code).filter((c) => platforms[c]);

    // ── Tools ────────────────────────────────────────────────────────
    let tools = opts.tools ? opts.tools.split(',').map((t) => t.trim()).filter(Boolean) : existing?.tools || detected;
    if (interactive && !quick) {
      const codes = [...new Set([...Object.keys(platforms).filter((c) => platforms[c].preferred), ...detected, ...(existing?.tools || [])])];
      const rest = Object.keys(platforms).filter((c) => !codes.includes(c));
      tools = await ui.multiselect(
        'Install for which tools?',
        [...codes, ...rest].map((c) => ({ value: c, label: platforms[c].name, hint: detected.includes(c) ? 'detected' : platforms[c].installer.target_dir })),
        tools.length ? tools : ['claude-code'],
      );
    }
    if (!tools.length) throw new Error('No tools selected. Pass --tools (see --list-tools).');

    // ── Questions (module.yaml) ──────────────────────────────────────
    const flagFor = { user_name: opts.userName, communication_language: opts.communicationLanguage, document_output_language: opts.documentOutputLanguage, input_folder: opts.inputFolder, output_folder: opts.outputFolder, style: opts.style };
    const answers = {};
    if (interactive && !quick) ui.note(mod.subheader, mod.header);
    for (const q of mod.questions) {
      const def = defaultFor(q, projectRoot, previous);
      if (flagFor[q.key] !== undefined) answers[q.key] = flagFor[q.key];
      else if (!interactive || quick) answers[q.key] = def;
      else if (q.options) answers[q.key] = await ui.select(q.prompt, q.options, def);
      else answers[q.key] = await ui.text(q.prompt, def);
    }

    // ── Orchestration ────────────────────────────────────────────────
    const orchestration = {
      primary: tools.find((t) => ['claude-code', 'opencode'].includes(t)) || tools[0],
      escalate: previous.orchestration?.escalate ?? true,
      roles: { ...ROLES, ...(previous.orchestration?.roles || {}) },
      tiers: { ...(previous.orchestration?.tiers || {}) },
    };
    for (const code of tools) {
      const h = scouted.find((x) => x.code === code);
      if (!h || orchestration.tiers[code] && (quick || !interactive)) continue;
      const s = h.suggestion;
      orchestration.tiers[code] = { top: 'inherit', mid: s.mid, low: s.low };
      if (interactive && !quick && h.perAgentModel) orchestration.tiers[code] = await chooseTiers(h, orchestration.tiers[code], previous.orchestration?.tiers?.[code]);
      else if (interactive && !h.perAgentModel && h.found) ui.info(`${h.name}: no per-subagent model — LEAN workers there run on the session model.`);
    }
    if (interactive && !quick) {
      const reviewTop = await ui.confirm(
        'Run reviewers on the session model instead of the mid tier? Catches more bugs, costs more. (Triage always runs on the session model.)',
        orchestration.roles.review === 'top',
      );
      orchestration.roles.review = reviewTop ? 'top' : 'mid';
    }
    applySets(opts.set, answers, orchestration, mod);
    if (answers.input_folder && answers.output_folder && path.normalize(answers.input_folder) === path.normalize(answers.output_folder))
      throw new Error('input_folder and output_folder must differ: LEAN never writes into your source documents.');

    // ── Hooks ────────────────────────────────────────────────────────
    let guardHook = opts.guardHook !== false && (existing?.hooks ? existing.hooks.includes('claude-code:frozen-guard') || !existing.tools.includes('claude-code') : true);
    let gitHook = opts.gitHook || (existing?.hooks || []).includes('git:pre-commit');
    if (interactive && !quick) {
      if (tools.includes('claude-code') && opts.guardHook !== false)
        guardHook = await ui.confirm('Claude Code: add a hook that refuses edits to frozen intent and frozen acceptance tests? (merged into .claude/settings.json)', guardHook);
      if (!opts.gitHook) gitHook = await ui.confirm('Add a git pre-commit hook that runs the plan check?', gitHook);
    }
    const basic = tools.filter((t) => platforms[t] && platforms[t].support !== 'full');
    if (basic.length) {
      const msg = `Basic support for ${basic.map((t) => platforms[t].name).join(', ')}: the skills run, but on one model and with review in the same context — no cheap worker tiers, no blind reviewers. Full support: Claude Code, OpenCode, Antigravity CLI.`;
      interactive ? ui.info(msg) : process.stderr.write(msg + '\n');
    }

    // ── Install ──────────────────────────────────────────────────────
    const run = () => install({ projectRoot, tools, answers, orchestration, guardHook, gitHook });
    const res = interactive ? await ui.spin('Installing…', run) : run();
    const summary = ui.summary(res, { projectRoot, tools, orchestration: deepMerge(orchestration, readCustom(projectRoot).orchestration || {}), platforms });
    if (interactive) {
      ui.note(summary, 'Installed');
      await ui.outro('LEAN is ready. Start with the lean-intent skill, or run lean-kit to review the tiers.');
    } else process.stdout.write(summary + '\n');
  },
};

async function chooseTiers(h, suggested, previous) {
  const current = h.current ? ` (session: ${h.current})` : '';
  const guessed = (t) => (h.suggestion.guessed || []).includes(t) ? pc.yellow(' — guessed from the session model id, verify it exists') : '';
  ui.note(
    [
      `${pc.bold(h.name)}${current}`,
      `top  → orchestrator: specs, triage, decisions, talking to you — always the session model`,
      `mid  → implement · review · check · research   suggested: ${pc.cyan(suggested.mid)}${guessed('mid')}`,
      `low  → scout (search, extraction)             suggested: ${pc.cyan(suggested.low)}${guessed('low')}`,
      '',
      pc.dim(h.suggestion.why),
      pc.dim('Cheaper workers are safe here because the orchestrator verifies everything they return.'),
      ...h.warnings.map((w) => pc.yellow(`! ${w}`)),
    ].join('\n'),
    'Model tiers',
  );
  const out = { top: 'inherit' };
  for (const tier of ['mid', 'low']) {
    const pre = previous?.[tier] || suggested[tier];
    // Same provider as the session first (its credentials are known to work), then the rest of what the tool lists.
    const provider = h.current?.includes('/') ? h.current.split('/')[0] : null;
    const same = h.models.filter((m) => provider && m.startsWith(provider + '/'));
    const pool = [...same, ...h.models.filter((m) => !same.includes(m))];
    const values = [...new Set([pre, suggested[tier], 'inherit', ...pool])].filter(Boolean).slice(0, 14);
    const choice = await ui.select(
      `${tier === 'mid' ? 'Mid' : 'Low'}-tier model for ${h.name}`,
      [...values.map((v) => ({ value: v, label: v, hint: v === suggested[tier] ? 'suggested' : v === 'inherit' ? 'same as session' : undefined })), { value: '__other', label: 'Other… (type a model id)' }],
      pre,
    );
    out[tier] = choice === '__other' ? await ui.text(`Model id (${h.modelFormat})`, pre) : choice;
  }
  return out;
}

function listOptions() {
  const mod = loadModule();
  const rows = mod.questions.map((q) => `${(q.section + '.' + q.key).padEnd(34)} ${q.prompt}  [default: ${q.default}]`);
  return [
    ...rows,
    `${'orchestration.tiers.<tool>.mid'.padEnd(34)} Model for implement/review/check/research on <tool>`,
    `${'orchestration.tiers.<tool>.low'.padEnd(34)} Model for scouts on <tool>`,
    `${'orchestration.roles.<role>'.padEnd(34)} Tier (top|mid|low) or model for a role: ${Object.keys(ROLES).join(', ')}`,
    `${'orchestration.escalate'.padEnd(34)} Re-run a failed worker one tier up (true|false)`,
  ].join('\n');
}
