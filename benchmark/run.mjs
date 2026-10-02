#!/usr/bin/env node
/**
 * benchmark/run.mjs — reproducible two-arm benchmark runner for DontKillTheVibes.
 *
 * ARM A (naive)  : the repo digest + a bare "review this repo" prompt, sent to the
 *                  same endpoint/model as arm B. No toolkit skills, no synthesis
 *                  agent, no finding schema, no validator. Output: naive.md
 * ARM B (toolkit): the real CLI runner, `scripts/dktv-assess.mjs`. Output:
 *                  toolkit/assessment.json
 *
 * Both arms receive the SAME digest, produced by
 * `scripts/dktv-assess.mjs --emit-digest`, so the only difference between the two
 * arms is the prompt/tooling — not the input bytes. That is the whole point of
 * the benchmark, and it is why the digest is written to disk as evidence.
 *
 * Usage:
 *   node benchmark/run.mjs [options]
 *
 * Options:
 *   --only <name>        Run just one target from repos.json
 *   --force              Re-run arms whose output already exists
 *   --model <id>         Model id (env LLM_MODEL)
 *   --base-url <url>     OpenAI-compatible base (env LLM_BASE_URL,
 *                        default https://integrate.api.nvidia.com/v1)
 *   --fixture <dir>      Target used by --mock (default: examples/realworld-assessment)
 *   --mock               Offline self-test: no network, no clone, obviously-fake
 *                        MOCK output. Use this to verify the harness.
 *   --help
 *
 * The API key is read from env LLM_API_KEY ONLY. It is never printed, never
 * written to disk, and never included in meta.json.
 *
 * NOTE ON stdio: all child processes here redirect stdout+stderr to a file,
 * never a pipe — piped spawns fail with EPERM in a confined sandbox. See lib.mjs.
 */
import { existsSync, readdirSync, statSync, readFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import {
  BENCH_DIR, REPO_ROOT, WORK_DIR, RESULTS_DIR, TMP_DIR,
  MOCK_BANNER_MD, parseCli, isHelp, log, ok, warn, fail,
  ensureDir, readJson, writeJson, writeText, run, gitHead, hasGit,
} from './lib.mjs';

const HELP = `benchmark/run.mjs — two-arm benchmark runner (naive prompt vs. DontKillTheVibes toolkit)

Usage:
  node benchmark/run.mjs [--only <name>] [--force] [--model <id>] [--base-url <url>]
                         [--fixture <dir>] [--mock] [--help]

What it does, per target in benchmark/repos.json:
  1. shallow-clone the repo into benchmark/work/<name> (skipped with --mock)
  2. record the resolved commit (git rev-parse HEAD) for reproducibility
  3. write the shared digest: benchmark/results/<name>/digest.json
     (produced by scripts/dktv-assess.mjs --emit-digest — byte-identical input
      for BOTH arms)
  4. ARM B  -> benchmark/results/<name>/toolkit/assessment.json
     ARM A  -> benchmark/results/<name>/naive.md
  5. benchmark/results/<name>/meta.json  (target, commit, model, base URL,
     ISO timestamp, digest stats, per-arm success)

Environment:
  LLM_API_KEY    required for a real run (never printed, never written to disk)
  LLM_MODEL      model id, or pass --model
  LLM_BASE_URL   optional, default https://integrate.api.nvidia.com/v1

--mock:
  No network, no clone. Uses --fixture (default examples/realworld-assessment) as
  the target and stubs both arms with obviously-fake MOCK output so the harness can
  be verified offline. meta.json gets "mock": true and saved files carry a MOCK banner.

Options:
  --only <name>      only run this target from repos.json
  --force            re-run an arm even if its output already exists
  --model <id>       model id for BOTH arms
  --base-url <url>   OpenAI-compatible base URL for BOTH arms
  --fixture <dir>    fixture target for --mock (default examples/realworld-assessment)
  --help             show this help

Safety: entries in repos.json with an empty "url" are skipped with a notice.
Commits are resolved at run time; no SHA is ever taken from repos.json.
`;

/* ------------------------------------------------------------------ */
/* naive prompt (arm A) — deliberately bare. No skills, no schema.     */
/* ------------------------------------------------------------------ */
const NAIVE_SYSTEM = 'You are a senior software engineer reviewing a repository. Answer in Markdown.';

function buildNaivePrompt(repoName, digest) {
  const tree = digest.tree.join('\n');
  const files = digest.included.map((f) => `### ${f.rel}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
  return `Review this repository and list the problems you find. Be specific.

# Repository: ${repoName}

## File tree (${digest.tree.length} files)
${tree}

## File contents (${digest.included.length} files, ${digest.chars} chars)

${files}

List the problems you find in this repository.`;
}

/* ------------------------------------------------------------------ */
/* LLM call (shared by both arms: same endpoint, same model)           */
/* ------------------------------------------------------------------ */
async function callChat({ baseUrl, apiKey, model }, messages, { jsonMode = false } = {}) {
  const body = {
    model,
    messages,
    temperature: 0.2,
    // Reasoning models (e.g. NVIDIA Nemotron) spend thousands of tokens on hidden
    // reasoning before emitting content — a real run burned 12,977 reasoning tokens.
    // 8192 truncated it, so the budget is larger and overridable via MAX_TOKENS.
    max_tokens: Number(process.env.MAX_TOKENS || 16384),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 400 && jsonMode) {
    const text = await res.text();
    if (/response_format|json/i.test(text)) return callChat({ baseUrl, apiKey, model }, messages, { jsonMode: false });
    throw new Error(`LLM HTTP 400: ${text.slice(0, 300)}`);
  }
  if (res.status === 429) {
    const wait = Number.parseInt(res.headers.get('retry-after') || '5', 10);
    log(`  rate limited (429) — waiting ${wait}s`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return callChat({ baseUrl, apiKey, model }, messages, { jsonMode });
  }
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned no content');
  return { content, usage: data.usage };
}

/* ------------------------------------------------------------------ */
/* mock target + mock toolkit runner                                   */
/* ------------------------------------------------------------------ */

/**
 * Mock findings, anchored to files that really exist inside the mock target.
 * They are intentionally banal and self-labelled MOCK. `naiveGround` decides
 * whether the mechanically-verifiable citation on a naive claim is real, so the
 * judge's grounding check can be exercised in both directions offline.
 */
const MOCK_FINDING_SPECS = [
  {
    id: 'security-jwt-weak-3',
    location: { file: 'assessment.json', line: 22 },
    description:
      'MOCK placeholder claim: the digest shows a hardcoded default credential used when an environment variable is absent.',
    remediation:
      'MOCK placeholder remediation: fail fast at boot when the secret is missing, and rotate anything signed with the default.',
    check: { file: 'assessment.json', line: 22, snippet: '"line": 16' },
  },
  {
    id: 'database-sequential-pagination-1',
    location: { file: 'assessment.json', line: 98 },
    description:
      'MOCK placeholder claim: a count and a page query are awaited sequentially on a paginated read path.',
    remediation:
      'MOCK placeholder remediation: issue both queries concurrently and await them together.',
    check: { file: 'assessment.json', line: 30, snippet: 'database-sequential-pagination-1' },
  },
];

const MOCK_NAIVE_CLAIMS = [
  {
    title: 'MOCK-CLAIM-01: identical pagination claim (grounded)',
    location: 'assessment.json:34',
    grounded: true,
  },
  {
    title: 'MOCK-CLAIM-02: fabricated citation (file does not exist)',
    location: 'src/this/path/does/not/exist.ts:42',
    grounded: false,
  },
];

function mockFindingFromSpec(spec) {
  return {
    id: spec.id,
    module: spec.id.split('-')[0],
    severity: 'medium',
    location: { file: spec.location.file, line: spec.location.line },
    description: `[MOCK] ${spec.description}`,
    remediation: `[MOCK] ${spec.remediation}`,
    effort: 'S',
    confidence: 0.5,
    tags: ['mock'],
    evidence: { snippet: spec.check.snippet, benchmark: 'mock' },
  };
}

function buildMockNaiveMarkdown(repoName) {
  const blocks = MOCK_NAIVE_CLAIMS.map((c) => `### ${c.title}
**Location**: \`${c.location}\`
**Description**: MOCK placeholder text. There is no real analysis behind this claim; it exists only to exercise the harness offline.
`).join('\n');
  return `# MOCK review response (fixture: ${repoName})

${MOCK_BANNER_MD}

${blocks}
## Notes
- This file was produced by \`--mock\`; no LLM was called.
- Its only purpose is to prove the harness runs end to end without a key.
`;
}

function buildMockToolkitScript(fixturePath) {
  return `#!/usr/bin/env node
/* AUTO-GENERATED MOCK — benchmark/run.mjs --mock. Not a real assessment runner.
 * Validates the mock assessment itself (no child process: piped spawn is EPERM
 * in a confined sandbox), writes it to <out>/assessment.json, exits 0. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
const get = (flag) => { const i = argv.indexOf(flag); return i === -1 ? null : argv[i + 1]; };
if (argv.includes('--help') || argv.includes('-h')) { console.log('MOCK runner: --target <dir> --out <dir>'); process.exit(0); }
const target = get('--target');
const out = get('--out');
if (!target || !out) { console.error('MOCK runner: --target and --out are required'); process.exit(2); }
const doc = JSON.parse(readFileSync(${JSON.stringify(fixturePath)}, 'utf8'));
const errors = [];
if (!doc.metadata || !doc.summary || !doc.work_plan || !Array.isArray(doc.findings)) errors.push('missing top-level document sections');
if (!Number.isInteger(doc.summary.total_findings) || doc.summary.total_findings !== doc.findings.length) errors.push('summary.total_findings does not match findings.length');
const seen = new Set();
for (const [i, f] of doc.findings.entries()) {
  if (!/^[a-z-]+-\\d+$/.test(f.id)) errors.push(\`findings[\${i}].id invalid\`);
  if (seen.has(f.id)) errors.push(\`findings[\${i}].id duplicated\`);
  seen.add(f.id);
  for (const req of ['module', 'severity', 'location', 'description', 'remediation', 'effort', 'confidence']) {
    if (f[req] === undefined || f[req] === null) errors.push(\`findings[\${i}] missing \${req}\`);
  }
  if (!f.location || typeof f.location.file !== 'string' || !Number.isInteger(f.location.line)) errors.push(\`findings[\${i}].location must be {file, line}\`);
}
if (errors.length) { console.error('MOCK assessment failed its own contract check:'); for (const e of errors) console.error(' - ' + e); process.exit(1); }
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'assessment.json'), JSON.stringify(doc, null, 2));
console.log('MOCK: wrote ' + join(out, 'assessment.json'));
console.log('MOCK: target ' + target + ' is a fixture; no repository was analysed.');
process.exit(0);
`;
}

/**
 * Build benchmark/tmp/mock-target: a copy of the fixture (so the mock findings'
 * citations point at files that really exist, giving the judge's mechanical
 * grounding check real work to do) plus target.json describing those findings.
 */
function buildMockTarget(fixtureDir) {
  const mockTarget = join(TMP_DIR, 'mock-target');
  rmSync(mockTarget, { recursive: true, force: true });
  ensureDir(mockTarget);
  cpSync(fixtureDir, mockTarget, { recursive: true });
  const doc = {
    $comment: 'Auto-generated by benchmark/run.mjs --mock. Describes the mock repo/claims used offline. Not evidence.',
    mock: true,
    name: 'realworld-control',
    url: 'https://github.com/gothinkster/realworld',
    note: 'MOCK: --mock uses a local fixture directory instead of cloning. No real repository was cloned or assessed.',
    fixtureSource: fixtureDir,
    mockFindings: MOCK_FINDING_SPECS,
    mockNaiveClaims: MOCK_NAIVE_CLAIMS,
  };
  writeJson(join(mockTarget, 'target.json'), doc);
  return { mockTarget, doc };
}

function buildMockAssessment(mockTargetDoc) {
  const findings = mockTargetDoc.mockFindings.map(mockFindingFromSpec);
  const bySeverity = {};
  const byModule = {};
  const byEffort = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byModule[f.module] = (byModule[f.module] || 0) + 1;
    byEffort[f.effort] = (byEffort[f.effort] || 0) + 1;
  }
  return {
    metadata: {
      repo: 'MOCK (fixture, not a clone)',
      assessed_at: new Date().toISOString(),
      toolkit_version: 'MOCK',
      llm_used: 'MOCK (no model was called)',
      run_type: 'MOCK — offline harness self-test; this is NOT an assessment',
    },
    summary: {
      total_findings: findings.length,
      by_severity: bySeverity,
      by_module: byModule,
      effort_estimate: byEffort,
    },
    findings,
    work_plan: {
      phases: [{ name: 'MOCK', findings: findings.map((f) => f.id), total_effort: 'S' }],
      dependencies: {},
    },
  };
}

/* ------------------------------------------------------------------ */
/* digest (shared input for both arms)                                 */
/* ------------------------------------------------------------------ */
async function emitDigest(targetDir, digestFile) {
  const args = ['scripts/dktv-assess.mjs', '--target', targetDir, '--emit-digest', digestFile];
  const r = await run(process.execPath, args, { cwd: REPO_ROOT });
  if (r.status !== 0 || !existsSync(digestFile)) {
    throw new Error(
      `failed to write the digest.\n${r.output.trim()}\n` +
      `Hint: every child process here redirects stdio to a file on purpose (piped spawns are\n` +
      `denied with EPERM in a confined sandbox). Verify scripts/dktv-assess.mjs --emit-digest\n` +
      `works on its own before re-running.`,
    );
  }
  return readJson(digestFile);
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  const argv = process.argv.slice(2);
  if (isHelp(argv) || argv.length === 0) {
    log(HELP);
    return 0;
  }

  let parsed;
  try {
    parsed = parseCli(argv, {
      only: 'string',
      force: 'boolean',
      model: 'string',
      'base-url': 'string',
      fixture: 'string',
      mock: 'boolean',
    });
  } catch (e) {
    fail(e.message);
    log('\nRun `node benchmark/run.mjs --help` for usage.');
    return 2;
  }

  const mock = Boolean(parsed.mock);
  const model = parsed.model || process.env.LLM_MODEL || null;
  const baseUrl = parsed['base-url'] || process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const apiKey = process.env.LLM_API_KEY || null;
  const fixtureDir = resolve(parsed.fixture || join(REPO_ROOT, 'examples', 'realworld-assessment'));

  const reposFile = join(BENCH_DIR, 'repos.json');
  if (!existsSync(reposFile)) {
    fail(`missing ${reposFile}`);
    return 2;
  }
  const targets = (readJson(reposFile).targets || []).filter((t) => t && t.name);

  if (!mock) {
    if (!apiKey) {
      fail('LLM_API_KEY is not set. This harness never asks for the key on the command line and never stores it.');
      log('  Fix: set LLM_API_KEY in your environment (do NOT commit it, do NOT pass it inline in shell history).');
      log('  To verify the harness with no key at all, run: node benchmark/run.mjs --mock');
      return 2;
    }
    if (!model) {
      fail('No model configured. Set LLM_MODEL or pass --model <id>.');
      log('  NIM examples: moonshotai/kimi-k2-instruct-0905, deepseek-ai/deepseek-v3.1, zai-org/glm-4.6-air');
      return 2;
    }
  }

  ensureDir(RESULTS_DIR);
  ensureDir(TMP_DIR);

  if (mock) {
    log('=== MOCK MODE ===');
    log('No network calls. No clones. Output is deliberately fake and labelled MOCK.');
    log('Do not treat anything below as evidence.\n');
    if (!existsSync(fixtureDir)) {
      fail(`--fixture not found: ${fixtureDir}`);
      return 2;
    }
  }

  /* mock target + mock toolkit runner are prepared once */
  let mockTargetDoc = null;
  let mockTargetDir = null;
  let mockRunner = null;
  if (mock) {
    const built = buildMockTarget(fixtureDir);
    mockTargetDir = built.mockTarget;
    mockTargetDoc = built.doc;
    const fixtureJson = join(TMP_DIR, 'mock-assessment.json');
    writeJson(fixtureJson, buildMockAssessment(mockTargetDoc));
    mockRunner = join(TMP_DIR, 'dktv-assess.mock.mjs');
    writeText(mockRunner, buildMockToolkitScript(fixtureJson));
    ok(`mock target built: ${mockTargetDir}`);
    ok(`mock toolkit runner: ${mockRunner}`);
  }

  let ran = 0;
  let failures = 0;

  for (const target of targets) {
    const { name, url, note } = target;
    if (parsed.only && parsed.only !== name) continue;

    // --mock uses a local fixture. It must never fabricate results for targets
    // whose url is still empty — those are the author's unfilled slots, and
    // writing placeholder output into results/ would pollute the evidence.
    const mockEligible = mock && !/^target-\d+$/.test(name);
    if (mock && !mockEligible) {
      log(`\n=== ${name} ===`);
      log('  SKIP  --mock only runs the control fixture; this slot has no url yet.');
      continue;
    }

    log(`\n=== ${name} ===`);
    if (!mock && (!url || !String(url).trim())) {
      log(`  SKIP  url is empty — fill it in repos.json first.`);
      log(`        note: ${note || '(none)'}`);
      continue;
    }

    const targetResults = join(RESULTS_DIR, name);
    const naiveFile = join(targetResults, 'naive.md');
    const toolkitDir = join(targetResults, 'toolkit');
    const toolkitFile = join(toolkitDir, 'assessment.json');
    const digestFile = join(targetResults, 'digest.json');
    const metaFile = join(targetResults, 'meta.json');

    /* ---- 1/2. resolve the target dir and the pinned commit ---- */
    let targetDir;
    let commit;
    let targetPointer = null;
    if (mock) {
      targetDir = mockTargetDir;
      commit = 'MOCK-NO-COMMIT';
      targetPointer = {
        $comment: 'Written by benchmark/run.mjs --mock. Records which local tree the mock run used, so judge.mjs can run its mechanical grounding check. Not evidence.',
        mock: true,
        name,
        repoDir: mockTargetDir,
        fixtureSource: fixtureDir,
      };
      writeJson(join(targetResults, 'target.json'), targetPointer);
    } else {
      const cloneDir = join(WORK_DIR, name);
      if (existsSync(join(cloneDir, '.git')) || existsSync(join(cloneDir, 'HEAD'))) {
        log(`  clone already present: ${cloneDir}`);
      } else {
        if (!(await hasGit())) {
          fail('git is not available on PATH — cannot clone. Real runs need git.');
          failures++;
          continue;
        }
        ensureDir(WORK_DIR);
        log(`  cloning ${url} (depth 1) ...`);
        const r = await run('git', ['clone', '--depth', '1', url, cloneDir], {});
        if (r.status !== 0) {
          fail(`clone failed (exit ${r.status}): ${r.output.trim().split('\n').slice(-8).join('\n')}`);
          failures++;
          continue;
        }
        ok('clone complete');
      }
      targetDir = cloneDir;
      commit = await gitHead(cloneDir);
      if (!commit) {
        fail('could not resolve HEAD for the clone — refusing to record an unpinned run.');
        failures++;
        continue;
      }
      ok(`commit ${commit}`);
    }

    const armStatus = {
      digest: false,
      toolkit: false,
      naive: false,
    };

    /* ---- 3. shared digest (both arms get byte-identical input) ---- */
    let digest;
    try {
      if (existsSync(digestFile) && !parsed.force) {
        digest = readJson(digestFile);
        armStatus.digest = true;
        log(`  digest already present (${digest.included.length} files, ${digest.chars} chars) — reuse (use --force to redo)`);
      } else {
        digest = await emitDigest(targetDir, digestFile);
        armStatus.digest = true;
        ok(`digest written: ${digest.included.length}/${digest.tree.length} files, ${digest.chars} chars`);
      }
    } catch (e) {
      fail(`digest step failed: ${e.message}`);
      failures++;
      continue;
    }
    if (digest.skippedSensitive?.length) {
      warn(`${digest.skippedSensitive.length} sensitive file(s) withheld from the digest — identical for both arms`);
    }

    /* ---- 4a. ARM B: toolkit ---- */
    if (existsSync(toolkitFile) && !parsed.force) {
      armStatus.toolkit = true;
      log('  ARM B (toolkit): output exists — skip (use --force to redo)');
    } else {
      log('  ARM B (toolkit): running scripts/dktv-assess.mjs ...');
      const runner = mock ? mockRunner : join(REPO_ROOT, 'scripts', 'dktv-assess.mjs');
      const args = [runner, '--target', targetDir, '--out', toolkitDir];
      if (model) args.push('--model', model);
      if (baseUrl) args.push('--base-url', baseUrl);
      const r = await run(process.execPath, args, { cwd: REPO_ROOT });
      if (r.status === 0 && existsSync(toolkitFile)) {
        armStatus.toolkit = true;
        ok('ARM B output written');
        // In mock mode the mock runner already writes "[MOCK]" fields; add a
        // top-level "mock": true marker so no file can be mistaken for real output.
        if (mock) markAssessmentAsMock(toolkitFile);
      } else {
        const tail = r.output.trim().split('\n').slice(-12).join('\n');
        fail(`ARM B failed (exit ${r.status}). Last output:\n${tail}`);
        if (/EPERM/i.test(r.output)) {
          log('  Note: a piped child spawn was denied (EPERM). scripts/dktv-assess.mjs validates by');
          log('  spawning validate-assessment.mjs with a pipe, which a confined sandbox blocks.');
        }
      }
    }

    /* ---- 4b. ARM A: naive prompt ---- */
    if (existsSync(naiveFile) && !parsed.force) {
      armStatus.naive = true;
      log('  ARM A (naive): output exists — skip (use --force to redo)');
    } else if (mock) {
      writeText(naiveFile, buildMockNaiveMarkdown(name));
      armStatus.naive = true;
      ok('ARM A output written (MOCK placeholder, no LLM called)');
    } else {
      log('  ARM A (naive): calling the same model with the bare review prompt ...');
      try {
        const repoName = basename(targetDir);
        const { content, usage } = await callChat(
          { baseUrl, apiKey, model },
          [
            { role: 'system', content: NAIVE_SYSTEM },
            { role: 'user', content: buildNaivePrompt(repoName, digest) },
          ],
        );
        writeText(naiveFile, `${content}\n`);
        armStatus.naive = true;
        ok(`ARM A output written${usage ? ` (${usage.prompt_tokens ?? '?'} in / ${usage.completion_tokens ?? '?'} out)` : ''}`);
      } catch (e) {
        fail(`ARM A failed: ${e.message}`);
      }
    }

    /* ---- 5. meta.json ---- */
    const meta = {
      mock,
      target: name,
      url: mock ? mockTargetDoc.url : url,
      commit,
      model: mock ? 'MOCK (no model called)' : model,
      base_url: mock ? null : baseUrl,
      target_dir: targetDir,
      timestamp: new Date().toISOString(),
      digest: {
        file: 'digest.json',
        tree_files: digest.tree.length,
        included_files: digest.included.length,
        chars: digest.chars,
        skipped_content: digest.skippedContent?.length ?? 0,
        skipped_sensitive: digest.skippedSensitive?.length ?? 0,
      },
      arms: {
        toolkit: { ok: armStatus.toolkit, output: 'toolkit/assessment.json' },
        naive: { ok: armStatus.naive, output: 'naive.md' },
      },
      note: mock
        ? 'MOCK RUN — no clone, no network, no LLM. Placeholder output only; not evidence.'
        : 'Digest was produced once and passed to both arms; the only difference is prompt/tooling.',
      api_key_recorded: false,
    };
    writeJson(metaFile, meta);
    ok(`meta.json written (arm B ok=${meta.arms.toolkit.ok}, arm A ok=${meta.arms.naive.ok})`);

    if (meta.arms.toolkit.ok && meta.arms.naive.ok) ran++;
    else failures++;
  }

  log(`\nDone. ${ran} target(s) with both arms complete, ${failures} with a failure or skip that needs attention.`);
  if (mock) {
    log('MOCK RUN COMPLETE — every file produced is labelled MOCK. Re-run without --mock for real results.');
  }
  return failures > 0 && ran === 0 ? 1 : 0;
}

/* helpers used only by the mock path */
function markAssessmentAsMock(file) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const marked = {
    mock: true,
    mock_notice: 'MOCK OUTPUT - NOT A REAL ASSESSMENT. Produced by --mock. Do not cite as evidence.',
    ...doc,
  };
  writeJson(file, marked);
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    fail(e.stack || String(e));
    process.exit(1);
  });
