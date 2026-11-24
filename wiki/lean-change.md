**`lean-change` handles change once building has started: `course` fixes a plan that went wrong, `retro` closes a finished epic.**

## Modes

The skill infers the mode from your request. Trigger phrases: "correct course", "the plan is wrong", "requirements changed", "retro", "retrospective".

| | `course` | `retro` |
|---|---|---|
| Use when | a requirement changed, a build hit a wall the plan didn't foresee, or blocked stories and deferred items point at a plan problem | an epic or milestone is finished |
| Not for | one story's local problem ([lean-build](lean-build.md)) | an unfinished epic (it asks first) |
| Writes | `plan/changes/{date}-{slug}.md`, then approved edits | the epic's `retro.md`; approved pitfalls in `AGENTS.md` |

Example prompts to your agent (illustrative):

```
lean-change course  The client now needs SSO; SPEC says email + password only
lean-change course  E2-4 is blocked: the search API cannot return facets
lean-change retro   E2
lean-change retro   E2 --auto
```

`scout` workers gather evidence; the orchestrator judges and writes ([roles](Orchestrator-and-Cost-Tiers.md)), replying in the [KISS shape](KISS-Style.md).

## course

1. **Trigger and evidence.** One or two sentences plus evidence: an error, a story, a stakeholder request, a failed approach. Files in `docs/` newer than SPEC.md's `updated` are often the evidence. No evidence: it asks before analyzing.
2. **Classify.** Technical limit, new requirement, misunderstood requirement, strategic pivot, or failed approach.
3. **Impact sweep.** Reads SPEC, UX, ARCHITECTURE (with Decision Logs), `epics.yaml`, `plan/deferred.md`. Then, only for epics touched (by `caps`, or stories whose `rules` cite a changed AD): EPIC.md, `stories.yaml`, story frontmatters, CONTRACTS.md, `deferred.md`. Done stories count too: a changed capability can invalidate shipped code, and a `scout` can search their code.
4. **Smallest sufficient response**, with the reason:
   - adjust stories only;
   - amend SPEC / UX / ARCHITECTURE, then stories;
   - re-plan one epic ([lean-plan](lean-plan.md)), or add / split / drop an epic in `epics.yaml`;
   - stop and rethink (back to [lean-intent](lean-intent.md)).
5. **Proposal.** One file, presented once as a whole. You approve, edit, or drop items. Nothing changes before that.
6. **Apply** the approved edits:
   - log each in the affected doc's Decision Log: `change — {gist} — see changes/{file}`;
   - ids stay stable: retire, never renumber;
   - rework: `status: todo` plus a note under the story's title; obsolete: `status: retired` with a one-line reason, entry kept in `stories.yaml`;
   - new stories take the next free id in their epic, with a stub file;
   - it ends with one recommended next step.

If an edit touches a story's frozen intent, `check` errors (`story/frozen-changed`) until it is unlocked and re-frozen ([Frozen Intent and Guards](Frozen-Intent-and-Guards.md)).

### Proposal skeleton (illustrative)

`plan/changes/2026-11-13-sso-login.md`. The skill fixes the content, not these headings.

```markdown
# SSO login

## Trigger and evidence
docs/client-sso.md (newer than SPEC `updated`): staff sign in with company SSO.
Class: new requirement. Response: amend SPEC, then stories.

## Impact
| Artifact | Change | Stories |
|---|---|---|
| SPEC.md CAP-2 | add SSO sign-in | E1-3 (done), E2-1 (todo) |

## Edits
1. SPEC.md CAP-2 success. Reason: SSO is now required.
   - old: "A user signs in with email and password."
   - new: "A user signs in with company SSO; email and password stay for admins."
2. E1-3 (done): `status: todo`, note "rework for SSO". Reason: shipped login lacks SSO.
```

### Contract change

The fast path when a lane needs a seam changed in a multi-lane epic whose CONTRACTS.md is frozen. A lane never patches contracts locally; [lean-build](lean-build.md) halts and asks for this instead.

- The proposal names the seam, the change (types, value rules, fake, fixture values, contract test) and every lane and story affected.
- The owner of each affected lane says yes (or you do, for them).
- On approval it adds one `<E>-C<n>` story, e.g. `E2-C1`: a story file plus a `stories.yaml` entry with `lane: shared`, `checkpoint: spec`, ahead of the stories that need it.
- It logs the change in CONTRACTS.md's Change Log; every lane then rebases.

See [Parallel Teams](Parallel-Teams.md).

## retro

Judges the finished work against the evidence it left, not memory. **Every finding cites a source** (file, line, commit, triage-log row, deferred entry); a claim without one is dropped.

**Short retro for a one-story epic.** The orchestrator reads the story's Review Triage Log, Spec Change Log and Implementation Notes, the epic's `deferred.md` and `metrics --epic <E> --json` itself: no `scout` workers, no analysis round. `retro.md` is a one-line verdict (the exit-evidence rule below still applies), one table of at most 8 findings with sources, at most 5 actions and at most 3 pitfalls. Run it in a mid-tier session. A full retro on a one-story epic only when you ask.

1. **Scope.** The epic you name; else the most recent `done` epic, or the active one with every story `done`. Unfinished stories: it says so and asks whether to proceed.
2. **Gather evidence** with parallel `scout` workers; each digest line carries a source reference, and the orchestrator re-opens the source of any line it turns into a finding. Sources: each story's Review Triage Log, Spec Change Log, `review_loops` and Implementation Notes ([Review and Triage](Review-and-Triage.md)); the epic's `deferred.md`; `git log` and diff stats for the epic's commits; the SPEC capabilities and ADs it covered.
3. **Analyze** for patterns no single story shows: recurring finding types, loopbacks and amendments, drift from an AD or capability, urgent deferred items, seam problems (multi-lane), complexity creep (`kiss.md` §A), cost and review quality, and whether the epic meets its capabilities' success lines.
4. **Verdict:** accept, accept with follow-ups, or not accepted (naming what is missing).
5. **Pitfalls**, then **write** `retro.md` (below).

### Cost and review figures

```bash
node _lean/bin/lean.js metrics --epic E2 --json
```

Run it instead of counting by hand. It covers `done` stories only ([CLI Plan Tooling](CLI-Plan-Tooling.md)).

| Figure | Reading |
|---|---|
| `escalations` | a role that keeps escalating has its tier set too low |
| `review_loops`, `looped_stories`, `triage_routes` | how often planning missed (`intent_gap`, `bad_spec`, `amend`) |
| `false_rate`, `by_lens` per reviewer model | a lens that is mostly `false` costs top-tier triage for nothing; a model with fewer real findings may be missing bugs |
| `worker_tokens`, `orchestrator_tokens`, `median_minutes`, `deferred` | spend and pace; `null` tokens = not reported; `deferred` = entries in the epic's `deferred.md` |

### Exit evidence

**Accept needs exit evidence.** EPIC.md's `## Exit evidence` must name the automated end-to-end test that passed on the integration branch (with the commit) or a demo you watched (date, who). The agent's own reading is not enough. If it is missing, you are asked to run the test or watch the demo now; if you can't, the verdict is at most *not accepted — exit not demonstrated*. `check` warns (`epics/no-exit-evidence`) on a `done` epic with an empty section.

### Pitfalls for the agents

Lessons that should change how any agent works in the repo go into `AGENTS.md` (or `CLAUDE.md`, if the repo uses it), not only `retro.md`. Candidates: a recurring root cause, a convention reviewers kept enforcing, an `agent-context:` deferred entry, a repeated trespass or frozen-intent violation.

- **At most 3 per retro**, one line each, under a `## Pitfalls` heading (created if missing):
  `- {what goes wrong} → {what to do instead} (source: {epic} retro, {file:line or triage row})`
- They are shown with the retro; only approved ones are written.
- Existing pitfalls are read first: merge or replace a near-duplicate; drop one the code now prevents mechanically (lint rule, test, type).

### Deferred items

From the epic's `deferred.md` (append-only). Items that became urgent are promoted to a story in a later epic or a new epic. `agent-context:` entries become proposed pitfalls. The rest stay where they are.

### Write and hand off

`retro.md` holds the verdict, findings with sources and action items. Each action is a concrete edit with an owner: a story or epic, an AD amendment, a convention, an approved pitfall, a promoted deferred item. It marks the epic `done` in `epics.yaml` and EPIC.md if it isn't already, goes over the actions with you and applies the approved ones. Next: [lean-plan](lean-plan.md) on the next epic. If the plan itself proves wrong, it switches to `course`.

`--auto`: scope comes from the invocation, no discussion, every assumption is recorded in the retro file, and nothing is applied. Actions and pitfalls are listed as proposed.

### Retro skeleton (illustrative)

`plan/epics/E2-search/retro.md`. Figures are made up.

```markdown
# E2 Search — retro

## Verdict
Accept with follow-ups. Exit evidence: `search_e2e` green on `main` at a1b2c3d.

## Findings
1. Date-format findings in three stories: no convention exists. (E2-2, E2-3, E2-5 triage rows)
2. edge-case lens: 9 of 12 findings `false` on one reviewer model. (`metrics --epic E2`, `by_lens`)

## Actions
1. Add a date-format AD. Owner: you.
2. Promote "paginate results" from deferred.md to a story in E3. Owner: lean-plan.

## Proposed pitfalls
- Dates passed as strings between modules → use the shared Instant type (source: E2 retro, E2-3 triage row 4)
```

## See also

- [lean-plan](lean-plan.md): re-plans an epic after `course`, plans the next one after `retro`.
- [Parallel Teams](Parallel-Teams.md): seams, CONTRACTS.md, `<E>-C<n>`.
- [Review and Triage](Review-and-Triage.md): the verdicts and routes a retro counts.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `metrics` and `check`.
- [Artifacts and Layout](Artifacts-and-Layout.md): where `plan/changes/` and `retro.md` live.
