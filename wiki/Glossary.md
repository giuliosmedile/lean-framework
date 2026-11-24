**Every term LEAN uses, in one line each, with the page that owns the detail.**

## Documents and ids

| Term | Meaning | Detail |
|---|---|---|
| `docs/` | Your source documents (`core.input_folder`). LEAN reads them and never writes them. | [Artifacts and Layout](Artifacts-and-Layout.md) |
| `plan/` | Everything LEAN writes (`core.output_folder`). | [Artifacts and Layout](Artifacts-and-Layout.md) |
| `_lean/` | Per-project config, manifests, the plan CLI (`bin/`) and the guard hook (`hooks/`). | [Configuration](Configuration.md) |
| SPEC | `plan/SPEC.md`: what and why, project-wide. Written by `lean-intent`. | [lean-intent](lean-intent.md) |
| CAP-n | A capability in the SPEC: what the product must do, with a testable success line. | [lean-intent](lean-intent.md) |
| QR-n | A quality requirement in the SPEC. It carries a number, not an adjective. | [lean-intent](lean-intent.md) |
| UJ-n | A user journey in the SPEC. Only when the product earns one. | [lean-intent](lean-intent.md) |
| `[ASSUMPTION]` | Tag on every inference the skill made without being told. Listed for you to confirm. In a story frozen without a checkpoint you never see the list, so reviewers may challenge those lines. | [lean-intent](lean-intent.md) |
| ARCHITECTURE | `plan/ARCHITECTURE.md`: the module table and the architecture decisions. | [lean-architecture](lean-architecture.md) |
| AD-n | Architecture decision. Records only what two independently built parts could get wrong. Fields: Binds, Prevents, Rule. | [lean-architecture](lean-architecture.md) |
| Epic (`E2`) | A milestone the user can see. Has a folder with `EPIC.md` and `stories.yaml`. | [lean-plan](lean-plan.md) |
| Story (`E2-3`) | One user-facing goal. The story file is also its build spec; its `status` is the only status. | [lean-plan](lean-plan.md) |
| Decision Log | Append-only `## Decision Log` at the end of every planning doc. Replaces a separate memory log. | [Artifacts and Layout](Artifacts-and-Layout.md) |
| Deferred | Findings routed `defer`, appended to the epic's or the project's `deferred.md`. | [Review and Triage](Review-and-Triage.md) |
| Ad hoc | Unplanned work. Its spec is `plan/adhoc/<slug>.md`. | [lean-build](lean-build.md) |

## Building and reviewing

| Term | Meaning | Detail |
|---|---|---|
| Frozen intent | The `<frozen-after-approval>` block of a story. Hashed by `freeze`; changed only if you renegotiate. | [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) |
| Contract fields | The story fields frozen with the block: `caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests`, `approved_via`. Hashed into `contract_sha256`. | [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) |
| `approved_via` | `checkpoint`: you saw the frozen block. `plan`: you approved only the plan stub, and the agent wrote the rest. Written by `freeze --via`. | [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) |
| Feature story | The only story of an epic, covering all its CAPs; `lean-plan` writes one for a feature-sized spec (at most three CAPs, nothing irreversible). Small route, build-spec cap doubled. | [lean-plan](lean-plan.md) |
| Frozen tests | Acceptance tests written first by a `test` worker (only for `security: true` or an irreversible step), then locked with `freeze --tests`. | [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) |
| Guard hook | A PreToolUse hook (Claude Code, Codex) that refuses edits to frozen intent, frozen contract fields, a `baseline_commit` already set, and frozen tests. | [Frozen Intent and Guards](Frozen-Intent-and-Guards.md) |
| Claim | An atomic lock on a story, a local git ref. Stops two agents on one clone building the same story. | [CLI: Plan Tooling](CLI-Plan-Tooling.md) |
| Small route / full route | Small: no gaps, nothing irreversible, a small footprint or a feature story; minimal spec. Full: complete spec, Edge-Case Matrix. | [lean-build](lean-build.md) |
| Spec checkpoint | The point where `lean-build` asks you to approve a spec. Only when needed. | [lean-build](lean-build.md) |
| Open Questions | Intent gaps the spec cannot settle. They block coding until you answer. | [lean-build](lean-build.md) |
| Edge-Case Matrix | Table of edge cases in a full-route spec; every row needs a passing test. | [lean-build](lean-build.md) |
| `baseline_commit` | The commit a build started from, written once. `check --story` measures the diff against it. | [CLI: Plan Tooling](CLI-Plan-Tooling.md) |
| Review window | The diff the next feature review covers: since the first story built after the last one with `review: feature`. A review is due at the epic's final story, or earlier once the window passes `review.max_diff_lines`. | [lean-build](lean-build.md) |
| `AC-n` | The number of an acceptance criterion in a build spec. Each test names its criterion as `<story id> AC-n`; `check --story` warns when one has no test. | [lean-build](lean-build.md) |
| Lens | One reviewer's brief: `adversarial`, `edge-case`, `verification-gap`, `security`, `doc-rubric`. | [Review and Triage](Review-and-Triage.md) |
| Blind review | Reviewers see only the lens and the content, never the conversation or each other. | [Review and Triage](Review-and-Triage.md) |
| Triage | The orchestrator verifies each finding, then routes it. Never delegated. | [Review and Triage](Review-and-Triage.md) |
| Route | Where a finding goes: `intent_gap`, `bad_spec`, `amend`, `patch`, `defer`, or `reject`. | [Review and Triage](Review-and-Triage.md) |
| Loopback | A return to an earlier build step after `intent_gap` or `bad_spec`. More than 3 halts the build. | [Review and Triage](Review-and-Triage.md) |
| Review Triage Log | The `| # | lens | verdict | route | evidence |` table in a story. `metrics` reads it. | [Review and Triage](Review-and-Triage.md) |
| Exit evidence | An end-to-end test that passed, or a demo you watched. An epic is accepted only with it. | [lean-change](lean-change.md) |
| Course | `lean-change course`: a proposal of old → new edits when something changed mid-flight. | [lean-change](lean-change.md) |
| Retro | `lean-change retro`: an evidence-based review of a finished epic. | [lean-change](lean-change.md) |
| Pitfall | A one-line lesson (at most 3 per retro) added to `AGENTS.md` or `CLAUDE.md` only when you approve. | [lean-change](lean-change.md) |

## Orchestration

| Term | Meaning | Detail |
|---|---|---|
| Orchestrator | The session model. Decides, verifies, talks to you. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| Worker | A subagent on a cheaper tier given one bounded job. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| Role | A worker job: `scout`, `research`, `implement`, `test`, `review`, `check`. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| Tier | `top`, `mid` or `low`: mapped per tool to a model. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| `inherit` | Use the parent's model. The fallback when a tool cannot pick a subagent model. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| Role agent | An installed agent named `lean-<role>` (`lean_<role>` on Codex) that carries its model. | [Supported Tools](Supported-Tools.md) |
| Escalation | Re-running a failed worker once, one tier up. | [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md) |
| Support level | `full` (tiers, blind review, fresh-context implementer) or `basic` (one model, same-context review). | [Supported Tools](Supported-Tools.md) |
| KISS | The default style: simplest passing code, capped documents, short replies. | [KISS Style](KISS-Style.md) |

## Parallel teams

| Term | Meaning | Detail |
|---|---|---|
| Lane | One person's or agent's slice of an epic, following module ownership. | [Parallel Teams](Parallel-Teams.md) |
| Seam | A port or type that crosses a lane boundary. Has an owner, value rules and a checkpoint. | [Parallel Teams](Parallel-Teams.md) |
| Value rules | What a seam does on empty, null, odd formats and errors. Pinned by contract tests. | [Parallel Teams](Parallel-Teams.md) |
| `CONTRACTS.md` | The epic's frozen seams. Exists only when the epic runs 2+ lanes. `contracts: lite` or `full`. | [Parallel Teams](Parallel-Teams.md) |
| `<E>-0` | The contracts story: types, fakes, fixtures, contract tests, boundary test, walking skeleton. | [Parallel Teams](Parallel-Teams.md) |
| `<E>-C<n>` | A contract change after the freeze, landed as one small shared story. | [Parallel Teams](Parallel-Teams.md) |
| Fake | The one stand-in for a port, owned by the lane that produces it. | [Parallel Teams](Parallel-Teams.md) |
| Oracle fixture | Sample data checked against the real schema. | [Parallel Teams](Parallel-Teams.md) |
| Walking skeleton | A test that runs the fixture end to end through every fake. Stays green. | [Parallel Teams](Parallel-Teams.md) |
| Trespass | A lane story changing files outside its lane's modules, or the contracts, fakes or fixtures. `check --story` flags it. | [Parallel Teams](Parallel-Teams.md) |

## See also

- [The LEAN Process](The-LEAN-Process.md): how these pieces fit in order.
- [Artifacts and Layout](Artifacts-and-Layout.md): where each document lives.
- [FAQ](FAQ.md): common questions in plain language.
