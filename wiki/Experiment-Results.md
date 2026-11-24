**LEAN 0.8.0 was tested against BMAD 6.12.4 on three features of one real project: the quality was the same, LEAN cost 1.65 to 2.85 times as much, and the pre-set rule gave "inconclusive". `lean-lite` (the cheap profile in LEAN 0.9.0) came out of that result and has been run once, for cost and time only. It is experimental and not yet tested for quality.**

The question was the one in [LEAN vs BMAD](LEAN-vs-BMAD.md): does LEAN match BMAD's quality for less cost and less of your time? This page reports the answer so far, how far it can be trusted, and what is still unknown.

## Where things stand

| Question | Answer so far | How firm |
|---|---|---|
| Is LEAN 0.8.0's output as good as BMAD's? | Yes, on every measure we had | Three features, one run each; the tests could not tell the two apart (ceiling effect) |
| Does LEAN 0.8.0 cost less? | No: 165%, 183% and 285% of BMAD's cost, and 125%, 133% and 273% of its time | Same limits |
| Does `lean-lite` cost less? | On one feature, yes: 77% of BMAD's cost and 27% of LEAN 0.8.0's; time 105% of BMAD's | One run, after the method was tuned on that very feature |
| Is `lean-lite`'s output as good? | **Not measured** | The hidden tests had been seen when `lean-lite` was written |

## What was compared

- **The project.** A real mid-sized Python service (a message board for coding agents; FastAPI and Postgres, about 4,900 lines of source and 7,800 of tests), halfway through its roadmap. Its requirements already existed in a PRD, so neither method started ahead. Its CI runs `ruff`, `mypy`, `pytest` and `pip-audit`.
- **The three features**, small to medium, each with a one-page brief:

| | Feature | Tests that decide |
|---|---|---|
| A | Topic subscriptions and a registry of who owns which paths | Hidden acceptance tests, 3 classes |
| B | Cancel or snooze a message (API only) | Same |
| C | A notification to an external service when a `blocker` message is stored | Same |

- **The two methods.** BMAD 6.12.4 on its shortest path for one feature (spec with a story breakdown, build per story, one code review, retrospective). LEAN 0.8.0 on its normal path (`lean-intent`, `lean-plan`, `lean-build` per story, `lean-change` retro). Models: Opus plans and judges, Sonnet builds. LEAN does that with its own tiers; BMAD has none, so its build and review sessions ran on Sonnet and its spec and retro on Opus. No unattended loops in either arm.
- **What was held constant.** Same starting commit and brief, separate worktrees, a pinned Claude Code version (mixed versions in A and in B's LEAN arm, one version throughout C), a fixed file of answers to the methods' questions. One rule in that file changed between B and C (answer with the agent's recommended option unless the brief contradicts it), so A and B are not strictly the same protocol as C.
- **Hidden tests.** Acceptance tests (the "oracle") were written before the runs by a separate session, kept outside the working trees and run only after each run finished.
- **A blind judge.** A model from a different vendor read the two diffs unlabelled, at least twice per feature with the positions swapped. Its bug claims were re-checked in the code. It does not decide anything.
- **Who ran it.** The method's author, with an AI assistant keeping the logs, re-running the checks on clean checkouts and verifying the judge. The author wrote LEAN, so read the result with that in mind.

## How it was decided

Thresholds were frozen before the first run.

| Measure | Rule for "LEAN holds" |
|---|---|
| Q1: oracle score (mean of the explicit, implicit and invariant classes) | LEAN at least BMAD minus 5 points |
| Q2: the `invariant` class (architecture rules) | LEAN at least BMAD |
| Q3: existing tests, `ruff`, `mypy`, `pip-audit` | green wherever BMAD is green; no new vulnerability |
| E1: cost in dollars, estimated from the token counts in the session logs at list prices (not an invoice) | LEAN at most 70% of BMAD |
| E2: your time: the sum, per session, of the time from your first message to the agent's last output; declared absences removed | LEAN at most 70% of BMAD |

*Quality ok* is Q1, Q2 and Q3 together. *Efficiency ok* is one of E1 and E2 at 70% or less and the other at 100% or less. **LEAN confirms** if quality and efficiency are both ok on at least two of the three features, **loses** if quality is not ok on at least two, and is **inconclusive** otherwise.

## Results for LEAN 0.8.0

| | A | B | C |
|---|---|---|---|
| Q1: oracle, BMAD / LEAN | 100.0 / 100.0 | 97.2 / 97.2 | 96.7 / 100.0 |
| Q2: `invariant` class, BMAD / LEAN | 6/6 / 6/6 | 6/6 / 6/6 | 5/5 / 5/5 |
| Q3: regression and gates | equal | equal | equal |
| E1: cost, BMAD / LEAN | $8.75 / $14.41 | $7.51 / $13.76 | $4.14 / $11.81 |
| E1: LEAN over BMAD | **165%** | **183%** | **285%** |
| E2: your time in minutes, BMAD / LEAN | 72.6 / 90.8 | 61.6 / 82.2 | 30.6 / 83.5 |
| E2: LEAN over BMAD | **125%** | **133%** | **273%** |
| Quality ok / efficiency ok | yes / no | yes / no | yes / no |
| Blind judge (does not decide) | LEAN, slightly | BMAD | LEAN |
| Real bugs the judge found, BMAD / LEAN | 1 / 0 | 2 / 2 | 3 / 3 |

Totals: cost $20.40 for BMAD and $39.98 for LEAN (196%); time 164.8 and 256.5 minutes (156%). In B and C, LEAN's time excludes one long absence each, declared by the operator (raw: 122.5 and 295.2 minutes); the verdict does not change either way.

**Verdict: inconclusive.** Quality was ok three times out of three, so LEAN did not lose; efficiency was ok zero times out of three, so it did not confirm.

## How to read it

1. **Quality cannot be told apart.** The oracle scored both methods between 96.7 and 100 on every feature, so it does not separate them. The one test that failed in C (BMAD) was an artifact of the test harness's logging, not a production defect. The judge's verdicts split (LEAN, BMAD, LEAN): LEAN was more robust on failure paths, BMAD simpler and easier to read.
2. **LEAN's overhead is fixed, so it weighs most on small features.** Cost went 165%, 183%, 285% as the features shrank. In C, BMAD took a short path (one build with no reviewers, one final review) while LEAN kept its per-story cycle: three stories, the full route with frozen tests for the two riskiest.
3. **Each method caught what the other missed.** BMAD's final review found a real defect in every feature (A: control characters accepted; B: a session summary that ignored snoozes; C: a dependency available only in development, which would stop production starting). LEAN had none of those in A and C, but in B its plan froze a wrong reading of the brief (its reviewer saw the problem and the finding was rejected on the strength of a frozen clause); in C it had defects of its own (a double notification with slow DNS, no log when a thread failed to start).
4. **Both methods' reports sometimes said `pip-audit` was clean when it was not.** The base had 16 and 15 known vulnerabilities, and neither method added any.

## Where LEAN's extra cost went

All of it is in the build and the review: outside them, the two methods cost the same.

| Dollars, A, B and C summed | BMAD | LEAN 0.8.0 |
|---|---|---|
| Intent or spec, plan, retro | 8.17 | 8.27 |
| Build and review | 12.23 | 31.70 |

- **The orchestrator session is about two thirds of LEAN's build cost** ($19.88 against $11.82 for all workers): on Opus, each build session rewrites and rereads its context (about $1.7 of cache per session) and triages every finding itself.
- **Review per story bought little here.** Across the three features the reviewers filed 166 findings, none of high severity; 73% were rejected and 23% led to a patch or an amendment. 57 were false.
- **Frozen tests bought little here.** LEAN's tests were 3 to 4 times longer, but line coverage of the new code was the same and the oracle saw no difference.
- **Time is mostly workers in sequence.** In a full-route LEAN story, 57% to 75% of the time was workers running one after another. A LEAN small-route story took about as long as the whole BMAD build in C (6.4 against 6.9 minutes).

## From the measurements to `lean-lite`

`lean-lite` is what LEAN looked like after asking which of those costs could go without removing a check. It is written down as the *cheap profile* in LEAN 0.9.0 ([The LEAN Process](The-LEAN-Process.md), [lean-kit](lean-kit.md)):

- a spec of at most three capabilities and nothing irreversible becomes **one epic and one feature story**, with no team question;
- the build and the retro run on a **mid-tier session** instead of the top tier;
- **tests are written with the code**; frozen tests and a separate `test` worker stay for `security: true` and irreversible steps;
- the feature is **reviewed once**, at its last story; earlier stories of a longer epic get only a security pass;
- reviewers are told which decisions are **already settled**, and triage rejects findings that only re-argue them;
- a one-story epic gets a **short retro**.

The changes were chosen after seeing the results on feature C, which is the main reason to be careful with the next section.

## The one test of `lean-lite`

Feature C, once, with the build and the retro on Sonnet.

| | BMAD | LEAN 0.8.0 | `lean-lite` |
|---|---|---|---|
| Cost | $4.14 | $11.81 | **$3.18** (77% of BMAD) |
| Your time | 30.6 min | 83.5 min | **32.1 min** (105% of BMAD) |
| Planning documents (words) | 1,192 | 6,648 | 2,764 |
| New code and tests (lines) | +139 / +348 | +163 / +1,313 | +129 / +629 |
| Hidden tests | 96.7 | 100.0 | 96.7 |

- **The efficiency rule is not met:** it needs the cost at 70% or less and the time at 100% or less. The run missed by about $0.28 and 1.5 minutes. About 9 of its 32 minutes were waiting for an answer in the retro, which counts in E2.
- **The one failing hidden test is a race in the test harness**, not a defect found in the code: it reads a result before the harness has computed it. On the `lean-lite` code it failed 3 times in 5 when run alone, and passed 6 times in 6 with a one-second wait; the same unmodified test passed 5 times in 5 on each of the other two.
- **The review log records a high-severity finding fixed before the commit:** an HTTP redirect that forwarded the token to the new address.

## What this does not show

- **Quality.** The hidden tests for C had been seen when `lean-lite` was written, so 96.7 says little. Nothing yet shows that `lean-lite` keeps LEAN's quality.
- **One run.** There is no measure of how much the same method varies on its own, and the arm order was not alternated: `lean-lite` ran after the other two.
- **Two changes at once.** The method changed and so did the model (build and retro on Sonnet, where 0.8.0's orchestrator ran on Opus). The run cannot say which change saved what.
- **A weaker review.** The edge-case lens does not run on a feature story. In the one run, three lenses were enough to find a real defect; whether the fourth would have found more is not known.
- **One feature size.** `lean-method check` still warns that a feature story's spec is over the 1,000-token cap; the skills tell the agent to accept the warning up to 2,000.
- **No judge.** The blind judge was not run on `lean-lite`.

Treat `lean-lite` as a hypothesis with one encouraging data point on cost. For features that are not small, or where a missed bug is expensive, use the full process until it has been tested.

## What would settle it

1. A **new feature with a new hidden test set**, written and frozen before any run, built by BMAD and by LEAN 0.9.0.
2. **Each arm run at least twice**, to get a noise band, with the **order alternated**.
3. A **modifiability test**: a small follow-up change made on each resulting codebase.
4. **One lever at a time** (the mid-tier session, the single review, tests without a frozen worker), to see which one earns its saving.

## Limits that apply to everything above

- One run per method and feature: the data guide the decision, they do not prove it.
- A single operator answered the methods' questions from a fixed file, and a single judge model read the code.
- The two methods did not always split the work the same way (BMAD built in 4, 2 and 1 units, LEAN in 4, 3 and 3), so the comparison is between whole methods.
- Claude Code versions differed between runs in A and in B; C used one version throughout.
- The full records (per-feature reports, session logs, the judge's readings) are kept outside this repository; this page summarises them.

## See also

- [LEAN vs BMAD](LEAN-vs-BMAD.md): how the two methods map to each other, and the protocol this experiment followed
- [The LEAN Process](The-LEAN-Process.md): the flow, including the cheap profile
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): why the session model matters for cost
- [Review and Triage](Review-and-Triage.md): the review model that was measured
