**Install LEAN into a project, check it works, and run your first change, feature or product.**

## Prerequisites

- **Node >= 20.19** (`node --version`).
- **An AI coding agent.** Full support: Claude Code, Codex, OpenCode, Antigravity CLI (AGY). The other 44 targets run the skills on one model without blind review. See [Supported Tools](Supported-Tools.md).
- **git** (recommended). Claims, the lane-trespass check, local commits and the pre-commit hook need it.
- **Network** on the first run: `npx` fetches the installer's five dependencies from the npm registry.

## Install today

LEAN is not on the npm registry yet. Pack it from a clone and run the installer from the tarball:

```bash
git clone https://github.com/giuliosmedile/lean-framework.git
cd lean-framework/lean && npm pack         # writes lean-method-0.8.0.tgz (the version in package.json)
LEAN_PKG="$PWD/lean-method-0.8.0.tgz"      # absolute path: you run npx from another folder
cd /path/to/your-project
npx --package="$LEAN_PKG" lean-method install
```

Once published, `npx lean-method install` is enough. Every other command below stays the same.

**Which directory does it install into?** The folder you run it from (`--directory <path>` overrides). Not the clone, not the git root. Run it in the project root you want. Running the checkout's `node tools/installer/lean-cli.js install` from inside `lean/` would install into `lean/`, so pass `--directory` there.

Preview first, if you like: `npx --package="$LEAN_PKG" lean-method scout` is read-only. It lists the agents and models found on this machine and suggests worker tiers.

## What the interactive install asks

In this order:

1. **Update or quick update**, only if LEAN is already installed here.
2. **Which tools** to install for. Detected agents are pre-selected. Pick "Antigravity CLI (AGY)", not "Google Antigravity".
3. **Seven questions**:

   | Question | Default | Flag |
   |---|---|---|
   | What the skills call you | system user | `--user-name` |
   | Project name | folder name | `--set core.project_name=…` |
   | Language for talking with you | English | `--communication-language` |
   | Language for documents | English | `--document-output-language` |
   | Source documents folder (LEAN reads, never writes) | `docs` | `--input-folder` |
   | Plans folder | `plan` | `--output-folder` |
   | Style: `kiss` or `standard` | `kiss` | `--style` |

   The two folders must differ.
4. **Model tiers** per tool that can give a subagent its own model: it shows the suggested mid and low models and lets you pick or type one. Cheaper workers, expensive judge: [Orchestrator and Cost Tiers](Orchestrator-and-Cost-Tiers.md).
5. **Reviewers on the session model?** Default no (mid tier). Yes catches more bugs and costs more.
6. **Hooks**: the frozen-intent guard (Claude Code, Codex; default yes) and a git pre-commit check (default no). See [Frozen Intent and Guards](Frozen-Intent-and-Guards.md).

## What lands on disk

Claude Code only; other tools differ in folder names ([Supported Tools](Supported-Tools.md)):

```
your-project/
  .claude/
    skills/lean-{intent,architecture,plan,build,review,change,kit,help}/
    agents/lean-{scout,research,implement,test,review,check}.md   each carries its model
    settings.json          guard hook merged next to your own settings
  _lean/
    config.toml            team answers (commit)
    config.user.toml       your answers + model tiers (gitignored)
    custom/                your overrides; the installer never touches them
    bin/lean.js            plan tooling, runs with plain Node
    hooks/frozen-guard.js
    _config/               manifests with a sha256 per installed file
  docs/                    empty: drop your source documents here
  plan/                    empty: LEAN writes specs and stories here
```

Commit it all except what `_lean/.gitignore` excludes. Codex, OpenCode and AGY share `.agents/skills/`. Codex only runs the hook after you trust it once with `/hooks`. Layers and keys: [Configuration](Configuration.md).

## Non-interactive

```bash
cd /path/to/your-project
npx --package="$LEAN_PKG" lean-method install --yes \
  --tools claude-code \
  --user-name ada --style kiss \
  --set core.project_name=notes-app \
  --set orchestration.tiers.claude-code.mid=sonnet \
  --set orchestration.tiers.claude-code.low=haiku \
  --git-hook
```

- `--yes` takes every default. Without `--tools` it uses the agents `scout` detects, and fails if none.
- No terminal (CI) also means non-interactive.
- Valid values: `install --list-tools` and `install --list-options`.
- Also: `--no-scout`, `--no-guard-hook`, `--action update|quick-update`.

## Verify

```bash
npx --package="$LEAN_PKG" lean-method status
node _lean/bin/lean.js check               # PASS — plan: 0 error(s), 0 warning(s)
node _lean/bin/lean.js next                # nothing ready — plan the next epic (lean-plan) or unblock a story
```

`status` prints version, tools, style, folders, `role=model` pairs and any installed files you edited:

```
LEAN 0.8.0 — installed 2026-11-13T…, updated 2026-11-13T…
tools: claude-code   skills: 9   role agents: 6
style: kiss   input: {project-root}/docs   output: {project-root}/plan   primary: claude-code
  claude-code: scout=haiku · research=sonnet · implement=sonnet · test=sonnet · review=sonnet · check=sonnet
no installed files edited
```

Open your agent in the project folder (restart it if it was running) so it loads the new skills.

## Your first run

Name the skill in your message. Claude Code and OpenCode also take it as a slash command (`/lean-build …`).

**Small change or bug fix: `lean-build` alone.** No plan needed.

```
Use lean-build: the signup form accepts "a@b" as an email. Reject addresses without a dot in the domain.
```

Commit or stash first: a dirty tree makes it stop and ask. It writes `plan/adhoc/<slug>.md`, implements in a fresh worker, reviews, commits locally. It never pushes.

**A feature: intent, plan, build.**

```
Use lean-intent. I want CSV export in my notes app. The support digest is in docs/.
Use lean-plan to create the epics.
Use lean-build: next story.
```

Repeat the last line per story. `lean-intent` asks one batch of questions; answer in the shape `1a 2b`. `lean-plan` asks how many people or agents work on the epic at once. When the last story is done: `Use lean-change retro`.

**A product, or parts built separately: add `lean-architecture`** after the SPEC.

```
Use lean-intent. <your idea>. Briefs and notes are in docs/.
Use lean-architecture.
Use lean-plan to create the epics.
Use lean-build: next story.
```

Two or more people on one epic need this path: lanes come from the module table. See [Parallel Teams](Parallel-Teams.md).

**Lost?** `Use lean-help: what next?` reads your plan and recommends the next step.

## Update and remove

Re-run `install`: `update` re-asks with your answers as defaults, `quick-update` keeps them. `uninstall` keeps `_lean/custom/` and your plans. Details: [CLI Installer](CLI-Installer.md).

## See also

- [Walkthrough Example](Walkthrough-Example.md): the feature path end to end, with the files each skill writes.
- [The LEAN Process](The-LEAN-Process.md): how the nine skills hand work to each other.
- [CLI Installer](CLI-Installer.md): every installer command and flag.
- [Supported Tools](Supported-Tools.md): per-tool folders, role agents and hooks.
- [Configuration](Configuration.md): tiers, overrides and `update` vs `quick-update`.
