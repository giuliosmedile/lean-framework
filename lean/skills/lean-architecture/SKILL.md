---
name: lean-architecture
description: 'Record the few architecture decisions that keep separately built stories consistent, in a short ARCHITECTURE.md. Works from a SPEC.md, a raw idea, or an existing codebase. Creates, updates, or validates. Use when the user says "create the architecture", "technical design", or "solution design".'
---

# Lean Architecture

Produce `plan/ARCHITECTURE.md` (project-wide; see the **Layout** in `{skill-root}/../lean-kit/SKILL.md`): a **consistency contract**, not a design encyclopedia. It fixes only the invariants that stop independently built stories from diverging — the paradigm, dependency direction, how state changes, who owns shared data, the shapes that cross boundaries. Everything else is seed (true at day one, owned by the code afterwards) or deferred.

**The test for every decision:**

> If two stories were built independently, could they choose incompatibly here? Record it only if yes, **and** it is non-obvious, **and** it is a real trade-off. Otherwise put it under Deferred, or leave it to the code.

Speak the user's language.

**On start:** follow `{skill-root}/../lean-kit/SKILL.md` → *Every lean skill, on start*. You are the orchestrator: every AD is yours; workers only scan and check. User-facing messages use the kiss shape.

**KISS bias:** default to a monolith, one datastore, the framework's conventions, and a well-known starter. Every AD that adds a moving part (queue, cache, service split, second datastore) must name the measured need in its Decision Log entry, or it doesn't go in. In `kiss` style, stay within the AD cap in `kiss.md` §B: if more seem needed, the scope is probably too big.

## Inputs

Read `plan/SPEC.md` (+ companions) if it exists; inherit everything it settles without re-asking. Check `docs/` (the input folder) for existing design material, such as architecture docs, ADRs, API specs, data models, and infra notes. Treat what's there as input to ratify or challenge, and cite it in the Decision Log. Also works from a raw idea (suggest `lean-intent` first if it's too thin to build on) or from an existing codebase.

**Brownfield:** investigate first. Launch `scout` workers in parallel (e.g. one for layering + dependency direction, one for data ownership + persistence, one for stack versions + build/test/deploy), each returning ≤ 15 bullets with file references. Spot-check anything you'll ratify. Ratify the conventions the code already shows as `[ADOPTED]` decisions; don't invent new ones and don't re-tell the user what the scan found.

## Working style

Default to **coaching** for the load-bearing calls — paradigm, stack/starter, major boundaries: lay out the 2–3 realistic options, say which you lean toward and why, and let the user choose. Everything below that, decide yourself and tag `[ASSUMPTION]`. If the user asks for speed, draft everything with tags and let them correct.

- Greenfield or beginner-friendly: recommend a well-known current starter/template; it pre-decides a coherent slab of architecture for free.
- **Verify on the web** the current stable version of every technology you pin; a `research` worker can collect them in one batch. Don't pin from memory.
- Present load-bearing options as a table (option · gains · costs), with your recommendation marked.
- Ask once, up front, whether anyone besides builders will read this (team alignment, stakeholders). If yes, offer an extra human-facing rendering at the end; ARCHITECTURE.md itself stays terse.

## Draft

Fill `assets/architecture-template.md`:

- Lead with a **named paradigm** (hexagonal, layered, pipes-and-filters…) — it carries a whole model for free.
- **Modules table**: module · responsibility · talks to (DBs, externals) · holds state? · depends on. Separate what *thinks* (pure logic) from what *talks* (I/O); one composition root knows everything else. State the dependency rule as an AD that a test can check ("no imports between X, Y, Z; only the root knows all"). Ask early how many people will build this in parallel: with 2+, shape modules so each could be one lane's territory. `lean-plan` draws lanes from this table.
- Each decision is an `AD-n` with **Binds** (which CAPs/areas), **Prevents** (the divergence), **Rule** (enforceable). Stable IDs: never renumber, never reuse.
- Shape goes in diagrams (valid mermaid), not prose. Include the dependency-direction diagram — it *is* a rule.
- Rationale goes in the Decision Log, not in the AD.
- **Sweep every dimension**: each of data, boundaries/APIs, state, errors, auth, config, deployment & environments, observability, testing approach is decided, deferred (with reason), or an open question. A dimension left silent is the classic failure.
- Map every SPEC capability to where it lives and what governs it.

## Review

Self-check against the test above and the sweep. Then — unless the project is a throwaway — launch **one** `check` worker with `{skill-root}/../lean-review/lenses/doc-rubric.md` (ARCHITECTURE section) against ARCHITECTURE.md and SPEC.md. For platform-scale or high-risk systems, add the adversarial lens as a second worker in parallel, or run the rubric at `top`. Verify each finding yourself; apply the clear fixes; bring the user only what needs a decision.

## Close

Put blocker open questions to the user in one kiss-shaped message. Set `status: final`, log `finalized` and the `workers:` line. Next: `lean-plan`.

## Update

Read ARCHITECTURE.md and its Decision Log. Log the change, amend the affected AD's Rule in place (or add the next AD-n), never renumber. If stories already exist, list the story files (in `active` and `done` epics) whose `rules:` reference a changed AD, and suggest `lean-change course`.

**Keep it readable as it grows:** when `lean-method check` warns `doc/log-size`, move all but the newest 10 Decision Log entries to `plan/ARCHITECTURE.log.md`, leaving a pointer line. Superseded ADs stay in place with a `superseded by AD-n` line (ids are never reused); when there are many, move them to `plan/ARCHITECTURE.archive.md`.

## Epic scope

When pointed at one epic (`plan/epics/<E>-*/`), the project ARCHITECTURE.md is **binding and read-only**. Fix only what that epic's stories could diverge on and the project left open: its `Deferred` items, plus the epic's internal seams. Write these into the epic's `EPIC.md` → `## Epic decisions`, continuing the global AD numbering, and log them in its Decision Log. An epic decision that contradicts or weakens a project AD is a conflict to raise with the user, not a local override.

## Validate

Critique only: run the rubric (and adversarial lens), report blockers first, offer to roll findings into an Update.
