#!/usr/bin/env node
/**
 * dktv-assess.mjs — Minimal CLI runner for the DontKillTheVibes assessment.
 *
 * Builds a repo digest, sends it with the Synthesis Agent prompt to an
 * OpenAI-compatible chat endpoint (NVIDIA NIM by default), and enforces the
 * output contract by running validate-assessment.mjs after every candidate,
 * feeding validation errors back to the LLM (max --max-retries attempts).
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
 *   --language <code>    Report language, e.g. es/en (default: es)
 *   --context-chars <n>  Total file-content budget in chars (default: 120000)
 *   --max-retries <n>    Validation retry attempts (default: 3)
 *   --max-tokens <n>     Completion token budget (default: 8192). Reasoning models
 *                        (e.g. NVIDIA Nemotron) spend part of this on hidden
 *                        reasoning, so raise it if responses come back truncated.
 *   --dry-run            Build the prompt, print stats, do not call the API
 *   --emit-digest <file> Write the exact repo digest (JSON) that would be sent, then exit.
 *                        Used by benchmark/run.mjs so both comparison arms get
 *                        byte-identical input.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- args ---------- */
function parseArgs(argv) {
  const opts = {
    target: process.cwd(),
    out: null,
    model: process.env.LLM_MODEL,
    baseUrl: process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.LLM_API_KEY,
    language: 'es',
    contextChars: 120_000,
    maxRetries: 3,
    maxTokens: 8192,
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
    else if (a === '--help' || a === '-h') { console.log('See header comment in scripts/dktv-assess.mjs'); process.exit(0); }
    else { console.error(`Unknown arg: ${a}`); process.exit(2); }
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
 * Every canonical rule id, harvested from the `→ FINDING: <id>` lines in
 * skills/*.skill.md. The decision trees define them, but they sit inside ~220k
 * chars of prose. A real NVIDIA NIM run showed the model inventing plausible-looking
 * ids (code-any-type-1, code-env-var-check-1, …) that the validator then rejected on
 * all five findings, so the runner now lists the registry explicitly.
 */
function loadCanonicalRegistry() {
  const ids = new Set();
  const dir = join(root, 'skills');
  for (const f of readdirSync(dir).filter(n => n.endsWith('.skill.md'))) {
    const content = readFileSync(join(dir, f), 'utf8');
    for (const m of content.matchAll(/→\s*FINDING:\s*([A-Za-z0-9-]+)/g)) ids.add(m[1]);
  }
  return [...ids].sort();
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

${loadCanonicalRegistry().join('\n')}

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
async function callChat(opts, messages, useJsonMode) {
  const body = {
    model: opts.model,
    messages,
    temperature: 0.2,
    max_tokens: opts.maxTokens,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 400 && useJsonMode) {
    const text = await res.text();
    if (/response_format|json/i.test(text)) return callChat(opts, messages, false); // model lacks json mode
    throw new Error(`LLM HTTP 400: ${text.slice(0, 300)}`);
  }
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('retry-after') || '5', 10);
    console.log(`  rate limited (429) — waiting ${wait}s`);
    await new Promise(r => setTimeout(r, wait * 1000));
    return callChat(opts, messages, useJsonMode);
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
if (!existsSync(opts.target)) { console.error(`--target not found: ${opts.target}`); process.exit(2); }
if (!opts.dryRun && !opts.emitDigest && !opts.apiKey) { console.error('Missing API key: set LLM_API_KEY or pass --api-key (or use --dry-run)'); process.exit(2); }
if (!opts.dryRun && !opts.emitDigest && !opts.model) {
  console.error('Missing model: set LLM_MODEL or pass --model. NIM examples: moonshotai/kimi-k2-instruct-0905, deepseek-ai/deepseek-v3.1, zai-org/glm-4.6-air, nvidia/llama-3.1-nemotron-70b-instruct');
  process.exit(2);
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
  process.exit(0);
}

if (opts.dryRun) {
  mkdirSync(opts.out, { recursive: true });
  writeFileSync(join(opts.out, 'dktv-prompt-preview.txt'), `${systemPrompt}\n\n--- USER ---\n\n${userPrompt}`);
  console.log(`Dry run — prompt written to ${join(opts.out, 'dktv-prompt-preview.txt')}`);
  process.exit(0);
}

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
];

mkdirSync(opts.out, { recursive: true });
let lastUsage = null;
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
  const candidatePath = join(opts.out, 'assessment.candidate.json');
  writeFileSync(candidatePath, JSON.stringify(candidate, null, 2));
  const v = spawnSync(process.execPath, [join(root, 'scripts/validate-assessment.mjs'), candidatePath], { encoding: 'utf8' });
  process.stdout.write(v.stdout);
  if (v.status === 0) {
    const finalPath = join(opts.out, 'assessment.json');
    writeFileSync(finalPath, JSON.stringify(candidate, null, 2));
    console.log(`\nSaved ${finalPath}`);
    if (lastUsage) console.log(`Tokens: ${lastUsage.prompt_tokens ?? '?'} in / ${lastUsage.completion_tokens ?? '?'} out`);
    process.exit(0);
  }
  messages.push(
    { role: 'assistant', content },
    { role: 'user', content: `The assessment failed validation. Fix ONLY these issues and return the complete corrected JSON object:\n${v.stdout || v.stderr}` },
  );
  await new Promise(r => setTimeout(r, 1000)); // be kind to rate limits
}
console.error(`\nFAILED: assessment did not pass validation after ${opts.maxRetries + 1} attempts.`);
process.exit(1);
