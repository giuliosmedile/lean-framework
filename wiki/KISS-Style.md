**KISS is LEAN's default style: build the simplest thing that passes acceptance, write short documents, and reply in a fixed shape of at most 12 lines.**

The rules live in `lean-kit/kiss.md`. Every `lean-*` skill loads that file on start (see [lean-kit](lean-kit.md)).

## kiss vs standard

Set `lean.style` in `_lean/config.toml`: `kiss` (default) or `standard`. The installer asks once.

| | `kiss` | `standard` |
|---|---|---|
| Engineering rules (below) | apply | apply, unchanged |
| Document caps | strict | relaxed |
| Reply caps (12 lines, 7 bullets) | apply | relaxed |

`standard` keeps the engineering rules and relaxes the caps. `kiss.md` gives no replacement numbers for replies. To switch for the whole team, put `style = "standard"` under `[lean]` in `_lean/custom/config.toml`.

## Engineering rules

1. **Simplest thing that passes acceptance.** Fewest files, concepts and moving parts.
2. **No speculative generality.** No interface with one implementation, no config for a value that never changes, no plugin points, no future-proofing. Abstract on the third use, not the first.
3. **Reuse before adding.** Existing code, then the standard library, then an installed dependency, then a new dependency (only with a one-line reason in the spec).
4. **Boring tech.** One process, one datastore, the framework's defaults. Distribution, queues, caches and microservices need a stated, measured reason.
5. **Delete before adding.** A change that removes code beats one that wraps it.
6. **Tests prove acceptance and the edge-case matrix.** Nothing more, no scaffolding for its own sake.
7. **Fail loudly and simply.** Handle the cases the spec names; let the rest raise.
8. **Dirty is not unverified** (next section).

## Document caps

| Doc | `kiss` | `standard` |
|---|---|---|
| `SPEC.md`: hobby / internal / launch | ½ / 2 / 5 pages (+ companions) | 1 / 4 / as needed |
| `UX.md` | 2 pages | as needed |
| `ARCHITECTURE.md` | ≤ 7 ADs, 2 pages | as needed |
| Build spec | ≤ 1,000 tokens | ≤ 1,600 tokens |
| Build spec, feature story (the only story of its epic) | ≤ 2,000 tokens | ≤ 3,200 tokens |
| Story description | 1 sentence | 2 sentences |

The SPEC tier is the `stakes:` value in its frontmatter (`hobby`, `internal`, `launch`).

Always: bullets and tables, no paragraph longer than 3 sentences, drop any section that is empty.

Enforcement is partial:

- `check` **warns** (never fails) when `SPEC.md` is more than 20% over its page cap (about 500 words a page), or a build spec is over its token cap (words times 4/3). For a feature story it applies the doubled cap. See [CLI Plan Tooling](CLI-Plan-Tooling.md).
- The `UX.md`, AD-count and story-description caps are not checked by a script. The skills apply them while writing (for example `lean-architecture` stays within the AD cap).

## The reply shape

Every message to you follows this shape. Lines that do not apply are left out.

```
**{skill} · {phase}** — {one-line status}

| … | … |        ← facts as a table or ≤ 7 bullets

Decide:
1. {question} — (a) {option} ← recommended  (b) {option}
2. …

Next: {one line}
```

- At most **12 lines** unless you ask for more. Files are pointed to, not pasted.
- Questions are **numbered, with lettered options**, one option marked recommended, all batched in one message.
- No narration of what was done or will be done, no restating your words, no closing summary.
- Paths are written in a form that is clickable in the current environment.
- Status words: `done`, `blocked`, `needs you`, `ready`, `failed`.

### Answering `1a 2b`

Illustrative reply (11 lines):

```
**lean-plan · E2** — needs you: 2 decisions before stories are written

| epic | goal | caps |
|---|---|---|
| E2 | Search by title and tag | CAP-3, CAP-4 |

Decide:
1. Who builds E2 — (a) one person or agent ← recommended  (b) two lanes
2. Fuzzy matching — (a) in scope  (b) defer ← recommended

Next: answer like `1a 2b`.
```

Reply `1a 2b`: one person or agent builds E2, and fuzzy matching is deferred. One short message settles both questions.

## Dirty is not unverified

KISS cuts polish, not checks. These stay on in every style:

- Acceptance criteria must pass.
- Frozen intent is respected.
- Irreversible steps are still gated.
- Review still runs.

A quick-and-plain implementation is fine. An unchecked one is not. See [Review and Triage](Review-and-Triage.md) and [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## Optional wording rules: ste80

`kiss` and `standard` set how much LEAN writes. `lean.prose` sets how each sentence is written. It is a separate key, so it combines with either style.

| `lean.prose` | Effect |
|---|---|
| `plain` (default) | No wording rules. |
| `ste80` | Replies and documents follow `lean-kit/ste.md`: simplified technical English, about 80% of ASD-STE100. |

Turn it on with `--set prose=ste80` at install, or `[lean] prose = "ste80"` in `_lean/custom/config.toml` followed by `install --action quick-update`.

- **Kept:** sentences of at most 20 words (procedures) or 25 (descriptions), one idea per sentence, active voice, the condition first, simple tenses, one term per thing, no `-ing` verbs, no noun stacks over three.
- **Not enforced:** the approved-word dictionary of about 900 words.
- **Applies to** replies to you and to documents you read (SPEC, UX, ARCHITECTURE, EPIC, story intent, retros, review reports).
- **Does not apply to** worker prompts, code, ids, status words, quoted source text, or text already inside a frozen block (rewriting it would break the hash).
- **English only.** For another language only the sentence and paragraph rules apply, not the word rules.
- **The caps win.** If a rule would push a reply past 12 lines or a document past its cap, the cap stands.

The idea comes from asking an LLM to write in the controlled English of aircraft manuals so a person can review the output faster. It makes text easier to read; it is not shown to make the model's code better. Treat it as an experiment and compare cost with `lean-method metrics` before you make it a team default.

## How reviewers enforce it

- Reviewers treat violations of rules 1 to 5 as findings, labelled `over-engineering`.
- The adversarial lens always hunts for them: single-implementation abstractions, config for values that never change, new dependencies where existing code or the standard library would do, extra layers, handling for cases nothing can reach, documents longer than their content.
- Each finding starts with `over-engineering:` and its fix is a deletion or simplification.

Illustrative finding:

```
over-engineering: PriceProvider has one implementation (src/pricing.ts:12). Inline it and delete the interface.
```

Triage treats such a finding as real when the complexity serves no stated requirement and no reachable case, and grades it by the maintenance cost it adds. Its fix is a deletion or inline replacement, so it routes as `patch`, unless removing it changes behavior the spec asks for.

In `lean-build`, over-engineering found in review counts as a defect. `lean-change retro` looks for complexity creep: code or ADs that break the engineering rules, and over-engineering findings that kept recurring.

## See also

- [lean-kit](lean-kit.md): the skill that holds `kiss.md` and shows the style setting
- [Review and Triage](Review-and-Triage.md): how `over-engineering:` findings are verified and routed
- [lean-build](lean-build.md): the small route and the simplest-approach rule in practice
- [Artifacts and Layout](Artifacts-and-Layout.md): what the capped documents are
