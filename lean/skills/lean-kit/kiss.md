# KISS — build less, say less

Active when the `_lean/` config has `lean.style = "kiss"` (the default). `style: standard` keeps the engineering rules (part A) but relaxes the caps in parts B–C. `lean.prose = "ste80"` adds the sentence rules of `ste.md` on top of either style; the caps here still win.

## A. Engineering rules

1. **Simplest thing that passes acceptance.** Fewest files, fewest new concepts, fewest moving parts.
2. **No speculative generality.** No interface with one implementation, no config for a value that never changes, no plugin points, no "future-proofing". Rule of three: abstract on the third use, not the first.
3. **Reuse before adding.** Existing code → standard library → an already-installed dependency → a new dependency (only with a one-line reason in the spec).
4. **Boring tech.** One process, one datastore, the framework's defaults. Distribution, queues, caches, and microservices need a stated, measured reason.
5. **Delete before adding.** A change that removes code is preferred over one that wraps it.
6. **Tests prove acceptance and the edge-case matrix** — nothing more, no test framework scaffolding for its own sake.
7. **Errors: fail loudly and simply.** Handle the cases the spec names; let the rest raise.
8. **Dirty ≠ unverified.** KISS cuts polish, not checks: acceptance must pass, frozen intent is respected, irreversible steps are still gated, review still runs.

Reviewers treat violations of rules 1–5 as findings (`over-engineering`). Triage routes them as `patch` when the fix is a deletion or an inline replacement.

## B. Document caps

| Doc | kiss | standard |
|---|---|---|
| SPEC.md — hobby / internal / launch | ½ / 2 / 5 pages (+ companions) | 1 / 4 / as needed |
| UX.md | 2 pages | as needed |
| ARCHITECTURE.md | ≤ 7 ADs, 2 pages | as needed |
| Build spec | ≤ 1,000 tokens | ≤ 1,600 tokens |
| Build spec, feature story (the only story of its epic) | ≤ 2,000 tokens | ≤ 3,200 tokens |
| Story description | 1 sentence | 2 sentences |

`lean-method check` knows the plain cap only: for a feature story, its `story/size` warning up to the doubled cap is accepted. Past it, split along a real seam or trim.

Write bullets and tables. No paragraph longer than 3 sentences. Drop any section that's empty.

## C. Talking to the user

Every message follows this shape. Leave out lines that don't apply.

```
**{skill} · {phase}** — {one-line status}

| … | … |        ← facts as a table or ≤ 7 bullets

Decide:
1. {question} — (a) {option} ← recommended  (b) {option}
2. …

Next: {one line}
```

- **≤ 12 lines** unless the user asks for more. Point to files instead of pasting them.
- **Questions are numbered with lettered options**, so the user can answer `1a 2b`. Mark one recommended option per question. Batch all questions into one message.
- **No narration** of what you did or are about to do, no restating the user's words, no closing summaries of the summary.
- **Paths** in a form that's clickable in the current environment.
- Status words: `done`, `blocked`, `needs you`, `ready`, `failed` — nothing vaguer.
