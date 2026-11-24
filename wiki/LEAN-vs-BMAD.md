**LEAN is BMAD v6.12.4 with the overhead removed: same backbone, 8 skills instead of 29, 5x to 9x fewer instruction words depending on how you count.** This is the only page that assumes you know BMAD.

## Why LEAN exists

BMAD is a useful method. It separates *what* (spec) from *how* (architecture) from *doing* (build), hands work between sessions through files, and reviews adversarially. LEAN keeps that backbone.

LEAN removes noise: instruction text the agent reads on every run that does not move the work forward. The largest sources were activation boilerplate, requirements copied between documents, finalize ceremonies, step menus and a sprint script.

## Mapping

| BMAD skill(s) | LEAN | What changed |
|---|---|---|
| product-brief, prd, spec, prfaq, forge-idea, ux | `lean-intent` | One output: `SPEC.md` (optional `UX.md`). Fast path by default; one optional pressure-test round replaces PRFAQ/forge. |
| architecture | `lean-architecture` | Spine concept kept. Finalize ceremony becomes one independent review. |
| create-epics-and-stories, sprint-planning | `lean-plan` | Stories reference CAP/AD ids. Epic tree, one file per story, just-in-time stories, status in the story file. Adds lanes and contracts. |
| build, build-auto | `lean-build` | Kept nearly whole. Acceptance seeds the spec. Spec checkpoint only when the story asks. `--auto` replaces build-auto. |
| review, code-review, build review prompts | `lean-review` | One copy of each lens and of the triage rules, shared with build. |
| correct-course, retrospective | `lean-change` | Two modes (`course`, `retro`), one short skill. |
| help | `lean-help` | Routes, orients, explains from a bundled guide. |
| customize | `lean-kit` | Config view, overrides in `_lean/custom/`, shared rules. |
| project-context | `lean-change` retro | At most 3 evidence-backed pitfalls per retro for `AGENTS.md`/`CLAUDE.md`. |
| walkthrough | `lean-build` | A `## How to review` note (5 bullets max) in the story file. |
| qa-generate-e2e-tests | `lean-build` | A `test` worker writes acceptance tests first; they are frozen. |
| 5 personas, party-mode, advanced-elicitation, brainstorming, deep-recon | none | Dropped. |

## What was cut, and why

| Cut | Why | Instead |
|---|---|---|
| Activation boilerplate (config resolver, `customize.toml` merge, hooks; in 26 of 29 skills) | Tokens and latency on every run | Plain conventions for language and paths |
| Personas | No process; only routing | Nothing |
| Repeated requirement extraction (epics file, epic context, each build spec) | Same text copied three times | Ids by reference; a story copies only its own acceptance |
| Finalize ceremony (memlog audit, reconciliation subagents, reviewer gate, polish, HTML reports) | Cost out of proportion to the document | One self-check plus one independent reviewer |
| "[C] to continue" menus, per-story approvals | Stop-and-approve moments | Batch review per epic |
| Sprint script and `sprint-status.yaml` | One shared file; the README reports merge conflicts in parallel work | Each story's `status` |
| Ideation zoo | Out of scope | External brainstorming, fed to `lean-intent` |

## Kept deliberately

1. Intent is elicited from the human; every inference is tagged `[ASSUMPTION]`.
2. Architecture records invariants only (Binds / Prevents / Rule).
3. Small single-goal build specs with frozen, human-owned intent and an Open Questions gate. See [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).
4. Implementation by a fresh subagent with the spec as sole source of truth.
5. Three blind parallel reviewers (plus a security lens at trust boundaries) and verify-then-route triage with loopback. See [Review and Triage](Review-and-Triage.md).
6. Readiness check before building; deferred-work log; a path for mid-flight change.
7. Acceptance tests written first by a separate worker, frozen and enforced (0.6.0).
8. An epic is accepted only on recorded exit evidence: an e2e test or a demo you watched (0.6.0).

## Measured size

Words from `wc -w` over every file in the skill directories. LEAN is `lean/skills/`. BMAD is `.claude/skills/bmad-*` (identical to `.agents/skills`) from baseline commit `b6cf242` (read from git history; the working tree may not contain it).

```bash
find lean/skills -type f | xargs cat | wc -w                                    # 22717
mkdir /tmp/bmad && git archive b6cf242 .claude/skills | tar -x -C /tmp/bmad
find /tmp/bmad/.claude/skills -type f | xargs cat | wc -w                       # 197753
```

| Measure | BMAD | LEAN | LEAN share |
|---|---|---|---|
| Skills / files | 29 / 214 | 8 / 26 | - |
| Words, all files | 197,753 | 22,717 | 11.5% (8.7x smaller) |
| Words, excluding `tests/` dirs | 180,834 | 22,717 | 12.6% (8.0x) |
| Words, markdown only | 112,281 | 22,466 | 20.0% (5.0x) |

Markdown only is the conservative figure: BMAD's Python, HTML and CSV inflate the others. Words are not tokens, and a run loads one skill plus the shared kit files, not everything installed.

| LEAN skill | BMAD words | LEAN words |
|---|---|---|
| `lean-intent` | 34,465 | 1,787 |
| `lean-architecture` | 6,974 | 1,318 |
| `lean-plan` | 13,181 | 3,073 |
| `lean-build` | 22,940 | 3,669 |
| `lean-review` | 14,947 | 5,546 |
| `lean-change` | 24,230 | 1,353 |
| `lean-help` | 726 | 3,132 |
| `lean-kit` | 2,290 | 2,839 |
| folded into build/change | 9,242 | included above |
| dropped | 68,758 | 0 |

`lean-help` and `lean-kit` grew: help bundles a 1,888-word guide, and kit holds the orchestration and KISS rules that replace per-skill boilerplate.

The user guide's "19k words instead of 180k" was true at 0.4.0 (19,055 vs 180,834). LEAN grew about 19% by 0.7.0 as enforcement was added.

## Risks being watched

| Risk | What to watch |
|---|---|
| Batch story approval lets drift through | Defects traced to bad stories; readiness check is the mitigation |
| Cheaper reviewers miss real bugs (BMAD required session-level reviewers) | Defects found per story at `review: mid` vs `review: top` |
| KISS caps squeeze out a load-bearing detail | `intent_gap` loopbacks traced to a spec at its cap |
| Spec checkpoint skipped by default | `intent_gap` loopbacks during build |
| Decision Log in the doc instead of a memlog | Whether interrupted runs resume cleanly |

Reviewer-tier and loopback risks show in `node _lean/bin/lean.js metrics --json`; the rest need judgment in the retro.

## Comparison protocol

Question: does LEAN match BMAD's quality for less cost and less of your time? One run is calibration; repeat on two or three features. The first full run of this protocol, on three features, is reported in [Experiment Results](Experiment-Results.md).

1. **Pick the feature.** Real, small, new to both runs: 3-6 stories, one epic, one lane. Write a hidden e2e test or demo script first and show it to neither run.
2. **Hold constant.**
   - Same starting commit, in two worktrees (`cmp/bmad`, `cmp/lean`).
   - Same one-page brief in `docs/`.
   - Same session model for both orchestrators. Record LEAN's worker tiers; optionally rerun with `review: top`.
   - Same answers to the same questions; log each question and your time.
   - Alternate which method goes first.
3. **Run.**
   - BMAD: product-brief or spec, architecture if needed, create-epics-and-stories, sprint-planning, build per story, code-review, retrospective.
   - LEAN: `lean-intent`, `lean-architecture` if needed, `lean-plan`, `lean-build` per story, `lean-change` retro.
   - Answer what each asks, nothing more. Count every unblock as an intervention.
4. **Record.** Tokens (LEAN: `metrics --json` `worker_tokens`), wall-clock (`median_minutes`), your time, interruptions, real vs false findings, loopbacks, escaped defects, code size, planning-doc size.
5. **Read the result.** LEAN wins only if escaped defects are no higher and your time or token cost is clearly lower. Fewer tokens with more escaped bugs is a loss. Find whether the difference comes from planning, build or review. Note the numbers and pick one change for the next run.

## See also

- [Experiment Results](Experiment-Results.md): what running this protocol found
- [The LEAN Process](The-LEAN-Process.md): the flow that replaces BMAD's phases
- [Review and Triage](Review-and-Triage.md): the review model LEAN kept and tightened
- [CLI: Plan Tooling](CLI-Plan-Tooling.md): `metrics` and the other commands the protocol reads
- [Development](Development.md): repo layout, and how to recover the BMAD baseline from history
