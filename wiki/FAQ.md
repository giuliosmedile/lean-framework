**Short answers about choosing a path, resuming, review, cost, install, files, and what to do when something fails.** Each links to the page that owns the detail.

## Choosing a path

**Which path do I take?**
Small change or bug fix: `lean-build` alone. Feature: `lean-intent` → `lean-plan` → `lean-build` per story. Product, or parts built separately: add `lean-architecture`. Unsure: ask [lean-help](lean-help.md). See [The LEAN Process](The-LEAN-Process.md).

**Can I skip architecture?**
Yes when nothing is built independently. Not for 2+ lanes: `lean-plan` stops and recommends [lean-architecture](lean-architecture.md) if the module table is missing.

**Do I need a SPEC for a bug fix?**
No. `lean-build` takes freeform intent and writes its spec to `plan/adhoc/<slug>.md`. See [lean-build](lean-build.md).

**How do I add work to a running project, or plan the next epic?**
Extend the SPEC with `lean-intent` (new CAP ids); `lean-plan` then adds epics and leaves existing ones alone. "Plan the next epic" picks the first `planned` epic whose dependencies are done. See [lean-plan](lean-plan.md).

**Can several people work in parallel?**
Yes, per epic: `lean-plan` asks how many people or agents, then draws lanes, a `CONTRACTS.md` and story `<E>-0`. See [Parallel Teams](Parallel-Teams.md).

## Resuming and changing course

**How do I resume interrupted work?**
Ask `lean-help` "what next". It finds specs that are `draft`, `ready`, `in-progress` or `in-review`; `lean-build` on that file resumes from its `status`. A `blocked` story resumes the same way: `lean-build` shows its `blocked_reason` and asks.

**A requirement changed mid-build.**
`lean-change course`. It writes a proposal in `plan/changes/` with old → new edits across SPEC, ARCHITECTURE and stories, and applies them when you approve. A problem local to one story stays in `lean-build`. See [lean-change](lean-change.md).

**I added a file to `docs/` after the SPEC.**
`lean-help` flags it. If building hasn't started, update the SPEC with `lean-intent`; if it has, `lean-change course`.

**An epic is finished.**
`lean-plan status` closes it, then `lean-change retro` writes `retro.md`. Acceptance needs exit evidence in `EPIC.md`: an e2e test with its commit, or a demo you watched.

## Review and loops

**Does review run by itself?**
Inside `lean-build`, yes: blind parallel reviewers, once per feature, after the last story of the epic (adversarial and verification-gap; edge-case when a story ran the full route; security at trust boundaries), and earlier when the unreviewed diff passes `review.max_diff_lines` (default 1,500 changed lines). Otherwise earlier stories of a multi-story epic get only a security pass, and only if they cross a trust boundary. The standalone [lean-review](lean-review.md) runs only when you say "review". See [Review and Triage](Review-and-Triage.md).

**What happens to a finding?**
The orchestrator verifies it, then routes it: `intent_gap` (back to you), `bad_spec` (wrong approach: revert, fix spec, redo), `amend` (spec missed something: add it, patch), `patch` (fix now), `defer` (to `deferred.md`). False ones are rejected.

**My build keeps looping back.**
Each `intent_gap` or `bad_spec` loopback adds to `review_loops`; past 3 it stops and asks you. The first `bad_spec` re-runs the implementer one tier up. An `amend` patches in place and is not a loopback.

**Do I approve every spec? Can it run unattended?**
The spec checkpoint appears only for open questions, irreversible steps, `checkpoint: spec`, or ad-hoc full-route work. `lean-build --auto` never waits: a question becomes `status: blocked` with a `blocked_reason`, and the run stops. For several stories in a row, use [`lean-loop`](lean-loop.md): it re-checks every story with `lean-method` and parks any that fail a gate.

## Cost and models

**Which models does LEAN use?**
Your session model is the orchestrator. `implement`, `test`, `review`, `check` and `research` default to a mid tier, `scout` to a low tier. See [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

**How do I make a small feature cheaper?**
Keep it to at most three capabilities and no irreversible step: `lean-plan` then writes one epic with one story. Run `lean-intent` and `lean-plan` on the top tier, then `lean-build` and the retro in a mid-tier session. See [The LEAN Process](The-LEAN-Process.md). This cheap profile is experimental: it has been run once, for cost only ([Experiment Results](Experiment-Results.md)).

**How do I change a model, or run reviewers on the session model?**
Edit `_lean/custom/config.user.toml` (personal) or `_lean/custom/config.toml` (team), then run `npx lean-method install --action quick-update`. Reviewers on the session model:

```toml
[orchestration.roles]
review = "top"
```

Triage always runs on the session model. See [Configuration](Configuration.md).

**What did a run cost?**
Each build fills a `metrics:` block in its story file; `node _lean/bin/lean.js metrics --epic E2 --json` totals them. Tokens are recorded only when the harness reports them, never estimated. See [CLI Plan Tooling](CLI-Plan-Tooling.md).

**Why do all workers run on one model?**
Your tool may lack per-subagent models (every tier becomes `inherit`), `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` may be set on Claude Code, or a role agent is stale: run quick-update.

## Tools and install

**Which tools are fully supported?**
Claude Code, Codex, OpenCode and Antigravity CLI. The other 44 targets are `basic`: one model, and review in the same context. See [Supported Tools](Supported-Tools.md).

**How do I install non-interactively?**

```bash
npx lean-method install --yes --tools claude-code,opencode --set style=standard
```

`install --list-tools` and `install --list-options` print valid values. LEAN is not on npm yet; see [Getting Started](Getting-Started.md) and [CLI Installer](CLI-Installer.md).

**Update, quick-update, uninstall?**
`--action update` re-asks with your answers as defaults; `quick-update` keeps them and refreshes files. `uninstall` keeps `_lean/custom/` (unless `--all`) and your plans.

## Files and status

**Where does story status live?**
Only in the story file's frontmatter: `todo | draft | ready | in-progress | in-review | done | blocked | retired`. `stories.yaml` has none. Ids (`E2-3`, CAP, AD) are never renumbered or reused; obsolete stories become `retired`. See [Artifacts and Layout](Artifacts-and-Layout.md).

**My SPEC got too long.**
`check` warns `spec/size` or `doc/log-size`. A `lean-intent` update archives retired capabilities to `plan/SPEC.archive.md` and rolls old log entries into `plan/SPEC.log.md`.

**Does LEAN commit or push?**
`lean-build` commits locally when git is available. It never pushes.

## Troubleshooting

**`check` fails.**
`✖` errors exit 1; `▲` warnings block only with `--strict`. Don't edit a file just to silence a finding you don't understand.

| Code | Means | Fix |
|---|---|---|
| `story/frozen-changed` | frozen block edited after `freeze` | restore from git; if you renegotiated, `freeze --story E2-3 --unlock`, edit, freeze again |
| `story/contract-changed` | `caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests` or `approved_via` edited after `freeze` | restore from git; if agreed, `--unlock`, edit, freeze again |
| `story/contract-unhashed` (warning) | a story frozen by an older LEAN | run `freeze --story E2-3` once |
| `story/frozen-test-changed`, `-missing` | frozen acceptance test edited or deleted | restore it; if the test is wrong, `freeze --unlock-tests`, fix, freeze again |
| `diff/trespass` | lane story touched another lane or the contracts | revert; change contracts via `lean-change course` |
| `stories/unlisted-file`, `stories/file-missing` | story file and `stories.yaml` disagree | make them match |
| `caps/uncovered` | a SPEC capability is in no epic | add to an epic's `caps`, or list under `uncovered:` with a reason |
| `lanes/no-e0`, `lanes/no-contracts` | 2+ lanes without `<E>-0` or `CONTRACTS.md` | run `lean-plan` on the epic |
| `story/size` (warning) | build spec over the cap (kiss: about 1,000 tokens; 2,000 for a feature story) | split, or keep with your OK |

**The guard hook refused an edit.**
Its message starts `LEAN guard:`. The edit would change a story's `<frozen-after-approval>` block, one of its frozen contract fields, a `baseline_commit` already set, or a frozen acceptance test while its story is `ready`, `in-progress` or `in-review`. Edit outside the block. If you renegotiated intent: `node _lean/bin/lean.js freeze --story E2-3 --unlock`, edit, freeze again. Don't bypass it with shell edits; `check --story` catches those. See [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

**The guard hook never fires.**
It exists only for Claude Code and Codex, and not with `--no-guard-hook` (`_lean/_config/manifest.yaml` lists `hooks:`). Codex runs it only after you trust it once in `/hooks`. OpenCode and Antigravity CLI have none. On Codex, also check that `[agents] enabled` isn't `false` in `~/.codex/config.toml`: that turns workers off.

**`taken: E2-3 is claimed by ...`**
Another agent or person holds the claim (exit 1). Take the next story; `next` lists claimed ones separately. If the holder is gone: `node _lean/bin/lean.js claim --story E2-3 --release`. Claims are local git refs, never pushed.

**A commit is blocked: `lean check failed`.**
That is the optional pre-commit hook (`--git-hook`). Fix the `✖` errors, or bypass once with `git commit --no-verify`. An existing pre-commit hook is never overwritten; call `node _lean/bin/lean.js check` from it yourself.

**`install` fails on `settings.json is not valid JSON`.**
Fix `.claude/settings.json` (or `.codex/hooks.json`) or pass `--no-guard-hook`, then re-run. Other install errors (`Unknown tool`, `Unknown --set key`, `input_folder and output_folder must differ`) name their fix.

**An update overwrote my edit to an installed skill.**
Edited files are first copied to `_lean/_backups/<timestamp>/`; `npx lean-method status` lists them. Keep lasting changes in `_lean/custom/`, which the installer never touches.

**Skills say the CLI is missing.**
They try `node _lean/bin/lean.js`, then a global `lean-method`, then check by reading. Without the installer, defaults apply and tiers come from the session model. `npx lean-method install` restores `_lean/bin/`.

## See also

- [Getting Started](Getting-Started.md): install and a first run.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `check`, `next`, `freeze`, `claim`, `metrics`.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): freeze hashes, claims, hooks.
- [lean-help](lean-help.md): ask it "what next" first.
