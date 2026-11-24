**Illustrative only: an invented "CSV export" feature in an invented notes app, run on the feature path (intent, plan, build per story, retro).**

Names, hashes, line numbers and token counts are made up. Files, fields and rules match the real templates in `lean/skills/*/assets/`. Setup: LEAN installed for Claude Code ([Getting Started](Getting-Started.md)); a support digest saved as `docs/csv-export-request.md`.

## 1. Intent: `lean-intent`

```
Use lean-intent. Users want to export their notes as CSV. See docs/csv-export-request.md.
```

One intake message: which `docs/` files to use, the stakes (hobby, internal, launch), fast or coaching. You answer `1a 2b 3a` (use the file, internal, fast). It drafts, runs one `check` worker on the draft (stakes above hobby), then asks what is still open:

```
**lean-intent · needs you** — plan/SPEC.md drafted (internal)
| id | capability |
|---|---|
| CAP-1 | Export all notes |
| CAP-2 | Export one tag |
Decide:
1. Archived notes — [ASSUMPTION] excluded — (a) keep ← recommended  (b) include
2. Encoding — [ASSUMPTION] UTF-8 with BOM, for Excel — (a) keep ← recommended  (b) plain UTF-8
Next: answer `1a 2a`, then lean-plan
```

`plan/SPEC.md`, trimmed:

```markdown
---
title: 'Notes — CSV export'
status: final
stakes: internal
updated: '2026-11-13'
companions: []
sources: [docs/csv-export-request.md]
---
## Capabilities
- **CAP-1 — Export all notes**
  - **intent:** A signed-in user downloads all their notes as one CSV file.
  - **success:** Given a user with 3 notes, when they ask for an export, then a file downloads with a header row and 3 data rows.
- **CAP-2 — Export one tag** …
## Quality Requirements
- **QR-1:** Exporting 10,000 notes takes under 5 s on a developer laptop.
## Non-goals
- Formats other than CSV (JSON, PDF).
## Decision Log
- 2026-11-13 — decision — Archived notes excluded; the request says "my notes", not the archive.
- 2026-11-13 — finalized — workers: check=sonnet escalations=0
```

## 2. Plan: `lean-plan`

```
Use lean-plan to create the epics.
```

It shows the epic table for one approval, then asks how many people or agents work on E1 at once. You say 1: single lane, so no lanes, no `E1-0`, no `CONTRACTS.md`. `plan/epics.yaml`:

```yaml
spec: SPEC.md
uncovered: []
epics:
  - id: E1
    title: CSV export
    folder: epics/E1-csv-export
    goal: >-
      A signed-in user downloads their notes, or one tag's notes, as a CSV file.
    caps: [CAP-1, CAP-2, QR-1]
    depends_on: []
    status: active
```

All stories come in one pass, then the readiness check (`check --epic E1`):

```
**lean-plan · E1 stories** — 3 drafted, readiness PASS
| id | lane | title | caps | depends_on |
|---|---|---|---|---|
| E1-1 | — | Export all notes as CSV | CAP-1, QR-1 | — |
| E1-2 | — | Filter an export by tag | CAP-2 | E1-1 |
| E1-3 | — | Export button in the notes list | CAP-1, CAP-2 | E1-1, E1-2 |
Next: lean-build E1-1
```

It wrote `EPIC.md`, `stories.yaml` (order only, no status) and three stub files under `stories/`, each `status: todo`.

## 3. Build: `lean-build`

```
Use lean-build: E1-1
```

1. `scout` workers map the code (`src/routes/notes.ts`, `src/db/notes.ts`). Notes are personal data, so `security: true`. One gap the user would notice: the download filename. That is an Open Question, so a checkpoint:

   ```
   **lean-build · needs you** — E1-1 spec: plan/epics/E1-csv-export/stories/E1-1-export-all.md
   Decide:
   1. Download filename — (a) notes-<date>.csv ← recommended  (b) notes.csv
   2. Spec — (a) approve and continue ← recommended  (b) let me review it first
   Next: answer `1a 2a`
   ```

2. The skill freezes the intent, has a `test` worker write failing tests, judges them, and freezes those too. You never type these:

   ```
   $ node _lean/bin/lean.js freeze --story E1-1 --via checkpoint
   frozen plan/epics/E1-csv-export/stories/E1-1-export-all.md — sha256 d597572fb744…, approved via checkpoint
   $ node _lean/bin/lean.js freeze --story E1-1 --tests test/export.test.js
   froze 1 test file(s) in plan/epics/E1-csv-export/stories/E1-1-export-all.md
   frozen plan/epics/E1-csv-export/stories/E1-1-export-all.md — sha256 d597572fb744…, approved via checkpoint
   ```

3. A fresh `implement` worker builds from the spec alone. `check --story E1-1` passes; the guard hook would refuse any edit to the frozen block, its contract fields or the test.
4. Four reviewers run blind and in parallel (the security lens joins at trust boundaries). The orchestrator verifies each finding. The Review Triage Log in the story file:

   | # | lens | verdict | route | evidence |
   |---|---|---|---|---|
   | 1 | security | high | patch | Cells starting `=`, `+`, `-` or `@` are written raw; Excel runs them as formulas (`src/export/csv.ts:14`). |
   | 2 | edge-case | medium | amend | A user with 0 notes gets an empty body, not the header row (`src/routes/notes.ts:41`); the spec does not say. |
   | 3 | adversarial | medium | patch | `over-engineering:` `ExportFormatter` has one implementation; other formats are a SPEC non-goal. Inline it. |
   | 4 | verification-gap | medium | patch | No test asserts the `Content-Disposition` filename. |
   | 5 | adversarial | false | reject | "Loads all notes into memory": the handler streams from a cursor (`src/db/notes.ts:27`). |

   No `intent_gap` or `bad_spec`, so no revert and `review_loops` stays 0. The amend lands in the Spec Change Log and the code is patched in place. How routes work: [Review and Triage](Review-and-Triage.md).

5. Finish: `## How to review`, the `metrics:` block, `status: done`, a local commit. The story's frontmatter now (trimmed):

   ```yaml
   id: E1-1
   epic: E1
   caps: [CAP-1, QR-1]
   status: done
   route: full
   baseline_commit: 'a91e3c7'
   review_loops: 0
   frozen_sha256: 'd597572fb7449623…'            # shortened
   approved_via: checkpoint                      # you saw the block at the checkpoint
   contract_sha256: '4be0c1a27e93f5d8…'          # caps, rules, seams, checkpoint, security, frozen_tests, approved_via
   frozen_tests: ['test/export.test.js#91781335…']
   security: true
   metrics:
     models: { orchestrator: opus, scout: haiku, test: sonnet, implement: sonnet, review: sonnet }
     escalations: 0
     worker_tokens: 61840
     orchestrator_tokens: null                    # the harness did not report it; never estimated
     started: '2026-11-13T09:12:00Z'
     finished: '2026-11-13T09:41:00Z'
   ```

   ```
   **lean-build · done** — E1-1: GET /export.csv streams the user's notes as CSV
   | review | 5 findings → 3 patched, 1 amended, 1 rejected |
   | verify | npm test -- export: pass |
   | commit | 4f1c2ab |
   Next: E1-2 Filter an export by tag
   ```

`Use lean-build: next story.` twice more. `lean-method next` picks E1-2, then E1-3. Both take the small route. E1-2 still gets the security lens, because `?tag=` is external input: it finds a tag concatenated into SQL (high, patched).

## 4. Close the epic: `lean-plan` and `lean-change`

```
Use lean-plan status.
Use lean-change retro.
```

Status sets E1 `done`. The retro reads the stories' triage logs, `lean-method metrics --epic E1` and git history. It will not accept an epic without exit evidence, so it asks you to run the test or watch the demo now; the evidence must be named in EPIC.md's `## Exit evidence`. `plan/epics/E1-csv-export/retro.md`, trimmed:

```markdown
**Verdict:** accept. Exit evidence: demo watched 2026-11-14 (you); `npm test -- export` green on main at 4f1c2ab.
## Findings
- Both high findings were untrusted text reaching an interpreter: a CSV cell (E1-1 triage row 1), a SQL string (E1-2 triage row 1).
- 6 findings, 1 false (0.17); 0 review loops; 0 escalations (`metrics --epic E1`).
## Actions
1. Add to CLAUDE.md under `## Pitfalls` (you approve first):
   - Raw user text in a CSV cell or SQL string → escape at the sink (source: E1 retro, E1-1 and E1-2 triage rows 1)
```

## What this run skipped

- Architecture (one process here, nothing built separately) and parallel lanes: [lean-architecture](lean-architecture.md), [Parallel Teams](Parallel-Teams.md).
- A requirement changing mid-way: [lean-change](lean-change.md) in `course` mode.
- Unattended builds: `lean-build --auto`, see [lean-build](lean-build.md).

## See also

- [Getting Started](Getting-Started.md): install and the three minimum paths.
- [The LEAN Process](The-LEAN-Process.md): the same flow, without the example.
- [Artifacts and Layout](Artifacts-and-Layout.md): where each file in this run lives.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): what `freeze` and the hook enforce.
