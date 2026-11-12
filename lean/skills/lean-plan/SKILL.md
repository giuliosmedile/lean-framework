---
name: lean-plan
description: 'Break a SPEC.md (and ARCHITECTURE.md, UX.md) into epics, then each epic into stories with acceptance criteria — a tree: plan/epics.yaml → plan/epics/<E>/ with its own stories. When several people or agents work on an epic in parallel, splits it into lanes with a contracts story first. Also checks readiness and shows progress. Use when the user says "create epics", "create stories", "plan the epic", "plan the next epic", "break this into stories", "plan the work", "split this across the team", "check readiness", or "where are we / show status".'
---

# Lean Plan

Turn the spec into a **tree**: `plan/epics.yaml` indexes the epics; each epic is a folder with its own `EPIC.md`, `stories.yaml`, and one `.md` file per story. Stories **point to** the spec and architecture rather than restating them. A story's status lives only in its own file, so there's no sprint file and no shared file everyone edits. When an epic runs in parallel, its `CONTRACTS.md` freezes everything that crosses a lane boundary so the lanes converge.

Speak the user's language.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*, and use its **Layout** for every path. You write epics, stories, lanes, and contracts yourself (that's judgment); workers only scan and check. User-facing messages use the kiss shape.

## Intents

- **epics** — create or refresh `epics.yaml` and the epic folders. Default when `epics.yaml` doesn't exist.
- **epic** (default once epics exist) — plan the stories of one epic: the one named, else the next `planned` epic whose dependencies are met.
- **readiness** — run only the readiness check (project, or one epic) and report.
- **status** — summarize progress; recommend the next story (per lane). No edits.

## Epics

1. **Load** SPEC.md, its companions, and ARCHITECTURE.md. If SPEC.md is missing, suggest `lean-intent`. Don't copy requirements; you'll reference CAP-, QR-, UJ-, and AD- ids.
2. **Draft the whole `epics.yaml` at once** from `assets/epics-template.yaml`. Present it as one table (id · title · goal · caps · depends_on) for **one** review pass.
   - **An epic is a milestone the user can see.** "After E2, an analyst can run a search end to end." Never an epic per technical layer.
   - **Fewest epics that deliver the spec**, in delivery order, with no forward dependencies. The first epic produces something runnable end to end.
   - Every CAP/QR lands in an epic, or under `uncovered:` with a reason.
3. **Create the folders.** For each epic, create `epics/<E>-<slug>/EPIC.md` from `assets/epic-template.md` with goal, scope, and exit criterion filled in, `status: planned`.
4. **Stories just in time.** Detail only the first epic now (go to *Epic*). The rest keep their EPIC.md until they're next. Planning them early just plans churn. If the user asks for every epic at once, do it, epic by epic.

**Refresh:** keep the ids of epics that have stories; new epics take the next free id; a dropped epic's id is retired. Log changes in EPIC.md's Decision Log.

## Epic

### 1. Load

Read `epics.yaml`, this epic's `EPIC.md`, the SPEC capabilities it covers, ARCHITECTURE.md, and the `stories.yaml` and story files of epics this one depends on (titles and status only). If the epic already has stories, this is a refresh: keep every story file whose status isn't `todo`, and keep the ids of all existing files.

### 2. Ask about the team (always, one message)

1. **How many people (or parallel agents) will work on this epic at the same time?**
2. If more than one: their names or handles, and any ownership or skill split.
3. If more than one: the integration branch, and whether lanes merge after every story (recommended) or at checkpoints.

Record the answers under `## Team` in EPIC.md. **One person → single lane:** skip steps 3–4.

### 3. Draw the lanes (2+ people)

Lanes follow **module ownership**, never story-by-story assignment. Use the module table in ARCHITECTURE.md. If it's missing, or boundaries are vague, stop and recommend `lean-architecture` first: lanes without enforced boundaries collide.

- **Number of lanes = min(people, independent module groups).** If there are more people than groups, don't invent lanes: suggest pairing inside a lane.
- **Lanes share no code** except the contracts package. Only the composition root knows every lane, and it has a named owner.
- **Every lane has a first story that needs nothing but `<E>-0`**, so nobody waits. If a lane can't start until another delivers, give it a story against the other lane's fake.
- **Balance the critical path.** If one lane carries most of the work, move a module or split the biggest story. Name the bottleneck in EPIC.md.

Present the lanes as one table (lane · owner · modules · first story · nature of work) for approval. Then write them into `stories.yaml` → `lanes`.

### 4. Contracts (2+ lanes)

Fill `assets/contracts-template.md` → the epic's `CONTRACTS.md`. Story **`<E>-0`** implements it. It comes before any lane story, with `lane: shared, checkpoint: spec`.

**Seams.** List every port, gateway, or type that crosses a lane boundary. For each one:
- the **owner of its real implementation** (lane + story). An unowned seam is the classic orphan, e.g. composition glue that lands in nobody's lane. The epic isn't ready while one exists.
- **value rules** the types alone don't pin: empty collections, null vs absent, formats/units/time types, ordering, id form, return-vs-throw on errors, every shape the producer may emit.
- **one fake**, owned by the producer lane, in shared test code. Never one fake per consumer: two fakes of the same port drift apart.

**`<E>-0` acceptance** (adapt; drop what doesn't apply to the stack):
1. The contracts package holds only types: no logic beyond trivial derivations, no framework or driver dependencies.
2. One word per concept; a glossary records rejected synonyms.
3. One deterministic fake per port/gateway, no I/O, in shared test code.
4. **Oracle fixtures:** the spec's worked examples as data, with every intermediate value at every seam, **checked against the real schema/catalog by a test**.
5. One **abstract contract test** per port, encoding its value rules. The fake passes it now; the real implementation must pass it later.
6. A **boundary test**: lane modules don't import each other.
7. A **walking skeleton**: the composition root wired with every fake runs the oracle fixture end to end as an automated test. It stays green on the integration branch as lanes swap fakes for real implementations.

**Seam checkpoints.** For each seam, add a small `lane: integration` story that runs as soon as both sides are real. Its `depends_on` names both stories.

**Decisions due.** Every deferred decision that a story will need gets a decide-by story in CONTRACTS.md.

**Contract changes after freeze** (`<E>-0` done → CONTRACTS `status: frozen`): raised through `lean-change course`, landed as one small `<E>-C<n>` story (`lane: shared`) that updates types, fakes, fixtures, and contract tests together. Every lane then rebases.

### 5. Draft the epic's stories at once

Write `stories.yaml` from `assets/stories-template.yaml`, and one file per story from `assets/story-template.md` under `stories/`. Present them as one table (id · lane · title · caps · depends_on) for **one** review pass. The user edits the list as a whole.

Story rules:

- **Fewest stories that deliver the epic.** Thin vertical slices; the first story (or the walking skeleton) produces something runnable. Don't split what one build spec can hold.
- **One user-facing goal per story**, small enough that its build spec fits the cap in `kiss.md` §B.
- **User value, not layers** (single lane). In multi-lane epics, lane stories may be module-shaped, but each must be testable on its own against fakes and fixtures.
- **No forward dependencies** within a lane. Cross-lane and cross-epic dependencies are allowed but explicit in `depends_on`.
- The story file holds the story's own acceptance criteria (Given/When/Then, error cases that matter), `caps`, `rules`, and `seams`. A seam story's acceptance includes "the contract tests for those seams pass".
- `checkpoint: spec` on risky, irreversible, or ambiguous stories, `<E>-0`, and contract changes. Default `none`.
- Every CAP the epic claims is covered by at least one story.

Then set the epic `active` in both `epics.yaml` and EPIC.md.

### 6. Readiness check

Ask one question: **could each developer build these stories without inventing decisions nothing records, and will the pieces fit together?**

- **Tree consistency:**
  - every `epics.yaml` entry has its folder and EPIC.md;
  - every `stories.yaml` entry has its file, and every file is listed;
  - ids are unique across the whole tree;
  - no story file carries a status that `stories.yaml` would contradict, because `stories.yaml` has none.
- **Traceability:** the epic's CAPs ↔ stories trace both ways.
- **Dependencies:** no forward dependencies; cross-epic dependencies point to existing stories.
- **Decisions:** decisions the stories rely on are recorded somewhere; decisions due have a decide-by story.
- **Conflicts:** conflicts between SPEC, UX, ARCHITECTURE, EPIC, and CONTRACTS are surfaced, not silently resolved.
- **Multi-lane:**
  - every seam has a real-impl owner, value rules, one fake, a contract test, and a checkpoint;
  - every lane has a first story that needs only `<E>-0`;
  - the composition root has an owner.

Verdict:
- **PASS** — one line; recommend `lean-build` on `<E>-0` (multi-lane) or the first `todo` story.
- **CONCERNS** — each briefly, with where the gap lives; ask whether to proceed or fix first.
- **FAIL** — findings by severity, each naming the skill that fixes it.

For launch-stakes projects, epics with more than ~15 stories, or any multi-lane epic, run the check as a `check` worker with the STORIES and CONTRACTS sections of `{skill-root}/../lean-review/lenses/doc-rubric.md` plus the questions above. Verify its findings yourself before reporting.

## Status

Read `epics.yaml`, then only the **active** epics: `stories.yaml`, the frontmatter of each story file, CONTRACTS.md, and `deferred.md`. Don't open `done` epics. No workers. Report:

- One table of epics: id · title · status · done/total stories.
- For each active epic, one table: lane · todo · in-progress · blocked · done · next story.
- Bullets:
  - `blocked` stories, with their reason;
  - seam checkpoints that are due;
  - overdue decisions;
  - pending contract changes;
  - deferred items worth promoting.
- `Next:` per lane, or the next epic to plan when the active one is done.

An epic whose stories are all `done` → set it `done` in `epics.yaml` and EPIC.md, and recommend `lean-change retro` for it. Blocked stories, failed checkpoints, or deferred items that point at a plan problem → recommend `lean-change course`.
