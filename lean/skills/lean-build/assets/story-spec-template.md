---
id: ''                 # story id (E2-3) — kept from the lean-plan stub; '' for ad-hoc work
title: '{title}'
epic: ''               # kept from the stub
lane: ''               # kept from the stub
caps: []               # kept from the stub
rules: []              # kept from the stub
seams: []              # kept from the stub
checkpoint: none       # kept from the stub
status: draft          # todo | draft | ready | in-progress | in-review | done | blocked | retired — the story's only status
blocked_reason: ''
route: ''              # small | full
baseline_commit: ''    # set before the first code change; never overwritten
review_loops: 0
frozen_sha256: ''      # written by `lean-method freeze` when intent is approved; `check` fails if the frozen block changes
contract_sha256: ''    # written by `lean-method freeze`: hash of caps, rules, seams, checkpoint, security, frozen_tests, approved_via
approved_via: ''       # written by `freeze --via`: checkpoint (a human saw the frozen block) | plan (only the plan stub was approved)
frozen_tests: []       # written by `lean-method freeze --tests` (security or irreversible): acceptance tests the implementer may not edit
security: false        # true when the change touches a trust boundary — adds the security lens to review
context: []            # project docs the implementer must read (SPEC.md, ARCHITECTURE.md, UX.md …) — only what applies
metrics:               # filled at finish; aggregated by `lean-method metrics`. null = the harness didn't report it — never estimate
  models: { orchestrator: '', scout: '', test: '', implement: '', review: '' }   # model each role actually ran on (after escalations)
  escalations: 0
  worker_tokens: null        # sum of the token counts the harness reported for this story's workers
  orchestrator_tokens: null  # only if the harness reports the session's own usage
  started: ''                # ISO time status went in-progress
  finished: ''               # ISO time status went done
---

<!-- Length cap: lean-kit/kiss.md §B (kiss: ≤ 1,000 tokens). Bullets and tables only. Boundaries and examples beat step-by-step "how". Delete every comment and every section that doesn't apply (never write "N/A"). A small-route spec keeps only Intent and Implementation Notes. -->

<frozen-after-approval reason="human-owned intent — change only when the human renegotiates">

<!-- A line that says more than the story's Acceptance, the SPEC, an AD or a human answer ends with [ASSUMPTION]. Without a checkpoint no human sees it, so reviewers may challenge it. -->

## Intent

**Problem:** {one or two sentences}

**Approach:** {one or two sentences — the simplest what that passes acceptance, not the how}

**Acceptance:**
<!-- Copied from the story in stories.yaml, then sharpened. Given/When/Then. -->
- Given …, when …, then …

## Boundaries

**Always:** {invariants, including the AD rules this story must honor} · KISS (lean-kit/kiss.md §A): reuse before adding; no speculative abstraction, config, or dependency

**Never:** {non-goals and forbidden approaches}

## Edge-Case Matrix

| Scenario | Input / state | Expected behavior |
|---|---|---|
| | | |

</frozen-after-approval>

## Open Questions

<!-- Only intent gaps the user would notice in the result. Each: the choice, the options, what each means. Spec can't leave draft while any remain. -->

## Code Map

- `path` — role / what to reuse / what not to touch

## Tasks

- [ ] `path` — action — why

## Verification

- `command` — expected result

## How to review

<!-- Written at finish, for the human: ≤ 5 bullets — where the real logic lives, what's risky, how to try it by hand. -->

## Implementation Notes

<!-- Append-only during implementation: decisions, surprises. -->

## Spec Change Log

<!-- Append-only, written on bad_spec loopbacks and amends: triggering finding, what was amended, the bad state avoided, KEEP instructions. -->

## Review Triage Log

<!-- One row per reviewer finding — never drop or merge rows. `lean-method metrics` counts these rows, so keep the vocabulary exact.
     lens: adversarial | edge-case | verification-gap | security · verdict: high | medium | low | false | maybe-false · route: patch | amend | bad_spec | intent_gap | defer | reject -->

| # | lens | verdict | route | evidence |
|---|---|---|---|---|
