'use strict';
// Reads a LEAN plan tree (lean-kit/SKILL.md → Layout) into one object.
// Pure reading: never writes. Used by `check`, `next`, `metrics`, `freeze`.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const YAML = require('yaml');
const { readMerged } = require('./config');

const STORY_STATUS = ['todo', 'draft', 'ready', 'in-progress', 'in-review', 'done', 'blocked', 'retired'];
const EPIC_STATUS = ['planned', 'active', 'done'];
const IN_FLIGHT = ['draft', 'ready', 'in-progress', 'in-review'];

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null);

/** Resolve plan/ and docs/ folders and style from the _lean/ config (defaults when absent). */
function resolveProject(root, planOverride) {
  const cfg = readMerged(root);
  const sub = (v, d) => path.resolve(root, String(v || d).replace('{project-root}', root));
  return {
    root,
    planDir: planOverride ? path.resolve(root, planOverride) : sub(cfg.core?.output_folder, 'plan'),
    style: cfg.lean?.style || 'kiss',
  };
}

/** Split `---\nyaml\n---\nbody`. Returns { data, body, error }. */
function frontmatter(text) {
  if (!text || !text.startsWith('---\n')) return { data: {}, body: text || '', error: text ? 'no frontmatter' : null };
  const end = text.indexOf('\n---', 4);
  if (end < 0) return { data: {}, body: text, error: 'unterminated frontmatter' };
  try {
    return { data: YAML.parse(text.slice(4, end)) || {}, body: text.slice(text.indexOf('\n', end + 1) + 1) };
  } catch (e) {
    return { data: {}, body: text.slice(end + 4), error: `frontmatter YAML: ${e.message.split('\n')[0]}` };
  }
}

function parseYaml(file) {
  const text = read(file);
  if (text == null) return { missing: true };
  try {
    return { data: YAML.parse(text) || {} };
  } catch (e) {
    return { error: e.message.split('\n')[0] };
  }
}

/** Body of a `## Heading` section (up to the next heading of the same or higher level). */
function section(body, heading) {
  const lines = (body || '').split('\n');
  const start = lines.findIndex((l) => /^#{2,3}\s/.test(l) && l.replace(/^#+\s*/, '').trim().toLowerCase() === heading.toLowerCase());
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  const out = [];
  for (const l of lines.slice(start + 1)) {
    const m = l.match(/^(#+)\s/);
    if (m && m[1].length <= level) break;
    out.push(l);
  }
  return out.join('\n');
}

const stripComments = (s) => (s || '').replace(/<!--[\s\S]*?-->/g, '');

/** First markdown table in `text` → array of row objects keyed by lower-cased header. */
function table(text) {
  const rows = stripComments(text)
    .split('\n')
    .filter((l) => /^\s*\|/.test(l))
    .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  return rows
    .slice(2)
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** The `<frozen-after-approval>` block, normalized for hashing; null when absent. */
function frozenBlock(text) {
  const m = (text || '').replace(/\r\n/g, '\n').match(/<frozen-after-approval[^>]*>([\s\S]*?)<\/frozen-after-approval>/);
  if (!m) return null;
  return stripComments(m[1])
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Words outside the Decision Log, and the number of Decision Log entries. */
function docSize(body) {
  const clean = stripComments(body);
  const log = section(clean, 'Decision Log') || '';
  const words = (clean.replace(log, '').match(/\S+/g) || []).length;
  return { words, logEntries: (log.match(/^\s*-\s+\S/gm) || []).length };
}

const idsIn = (text, re) => [...new Set([...(text || '').matchAll(re)].map((m) => m[1]))];

/** Load the whole tree. Never throws on content problems; records them in `problems`. */
function loadPlan(project) {
  const { planDir } = project;
  const plan = { ...project, exists: fs.existsSync(planDir), epics: [], stories: new Map(), problems: [], spec: null, arch: null };
  if (!plan.exists) return plan;

  const CAP_RE = /^\s*-\s*\*\*((?:CAP|QR)-\d+)\b/gm;
  const AD_RE = /^#{2,4}\s*(AD-\d+)\b/gm;
  const spec = read(path.join(planDir, 'SPEC.md'));
  if (spec != null) {
    const fm = frontmatter(spec);
    plan.spec = { fm: fm.data, ids: idsIn(stripComments(fm.body), CAP_RE), archived: idsIn(stripComments(read(path.join(planDir, 'SPEC.archive.md'))), CAP_RE), ...docSize(fm.body) };
  }
  const arch = read(path.join(planDir, 'ARCHITECTURE.md'));
  if (arch != null) {
    const fm = frontmatter(arch);
    plan.arch = { fm: fm.data, ads: [...idsIn(stripComments(arch), AD_RE), ...idsIn(stripComments(read(path.join(planDir, 'ARCHITECTURE.archive.md'))), AD_RE)], ...docSize(fm.body) };
  }

  const idx = parseYaml(path.join(planDir, 'epics.yaml'));
  plan.index = idx;
  for (const e of (idx.data && idx.data.epics) || []) {
    const epic = { ...e, dir: e.folder ? path.join(planDir, e.folder) : null, stories: [], lanes: [] };
    plan.epics.push(epic);
    if (!epic.dir || !fs.existsSync(epic.dir)) continue;

    const epicMd = read(path.join(epic.dir, 'EPIC.md'));
    if (epicMd != null) {
      const fm = frontmatter(epicMd);
      epic.md = { fm: fm.data, error: fm.error, ads: idsIn(stripComments(fm.body), /^#{2,4}\s*(AD-\d+)\b/gm), exitEvidence: (stripComments(section(fm.body, 'Exit evidence') || '').match(/\S+/g) || []).length };
    }
    const contracts = read(path.join(epic.dir, 'CONTRACTS.md'));
    if (contracts != null) {
      const fm = frontmatter(contracts);
      epic.contracts = {
        fm: fm.data,
        seams: table(section(fm.body, 'Seams')),
        decisions: table(section(fm.body, 'Decisions due')),
      };
    }
    epic.deferred = ((read(path.join(epic.dir, 'deferred.md')) || '').match(/^- source:/gm) || []).length;

    const sy = parseYaml(path.join(epic.dir, 'stories.yaml'));
    epic.storiesYaml = sy;
    if (!sy.data) continue;
    epic.lanes = sy.data.lanes || [];
    (sy.data.stories || []).forEach((s, order) => {
      const file = s.file ? path.join(epic.dir, s.file) : null;
      const text = file ? read(file) : null;
      const fm = frontmatter(text);
      const story = { entry: s, id: s.id, epic: epic.id, order, file, exists: text != null, text, fm: fm.data, fmError: text != null ? fm.error : null, body: fm.body };
      epic.stories.push(story);
      if (s.id && !plan.stories.has(s.id)) plan.stories.set(s.id, story);
    });
  }
  return plan;
}

/** A story's effective status ('missing' when its file can't be read). */
const statusOf = (story) => (story && story.exists ? story.fm.status || 'todo' : 'missing');

module.exports = {
  STORY_STATUS,
  EPIC_STATUS,
  IN_FLIGHT,
  resolveProject,
  loadPlan,
  frontmatter,
  section,
  table,
  stripComments,
  frozenBlock,
  sha256,
  statusOf,
  read,
};
