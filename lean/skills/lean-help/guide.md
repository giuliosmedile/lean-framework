# LEAN — user guide

## 1. What LEAN is

A streamlined method for building software with AI agents, derived from BMAD v6.12. It keeps BMAD's backbone:
- separate *what* (spec) from *how* (architecture) from *doing* (build);
- hand work between sessions through files on disk;
- review adversarially before anything ships.

It drops most of BMAD's ceremony. There are 8 skills instead of 29, and about 19k words of instructions instead of 180k.

## 2. Which path to take

| Situation | Path |
|---|---|
| Small change, bug fix | `lean-build` alone |
| A feature | `lean-intent` → `lean-plan` (epics, then the first epic's stories) → `lean-build` per story |
| A product, or parts built separately | `lean-intent` → `lean-architecture` → `lean-plan` → `lean-build` per story |
| 2+ people in parallel on an epic | as above; `lean-plan` gives that epic lanes, a `CONTRACTS.md` and story `<E>-0` |
| Something changed mid-way | `lean-change course` |
| An epic finished | `lean-change retro` (writes the epic's `retro.md`), then `lean-plan` on the next epic |
| Not sure | `lean-help` |

Each skill can run in a fresh session: everything it needs is in the files.

## 3. Files — a tree

```
docs/                             YOUR source documents (core.input_folder) — LEAN reads, never writes
plan/                             (the folder name comes from core.output_folder)
  SPEC.md            project: what & why — capabilities CAP-n, quality QR-n, non-goals, Decision Log
  UX.md              optional: look, flows, states
  ARCHITECTURE.md    project: modules, decisions AD-n (Binds / Prevents / Rule), Deferred
  epics.yaml         epic index: id · title · goal · caps · depends_on · status
  deferred.md        cross-epic and ad-hoc deferred items
  changes/           course-change proposals
  adhoc/<slug>.md    build specs for unplanned work
  epics/E2-search/   one folder per epic
    EPIC.md          goal, exit criterion, team/lanes, epic-only decisions
    stories.yaml     order and structure only: id · title · lane · depends_on
    stories/E2-3-…md the story AND its build spec — its status lives here, only here
    CONTRACTS.md     only if the epic runs 2+ lanes
    deferred.md      this epic's deferred items
    retro.md         written when the epic is done
```

- **`docs/` is yours, `plan/` is LEAN's.** Drop briefs, PRDs, notes, transcripts, research, and mockups into `docs/`. `lean-intent` lists them and asks which apply; `lean-architecture` looks there for existing design docs. Every skill cites what it used in `sources:`, and none of them ever writes to `docs/`. A new file in `docs/` after the SPEC exists is flagged by `lean-help` as a possible update.
- **Ids are global and stable:** `E2`, `E2-3`, `E2-0` (contracts story), `E2-C1` (contract change), CAP/QR/AD. They are never renumbered and never reused.
- **Story status lives only in the story file:** `todo | draft | ready | in-progress | in-review | done | blocked | retired`. There's no shared status file, so two people finishing two stories never conflict.
- **Big projects stay cheap:** "what next" reads `epics.yaml` plus the active epic; a build reads one story file plus what it cites; finished epics are never reopened.
- **Stories are planned just in time:** `lean-plan` details only the next epic; the others keep a one-line goal until it's their turn.
- Every planning doc ends with an append-only **Decision Log**, which is how a run is resumed.

## 4. The ideas that matter

- **Intent comes from you.** Skills ask; they don't invent. Every guess is tagged `[ASSUMPTION]` and listed for you to confirm.
- **Architecture records only invariants.** These are the decisions two independently built stories could otherwise get wrong in incompatible ways.
- **Stories point, they don't copy.** A story references CAP/AD ids and holds only its own acceptance criteria.
- **Build specs freeze intent.** Once a spec is approved, the `<frozen-after-approval>` part changes only if you renegotiate it. Open questions block coding.
- **Review routes problems back to their source.** Three blind reviewers run in parallel. Each finding is verified, then sent to one of four places:
  - `intent_gap` → back to you
  - `bad_spec` → fix the spec, redo the code
  - `patch` → fix now
  - `defer` → `deferred.md`
- **The spec checkpoint is conditional.** Build asks you to approve its spec only when there are open questions, something can't be undone, the story is marked `checkpoint: spec`, or the work is unplanned.

## 5. Orchestrator and cost

The session model is the **orchestrator**: it writes specs, decides, verifies, and talks to you. Bounded jobs go to cheaper **workers**:

| Role | Default tier | E.g. on an Opus session |
|---|---|---|
| orchestrator | top | Opus |
| implement · review · check · research | mid | Sonnet |
| scout (search, extraction) | low | Haiku |

- **Role agents.** The installer creates `lean-<role>` agents in `.claude/agents/` and `.opencode/agents/`, each carrying its model. The skills spawn them by name.
- **Escalation.** A worker that fails is re-run once, one tier up.
- **Never delegated:** triage of findings, frozen intent, IDs, and decisions put to you.
- **Spend is logged.** Each build fills a `metrics:` block in the story file (models per role, escalations, tokens when the harness reports them, start/finish); `lean-method metrics` adds them up, together with the review findings by verdict, lens and reviewer model.
- **Changing models:** run `lean-kit`, or edit `_lean/custom/config.user.toml` and then run `npx lean-method install --action quick-update`.

## 6. KISS

The default style is `kiss` (alternative: `standard`).

- **Code:** the simplest thing that passes acceptance. Reuse before adding. No speculative abstraction, config or dependency. Reviewers flag `over-engineering:` and triage routes it as a patch.
- **Documents:** hard length caps, bullets and tables.
- **Replies to you:** at most 12 lines, in a fixed shape: status → table → numbered questions with lettered options (answer `1a 2b`) → `Next:`.
- **Dirty ≠ unverified.** KISS cuts polish, never checks.

## 7. Parallel teams

When planning an epic, `lean-plan` asks how many people (or agents) will work on it at once. Lanes and contracts are per epic, so one epic can run with three lanes and the next with one. With two or more:

- **Lanes follow module ownership** from ARCHITECTURE.md. Lanes share only the contracts package.
- **Story `<E>-0` comes first.** It delivers:
  - contract types, and one fake per port, owned by the producing lane;
  - oracle fixtures, checked against the real schema;
  - contract tests and a boundary test;
  - a **walking skeleton** that runs the fixture end to end through the fakes.
- **Every seam has an owner** for its real implementation, value rules (empty, null, formats, errors), and a **checkpoint** story that runs as soon as both sides are real.
- **Lanes merge after every story**, and the skeleton stays green.
- **Contract changes** after the freeze go through `lean-change course` as a small shared `<E>-C<n>` story. Every lane then rebases.

## 8. LEAN vs BMAD

| BMAD | LEAN |
|---|---|
| product-brief, prd, spec, prfaq, forge-idea, ux | `lean-intent` |
| architecture | `lean-architecture` (same "spine" idea, lighter finalize) |
| create-epics-and-stories, sprint-planning, readiness check | `lean-plan` (an epic tree instead of one epics file + sprint-status.yaml; + lanes and contracts) |
| build, build-auto | `lean-build` (`--auto`) |
| review, code-review | `lean-review` (one copy of the lenses) |
| correct-course, retrospective | `lean-change` |
| customize | `lean-kit` |
| help | `lean-help` |
| agent personas, party-mode, brainstorming, deep-recon, advanced-elicitation, walkthrough, qa-e2e, project-context | dropped |

**Main cuts:**
- the startup boilerplate repeated in every skill;
- rewriting requirements five times;
- the per-document finalize ceremony;
- "[C] to continue" menus and per-story approvals;
- the sprint YAML script.

## 9. Install and config

```bash
npx lean-method install     # scouts agents, asks questions, helps you pick model tiers, installs
npx lean-method scout       # read-only: agents, models, suggested tiers
npx lean-method status      # what's installed, effective role → model, files you've edited
npx lean-method uninstall   # keeps _lean/custom/ and your plans
```

Plan tooling — deterministic, no model involved (the skills call these too):

```bash
lean-method check [--epic E2]        # lint the plan tree: ids, status, deps, CAP coverage, lanes, seams, frozen intent, spec size
lean-method check --story E2-3       # one story: frozen block intact, size, open deps, lane trespass since baseline_commit
lean-method next [--lane A]          # in-flight, blocked, and next ready story per epic/lane
lean-method freeze --story E2-3      # hash the approved frozen block; check fails if it changes
lean-method metrics [--epic E2] [--json]   # loops, escalations, findings by verdict/lens/model, tokens, time
```

Install the package as a devDependency (`npm i -D lean-method`) or globally so these run offline; skills fall back to reading when the CLI is missing.

| File | Holds | Who writes it |
|---|---|---|
| `_lean/config.toml` | team answers: project, doc language, input and output folders, style, roles | installer |
| `_lean/config.user.toml` | your name, language, model tiers per tool | installer (gitignored) |
| `_lean/custom/config.toml` | team overrides | you; installer never touches |
| `_lean/custom/config.user.toml` | personal overrides | you; installer never touches |

Later files win. Re-running `install` offers `update` (re-ask, your answers as defaults) or `quick-update` (keep everything). Installed files you've edited are backed up to `_lean/_backups/` before being replaced.

## 10. Common questions

- **Resume interrupted work?** Ask `lean-help` "what next". It finds in-progress specs. `lean-build` resumes from the spec's `status`.
- **A requirement changed mid-build?** `lean-change course`. It proposes old → new edits across SPEC, ARCHITECTURE and stories, and applies them once you approve.
- **A build keeps looping back?** After 3 review loopbacks it stops and asks you. Two `bad_spec` loops move the implementer up a tier.
- **Skip architecture?** Yes, for work with no independently built parts. Not for 2+ lanes.
- **Unattended run?** `lean-build --auto`: it never waits. Questions turn into `blocked` stories with the question written down.
- **Where are deferred findings?** In each epic's `deferred.md`, and `plan/deferred.md` for ad-hoc or cross-epic items. `lean-plan status` suggests which to promote into stories.
- **Plan the next epic?** `lean-plan` with the epic id, or just "plan the next epic". It picks the first `planned` epic whose dependencies are done.
- **Add work to a running project?** Extend the SPEC with `lean-intent` (new CAP ids), then run `lean-plan` to add epics. Existing epics are untouched.
- **Use a different model for reviews?** `orchestration.roles.review = "top"` in `_lean/custom/config.toml`, then run `install --action quick-update`.
