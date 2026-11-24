**LEAN review runs blind lenses in parallel, then one orchestrator verifies every finding and routes it back to where the problem came from.**

Invoke it with [lean-review](lean-review.md); build acts on the result in [lean-build](lean-build.md).

```
diff or planning doc, staged as a file
   ▼
adversarial · edge-case · verification-gap · [security]   all at once, blind
   ▼  every reviewer has reported
orchestrator: verify ─► grade ─► group ─► route ─► act and log
```

## The lenses

| Lens | Applies to | Hunts |
|---|---|---|
| `adversarial` | anything | what is wrong, what is missing, over-engineering |
| `edge-case` | code | unhandled paths, behavior lost in deletions, false spec claims |
| `verification-gap` | code that changes behavior | changed behavior no running test would catch |
| `security` | code at a trust boundary | untrusted input reaching a dangerous sink; missing access checks |
| `doc-rubric` | planning docs | decision-readiness, coverage, traceability |

**adversarial.** Two passes: what is wrong, then what is missing. It always also hunts `over-engineering:` (single-use abstractions, config for constants); the fix is a deletion. No quota: `No findings` is valid.

**edge-case.** A pure path tracer: it lists missing handling, never quality. It walks every branch in the diff, including the untouched members of a changed enum, then runs a deletion check (a removed contract nobody re-established) and a claims check. It reads the claims file (the build spec) only after tracing, as testimony, and tries to falsify each claim. Output is a JSON array.

**verification-gap.** One question: if the behavior this change produces broke where it is used, would a test fail? Three shapes: regression gap, missing-adoption gap (a sibling site should use the new rule and nothing checks it), broken-verification gap (test skipped, flaky or too weak). A test counts only if it runs normally and asserts the changed result. Each gap ends in `patch` (the test to add) or `defer`.

**security.** Traces untrusted input (requests, files, environment, third-party responses, agent output) to sinks (queries, shell, paths, templates, deserializers, server-side fetches, `eval`). Also checks ownership and authorization on new endpoints, secrets and personal data in logs, crypto, new dependencies and fail-open errors. It needs a concrete path; generic advice is not a finding.

**doc-rubric.** Four rubrics: SPEC (`SPEC.md`, `UX.md`), ARCHITECTURE, EPICS & STORIES, CONTRACTS. It judges substance, not formatting (for example: does every cross-lane seam have an owner?). It opens with `ready`, `ready with fixes` or `not ready`, then lines tagged `blocker`/`high`/`medium`/`low`. `lean-intent`, `lean-architecture` and `lean-plan` also run it, scaled to stakes.

## Blind and parallel

- A reviewer gets its lens file, the content path, optional `also_consider` areas and the paths of the recorded decisions (SPEC Assumptions and Decision Log, epic and story decisions), which it must not re-argue. It never sees the build conversation, the implementer's report or other reviewers' findings. Edge-case also gets the claims path, unread until its instructions call for it.
- All lenses launch in one turn. Triage starts only after all have reported.
- Reviewers' severity labels are ignored: they lack the context to grade. A cheaper tier works because the orchestrator verifies each finding ([tiers](Orchestrator-and-Cost-Tiers.md)).
- No subagents: `lean-review` runs the lenses one after another in one session. `lean-build` writes the prompts to `plan/adhoc/review-prompts/` and halts so you can run them in separate sessions.

## When the security lens is added

- Build: the spec has `security: true` (set in planning when the story touches auth, personal data, money, secrets, external input, files, shell or query construction), or the diff crosses a trust boundary. On a feature review, any story of the epic with `security: true` is enough; an earlier story of a multi-story epic gets this lens alone, on its own diff.
- Standalone: the diff touches one of those. Never on documents.

## The evidence rule

A finding without evidence is a hunch, and a hunch costs the judge a check.

- Code findings cite `file:line` and the input or state that triggers the problem. Document findings cite the section and the downstream decision it breaks.
- Adversarial may add at most 3 `Unverified hunches`; the judge may ignore them. Verification-gap must read a test before saying what it covers.
- Each log row carries evidence in one or two sentences. `false` says what disproves the claim. `maybe-false` says what would settle it.

## Verify, then route

Triage is the orchestrator's job, never a worker's. **Settled decisions first:** a finding that only re-argues a decision recorded in the SPEC, the epic or the story takes verdict `false`, route `reject`, evidence `decided: <where it is recorded>`, with no code reading. If it names a concrete bad outcome the record does not mention, verify it like any other; if it is real, route it `intent_gap`, because the decision may be what is wrong. For every other finding:

1. **Check the claim.** Open the location and read past the changed lines (callers, upstream guards) until you know whether the bad outcome happens. Code that fails loudly on a state nobody showed to be reachable is correct.
2. **Give one verdict.**

| Verdict | Meaning |
|---|---|
| `high` / `medium` / `low` | Real. Graded by harm to users or developers; unsure means the higher grade. |
| `false` | Checked; it does not happen. |
| `maybe-false` | Code and diff cannot settle it. |

3. **Reject** `false` findings, rare `low` findings whose fix adds complexity, findings whose only fix edits the build spec, and out-of-scope findings only when the intent excludes them.
4. **Group** by shared root cause (same file or same fix is not enough). A group takes its worst verdict.

Verification-gap findings are trusted as filed only when that reviewer ran at the `top` tier; otherwise they are re-verified. `over-engineering:` findings are `patch` unless removal changes behavior the spec asks for. On a loopback, a finding that matches an existing row (same location, same claim) is marked `carried` and not redone.

### Routes

| Route | Use when | Build does |
|---|---|---|
| `intent_gap` | The frozen intent is incomplete; the spec cannot settle it. | Revert code, ask the human, [renegotiate the frozen block](Frozen-Intent-and-Guards.md), re-plan. |
| `bad_spec` | The spec's approach was wrong; patching leaves incoherent code. | Write KEEP notes, revert, amend non-frozen sections, re-implement (one tier up on the first loopback). |
| `amend` | The spec missed a case or rule; the approach holds. | Log it, add the rule, patch the code. No revert. |
| `patch` | Trivial fix, no new public surface, no spec change. | One message to the implementer, then re-verify. |
| `defer` | Not this change's problem: pre-existing, serious but unverified, or fixable only in an agent-context file. | Append to `deferred.md`. |
| `reject` | Filtered out by the rules above. | Logged, nothing else. |

Tie-breaks: ask "if I add this to the spec, does the existing code keep the right shape?" Yes is `amend`, no is `bad_spec`. Torn between `patch` and a spec route: take the spec route. Torn between `amend` and `bad_spec`: take `amend`, unless two or more findings share one approach-level cause. An all-`maybe-false` group is deferred only if it would be `medium` or `high` if true; if only `low`, reject.

Deferred entries (`source`, `summary`, `evidence`) are append-only and never deduplicated. A summary starts with `agent-context:` when the fix would edit `CLAUDE.md`, `AGENTS.md` or rules; [`lean-change retro`](lean-change.md) turns those into proposed pitfalls.

## Loopbacks and escalation

- Order: `intent_gap` and `bad_spec` first, then `amend`, then `patch`. Patches wait until no loopback is pending.
- Each loopback increments `review_loops` in the spec. Past 3, build halts and escalates to the human. `amend` and `patch` do not count.
- `--auto`: a halt becomes `status: blocked` plus `blocked_reason`.
- Small route has no spec to loop through: `intent_gap` or `bad_spec` halts and asks; `amend` switches the story to `route: full`.
- Worker tier escalation is in [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).

## The Review Triage Log

Every finding is one row of `## Review Triage Log` in the story spec. Never drop or merge a row. `lens` is the reviewer's lens name; `verdict` is one of the five above; `route` is one of `patch | amend | bad_spec | intent_gap | defer | reject`.

```markdown
| # | lens | verdict | route | evidence |
|---|---|---|---|---|
| 1 | adversarial | false | reject | `parse()` runs only after `validate()` rejects empty input (`api.ts:41`). |
| 2 | edge-case | high | patch | `limit=0` returns every row; no guard at `list.ts:18`. |
| 3 | verification-gap | medium | amend | Spec has no row for expired tokens; no test hits `auth.ts:77`. |
| 4 | security | medium | bad_spec | `search.ts:30` builds SQL by concatenation; the spec chose raw queries. |
| 5 | adversarial | maybe-false | defer | Cache refill may race; medium if real. A concurrent-load run would settle it. |
```

*(Illustrative.)*

### How `metrics` reads it

```bash
node _lean/bin/lean.js metrics [--epic E1] [--json]
```

- It counts log rows, never numbers the agent wrote about itself. Only `done` stories count.
- A verdict or route outside the vocabulary is counted as `unparsed` or `other`.
- It reports findings by verdict, routes taken, false rate, and findings and false rate per lens and per reviewer model (`metrics.models.review` in the spec frontmatter), plus loops and escalations. For the log above: 5 findings, 20% false, `adversarial` 50% false. That shows whether a cheaper reviewer tier is noisy.
- `check` warns, without failing, on `story/no-triage-log` (a story with a `route` that is `in-review` or `done` but has no log) and `story/triage-vocab` (verdict or route outside the vocabulary).

## See also

- [lean-review](lean-review.md): run a review on a diff, branch or planning doc.
- [lean-build](lean-build.md): where the lenses run per story and routes are acted on.
- [Frozen Intent and Guards](Frozen-Intent-and-Guards.md): why `intent_gap` reopens the frozen block.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): reviewer tiers and escalation.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): `check` and `metrics` in full.
