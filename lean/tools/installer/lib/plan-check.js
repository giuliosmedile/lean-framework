'use strict';
// Deterministic checks over a LEAN plan tree. Everything here is mechanical:
// the skills call `lean-method check` instead of re-deriving it in tokens.
// Each finding: { level: 'error' | 'warn', code, where, msg }.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { STORY_STATUS, EPIC_STATUS, IN_FLIGHT, section, stripComments, frozenBlock, sha256, statusOf } = require('./plan');

const STORY_ID = /^E\d+-(?:\d+|C\d+)$/;
const EPIC_ID = /^E\d+$/;
const SPECIAL_LANES = ['', 'shared', 'integration'];
const LOG_SECTIONS = ['Implementation Notes', 'Spec Change Log', 'Review Triage Log'];
// kiss.md §B — build-spec caps in tokens. Words → tokens at ~4/3 (English prose + markdown).
const SPEC_CAP_TOKENS = { kiss: 1000, standard: 1600 };
const TOKENS_PER_WORD = 4 / 3;

const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const idOf = (v) => (typeof v === 'string' ? (v.match(/^\s*([A-Z]+-\d+)/) || [])[1] : v && v.id);
const rel = (plan, f) => path.relative(plan.root, f) || '.';
const storyIds = (cell) => [...new Set((cell || '').match(/\bE\d+-C?\d+\b/g) || [])];

/** Approximate spec size: body words without frontmatter, comments, and the append-only logs. */
function specTokens(story) {
  let body = stripComments(story.body);
  for (const s of LOG_SECTIONS) {
    const sec = section(body, s);
    if (sec != null) body = body.replace(sec, '');
  }
  body = body.replace(/<\/?frozen-after-approval[^>]*>/g, '');
  const words = (body.match(/\S+/g) || []).length;
  return Math.round(words * TOKENS_PER_WORD);
}

function checkPlan(plan, { epic: only } = {}) {
  const out = [];
  const add = (level, code, where, msg) => out.push({ level, code, where, msg });
  if (!plan.exists) return [{ level: 'warn', code: 'plan/missing', where: rel(plan, plan.planDir), msg: 'no plan folder yet — nothing to check' }];

  // ── epics.yaml ──────────────────────────────────────────────
  const idx = plan.index;
  if (idx.missing) {
    if (plan.spec) add('warn', 'epics/missing', 'epics.yaml', 'SPEC.md exists but there is no epics.yaml yet');
    return out;
  }
  if (idx.error) return [{ level: 'error', code: 'epics/parse', where: 'epics.yaml', msg: idx.error }];

  const epicPos = new Map();
  plan.epics.forEach((e, i) => {
    const where = `epics.yaml#${e.id || i}`;
    if (!EPIC_ID.test(String(e.id))) add('error', 'epics/id', where, `epic id "${e.id}" is not E<n>`);
    if (epicPos.has(e.id)) add('error', 'epics/dup-id', where, `epic id ${e.id} is used twice`);
    epicPos.set(e.id, i);
    if (!EPIC_STATUS.includes(e.status)) add('error', 'epics/status', where, `status "${e.status}" is not one of ${EPIC_STATUS.join(' | ')}`);
  });

  // ── capability coverage (project-wide; skipped when scoped to one epic) ──
  if (!only && plan.spec) {
    const where = new Map();
    for (const e of plan.epics) for (const c of asList(e.caps)) where.set(c, [...(where.get(c) || []), e.id]);
    const uncovered = new Set(asList(idx.data.uncovered).map(idOf).filter(Boolean));
    for (const id of plan.spec.ids) {
      const eps = where.get(id) || [];
      if (!eps.length && !uncovered.has(id)) add('error', 'caps/uncovered', 'epics.yaml', `${id} (SPEC.md) is in no epic and not under uncovered:`);
      if (eps.length > 1) add('warn', 'caps/dup', 'epics.yaml', `${id} is claimed by ${eps.join(', ')}`);
    }
    for (const [c, eps] of where) if (!plan.spec.ids.includes(c)) add('warn', 'caps/unknown', `epics.yaml#${eps[0]}`, `${c} is not defined in SPEC.md`);
  }

  const adsKnown = new Set([...(plan.arch?.ads || []), ...plan.epics.flatMap((e) => e.md?.ads || [])]);

  // ── per epic ─────────────────────────────────────────────────
  for (const [i, e] of plan.epics.entries()) {
    if (only && e.id !== only) continue;
    const where = `epics.yaml#${e.id}`;
    for (const d of asList(e.depends_on)) {
      if (!epicPos.has(d)) add('error', 'epics/dep-unknown', where, `depends on unknown epic ${d}`);
      else if (epicPos.get(d) > i) add('error', 'epics/dep-forward', where, `depends on ${d}, which comes later in epics.yaml`);
    }
    if (!e.dir || !fs.existsSync(e.dir)) {
      add('error', 'epics/folder', where, `folder ${e.folder || '(none)'} is missing`);
      continue;
    }
    const ew = rel(plan, e.dir);
    if (!e.md) add('error', 'epics/epic-md', ew, 'EPIC.md is missing');
    else if (e.md.fm.status && e.md.fm.status !== e.status) add('warn', 'epics/status-mismatch', `${ew}/EPIC.md`, `status ${e.md.fm.status} ≠ epics.yaml ${e.status}`);

    const sy = e.storiesYaml;
    if (sy.missing) {
      if (e.status !== 'planned') add('error', 'stories/missing', ew, `epic is ${e.status} but has no stories.yaml`);
      continue;
    }
    if (sy.error) {
      add('error', 'stories/parse', `${ew}/stories.yaml`, sy.error);
      continue;
    }
    if (sy.data.epic && sy.data.epic !== e.id) add('error', 'stories/epic-mismatch', `${ew}/stories.yaml`, `epic: ${sy.data.epic} ≠ ${e.id}`);
    checkStories(plan, e, add, adsKnown);
    checkLanes(plan, e, add);
  }

  checkCycles(plan, add, only);
  return out;
}

function checkStories(plan, e, add, adsKnown) {
  const ew = rel(plan, e.dir);
  const laneIds = new Set(e.lanes.map((l) => l.id));
  const listed = new Set();
  const seen = new Set();
  const counts = {};
  for (const s of e.stories) {
    const where = `${ew}/stories.yaml#${s.id}`;
    if ('status' in s.entry) add('error', 'stories/status-in-index', where, 'stories.yaml must not hold status — it lives in the story file');
    if (!STORY_ID.test(String(s.id)) || !String(s.id).startsWith(`${e.id}-`)) add('error', 'stories/id-format', where, `story id "${s.id}" is not ${e.id}-<n> or ${e.id}-C<n>`);
    if (seen.has(s.id) || [...plan.stories.values()].some((o) => o.id === s.id && o !== s && o.epic !== e.id)) add('error', 'stories/dup-id', where, `story id ${s.id} is used more than once`);
    seen.add(s.id);
    const lane = s.entry.lane ?? '';
    if (!SPECIAL_LANES.includes(lane) && !laneIds.has(lane)) add('error', 'stories/lane-unknown', where, `lane "${lane}" is not declared in lanes:`);

    if (!s.file) {
      add('error', 'stories/file-missing', where, 'no file:');
      continue;
    }
    listed.add(path.resolve(s.file));
    if (!s.exists) {
      add('error', 'stories/file-missing', where, `${rel(plan, s.file)} does not exist`);
      continue;
    }
    checkStoryFile(plan, e, s, add, adsKnown);
    const st = statusOf(s);
    counts[st] = (counts[st] || 0) + 1;

    // dependencies
    for (const d of asList(s.entry.depends_on)) {
      const dep = plan.stories.get(d);
      if (!dep) {
        add('error', 'stories/dep-unknown', where, `depends on unknown story ${d}`);
        continue;
      }
      if (dep.epic === e.id && dep.order > s.order) {
        const sameLane = (dep.entry.lane ?? '') === lane;
        add(sameLane ? 'error' : 'warn', 'stories/dep-forward', where, `depends on ${d}, listed later${sameLane ? ' in the same lane' : ''}`);
      }
      if (dep.epic !== e.id) {
        const epics = plan.epics.map((x) => x.id);
        if (epics.indexOf(dep.epic) > epics.indexOf(e.id)) add('warn', 'stories/dep-forward', where, `depends on ${d} in a later epic`);
      }
      if (statusOf(dep) === 'retired') add('warn', 'stories/dep-retired', where, `depends on retired story ${d}`);
    }
  }

  // files on disk that stories.yaml doesn't list
  const sdir = path.join(e.dir, 'stories');
  if (fs.existsSync(sdir))
    for (const f of fs.readdirSync(sdir).filter((f) => f.endsWith('.md')))
      if (!listed.has(path.resolve(sdir, f))) add('error', 'stories/unlisted-file', `${ew}/stories/${f}`, 'story file is not listed in stories.yaml');

  // epic status vs story statuses
  const live = e.stories.filter((s) => s.exists && statusOf(s) !== 'retired');
  const open = live.filter((s) => statusOf(s) !== 'done');
  if (e.status === 'done' && open.length) add('error', 'epics/done-open-stories', `epics.yaml#${e.id}`, `epic is done but ${open.map((s) => s.id).join(', ')} are not`);
  if (e.status === 'active' && live.length && !open.length) add('warn', 'epics/ready-to-close', `epics.yaml#${e.id}`, 'every story is done — close the epic (lean-plan status) and run lean-change retro');
  if (e.status === 'planned' && live.some((s) => statusOf(s) !== 'todo')) add('warn', 'epics/status-mismatch', `epics.yaml#${e.id}`, 'epic is planned but stories have started');
}

function checkStoryFile(plan, e, s, add, adsKnown) {
  const where = rel(plan, s.file);
  const fm = s.fm;
  if (s.fmError) return add('error', 'story/frontmatter', where, s.fmError);
  if (fm.id !== s.id) add('error', 'story/id-mismatch', where, `frontmatter id ${fm.id} ≠ stories.yaml ${s.id}`);
  if (fm.epic && fm.epic !== e.id) add('error', 'story/epic-mismatch', where, `frontmatter epic ${fm.epic} ≠ ${e.id}`);
  const st = fm.status || 'todo';
  if (!STORY_STATUS.includes(st)) add('error', 'story/status', where, `status "${st}" is not one of ${STORY_STATUS.join(' | ')}`);
  if (st === 'blocked' && !fm.blocked_reason) add('error', 'story/blocked-reason', where, 'blocked without blocked_reason');
  if ((fm.lane ?? '') !== (s.entry.lane ?? '')) add('warn', 'story/lane-mismatch', where, `lane "${fm.lane ?? ''}" ≠ stories.yaml "${s.entry.lane ?? ''}"`);

  const epicCaps = new Set(asList(e.caps));
  for (const c of asList(fm.caps)) if (!epicCaps.has(c)) add('warn', 'story/caps-outside-epic', where, `${c} is not in ${e.id}'s caps`);
  for (const r of asList(fm.rules)) if (plan.arch && !adsKnown.has(r)) add('warn', 'story/rule-unknown', where, `${r} is not defined in ARCHITECTURE.md or any EPIC.md`);

  // grown into a build spec?
  if (fm.route === 'full' || fm.route === 'small') {
    const cap = SPEC_CAP_TOKENS[plan.style] || SPEC_CAP_TOKENS.kiss;
    const tokens = specTokens(s);
    if (tokens > cap) add('warn', 'story/size', where, `build spec ≈${tokens} tokens > ${plan.style} cap ${cap} — split, or keep with the user's OK`);
  }

  // frozen intent
  const block = frozenBlock(s.text);
  if (fm.frozen_sha256) {
    if (block == null) add('error', 'story/frozen-changed', where, 'frozen_sha256 is set but the <frozen-after-approval> block is gone');
    else if (sha256(block) !== fm.frozen_sha256) add('error', 'story/frozen-changed', where, 'frozen intent changed since it was frozen — only the human renegotiates it (then re-run freeze)');
  } else if (block != null && ['ready', 'in-progress', 'in-review', 'done'].includes(st)) {
    add('warn', 'story/frozen-unhashed', where, `status ${st} but the frozen block was never hashed — run: lean-method freeze --story ${s.id}`);
  }
  if (st === 'done' && fm.route && !fm.baseline_commit) add('warn', 'story/no-baseline', where, 'done without baseline_commit');
}

function checkLanes(plan, e, add) {
  if (!e.lanes.length) return;
  const ew = rel(plan, e.dir);
  const e0 = `${e.id}-0`;
  if (!e.contracts) add('error', 'lanes/no-contracts', ew, `${e.lanes.length} lanes but no CONTRACTS.md`);
  if (!e.stories.some((s) => s.id === e0)) add('error', 'lanes/no-e0', `${ew}/stories.yaml`, `${e.lanes.length} lanes but no ${e0} contracts story`);

  for (const l of e.lanes) {
    if (!l.id) continue;
    if (!asList(l.modules).length) add('warn', 'lanes/no-modules', `${ew}/stories.yaml#lane-${l.id}`, 'lane has no modules: — trespass can\'t be checked');
    const first = e.stories.find((s) => (s.entry.lane ?? '') === l.id);
    if (!first) add('warn', 'lanes/empty', `${ew}/stories.yaml#lane-${l.id}`, 'lane has no stories');
    else {
      const blockers = asList(first.entry.depends_on).filter((d) => d !== e0 && plan.stories.get(d)?.epic === e.id);
      if (blockers.length) add('warn', 'lanes/first-story', `${ew}/stories.yaml#${first.id}`, `lane ${l.id}'s first story waits on ${blockers.join(', ')} — it should need only ${e0}`);
    }
  }
  // module overlap between lanes
  const owner = new Map();
  for (const l of e.lanes)
    for (const m of asList(l.modules).map(normPath)) {
      for (const [o, lid] of owner) if (lid !== l.id && (m === o || m.startsWith(o + '/') || o.startsWith(m + '/'))) add('error', 'lanes/overlap', `${ew}/stories.yaml`, `lanes ${lid} and ${l.id} both own ${o === m ? m : `${o} / ${m}`}`);
      owner.set(m, l.id);
    }

  if (!e.contracts) return;
  const cw = `${ew}/CONTRACTS.md`;
  const col = (row, prefix) => Object.keys(row).find((k) => k.startsWith(prefix));
  for (const row of e.contracts.seams) {
    const name = row['#'] || row[col(row, 'port')] || '?';
    const impl = row[col(row, 'real impl')] || '';
    const cp = row[col(row, 'checkpoint')] || '';
    if (!impl) add('error', 'seams/orphan', `${cw}#${name}`, 'seam has no real-implementation owner');
    if (!cp) add('error', 'seams/no-checkpoint', `${cw}#${name}`, 'seam has no checkpoint story');
    for (const id of storyIds(impl + ' ' + cp)) if (!plan.stories.has(id)) add('warn', 'seams/unknown-story', `${cw}#${name}`, `${id} is not in any stories.yaml`);
  }
  for (const row of e.contracts.decisions) {
    const byKey = col(row, 'decide by');
    const done = /^(done|decided|closed)$/i.test(row.status || '');
    for (const id of storyIds(byKey ? row[byKey] : '')) {
      const s = plan.stories.get(id);
      if (!s) add('warn', 'decisions/unknown-story', cw, `decide-by story ${id} does not exist`);
      else if (!done && ['in-progress', 'in-review', 'done'].includes(statusOf(s))) add('warn', 'decisions/overdue', cw, `"${row.decision}" was due before ${id}, which is ${statusOf(s)}`);
    }
  }
}

function checkCycles(plan, add, only) {
  const state = new Map(); // 1 visiting, 2 done
  const visit = (id, trail) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const loop = trail.slice(trail.indexOf(id)).concat(id);
      if (!only || loop.some((x) => plan.stories.get(x)?.epic === only)) add('error', 'stories/cycle', loop[0], `dependency cycle: ${loop.join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const d of asList(plan.stories.get(id)?.entry.depends_on)) if (plan.stories.has(d)) visit(d, trail.concat(id));
    state.set(id, 2);
  };
  for (const id of plan.stories.keys()) visit(id, []);
}

// ── story-scoped: trespass against the lane map ─────────────────
const normPath = (p) => String(p).replace(/^\.\//, '').replace(/\/\*\*?$/, '').replace(/\/+$/, '');
const under = (file, p) => p && (file === p || file.startsWith(p + '/'));

function changedFiles(root, baseline) {
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const files = baseline && baseline !== 'NO_VCS' ? git('diff', '--name-only', '--relative', baseline) : git('diff', '--name-only', '--relative', 'HEAD');
  return [...new Set((files + git('ls-files', '--others', '--exclude-standard')).split('\n').filter(Boolean))];
}

/** Files a lane story changed outside its territory. Returns findings. */
function checkTrespass(plan, story) {
  const out = [];
  const e = plan.epics.find((x) => x.id === story.epic);
  if (!e || !e.lanes.length) return out;
  const lane = story.fm.lane ?? story.entry.lane ?? '';
  let files;
  try {
    files = changedFiles(plan.root, story.fm.baseline_commit);
  } catch {
    return [{ level: 'warn', code: 'diff/no-git', where: story.id, msg: 'git unavailable or baseline_commit unknown — trespass not checked' }];
  }
  const shared = [e.contracts?.fm.contracts_path, e.contracts?.fm.fixtures_path].filter(Boolean).map(normPath);
  const others = e.lanes.filter((l) => l.id !== lane).flatMap((l) => asList(l.modules).map((m) => [normPath(m), l.id]));
  const planRel = normPath(path.relative(plan.root, plan.planDir));
  for (const f of files) {
    if (under(f, planRel)) continue;
    if (lane !== 'shared' && shared.some((p) => under(f, p))) out.push({ level: 'error', code: 'diff/trespass', where: f, msg: `${story.id} (lane ${lane || '—'}) changed the contracts/fixtures — needs a contract change (${e.id}-C<n>)` });
    else if (!SPECIAL_LANES.includes(lane)) {
      const hit = others.find(([p]) => under(f, p));
      if (hit) out.push({ level: 'error', code: 'diff/trespass', where: f, msg: `${story.id} (lane ${lane}) changed lane ${hit[1]}'s module ${hit[0]}` });
    }
  }
  return out;
}

/** Checks for one story, for lean-build: its file, its frozen block, its size, and trespass. */
function checkStory(plan, id) {
  const s = plan.stories.get(id);
  if (!s) return [{ level: 'error', code: 'story/unknown', where: id, msg: `${id} is not in any stories.yaml` }];
  const e = plan.epics.find((x) => x.id === s.epic);
  const findings = [];
  const add = (level, code, where, msg) => findings.push({ level, code, where, msg });
  const adsKnown = new Set([...(plan.arch?.ads || []), ...plan.epics.flatMap((x) => x.md?.ads || [])]);
  if (!s.exists) add('error', 'stories/file-missing', id, 'story file does not exist');
  else checkStoryFile(plan, e, s, add, adsKnown);
  for (const d of asList(s.entry.depends_on)) {
    const dep = plan.stories.get(d);
    if (!dep) add('error', 'stories/dep-unknown', id, `depends on unknown story ${d}`);
    else if (!['done', 'retired'].includes(statusOf(dep))) add('warn', 'story/dep-open', id, `depends on ${d}, which is ${statusOf(dep)}`);
  }
  return findings.concat(s.exists ? checkTrespass(plan, s) : []);
}

/** Deterministic "what next": in-flight stories, then the next ready todo per (epic, lane). */
function nextStories(plan, { lane } = {}) {
  const inFlight = [];
  const next = [];
  const blocked = [];
  for (const e of plan.epics.filter((x) => x.status === 'active')) {
    const e0 = e.lanes.length ? plan.stories.get(`${e.id}-0`) : null;
    const e0Done = !e0 || statusOf(e0) === 'done';
    const picked = new Set();
    for (const s of e.stories) {
      const sl = s.entry.lane ?? '';
      if (lane && sl !== lane && sl !== 'shared') continue;
      const st = statusOf(s);
      if (IN_FLIGHT.includes(st)) inFlight.push({ id: s.id, epic: e.id, lane: sl, status: st, file: s.file });
      if (st === 'blocked') blocked.push({ id: s.id, epic: e.id, lane: sl, reason: s.fm.blocked_reason || '' });
      if (st !== 'todo' || picked.has(sl)) continue;
      if (e0 && s !== e0 && !e0Done) continue; // no lane starts before <E>-0
      const waiting = asList(s.entry.depends_on).filter((d) => !['done', 'retired'].includes(statusOf(plan.stories.get(d))));
      if (waiting.length) continue;
      picked.add(sl);
      next.push({ id: s.id, epic: e.id, lane: sl, title: s.entry.title || s.fm.title || '', file: s.file });
    }
  }
  return { inFlight, next, blocked };
}

module.exports = { checkPlan, checkStory, checkTrespass, nextStories, specTokens, SPEC_CAP_TOKENS };
