# Triage — verify, grade, route

Shared by `lean-review` (code) and `lean-build`. Runs only after **every** reviewer has reported. Reviewers' own severity labels are ignored: they lack the context to grade.

## 1. Verify and grade each finding

If the triage log already has rows (a loopback or resumed review), first match each finding against them: same location, same claim, and the code still reads as the row says → keep the row's verdict and route, mark it `carried`, don't re-verify or re-patch it.

Findings from the verification-gap lens count as pre-verified **only if that reviewer ran at the `top` tier** (its evidence rules make it read the tests and run the searches it cites). Then take the gap as filed and weigh its filed disposition when routing. At any lower tier, verify its gaps like every other finding: re-open the cited test and re-run the cited search. Its `Other findings` are always verified.

`over-engineering:` findings are real when the complexity serves no stated requirement and no reachable case. Grade them by the maintenance cost they add. Their fix is a deletion or inline replacement, which makes them `patch`, unless removing it changes behavior the spec asks for.

For every other finding, **check the claim**: go to the cited location and read beyond the changed lines — callers, upstream guards — until you can say whether the bad outcome actually happens. A different problem nearby doesn't settle this one. Judge whether the problem is real, not whether the suggested fix sounds plausible. Code that fails loudly on a state you haven't shown is reachable is correct, not a defect.

Give exactly one verdict:

- `high` (intolerable) / `medium` (tolerable) / `low` (cosmetic or negligible) — the bad outcome is real. Grade by harm to users or developers. For developer-only harm, name where it will bite (which caller diverges, which rule breaks); "this is messy" with no named harm is not a grade. Unsure how bad → pick the higher grade.
- `false` — you checked and it doesn't happen. Write what disproves it.
- `maybe-false` — the code and diff genuinely can't settle it. Write what would.

Record **every** finding as one row in the triage log, never dropping or silently merging one. In a build spec the log is a table `| # | lens | verdict | route | evidence |` (see `lean-build/assets/story-spec-template.md`): `lens` is the reviewer's lens name, `verdict` one of the five above, `route` one of `patch | amend | bad_spec | intent_gap | defer | reject` (rejected findings take `reject`), evidence one or two sentences. `lean-method metrics` counts these rows, so use exactly these words.

Then reject:
- `false` findings.
- `low` findings that people would rarely hit in normal use **and** whose fix adds complexity (guards, branches, parameters) rather than a direct correction.
- Findings whose only fix is editing the build spec itself.
- Out-of-scope only when **the intent** excludes it — not because the plan or the shape of the diff does.

## 2. Group

Group survivors by shared root cause — only when the same defect produced both. Same file or same fix is not a shared root cause. A group takes its worst verdict (`high` > `medium` > `low` > `maybe-false`).

## 3. Route each group

Caused or exposed by this change:

- **intent_gap** — the frozen intent is incomplete; the spec can't settle it. Don't infer intent unless there's exactly one reading.
- **bad_spec** — the spec's *approach* was wrong, so the code built on it is wrong in shape (wrong module, wrong data flow, wrong abstraction, a deviation the rest of the diff depends on). Patching would leave incoherent code. Costs a full revert and re-implementation.
- **amend** — the spec *missed* something, but the approach holds and the rest of the diff is sound: a case, a rule, or an acceptance line to add. Amend the spec's non-frozen sections, then fix the code with a targeted change. Costs one patch round, not a rebuild.
- **patch** — the smallest fix is trivial, adds no public surface, and guards no state you didn't demonstrate, and the spec needs no change. Otherwise → intent_gap (spec doesn't settle the fix), amend, or bad_spec.

Choosing between them: ask "if I add this to the spec, does the existing code still have the right shape?" Yes → `amend`. No → `bad_spec`. When torn between `patch` and a spec route, choose the spec route (a spec-level record produces more coherent code); when torn between `amend` and `bad_spec`, choose `amend` unless two or more findings point at the same approach-level cause.

Not this change's problem:

- **defer** — pre-existing issues; groups that are all `maybe-false` but would be `medium`/`high` if true (record as unverified + what would settle it; if it would only be `low`, reject); fixes that would edit agent-context files (CLAUDE.md, AGENTS.md, rules). Start those entries' summary with `agent-context:` so `lean-change retro` can turn them into proposed pitfalls.

A group with any verified `high`/`medium`/`low` member routes by that, never to defer just because another member is `maybe-false`.

## Deferred entry format

Append to the epic's `plan/epics/<E>-*/deferred.md` (or `plan/deferred.md` for ad-hoc or cross-epic work). Never edit existing entries; don't dedupe.

```markdown
- source: `{spec file or "review"}`
  summary: {one sentence}
  evidence: {why it's real; for maybe-false, what would settle it}
```
