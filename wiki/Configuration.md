**LEAN reads four TOML files in `_lean/`; later files win. The installer writes the first two, you write the last two.**

## The four layers

| # | File | Written by | Holds | Git |
|---|---|---|---|---|
| 1 | `_lean/config.toml` | installer, every install | team answers: project, document language, folders, style, roles | commit |
| 2 | `_lean/config.user.toml` | installer, every install | your name, your language, model tiers per tool | ignored |
| 3 | `_lean/custom/config.toml` | you; created once, never touched again | team overrides | commit |
| 4 | `_lean/custom/config.user.toml` | you; same | personal overrides | ignored |

Merge rules: tables deep-merge key by key; a scalar or list in a later file replaces the earlier value. A file that is missing or fails to parse counts as empty, silently, so a TOML typo drops that whole layer. With no `_lean/` folder the skills use their defaults.

Model tiers live in the user file because model access depends on your machine. Layers 1 and 2 begin with "regenerated on every install — treat as read-only": hand edits there are overwritten with no backup.

## Questions asked at install

Defined in `lean/src/module.yaml`. A flag skips its question; re-installing offers your previous answer as the default.

| Key | Question | Default | Flag | File |
|---|---|---|---|---|
| `core.user_name` | What should the skills call you? | OS user name | `--user-name` | 2 |
| `core.project_name` | What is your project called? | folder name | `--set project_name=…` | 1 |
| `core.communication_language` | Language for talking with you? | English | `--communication-language` | 2 |
| `core.document_output_language` | Language for documents? | English | `--document-output-language` | 1 |
| `core.input_folder` | Folder with your source documents | `docs` | `--input-folder` | 1 |
| `core.output_folder` | Folder for plans and specs | `plan` | `--output-folder` | 1 |
| `lean.style` | Default working style | `kiss` | `--style` | 1 |

- Folder answers are stored as `{project-root}/docs`; skills replace `{project-root}`. LEAN reads the input folder and never writes to it. The two folders must differ, and both are created at install. Layout: [Artifacts and Layout](Artifacts-and-Layout.md).
- `kiss`: simplest code, short docs, replies of 12 lines or fewer. `standard`: same engineering rules, relaxed length caps. See [KISS Style](KISS-Style.md). Values are not validated by the installer.

## Orchestration keys

Set by tier selection or `--set`, not by plain questions.

| Key | Values | Installer default |
|---|---|---|
| `orchestration.roles.<role>` | `top`, `mid`, `low`, or a model string | `scout=low`; `research`, `implement`, `test`, `review`, `check` = `mid` |
| `orchestration.tiers.<tool>.top` | always the session model | `inherit` |
| `orchestration.tiers.<tool>.mid` | model for implement, test, review, check, research | scout suggestion, else `inherit` |
| `orchestration.tiers.<tool>.low` | model for scouts | scout suggestion, else `inherit` |
| `orchestration.escalate` | `true` or `false`: re-run a failed worker one tier up | `true` |
| `orchestration.primary` | tool ID, informational | first of `claude-code`, `opencode`, `codex` you installed, else your first tool |

`<tool>` is a tool ID (`claude-code`, `codex`, `opencode`, `antigravity-cli`). What the tiers mean: [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md). Value syntax per tool: [Supported Tools](Supported-Tools.md#tier-values-per-tool).

What the installer writes (illustrative, from the real generator):

```toml
# _lean/config.toml
[core]
project_name = "shop"
document_output_language = "English"
input_folder = "{project-root}/docs"
output_folder = "{project-root}/plan"

[lean]
style = "kiss"

[orchestration]
primary = "claude-code"
escalate = true

[orchestration.roles]
scout = "low"
research = "mid"
implement = "mid"
test = "mid"
review = "mid"
check = "mid"
```

```toml
# _lean/config.user.toml
[core]
user_name = "Ada"
communication_language = "English"

[orchestration.tiers.claude-code]
top = "inherit"
mid = "sonnet"
low = "haiku"
```

## Override a tier or a role

Put overrides in `_lean/custom/`; the installer never edits them.

```toml
# _lean/custom/config.user.toml  (personal)
[orchestration.tiers.claude-code]
low = "sonnet"
```

```toml
# _lean/custom/config.toml  (team)
[lean]
style = "standard"

[orchestration.roles]
review = "top"      # reviewers run on the session model
```

Then re-apply:

```bash
npx lean-method install --action quick-update
npx lean-method status        # check the effective role → model
```

- Each worker's model is written into its role-agent file, so the files must be regenerated. Quick-update renders them from layers 1 and 2 plus your overrides, without copying the overrides into layers 1 and 2.
- `lean-kit` shows role, tier, model and source in one table, flags a stale agent file, and writes personal choices to layer 4 and team choices to layer 3 for you. See [lean-kit](lean-kit.md).
- Custom beats everything. If a `--set` seems ignored, look in `custom/`.
- `--set` changes the installer-managed answer instead (`--set orchestration.roles.review=top`) and becomes the default next time.

| After you... | Run |
|---|---|
| edited `custom/*.toml` | `install --action quick-update` |
| want new answers or a re-scout (new model, new machine, new tool) | `install --action update` |
| cloned a repo without your `config.user.toml` | `install --action update` (scouts, sets tiers). Quick-update does not scout: tiers stay `inherit`. |

Details of both actions: [CLI Installer](CLI-Installer.md#update-vs-quick-update).

## Manifests and other files in `_lean/`

```
_lean/
  config.toml  config.user.toml  custom/{config.toml,config.user.toml}
  _config/manifest.yaml  skill-manifest.csv  files-manifest.csv
  _backups/<timestamp>/    edited files saved before an update
  bin/                     plan CLI with its dependencies (`node _lean/bin/lean.js …`)
  hooks/frozen-guard.js    the guard hook script
  .gitignore               rewritten on every install
```

| Manifest | Holds | Used by |
|---|---|---|
| `manifest.yaml` | version, install and update dates, tools, target folders, skills, role-agent paths, hooks | `status`, update, uninstall |
| `files-manifest.csv` | `type,path,hash` (sha256) for each installed file | edit detection, backups, clean removal |
| `skill-manifest.csv` | `canonicalId,name,description,path` per skill | reference only; the CLI writes it and never reads it |

Do not edit them.

## Git

`_lean/.gitignore` contains exactly `*.user.toml` and `_backups/`. The installer adds no other ignore rules.

- **Commit:** `_lean/config.toml`, `_lean/custom/config.toml`, `_lean/_config/`, `_lean/bin/`, `_lean/hooks/`, the skills folders, the plan folder.
- **Ignored by default:** both `*.user.toml` files and the backups.
- **Role agents** (`.claude/agents/lean-*.md` and the like) carry one machine's models. If teammates use different models, each puts theirs in `custom/config.user.toml` and runs quick-update.

## See also

- [CLI Installer](CLI-Installer.md) — flags, `--set`, update vs quick-update.
- [Supported Tools](Supported-Tools.md) — tier syntax and role-agent files per tool.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) — what top, mid and low do.
- [lean-kit](lean-kit.md) — view and change the config from inside the agent.
