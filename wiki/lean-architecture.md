**`lean-architecture` records the few decisions that keep separately built stories consistent, in a short `plan/ARCHITECTURE.md`.**

It is a consistency contract, not a design document: it fixes only what two independent builders could get wrong in incompatible ways.

## When to use it

| Situation | Do this |
|---|---|
| Small change or one feature, one builder, no independent parts | Skip it. Go `lean-build` alone, or `lean-intent` → `lean-plan` → `lean-build`. |
| A product, or parts built separately (modules, services, several agents over time) | Run it after `lean-intent`. |
| An epic with 2+ lanes (people or parallel agents) | Required. `lean-plan` draws lanes from its module table and stops without one. |
| Existing codebase | Run it to ratify the conventions the code already shows. |

## Inputs

- `plan/SPEC.md` and companions, if present. What the SPEC settles is inherited, not re-asked.
- `docs/` (the input folder): architecture docs, ADRs, API specs, data models, infra notes. Ratified or challenged, and cited in the Decision Log. LEAN never writes to `docs/`.
- A raw idea (if too thin, the skill suggests `lean-intent` first) or an existing codebase.

## Output

`plan/ARCHITECTURE.md`, from `assets/architecture-template.md`. Keep only the sections the system needs; a small feature can be paradigm + 3 ADs + conventions.

| Section | Holds |
|---|---|
| Frontmatter | `title`, `status` (`draft` or `final`), `paradigm`, `updated`, `spec` |
| Paradigm | A named pattern and a dependency-direction diagram (mermaid in the file) |
| Modules | module · responsibility · talks to · holds state · may depend on |
| Decisions | `AD-n`, each with **Binds**, **Prevents**, **Rule** |
| Conventions, Stack, Structural Seed | Naming and formats; verified versions; minimal source tree |
| Capability Map | Each SPEC capability → where it lives → governing ADs |
| Deferred, Open Questions | Decisions left to stories, each with why it can wait |
| Decision Log | Append-only; rationale lives here, not in the AD |

## Invariants only

The test for every decision:

> If two stories were built independently, could they choose incompatibly here? Record it only if yes, **and** it is non-obvious, **and** it is a real trade-off.

Otherwise it goes under Deferred, or is left to the code.

- Each AD has a **Binds** (which CAPs or areas), a **Prevents** (the divergence), and a **Rule** (enforceable, ideally by a test). Ids are stable: never renumbered, never reused.
- Sweep every dimension: data, boundaries/APIs, state, errors, auth, config, deployment, observability, testing. Each is decided, deferred with a reason, or an open question. A silent dimension is the classic failure.
- KISS bias: monolith, one datastore, framework conventions, a well-known starter. An AD that adds a moving part (queue, cache, service split, second datastore) must name the measured need in the Decision Log.
- In `kiss` style the cap is **≤ 7 ADs, 2 pages** ([KISS Style](KISS-Style.md)). More usually means the scope is too big. `check` does not count ADs; author and reviewer hold the cap.

## How it runs

1. **Coach the load-bearing calls** (paradigm, stack or starter, major boundaries): 2–3 options in a table, a recommendation, the user picks. Decide the rest and tag `[ASSUMPTION]`. If the user wants speed, draft everything tagged and let them correct.
2. **Ask early** how many people will build in parallel. With 2+, shape modules so each could be one lane's territory. If non-builders will read it, a human-facing rendering is offered at the end.
3. **Brownfield:** parallel `scout` workers (layering and dependencies; data ownership and persistence; stack, build, test, deploy), each ≤ 15 bullets with file references. The orchestrator spot-checks, then ratifies what the code shows as `[ADOPTED]`. It invents nothing new.
4. **Pin versions from the web**, not memory; a `research` worker can batch it.
5. The orchestrator writes every AD; workers only scan and check.

## Independent review

There is no finalize ceremony. After a self-check against the test and the sweep, the skill launches **one** `check` worker with the ARCHITECTURE section of `lean-review`'s `doc-rubric.md`, run against ARCHITECTURE.md and SPEC.md. Skip it for a throwaway project.

The rubric checks:

- the real divergence points are fixed and none is missed;
- every Rule is enforceable and prevents its stated divergence;
- nothing under Deferred could let two stories diverge;
- every dimension is decided, deferred, or open;
- pinned tech is current; brownfield ratifies the code;
- every SPEC capability is in the Capability Map.

The worker returns a verdict (`ready` / `ready with fixes` / `not ready`) and findings by severity. For platform-scale or high-risk systems, add the adversarial lens as a parallel worker, or run the rubric at `top` tier. The orchestrator verifies every finding itself ([Review and Triage](Review-and-Triage.md)), applies clear fixes, and brings the user only what needs a decision.

**Close:** blocker questions go to the user in one message. Then `status: final`, log `finalized` plus the `workers:` line. Next step: `lean-plan`.

## Modes

- **Create** (default): as above.
- **Update:** log the change, amend the affected AD's Rule in place or add the next `AD-n`; never renumber. Then list the stories (in `active` and `done` epics) whose `rules:` cite a changed AD and suggest `lean-change course` ([lean-change](lean-change.md)).
- **Validate:** critique only. Runs the rubric (plus adversarial), reports blockers first, offers to roll findings into an Update. Edits nothing.
- **Epic scope:** the project doc is binding and read-only. Only the project's Deferred items and the epic's internal seams are decided, in `EPIC.md` → `## Epic decisions`, continuing the AD numbering. A decision that weakens a project AD is a conflict for the user, not a local override.

**Keeping it small:** when `check` warns `doc/log-size` (over 40 Decision Log entries), move all but the newest 10 to `plan/ARCHITECTURE.log.md`. Superseded ADs stay with a `superseded by AD-n` line; many go to `plan/ARCHITECTURE.archive.md`, and `check` still recognizes their ids.

## How lanes derive from the module table

`lean-plan` draws lanes by **module ownership**, never story by story ([Parallel Teams](Parallel-Teams.md)).

- Lanes = min(people, independent module groups).
- Lanes share no code except the contracts package. Only the composition root knows every lane, and it has a named owner.
- Each lane's modules become path prefixes in `stories.yaml` → `lanes`, so `check --story` can flag trespass.
- Module table missing or boundaries vague: `lean-plan` stops and sends you back here.
- Stories list the ADs they honor in `rules:`; `check` warns `story/rule-unknown` for an id found nowhere.

## Invocation

Ask in plain language, or name the skill:

```
create the architecture
update the architecture: we are adding a job queue
validate the architecture
architecture decisions for epic E3
```

## Illustrative example

Invented and trimmed; real files follow the template.

```markdown
---
title: 'Linkbox — Architecture'
status: final
paradigm: 'Hexagonal (ports and adapters)'
updated: '2026-11-13'
spec: SPEC.md
---

## Modules

| Module | Responsibility | Talks to | Holds state | May depend on |
|---|---|---|---|---|
| domain | Pure link rules | — | no | — |
| store | Persist links | SQLite | yes | domain |
| app | Composition root | all | no | all |

## Decisions

### AD-1 — Domain imports nothing
- **Binds:** all
- **Prevents:** SQL or HTTP types leaking into business rules
- **Rule:** `src/domain/` imports only from `src/domain/`; a test fails otherwise.

### AD-2 — One error shape
- **Binds:** CAP-1, CAP-2
- **Prevents:** each endpoint inventing its own error body
- **Rule:** every non-2xx body is `{ "error": { "code", "message" } }`.

## Deferred

- Caching: no measured need; decide if p95 > 300 ms.

## Decision Log

- 2026-11-13 — decision — hexagonal over layered: store can be faked in tests; layered lets SQL creep upward.
```

## See also

- [lean-intent](lean-intent.md): produces the SPEC this skill reads.
- [lean-plan](lean-plan.md): turns SPEC and ARCHITECTURE into epics, stories and lanes.
- [Parallel Teams](Parallel-Teams.md): how lanes and contracts use the module table.
- [Review and Triage](Review-and-Triage.md): how the independent review is verified.
- [KISS Style](KISS-Style.md): the AD and page caps.
