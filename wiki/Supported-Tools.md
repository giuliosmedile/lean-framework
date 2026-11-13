**LEAN installs into 48 coding-agent targets. Four have full support: Claude Code, Codex, OpenCode and Antigravity CLI (AGY). The other 44 are basic.**

The list lives in `lean/tools/installer/lib/platform-codes.yaml` (copied from BMAD 6.12.4). `npx lean-method install --list-tools` prints each ID, level and target folder. LEAN reads `name`, `preferred`, `suspended`, `support`, `installer.target_dir` and `installer.commands_target_dir`; it installs per project and ignores `global_target_dir`.

## Full vs basic

| | Full | Basic |
|---|---|---|
| Skills in the tool's skills folder | yes | yes |
| `_lean/` config and plan CLI | yes | yes |
| Role agents, each with its own model | yes | no |
| Cheap worker tiers | yes | no: one model does everything |
| Blind parallel reviewers (fresh context) | yes | no: review runs in the same context |
| Fresh-context implementer | yes | no |
| Guard hook | Claude Code, Codex | no |

What basic means in practice:

- Every tier resolves to `inherit`: no role agents are written and the orchestrator and its workers are the same model.
- On install you get this notice: "Basic support for …: the skills run, but on one model and with review in the same context — no cheap worker tiers, no blind reviewers."
- Where a tool cannot spawn subagents, the skills fall back: `lean-build` implements the story itself; `lean-review` runs the lenses one after another itself, or writes prompts for you to run in separate sessions.
- Gemini CLI and Cursor are scouted but have no per-subagent model, so they get `inherit`.
- The plan CLI, `check --story` and the optional git pre-commit hook still work.

`support: full` only sets that notice and the label in `--list-tools`. Role agents exist because `role-agents.js` has a renderer for the tool.

## What each full tool gets

| | Claude Code | Codex | OpenCode | AGY |
|---|---|---|---|---|
| ID | `claude-code` | `codex` | `opencode` | `antigravity-cli` |
| Skills | `.claude/skills` | `.agents/skills` | `.agents/skills` | `.agents/skills` |
| Role agents | `.claude/agents/lean-<role>.md` | `.codex/agents/lean-<role>.toml`, named `lean_<role>` | `.opencode/agents/lean-<role>.md` | `.agents/agents/lean-<role>/agent.md` |
| Format | Markdown; frontmatter `name`, `description`, `model`, `disallowedTools` | TOML; `name`, `description`, `model`, `model_reasoning_effort`, `developer_instructions`, `[skills] include_instructions = false` | Markdown; frontmatter `description`, `mode: subagent`, `model` | Markdown; frontmatter `name`, `description`, `subagent: true`, `mainAgent: false`, `model` |
| Command pointers | none | none | `.opencode/commands/lean-<skill>.md` | none |
| Guard hook | yes | yes | no | no |

Six roles per tool: `scout`, `research`, `implement`, `test`, `review`, `check`. Each file starts with the same rule: do exactly the task in your prompt, never invoke skills, never spawn subagents, return text. When a role resolves to `inherit`, the `model` line is left out (OpenCode, Codex) or set to `inherit` (Claude Code, AGY).

`scout`, `research`, `review` and `check` are read-only. Only Claude Code enforces it (`disallowedTools`). In Codex, OpenCode and AGY it is an instruction; Codex agents also inherit the parent sandbox, so the orchestrator checks `git status` after scout, review and check workers. Spawn order and escalation: [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

## Tier values per tool

Set under `orchestration.tiers.<tool>` (see [Configuration](Configuration.md)).

| Tool | Value | Example | Checked at install |
|---|---|---|---|
| Claude Code | alias `opus`, `sonnet`, `haiku`, `fable`, or a full model ID; `inherit` | `sonnet` | no |
| Codex | `model` or `model#effort`; effort is `minimal`, `low`, `medium`, `high`, `xhigh`, `max` or `ultra` | `gpt-6.1-sol#medium`, `inherit#low` | effort only |
| OpenCode | `provider/model[#variant]`; `inherit` | `anthropic/claude-sonnet-5-5` | no |
| AGY | preset: `inherit`, `flash_lite`, `flash`, `pro` | `flash` | yes: anything else is an error |

- Codex: `inherit#low` keeps the parent model and sets the effort. The effort becomes `model_reasoning_effort`.
- AGY: presets only. Antigravity picks the underlying model and may change it, so LEAN reports presets, not verified model IDs. AGY's session model cannot be read; start it with `agy --model <id>`.
- A bad Codex effort or AGY preset stops the install and leaves an existing install untouched.

## Hooks per tool

| Tool | Guard hook | Limits |
|---|---|---|
| Claude Code | `.claude/settings.json` → `hooks.PreToolUse`, matcher `Edit\|MultiEdit\|Write`, runs `_lean/hooks/frozen-guard.js` | Shell edits (`sed`, `>`) are not seen |
| Codex | `.codex/hooks.json`, matcher `^apply_patch$`; the guard applies the patch in memory and checks the result | Codex runs project hooks only after you trust them once with `/hooks`. Only `apply_patch` is seen |
| OpenCode | none yet | rely on `check --story` and the git hook |
| AGY | none | same |
| any tool | git pre-commit with `--git-hook`: runs `check`, bypass with `--no-verify` | skipped (and reported in the install summary) if the folder is not a git repo or a pre-commit hook already exists |

- The guard is on by default when Claude Code or Codex is selected. `--no-guard-hook` skips it. It blocks with exit code 2 and a message; if the script itself crashes, the edit is allowed.
- Install merges into your existing `settings.json` or `hooks.json`, never duplicates, and uninstall removes only LEAN's entries. Invalid JSON in those files aborts the install unless you pass `--no-guard-hook`.
- The Codex command is `node "$(git rev-parse --show-toplevel)/_lean/hooks/frozen-guard.js"` in a git repo, an absolute path otherwise.
- What the guard protects: [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## How scouting detects agents and models

`scout` (and install) look at six tools. A tool is **found** if its binary is on `PATH` or its config folder exists. Other targets are never detected, so they get no suggestion.

| Tool | Binary, config | Session model from | Models from | Suggested mid / low |
|---|---|---|---|---|
| Claude Code | `claude`, `~/.claude` | `ANTHROPIC_MODEL`, then `.claude/settings.local.json`, `.claude/settings.json`, `~/.claude/settings.json` | fixed: opus, sonnet, haiku, fable | Opus or unknown: `sonnet` / `haiku`. Sonnet: `inherit` / `haiku`. Haiku: `inherit` / `inherit` |
| OpenCode | `opencode`, `~/.config/opencode` | `model` in `opencode.json`, then `~/.config/opencode/opencode.json` | `opencode models` | models cheaper than the session model, from its provider, classified by name (opus top, sonnet mid, haiku/mini/flash/lite low); Claude siblings guessed from the session ID are flagged "verify" |
| AGY | `agy`, `~/.gemini/antigravity-cli` | not readable | presets | `pro` / `flash` |
| Codex | `codex`, `~/.codex` | `model` in `.codex/config.toml`, then `~/.codex/config.toml` | fixed: `gpt-6.1-sol`, `gpt-6-luna` (no listing command) | `gpt-6.1-sol#medium` / `gpt-6-luna#medium`; session on Luna: `inherit` / `inherit#low` |
| Gemini CLI | `gemini`, `~/.gemini` | `~/.gemini/settings.json` | none | `inherit` / `inherit` |
| Cursor | `cursor-agent`, `~/.cursor` | not readable | none | `inherit` / `inherit` |

Scouting warns about: `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` (forces one model on every subagent, so LEAN tiers are ignored); Bedrock or Vertex (aliases resolve to that provider's IDs); Codex sandbox inheritance and `[agents] enabled = false` (workers cannot spawn); AGY presets that may change. Command details: [CLI Installer](CLI-Installer.md#scout).

## The 48 targets

| Group | Count | Examples |
|---|---|---|
| Full | 4 | `claude-code`, `codex`, `opencode`, `antigravity-cli` |
| Basic, share `.agents/skills` | 24 | `cursor`, `gemini`, `github-copilot`, `windsurf`, `roo`, `goose` |
| Basic, own folder | 20 | `cline` (`.cline/skills`), `kiro` (`.kiro/skills`), `junie`, `trae`, `qwen` |

Sharing a folder means installing several tools writes the skills once. `cursor`, `github-copilot`, `claude-code` and `codex` are preferred (listed first in the picker). GitHub Copilot also gets pointer files in `.github/agents/`, in OpenCode's format. No target is currently `suspended`.

## See also

- [CLI Installer](CLI-Installer.md) — `install`, `scout`, flags.
- [Configuration](Configuration.md) — where tiers and roles are set and overridden.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) — why tiers exist and how workers are spawned.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) — what the guard hook enforces.
