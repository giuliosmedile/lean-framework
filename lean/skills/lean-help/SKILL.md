---
name: lean-help
description: 'Routes a request to the right lean-* skill — runs it directly when the fit is clear, otherwise recommends one with the reason — and explains how the LEAN framework works. Reads the project state (config, SPEC, stories, contracts) to say where you are and what comes next. Use when the user says "lean help", "help", "what next", "where do I start", "which skill should I use", asks how LEAN (or a part of it) works, or makes a LEAN-shaped request without naming a skill.'
---

# Lean Help

Three jobs, picked from the request:

| The user… | You… |
|---|---|
| asks for something to be done ("plan the epic", "review my branch", "the requirements changed") | **route** — run the matching skill, or recommend it |
| asks where they are or what's next | **orient** — read the project state, recommend the next step |
| asks how LEAN or a procedure works | **explain** — answer from `guide.md` and the skill files |

**On start:** read the `_lean/` config as described in `{skill-root}/../lean-kit/SKILL.md` → *Config* (language, output folder, style). Don't load `orchestration.md`; this skill spawns no workers. Every message uses the kiss shape from `{skill-root}/../lean-kit/kiss.md` §C, and follows `ste.md` when `lean.prose` is `ste80`.

## Catalog

| Skill | Use it for | Needs first | Produces | Usually next |
|---|---|---|---|---|
| `lean-intent` | capture what and why: idea, brief, PRD, requirements, pressure-testing an idea | nothing | `SPEC.md` (+ `UX.md`) | architecture or plan |
| `lean-architecture` | invariants that keep separately built parts consistent; module table; brownfield conventions | a SPEC (or a clear idea / existing code) | `ARCHITECTURE.md` | plan |
| `lean-plan` | epics, then one epic's stories; team lanes and contracts; readiness; progress status | a final SPEC; ARCHITECTURE for 2+ lanes | `epics.yaml`, epic folders with `EPIC.md`, `stories.yaml`, story files (+ `CONTRACTS.md`) | build |
| `lean-build` | implement a story, feature, bug fix, or change: plan → code → review → commit | nothing for small work; a story for planned work | build spec + code + commit | next story |
| `lean-loop` | several planned stories back to back, unattended; each accepted only if the static checks pass | an active epic with `todo` stories; the plan CLI | built stories, `blocked` ones with the failing gate | resolve blocked ones, or `lean-plan status` at the epic's end |
| `lean-review` | an independent review of a diff, branch, or planning doc, **only when the user says "review"** | something to review | triaged findings | fixes via build |
| `lean-change` | `course`: a significant mid-flight change or a contract change · `retro`: a finished epic | epics exist | `plan/changes/` proposal / epic `retro.md` | plan or build |
| `lean-kit` | see or change config: model tiers, role agents, style, the guard hook and the plan CLI | nothing | config overrides | — |
| `lean-help` | this: routing, orientation, explanations | nothing | — | — |

Installer commands (terminal, not skills): `npx lean-method install | scout | status | uninstall`. Plan commands (also used by the skills): `node _lean/bin/lean.js check | next | freeze | metrics | claim`.

## Route

1. **Match** the request to the catalog by intent, not keywords. "Fix the login bug" → build; "is this PRD any good?" → intent (validate); "split this across Anna and Marco" → plan; "we have to drop Redis" → change course.
2. **Check prerequisites** against the project state (see *Orient*). A missing prerequisite changes the answer: "create stories" with no SPEC → recommend `lean-intent` first, and say why.
3. **Decide whether to run it:**
   - **Run it** — exactly one skill fits, its prerequisites are met, and the user asked for the work (not just about it). Say in one line which skill you're starting and why, then invoke it (the Skill tool, or the harness's equivalent), passing the user's request through unchanged. Don't ask permission first; that's the point of routing.
   - **Recommend** — two skills fit, a prerequisite is missing, the request is ambiguous, or the user only asked which skill to use. Give one recommendation with its reason, then at most one alternative, as a lettered choice (`(a) run lean-plan ← recommended (b) …`).
   - **Never run `lean-review` uninvited.** It runs only when the user explicitly says "review".
   - **Never run `lean-loop` uninvited.** It spends and commits across many stories, so it runs only when the user asks for several stories, the epic, or an unattended run. For "next story" alone, route to `lean-build`.
4. If nothing in LEAN fits (a git question, a one-line typo fix), say so in one line and just help normally.

## Orient

Paths follow the **Layout** in `{skill-root}/../lean-kit/SKILL.md`. Start with `lean-method next` and `lean-method check` (CLI per `lean-kit/SKILL.md` → *CLI*): they answer most of the table below. Then read only what they don't cover, without workers:

- `_lean/_config/manifest.yaml` — installed? which version and tools. If it's missing, mention `npx lean-method install` once; everything still works without it.
- `docs/` (the input folder): just the file listing and modification times.
- `plan/SPEC.md` and `plan/ARCHITECTURE.md` frontmatter `status`, `updated`, and `sources`.
- `plan/epics.yaml` — every epic's status.
- For each **active** epic only: its `stories.yaml`, the **frontmatter** of each story file (status, lane, blocked_reason), EPIC.md's Team section, CONTRACTS.md (seams, decisions due), and `deferred.md`.
- `plan/adhoc/*.md` frontmatter.
- Never open `done` epics for orientation.

Recommend the first step that applies:

| State | Next |
|---|---|
| A story or ad-hoc spec in progress (`draft` / `ready` / `in-progress` / `in-review`) | resume it: `lean-build` with that file |
| No SPEC, documents in `docs/` | `lean-intent` — it will distill them; name the files |
| No SPEC, `docs/` empty | put source material in `docs/` (or just describe the idea), then `lean-intent` — or `lean-build` directly for a small change |
| Files in `docs/` newer than SPEC's `updated`, or not in its `sources` | `lean-intent` update (if the SPEC is still being planned) or `lean-change course` (if building has started) |
| SPEC `draft` | finish it: `lean-intent` |
| SPEC final, no ARCHITECTURE, and parts will be built separately or by 2+ people | `lean-architecture` |
| SPEC final, no `epics.yaml` | `lean-plan` (epics) |
| No `active` epic, a `planned` one whose dependencies are done | `lean-plan` on that epic |
| Active multi-lane epic, `<E>-0` not done | `lean-build <E>-0` — no lane starts before it |
| A story `blocked` | read its `blocked_reason`: a contract change or plan problem → `lean-change course`; an answer the user owes → ask it |
| A seam checkpoint due, or a decision overdue (epic CONTRACTS.md) | that checkpoint story / that decision |
| `todo` stories in an active epic | `lean-build` on the next one (per lane when multi-lane); `lean-loop` to run several unattended |
| Every story of an active epic `done` | `lean-plan status` (closes it), then `lean-change retro` on it |
| All epics `done` | `lean-intent` to extend the SPEC, then `lean-plan` for new epics |

Show the state as one small table (epic · status · done/total stories; plus SPEC/ARCH status when not final), then `Next:`. If the user's request is itself a next step, route it (*Route*) instead of only reporting.

## Explain

Answer from `guide.md` first. For details of a procedure, read the relevant skill's `SKILL.md` (and its assets), then answer in your own words. Don't paste the file.

- Lead with the answer in 1–3 sentences, then a small table or ≤ 7 bullets if needed.
- Use the user's project as the example when there is one ("in your plan, E2-0 is…").
- When the question compares LEAN with BMAD, use the mapping in `guide.md` §8.
- If the files don't say, say so. Don't invent framework behavior.
- End with the one skill or command that lets them try it, if there is one.
