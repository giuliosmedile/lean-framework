**`lean-review` runs independent reviewers on a diff, a branch or a planning doc, checks every finding itself, and reports only what is real.**

It runs only when you ask. The skill triggers on the word "review" and must never run uninvited, including on edits the agent just made. The model behind it (lenses, triage, routes) is on [Review and Triage](Review-and-Triage.md).

## Invoke it

Ask in plain words (illustrative):

```
review my uncommitted changes
review this branch against main
review the last 3 commits with the security lens only
review plan/SPEC.md
review plan/epics/E2-search
```

- **Code:** uncommitted work (untracked files included), a branch, or a commit range. A branch is diffed against its merge base. For a PR, check out its branch; the skill stages a local diff and names no PR-fetching step.
- **Planning docs:** `SPEC.md`, `UX.md`, `ARCHITECTURE.md`, `epics.yaml`, an epic folder, `CONTRACTS.md`.
- **Other prose:** reviewed with the adversarial lens alone.

## Which lenses run

If you name lenses, exactly those run. Otherwise:

| You review | Lenses | Worker role |
|---|---|---|
| Code | adversarial, edge-case, verification-gap; plus security if the diff touches auth, personal data, money, secrets, external input, files, shell or queries | `review` |
| Planning doc | doc-rubric, adversarial | `check` |
| Other prose | adversarial | `check` |

If the change has its own account of itself (a build spec, PR description, commit messages), the skill stages it as a claims file. Only the edge-case lens gets it, and reads it last.

## What happens

1. The skill writes the diff to a uniquely named file in the system temp directory.
2. It announces the content type and lenses in one line.
3. It launches every lens at once as blind workers, passing file paths (and the paths of any recorded decisions, which the lenses do not re-argue as preferences; story lines tagged `[ASSUMPTION]` stay open, and a decision that produces a wrong result is reported as `decision-conflict:`), never pasted content. Without subagent support, it runs the lenses one after another in the same session, so they are no longer blind.
4. After all report, it triages. For code it verifies each finding, grades it and groups duplicates. For documents it verifies each finding against the doc and its sources, drops false ones and groups duplicates. It does not patch or route anything unless you ask.
5. It reports.

The orchestrator is the judge. Triage never runs on a worker.

## What you get back

A short report in the KISS shape (illustrative):

```
**lean-review · done** — last 3 commits: 1 high, 2 medium findings
| location | problem | fix |
|---|---|---|
| list.ts:18 | `limit=0` returns every row | reject `limit < 1` |
plus 2 medium/low — ask to see them
Rejected as false: 3
Workers: review=sonnet×3, escalations=0
```

- A verdict line.
- A table of high and blocker findings: location, problem, fix.
- A one-line tail counting the medium and low findings you can ask to see.
- How many findings were rejected as false, so you know what was filtered.
- Workers used and any escalations.

For planning docs the verdict is `ready`, `ready with fixes` or `not ready`, and findings are tagged `blocker`, `high`, `medium` or `low`.

## Fixing

The skill offers to fix. On yes, it applies patch-grade fixes directly. Anything larger becomes a [`lean-build`](lean-build.md) intent or a deferred entry. The Review Triage Log table lives in a build spec, so a standalone review reports counts instead.

## How build reuses it

`lean-build` has no copy of the lenses. It reads `triage.md` and the lens files from the sibling `lean-review` skill, so the installer always installs them together. `lean-intent`, `lean-architecture` and `lean-plan` reuse the doc-rubric file the same way, scaled to stakes.

| | Standalone review | Review inside `lean-build` |
|---|---|---|
| Content | the diff you name | the review window: diff since the first story built after the last feature review |
| Lenses | by content type | by route; security if `security: true` or a trust boundary |
| Claims file | spec, PR text or commits, if any | the story spec |
| Triage | verify, grade, group | plus routes, loopbacks and a Review Triage Log |
| Fixes | only if you ask | automatic, by route |

## See also

- [Review and Triage](Review-and-Triage.md): lenses, evidence rule, routes, loopbacks, log format.
- [lean-build](lean-build.md): the build step that reviews each feature once, at its final story.
- [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md): which tier the `review` and `check` workers run on.
- [Supported Tools](Supported-Tools.md): which tools give blind parallel review and which fall back to one session.
- [KISS Style](KISS-Style.md): the reply shape and the over-engineering rules reviewers enforce.
