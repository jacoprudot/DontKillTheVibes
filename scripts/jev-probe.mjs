#!/usr/bin/env node
/**
 * jev-probe.mjs — a THREE-QUESTION probe of TypeSafe's "Jev" model.
 *
 * WHY THIS EXISTS (and what it deliberately is NOT)
 * -------------------------------------------------
 * This is NOT a general TypeSafe integration and NOT a replacement for the B2
 * orchestrator. It is a probe with three falsifiable questions, aimed at the two
 * defects this project MEASURED against `benchmark/work/realworld-control`:
 *
 *   DEFECT A — invented rule ids / invented severities.
 *     A real B2 run produced 5 of 5 non-existent rule ids. Another run produced 21
 *     findings of which 14 (67%) carried a severity or effort that CONTRADICTED the rule
 *     the model itself had cited (measured by diffRuleFields in
 *     scripts/lib/canonical-registry.mjs).
 *
 *   DEFECT B — citations that point at nothing.
 *     9 of 21 findings (≈40%, per dktv-orchestrate.mjs REPAIR_* comments) cited a line
 *     with no evidence: line 0, a blank line, an import, a lone `};`.
 *
 *   DEFECT C — an unstable judge.
 *     The blind judge (benchmark/judge.mjs) is a generating model we prompt and parse.
 *     It moved 11 verdicts across prompt variants without a single claim changing.
 *
 * H1 — RULE SELECTION. If the rule id is a Choice over the canonical ids read from the
 *   registry, an out-of-registry id is schema-impossible (an answer can only name an
 *   option key). H1 asks the empirical half of that: does it pick the RIGHT id — the
 *   ground-truth id supplied by --expect-id?
 *
 * H2 — LINE SELECTION. If the cited line is a Choice over the real line numbers of a
 *   window, a line that does not exist is schema-impossible. H2 asks whether the chosen
 *   line is the ground-truth line supplied by --expect-line, and whether its TEXT carries
 *   the evidence.
 *
 * BOTH ARE MODULE-PARAMETRIC. --module picks the ONE skill file whose frontmatter declares
 *   that module — the mapping is DISCOVERED by reading skills/*.skill.md, never assumed
 *   from the filename (the code module lives in `code-quality-assessment.skill.md` and the
 *   github module in `github-intelligence.skill.md`, so a naming convention would be wrong).
 *   That file's declared ids are H1's option list. --file is the file H2 asks about.
 *   Every default is the security value, so all pre-existing invocations keep producing
 *   byte-identical request bodies (H1: 45 options / 1,721 tokens; H2: 394 tokens).
 *
 * H3 — JUDGING. A Noul returns the probability that a statement is true, directly, with
 *   no prompt to vary. H3 asks whether one TRUE and one FALSE-but-plausible statement
 *   about this repo separate cleanly.
 *
 * SCHEMA PROVENANCE (field names below were READ from the docs, never invented)
 * ---------------------------------------------------------------------------
 *   https://docs.typesafe.ai/api                      (request/response reference)
 *   https://docs.typesafe.ai/primitives/choice
 *   https://docs.typesafe.ai/primitives/noul
 *   https://docs.typesafe.ai/primitives/score
 *   https://docs.typesafe.ai/introduction/quickstart
 *
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <API_KEY>   Content-Type: application/json
 *
 *   REQUEST  { state, model, questions }                     (all three required)
 *     state     : string | object | array
 *     model     : string        — "jev-latest" is the flagship alias
 *     questions : map<string, Question>   (the key is NOT sent to the model)
 *       Question  { type, instructions, criteria }  — criteria is required for choice
 *         type         : "choice" | "score" | "noul"
 *         instructions : string | object | array
 *         criteria     :
 *           choice → map<option, string|object|array|null>   (max 255 options)
 *           score  → array<string|object|array>              (2..10 levels)
 *           noul   → optional { true: <desc>, false: <desc> }
 *
 *   RESPONSE { model, answers, usage }
 *     usage     : { input_tokens, output_tokens }
 *     answers.<id> :
 *       choice → { type:"choice", choice, probabilities: map<option,number>, confidence }
 *       score  → { type:"score", score, legend, probabilities, confidence }
 *       noul   → { type:"noul", noul }            (no confidence for a Noul)
 *
 *   Errors: 401 (bad key), 422 (validation), 429 (rate limit), 529 (overloaded).
 *   Documented guidance: retry 429/529 with exponential backoff.
 *
 * UNITS AND PRICES (as stated by the requester, treated as constants here)
 *   $42 per Btok of INPUT; output tokens are free. 100k tokens/s, 80 req/s.
 *   64k-token context per request, of which STATE + longest single question ≤ 32k.
 *
 * CLI
 *   node scripts/jev-probe.mjs --target <dir> --out <dir> [--module security]
 *        [--file src/app/routes/auth/auth.ts] [--expect-id security-jwt-weak-3]
 *        [--expect-line 16] [--model jev-latest] [--dry-run] [--mock] [--help]
 *
 *   --dry-run  Build and print the exact JSON request bodies, the per-request state and
 *              token sizes and the estimated cost. NO network call, NO key, writes
 *              NOTHING (no mkdir, no file, no env read).
 *   --mock     Stub the responses with clearly-labelled MOCK values so the whole
 *              reporting path runs offline. No network, no key. Writes the report to
 *              --out (that is the point: the offline artifact path is exercised too).
 *   (neither)  LIVE: requires TYPESAFE_API_KEY in the environment. The key is never
 *              printed and never written to disk.
 *
 * EXIT CODES  0 ok · 1 API/network failure · 2 usage/config (incl. token-budget refusal)
 *
 * CHILD PROCESSES
 *   This probe spawns exactly one thing (provenance capture: `node --version` and
 *   `git rev-parse --short HEAD`) and captures its output through a REAL FILE
 *   DESCRIPTOR — never through piped stdio, which this sandbox denies with EPERM.
 *   `spawnSync` is called with stdio ['ignore', fd, fd] and no `encoding` option.
 */
import {
  writeFileSync, mkdirSync, existsSync, openSync, closeSync, readFileSync, readdirSync, unlinkSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
// Reused, never re-implemented:
//   openRepo  — repo walking + .gitignore + the sensitive-file deny-list (never .env/keys)
//   loadRules / loadRulesFrom — the ONE canonical rule contract (ids + severity + effort)
import { openRepo } from './lib/repo-files.mjs';
import { loadRules, loadRulesFrom, rulesetFingerprint } from './lib/canonical-registry.mjs';

/* ==========================================================================================
   constants
   ========================================================================================== */

const ENDPOINT = process.env.TYPESAFE_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';
const EXPECTED_MODEL_FAMILY = 'jev-1.13.0'; // the version jev-latest resolves to, per the docs

const USD_PER_BTOK_INPUT = 42;             // $42 per billion input tokens
const CHARS_PER_TOKEN = 4;                 // documented approximation for this probe
const STATE_QUESTION_LIMIT = 32_000;       // state + longest question must fit in 32k
const CONTEXT_LIMIT_TOTAL = 64_000;        // whole-request context
const RETRY_DELAYS_S = [5, 10, 15, 20];    // 5 attempts total => 4 delays

const DEFAULT_MODULE = 'security';

/**
 * The SECURITY defaults. They are defaults, not constants: every pre-existing invocation
 * must keep producing byte-identical request bodies (H1: 45 options / 1,721 tokens;
 * H2: 394 tokens; H3: 331 tokens).
 */
const DEFAULT_FILE = 'src/app/routes/auth/auth.ts';
const DEFAULT_EXPECT_ID = 'security-jwt-weak-3';           // critical / XS in the skill file
const DEFAULT_EXPECT_LINE = 16;

/**
 * Per-module LITERAL evidence locators — OPTIONAL, and deliberately tiny.
 *
 * The H2 ground truth is --expect-line, and that is what the check reports. A module MAY
 * also ship a literal code pattern whose occurrences are accepted as ground truth, because
 * the security snapshot contains the same hardcoded fallback TWICE (lines 16 and 21 of
 * auth.ts) and the documented decision rule accepts either. Only security ships one, so the
 * security path keeps its original semantics (including its hard refusal when the literal is
 * absent, which is what stops a wrong --target from producing a meaningless PASS), while
 * every other module is judged against --expect-line alone.
 */
const MODULE_EVIDENCE_LOCATORS = {
  security: {
    re: /process\.env\.JWT_SECRET\s*\|\|\s*['"]superSecret['"]/,
    hint: "process.env.JWT_SECRET || 'superSecret'",
  },
};

/** H2's window is 1..max(40, expect-line + tail): the security default is 1..40 (file has 28). */
const H2_WINDOW_MIN_LINES = 40;
const H2_WINDOW_TAIL = 4;                                   // so the answer is not the last option
const CHOICE_MAX_OPTIONS = 255;                             // documented Choice maximum

/** Single-pass digest facts (from scripts/dktv-assess.mjs: DIGEST_CONTEXT_CHARS=180000). */
const DIGEST_BUDGET_CHARS = 180_000;
const PER_FILE_CAP = 10_000;

/** Full-benchmark projection: EXPLICIT ASSUMPTIONS, printed with the math. */
const FULL_TARGETS = 5;
const FULL_MODULES = 8;
const ASSUMED_ROUND1_TOKENS = 4_000;   // tree-only "which files do you need?" round
const ASSUMED_ROUND2_TOKENS = 20_000;  // per-module content round

const HELP = `jev-probe.mjs — three-question probe of TypeSafe's "Jev" model (H1 rules, H2 lines, H3 judging)

Usage:
  node scripts/jev-probe.mjs --target <dir> --out <dir> [options]

Options:
  --target <dir>     Repository to probe (default: cwd). The default ground truth lives in the
                     control snapshot at benchmark/work/realworld-control.
  --out <dir>        Where the report + results JSON are written (default: <repo>/temp/jev-probe).
                     Ignored by --dry-run, which writes nothing.
  --module <name>    Module whose canonical rules form H1's option list (default: security).
                     The ONE skill file whose frontmatter declares this module supplies the ids;
                     the mapping is DISCOVERED by reading skills/*.skill.md, never assumed from
                     the filename. Any module a skill file declares is accepted; one that no file
                     declares is refused with the list of modules that exist.
  --file <path>      Repo-relative file H2 asks about (default: src/app/routes/auth/auth.ts).
                     Read through openRepo, so the sensitive-file deny-list still applies.
  --expect-id <id>   Ground-truth canonical rule id for H1 (default: security-jwt-weak-3).
  --expect-line <n>  Ground-truth line number for H2 (default: 16). The window START is 1 and the
                     END is max(40, n+4) clamped to the file length, so it always covers n and n is
                     never the last option. Refused outright when that would need more than 255
                     options — the documented Choice maximum.
  --model <id>       Model alias for the request body (default: jev-latest).
  --dry-run          Print the exact request bodies, token sizes and estimated cost.
                     No network call, no API key needed, writes NOTHING.
  --mock             Stub every response with MOCK values; exercises the full reporting path
                     offline. No network, no key. TWO stubbed answers per hypothesis (one
                     PASS-shaped, one FAIL-shaped) prove each check can return both verdicts.
                     The report is clearly labelled MOCK.
  --help             This text.

Env:
  TYPESAFE_API_KEY   Required for a live run only. Never printed, never written to disk.
  TYPESAFE_ENDPOINT  Verification hook: override the endpoint (default ${ENDPOINT}).
                     Exists so the 429/5xx/network retry path can be exercised offline
                     against a closed port; nothing else changes it.

Exit codes: 0 ok · 1 API/network failure · 2 usage/config (including a token-budget refusal).

Facts this probe asserts from the docs:
  POST ${ENDPOINT}
  body { state, model, questions }   question { type, instructions, criteria }
  answer choice { choice, probabilities, confidence } · noul { noul } · usage { input_tokens, output_tokens }
  $${USD_PER_BTOK_INPUT}/Btok of INPUT, output free · state + longest question <= ${STATE_QUESTION_LIMIT} tokens
`;

/* ==========================================================================================
   small utilities
   ========================================================================================== */

/** Exit with an explicit code after tearing down stdin (same convention as the other runners). */
function hardExit(code) {
  try { process.stdin.destroy(); } catch { /* already closed */ }
  process.exit(code);
}

function fail(msg) {
  console.error(`error: ${msg}`);
  hardExit(2);
}

/** chars/4, rounded UP so the estimate never looks better than it is. */
function tokensOf(text) {
  return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

function costUsd(inputTokens) {
  return (inputTokens / 1e9) * USD_PER_BTOK_INPUT;
}

function fmtUsd(usd) {
  if (usd === 0) return '$0';
  return usd >= 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(8)}`;
}

function fmtInt(n) {
  return Number(n).toLocaleString('en-US');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(s, n) {
  const t = String(s ?? '');
  return t.length <= n ? t : `${t.slice(0, n)}… [${t.length} chars total]`;
}

function relToCwd(p) {
  const rel = resolve(p);
  const cwd = resolve(process.cwd());
  return rel.startsWith(cwd) ? rel.slice(cwd.length + 1) || '.' : rel;
}

/** A refusal is a hard error: nothing is sent when the budget does not fit. */
class BudgetError extends Error {
  constructor(kind, size) {
    super(
      `TOKEN BUDGET REFUSED for "${kind}": state ${fmtInt(size.stateTokens)} + longest question `
      + `${fmtInt(size.longest.tokens)} = ${fmtInt(size.totalTokens)} tokens, over the `
      + `${fmtInt(STATE_QUESTION_LIMIT)}-token limit (state ${fmtInt(size.stateChars)} chars). `
      + 'Nothing was sent. The state must be narrowed (a per-module prompt) or split.',
    );
    this.name = 'BudgetError';
    this.size = size;
  }
}

/* ==========================================================================================
   CLI
   ========================================================================================== */

function parseArgs(argv) {
  const opts = {
    target: null,
    out: null,
    module: DEFAULT_MODULE,
    file: DEFAULT_FILE,
    expectId: DEFAULT_EXPECT_ID,
    expectLine: DEFAULT_EXPECT_LINE,
    model: DEFAULT_MODEL,
    dryRun: false,
    mock: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(`${a} requires a value`);
      i += 1;
      return v;
    };
    if (a === '--target') opts.target = resolve(next());
    else if (a === '--out') opts.out = resolve(next());
    else if (a === '--module') opts.module = next().trim();
    else if (a === '--file') opts.file = next().trim();
    else if (a === '--expect-id') opts.expectId = next().trim();
    else if (a === '--expect-line') {
      const raw = next();
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) fail(`--expect-line must be a positive integer (got "${raw}")`);
      opts.expectLine = n;
    } else if (a === '--model') opts.model = next();
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--mock') opts.mock = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else fail(`unknown option "${a}" (try --help)`);
  }
  if (!opts.help) {
    if (opts.dryRun && opts.mock) fail('--dry-run and --mock are mutually exclusive (dry-run makes no response at all)');
    // --module is NOT validated here: which modules exist is DISCOVERED from the skill files
    // in main(), so there is no hardcoded list to fall out of date.
    if (opts.module === '') fail('--module requires a name');
    if (opts.file === '') fail('--file requires a repo-relative path');
    if (opts.expectId === '') fail('--expect-id requires a canonical rule id');
  }
  return opts;
}

/* ==========================================================================================
   registry: H1's option list comes from the canonical registry, via the shared parser
   ========================================================================================== */

/**
 * Presentation-only hints for the Choice descriptions: for each `→ FINDING: <id>` line, the
 * nearest preceding `N. IF <condition>` and the following `- Evidence: "..."`.
 *
 * The AUTHORITY for which ids exist and what severity/effort they carry stays in
 * scripts/lib/canonical-registry.mjs (loadRulesFrom / loadRules). The id regex below is only
 * a LOCATOR, so a condition/evidence line can be attached to the right option; main() asserts
 * that the locator found exactly the same id set the registry parser reported.
 */
function extractRuleHints(text) {
  const hints = new Map();
  let condition = '';
  let pendingId = null;
  for (const line of String(text).split(/\r?\n/)) {
    const ifM = line.match(/^\s*\d+\.\s+IF\s+(.+?)\s*$/);
    if (ifM) condition = ifM[1];
    const idM = line.match(/→\s*FINDING:\s*([A-Za-z0-9-]+)/);
    if (idM) {
      pendingId = idM[1];
      hints.set(pendingId, { condition, evidence: '' });
      continue;
    }
    const evM = line.match(/^\s*-\s*Evidence:\s*(.+?)\s*$/);
    if (evM && pendingId) {
      const h = hints.get(pendingId);
      if (h && !h.evidence) h.evidence = evM[1];
    }
  }
  return hints;
}

/** The option description: the rule's condition + its own evidence example. Deliberately
 *  WITHOUT severity, so the Choice cannot be won on "critical sounds scary" vibes — the
 *  discriminating information is the condition, and severity is stamped afterwards. */
function optionDescription(hint) {
  if (!hint) return null;
  const parts = [];
  if (hint.condition) parts.push(`IF ${hint.condition.replace(/_/g, ' ')}`);
  if (hint.evidence) parts.push(hint.evidence.replace(/^["']|["']$/g, ''));
  return parts.length ? parts.join(' — ') : null;
}

/**
 * H1's option list = exactly the canonical rule ids declared in ONE skill file, with their
 * authoritative severity/effort looked up in the full registry.
 */
function loadModuleRules(repoRoot, skillRel) {
  const skillAbs = join(repoRoot, skillRel);
  if (!existsSync(skillAbs)) fail(`canonical skill file not found: ${skillAbs}`);
  const text = readFileSync(skillAbs, 'utf8');

  const moduleRules = loadRulesFrom([[skillRel, text]]); // ids declared by THIS file
  const allRules = loadRules(join(repoRoot, 'skills'));  // authoritative severity/effort
  const hints = extractRuleHints(text);

  const options = new Map();
  for (const id of moduleRules.keys()) {
    const rule = allRules.get(id) ?? { severity: null, effort: null, deprecated: false, supersededBy: null };
    options.set(id, { ...rule, description: optionDescription(hints.get(id)) });
  }

  return {
    skillRel,
    options,
    moduleCount: moduleRules.size,
    totalCount: allRules.size,
    fingerprint: rulesetFingerprint(allRules),
    hintCount: hints.size,
    withEvidenceHint: [...options.values()].filter((o) => o.description).length,
  };
}

/**
 * The module → skill-file MAPPING, DISCOVERED from the files themselves.
 *
 * `skills/*.skill.md` carries YAML frontmatter whose `module:` key is the module a skill
 * file declares. The filename is NOT reliable: the code module lives in
 * `code-quality-assessment.skill.md` and the github module in
 * `github-intelligence.skill.md`, so `<module>-assessment.skill.md` would be wrong for two
 * of the eight files. This reads the frontmatter block only (between the first `---` pair),
 * never a `module:` that happens to appear in the body prose.
 *
 * @param {string} skillsDir absolute path to skills/
 * @returns {Map<string, string[]>} module -> sorted repo-relative skill paths declaring it
 */
function discoverModuleSkills(skillsDir) {
  const byModule = new Map();
  let names;
  try {
    names = readdirSync(skillsDir).filter((n) => n.endsWith('.skill.md')).sort();
  } catch {
    return byModule;
  }
  for (const name of names) {
    let text;
    try {
      text = readFileSync(join(skillsDir, name), 'utf8');
    } catch {
      continue; // an unreadable skill file declares nothing; the rest still load
    }
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const declared = fm ? fm[1].match(/^module:\s*([A-Za-z0-9_-]+)\s*$/m) : null;
    if (!declared) continue;
    const rel = `skills/${name}`;
    const list = byModule.get(declared[1]);
    if (list) list.push(rel);
    else byModule.set(declared[1], [rel]);
  }
  return byModule;
}

/* ==========================================================================================
   state + requests
   ========================================================================================== */

function languageOf(rel) {
  if (rel.endsWith('.ts') || rel.endsWith('.tsx')) return 'typescript';
  if (rel.endsWith('.js') || rel.endsWith('.mjs') || rel.endsWith('.cjs')) return 'javascript';
  if (rel.endsWith('.prisma')) return 'prisma';
  if (rel.endsWith('.json')) return 'json';
  return 'text';
}

/** `   16: secret: ...` — line numbers are part of the state for H2 to be answerable at all. */
function numberLines(lines, from = 1) {
  return lines.map((text, i) => `${from + i}: ${text}`).join('\n');
}

function buildStates(repoName, relPath, content, expectLine) {
  // A trailing newline would otherwise add a phantom empty "line N+1" to the window.
  const lines = content.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const rawState = {
    repository: repoName,
    path: relPath,
    language: languageOf(relPath),
    content,
  };

  // The ground truth must be a line that EXISTS: a wrong --file/--expect-line pair would
  // otherwise produce a meaningless PASS/FAIL instead of a config error.
  if (expectLine > lines.length) {
    fail(`--expect-line ${expectLine} is beyond the end of ${relPath} (${fmtInt(lines.length)} lines). `
      + 'The H2 ground truth must be a real line: check --file and --target.');
  }

  // Window 1..end. It ALWAYS covers the ground-truth line, and it stays as tight as that
  // allows: the security default (expect-line 16, 28-line file) still yields 1..28 — the
  // exact window every previous invocation sent.
  const windowStart = 1;
  const windowEnd = Math.min(lines.length, Math.max(H2_WINDOW_MIN_LINES, expectLine + H2_WINDOW_TAIL));

  // The documented Choice maximum is 255 options. One line = one option, so a window beyond
  // it cannot be expressed as a question at all: refuse before building anything.
  const windowOptions = windowEnd - windowStart + 1;
  if (windowOptions > CHOICE_MAX_OPTIONS) {
    fail(`the H2 window ${windowStart}-${windowEnd} would need ${fmtInt(windowOptions)} line options in one `
      + `Choice, over the documented maximum of ${fmtInt(CHOICE_MAX_OPTIONS)} options. --expect-line ${expectLine} `
      + `in ${relPath} (${fmtInt(lines.length)} lines) forces this window. Nothing was sent: probe a smaller `
      + 'file or a windowed excerpt instead.');
  }

  const h2State = {
    repository: repoName,
    path: relPath,
    language: languageOf(relPath),
    line_window: `${windowStart}-${windowEnd} of ${lines.length}`,
    lines: numberLines(lines.slice(windowStart - 1, windowEnd), windowStart),
  };
  return { rawState, h2State, lines, windowStart, windowEnd, windowOptions };
}

/**
 * H1's question text. The module name is interpolated, so `security` yields the original
 * sentence BYTE-FOR-BYTE (that is what keeps H1 at 1,479 question tokens).
 */
function h1Instructions(module) {
  return `Which ONE canonical ${module} rule from the module rule list is violated by the file in the state? `
    + 'Pick the single best-matching rule id as the option key. Judge only against the code shown.';
}

/**
 * H2's question text. `security` keeps the original JWT sentence VERBATIM (537 chars ≈ 135
 * tokens, byte-for-byte); any other module gets a template naming its own ground-truth rule,
 * because a question about a JWT-secret fallback asked of a Prisma pagination file is
 * nonsense and would make the answer meaningless.
 */
function h2Instructions(module, fileRel, expectId) {
  if (module === 'security') {
    return 'Which single numbered line of the state contains the code that EVIDENCES a hardcoded JWT-secret '
      + 'fallback (a literal secret used when the environment variable is missing)? Answer with the option key of that line number.';
  }
  return `Which single numbered line of the state contains the code that EVIDENCES the ${module} rule `
    + `${expectId} in ${fileRel}? Answer with the option key of that line number.`;
}

/**
 * H3's two statements. `security` keeps the original pair VERBATIM (byte-for-byte: H3 stays
 * 331 tokens). Other modules get a generic TRUE / FALSE-but-plausible pair built from their
 * own ground truth, so the Noul is judging the file that is actually in the state.
 */
function buildH3Statements({ module, fileRel, expectId, expectLine }) {
  if (module === 'security') {
    return {
      statement_a: {
        truth: 'TRUE',
        text: `${fileRel} falls back to the hardcoded literal 'superSecret' whenever the JWT_SECRET `
          + 'environment variable is unset.',
      },
      statement_b: {
        truth: 'FALSE (plausible)',
        text: `${fileRel} resolves the JWT signing secret through a centralised secrets helper, and its `
          + 'hardcoded fallback literal is only reachable in local development.',
      },
    };
  }
  return {
    statement_a: {
      truth: 'TRUE',
      text: `${fileRel} genuinely violates the canonical ${module} rule ${expectId}, which the hand-verified `
        + `assessment cites at line ${expectLine} of this file.`,
    },
    statement_b: {
      truth: 'FALSE (plausible)',
      text: `The code at ${fileRel}:${expectLine} only looks like a ${expectId} violation: the value is guarded `
        + 'by a branch elsewhere in the file, so the rule is not actually violated.',
    },
  };
}

function buildRequests({
  model, rawState, h2State, options, windowStart, windowEnd, module, fileRel, expectId, expectLine,
}) {
  const criteria = {};
  for (const [id, rule] of options) criteria[id] = rule.description ?? null;

  const h1 = {
    state: rawState,
    model,
    questions: {
      rule_id: { type: 'choice', instructions: h1Instructions(module), criteria },
    },
  };

  const lineCriteria = {};
  for (let n = windowStart; n <= windowEnd; n += 1) lineCriteria[String(n)] = null; // null = the option name says it all

  const h2 = {
    state: h2State,
    model,
    questions: {
      evidence_line: {
        type: 'choice',
        instructions: h2Instructions(module, fileRel, expectId),
        criteria: lineCriteria,
      },
    },
  };

  const noulCriteria = {
    true: 'The code in the state confirms the statement',
    false: 'The code in the state contradicts the statement, or does not support it',
  };
  const statements = buildH3Statements({ module, fileRel, expectId, expectLine });
  const h3 = {
    state: rawState,
    model,
    questions: {
      statement_a: { type: 'noul', instructions: statements.statement_a.text, criteria: noulCriteria },
      statement_b: { type: 'noul', instructions: statements.statement_b.text, criteria: noulCriteria },
    },
  };

  return [
    { kind: 'H1', key: 'h1-rule-id', title: 'H1 — rule selection (Choice over canonical rule ids)', request: h1 },
    { kind: 'H2', key: 'h2-evidence-line', title: 'H2 — line selection (Choice over real line numbers)', request: h2 },
    { kind: 'H3', key: 'h3-statements', title: 'H3 — judging (Noul × 2)', request: h3 },
  ];
}

/* ==========================================================================================
   token budget — computed BEFORE every request, and the refusal is a hard error
   ========================================================================================== */

function measureRequest(kind, body) {
  const stateJson = JSON.stringify(body.state);
  const stateTokens = tokensOf(stateJson);
  const questions = Object.entries(body.questions).map(([id, q]) => {
    const json = JSON.stringify(q);
    return { id, chars: json.length, tokens: tokensOf(json), options: Object.keys(q.criteria ?? {}).length };
  });
  const longest = questions.reduce((a, b) => (b.tokens > a.tokens ? b : a), { id: '-', chars: 0, tokens: 0, options: 0 });
  const totalTokens = stateTokens + longest.tokens;
  return {
    kind,
    stateChars: stateJson.length,
    stateTokens,
    questions,
    longest,
    totalTokens,
    limit: STATE_QUESTION_LIMIT,
    headroom: STATE_QUESTION_LIMIT - totalTokens,
    fits: totalTokens <= STATE_QUESTION_LIMIT,
    bodyChars: JSON.stringify(body).length,
  };
}

function printSize(size, indent = '  ') {
  console.log(`${indent}state:            ${fmtInt(size.stateChars)} chars  ≈ ${fmtInt(size.stateTokens)} tokens`);
  for (const q of size.questions) {
    const mark = q.id === size.longest.id ? ' (longest)' : '';
    console.log(`${indent}question ${q.id}:${' '.repeat(Math.max(1, 14 - q.id.length))}`
      + `${fmtInt(q.chars)} chars  ≈ ${fmtInt(q.tokens)} tokens, ${q.options} options${mark}`);
  }
  console.log(`${indent}total:            ${fmtInt(size.totalTokens)} / ${fmtInt(size.limit)} tokens  `
    + `(headroom ${fmtInt(size.headroom)})  ${size.fits ? 'OK' : 'REFUSED'}`);
  console.log(`${indent}est. input cost:  ${fmtUsd(costUsd(size.totalTokens))}  ($${USD_PER_BTOK_INPUT}/Btok in, output free)`);
}

/* ==========================================================================================
   the 32k measurement: why the per-module prompt fits and a single-pass digest does not
   ========================================================================================== */

/**
 * Measure the digest a single-pass runner would build: every text file (binary/ignored/
 * sensitive files are null from openRepo.readFile), each truncated to PER_FILE_CAP chars,
 * accumulated until the toolkit's own DIGEST_CONTEXT_CHARS budget is reached.
 */
function measureDigest(repo, budgetChars = DIGEST_BUDGET_CHARS) {
  let chars = 0;
  let files = 0;
  let truncated = 0;
  for (const rel of repo.tree) {
    if (chars >= budgetChars) break;
    const content = repo.readFile(rel); // null for binary/asset/unreadable
    if (content === null) continue;
    let piece = content;
    if (piece.length > PER_FILE_CAP) { piece = piece.slice(0, PER_FILE_CAP); truncated += 1; }
    chars += piece.length;
    files += 1;
  }
  return { chars, files, truncated, tokens: tokensOf('x'.repeat(chars)), budgetChars, overBudget: chars >= budgetChars };
}

/** Total size of the 8 skill files a single-pass prompt also carries. */
function measureSkillsCorpus(repoRoot) {
  let chars = 0;
  let files = 0;
  try {
    for (const name of readdirSync(join(repoRoot, 'skills'))) {
      if (!name.endsWith('.skill.md')) continue;
      chars += readFileSync(join(repoRoot, 'skills', name), 'utf8').length;
      files += 1;
    }
  } catch { /* skills/ missing: report 0 */ }
  return { chars, files, tokens: tokensOf('x'.repeat(chars)) };
}

/**
 * The budget check applied to a single-pass digest, using the SAME guard as the requests,
 * so the refusal path is demonstrated rather than asserted.
 */
function digestBudgetFinding(digestChars, questionTokens) {
  const stateTokens = tokensOf('x'.repeat(digestChars));
  const fake = {
    kind: 'single-pass digest',
    stateChars: digestChars,
    stateTokens,
    questions: [{ id: 'synthesis', chars: questionTokens * CHARS_PER_TOKEN, tokens: questionTokens, options: 0 }],
    longest: { id: 'synthesis', chars: questionTokens * CHARS_PER_TOKEN, tokens: questionTokens, options: 0 },
    totalTokens: stateTokens + questionTokens,
    limit: STATE_QUESTION_LIMIT,
    headroom: STATE_QUESTION_LIMIT - (stateTokens + questionTokens),
  };
  fake.fits = fake.totalTokens <= STATE_QUESTION_LIMIT;
  return fake;
}

/* ==========================================================================================
   transport
   ========================================================================================== */

function parseRetryAfter(header) {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return secs;
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.max(0, Math.round((when - Date.now()) / 1000));
  return null;
}

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const RETRYABLE_STATUS = (s) => s === 429 || s === 529 || (s >= 500 && s <= 599);

/**
 * POST one request. Retries 429/5xx/529/network up to 5 attempts with 5/10/15/20s backoff,
 * honouring `retry-after`. 401/422 are NOT retried: a bad key or a malformed body will not
 * get better. The Authorization header is never logged.
 */
async function postSystemOne(body, apiKey, log) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_S.length; attempt += 1) {
    const isLast = attempt === RETRY_DELAYS_S.length;
    let res = null;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastError = new ApiError(`network error: ${err && err.message ? err.message : String(err)}`, 0);
      if (isLast) throw lastError;
      log(`  retry ${attempt + 1}/${RETRY_DELAYS_S.length + 1} after ${lastError.message} — waiting ${RETRY_DELAYS_S[attempt]}s`);
      await sleep(RETRY_DELAYS_S[attempt] * 1000);
      continue;
    }

    if (res.ok) {
      try {
        return await res.json();
      } catch (err) {
        throw new ApiError(`HTTP ${res.status} but the body was not JSON: ${err.message}`, res.status);
      }
    }

    const text = await res.text().catch(() => '');
    if (!RETRYABLE_STATUS(res.status)) {
      throw new ApiError(`HTTP ${res.status} ${truncate(text, 400)}`, res.status);
    }
    lastError = new ApiError(`HTTP ${res.status} ${truncate(text, 200)}`, res.status);
    if (isLast) throw lastError;
    const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
    const wait = retryAfter !== null ? retryAfter : RETRY_DELAYS_S[attempt];
    log(`  retry ${attempt + 1}/${RETRY_DELAYS_S.length + 1} after HTTP ${res.status} — waiting ${wait}s`
      + `${retryAfter !== null ? ' (retry-after)' : ''}`);
    await sleep(wait * 1000);
  }
  throw lastError ?? new ApiError('unreachable');
}

/* ==========================================================================================
   mock responses — deliberately chosen to exercise BOTH branches of every check
   ========================================================================================== */

/** A believable full probability distribution over the real option keys. */
function mockDistribution(keys, winner, winnerProb) {
  const out = {};
  const others = keys.filter((k) => k !== winner);
  const rest = Number((1 - winnerProb).toFixed(6));
  const each = others.length ? Number((rest / others.length).toFixed(6)) : 0;
  let acc = 0;
  for (const k of others) { out[k] = each; acc = Number((acc + each).toFixed(6)); }
  if (others.length) out[others[others.length - 1]] = Number((out[others[others.length - 1]] + (rest - acc)).toFixed(6));
  out[winner] = winnerProb;
  return out;
}

/**
 * MOCK answers — TWO per hypothesis, deliberately: a PASS-shaped one and a FAIL-shaped one.
 * One branch per hypothesis would leave the other verdict path unproven (a check that can
 * only ever return PASS is vacuously green). `mctx` carries the ground truth so the stubs
 * are built from the SAME options we would really send.
 *
 * @param {object} mctx { expectId, expectLine, acceptedLines }
 */
function mockResponse(entry, size, mctx, branch) {
  const usage = { input_tokens: size.stateTokens + size.longest.tokens, output_tokens: 0 };
  const model = `MOCK-${EXPECTED_MODEL_FAMILY}`;
  if (entry.kind === 'H1') {
    const keys = [...mctx.registry.options.keys()];
    if (branch === 'PASS') {
      // picks the CORRECT id: exercises the MATCH branch and the registry stamp. If the
      // ground-truth id is not in the option list there is no PASS to be had — say so by
      // answering with the first real key, which still exercises the IN-LIST branch.
      const choice = keys.includes(mctx.expectId) ? mctx.expectId : (keys[0] ?? mctx.expectId);
      return {
        mock: true,
        model,
        answers: {
          rule_id: {
            type: 'choice',
            choice,
            probabilities: mockDistribution(keys, choice, 0.9),
            confidence: 0.87,
          },
        },
        usage,
      };
    }
    // picks a DIFFERENT real rule: the FAIL branch, and the one that matters for a file
    // which legitimately violates more than one rule.
    const choice = keys.find((k) => k !== mctx.expectId) ?? '<not-a-canonical-rule>';
    return {
      mock: true,
      model,
      answers: {
        rule_id: {
          type: 'choice',
          choice,
          probabilities: mockDistribution(keys, choice, 0.74),
          confidence: 0.71,
        },
      },
      usage,
    };
  }
  if (entry.kind === 'H2') {
    const keys = Object.keys(entry.request.questions.evidence_line.criteria);
    const choice = branch === 'PASS'
      ? (keys.includes(String(mctx.expectLine)) ? String(mctx.expectLine) : keys[0])
      // a real line number in the window that is NOT accepted ground truth: exercises the
      // FAIL branch, so the citation check is proven capable of failing.
      : (keys.find((k) => !mctx.acceptedLines.includes(Number(k))) ?? keys[0]);
    return {
      mock: true,
      model,
      answers: {
        evidence_line: {
          type: 'choice',
          choice,
          probabilities: mockDistribution(keys, choice, branch === 'PASS' ? 0.82 : 0.6),
          confidence: branch === 'PASS' ? 0.79 : 0.55,
        },
      },
      usage,
    };
  }
  // H3: PASS separates cleanly; FAIL does not separate at all.
  return {
    mock: true,
    model,
    answers: branch === 'PASS'
      ? { statement_a: { type: 'noul', noul: 0.93 }, statement_b: { type: 'noul', noul: 0.12 } }
      : { statement_a: { type: 'noul', noul: 0.31 }, statement_b: { type: 'noul', noul: 0.72 } },
    usage,
  };
}

/* ==========================================================================================
   checks against ground truth — mechanical, falsifiable
   ========================================================================================== */

function checkH1(answer, registry, expectId, modelReported) {
  const chosen = answer && typeof answer.choice === 'string' ? answer.choice : null;
  const inList = chosen !== null && registry.options.has(chosen);
  const rule = inList ? registry.options.get(chosen) : null;
  const probs = (answer && answer.probabilities) || {};
  const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 3);
  // The runner-up is reported on purpose: a file can genuinely violate MORE THAN ONE rule
  // (article.service.ts really violates database-sequential-pagination-1 *and*
  // database-overfetch-relation-1), so a second choice that is itself a real canonical rule
  // is a co-violation signal, not a miss. Hiding it would hide real information.
  const runnerUpEntry = ranked.find(([k]) => k !== chosen) ?? null;
  const runnerUpRule = runnerUpEntry && registry.options.has(runnerUpEntry[0])
    ? registry.options.get(runnerUpEntry[0]) : null;
  return {
    chosen,
    inList,
    expected: expectId,
    matched: chosen === expectId,
    confidence: answer && typeof answer.confidence === 'number' ? answer.confidence : null,
    chosenProbability: chosen !== null && typeof probs[chosen] === 'number' ? probs[chosen] : null,
    topProbabilities: ranked,
    runnerUp: runnerUpEntry
      ? {
        id: runnerUpEntry[0],
        probability: runnerUpEntry[1],
        inList: registry.options.has(runnerUpEntry[0]),
        severity: runnerUpRule ? runnerUpRule.severity : null,
        effort: runnerUpRule ? runnerUpRule.effort : null,
        isExpected: runnerUpEntry[0] === expectId,
      }
      : null,
    probabilitySum: Number(Object.values(probs).reduce((a, b) => a + b, 0).toFixed(4)),
    stampedSeverity: rule ? rule.severity : null,
    stampedEffort: rule ? rule.effort : null,
    expectedSeverity: registry.options.get(expectId)?.severity ?? null,
    expectedEffort: registry.options.get(expectId)?.effort ?? null,
    modelReported: modelReported ?? null,
  };
}

function checkH2(answer, {
  lines, windowStart, windowEnd, expectLine, locator,
}) {
  const chosen = answer && typeof answer.choice === 'string' ? answer.choice : null;
  const n = chosen === null ? NaN : Number.parseInt(chosen, 10);
  const inWindow = Number.isInteger(n) && n >= windowStart && n <= windowEnd;
  const lineText = inWindow ? lines[n - 1] : null;
  // The ground truth is --expect-line. A module MAY additionally accept the lines carrying
  // its own literal evidence (security: the same hardcoded fallback appears on lines 16 AND
  // 21, and the documented decision rule accepts either). For every other module the
  // accepted set IS [--expect-line].
  const evidenceLines = [];
  if (locator) lines.forEach((text, i) => { if (locator.re.test(text)) evidenceLines.push(i + 1); });
  const acceptedLines = [...new Set([expectLine, ...evidenceLines])]
    .filter((x) => x >= windowStart && x <= windowEnd)
    .sort((a, b) => a - b);
  const probs = (answer && answer.probabilities) || {};
  const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    chosen,
    lineNumber: Number.isInteger(n) ? n : null,
    inWindow,
    lineText,
    expectedLine: expectLine,
    evidenceLines,
    acceptedLines,
    matchesExpectedLine: Number.isInteger(n) && n === expectLine,
    accepted: inWindow && acceptedLines.includes(n),
    chosenProbability: chosen !== null && typeof probs[chosen] === 'number' ? probs[chosen] : null,
    confidence: answer && typeof answer.confidence === 'number' ? answer.confidence : null,
    topProbabilities: ranked,
  };
}

function checkH3(answers) {
  const a = answers.statement_a && typeof answers.statement_a.noul === 'number' ? answers.statement_a.noul : null;
  const b = answers.statement_b && typeof answers.statement_b.noul === 'number' ? answers.statement_b.noul : null;
  const separation = a !== null && b !== null ? Number((a - b).toFixed(4)) : null;
  return {
    trueValue: a,
    falseValue: b,
    separation,
    // Thresholds are ours and are stated: a statement is "called true" when > 0.5.
    trueCalledTrue: a !== null && a > 0.5,
    falseCalledFalse: b !== null && b < 0.5,
    clean: a !== null && b !== null && a >= 0.8 && b <= 0.2,
  };
}

/* ==========================================================================================
   provenance capture — through a FILE DESCRIPTOR, never piped stdio
   ========================================================================================== */

/**
 * Run `cmd args` and return its trimmed stdout+stderr, or null.
 *
 * stdio is ['ignore', fd, fd] with the fd opened on a real file: piped stdio is DENIED in
 * this sandbox (EPERM on named pipes), and `encoding` is only ever read from pipes, so it is
 * deliberately not set here. The temp file lives inside the out dir (which we are already
 * writing to) and is removed immediately.
 */
function captureCommand(cmd, args, cwd, outDir) {
  const tmp = join(outDir, `.jev-probe-capture-${process.pid}.tmp`);
  let fd = null;
  try {
    fd = openSync(tmp, 'w');
    const res = spawnSync(cmd, args, { cwd, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 20_000 });
    closeSync(fd);
    fd = null;
    const text = readFileSync(tmp, 'utf8').trim();
    unlinkSync(tmp);
    if (res.error) return null;
    return text || null;
  } catch {
    try { if (fd !== null) closeSync(fd); } catch { /* ignore */ }
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
    return null;
  }
}

/* ==========================================================================================
   report
   ========================================================================================== */

function renderReport(ctx) {
  const L = [];
  const push = (...lines) => L.push(...lines);
  const banner = ctx.mode === 'MOCK'
    ? '=== MOCK RUN — NO NETWORK, NO API KEY, EVERY VALUE BELOW IS A STUB ==='
    : ctx.mode === 'DRY RUN' ? '=== DRY RUN — request bodies only, nothing was sent ===' : '=== LIVE RUN ===';

  push(banner, '');
  push('jev-probe — TypeSafe "Jev" probe (H1 rule selection, H2 line selection, H3 judging)');
  push(`mode:       ${ctx.mode}`);
  push(`target:     ${ctx.target}${ctx.provenance.commit ? ` (git ${ctx.provenance.commit})` : ''}`);
  push(`file:       ${ctx.file}   (H2 ground truth: line ${ctx.expectLine}, window ${ctx.windowStart}-${ctx.windowEnd} of ${ctx.fileLines})`);
  push(`module:     ${ctx.module}   (H1 options = the canonical ids declared in ${ctx.registry.skillRel})`);
  push(`expected:   H1 --expect-id ${ctx.expectId}   H2 --expect-line ${ctx.expectLine}`);
  push(`endpoint:   ${ENDPOINT}`);
  push(`model:      ${ctx.model}  (alias; docs say jev-latest = ${EXPECTED_MODEL_FAMILY})`);
  push(`api key:    ${ctx.keyPresent ? 'present (never printed, never written)' : 'absent — not needed in this mode'}`);
  push(`node:       ${ctx.provenance.node ?? 'unknown'}`);
  push(`generated:  ${ctx.generatedAt}`);
  push('');
  push('REGISTRY (scripts/lib/canonical-registry.mjs — the same parser the validator uses)');
  push(`  canonical rules in skills/*.skill.md : ${fmtInt(ctx.registry.totalCount)}  (fingerprint ${ctx.registry.fingerprint})`);
  push(`  rules declared by ${ctx.module} skill : ${fmtInt(ctx.registry.moduleCount)}`);
  push(`  expected id present                  : ${ctx.registry.options.has(ctx.expectId) ? 'YES' : 'NO'}`
    + `  ${ctx.expectId} = ${ctx.registry.options.get(ctx.expectId)?.severity}/${ctx.registry.options.get(ctx.expectId)?.effort}`);
  push(`  options with a condition/evidence description: ${ctx.registry.withEvidenceHint}/${ctx.registry.moduleCount}`);
  push('');

  for (const r of ctx.results) {
    push('─'.repeat(100));
    push(r.title);
    if (r.branch) push(`STUB BRANCH: ${r.branch} — this answer is a MOCK, not a model output`);
    push(`hypothesis: ${r.hypothesis}`);
    push(`baseline defect being tested: ${r.baseline}`);
    push(`question id: ${r.questionId}   type: ${r.type}`);
    push('');
    push(`request budget (measured BEFORE sending): state ${fmtInt(r.size.stateTokens)} + longest question `
      + `${fmtInt(r.size.longest.tokens)} = ${fmtInt(r.size.totalTokens)} / ${fmtInt(STATE_QUESTION_LIMIT)} tokens — `
      + `${r.size.fits ? 'fits' : 'OVER'}`);
    push('');
    push('RAW ANSWER');
    push(JSON.stringify(r.rawAnswer, null, 2));
    push('');
    push('INTERPRETATION');
    for (const line of r.interpretation) push(`  ${line}`);
    push('');
    push(`VERDICT: ${r.verdict}`);
    push('');
  }

  push('─'.repeat(100));
  push('BUDGET FINDINGS — the 32k constraint that forces the per-module architecture');
  for (const line of ctx.budgetLines) push(`  ${line}`);
  push('');
  push('COST');
  for (const line of ctx.costLines) push(`  ${line}`);
  push('');
  push('WHAT THIS PROBE DOES NOT PROVE');
  for (const line of ctx.caveats) push(`  - ${line}`);
  push('');
  if (ctx.mode === 'DRY RUN') {
    push('NOTHING WAS WRITTEN: no directory was created, no file was written, no API key was read.');
  } else {
    push(`artifacts: ${ctx.outFiles.join('  ·  ')}`);
  }
  return L.join('\n');
}

/* ==========================================================================================
   main
   ========================================================================================== */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    hardExit(0);
  }

  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const target = opts.target ?? process.cwd();
  if (!existsSync(target)) fail(`--target does not exist: ${target}`);
  const outDir = opts.out ?? join(repoRoot, 'temp', 'jev-probe');

  /* ---- module → skill file: DISCOVERED from the skill files' frontmatter ---- */
  const moduleSkills = discoverModuleSkills(join(repoRoot, 'skills'));
  const knownModules = [...moduleSkills.keys()].sort();
  if (!moduleSkills.has(opts.module)) {
    fail(`--module "${opts.module}" is not declared by any skills/*.skill.md. Declared modules: `
      + `${knownModules.join(', ')}. H1 builds its option list from the ONE skill file whose frontmatter `
      + 'carries `module: <name>`; add or fix that file if the module is missing.');
  }
  const skillRels = moduleSkills.get(opts.module);
  if (skillRels.length > 1) {
    fail(`module "${opts.module}" is declared by ${skillRels.length} skill files (${skillRels.join(', ')}); `
      + 'the H1 option list would be ambiguous. Exactly one file may declare a module.');
  }
  const skillRel = skillRels[0];

  const registry = loadModuleRules(repoRoot, skillRel);
  if (registry.hintCount !== registry.moduleCount) {
    console.warn(`warning: the hint locator found ${registry.hintCount} rule lines but the registry parser `
      + `reports ${registry.moduleCount} ids — descriptions may be missing for some options.`);
  }

  // openRepo enforces the sensitive-file deny-list: .env / keys are never reachable here.
  const repo = openRepo(target);
  const content = repo.readFile(opts.file);
  if (content === null) {
    fail(`${opts.file} is not readable in ${target} (missing, binary, or withheld as sensitive). `
      + 'Pass --file <repo-relative path>; the default ground truth lives in '
      + 'benchmark/work/realworld-control (see docs/development/JEV_EXPERIMENT.md).');
  }
  const {
    rawState, h2State, lines, windowStart, windowEnd,
  } = buildStates(basename(resolve(target)), opts.file, content, opts.expectLine);

  const locator = MODULE_EVIDENCE_LOCATORS[opts.module] ?? null;
  const evidenceLines = [];
  if (locator) lines.forEach((text, i) => { if (locator.re.test(text)) evidenceLines.push(i + 1); });
  if (locator && evidenceLines.length === 0) {
    fail(`ground truth not found: no line of ${opts.file} matches ${locator.hint}. `
      + 'Point --target/--file at the snapshot that contains it (default: benchmark/work/realworld-control).');
  }
  const acceptedLines = [...new Set([opts.expectLine, ...evidenceLines])]
    .filter((x) => x >= windowStart && x <= windowEnd)
    .sort((a, b) => a - b);

  const entries = buildRequests({
    model: opts.model,
    rawState,
    h2State,
    options: registry.options,
    windowStart,
    windowEnd,
    module: opts.module,
    fileRel: opts.file,
    expectId: opts.expectId,
    expectLine: opts.expectLine,
  });
  const withSizes = entries.map((e) => ({ ...e, size: measureRequest(e.kind, e.request) }));

  console.log(`registry: ${fmtInt(registry.totalCount)} canonical rules (${registry.fingerprint}); `
    + `${registry.moduleCount} ${opts.module} rules; ${opts.expectId} `
    + `${registry.options.has(opts.expectId) ? 'present' : 'MISSING'} `
    + `(${registry.options.get(opts.expectId)?.severity}/${registry.options.get(opts.expectId)?.effort})`);
  console.log(`module mapping: "${opts.module}" → ${skillRel} (frontmatter; ${knownModules.length} modules declared: ${knownModules.join(', ')})`);
  console.log(`target:   ${relToCwd(target)}   file: ${opts.file} (${fmtInt(content.length)} chars, ${lines.length} lines)`);
  console.log(`ground truth H1: --expect-id ${opts.expectId}   H2: --expect-line ${opts.expectLine}, `
    + `window ${windowStart}-${windowEnd} (${fmtInt(windowEnd - windowStart + 1)} options, max ${CHOICE_MAX_OPTIONS})`);
  console.log(`ground truth H2 accepted line(s): ${acceptedLines.join(', ')}`
    + `${locator ? ` (--expect-line plus the ${locator.hint} literal on line(s) ${evidenceLines.join(', ') || 'none'})` : ' (--expect-line only: this module ships no literal locator)'}`);
  console.log('');

  /* ---- budget gate: refuse BEFORE any network call, in every mode ---- */
  for (const e of withSizes) {
    console.log(`${e.kind} request budget`);
    printSize(e.size);
    if (!e.size.fits) throw new BudgetError(e.kind, e.size);
    console.log('');
  }

  /* ---- the single-pass measurement (documented finding) ---- */
  const digest = measureDigest(repo);
  const skills = measureSkillsCorpus(repoRoot);
  const configuredDigest = digestBudgetFinding(DIGEST_BUDGET_CHARS, withSizes[2].size.longest.tokens);
  const measuredDigest = digestBudgetFinding(digest.chars, withSizes[2].size.longest.tokens);
  const fullSinglePass = digestBudgetFinding(digest.chars + skills.chars, withSizes[2].size.longest.tokens);
  const perModuleState = withSizes.map((e) => e.size.stateTokens);
  const largestModuleState = Math.max(...perModuleState);

  const budgetLines = [
    `per-module state (this probe, worst of 3): ${fmtInt(largestModuleState)} tokens `
      + `(${withSizes.map((e) => `${e.kind} ${fmtInt(e.size.stateTokens)}`).join(', ')}) — fits with `
      + `${fmtInt(STATE_QUESTION_LIMIT - largestModuleState)} tokens of headroom`,
    `single-pass digest at the toolkit's configured budget (scripts/dktv-assess.mjs DIGEST_CONTEXT_CHARS=${fmtInt(DIGEST_BUDGET_CHARS)} chars): `
      + `${fmtInt(configuredDigest.stateTokens)} tokens + question ${fmtInt(configuredDigest.longest.tokens)} = `
      + `${fmtInt(configuredDigest.totalTokens)} tokens → ${configuredDigest.fits ? 'FITS' : 'DOES NOT FIT (over 32k)'}`,
    `refusal the guard would raise: ${configuredDigest.fits ? '—' : new BudgetError('single-pass digest', configuredDigest).message}`,
    `measured digest of THIS target (${fmtInt(PER_FILE_CAP)} chars/file cap): ${fmtInt(digest.chars)} chars ≈ `
      + `${fmtInt(digest.tokens)} tokens over ${fmtInt(digest.files)} files (${fmtInt(digest.truncated)} truncated) `
      + `→ ${measuredDigest.fits ? 'fits on its own' : 'does not fit'}`,
    `measured skills corpus (all ${fmtInt(skills.files)} *.skill.md): ${fmtInt(skills.chars)} chars ≈ ${fmtInt(skills.tokens)} tokens`,
    `single-pass prompt = digest + skills = ${fmtInt(digest.chars + skills.chars)} chars ≈ ${fmtInt(fullSinglePass.stateTokens)} tokens `
      + `→ ${fullSinglePass.fits ? 'fits under 32k' : 'OVER the 32k state limit'}; `
      + `vs the ${fmtInt(CONTEXT_LIMIT_TOTAL)}-token whole-request context: `
      + `${fullSinglePass.totalTokens > CONTEXT_LIMIT_TOTAL ? 'OVER' : 'under'}`,
    'conclusion: the per-module prompt fits with room to spare; the configured single-pass digest does not fit '
      + 'at all, and no single-pass prompt can carry both the digest and the 8 skill files inside 32k. '
      + 'The per-module architecture is therefore forced by the API limit, not a stylistic choice.',
  ];

  /* ---- DRY RUN: print bodies, write nothing, read no key ---- */
  if (opts.dryRun) {
    console.log('BUDGET FINDINGS');
    for (const l of budgetLines) console.log(`  ${l}`);
    console.log('');
    for (const e of withSizes) {
      console.log('─'.repeat(100));
      console.log(`${e.title}`);
      console.log(`exact request body (${fmtInt(e.size.bodyChars)} chars, ${fmtInt(e.size.totalTokens)} tokens):`);
      console.log(JSON.stringify(e.request, null, 2));
      console.log('');
    }
    const totalTokens = withSizes.reduce((a, e) => a + e.size.totalTokens, 0);
    console.log('─'.repeat(100));
    console.log(`estimated run cost: ${withSizes.length} requests, ${fmtInt(totalTokens)} input tokens → `
      + `${fmtUsd(costUsd(totalTokens))}  ($${USD_PER_BTOK_INPUT}/Btok in; output free)`);
    console.log(`projected full benchmark (${FULL_TARGETS} targets × ${FULL_MODULES} modules, ASSUMED `
      + `${fmtInt(ASSUMED_ROUND1_TOKENS)}+${fmtInt(ASSUMED_ROUND2_TOKENS)} tokens/module): `
      + `${fmtInt(FULL_TARGETS * FULL_MODULES * (ASSUMED_ROUND1_TOKENS + ASSUMED_ROUND2_TOKENS))} tokens → `
      + `${fmtUsd(costUsd(FULL_TARGETS * FULL_MODULES * (ASSUMED_ROUND1_TOKENS + ASSUMED_ROUND2_TOKENS)))}`);
    console.log('');
    console.log('NOTHING WAS WRITTEN: no directory was created, no file was written, no API key was read.');
    hardExit(0);
  }

  /* ---- MOCK / LIVE: check the key first, then give the transport a real place to write ---- */
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!opts.mock && !apiKey) {
    fail('TYPESAFE_API_KEY is not set. Use --dry-run to inspect the exact requests offline, '
      + 'or --mock to exercise the reporting path without a key.');
  }

  mkdirSync(outDir, { recursive: true });
  const provenance = {
    node: captureCommand(process.execPath, ['--version'], repoRoot, outDir),
    commit: captureCommand('git', ['rev-parse', '--short', 'HEAD'], target, outDir),
  };

  const mockCtx = {
    registry, expectId: opts.expectId, expectLine: opts.expectLine, acceptedLines,
  };
  const results = [];
  let totalInputTokens = 0;
  for (const e of withSizes) {
    // MOCK: TWO stubbed answers per hypothesis — one PASS-shaped and one FAIL-shaped — so both
    // verdict branches of every check are exercised offline instead of one being vacuously green.
    let responses;
    if (opts.mock) {
      console.log(`[MOCK] ${e.kind} — no network call; two stubbed answers (PASS-shaped and FAIL-shaped)`);
      responses = ['PASS', 'FAIL'].map((b) => ({ branch: b, raw: mockResponse(e, e.size, mockCtx, b) }));
    } else {
      console.log(`${e.kind} → POST ${ENDPOINT} (${fmtInt(e.size.totalTokens)} tokens)`);
      responses = [{ branch: null, raw: await postSystemOne(e.request, apiKey, (m) => console.log(m)) }];
    }
    for (const { branch, raw } of responses) {
      const usage = raw && raw.usage ? raw.usage : {};
      const inputTokens = Number.isFinite(usage.input_tokens) ? usage.input_tokens : e.size.totalTokens;
      totalInputTokens += inputTokens;
      console.log(`  model: ${raw.model ?? 'unknown'}   usage: input ${fmtInt(inputTokens)} / output `
        + `${fmtInt(usage.output_tokens ?? 0)} tokens   cost so far ${fmtUsd(costUsd(totalInputTokens))}`);

      const answers = (raw && raw.answers) || {};
      if (e.kind === 'H1') {
        const c = checkH1(answers.rule_id, registry, opts.expectId, raw.model ?? null);
        const expectedRank = c.topProbabilities.findIndex(([k]) => k === c.expected);
        const top3 = c.topProbabilities.length
          ? c.topProbabilities.map(([k, v], i) => {
            const r = registry.options.get(k);
            const tag = k === c.expected ? '  ← the expected id'
              : r ? '  [a REAL canonical rule in the option list]' : '  [NOT in the option list]';
            return `#${i + 1} ${k}: ${v}${r ? `  [${r.severity}/${r.effort}]` : ''}${tag}`;
          })
          : ['(no probabilities returned)'];
        const interpretation = [
          `chosen id: ${c.chosen ?? '(none)'}`,
          `chosen probability: ${c.chosenProbability ?? 'n/a'}   confidence: ${c.confidence ?? 'n/a'}`,
          `equals --expect-id ${c.expected}: ${c.matched ? 'YES' : 'NO'}`,
          `in the canonical option list: ${c.inList ? 'YES' : 'NO'} — an out-of-list id is schema-impossible for a `
            + 'Choice, because the answer names one of the option keys we sent',
          'top-3 options by probability:',
          ...top3.map((t) => `    ${t}`),
          c.runnerUp && c.runnerUp.inList
            ? `runner-up ${c.runnerUp.id} (${c.runnerUp.severity}/${c.runnerUp.effort}) is itself a REAL canonical rule: `
              + 'a file can genuinely violate MORE THAN ONE rule (article.service.ts really violates '
              + 'database-sequential-pagination-1 AND database-overfetch-relation-1), so a second choice that is a real '
              + 'rule is a co-violation signal, not a miss — it is surfaced here on purpose'
            : 'runner-up: none of the top-3 is another canonical rule',
          expectedRank > 0
            ? `the expected id ${c.expected} is #${expectedRank + 1} by probability (${c.topProbabilities[expectedRank][1]})`
            : expectedRank < 0 ? `the expected id ${c.expected} is not in the top-3` : '',
          `probabilities sum: ${c.probabilitySum}`,
          `expected id: ${c.expected} (${c.expectedSeverity}/${c.expectedEffort})`,
          c.inList
            ? `severity/effort are STAMPED from the registry, never asked of the model: ${c.stampedSeverity}/${c.stampedEffort} `
              + '— this is what makes the 14/21 severity-contradiction defect impossible for a valid id'
            : 'the model named something outside the registry, which the Choice schema forbids',
        ].filter((line) => line !== '');
        results.push({
          ...e,
          title: `${e.title}${branch ? ` — MOCK ${branch} branch` : ''}`,
          branch,
          type: 'choice',
          questionId: 'rule_id',
          hypothesis: 'A Choice over the canonical ids makes an invented rule id structurally impossible; the open '
            + 'question is only whether it picks the RIGHT id.',
          baseline: 'a real B2 run produced 5 of 5 non-existent rule ids; 14 of 21 findings contradicted the severity '
            + 'of the rule they cited',
          rawAnswer: answers.rule_id ?? null,
          interpretation,
          check: c,
          verdict: c.matched
            ? `PASS — it chose ${c.expected}, the ground-truth rule, and the option list makes any other id impossible`
            : c.inList
              ? `FAIL — chose ${c.chosen} (${c.stampedSeverity}/${c.stampedEffort}), a real rule, but not ${c.expected}`
                + `${expectedRank > 0 ? `; note the expected id is #${expectedRank + 1} in the top-3 probability list` : ''}`
              : 'FAIL — chose an id outside the list (should be impossible: report this as a schema surprise)',
        });
      } else if (e.kind === 'H2') {
        const c = checkH2(answers.evidence_line, {
          lines, windowStart, windowEnd, expectLine: opts.expectLine, locator,
        });
        const interpretation = [
          `chosen line: ${c.lineNumber ?? '(none)'}${c.chosen !== null ? ` (option "${c.chosen}")` : ''} of window ${windowStart}-${windowEnd}`,
          `chosen probability: ${c.chosenProbability ?? 'n/a'}   confidence: ${c.confidence ?? 'n/a'}`,
          `equals --expect-line ${c.expectedLine}: ${c.matchesExpectedLine ? 'YES' : 'NO'}`,
          `chosen line text: ${c.lineText === null ? '(outside the window)' : JSON.stringify(c.lineText)}`,
          `accepted ground-truth line(s): ${c.acceptedLines.join(', ')}`
            + `${locator
              ? ` (--expect-line plus the ${locator.hint} literal found on line(s) ${c.evidenceLines.join(', ') || 'none'})`
              : ' (--expect-line only: this module ships no literal evidence locator)'}`
            + ` → the chosen line is ${c.accepted ? 'ACCEPTED' : 'NOT accepted'}`,
          c.topProbabilities.map(([k, v]) => `line ${k}: ${v}`).join('   ') || '(no probabilities returned)',
          'the option list is the real line numbers, so a citation outside this window is schema-impossible',
        ];
        results.push({
          ...e,
          title: `${e.title}${branch ? ` — MOCK ${branch} branch` : ''}`,
          branch,
          type: 'choice',
          questionId: 'evidence_line',
          hypothesis: 'A Choice whose options are the real line numbers of the window makes a non-existent citation '
            + 'structurally impossible; the open question is whether the chosen line is the ground-truth line and '
            + 'carries the evidence.',
          baseline: '9 of 21 findings (≈40%) cited a line with no evidence — imports, braces, blank lines, line 0',
          rawAnswer: answers.evidence_line ?? null,
          interpretation,
          check: c,
          verdict: c.accepted
            ? `PASS — line ${c.lineNumber} is ${JSON.stringify(truncate(c.lineText, 70))}`
              + `${c.matchesExpectedLine ? ' and equals --expect-line' : ` (accepted by the module's literal ground-truth locator; --expect-line is ${c.expectedLine})`}`
            : `FAIL — line ${c.lineNumber ?? c.chosen} is ${c.lineText === null
              ? 'not a real line in the window'
              : JSON.stringify(truncate(c.lineText, 70))}, which is not ground truth (--expect-line ${c.expectedLine})`,
        });
      } else {
        const c = checkH3(answers);
        const interpretation = [
          `statement_a (TRUE)  → noul ${c.trueValue ?? 'n/a'}   called true? ${c.trueCalledTrue ? 'yes' : 'no'}`,
          `statement_b (FALSE) → noul ${c.falseValue ?? 'n/a'}   called false? ${c.falseCalledFalse ? 'yes' : 'no'}`,
          `separation (a − b): ${c.separation ?? 'n/a'}   (thresholds: a ≥ 0.8 and b ≤ 0.2 for a CLEAN separation)`,
          'a Noul takes no prompt variant, so there is no phrasing to re-roll the verdict with: the number IS the answer',
        ];
        results.push({
          ...e,
          title: `${e.title}${branch ? ` — MOCK ${branch} branch` : ''}`,
          branch,
          type: 'noul',
          questionId: 'statement_a / statement_b',
          hypothesis: 'A Noul returns a truth probability directly, so a judge built on it cannot drift across prompt '
            + 'variants the way a generating judge does.',
          baseline: 'the blind judge moved 11 verdicts across prompt variants without a single claim changing',
          rawAnswer: { statement_a: answers.statement_a ?? null, statement_b: answers.statement_b ?? null },
          interpretation,
          check: c,
          verdict: c.trueCalledTrue && c.falseCalledFalse
            ? `SEPARATES — true ${c.trueValue} vs false ${c.falseValue}, margin ${c.separation}${c.clean ? ' (clean)' : ' (not clean: margin is thinner than 0.8/0.2)'}`
            : `DOES NOT SEPARATE — true ${c.trueValue ?? 'n/a'} vs false ${c.falseValue ?? 'n/a'}`,
        });
      }
      console.log('');
    }
  }

  const costLines = [
    `per request: ${withSizes.map((e) => `${e.kind} ${fmtInt(e.size.totalTokens)} tok`).join(' · ')} (estimate, chars/4)`,
    opts.mock
      ? `this MOCK run: ${fmtInt(totalInputTokens)} input tokens → ${fmtUsd(costUsd(totalInputTokens))} — DOUBLED and meaningless: `
        + 'each hypothesis was answered twice with a stub, and no token was ever billed'
      : `this run: ${fmtInt(totalInputTokens)} input tokens → ${fmtUsd(costUsd(totalInputTokens))} `
        + `($${USD_PER_BTOK_INPUT}/Btok of input, output free)`,
    `projected full benchmark (${FULL_TARGETS} targets × ${FULL_MODULES} modules at ASSUMED `
      + `${fmtInt(ASSUMED_ROUND1_TOKENS)} + ${fmtInt(ASSUMED_ROUND2_TOKENS)} tokens/module): `
      + `${fmtInt(FULL_TARGETS * FULL_MODULES * (ASSUMED_ROUND1_TOKENS + ASSUMED_ROUND2_TOKENS))} input tokens → `
      + `${fmtUsd(costUsd(FULL_TARGETS * FULL_MODULES * (ASSUMED_ROUND1_TOKENS + ASSUMED_ROUND2_TOKENS)))}`,
    'the full-benchmark line is an ASSUMPTION, not a measurement: only the probe itself has been measured.',
  ];

  const ctx = {
    mode: opts.mock ? 'MOCK' : 'LIVE',
    target: relToCwd(target),
    module: opts.module,
    file: opts.file,
    fileLines: lines.length,
    windowStart,
    windowEnd,
    expectId: opts.expectId,
    expectLine: opts.expectLine,
    model: opts.model,
    registry,
    results,
    budgetLines,
    costLines,
    keyPresent: Boolean(apiKey),
    provenance,
    generatedAt: new Date().toISOString(),
    outFiles: [],
    caveats: [
      'n = 1 per hypothesis, on ONE file of ONE repository: this is a signal, not a benchmark.',
      'H1/H2 prove the SHAPE of the answer is constrained. They do not prove the model is right in general — only '
        + 'that a wrong answer can no longer be an invented id or an invented line number.',
      'H3 with two statements is the weakest of the three: one clean pair does not establish judge stability. '
        + 'A real test needs the same statements across prompt variants and repeated runs.',
      'The state is English source code, and English is the model\'s primary language; this probe says nothing '
        + 'about accuracy on Spanish-first repositories.',
      'The second-place option is reported rather than hidden: a file can legitimately violate more than one rule, '
        + 'so a runner-up that is itself a canonical rule is a co-violation signal, not automatically a wrong answer.',
      opts.mock ? 'MOCK: every value above is a stub, and each hypothesis is answered TWICE (a PASS-shaped and a '
        + 'FAIL-shaped stub) so both verdict branches are exercised. The pass/fail verdicts above are about the '
        + 'HARNESS, not about Jev. No network call was made and no key was read.' : 'LIVE values come from the API.',
    ],
  };

  const report = renderReport(ctx);

  const resultsPath = join(outDir, 'jev-probe-results.json');
  const reportPath = join(outDir, 'jev-probe-report.md');
  writeFileSync(resultsPath, JSON.stringify({
    generated_at: ctx.generatedAt,
    mode: ctx.mode,
    endpoint: ENDPOINT,
    model: ctx.model,
    target: target,
    file: opts.file,
    file_lines: lines.length,
    provenance,
    module_mapping: {
      requested_module: opts.module,
      skill_file: registry.skillRel,
      declared_modules: knownModules,
    },
    ground_truth: {
      expect_id: opts.expectId,
      expect_id_present: registry.options.has(opts.expectId),
      expect_line: opts.expectLine,
      accepted_lines: acceptedLines,
      evidence_lines_from_locator: evidenceLines,
      window_start: windowStart,
      window_end: windowEnd,
      window_options: windowEnd - windowStart + 1,
      choice_max_options: CHOICE_MAX_OPTIONS,
    },
    registry: {
      canonical_rule_count: registry.totalCount,
      fingerprint: registry.fingerprint,
      module: opts.module,
      module_rule_count: registry.moduleCount,
      expected_rule_id: opts.expectId,
      expected_rule_present: registry.options.has(opts.expectId),
      options: Object.fromEntries([...registry.options].map(([id, r]) => [id, { severity: r.severity, effort: r.effort, description: r.description }])),
    },
    budget: {
      state_question_limit: STATE_QUESTION_LIMIT,
      context_limit_total: CONTEXT_LIMIT_TOTAL,
      per_request: withSizes.map((e) => ({ kind: e.kind, state_tokens: e.size.stateTokens, longest_question_tokens: e.size.longest.tokens, total_tokens: e.size.totalTokens, fits: e.size.fits })),
      single_pass: {
        configured_digest_chars: DIGEST_BUDGET_CHARS,
        configured_digest_tokens: configuredDigest.stateTokens,
        configured_digest_total_tokens: configuredDigest.totalTokens,
        configured_digest_fits: configuredDigest.fits,
        measured_digest_chars: digest.chars,
        measured_digest_tokens: digest.tokens,
        skills_chars: skills.chars,
        skills_tokens: skills.tokens,
        full_single_pass_tokens: fullSinglePass.stateTokens,
        full_single_pass_fits: fullSinglePass.fits,
      },
    },
    requests: withSizes.map((e) => ({ kind: e.kind, size: e.size, body: e.request })),
    results: results.map((r) => ({
      kind: r.kind, branch: r.branch, question_id: r.questionId, verdict: r.verdict, check: r.check, raw_answer: r.rawAnswer,
    })),
    usage: { input_tokens: totalInputTokens, cost_usd: costUsd(totalInputTokens) },
  }, null, 2), 'utf8');
  writeFileSync(reportPath, `${report}\n`, 'utf8');
  ctx.outFiles = [relToCwd(resultsPath), relToCwd(reportPath)];

  console.log(renderReport(ctx));
  console.log('');
  console.log(`wrote ${ctx.outFiles.join(' and ')}`);
  hardExit(0);
}

main().catch((err) => {
  if (err instanceof BudgetError) {
    console.error(`error: ${err.message}`);
    hardExit(2);
  }
  if (err instanceof ApiError) {
    console.error(`error: ${err.message}`);
    console.error(err.status === 401 ? 'hint: TYPESAFE_API_KEY is missing or invalid (the key itself is never printed).' : '');
    hardExit(1);
  }
  console.error(`error: ${err && err.stack ? err.stack : String(err)}`);
  hardExit(2);
});
