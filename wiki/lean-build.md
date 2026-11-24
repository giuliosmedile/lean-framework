**`lean-build` turns one story, or one freeform request, into reviewed and verified code. One spec file holds the intent, the approach, the review log and the metrics.**

Your session model is the orchestrator: it routes, writes the spec, judges the diff and triages every finding. Cheaper workers do bounded jobs ([Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md)). It never pushes to a remote.

## The flow

```
1 RESOLVE   story id | "next story" | freeform ──▶ one spec file
2 PLAN      scout ─▶ route (small | full) ─▶ [checkpoint?] ─▶ freeze
            security: true or irreversible step: test worker ─▶ judge tests ─▶ freeze --tests
3 IMPLEMENT fresh implement worker ─▶ judge the diff ─▶ matrix audit
            ─▶ Verification commands ─▶ check --story
4 REVIEW    final story only: 2-4 blind reviewers on the whole feature ─▶ you triage ─▶ route
              intent_gap ──▶ back to 2     bad_spec ──▶ back to 3
              amend / patch ──▶ fix in place     defer ──▶ deferred.md
5 FINISH    ## How to review ─▶ metrics ─▶ done ─▶ commit ─▶ report
```

## 1. Resolve

| You give | The skill does |
|---|---|
| A story id (`E2-3`) or file | Opens the file and resumes by `status` (see Status and resuming). |
| "next story" | Runs `node _lean/bin/lean.js next` and takes the first `next` line. |
| Freeform intent | Uses `plan/adhoc/<slug>.md` as the spec. It does not make you repeat the request. |
| Nothing | Lists in-flight stories and the next one, and asks which. |

Interactively, a dirty tree, a mismatched branch or several shippable goals stops the run to ask. Split-off goals go to `deferred.md` (`plan/deferred.md` for ad-hoc work).

## 2. Plan

**Seeding.** The story file written by [lean-plan](lean-plan.md) is the spec. Build keeps its frontmatter and grows the same file from `story-spec-template.md`. The story's `## Acceptance` moves into the Intent, sharpened, not re-derived, and numbered (`- AC-1: Given …`). Build adds `route`, `baseline_commit`, `review_loops`, `review`, `frozen_sha256`, `contract_sha256`, `approved_via`, `frozen_tests`, `security`, `context`, `metrics`. Ad-hoc work starts a fresh template file.

**Investigation.** `scout` workers map the code (15 bullets or fewer each); the orchestrator opens what it relies on. The spec's `context:` lists what the implementer reads.

**Route.** The orchestrator records intent gaps, irreversibles, footprint and trust boundary. Irreversible means a revert of the code would not undo it: a destructive or data-rewriting migration, data deletion, an external side effect, a deploy trigger. An additive migration (new tables, nullable columns or columns with a default, indexes) with a working downgrade is not irreversible. A trust boundary sets `security: true`.

| | Small route | Full route |
|---|---|---|
| When | no gaps, nothing irreversible, and a small footprint or a feature story | anything else |
| Spec | frontmatter, Intent (frozen), Implementation Notes | adds Boundaries, Edge-Case Matrix, Open Questions, Code Map, Tasks, Verification |
| Checkpoint | skipped | yes |
| Reviewers (final story) | adversarial, verification-gap if behavior changed | adversarial, edge-case, verification-gap |

The security lens joins either route on `security: true` or a diff that crosses a trust boundary. A small build that hits a gap, an irreversible step or growing scope switches to full and returns to step 2. The `kiss` spec cap is 1,000 tokens; over it, `check` warns `story/size` and the skill proposes a split ([KISS Style](KISS-Style.md)).

A **feature story** is the only story of its epic and covers all of the epic's capabilities (`lean-plan` writes one for a feature-sized spec). It takes the small route whatever its footprint, and its spec cap is twice the plain one (`check` applies the doubled cap to it).

**Checkpoint (conditional).** You are asked only if one of these holds:
- Open Questions exist.
- Something is irreversible.
- The story says `checkpoint: spec`.
- The work is ad-hoc and full route.

All questions come at once, numbered, with options; each answer goes into the frozen block as a decision. You then pick: approve and continue, approve and stop, or review first. With no trigger, only the plan stub was approved during planning: the spec goes to `status: ready` unasked, and every frozen line the orchestrator wrote beyond the stub, the SPEC, an AD or a human answer ends with `[ASSUMPTION]`. Reviewers may challenge those lines; a real finding against one is corrected by the orchestrator (`amend`), not escalated ([Review and Triage](Review-and-Triage.md)).

**Freeze.** `freeze --story <id> --via checkpoint|plan` (`--file <spec>` for ad-hoc) hashes the frozen block and the contract fields (`caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests`, `approved_via`) and records whether a human saw the block; run it again after any renegotiation ([Frozen Intent and Guards](Frozen-Intent-and-Guards.md)).

**Tests first (only when `security: true` or a step is irreversible, on either route).** A `test` worker writes failing tests for every Acceptance line and Matrix row. The orchestrator checks that each asserts behavior and fails for the right reason, then runs `freeze --story <id> --tests <f1,f2>`. Skipped if behavior can't be tested deterministically (reason in Implementation Notes). In every other story there are no frozen tests: the implementer writes the tests with the code, one per Acceptance line and Matrix row. Either way each test names its criterion as `<story id> AC-n` (in its name or a comment), and `check --story` warns `story/ac-untested` for a criterion no changed test names.

## 3. Implement

1. Record `baseline_commit` (HEAD, or `NO_VCS`); set `status: in-progress` and `metrics.started`.
2. **Full route:** a fresh-context `implement` worker gets the spec path and a fixed prompt, nothing else; it never edits the frozen tests. **Small route:** the orchestrator implements. With no `frozen_tests` it writes the tests with the code. A failed worker is re-run once a tier up.
3. The orchestrator reads the diff since `baseline_commit`, not the worker's report.
4. **Matrix audit:** every Matrix row needs a test that ran and passed. A skipped test counts as missing. If code and matrix disagree, the code changes.
5. Run the Verification commands.
6. Run `node _lean/bin/lean.js check --story <id>`:

| Finding | Response |
|---|---|
| `story/frozen-changed` | Restore the block from git. Never re-freeze to pass. |
| `story/frozen-test-changed` | A frozen test was edited. The implementer may not do that. |
| `diff/trespass` (lane stories) | Revert before review. |

If the implementer reports a frozen test is wrong, the orchestrator judges it. A test that contradicts the spec is a `test` worker defect: `freeze --unlock-tests`, fix, freeze again, log it in the Spec Change Log. A correct test means the code is wrong.

`check --story` needs an id from `stories.yaml`, so ad-hoc specs can't use it; they rely on the guard hook and the diff read.

## 4. Review and loopbacks

**The feature is reviewed once, not every story, unless the unreviewed diff grows too big.** `check --story` prints the *review window*: the diff since the `baseline_commit` of the first story built after the last feature review (the epic's first story when there is none), and its size in changed lines. A feature review is due:

- at the *final* story: ad-hoc work, or no other story of its epic still open (`todo`, `draft`, `ready`, `in-progress`, `blocked`); a feature story is always final;
- at an earlier story, once the window passes `review.max_diff_lines` (default 1,500 changed lines; `0` reviews every story), because a reviewer cannot hold an unbounded diff.

When it is due, the story gets `review: feature` and the review covers the window's diff. Otherwise an earlier story gets only the security lens (`review: security`), and only if it has `security: true` or crosses a trust boundary; or nothing (`review: deferred`), with one Review Triage Log line, `Deferred to <final story id>`. `check --story` warns `story/review-due` when a due review was skipped, and `lean-loop` parks that story.

On a feature review the lenses are adversarial, verification-gap if behavior changed, edge-case only if some story in the window ran the full route, and security if any story in the window has `security: true` or the diff crosses a trust boundary. Each reviewer also gets the paths of the recorded decisions (the SPEC's Assumptions and Decision Log, the epic's and stories' decisions) and is told they are settled.

Context-free `review` workers launch together. The orchestrator triages every finding itself, one Review Triage Log row each ([Review and Triage](Review-and-Triage.md)).

| Route | Action | Loop? |
|---|---|---|
| `intent_gap` | Revert code, ask you, update the frozen block, back to step 2. | yes |
| `bad_spec` | Write KEEP notes, revert, amend non-frozen sections, log it, back to step 3. The first one re-runs the implementer a tier up. | yes |
| `amend` | Log it, amend Tasks, Matrix or Code Map, then patch. New acceptance tests go through the `test` worker and a re-freeze. | no |
| `patch` | One message to the implementer, one line per fix. | no |
| `defer` | Append to `deferred.md`. | no |

Routes run highest first; patches wait until no loopback is pending. `review_loops` is incremented before each loopback; past 3 the skill stops and asks you. On the small route, `intent_gap` or `bad_spec` stops and asks, and `amend` switches to `route: full`.

## 5. Finish

1. Write `## How to review`: at most 5 bullets on where the logic lives, what's risky, how to try it by hand.
2. Fill `metrics:` and set `status: done`. After an epic's last story, `Next:` points to `lean-plan status` and `lean-change retro`.
3. Release the claim, if any.
4. If the tree is dirty, commit locally with a conventional message.
5. Report in the kiss shape: one line, then rows for review, verify, commit, workers, and `Next:`.

```yaml
metrics:   # illustrative; null = the harness did not report it, never estimated
  models: { orchestrator: opus, scout: haiku, test: sonnet, implement: sonnet, review: sonnet }
  escalations: 0
  worker_tokens: 48210
  orchestrator_tokens: null   # plus started / finished (ISO times)
```

`lean-method metrics` aggregates them ([CLI Plan Tooling](CLI-Plan-Tooling.md)).

## Status and resuming

```
todo ─▶ draft ─▶ ready ─▶ in-progress ─▶ in-review ─▶ done
                            ▲                │
                            └── loopback ────┘     any HALT in --auto ─▶ blocked
```

A `bad_spec` loopback re-enters step 3; an `intent_gap` loopback re-enters step 2.

| `status` | Meaning | Resumes at |
|---|---|---|
| `todo` | stub from `lean-plan` | step 2 |
| `draft` | spec in progress; stays while Open Questions remain | step 2 |
| `ready` | intent approved and frozen | step 3 |
| `in-progress` | implementing | step 3 |
| `in-review` | reviewing | step 4 |
| `blocked` | waiting on a human | shows `blocked_reason`, asks |
| `done` | finished | context for new work |

Status lives only in the story frontmatter ([Artifacts and Layout](Artifacts-and-Layout.md)).

## Modes and flags

| Mode | Effect |
|---|---|
| `--auto` | Unattended run (below). |
| `checkpoint: spec` (story field) | Forces the spec checkpoint. |
| `security: true` (spec field) | Adds the security lens. |
| `next --lane <id>` | "Next story" within one lane. |
| `claim --story <id> --owner <name>` | Atomic lock on a planned story (a git ref). Exit 1 means taken, so pick another. `--release` at finish. |
| `freeze --story <id>` or `--file <spec>` | Hash the frozen block. `--tests a,b` locks tests; `--unlock`, `--unlock-tests` reopen. |

## `--auto`

- Never waits for a human; the interactive sanity gates don't run.
- Always claims a planned story first, under the owner it was given if any ([`lean-loop`](lean-loop.md) claims first and passes its own name; claiming again as the same owner is a no-op). With no story given, it takes the next one whose `depends_on` are all `done`.
- Anything that would wait for you instead writes the question into the story, sets `status: blocked` with `blocked_reason`, releases the claim, reports and stops. Examples: an intent gap, an ambiguous matrix row, a contract-change request, `review_loops` past 3. `lean-method next` lists blocked stories.

## Human-owned

- The frozen block: only you renegotiate it.
- Checkpoint answers, and splitting or keeping an oversize spec.
- Unblocking `blocked` stories; escalations past 3 loops.
- Pushing to a remote, and merging lane branches.

## Variants

- **Lane stories** also read `CONTRACTS.md` and never edit contracts, fakes or fixtures ([Parallel Teams](Parallel-Teams.md)).
- **No subagents:** the orchestrator implements itself and writes review prompts to `plan/adhoc/review-prompts/` for you to run elsewhere.

## See also

- [lean-plan](lean-plan.md): writes the story stubs build grows.
- [lean-loop](lean-loop.md): runs `--auto` builds back to back and re-checks each story.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): freeze hashes, frozen tests, guard hook.
- [Review and Triage](Review-and-Triage.md): lenses, verdicts, routes.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): roles, tiers, escalation.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `check`, `next`, `freeze`, `claim`, `metrics`.
