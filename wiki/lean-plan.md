**`lean-plan` turns the SPEC into a tree of epics and story files, checks that the plan is buildable, and shows progress.**

## When to use it

- You have a final `plan/SPEC.md` (from [lean-intent](lean-intent.md)). No SPEC: it sends you back to `lean-intent`.
- You want the next epic's stories, "where are we", or a readiness check.
- Two or more people or agents will work on one epic at once: it also draws lanes (see [Parallel Teams](Parallel-Teams.md)).
- Skip it for a small fix: use [lean-build](lean-build.md) alone.

The agent writes the plan itself (judgment); scripts do the mechanical checks.

## Modes

| Mode | Runs when | What it does |
|---|---|---|
| `epics` | default if `epics.yaml` does not exist | Drafts all epics at once as one table; creates the epic folders; then goes on to plan the first epic's stories. |
| `epic` | default once epics exist | Plans the stories of one epic: the one you name, else the next `planned` epic whose dependencies are done. |
| `readiness` | on request | Runs only the readiness check (whole project, or one epic) and reports. |
| `status` | on request | Summarizes progress and recommends the next story per lane. Edits nothing. |

Invocation is plain language (illustrative):

```
create epics from the spec
plan the next epic
plan epic E2
check readiness of E2
where are we?
```

## What it writes

```
plan/
  epics.yaml                    thin index: id, title, goal, caps, depends_on, status
  epics/E1-foundation/
    EPIC.md                     goal, exit criterion, scope, team, epic decisions, Decision Log
    stories.yaml                order and structure only
    stories/E1-1-scaffold.md    one file per story
    CONTRACTS.md                only when the epic runs 2+ lanes
```

Ids and layout in full: [Artifacts and Layout](Artifacts-and-Layout.md).

### Epics

- An epic is a milestone the user can see ("after E2, an analyst can run a search end to end"). Never one epic per technical layer.
- Fewest epics that deliver the spec, in delivery order, no forward dependencies. The first epic produces something runnable.
- Every CAP/QR lands in an epic, or under `uncovered:` with a reason.
- You review the whole `epics.yaml` in one pass.
- Only the first epic gets stories now; the others keep their `EPIC.md` until their turn ("just in time").

```yaml
# plan/epics.yaml (illustrative)
spec: SPEC.md
architecture: ARCHITECTURE.md
uncovered: []
epics:
  - id: E1
    title: Foundation
    folder: epics/E1-foundation
    goal: A user can add a document and see it listed.
    caps: [CAP-1, QR-1]
    depends_on: []
    status: active
  - id: E2
    title: Search
    folder: epics/E2-search
    goal: An analyst can search documents and open a result.
    caps: [CAP-2, CAP-3]
    depends_on: [E1]
    status: planned
```

### Stories

- `stories.yaml` keeps order and structure only. It has no status and no requirement text.
- Each story file is a stub: frontmatter, one sentence, Given/When/Then acceptance. [lean-build](lean-build.md) grows the same file into the build spec.
- **Stories point, they do not copy.** `caps` holds CAP-/QR-/UJ- ids and `rules` holds AD ids; the text stays in SPEC and ARCHITECTURE.
- Rules: fewest stories that deliver the epic; thin vertical slices; one user-facing goal each, small enough for the build-spec cap (kiss: 1,000 tokens); no forward dependencies in a lane; every claimed CAP covered. You review the list in one pass.
- `checkpoint: spec` goes on risky, irreversible or ambiguous stories (and `<E>-0`). Default `none`.

```yaml
# plan/epics/E2-search/stories.yaml (illustrative, single lane)
epic: E2
lanes: []
stories:
  - id: E2-1
    title: Search by keyword
    file: stories/E2-1-keyword-search.md
    lane: ''
    depends_on: []
  - id: E2-2
    title: Open a result
    file: stories/E2-2-open-result.md
    lane: ''
    depends_on: [E2-1]
```

```markdown
---
id: E2-1
title: 'Search by keyword'
epic: E2
lane: ''
caps: [CAP-2]
rules: [AD-2]
seams: []
checkpoint: none
status: todo
blocked_reason: ''
---

# E2-1 — Search by keyword

A user types a keyword and gets matching documents (CAP-2).

## Acceptance

- Given 3 documents and one containing "invoice", when the user searches "invoice", then only that document is listed.
- Given no match, when the user searches, then an empty-state message is shown.
```

Frontmatter written by `lean-plan`: `id`, `title`, `epic`, `lane`, `caps`, `rules`, `seams`, `checkpoint`, `status`, `blocked_reason`. `lean-build` adds its own keys later (route, hashes, metrics); see [lean-build](lean-build.md).

### Status values

| Where | Values |
|---|---|
| Story file (`status`, the only home) | `todo`, `draft`, `ready`, `in-progress`, `in-review`, `done`, `blocked`, `retired` |
| `epics.yaml` and `EPIC.md` | `planned`, `active`, `done` |

- `blocked` needs `blocked_reason`. `retired` stories stay listed but do not count.
- After drafting stories, `lean-plan` sets the epic `active` in `epics.yaml` and `EPIC.md`.
- Who builds a story right now is a claim, not a status ([CLI Plan Tooling](CLI-Plan-Tooling.md)).

## The headcount question

Before drawing stories, `lean-plan` always asks, in one message:

1. How many people or parallel agents work on this epic at the same time?
2. If more than one: names, ownership split, integration branch, merge cadence.
3. If more than one: are the builders agents run by one person (`contracts: lite`) or separate people (`contracts: full`)?

The answers go under `## Team` in `EPIC.md`.

- **One lane:** nothing else changes.
- **2+ lanes:** it needs the module table in ARCHITECTURE.md (else it recommends [lean-architecture](lean-architecture.md) first). It writes `lanes` into `stories.yaml` and a `CONTRACTS.md`. Story `<E>-0` implements the contracts and comes before any lane story. Details: [Parallel Teams](Parallel-Teams.md).

## Readiness check

Closes each epic plan. One question: could each developer build these stories without inventing decisions nothing records, and will the pieces fit?

It runs `node _lean/bin/lean.js check --epic <E>` first, then reads what a script cannot judge: decisions recorded, document conflicts, buildable stories.

| The script flags | Level |
|---|---|
| Missing folder, `EPIC.md` or story file; story file not listed in `stories.yaml`; active epic without `stories.yaml` | error |
| Bad or duplicate ids; frontmatter id or epic not matching the index; unknown lane | error |
| Status in `stories.yaml`; unknown status; `blocked` without `blocked_reason` | error |
| Unknown or cyclic dependency; forward dependency in the same lane | error |
| Lanes without `CONTRACTS.md` or `<E>-0`; overlapping lane modules; seam without an owner (or, in `full`, a checkpoint) | error |
| Story `caps` outside the epic's caps; unknown AD in `rules`; lane first story waiting on more than `<E>-0`; overdue decision | warning |

Project-wide CAP coverage (every CAP/QR is in an epic or `uncovered:`) is checked only by a full `check`, not by `--epic`. Errors must be fixed; warnings are reported. Verdict:

- **PASS:** one line; next is `lean-build` on `<E>-0` (multi-lane) or the first `todo` story.
- **CONCERNS:** each gap named; you choose: proceed or fix.
- **FAIL:** findings by severity, each naming the skill that fixes it.

Launch-stakes projects, epics over about 15 stories, and multi-lane epics also get a `check` worker run against the doc rubric; the agent verifies its findings.

## Status, deferred items, closing an epic

`status` runs `next` and `check`, then reports an epics table, a per-lane table for each active epic, blocked stories, due seam checkpoints, overdue decisions, pending contract changes, deferred items worth promoting, and `Next:`.

- **Deferred items** live in each epic's `deferred.md` and in `plan/deferred.md` (ad-hoc and cross-epic). [Review and Triage](Review-and-Triage.md) and `lean-build` append to them. `status` points out which deserve a story; a promoted item becomes a story in `stories.yaml` with the next free id.
- **All stories `done`:** the epic is set `done` in `epics.yaml` and `EPIC.md`, and `lean-plan` recommends `lean-change retro`. `check` warns when a done epic has no `## Exit evidence` in `EPIC.md`.
- **Blocked stories, failed checkpoints, or deferred items that point at a plan problem:** it recommends `lean-change course` ([lean-change](lean-change.md)).

## See also

- [Artifacts and Layout](Artifacts-and-Layout.md): the `plan/` tree, ids and statuses in full
- [Parallel Teams](Parallel-Teams.md): lanes, `<E>-0`, `CONTRACTS.md`, seams
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `check`, `next`, `claim` in detail
- [lean-build](lean-build.md): what happens to a story file next
- [lean-change](lean-change.md): `course` and `retro`
