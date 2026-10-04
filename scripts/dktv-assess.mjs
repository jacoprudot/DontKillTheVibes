#!/usr/bin/env node
/**
 * dktv-assess.mjs — Minimal CLI runner for the DontKillTheVibes assessment.
 *
 * Builds a repo digest, sends it with the Synthesis Agent prompt to an
 * OpenAI-compatible chat endpoint (NVIDIA NIM by default), and enforces the
 * output contract by running validate-assessment.mjs after every candidate,
 * feeding validation errors back to the LLM (max --max-retries attempts).
 * Before validation, severity/effort are STAMPED from the shared canonical
 * registry (scripts/lib/canonical-registry.mjs) — they are properties of the
 * rule, never an LLM judgement — and the run reports how many findings were
 * corrected.
 *
 * Usage:
 *   node scripts/dktv-assess.mjs --target /path/to/repo [options]
 *
 * Options:
 *   --target <dir>       Repository to assess (default: cwd)
 *   --out <dir>          Output dir for assessment.json (default: <target>/.dontkillthevibes)
 *   --model <id>         LLM model id (or env LLM_MODEL). NIM examples:
 *                        moonshotai/kimi-k2-instruct-0905, deepseek-ai/deepseek-v3.1,
 *                        zai-org/glm-4.6-air, nvidia/llama-3.1-nemotron-70b-instruct
 *                        (check current ids on build.nvidia.com)
 *   --base-url <url>     OpenAI-compatible base (env LLM_BASE_URL,
 *                        default https://integrate.api.nvidia.com/v1)
 *   --api-key <key>      API key (env LLM_API_KEY). Not needed with --dry-run.
 *   --language <code>    Report language, e.g. en/es (default: en)
 *   --context-chars <n>  Total file-content budget in chars
 *                        (default: DIGEST_CONTEXT_CHARS env, else 180000)
 *   --max-retries <n>    Validation retry attempts (default: 3)
 *   --max-tokens <n>     Completion token budget (default: MAX_TOKENS env, else 8192).
 *                        Reasoning models (e.g. NVIDIA Nemotron) spend part of this on
 *                        hidden reasoning — set MAX_TOKENS=32768 for large digests.
 *   --dry-run            Build the prompt, print stats, do not call the API
 *   --emit-digest <file> Write the exact repo digest (JSON) that would be sent, then exit.
 *                        Used by benchmark/run.mjs so both comparison arms get
 *                        byte-identical input.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadRules, stampRuleFields, rulesetFingerprint } from './lib/canonical-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The canonical rule contract lives in ONE module (shared with the validator and
// the B2 orchestrator). Parsed once per process; severity/effort are properties
// of the rule, never an LLM judgement.
const canonicalRules = loadRules(join(root, 'skills'));

/**
 * Exit with an explicit code after tearing down stdin. On Windows/Git Bash a
 * process that exits while a stdio handle is still open can fast-fail with
 * 0xC0000409 (-1073740791) instead of returning its real exit code — destroy
 * stdin first so `echo $?` reports the code the script actually decided.
 */
function hardExit(code) {
  try { process.stdin.destroy(); } catch { /* already closed */ }
  process.exit(code);
}

/* ---------- args ---------- */
function parseArgs(argv) {
  const opts = {
    target: process.cwd(),
    out: null,
    model: process.env.LLM_MODEL,
    baseUrl: process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.LLM_API_KEY,
    language: 'en',
    contextChars: Number(process.env.DIGEST_CONTEXT_CHARS) || 180_000,
    maxRetries: 3,
    // Reasoning models spend thousands of tokens on hidden reasoning before emitting
    // any content: a real run against a 94k-token digest burned all 8192 tokens on
    // reasoning and returned an empty message. Override with MAX_TOKENS or --max-tokens.
    maxTokens: Number(process.env.MAX_TOKENS) || 8192,
    dryRun: false,
    emitDigest: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--target') opts.target = resolve(next());
    else if (a === '--out') opts.out = resolve(next());
    else if (a === '--model') opts.model = next();
    else if (a === '--base-url') opts.baseUrl = next();
    else if (a === '--api-key') opts.apiKey = next();
    else if (a === '--language') opts.language = next();
    else if (a === '--context-chars') opts.contextChars = parseInt(next(), 10);
    else if (a === '--max-retries') opts.maxRetries = parseInt(next(), 10);
    else if (a === '--max-tokens') opts.maxTokens = parseInt(next(), 10);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--emit-digest') opts.emitDigest = resolve(next());
    else if (a === '--help' || a === '-h') { console.log('See header comment in scripts/dktv-assess.mjs'); hardExit(0); }
    else { console.error(`Unknown arg: ${a}`); hardExit(2); }
  }
  opts.target = resolve(opts.target);
  opts.out = opts.out || join(opts.target, '.dontkillthevibes');
  return opts;
}

/* ---------- repo digest ---------- */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', '.turbo', '.nuxt', 'coverage', '.dontkillthevibes', '.cache', 'target', 'vendor', '__pycache__']);
const SKIP_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.gz', '.tgz', '.tar', '.rar', '.7z', '.mp4', '.mp3', '.mov', '.wasm', '.exe', '.dll', '.so', '.dylib', '.jar', '.class', '.pyc', '.db', '.sqlite', '.bin', '.lock', '.ico']);
const PER_FILE_CAP = 10_000; // chars of content per file

// Filenames that must never leave the machine: the digest is sent to an
// external LLM endpoint, so these are excluded from content AND tree.
const SENSITIVE_NAME =
  /(^\.env(\..+)?$|\.(pem|key|p12|pfx|jks|keystore)$|^id_(rsa|ed25519|ecdsa|dsa)(\.|$)|\.(secret|secrets|credentials)$|^credentials(\.|$)|^\.npmrc$|^\.netrc$)/i;

/**
 * Minimal .gitignore honoring (comments and blank lines skipped; `!`
 * negation unsupported — negated patterns are ignored, which can only
 * over-exclude, never leak).
 */
function loadGitignore(target) {
  const gi = join(target, '.gitignore');
  if (!existsSync(gi)) return () => false;
  const regexes = readFileSync(gi, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('!'))
    .map(p => {
      const dirOnly = p.endsWith('/');
      const anchored = p.startsWith('/');
      let pat = p.replace(/^\//, '').replace(/\/$/, '');
      let re = pat
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DOUBLESTAR::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DOUBLESTAR::/g, '.*')
        .replace(/\?/g, '[^/]');
      re = anchored ? `^${re}` : `(^|/)${re}`;
      return new RegExp(`${re}($|/)`);
    });
  return rel => regexes.some(r => r.test(rel));
}

function walk(dir, base, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, base, files);
    } else if (entry.isFile()) {
      const ext = entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase() : '';
      files.push({ rel: relative(base, full).split('\\').join('/'), full, ext });
    }
  }
}

function buildDigest(target, budget) {
  const all = [];
  walk(target, target, all);
  all.sort((a, b) => a.rel.localeCompare(b.rel));
  const isIgnored = loadGitignore(target);
  const tree = [];
  const included = [];
  const skippedContent = [];
  const skippedSensitive = [];
  let spent = 0;
  for (const f of all) {
    if (SENSITIVE_NAME.test(f.rel.split('/').pop())) {
      skippedSensitive.push(f.rel);
      continue;
    }
    if (isIgnored(f.rel)) { skippedContent.push(f.rel); continue; }
    tree.push(f.rel);
    if (SKIP_EXT.has(f.ext)) { skippedContent.push(f.rel); continue; }
    let size;
    try { size = statSync(f.full).size; } catch { continue; }
    if (spent >= budget) { skippedContent.push(f.rel); continue; }
    let content;
    try { content = readFileSync(f.full, 'utf8'); } catch { skippedContent.push(f.rel); continue; }
    if (content.length > PER_FILE_CAP) {
      content = content.slice(0, PER_FILE_CAP) + `\n... [truncated, file is ${size} bytes]`;
    }
    if (spent + content.length > budget) {
      const room = budget - spent;
      if (room < 500) { skippedContent.push(f.rel); continue; }
      content = content.slice(0, room) + '\n... [truncated by context budget]';
    }
    spent += content.length;
    included.push({ rel: f.rel, content });
  }
  return { tree, included, skippedContent, skippedSensitive, chars: spent };
}

/* ---------- prompts ---------- */
/**
 * Every canonical rule id, from the SHARED registry (scripts/lib/canonical-registry.mjs —
 * the same parse the validator enforces, so prompt and gate can never drift). The
 * decision trees define the rules, but they sit inside ~220k chars of prose. A real
 * NVIDIA NIM run showed the model inventing plausible-looking ids (code-any-type-1,
 * code-env-var-check-1, …) that the validator then rejected on all five findings, so
 * the runner lists the registry explicitly.
 */
function canonicalRuleIds() {
  return [...canonicalRules.keys()].sort();
}

function buildSystemPrompt(language) {
  const synthesis = readFileSync(join(root, 'agents/synthesis-agent.md'), 'utf8');
  const skillFiles = readdirSync(join(root, 'skills')).filter(f => f.endsWith('.skill.md')).sort();
  const skills = skillFiles
    .map(f => `## skills/${f}\n${readFileSync(join(root, 'skills', f), 'utf8')}`)
    .join('\n\n');
  return `You are the DontKillTheVibes Synthesis Agent operating in CLI-runner mode (single-pass: you receive a repository digest and must produce the final machine-readable assessment in one response — no tools, no follow-up questions).

${synthesis}

# Specialist decision trees you must apply

${skills}

# Canonical rule ID registry — the ONLY valid finding ids

${canonicalRuleIds().join('\n')}

# Output contract (hard requirement)

Respond with ONLY a JSON object — no prose, no markdown fences, no comments:

{
  "metadata": { "repo": "<repo name>", "assessed_at": "<ISO 8601>", "toolkit_version": "0.1.0-beta", "llm_used": "<model id>" },
  "summary": { "overall_health": "<A-F>", "total_findings": <n>, "critical_count": <n> },
  "findings": [ <finding objects> ],
  "work_plan": { "phases": { "30_days": ["<finding-id>", ...], "60_days": [...], "90_days": [...] }, "dependencies": [{ "from": "<id>", "to": "<id>", "type": "blocks" }] }
}

Rules for each finding:
- id: MUST be copied verbatim from the canonical registry above. Inventing an id — even a plausible-looking one such as code-any-type-1 or code-env-var-check-1 — is a contract violation and the whole assessment is rejected. Ids must be unique across all findings.
- If a real problem has no matching rule in the registry, do NOT invent a rule: omit the finding, or attach it to the closest existing rule and name that rule in the description.
- Required fields: id, module, severity, location, description, remediation, effort, confidence.
- id shape only (NOT sufficient on its own — the registry rule above is binding): ^[a-z-]+-\\d+$ (module-category-number, unique across all findings).
- module ∈ database|code|structure|flows|security|cost|performance|github
- severity ∈ critical|high|medium|low|info; effort ∈ XS|S|M|L|XL
- confidence: number 0.0-1.0 (use < 0.6 only for genuinely uncertain findings)
- location: { "file": "<repo-relative path>", "line": <n> } — line 0 only for file-level findings
- location.line MUST be the line of the code that evidences the finding (the handler, the query, the config value, the call); never the file header, license block, or import section. If the snippet at the cited line shows imports, you cited the wrong line — move it to the line that actually demonstrates the problem.
- remediation must be specific and actionable (min ~20 chars)
- Every finding MUST be grounded in file content present in the digest below. Do not invent file paths or line numbers you did not see. Cite real line numbers from the snippets.
- Apply the priority algorithm from the Synthesis Agent definition (severity weight x module weight x confidence) and the dependency mapping rules.

The human-readable report language is: ${language}. (JSON string values in description/remediation use that language; keys stay English.)`;
}

function buildUserPrompt(target, digest) {
  const repoName = basename(target);
  const tree = digest.tree.slice(0, 2000).join('\n');
  const files = digest.included.map(f => `### ${f.rel}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
  const truncatedNote = digest.skippedContent.length
    ? `\n\nFiles not included (binary, gitignored, or context budget): ${digest.skippedContent.length} — base findings ONLY on the files shown.`
    : '';
  const sensitiveNote = digest.skippedSensitive.length
    ? `\n\nWithheld for privacy BEFORE transmission: ${digest.skippedSensitive.length} sensitive file(s) — ${digest.skippedSensitive.slice(0, 20).join(', ')}${digest.skippedSensitive.length > 20 ? ', …' : ''}\nThese files were NEVER sent to you. Their absence is NOT evidence that the repository is clean: do not report a secret-management rule as passing, and do not state that no secrets are committed. If a rule needs those files as evidence, omit the finding or lower its confidence below 0.6 and say the evidence was withheld.`
    : '';
  return `# Repository: ${repoName}

## File tree (${digest.tree.length} files)
${tree}

## File contents (${digest.included.length} files, ${digest.chars} chars)${truncatedNote}${sensitiveNote}

${files}

Assess this repository now. Return ONLY the assessment JSON per the output contract.`;
}

/* ---------- LLM call ---------- */
// Free-tier endpoints fail transiently: NVIDIA NIM returns HTTP 504 after a ~2 minute
// cold start, and a bare throw there loses the whole run. 429, every 5xx and network
// errors are retried with backoff before giving up.
const MAX_TRANSPORT_RETRIES = 5;

async function callChat(opts, messages, useJsonMode, transportAttempt = 1) {
  const body = {
    model: opts.model,
    messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  let res;
  try {
    res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (transportAttempt < MAX_TRANSPORT_RETRIES) {
      const wait = Math.min(60, 5 * transportAttempt);
      console.warn(`  network error (${e.message}) — retry ${transportAttempt}/${MAX_TRANSPORT_RETRIES - 1} in ${wait}s`);
      await new Promise(r => setTimeout(r, wait * 1000));
      return callChat(opts, messages, useJsonMode, transportAttempt + 1);
    }
    throw e;
  }
  if (res.status === 400 && useJsonMode) {
    const text = await res.text();
    if (/response_format|json/i.test(text)) return callChat(opts, messages, false, transportAttempt); // model lacks json mode
    throw new Error(`LLM HTTP 400: ${text.slice(0, 300)}`);
  }
  if (res.status === 429 || res.status >= 500) {
    if (transportAttempt < MAX_TRANSPORT_RETRIES) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
      const wait = retryAfter > 0 ? retryAfter : Math.min(60, 5 * transportAttempt);
      console.warn(`  HTTP ${res.status} (rate limit / cold-start gateway) — retry ${transportAttempt}/${MAX_TRANSPORT_RETRIES - 1} in ${wait}s`);
      await new Promise(r => setTimeout(r, wait * 1000));
      return callChat(opts, messages, useJsonMode, transportAttempt + 1);
    }
    throw new Error(`LLM HTTP ${res.status} after ${MAX_TRANSPORT_RETRIES} transport attempts: ${(await res.text()).slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const finishReason = data.choices?.[0]?.finish_reason;
  if (!content) {
    // Reasoning models can spend the whole budget on hidden reasoning and return
    // an empty content field. Say exactly why instead of a bare "no content".
    throw new Error(
      `LLM returned no content (finish_reason: ${finishReason ?? 'unknown'}; reasoning_tokens: ` +
      `${data.usage?.completion_tokens_details?.reasoning_tokens ?? 'n/a'}). If finish_reason is "length", raise --max-tokens.`
    );
  }
  return { content, usage: data.usage, finishReason };
}

/* ---------- json extraction ---------- */
function extractJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error('no JSON object found in response');
}

/* ---------- main ---------- */
const opts = parseArgs(process.argv.slice(2));
if (!existsSync(opts.target)) { console.error(`--target not found: ${opts.target}`); hardExit(2); }
if (!opts.dryRun && !opts.emitDigest && !opts.apiKey) { console.error('Missing API key: set LLM_API_KEY or pass --api-key (or use --dry-run)'); hardExit(2); }
if (!opts.dryRun && !opts.emitDigest && !opts.model) {
  console.error('Missing model: set LLM_MODEL or pass --model. NIM examples: moonshotai/kimi-k2-instruct-0905, deepseek-ai/deepseek-v3.1, zai-org/glm-4.6-air, nvidia/llama-3.1-nemotron-70b-instruct');
  hardExit(2);
}

console.log(`Digesting ${opts.target} ...`);
const digest = buildDigest(opts.target, opts.contextChars);
const systemPrompt = buildSystemPrompt(opts.language);
const userPrompt = buildUserPrompt(opts.target, digest);
const approxTokens = Math.round((systemPrompt.length + userPrompt.length) / 4);
console.log(`Context: ${digest.included.length}/${digest.tree.length} files, ~${approxTokens} tokens estimated`);
if (digest.skippedSensitive.length)
  console.log(`Sensitive files excluded (never sent to the LLM): ${digest.skippedSensitive.length}`);
if (approxTokens > 100_000) console.warn('WARNING: prompt exceeds ~100k tokens — reduce --context-chars or use a model with a larger context window.');

// Benchmark hook: dump the exact digest that would be sent, so a comparison run can
// feed both arms (naive prompt vs. toolkit prompt) byte-identical input.
if (opts.emitDigest) {
  mkdirSync(dirname(opts.emitDigest), { recursive: true });
  writeFileSync(opts.emitDigest, JSON.stringify(digest, null, 2), 'utf8');
  console.log(`Digest written to ${opts.emitDigest}`);
  hardExit(0);
}

if (opts.dryRun) {
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, 'dktv-prompt-preview.txt'), `${systemPrompt}\n\n--- USER ---\n\n${userPrompt}`);
  console.log(`Dry run — prompt written to ${join(opts.out, 'dktv-prompt-preview.txt')}`);
  hardExit(0);
}

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
];

mkdirSync(opts.out, { recursive: true });
let lastUsage = null;
let lastCorrected = 0; // findings whose severity/effort the registry stamped this attempt
for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
  console.log(`Attempt ${attempt}/${opts.maxRetries + 1}: calling ${opts.model} ...`);
  const { content, usage, finishReason } = await callChat(opts, messages, true);
  lastUsage = usage;
  if (finishReason === 'length') {
    console.warn(`  response was TRUNCATED (finish_reason: length) — raise --max-tokens (currently ${opts.maxTokens})`);
  }
  let candidate;
  try { candidate = extractJson(content); }
  catch (e) {
    const hint = finishReason === 'length'
      ? ` Your previous response was cut off by the ${opts.maxTokens}-token limit; return a shorter but COMPLETE JSON object.`
      : '';
    messages.push({ role: 'assistant', content }, { role: 'user', content: `Your response was not parseable JSON: ${e.message}.${hint} Return ONLY the JSON object.` });
    continue;
  }
  // Stamp the rule's declared severity/effort BEFORE validation and BEFORE saving.
  // severity/effort are PROPERTIES OF THE RULE, not an LLM judgement — the same
  // defect class as metadata.llm_used, which the model invented until the runner
  // stamped it. A measured B2 run on the control had 14/21 findings (67%) carrying
  // a contradicting severity; an invented severity silently rewrites the whole
  // work plan (prioritization is severityWeight x moduleWeight x confidence).
  // stampRuleFields never invents: it corrects only when the cited rule exists
  // and declares the field, and never mutates the input.
  lastCorrected = 0;
  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.findings)) {
    candidate.findings = candidate.findings.map((f) => {
      const stamped = stampRuleFields(f, canonicalRules);
      if (stamped !== f
        && (stamped.severity !== f?.severity || stamped.effort !== f?.effort)) {
        lastCorrected++;
      }
      return stamped;
    });
    // The validator tallies summary.by_severity / effort_estimate against the
    // findings, so the stamped values make the model's own counts stale — rebuild
    // them from the stamped findings or the gate would burn retries on our fix.
    if (candidate.summary && typeof candidate.summary === 'object') {
      const bySeverity = {};
      const byEffort = {};
      for (const f of candidate.findings) {
        if (f && typeof f.severity === 'string') bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        if (f && typeof f.effort === 'string') byEffort[f.effort] = (byEffort[f.effort] || 0) + 1;
      }
      candidate.summary.by_severity = bySeverity;
      candidate.summary.effort_estimate = byEffort;
    }
  }
  // Pin the rule contract to the document: the fingerprint changes on ANY rule
  // add/remove/reclass/severity change, so a saved report can always be tied to
  // the exact registry that produced (and stamped) it. Stamped only when the
  // model produced a metadata object — creating one from nothing is the
  // validator's job to reject, not ours to fabricate.
  if (candidate && typeof candidate === 'object'
    && candidate.metadata && typeof candidate.metadata === 'object') {
    candidate.metadata.ruleset_version = rulesetFingerprint(canonicalRules);
  }
  const candidatePath = join(opts.out, 'assessment.candidate.json');
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));

  // Capture the validator through a FILE, not a pipe. Piped stdio for child processes
  // is denied in confined environments (Windows sandbox → EPERM), which made every
  // validation look like a failure and burned the whole retry budget on real LLM
  // calls. File redirection works everywhere and yields byte-identical verdicts.
  const validationPath = join(opts.out, 'validation.txt');
  let v;
  try {
    const fd = openSync(validationPath, 'w');
    try {
      v = spawnSync(process.execPath, [join(root, 'scripts/validate-assessment.mjs'), candidatePath], {
        stdio: ['ignore', fd, fd],
      });
    } finally {
      closeSync(fd);
    }
  } catch (e) {
    v = { status: null, error: e };
  }
  const verdict = existsSync(validationPath) ? readFileSync(validationPath, 'utf8') : '';
  process.stdout.write(verdict);

  if (v.status === 0) {
    const finalPath = join(opts.out, 'assessment.json');
    writeFileSync(finalPath, JSON.stringify(candidate, null, 2));
    console.log(`\nSaved ${finalPath}`);
    // Live measurement of the invented-severity bug: how many findings the registry
    // had to correct in the document that passed the gate. Target: 0 with the
    // enriched prompt; anything persistently > 0 means the model ignores the registry.
    console.log(`Rule fields stamped: ${lastCorrected} finding(s) had severity/effort corrected to the rule's declared values (ruleset ${rulesetFingerprint(canonicalRules)})`);
    if (lastUsage) console.log(`Tokens: ${lastUsage.prompt_tokens ?? '?'} in / ${lastUsage.completion_tokens ?? '?'} out`);
    // Human-readable report, rendered deterministically (no LLM). The JSON above is
    // the contract; the markdown is a convenience artifact. Wired against the shared
    // renderer's fixed interface but guarded with existsSync until the module lands:
    // a run must never fail because the renderer is missing, and a rendering error
    // must never fail a run whose JSON is already valid and saved.
    const rendererPath = join(root, 'scripts/lib/report-renderer.mjs');
    if (existsSync(rendererPath)) {
      try {
        // Dynamic import needs a file:// URL on Windows (a bare C:\ path throws).
        const { renderReport } = await import(pathToFileURL(rendererPath).href);
        const reportPath = join(opts.out, 'assessment-report.md');
        const md = renderReport(candidate, {
          language: opts.language,
          repo: basename(opts.target),
          commit: null, // single-pass runner does not resolve the git commit
          model: opts.model,
          generatedAt: new Date().toISOString(),
        });
        writeFileSync(reportPath, md, 'utf8');
        console.log(`Report: ${reportPath}`);
      } catch (e) {
        console.warn(`  report rendering failed (non-fatal, JSON is valid): ${e.message}`);
      }
    }
    hardExit(0);
  }
  const detail = verdict.trim()
    || (v.error ? `validator could not run: ${v.error.message}` : 'validator produced no output');
  messages.push(
    { role: 'assistant', content },
    { role: 'user', content: `The assessment failed validation. Fix ONLY these issues and return the complete corrected JSON object:\n${detail}` },
  );
  await new Promise(r => setTimeout(r, 1000)); // be kind to rate limits
}
console.error(`\nFAILED: assessment did not pass validation after ${opts.maxRetries + 1} attempts.`);
hardExit(1);
