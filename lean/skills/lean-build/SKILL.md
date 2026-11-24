---
name: lean-build
description: 'Turn a story, feature, bug fix, or meaningful change into working code — planned, implemented by a fresh subagent, reviewed by independent reviewers, and verified. Use when the user delegates implementation work, names a story id, or says "build", "implement", or "next story". Supports --auto for unattended runs. Skip trivial mechanical edits (typos, formatting, ignore files).'
---

# Lean Build

Intent → small frozen spec → implementation → independent review → route problems back to where they came from. The spec is the single source of truth: the implementer works only from it, and the reviewers judge the code against it.

Speak the user's language. Never push to a remote. Never edit anything inside `<frozen-after-approval>` unless the human renegotiates.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*, and use its **Layout** for every path. You are the orchestrator.

**One file per story.** A planned story's `.md` file (written by `lean-plan`) *is* its build spec: you grow that same file into the full spec. Its frontmatter `status` is the story's only status: never write status into `stories.yaml`. The only time build touches `stories.yaml` is to add a story split off from this one.

| You (top tier) | Workers |
|---|---|
| route, spec, frozen intent, checkpoint | `scout`: code investigation |
| approve the acceptance tests | `test`: writes failing acceptance tests from the spec (only when `security: true` or a step is irreversible) |
| judge the diff against the spec | `implement`: writes the code from the spec |
| triage every review finding | `review`: the lenses (three, plus security when it applies) |
| everything said to the user (kiss shape) | |

**KISS is the default build posture:** the spec's Approach is the simplest one that passes acceptance (`kiss.md` §A), prefer the small route whenever it honestly applies, and treat over-engineering found in review as a defect.

**Cheap by default.** Three things cost most in a build: the orchestrator's session, one review per story, and tests written by a separate worker. So: (1) **the session model is the user's choice, and the mid tier is enough** for the small route and for a feature story (below); keep the top tier for `lean-intent`, `lean-plan`, and a `bad_spec` or `intent_gap` loopback; (2) **review once per feature**, not once per story, unless the unreviewed diff grows past `review.max_diff_lines` (step 4); (3) **frozen acceptance tests only where a mistake is expensive** — `security: true` or an irreversible step; elsewhere the implementer writes the tests with the code. None of this skips a check: acceptance and the Verification commands still run, frozen intent is still respected, and the review still happens.

Shared files from the sibling `lean-review` skill (install them together):
- `{skill-root}/../lean-review/triage.md`
- `{skill-root}/../lean-review/lenses/adversarial.md`, `edge-case-hunter.md`, `verification-gap.md`, `security.md`

**`--auto` mode** (unattended loop): never wait for a human. Wherever this file says HALT, instead write the question into the story file, set its `status: blocked` with `blocked_reason`, report it, and stop. With no story given, take the next story (below) whose `depends_on` are all `done`.

**Claim before you build** (planned stories, whenever more than one agent or person may be building at once — always in `--auto`): run `lean-method claim --story <id> --owner <your agent or user name>` before step 2. Exit 1 means someone else holds it: take the next story instead (`lean-method next` lists claimed stories separately). If you were told a claim owner (`lean-loop` claims first, under its own name), use exactly that name: claiming again as the same owner is a no-op. Release at step 5 (`claim --story <id> --release`), or when you hand the story back as `blocked`. In lane work, story status is authoritative on the **integration branch**; claims are git refs shared by every worktree of the clone, so they work across worktrees on one machine, not across machines.

## 1. Resolve

Work out what you're building, in this order:

1. **A story or spec file** → resume by its `status`: `todo` → step 2 (it's a stub from lean-plan); `draft` → step 2; `ready`/`in-progress` → step 3; `in-review` → step 4; `blocked` → show `blocked_reason` and ask; `done` → read it as context for new work.
2. **A story id** (`E2-3`) → the epic is the id's prefix. Look the id up in `plan/epics/<E>-*/stories.yaml` and open its `file`, then resume as above.
3. **"Next story"** → run `lean-method next` (add `--lane <id>` for a lane; CLI per `lean-kit/SKILL.md` → *CLI*) and take the first `next` line. Without the CLI: in `plan/epics.yaml`, take the `active` epics in order; in each one, walk `stories.yaml` top to bottom and pick the first story whose file says `todo` and whose `depends_on` are all `done` (in a multi-lane epic, nothing but `<E>-0` until it's done). For a lane, use that lane's stories only. Read frontmatters only, not whole files.
4. **Freeform intent** → spec file is `plan/adhoc/<slug>.md`. Don't ask the user to restate a request they already made.
5. **Nothing** → list in-flight story files in active epics and `plan/adhoc/` (status not `todo`/`done`), and the next story; ask which.

Treat the intent — however detailed — as input to investigate, not permission to skip planning.

**Sanity gates** (interactive only):
- Dirty working tree or a branch that obviously doesn't match the work → HALT and ask.
- More than one independently shippable goal in the request → list them, recommend which to do first, and ask: split (append the rest to the epic's `deferred.md`, or `plan/deferred.md` for ad-hoc work) or keep together.

## 2. Plan

**Context.** For a story, read:
- the story file;
- its epic's `EPIC.md` (goal, epic decisions);
- the SPEC capabilities in `caps`, and the ADs in `rules` (project ARCHITECTURE or EPIC.md);
- the relevant UX.md sections;
- the `Implementation Notes` / `Code Map` of the most recent `done` story in the same epic.

Don't load whole planning docs into the implementer's context; cite the files that apply in the spec's `context:` list. That can include a specific document from `docs/` (an API spec, a data dictionary) when the story depends on it. For ad-hoc work, skim `plan/` for anything relevant.

**Lane stories** (the epic's `stories.yaml` has `lanes:`). Also read the epic's CONTRACTS.md: the seams this story implements (`seams:`) and consumes, their value rules, and the fixtures. Add to the spec's Boundaries → **Always**:
- touch only this lane's modules (per CONTRACTS.md) plus its tests;
- **never** edit the contracts package, the shared fakes, or the fixtures. If the story can't be done without changing them, HALT with a contract-change request (what, why, which seams). In `--auto`: `blocked` with that request. The fix goes through `lean-change course` → an `<E>-C<n>` story;
- build against the other lanes' fakes; the contract tests of the seams in `seams:` must pass against the real implementation;
- the walking-skeleton test stays green after swapping in this story's real implementation.

Special stories:
- **`<E>-0`** implements the epic's CONTRACTS.md (types, fakes, fixtures + their schema check, contract tests, boundary test, skeleton). It's always full route with a spec checkpoint. Its "real implementations" are the fakes.
- **Checkpoint / integration stories** run the fixture through the real producer and real consumer. When they fail, the contract tests decide whose side is wrong. Fix that side if it's within this story's reach. Otherwise defer it to that lane's next story, with the failing test named. If the contract itself is ambiguous, raise a contract change.

**Investigate the code** — launch `scout` workers (in parallel when the questions are independent), each with one precise question, returning ≤ 15 bullets of `path:line — what's there — reuse / don't touch`. Open the cited spots yourself before you rely on them. Look specifically for **existing code to reuse** — KISS starts there. Don't ask the human anything a search, the planning docs, or git history can answer.

**Decide the route** by writing down three facts:
- **Intent gaps** — things the user would notice in the result that neither the request nor the code settles. (Choices the user wouldn't notice are yours — decide and record them.)
- **Irreversibles** — destructive or data-rewriting migrations, data deletion/mutation, external side effects, deploy/config triggers (`lean-kit/SKILL.md` → *Irreversible steps*). An additive migration (new tables, nullable columns or columns with a default, indexes) with a working downgrade is not one: test its downgrade like any other code.
- **Footprint** — files changed; new things other code will depend on.
- **Trust boundary** — does it touch auth, personal data, money, secrets, external input, files, shell, or query construction (or does the story's SPEC capability carry such a concern)? If yes, set `security: true`: the security lens joins the review.

**Growing the story file.** Keep its frontmatter (`id`, `epic`, `lane`, `caps`, `rules`, `seams`, `checkpoint`) and add the build fields from `assets/story-spec-template.md`. Its `## Acceptance` moves into the Intent's **Acceptance**, each criterion numbered (`- AC-1: Given …, when …, then …`) so tests can name it. Ad-hoc work starts a fresh file from the template.

**Mark what only you decided.** Anything you write into the frozen block that does not come from the story's own Acceptance, a SPEC capability or decision, an AD, or an answer the human gave ends with `[ASSUMPTION]`: typically a Never clause, an Always rule you inferred, or an Edge-Case Matrix row. Without a checkpoint no human sees these lines, so they are not settled: a reviewer may challenge them, and triage judges them on the merits (`triage.md` §1). This is for choices the user wouldn't notice; an intent gap is still an Open Question, never an assumption.

**Small route** — no gaps, nothing irreversible, and either a small footprint **or the story is a feature story** (the only story of its epic, which covers all of the epic's capabilities: `lean-plan` writes it for a feature-sized spec): the spec keeps only frontmatter, Intent (inside the frozen block), and Implementation Notes; `route: small`; skip to step 3 without a checkpoint. A feature story's spec may run to twice the cap in `kiss.md` §B (`lean-method check` applies the doubled cap to it).

**Full route** — otherwise fill the rest of `assets/story-spec-template.md`:
- Sharpen the story's acceptance criteria; don't re-derive the story from the spec.
- Put AD rules the story touches under Always; put the investigation into Code Map so the implementer needn't repeat it.
- Every intent gap becomes an Open Questions entry with options and consequences. Never bury a gap in the frozen block as an assumption.
- Self-check: every task has a path and action, tasks are in dependency order, acceptance is Given/When/Then, nothing is TBD. Fix what the repo can tell you; anything else is an open question.
- **KISS pass on your own spec:** Approach is the simplest that passes acceptance; tasks touch the fewest files; any new dependency, abstraction, or config option carries a one-line reason, otherwise delete it.
- Over the build-spec cap in `kiss.md` §B (`lean-method check --story <id>` measures it — a `story/size` warning) → propose a split, or keep the spec with the user's OK. A split of a planned story adds the new story to the epic's `stories.yaml` with the next free id and a stub file. A split of ad-hoc work sends the deferred goals to `deferred.md`.

**Checkpoint — only when needed.** Ask the human when any of these are true: Open Questions exist, something is irreversible, the story says `checkpoint: spec`, or the work is ad-hoc and full-route. Present every open question at once, numbered, with options; write each answer into the frozen block as a decision. Then show the spec path and offer: approve and continue / approve and stop here / let me review it first.

If none apply, the human approved only the plan stub (its Acceptance): set `status: ready` and continue. Everything else in the block is yours and carries `[ASSUMPTION]` where it says more than the stub.

**Freeze.** Whenever the frozen block is approved (at the checkpoint, at `status: ready` without one, and again after an intent_gap is renegotiated), run `lean-method freeze --story <id> --via <how>` (ad-hoc: `--file <spec>`): `--via checkpoint` when the human saw the block at the checkpoint, `--via plan` otherwise. It hashes the block **and the contract fields** (`caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests`, `approved_via`), so set those first. From then on `check` fails if anyone, the implementer included, edits frozen intent or a contract field (and the installed guard hook, on Claude Code and Codex, refuses the edit outright, as it refuses any rewrite of a `baseline_commit` already set). To renegotiate: `freeze --unlock`, edit with the human's agreement, freeze again. Never claim `--via checkpoint` for a block the human did not see.

**Acceptance tests first (only when `security: true` or a step is irreversible, on either route).** Otherwise skip this step: the implementer writes the tests with the code (step 3). Before any implementation, launch a `test` worker:

> Read {spec_file}. Write tests that encode its Acceptance criteria and every Edge-Case Matrix row, using the project's existing test setup and conventions. Tests only: no production code. Run them and confirm each fails for the expected reason (missing behavior, not a typo or import error). Do not invoke skills or spawn subagents. Name the criterion in each test as `{story_id} AC-n`, in the test's name or a comment. Report the test files and one line per test: which criterion or row it encodes.

Judge what it wrote: every criterion and matrix row has a test, each test asserts the behavior (not just "no error"), and each one fails for the right reason. Fix or re-run what doesn't hold. Then freeze them: `lean-method freeze --story <id> --tests <file1,file2>`. List the test files under Verification (small route: in Implementation Notes). The implementer makes them pass and may not edit them; `check --story` fails if it does. Skip this step when the behavior can't be tested deterministically (say why in Implementation Notes).

## 3. Implement

1. Record `baseline_commit` (current HEAD, or `NO_VCS`) in frontmatter unless already set. Set `status: in-progress` and `metrics.started` (ISO time) unless already set.
2. **Full route:** launch a fresh-context `implement` worker with exactly this prompt (paths filled in) and nothing else — the spec is the whole brief:

   > Read {spec_file} fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. Follow the engineering rules in {kiss_file} §A: the simplest code that passes the acceptance criteria, nothing speculative. The test files in its frontmatter `frozen_tests` are fixed: make them pass and never edit them; if you believe one is wrong, stop and report why instead of changing it. If the spec has no `frozen_tests`, write the tests yourself with the code: one for each Acceptance criterion and each Edge-Case Matrix row, in the project's test conventions, each asserting the behavior and naming its criterion as `{story_id} AC-n` (in the test's name or a comment); run them. Add decisions and surprises to its Implementation Notes. Do not invoke skills or spawn subagents. When done, report in ≤ 10 lines: what you changed, how you verified it, and anything left incomplete or risky.

   `{kiss_file}` = absolute path of `lean-kit/kiss.md`; `{story_id}` = the story id (`E2-3`; ad-hoc work: drop it and name just `AC-n`). Keep the worker addressable for review fixes. Without subagents, implement it yourself from the spec.

   If the worker reports it couldn't finish, or step 3 finds the work substantially incomplete, re-run it once at the next tier up (`orchestration.md` §4) from the same spec.

   **Small route:** implement directly; make the `frozen_tests` pass if there are any, otherwise write the tests for the Intent's Acceptance with the code (`kiss.md` §A.6), each naming its criterion (`{story_id} AC-n`). If you discover an intent gap, an irreversible step, or growing scope, stop, record why in Implementation Notes, switch to `route: full`, and return to step 2.
3. **Judge the diff, not the report.** Write the unified diff since `baseline_commit` (untracked files included) to a uniquely named file in the system temp dir and read it. Check every task and acceptance criterion; tick tasks `[x]`; finish anything missing.
4. **Matrix and acceptance audit.** Every numbered Acceptance criterion needs a test that names it: `check --story` (step 6) warns `story/ac-untested` for any that no changed test file names; add the test, or say in Implementation Notes why it can't be tested. If an Edge-Case Matrix exists, every row needs a test that ran and passed. A test that didn't run (skipped, filtered, unregistered) counts as missing. If a test disagrees with the matrix, fix the code — never the expectation; if the row itself is ambiguous, HALT. If the implementer reports a frozen test is wrong, judge it yourself: a test that contradicts the spec is a `test` worker defect (`freeze --unlock-tests`, fix the test, freeze again, log it in the Spec Change Log); a test that is right means the code is wrong.
5. Run the Verification commands. Lane stories also run the boundary test, the contract tests of their seams, and the walking skeleton.
6. **Mechanical gate:** run `lean-method check --story <id>`. A `story/frozen-changed` or `story/contract-changed` error means frozen intent or a contract field was edited: restore it from the approved version (git) — never re-freeze to make it pass. A `diff/trespass` error (lane stories: a change outside the lane's modules, or to the contracts, fakes, or fixtures) is reverted before review; it isn't negotiable inside a build. Also judge the diff yourself for trespass the lane map can't see (e.g. shared test helpers).

## 4. Review

**Review the feature once, not every story, unless the unreviewed diff grows too big for a reviewer to hold.** `lean-method check --story <id>` prints the **review window**: the diff since the `baseline_commit` of the first story built after the last feature review (the epic's first story when there is none), its size in changed lines, and whether a feature review is due. One is due:
- at the **final** story: ad-hoc work, or no other story of its epic is still `todo`, `draft`, `ready`, `in-progress` or `blocked` (a feature story is always final);
- at an earlier story, once the window passes `review.max_diff_lines` (config; default 1,500 changed lines, `0` reviews every story).

Without the CLI, work it out from the stories' `review:` and `baseline_commit` fields and `git diff --numstat`. Then record the decision in the frontmatter `review:` field:

- **Due** → `review: feature`; review the window's diff (ad-hoc: since this story's own `baseline_commit`). Continue below.
- **Not due** → no general review. If the story has `security: true` or its diff crosses a trust boundary, `review: security`: run only the `security` lens on its own diff and triage as below. Otherwise `review: deferred`, write `## Review Triage Log` with the single line `Deferred to {final story id}`, and go to step 5.

Set spec `status: in-review`. Write the diff file for the review scope above (untracked files included).

Launch all reviewers **at once**, as context-free `review` workers at that role's tier, and wait for all of them in this turn:

| Reviewer | Prompt | Feature review |
|---|---|---|
| adversarial | lens `adversarial.md` + diff path | ✓ |
| verification-gap | lens `verification-gap.md` + diff path | ✓ (if behavior changed) |
| edge-case | lens `edge-case-hunter.md` + diff path + spec path(s) as claims file (read last) | only if some story in the window ran the full route |
| security | lens `security.md` + diff path | if any story in the window has `security: true`, or the diff crosses a trust boundary |

Each prompt gives absolute paths (never pasted diff text) and the paths of the **settled decisions** (the SPEC's Assumptions and Decision Log, the epic's and the stories' decisions), and ends: *"Decisions listed in those files are settled: do not re-argue them as preferences. Lines tagged `[ASSUMPTION]` in a story file are not settled: you may challenge them. If any decision produces a concrete wrong result, report it as `decision-conflict:` with the input and the wrong output. Do not invoke skills or spawn subagents — you are the reviewer. Return your findings as text in your final message."* Without subagents: write each prompt with its files inlined into `plan/adhoc/review-prompts/`, HALT, and ask the user to run them in separate sessions and paste back the findings.

**Triage** every finding per `triage.md` **yourself** (never on a worker; reviewer tiers are cheap precisely because you verify) and log each as one row of the spec's Review Triage Log table (exact vocabulary: `triage.md` §1). On a feature review the table goes in the reviewing story's spec; for a finding in code that an earlier story wrote, put that story's id in the evidence. Then act on the routes, highest first:

- **intent_gap** (full route) → revert the code changes, HALT to resolve with the human, update the frozen block, back to step 2.
- **bad_spec** (full route; the approach was wrong) → write KEEP notes (what worked and must survive), revert the code changes, amend the non-frozen spec sections respecting every earlier Spec Change Log entry, append a change-log entry, back to step 3. On the **first** bad_spec loopback, re-run the `implement` worker one tier up: a wrong approach is the expensive failure, so don't repeat it at the same tier.
- **amend** (the spec missed something; the approach holds) → append a Spec Change Log entry, amend the non-frozen spec sections (Tasks, Edge-Case Matrix, Code Map), then handle the code change like a **patch** below. If the amendment adds acceptance tests, the `test` worker writes them and you re-freeze (step 2 → *Acceptance tests*). No revert. Doesn't count as a loopback. When the wrong line is an unseen `[ASSUMPTION]` of the frozen block (`approved_via: plan`), it was your mistake, not the human's: `freeze --unlock`, correct the line, log it in the Spec Change Log, freeze again with the same `--via`. A frozen line without the tag is the human's: a real finding against it is an **intent_gap**.
- On the small route, an intent_gap or bad_spec → HALT and ask (the small route has no spec to loop through); an amend → switch to `route: full` and record the amendment.
- Before any loopback (intent_gap, bad_spec), increment `review_loops`; past **3**, HALT and escalate to the human.
- **patch** (and amend fixes; only once no loopback is pending) → send the implementation subagent one message — *"Review found problems. Fix each with the smallest change that does the job; run only the tests covering files you edit. Reply with what you changed."* plus one line per fix (`file — what's wrong — what the fix must do`). Apply them yourself if it's gone (the implementer of an earlier story is never kept: a feature review's patches you apply yourself, or give to one fresh `implement` worker). Re-run Verification; if it fails and can't be fixed, HALT.
- **defer** → append to the epic's `deferred.md` (or `plan/deferred.md` for ad-hoc work) per `triage.md`.

## 5. Finish

1. Write `## How to review` in the story file (≤ 5 bullets, for the human): the 1–3 files where the real logic lives, what's risky or surprising, and how to try it by hand (a command, a URL, an input). It's the part of a walkthrough that matters; skip nothing to fit it, but don't pad it.
2. Fill the frontmatter `metrics:` block (`orchestration.md` §6): the model each role actually ran on, escalations, token counts the harness reported (else leave `null`), and `finished`. Set `status: done`. If this was the epic's last open story, say so in `Next:` and recommend `lean-plan status` (it closes the epic) and `lean-change retro`.
3. Release the claim, if you made one: `lean-method claim --story <id> --release`.
4. If git is available and the tree is dirty, commit locally with a conventional message from the spec title. Lane stories: remind the user (in `Next:`) to merge into the integration branch per the plan's cadence, and name any seam checkpoint this story just unblocked.
5. Report in the kiss shape, nothing more:

   ```
   **lean-build · done** — {story id}: {what changed, one line}
   | review | {N findings → x patched, y deferred, z rejected} or {deferred to the final story {id}} |
   | verify | {pass / what ran} |
   | commit | {hash} |
   | workers | {scout=… test=… implement=… review=…×3, escalations=n, tokens=… or "not reported"} |
   | review it | {the How-to-review bullets, ≤ 3 lines} |
   Next: {next story id/title} · PR · other change
   ```
