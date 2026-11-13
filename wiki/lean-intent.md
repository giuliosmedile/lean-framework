**`lean-intent` turns an idea, notes or an existing PRD into one short `SPEC.md`: what to build and why.**

It is the first step of the [LEAN process](The-LEAN-Process.md). It draws the intent out of you and never substitutes its own.

## When to use it

- New feature, product or initiative, from an idea, brief, transcript or PRD.
- Pressure-testing an idea before committing.
- The SPEC exists and requirements changed (update mode), or you want a critique with no edits (validate mode).

Skip it for a small, well-understood change: run `lean-build` alone with a freeform intent.

## Inputs

| Input | Notes |
|---|---|
| Your idea, in your words | Rough is fine. |
| `docs/` | Briefs, PRDs, notes, transcripts, research, mockups. Read-only: LEAN never writes there. Folder is `core.input_folder` in the [config](Configuration.md). |
| Material elsewhere | A path or a paste. |
| Stakes | One question: **hobby / internal tool / product launch?** |

Large documents go to a `scout` worker that returns at most 20 bullets with section references. Every document used is listed in the SPEC's `sources:` frontmatter.

## Outputs

| File | When |
|---|---|
| `plan/SPEC.md` | Always. One per project. Capabilities `CAP-n`, quality requirements `QR-n`. |
| `plan/UX.md` | Only when UI is a major part. Tokens, surfaces, flows, states, accessibility floor. |
| Companion files | Launch stakes with heavy concerns (compliance, integrations, monetization). Listed in `companions:`. |

Where these live: [Artifacts and Layout](Artifacts-and-Layout.md).

## How a run goes (create mode)

1. **Intake, one turn.** It lists `docs/`, then asks for the idea, which listed documents apply (default: all), other material, and the stakes.
2. **Draft** on the fast or coaching path (below), from the template; `UX.md` too if UI matters.
3. **Self-check**, then one independent `check` worker against the doc rubric (skipped for hobby). The orchestrator verifies each finding before acting.
4. **Close.** Open Questions and assumptions go to you in one message, with a recommendation marked. Blockers are resolved now. Then `status: final`, and it names the next step.

### Fast path vs coaching

| Path | What happens | Use when |
|---|---|---|
| **Fast** (default) | One consolidated question round for the gaps, then the whole spec with `[ASSUMPTION]` tags. You correct in review. | You know what you want. |
| **Coaching** | It walks the sections with open-ended questions ("tell me about who hits this problem"). | The idea is still forming, or you ask for it. |

### Drafting rules

- Capabilities say WHAT, never HOW. Tech choices go to the Decision Log as `[for architecture]`.
- Every capability has an `intent` and a testable `success`. No success line means an open question.
- Quality requirements carry numbers: "p95 < 300 ms on search", not "fast".
- At least one non-goal.
- Each concern the product carries (compliance, money, PII, offline...) gets a home. A domain concern the input is silent on (health data without HIPAA) becomes an Open Question, never an invented answer.
- Journeys only when they earn it. It proposes cutting any capability not needed for the Why.

## `[ASSUMPTION]` tagging

Every inference you have not confirmed is tagged `[ASSUMPTION: ...]` inline, indexed in the `Assumptions` section, and put to you at close.

## Pressure-test round and research (optional)

- **Challenge round.** For half-formed ideas, or on request. 5-7 hard questions, one or two at a time, each from a named angle: skeptical customer, operator, engineer, finance, competitor. It pushes back once on thin answers, then gives a 3-line verdict: proceed, reshape or drop.
- **Research.** When market, domain or prior art would change a decision, a `research` worker returns at most 10 bullets with sources. Sources a decision rests on are spot-checked and cited in the Decision Log.

Worker tiers: [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

## Length scales with stakes

| Stakes | Extras | SPEC cap (`kiss`) | SPEC cap (`standard`) |
|---|---|---|---|
| hobby | none | 1/2 page | 1 page |
| internal | `UX.md` if UI-heavy | 2 pages | 4 pages |
| launch | `UX.md` if UI matters, companion files | 5 pages (+ companions) | as needed |

`UX.md` is capped at 2 pages under `kiss`. One page is about 500 words. `check` warns `spec/size` above 1.2 times the cap; the Decision Log is not counted. More: [KISS Style](KISS-Style.md).

## Decision Log

The last section of `SPEC.md`. Append-only, one line per entry, newest last:

```
- {date} — {decision | change | assumption | dropped} — {gist, with reason}
```

Never edited or reordered; a later entry supersedes an earlier one. Close logs `finalized` and a `workers:` line. In update mode it is the authority on what was decided and why.

## Updating an existing SPEC

If `plan/SPEC.md` exists, the run is an update, including a new initiative in an existing project.

1. It reads the SPEC, `UX.md` and the Decision Log first.
2. It logs the change, surfaces conflicts with earlier decisions, then edits.
3. **CAP ids are stable.** Never renumbered or reused. New capabilities take the next free number.
4. If `plan/epics.yaml` exists, it lists the epics whose `caps` include a changed capability, plus the story files that cite it in `active` or `done` epics. Then it suggests `lean-change course` ([lean-change](lean-change.md)).

When the SPEC grows, `check` warns (see [CLI Plan Tooling](CLI-Plan-Tooling.md)):

| Warning | Fix |
|---|---|
| `spec/size` | Move retired capabilities, ids intact, to `plan/SPEC.archive.md` with a `retired:` line (date, reason). Their ids stay taken. Never archive one an active or planned epic still claims. |
| `doc/log-size` (over 40 entries) | Keep the newest 10. Append the rest, oldest first, to `plan/SPEC.log.md`; leave `Earlier decisions: SPEC.log.md`. |

**Validate mode** runs `check` workers in parallel (SPEC rubric lens plus the adversarial lens), verifies their findings, and reports blockers first. It makes no edits.

## How it feeds `lean-plan`

- Next step is [`lean-architecture`](lean-architecture.md) when separately built parts could diverge, otherwise [`lean-plan`](lean-plan.md).
- `lean-plan` loads `SPEC.md` and its companions and cites `CAP-`, `QR-` and `UJ-` ids instead of copying requirements.
- Each `CAP-n` and `QR-n` must land in an epic's `caps`, or under `uncovered:` with a reason. Otherwise `check` fails with `caps/uncovered`.
- `check` finds ids only in bullets shaped `- **CAP-n ...` or `- **QR-n ...`. Keep that shape.

## Invocation example

Ask your agent in plain words, or name the skill with your tool's skill command.

```
Use lean-intent to create a spec. Idea: a CLI that exports last month's
invoices to CSV for our accountant. Use docs/accountant-email.md.
Internal tool, fast path.
```

Answer its numbered questions as `1a 2b` ([KISS Style](KISS-Style.md)).

## Illustrative `SPEC.md` skeleton

Trimmed and invented for illustration. Sections follow the real template (`lean/skills/lean-intent/assets/spec-template.md`); unused optional sections are cut, never written as "N/A".

```markdown
---
title: 'Invoice Export'
status: final          # draft | final
stakes: internal       # hobby | internal | launch
updated: '2026-11-13'
companions: []
sources: [docs/accountant-email.md]
---

# Invoice Export

## Why
Finance rebuilds the monthly CSV by hand (about 2 h). Errors reach the accountant.

## Capabilities
- **CAP-1 — Monthly export**
  - **intent:** A finance user exports one month's invoices as CSV.
  - **success:** Given March has 40 invoices, When exported, Then the CSV has 40 rows and totals match the ledger.
- **CAP-2 — Re-run safely**
  - **intent:** The user re-runs an export without duplicates.
  - **success:** Two runs for the same month produce byte-identical files.

## Quality Requirements
- **QR-1:** A 5,000-invoice month exports in under 10 s.

## Non-goals
- No accounting-system integration; the accountant still receives a file.

## Assumptions
- [ASSUMPTION: CSV is UTF-8, comma-separated] — accountant's email does not say.

## Open Questions
- Should credit notes be exported? Default: no.

## Decision Log
- 2026-11-13 — dropped — PDF export, nobody asked for it.
- 2026-11-13 — assumption — UTF-8, comma-separated.
- 2026-11-13 — finalized — workers: check=sonnet escalations=0
```

## See also

- [The LEAN Process](The-LEAN-Process.md): where intent sits in the full flow.
- [lean-plan](lean-plan.md): the next skill; turns the SPEC into epics and stories.
- [lean-architecture](lean-architecture.md): optional step between SPEC and plan.
- [Artifacts and Layout](Artifacts-and-Layout.md): `docs/` vs `plan/`, ids, statuses.
- [KISS Style](KISS-Style.md): the caps and message shape this skill follows.
