# BMAD vs LEAN — comparison protocol

The question: **does LEAN deliver the same quality as BMAD for less cost and less of your time?** `lean-method metrics` measures LEAN on its own; this protocol gives it a baseline. One run proves little. Treat the first one as a calibration, and repeat it on two or three features before drawing conclusions.

## 1. Pick the feature

- Real, small, and new to both runs: 3–6 stories' worth, one epic, single lane. Something you'd actually ship.
- It has a clear, testable outcome you can check yourself at the end (a demo script or an e2e test you write **before** either run, and show to neither).
- Not a feature either method has already touched. Not one where you already know the design: you'd steer one run with knowledge from the other.

## 2. Fix everything except the method

| Hold constant | How |
|---|---|
| Starting code | Same commit. Two branches: `cmp/bmad`, `cmp/lean`. Use separate worktrees, never one after the other on the same branch. |
| Input | The same source document in `docs/` for both: a one-page brief you write once. |
| Model | Same session model for both orchestrators (e.g. Opus). Record any worker tiers LEAN used. Run LEAN once with `review: top` too if you want the reviewer-tier answer. |
| Your answers | Answer the same questions the same way. Keep a short log of every question each method asked you and how long you spent. |
| Order | Alternate which method goes first across features: the second run benefits from your having thought about the problem. |

## 3. Run

- **BMAD:** product-brief or spec → (architecture if needed) → create-epics-and-stories → sprint-planning → build per story → code-review → retrospective.
- **LEAN:** lean-intent → (lean-architecture if needed) → lean-plan → lean-build per story → lean-change retro.
- Don't intervene beyond answering what each method asks. If a run gets stuck, note where, unblock it the minimum amount, and count it as an intervention.

## 4. Record

| Measure | BMAD source | LEAN source |
|---|---|---|
| Tokens (orchestrator + workers) | harness usage per session (`/cost` or the provider console) | same, plus `metrics --json` → `worker_tokens` |
| Wall-clock time to done | timestamps of the first and last commit | same, plus `metrics` → `median_minutes` |
| **Your time** | your log: minutes spent answering, reviewing, unblocking | same |
| Interruptions | number of times you were asked something | same |
| Review findings: real vs false | count from BMAD's review output after you verify a sample | `metrics` → findings by verdict, false rate per lens |
| Loopbacks / rework | stories re-implemented | `metrics` → review loops, bad_spec / amend routes |
| **Defects that escaped** | run your hidden e2e test / demo script; then a week of real use: count bugs traced to this feature | same |
| Code size and complexity | `git diff --stat` from the base; new dependencies | same |
| Planning-doc size | words in brief + PRD + architecture + epics + stories | words in SPEC + ARCHITECTURE + epic folder |

Escaped defects and your time are the two that matter most; everything else explains them.

## 5. Read the result

- LEAN is **better** only if escaped defects are no higher **and** your time or the token cost is clearly lower. Fewer tokens with more escaped bugs is a loss.
- Look at *where* the difference comes from: planning (doc size, questions asked), build (loops, escalations), or review (false-finding rate, real findings per story). That points to which LEAN change earned its keep and which to revert.
- Write the result as a short `retro.md`-style note in this repo, with the numbers, and decide one change to make before the next run.
