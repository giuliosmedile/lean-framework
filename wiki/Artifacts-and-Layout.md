**LEAN keeps everything in one fixed tree: your documents in `docs/` (read-only), LEAN's output in `plan/`, and every story's status in exactly one place.**

## The tree

The same layout is used for one epic or twenty.

```
docs/                             your source documents; LEAN reads, never writes
plan/
  SPEC.md                         what and why: CAP-n, QR-n, UJ-n         lean-intent
  SPEC.archive.md                 retired capabilities (on rollover)      lean-intent
  SPEC.log.md                     older Decision Log entries (rollover)   lean-intent
  UX.md                           optional                                lean-intent
  ARCHITECTURE.md                 modules table, AD-n                     lean-architecture
  ARCHITECTURE.log.md / .archive.md  rollover files, if present           lean-architecture
  epics.yaml                      epic index: id, title, goal, caps,
                                  depends_on, status                      lean-plan
  deferred.md                     cross-epic and ad-hoc deferred items    lean-build (triage)
  changes/<date>-<slug>.md        course-change proposals                 lean-change
  adhoc/<slug>.md                 build specs for unplanned work          lean-build
  epics/E2-search/                one folder per epic
    EPIC.md                       goal, exit criterion, team, epic ADs    lean-plan
    stories.yaml                  order and structure only: no status     lean-plan
    stories/E2-3-<slug>.md        the story AND its build spec            lean-plan stub, grown by lean-build
    CONTRACTS.md                  only when the epic runs 2+ lanes        lean-plan
    deferred.md                   this epic's deferred items              lean-build (triage)
    retro.md                      when the epic is done                   lean-change
```

Epic-scoped decisions (`## Epic decisions` in `EPIC.md`) are written by `lean-architecture`. See [Parallel Teams](Parallel-Teams.md) for `CONTRACTS.md`.

## `docs/` in, `plan/` out

- `docs/` is `core.input_folder` (default `docs`); `plan/` is `core.output_folder` (default `plan`). Wherever a skill says `docs/` or `plan/`, it means these keys.
- Set them at install (`--input-folder`, `--output-folder`) or in the config ([Configuration](Configuration.md)). They must differ; the installer refuses equal values.
- Skills never create, edit, move or delete anything in `docs/`. They cite what they used in the `sources:` frontmatter of `SPEC.md` (illustrative: `sources: [docs/brief.md, docs/interview-notes.md]`) or in a Decision Log entry. Large files go to a `scout` worker that returns the load-bearing claims as bullets.

## Ids

Ids are global, never renumbered, never reused.

| Id | Meaning |
|---|---|
| `E2` | epic |
| `E2-3` | story 3 of epic E2 |
| `E2-0` | the epic's contracts story (2+ lanes) |
| `E2-C1` | a contract change after freeze |
| `CAP-n`, `QR-n`, `UJ-n` | capability, quality requirement, user journey, in `SPEC.md` |
| `AD-n` | architecture decision; epic ADs continue the global numbering |

`check` enforces the formats (`E<n>`, `<E>-<n>` or `<E>-C<n>`, prefix matching the epic) and duplicates. Nothing is deleted. A dropped epic's id is retired. A story that is obsolete gets `status: retired` and stays in `stories.yaml`. A retired capability moves to `SPEC.archive.md` and its id stays taken. A superseded AD stays with a `superseded by AD-n` line.

## Status has one home

A story's status is the `status` in its own file's frontmatter. `stories.yaml` has none (`stories/status-in-index` is an error), and there is no sprint file. Two people finishing two stories never touch the same file.

| Story status | Meaning |
|---|---|
| `todo` | stub from `lean-plan`, not started |
| `draft` | `lean-build` is writing the spec; open questions keep it here |
| `ready` | intent approved and frozen |
| `in-progress` | `baseline_commit` set, implementing |
| `in-review` | reviewers and triage running |
| `done` | finished, `metrics:` filled |
| `blocked` | needs `blocked_reason` (`check` errors without it) |
| `retired` | obsolete; stays listed, does not count |

```
todo -> draft -> ready -> in-progress -> in-review -> done
 any open status -> blocked (halted, with a reason)
 rework: lean-change sets the story back to todo
 obsolete: lean-change sets it to retired
```

- **Epic status** lives in `epics.yaml`, mirrored in `EPIC.md`: `planned` (no stories yet) -> `active` (stories drafted) -> `done` (every non-retired story `done`).
- `check` warns `epics/ready-to-close` when all stories are done, errors `epics/done-open-stories` if a `done` epic has open ones, and warns `epics/no-exit-evidence` if it has no `## Exit evidence`.
- **Who is building a story now** is a claim, not a status ([Parallel Teams](Parallel-Teams.md#working-in-parallel)).
- In lane work the copy on the integration branch is authoritative; a lane branch may lag until it merges.

## Decision Log

Every planning doc (`SPEC.md`, `UX.md`, `ARCHITECTURE.md`, each `EPIC.md`) ends with a `## Decision Log`.

- Append-only, one line per entry, newest last. Never edit or reorder; a later entry supersedes an earlier one.
- Format: `{date} — {decision | change | assumption | ...} — {gist, with reason}`. Course changes log `change — {gist} — see changes/{file}`.
- It replaces BMAD's separate `.memlog.md` and script. To resume a run, read the doc.

## Just-in-time stories

`lean-plan` drafts all of `epics.yaml` at once, with an `EPIC.md` per epic. Only the first epic gets `stories.yaml` and story files. The next epic is detailed when it is next. Planning it early only plans churn. (If you ask for every epic at once, `lean-plan` does it, epic by epic.)

## Why cost stays flat

- "What next" reads `epics.yaml` plus the active epic. `node _lean/bin/lean.js next` computes it in a script, so no model tokens go on it.
- A build reads one story file, its `EPIC.md` (and `CONTRACTS.md`), and the CAP and AD ids it cites.
- Stories point to ids; they do not copy requirements.
- `done` epics are never reopened.
- The documents every skill reads whole are kept small by rollover (below).

## `deferred.md` at two levels

Review findings routed `defer` are appended to the epic's `deferred.md`, or to `plan/deferred.md` for ad-hoc or cross-epic work ([Review and triage](Review-and-Triage.md)). Append-only; existing entries are never edited and not deduplicated.

```
- source: `review`
  summary: one sentence
  evidence: why it is real
```

A summary starting `agent-context:` is picked up by `lean-change retro` as a candidate pitfall. `lean-plan status` suggests entries worth promoting to stories.

## Rollover

Skills read `SPEC.md` and `ARCHITECTURE.md` whole, so they must not grow without bound.

| File | Created when | Holds |
|---|---|---|
| `SPEC.archive.md` | `check` warns `spec/size` (over the page cap for its stakes) | retired capabilities with a `retired:` line (date, reason). Never archive one an active or planned epic claims |
| `SPEC.log.md`, `ARCHITECTURE.log.md` | `check` warns `doc/log-size` (over 40 Decision Log entries) | all but the newest 10 entries, oldest first; the doc keeps a pointer line |
| `ARCHITECTURE.archive.md` | many superseded ADs | the superseded ADs |

`check` reads the archives, so archived ids still count as taken.

## See also

- [Parallel Teams](Parallel-Teams.md): `CONTRACTS.md`, lanes and `<E>-C<n>` changes.
- [lean-plan](lean-plan.md): how the epic and story files are drafted.
- [Configuration](Configuration.md): the keys that rename `docs/` and `plan/`.
- [CLI plan tooling](CLI-Plan-Tooling.md): `check` and `next` over this tree.
- [The LEAN process](The-LEAN-Process.md): which skill writes which file, in order.
