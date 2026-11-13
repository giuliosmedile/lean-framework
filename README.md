<h1 align="center">LEAN - LEAN Eliminates Agent Noise</h1>

<p align="center">
  <a href="https://github.com/giuliosmedile/lean-framework/wiki">Wiki</a> ·
  <a href="https://github.com/giuliosmedile/lean-framework/wiki/Getting-Started">Getting started</a> ·
  <a href="https://github.com/giuliosmedile/lean-framework/wiki/The-LEAN-Process">The process</a> ·
  <a href="https://github.com/giuliosmedile/lean-framework/wiki/LEAN-vs-BMAD">LEAN vs BMAD</a>
</p>

LEAN is a streamlined, orchestrator-first method for building software with AI coding agents. It is a set of eight skills, a small CLI and an installer. You install it into a project, then talk to your agent as usual: it follows the method, hands work between sessions through files on disk, and reviews its own output adversarially before anything ships.

It keeps the backbone of the [BMAD method](https://github.com/bmad-code-org/BMAD-METHOD) (it is derived from v6.12.4): separate **what** from **how** from **doing**, hand off through files, review adversarially. It drops the ceremony around that backbone, which is the "agent noise" of the name: activation boilerplate repeated in every skill, requirements re-copied five times, finalize rituals, step menus, per-story approvals. Measured at 0.7.0, LEAN's skills hold 22.7k words against 197.7k for BMAD's 29 ([how it was counted](https://github.com/giuliosmedile/lean-framework/wiki/LEAN-vs-BMAD#measured-size)).

> **Status: an experiment.** Version 0.7.0. Not on the npm registry yet. Whether LEAN matches BMAD's quality for less cost and less of your time is an open question; the repo ships the [comparison protocol](https://github.com/giuliosmedile/lean-framework/wiki/LEAN-vs-BMAD) and the metrics to answer it.

## The flow

```
            ┌──────────────┐   ┌────────────────────┐   ┌────────────┐   ┌──────────────────┐
 idea ────▶ │ lean-intent  │──▶│ lean-architecture  │──▶│ lean-plan  │──▶│ lean-build  (×N) │──▶ shipped
            │  SPEC.md     │   │  ARCHITECTURE.md   │   │ epics/…    │   │ story file+code  │
            └──────────────┘   └────────────────────┘   └────────────┘   └──────────────────┘
                   ▲                 (optional for                              │
                   │                  small work)                               ▼
                   └──────────────────── lean-change (course | retro) ◀── deferred.md, triage logs
```

| Skill | Job |
|---|---|
| `lean-intent` | Turns an idea into `SPEC.md` (capabilities, quality requirements, non-goals), optional `UX.md`. Every guess is tagged `[ASSUMPTION]`. |
| `lean-architecture` | Records only the decisions that keep separately built parts consistent: `ARCHITECTURE.md`. Optional for small work. |
| `lean-plan` | Breaks the SPEC into epics, then into small story files. Asks how many people or agents work in parallel and plans lanes and contracts if more than one. |
| `lean-build` | Builds one story: frozen spec, tests first, fresh-context implementer, three blind reviewers, triage, loopback. |
| `lean-review` | Standalone review of any diff or planning document. Supplies the review lenses `lean-build` uses. |
| `lean-change` | `course`: handle a change mid-flight. `retro`: close an epic against evidence. |
| `lean-kit` | Shared rules (orchestration, KISS) and the configuration view. |
| `lean-help` | Routes a request to the right skill, answers "what next", explains LEAN. Start here when unsure. |

Small change? `lean-build` alone. A feature? `lean-intent` → `lean-plan` → `lean-build` per story. A product? Add `lean-architecture`. Details: [The LEAN Process](https://github.com/giuliosmedile/lean-framework/wiki/The-LEAN-Process).

## Ideas that matter

- **Intent comes from you.** Skills ask; they do not invent. Once approved, a story's intent is frozen with a hash, and a hook refuses edits to it. → [Frozen Intent and Guards](https://github.com/giuliosmedile/lean-framework/wiki/Frozen-Intent-and-Guards)
- **Cheap workers generate, the expensive model judges.** Your session model orchestrates; scouts, implementers, testers and reviewers run on cheaper tiers, and the orchestrator verifies what they return. → [Orchestrator and Cost Tiers](https://github.com/giuliosmedile/lean-framework/wiki/Orchestrator-and-Cost-Tiers)
- **Review routes problems to their source.** Blind parallel reviewers, then verify-then-route triage: `intent_gap`, `bad_spec`, `amend`, `patch`, `defer`. → [Review and Triage](https://github.com/giuliosmedile/lean-framework/wiki/Review-and-Triage)
- **Mechanics are scripts, not tokens.** Plan linting, "what next", freezing, claims and metrics are deterministic commands. → [CLI: Plan Tooling](https://github.com/giuliosmedile/lean-framework/wiki/CLI-Plan-Tooling)
- **Parallel teams work from contracts.** Lanes follow module ownership; a contracts story freezes the seams before anyone builds. → [Parallel Teams](https://github.com/giuliosmedile/lean-framework/wiki/Parallel-Teams)
- **KISS by default.** The simplest code that passes acceptance, hard length caps on documents, replies of 12 lines or fewer. → [KISS Style](https://github.com/giuliosmedile/lean-framework/wiki/KISS-Style)
- **Files, not chat history.** One status per story, in the story file; a tree of small documents so cost stays flat as the project grows. → [Artifacts and Layout](https://github.com/giuliosmedile/lean-framework/wiki/Artifacts-and-Layout)

## Quick start

Requires Node 20.19 or newer and a supported agent. Until the package is published, install from a checkout:

```bash
git clone https://github.com/giuliosmedile/lean-framework.git
cd lean-framework/lean && npm install
node tools/installer/lean-cli.js install --directory /path/to/your/project
```

The installer scouts the coding agents and models on your machine, asks a few questions (project, languages, `docs/` and `plan/` folders, style, model tiers), and installs the skills, role agents, config in `_lean/` and the plan CLI. Then open your agent in the project (restart it if it was running) and name a skill in your message:

```
Use lean-help: what should I do first?
Use lean-intent. I want CSV export in my notes app.
Use lean-build: the signup form accepts "a@b" as an email. Reject it.
```

The first asks for routing, the second starts a feature from an idea, the third is a small change with no planning.

Full walkthrough, flags and a non-interactive install: [Getting Started](https://github.com/giuliosmedile/lean-framework/wiki/Getting-Started).

## Supported tools

| Level | Tools | What you get |
|---|---|---|
| **full** | Claude Code, Codex, OpenCode, Antigravity CLI | worker model tiers, blind parallel review, fresh-context implementer; the frozen-intent guard hook on Claude Code and Codex |
| **basic** | every other target the installer knows | skills install and run on one model, with review in the same context |

See [Supported Tools](https://github.com/giuliosmedile/lean-framework/wiki/Supported-Tools).

## Repository layout

| Path | What it is |
|---|---|
| [`lean/`](lean/) | **The LEAN package** (`lean-method`): skills, installer, plan CLI, tests. Its own [README](lean/README.md) is the package reference. |
| [`wiki/`](wiki/) | Source copy of the pages of the [project wiki](https://github.com/giuliosmedile/lean-framework/wiki). |
| git history, commit `b6cf242` | The BMAD 6.12.4 install LEAN was derived from and is measured against (`_bmad/`, `.claude/skills/bmad-*`, `.agents/`, `.opencode/`). Not part of LEAN, and not in the working tree: recover it with `git archive b6cf242 .claude _bmad`. |

## Documentation

The [wiki](https://github.com/giuliosmedile/lean-framework/wiki) explains the process page by page:

| | |
|---|---|
| **Start** | [Getting Started](https://github.com/giuliosmedile/lean-framework/wiki/Getting-Started) · [The LEAN Process](https://github.com/giuliosmedile/lean-framework/wiki/The-LEAN-Process) · [Walkthrough Example](https://github.com/giuliosmedile/lean-framework/wiki/Walkthrough-Example) |
| **Skills** | [lean-intent](https://github.com/giuliosmedile/lean-framework/wiki/lean-intent) · [lean-architecture](https://github.com/giuliosmedile/lean-framework/wiki/lean-architecture) · [lean-plan](https://github.com/giuliosmedile/lean-framework/wiki/lean-plan) · [lean-build](https://github.com/giuliosmedile/lean-framework/wiki/lean-build) · [lean-review](https://github.com/giuliosmedile/lean-framework/wiki/lean-review) · [lean-change](https://github.com/giuliosmedile/lean-framework/wiki/lean-change) · [lean-kit](https://github.com/giuliosmedile/lean-framework/wiki/lean-kit) · [lean-help](https://github.com/giuliosmedile/lean-framework/wiki/lean-help) |
| **Concepts** | [Artifacts and Layout](https://github.com/giuliosmedile/lean-framework/wiki/Artifacts-and-Layout) · [Review and Triage](https://github.com/giuliosmedile/lean-framework/wiki/Review-and-Triage) · [Frozen Intent and Guards](https://github.com/giuliosmedile/lean-framework/wiki/Frozen-Intent-and-Guards) · [Orchestrator and Cost Tiers](https://github.com/giuliosmedile/lean-framework/wiki/Orchestrator-and-Cost-Tiers) · [Parallel Teams](https://github.com/giuliosmedile/lean-framework/wiki/Parallel-Teams) · [KISS Style](https://github.com/giuliosmedile/lean-framework/wiki/KISS-Style) |
| **Reference** | [CLI: Plan Tooling](https://github.com/giuliosmedile/lean-framework/wiki/CLI-Plan-Tooling) · [CLI: Installer](https://github.com/giuliosmedile/lean-framework/wiki/CLI-Installer) · [Configuration](https://github.com/giuliosmedile/lean-framework/wiki/Configuration) · [Supported Tools](https://github.com/giuliosmedile/lean-framework/wiki/Supported-Tools) · [Glossary](https://github.com/giuliosmedile/lean-framework/wiki/Glossary) |
| **More** | [LEAN vs BMAD](https://github.com/giuliosmedile/lean-framework/wiki/LEAN-vs-BMAD) · [FAQ](https://github.com/giuliosmedile/lean-framework/wiki/FAQ) · [Development](https://github.com/giuliosmedile/lean-framework/wiki/Development) |

## Development

```bash
cd lean && npm install && npm test        # installer tests + plan tooling tests
node tools/installer/lean-cli.js --help   # run the CLI from the checkout
```

More in [Development](https://github.com/giuliosmedile/lean-framework/wiki/Development).

## License

`lean/package.json` declares MIT.
