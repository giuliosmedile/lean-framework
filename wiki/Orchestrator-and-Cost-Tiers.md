**Every LEAN skill runs as an orchestrator on your session model; bounded jobs go to cheaper worker subagents, and the orchestrator verifies what they return.**

Cheap workers generate, the expensive model judges. The rules live in `lean-kit/orchestration.md`; [lean-kit](lean-kit.md) shows the resolved values.

## Roles and default tiers

| Role | Used for | Default tier | On an Opus session | Read-only |
|---|---|---|---|---|
| orchestrator | specs, ADs, stories, triage, routing, talking to you | top | Opus (the session) | — |
| `scout` | repo sweeps, source-doc extraction, retro evidence | low | Haiku | yes |
| `research` | web research digests | mid | Sonnet | yes |
| `implement` | build the code from a frozen spec | mid | Sonnet | no |
| `test` | acceptance tests before implementation (only `security: true` or an irreversible step) | mid | Sonnet | no |
| `review` | adversarial, edge-case, verification-gap lenses | mid | Sonnet | yes |
| `check` | doc rubric, readiness check | mid | Sonnet | yes |

`orchestration.roles.<role>` overrides any row with a tier name (`top`, `mid`, `low`) or a model string.

**The orchestrator is the largest line in a build's bill**, because every worker report and every diff passes through its context. For feature-sized work (the experimental cheap profile in [The LEAN Process](The-LEAN-Process.md); see [Experiment Results](Experiment-Results.md) for what has been measured) run `lean-build` and the retro in a session on the mid-tier model, and keep the top tier for `lean-intent`, `lean-plan` and a `bad_spec` or `intent_gap` loopback.

## From tier to model

Each run resolves tiers once, in this order:

1. **Config.** `orchestration.roles` maps role to tier. `orchestration.tiers.<tool>.<tier>` maps tier to a model for the tool you are in (`claude-code`, `opencode`, `antigravity-cli`, `codex`). `npx lean-method install` writes these after scouting.
2. **Detection**, if there is no `_lean/` config or no tiers for this tool. It derives tiers from the session model:

   | Session model | top | mid | low |
   |---|---|---|---|
   | Opus | inherit | sonnet | haiku |
   | Sonnet | inherit | inherit | haiku |
   | Haiku | inherit | inherit | inherit |
   | other or unknown | inherit | inherit | inherit |

3. **Harness check.** A tool with no per-subagent model (or no subagents) gets `inherit` everywhere. The run says so once, in its first message.

`inherit` means the parent model. An invalid configured value stops the run with a question. It is never silently replaced.

| Tool | Value format |
|---|---|
| Claude Code | alias (`opus`, `sonnet`, `haiku`, `fable`) or full model id |
| OpenCode | `provider/model` |
| Antigravity CLI (AGY) | preset: `inherit`, `flash_lite`, `flash`, `pro` (Antigravity picks the model) |
| Codex | model id, optional `#effort`: `gpt-6-luna#high`, `inherit#low` |

Support levels per tool: [Supported Tools](Supported-Tools.md).

## From tier to role agent

The installer bakes each role's model into a subagent file named `lean-<role>`:

| Tool | File |
|---|---|
| Claude Code | `.claude/agents/lean-<role>.md` |
| OpenCode | `.opencode/agents/lean-<role>.md` |
| Antigravity CLI (AGY) | `.agents/agents/lean-<role>/agent.md` |
| Codex | `.codex/agents/lean-<role>.toml` (the agent is named `lean_<role>`) |

Generated Claude Code file for `scout` (body shortened):

```
---
name: lean-scout
description: "LEAN scout worker: searches code or documents ... Read-only."
model: haiku
disallowedTools: Edit, Write, NotebookEdit
---

You are a worker for a LEAN orchestrator. Do exactly the task in your prompt. Never invoke skills ...
```

- Read-only roles (`scout`, `research`, `review`, `check`) get `disallowedTools`.
- Codex agents inherit the session sandbox, so those roles are read-only by instruction. The orchestrator checks `git status` after a scout, review or check worker and reverts any change.
- A custom override reaches these files on the next `install --action quick-update`.

## How a worker is spawned

The first that applies:

1. **Role agent** `lean-<role>`. Claude Code is also given the role's model from config per call. AGY gets the resolved preset in `Model`, so overrides and escalation win over a stale file. Codex's file `model` beats any request, so for an override or escalation the orchestrator spawns the built-in `default` agent with that model and effort, with the role's instructions at the top of the prompt.
2. **Generic subagent** with the role's model, if the tool takes a per-call model.
3. **Inherit**: a plain subagent on the session model.

A worker prompt holds a one-sentence task, absolute input paths, an output shape with a length cap, and "do not invoke skills or spawn subagents". Independent workers launch in parallel; the orchestrator takes back digests, never transcripts.

## Escalation

- A worker that returns malformed output, says it could not finish, or fails the orchestrator's check is re-run **once, one tier up** (low, then mid, then top).
- Still failing at top: the orchestrator does the job itself or halts.
- In `lean-build`, the first `bad_spec` loopback (wrong approach) re-runs the implementer one tier up. An `amend` (the spec missed something) is patched in place at the same tier.
- Escalation is never silent. It is logged (see below).
- If two tiers resolve to the same model, as on a Sonnet session where `mid` and `top` are both `inherit`, a step up changes nothing.
- `orchestration.escalate` defaults to `true`.

## Never delegated

- Triage verdicts: the orchestrator verifies every finding itself.
- Anything inside `<frozen-after-approval>`, ADs and capability ids.
- Any decision put to you.

### When verification-gap findings can be trusted

Triage takes a verification-gap finding as filed, without re-checking, only if that reviewer ran at `top`. Its evidence rules make it read the tests and run the searches it cites. At any lower tier, triage re-opens the cited test and re-runs the cited search. Its `Other findings` are always verified. With the default `review = mid`, gaps are re-verified. See [Review and Triage](Review-and-Triage.md).

## Measuring the spend

Each finished build fills a `metrics:` block in the story frontmatter:

```yaml
metrics:
  models: { orchestrator: '', scout: '', test: '', implement: '', review: '' }   # model each role ran on, after escalations
  escalations: 0
  worker_tokens: null        # sum of token counts the harness reported for the workers
  orchestrator_tokens: null  # only if the harness reports the session's own usage
  started: ''                # ISO time, status went in-progress
  finished: ''               # ISO time, status went done
```

- **Tokens: report, never estimate.** Add what the harness returns for each subagent to `worker_tokens`. If the harness reports nothing, leave `null`. A guessed number poisons the comparison.
- Other skills log one line in the doc's Decision Log: `{date} — event — workers: scout=haiku×2 check=sonnet escalations=0 tokens=…`.
- `lean-method metrics` aggregates the blocks with the Review Triage Log rows. Finding counts come from those rows, never from numbers a model wrote about itself. Only `done` stories feed the numbers.

```bash
node _lean/bin/lean.js metrics --epic E2 --json
```

Illustrative output (trimmed):

```
E2 Search: 4/5 done · routes small 1 / full 3 · loops 2 (1 stories) · escalations 1 · deferred 3 · median 38 min/story
  findings 12: high 1 · medium 4 · low 3 · false 4 (33%) · maybe-false 0
  routed: patch 5 · amend 1 · defer 2 · reject 4
  adversarial       6 findings, 33% false · sonnet: 6/33% false
  tokens: workers 412,300 (4 stories)
  models: implement=sonnet×3 · review=sonnet×4
```

The false-finding rate per lens and per reviewer model shows whether a cheaper reviewer costs you accuracy. `lean-change retro` reads these numbers: a role that keeps escalating has its tier set too low.

## Changing models

| Goal | How |
|---|---|
| See what is in effect | `npx lean-method status` (role to model per tool), or ask [lean-kit](lean-kit.md) |
| See what your machine offers | `npx lean-method scout` (read-only) |
| Reviewers on the session model | `[orchestration.roles] review = "top"` in `_lean/custom/config.toml` (the interactive installer also asks) |
| Another model for scouts, just for you | `[orchestration.tiers.claude-code] low = "sonnet"` in `_lean/custom/config.user.toml` |
| One-off, scripted | `npx lean-method install --action quick-update --set orchestration.tiers.claude-code.low=haiku` |

After editing a custom file, run `npx lean-method install --action quick-update` to regenerate the role agents.

Claude Code: `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` forces one model on every subagent and defeats the tiers. `scout` warns about it.

## See also

- [lean-kit](lean-kit.md): view and edit the resolved tiers
- [Configuration](Configuration.md): the `_lean/` layers and keys
- [Review and Triage](Review-and-Triage.md): what the orchestrator verifies and why
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `metrics` and the other plan commands
- [Supported Tools](Supported-Tools.md): which tools get worker tiers
