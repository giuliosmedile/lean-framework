**How the LEAN repo is laid out, how to test and extend it, and how releases and this wiki are maintained.** Everything LEAN ships lives in `lean/`.

## Repo layout

```
lean-framework/
  lean/                    LEAN: the `lean-method` npm package. Edit here.
  wiki/                    source copy of the pages of this wiki
  .gitignore
```

- **LEAN:** `lean/` (plus `wiki/`).
- **Baseline (history only):** the BMAD 6.12.4 install that LEAN was derived from and is measured against was committed once in `b6cf242`: `_bmad/` (config, manifests, 5 Python helper scripts), the 29 `bmad-*` skills in `.claude/skills/` and `.agents/skills/`, and 29 pointer files in `.opencode/commands/`. It is comparison material, not LEAN, and the working tree may not contain it. The [size measurements](LEAN-vs-BMAD.md#measured-size) and any comparison run depend on that commit. Recover the files with `git archive b6cf242 .claude .agents .opencode _bmad | tar -x -C <empty-dir>`. BMAD writes its documents to `_bmad-output/` (the `output_folder` in `_bmad/config.toml`); that folder was never committed.
- **Generated, never edit by hand:** a target project's `_lean/`, `.claude/skills/lean-*` and role agents. They are copies made by the installer. Edit the source in `lean/`, then reinstall; edited copies are backed up to `_lean/_backups/` on update.
- **Ignored by git:** `node_modules/`, `*.tgz`, `_lean/config.user.toml`, `_lean/custom/config.user.toml`. The root `.gitignore` still lists `explainer/` and Python entries from before 0.5.0.

## The `lean/` package

```
lean/
  package.json             name lean-method, version, bin lean + lean-method, node >=20.19
  README.md  COMPARISON.md package docs; BMAD-vs-LEAN run protocol
  skills/                  the 9 lean-* skills, copied as-is into projects
  src/module.yaml          install questions -> _lean/config*.toml
  tools/installer/
    lean-cli.js            `npx lean-method <cmd>`; loads every commands/*.js
    plan-cli.js            becomes _lean/bin/lean.js (plan commands only)
    commands/              install scout status uninstall | check next freeze claim metrics
    hooks/frozen-guard.js  becomes _lean/hooks/frozen-guard.js
    lib/
      installer.js         file plan, manifests, hooks, vendoring _lean/bin
      config.js            reads and writes _lean/config*.toml; role tiers
      scout.js             detects agents and models, suggests tiers
      role-agents.js       renders role agents per tool
      platform-codes.yaml  the 48 install targets
      plan.js plan-check.js metrics.js claims.js   plan tooling
      ui.js                prompts (@clack/prompts)
  test/                    installer.test.js, plan.test.js
```

Runtime dependencies: `@clack/prompts`, `commander`, `picocolors`, `smol-toml`, `yaml`.

## Run the tests

```bash
cd lean
npm install                                   # once
npm test                                      # node --test test/*.test.js
node --test --test-name-pattern=claims test/plan.test.js   # one test
```

Result on Node 22 at 0.10.1: 39 tests, 39 pass, 0 fail, about 6 s. The tests use the built-in `node:test` runner and drive the real CLI against temp directories.

- `installer.test.js` (16): scout and tier suggestions, role agents for each tool, install, update, quick-update, uninstall, hooks, and a check that every `` `assets/<file>` `` a skill mentions exists.
- `plan.test.js` (13): builds a small plan tree, then covers `check`, `next`, `freeze`, `metrics`, `claim`, lane trespass and the guard hook. Needs `git` on the path.

Try the installer from the checkout in a throwaway directory:

```bash
node tools/installer/lean-cli.js install --directory /tmp/try --tools claude-code --yes --no-scout
```

## How a skill is built

```
skills/lean-plan/
  SKILL.md              required
  assets/               templates the skill copies from (story-template.md, epics-template.yaml, ...)
```

- **Frontmatter:** exactly two keys, `name` and `description`. The description is one quoted line ending in trigger phrases ("Use when the user says ..."). OpenCode command pointers reuse it.
- **Discovery:** the installer takes every directory under `skills/` that starts with `lean-` and copies it whole to each tool's skills folder. Extra files ship automatically.
- **Body:** starts `# Lean <Name>`. Every skill except `lean-kit` then has an **On start** line pointing to `{skill-root}/../lean-kit/SKILL.md`. `{skill-root}` and `{project-root}` are placeholders the agent resolves.
- **Siblings:** skills read shared files from each other (`lean-kit/orchestration.md`, `kiss.md`; `lean-review/lenses/`, `triage.md`), so all nine always install together.
- **Templates:** refer to them as `` `assets/<file>` ``; the installer test fails if the file is missing.

## Add a platform target

Add an entry to `tools/installer/lib/platform-codes.yaml`:

```yaml
platforms:
  my-tool:
    name: "My Tool"
    preferred: false
    installer:
      target_dir: .my-tool/skills
```

- LEAN reads only `name`, `preferred`, `suspended`, `support`, `installer.target_dir` and `installer.commands_target_dir`. Other keys inherited from BMAD's schema (such as `global_target_dir`) are ignored.
- That entry gives **basic** support: skills install and run on one model. Check with `node tools/installer/lean-cli.js install --list-tools`.
- `commands_target_dir` writes one pointer file per skill (OpenCode uses `.opencode/commands`).
- **Full** support (`support: full`) also needs a renderer in `FORMATS` (`lib/role-agents.js`), a `HARNESSES` entry and a tier branch in `lib/scout.js`, and tests. A guard hook adds the tool to `GUARDED` in `commands/install.js` and add/remove functions in `lib/installer.js`.
- Worked examples: commits `553544a` (AGY) and `3323bb7` (Codex). See [Supported Tools](Supported-Tools.md).

## Add a CLI command

Create `tools/installer/commands/<name>.js` (illustrative):

```js
module.exports = {
  command: 'hello',
  description: 'Say hello',
  options: [['--directory <path>', 'Project directory (default: current directory)']],
  action: async (opts) => { process.stdout.write('hello\n'); },
};
```

- `lean-cli.js` registers every file in `commands/` automatically. A thrown error prints `lean-method <name>: <message>` and exits 1; set `LEAN_DEBUG=1` for the stack.
- To also offer it as a plan command (`node _lean/bin/lean.js hello`), add the name to `COMMANDS` in `plan-cli.js` and to `CLI_COMMANDS` in `lib/installer.js`; add any new lib to `CLI_LIBS`. That CLI is vendored without npm, so only `yaml`, `smol-toml` and `picocolors` are available, and options must be `--flag` or `--flag <value>`.
- Add a test, then update the README, the CLI section of `lean-kit`, and `guide.md` section 9. See [CLI: Plan Tooling](CLI-Plan-Tooling.md) and [CLI: Installer](CLI-Installer.md).

## Versions and releases

- **One source:** `version` in `lean/package.json`. The installer reads it for `--version`, the install banner and the manifest (`_lean/_config/manifest.yaml`, `installation.version`), which `status` and updates read back.
- **Not published:** no git tags, no changelog, not on the npm registry. `npm pack --dry-run` shows `lean-method-0.10.1.tgz` (54 files, about 116 kB); the `files` field in `package.json` decides what ships.
- **Local use:** `npm pack` in `lean/`, then `npx --package=./lean-method-0.10.1.tgz lean-method install`.
- **Convention in the history:** a release is one commit titled `LEAN x.y.z: <summary>` that bumps `package.json`, updates README and `guide.md`, and adds tests. The body lists the changes and the test count.

| Version | Commit | Date | Change |
|---|---|---|---|
| 0.4.0 | `b6cf242` | 2026-11-12 | Baseline: BMAD 6.12.4, LEAN draft (installer, scout, role agents), `explainer/` sources. 10 tests |
| 0.5.0 | `183d5f4` | 2026-11-12 | Deterministic plan tooling: `check`, `next`, `freeze`, `metrics`. `frozen_sha256` and `metrics:` in stories. Triage log gets a fixed vocabulary. `explainer/` removed. 18 tests |
| 0.6.0 | `d6578b4` | 2026-11-13 | Enforced review, tests-first build, claims, hooks. Evidence rule, `amend` route, security lens, `test` worker, `freeze --tests`, `claim`, exit evidence, vendored `_lean/bin`, guard hook, git pre-commit, full/basic support, `COMPARISON.md`. 23 tests |
| none | `553544a` | 2026-11-13 | Antigravity CLI (AGY) full support. Version stayed 0.6.0. 26 tests |
| 0.7.0 | `3323bb7` | 2026-11-13 | Codex full support: `.codex/agents/*.toml`, guard on `apply_patch`, scout detection. 29 tests |
| 0.8.0 | `0383a2b` | 2026-11-15 | `lean-loop`: unattended story loop whose gates are static checks (status, `check --story`, frozen-test hashes, verification commands, clean commit); `loop.verify` config key; `lean-build` reuses a given claim owner. 31 tests |
| 0.9.0 | `09955da` | 2026-11-24 | Cheap profile for feature-sized work (at most three CAPs, nothing irreversible): one epic and one feature story with no team question, small route on a mid-tier session, tests written with the code (frozen tests only for `security: true` or an irreversible step), one review of the whole feature (earlier stories of a multi-story epic get a security pass only), reviewers told which decisions are settled, short retro for a one-story epic. Skills and docs only: no CLI change. Experimental: run once, for cost and time only ([Experiment Results](Experiment-Results.md)). 31 tests |
| 0.10.0 | `ab03f60` | 2026-11-24 | Frozen contract fields and approval provenance, after an external review and the B run of the experiment. `freeze --via checkpoint\|plan` writes `approved_via` and `contract_sha256` (`caps`, `rules`, `seams`, `checkpoint`, `security`, `frozen_tests`, `approved_via`); `check` adds `story/contract-changed`, `story/contract-unhashed`, `story/approved-via`, `story/baseline-unknown`, `story/security-untested`, and the doubled cap for a feature story; the guard also blocks contract-field edits and a `baseline_commit` rewrite. Frozen lines the orchestrator wrote without a checkpoint carry `[ASSUMPTION]` and are open to review (`decision-conflict:`); triage judges them on the merits. `lean-loop` requires `loop.verify` unless `--allow-no-verify`. Not yet measured in a run. 37 tests |
| 0.10.1 | `5fcbcf0` | 2026-11-24 | Review window and acceptance traceability. `check --story` prints the diff since the last feature review and whether a review is due: at the final story, or earlier once it passes `review.max_diff_lines` (default 1,500 changed lines; `0` reviews every story); stories record `review: feature \| security \| deferred`; `story/review-due` (parked by `lean-loop`), `story/review-vocab`. Acceptance criteria are numbered `AC-n` in the frozen block, tests name them as `<story id> AC-n`, and `story/ac-untested` lists the ones no changed test names (reported only). Not yet measured in a run. 39 tests |

## Maintain this wiki

- The live wiki is the repository's GitHub wiki, a separate git repo (`lean-framework.wiki.git`). `wiki/` in this repo holds the same pages. Nothing syncs them: change a page in both places, or copy the files from `wiki/` into a clone of the wiki repo and push.
- Page file names are the page names (`Review-and-Triage.md`, `_Sidebar.md`, `_Footer.md`).
- Style: no `# H1` (the wiki shows the title); one bold lead line, then `##` sections; ASCII diagrams only; end with `## See also`.
- Links between pages are relative with `.md` in `wiki/` (`[Parallel Teams](Parallel-Teams.md)`), so they work when browsed in the repo. The GitHub wiki needs them without the extension. When copying, strip it: `sed -E 's/\]\(([A-Za-z0-9_][A-Za-z0-9_-]*)\.md(#[^)]*)?\)/](\1\2)/g' Page.md`.
- Every claim must trace to a file in `lean/`. When docs and code disagree, the code wins; fix the doc.
- When you change behaviour in `lean/`, update the README, `skills/lean-help/guide.md` and the affected wiki page in the same commit.

## See also

- [LEAN vs BMAD](LEAN-vs-BMAD.md): why the baseline is kept in history, and how it is measured
- [Supported Tools](Supported-Tools.md): what full and basic support mean per tool
- [Configuration](Configuration.md): the `_lean/` files the installer generates
- [CLI: Installer](CLI-Installer.md): the commands you extend
