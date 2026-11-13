'use strict';
// Role agents: one subagent definition per LEAN worker role, carrying that role's model.
// Written into each tool's native agents folder, so the orchestrator spawns `lean-<role>`
// and the tool itself runs it on the cheaper model.
//   Claude Code: .claude/agents/lean-<role>.md   (model: alias | full id | inherit)
//   OpenCode:    .opencode/agents/lean-<role>.md (mode: subagent, model: provider/model)
//   AGY:         .agents/agents/lean-<role>/agent.md (model: native preset)
//   Codex:       .codex/agents/lean-<role>.toml  (name lean_<role>; "model#effort" → model + model_reasoning_effort)

const ROLE_TEXT = {
  scout: {
    description: 'LEAN scout worker: searches code or documents and returns a short, referenced digest. Read-only.',
    body: 'Answer the one question in your prompt by reading the repository or the files named. Return at most the number of bullets requested, each with a path:line or section reference. Do not edit anything.',
    readOnly: true,
  },
  research: {
    description: 'LEAN research worker: answers one precise question from the web and returns a sourced digest.',
    body: 'Answer the question in your prompt from reliable sources. Return a short digest where every claim has a source URL. Say plainly what you could not verify.',
    readOnly: true,
  },
  implement: {
    description: 'LEAN implementation worker: implements a frozen spec file exactly, with the simplest code that passes its acceptance criteria.',
    body: 'Read the spec file named in your prompt and implement it; the spec is the sole source of truth. Simplest code that passes acceptance, nothing speculative. Report what you changed, how you verified it, and anything incomplete.',
    readOnly: false,
  },
  test: {
    description: 'LEAN test worker: turns a spec\'s acceptance criteria and edge-case matrix into failing tests, before any implementation exists.',
    body: 'Read the spec file named in your prompt. Write tests that encode its Acceptance and Edge-Case Matrix, using the project\'s existing test setup. Write tests only — no production code, no stubs beyond what a test needs to compile. Run them and confirm each fails for the expected reason (missing behavior, not a typo or import error). Report the test files and one line per test.',
    readOnly: false,
  },
  review: {
    description: 'LEAN review worker: reviews a diff with the lens file named in the prompt and returns findings as text. Read-only.',
    body: 'Follow the lens file named in your prompt exactly against the content it names. Return findings as text in your final message. Do not edit anything.',
    readOnly: true,
  },
  check: {
    description: 'LEAN check worker: judges a planning document against the rubric named in the prompt. Read-only.',
    body: 'Apply the rubric named in your prompt to the document it names. Return the verdict and findings in the rubric\'s output format. Do not edit anything.',
    readOnly: true,
  },
};

const COMMON = 'You are a worker for a LEAN orchestrator. Do exactly the task in your prompt. Never invoke skills and never spawn subagents. Return your result as text in your final message.';

function resolveModel(roleTier, tiers) {
  // A role maps to a tier name (top|mid|low) or directly to a model string.
  const value = ['top', 'mid', 'low'].includes(roleTier) ? tiers?.[roleTier] : roleTier;
  return value && value !== 'top' ? value : 'inherit';
}

function claudeAgent(role, model) {
  const r = ROLE_TEXT[role];
  const lines = ['---', `name: lean-${role}`, `description: ${JSON.stringify(r.description)}`, `model: ${model}`];
  if (r.readOnly) lines.push('disallowedTools: Edit, Write, NotebookEdit');
  lines.push('---', '', COMMON, '', r.body, '');
  return lines.join('\n');
}

function opencodeAgent(role, model) {
  const r = ROLE_TEXT[role];
  const lines = ['---', `description: ${JSON.stringify(r.description)}`, 'mode: subagent'];
  if (model !== 'inherit') lines.push(`model: ${model}`); // omitted → the session model
  lines.push('---', '', COMMON, '', r.body, '');
  return lines.join('\n');
}

function agyAgent(role, model) {
  if (!['inherit', 'flash_lite', 'flash', 'pro'].includes(model))
    throw new Error(`Antigravity CLI subagents require a native preset (inherit, flash_lite, flash, pro), not "${model}".`);
  const r = ROLE_TEXT[role];
  return ['---', `name: lean-${role}`, `description: ${JSON.stringify(r.description)}`, 'subagent: true', 'mainAgent: false', `model: ${model}`, '---', '', '# System Prompt', '', COMMON, '', r.body, ''].join('\n');
}

// Codex custom agent (TOML). Codex can't give one agent a read-only sandbox (it inherits the parent's),
// so read-only roles are read-only by instruction. A tier value may carry an effort: "gpt-6-luna#high".
const CODEX_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
function codexAgent(role, model) {
  const r = ROLE_TEXT[role];
  const [id, effort] = String(model).split('#');
  if (effort && !CODEX_EFFORTS.includes(effort)) throw new Error(`Codex reasoning effort must be one of ${CODEX_EFFORTS.join(', ')}, not "${effort}".`);
  const lines = [`name = ${JSON.stringify(`lean_${role}`)}`, `description = ${JSON.stringify(r.description)}`];
  if (id && id !== 'inherit') lines.push(`model = ${JSON.stringify(id)}`); // omitted → the parent's model
  if (effort) lines.push(`model_reasoning_effort = ${JSON.stringify(effort)}`);
  const readOnly = r.readOnly ? ['', 'Read-only role: never edit, create, or delete files, and never run commands that change the repository.'] : [];
  // A JSON string is a valid TOML basic string (same escapes), so no multi-line quoting edge cases.
  lines.push(`developer_instructions = ${JSON.stringify([COMMON, '', r.body, ...readOnly].join('\n'))}`);
  lines.push('', '[skills]', 'include_instructions = false   # workers never invoke skills: skip the skills block, save tokens', '');
  return lines.join('\n');
}

const FORMATS = {
  'claude-code': { dir: '.claude/agents', render: claudeAgent },
  opencode: { dir: '.opencode/agents', render: opencodeAgent },
  'antigravity-cli': { dir: '.agents/agents', render: agyAgent, nested: true },
  codex: { dir: '.codex/agents', render: codexAgent, ext: '.toml' },
};

/** Returns [{ relPath, content, role, model }] for one harness. */
function renderRoleAgents(harness, roles, tiers) {
  const fmt = FORMATS[harness];
  if (!fmt) return [];
  return Object.entries(roles).map(([role, tier]) => {
    const model = resolveModel(tier, tiers);
    return { relPath: `${fmt.dir}/lean-${role}${fmt.nested ? '/agent.md' : fmt.ext || '.md'}`, content: fmt.render(role, model), role, model };
  });
}

module.exports = { renderRoleAgents, resolveModel, FORMATS, ROLES: Object.keys(ROLE_TEXT) };
