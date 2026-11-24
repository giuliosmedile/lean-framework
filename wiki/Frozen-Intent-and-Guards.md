**Frozen intent is what the human approved for a story. Hashes make a change visible, a hook blocks most changes, and claims and lanes keep parallel agents apart.**

A building agent must not quietly widen a story, weaken its tests, or edit another lane's code. Prose asks for that; this page covers what enforces it. Flags are in [CLI Plan Tooling](CLI-Plan-Tooling.md).

## What is frozen

| What | Recorded in | Set by | Enforced by |
|---|---|---|---|
| Intent | `frozen_sha256` in the story's frontmatter | `freeze --story <id> --via checkpoint\|plan` | `check`, guard hook |
| Contract fields (`caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests`, `approved_via`) | `contract_sha256` in the frontmatter | the same `freeze` | `check`, guard hook |
| Who approved the block | `approved_via: checkpoint \| plan` | `freeze --via` | part of the contract hash |
| Where the build started | `baseline_commit` | `lean-build`, once | guard hook (no rewrite), `check --story` (a commit behind HEAD) |
| Acceptance tests (`security: true` or irreversible) | `frozen_tests: ['path#sha256', …]` | `freeze --story <id> --tests a,b` | `check`, guard hook |
| Who builds the story | git ref `refs/lean/claims/<id>` | `claim --story <id>` | `claim`, `next`, `check` |
| Which files a lane story may touch | `lanes:` in `stories.yaml` | `lean-plan` | `check --story` |

## Freeze, build, check

```
orchestrator (lean-build)         implement worker        tooling
  |                                     |
  |-- claim --story E2-1 ---------------------------------> refs/lean/claims/E2-1
  |   (spec grown, human approves the frozen block)
  |-- freeze --story E2-1 --via plan ----------------------> frozen_sha256 = sha256(block), contract_sha256
  |-- test worker writes failing tests, orchestrator judges them
  |-- freeze --story E2-1 --tests a,b ---------------------> frozen_tests = [path#sha256], contract_sha256 again
  |-- baseline_commit = HEAD; status: in-progress
  |-- spec path ------------------------->|
  |                                       |-- Edit/Write ---> guard hook: allow, or exit 2
  |<----------- report, diff -------------|
  |-- check --story E2-1 ----------------------------------> hash? tests? size? trespass?
  |      FAIL: restore from git. Never re-freeze to pass.
  |      PASS: review, then claim --release
```

## Frozen intent

The story file holds the build spec. Its `<frozen-after-approval>` block is the part the human owns (the template puts Intent, Boundaries and the Edge-Case Matrix inside it):

```markdown
<frozen-after-approval reason="human-owned intent — change only when the human renegotiates">
## Intent
**Problem:** …  **Acceptance:** Given …, when …, then …
</frozen-after-approval>
```

- `freeze` hashes the block (HTML comments and trailing spaces ignored) and writes `frozen_sha256` to the frontmatter.
- Edits outside the block do not matter: tasks, notes, status, logs.
- `check` reports `story/frozen-changed` if the block changes or disappears, in any status. A `ready` or later story with no hash gets the warning `story/frozen-unhashed`.
- A small-route story freezes its Intent the same way. Ad-hoc specs use `--file plan/adhoc/<slug>.md`.

### Contract fields

Some frontmatter fields change what the build must do as much as the block does: a story could drop its frozen tests, lower `security`, or widen `caps` without touching the block. `freeze` therefore also hashes `caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests` and `approved_via` into `contract_sha256` (comments and spacing ignored).

- `check` reports `story/contract-changed` when one of them changes, in any status. A frozen story without `contract_sha256` (frozen by an older LEAN) gets the warning `story/contract-unhashed`: run `freeze` once to record it.
- `freeze --unlock` removes both hashes; `freeze` (with or without `--tests`) writes both again.
- `status`, `route`, `review_loops`, `metrics` and the logs stay free: the build changes them as it goes.

### Who approved it

`approved_via` says how much of the block a human saw. `checkpoint`: the human saw the whole block at the build checkpoint. `plan`: the human approved only the plan stub (its Acceptance), and the orchestrator wrote the rest. In a `plan` story the orchestrator tags `[ASSUMPTION]` on every frozen line that says more than the stub, the SPEC, an AD or a human answer. Those lines are frozen against the implementer like the rest, but they are not *settled*: reviewers may challenge them, and triage judges them on the merits ([Review and Triage](Review-and-Triage.md)). This came from an experiment where an unseen line the orchestrator wrote in the block made triage reject a correct finding ([Experiment Results](Experiment-Results.md)).

`freeze` writes `plan` unless told `--via checkpoint`, and keeps the value already recorded when called again without `--via`.

## Frozen acceptance tests

When a story has `security: true` or an irreversible step, a `test` worker writes failing tests from the spec before any code exists (other stories get their tests from the implementer, with the code). The orchestrator judges them, then runs `freeze --tests`. The implementer makes them pass and never edits them. If it thinks one is wrong, it stops and reports.

`check` reports `story/frozen-test-changed` or `story/frozen-test-missing` for any story not `done` or `retired`. A `security: true` story past `ready` with no frozen tests gets the warning `story/security-untested`; `lean-loop` parks it for a human.

## Claims

- `claim` runs `git update-ref` with `create` on `refs/lean/claims/<id>`. The ref points to a blob with the owner and an ISO time. Creation is atomic, so two agents racing for one story cannot both win.
- Refs live in the shared git directory. Every worktree of one clone sees them.
- LEAN never pushes, so claims do not cross machines. Teams on separate machines own separate lanes ([Parallel Teams](Parallel-Teams.md)).
- A claim is not a status. Status stays in the story file.
- `next` lists claimed stories apart and skips them. `check` warns `claims/stale` (story `done` or `retired`) and `claims/unknown`.
- List them with `claim --list` or `git for-each-ref refs/lean/claims/`.

## Lane trespass

`check --story <id>` lists files changed since the story's `baseline_commit` (tracked and untracked; `git diff HEAD` when the baseline is empty or `NO_VCS`). It applies only to epics that declare `lanes:`.

- Files under the plan folder are ignored.
- A story in a named lane that changes another lane's `modules` gets `diff/trespass`.
- Any story outside lane `shared` that changes `contracts_path` or `fixtures_path` from `CONTRACTS.md` gets `diff/trespass`: it needs a contract change (`<E>-C<n>`).
- No git, or an unreadable baseline, gives the warning `diff/no-git`.

`lean-build` reverts a trespass before review.

## The guard hook

A PreToolUse hook, `_lean/hooks/frozen-guard.js`, installed by default for Claude Code and Codex (`--no-guard-hook` skips it). Plain Node, no dependencies.

| Tool | Registered in | Matcher |
|---|---|---|
| Claude Code | `.claude/settings.json` | `Edit\|MultiEdit\|Write` |
| Codex | `.codex/hooks.json` | `^apply_patch$` |

The installer merges its entry next to yours and `uninstall` removes only that entry. Codex runs project hooks only after you trust them once with `/hooks`.

For each file a tool call would touch, the guard works out the content after the edit. Codex's `apply_patch` text is parsed and applied in memory first, so adds, updates, deletes and moves are all seen.

It blocks (exit 2, with the reason on stderr for the agent) when:

- the file has a `frozen_sha256` and the edit would change the frozen block, drop the block or the hash, or delete or move the file (any status);
- the file has a `contract_sha256` and the edit would change a contract field or that hash;
- the file has a `baseline_commit` and the edit would change or remove it;
- the file is listed in `frozen_tests` of a story whose status is `ready`, `in-progress` or `in-review` (any edit).

Everything else passes. A guard crash allows the edit. A patch that cannot apply is left for Codex to reject.

```
LEAN guard: test/producer.test.js is a frozen acceptance test of plan/epics/E2-export/stories/E2-1-producer.md. Make the code pass it; don't change it. …
```

## What the guard cannot catch

- **Shell edits** (`sed -i`, `echo >`, `git checkout`). The hook sees only edit tools. `check --story` catches the result afterwards, and `lean-build` runs it as its mechanical gate.
- **Other tools.** OpenCode and Antigravity CLI have no guard hook. `check --story` is the only net there.
- **Gaps by design.** The guard ignores a block that was never frozen. In `draft`, a frozen test edit passes the guard but fails `check`.
- **Unlocking.** `freeze --unlock` is a shell command, so the hook cannot stop it. The rule is in the skills: only after the human agrees.
- **Who approved.** The agent runs `freeze`, so `approved_via` records what the skill says happened; it is not a signature. A hash proves that nothing changed since the last `freeze`, not that a human approved it. For audited work, have a human review the commit that adds the frozen spec (in a pull request, for example).

## Git pre-commit hook

Off by default. `npx lean-method install --git-hook` (or answer yes when asked) writes the hook at `git rev-parse --git-path hooks/pre-commit`. It runs `_lean/bin/lean.js check` and blocks the commit on errors; warnings do not block. Bypass once with `git commit --no-verify`.

- It never overwrites a pre-commit hook it did not write (the install reports `git:pre-commit skipped`).
- Whole-plan `check` includes every story's frozen hash and test hashes, so a shell edit to frozen intent cannot be committed unnoticed. Trespass needs `check --story` and is not part of it.
- `quick-update` keeps the hook. `uninstall` removes it. See [CLI Installer](CLI-Installer.md).

## Renegotiating on purpose

Intent changed by agreement with the human:

```bash
node _lean/bin/lean.js freeze --story E2-1 --unlock     # removes frozen_sha256 and contract_sha256
# edit the frozen block (or a contract field) with the human
node _lean/bin/lean.js freeze --story E2-1 --via checkpoint   # hash the new block: the human saw it
```

A test judged wrong by the orchestrator (a test that contradicts the spec is a `test` worker defect):

```bash
node _lean/bin/lean.js freeze --story E2-1 --unlock-tests
# fix the test, note it in the Spec Change Log
node _lean/bin/lean.js freeze --story E2-1 --tests test/producer.test.js   # list every test again
```

- The implementer never unlocks. It stops and reports.
- After `story/frozen-changed` or `story/contract-changed`, restore the block or field from the approved version in git. Never re-freeze to make `check` pass.
- An unseen `[ASSUMPTION]` line (`approved_via: plan`) that review proves wrong was the orchestrator's mistake: it unlocks, corrects the line, logs it in the Spec Change Log and freezes again with `--via plan`, without stopping for the human.
- A review `intent_gap` reverts the code, goes to the human, updates the block, then freezes again ([Review and Triage](Review-and-Triage.md)).

## See also

- [CLI Plan Tooling](CLI-Plan-Tooling.md): every flag of `freeze`, `claim` and `check`.
- [lean-build](lean-build.md): the step order around freezing and the gate.
- [Parallel Teams](Parallel-Teams.md): lanes, contracts and seams that trespass protects.
- [Supported Tools](Supported-Tools.md): which tools get the guard hook.
- [Review and Triage](Review-and-Triage.md): the `intent_gap` and `bad_spec` loopbacks.
