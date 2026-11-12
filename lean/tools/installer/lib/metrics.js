'use strict';
// Aggregates what lean-build leaves in each story file, so the experiment can be measured:
//   - frontmatter: route, review_loops, metrics { models, escalations, worker_tokens, orchestrator_tokens, started, finished }
//   - ## Review Triage Log table: | # | lens | verdict | route | evidence |
// Counts come from the log rows, never from numbers the model wrote about itself.

const { section, table, statusOf } = require('./plan');

const VERDICTS = ['high', 'medium', 'low', 'false', 'maybe-false'];
const ROUTES = ['patch', 'bad_spec', 'intent_gap', 'defer', 'reject'];

const zero = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const norm = (s) => String(s || '').trim().toLowerCase().replace(/`/g, '');

/** Triage rows of one story. Unknown verdicts/routes are kept as-is and counted under `other`. */
function triageRows(story) {
  const sec = section(story.body, 'Review Triage Log');
  return sec ? table(sec).map((r) => ({ lens: norm(r.lens) || 'unknown', verdict: norm(r.verdict), route: norm(r.route).replace('-', '_') })) : [];
}

function newBucket() {
  return {
    stories: 0,
    done: 0,
    routes: { small: 0, full: 0 },
    review_loops: 0,
    looped_stories: 0,
    escalations: 0,
    findings: { total: 0, ...zero(VERDICTS), other: 0 },
    triage_routes: { ...zero(ROUTES), other: 0 },
    by_lens: {}, // lens → { total, false, model→{ total, false } }
    worker_tokens: 0,
    worker_tokens_reported: 0,
    orchestrator_tokens: 0,
    orchestrator_tokens_reported: 0,
    minutes: [],
    deferred: 0,
    models: {}, // role → { model: count }
  };
}

function addStory(b, s) {
  const fm = s.fm;
  const m = fm.metrics || {};
  b.stories++;
  if (statusOf(s) !== 'done') return;
  b.done++;
  if (fm.route in b.routes) b.routes[fm.route]++;
  const loops = num(fm.review_loops) || 0;
  b.review_loops += loops;
  if (loops > 0) b.looped_stories++;
  b.escalations += num(m.escalations) || 0;
  if (num(m.worker_tokens) != null) (b.worker_tokens += m.worker_tokens), b.worker_tokens_reported++;
  if (num(m.orchestrator_tokens) != null) (b.orchestrator_tokens += m.orchestrator_tokens), b.orchestrator_tokens_reported++;
  const t0 = Date.parse(m.started);
  const t1 = Date.parse(m.finished);
  if (t0 && t1 && t1 >= t0) b.minutes.push(Math.round((t1 - t0) / 60000));
  for (const [role, model] of Object.entries(m.models || {})) {
    if (!model) continue;
    b.models[role] = b.models[role] || {};
    b.models[role][model] = (b.models[role][model] || 0) + 1;
  }
  const reviewModel = (m.models && m.models.review) || 'unknown';
  for (const r of triageRows(s)) {
    b.findings.total++;
    VERDICTS.includes(r.verdict) ? b.findings[r.verdict]++ : b.findings.other++;
    ROUTES.includes(r.route) ? b.triage_routes[r.route]++ : b.triage_routes.other++;
    const L = (b.by_lens[r.lens] = b.by_lens[r.lens] || { total: 0, false: 0, by_model: {} });
    const M = (L.by_model[reviewModel] = L.by_model[reviewModel] || { total: 0, false: 0 });
    L.total++, M.total++;
    if (r.verdict === 'false') L.false++, M.false++;
  }
}

function finish(b) {
  const sorted = [...b.minutes].sort((x, y) => x - y);
  const { minutes, ...rest } = b;
  return {
    ...rest,
    median_minutes: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    false_rate: b.findings.total ? +(b.findings.false / b.findings.total).toFixed(2) : null,
  };
}

/** { epics: [{ id, title, status, ...bucket }], total: bucket } */
function aggregate(plan, { epic: only } = {}) {
  const total = newBucket();
  const epics = [];
  for (const e of plan.epics) {
    if (only && e.id !== only) continue;
    const b = newBucket();
    for (const s of e.stories) if (s.exists && statusOf(s) !== 'retired') addStory(b, s), addStory(total, s);
    b.deferred = e.deferred || 0;
    total.deferred += b.deferred;
    epics.push({ id: e.id, title: e.title, status: e.status, ...finish(b) });
  }
  return { epics, total: finish(total) };
}

module.exports = { aggregate, triageRows, VERDICTS, ROUTES };
