---
name: lean-loop
description: 'Build several planned stories back to back, unattended: pick the next ready story, claim it, build it with lean-build --auto, and accept it only if LEAN''s static checks pass (status, frozen intent and tests, lane trespass, review log, verification commands, clean commit). Stops at a blocked story, a story cap, or the end of the epic. Use when the user says "run the epic", "lean loop", "build the next N stories", "work through the stories", or "run unattended". Not for a single story or ad-hoc work: use lean-build.'
---

# Lean Loop

Pick → claim → build → **verify statically** → next. The work is `lean-build --auto`. What makes the loop safe is that **a story counts as done only when scripts say so**: the build's own report is never evidence.

Speak the user's language. Never push to a remote. You write nothing of your own: story files, commits and claims are the only state, so a stopped run resumes by running again.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*, and use its **Layout**. You spawn no workers (`lean-build` does). Report in the kiss shape.

**Controller rule.** Every decision below comes from an exit code, a `--json` field, or a status read from a file. If none exists for something you must decide, stop and park the story. Never judge, never "probably fine".

**Arguments:** `--epic <E>`, `--lane <id>` narrow the queue · `--max-stories <n>` (default 3: the loop shares one context; for a fresh context per story use `1` and run it again) · `--stop-on-block` (stop at the first parked story instead of continuing with independent ones) · `--allow-no-verify` (run without `loop.verify`; the report says so) · `--dry-run` (preflight and the next story per lane, nothing claimed or built).

**Config:** `loop.verify` — a list of shell commands, run from the project root, in `_lean/custom/config.toml`. Project-wide checks (whole test suite, linter). `lean-build` runs only the tests covering what it touched, so without this a story can break a distant test and pass every gate: the preflight refuses to start without it unless the user passed `--allow-no-verify`.

```toml
[loop]
verify = ["npm test", "npm run lint"]
```

## 0. Preflight — once, before touching anything

Report the failing line and stop unless all pass. The plan CLI is required: a loop has no "check by reading" fallback.

| # | Check | Pass |
|---|---|---|
| P1 | `lean-method check [--epic E] --json` | `errors` = 0 |
| P2 | `git status --porcelain`; `git branch --show-current` | empty; a branch (not detached) |
| P3 | `loop.verify` commands, once | set, and all exit 0. A red baseline would blame every story. Unset passes only with `--allow-no-verify` |
| P4 | `lean-method next --json` | a `next` entry, or an `inFlight` story we claimed |

Report, don't refuse: whether the guard hook is registered (`_lean/hooks/frozen-guard.js` in `.claude/settings.json` or `.codex/hooks.json`; without it, frozen-intent and contract edits are caught only afterwards, by G2).

**Owner:** `loop-<lane>`, or `loop` without `--lane`. One loop per lane; two loops with the same owner would share claims.

## 1. The loop

Repeat until a stop rule (§3) fires:

1. `lean-method next --json [--lane L]`, kept to `--epic`. Take an `inFlight` story whose claim is ours (`lean-method claim --list`), else the first `next` entry. Skip ids finished or parked in this run, and ids already attempted twice. An in-flight story claimed by someone else, or not claimed, belongs to a person: list it, don't touch it.
2. `lean-method claim --story <id> --owner <owner>`. Exit 1: taken, go back to 1 without counting it.
3. Run `lean-build --auto <id>` (Skill tool or the harness equivalent) and say the claim owner is `<owner>`: its own `claim` with that name is a no-op. `lean-build` resumes by status, so a half-built story simply continues.
4. Run the gates (§2). All pass → `done`. First failure → park.
5. Keep one line (id · result · gate) and drop the story from your context. Start the next iteration from the CLI again.

## 2. Gates — after every build, in order

| # | Gate | Fails when |
|---|---|---|
| G1 | `status` in the story file | not `done`. `blocked`: park as is (the reason is written). `in-progress` / `in-review`: the build stopped mid-way, so run step 3 once more (2 attempts per story per run), then park |
| G2 | `lean-method check --story <id> --json` | any `error` (including `story/contract-changed`), **or** one of these warnings, which mean a step was skipped or a record can't be trusted: `story/frozen-unhashed`, `story/contract-unhashed`, `story/no-baseline`, `story/baseline-unknown`, `story/no-triage-log`, `story/triage-vocab`, `story/review-due`, `story/security-untested`, `diff/no-git`. Other warnings (`story/size`, `story/ac-untested` …) are reported only |
| G3 | each `frozen_tests` entry `path#sha256` in the frontmatter | the file's SHA-256 differs or the file is gone (`check` stops looking once a story is `done`) |
| G4 | the commands in the story's `## Verification`, run by you | any exits ≠ 0. None listed: nothing to run, report the story as `unverified` |
| G5 | `loop.verify` | any exits ≠ 0 |
| G6 | `git status --porcelain`; `git rev-list --count <baseline_commit>..HEAD` | dirty tree, or no commit since the baseline (skip the count when `baseline_commit` is `NO_VCS`) |

A failed gate is the finding. Never re-freeze, unlock, edit a test, or revert files to make one pass.

**Park** = in the story file set `status: blocked` and `blocked_reason: 'lean-loop {gate}: {code or command} — {one line}'`; `lean-method claim --story <id> --release`; commit only that file (`chore({id}): blocked by lean-loop`). A story the build already blocked keeps its own reason: release the claim and commit the file. Code the build already committed stays: never reset, never revert. Resolving is human work: `lean-build <id>` interactively (it reads the reason and asks), or `lean-change course` for a plan or contract problem.

`story/security-untested` parks on purpose: a `security: true` story without frozen acceptance tests may have a good reason (behavior that can't be tested deterministically), but a human accepts it, not the loop.

## 3. Stop rules

The first that applies; name it in the report.

| Stop | When |
|---|---|
| `nothing ready` | `next` offers nothing for this loop |
| `max-stories` | the cap is reached |
| `epic complete` | `check --epic <E> --json` has `epics/ready-to-close`. Do not close it: that needs exit evidence from a human (`lean-plan status`, then `lean-change retro`) |
| `blocked` | `--stop-on-block` and a story was parked |
| `2 parked in a row` | always. Repeated failures are evidence about the plan, not noise: stop and escalate |
| `dirty tree` | before picking a story, `git status --porcelain` is not empty. Change nothing |

## 4. Report

```
**lean-loop · {done | blocked | failed}** — {epic}: {n done, m blocked} · stopped: {rule}

| story | result | loops | gate |
|---|---|---|---|
| E2-3 | done | 0 | — |
| E2-5 | blocked | 3 | G2 story/frozen-changed |

guard: {on | off} · verify: {loop.verify | unset (--allow-no-verify)} · unverified: {ids}
Next: {`lean-build <id>` to resolve · `lean-plan status` + `lean-change retro` · `lean-loop` again}
```

`loops` is each story's `review_loops`. For cost and review quality: `lean-method metrics --epic <E>`.
