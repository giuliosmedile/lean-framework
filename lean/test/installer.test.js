'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const TOML = require('smol-toml');
const { classify, suggestTiers } = require('../tools/installer/lib/scout');
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
  assert.deepEqual(pickTiers(suggestTiers('codex', 'gpt-6', [])), ['inherit', 'inherit']);
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

test('fresh --yes install writes skills, pointers, role agents, config, manifests', () => {
  const root = tmp();
  cli('install', '--directory', root, '--tools', 'claude-code,opencode', '--yes', '--no-scout', '--user-name', 'Ada', '--set', 'orchestration.tiers.claude-code.mid=sonnet', '--set', 'orchestration.tiers.claude-code.low=haiku');
  for (const rel of [
    '.claude/skills/lean-build/SKILL.md',
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
