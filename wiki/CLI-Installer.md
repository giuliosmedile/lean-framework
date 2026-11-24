**`npx lean-method` installs LEAN into a project, scouts your coding agents, and keeps the install in sync.**

Package `lean-method` 0.10.1 (binaries `lean-method` and `lean`, Node >= 20.19). It is not on the npm registry yet: run `npm pack` in `lean/`, then `npx --package=./lean-method-0.10.1.tgz lean-method install`. First run: [Getting Started](Getting-Started.md). The same binary also has the plan commands (`check`, `next`, `freeze`, `claim`, `metrics`): see [CLI Plan Tooling](CLI-Plan-Tooling.md).

| Command | Does | Writes files? |
|---|---|---|
| `install` | install or update skills, role agents, config, plan CLI, hooks | yes |
| `scout` | detect agents and models, suggest tiers | no |
| `status` | show version, tools, effective config, edited files | no |
| `uninstall` | remove what `install` added | yes (deletes) |

All four take `--directory <path>` (default: current directory). Errors print `lean-method <command>: <message>` to stderr and exit 1; `LEAN_DEBUG=1` adds the stack trace. Cancelling a prompt exits 0 with "Cancelled — nothing changed."

## install

```bash
npx lean-method install [options]
```

| Flag | Meaning |
|---|---|
| `--tools <ids>` | Comma-separated tool IDs (`claude-code,codex`). With `--yes` on a fresh install it is required unless scouting detects a tool. Unknown ID: error. |
| `--list-tools` | Print every ID with support level and target folders, then exit. |
| `--list-options` | Print the keys `--set` accepts, then exit. |
| `--set <key=value>` | Set one value without prompts. Repeatable. Applied after the prompts, so it wins over them. |
| `--action <type>` | `update` or `quick-update`, for an existing install. |
| `--user-name`, `--communication-language`, `--document-output-language` | Answer those questions. |
| `--input-folder`, `--output-folder` | Source-documents folder (default `docs`) and plans folder (default `plan`). Must differ. |
| `--style <kiss\|standard>` | Working style (default `kiss`). |
| `--no-scout` | Skip scouting. Tiers become `inherit` unless set with `--set`. |
| `--no-guard-hook` | Do not add the frozen-intent guard hook. |
| `--git-hook` | Add a git pre-commit hook that runs `check`. |
| `-y, --yes` | Accept defaults, no prompts. |

`--set` keys: `style=standard` or `lean.style=standard`, `prose=ste80` or `lean.prose=ste80`, `core.project_name=shop`, `orchestration.tiers.claude-code.low=haiku`, `orchestration.roles.review=top`, `orchestration.escalate=false`. Unknown key: error. All keys: [Configuration](Configuration.md).

The run is interactive only when `--yes` is absent and stdin is a terminal. Pipes and CI run non-interactively.

### What it does

1. **Existing install?** (`_lean/_config/manifest.yaml`) Without `--action` it asks: Update, Quick update, Cancel. With `--yes` it runs `update`.
2. **Scout** the machine (skipped by `--no-scout` and by quick-update). Interactive runs show an "Agents found" table.
3. **Tools:** `--tools`, else the previous install's tools, else detected ones. Interactive: a picker with preferred and detected tools first.
4. **Questions** from `module.yaml` (name, project, languages, folders, style). A flag answers its question. Quick-update and `--yes` use the previous answer or the default.
5. **Tiers** per tool: the scout suggestion, or your earlier choice. Interactive: you pick the mid and low model for each tool that supports it, then answer "Run reviewers on the session model instead of the mid tier?"
6. **Hooks:** confirm the guard hook (Claude Code, Codex) and the git pre-commit hook. A notice follows if you picked a basic tool ([Supported Tools](Supported-Tools.md)).
7. **Write:** back up edited files, delete files LEAN no longer owns, write everything, merge hooks, write manifests.

A bad tier value (a Codex effort or an AGY preset that does not exist) fails before any file is touched.

### What lands in the project

```
.claude/skills/lean-*/  or  .agents/skills/lean-*/   9 skills, per tool
.claude/agents/ .opencode/agents/ .codex/agents/ .agents/agents/   role agents (full tools only)
.opencode/commands/lean-*.md                         command pointers (OpenCode)
_lean/config.toml  config.user.toml  custom/*.toml   config, see Configuration
_lean/bin/  _lean/hooks/frozen-guard.js              plan CLI and guard hook, no npm needed
_lean/_config/  _lean/.gitignore                     manifests, ignore rules
docs/  plan/                                         the two folders, created if missing
.claude/settings.json  .codex/hooks.json             guard entry merged in, your settings kept
.git/hooks/pre-commit                                only with --git-hook
```

### update vs quick-update

| | `update` (default) | `quick-update` |
|---|---|---|
| Scouting | runs | skipped |
| Questions | re-asked; previous answers are the defaults | not asked; answers kept |
| Tools | picker (or `--tools`) | kept (or `--tools`) |
| Tiers | interactive: re-chosen. `--yes`: kept, new tools get the scout suggestion | kept; a newly added tool gets `inherit` |
| Hooks | asked again | kept |
| Files, role agents | refreshed | refreshed |

Both re-render the role agents from base config plus your `custom/` overrides. Flags such as `--set` and `--style` still apply in both. Leaving a tool out of `--tools` uninstalls it: its skills, agents and hook entry are removed (a shared `.agents/skills` stays while any tool needs it).

### Backups

`_lean/_config/files-manifest.csv` holds a sha256 for every installed file (skills, pointers, role agents, `_lean/bin`, `_lean/hooks`). Before an update overwrites anything, each file whose hash changed is copied to `_lean/_backups/<timestamp>/<same path>`, for example `_lean/_backups/2026-11-13T10-22-31-512Z/.claude/skills/lean-build/SKILL.md`. The folder is gitignored. Config files are not in the manifest: edits to `_lean/config.toml` or `config.user.toml` are overwritten without a backup. Put changes in `_lean/custom/`.

### Output

Non-interactive runs print the summary to stdout (illustrative):

```
Version   0.10.1
Tools     Claude Code
Skills    8 → .claude/skills
Agents    6 role agents (.claude/agents)
Plan CLI  node _lean/bin/lean.js check | next | freeze | metrics | claim
Hooks     claude-code:frozen-guard

Role → model
  Claude Code  orchestrator=session · scout=haiku · research=sonnet · ...
```

It also reports removed files and the backup folder.

### Examples

```bash
npx lean-method install                                    # guided
npx lean-method install --yes --tools claude-code,codex --no-scout \
  --set orchestration.tiers.claude-code.mid=sonnet \
  --set orchestration.tiers.claude-code.low=haiku
npx lean-method install --yes --tools codex --no-scout \
  --set 'orchestration.tiers.codex.low=gpt-6-luna#low'      # model#effort
npx lean-method install --action quick-update              # re-apply after editing custom/
npx lean-method install --action quick-update --set orchestration.roles.review=top
```

## scout

```bash
npx lean-method scout [--directory <path>] [--json] [--no-models]
```

| Flag | Meaning |
|---|---|
| `--json` | Print the full result as JSON (found, version, session model, models, suggestion, warnings). |
| `--no-models` | Skip listing models (skips the `opencode models` call). |

Read-only: it checks `PATH` and config folders, runs `<tool> --version`, and for OpenCode `opencode models`. It writes nothing. Output is a table (tool, found, session model, per-subagent model support, suggested mid and low), then per tool the reason for the suggestion and a few reachable models, then `Apply with: npx lean-method install`. How each tool is detected and tiers are suggested: [Supported Tools](Supported-Tools.md#how-scouting-detects-agents-and-models).

## status

```bash
npx lean-method status [--directory <path>]
```

Prints version and dates, tools, counts, `style`, folders, `primary`, the **effective** role → model per tool (all four config layers merged), and installed files you have edited. Illustrative:

```
LEAN 0.10.1 — installed 2026-11-13T10:20:02.114Z, updated 2026-11-13T10:22:31.512Z
tools: claude-code   skills: 8   role agents: 6
style: kiss   input: {project-root}/docs   output: {project-root}/plan   primary: claude-code
  claude-code: scout=haiku · research=sonnet · implement=sonnet · test=sonnet · review=sonnet · check=sonnet
no installed files edited
```

Not installed: `LEAN is not installed here. Run: npx lean-method install`.

## uninstall

```bash
npx lean-method uninstall [--directory <path>] [--all] [-y]
```

| Flag | Meaning |
|---|---|
| `--all` | Also remove `_lean/custom/`. |
| `-y, --yes` | Skip the confirmation (default answer is No). |

Steps: remove LEAN's entries from `.claude/settings.json` and `.codex/hooks.json` (the file is deleted only if LEAN's hook was all it held); remove the git pre-commit hook if it carries LEAN's marker; delete every file in `files-manifest.csv` and any folder left empty; delete everything in `_lean/` except `custom/`. Output: `Removed 214 files; kept _lean/custom/.` (illustrative count).

| Kept | Removed |
|---|---|
| your plans in the output folder, your source folder | skills, role agents, command pointers |
| `_lean/custom/` (unless `--all`) | `_lean/config*.toml`, `bin/`, `hooks/`, `_config/`, `_backups/` |
| the rest of your hook and settings files, your own pre-commit hook | LEAN's hook entries |

Uninstall does not back up files you edited, and it deletes `_lean/_backups/`. Copy what you need first (`status` lists them).

## See also

- [Getting Started](Getting-Started.md) — first install and first run.
- [Configuration](Configuration.md) — every key, overrides, manifests.
- [Supported Tools](Supported-Tools.md) — full vs basic, role agents, hooks per tool.
- [CLI Plan Tooling](CLI-Plan-Tooling.md) — the `check`, `next`, `freeze`, `claim`, `metrics` commands.
