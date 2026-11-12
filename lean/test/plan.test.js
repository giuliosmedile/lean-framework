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
  write(root, 'plan/epics/E1-foundation/EPIC.md', '---\nid: E1\nstatus: done\n---\n');
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
