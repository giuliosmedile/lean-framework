**`lean-help` is where to start when you don't know which skill to use: it routes a request to the right `lean-*` skill, says what comes next from the plan state, and explains how LEAN works.**

It spawns no workers, writes no files, and loads no orchestration rules. It reads the config, a few frontmatters, and `docs/` timestamps. Every reply uses the [KISS reply shape](KISS-Style.md).

## Three jobs

The skill picks one from your request.

| You... | It... |
|---|---|
| ask for something to be done | **routes**: runs the matching skill, or recommends it |
| ask where you are or what's next | **orients**: reads project state, recommends the next step |
| ask how LEAN or a procedure works | **explains**: answers from its bundled `guide.md` and the skill files |

## Example prompts

| Say | Result |
|---|---|
| "Fix the login bug" | routes to `lean-build` and starts it |
| "Is this PRD any good?" | routes to `lean-intent` in validate mode |
| "Split this across Anna and Marco" | routes to `lean-plan` (lanes) |
| "We have to drop Redis" | routes to `lean-change course` |
| "Create stories" (no SPEC yet) | recommends `lean-intent` first, with the reason |
| "What next?" / "Where do I start?" | orients |
| "How do lanes work?" / "What is `E2-0`?" | explains, using your plan as the example |
| "Which skill should I use for X?" | recommends, does not run |

The skill triggers on phrases such as "lean help", "help", "what next", "where do I start", and "which skill should I use". It also triggers on a LEAN-shaped request that names no skill. OpenCode also gets a command pointer, `.opencode/commands/lean-help.md`.

## Route: run or recommend

It matches by intent, not keywords, then checks prerequisites against the project state. A missing prerequisite changes the answer.

- **Run it** when exactly one skill fits, its prerequisites are met, and you asked for the work, not just about it. It says in one line which skill it starts and why, then invokes it with your request unchanged. It does not ask permission first.
- **Recommend** when two skills fit, a prerequisite is missing, the request is ambiguous, or you only asked which skill to use. You get one recommendation with its reason and at most one alternative, as lettered choices.
- **Never runs `lean-review` uninvited.** [`lean-review`](lean-review.md) runs only when you say "review".
- **Nothing in LEAN fits** (a git question, a one-line typo)? It says so in one line and helps normally.

## Orient: what next

It starts with `node _lean/bin/lean.js next` and `check` ([CLI](CLI-Plan-Tooling.md)), which answer most of it. It then reads only what they don't cover:

- `_lean/_config/manifest.yaml` (installed? version, tools). If missing, it mentions `npx lean-method install` once. Everything still works without it.
- `docs/`: the file list and modification times only.
- `plan/SPEC.md` and `plan/ARCHITECTURE.md`: frontmatter `status`, `updated`, `sources`.
- `plan/epics.yaml`, then for **active** epics only: `stories.yaml`, story frontmatters, the `EPIC.md` Team section, `CONTRACTS.md`, `deferred.md`.
- `plan/adhoc/*.md` frontmatter. It never opens `done` epics.

It recommends the **first** row that applies:

| State | Next |
|---|---|
| A story or ad-hoc spec is `draft`, `ready`, `in-progress` or `in-review` | resume it with `lean-build` |
| No SPEC, files in `docs/` | `lean-intent` (it names the files) |
| No SPEC, `docs/` empty | add material to `docs/` or describe the idea, then `lean-intent`; for a small change, `lean-build` directly |
| `docs/` file newer than SPEC `updated`, or not in `sources` | `lean-intent` update if still planning; `lean-change course` if building has started |
| SPEC is `draft` | finish it with `lean-intent` |
| SPEC final, no ARCHITECTURE, parts built separately or by 2+ people | `lean-architecture` |
| SPEC final, no `epics.yaml` | `lean-plan` (epics) |
| No `active` epic; a `planned` one has its dependencies done | `lean-plan` on that epic |
| Active multi-lane epic, `<E>-0` not done | `lean-build <E>-0` (no lane starts before it) |
| A story is `blocked` | read `blocked_reason`: plan or contract problem, `lean-change course`; an answer you owe, it asks you |
| Seam checkpoint or decision overdue | that checkpoint story or decision |
| `todo` stories in an active epic | `lean-build` on the next one (per lane) |
| Every story of an active epic `done` | `lean-plan status` to close it, then `lean-change retro` |
| All epics `done` | `lean-intent` to extend the SPEC, then `lean-plan` |

Because the first match wins, work in flight outranks a new file in `docs/`. If your request is itself the next step, it routes instead of only reporting.

## Explain

It answers from `guide.md` first, then reads the relevant `SKILL.md` and assets for procedure details. It answers in its own words and does not paste files.

- It leads with the answer in 1 to 3 sentences, then a small table or at most 7 bullets.
- It uses your project as the example when there is one ("in your plan, `E2-0` is...").
- For BMAD comparisons it uses the mapping on [LEAN vs BMAD](LEAN-vs-BMAD.md).
- If the files don't say, it says so. It does not invent behavior.
- It ends with the one skill or command that lets you try it.

## Shape of an answer

Illustrative. Orient:

```
**lean-help · orient** — E2 active, one story in review

| epic | status | stories |
|---|---|---|
| E1 Core search | done | 4/4 |
| E2 Export | active | 2/5 |

E2-3 is `in-review`: plan/epics/E2-export/stories/E2-3-csv.md
Next: lean-build E2-3 (resumes at review)
```

Route, when a prerequisite is missing:

```
**lean-help · route** — no SPEC yet, 2 files in docs/

Decide:
1. Stories need a SPEC first. — (a) lean-intent on docs/brief.md and docs/notes.md ← recommended  (b) describe the idea instead

Next: lean-intent
```

Route, when the fit is clear, is one line, and the chosen skill then answers in its own shape:

```
Starting lean-build: a bug fix needs no SPEC.
```

## See also

- [The LEAN Process](The-LEAN-Process.md): the full path and the skill catalog `lean-help` routes over.
- [lean-kit](lean-kit.md): config view and the shared rules every skill follows.
- [CLI Plan Tooling](CLI-Plan-Tooling.md): the `next` and `check` commands it starts with.
- [FAQ](FAQ.md): common questions and troubleshooting.
- [Getting Started](Getting-Started.md): install and a first run.
