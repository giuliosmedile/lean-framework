# LEAN Method

A streamlined take on the BMAD method (derived from v6.12.4). Same backbone — separate *what* from *how* from *doing*, hand off through files, review adversarially — with roughly a tenth of the instruction weight and far fewer stop-and-approve moments.

## Install

Same model as BMAD: one `npx` command per project.

```bash
npx lean-method install            # interactive: scouts your agents, asks, installs
npx lean-method scout              # read-only: which agents and models are on this machine, suggested tiers
npx lean-method status             # installed version, tools, effective role → model, files you've edited
npx lean-method uninstall          # removes what it installed; keeps _lean/custom/ and your plans
```

Plan tooling: deterministic, no model involved. The skills call these instead of spending tokens on bookkeeping. `install` copies them into `_lean/bin/` with their three dependencies (~660 KB), so they run with plain Node, no npm:

```bash
node _lean/bin/lean.js check [--epic E2]          # lint the plan tree — exit 1 on errors
node _lean/bin/lean.js check --story E2-3         # one story: frozen intent, contract fields and tests intact, spec size, open deps, baseline, lane trespass, review window, AC tests
node _lean/bin/lean.js next [--lane A]            # in-flight, claimed, blocked, and the next ready story per epic and lane
node _lean/bin/lean.js freeze --story E2-3 --via checkpoint|plan [--tests a,b]   # hash the approved frozen block and contract fields (and lock the acceptance tests)
node _lean/bin/lean.js claim --story E2-3 --owner me       # atomic lock so parallel agents never take the same story
node _lean/bin/lean.js metrics [--epic E2] --json # loops, escalations, findings by verdict / lens / reviewer model, tokens, time
```

The same commands are on the package (`npx lean-method check …`).

**Hooks** (asked at install, removed by uninstall):
- **Guard (Claude Code and Codex, on by default):** a PreToolUse hook that refuses any edit changing a story's frozen intent, its frozen contract fields, a `baseline_commit` already set, or a frozen acceptance test while its story is being built. Claude Code: merged into `.claude/settings.json` next to your own settings, on Edit/MultiEdit/Write. Codex: merged into `.codex/hooks.json`, on `apply_patch` (the guard applies the patch in memory and checks the result); Codex runs project hooks only after you trust them once with `/hooks`. Prose asks the model to behave; the hook makes it. (Shell edits aren't intercepted; `check --story` still catches them.)
- **Git pre-commit (off by default, `--git-hook`):** runs `check` and blocks a commit that leaves the plan inconsistent. Never overwrites an existing pre-commit hook.

**Support levels.** `full`: Claude Code, Codex, OpenCode and Antigravity CLI (AGY), where worker tiers, blind parallel review and the fresh-context implementer work. Codex workers take a model id plus an optional reasoning effort (`gpt-6-luna#high`); its custom agents inherit the session's sandbox, so read-only roles are read-only by instruction. AGY workers accept only `inherit`, `flash_lite`, `flash` and `pro` presets; Antigravity chooses the underlying models, which can change. Every other target (`--list-tools` shows the level) is `basic`: the skills install and run, but on one model and with review in the same context. The installer says so when you pick one.

What `install` does:

1. **Scouts** the machine for coding agents (Claude Code, OpenCode, AGY, Codex, Gemini CLI, Cursor). For each one it finds the session model where available, whether it can give a subagent its own model, and the available models or presets. It then suggests mid/low worker tiers; sibling models guessed from the session id are flagged "verify".
2. Asks which **tools** to install for (same 50 targets as BMAD, detected ones pre-selected), then the **questions** in `src/module.yaml`: name, project, languages, input folder (`docs`), plans folder (`plan`), style.
3. **Helps you choose tiers** per tool: shows role → tier, the suggestion and why, and lets you pick models (or type one). Also asks whether reviewers should run on the session model.
4. **Installs**:
   - the skills into each tool's skills folder;
   - OpenCode command pointers;
   - **role agents** (`lean-scout`, `lean-implement`, `lean-test`, `lean-review`, `lean-check`, `lean-research`) in `.claude/agents/`, `.opencode/agents/`, `.agents/agents/` for AGY, or `.codex/agents/*.toml` for Codex (named `lean_<role>` there), each carrying its model or preset;
   - the plan CLI in `_lean/bin/` and the guard hook in `_lean/hooks/`;
   - the `_lean/` config and the manifests.

Non-interactive, as in BMAD: `--yes --tools claude-code,opencode --set orchestration.tiers.claude-code.low=haiku --set style=standard`. Run `--list-tools` and `--list-options` for the valid values. On an existing install, `--action update` re-asks with your previous answers as defaults, and `--action quick-update` keeps them.

```
_lean/
  config.toml            team answers (installer-managed, commit it)
  config.user.toml       your answers + model tiers (installer-managed, gitignored — models depend on your machine)
  custom/config.toml     team overrides — never touched by the installer
  custom/config.user.toml personal overrides — never touched
  _config/               manifest.yaml · skill-manifest.csv · files-manifest.csv (sha256 per installed file)
  _backups/<timestamp>/  installed files you had edited, saved before an update overwrote them
  bin/                   the plan CLI (lean.js) + its vendored dependencies — commit it with the skills
  hooks/                 frozen-guard.js (PreToolUse hook for Claude Code and Codex)
```

Not on the npm registry yet. From a local checkout: `npm pack` in `lean/`, then `npx --package=./lean-method-0.10.1.tgz lean-method install`.

## The flow

```
            ┌──────────────┐   ┌────────────────────┐   ┌────────────┐   ┌──────────────────┐
 idea ────▶ │ lean-intent  │──▶│ lean-architecture  │──▶│ lean-plan  │──▶│ lean-build  (×N) │──▶ shipped
            │  SPEC.md     │   │  ARCHITECTURE.md   │   │ epics/…    │   │ story file+code  │
            └──────────────┘   └────────────────────┘   └────────────┘   └──────────────────┘
                   ▲                 (optional for                              │
                   │                  small work)                               ▼
                   └──────────────────── lean-change (course | retro) ◀── deferred.md, triage logs

 lean-loop   — runs lean-build over an epic's stories unattended; a story is accepted only if the static checks pass.
 lean-review — standalone review of any diff or planning doc; also supplies the lenses build uses.
 lean-kit    — shared rules every skill loads (orchestration + KISS) and the config view.
 lean-help   — routes a request to the right skill (runs it when the fit is clear) and explains LEAN; start here when unsure.
```

## Orchestrator pattern & cost tiers

Every skill is an **orchestrator** on the session model. Bounded jobs go to cheaper **workers**; the orchestrator verifies what they return. Cheap workers generate, the expensive model judges.

| Role | Default tier | On an Opus session |
|---|---|---|
| orchestrator: specs, ADs, stories, triage, everything said to the user | top | Opus |
| `implement`, `test`, `review`, `check`, `research` | mid | Sonnet |
| `scout` (repo sweeps, doc extraction, retro evidence) | low | Haiku |

- **Tiers** are chosen at install time after scouting, and stored per tool in `_lean/config.user.toml`. They're also baked into the role agents, which the skills spawn by name (`lean-<role>`). Without an install, tiers are detected from the session model. Unknown models and tools without per-subagent model selection fall back to `inherit`.
- **Escalation:** a worker that fails or returns bad output is re-run once a tier up. The implementer moves up a tier on the first bad-spec loopback (a wrong approach); an `amend` (the spec missed something) is patched in place.
- **Guardrails:** triage, frozen intent, ADs, IDs and user decisions are never delegated. Verification-gap findings are trusted without re-checking only when that reviewer ran at top.
- **Spend is measured:** each build fills a `metrics:` block in its story file (model per role, escalations, tokens as the harness reports them, start/finish). `lean-method metrics` aggregates it with the Review Triage Log rows, so cost and review quality per tier are numbers, not impressions.
- Run `lean-kit` ("configure lean") to see or change the resolved tiers.
- **Feature-sized work** (a spec of at most three capabilities and no irreversible step) takes the **cheap profile**: one epic and one story, the small route on a mid-tier session (the orchestrator's session is the largest line in the bill), tests written with the code, one review of the whole feature, a short retro. Frozen tests with a separate `test` worker stay for `security: true` and irreversible steps; for an epic of several stories, the review runs once at the end of the last story, or earlier when the unreviewed diff passes `review.max_diff_lines` (default 1,500 changed lines). See `lean-kit` → *Cheap profile*, and `lean-build` step 4. **Experimental:** it has been run once, on one feature, for cost and time only; its quality is not yet measured ([Experiment Results](https://github.com/giuliosmedile/lean-framework/wiki/Experiment-Results)).

## Unattended: `lean-loop`

`lean-loop` builds an epic's stories back to back: `next` → `claim` → `lean-build --auto` → gates → next. The counterpart of BMAD's `bmad-loop` orchestrator, but a skill, not a program: the session is the controller, so the safety comes from the gates, not from keeping the model out of the loop. After every build it re-checks the story with scripts instead of trusting the report:

| Gate | Static check |
|---|---|
| status | read from the story file: `done` |
| plan | `check --story --json`: no errors, and the warnings that mean a step was skipped or a record can't be trusted (`story/frozen-unhashed`, `story/contract-unhashed`, `story/no-baseline`, `story/baseline-unknown`, `story/no-triage-log`, `story/triage-vocab`, `story/review-due`, `story/security-untested`, `diff/no-git`) |
| frozen tests | each `frozen_tests` SHA-256 re-computed (`check` stops looking once a story is `done`) |
| verification | the story's `## Verification` commands, plus `loop.verify` (whole suite, linter) re-run by the loop |
| commit | clean tree and a commit since `baseline_commit` |

A story that fails a gate is parked (`blocked` + the failing gate as `blocked_reason`), its commits are left alone, and the loop continues with independent stories. It stops at the story cap (`--max-stories`, default 3), two parked stories in a row, a dirty tree, nothing ready, or the end of the epic, which it never closes: that needs a human's exit evidence. Preflight refuses to start on an inconsistent plan, a dirty tree, or a `loop.verify` that is unset (unless `--allow-no-verify`) or red. It writes no state of its own; run it again to resume.

## Parallel teams: lanes and contracts

When planning an epic, `lean-plan` asks how many people (or agents) will work on it at once. Lanes and contracts are per epic: one epic can run three lanes, the next a single one. With one, nothing changes. With two or more:

```
                ┌─ lane A: A1 → A2 → A3 ─┐
 E2-0 ──────────┼─ lane B: B1 → B2 ──────┼── checkpoints (per seam, as soon as both sides are real) ── exit: fixture end to end
 contracts      └─ lane C: C1 → C2 → C3 ─┘
 fakes, fixtures, contract tests, boundary test, walking skeleton
```

- **Lanes = module ownership** (from ARCHITECTURE.md's module table); lanes share only the contracts package.
- **Story `<E>-0`** freezes the epic's seams: types, one producer-owned fake per port, oracle fixtures checked against the real schema, abstract contract tests, a boundary test, and a **walking skeleton** that runs the fixture through every fake end to end.
- **Every seam has an owner for its real implementation, value rules, and a checkpoint story.** Contract changes after the freeze go through `lean-change` as an `<E>-C<n>` story; lanes never patch contracts locally.

Modelled on a real epic (three lanes, a contracts-first story). The plan added what that epic's integration brief, seam fixes, and course corrections showed was missing:

| What went wrong there | Added here |
|---|---|
| A port nobody owned (composition glue); the wiring story appeared late | Every seam needs a real-impl owner; the skeleton wires the composition root on day 1 |
| Seams broke on values the types allowed (empty filter, dates as strings, parallel edges) | Value rules per seam, pinned by contract tests |
| Two incompatible fakes under one name | Exactly one fake per port, owned by the producer |
| Fixtures used fields the real catalog didn't have | Fixtures checked against the real schema in `<E>-0` |
| Lanes merged after weeks; drift found on merge day | Merge after every story; per-seam checkpoints; skeleton always green |
| Decisions "due before story X" never taken | Decisions due, each with a decide-by story; status flags overdue ones |

## KISS by default

`kiss` (default) or `standard`, chosen at install (`lean.style` in `_lean/config.toml`). Full rules in `skills/lean-kit/kiss.md`.

- **Engineering:** simplest thing that passes acceptance; reuse before adding; no speculative abstraction, config or dependencies; boring tech; delete before adding. Enforced at review: the adversarial lens hunts `over-engineering:` and triage routes it as a patch.
- **Documents:** hard length caps (e.g. a ½-page hobby spec, ≤ 7 ADs, ≤ 1,000-token build specs); bullets and tables only.
- **Talking to you:** ≤ 12 lines per message in one fixed shape (status line → table → numbered questions with lettered options, so you can answer `1a 2b` → `Next:`). No narration.
- **Optional wording rules:** `lean.prose = "ste80"` (off by default; `--set prose=ste80`) adds simplified technical English, about 80% of ASD-STE100, to replies and documents: short active sentences, condition first, one term per thing. It sits on top of either style, applies to English text only, and never overrides the caps. Rules in `skills/lean-kit/ste.md`.
- **Dirty ≠ unverified:** KISS cuts polish, never checks. Acceptance, frozen intent, gating of irreversible steps and review all stay.

Minimum path for a small change: `lean-build` alone (freeform intent).
Minimum path for a feature: `lean-intent` → `lean-plan` → `lean-build` per story.
Full path for a product or anything with independently built parts: add `lean-architecture`.

## Artifacts — a tree, not one big file

```
docs/                      your source documents (core.input_folder) — read by LEAN, never written
plan/
  SPEC.md                  what and why, project-wide (lean-intent)
  UX.md                    optional: look + behavior (lean-intent)
  ARCHITECTURE.md          project invariants + module table (lean-architecture)
  epics.yaml               thin epic index: id · title · goal · caps · depends_on · status (lean-plan)
  deferred.md              cross-epic and ad-hoc deferred items
  changes/                 course-change proposals (lean-change)
  adhoc/<slug>.md          build specs for unplanned work (lean-build)
  epics/E2-search/
    EPIC.md                goal, exit criterion, team/lanes, epic-only ADs (lean-plan)
    stories.yaml           order and structure only — no status (lean-plan)
    stories/E2-3-<slug>.md the story AND its build spec; status lives here only (lean-plan → lean-build)
    CONTRACTS.md           only when this epic runs 2+ lanes (lean-plan)
    deferred.md            this epic's deferred findings
    retro.md               when the epic is done (lean-change)
```

- **`docs/` in, `plan/` out.** The installer asks for both folders (defaults `docs`, `plan`; they must differ). Skills read source material from `docs/`, cite it in `sources:`, and write only to `plan/`.
- **One home for status.** Each story's frontmatter holds its status; nothing else does. Parallel lanes never conflict on a shared status file, which is the merge conflict BMAD's single `sprint-status.yaml` caused in practice.
- **Cost stays flat as the project grows.** "What next" reads `epics.yaml` plus the active epic. A build reads one story file plus what it cites. Done epics are never reopened.
- **Just-in-time stories.** Only the next epic gets detailed stories; later epics keep a one-line goal until they're up.
- **Global ids:** `E2`, `E2-3`, `E2-0` (contracts), `E2-C1` (contract change), never reused.
- **The canonical layout lives in `skills/lean-kit/SKILL.md` → Layout**; every skill points there.

Every planning doc ends with a `## Decision Log` — append-only, one line per decision with its reason. That replaces BMAD's separate `.memlog.md` + script: resuming a run means reading the doc.

## Mapping from BMAD

| BMAD skill(s) | Lean | What changed |
|---|---|---|
| product-brief, prd, spec, prfaq, forge-idea, ux | **lean-intent** | One output (SPEC.md, optional UX.md). Fast path by default, coaching on request. Optional pressure-test round replaces PRFAQ/forge. Length scales with stakes. |
| architecture | **lean-architecture** | Spine concept kept intact. Finalize ceremony → one independent review. |
| create-epics-and-stories, sprint-planning (+ readiness gate) | **lean-plan** | Stories *reference* CAP/AD ids instead of re-extracting requirements. Epic tree (`epics.yaml` → `epics/<E>/stories.yaml` + one file per story); each epic's list approved in one pass; stories planned just in time. Status lives in each story file — no sprint-status.yaml, no script. Readiness check closes each epic plan. |
| build, build-auto | **lean-build** | Kept nearly whole. Story acceptance seeds the spec (no re-authoring). Spec checkpoint only when the story asks for it or something needs a human. `--auto` replaces build-auto. |
| review, code-review, build review-prompts | **lean-review** | One copy of each lens + the triage rules, shared with build. |
| correct-course, retrospective | **lean-change** | Two modes, one short skill. |
| help | **lean-help** | Routes the request: runs the matching skill when the fit is clear, otherwise recommends one; reads plan state for "what next"; explains LEAN from a bundled guide. |
| customize | **lean-kit** | Config view + overrides in `_lean/custom/`. |
| project-context | **lean-change** retro | Narrowed: each retro proposes ≤ 3 evidence-backed pitfalls for `AGENTS.md`/`CLAUDE.md`, written only when you approve. |
| walkthrough | **lean-build** finish | Narrowed: a ≤ 5-bullet `## How to review` in the story file (where the logic lives, what's risky, how to try it). |
| qa-generate-e2e-tests | **lean-build** | When a story has `security: true` or an irreversible step, acceptance tests are written first by a `test` worker and frozen; otherwise the implementer writes them with the code. The verification-gap lens catches what's still untested. |
| agent-* personas, party-mode, advanced-elicitation, brainstorming, deep-recon | — | Dropped. See below. |

## What was cut, and why

- **Activation boilerplate** (config resolver, customize.toml merge, prepend/append hooks, greet-by-name) — repeated in 26 skills, adds tokens and latency to every run. Language and paths are just conventions now.
- **Personas** — they carry no process; they routed to skills and added theater.
- **Repeated requirement extraction** — BMAD re-copies every FR into epics.md, then again into an epic-context file, then again into each build spec. Lean references IDs and copies only a story's own acceptance criteria into its build spec.
- **Per-document finalize ceremony** (memlog audit, per-input reconciliation subagents, parallel reviewer gate, polish pass, HTML reports) — replaced by one self-check plus one independent reviewer, scaled to stakes.
- **Step-file "[C] to continue" menus and per-story approvals** — replaced by batch review.
- **Sprint tracking script and file** — each story file's `status` does the same job without a shared file.
- **Ideation zoo** (brainstorm, forge, PRFAQ, deep-recon) — lean-intent has one optional pressure-test round and optional research. Use any external brainstorming you like; feed the result to lean-intent.

## Kept deliberately (the core)

1. Elicit intent from the human; tag every inference `[ASSUMPTION]`.
2. Architecture as invariants only (Binds / Prevents / Rule).
3. Small single-goal build specs with frozen, human-owned intent and an Open Questions gate; lines the agent added without a human seeing them are tagged `[ASSUMPTION]` and stay open to review.
4. Implementation in a fresh subagent with the spec as sole source of truth.
5. Three blind, parallel reviewers (plus a security lens at trust boundaries) + verify-then-route triage (intent_gap / bad_spec / amend / patch / defer) with loopback.
6. Readiness check before building; deferred-work log; a defined path for mid-flight change.
7. Acceptance tests written before the code by a separate worker, frozen, and enforced, where a mistake is expensive (`security: true` or an irreversible step).
8. An epic is accepted only on demonstrated exit evidence (an e2e test or a demo you watched).

## Risks to watch in the experiment

The reviewer-tier and loopback risks show up in `lean-method metrics --json` (findings and false rate per reviewer model, intent_gap / bad_spec routes, loops); compare epics run with different settings. Drift from bad stories and clean resumes still need judgment in the retro.

- Batch story approval may let drift through → readiness check is the mitigation; measure defects traced to bad stories.
- Cheaper reviewers may miss real bugs (BMAD insisted reviewers run at session level). Triage filters false positives but can't recover missed findings → compare defects found per story at `review: mid` vs `review: top`.
- KISS caps may squeeze out a load-bearing detail → watch for intent_gap loopbacks traced to a spec that hit its cap.
- Skipping the spec checkpoint by default → watch for intent_gap loopbacks in build.
- Decision Log inside docs instead of a memlog → watch whether interrupted runs resume cleanly.

## Comparing against BMAD

The metrics only mean something against a baseline. [COMPARISON.md](COMPARISON.md) is the protocol: the same small feature built twice (BMAD and LEAN), same spec and model, and what to record.

## Development

```bash
cd lean && npm install && npm test        # installer tests + plan tooling tests (check, freeze, next, metrics, trespass)
node tools/installer/lean-cli.js install  # run the installer from the checkout
```

Skills read shared files from their siblings (`lean-kit`, `lean-review`); the installer always installs all nine together.
