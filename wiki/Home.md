**LEAN - LEAN Eliminates Agent Noise.** A streamlined, orchestrator-first method for building software with AI coding agents. This wiki explains the process, every skill, every command and the ideas behind them. It describes LEAN **0.10.2**.

## What LEAN is

Nine skills, a plan CLI and an installer. You install them into a project and talk to your agent as usual. The agent:

1. asks what you want and writes it down (`lean-intent`);
2. records only the design decisions that matter (`lean-architecture`);
3. breaks the work into small stories (`lean-plan`);
4. builds each story from a frozen spec, with its tests, and has independent reviewers check the finished feature (`lean-build`);
5. handles change and closes epics against evidence (`lean-change`).

Everything passes between steps as files on disk, so any step can run in a fresh session.

## What "noise" means

LEAN is derived from the BMAD method, keeps its backbone (what / how / doing, file handoffs, adversarial review) and removes the overhead around it: persona routing, activation boilerplate repeated in every skill, requirements re-copied from document to document, finalize ceremonies, "[C] to continue" menus, a shared sprint-status file. See [LEAN vs BMAD](LEAN-vs-BMAD.md).

## Start here

| If you want to… | Read |
|---|---|
| Understand the whole process in five minutes | [The LEAN Process](The-LEAN-Process.md) |
| Install LEAN and run it | [Getting Started](Getting-Started.md) |
| See a full run on a small feature | [Walkthrough Example](Walkthrough-Example.md) |
| Not sure which skill to use | [lean-help](lean-help.md) and the [FAQ](FAQ.md) |

## The skills

| Skill | Page |
|---|---|
| `lean-intent`: idea → SPEC | [lean-intent](lean-intent.md) |
| `lean-architecture`: SPEC → invariants | [lean-architecture](lean-architecture.md) |
| `lean-plan`: SPEC → epics and stories | [lean-plan](lean-plan.md) |
| `lean-build`: story → reviewed code | [lean-build](lean-build.md) |
| `lean-loop`: an epic's stories, unattended, each gated by static checks | [lean-loop](lean-loop.md) |
| `lean-review`: independent review of any diff or doc | [lean-review](lean-review.md) |
| `lean-change`: course corrections and retros | [lean-change](lean-change.md) |
| `lean-kit`: shared rules and configuration | [lean-kit](lean-kit.md) |
| `lean-help`: routing and "what next" | [lean-help](lean-help.md) |

## The ideas

- [Artifacts and Layout](Artifacts-and-Layout.md): the `plan/` tree, ids, statuses.
- [Review and Triage](Review-and-Triage.md): blind lenses, verify-then-route, loopbacks.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): frozen specs, frozen tests, claims, hooks.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): expensive judge, cheap workers.
- [Parallel Teams](Parallel-Teams.md): lanes and contracts.
- [KISS Style](KISS-Style.md): the default rules for code, documents and replies.

## Reference

- [CLI: Plan Tooling](CLI-Plan-Tooling.md): `check`, `next`, `freeze`, `claim`, `metrics`.
- [CLI: Installer](CLI-Installer.md): `install`, `scout`, `status`, `uninstall`.
- [Configuration](Configuration.md): the `_lean/` config layers.
- [Supported Tools](Supported-Tools.md): Claude Code, Codex, OpenCode, Antigravity CLI and the rest.
- [Glossary](Glossary.md): CAP, QR, AD, lane, seam, frozen, triage…
- [Experiment Results](Experiment-Results.md): LEAN against BMAD on three features, and what `lean-lite` has and has not shown.
- [Development](Development.md): repository layout, tests, contributing.

## Status

LEAN is an experiment: can the BMAD method be streamlined without losing its core? It is on npm as `lean-method`. The [comparison protocol](LEAN-vs-BMAD.md#comparison-protocol) says how to measure it, and [Experiment Results](Experiment-Results.md) reports the runs so far: 0.8.0 matched BMAD's quality at a higher cost; 0.10.2 with the cheap profile (`lean-lite`, from 0.9.0) cost 59% as much and took 64% of the time on a fourth feature, with quality not shown to match. Overall: inconclusive.
