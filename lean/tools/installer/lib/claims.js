'use strict';
// Story claims: an atomic, create-only git ref per story — refs/lean/claims/<id> → a blob "owner\nISO time\n".
// Refs are shared by every worktree of one clone, so parallel agents on one machine can't take the same story.
// Claims are local: never pushed (LEAN never pushes). Teams on separate machines own separate lanes instead.

const { execFileSync } = require('node:child_process');

const PREFIX = 'refs/lean/claims/';
const git = (root, args, input) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', input, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });

function hasGit(root) {
  try {
    git(root, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/** Map id → { owner, at } for every claim in the repo. Empty when there's no git. */
function listClaims(root) {
  if (!hasGit(root)) return new Map();
  const out = new Map();
  const refs = git(root, ['for-each-ref', '--format=%(refname) %(objectname)', PREFIX]).split('\n').filter(Boolean);
  for (const line of refs) {
    const [ref, oid] = line.split(' ');
    const [owner = '', at = ''] = git(root, ['cat-file', '-p', oid]).split('\n');
    out.set(ref.slice(PREFIX.length), { owner, at });
  }
  return out;
}

/** Atomically claim a story. Returns { ok, holder } — holder is the existing claim when ok is false. */
function claim(root, id, owner) {
  if (!hasGit(root)) return { ok: true, nogit: true };
  const oid = git(root, ['hash-object', '-w', '--stdin'], `${owner}\n${new Date().toISOString()}\n`).trim();
  try {
    git(root, ['update-ref', '--stdin'], `create ${PREFIX}${id} ${oid}\n`);
    return { ok: true };
  } catch {
    const holder = listClaims(root).get(id);
    if (holder && holder.owner === owner) return { ok: true, already: true };
    return { ok: false, holder };
  }
}

function release(root, id) {
  if (!hasGit(root)) return false;
  try {
    git(root, ['update-ref', '-d', `${PREFIX}${id}`]);
    return true;
  } catch {
    return false;
  }
}

module.exports = { listClaims, claim, release, hasGit };
