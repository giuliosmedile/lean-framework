# Orchestration — cheap workers, expensive judge

Every lean skill runs as an **orchestrator**: the session model holds the intent, makes decisions, judges worker output, and talks to the user. Bounded jobs go to **worker subagents** on a cheaper model tier. Quality comes from the orchestrator verifying what workers return, not from workers being expensive.

## 1. Resolve tiers (once per run)

1. **Config** — read the merged `_lean/` config (`SKILL.md` → *Config*): `orchestration.roles` maps each role to a tier, and `orchestration.tiers.<harness>` maps `top`/`mid`/`low` to models for the tool you're running in (`claude-code`, `opencode`, …). `npx lean-method install` writes these after scouting the machine.
2. **Detect** — if there is no `_lean/` config, or no tiers for this harness, derive them from the session model:

   | Session model | top | mid | low |
   |---|---|---|---|
   | Opus | inherit | sonnet | haiku |
   | Sonnet | inherit | inherit | haiku |
   | Haiku | inherit | inherit | inherit |
   | anything else / unknown | inherit | inherit | inherit |

3. **Harness check** — if the subagent tool can't take a per-call model (or has no subagents at all), every tier is `inherit`. Say so once in the run's first message.

`inherit` = omit the model parameter. In Claude Code the values are the Agent tool's `model` aliases (`opus`, `sonnet`, `haiku`, …) or full model ids. In OpenCode they are `provider/model` strings.

**How to spawn a worker** (first that applies):
1. **Role agent** — if the harness has an agent named `lean-<role>` (the installer writes them into `.claude/agents/` or `.opencode/agents/`, carrying the role's model), spawn that agent. In Claude Code, also pass the role's model from config as the per-call model, so overrides in `_lean/custom/` win even if the agent file is stale.
2. **Generic subagent + model** — no role agent, but the harness takes a per-call model: spawn a general-purpose subagent with the role's model.
3. **Inherit** — neither: spawn a plain subagent on the session model.

## 2. Roles → default tier

| Role | Used by | Tier | Why |
|---|---|---|---|
| `scout` | repo sweeps, source-doc extraction, retro evidence | low | read and summarize; the orchestrator re-checks what it uses |
| `research` | web research digests | mid | needs judgment about sources |
| `implement` | build implementation | mid | works from a frozen, explicit spec |
| `review` | adversarial, edge-case, verification-gap lenses | mid | the orchestrator verifies every finding |
| `check` | doc rubric, readiness check | mid | the orchestrator decides what to act on |
| *(orchestrator)* | specs, ADs, stories, triage, routing, user dialogue | top | the judgment layer — never delegated |

`orchestration.roles` in `_lean/` config can override any row (a tier name or a model string).

## 3. Dispatch contract

Every worker prompt contains, and only contains:

- **Task** — one sentence.
- **Inputs** — absolute file paths (never pasted file contents unless the harness can't read files).
- **Output shape** — exact format and a length cap ("≤ 15 bullets", "JSON array").
- **Limits** — *"Do not invoke skills or spawn subagents. Return your result as text in your final message."*

Launch independent workers in parallel in one turn and wait for all of them. Take back digests; never pull a worker's full transcript into your context.

## 4. Escalation

- A worker returns malformed output, says it couldn't finish, or its result fails the orchestrator's check → re-run it **once at the next tier up** (low → mid → top). If it still fails at top, the orchestrator does the job itself or HALTs.
- In `lean-build`: a `bad_spec` loopback re-runs the implementer at the same tier; a second loopback on the same story escalates the implementer one tier.
- Never escalate silently: record it in the run's log line (below).

## 5. Guardrails — what never moves down a tier

- Triage verdicts (`../lean-review/triage.md`): the orchestrator verifies every finding itself.
- Writing anything inside `<frozen-after-approval>`, ADs, or capability IDs.
- Any decision put to the user.
- Verification-gap findings count as "pre-verified" only when that reviewer ran at `top`. At any lower tier, triage verifies them like every other finding.

## 6. Log the spend

Record which tier did what, so runs can be compared. The point is a number someone can aggregate, not a sentence.

- `lean-build`: the story's frontmatter `metrics:` block (`lean-build/assets/story-spec-template.md`): the model each role actually ran on after escalations, the escalation count, `started`/`finished`, and tokens. `lean-method metrics` aggregates it, together with the Review Triage Log rows (verdict and false-positive rate per lens and per reviewer model).
- **Tokens: report, never estimate.** When the harness returns usage for a subagent (Claude Code's Agent tool result does), add it to `worker_tokens`. Fill `orchestrator_tokens` only if the harness shows the session's own usage. Otherwise leave `null`: a guessed number poisons the comparison.
- Other skills: one line in the doc's Decision Log — `{date} — event — workers: scout=haiku×2 check=sonnet escalations=0 tokens=…`.
