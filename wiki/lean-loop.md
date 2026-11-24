**`lean-loop` builds an epic's planned stories back to back, unattended, and accepts each one only if LEAN's static checks pass. The build's own report is never evidence.**

It is the LEAN counterpart of BMAD's `bmad-loop`, but a skill, not a program. It spawns no workers (`lean-build` does), writes no file of its own, and keeps no state: stories, commits and claims are the state, so a stopped run resumes by running it again. It never pushes.

## The loop

```
preflight ─▶ ┌─▶ next ─▶ claim ─▶ lean-build --auto <id> ─▶ gates ─┬─ pass ─▶ done ─┐
             │                                                     └─ fail ─▶ park ─┤
             └──────────────────────── stop rule? no ◀──────────────────────────────┘
```

Every decision comes from an exit code, a `--json` field, or a status read from a file. When there is none for something it must decide, it stops and parks the story.

## Arguments

| Argument | Effect |
|---|---|
| `--epic <E>`, `--lane <id>` | Narrow the queue to one epic or lane. |
| `--max-stories <n>` | Stop after `n` stories. Default 3: the loop shares one context. For a fresh context per story use `1` and run it again. |
| `--stop-on-block` | Stop at the first parked story. Default: continue with independent stories. |
| `--allow-no-verify` | Run without `loop.verify`. The report says `verify: unset (--allow-no-verify)`. |
| `--dry-run` | Preflight and the next story per lane. Nothing is claimed or built. |

Example prompts (illustrative):

```
lean-loop --epic E2
lean-loop --lane A --max-stories 5
lean-loop --dry-run
```

## Preflight

It stops, naming the failing line, unless all of these pass. The plan CLI is required: a loop has no "check by reading" fallback.

| # | Check | Pass |
|---|---|---|
| P1 | `check [--epic E] --json` | no errors |
| P2 | `git status --porcelain`, current branch | clean tree, on a branch |
| P3 | `loop.verify` commands, once | set, and all exit 0. A red baseline would blame every story. Unset passes only with `--allow-no-verify` |
| P4 | `next --json` | something to do: a `next` entry, or an `inFlight` story this loop claimed |

It also reports, without refusing, whether the [guard hook](Frozen-Intent-and-Guards.md) is registered.

## Claims and resuming

The loop claims each story as `loop-<lane>` (`loop` without `--lane`) and tells `lean-build` that owner, so the build's own claim is a no-op. Run one loop per lane: two loops with the same owner would share claims.

On start it first resumes an `inFlight` story it claimed (a crashed run), then takes the first `next` entry. An in-flight story with another owner, or none, belongs to a person and is only listed.

## The gates

After each build, in order. The first failure parks the story.

| # | Gate | Fails when |
|---|---|---|
| G1 | `status` in the story file | not `done`. A `blocked` story is parked as is. `in-progress` or `in-review` means the build stopped mid-way: it runs once more (2 attempts per story per run), then is parked |
| G2 | `check --story <id> --json` | any error (including `story/contract-changed`), or a warning that means a step was skipped or a record can't be trusted: `story/frozen-unhashed`, `story/contract-unhashed`, `story/no-baseline`, `story/baseline-unknown`, `story/no-triage-log`, `story/triage-vocab`, `story/security-untested`, `diff/no-git`. Other warnings are reported only. `story/security-untested` parks on purpose: a human, not the loop, accepts a security story without frozen tests |
| G3 | each `frozen_tests` entry (`path#sha256`) | the file's SHA-256 differs or the file is gone. `check` stops looking once a story is `done`, so the loop recomputes it |
| G4 | the story's `## Verification` commands, re-run by the loop | any exits non-zero. None listed: the story is reported `unverified` |
| G5 | `loop.verify` | any exits non-zero |
| G6 | `git status --porcelain`, `git rev-list --count <baseline_commit>..HEAD` | dirty tree, or no commit since the baseline (count skipped for `NO_VCS`) |

A failed gate is the finding. The loop never re-freezes, unlocks, edits a test, or reverts files to make a gate pass.

**Parking** sets `status: blocked` and `blocked_reason: 'lean-loop G2: story/frozen-changed — …'` in the story file, releases the claim, and commits only that file. A story the build already blocked keeps its own reason. Code the build already committed stays: the loop never resets or reverts. Dependents wait because `next` only offers stories whose `depends_on` are `done`.

To resolve a parked story, run `lean-build <id>` interactively (it reads the reason and asks you) or `lean-change course` for a plan or contract problem.

## Stop rules

The first that applies is named in the report.

| Stop | When |
|---|---|
| `nothing ready` | `next` offers nothing for this loop |
| `max-stories` | the cap is reached |
| `epic complete` | `check --epic` shows `epics/ready-to-close`. The loop does not close it: that needs exit evidence from a human (`lean-plan status`, `lean-change retro`) |
| `blocked` | `--stop-on-block` and a story was parked |
| `2 parked in a row` | always. Repeated failures are evidence about the plan, not noise |
| `dirty tree` | before picking a story the tree is not clean. It changes nothing |

## Config

`loop.verify` in `_lean/custom/config.toml`: shell commands run from the project root at preflight and after every story. Required: without it a story can break a test outside the files it touched and still pass every gate, so the preflight fails unless you pass `--allow-no-verify`.

```toml
[loop]
verify = ["npm test", "npm run lint"]
```

`lean-build` runs only the tests covering what it touched, so without this a story can break a distant test and still pass every gate. Unset, the report says so.

## The report

```
**lean-loop · blocked** — E2: 2 done, 1 blocked · stopped: max-stories

| story | result | loops | gate |
|---|---|---|---|
| E2-3 | done | 0 | — |
| E2-4 | done | 1 | — |
| E2-5 | blocked | 3 | G2 story/frozen-changed |

guard: on · verify: loop.verify · unverified: —
Next: lean-build E2-5 to resolve
```

Cost and review quality across the epic: `lean-method metrics --epic E2` ([CLI Plan Tooling](CLI-Plan-Tooling.md)).

## Compared with `bmad-loop`

| `bmad-loop` | `lean-loop` |
|---|---|
| Python engine; no model in the control loop | The session is the controller; safety comes from the gates, not from keeping the model out |
| Each phase in a fresh tmux session | `lean-build` already uses a fresh-context implementer and blind reviewers; for a fresh context per story use `--max-stories 1` |
| Verify: spec status, baseline, non-empty diff, test commands | G1 to G6, plus frozen-intent and frozen-test hashes, lane trespass and the review-log vocabulary |
| `sprint-status.yaml`, run state, journal | None: the story file's `status`, git, and claims |
| Rolls a failed story back to baseline | Leaves the commits, parks the story with the failing gate |
| `bmad-loop-resolve`, `-sweep`, `-setup`; TUI; worktree isolation | `lean-build <id>` and `lean-change course` to resolve; `npx lean-method install` to set up. No sweep, TUI or worktree isolation |

## Human-owned

- Unblocking parked stories, and any change to frozen intent.
- Closing an epic and its exit evidence.
- Pushing to a remote, and merging lane branches.

## See also

- [lean-build](lean-build.md): the `--auto` run the loop drives.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): the hashes and the hook the gates rely on.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `check`, `next`, `claim`, `metrics`.
- [Parallel Teams](Parallel-Teams.md): one loop per lane.
