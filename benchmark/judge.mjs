#!/usr/bin/env node
/**
 * benchmark/judge.mjs — blind scorer for the two-arm benchmark.
 *
 * Blind: claims from both arms are pooled, shuffled, relabelled C1..Cn, and the
 * judge prompt NEVER sees which arm produced a claim. The label -> (arm, source
 * id) mapping is written to mapping.json so the scores can be re-aggregated
 * afterwards, and it is deliberately NOT sent to the judge.
 *
 * Two independent reality signals are recorded for every claim:
 *   1. JUDGE    — the judge model's opinion (real / grounded / actionable 1-5).
 *   2. MECHANICAL — this script checks the cited file:line itself: does the file
 *      exist in the target repo, and is the line within the file's line count?
 * Disagreements between the two are the interesting part, so both are kept.
 *
 * Grounding here is *existence + line-in-range*, not semantic ("does that line
 * say that?"). That limit is stated in benchmark/README.md.
 *
 * Usage:
 *   node benchmark/judge.mjs <results-dir> [--judge-model <id>] [--repo <dir>] [--mock] [--help]
 *
 * <results-dir> may be a full path or a bare target name, e.g. both of:
 *   node benchmark/judge.mjs benchmark/results/realworld-control
 *   node benchmark/judge.mjs realworld-control
 *
 * Env: LLM_API_KEY (never printed or stored), LLM_JUDGE_MODEL (or --judge-model),
 *      LLM_BASE_URL (default https://integrate.api.nvidia.com/v1).
 *
 * NOTE ON stdio: nothing here spawns a piped child (EPERM in a confined sandbox).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, isAbsolute, relative } from 'node:path';
import {
  BENCH_DIR, REPO_ROOT, WORK_DIR, RESULTS_DIR,
  parseCli, isHelp, log, ok, warn, fail,
  readJson, writeJson, writeText, relPosix,
} from './lib.mjs';

const HELP = `benchmark/judge.mjs — blind scorer (naive arm vs. toolkit arm)

Usage:
  node benchmark/judge.mjs <results-dir> [--judge-model <id>] [--repo <dir>] [--mock] [--help]

Arguments:
  <results-dir>       benchmark/results/<name>, or just <name>

Options:
  --judge-model <id>  judge model id (or env LLM_JUDGE_MODEL). Recorded in scores.json.
                      Use the SAME judge model for every target, or the scores are not comparable.
  --repo <dir>        the repo tree used for the mechanical grounding check.
                      Normally resolved automatically from meta.json / target.json.
  --dump-prompt <f>   copy the exact judge prompt to <f> for audit: it is the
                      evidence that scoring was blind (no arm label appears in it).
  --mock              offline self-test: no network; obviously-fake judge answers.
                      The mechanical grounding check still really runs.
  --help

What it does:
  1. pools claims: arm B = findings in toolkit/assessment.json (id + description +
     location); arm A = candidate claims parsed out of naive.md (no toolkit schema)
  2. shuffles them, labels C1..Cn, writes the label->source mapping to mapping.json
     WITHOUT telling the judge which arm each claim is from
  3. asks the judge for strict JSON per claim: {"real","grounded","actionable","reason"}
  4. separately verifies each cited file:line against the real repo tree
  5. writes scores.json and prints a per-arm summary table

Env:
  LLM_API_KEY        required unless --mock (never printed, never written to disk)
  LLM_JUDGE_MODEL    judge model id
  LLM_BASE_URL       optional, default https://integrate.api.nvidia.com/v1
`;

const SECURITY_PATTERNS = [
  /\bsecret\b/i, /\bcredential/i, /\bpassword/i, /\bpasswd\b/i, /\bapi[_-]?key/i,
  /\bjwt\b/i, /\btoken\b/i, /\bauth(n|entication|orization)?\b/i, /\bsession\b/i,
  /\bsql\b/i, /\binjection\b/i, /\bxss\b/i, /\bcsrf\b/i, /\bcors\b/i,
  /\bencrypt/i, /\bhash(ing)?\b/i, /\bsalt\b/i, /\bplaintext/i, /\bhttps?\b/i,
  /\brce\b/i, /\bssrf\b/i, /\bprivile/i, /\bsanitiz/i, /\bescap(e|ing)\b/i,
  /\bpermission/i, /\bacl\b/i, /\bsecret/i, /\.env\b/i, /\bvulnerab/i,
];

/* ------------------------------------------------------------------ */
/* claim parsing                                                       */
/* ------------------------------------------------------------------ */

/** Arm B: one claim per finding, from the toolkit's own schema. */
function claimsFromToolkit(assessmentFile) {
  const doc = readJson(assessmentFile);
  const findings = Array.isArray(doc.findings) ? doc.findings : [];
  return findings.map((f, i) => ({
    arm: 'toolkit',
    sourceId: String(f.id ?? `finding-${i + 1}`),
    kind: 'finding',
    title: String(f.id ?? `finding-${i + 1}`),
    description: String(f.description ?? ''),
    remediation: String(f.remediation ?? ''),
    severity: f.severity ? String(f.severity) : null,
    module: f.module ? String(f.module) : null,
    structuredLocation:
      f.location && typeof f.location === 'object'
        ? { file: String(f.location.file ?? ''), line: Number.isInteger(f.location.line) ? f.location.line : null }
        : null,
  }));
}

const GENERIC_HEADINGS = new Set([
  'executive summary', 'summary', 'notes', 'note', 'appendix', 'methodology',
  'plan', '30/60/90 day plan', 'next steps', 'conclusion', 'overview',
  'detailed findings', 'findings', 'priorities', 'introduction', 'background',
]);

function headingLevel(line) {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  return m ? { level: m[1].length, title: m[2].trim() } : null;
}

/**
 * Arm A: the naive response is free-form Markdown with no schema. Two strategies:
 *   (a) if the document has meaningful section headings, each section is a claim;
 *   (b) otherwise every list item / non-empty line is a claim.
 * Everything after a plan/appendix/notes heading is treated as bookkeeping, not claim.
 */
function claimsFromNaive(naiveFile, maxClaims = 60) {
  const raw = readFileSync(naiveFile, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');
  const hasSections = lines.some((l) => {
    const h = headingLevel(l);
    return h && h.level >= 2 && h.level <= 4 && !GENERIC_HEADINGS.has(h.title.toLowerCase()) && !/^\d+[.)]\s*/.test(h.title);
  });

  const claims = [];
  if (hasSections) {
    let current = null;
    for (const line of lines) {
      const h = headingLevel(line);
      if (h) {
        const isGeneric = GENERIC_HEADINGS.has(h.title.toLowerCase()) || h.level === 1;
        if (current) {
          claims.push(current);
          current = null;
        }
        if (!isGeneric && h.level >= 2 && h.level <= 4) {
          current = { title: h.title, body: [] };
        }
        continue;
      }
      if (current) current.body.push(line);
    }
    if (current) claims.push(current);
  }

  if (claims.length === 0) {
    let buf = [];
    const flush = () => {
      const text = buf.join('\n').trim();
      if (text) claims.push({ title: text.split('\n')[0].slice(0, 120), body: text.split('\n').slice(1) });
      buf = [];
    };
    for (const line of lines) {
      const h = headingLevel(line);
      if (h) {
        flush();
        continue;
      }
      const trimmed = line.trim();
      if (!trimmed) {
        flush();
        continue;
      }
      // A single line that stands alone is a whole claim; consecutive lines join.
      buf.push(line);
      if (/^([-*+]|\d+[.)])\s+/.test(trimmed) && buf.length > 1) flush();
    }
    flush();
  }

  return claims.slice(0, maxClaims).map((c, i) => {
    const bodyText = c.body.join('\n').trim();
    return {
      arm: 'naive',
      sourceId: `naive-claim-${i + 1}`,
      kind: 'prose-claim',
      title: c.title,
      description: bodyText || c.title,
      remediation: '',
      severity: null,
      module: null,
      structuredLocation: null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* mechanical grounding check                                          */
/* ------------------------------------------------------------------ */
const FILE_RE = String.raw`[A-Za-z0-9_@][A-Za-z0-9_\-./@\\]*\.[A-Za-z0-9]{1,10}`;
const CITATION_PATTERNS = [
  new RegExp(String.raw`(${FILE_RE}):(\d+)`, 'g'),   // path.ts:42
  new RegExp(String.raw`(${FILE_RE})\s*#L(\d+)`, 'g'), // path.ts#L42
];

function normalizeRel(p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function fileLineCount(repoDir, relPath) {
  const abs = join(repoDir, ...normalizeRel(relPath).split('/'));
  let rel;
  try {
    rel = relative(repoDir, abs);
  } catch {
    return { exists: false, reason: 'path is outside the repo' };
  }
  if (rel.startsWith('..') || isAbsolute(rel)) return { exists: false, reason: 'path escapes the repo' };
  if (!existsSync(abs)) return { exists: false, reason: 'file not found in the target repo' };
  let st;
  try {
    st = statSync(abs);
  } catch {
    return { exists: false, reason: 'unreadable' };
  }
  if (!st.isFile()) return { exists: false, reason: 'not a regular file' };
  let content;
  try {
    content = readFileSync(abs, 'utf8');
    if (content.includes('\u0000')) return { exists: true, isBinary: true, lines: null, reason: 'binary file' };
  } catch {
    return { exists: true, isBinary: true, lines: null, reason: 'unreadable as text' };
  }
  const lines = content.split('\n');
  return { exists: true, isBinary: false, lines: lines.length };
}

/** Pull candidate citations out of a claim: structured location + path:line mentions. */
function extractCitations(claim) {
  const found = [];
  const seen = new Set();
  const add = (file, line, origin) => {
    const key = `${normalizeRel(file)}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ file: normalizeRel(file), line, origin });
  };
  if (claim.structuredLocation?.file) {
    add(claim.structuredLocation.file, claim.structuredLocation.line ?? null, 'structured');
  }
  const text = `${claim.title}\n${claim.description}\n${claim.remediation}`;
  for (const re of CITATION_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) add(m[1], Number.parseInt(m[2], 10), 'prose');
  }
  return found;
}

/** Mechanical verdict for one claim, checked against the real repo tree. */
function mechanicalCheck(repoDir, claim) {
  const citations = extractCitations(claim);
  if (!repoDir || !existsSync(repoDir)) {
    return { repoAvailable: false, citations: [], verified: 0, unverified: 0, mismatched: 0, verdict: 'unverifiable', details: [] };
  }
  const details = citations.map((c) => {
    const check = fileLineCount(repoDir, c.file);
    let status;
    if (!check.exists) status = 'missing-file';
    else if (check.isBinary) status = 'binary-file';
    else if (c.line === null || c.line === 0) status = 'file-level-no-line';
    else if (!Number.isFinite(c.line)) status = 'bad-line';
    else if (c.line > check.lines) status = 'line-out-of-range';
    else status = 'ok';
    return { ...c, status, fileLines: check.lines, reason: check.reason ?? null };
  });
  // "Cited and real" = a concrete file:line citation that resolves inside the repo.
  const verified = details.filter((d) => d.status === 'ok').length;
  const mismatched = details.filter((d) => ['missing-file', 'line-out-of-range', 'bad-line'].includes(d.status)).length;
  const unverified = citations.length - verified;
  let verdict;
  if (verified === 0) verdict = 'ungrounded';
  else if (mismatched > 0) verdict = 'partially-grounded';
  else verdict = 'grounded';
  return { repoAvailable: true, citations: details, verified, unverified, mismatched, verdict, details };
}

function isSecurityRelevant(claim) {
  const text = `${claim.title}\n${claim.description}\n${claim.remediation}`;
  return SECURITY_PATTERNS.some((re) => re.test(text));
}

/* ------------------------------------------------------------------ */
/* judge                                                               */
/* ------------------------------------------------------------------ */
/**
 * How a claim is shown to the judge. Identifiers are STRIPPED: the toolkit's rule
 * ids are slugs that reveal the module and the rule that fired (e.g.
 * "security-jwt-weak-3"), and showing those would hand the judge a provenance
 * hint. The judge sees an anonymous claim, its stated severity, and its text.
 */
function anonymousTitle(claim) {
  const raw = (claim.title || '').trim();
  if (!raw || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(raw)) return `${claim.kind === 'finding' ? 'Finding' : 'Claim'} ${claim.label}`;
  return raw.length > 90 ? `${raw.slice(0, 90)}…` : raw;
}

/** Remove known arm/source identifiers from text before it reaches the judge. */
function redactIdentifiers(text, claims) {
  let out = String(text ?? '');
  const identifiers = new Set(['toolkit', ...claims.map((c) => c.sourceId)]);
  for (const id of identifiers) {
    if (!id || id.length < 3) continue;
    out = out.split(id).join('[redacted-identifier]');
  }
  return out;
}

function buildJudgePrompt(repoName, claims, treeSample) {
  const claimBlocks = claims
    .map((c) => {
      const claimText = redactIdentifiers(c.description || c.title, claims).slice(0, 2000);
      const fix = c.remediation ? redactIdentifiers(c.remediation, claims).slice(0, 800) : '';
      return `### ${c.label}
Title: ${anonymousTitle(c)}
Severity (if stated): ${c.severity ?? 'not stated'}
Claim: ${claimText}${fix ? `\nSuggested fix: ${fix}` : ''}`;
    })
    .join('\n\n');
  return `You are a strict, skeptical code reviewer scoring claims about a repository.
You do NOT know who or what produced these claims, and you must not try to guess.
Judge every claim on its own merits only.

# Repository: ${repoName}

## File tree (partial)
${treeSample || '(not available)'}

# Claims to score

${claimBlocks}

# Scoring rules
For EACH claim, decide:
- "real": is the problem genuinely present in a repository like this, as described?
  true only if a competent engineer would agree the described problem is a real defect
  or real risk. If the claim is vague, speculative, generic advice, or unverifiable
  from what you can see, answer false.
- "grounded": does the claim cite a specific file (and line) that plausibly exists in
  this repository, and does that citation actually support the claim? A claim with no
  citation at all is NOT grounded.
- "actionable": 1-5. 5 = a specific fix is named that an engineer could apply today;
  1 = restates a best practice with no concrete action.
- "reason": one short sentence. Keep it under 240 characters.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"judgments":[{"label":"C1","real":true,"grounded":false,"actionable":2,"reason":"..."}]}
Every label you were given must appear exactly once.`;
}

function extractJson(text) {
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(trimmed);
  } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('no JSON object in the judge response');
}

async function callJudge({ baseUrl, apiKey, model }, messages) {
  // See run.mjs: reasoning models need a bigger budget than the OpenAI default.
  const body = { model, messages, temperature: 0, max_tokens: Number(process.env.MAX_TOKENS || 16384), response_format: { type: 'json_object' } };
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 400) {
    const text = await res.text();
    if (/response_format|json/i.test(text)) {
      delete body.response_format;
      const retry = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!retry.ok) throw new Error(`judge HTTP ${retry.status}: ${(await retry.text()).slice(0, 300)}`);
      return (await retry.json()).choices?.[0]?.message?.content;
    }
    throw new Error(`judge HTTP 400: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`judge HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

/**
 * Offline stub. Deterministic and obviously fake, but it still exercises the
 * whole aggregation path, and the mechanical grounding check remains real.
 * If the results dir carries a mock target spec (written by run.mjs --mock),
 * the stub mimics those declared mock claims; otherwise it falls back to a
 * fixed pattern.
 */
function mockJudgments(claims, mockSpec) {
  const specClaims = mockSpec
    ? [
        ...(mockSpec.mockFindings || []).map((f) => ({ arm: 'toolkit', real: true, grounded: true, actionable: 4 })),
        ...(mockSpec.mockNaiveClaims || []).map((c) => ({ arm: 'naive', real: false, grounded: Boolean(c.grounded), actionable: 2 })),
      ]
    : null;
  const byArm = { toolkit: [], naive: [] };
  return claims.map((c, i) => {
    const fromSpec = specClaims ? specClaims.filter((s) => s.arm === c.arm)[byArm[c.arm].length] : null;
    byArm[c.arm].push(c.label);
    void i;
    const shape = fromSpec ?? { real: c.arm === 'toolkit', grounded: c.arm === 'toolkit', actionable: c.arm === 'toolkit' ? 4 : 2 };
    return {
      label: c.label,
      real: shape.real,
      grounded: shape.grounded,
      actionable: shape.actionable,
      reason: `MOCK judge opinion for ${c.label} — offline stub, not a real judgement.`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* reporting                                                           */
/* ------------------------------------------------------------------ */
function summarize(claims, judgments, mechanical) {
  const byArm = {};
  for (const c of claims) {
    const j = judgments[c.label] || {};
    const m = mechanical[c.label] || {};
    const arm = c.arm;
    byArm[arm] ??= {
      claims: 0, judged: 0, real: 0, judgeGrounded: 0, mechGrounded: 0, mechUngrounded: 0,
      mismatch: 0, actionableSum: 0, actionableN: 0, security: 0, securityFn: 0,
    };
    const a = byArm[arm];
    a.claims++;
    if (j.label) a.judged++;
    if (j.real) a.real++;
    if (j.grounded) a.judgeGrounded++;
    if (m.verdict === 'grounded' || m.verdict === 'partially-grounded') a.mechGrounded++;
    if (m.verdict === 'ungrounded') a.mechUngrounded++;
    if (j.grounded === true && m.verdict === 'ungrounded') a.mismatch++;
    if (typeof j.actionable === 'number') {
      a.actionableSum += j.actionable;
      a.actionableN++;
    }
    if (c.securityRelevant) {
      a.security++;
      if (j.real === false) a.securityFn++;
    }
  }
  for (const a of Object.values(byArm)) {
    a.meanActionability = a.actionableN ? Number((a.actionableSum / a.actionableN).toFixed(2)) : null;
    a.precision = a.judged ? Number((a.real / a.judged).toFixed(3)) : null;
    a.judgeGroundedRate = a.judged ? Number((a.judgeGrounded / a.judged).toFixed(3)) : null;
  }
  return byArm;
}

function printTable(summary, targetName, mock, judgeModel) {
  const arms = Object.keys(summary).sort();
  const cols = ['arm', 'claims', 'real', 'precision', 'grounded(judge)', 'grounded(mech)', 'meanAction', 'secRelevant', 'secFalseNeg'];
  const rows = arms.map((arm) => {
    const a = summary[arm];
    return [
      arm,
      a.claims,
      a.real,
      a.precision === null ? 'n/a' : String(a.precision),
      a.judgeGrounded,
      a.mechGrounded,
      a.meanActionability === null ? 'n/a' : String(a.meanActionability),
      a.security,
      a.securityFn,
    ];
  });
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => `| ${cells.map((c, i) => String(c).padEnd(widths[i])).join(' | ')} |`;
  log('');
  log(`Summary — ${targetName}${mock ? '  [MOCK: judge answers are stub text]' : ''}`);
  log(`judge model: ${judgeModel}`);
  log(line(cols));
  log(`|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`);
  for (const r of rows) log(line(r));
  log('');
  log('verdict columns: "real"/"precision"/"meanAction" are the judge\'s opinion;');
  log('"grounded(mech)" is this script\'s own file:line check against the repo tree.');
  log('secFalseNeg = security-relevant claims the judge called NOT real (missed vulnerabilities).');
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  const argv = process.argv.slice(2);
  if (isHelp(argv)) {
    log(HELP);
    return 0;
  }
  // Split argv ourselves so a flag VALUE is never mistaken for the positional
  // <results-dir> (e.g. `--judge-model X results/y` must yield positional [results/y]).
  const cliSpec = { 'judge-model': 'string', repo: 'string', 'dump-prompt': 'string', mock: 'boolean' };
  const flagArgv = [];
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--?/, '');
    if (Object.prototype.hasOwnProperty.call(cliSpec, key)) {
      flagArgv.push(argv[i]);
      if (cliSpec[key] !== 'boolean') {
        if (argv[i + 1] === undefined) {
          fail(`--${key} requires a value`);
          return 2;
        }
        flagArgv.push(argv[++i]);
      }
    } else if (argv[i].startsWith('-')) {
      fail(`unknown argument: ${argv[i]}`);
      log('\nRun `node benchmark/judge.mjs --help` for usage.');
      return 2;
    } else {
      positional.push(argv[i]);
    }
  }
  let parsed;
  try {
    parsed = parseCli(flagArgv, cliSpec);
  } catch (e) {
    fail(e.message);
    log('\nRun `node benchmark/judge.mjs --help` for usage.');
    return 2;
  }
  if (positional.length === 0) {
    fail('missing <results-dir>.');
    log('\nRun `node benchmark/judge.mjs --help` for usage.');
    return 2;
  }

  const mock = Boolean(parsed.mock);
  const baseUrl = process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const apiKey = process.env.LLM_API_KEY || null;
  const rawArg = positional[0];
  // Accept an absolute path, a path relative to the CWD, a path relative to the
  // repo root, or a bare target name — in that order of preference.
  const resultsDir = isAbsolute(rawArg)
    ? rawArg
    : [
        resolve(rawArg),
        resolve(REPO_ROOT, rawArg),
        join(RESULTS_DIR, rawArg),
      ].find((p) => existsSync(p)) ?? join(RESULTS_DIR, rawArg);
  const targetName = resultsDir.split(/[\\/]/).filter(Boolean).pop();

  const judgeModel = parsed['judge-model'] || process.env.LLM_JUDGE_MODEL || (mock ? 'MOCK-JUDGE (no model called)' : null);
  if (!mock && !apiKey) {
    fail('LLM_API_KEY is not set (needed to call the judge model).');
    log('  This tool never asks for the key on the command line. To verify it offline: --mock');
    return 2;
  }
  if (!mock && !judgeModel) {
    fail('No judge model. Pass --judge-model <id> or set LLM_JUDGE_MODEL.');
    log('  Use the same judge model for every target, or the scores are not comparable.');
    return 2;
  }

  const toolkitFile = join(resultsDir, 'toolkit', 'assessment.json');
  const naiveFile = join(resultsDir, 'naive.md');
  const metaFile = join(resultsDir, 'meta.json');
  if (!existsSync(toolkitFile) && !existsSync(naiveFile)) {
    fail(`no claims found: neither ${toolkitFile} nor ${naiveFile} exists.`);
    return 2;
  }

  /* ---- repo tree for mechanical grounding ---- */
  let meta = null;
  if (existsSync(metaFile)) {
    try {
      meta = readJson(metaFile);
    } catch { /* ignore malformed meta */ }
  }
  const targetJson = join(resultsDir, 'target.json');
  const pointer = existsSync(targetJson) ? readJson(targetJson) : null;
  const repoCandidates = [
    parsed.repo ? resolve(parsed.repo) : null,
    meta?.target_dir || null,
    pointer?.repoDir || null,
    pointer?.fixtureSource || null,
    join(WORK_DIR, targetName),
  ].filter(Boolean);
  const repoDir = repoCandidates.find((p) => existsSync(p)) ?? null;
  if (!repoDir) {
    warn('target repo tree not found — the mechanical grounding check cannot run for this target.');
    warn(`looked in: ${repoCandidates.join(', ')}`);
  } else {
    ok(`grounding against repo tree: ${repoDir}`);
  }

  /* ---- pool + shuffle + label ---- */
  const claims = [
    ...(existsSync(toolkitFile) ? claimsFromToolkit(toolkitFile) : []),
    ...(existsSync(naiveFile) ? claimsFromNaive(naiveFile) : []),
  ].map((c) => ({ ...c, securityRelevant: isSecurityRelevant(c) }));
  if (!existsSync(toolkitFile)) warn('toolkit/assessment.json missing — arm B contributes no claims.');
  if (!existsSync(naiveFile)) warn('naive.md missing — arm A contributes no claims.');
  if (claims.length === 0) {
    fail('both arms produced zero claims — nothing to judge.');
    return 1;
  }

  // Deterministic shuffle: same results dir always yields the same labels, so a
  // judge run is reproducible. Labels stay blind (they carry no arm information).
  let seed = 0;
  for (const ch of `${targetName}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = claims.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [claims[i], claims[j]] = [claims[j], claims[i]];
  }
  claims.forEach((c, i) => {
    c.label = `C${i + 1}`;
  });

  const mapping = {
    target: targetName,
    mock,
    created_at: new Date().toISOString(),
    note: 'Blind mapping: the judge saw only C1..Cn, never these arms. Do not paste this file into the judge prompt.',
    labels: claims.map((c) => ({
      label: c.label,
      arm: c.arm,
      source_id: c.sourceId,
      title: c.title,
      security_relevant: c.securityRelevant,
    })),
  };
  writeJson(join(resultsDir, 'mapping.json'), mapping);
  ok(`mapping.json written (${claims.length} claims: ${claims.filter((c) => c.arm === 'toolkit').length} toolkit, ${claims.filter((c) => c.arm === 'naive').length} naive)`);

  /* ---- mechanical grounding (always real, even in --mock) ---- */
  const mechanical = {};
  for (const c of claims) mechanical[c.label] = mechanicalCheck(repoDir, c);
  const mechGrounded = Object.values(mechanical).filter((m) => m.verdict === 'grounded').length;
  log(`  mechanical grounding: ${mechGrounded}/${claims.length} claim(s) cite a file:line that really exists`);

  /* ---- judge ---- */
  const treeSample = repoDir
    ? (() => {
        try {
          const out = [];
          const walk = (dir, depth) => {
            if (depth > 3 || out.length > 400) return;
            for (const e of readdirSync(dir, { withFileTypes: true })) {
              if (['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', 'coverage'].includes(e.name)) continue;
              const full = join(dir, e.name);
              out.push(relPosix(repoDir, full) + (e.isDirectory() ? '/' : ''));
              if (e.isDirectory()) walk(full, depth + 1);
            }
          };
          walk(repoDir, 0);
          return out.slice(0, 400).join('\n');
        } catch {
          return null;
        }
      })()
    : null;
  const judgePrompt = buildJudgePrompt(targetName, claims, treeSample);

  // Leak guard: the judge prompt must never reveal which arm a claim came from.
  // Source ids are redacted above, so any remaining hit is a real blindness bug.
  // NOTE: a legitimately quoted sentence may contain ordinary words like "naive";
  // what must never appear is a PROVENANCE phrase naming the arms or the pipeline.
  const leakNeedles = [
    { what: 'the word "toolkit"', needle: /\btoolkit\b/i },
    { what: 'an arm label', needle: /\b(naive|baseline|control)\s+(arm|prompt|run)\b/i },
    { what: 'an arm label', needle: /\barm\s*[ab]\b/i },
    ...claims.map((c) => ({ what: `source id ${c.sourceId}`, needle: new RegExp(c.sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })),
  ];
  const leaks = leakNeedles.filter(({ needle }) => needle.test(judgePrompt)).map(({ what }) => what);
  if (leaks.length) {
    fail(`blindness violation: the judge prompt mentions arm/source identifiers: ${leaks.join(', ')}`);
    return 1;
  }
  if (parsed['dump-prompt']) {
    writeText(resolve(parsed['dump-prompt']), judgePrompt);
    ok(`judge prompt dumped to ${resolve(parsed['dump-prompt'])} (verify by eye that no arm is named)`);
  }

  let judgeRaw;
  if (mock) {
    judgeRaw = JSON.stringify({ mock: true, judgments: mockJudgments(claims, pointer) });
    ok('judge stubbed (MOCK — no model was called)');
  } else {
    const content = await callJudge(
      { baseUrl, apiKey, model: judgeModel },
      [{ role: 'user', content: judgePrompt }],
    );
    judgeRaw = content;
  }

  let parsedJudge;
  try {
    parsedJudge = extractJson(judgeRaw);
  } catch (e) {
    fail(`could not parse the judge response as JSON: ${e.message}`);
    writeJson(join(resultsDir, 'judge-raw.json'), { mock, raw: judgeRaw });
    return 1;
  }
  const list = Array.isArray(parsedJudge.judgments) ? parsedJudge.judgments : [];
  const judgments = {};
  for (const row of list) {
    const label = String(row?.label ?? '').trim();
    if (!label) continue;
    const actionable = Number(row.actionable);
    judgments[label] = {
      label,
      real: row.real === true,
      grounded: row.grounded === true,
      actionable: Number.isFinite(actionable) ? Math.min(5, Math.max(1, Math.round(actionable))) : null,
      reason: String(row.reason ?? '').slice(0, 400),
      provided: true,
    };
  }
  const missing = claims.filter((c) => !judgments[c.label]);
  if (missing.length) {
    warn(`judge omitted ${missing.length} claim(s): ${missing.map((c) => c.label).join(', ')} — recorded as unscored, NOT as false.`);
    for (const c of missing) {
      judgments[c.label] = { label: c.label, real: null, grounded: null, actionable: null, reason: 'judge returned no row for this claim', provided: false };
    }
  }

  /* ---- scores.json ---- */
  const summary = summarize(claims, judgments, mechanical);
  const scores = {
    target: targetName,
    mock,
    created_at: new Date().toISOString(),
    judge_model: judgeModel,
    judge_base_url: mock ? null : baseUrl,
    repo_tree_used_for_grounding: repoDir,
    mock_notice: mock ? 'MOCK RUN — judge answers are stub text, not a real judgement.' : null,
    model_under_test: meta?.model ?? null,
    commit: meta?.commit ?? null,
    note: 'grounded_mechanical = the cited file exists AND the cited line is within the file. Existence only, not semantics.',
    totals: {
      claims: claims.length,
      toolkit: claims.filter((c) => c.arm === 'toolkit').length,
      naive: claims.filter((c) => c.arm === 'naive').length,
      judged: Object.values(judgments).filter((j) => j.provided).length,
    },
    summary_by_arm: summary,
    claims: claims.map((c) => {
      const j = judgments[c.label];
      const m = mechanical[c.label];
      return {
        label: c.label,
        arm: c.arm, // present in scores.json (post-hoc analysis) but never sent to the judge
        source_id: c.sourceId,
        title: c.title,
        severity: c.severity,
        module: c.module,
        security_relevant: c.securityRelevant,
        judge: { real: j.real, grounded: j.grounded, actionable: j.actionable, reason: j.reason },
        grounded_mechanical: m.verdict,
        mechanical: {
          citations: m.citations,
          verified: m.verified,
          unverified: m.unverified,
          mismatched: m.mismatched,
          repo_available: m.repoAvailable,
        },
      };
    }),
  };
  writeJson(join(resultsDir, 'scores.json'), scores);
  ok(`scores.json written: ${join(resultsDir, 'scores.json')}`);
  printTable(summary, targetName, mock, judgeModel);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    fail(e.stack || String(e));
    process.exit(1);
  });
