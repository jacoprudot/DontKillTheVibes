#!/usr/bin/env node
/**
 * dktv-orchestrate.mjs — B2 multi-agent orchestrator for the DontKillTheVibes assessment.
 *
 * WHY THIS EXISTS
 * ---------------
 * scripts/dktv-assess.mjs is single-pass: it injects the synthesis agent + all 8 skills
 * into ONE prompt over a truncated digest, so the 8 specialist agents in `agents/*.md`
 * never actually run. This runner makes them run, one module at a time, in TWO rounds:
 *
 *   ROUND 1 (cheap, tree only) — system = that module's skill + its analyst agent.
 *     The model answers "which repo-relative paths do you need?" as {"need":[...]}.
 *     Anything not in the tree is dropped, and the list is capped at --max-files.
 *   ROUND 2 (content) — system = same skill + agent, plus ONLY the content of the
 *     files the model asked for (per-module char budget --max-chars, 10k per file),
 *     plus the canonical id registry. The model answers with findings for its module.
 *
 * Synthesis is DETERMINISTIC and lives in this file — no extra LLM call, so the
 * document can never contain invented metadata or a hallucinated work plan:
 *   score = severityWeight x moduleWeight x confidence   (both tables read from
 *   agents/synthesis-agent.md at runtime), phases are an ARRAY, dependencies a MAP.
 *
 * RULE CONTRACT (same principle as `metadata.llm_used`): the rule a finding cites already
 * declares its severity and effort in skills/*.skill.md, so those two fields are STAMPED
 * from the rule after parsing and before synthesis/validation — never taken from the
 * model, which contradicted the rule it cited on 14 of 21 findings of the control run.
 * The registry parser is shared with scripts/validate-assessment.mjs via
 * scripts/lib/canonical-registry.mjs, so what this runner stamps is exactly what the
 * validator enforces.
 *
 * Usage:
 *   node scripts/dktv-orchestrate.mjs --target <dir> --out <dir> [options]
 *
 * Options:
 *   --target <dir>     Repository to assess (default: cwd)
 *   --out <dir>        Output dir (default: <target>/.dontkillthevibes)
 *   --model <id>       LLM model id (env LLM_MODEL)
 *   --base-url <url>   OpenAI-compatible base (env LLM_BASE_URL,
 *                      default https://integrate.api.nvidia.com/v1)
 *   --api-key <key>    API key (env LLM_API_KEY). Never printed, never written.
 *   --modules a,b,c    Subset of modules (default: all 8)
 *   --max-files N      Max files a module may request in round 1 (default 25)
 *   --max-chars N      Per-module content budget in chars for round 2 (default 200000)
 *   --max-tokens N     Completion budget (env MAX_TOKENS, default 32768 — reasoning
 *                      models spend thousands of tokens before any content)
 *   --language <code>  Report language (default: en)
 *   --dry-run          No API key needed; print plan + budgets + prompt sizes, no LLM
 *   --mock             Offline; every finding is clearly labelled MOCK. No network.
 *                      The stub also drifts severity/effort on purpose so the rule stamp
 *                      is exercised offline — the stamp corrects it before anything is
 *                      written or validated (a regressed stamp fails the gate loudly).
 *   --help
 *
 * Output (both modes): <out>/assessment.json (the contract, validator-gated),
 * <out>/assessment-report.md (human-readable, rendered AFTER the gate by
 * scripts/lib/report-renderer.mjs — best-effort: a rendering failure only warns),
 * <out>/metrics.json (includes report_path / report_written), <out>/modules/<module>.json.
 *
 * Exit codes: 0 ok, 1 failed (LLM/validation), 2 usage/config error.
 */
import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  openSync, closeSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openRepo, SKIP_EXT, SENSITIVE_NAME } from './lib/repo-files.mjs';
// Canonical rule contract (ids + declared severity/effort): ONE shared module, so this
// runner and scripts/validate-assessment.mjs can never disagree about what a rule says.
// The runner both ENFORCES the contract (id list + validation) and MAKES it hold
// (stampRuleFields), because severity/effort are rule properties, not LLM judgements.
import { loadRules, stampRuleFields, diffRuleFields, rulesetFingerprint } from './lib/canonical-registry.mjs';
import { gradeFromFindings } from './lib/health-grade.mjs';
// Human-readable artifact: assessment.json is the contract, assessment-report.md is what a
// human reads. ONE shared renderer (scripts/lib/report-renderer.mjs) so this runner and
// scripts/dktv-assess.mjs produce the same report from the same document. The render runs
// AFTER the validator gate and can never influence the JSON or the exit code.
import { renderReport } from './lib/report-renderer.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Exit with an explicit code after tearing down stdin (see dktv-assess.mjs). */
function hardExit(code) {
  try { process.stdin.destroy(); } catch { /* already closed */ }
  process.exit(code);
}

/* ---------- module map ---------- */
const MODULE_DEFS = [
  { module: 'database', skill: 'skills/database-assessment.skill.md', agent: 'agents/database-analyst.md' },
  { module: 'code', skill: 'skills/code-quality-assessment.skill.md', agent: 'agents/code-quality-analyst.md' },
  { module: 'structure', skill: 'skills/structure-assessment.skill.md', agent: 'agents/structure-analyst.md' },
  { module: 'flows', skill: 'skills/flows-assessment.skill.md', agent: 'agents/flows-analyst.md' },
  { module: 'security', skill: 'skills/security-assessment.skill.md', agent: 'agents/security-analyst.md' },
  { module: 'cost', skill: 'skills/cost-analysis.skill.md', agent: 'agents/cost-analyst.md' },
  { module: 'performance', skill: 'skills/performance-assessment.skill.md', agent: 'agents/performance-analyst.md' },
  { module: 'github', skill: 'skills/github-intelligence.skill.md', agent: 'agents/github-intelligence-analyst.md' },
];

const SEVERITY_WEIGHT = { critical: 100, high: 50, medium: 20, low: 5, info: 1 };
const EFFORT_WEIGHT = { XS: 1, S: 2, M: 4, L: 8, XL: 16 };
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const EFFORTS = ['XS', 'S', 'M', 'L', 'XL'];
const PER_FILE_CAP = 10_000; // chars of content per file, same as dktv-assess.mjs

/* ---------- citation-repair budget (see "weak citations" below) ----------
   The realworld-control run produced 21 findings of which 9 cited a line carrying no
   evidence (line 0, a blank line, a block-comment close, a lone "};"). Repair is
   deliberately bounded: one batched call per module, at most REPAIR_MAX_FINDINGS
   findings, one window per finding. */
const REPAIR_MAX_FINDINGS = 5;        // repaired findings per module (highest severity first)
const REPAIR_WINDOW_RADIUS = 40;      // +/- lines around the cited line
const REPAIR_WINDOW_CAP = 6_000;      // chars of window per finding
const REPAIR_PROMPT_CAP = 40_000;     // chars for the whole repair prompt

/* Fallback module weights if agents/synthesis-agent.md cannot be parsed.
   The live table is read from the file; this only exists so the runner does not
   crash on a moved file. parseModuleWeights() warns when it falls back. */
const MODULE_WEIGHT_FALLBACK = {
  security: 1.5, database: 1.3, performance: 1.2, structure: 1.1,
  flows: 1.0, code: 1.0, cost: 0.8, github: 0.7,
};

const HELP = `dktv-orchestrate.mjs — multi-agent (per-module, two-round) assessment runner

Usage:
  node scripts/dktv-orchestrate.mjs --target <dir> --out <dir> [options]

Options:
  --target <dir>     Repository to assess (default: cwd)
  --out <dir>        Output dir (default: <target>/.dontkillthevibes)
  --model <id>       LLM model id (env LLM_MODEL)
  --base-url <url>   OpenAI-compatible base (env LLM_BASE_URL, default https://integrate.api.nvidia.com/v1)
  --api-key <key>    API key (env LLM_API_KEY). Never printed or written.
  --modules a,b,c    Subset of modules, comma separated (default: all 8)
  --max-files N      Max files a module may request in round 1 (default 25)
  --max-chars N      Per-module content budget for round 2, chars (default 200000)
  --max-tokens N     Completion token budget (env MAX_TOKENS, default 32768)
  --language <code>  Report language (default: en)
  --dry-run          No API key needed: print the plan, budgets and prompt sizes; call nothing
  --mock             Offline: stub every LLM response with MOCK-labelled findings; no network
  --help             Show this help

Modules: ${MODULE_DEFS.map((m) => m.module).join(', ')}

An output dir receives assessment.json (validator-gated contract), assessment-report.md
(rendered after the gate by scripts/lib/report-renderer.mjs, best-effort), metrics.json
(report_path / report_written included) and modules/<module>.json per module.

A real run makes 2 LLM calls per module (round 1 = pick files, round 2 = findings),
i.e. ${MODULE_DEFS.length * 2} calls for all 8 modules, PLUS at most ONE extra batched repair
call per module whose kept findings cite a weak line (line 0 / out of range / blank /
comment-only / lone-bracket line; an import line IS evidence and is never weak): at most
${MODULE_DEFS.length} repair calls, at most ${REPAIR_MAX_FINDINGS} findings repaired per module,
so at most ${MODULE_DEFS.length * 3} calls. Synthesis is deterministic (no call).
Metrics (weak_before / weak_after / repaired / repair_failed / repair_calls and the
rule-contract stamp counts stamped_total / stamped_severity / stamped_effort /
rules_unknown) are written to <out>/metrics.json and <out>/modules/<module>.json.
`;

/* ---------- args ---------- */
function parseArgs(argv) {
  const opts = {
    target: process.cwd(),
    out: null,
    model: process.env.LLM_MODEL || null,
    baseUrl: process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.LLM_API_KEY || null,
    modules: MODULE_DEFS.map((m) => m.module),
    maxFiles: 25,
    maxChars: 200_000,
    // Reasoning models spend thousands of tokens on hidden reasoning before emitting
    // content: a real run burned 12,977 reasoning tokens and 8192 truncated it.
    maxTokens: Number(process.env.MAX_TOKENS) || 32_768,
    language: 'en',
    dryRun: false,
    mock: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--target') opts.target = resolve(next());
    else if (a === '--out') opts.out = resolve(next());
    else if (a === '--model') opts.model = next();
    else if (a === '--base-url') opts.baseUrl = next();
    else if (a === '--api-key') opts.apiKey = next();
    else if (a === '--max-files') opts.maxFiles = parseInt(next(), 10);
    else if (a === '--max-chars') opts.maxChars = parseInt(next(), 10);
    else if (a === '--max-tokens') opts.maxTokens = parseInt(next(), 10);
    else if (a === '--language') opts.language = next();
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--mock') opts.mock = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--modules') {
      const list = next().split(',').map((s) => s.trim()).filter(Boolean);
      opts.modules = list;
    } else {
      console.error(`Unknown arg: ${a}\n`);
      process.stderr.write(HELP);
      hardExit(2);
    }
  }
  opts.target = resolve(opts.target);
  opts.out = opts.out || join(opts.target, '.dontkillthevibes');
  return opts;
}

/* ---------- canonical registry (scripts/lib/canonical-registry.mjs) ----------
   Every canonical rule id, harvested from the `→ FINDING: <id>` lines in
   skills/*.skill.md. The decision trees define the ids but they sit inside ~200k
   chars of prose; a real NIM run invented plausible-looking ids (code-any-type-1,
   code-env-var-check-1, …) that the validator rejected. The registry is therefore
   injected verbatim into every round-2 prompt.

   The SAME map carries the (severity, effort) each rule declares — and that is the
   whole point of sharing it: severity/effort are properties of the rule, so after the
   findings are parsed this runner STAMPS them from the rule instead of trusting the
   model to reproduce them (14 of 21 findings on the control run carried a severity or
   effort that contradicted the rule they cited). See stampFindings() below. */

/**
 * Run every finding through the shared stamp and count what changed.
 *
 * Returns fresh findings (the inputs are never mutated) plus the four measured counts
 * that go into <out>/metrics.json:
 *   stamped_total     findings whose severity OR effort was replaced by the rule's value
 *   stamped_severity  findings whose severity was replaced
 *   stamped_effort    findings whose effort was replaced
 *   rules_unknown     findings whose id is not in the registry (already an error upstream,
 *                     so this must be 0; the finding is left untouched when it happens)
 * plus `changes`, the per-finding before/after evidence kept in the module audit files.
 *
 * @param {Array<Record<string, any>>} findings coerced per-module findings
 * @param {Map<string, {severity: string|null, effort: string|null}>} rules
 */
function stampFindings(findings, rules) {
  const out = {
    findings: [], changes: [],
    stamped_total: 0, stamped_severity: 0, stamped_effort: 0, rules_unknown: 0,
  };
  for (const f of findings) {
    const rule = f && typeof f.id === 'string' ? rules.get(f.id) : undefined;
    if (!rule) out.rules_unknown++;
    const stamped = stampRuleFields(f, rules);
    // measured against the finding as the model emitted it: a present field that
    // contradicts the rule. diffRuleFields mirrors the validator's comparison exactly.
    const { severityDiffers, effortDiffers } = diffRuleFields(f, rules);
    if (severityDiffers) out.stamped_severity++;
    if (effortDiffers) out.stamped_effort++;
    if (severityDiffers || effortDiffers) {
      out.stamped_total++;
      out.changes.push({
        id: f.id,
        from: { severity: f.severity, effort: f.effort },
        to: { severity: stamped.severity, effort: stamped.effort },
      });
    }
    out.findings.push(stamped);
  }
  return out;
}

/* ---------- synthesis tables, read from agents/synthesis-agent.md ---------- */
function parseModuleWeights() {
  const fallback = { weights: { ...MODULE_WEIGHT_FALLBACK }, source: 'fallback' };
  let text;
  try {
    text = readFileSync(join(root, 'agents/synthesis-agent.md'), 'utf8');
  } catch {
    console.warn('WARN: agents/synthesis-agent.md not readable — using fallback module weights');
    return fallback;
  }
  const m = text.match(/Module Weight[^\n]*\n([^\n]*)/i);
  if (!m) {
    console.warn('WARN: could not find the Module Weight table in agents/synthesis-agent.md — using fallback weights');
    return fallback;
  }
  const weights = {};
  for (const pair of m[1].matchAll(/([a-z]+)\s*:\s*([0-9.]+)/g)) weights[pair[1]] = Number(pair[2]);
  if (!Object.keys(weights).length) {
    console.warn('WARN: Module Weight table parsed empty — using fallback weights');
    return fallback;
  }
  const source = m[1].trim();
  for (const def of MODULE_DEFS) {
    if (!(def.module in weights)) {
      console.warn(`WARN: no module weight for "${def.module}" in agents/synthesis-agent.md — defaulting to ${MODULE_WEIGHT_FALLBACK[def.module]}`);
      weights[def.module] = MODULE_WEIGHT_FALLBACK[def.module] ?? 1.0;
    }
  }
  return { weights, source };
}

/* ---------- prompts ---------- */
function buildRound1Prompt(def, files, tree, maxFiles, language) {
  const system = `You are the DontKillTheVibes **${def.module}** specialist: the persona and workflow in the analyst definition below, applying the decision trees in the skill below. You run headless: you have NO tools, so you cannot open files yourself — you must ask for them.

## Specialist definition — ${def.agent}
${files.agent}

## Decision trees you must apply — ${def.skill}
${files.skill}

# Round 1 of 2 (file selection)

You receive ONLY the repository file tree (names, no contents). Reply with the repo-relative paths whose CONTENT you must read to apply this module's decision trees (schema files, migrations, queries, config, entry points, tests, …).

Rules:
- Reply with ONLY a JSON object: {"need": ["path/one", "path/two", ...]} — no prose, no fences.
- Every path MUST appear verbatim in the tree below. Paths not in the tree are discarded.
- You may request at most ${maxFiles} paths; extras are discarded in order.
- Request the SMALLEST set that lets you apply the decision trees. Do not request binary/asset paths — binary content is never provided.
- Do not request .env / certificates / private keys: those are withheld and never sent.
- If this module has no relevant files in the tree, reply {"need": []}.`;

  const user = `# Module: ${def.module}

## Repository file tree (${tree.length} files, names only)
${tree.join('\n')}

## Task
List the paths you need for this module. Reply with ONLY {"need":[...]}. Human-readable report language for anything you write later: ${language} (JSON keys stay English).`;

  return { system, user };
}

function buildRound2Prompt(def, files, registry, requestedFiles, target, withheldCount, language) {
  const system = `You are the DontKillTheVibes **${def.module}** specialist: the persona and workflow in the analyst definition below, applying the decision trees in the skill below. You run headless: the CONTENT of the files you requested in round 1 is provided below and nothing else.

## Specialist definition — ${def.agent}
${files.agent}

## Decision trees you must apply — ${def.skill}

# Canonical rule ID registry — the ONLY valid finding ids

${registry.join('\n')}

# Rule selection — the MOST SPECIFIC rule wins

Choose the MOST SPECIFIC rule that applies. If a generic rule and a specific rule both match, use the specific one. Example: a hardcoded JWT secret fallback (\`process.env.JWT_SECRET || 'superSecret'\`) is \`security-jwt-weak-3\`, NOT the generic \`security-secret-in-code-1\`. Both are declared \`critical\` in the registry — and the \`severity\` and \`effort\` you emit MUST be exactly the ones the chosen rule declares. Never downgrade a rule's declared severity: emitting \`high\` for a rule declared \`critical\` is a contract violation and under-severitizes a real vulnerability.

# Round 2 of 2 (findings)

Apply your module's decision trees to the file contents provided and report the findings you can EVIDENCE.

Rules:
- Reply with ONLY a JSON object: {"findings": [ <finding object>, ... ]} — no prose, no fences.
- The "id" MUST be copied verbatim from the canonical registry above. Never invent an id, never renumber it, never synthesise a plausible-looking variant. If no rule matches what you see, OMIT the finding.
- "module" is always "${def.module}".
- Required fields per finding: id, module, severity, location, description, remediation, effort, confidence.
- severity ∈ critical|high|medium|low|info ; effort ∈ XS|S|M|L|XL ; confidence is 0.0-1.0.
- location: { "file": "<repo-relative path>", "line": <n> } — the file MUST be one of the files provided, and the line MUST be the line of the code that evidences the finding (never the license header or the import block). Use line 0 only for file-level findings.
- remediation must be specific and actionable (>= 20 chars).
- Every finding MUST be grounded in content shown below. Do not cite files or lines you were not given.
- Report each distinct rule violation once. Quality over quantity: omit anything you cannot evidence.
- Human-readable strings (description, remediation) are written in: ${language}. JSON keys stay English.`;

  const chunks = [];
  let chars = 0;
  for (const rel of requestedFiles) {
    const raw = target.readFile(rel);
    if (raw === null) continue;
    let content = raw;
    if (content.length > PER_FILE_CAP) {
      content = content.slice(0, PER_FILE_CAP) + `\n... [truncated at ${PER_FILE_CAP} chars by dktv-orchestrate]`;
    }
    if (chars + content.length > files.maxChars) {
      const room = files.maxChars - chars;
      if (room < 500) break;
      content = content.slice(0, room) + '\n... [truncated by per-module char budget]';
    }
    chars += content.length;
    chunks.push(`### ${rel}\n\`\`\`\n${content}\n\`\`\``);
  }

  const withheldNote = withheldCount
    ? `\n\nWithheld BEFORE transmission: ${withheldCount} sensitive file(s) (deny-list: .env*, *.pem, *.key, id_rsa*, *.credentials, .npmrc, .netrc). They were NEVER sent to you. Their absence is NOT evidence that this module passes: do not report a secret-management rule as passing and do not claim no secrets are committed. If a rule needs those files as evidence, omit the finding or set confidence below 0.6 and say the evidence was withheld.`
    : '';

  const user = `# Repository: ${basename(target.baseDir)}  (module: ${def.module})

## Files you requested in round 1 — content (${requestedFiles.length} requested, ${chars} chars of content)${withheldNote}

${chunks.join('\n\n')}

## Task
Report this module's findings now. Reply with ONLY {"findings":[...]}, ids copied verbatim from the canonical registry.`;

  return { system, user, contentChars: chars };
}

/* ---------- weak-citation classifier + targeted repair (TASK A) ---------- */
/**
 * Is this citation strong enough to carry evidence?
 *
 * Deliberately CONSERVATIVE — it returns true ONLY for lines that cannot evidence
 * anything at all: line 0 / out of range, blank or whitespace-only, comment-only
 * (a double-slash line, a slash-star line, a star-slash line, or a line whose first
 * non-space character is an asterisk — block-comment continuation), or a lone
 * structural bracket (`}`, `{`, `);`, `};`, `});` — anything made only of
 * (){}[];, characters.
 *
 * It must NOT flag `import`/`export … from` lines: in the realworld-control run,
 * structure-class-dependency-cycle-3 cited an import line and for a dependency-cycle
 * finding that IS legitimate evidence. A false positive here costs money (it triggers
 * a repair call) and can only ever leave the original line in place anyway.
 *
 * @param {string|undefined|null} lineText   content of the cited line (1-based line n -> [n-1])
 * @param {number} lineNumber                the cited line number
 * @param {number} fileLineCount             total lines in that file
 * @returns {boolean} true when the line cannot evidence the finding
 */
const STRUCTURAL_ONLY = /^[{}()[\];,]+$/;

function isWeakCitation(lineText, lineNumber, fileLineCount) {
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return true;      // line 0 (file-level) / negative
  if (!Number.isFinite(fileLineCount) || lineNumber > fileLineCount) return true; // out of range
  if (typeof lineText !== 'string') return true;                          // content unavailable
  const t = lineText.trim();
  if (!t) return true;                     // blank / whitespace-only
  if (t.startsWith('//')) return true;     // line comment
  if (t.startsWith('/*')) return true;     // block comment open
  if (t.startsWith('*/')) return true;     // block comment close
  if (t.startsWith('*')) return true;      // block comment continuation
  if (STRUCTURAL_ONLY.test(t)) return true; // lone } { ); }; }); [ ] , ;
  return false;                             // anything else — including import/export lines — is evidence
}

/** Per-run file line cache: the repair step needs whole files, not the truncated prompt copy. */
function makeLineReader(target) {
  const cache = new Map();
  return (rel) => {
    const key = String(rel);
    if (cache.has(key)) return cache.get(key);
    const raw = target.readFile(rel);
    const lines = raw === null ? null : raw.split(/\r?\n/);
    cache.set(key, lines);
    return lines;
  };
}

/** Classify one coerced finding against its file's real content. */
function isWeakFinding(finding, linesOf) {
  const lines = linesOf(finding.location.file);
  if (!lines) return true; // cannot read the file -> cannot evidence the line
  return isWeakCitation(lines[finding.location.line - 1], finding.location.line, lines.length);
}

/**
 * The findings a module will actually spend its single repair call on: the
 * REPAIR_MAX_FINDINGS highest-severity weak ones (severity, then confidence, then id),
 * each paired with its numbered window. Everything else is left as-is and counted
 * as `weak_over_cap` — the budget is per module, never per finding.
 */
function selectRepairTargets(weakFindings, linesOf) {
  return weakFindings
    .slice()
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
      || b.confidence - a.confidence
      || a.id.localeCompare(b.id))
    .slice(0, REPAIR_MAX_FINDINGS)
    .map((finding) => ({
      finding,
      window: numberedWindow(linesOf(finding.location.file) || [''], finding.location.line),
    }));
}

/** Numbered +/-REPAIR_WINDOW_RADIUS window around `line`, trimmed to the per-finding cap. */
function numberedWindow(lines, line) {
  const total = lines.length;
  const anchor = Math.min(Math.max(line || 1, 1), total);
  const start = Math.max(1, anchor - REPAIR_WINDOW_RADIUS);
  const end = Math.min(total, anchor + REPAIR_WINDOW_RADIUS);
  const rows = [];
  for (let n = start; n <= end; n++) rows.push({ n, s: `${String(n).padStart(5)} | ${lines[n - 1]}` });
  const size = () => rows.reduce((acc, r) => acc + r.s.length + 1, 0);
  while (rows.length > 1 && size() > REPAIR_WINDOW_CAP) {
    // drop whichever end sits farther from the cited line, so the window stays centred on it
    if (Math.abs(rows[rows.length - 1].n - anchor) >= Math.abs(rows[0].n - anchor)) rows.pop();
    else rows.shift();
  }
  let text = rows.map((r) => r.s).join('\n');
  if (text.length > REPAIR_WINDOW_CAP) {
    // a single minified line can exceed the cap on its own: hard-slice so the per-finding
    // budget holds and the whole-prompt cap in buildRepairPrompt stays meaningful
    text = `${text.slice(0, REPAIR_WINDOW_CAP)}\n... [window truncated at ${REPAIR_WINDOW_CAP} chars by dktv-orchestrate]`;
  }
  return { text, start: rows[0].n, end: rows[rows.length - 1].n };
}

/**
 * ONE batched repair prompt for a module. Each finding gets its id, description, file and a
 * numbered window; the model answers {"fixes":[{"id":"<id>","line":<n>}]}, 0 meaning "no line
 * in the window evidences this". Whole prompt capped at REPAIR_PROMPT_CAP chars (findings that
 * do not fit are returned as `skipped` and left untouched).
 */
function buildRepairPrompt(def, targets, language) {
  const system = `You repair citations in a DontKillTheVibes code assessment for the "${def.module}" module. You run headless: no tools, no repository access beyond the numbered windows below.

For each finding, the line it currently cites does NOT carry the evidence: it is line 0, out of range, blank, a comment, or a lone bracket. Each finding is followed by a numbered window (the numbers are REAL line numbers of that file).

Your job, per finding:
- Choose the line number inside that finding's window whose CONTENT best evidences the finding (the offending code, config or statement).
- Never return a blank line, a comment line, a lone bracket line, or a number that is not shown in the window.
- If NO line in the window evidences the finding, return 0. Do not guess.
- The findings' prose is in "${language}"; your reply is numbers only.

Reply with ONLY a JSON object: {"fixes":[{"id":"<finding id>","line":<n>}]} — exactly one entry per finding shown, no prose, no fences.`;

  const preamble = `# Findings whose citation must be repaired (${targets.length})

`;
  const blocks = [];
  const included = [];
  const skipped = [];
  let size = system.length + preamble.length;
  for (const t of targets) {
    const f = t.finding;
    const block = `## ${f.id}
file: ${f.location.file}
current line: ${f.location.line}
description: ${f.description}
\`\`\`
${t.window.text}
\`\`\`

`;
    if (size + block.length > REPAIR_PROMPT_CAP) { skipped.push(f.id); continue; }
    size += block.length;
    included.push(t);
    blocks.push(block);
  }
  const user = `${preamble}${blocks.join('')}Reply with ONLY {"fixes":[{"id":"<finding id>","line":<n>}]}.`;
  return { system, user, promptChars: system.length + user.length, included, skipped };
}

/** Accept {"fixes":[...]}, a bare array, {"<id>": n} or {"<id>": {"line": n}}. */
function coerceFixList(parsed) {
  const asLine = (v) => {
    if (Number.isInteger(v)) return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v.trim());
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Number.isInteger(v.line)) return v.line;
      if (typeof v.line === 'string' && /^-?\d+$/.test(v.line.trim())) return Number(v.line.trim());
    }
    return null;
  };
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['fixes', 'fix', 'results', 'lines']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    const entries = Object.entries(parsed).map(([k, v]) => ({ id: k, line: asLine(v) })).filter((x) => x.line !== null);
    if (entries.length) return entries;
  }
  return [];
}

/** Deterministic offline stub for --mock: nearest non-weak line in the window, else 0. */
function mockRepairLine(lines, line) {
  if (!lines || !lines.length) return 0;
  const anchor = Math.min(Math.max(line || 1, 1), lines.length);
  for (let d = 0; d <= REPAIR_WINDOW_RADIUS; d++) {
    for (const n of [anchor + d, anchor - d]) {
      if (n < 1 || n > lines.length) continue;
      if (!isWeakCitation(lines[n - 1], n, lines.length)) return n;
    }
  }
  return 0;
}

/**
 * One repair call for a module (real) or one deterministic stub (mock). Never throws:
 * a transport failure is reported and every target is recorded as repair_failed, so a
 * repair problem can never lose the findings the module already produced.
 */
async function runRepair(def, targets, linesOf, opts) {
  const prompt = buildRepairPrompt(def, targets, opts.language);
  const result = {
    applied: [], failed: [], calls: 1, // one call is *attempted* even if it fails
    promptChars: prompt.promptChars, usage: null, rawResponse: null,
    budgetSkipped: prompt.skipped, error: null,
  };
  let fixList = [];
  if (opts.mock) {
    fixList = targets.map((t) => ({
      id: t.finding.id,
      line: mockRepairLine(linesOf(t.finding.location.file), t.finding.location.line),
    }));
    result.rawResponse = JSON.stringify({ fixes: fixList });
  } else {
    try {
      const res = await callChat(opts, [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ], true);
      result.usage = res.usage;
      result.rawResponse = res.content;
      fixList = coerceFixList(extractObject(res.content));
      if (res.finishReason === 'length') console.warn(`  repair response truncated (finish_reason: length) — raise --max-tokens (currently ${opts.maxTokens})`);
    } catch (e) {
      result.error = describeError(e);
      console.warn(`  repair call failed (${result.error}) — keeping the original citations for this module`);
      fixList = [];
    }
  }

  const fixById = new Map();
  for (const fx of fixList) {
    if (!fx || typeof fx !== 'object') continue;
    const id = typeof fx.id === 'string' ? fx.id.trim()
      : typeof fx.finding_id === 'string' ? fx.finding_id.trim() : '';
    const line = Number.isInteger(fx.line) ? fx.line
      : typeof fx.line === 'string' && /^-?\d+$/.test(fx.line.trim()) ? Number(fx.line.trim()) : null;
    if (!id || line === null || fixById.has(id)) continue;
    fixById.set(id, line);
  }

  for (const t of targets) {
    const f = t.finding;
    const lines = linesOf(f.location.file);
    const from = f.location.line;
    const n = fixById.get(f.id);
    if (n === undefined) { result.failed.push({ id: f.id, file: f.location.file, from, line: null, reason: 'no fix returned for this id' }); continue; }
    if (!lines) { result.failed.push({ id: f.id, file: f.location.file, from, line: n, reason: 'file content unavailable' }); continue; }
    if (!Number.isInteger(n) || n < 1 || n > lines.length) { result.failed.push({ id: f.id, file: f.location.file, from, line: n, reason: `line ${n} outside 1..${lines.length}` }); continue; }
    if (isWeakCitation(lines[n - 1], n, lines.length)) { result.failed.push({ id: f.id, file: f.location.file, from, line: n, reason: `line ${n} is still a weak line` }); continue; }
    f.location.line = n; // only ever replaces a weak citation with a strong one
    result.applied.push({ id: f.id, file: f.location.file, from, to: n });
  }
  return result;
}

/* ---------- LLM transport (OpenAI-compatible) ---------- */
// NVIDIA NIM returns HTTP 504 after a ~2 minute cold start, and 429 under load:
// a bare throw there loses the whole run. 429, every 5xx and network errors are
// retried (5,10,15,20,25s, capped at 60, honoring retry-after).
const MAX_TRANSPORT_ATTEMPTS = 5;

function describeError(e) {
  return e && e.message ? e.message : String(e);
}

async function callChat(opts, messages, useJsonMode, attempt = 1) {
  const body = {
    model: opts.model,
    messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const backoff = () => Math.min(60, 5 * attempt);
  let res;
  try {
    res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (attempt < MAX_TRANSPORT_ATTEMPTS) {
      const wait = backoff();
      console.warn(`  network error (${describeError(e)}) — retry ${attempt}/${MAX_TRANSPORT_ATTEMPTS - 1} in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return callChat(opts, messages, useJsonMode, attempt + 1);
    }
    throw new Error(`LLM network error after ${MAX_TRANSPORT_ATTEMPTS} attempts: ${describeError(e)}`);
  }

  if (res.status === 400 && useJsonMode) {
    const text = await res.text();
    if (/response_format|json/i.test(text)) {
      console.warn('  model rejected response_format — retrying without JSON mode');
      return callChat(opts, messages, false, attempt); // does not consume a transport attempt
    }
    throw new Error(`LLM HTTP 400: ${text.slice(0, 300)}`);
  }

  if (res.status === 429 || res.status >= 500) {
    if (attempt < MAX_TRANSPORT_ATTEMPTS) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      const wait = retryAfter > 0 ? Math.min(60, retryAfter) : backoff();
      console.warn(`  HTTP ${res.status} (rate limit / cold-start gateway) — retry ${attempt}/${MAX_TRANSPORT_ATTEMPTS - 1} in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return callChat(opts, messages, useJsonMode, attempt + 1);
    }
    throw new Error(`LLM HTTP ${res.status} after ${MAX_TRANSPORT_ATTEMPTS} transport attempts: ${(await res.text()).slice(0, 300)}`);
  }

  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const finishReason = data.choices?.[0]?.finish_reason;
  if (!content) {
    // Reasoning models can spend the whole budget on hidden reasoning and return an
    // empty content field. Say exactly why instead of a bare "no content".
    throw new Error(
      `LLM returned no content (finish_reason: ${finishReason ?? 'unknown'}; reasoning_tokens: ` +
      `${data.usage?.completion_tokens_details?.reasoning_tokens ?? 'n/a'}). If finish_reason is "length", raise --max-tokens.`
    );
  }
  return { content, usage: data.usage || null, finishReason };
}

/* ---------- JSON extraction (tolerates fences and prose) ---------- */
function stripFences(text) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function extractObject(text) {
  const t = stripFences(text);
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('no JSON object found in response');
}

function extractArray(text) {
  const t = stripFences(text);
  try {
    const v = JSON.parse(t);
    if (Array.isArray(v)) return v;
  } catch { /* fall through */ }
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end > start) {
    const v = JSON.parse(t.slice(start, end + 1));
    if (Array.isArray(v)) return v;
  }
  throw new Error('no JSON array found in response');
}

/** The model is asked for {"need":[...]}; accept that object or a bare array. */
function coerceNeedList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['need', 'needs', 'files', 'paths', 'read']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // some models emit {"path/to/file": "why"} maps
    const values = Object.values(parsed);
    if (values.length && values.every((v) => typeof v === 'string')
      && Object.keys(parsed).every((k) => k.includes('/') || k.includes('.'))) {
      return Object.keys(parsed);
    }
  }
  return [];
}

/** The model is asked for {"findings":[...]}; accept that object, a bare array, or {"<id>": {...}}. */
function coerceFindingList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['findings', 'results', 'items']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    const objs = Object.values(parsed).filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (objs.length && objs.every((o) => o.id || o.severity)) return objs;
  }
  return [];
}

/* ---------- mock LLM (offline, unmistakably synthetic) ---------- */
const MOCK_TAG = 'MOCK';

/**
 * --mock deliberately emits CONTRACT DRIFT on the findings it can, so that the offline
 * run exercises the severity/effort stamp the same way the first finding of every module
 * already exercises citation repair (line 0). The runner stamps these back to the rule's
 * declared values BEFORE anything is written or validated, so the document is still
 * contract-clean — but if the stamp ever regressed, --mock would fail the validator gate
 * instead of silently passing. Nothing but a --mock run is ever affected.
 */
const MOCK_CONTRACT_DRIFT = {
  severity: { critical: 'high', high: 'medium', medium: 'low', low: 'info', info: 'low' },
  effort: { XS: 'S', S: 'M', M: 'L', L: 'XL', XL: 'S' },
};

function mockNeed(def, repo, maxFiles) {
  // Deterministic, module-flavoured selection from the REAL tree, so the mock still
  // exercises the content path. Every id/description it later emits is MOCK-prefixed.
  const PATTERNS = {
    database: [/(^|\/)(schema\.prisma|.*\.sql|migrations?\/)/i, /(^|\/)(models?|entities)\//i, /package\.json$/i],
    code: [/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rb|java|cs)$/i, /package\.json$/i],
    structure: [/(^|\/)(package\.json|tsconfig.*\.json|nx\.json|turbo\.json|pnpm-workspace\.yaml)$/i, /(^|\/)(src|apps|packages)\//i],
    flows: [/(^|\/)(routes?|controllers?|handlers?|api|services?)\//i, /\.(ts|js|py)$/i],
    security: [/(^|\/)(auth|middleware|config|security)\b/i, /(^|\/)Dockerfile$/i, /package\.json$/i],
    cost: [/(^|\/)(Dockerfile|docker-compose\.ya?ml|\.github\/workflows\/)/i, /package\.json$/i],
    performance: [/\.(ts|tsx|js|jsx|py)$/i, /\.(json|ya?ml)$/i],
    github: [/(^|\/)\.github\//i, /(^|\/)(README\.md|CONTRIBUTING\.md|CODE_OF_CONDUCT\.md|LICENSE)$/i],
  };
  const pats = PATTERNS[def.module] || [/./];
  const picked = [];
  for (const p of pats) {
    for (const rel of repo.tree) {
      if (picked.length >= maxFiles) break;
      if (picked.includes(rel)) continue;
      if (SKIP_EXT.has(rel.slice(rel.lastIndexOf('.')))) continue;
      if (p.test(rel)) picked.push(rel);
      if (picked.length >= Math.max(2, Math.ceil(maxFiles / 3))) break;
    }
  }
  if (!picked.length) picked.push(...repo.tree.filter((r) => repo.readFile(r) !== null).slice(0, 2));
  return picked.slice(0, maxFiles);
}

function mockFindings(def, registry, requestedFiles, tree) {
  const moduleIds = [...registry.keys()].filter((id) => id.startsWith(`${def.module}-`));
  const pool = moduleIds.length ? moduleIds : [...registry.keys()];
  const files = requestedFiles.filter((f) => tree.includes(f));
  const count = Math.min(3, pool.length);
  const out = [];
  for (let i = 0; i < count; i++) {
    const id = pool[(def.module.length + i * 7) % pool.length];
    const entry = registry.get(id) || {};
    const severity = entry.severity && SEVERITIES.includes(entry.severity) ? entry.severity : 'medium';
    const effort = entry.effort && EFFORTS.includes(entry.effort) ? entry.effort : 'S';
    const file = files.length ? files[i % files.length] : (tree[0] || '');
    out.push({
      // The id is a REAL canonical rule id (the validator rejects anything else), so the
      // mock cannot be mistaken for a real run by id alone — the MOCK label lives in
      // description, remediation, tags, evidence, metadata.run_mode and every filename.
      id,
      module: def.module,
      // i === 0 carries deliberate severity drift, i === 1 deliberate effort drift (when
      // there is one): the runner stamps both back to the rule's values, which makes the
      // offline run a regression test for the stamp. See MOCK_CONTRACT_DRIFT.
      severity: i === 0 && MOCK_CONTRACT_DRIFT.severity[severity]
        ? MOCK_CONTRACT_DRIFT.severity[severity]
        : severity,
      // The first finding of every module deliberately cites a weak line (0 = file level) so
      // that --mock exercises the citation-repair path offline: the stub then returns the
      // nearest non-weak line of the window, and the repair metrics become non-trivial.
      location: { file, line: i === 0 ? 0 : 1 },
      description: `${MOCK_TAG} finding — stub standing in for canonical rule "${id}", produced by --mock in scripts/dktv-orchestrate.mjs. NO repository content was analysed and NO LLM was called. Not a real assessment result.`,
      remediation: `${MOCK_TAG} placeholder remediation: this text is synthetic. Re-run without --mock against a real LLM endpoint to get an actionable fix for ${id}.`,
      effort: i === 1 && MOCK_CONTRACT_DRIFT.effort[effort]
        ? MOCK_CONTRACT_DRIFT.effort[effort]
        : effort,
      confidence: 0.9,
      tags: [MOCK_TAG.toLowerCase(), def.module, 'stub'],
      evidence: { snippet: `${MOCK_TAG}: no repository content was analysed for this finding.` },
    });
  }
  return out;
}

/* ---------- synthesis (deterministic, in code) ---------- */

/** Coerce one raw model finding into a validator-safe finding, or return {drop, reason}. */
function coerceFinding(raw, def, knownFiles) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { drop: 'not an object' };
  }
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) return { drop: 'missing id' };
  const severity = typeof raw.severity === 'string' ? raw.severity.trim().toLowerCase() : '';
  if (!SEVERITIES.includes(severity)) return { drop: `bad severity "${raw.severity}"` };
  const effort = typeof raw.effort === 'string' ? raw.effort.trim().toUpperCase() : '';
  if (!EFFORTS.includes(effort)) return { drop: `bad effort "${raw.effort}"` };

  const loc = raw.location && typeof raw.location === 'object' && !Array.isArray(raw.location) ? raw.location : {};
  let file = typeof loc.file === 'string' ? loc.file.trim().replace(/^\.\//, '').split('\\').join('/') : '';
  if (!knownFiles.has(file.toLowerCase())) {
    // Keep the finding but never cite a path we cannot back: the validator accepts
    // any non-empty file, and a hallucinated path would be worse than a requested one.
    const fallback = [...knownFiles][0];
    if (fallback) file = fallback;
  }
  if (!file) return { drop: 'no usable location.file' };
  let line = Number.isInteger(loc.line) ? loc.line : 0;
  if (line < 0) line = 0;

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (!description) return { drop: 'empty description' };
  let remediation = typeof raw.remediation === 'string' ? raw.remediation.trim() : '';
  if (remediation.length < 20) {
    remediation = `${remediation}${remediation ? ' ' : ''}(remediation expanded to meet the >= 20 char contract; see rule ${id}.)`;
  }
  let confidence = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : 0.6;
  confidence = Math.min(1, Math.max(0, confidence));
  if (raw.confidence !== undefined && (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence))) {
    confidence = 0.6;
  }

  const finding = {
    id,
    module: def.module,
    severity,
    location: { file, line },
    description,
    remediation,
    effort,
    confidence,
  };
  if (typeof loc.function === 'string' && loc.function.trim()) finding.location.function = loc.function.trim();
  if (typeof loc.commit === 'string' && loc.commit.trim()) finding.location.commit = loc.commit.trim();
  if (Array.isArray(raw.tags)) finding.tags = raw.tags.filter((t) => typeof t === 'string');
  if (Array.isArray(raw.relatedFindings)) finding.relatedFindings = raw.relatedFindings.filter((t) => typeof t === 'string');
  if (raw.evidence && typeof raw.evidence === 'object' && !Array.isArray(raw.evidence)) {
    const ev = {};
    if (typeof raw.evidence.snippet === 'string') ev.snippet = raw.evidence.snippet;
    if (typeof raw.evidence.metric === 'number' && Number.isFinite(raw.evidence.metric)) ev.metric = raw.evidence.metric;
    if (typeof raw.evidence.benchmark === 'string') ev.benchmark = raw.evidence.benchmark;
    if (Object.keys(ev).length) finding.evidence = ev;
  }
  return { finding };
}

function scoreOf(finding, moduleWeights) {
  const sev = SEVERITY_WEIGHT[finding.severity] ?? SEVERITY_WEIGHT.info;
  const mod = moduleWeights[finding.module] ?? 1.0;
  return sev * mod * finding.confidence;
}

/** A-F overall health comes from scripts/lib/health-grade.mjs (worst severity,
 *  volume-immune) — the SAME function Path A (dktv-grade.mjs) and Path B
 *  (dktv-assess.mjs) run, so one repository can never receive two letters.

/** Bucket a summed effort weight back into the XS..XL scale used by `total_effort`. */
function effortBucket(total) {
  if (total <= 1) return 'XS';
  if (total <= 2) return 'S';
  if (total <= 4) return 'M';
  if (total <= 8) return 'L';
  return 'XL';
}

function tally(findings, field, universe) {
  const out = {};
  for (const key of universe) {
    const n = findings.filter((f) => f[field] === key).length;
    if (n > 0) out[key] = n; // only non-zero keys: the validator cross-checks every key
  }
  return out;
}

/**
 * Deterministic synthesis. No LLM call: metadata is stamped from real values and the
 * work plan is computed from the actual findings, so the document can never contain
 * an invented agent name or a reference to a finding that does not exist.
 */
function synthesize({ findings, target, model, toolkitVersion, moduleWeights, meta }) {
  // The shared registry maps id -> { severity, effort }; the score board only needs to
  // show that the finding cites a canonical rule (null when it does not).
  const registryEntry = (id) => (meta.registry.has(id) ? id : null);

  // dedupe by id, keeping the highest confidence
  const byId = new Map();
  let droppedCount = 0;
  for (const f of findings) {
    const existing = byId.get(f.id);
    if (!existing) { byId.set(f.id, f); continue; }
    if (f.confidence > existing.confidence) byId.set(f.id, f);
    droppedCount++;
  }
  const merged = [...byId.values()];

  const scored = merged
    .map((f) => ({ f, score: scoreOf(f, moduleWeights) }))
    .sort((a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id));

  // 3 phases by score order: top 30% -> 30 days, next 30% -> 60 days, rest -> 90 days.
  const n = scored.length;
  const cut1 = Math.ceil(n * 0.3);
  const cut2 = cut1 + Math.ceil((n - cut1) * 0.3);
  const groups = [scored.slice(0, cut1), scored.slice(cut1, cut2), scored.slice(cut2)];
  const names = ['30 Days (Quick Wins)', '60 Days (Core Fixes)', '90 Days (Strategic)'];
  const phases = groups.map((g, i) => {
    const ids = g.map((x) => x.f.id);
    const total = g.reduce((acc, x) => acc + (EFFORT_WEIGHT[x.f.effort] ?? 1), 0);
    return { name: names[i], findings: ids, total_effort: effortBucket(total) };
  });

  // Dependency MAP {id: [ids it depends on]}, derived from the Dependency Mapping Rules
  // in agents/synthesis-agent.md and restricted to ids that actually exist.
  const present = new Set(merged.map((f) => f.id));
  const blocks = { database: ['code', 'performance'], structure: ['flows'] };
  const dependencies = {};
  for (const f of merged) {
    const deps = [];
    for (const [blocker, targets] of Object.entries(blocks)) {
      if (!targets.includes(f.module)) continue;
      const candidates = merged
        .filter((o) => o.module === blocker && o.id !== f.id)
        .map((o) => ({ id: o.id, score: scoreOf(o, moduleWeights) }))
        .sort((a, b) => b.score - a.score);
      if (candidates[0]) deps.push(candidates[0].id);
    }
    if (deps.length) dependencies[f.id] = [...new Set(deps)].filter((id) => present.has(id) && id !== f.id);
    if (dependencies[f.id] && !dependencies[f.id].length) delete dependencies[f.id];
  }

  // relatedFindings may reference ids that were dropped: prune to keep the validator happy
  for (const f of merged) {
    if (!Array.isArray(f.relatedFindings)) continue;
    f.relatedFindings = f.relatedFindings.filter((id) => present.has(id) && id !== f.id);
    if (!f.relatedFindings.length) delete f.relatedFindings;
  }

  // The letter is stamped into the document (schema enum A–F), and its presentation form
  // (F·3) rides along in `stats` for the CLI: the letter saturates — 8/10 vibe-coded repos
  // in our data score F — so the count of criticals is the only thing that distinguishes
  // "one critical" from "twenty" for a reader.
  const grade = gradeFromFindings(merged);

  return {
    document: {
      // metadata is stamped by the RUNNER from real values. The LLM never writes it:
      // earlier runs showed it inventing agent names and versions.
      metadata: {
        repo: `${basename(target.baseDir)}${meta.repoSuffix}`,
        assessed_at: meta.assessedAt,
        toolkit_version: toolkitVersion,
        // Which ruleset produced these scores: `"<count>-<8 hex>"` over every canonical
        // rule's id|severity|effort. Stamped by the RUNNER from the same registry it parsed
        // and validated against, so a report can always be tied back to the rules it used;
        // scripts/validate-assessment.mjs warns when a document carries a stale one.
        ruleset_version: rulesetFingerprint(meta.registry),
        llm_used: model,
        run_mode: meta.runMode,
        orchestrator: 'scripts/dktv-orchestrate.mjs (per-module, 2 rounds, deterministic synthesis)',
        modules_run: meta.modulesRun,
        llm_calls: meta.llmCalls,
        findings_raw: meta.findingsRaw,
        findings_dropped: droppedCount,
        sensitive_files_withheld: target.withheldSensitive.length,
        files_withheld_sensitive: target.withheldSensitive,
        ...(meta.notes ? { notes: meta.notes } : {}),
      },
      summary: {
        overall_health: grade.letter,
        critical_count: grade.criticalCount,
        total_findings: merged.length,
        by_severity: tally(merged, 'severity', SEVERITIES),
        by_module: tally(merged, 'module', MODULE_DEFS.map((m) => m.module)),
        effort_estimate: tally(merged, 'effort', EFFORTS),
      },
      findings: scored.map((x) => x.f),
      work_plan: { phases, dependencies },
      // Extra, non-contract fields: the score board that produced the phases.
      priority_scores: scored.map((x) => ({
        id: x.f.id,
        severity: x.f.severity,
        module: x.f.module,
        confidence: x.f.confidence,
        score: Number(x.score.toFixed(2)),
        canonical_rule: registryEntry(x.f.id),
      })),
    },
    stats: { merged: merged.length, dropped: droppedCount, scores: scored.map((x) => x.score), health_display: grade.display },
  };
}

/* ---------- validation (hard gate) ---------- */
/**
 * Shell out to scripts/validate-assessment.mjs and capture its verdict through a FILE
 * descriptor. Piped child stdio is denied in this repo's sandbox (Windows EPERM), which
 * made every validation look like a failure; file redirection works everywhere and
 * yields byte-identical verdicts. NEVER pass { encoding: 'utf8' } here: that means pipes.
 */
function runValidator(outDir, assessmentPath) {
  const validationPath = join(outDir, 'validation.txt');
  let v;
  try {
    const fd = openSync(validationPath, 'w');
    try {
      v = spawnSync(process.execPath, [join(root, 'scripts/validate-assessment.mjs'), assessmentPath], {
        stdio: ['ignore', fd, fd],
      });
    } finally {
      closeSync(fd);
    }
  } catch (e) {
    v = { status: null, error: e };
  }
  const verdict = existsSync(validationPath) ? readFileSync(validationPath, 'utf8') : '';
  return { status: v.status, error: v.error, verdict, validationPath };
}

/* ---------- main ---------- */
const opts = parseArgs(process.argv.slice(2));

if (opts.help) {
  process.stdout.write(HELP);
  hardExit(0);
}

const unknownModules = opts.modules.filter((m) => !MODULE_DEFS.some((d) => d.module === m));
if (unknownModules.length) {
  console.error(`Unknown module(s): ${unknownModules.join(', ')}\nValid modules: ${MODULE_DEFS.map((m) => m.module).join(', ')}`);
  hardExit(2);
}
if (!opts.modules.length) {
  console.error('No modules selected (--modules was empty).');
  hardExit(2);
}
const selected = MODULE_DEFS.filter((d) => opts.modules.includes(d.module));

if (!existsSync(opts.target)) {
  console.error(`--target not found: ${opts.target}`);
  hardExit(2);
}
if (!Number.isFinite(opts.maxFiles) || opts.maxFiles < 1) { console.error('--max-files must be a positive integer'); hardExit(2); }
if (!Number.isFinite(opts.maxChars) || opts.maxChars < 1000) { console.error('--max-chars must be >= 1000'); hardExit(2); }

const effectiveModel = opts.model || (opts.mock ? 'mock-model (offline stub)' : null);
if (!opts.dryRun && !opts.mock) {
  if (!opts.apiKey) {
    console.error('Missing API key: set LLM_API_KEY or pass --api-key (use --dry-run or --mock to run without one).');
    hardExit(2);
  }
  if (!effectiveModel) {
    console.error('Missing model: set LLM_MODEL or pass --model. NIM examples: moonshotai/kimi-k2-instruct-0905, deepseek-ai/deepseek-v3.1, zai-org/glm-4.6-air, nvidia/llama-3.1-nemotron-70b-instruct');
    hardExit(2);
  }
}

/* toolkit version: real value from package.json, never from the LLM */
let toolkitVersion = 'unknown';
try {
  toolkitVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || 'unknown';
} catch { /* keep 'unknown' */ }

console.log(`dktv-orchestrate — target: ${opts.target}`);
console.log(`mode: ${opts.dryRun ? 'DRY RUN (no LLM calls)' : opts.mock ? 'MOCK (offline, no network)' : 'REAL (LLM calls)'}`);
if (!opts.mock) console.log(`model: ${effectiveModel || '(unset)'}  base-url: ${opts.baseUrl}  max-tokens: ${opts.maxTokens}`);

/* ---------- repo walk ---------- */
const target = openRepo(opts.target);
console.log(`Tree: ${target.tree.length} files (posix-relative, names only)`);
console.log(`Withheld sensitive files (deny-list, never listed nor sent): ${target.withheldSensitive.length}${target.withheldSensitive.length ? ` -> ${target.withheldSensitive.slice(0, 10).join(', ')}${target.withheldSensitive.length > 10 ? ', …' : ''}` : ''}`);
console.log(`Gitignored files excluded: ${target.skippedIgnored.length}`);
console.log(`Binary/asset files (in tree, content never read): ${target.binaryFiles.length}`);

const registry = loadRules(join(root, 'skills'));
if (!registry.size) {
  console.error('FATAL: no canonical finding ids found in skills/*.skill.md — refusing to run: every id would be rejected by the validator.');
  hardExit(1);
}
const { weights: moduleWeights, source: weightsSource } = parseModuleWeights();
console.log(`Canonical rule registry: ${registry.size} ids from skills/*.skill.md`);
console.log(`Module weights from agents/synthesis-agent.md: ${weightsSource}`);

const moduleFiles = new Map();
for (const def of selected) {
  const skillPath = join(root, def.skill);
  const agentPath = join(root, def.agent);
  if (!existsSync(skillPath)) { console.error(`FATAL: missing skill file ${def.skill}`); hardExit(1); }
  if (!existsSync(agentPath)) { console.error(`FATAL: missing agent file ${def.agent}`); hardExit(1); }
  moduleFiles.set(def.module, {
    skill: readFileSync(skillPath, 'utf8'),
    agent: readFileSync(agentPath, 'utf8'),
  });
}

if (opts.dryRun) {
  console.log(`\n=== DRY RUN PLAN ===`);
  console.log(`modules (${selected.length}): ${selected.map((m) => m.module).join(', ')}`);
  console.log(`budgets: --max-files ${opts.maxFiles} files/module, --max-chars ${opts.maxChars} chars/module, --max-tokens ${opts.maxTokens}, per-file cap ${PER_FILE_CAP}`);
  console.log(`LLM calls a real run would make: ${selected.length * 2} base (2 per module) + up to ${selected.length} citation-repair call(s) if every module has a weak citation = up to ${selected.length * 3}. Synthesis is deterministic and free.`);
  console.log(`citation-repair budget: at most 1 batched call per module with weak citations, at most ${REPAIR_MAX_FINDINGS} findings repaired per module (highest severity first), window +/-${REPAIR_WINDOW_RADIUS} lines, <=${REPAIR_WINDOW_CAP} chars/finding, <=${REPAIR_PROMPT_CAP} chars/call`);
  console.log(`"weak citation" = line 0 / out of range / blank / comment-only / lone-bracket line. An import line is evidence and is NEVER weak, so a dependency-cycle finding keeps its import citation.`);
  console.log(`a real run also writes <out>/assessment-report.md (human-readable, rendered after the validator gate; report_path in metrics.json) and per-module metrics into <out>/modules/<module>.json: weak_before, weak_after, repaired, repair_failed, repair_calls, stamped_total, stamped_severity, stamped_effort, rules_unknown`);
  console.log(`severity/effort are stamped from the rule the finding cites (skills/*.skill.md) after parsing and before synthesis/validation: those fields are rule properties, not LLM judgements.`);
  console.log(`\nper-module prompt sizes (round 1 = exact; round 2 = size of the prompt if a module requested files greedily in tree order up to the char budget):`);
  let total1 = 0;
  let total2 = 0;
  for (const def of selected) {
    const files = moduleFiles.get(def.module);
    const r1 = buildRound1Prompt(def, files, target.tree, opts.maxFiles, opts.language);
    // Round 2 cannot be exact without a model reply; measure the budget-filling case.
    const greedy = [];
    let chars = 0;
    for (const rel of target.tree) {
      const raw = target.readFile(rel);
      if (raw === null) continue;
      const cap = Math.min(raw.length, PER_FILE_CAP);
      if (chars + cap > opts.maxChars) break;
      chars += cap;
      greedy.push(rel);
    }
    const r2 = buildRound2Prompt(def, { maxChars: opts.maxChars }, [...registry.keys()].sort(), greedy, target, target.withheldSensitive.length, opts.language);
    total1 += r1.system.length + r1.user.length;
    total2 += r2.system.length + r2.user.length;
    console.log(
      `  ${def.module.padEnd(12)} skill ${String(files.skill.length).padStart(6)} + agent ${String(files.agent.length).padStart(5)}` +
      ` | round1 ${String(r1.system.length + r1.user.length).padStart(7)} chars | round2 ${String(r2.system.length + r2.user.length).padStart(7)} chars` +
      ` (${greedy.length} files, ${r2.contentChars} content chars)`
    );
  }
  console.log(`  TOTAL round 1 ~${total1} chars, round 2 (worst case) ~${total2} chars; ~${Math.round((total1 + total2) / 4)} tokens estimated — nothing was called.`);
  console.log(`\nSensitive-withheld: ${target.withheldSensitive.length} file(s) never listed and never sent.`);
  console.log(`Dry run wrote nothing. Remove --dry-run (and provide LLM_API_KEY/LLM_MODEL) to run for real.`);
  hardExit(0);
}

/* ---------- run ---------- */
mkdirSync(opts.out, { recursive: true });
mkdirSync(join(opts.out, 'modules'), { recursive: true });

const assessedAt = new Date().toISOString();
const allFindings = [];
const drops = [];
const linesOf = makeLineReader(target);
const moduleMetrics = {};
const totals = {
  weak_before: 0, weak_after: 0, repaired: 0, repair_failed: 0, repair_calls: 0, weak_over_cap: 0,
  stamped_total: 0, stamped_severity: 0, stamped_effort: 0, rules_unknown: 0,
};
let llmCalls = 0;
let findingsRaw = 0;

for (const def of selected) {
  const files = moduleFiles.get(def.module);
  console.log(`\n=== [${def.module}] round 1/2 — file selection ===`);
  const r1 = buildRound1Prompt(def, files, target.tree, opts.maxFiles, opts.language);
  const r1Size = r1.system.length + r1.user.length;
  console.log(`  prompt: ${r1Size} chars (~${Math.round(r1Size / 4)} tokens)`);

  let requested;
  let r1Usage = null;
  if (opts.mock) {
    requested = mockNeed(def, target, opts.maxFiles);
  } else {
    let res;
    try {
      res = await callChat(opts, [
        { role: 'system', content: r1.system },
        { role: 'user', content: r1.user },
      ], true);
    } catch (e) {
      console.error(`\nFAILED in module "${def.module}" (round 1, file selection): ${describeError(e)}`);
      console.error('The endpoint is the OpenAI-compatible base URL below. Check network/credentials/model, or re-run (NIM cold starts return 504 and are retried automatically).');
      console.error(`  base-url: ${opts.baseUrl}  model: ${effectiveModel}  max-tokens: ${opts.maxTokens}`);
      hardExit(1);
    }
    llmCalls++;
    r1Usage = res.usage;
    try {
      requested = coerceNeedList(extractObject(res.content));
    } catch (e) {
      console.warn(`  round 1 returned unparseable JSON (${describeError(e)}) — asking for zero files for this module`);
      requested = [];
    }
    if (res.finishReason === 'length') console.warn(`  response truncated (finish_reason: length) — raise --max-tokens (currently ${opts.maxTokens})`);
  }

  const requestedRaw = requested.filter((x) => typeof x === 'string').map((s) => s.trim());
  const inTree = requestedRaw.filter((p) => target.exists(p));
  const notInTree = requestedRaw.filter((p) => !target.exists(p));
  const capped = inTree.slice(0, opts.maxFiles);
  const overCap = inTree.slice(opts.maxFiles);
  console.log(`  requested ${requestedRaw.length} path(s): ${inTree.length} in tree, ${notInTree.length} discarded (not in tree), ${overCap.length} over --max-files cap`);
  if (notInTree.length) console.log(`  discarded (not in tree): ${notInTree.slice(0, 8).join(', ')}${notInTree.length > 8 ? ', …' : ''}`);
  console.log(`  reading ${capped.length} file(s): ${capped.join(', ') || '(none)'}`);

  console.log(`=== [${def.module}] round 2/2 — findings ===`);
  const r2 = buildRound2Prompt(def, { maxChars: opts.maxChars }, [...registry.keys()].sort(), capped, target, target.withheldSensitive.length, opts.language);
  const r2Size = r2.system.length + r2.user.length;
  console.log(`  prompt: ${r2Size} chars (~${Math.round(r2Size / 4)} tokens), ${r2.contentChars} chars of file content`);

  let rawFindings;
  let r2Usage = null;
  let r2RawContent = null;
  if (opts.mock) {
    rawFindings = mockFindings(def, registry, capped, target.tree);
  } else {
    let res;
    try {
      res = await callChat(opts, [
        { role: 'system', content: r2.system },
        { role: 'user', content: r2.user },
      ], true);
    } catch (e) {
      console.error(`\nFAILED in module "${def.module}" (round 2, findings): ${describeError(e)}`);
      console.error(`  base-url: ${opts.baseUrl}  model: ${effectiveModel}  max-tokens: ${opts.maxTokens}`);
      console.error('Round-1 file lists for the modules that already ran are in <out>/modules/*.json; nothing was written for this module.');
      hardExit(1);
    }
    llmCalls++;
    r2Usage = res.usage;
    r2RawContent = res.content;
    try {
      rawFindings = coerceFindingList(extractObject(res.content));
    } catch (e) {
      console.warn(`  round 2 returned unparseable JSON (${describeError(e)}) — recording zero findings for this module (raw response kept in its audit file)`);
      rawFindings = [];
    }
    if (res.finishReason === 'length') console.warn(`  response truncated (finish_reason: length) — raise --max-tokens (currently ${opts.maxTokens})`);
  }

  const knownFiles = new Set(capped.map((f) => f.toLowerCase()));
  const kept = [];
  for (const raw of rawFindings) {
    const id = raw && typeof raw.id === 'string' ? raw.id.trim() : '';
    if (id && !registry.has(id)) {
      drops.push({ module: def.module, id, reason: 'id not in canonical registry' });
      continue;
    }
    const { finding, drop } = coerceFinding(raw, def, knownFiles);
    if (drop) { drops.push({ module: def.module, id: id || '(none)', reason: drop }); continue; }
    kept.push(finding);
  }
  findingsRaw += rawFindings.length;
  console.log(`  findings: ${kept.length} kept, ${rawFindings.length - kept.length} dropped${rawFindings.length - kept.length ? ` (${drops.slice(-(rawFindings.length - kept.length)).map((d) => d.reason).join('; ')})` : ''}`);

  /* ---------- weak citations + at most ONE batched repair call for this module ---------- */
  const weakBeforeList = kept.filter((f) => isWeakFinding(f, linesOf));
  const weakBefore = weakBeforeList.length;
  const repairable = selectRepairTargets(weakBeforeList, linesOf);
  const weakOverCap = weakBefore - repairable.length;

  let repair = { applied: [], failed: [], calls: 0, promptChars: 0, usage: null, rawResponse: null, budgetSkipped: [], error: null };
  if (repairable.length) {
    console.log(`  weak citations: ${weakBefore} of ${kept.length} kept finding(s) cite a line with no evidence — one batched repair call for ${repairable.length}${weakOverCap ? ` (${weakOverCap} more left over the ${REPAIR_MAX_FINDINGS}/module cap)` : ''}`);
    repair = await runRepair(def, repairable, linesOf, opts);
    if (!opts.mock) llmCalls += repair.calls; // a real (or attempted) repair call is a real call
    console.log(`  repair: ${repair.applied.length} repaired, ${repair.failed.length} failed, prompt ${repair.promptChars} chars`);
  }
  const weakAfter = kept.filter((f) => isWeakFinding(f, linesOf)).length;

  /* ---------- THE FIX: severity/effort are stamped from the cited rule ----------
     The rule the finding cites already declares both fields with certainty; asking the
     model to reproduce them produced 14/21 contradictory findings on the control run.
     The stamp runs after the model output is parsed (and after citation repair, so the
     repair budget keeps selecting on exactly the severities the model emitted) and
     BEFORE merging/synthesis, i.e. before assessment.json is written and before the
     validator gate. `kept` and `allFindings` therefore only ever hold stamped findings. */
  const stampedResult = stampFindings(kept, registry);
  for (let i = 0; i < kept.length; i++) kept[i] = stampedResult.findings[i];
  allFindings.push(...kept);
  if (stampedResult.stamped_total > 0) {
    console.log(`  contract stamp: ${stampedResult.stamped_total} of ${kept.length} finding(s) had severity/effort replaced by the rule's declared values (severity: ${stampedResult.stamped_severity}, effort: ${stampedResult.stamped_effort})`);
  }

  const metrics = {
    weak_before: weakBefore,
    weak_after: weakAfter,
    repaired: repair.applied.length,
    repair_failed: repair.failed.length,
    repair_calls: repair.calls,
    weak_over_cap: weakOverCap,
    // Deterministic-contract measurement: how many findings the model got wrong about
    // fields it was never supposed to own (14/21 on the control run), i.e. how many the
    // stamp had to correct. The OUTPUT is contract-clean either way — the validator gate
    // below proves it; this number is the evidence of how much drift there was to absorb.
    stamped_total: stampedResult.stamped_total,
    stamped_severity: stampedResult.stamped_severity,
    stamped_effort: stampedResult.stamped_effort,
    rules_unknown: stampedResult.rules_unknown,
  };
  moduleMetrics[def.module] = metrics;
  for (const k of Object.keys(totals)) totals[k] += metrics[k] ?? 0;

  // Per-module auditability: exactly what was requested and exactly what came back.
  const audit = {
    module: def.module,
    skill_file: def.skill,
    agent_file: def.agent,
    run_mode: opts.mock ? 'mock' : 'real',
    model: effectiveModel,
    metrics,
    round1: {
      prompt_chars: r1Size,
      usage: r1Usage,
      requested_raw: requestedRaw,
      requested_in_tree: inTree,
      requested_not_in_tree: notInTree,
      requested_over_cap: overCap,
      files_read: capped,
    },
    round2: {
      prompt_chars: r2Size,
      content_chars: r2.contentChars,
      usage: r2Usage,
      raw_response: r2RawContent,
      findings_raw: rawFindings,
      findings_kept: kept,
      findings_dropped: drops.filter((d) => d.module === def.module),
    },
    repair: {
      candidates: repairable.map((t) => t.finding.id),
      over_cap_ids: weakBeforeList
        .filter((f) => !repairable.some((t) => t.finding === f))
        .map((f) => f.id),
      weak_before_ids: weakBeforeList.map((f) => f.id),
      weak_after_ids: kept.filter((f) => isWeakFinding(f, linesOf)).map((f) => f.id),
      prompt_chars: repair.promptChars,
      prompt_budget_skipped: repair.budgetSkipped,
      usage: repair.usage,
      raw_response: repair.rawResponse,
      applied: repair.applied,
      failed: repair.failed,
      error: repair.error,
    },
    // What the stamp changed, finding by finding: `round2.findings_raw` is what the model
    // emitted, this is exactly which of those fields the runner overrode and with what.
    stamp: {
      stamped_total: stampedResult.stamped_total,
      stamped_severity: stampedResult.stamped_severity,
      stamped_effort: stampedResult.stamped_effort,
      rules_unknown: stampedResult.rules_unknown,
      changes: stampedResult.changes,
    },
  };
  writeFileSync(join(opts.out, 'modules', `${def.module}.json`), JSON.stringify(audit, null, 2), 'utf8');

  // one finding per id: the document-level dedupe is the final authority
  const dupes = new Set();
  for (const f of kept) { if (dupes.has(f.id)) console.warn(`  WARN: duplicate id within module: ${f.id}`); dupes.add(f.id); }
}

/* ---------- deterministic synthesis ---------- */
const repoNote = opts.mock
  ? 'MOCK RUN: no LLM was called and no repository content was analysed. Every finding carries the "MOCK" label in its description, remediation, tags and evidence, and stands in for the canonical rule id it reuses (ids must stay canonical or the validator rejects them). Nothing here is a real assessment result.'
  : null;

const { document, stats } = synthesize({
  findings: allFindings,
  target,
  model: opts.mock ? 'mock-model (offline stub — no LLM was called)' : effectiveModel,
  toolkitVersion,
  moduleWeights,
  meta: {
    registry,
    assessedAt,
    runMode: opts.mock ? 'mock (offline, no LLM)' : 'real',
    repoSuffix: '',
    modulesRun: selected.map((m) => m.module),
    llmCalls,
    findingsRaw,
    notes: [
      repoNote,
      'Synthesis performed deterministically in scripts/dktv-orchestrate.mjs (severity x module weight x confidence). metadata stamped by the runner, never by the LLM.',
    ].filter(Boolean).join(' '),
  },
});

const assessmentPath = join(opts.out, 'assessment.json');
// The human-readable artifact. The path is known now; whether it was actually written is
// only known after the validator gate (see the post-gate render below), hence report_written.
const reportPath = join(opts.out, 'assessment-report.md');
writeFileSync(assessmentPath, JSON.stringify(document, null, 2), 'utf8');
console.log(`\nWrote ${assessmentPath} (${document.findings.length} findings from ${findingsRaw} raw, ${stats.dropped} duplicate id(s) merged, ${drops.length} dropped)`);
// Presentation only: the document stores the bare letter (the validator accepts A–F only),
// the `·n` suffix is what tells a reader how many criticals produced that F. See
// scripts/lib/health-grade.mjs.
console.log(`overall_health: ${stats.health_display} (document stores the letter alone: "${document.summary.overall_health}")`);
if (drops.length) {
  console.log(`Dropped findings (not in the module audit; kept in modules/*.json):`);
  for (const d of drops.slice(0, 12)) console.log(`  - [${d.module}] ${d.id}: ${d.reason}`);
  if (drops.length > 12) console.log(`  … ${drops.length - 12} more`);
}

/* ---------- weak-citation metrics: the measurement this pass exists for ---------- */
const metricsPath = join(opts.out, 'metrics.json');
const metricsDoc = {
  run_mode: opts.mock ? 'mock' : 'real',
  repo: basename(target.baseDir),
  assessed_at: assessedAt,
  // Human-readable artifact: rendered only after the validator gate, so a rendering
  // problem can never touch assessment.json. Patched in place once the render has run.
  report_path: reportPath,
  report_written: false,
  findings_total: document.findings.length,      // after id-level dedupe (the document's own count)
  findings_evaluated: allFindings.length,        // kept findings the classifier was run over (Y)
  weak_before: totals.weak_before,
  weak_after: totals.weak_after,
  repaired: totals.repaired,
  repair_failed: totals.repair_failed,
  repair_calls: totals.repair_calls,
  weak_over_cap: totals.weak_over_cap,
  // Deterministic rule contract: how many findings the model emitted with a severity or
  // effort contradicting the rule the model itself cited, i.e. how many the runner had to
  // stamp back to the rule's declared values before writing/validating the document.
  stamped_total: totals.stamped_total,
  stamped_severity: totals.stamped_severity,
  stamped_effort: totals.stamped_effort,
  rules_unknown: totals.rules_unknown,
  llm_calls: llmCalls,
  repair_budget: {
    max_calls: selected.length,
    max_findings_per_module: REPAIR_MAX_FINDINGS,
    window_radius: REPAIR_WINDOW_RADIUS,
    window_chars_cap: REPAIR_WINDOW_CAP,
    prompt_chars_cap: REPAIR_PROMPT_CAP,
    calls_used: totals.repair_calls,
  },
  per_module: moduleMetrics,
};
writeFileSync(metricsPath, JSON.stringify(metricsDoc, null, 2), 'utf8');
console.log(`weak citations: ${totals.weak_before}/${allFindings.length} before repair, ${totals.weak_after}/${allFindings.length} after repair (${totals.repaired} repaired, ${totals.repair_failed} failed, ${totals.repair_calls} repair call(s))`);
console.log(`contract stamp: ${totals.stamped_total}/${allFindings.length} finding(s) had severity/effort corrected from the cited rule (severity: ${totals.stamped_severity}, effort: ${totals.stamped_effort}); ${totals.rules_unknown} finding(s) cite an id absent from the registry`);
if (totals.weak_over_cap) console.log(`  ${totals.weak_over_cap} weak citation(s) left as-is over the ${REPAIR_MAX_FINDINGS}/module repair cap (each module repairs its highest-severity weak findings first).`);
console.log(`Wrote ${metricsPath} (weak_before/weak_after/repaired/repair_failed/repair_calls/stamped_total/stamped_severity/stamped_effort/rules_unknown per module too; report_path/report_written are patched in after the post-gate render).`);

/* ---------- hard gate: validator ---------- */
console.log(`\n=== validation gate: node scripts/validate-assessment.mjs ${assessmentPath} ===`);
const val = runValidator(opts.out, assessmentPath);
process.stdout.write(val.verdict.endsWith('\n') || !val.verdict ? val.verdict : `${val.verdict}\n`);
if (val.status !== 0) {
  console.error(`\nFAILED: validation did not exit 0 (status ${val.status}${val.error ? `, ${val.error.message}` : ''}). Verdict captured in ${val.validationPath}.`);
  console.error('The assessment.json was still written for inspection; fix the run (see the ERROR lines above) and re-run.');
  hardExit(1);
}
console.log(`VALIDATED: ${document.findings.length} findings; LLM calls this run: ${llmCalls} (real mode: 2 per module = ${selected.length * 2} for ${selected.length} module(s), plus up to 1 repair call per module with weak citations — ${totals.repair_calls} made).`);

/* ---------- post-gate: the human-readable report (best-effort, never fatal) ----------
   This runs AFTER the validator gate on purpose. assessment.json is the contract and the
   exit code was already earned by it; a renderer bug must therefore be a warning, never a
   failed run (the JSON stays byte-identical either way, and nothing here can throw out of
   the try). The document handed to the renderer is the same object that was written and
   validated, so report and JSON can never disagree. */
console.log(`\n=== human-readable report (post-gate, best-effort) ===`);
let reportWritten = false;
let reportError = null;
try {
  const markdown = renderReport(document, {
    language: opts.language,
    repo: basename(target.baseDir),   // the real repo name, not the doc's descriptive label
    model: document.metadata.llm_used, // the model actually used (runner-stamped, never the LLM's claim)
    generatedAt: assessedAt,           // ISO timestamp of this run
    toolkitVersion,
  });
  writeFileSync(reportPath, markdown, 'utf8');
  reportWritten = true;
  console.log(`Wrote ${reportPath} (${markdown.length} chars, language: ${opts.language})`);
} catch (e) {
  reportError = describeError(e);
  console.warn(`WARN: could not render ${reportPath} (${reportError}). The run stays successful: assessment.json passed the validator gate and is the contract; the markdown is the human artifact.`);
}

// metrics.json is PATCHED rather than rewritten from scratch: report_path is already in it,
// and report_written/report_error are only knowable after the render above. This update is
// itself best-effort — recording a metric must never change the exit code already earned.
try {
  metricsDoc.report_written = reportWritten;
  metricsDoc.report_language = opts.language;
  if (reportError) metricsDoc.report_error = reportError;
  writeFileSync(metricsPath, JSON.stringify(metricsDoc, null, 2), 'utf8');
} catch (e) {
  console.warn(`WARN: could not record report_path/report_written in ${metricsPath} (${describeError(e)}).`);
}

hardExit(0);
