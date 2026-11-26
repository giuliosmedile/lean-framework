'use strict';
// The CLI colors its output when FORCE_COLOR is set, and npm sets it for scripts run from a terminal
// (`npm publish` → prepublishOnly → `npm test`). The tests match plain text, so switch colors off for the children.
delete process.env.FORCE_COLOR;
process.env.NO_COLOR = '1';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const TOML = require('smol-toml');
const { classify, suggestTiers, HARNESSES } = require('../tools/installer/lib/scout');
const { renderRoleAgents, resolveModel } = require('../tools/installer/lib/role-agents');
const { readMerged } = require('../tools/installer/lib/config');

const CLI = path.join(__dirname, '../tools/installer/lean-cli.js');
const cli = (...args) => execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lean-test-'));
const exists = (root, rel) => fs.existsSync(path.join(root, rel));

test('classify places model families conservatively', () => {
  assert.equal(classify('opus').tier, 'top');
  assert.equal(classify('amazon-bedrock/eu.anthropic.claude-sonnet-5-5').tier, 'mid');
  assert.equal(classify('anthropic/claude-haiku-5-5').tier, 'low');
  assert.equal(classify('openai/gpt-5.5-mini').tier, 'low');
  assert.equal(classify('openai/gpt-6-sol').tier, null);
  assert.equal(classify('opencode/glm-5.3-flash-free').free, true);
});

test('tier suggestions follow the session model', () => {
  assert.deepEqual(pickTiers(suggestTiers('claude-code', 'opus', [])), ['sonnet', 'haiku']);
  assert.deepEqual(pickTiers(suggestTiers('claude-code', 'sonnet', [])), ['inherit', 'haiku']);
  assert.deepEqual(pickTiers(suggestTiers('claude-code', 'haiku', [])), ['inherit', 'inherit']);
  const oc = suggestTiers('opencode', 'amazon-bedrock/eu.anthropic.claude-sonnet-5-5', ['openai/gpt-6-sol']);
  assert.deepEqual(pickTiers(oc), ['inherit', 'amazon-bedrock/eu.anthropic.claude-haiku-5-5']);
  assert.deepEqual(oc.guessed, ['low']);
  assert.deepEqual(pickTiers(suggestTiers('codex', 'gpt-6.1-sol', [])), ['gpt-6.1-sol#medium', 'gpt-6-luna#medium']);
  assert.deepEqual(pickTiers(suggestTiers('codex', 'gpt-6-luna', [])), ['inherit', 'inherit#low']);
});
const pickTiers = (s) => [s.mid, s.low];

test('role agents carry the role model in each tool format', () => {
  const roles = { scout: 'low', implement: 'mid', review: 'top' };
  const cc = renderRoleAgents('claude-code', roles, { mid: 'sonnet', low: 'haiku' });
  assert.match(cc.find((a) => a.role === 'scout').content, /model: haiku[\s\S]*disallowedTools: Edit, Write, NotebookEdit/);
  assert.match(cc.find((a) => a.role === 'review').content, /model: inherit/);
  const oc = renderRoleAgents('opencode', roles, { mid: 'anthropic/claude-sonnet-5-5', low: 'inherit' });
  assert.match(oc.find((a) => a.role === 'implement').content, /mode: subagent\nmodel: anthropic\/claude-sonnet-5-5/);
  assert.doesNotMatch(oc.find((a) => a.role === 'scout').content, /model:/); // inherit → omitted
  assert.equal(resolveModel('some/model', {}), 'some/model');
});

test('Codex role agents: TOML with model and reasoning effort, read-only by instruction', () => {
  assert.equal(HARNESSES.codex.perAgentModel, true);
  const agents = renderRoleAgents('codex', { scout: 'low', implement: 'mid', review: 'top' }, { low: 'gpt-6-luna#medium', mid: 'gpt-6.1-sol' });
  const by = Object.fromEntries(agents.map((a) => [a.role, a]));
  assert.equal(by.scout.relPath, '.codex/agents/lean-scout.toml');
  const scout = TOML.parse(by.scout.content);
  assert.equal(scout.name, 'lean_scout');
  assert.equal(scout.model, 'gpt-6-luna');
  assert.equal(scout.model_reasoning_effort, 'medium');
  assert.match(scout.developer_instructions, /Read-only role/);
  assert.equal(scout.skills.include_instructions, false);
  const impl = TOML.parse(by.implement.content);
  assert.equal(impl.model, 'gpt-6.1-sol');
  assert.equal(impl.model_reasoning_effort, undefined);
  assert.doesNotMatch(impl.developer_instructions, /Read-only role/);
  const review = TOML.parse(by.review.content);
  assert.equal(review.model, undefined, 'top → inherit → omitted');
  assert.throws(() => renderRoleAgents('codex', { scout: 'low' }, { low: 'gpt-6-luna#turbo' }), /reasoning effort/);
});

test('Codex install: agents, guard hook in .codex/hooks.json merged and removed cleanly', () => {
  const root = tmp();
  execFileSync('git', ['-C', root, 'init', '-q']);
  fs.mkdirSync(path.join(root, '.codex'));
  const mine = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }] } };
  fs.writeFileSync(path.join(root, '.codex/hooks.json'), JSON.stringify(mine));
  cli('install', '--directory', root, '--tools', 'codex', '--yes', '--no-scout', '--set', 'orchestration.tiers.codex.low=gpt-6-luna#low');
  assert.ok(exists(root, '.agents/skills/lean-build/SKILL.md'));
  assert.equal(TOML.parse(fs.readFileSync(path.join(root, '.codex/agents/lean-scout.toml'), 'utf8')).model_reasoning_effort, 'low');
  const hooks = JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8')).hooks.PreToolUse;
  assert.equal(hooks.length, 2);
  assert.equal(hooks[1].matcher, '^apply_patch$');
  assert.match(hooks[1].hooks[0].command, /git rev-parse --show-toplevel\)\/_lean\/hooks\/frozen-guard\.js/);
  cli('install', '--directory', root, '--action', 'quick-update', '--yes', '--no-scout');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8')).hooks.PreToolUse.length, 2, 'no duplicate on re-install');
  cli('uninstall', '--directory', root, '--yes');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'), 'utf8')), mine);
  assert.ok(!exists(root, '.codex/agents'));
});

test('Antigravity CLI uses native worker presets and detects agy', () => {
  const h = HARNESSES['antigravity-cli'];
  assert.equal(h.bin, 'agy');
  assert.equal(h.perAgentModel, true);
  assert.deepEqual(pickTiers(suggestTiers('antigravity-cli', null, [])), ['pro', 'flash']);
  const agents = renderRoleAgents('antigravity-cli', { scout: 'low', review: 'mid' }, { low: 'flash', mid: 'pro' });
  assert.equal(agents[0].relPath, '.agents/agents/lean-scout/agent.md');
  assert.match(agents[0].content, /name: lean-scout[\s\S]*subagent: true[\s\S]*model: flash/);
  assert.match(agents[1].content, /model: pro/);
  assert.throws(() => renderRoleAgents('antigravity-cli', { scout: 'low' }, { low: 'gemini-3.8-flash-medium' }), /preset|flash/i);
});

test('quick-update generates agy workers from effective custom overrides without changing base answers', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'antigravity-cli', '--yes', '--no-scout', '--set', 'orchestration.tiers.antigravity-cli.mid=inherit');
  fs.appendFileSync(path.join(root, '_lean/custom/config.user.toml'), '\n[orchestration.tiers.antigravity-cli]\nmid = "pro"\nlow = "flash"\n');
  cli('install', '--directory', root, '--action', 'quick-update', '--yes');
  assert.match(fs.readFileSync(path.join(root, '.agents/agents/lean-review/agent.md'), 'utf8'), /model: pro/);
  assert.match(fs.readFileSync(path.join(root, '.agents/agents/lean-scout/agent.md'), 'utf8'), /model: flash/);
  const user = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.user.toml'), 'utf8'));
  assert.equal(user.orchestration.tiers['antigravity-cli'].mid, 'inherit');
  assert.match(cli('status', '--directory', root), /antigravity-cli:.*scout=flash.*review=pro/);
});

test('invalid agy preset fails without overwriting an existing install', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'antigravity-cli', '--yes', '--no-scout', '--set', 'orchestration.tiers.antigravity-cli.low=flash');
  const agent = path.join(root, '.agents/agents/lean-scout/agent.md');
  const before = fs.readFileSync(agent, 'utf8');
  fs.appendFileSync(path.join(root, '_lean/custom/config.user.toml'), '\n[orchestration.tiers.antigravity-cli]\nlow = "gemini-3.8-flash-medium"\n');
  assert.throws(() => execFileSync(process.execPath, [CLI, 'install', '--directory', root, '--action', 'quick-update', '--yes'], { stdio: 'pipe' }), /preset|flash/i);
  assert.equal(fs.readFileSync(agent, 'utf8'), before);
});

test('fresh --yes install writes skills, pointers, role agents, config, manifests', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code,opencode', '--yes', '--no-scout', '--user-name', 'Ada', '--set', 'orchestration.tiers.claude-code.mid=sonnet', '--set', 'orchestration.tiers.claude-code.low=haiku');
  for (const rel of [
    '.claude/skills/lean-build/SKILL.md',
    '.claude/skills/lean-loop/SKILL.md',
    '.opencode/commands/lean-loop.md',
    '.claude/skills/lean-help/guide.md',
    '.opencode/commands/lean-help.md',
    '.claude/skills/lean-review/lenses/edge-case-hunter.md',
    '.agents/skills/lean-plan/assets/contracts-template.md',
    '.agents/skills/lean-plan/assets/epics-template.yaml',
    '.agents/skills/lean-plan/assets/epic-template.md',
    '.agents/skills/lean-plan/assets/story-template.md',
    '.opencode/commands/lean-intent.md',
    '.claude/agents/lean-scout.md',
    '.opencode/agents/lean-implement.md',
    '_lean/config.toml',
    '_lean/config.user.toml',
    '_lean/custom/config.toml',
    '_lean/.gitignore',
    '_lean/_config/manifest.yaml',
    '_lean/_config/files-manifest.csv',
    '_lean/_config/skill-manifest.csv',
    'plan',
  ])
    assert.ok(exists(root, rel), rel);
  const user = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.user.toml'), 'utf8'));
  assert.equal(user.core.user_name, 'Ada');
  assert.equal(user.orchestration.tiers['claude-code'].low, 'haiku');
  const team = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.toml'), 'utf8'));
  assert.equal(team.core.output_folder, '{project-root}/plan');
  assert.equal(team.lean.style, 'kiss');
  assert.equal(team.lean.prose, 'plain', 'wording rules are off by default');
  assert.ok(exists(root, '.claude/skills/lean-kit/ste.md'), 'ste.md ships with lean-kit');
  assert.equal(team.core.user_name, undefined, 'user-scope answers stay out of the team file');
  assert.match(fs.readFileSync(path.join(root, '.claude/agents/lean-scout.md'), 'utf8'), /model: haiku/);
  assert.match(fs.readFileSync(path.join(root, '.opencode/commands/lean-build.md'), 'utf8'), /@skills\/lean-build/);
});

test('update keeps answers, backs up edits, drops deselected tools, keeps custom overrides', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code,opencode', '--yes', '--no-scout', '--style', 'standard');
  fs.appendFileSync(path.join(root, '.claude/skills/lean-build/SKILL.md'), '\nmy edit\n');
  fs.appendFileSync(path.join(root, '_lean/custom/config.toml'), '\n[lean]\nstyle = "kiss"\n');
  assert.match(cli('status', '--directory', root), /edited since install \(1\)/);

  cli('install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout');
  assert.ok(!exists(root, '.opencode'), 'opencode files removed');
  assert.ok(!exists(root, '.agents'), 'shared .agents/skills removed when no tool needs it');
  const backups = fs.readdirSync(path.join(root, '_lean/_backups'));
  assert.equal(backups.length, 1);
  assert.match(fs.readFileSync(path.join(root, '_lean/_backups', backups[0], '.claude/skills/lean-build/SKILL.md'), 'utf8'), /my edit/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, '.claude/skills/lean-build/SKILL.md'), 'utf8'), /my edit/);
  const team = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.toml'), 'utf8'));
  assert.equal(team.lean.style, 'standard', 'previous answer kept');
  assert.equal(readMerged(root).lean.style, 'kiss', 'custom override wins in the merged view');
});

test('--set prose=ste80 is stored in the team file and kept across updates, independent of style', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout', '--set', 'prose=ste80');
  const read = () => {
    const lean = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.toml'), 'utf8')).lean;
    return [lean.style, lean.prose];
  };
  assert.deepEqual(read(), ['kiss', 'ste80']);
  cli('install', '--directory', root, '--action', 'quick-update', '--yes', '--style', 'standard');
  assert.deepEqual(read(), ['standard', 'ste80'], 'prose survives an update that changes style');
  assert.match(cli('install', '--list-options'), /lean\.prose/);
});

test('quick-update and --set roles regenerate role agents', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout', '--set', 'orchestration.tiers.claude-code.mid=sonnet');
  assert.match(fs.readFileSync(path.join(root, '.claude/agents/lean-review.md'), 'utf8'), /model: sonnet/);
  cli('install', '--directory', root, '--action', 'quick-update', '--yes', '--set', 'orchestration.roles.review=top');
  assert.match(fs.readFileSync(path.join(root, '.claude/agents/lean-review.md'), 'utf8'), /model: inherit/);
});

test('uninstall removes owned files and keeps custom and plans', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code,codex', '--yes', '--no-scout');
  fs.writeFileSync(path.join(root, 'plan', 'keep.md'), 'my plan');
  cli('uninstall', '--directory', root, '--yes');
  assert.ok(!exists(root, '.claude'));
  assert.ok(!exists(root, '_lean/config.toml'));
  assert.ok(exists(root, '_lean/custom/config.toml'));
  assert.ok(exists(root, 'plan/keep.md'));
});

test('bad input fails loudly', () => {
  const root = tmp();
  assert.throws(() => execFileSync(process.execPath, [CLI, 'install', '--directory', root, '--tools', 'nope', '--yes', '--no-scout'], { stdio: 'pipe' }), /Unknown tool/);
  assert.throws(() => execFileSync(process.execPath, [CLI, 'install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout', '--set', 'bogus=1'], { stdio: 'pipe' }), /Unknown --set key/);
});

test('skills: referenced assets exist and no stale single-file layout remains', () => {
  const skillsDir = path.join(__dirname, '../skills');
  const problems = [];
  for (const skill of fs.readdirSync(skillsDir)) {
    const dir = path.join(skillsDir, skill);
    const files = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.md') || f.endsWith('.yaml'));
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of text.matchAll(/`assets\/([\w.-]+)`/g)) {
        if (!fs.existsSync(path.join(dir, 'assets', m[1]))) problems.push(`${skill}/${f}: missing assets/${m[1]}`);
      }
      for (const stale of [/plan\/<slug>\//, /\bstory 0\b/i, /stories\.yaml[^\n]*\bstatus:/]) {
        if (stale.test(text) && !/no status|NO status/.test(text.match(stale)?.input.split('\n').find((l) => stale.test(l)) || '')) problems.push(`${skill}/${f}: stale ${stale}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('lean-loop: every check code and CLI command it names exists', () => {
  const skill = fs.readFileSync(path.join(__dirname, '../skills/lean-loop/SKILL.md'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../tools/installer/lib/plan-check.js'), 'utf8');
  const { COMMANDS } = require('../tools/installer/plan-cli');
  const codes = [...skill.matchAll(/`((?:story|diff|epics)\/[a-z-]+)`/g)].map((m) => m[1]);
  assert.ok(codes.length >= 6, 'the gates name their check codes');
  for (const code of codes) assert.ok(source.includes(`'${code}'`), `plan-check.js has no ${code}`);
  const verbs = [...skill.matchAll(/lean-method (\w+)/g)].map((m) => m[1]);
  assert.ok(verbs.length > 0);
  for (const verb of verbs) assert.ok(COMMANDS.includes(verb), `lean-method has no "${verb}" command`);
});

test('input folder: asked, created, stored, and must differ from output', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout', '--input-folder', 'context');
  assert.ok(exists(root, 'context'));
  const team = TOML.parse(fs.readFileSync(path.join(root, '_lean/config.toml'), 'utf8'));
  assert.equal(team.core.input_folder, '{project-root}/context');
  assert.match(cli('status', '--directory', root), /input: \{project-root\}\/context/);
  const def = tmp();
  cli('install', '--directory', def, '--tools', 'claude-code', '--yes', '--no-scout');
  assert.ok(exists(def, 'docs'), 'default input folder is docs');
  assert.throws(() => execFileSync(process.execPath, [CLI, 'install', '--directory', tmp(), '--tools', 'claude-code', '--yes', '--no-scout', '--input-folder', 'plan'], { stdio: 'pipe' }), /must differ/);
});

test('install vendors the plan CLI and the guard hook; uninstall removes only what LEAN added', () => {
  const root = tmp();
  execFileSync('git', ['-C', root, 'init', '-q']);
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(path.join(root, '.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }));
  cli('install', '--directory', root, '--tools', 'claude-code', '--yes', '--no-scout', '--git-hook');
  for (const rel of ['_lean/bin/lean.js', '_lean/bin/lib/plan-check.js', '_lean/bin/commands/claim.js', '_lean/bin/node_modules/yaml/package.json', '_lean/hooks/frozen-guard.js', '.claude/agents/lean-test.md'])
    assert.ok(exists(root, rel), rel);
  const out = execFileSync(process.execPath, [path.join(root, '_lean/bin/lean.js'), 'check', '--directory', root], { encoding: 'utf8', cwd: os.tmpdir() });
  assert.match(out, /PASS/);
  const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions.allow, ['Bash(ls)']);
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /_lean\/hooks\/frozen-guard\.js/);
  assert.match(fs.readFileSync(path.join(root, '.git/hooks/pre-commit'), 'utf8'), /lean-method pre-commit/);
  cli('install', '--directory', root, '--action', 'quick-update', '--yes', '--no-scout');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8')).hooks.PreToolUse.length, 1, 're-install does not duplicate the hook');
  assert.ok(exists(root, '.git/hooks/pre-commit'), 'quick-update keeps the git hook');
  cli('uninstall', '--directory', root, '--yes');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8')), { permissions: { allow: ['Bash(ls)'] } });
  assert.ok(!exists(root, '.git/hooks/pre-commit'));
  assert.ok(!exists(root, '_lean/bin'));
});
