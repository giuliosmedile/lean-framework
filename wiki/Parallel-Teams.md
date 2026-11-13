**Parallel teams in LEAN: when an epic has more than one builder, `lean-plan` splits it into lanes, freezes the seams between them in a contracts story first, and `check` enforces the boundaries.**

Lanes are per epic: one epic can run three, the next one. With one builder nothing below applies.

## The headcount question

`lean-plan` asks once per epic, in one message:

1. How many people or parallel agents work on this epic at the same time?
2. If more than one: their names or handles, and any ownership split.
3. The integration branch, and whether lanes merge after every story (recommended) or at checkpoints.
4. Are the builders agents run by one person, or separate people?

Answers go under `## Team` in `EPIC.md`. One builder means one lane. Agents under one person means `contracts: lite`; two or more people means `contracts: full`.

## Lanes = module ownership

A lane owns modules from the module table in `ARCHITECTURE.md` ([lean-architecture](lean-architecture.md)), never loose stories. If the table is missing or vague, `lean-plan` stops and sends you there first.

- Lanes = min(people, independent module groups). More people than groups: pair inside a lane.
- Lanes share no code except the contracts package. Only the composition root knows every lane; it has a named owner.
- Every lane has a first story that needs only `<E>-0`, so nobody waits.
- Balance the critical path: if one lane carries most of the work, move a module or split its biggest story.

```
            +--> lane A  src/query/   E2-1 -> E2-2 --+
 E2-0 ------+                                         +--> E2-5 checkpoint --> exit: fixture runs
 contracts  +--> lane B  src/export/  E2-3 -> E2-4 --+    (integration)       end to end, real code
```

Lanes are declared in the epic's `stories.yaml`; `modules` are path prefixes from the repo root:

```yaml
epic: E2
contracts: full            # full | lite; full when omitted
lanes:
  - { id: A, owner: ann, modules: [src/query/] }
  - { id: B, owner: bob, modules: [src/export/] }
```

`check` errors on overlapping lane paths (`lanes/overlap`) and undeclared lanes. A lane without `modules` only warns, but its trespass cannot be checked.

## Story `<E>-0`

The contracts story: `lane: shared`, `checkpoint: spec`, always the full build route. `next` offers no other story in the epic until it is `done`. It implements `CONTRACTS.md`:

1. Contracts package: types only, no logic, no framework or driver dependencies.
2. One word per concept; a glossary lists rejected synonyms.
3. One deterministic fake per port, no I/O, in shared test code.
4. Oracle fixtures: the spec's worked examples as data, every intermediate value at every seam, checked against the real schema by a test.
5. One abstract contract test per port, encoding its value rules. The fake passes it now; the real code must later.
6. A boundary test: lane modules do not import each other.
7. A walking skeleton: the composition root wired with every fake runs the fixture end to end as a test. It stays green on the integration branch while lanes swap fakes for real code.

## CONTRACTS.md: lite vs full

| | lite | full |
|---|---|---|
| For | agents run by one person | two or more people |
| File keeps | Lanes, Seams (owner, value rules, fake), skeleton | everything, incl. fixtures, vocabulary, decisions due, change log |
| `<E>-0` items | 1, 3, 5, 7 | all seven |
| Dropped | glossary, schema checks on fixtures, boundary test, checkpoint stories, decisions due | nothing |

`check` warns `lanes/lite-with-people` if a lite epic's lanes have different owners. Switch to full when a second person joins.

## Seams

A seam is any port, gateway or type crossing a lane boundary. Each needs:

- **A real-implementation owner** (lane and story). An unowned seam is the classic orphan, e.g. composition glue in nobody's lane (`seams/orphan`, error).
- **Value rules** the types do not pin: empty collections, null vs absent, formats and units, ordering, id form, return vs throw, every shape the producer may emit. Each is pinned by a contract test.
- **One fake**, producer-owned. Two fakes of one port drift apart.
- **A checkpoint story** (full only; `seams/no-checkpoint` is an error): a small `lane: integration` story whose `depends_on` names both sides. When both are real it runs the fixture through real producer and real consumer. On failure, the contract tests decide whose side is wrong.

Illustrative `CONTRACTS.md` excerpt:

```markdown
---
title: 'E2 Export — Contracts'
status: draft
contracts_path: src/contracts/
fixtures_path: test/fixtures/
---
## Seams
| # | Port / type | Producer → consumer | Real impl (lane · story) | Fake | Contract test | Checkpoint story |
|---|---|---|---|---|---|---|
| S-1 | RowSource | A → B | A · E2-2 | FakeRowSource (A) | RowSourceContract | E2-5 |

### Value rules
| Seam | Rule |
|---|---|
| S-1 | No rows: empty list, never null. Dates: ISO-8601 UTC strings. Ordered by id ascending. Query failure: throws QueryError. |

## Decisions due
| Decision | Decide by (story) | Owner | Status |
|---|---|---|---|
| CSV delimiter | E2-3 | bob | open |
```

**Decisions due** (full only): each deferred decision a story will need gets a row with a decide-by story. `check` warns `decisions/overdue` when that story is already in progress, in review or done and the row is not `done`, `decided` or `closed`.

## Working in parallel

- **Merge after every done story** to the integration branch, not at the end. Status on the integration branch is authoritative; a lane branch may lag. `lean-build` reminds you and names any checkpoint the story unblocked.
- **Claims.** `node _lean/bin/lean.js claim --story E2-3 --owner agent-a` takes an atomic lock (a git ref); exit 1 means someone holds it. `--release` and `--list` also exist. Claims are shared by all worktrees of one clone and never pushed, so they stop two agents on one machine taking one story. People on separate machines avoid collisions by owning separate lanes.
- **Trespass check.** `check --story E2-3` diffs files changed since the story's `baseline_commit`. A lane story that touches another lane's `modules`, or the `contracts_path` and `fixtures_path` from CONTRACTS.md, gets `diff/trespass` (error); only lane `shared` may change contracts. Files under `plan/` are ignored; without git it only warns. `lean-build` reverts a trespass before review. More in [Frozen intent and guards](Frozen-Intent-and-Guards.md).

## Changing a contract after freeze

When `<E>-0` is done, CONTRACTS.md is `frozen`. A lane story that needs a change halts with a request (`blocked` in `--auto`); it never patches contracts locally.

1. [lean-change](lean-change.md) `course` writes a proposal in `plan/changes/`: the seam, the change, every affected lane and story.
2. The owner of each affected lane says yes.
3. One `E2-C1` story (`lane: shared`, `checkpoint: spec`) goes in ahead of the stories that need it. It updates types, fakes, fixtures and contract tests together.
4. The change is logged in CONTRACTS.md's Change Log. Every lane rebases.

## Lessons behind it

LEAN is modelled on a real three-lane epic with a contracts-first story. Its integration brief, seam fixes and course corrections showed what was missing:

| What went wrong there | What LEAN added |
|---|---|
| A port nobody owned (composition glue); the wiring story appeared late | Every seam needs a real-implementation owner; the skeleton wires the composition root on day 1 |
| Seams broke on values the types allowed (empty filter, dates as strings, parallel edges) | Value rules per seam, pinned by contract tests |
| Two incompatible fakes under one name | Exactly one fake per port, owned by the producer |
| Fixtures used fields the real catalog did not have | Fixtures checked against the real schema in `<E>-0` |
| Lanes merged after weeks; drift found on merge day | Merge after every story; per-seam checkpoints; skeleton always green |
| Decisions "due before story X" never taken | Decisions due, each with a decide-by story; status flags overdue ones |

## See also

- [lean-plan](lean-plan.md): how lanes and `<E>-0` are drafted.
- [lean-change](lean-change.md): the `course` mode that lands `<E>-C<n>` changes.
- [Frozen intent and guards](Frozen-Intent-and-Guards.md): claims and trespass in depth.
- [CLI plan tooling](CLI-Plan-Tooling.md): `check`, `next`, `claim` flags.
- [Artifacts and layout](Artifacts-and-Layout.md): where `CONTRACTS.md` lives.
