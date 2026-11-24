'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveProject, loadPlan } = require('../tools/installer/lib/plan');
const { checkPlan, checkStory, nextStories } = require('../tools/installer/lib/plan-check');
const { aggregate } = require('../tools/installer/lib/metrics');

const CLI = path.join(__dirname, '../tools/installer/lean-cli.js');
const run = (...args) => {
  try {
    return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: e.stdout };
  }
};

const write = (root, rel, text) => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
};
const story = (id, { status = 'todo', lane = '', extra = '', body = '' } = {}) =>
  `---\nid: ${id}\ntitle: 'Story ${id}'\nepic: ${id.split('-')[0]}\nlane: '${lane}'\ncaps: [CAP-1]\nrules: [AD-1]\nstatus: ${status}\n${extra}---\n\n# ${id}\n\n${body}`;

/** A small valid tree: E1 single-lane (done), E2 two lanes with contracts. */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-plan-'));
  write(root, 'plan/SPEC.md', '---\nstatus: final\n---\n## Capabilities\n\n- **CAP-1 — search**\n- **CAP-2 — export**\n\n## Quality Requirements\n\n- **QR-1:** fast enough\n');
  write(root, 'plan/ARCHITECTURE.md', '---\nstatus: final\n---\n### AD-1 — hexagonal\n');
  write(root, 'plan/epics.yaml', `uncovered: ['QR-1: measured later']
epics:
  - { id: E1, title: Foundation, folder: epics/E1-foundation, caps: [CAP-1], depends_on: [], status: done }
  - { id: E2, title: Export, folder: epics/E2-export, caps: [CAP-2], depends_on: [E1], status: active }
`);
  write(root, 'plan/epics/E1-foundation/EPIC.md', '---\nid: E1\nstatus: done\n---\n## Exit evidence\n\n- e2e `scaffold.e2e` green at abc123\n');
  write(root, 'plan/epics/E1-foundation/stories.yaml', 'epic: E1\nstories:\n  - { id: E1-1, title: Scaffold, file: stories/E1-1-scaffold.md, depends_on: [] }\n');
  write(root, 'plan/epics/E1-foundation/stories/E1-1-scaffold.md', story('E1-1', { status: 'done' }));

  write(root, 'plan/epics/E2-export/EPIC.md', '---\nid: E2\nstatus: active\n---\n## Epic decisions\n\n### AD-2 — csv only\n');
  write(root, 'plan/epics/E2-export/stories.yaml', `epic: E2
lanes:
  - { id: A, owner: ann, modules: [src/a/] }
  - { id: B, owner: bob, modules: [src/b] }
stories:
  - { id: E2-0, title: Contracts, file: stories/E2-0-contracts.md, lane: shared, depends_on: [E1-1] }
  - { id: E2-1, title: Producer, file: stories/E2-1-producer.md, lane: A, depends_on: [E2-0] }
  - { id: E2-2, title: Consumer, file: stories/E2-2-consumer.md, lane: B, depends_on: [E2-0] }
  - { id: E2-3, title: Checkpoint, file: stories/E2-3-checkpoint.md, lane: integration, depends_on: [E2-1, E2-2] }
`);
  for (const [id, slug, lane] of [['E2-0', 'contracts', 'shared'], ['E2-1', 'producer', 'A'], ['E2-2', 'consumer', 'B'], ['E2-3', 'checkpoint', 'integration']])
    write(root, `plan/epics/E2-export/stories/${id}-${slug}.md`, story(id, { lane }).replace('caps: [CAP-1]', 'caps: [CAP-2]'));
  write(root, 'plan/epics/E2-export/CONTRACTS.md', `---
status: draft
contracts_path: src/contracts
fixtures_path: test/fixtures
---
## Seams

| # | Port / type | Producer → consumer | Real impl (lane · story) | Fake | Contract test | Checkpoint story |
|---|---|---|---|---|---|---|
| S-1 | Rows | A → B | A · E2-1 | FakeRows | RowsContract | E2-3 |

## Decisions due

| Decision | Decide by (story) | Owner | Status |
|---|---|---|---|
| CSV delimiter | E2-2 | bob | open |
`);
  return root;
}

const load = (root) => loadPlan(resolveProject(root));
const codes = (fs_) => fs_.map((f) => f.code).sort();
const errors = (fs_) => fs_.filter((f) => f.level === 'error');
const edit = (root, rel, fn) => write(root, rel, fn(fs.readFileSync(path.join(root, rel), 'utf8')));

test('a valid tree passes with no errors and no warnings', () => {
  const root = fixture();
  assert.deepEqual(checkPlan(load(root)), []);
  const r = run('check', '--directory', root);
  assert.equal(r.code, 0);
  assert.match(r.out, /PASS — plan: 0 error/);
});

test('mechanical tree defects are all caught', () => {
  const root = fixture();
  const E2 = 'plan/epics/E2-export';
  edit(root, 'plan/epics.yaml', (t) => t.replace("uncovered: ['QR-1: measured later']", 'uncovered: []'));
  edit(root, `${E2}/stories.yaml`, (t) =>
    t
      .replace('{ id: E2-1, title: Producer,', '{ id: E2-1, status: done, title: Producer,')
      .replace('lane: A, depends_on: [E2-0] }', 'lane: A, depends_on: [E2-0, E2-4] }') +
      '  - { id: E2-4, title: Later, file: stories/E2-4-later.md, lane: A, depends_on: [E2-1] }\n');
  write(root, `${E2}/stories/E2-4-later.md`, story('E2-4', { lane: 'A' }).replace('caps: [CAP-1]', 'caps: [CAP-2]'));
  write(root, `${E2}/stories/E2-9-stray.md`, story('E2-9'));
  edit(root, `${E2}/stories/E2-2-consumer.md`, (t) => t.replace('status: todo', 'status: blocked').replace('rules: [AD-1]', 'rules: [AD-7]'));
  edit(root, `${E2}/CONTRACTS.md`, (t) => t.replace('| A · E2-1 |', '|  |'));
  edit(root, 'plan/epics/E1-foundation/stories/E1-1-scaffold.md', (t) => t.replace('status: done', 'status: in-progress'));

  const f = checkPlan(load(root));
  for (const c of [
    'caps/uncovered', // QR-1 no longer covered
    'stories/status-in-index',
    'stories/dep-forward', // E2-1 → E2-4, same lane, listed later
    'stories/cycle', // E2-1 ↔ E2-4
    'stories/unlisted-file',
    'story/blocked-reason',
    'story/rule-unknown',
    'seams/orphan',
    'epics/done-open-stories',
  ])
    assert.ok(codes(f).includes(c), `expected ${c} in ${codes(f).join(', ')}`);
  assert.equal(run('check', '--directory', root).code, 1);
});

test('lane rules: contracts story, overlap, first-story wait, overdue decisions', () => {
  const root = fixture();
  const E2 = 'plan/epics/E2-export';
  edit(root, `${E2}/stories.yaml`, (t) => t.replace('modules: [src/b]', 'modules: [src/a/sub]').replace("lane: B, depends_on: [E2-0]", 'lane: B, depends_on: [E2-0, E2-1]'));
  edit(root, `${E2}/stories/E2-2-consumer.md`, (t) => t.replace('status: todo', 'status: in-progress'));
  const f = checkPlan(load(root));
  assert.ok(codes(f).includes('lanes/overlap'));
  assert.ok(codes(f).includes('lanes/first-story'));
  assert.ok(codes(f).includes('decisions/overdue'));
  fs.rmSync(path.join(root, E2, 'CONTRACTS.md'));
  assert.ok(codes(checkPlan(load(root))).includes('lanes/no-contracts'));
});

test('freeze records the frozen block; any later edit to it fails check', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) =>
    t.replace('status: todo', 'status: ready\nroute: full') + '<frozen-after-approval reason="x">\n\n## Intent\n\n**Problem:** p\n</frozen-after-approval>\n\n## Implementation Notes\n\n- note\n');
  assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/frozen-unhashed'));

  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1').code, 0);
  assert.match(fs.readFileSync(path.join(root, rel), 'utf8'), /^frozen_sha256: '[0-9a-f]{64}'/m);
  assert.deepEqual(errors(checkStory(load(root), 'E2-1')).filter((x) => x.code.startsWith('story/')), []);

  edit(root, rel, (t) => t.replace('- note', '- note\n- another note')); // outside the block: fine
  assert.ok(!codes(checkStory(load(root), 'E2-1')).includes('story/frozen-changed'));
  edit(root, rel, (t) => t.replace('**Problem:** p', '**Problem:** quietly widened'));
  assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/frozen-changed'));
});

test('build-spec size is measured without the append-only logs', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  const words = (n) => Array(n).fill('word').join(' ');
  edit(root, rel, (t) => t.replace('status: todo', 'status: draft\nroute: full') + `## Intent\n\n${words(500)}\n\n## Review Triage Log\n\n${words(2000)}\n`);
  assert.ok(!codes(checkStory(load(root), 'E2-1')).includes('story/size'), 'logs do not count');
  edit(root, rel, (t) => t.replace('## Intent\n\n', `## Intent\n\n${words(400)} `));
  assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/size'), '900 words ≈ 1200 tokens > 1000');
});

test('next: nothing but <E>-0 until it is done, then one ready story per lane', () => {
  const root = fixture();
  const E2 = 'plan/epics/E2-export/stories';
  let r = nextStories(load(root));
  assert.deepEqual(r.next.map((s) => s.id), ['E2-0']);
  edit(root, `${E2}/E2-0-contracts.md`, (t) => t.replace('status: todo', 'status: done'));
  r = nextStories(load(root));
  assert.deepEqual(r.next.map((s) => s.id), ['E2-1', 'E2-2']);
  assert.deepEqual(nextStories(load(root), { lane: 'B' }).next.map((s) => s.id), ['E2-2']);
  edit(root, `${E2}/E2-1-producer.md`, (t) => t.replace('status: todo', 'status: in-progress'));
  edit(root, `${E2}/E2-2-consumer.md`, (t) => t.replace('status: todo', "status: blocked\nblocked_reason: 'needs C1'"));
  r = nextStories(load(root));
  assert.deepEqual(r.next, []);
  assert.deepEqual(r.inFlight.map((s) => s.id), ['E2-1']);
  assert.deepEqual(r.blocked.map((s) => s.reason), ['needs C1']);
  assert.match(run('next', '--directory', root).out, /resume\s+E2-1 \[A\] in-progress/);
});

test('metrics counts triage rows, not self-reported numbers', () => {
  const root = fixture();
  const rel = 'plan/epics/E1-foundation/stories/E1-1-scaffold.md';
  edit(root, rel, (t) =>
    t.replace(
      'status: done\n',
      `status: done
route: full
review_loops: 1
metrics:
  models: { orchestrator: opus, implement: sonnet, review: sonnet }
  escalations: 1
  worker_tokens: 120000
  orchestrator_tokens: null
  started: '2026-11-12T09:00:00Z'
  finished: '2026-11-12T09:42:00Z'
`
    ) +
      `## Review Triage Log

| # | lens | verdict | route | evidence |
|---|---|---|---|---|
| 1 | adversarial | false | reject | guarded upstream |
| 2 | adversarial | high | patch | null deref |
| 3 | edge-case | medium | bad_spec | empty list |
| 4 | \`verification-gap\` | maybe-false | defer | needs prod data |
`
  );
  write(root, 'plan/epics/E1-foundation/deferred.md', '- source: review\n  summary: x\n');
  const { total, epics } = aggregate(load(root));
  const e1 = epics.find((e) => e.id === 'E1');
  assert.equal(e1.done, 1);
  assert.equal(e1.findings.total, 4);
  assert.equal(e1.findings.false, 1);
  assert.equal(e1.false_rate, 0.25);
  assert.equal(e1.triage_routes.patch, 1);
  assert.equal(e1.triage_routes.bad_spec, 1);
  assert.deepEqual(e1.by_lens.adversarial, { total: 2, false: 1, by_model: { sonnet: { total: 2, false: 1 } } });
  assert.equal(e1.by_lens['verification-gap'].total, 1);
  assert.equal(e1.worker_tokens, 120000);
  assert.equal(e1.orchestrator_tokens_reported, 0);
  assert.equal(e1.median_minutes, 42);
  assert.equal(e1.deferred, 1);
  assert.equal(total.escalations, 1);
  assert.equal(total.done, 1); // E2 stories are todo
  const json = JSON.parse(run('metrics', '--directory', root, '--json').out);
  assert.equal(json.total.findings.high, 1);
});

test('trespass: a lane story editing another lane or the contracts is an error', (t) => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    return t.skip('git not available');
  }
  const root = fixture();
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base');
  const base = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  edit(root, 'plan/epics/E2-export/stories/E2-1-producer.md', (s) => s.replace('status: todo', `status: in-progress\nbaseline_commit: '${base}'`));
  write(root, 'src/a/producer.js', '//ok\n');
  assert.deepEqual(errors(checkStory(load(root), 'E2-1')), []);
  write(root, 'src/b/consumer.js', '//not yours\n');
  write(root, 'src/contracts/rows.ts', '//frozen\n');
  const f = errors(checkStory(load(root), 'E2-1')).filter((x) => x.code === 'diff/trespass');
  assert.deepEqual(f.map((x) => x.where).sort(), ['src/b/consumer.js', 'src/contracts/rows.ts']);
});

// ── 0.6 ─────────────────────────────────────────────────────────────────
const { check: guard } = require('../tools/installer/hooks/frozen-guard');
const { claim, release, listClaims } = require('../tools/installer/lib/claims');
const gitInit = (root) => {
  execFileSync('git', ['-C', root, 'init', '-q']);
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base']);
};
const hasGit = () => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const FROZEN = '<frozen-after-approval reason="x">\n\n## Intent\n\n**Problem:** p\n</frozen-after-approval>\n\n## Tasks\n\n- [ ] a\n';

test('frozen tests: freeze --tests locks them; an edit fails check; unlock clears', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full') + FROZEN);
  write(root, 'test/producer.test.js', 'assert(1)\n');
  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1', '--tests', 'test/producer.test.js').code, 0);
  assert.match(fs.readFileSync(path.join(root, rel), 'utf8'), /^frozen_tests: \['test\/producer\.test\.js#[0-9a-f]{64}'\]/m);
  assert.deepEqual(errors(checkStory(load(root), 'E2-1')), []);
  write(root, 'test/producer.test.js', 'assert(true) // weakened\n');
  assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/frozen-test-changed'));
  run('freeze', '--directory', root, '--story', 'E2-1', '--unlock-tests');
  assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /^frozen_tests:/m);
  assert.ok(!codes(checkStory(load(root), 'E2-1')).includes('story/frozen-test-changed'));
  run('freeze', '--directory', root, '--story', 'E2-1', '--unlock');
  assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /frozen_sha256/);
});

test('lean-loop premises: skipped steps are only warnings, and check stops watching frozen tests at done', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full') + FROZEN);
  write(root, 'test/producer.test.js', 'assert(1)\n');
  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1', '--tests', 'test/producer.test.js').code, 0);
  run('freeze', '--directory', root, '--story', 'E2-1', '--unlock'); // a story whose intent was never (or no longer) hashed
  edit(root, rel, (t) => t.replace('status: in-progress', 'status: done'));
  write(root, 'test/producer.test.js', 'assert(true) // weakened after done\n');
  const found = checkStory(load(root), 'E2-1');
  // G3 exists because of this: the hash mismatch is invisible to check once the story is done.
  assert.ok(!codes(found).includes('story/frozen-test-changed'));
  // G2 promotes exactly these: a skipped step is a warning, so `check --story` alone would exit 0.
  for (const code of ['story/frozen-unhashed', 'story/no-baseline', 'story/no-triage-log', 'diff/no-git'])
    assert.equal(found.find((f) => f.code === code)?.level, 'warn', code);
  assert.deepEqual(errors(found), []);
  assert.equal(run('check', '--directory', root, '--story', 'E2-1').code, 0);
});

test('guard hook: blocks edits to frozen intent and frozen tests, allows the rest', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full') + FROZEN);
  write(root, 'test/producer.test.js', 'assert(1)\n');
  run('freeze', '--directory', root, '--story', 'E2-1', '--tests', 'test/producer.test.js');
  const evt = (tool_name, tool_input) => ({ tool_name, tool_input, cwd: root });
  const abs = path.join(root, rel);
  assert.equal(guard(evt('Edit', { file_path: abs, old_string: '- [ ] a', new_string: '- [x] a' })), null, 'outside the block is fine');
  assert.equal(guard(evt('Edit', { file_path: abs, old_string: 'status: in-progress', new_string: 'status: in-review' })), null, 'frontmatter status is fine');
  assert.match(guard(evt('Edit', { file_path: abs, old_string: '**Problem:** p', new_string: '**Problem:** q' })), /frozen intent/);
  assert.match(guard(evt('MultiEdit', { file_path: abs, edits: [{ old_string: '- [ ] a', new_string: '- [x] a' }, { old_string: '**Problem:** p', new_string: '**Problem:** q' }] })), /frozen intent/);
  const cur = fs.readFileSync(abs, 'utf8');
  assert.match(guard(evt('Write', { file_path: abs, content: cur.replace(/frozen_sha256: .*\n/, '') })), /frozen intent/, 'dropping the hash is blocked too');
  assert.match(guard(evt('Write', { file_path: path.join(root, 'test/producer.test.js'), content: 'x' })), /frozen acceptance test/);
  assert.equal(guard(evt('Write', { file_path: path.join(root, 'src/a/producer.js'), content: 'x' })), null);
  edit(root, rel, (t) => t.replace('status: in-progress', 'status: done'));
  assert.equal(guard(evt('Write', { file_path: path.join(root, 'test/producer.test.js'), content: 'x' })), null, 'unlocked once the story is done');
});

test('guard hook (Codex): apply_patch is applied in memory and checked the same way', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full') + FROZEN);
  write(root, 'test/producer.test.js', 'assert(1)\n');
  run('freeze', '--directory', root, '--story', 'E2-1', '--tests', 'test/producer.test.js');
  const patch = (...body) => ({ tool_name: 'apply_patch', tool_input: { command: ['*** Begin Patch', ...body, '*** End Patch'].join('\n') }, cwd: root });
  assert.equal(guard(patch(`*** Update File: ${rel}`, '@@ ## Tasks', ' ', '-- [ ] a', '+- [x] a')), null, 'outside the block is fine');
  assert.match(guard(patch(`*** Update File: ${rel}`, '@@', '-**Problem:** p', '+**Problem:** q')), /frozen intent/);
  assert.match(guard(patch(`*** Delete File: ${rel}`)), /frozen intent/, 'deleting a frozen spec is blocked');
  assert.match(guard(patch(`*** Update File: ${rel}`, `*** Move to: plan/elsewhere.md`, '@@', '-- [ ] a', '+- [x] a')), /frozen intent/, 'moving it away is blocked');
  assert.match(guard(patch('*** Update File: test/producer.test.js', '@@', '-assert(1)', '+assert(true)')), /frozen acceptance test/);
  assert.match(guard(patch('*** Add File: src/a/new.js', '+x', '*** Delete File: test/producer.test.js')), /frozen acceptance test/, 'any file in a multi-file patch');
  assert.equal(guard(patch('*** Add File: src/a/new.js', '+x')), null);
  assert.equal(guard(patch(`*** Update File: ${rel}`, '@@', '-no such line', '+y')), null, 'a patch that cannot apply is left to Codex to reject');
});

test('claims: atomic, exclusive, visible to next and check', (t) => {
  if (!hasGit()) return t.skip('git not available');
  const root = fixture();
  gitInit(root);
  edit(root, 'plan/epics/E2-export/stories/E2-0-contracts.md', (s) => s.replace('status: todo', 'status: done'));
  assert.equal(claim(root, 'E2-1', 'agent-a').ok, true);
  assert.equal(claim(root, 'E2-1', 'agent-a').already, true);
  const taken = claim(root, 'E2-1', 'agent-b');
  assert.equal(taken.ok, false);
  assert.equal(taken.holder.owner, 'agent-a');
  assert.equal(run('claim', '--directory', root, '--story', 'E2-1', '--owner', 'agent-b').code, 1);
  const r = nextStories(load(root));
  assert.deepEqual(r.next.map((s) => s.id), ['E2-2'], 'claimed story is skipped');
  assert.deepEqual(r.claimed.map((s) => `${s.id}:${s.owner}`), ['E2-1:agent-a']);
  claim(root, 'E2-0', 'agent-c');
  assert.ok(codes(checkPlan(load(root))).includes('claims/stale'), 'claim on a done story');
  assert.equal(release(root, 'E2-0'), true);
  assert.deepEqual([...listClaims(root).keys()], ['E2-1']);
});

test('contracts lite, exit evidence, document size, archives, triage vocabulary', () => {
  const root = fixture();
  const E2 = 'plan/epics/E2-export';
  // lite: no checkpoint column needed, decisions table ignored
  edit(root, `${E2}/stories.yaml`, (t) => t.replace('epic: E2\n', 'epic: E2\ncontracts: lite\n').replace('owner: bob', 'owner: ann'));
  edit(root, `${E2}/CONTRACTS.md`, (t) => t.replace('| E2-3 |\n', '|  |\n'));
  edit(root, `${E2}/stories/E2-2-consumer.md`, (t) => t.replace('status: todo', 'status: in-progress'));
  assert.deepEqual(checkPlan(load(root)), [], 'lite skips seam checkpoints and decisions due');
  edit(root, `${E2}/stories.yaml`, (t) => t.replace('owner: ann, modules: [src/b]', 'owner: bob, modules: [src/b]'));
  assert.ok(codes(checkPlan(load(root))).includes('lanes/lite-with-people'));
  // exit evidence
  write(root, 'plan/epics/E1-foundation/EPIC.md', '---\nid: E1\nstatus: done\n---\n## Exit evidence\n\n<!-- todo -->\n');
  assert.ok(codes(checkPlan(load(root))).includes('epics/no-exit-evidence'));
  // spec size + log rollover + archive
  const words = (n) => Array(n).fill('w').join(' ');
  edit(root, 'plan/SPEC.md', (t) => t.replace('status: final', 'status: final\nstakes: hobby') + `\n${words(400)}\n\n## Decision Log\n\n${Array(45).fill('- 2026-11-12 — decision — x').join('\n')}\n`);
  let c = codes(checkPlan(load(root)));
  assert.ok(c.includes('spec/size') && c.includes('doc/log-size'));
  edit(root, 'plan/epics.yaml', (t) => t.replace('caps: [CAP-1], depends_on: []', 'caps: [CAP-1, CAP-9], depends_on: []'));
  assert.ok(codes(checkPlan(load(root))).includes('caps/unknown'));
  write(root, 'plan/SPEC.archive.md', '- **CAP-9 — old thing**\n  - retired: 2026-10-01 — dropped\n');
  c = codes(checkPlan(load(root)));
  assert.ok(!c.includes('caps/unknown') && !c.includes('caps/archived'), 'archived id known; its epic is done');
  // triage vocabulary
  edit(root, 'plan/epics/E1-foundation/stories/E1-1-scaffold.md', (t) =>
    t.replace('status: done', 'status: done\nroute: full\nbaseline_commit: abc') + '\n## Review Triage Log\n\n| # | lens | verdict | route | evidence |\n|---|---|---|---|---|\n| 1 | adversarial | severe | fix-it | x |\n| 2 | edge-case | medium | amend | y |\n');
  const vocab = checkPlan(load(root)).filter((f) => f.code === 'story/triage-vocab');
  assert.equal(vocab.length, 2, 'bad verdict + bad route; amend is valid');
  assert.equal(aggregate(load(root)).total.triage_routes.amend, 1);
});

// ── contract fields, approval provenance, baseline, feature-story cap ─────
const { contractHash } = require('../tools/installer/lib/plan');
const { contractHash: guardContractHash } = require('../tools/installer/hooks/frozen-guard');

test('freeze also hashes the contract fields; check and the guard catch a change to them', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  const abs = path.join(root, rel);
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full\nsecurity: true   # external input') + FROZEN);
  write(root, 'test/producer.test.js', 'assert(1)\n');
  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1', '--tests', 'test/producer.test.js').code, 0);
  const frozen = fs.readFileSync(abs, 'utf8');
  assert.match(frozen, /^approved_via: plan\b/m, 'no --via: only the plan stub was approved');
  assert.match(frozen, /^contract_sha256: '[0-9a-f]{64}'/m);
  assert.deepEqual(errors(checkStory(load(root), 'E2-1')), []);

  // check: lowering security, dropping the frozen tests, widening caps
  for (const [from, to] of [['security: true', 'security: false'], [/^frozen_tests: .*\n/m, ''], ['caps: [CAP-2]', 'caps: [CAP-2, CAP-1]']]) {
    fs.writeFileSync(abs, frozen.replace(from, to));
    assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/contract-changed'), `${from} → ${to}`);
  }
  fs.writeFileSync(abs, frozen.replace('security: true   # external input', 'security: true   # reworded comment'));
  assert.ok(!codes(checkStory(load(root), 'E2-1')).includes('story/contract-changed'), 'comments are not part of the contract');

  // guard: the same edits are refused before they happen
  fs.writeFileSync(abs, frozen);
  const evt = (tool_input) => ({ tool_name: 'Edit', tool_input: { file_path: abs, ...tool_input }, cwd: root });
  assert.match(guard(evt({ old_string: 'security: true', new_string: 'security: false' })), /contract fields/);
  assert.match(guard(evt({ old_string: 'caps: [CAP-2]', new_string: 'caps: []' })), /contract fields/);
  assert.match(guard(evt({ old_string: frozen.match(/^frozen_tests: .*\n/m)[0], new_string: '' })), /contract fields/);
  assert.match(guard(evt({ old_string: 'approved_via: plan', new_string: 'approved_via: checkpoint' })), /contract fields/);
  assert.equal(guard(evt({ old_string: 'status: in-progress', new_string: 'status: in-review' })), null, 'status is not a contract field');

  // the guard's dependency-free copy computes the same hash as the CLI, whatever the YAML shape
  for (const text of [frozen, frozen.replace('caps: [CAP-2]', 'caps:\n  - CAP-2   # main\n- CAP-1'), frozen.replace(/^rules: .*\n/m, '')])
    assert.equal(guardContractHash(text), contractHash(text));

  // --via
  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1', '--via', 'chat').code, 1);
  assert.equal(run('freeze', '--directory', root, '--story', 'E2-1', '--via', 'checkpoint').code, 0);
  assert.match(fs.readFileSync(abs, 'utf8'), /^approved_via: checkpoint$/m);
  assert.deepEqual(errors(checkStory(load(root), 'E2-1')), []);
  run('freeze', '--directory', root, '--story', 'E2-1', '--unlock');
  assert.doesNotMatch(fs.readFileSync(abs, 'utf8'), /contract_sha256/, 'unlock removes both hashes');
});

test('contract warnings: older frozen stories, security without frozen tests, bad approved_via', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  edit(root, rel, (t) => t.replace('status: todo', 'status: in-progress\nroute: full\nsecurity: true') + FROZEN);
  let c = codes(checkStory(load(root), 'E2-1'));
  assert.ok(c.includes('story/security-untested'));
  run('freeze', '--directory', root, '--story', 'E2-1');
  edit(root, rel, (t) => t.replace(/^contract_sha256: .*\n/m, ''));
  c = codes(checkStory(load(root), 'E2-1'));
  assert.ok(c.includes('story/contract-unhashed'), 'frozen by an older LEAN');
  edit(root, rel, (t) => t.replace('approved_via: plan', 'approved_via: chat'));
  assert.ok(codes(checkStory(load(root), 'E2-1')).includes('story/approved-via'));
});

test('guard: baseline_commit is written once', () => {
  const root = fixture();
  const rel = 'plan/epics/E2-export/stories/E2-1-producer.md';
  const abs = path.join(root, rel);
  edit(root, rel, (t) => t.replace('status: todo', "status: in-progress\nbaseline_commit: ''"));
  const evt = (o, n) => ({ tool_name: 'Edit', tool_input: { file_path: abs, old_string: o, new_string: n }, cwd: root });
  assert.equal(guard(evt("baseline_commit: ''", "baseline_commit: 'abc123'")), null, 'first write is fine');
  edit(root, rel, (t) => t.replace("baseline_commit: ''", "baseline_commit: 'abc123'"));
  assert.match(guard(evt("baseline_commit: 'abc123'", "baseline_commit: 'def456'")), /never overwritten/);
  assert.match(guard(evt("baseline_commit: 'abc123'\n", '')), /never overwritten/);
});

test('baseline_commit must be a commit behind HEAD', (t) => {
  if (!hasGit()) return t.skip('git not available');
  const root = fixture();
  gitInit(root);
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const rel = 'plan/epics/E1-foundation/stories/E1-1-scaffold.md';
  edit(root, rel, (s) => s.replace('status: done', `status: done\nbaseline_commit: '${head.slice(0, 7)}'`));
  assert.ok(!codes(checkStory(load(root), 'E1-1')).includes('story/baseline-unknown'));
  edit(root, rel, (s) => s.replace(head.slice(0, 7), 'deadbeef'));
  assert.ok(codes(checkStory(load(root), 'E1-1')).includes('story/baseline-unknown'));
});

test('a feature story (the only story of its epic, all its caps) gets twice the size cap', () => {
  const root = fixture();
  const rel = 'plan/epics/E1-foundation/stories/E1-1-scaffold.md';
  const words = (n) => Array(n).fill('word').join(' ');
  edit(root, rel, (t) => t.replace('status: done', 'status: in-progress\nroute: small') + `## Intent\n\n${words(900)}\n`);
  assert.ok(!codes(checkStory(load(root), 'E1-1')).includes('story/size'), '≈1200 tokens ≤ 2 × 1000');
  edit(root, rel, (t) => t.replace('## Intent\n\n', `## Intent\n\n${words(700)} `));
  const size = checkStory(load(root), 'E1-1').find((f) => f.code === 'story/size');
  assert.match(size.msg, /cap 2000 \(feature story: doubled\)/);
});
