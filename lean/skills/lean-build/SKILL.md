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
| approve the acceptance tests | `test`: writes failing acceptance tests from the spec (full route) |
| judge the diff against the spec | `implement`: writes the code from the spec |
| triage every review finding | `review`: the lenses (three, plus security when it applies) |
| everything said to the user (kiss shape) | |

**KISS is the default build posture:** the spec's Approach is the simplest one that passes acceptance (`kiss.md` §A), prefer the small route whenever it honestly applies, and treat over-engineering found in review as a defect.

Shared files from the sibling `lean-review` skill (install them together):
- `{skill-root}/../lean-review/triage.md`
- `{skill-root}/../lean-review/lenses/adversarial.md`, `edge-case-hunter.md`, `verification-gap.md`, `security.md`

**`--auto` mode** (unattended loop): never wait for a human. Wherever this file says HALT, instead write the question into the story file, set its `status: blocked` with `blocked_reason`, report it, and stop. With no story given, take the next story (below) whose `depends_on` are all `done`.

**Claim before you build** (planned stories, whenever more than one agent or person may be building at once — always in `--auto`): run `lean-method claim --story <id> --owner <your agent or user name>` before step 2. Exit 1 means someone else holds it: take the next story instead (`lean-method next` lists claimed stories separately). Release at step 5 (`claim --story <id> --release`), or when you hand the story back as `blocked`. In lane work, story status is authoritative on the **integration branch**; claims are git refs shared by every worktree of the clone, so they work across worktrees on one machine, not across machines.

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
- **Irreversibles** — migrations, data deletion/mutation, external side effects, deploy/config triggers.
- **Footprint** — files changed; new things other code will depend on.
- **Trust boundary** — does it touch auth, personal data, money, secrets, external input, files, shell, or query construction (or does the story's SPEC capability carry such a concern)? If yes, set `security: true`: the security lens joins the review.

**Growing the story file.** Keep its frontmatter (`id`, `epic`, `lane`, `caps`, `rules`, `seams`, `checkpoint`) and add the build fields from `assets/story-spec-template.md`. Its `## Acceptance` moves into the Intent's **Acceptance**. Ad-hoc work starts a fresh file from the template.

**Small route** — no gaps, nothing irreversible, small footprint: the spec keeps only frontmatter, Intent (inside the frozen block), and Implementation Notes; `route: small`; skip to step 3 without a checkpoint.

**Full route** — otherwise fill the rest of `assets/story-spec-template.md`:
- Sharpen the story's acceptance criteria; don't re-derive the story from the spec.
- Put AD rules the story touches under Always; put the investigation into Code Map so the implementer needn't repeat it.
- Every intent gap becomes an Open Questions entry with options and consequences. Never bury a gap in the frozen block as an assumption.
- Self-check: every task has a path and action, tasks are in dependency order, acceptance is Given/When/Then, nothing is TBD. Fix what the repo can tell you; anything else is an open question.
- **KISS pass on your own spec:** Approach is the simplest that passes acceptance; tasks touch the fewest files; any new dependency, abstraction, or config option carries a one-line reason, otherwise delete it.
- Over the build-spec cap in `kiss.md` §B (`lean-method check --story <id>` measures it — a `story/size` warning) → propose a split, or keep the spec with the user's OK. A split of a planned story adds the new story to the epic's `stories.yaml` with the next free id and a stub file. A split of ad-hoc work sends the deferred goals to `deferred.md`.

**Checkpoint — only when needed.** Ask the human when any of these are true: Open Questions exist, something is irreversible, the story says `checkpoint: spec`, or the work is ad-hoc and full-route. Present every open question at once, numbered, with options; write each answer into the frozen block as a decision. Then show the spec path and offer: approve and continue / approve and stop here / let me review it first.

If none apply, the intent was already approved during planning: set `status: ready` and continue.

**Freeze.** Whenever the frozen block is approved (at the checkpoint, at `status: ready` without one, and again after an intent_gap is renegotiated), run `lean-method freeze --story <id>` (ad-hoc: `--file <spec>`). From then on `check` fails if anyone, the implementer included, edits frozen intent (and the installed Claude Code guard hook refuses the edit outright). To renegotiate: `freeze --unlock`, edit with the human's agreement, freeze again.

**Acceptance tests first (full route).** Before any implementation, launch a `test` worker:

> Read {spec_file}. Write tests that encode its Acceptance criteria and every Edge-Case Matrix row, using the project's existing test setup and conventions. Tests only: no production code. Run them and confirm each fails for the expected reason (missing behavior, not a typo or import error). Do not invoke skills or spawn subagents. Report the test files and one line per test: which criterion or row it encodes.

Judge what it wrote: every criterion and matrix row has a test, each test asserts the behavior (not just "no error"), and each one fails for the right reason. Fix or re-run what doesn't hold. Then freeze them: `lean-method freeze --story <id> --tests <file1,file2>`. List the test files under Verification. The implementer makes them pass and may not edit them; `check --story` fails if it does. Skip this step on the small route, or when the behavior can't be tested deterministically (say why in Implementation Notes).

## 3. Implement

1. Record `baseline_commit` (current HEAD, or `NO_VCS`) in frontmatter unless already set. Set `status: in-progress` and `metrics.started` (ISO time) unless already set.
2. **Full route:** launch a fresh-context `implement` worker with exactly this prompt (paths filled in) and nothing else — the spec is the whole brief:

   > Read {spec_file} fully and implement it — the spec is the sole source of truth. Load every file listed in its frontmatter `context:` before you start. Follow the engineering rules in {kiss_file} §A: the simplest code that passes the acceptance criteria, nothing speculative. The test files in its frontmatter `frozen_tests` are fixed: make them pass and never edit them; if you believe one is wrong, stop and report why instead of changing it. Add decisions and surprises to its Implementation Notes. Do not invoke skills or spawn subagents. When done, report in ≤ 10 lines: what you changed, how you verified it, and anything left incomplete or risky.

   `{kiss_file}` = absolute path of `lean-kit/kiss.md`. Keep the worker addressable for review fixes. Without subagents, implement it yourself from the spec.

   If the worker reports it couldn't finish, or step 3 finds the work substantially incomplete, re-run it once at the next tier up (`orchestration.md` §4) from the same spec.

   **Small route:** implement directly. If you discover an intent gap, an irreversible step, or growing scope, stop, record why in Implementation Notes, switch to `route: full`, and return to step 2.
3. **Judge the diff, not the report.** Write the unified diff since `baseline_commit` (untracked files included) to a uniquely named file in the system temp dir and read it. Check every task and acceptance criterion; tick tasks `[x]`; finish anything missing.
4. **Matrix audit.** If an Edge-Case Matrix exists, every row needs a test that ran and passed. A test that didn't run (skipped, filtered, unregistered) counts as missing. If a test disagrees with the matrix, fix the code — never the expectation; if the row itself is ambiguous, HALT. If the implementer reports a frozen test is wrong, judge it yourself: a test that contradicts the spec is a `test` worker defect (`freeze --unlock-tests`, fix the test, freeze again, log it in the Spec Change Log); a test that is right means the code is wrong.
5. Run the Verification commands. Lane stories also run the boundary test, the contract tests of their seams, and the walking skeleton.
6. **Mechanical gate:** run `lean-method check --story <id>`. A `story/frozen-changed` error means frozen intent was edited: restore the block from the approved version (git) — never re-freeze to make it pass. A `diff/trespass` error (lane stories: a change outside the lane's modules, or to the contracts, fakes, or fixtures) is reverted before review; it isn't negotiable inside a build. Also judge the diff yourself for trespass the lane map can't see (e.g. shared test helpers).

## 4. Review

Set spec `status: in-review`. Rewrite the diff file to the current tree.

Launch all reviewers **at once**, as context-free `review` workers at that role's tier, and wait for all of them in this turn:

| Reviewer | Prompt | Full route | Small route |
|---|---|---|---|
| adversarial | lens `adversarial.md` + diff path | ✓ | ✓ |
| edge-case | lens `edge-case-hunter.md` + diff path + spec path as claims file (read last) | ✓ | |
| verification-gap | lens `verification-gap.md` + diff path | ✓ | ✓ (if behavior changed) |
| security | lens `security.md` + diff path | if `security: true` or the diff crosses a trust boundary | same |

Each prompt gives absolute paths (never pasted diff text) and ends: *"Do not invoke skills or spawn subagents — you are the reviewer. Return your findings as text in your final message."* Without subagents: write each prompt with its files inlined into `plan/adhoc/review-prompts/`, HALT, and ask the user to run them in separate sessions and paste back the findings.

**Triage** every finding per `triage.md` **yourself** (never on a worker; reviewer tiers are cheap precisely because you verify) and log each as one row of the spec's Review Triage Log table (exact vocabulary: `triage.md` §1). Then act on the routes, highest first:

- **intent_gap** (full route) → revert the code changes, HALT to resolve with the human, update the frozen block, back to step 2.
- **bad_spec** (full route; the approach was wrong) → write KEEP notes (what worked and must survive), revert the code changes, amend the non-frozen spec sections respecting every earlier Spec Change Log entry, append a change-log entry, back to step 3. On the **first** bad_spec loopback, re-run the `implement` worker one tier up: a wrong approach is the expensive failure, so don't repeat it at the same tier.
- **amend** (the spec missed something; the approach holds) → append a Spec Change Log entry, amend the non-frozen spec sections (Tasks, Edge-Case Matrix, Code Map), then handle the code change like a **patch** below. If the amendment adds acceptance tests, the `test` worker writes them and you re-freeze (step 2 → *Acceptance tests*). No revert. Doesn't count as a loopback.
- On the small route, an intent_gap or bad_spec → HALT and ask (the small route has no spec to loop through); an amend → switch to `route: full` and record the amendment.
- Before any loopback (intent_gap, bad_spec), increment `review_loops`; past **3**, HALT and escalate to the human.
- **patch** (and amend fixes; only once no loopback is pending) → send the implementation subagent one message — *"Review found problems. Fix each with the smallest change that does the job; run only the tests covering files you edit. Reply with what you changed."* plus one line per fix (`file — what's wrong — what the fix must do`). Apply them yourself if it's gone. Re-run Verification; if it fails and can't be fixed, HALT.
- **defer** → append to the epic's `deferred.md` (or `plan/deferred.md` for ad-hoc work) per `triage.md`.

## 5. Finish

1. Write `## How to review` in the story file (≤ 5 bullets, for the human): the 1–3 files where the real logic lives, what's risky or surprising, and how to try it by hand (a command, a URL, an input). It's the part of a walkthrough that matters; skip nothing to fit it, but don't pad it.
2. Fill the frontmatter `metrics:` block (`orchestration.md` §6): the model each role actually ran on, escalations, token counts the harness reported (else leave `null`), and `finished`. Set `status: done`. If this was the epic's last open story, say so in `Next:` and recommend `lean-plan status` (it closes the epic) and `lean-change retro`.
3. Release the claim, if you made one: `lean-method claim --story <id> --release`.
4. If git is available and the tree is dirty, commit locally with a conventional message from the spec title. Lane stories: remind the user (in `Next:`) to merge into the integration branch per the plan's cadence, and name any seam checkpoint this story just unblocked.
5. Report in the kiss shape, nothing more:

   ```
   **lean-build · done** — {story id}: {what changed, one line}
   | review | {N findings → x patched, y deferred, z rejected} |
   | verify | {pass / what ran} |
   | commit | {hash} |
   | workers | {scout=… test=… implement=… review=…×3, escalations=n, tokens=… or "not reported"} |
   | review it | {the How-to-review bullets, ≤ 3 lines} |
   Next: {next story id/title} · PR · other change
   ```
