**LEAN moves an idea to shipped code through nine skills that hand work to each other as files on disk.**

Each skill can run in a fresh agent session: everything it needs is in the files, never in chat history.

## The idea in one paragraph

Separate **what** (the spec), **how** (the architecture) and **doing** (the build). Keep intent in human hands, let cheap workers generate, let the expensive model judge. Review adversarially before anything ships. Everything else that older methods do (persona routing, repeated requirement extraction, finalize ceremonies, "[C] to continue" menus) is *noise*, and LEAN removes it. See [LEAN vs BMAD](LEAN-vs-BMAD.md) for what was cut.

## The pipeline

```
            ┌──────────────┐   ┌────────────────────┐   ┌────────────┐   ┌──────────────────┐
 idea ────▶ │ lean-intent  │──▶│ lean-architecture  │──▶│ lean-plan  │──▶│ lean-build  (×N) │──▶ shipped
            │  SPEC.md     │   │  ARCHITECTURE.md   │   │ epics/…    │   │ story file+code  │
            └──────────────┘   └────────────────────┘   └────────────┘   └──────────────────┘
                   ▲                 (optional for                              │
                   │                  small work)                               ▼
                   └──────────────────── lean-change (course | retro) ◀── deferred.md, triage logs

 lean-loop   — runs lean-build over an epic's stories unattended; a story is accepted only if the static checks pass.
 lean-review — standalone review of any diff or planning doc; also supplies the lenses build uses.
 lean-kit    — shared rules every skill loads (orchestration + KISS) and the config view.
 lean-help   — routes a request to the right skill and explains LEAN; start here when unsure.
```

## Stage by stage

| Stage | Skill | You provide | LEAN writes | You approve |
|---|---|---|---|---|
| 1. Intent | [lean-intent](lean-intent.md) | the idea, source files in `docs/`, how high the stakes are | `plan/SPEC.md` (capabilities `CAP-n`, quality requirements `QR-n`, non-goals), optional `UX.md` | answers to one consolidated round of questions; every `[ASSUMPTION]` |
| 2. Design | [lean-architecture](lean-architecture.md) | the SPEC (and any existing code) | `plan/ARCHITECTURE.md`: module table and the few decisions (`AD-n`) that could make separately built parts disagree | the decisions |
| 3. Plan | [lean-plan](lean-plan.md) | headcount: how many people or agents work on the epic at once | `epics.yaml`, then per epic: `EPIC.md`, `stories.yaml`, one file per story | the epic list, then the story list, each in one pass |
| 4. Build | [lean-build](lean-build.md) | a story id, "next story", or a free-form request | code, tests, and the story file grown into a full spec | the spec only when [a checkpoint applies](#where-you-stay-in-the-loop) |
| 5. Review | [lean-review](lean-review.md) | (runs inside every build; also usable alone) | a Review Triage Log in the story file | nothing, unless a finding goes back to you |
| 6. Change | [lean-change](lean-change.md) | a trigger: something changed, or an epic finished | `plan/changes/<date>-<slug>.md` (course) or `retro.md` | the proposal; the retro's actions |

## Choose your path

| Situation | Path |
|---|---|
| Small change, bug fix | `lean-build` alone |
| A feature | `lean-intent` → `lean-plan` → `lean-build` per story |
| A product, or parts built separately | `lean-intent` → `lean-architecture` → `lean-plan` → `lean-build` per story |
| 2+ people or agents in parallel on an epic | the product path; `lean-plan` adds lanes and contracts ([Parallel Teams](Parallel-Teams.md)) |
| Several planned stories, unattended | `lean-loop` ([page](lean-loop.md)) |
| A requirement or contract changed mid-way | `lean-change course` |
| An epic finished | `lean-change retro`, then `lean-plan` on the next epic |
| Not sure | `lean-help` |

## What one build does

`lean-build` is where most of the work happens. In order:

1. **Resolve** what to build: a story id, the next ready story, or a free-form request (saved as `plan/adhoc/<slug>.md`).
2. **Plan**: investigate the code with cheap `scout` workers, then choose the **small route** (no gaps, nothing irreversible, and a small footprint or a feature story) or the **full route** (a complete spec with an Edge-Case Matrix).
3. **Checkpoint** (only when needed), then **freeze** the approved intent with a hash.
4. **Tests first** (only when the story is `security: true` or a step is irreversible): a separate `test` worker writes failing acceptance tests; the orchestrator judges them and freezes them too. Otherwise the implementer writes the tests with the code.
5. **Implement**: a fresh-context `implement` worker, with the spec as its only brief.
6. **Check the diff**, not the worker's report, then run `lean-method check --story <id>` (planned stories only: ad-hoc specs are not in a `stories.yaml`, so only `freeze --file` and the guard hook cover them).
7. **Review**, once per feature, at the final story of the epic (earlier if the unreviewed diff passes `review.max_diff_lines`): blind reviewers in parallel (adversarial and verification-gap; edge-case when some story ran the full route; the security lens at trust boundaries). The orchestrator verifies each finding and routes it: `intent_gap`, `bad_spec`, `amend`, `patch` or `defer`. See [Review and Triage](Review-and-Triage.md).
8. **Finish**: a `## How to review` note, the `metrics:` block, `status: done`, a local commit.

Details, flags and the `--auto` unattended mode: [lean-build](lean-build.md).

**Feature-sized work takes the cheap profile.** A spec of at most three capabilities and no irreversible step (an additive migration such as a new table does not count) becomes one epic and one *feature story*, with no team question. Build it on a mid-tier session (the orchestrator's session is the largest line in the bill), on the small route, with tests written alongside the code and one review of the whole feature; the retro is one table. Frozen tests and a separate `test` worker stay for `security: true` and irreversible steps. A `bad_spec` or `intent_gap` loopback, or a failed implementer, moves the build to the top tier.

**This profile is experimental.** It came out of the cost analysis in [Experiment Results](Experiment-Results.md) and has been run once, on one feature, for cost and time only: its cost fell below BMAD's there, but its quality has not been measured. For work where a missed bug is expensive, use the full process.

## Where you stay in the loop

LEAN removes stop-and-approve moments that carry no information, and keeps the ones that do. You are asked when:

- **Intent is formed**: the idea, the stakes, open questions and assumptions in the SPEC.
- **Lists are approved as a whole**: the epic list once; each epic's story list once.
- **A build needs a human**: open questions exist, something is irreversible, the story says `checkpoint: spec`, or the work is ad hoc and on the full route.
- **A review finding is an `intent_gap`**, or a build has looped back more than 3 times.
- **Plans change**: you approve a course-change proposal before anything is edited.
- **An epic closes**: it is accepted only on demonstrated exit evidence (an end-to-end test that passed, or a demo you watched).

Never delegated to a cheaper worker: triage verdicts, frozen intent, ids, and any decision put to you. See [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

## What tools enforce

Prose asks an agent to behave; scripts and hooks make it:

- `lean-method check` lints the plan tree (ids, statuses, dependency order, CAP coverage, lanes, seams, spec size) and a single story (frozen intent intact, frozen tests intact, lane trespass).
- `freeze` hashes the approved intent; a guard hook on Claude Code and Codex refuses edits to it.
- `claim` takes an atomic lock on a story so two agents never build the same one.
- `metrics` counts loops, escalations and findings per lens and reviewer model.

See [CLI: Plan Tooling](CLI-Plan-Tooling.md) and [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## See also

- [Getting Started](Getting-Started.md): install LEAN and run your first path.
- [Walkthrough Example](Walkthrough-Example.md): an illustrative run on a small feature.
- [Artifacts and Layout](Artifacts-and-Layout.md): where every file lives and who writes it.
- [KISS Style](KISS-Style.md): the default rules for code, documents and replies.
