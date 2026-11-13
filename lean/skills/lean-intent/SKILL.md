---
name: lean-intent
description: 'Capture what to build and why in one short SPEC.md (plus UX.md when UI matters), from an idea, notes, transcript, brief, or existing PRD. Creates, updates, or validates a spec. Use when the user says "create a spec", "write a PRD", "capture requirements", "product brief", or "pressure-test this idea".'
---

# Lean Intent

Produce `SPEC.md`: the contract for *what* to build and *why*, short enough that every downstream step reads all of it. You draw the intent out of the user; you never substitute your own. Every inference you make without confirmation is tagged `[ASSUMPTION: …]`.

Speak the user's language. Write documents in the language the user asks for (default: the conversation's language).

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*. You are the orchestrator: you write the spec and talk to the user; workers only extract, research, and check. All user-facing messages use the kiss shape.

## Workspace

`plan/SPEC.md` (and `plan/UX.md`). There is one SPEC per project; see the **Layout** in `{skill-root}/../lean-kit/SKILL.md`. If it exists, this is an **update** (see below). A new initiative in an existing project is an update too: new capabilities get the next free CAP ids, and `lean-plan` turns them into new epics.

## Modes

Infer from the request; ask only if genuinely unclear.

- **Create** — no spec yet.
- **Update** — a spec exists and something changed. Read SPEC.md and its Decision Log first; the log is the authority on what was decided and why.
- **Validate** — critique only, no edits. Run the review in *Review* below and report.

## Create

### 1. Intake (one turn)

First list `docs/` (the input folder; see the Layout). Then ask for everything at once: the idea in their words, which of the listed documents apply (default: all of them; show the list), and any material elsewhere (a path or a paste). If `docs/` is empty, say where to drop files next time. Ask one calibration question in the same message: **hobby / internal tool / product launch?** That sets depth:

| Stakes | Extras |
|---|---|
| hobby | none |
| internal | UX.md if UI-heavy |
| launch | UX.md if UI matters; companion files for heavy concerns (compliance, integrations, data governance, monetization) |

Length caps per stakes: `kiss.md` §B.

Record every document you used in SPEC.md's `sources:` frontmatter. Large source documents: send each to a `scout` worker that returns its load-bearing claims as ≤ 20 bullets with section references. Don't load them whole into your own context; open the source yourself only to settle a specific claim.

### 2. Choose the path

Offer, in one line, defaulting to fast:

- **Fast** — you batch remaining gaps into one consolidated question round, then draft the whole spec with `[ASSUMPTION]` tags. The user corrects in review.
- **Coaching** — walk the sections together with open-ended questions ("tell me about who hits this problem") rather than multiple choice. Use when the user is still forming the idea or explicitly wants it.

If the idea is half-formed or the user asks to pressure-test it, offer the **challenge round** first (below).

### 3. Draft

Fill `assets/spec-template.md`. Rules:

- **Capabilities describe WHAT, never HOW.** Tech choices go to the Decision Log as `[for architecture]` or wait for lean-architecture.
- **Every capability has an intent and a testable success.** If you can't write the success line, it's an open question.
- **Quality requirements carry numbers.** "Fast" is a finding, "p95 < 300 ms on the search endpoint" is a requirement.
- **At least one non-goal.** An empty non-goal list invites downstream to fill the vacuum.
- **Name the concerns this product actually carries** (compliance, integrations, offline, multi-tenant, money, PII, hardware…) and give each one a home — a constraint, a quality requirement, or a companion file. A recognized domain concern the input is silent on (health data without HIPAA, payments without PCI) is an Open Question, never an invented answer.
- **Journeys only when they earn it** (consumer, multi-role, UX-heavy). Narrated by the user with a named protagonist, captured by you; drop the section for single-operator tools.
- Every sentence carries load. No vision theater, no persona theater, no boilerplate NFRs.
- **KISS scope:** when a capability could be cut or merged without losing the Why, propose the cut. Fewer capabilities beat thorough ones.

**UX.md** (only when UI is a major part): fill `assets/ux-template.md` in the same session. Elicit; don't propose colors or patterns unless asked. If the project uses an existing design system, reference it and record only the deltas.

### 4. Self-check, then one independent review

Self-check against the rules above and against the sources: every load-bearing source claim landed somewhere (or was dropped on purpose — log it).

Then, unless stakes are hobby, launch **one** `check` worker with `{skill-root}/../lean-review/lenses/doc-rubric.md` (SPEC section) against SPEC.md (and UX.md). Verify each finding yourself before acting on it; apply clear fixes; bring only real decisions to the user.

### 5. Close

Put Open Questions and `[ASSUMPTION]` tags to the user in **one** kiss-shaped message (numbered, lettered options, recommendation marked). Blockers (would make architecture or planning unsafe) get resolved now; the rest stay listed. Set frontmatter `status: final`. Log `finalized` and the `workers:` line in the Decision Log. Recommend the next step in one line: `lean-architecture` when separately built parts could diverge, otherwise `lean-plan`.

## Challenge round (optional)

Replaces PRFAQ / forge-idea. Ask 5–7 hard questions, one or two at a time, each from a named angle: **skeptical customer** (why would I switch?), **operator** (who runs this at 3am?), **engineer** (what's the hardest part?), **finance** (what does it cost / earn?), **competitor** (why won't we just copy it?). Push back on thin answers once. End with a 3-line verdict — proceed / reshape / drop — and carry surviving insights into the spec.

## Research (optional)

When the market, domain, or prior art would change decisions, launch a `research` worker with a precise question; take back ≤ 10 bullets with sources, not raw pages. Spot-check any source a decision will rest on. Record what changed a decision in the Decision Log, citing the source.

## Update

Read SPEC.md, UX.md, and the Decision Log. Capture the change as new log entries, surface conflicts with earlier decisions before applying, then edit the spec. **Capability IDs are stable**: never renumber, never reuse a retired ID; new capabilities get the next free number. If `plan/epics.yaml` exists, list the epics whose `caps` include a changed capability. In epics that are `active` or `done`, list the story files whose `caps` include it. Then suggest `lean-change course`.

**Keep it readable as it grows** (every downstream skill reads SPEC.md whole). When `lean-method check` warns `spec/size` or `doc/log-size`:
- **Retired capabilities** move, with their ids, to `plan/SPEC.archive.md` (same CAP format, plus a `retired:` line with date and reason). Their ids stay taken forever; `check` knows them from the archive.
- **Decision Log rollover:** move all but the newest 10 entries to `plan/SPEC.log.md` (append, oldest first), leaving a line `Earlier decisions: SPEC.log.md`. Update mode reads the log file too when a change touches an old decision.
- Never archive a capability an active or planned epic still claims.

## Review

Validate mode: run `check` workers in parallel with the `doc-rubric.md` SPEC lens and the adversarial lens, verify their findings, report tiered (blockers first, then a one-line tail of the rest). Offer to roll findings into an Update.
