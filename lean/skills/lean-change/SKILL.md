---
name: lean-change
description: 'Handle change once building has started. "course" mode: assess a significant mid-flight change across SPEC, UX, ARCHITECTURE, and stories, and apply an approved change proposal. "retro" mode: review a finished epic or milestone against the evidence it left and turn lessons into actions. Use when the user says "correct course", "the plan is wrong", "requirements changed", "retro", or "retrospective".'
---

# Lean Change

Two modes; infer which from the request.

Speak the user's language. Paths follow the **Layout** in `{skill-root}/../lean-kit/SKILL.md`: course proposals go to `plan/changes/`, and a retro goes to the epic's `retro.md`.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*. Workers gather evidence; you judge impact, write proposals, and talk to the user in the kiss shape. KISS here means choosing the smallest response that fixes the problem, and writing proposals as tables plus old → new edits, not essays.

## course — something significant changed

Use when a build hit a wall the plan didn't foresee, a requirement changed, or blocked stories and deferred items point at a plan problem. A single story's local problem isn't a course change; that belongs in `lean-build`.

1. **Trigger.** Get the trigger in one or two sentences, plus evidence (error, story, stakeholder request, failed approach). New or changed files in `docs/` (newer than SPEC.md's `updated`) are often the evidence: check them first. No evidence → ask for it before analyzing.
2. **Classify.** Technical limit found · new requirement · misunderstood requirement · strategic pivot · failed approach.
3. **Impact sweep.** Read SPEC.md, UX.md, ARCHITECTURE.md (with their Decision Logs), `epics.yaml`, and `plan/deferred.md`. Then, for the epics touched (by `caps`, or by stories whose `rules` cite a changed AD), read their EPIC.md, `stories.yaml`, story frontmatters, CONTRACTS.md, and `deferred.md`. Leave untouched epics unread. When done stories may be affected, a `scout` worker can check their code for the changed behavior and return file references. For each, answer: what must change, and which stories (done, in-progress, todo) are affected? Check done stories too — a changed capability may invalidate shipped code.
4. **Pick the smallest sufficient response** and say why:
   - adjust stories only;
   - amend SPEC / UX / ARCHITECTURE, then stories;
   - re-plan one epic (`lean-plan` on that epic), or add / split / drop an epic in `epics.yaml`;
   - stop and rethink (back to `lean-intent`).
5. **Proposal.** Write `plan/changes/{date}-{slug}.md`: trigger and evidence, impact table (artifact → change → affected stories), and every edit as **old → new** text with a one-line reason. Present it once, as a whole; the user approves, edits, or drops items.
   **Contract change** (multi-lane, CONTRACTS.md frozen) — the fast path when a lane needs a seam changed. The proposal names the seam, the change (types, value rules, fake, fixture values, contract test), and every lane and story affected. Get a yes from the owner of each affected lane (or the user acting for them). On approval, add one `<E>-C<n>` story (a file plus a `stories.yaml` entry; `lane: shared`, `checkpoint: spec`) ahead of the stories that need it. Log it in the epic CONTRACTS.md's Change Log, and tell every lane to rebase once it's done. Never let a lane patch the contracts locally.
6. **Apply** approved edits. Log each in the affected doc's Decision Log (`change — {gist} — see changes/{file}`). Keep IDs stable: retire, don't renumber. Stories touched: set the story file's `status: todo`, with a note under its title, if it needs rework. If it's obsolete, set the file's `status: retired` with a one-line reason, and keep its `stories.yaml` entry; the id is never reused. New stories get the next free id in their epic, with a stub file. Recommend the next step in one line.

## retro — an epic or milestone is done

Judge the finished work against the evidence it left, not memory. **Every finding cites a source** (file, line, commit, triage-log row, deferred entry). A claim you can't point at is not a finding — drop it.

1. **Scope.** Which epic (default: the most recent `done` epic in `epics.yaml`, or the active one whose story files are all `done`). If stories are still unfinished, say so and ask whether to proceed. Read only that epic's folder plus the SPEC/AD ids it cites.
2. **Gather evidence** with `scout` workers in parallel (e.g. one over build specs + triage logs, one over git history + deferred.md), each returning a digest with a source reference on every line. Re-open the source of any line you turn into a finding: the stories and their build specs — especially Review Triage Logs, Spec Change Logs, `review_loops` counts, and Implementation Notes; the epic's `deferred.md`; `git log` / diff stats for the epic's commits; the SPEC capabilities and ADs the epic covered.
3. **Analyze** for patterns no single story shows:
   - recurring finding types (same root cause across stories → a convention or AD is missing);
   - stories that looped back (intent_gap / bad_spec) → what planning missed;
   - drift: code that contradicts an AD or SPEC capability; ADs that turned out wrong;
   - deferred items that have become urgent;
   - seams (multi-lane): checkpoint failures and whose side was wrong; contract changes after freeze and what the value rules missed; trespass reverts; time from a lane's first story to its first green checkpoint; overdue decisions. Each is a lesson for the next CONTRACTS.md;
   - complexity creep: code or ADs that violate `kiss.md` §A, and over-engineering findings that kept recurring;
   - cost: `workers:` lines and escalations — which roles kept escalating (a sign the tier is set too low for that job);
   - acceptance: does the shipped epic actually meet the success lines of the capabilities it claimed?
4. **Verdict:** accept / accept with follow-ups / not accepted (name what's missing).
5. **Write** the epic's `retro.md`: verdict, findings with sources, and action items. Each action is a concrete edit with an owner: a new story in a later epic (or a new epic), an AD amendment, a convention added, or a deferred item promoted. Mark the epic `done` in `epics.yaml` and EPIC.md if it isn't already. Go over it with the user and apply the actions they approve. If findings show the plan itself is wrong, switch to **course**.

Interactive by default. With `--auto`: take the scope from the invocation, skip discussion, record every assumption you made in the retro file, and don't apply actions — list them as proposed.
