**`lean-kit` shows and changes the LEAN configuration, and holds the shared rules every other `lean-*` skill loads.**

You rarely start it. The other skills read its files on start. You invoke it to answer "which models will LEAN use?" or to change them.

## What it contains

```
skills/lean-kit/
  SKILL.md          config keys, plan layout, CLI contract, the "when invoked directly" flow
  orchestration.md  model tiers, worker roles, spawning, escalation, guardrails, spend log
  kiss.md           engineering rules, document caps, reply shape
```

Every `lean-*` skill does two things on start:

1. Reads `kiss.md` and `orchestration.md`.
2. Reads the config once and resolves style, language, output folder and tiers. It announces nothing unless a tier fell back to `inherit` for a reason you should know.

Details live elsewhere: [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md), [KISS Style](KISS-Style.md), [Artifacts and Layout](Artifacts-and-Layout.md) (the `plan/` tree, defined in `SKILL.md`), [CLI Plan Tooling](CLI-Plan-Tooling.md) (how skills call `check`, `next`, `freeze`, `claim`, `metrics`).

## What the skill reads

Four files, in order. Later keys win and tables deep-merge:

| # | File | Scope | Touched by installer |
|---|---|---|---|
| 1 | `_lean/config.toml` | team answers (committed) | yes |
| 2 | `_lean/config.user.toml` | your answers and model tiers (gitignored) | yes |
| 3 | `_lean/custom/config.toml` | team overrides | never |
| 4 | `_lean/custom/config.user.toml` | personal overrides (gitignored) | never |

Keys the config view cares about: `lean.style`, `orchestration.roles.<role>`, `orchestration.tiers.<tool>.<tier>`, `orchestration.escalate`. The full key list is on [Configuration](Configuration.md).

No `_lean/` folder (skills linked by hand)? Defaults apply and everything still runs.

## What you can ask it

| Say | What happens |
|---|---|
| "configure lean", "which models will lean use" | it shows the table below |
| "set model tiers" | it changes the model behind `mid` or `low` |
| "run reviewers on my session model" | it sets `orchestration.roles.review = "top"` |
| "change lean style" | it sets `lean.style` to `kiss` or `standard` |

When invoked directly, `lean-kit`:

1. Resolves the config and lists the role agents that exist, with their `model:` (Codex: `model` plus `model_reasoning_effort`). AGY shows presets, not model ids.
2. Shows one table: role, tier, model, source. The source is a `_lean/` config file, a custom override, a role agent, detection, or `inherit`, with the reason.
3. Flags any role agent whose model disagrees with the config. That agent is stale.
4. Asks what to change, in the [KISS reply shape](KISS-Style.md#the-reply-shape).
5. Writes the change (next section).

Illustrative reply:

```
**lean-kit · config** — claude-code · style kiss

| role | tier | model | source |
|---|---|---|---|
| scout | low | haiku | _lean/config.user.toml |
| research, implement, test, check | mid | sonnet | _lean/config.user.toml |
| review | top | inherit | _lean/custom/config.toml |

Decide:
1. Change anything? — (a) no ← recommended  (b) models  (c) style

Next: answer like `1a`.
```

## Where changes go

| Kind of change | File it writes |
|---|---|
| personal model choices | `_lean/custom/config.user.toml` |
| team choices (style, roles) | `_lean/custom/config.toml` |

It never edits the installer-managed files. Afterwards it tells you to run:

```bash
npx lean-method install --action quick-update   # regenerates the role agents, keeps all answers
```

Examples of what lands in the custom files:

```toml
# _lean/custom/config.toml (team)
[lean]
style = "standard"

[orchestration.roles]
review = "top"          # reviewers on the session model
```

```toml
# _lean/custom/config.user.toml (personal)
[orchestration.tiers.claude-code]
low = "sonnet"          # scouts on Sonnet instead of Haiku
```

To re-scout the machine for agents and models without changing anything, run `npx lean-method scout`. Run `npx lean-method install` for the guided choice. Both are covered on [CLI Installer](CLI-Installer.md).

## Rules it fixes for all skills

- **Config layering** as above, so every skill resolves the same values.
- **Layout:** `docs/` is input only (LEAN never writes it); everything LEAN writes goes under `plan/`. Both names are the `core.input_folder` and `core.output_folder` keys.
- **Mechanics are scripts, not tokens:** skills run the plan CLI (`node _lean/bin/lean.js <cmd>`) instead of working things out by reading. `✖` errors must be fixed or put to you; `▲` warnings are reported, not blocking.
- **Guard hook:** in Claude Code and Codex, a hook can refuse edits to frozen intent. See [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## See also

- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): what the tiers and roles in the table mean
- [KISS Style](KISS-Style.md): the `lean.style` setting and the reply shape
- [Configuration](Configuration.md): every key and layer
- [CLI Installer](CLI-Installer.md): `install`, `scout`, `status`
