**Five commands do the mechanical plan work (`check`, `next`, `freeze`, `claim`, `metrics`) so the agent spends tokens on judgment, not on counting.**

They are deterministic: no model, no network. `check`, `next` and `metrics` only read. `freeze` rewrites one story's frontmatter. `claim` writes git refs.

## Running them

```bash
node _lean/bin/lean.js <command> [options]     # installed project: plain Node, no npm install
npx lean-method <command> [options]            # the same commands, from the package
```

- The installer copies the CLI and its three runtime dependencies into `_lean/bin/`. Node 20.19 or newer is all it needs.
- Skills write `lean-method <cmd>` and mean `node {project-root}/_lean/bin/lean.js <cmd>`.
- The package is on the npm registry: `npx lean-method <cmd>`. From a clone: `node lean/tools/installer/lean-cli.js <cmd>`.
- Every command takes `--directory <path>` (project root, default: current directory) and `--plan <path>` (plan folder, default: `core.output_folder` from the [`_lean/` config](Configuration.md), else `plan/`).
- Exit 0 is success. Exit 1 is a failed check or a thrown error (for example `give --story <id> or --file <path>`). `_lean/bin/lean.js` exits 2 for an unknown command or flag.

## `check`

```bash
node _lean/bin/lean.js check [--epic E2 | --story E2-3] [--strict] [--json]
```

| Flag | Effect |
|---|---|
| `--epic <id>` | One epic only. Skips document size and capability coverage. |
| `--story <id>` | One story, for `lean-build`: its file, frozen intent and tests, size, open dependencies, lane trespass, the review window, and a test for each numbered acceptance criterion. |
| `--strict` | Warnings also exit 1. |
| `--json` | `{ errors, warnings, findings: [{ level, code, where, msg }] }`; with `--story`, also `review: { story, final, from, base, lines, cap, due }` (`null` without git or a baseline). |

Exit 1 on any error, or on any warning with `--strict`; otherwise 0. No plan folder gives one warning (`plan/missing`).

What it checks (✖ error, ▲ warning):

| Area | Codes | Examples |
|---|---|---|
| Epics | `epics/*` | ✖ id not `E<n>`, duplicate, bad status, depends on a later epic, folder or `EPIC.md` missing, `done` with open stories. ▲ `done` without `## Exit evidence`. |
| Capabilities | `caps/*` | ✖ a `CAP-`/`QR-` id from SPEC.md is in no epic and not under `uncovered:`. ▲ duplicate, unknown, archived but claimed. |
| Stories index | `stories/*` | ✖ status in `stories.yaml`, bad or duplicate id, unknown lane, missing file, story file not listed, unknown dependency, dependency cycle. |
| Story file | `story/*` | ✖ frontmatter id or epic mismatch, status outside the list, `blocked` without `blocked_reason`. ▲ unknown AD in `rules`, `story/size` over the cap, no triage log, bad triage words, `done` without `baseline_commit`. |
| Frozen | `story/frozen-*`, `story/contract-*` | ✖ `frozen-changed`, `contract-changed`, `frozen-test-changed`, `frozen-test-missing`, `approved-via` (not `checkpoint` or `plan`). ▲ `frozen-unhashed`, `contract-unhashed`, `security-untested` (`security: true` past `ready` with no frozen tests). See [Frozen Intent and Guards](Frozen-Intent-and-Guards.md). |
| Lanes, seams | `lanes/*`, `seams/*`, `decisions/*` | ✖ lanes but no `CONTRACTS.md` or `<E>-0`, two lanes own the same module, seam without a real-implementation owner or checkpoint. ▲ lane without `modules:`, overdue decision. See [Parallel Teams](Parallel-Teams.md). |
| Document size | `spec/size`, `doc/log-size` | ▲ SPEC.md over its page cap, Decision Log over 40 entries. |
| Claims | `claims/*` | ▲ claim on a `done` or unknown story. |
| Trespass (`--story`) | `diff/*`, `story/baseline-unknown` | ✖ `diff/trespass`. ▲ `diff/no-git`; `baseline_commit` that is not a commit behind HEAD. |
| Review (`--story`) | `story/review-due`, `story/review-vocab` | ▲ a feature review is due (final story, or the window over `review.max_diff_lines`) and the story's `review:` is not `feature`; `review:` outside `feature \| security \| deferred`. |
| Acceptance (`--story`) | `story/ac-untested` | ▲ a numbered criterion (`- AC-n:` in the frozen block) that no test file changed since `baseline_commit` (or frozen for the story) names as `<story id> AC-n`. Test files: under `test/`, `tests/`, `__tests__/`, `spec/`, or named `test_*`, `*_test.*`, `*.test.*`, `*.spec.*`, `*Test(s).*`. Identifier forms count too (`test_e1_2_ac3`). |

**Review window** (`--story`): the diff since the `baseline_commit` of the first story built after the last story with `review: feature` and status `done` (the epic's first built story when there is none), counted as changed lines in tracked files plus untracked files, outside the plan folder and `_lean/`. The text output prints it before the findings:

```
review window since 3f2a91c (E2-2): 1734 changed lines, cap 1500 → feature review due
```

In an epic with lanes the window can include other lanes' merged work.

`story/size` estimates tokens as words × 4/3 over the spec body (no frontmatter, comments or append-only logs). Cap: 1000 for style `kiss`, 1600 for `standard`, doubled for a feature story (the only story of its epic, covering all the epic's capabilities).

Illustrative output:

```
✖ stories/dep-unknown    plan/epics/E2-export/stories.yaml#E2-2 — depends on unknown story E2-9
▲ story/frozen-unhashed  plan/epics/E2-export/stories/E2-1-producer.md — status ready but the frozen block was never hashed — run: lean-method freeze --story E2-1
FAIL — plan: 1 error(s), 1 warning(s)
```

The last line is `PASS`, `PASS with warnings` or `FAIL`, plus the scope.

**Called by:** `lean-plan` (readiness check `--epic <E>`, status), `lean-build` (`--story <id>`: mechanical gate, spec size), `lean-help`, and the optional git pre-commit hook.

## `next`

```bash
node _lean/bin/lean.js next [--lane A] [--json]
```

- `--lane <id>` keeps that lane plus `shared` stories. `--json` returns `inFlight`, `next`, `blocked`, `claimed`. Looks only at `active` epics. Exit 0.
- `resume`: status `draft`, `ready`, `in-progress` or `in-review`.
- `claimed`: a `todo` story that holds a [claim](Frozen-Intent-and-Guards.md#claims).
- `blocked`: shows `blocked_reason`.
- `next`: the first `todo` story per lane, in `stories.yaml` order, whose `depends_on` are all `done` or `retired`. In an epic with lanes, only `<E>-0` is offered until it is done.

Illustrative output:

```
resume   E2-1 [A] in-progress — plan/epics/E2-export/stories/E2-1-producer.md
blocked  E2-2 [B] — needs C1
```

Nothing to offer prints `nothing ready — plan the next epic (lean-plan) or unblock a story`.

**Called by:** `lean-build` ("next story", `--lane` for a lane), `lean-plan` status, `lean-help`.

## `freeze`

```bash
node _lean/bin/lean.js freeze --story E2-1 --via checkpoint|plan [--tests test/a.js,test/b.js]
node _lean/bin/lean.js freeze --file plan/adhoc/csv.md          # ad-hoc spec
node _lean/bin/lean.js freeze --story E2-1 --unlock [--unlock-tests]
```

| Flag | Effect |
|---|---|
| `--story <id>` / `--file <path>` | The spec to freeze. One is required. |
| `--via <how>` | `checkpoint` (a human saw the frozen block) or `plan` (only the plan stub was approved). Writes `approved_via`. Without it, the recorded value stays, or `plan` when there is none. |
| `--tests <paths>` | Comma-separated, relative to the project root, each must exist. Writes `frozen_tests: ['path#sha256', …]`, replacing the list. |
| `--unlock` | Removes `frozen_sha256` and `contract_sha256`. |
| `--unlock-tests` | Removes `frozen_tests`. |

- Plain `freeze` writes `frozen_sha256: '<hash>'`, `approved_via` and `contract_sha256: '<hash>'` into the frontmatter and leaves the rest of the file byte-for-byte. Re-running it leaves `frozen_tests` alone.
- `contract_sha256` covers the raw values of `caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests` and `approved_via` (comments and spacing ignored), so set them before freezing.
- The hash covers the `<frozen-after-approval>` block with HTML comments and trailing spaces removed. `--tests` also re-hashes the block, so the block must exist.
- Exit 1 with `story E9-1 not found`, `test file test/nope.js does not exist` or `… has no <frozen-after-approval> block`.

```
froze 1 test file(s) in plan/epics/E2-export/stories/E2-1-producer.md
frozen plan/epics/E2-export/stories/E2-1-producer.md — sha256 ade316816a1c…, approved via plan
```

**Called by:** `lean-build`, when the frozen block is approved (and again after an `intent_gap` is renegotiated), and after the `test` worker's tests are judged. Concepts and unlocking: [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## `claim`

```bash
node _lean/bin/lean.js claim --story E2-1 --owner agent-a
node _lean/bin/lean.js claim --story E2-1 --release
node _lean/bin/lean.js claim --list
```

- `--owner` defaults to `$USER` (then `$USERNAME`, else `unknown`).
- Exit 1 if the story is held by someone else, or is not in any `stories.yaml` (ad-hoc specs cannot be claimed).
- The same owner claiming again gets `already yours`.
- Without git it locks nothing, prints `no git here`, and exits 0.
- `--release` does not check the owner.

```
claimed: E2-1 → agent-a
taken: E2-1 is claimed by agent-a since 2026-11-13T15:48:06.288Z
```

**Called by:** `lean-build` before it builds, whenever more than one agent or person may build (always in `--auto`), and again at finish to release. How the lock works: [Frozen Intent and Guards](Frozen-Intent-and-Guards.md#claims).

## `metrics`

```bash
node _lean/bin/lean.js metrics [--epic E1] [--json]
```

- Aggregates `done` stories only (`3/9 done` counts every non-retired story): `route`, `review_loops` and the `metrics:` block from the frontmatter, plus the rows of `## Review Triage Log`. Findings are counted from the rows, never from totals an agent wrote about itself.
- Prints one block per epic that has stories, plus `TOTAL` when there are several. `--json` returns `{ epics, total }`, with `false_rate` and `median_minutes`.
- Tokens an agent did not report show as `not reported`; they are never estimated. Exit 0.

Illustrative output:

```
E1 Foundation: 1/1 done · routes small 0 / full 1 · loops 1 (1 stories) · escalations 1 · deferred 0 · median 42 min/story
  findings 4: high 1 · medium 1 · low 0 · false 1 (25%) · maybe-false 1
  routed: patch 1 · bad_spec 1 · defer 1 · reject 1
  tokens: workers 120,000 (1 stories)
```

Words outside the vocabulary count under `other`, and `check` warns `story/triage-vocab`. The words: [Review and Triage](Review-and-Triage.md).

**Called by:** `lean-change retro` (`--epic <E> --json`), and anyone comparing runs. See [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

## See also

- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): what `freeze`, `claim` and `check --story` protect.
- [lean-build](lean-build.md): where the build calls each command.
- [Artifacts and Layout](Artifacts-and-Layout.md): the tree and statuses `check` validates.
- [CLI Installer](CLI-Installer.md): `install`, `scout`, `status`, `uninstall`.
