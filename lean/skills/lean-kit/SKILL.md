---
name: lean-kit
description: 'Show or change the LEAN configuration: model tiers for subagents (cost), role agents, output style (kiss/standard), language and folders. Holds the shared orchestration and KISS rules every lean-* skill follows. Use when the user says "configure lean", "set model tiers", "which models will lean use", or "change lean style".'
---

# Lean Kit

Shared rules for all `lean-*` skills, plus the configuration view.

- `orchestration.md` — model tiers, roles, how to spawn workers, escalation, guardrails.
- `kiss.md` — engineering rules, document caps, user-output shape.

## Config

Written by `npx lean-method install`, laid out like BMAD's `_bmad/`. Read these four files in order; later keys win (tables deep-merge):

1. `{project-root}/_lean/config.toml` — team answers (installer-managed)
2. `{project-root}/_lean/config.user.toml` — your answers and model tiers (installer-managed, gitignored)
3. `{project-root}/_lean/custom/config.toml` — team overrides (never touched by the installer)
4. `{project-root}/_lean/custom/config.user.toml` — personal overrides (never touched)

Replace `{project-root}` in values with the project root. Keys:

| Key | Meaning | Default when missing |
|---|---|---|
| `core.user_name` | how to address the user | don't use a name |
| `core.communication_language` | language for talking to the user | the conversation's language |
| `core.document_output_language` | language for written docs | same as above |
| `core.input_folder` | the user's source documents (briefs, PRDs, notes, transcripts, research, mockups) — wherever a skill says `docs/`, use this folder | `{project-root}/docs` |
| `core.output_folder` | where plans live — wherever a skill says `plan/`, use this folder | `{project-root}/plan` |
| `lean.style` | `kiss` or `standard` | `kiss` |
| `orchestration.roles.<role>` | tier (`top`/`mid`/`low`) or model per worker role | see orchestration.md §2 |
| `orchestration.tiers.<harness>.<tier>` | model for that tier in that tool | detected (orchestration.md §1) |
| `orchestration.escalate` | re-run failed workers one tier up | `true` |
| `loop.verify` | list of shell commands `lean-loop` runs from the project root before it starts and after every story (whole test suite, linter) | none (reported as unset) |

No `_lean/` folder (skills linked by hand)? Use the defaults; everything still works.

## Layout

The one definition of where files live. Every skill uses these paths. `docs/` means `core.input_folder`, and `plan/` means `core.output_folder`.

```
docs/                             the user's source documents — LEAN reads, never writes
plan/
  SPEC.md                         project: what & why — CAP-n, QR-n                       (lean-intent)
  UX.md                           optional                                                  (lean-intent)
  ARCHITECTURE.md                 project invariants — modules, AD-n                        (lean-architecture)
  epics.yaml                      epic index — id · title · goal · caps · depends_on · status (lean-plan)
  deferred.md                     cross-epic and ad-hoc deferred items
  changes/                        course-change proposals                                   (lean-change)
  adhoc/<slug>.md                 build specs for unplanned work                            (lean-build)
  epics/<E>-<slug>/               one folder per epic, e.g. epics/E2-search/
    EPIC.md                       goal, exit criterion, team/lanes, epic-scoped ADs         (lean-plan)
    stories.yaml                  order and structure only — id · title · lane · depends_on (lean-plan)
    stories/<id>-<slug>.md        the story AND its build spec; status lives here, only here
    CONTRACTS.md                  only when the epic runs 2+ lanes                          (lean-plan)
    deferred.md                   this epic's deferred items
    retro.md                      when the epic is done                                     (lean-change)
```

Rules:
- **`docs/` is input only.** Skills read it and cite what they used (a file path, plus a section where it helps) in the doc's `sources:` frontmatter or Decision Log. They never create, edit, move, or delete anything in it; everything LEAN writes goes to `plan/`. Large files go to a `scout` worker for extraction rather than being loaded whole.
- **Ids are global.** Epics are `E1`, `E2`, …; stories are `<epic>-<n>` (`E2-3`), with `E2-0` for an epic's contracts story and `E2-C1` for its contract changes. They're never renumbered or reused, so cross-epic `depends_on` and commit messages stay unambiguous.
- **Status has one home.** A story's status is the `status` in its `.md` frontmatter (`todo | draft | ready | in-progress | in-review | done | blocked | retired`; `retired` stories stay listed but don't count). `stories.yaml` has no status. `epics.yaml` holds only the epic's own status (`planned | active | done`). In lane work, the copy on the integration branch is authoritative; a lane branch may lag until it merges. Who is building a story right now is a claim (`lean-method claim`), not a status.
- **Read only what's needed.** "What next" reads `epics.yaml` plus the active epic(s). A build reads one story file, its `EPIC.md` (and `CONTRACTS.md`), and the CAP/AD ids it cites. Finished epics are left alone.
- **Always this tree,** even for a single epic: one layout, one code path.

## CLI — mechanics are scripts, not tokens

Anything a script can decide, the script decides. Skills run these instead of working it out by reading:

| Command | Replaces |
|---|---|
| `lean-method check [--epic E2]` | tree consistency, id/status/lane validity, dependency order and cycles, CAP coverage, seam owners, overdue decisions, frozen-intent hashes, build-spec size |
| `lean-method check --story E2-3` | one story before review: its file, frozen block, size, open dependencies, and lane **trespass** since `baseline_commit` |
| `lean-method next [--lane A]` | "what's next": in-flight, blocked, and the next ready story per epic and lane |
| `lean-method freeze --story E2-3` (or `--file`) | records the hash of the `<frozen-after-approval>` block; `check` fails if it changes later |
| `lean-method metrics [--epic E2] [--json]` | counting review findings, loops, escalations, tokens, and time across stories |
| `lean-method claim --story E2-3 --owner <name>` (`--release`, `--list`) | deciding by hand who's building what: an atomic lock (a git ref) so parallel agents never take the same story |
| `lean-method freeze --story E2-3 --tests a,b` (`--unlock`, `--unlock-tests`) | trusting the implementer not to touch the acceptance tests it must pass |

**How to call it:** wherever a skill says `lean-method <cmd>`, run `node {project-root}/_lean/bin/lean.js <cmd>`. The installer puts it there with its dependencies, so it needs nothing but Node. Without an install, use `lean-method <cmd>` (global) or `npx --no-install lean-method <cmd>` (devDependency). Add `--directory {project-root}` when not running from the root. If none runs, do the same check by reading, as the skill describes, and say once that the CLI is missing (`npx lean-method install` fixes it).

**Guard hook (Claude Code, Codex):** the installer can add a PreToolUse hook that refuses any edit (Edit/Write, or Codex's `apply_patch`) that would change frozen intent or a frozen acceptance test of a story in progress. When it blocks you, its message says why; don't work around it with shell edits. Renegotiate (intent) or judge the test (tests), unlock, edit, freeze again.

**Reading the result:** `✖` errors must be fixed (or put to the user) before the step that needed the check; `▲` warnings are reported, not blocking. Never edit a file just to silence a finding you haven't understood. Use `--json` when you need to act on the findings one by one.

## Cheap profile: feature-sized work

A spec with at most three capabilities and no irreversible step is built the cheap way. Same checks, fewer sessions and fewer workers:

| Step | What | Session model |
|---|---|---|
| `lean-intent` | the spec and its decisions | top |
| `lean-plan` | one epic, one *feature story*, no questions | top |
| `lean-build: next story` | small route, tests written with the code, one review of the feature (adversarial + verification-gap, + security at a trust boundary) | **mid** |
| `lean-change retro` | short retro (one table) | **mid** |

Frozen acceptance tests and a separate `test` worker stay for `security: true` and irreversible steps. A `bad_spec` or `intent_gap` loopback, or a failed implementer, moves the build to the top tier (`orchestration.md` §4). Epics with several stories keep one review at the end of the last story and a security pass on earlier stories that cross a trust boundary (`lean-build` step 4).

## Every lean skill, on start

1. Read `{skill-root}/../lean-kit/kiss.md` and `{skill-root}/../lean-kit/orchestration.md`.
2. Read the config above once, and resolve style, language, output folder, and tiers. Don't announce them unless something fell back to `inherit` for a reason the user should know.

## When invoked directly

1. Resolve the configuration as above. Note which role agents exist (`.claude/agents/lean-*.md`, `.opencode/agents/lean-*.md`, `.agents/agents/lean-*/agent.md` for AGY, `.codex/agents/lean-*.toml` for Codex) and their `model:` (Codex: `model` + `model_reasoning_effort`). AGY uses `orchestration.tiers.antigravity-cli` presets rather than full model IDs; the actual model is selected by Antigravity.
2. Show one table: role · tier · model · source (`_lean/config…` file, custom override, role agent, detected, or inherit — and why). Flag a role agent whose model disagrees with the config (it's stale).
3. Ask, using the kiss question shape, what to change.
4. Apply changes:
   - personal model choices → `_lean/custom/config.user.toml`
   - team choices (style, roles) → `_lean/custom/config.toml`
   - then tell the user to run `npx lean-method install --action quick-update`, which regenerates the role agents.

   To re-scout the machine for agents and models, the user runs `npx lean-method scout`, or `install` for the guided choice.
