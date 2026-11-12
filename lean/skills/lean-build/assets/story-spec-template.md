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
context: []            # project docs the implementer must read (SPEC.md, ARCHITECTURE.md, UX.md …) — only what applies
---

<!-- Length cap: lean-kit/kiss.md §B (kiss: ≤ 1,000 tokens). Bullets and tables only. Boundaries and examples beat step-by-step "how". Delete every comment and every section that doesn't apply (never write "N/A"). A small-route spec keeps only Intent and Implementation Notes. -->

<frozen-after-approval reason="human-owned intent — change only when the human renegotiates">

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

## Implementation Notes

<!-- Append-only during implementation: decisions, surprises. -->

## Spec Change Log

<!-- Append-only, written on bad_spec loopbacks: triggering finding, what was amended, the bad state avoided, KEEP instructions. -->

## Review Triage Log

<!-- One row per reviewer finding: verdict — evidence — route. -->
