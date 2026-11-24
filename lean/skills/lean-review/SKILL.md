---
name: lean-review
description: 'Review a diff, branch, uncommitted changes, or planning document with independent context-free reviewers in parallel, then verify and triage their findings. Use only when the user explicitly asks to "review" something. Never invoke uninvited, including on edits you just made.'
---

# Lean Review

Run independent reviewers (lenses) in parallel against one piece of content, then verify every finding yourself before reporting. Report what is real; never pad.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*. Lenses run as `review` workers (code) or `check` workers (documents); you are the judge and do all triage yourself, never on a worker.

## Lenses

| Lens | File | Applies to |
|---|---|---|
| adversarial | `lenses/adversarial.md` | anything |
| edge-case | `lenses/edge-case-hunter.md` | code |
| verification-gap | `lenses/verification-gap.md` | code that changes behavior |
| security | `lenses/security.md` | code that touches a trust boundary: auth, personal data, money, secrets, external input, files, shell, queries |
| doc-rubric | `lenses/doc-rubric.md` | SPEC.md, UX.md, ARCHITECTURE.md, epics.yaml, an epic folder, CONTRACTS.md |

If the user names lenses, run exactly those. Otherwise: **code** → adversarial + edge-case + verification-gap, plus security when the diff touches a trust boundary (see the table); **planning doc** → doc-rubric + adversarial; **other prose** → adversarial.

## Run

1. **Stage the content as a file.** For a branch, uncommitted work (including untracked files), or a commit range, write the unified diff to a uniquely named file in the system temp directory. For a branch, diff against its merge base. If the change has its own account of itself (a build spec, PR description, commit messages), stage that separately as the claims file — it goes to the edge-case lens only.
2. **Announce** in one line: content type and lenses about to run.
3. **Launch every lens at once** as context-free workers at their role's tier (`orchestration.md` §2–3), each with: the absolute path of its lens file, the absolute path of the content file (never paste the content), any `also_consider` areas, the paths of any recorded decisions (the SPEC's Assumptions and Decision Log, an epic's or story's decisions), and for edge-case only, the claims file path marked "leave unread until your instructions call for it". End each prompt with: *"Decisions listed in those files are settled: do not re-argue them as preferences. Lines tagged `[ASSUMPTION]` in a story file are not settled: you may challenge them. If any decision produces a concrete wrong result, report it as `decision-conflict:` with the input and the wrong output. Do not invoke skills or spawn subagents — you are the reviewer. Return your findings as text in your final message."* Wait for all of them in this turn. Without subagent support, run the lenses sequentially yourself, finishing each before starting the next.
4. **Triage.**
   - Code: follow `triage.md` sections 1–2 (verify, grade, group). Don't patch or route anything unless the user asks you to fix.
   - Documents: verify each finding against the doc and its sources, drop the false ones, and group duplicates.
5. **Report** in the kiss shape: verdict line; a table of high/blocker findings (location · problem · fix); a one-line tail ("plus N medium/low — ask to see them"); counts rejected as false, so the user knows what was filtered; workers used and any escalations.

Offer to fix: on yes, apply patch-grade fixes directly; anything larger becomes a `lean-build` intent or a deferred entry.
