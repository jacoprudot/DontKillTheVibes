#!/usr/bin/env node
/**
 * test-fixtures.mjs — positive/negative fixture gate for detector specs.
 *
 * Layout: tests/fixtures/detectors/<rule-id>/{positive,negative}/<repo files>
 * Contract: the rule MUST fire at least once on `positive/` and MUST NOT fire
 * on `negative/`. That is what converts a spec from a declaration into a
 * tested detector (PLAN.md Fase 1/2; the validator prints PROVISIONAL until
 * this passes).
 *
 * GIT-HISTORY FIXTURES (2026-10-08). A rule whose tool reads COMMITS cannot be
 * tested against a plain directory, and `git clone` is blocked in this sandbox
 * (measured: msys NtCreateDirectoryObject 0xC0000022). `git init` + commit in a
 * temp directory DOES work, so those fixtures are MATERIALISED at test time:
 *
 *   <fixture>/{positive,negative}/commits/<YYYY-MM-DDTHHMM[~N]>/<tree files…>
 *
 *   - each state dir REPLACES the repo tree (a file absent from it is deleted,
 *     which is how "committed then deleted" is expressed),
 *   - the dir name carries the commit's timestamp (no colon: Windows cannot
 *     hold one), `~N` repeats the same state N times (for commit-rate),
 *   - an optional `subject.txt` inside a state dir sets that commit's subject,
 *   - `<fixture>/secret_value.txt`, when present, holds the obviously-fake value
 *     that must NEVER appear anywhere in the scan output.
 *   The temp repo is built once per side, scanned with onlyIds = {rule}, and
 *   thrown away. Every date is fixed by the directory name, so nothing here
 *   depends on the wall clock.
 *
 * Rules whose tools are not implemented in the engine yet are reported as
 * SKIP (with the tool name), never as PASS. Exit 0 = all run fixtures pass,
 * 1 = at least one failure.
 *
 * `git-log` was REMOVED from the SKIP set below when it started running (see
 * scripts/detect/matchers.mjs). It is not "all 11 rules work" — the one spec the
 * runner refuses by name (flows-message-breaking-schema-2) has no fixture and
 * must not get one that fakes it.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDetect } from './engine.mjs';
import { classifySecretHit, SECRET_NOISE_REASONS } from './secret-noise.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'fixtures', 'detectors');
const DEGRADED = new Set(['semgrep', 'osv-scanner', 'npm-audit', 'license-scan', 'github-api']);

// ---------------------------------------------------------------------------
// git-history fixture materialiser (see the header note)
// ---------------------------------------------------------------------------

/** Run git inside `dir` with an argv array (never a shell). Returns the exit code. */
function gitRun(dir, args, iso) {
  const env = Object.assign({}, process.env, {
    GIT_AUTHOR_DATE: iso ?? '2024-01-01T12:00:00+00:00',
    GIT_COMMITTER_DATE: iso ?? '2024-01-01T12:00:00+00:00',
    GIT_AUTHOR_NAME: 'dktv fixture',
    GIT_AUTHOR_EMAIL: 'fixture@dktv.invalid',
    GIT_COMMITTER_NAME: 'dktv fixture',
    GIT_COMMITTER_EMAIL: 'fixture@dktv.invalid',
  });
  try {
    execFileSync('git', [
      '-C', dir,
      '-c', 'commit.gpgsign=false',
      '-c', 'user.name=dktv fixture',
      '-c', 'user.email=fixture@dktv.invalid',
      '-c', 'init.defaultBranch=main',
      ...args,
    ], { stdio: 'ignore', windowsHide: true, env });
    return 0;
  } catch (e) {
    return typeof e?.status === 'number' ? e.status : -1;
  }
}

/** Relative file paths under `dir` (skips .git), used to mirror and to prune. */
function walkFiles(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = join(dir, entry.name);
    const rel = base === dir ? entry.name : `${full.slice(base.length + 1)}`.split('\\').join('/');
    if (entry.isDirectory()) walkFiles(full, base, out);
    else out.push(rel);
  }
  return out;
}

/** Make `destDir`'s tree identical to `srcDir`'s tree (subject.txt is fixture metadata). */
function replaceTree(srcDir, destDir) {
  const wanted = new Set();
  for (const rel of walkFiles(srcDir)) {
    if (rel === 'subject.txt') continue;
    wanted.add(rel);
    const full = join(destDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, readFileSync(join(srcDir, rel)));
  }
  for (const rel of walkFiles(destDir)) {
    if (!wanted.has(rel)) rmSync(join(destDir, rel), { force: true });
  }
}

const COMMIT_DIR_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(?:~(\d+))?$/;

/** Build the git repo described by a fixture side. Returns the commit count. */
function materializeHistoryRepo(caseDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (gitRun(destDir, ['init', '-q']) !== 0) throw new Error('git init failed');
  const commitsRoot = join(caseDir, 'commits');
  const states = readdirSync(commitsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (states.length === 0) throw new Error('no commits/<stamp> state dirs');
  let commits = 0;
  for (const name of states) {
    const m = COMMIT_DIR_RE.exec(name);
    if (!m) throw new Error(`commit dir name must be YYYY-MM-DDTHHMM[~N], got "${name}"`);
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+00:00`;
    const repeats = m[6] ? Number(m[6]) : 1;
    const src = join(commitsRoot, name);
    replaceTree(src, destDir);
    if (gitRun(destDir, ['add', '-A']) !== 0) throw new Error(`git add failed in ${name}`);
    const subjectFile = join(src, 'subject.txt');
    const subject = existsSync(subjectFile)
      ? (readFileSync(subjectFile, 'utf8').split(/\r?\n/)[0].trim() || `fixture commit ${name}`)
      : `fixture commit ${name}`;
    for (let i = 0; i < repeats; i++) {
      const rc = gitRun(destDir, ['commit', '-q', '--allow-empty', '-m', subject], iso);
      if (rc !== 0) throw new Error(`git commit failed (exit ${rc}) in ${name}`);
      commits++;
    }
  }
  return commits;
}

/**
 * Mark the checkout shallow exactly the way `git clone --depth 1` does: list a
 * commit in .git/shallow and git grafts its parents away. Deterministic, no
 * clone, no network.
 */
function makeShallow(dir) {
  const head = readFileSync(join(dir, '.git', 'HEAD'), 'utf8').trim();
  const ref = head.replace(/^ref:\s*/, '');
  const tip = readFileSync(join(dir, '.git', ref), 'utf8').trim();
  writeFileSync(join(dir, '.git', 'shallow'), `${tip}\n`);
  return tip;
}

/**
 * The git-history contract, with the assertions that make it mean something:
 *   - the rule RAN on both sides (a degraded/skipped rule fails, never passes),
 *   - positive >= 1 finding, negative === 0 findings,
 *   - neither side hit a history cap (so the negative 0 is a complete answer),
 *   - a capped run NAMES its cap (deterministic: gitLimits.maxCommits = 1),
 *   - a shallow checkout NAMES SHALLOW_CHECKOUT,
 *   - the fixture secret never appears anywhere in the output, capped or not.
 */
function runHistoryFixture(id, base) {
  const secretFile = join(base, 'secret_value.txt');
  const secret = existsSync(secretFile) ? readFileSync(secretFile, 'utf8').trim() : null;
  const notes = [];
  const commitCount = { positive: 0, negative: 0 };
  let posDir = null;
  let negDir = null;
  try {
    for (const side of ['positive', 'negative']) {
      const dir = mkdtempSync(join(tmpdir(), `dktv-hist-${id}-${side}-`));
      if (side === 'positive') posDir = dir; else negDir = dir;
      commitCount[side] = materializeHistoryRepo(join(base, side), dir);
      const probe = runDetect(dir, { onlyIds: new Set([id]) });

      const degradedForRule = probe.degraded.filter((d) => d.rule === id);
      if (degradedForRule.length > 0) return { ok: false, detail: `${side}: the rule did not run — degraded: ${degradedForRule[0].reason}` };
      const failures = probe.ruleFailures.filter((f) => f.rule === id);
      if (failures.length > 0) return { ok: false, detail: `${side}: the rule failed — ${JSON.stringify(failures)}` };
      const capped = probe.capHits.filter((c) => c.rule === id);
      if (capped.length > 0) return { ok: false, detail: `${side}: the fixture history was capped (${capped.map((c) => c.cap).join('+')}), so this is not a complete-history test` };

      const found = probe.findings.filter((f) => f.rule === id);
      if (secret && JSON.stringify(probe).includes(secret)) {
        return { ok: false, detail: `${side}: REDACTION FAILURE — the fixture secret value appears in the scan output` };
      }
      if (side === 'positive') {
        if (found.length < 1) return { ok: false, detail: 'positive: 0 findings (expected >= 1)' };
        if (secret && !found.some((f) => String(f.evidence).includes('<redacted'))) {
          return { ok: false, detail: 'positive: no finding carried a redaction marker' };
        }
        notes.push(`positive: ${found.length} finding(s)${secret ? ', secret value absent from the whole output' : ''}`);
      } else {
        if (found.length !== 0) return { ok: false, detail: `negative: expected 0 findings, got ${found.length}` };
        notes.push('negative: 0 findings on an uncapped clean history');
      }
    }

    // deterministic cap probes. Both are driven by explicit limits, never by a
    // clock: (a) a 1-commit cap, (b) a 64-byte cap. A 1-commit positive fixture
    // cannot exercise (a) — the cap is only "hit" when the repo has more commits
    // than the cap — so it is asserted only when the fixture has >= 2 commits;
    // (b) applies to every fixture with a non-trivial diff.
    const tight = runDetect(posDir, { onlyIds: new Set([id]), gitLimits: { maxCommits: 1 } });
    const tightCaps = tight.capHits.filter((c) => c.rule === id).map((c) => String(c.cap));
    if (commitCount.positive >= 2) {
      if (!tightCaps.some((c) => c.includes('MAX_COMMITS'))) {
        return { ok: false, detail: `the commit cap was not named at gitLimits.maxCommits=1 (capHits=${JSON.stringify(tight.capHits)})` };
      }
      notes.push(`commit cap named: ${tightCaps.join('+')}`);
    } else {
      notes.push(`commit cap not exercisable (${commitCount.positive}-commit fixture)`);
    }
    if (secret) {
      if (JSON.stringify(tight).includes(secret)) return { ok: false, detail: 'REDACTION FAILURE in the capped run' };
      const tightFound = tight.findings.filter((f) => f.rule === id).length;
      if (tightFound < 1) return { ok: false, detail: `the capped run found nothing (${tightFound}) although the newest commit still carries the secret line as a removal` };
    }

    const byteCapped = runDetect(posDir, { onlyIds: new Set([id]), gitLimits: { maxDiffBytes: 64 } });
    const byteCaps = byteCapped.capHits.filter((c) => c.rule === id).map((c) => String(c.cap));
    if (!byteCaps.some((c) => c.includes('MAX_DIFF_BYTES'))) {
      return { ok: false, detail: `the byte cap was not named at gitLimits.maxDiffBytes=64 (capHits=${JSON.stringify(byteCapped.capHits)})` };
    }
    if (secret && JSON.stringify(byteCapped).includes(secret)) return { ok: false, detail: 'REDACTION FAILURE in the byte-capped run' };
    notes.push(`byte cap named: ${byteCaps.join('+')}`);

    // shallow checkout: a statistic over 1 visible commit is NOT an answer, and
    // the run must say so instead of reporting a number.
    makeShallow(posDir);
    const shallowProbe = runDetect(posDir, { onlyIds: new Set([id]) });
    const shallowCaps = shallowProbe.capHits.filter((c) => c.rule === id).map((c) => String(c.cap));
    if (!shallowCaps.some((c) => c.includes('SHALLOW_CHECKOUT'))) {
      return { ok: false, detail: `a shallow checkout was not named (capHits=${JSON.stringify(shallowProbe.capHits)})` };
    }
    notes.push('shallow checkout named');
    return { ok: true, detail: notes.join('; ') };
  } catch (e) {
    return { ok: false, detail: `fixture build failed: ${e?.message ?? String(e)}` };
  } finally {
    for (const d of [posDir, negDir]) if (d) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
  }
}

function readRuleIds() {
  if (!existsSync(FIXTURES)) return [];
  return readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

const ids = readRuleIds();
if (ids.length === 0) {
  console.log('NO FIXTURES');
  process.exit(1);
}

// one scan per side, batching all rules: fixtures dirs are tiny
let pass = 0, fail = 0, skip = 0;
const failures = [];

for (const id of ids) {
  const base = join(FIXTURES, id);
  const posDir = join(base, 'positive');
  const negDir = join(base, 'negative');
  if (!existsSync(posDir) || !existsSync(negDir)) {
    console.log(`FAIL ${id} — missing positive/ or negative/ dir`);
    fail++;
    failures.push(id);
    continue;
  }

  // A fixture that ships `commits/` state dirs needs a REAL repository: build
  // it, scan it, throw it away (see the header note).
  if (existsSync(join(posDir, 'commits'))) {
    const res = runHistoryFixture(id, base);
    if (res.ok) {
      console.log(`PASS ${id} (history: ${res.detail})`);
      pass++;
    } else {
      console.log(`FAIL ${id} — ${res.detail}`);
      fail++;
      failures.push(id);
    }
    continue;
  }

  const probe = runDetect(posDir, { onlyIds: new Set([id]) });
  if (probe.skipped > 0 || probe.degraded.some((d) => DEGRADED.has(d.tool.split(':')[0]))) {
    const tool = probe.degraded[0]?.tool ?? 'unknown';
    console.log(`SKIP ${id} — tool not implemented: ${tool}`);
    skip++;
    continue;
  }

  const pos = probe.findings.filter((f) => f.rule === id).length;
  const neg = runDetect(negDir, { onlyIds: new Set([id]) }).findings.filter((f) => f.rule === id).length;

  // OPT-IN EXACT COUNT (2026-10-08). `pos >= 1` cannot see a spec constraint that
  // silently drops SOME of its own positives — which is exactly how
  // `security-debug-in-prod-1` lost every CRLF file and every object-property
  // shape without a single FAIL. A fixture that ships `expected_positive.txt`
  // turns its count into part of the contract; every other fixture keeps the
  // weaker (and much less brittle) `>= 1`.
  const expectedFile = join(base, 'expected_positive.txt');
  const expected = existsSync(expectedFile) ? Number.parseInt(readFileSync(expectedFile, 'utf8').trim(), 10) : null;
  if (expected !== null && (!Number.isInteger(expected) || expected < 0)) {
    console.log(`FAIL ${id} — expected_positive.txt must hold a non-negative integer`);
    fail++;
    failures.push(id);
    continue;
  }

  if (pos >= 1 && (expected === null || pos === expected) && neg === 0) {
    console.log(`PASS ${id} (positive: ${pos} finding(s)${expected === null ? '' : `, exactly the declared ${expected}`}, negative: 0)`);
    pass++;
  } else {
    console.log(`FAIL ${id} — expected ${expected === null ? 'positive>=1' : `positive=${expected} (declared in expected_positive.txt)`}, negative=0; got positive=${pos}, negative=${neg}`);
    fail++;
    failures.push(id);
  }
}

// ---- torture case (2026-10-07 hang incident) ----
// The fixtures above are tiny and can never trigger scale defects: the
// screenshot-to-code hang (catastrophic regex on a minified line) only showed
// at 316 real files. This case generates the adversarial shapes — a very long
// single line, an over-cap file, and a large tree — and asserts the FULL
// all-module run terminates within a hard wall bound. Generated under temp/,
// never committed.
{
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const torture = mkdtempSync(join(tmpdir(), 'dktv-torture-'));
  // 1) 300KB single line with the exact param-count trigger shape (commas + parens)
  const chunk = 'const x = call(a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,y,z,1,2,3);';
  writeFileSync(join(torture, 'big-line.js'), chunk.repeat(Math.ceil(300 * 1024 / chunk.length)));
  // 2) 600KB many-lines file (over the 512KB read cap) of varied code
  const lines = [];
  for (let i = 0; i < 9000; i++) lines.push(`export function fn_${i}(a, b) { return a + b + ${i}; }`);
  writeFileSync(join(torture, 'big-file.ts'), lines.join('\n'));
  // 3) 150 small files
  for (let i = 0; i < 150; i++) writeFileSync(join(torture, `f${i}.ts`), `export const v${i} = ${i};\n`);

  const t0 = Date.now();
  const res = runDetect(torture, {});
  const wall = Date.now() - t0;
  rmSync(torture, { recursive: true, force: true });
  if (wall < 15000) {
    console.log(`PASS torture-case (all-module run over adversarial tree: ${wall}ms, ${res.scanned} rules, ${res.skippedLongLineFiles} long-line file(s) skipped by guard)`);
    pass++;
  } else {
    console.log(`FAIL torture-case — all-module run took ${wall}ms (bound: 15000ms)`);
    fail++;
    failures.push('(torture-case)');
  }
}

// ---- torture case 2: the WHOLE-FILE regex path (2026-10-07 hang, defect 1) ----
// The case above cannot catch it: its trigger file is a single 300KB line, which
// the per-line MAX_LINE guard refuses BEFORE any regex runs. The rule that took
// down chatbot-ui and aurora-synth (`code-many-params-10`) searches whole file
// CONTENT, so it never cared about line length. The two real trigger files prove
// it — aurora-synth/src/demo/songlib.js is 34 856 B over 697 lines with a longest
// line of 178 chars, chatbot-ui/components/utility/global-state.tsx is 10 276 B
// with a longest line of 80 chars. Neither is minified. The adversarial shape is
// therefore reproduced BOTH ways, and the comma-counting rules must still MATCH a
// real violation (unrolling the pattern must not turn the rule off).
{
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dktv-wholefile-'));

  // (a) normal formatting, trigger DENSITY of the real hang: ~700 lines, ~940
  //     commas, ~615 parens, no long line. Pre-fix this shape exceeded 75 s in
  //     one regex call (sweep diag/file/aurora-synth).
  const dense = [];
  for (let i = 0; i < 175; i++) {
    dense.push(`  const v${i} = wrap(a${i}, (b${i}), c${i}, d${i}) + join(x${i}, (y${i}), z${i});`);
    dense.push(`  if (check(p${i}, q${i})) { emit(r${i}, (s${i}), t${i}, u${i}, v${i}); }`);
    dense.push(`  const w${i} = { a: f${i}(1, 2), b: g${i}(3, 4), c: h${i} };`);
    dense.push(`  list.push(item(a${i}, (b${i} + c${i}), d${i}, e${i}));`);
  }
  // real violations the unrolled pattern must still find (7+ and 9+ params)
  dense.push('function needsSevenPlus(a, b, c, d, e, f, g) { return a; }');
  dense.push('function needsNinePlus(a, b, c, d, e, f, g, h, i) { return a; }');
  writeFileSync(join(dir, 'dense-normal-format.js'), dense.join('\n'));

  // (b) the minified shape the incident was first described as: ONE long line of
  //     comma-separated parenthesised groups (refused by MAX_LINE, so it also
  //     proves the line guard and the content guard do not mask each other).
  const mini = 'call(a,(b),c,d,(e),f,g,(h),i,j,(k),l,m,(n),o,p,(q),r,s,(t),u,v);';
  writeFileSync(join(dir, 'minified-line.js'), `const z=${mini.repeat(300)}`);

  // (c) an over-content file: 400KB of many short lines (passes MAX_LINE, trips
  //     the whole-file content guard, which must NAME it rather than hang or lie)
  const big = [];
  for (let i = 0; i < 6000; i++) big.push(`export const big${i} = fn(a, (b), c, d, e, f, g, h, i, j);`);
  writeFileSync(join(dir, 'over-content.ts'), big.join('\n'));

  // (d) one python file, so the THIRD comma rule (`code-long-parameter-list-8`,
  //     path_glob `**/*.py`) actually has a file to open. A rule whose glob
  //     matches nothing never reaches a budget check, so without this the
  //     "every exhausted rule is named" assertion below would silently be a
  //     claim about two rules while reading as one about three.
  writeFileSync(join(dir, 'dense-normal-format.py'), 'def handler(a, b, c, d, e, f, g, h):\n    return a\n');

  const COMMA_RULES = ['code-many-params-10', 'code-too-many-params-9', 'code-long-parameter-list-8'];
  const t0 = Date.now();
  const res = runDetect(dir, { onlyIds: new Set(COMMA_RULES) });
  const wall = Date.now() - t0;
  const foundMany = res.findings.filter((f) => f.rule === 'code-many-params-10').length;
  const foundTooMany = res.findings.filter((f) => f.rule === 'code-too-many-params-9').length;

  // every-rule run over the same tree, to prove the whole path is bounded
  const t1 = Date.now();
  const full = runDetect(dir, { ruleBudgetMs: 10000 });
  const fullWall = Date.now() - t1;

  // An EXHAUSTED per-rule budget must DEGRADE TO A NAMED FAILURE, not to a hang
  // and not to silence. The budget is exactly 0 ms on purpose: the deadline is
  // "now", `budgetExceeded()` compares with `>=` and performance.now() is
  // monotonic, so the first between-step check of every rule that has a file to
  // open is guaranteed to trip. That makes the input exceed the budget BY
  // CONSTRUCTION and the assertion independent of machine speed.
  //
  // Why not a 1 ms budget (the original probe): the budget is consulted BETWEEN
  // steps, so a rule can finish its last — and most expensive — step after its
  // final check and end with nobody having observed the deadline. Measured on
  // the tree below: `code-many-params-10` spends 2.1 ms reading the 400 KB
  // `over-content.ts` AFTER its last check, and with a 1 ms budget it ran 3.5 ms
  // to completion while naming nothing (2 of 10 gate runs went green; the other 8
  // reported a false FAIL). This is a property of between-step budgets, not a
  // regression: the 0 ms budget removes the race instead of widening it.
  const tight = runDetect(dir, { onlyIds: new Set(COMMA_RULES), ruleBudgetMs: 0 });
  const namedRules = new Set(tight.ruleFailures.filter((f) => f.reason === 'budget-exceeded').map((f) => f.rule));
  const notNamed = COMMA_RULES.filter((id) => !namedRules.has(id));
  const capped = full.capHits.length;

  rmSync(dir, { recursive: true, force: true });

  const boundMs = 5000;
  if (wall >= boundMs) {
    console.log(`FAIL torture-whole-file — the comma-counting rules took ${wall}ms over the adversarial tree (bound: ${boundMs}ms) — catastrophic backtracking is back`);
    fail++;
    failures.push('(torture-whole-file)');
  } else if (foundMany < 1 || foundTooMany < 1) {
    console.log(`FAIL torture-whole-file — bounded (${wall}ms) but the unrolled patterns stopped matching real violations (many-params=${foundMany}, too-many-params=${foundTooMany}; both must be >= 1)`);
    fail++;
    failures.push('(torture-whole-file)');
  } else if (notNamed.length > 0) {
    console.log(`FAIL torture-whole-file — an exhausted per-rule budget (0ms) produced no NAMED rule failure for: ${notNamed.join(', ')} (ruleFailures=${JSON.stringify(tight.ruleFailures)})`);
    fail++;
    failures.push('(torture-whole-file)');
  } else if (fullWall >= 15000) {
    console.log(`FAIL torture-whole-file — the full rule set took ${fullWall}ms over the adversarial tree (bound: 15000ms)`);
    fail++;
    failures.push('(torture-whole-file)');
  } else {
    console.log(`PASS torture-whole-file (comma rules: ${wall}ms, many-params=${foundMany}, too-many-params=${foundTooMany}; full rule set: ${fullWall}ms, ${full.scanned} rules, over-content guarded: ${full.coverage.skipped.read_guards.length}; 0ms budget → ${namedRules.size}/${COMMA_RULES.length} rules named budget-exceeded, cap hits: ${capped})`);
    pass++;
  }
}

// ---- the credential-noise policy itself (2026-10-08 calibration 3) ----
// The per-rule fixtures above prove the SPECS; this block proves the POLICY that
// those specs declare. Two properties, both required:
//
//   1. EVERY declared reason is REACHABLE. SECRET_NOISE_REASONS is the policy's
//      contract; a reason no input can produce is dead code pretending to be a
//      safeguard, and a reason that exists but is never exercised is a claim.
//   2. NO reason fires on a realistic credential. The positive values below are
//      the ones the rule fixtures carry; if the policy ever swallows one, this
//      gate fails in the same run as the rule fixture, not three weeks later.
//
// The `value:empty` shape is here rather than in a rule fixture ON PURPOSE: the
// shipped credential regexes already require ≥8/≥16 value characters, so an empty
// assignment cannot reach the matcher today. It is the policy's second line of
// defence for the next spec that forgets the floor, and it is tested where it
// lives.
{
  /** [reason constant, hit that must produce it] */
  const REACHABLE = [
    [SECRET_NOISE_REASONS.PATH, { path: 'macos/Tests/Fixtures/SigningKeys.swift', line: 'const api_key = "AKIAIOSFODNN7EXAMPLE";' }],
    [SECRET_NOISE_REASONS.NOSEC, { path: 'src/config.js', line: 'const API_KEY = "abc123def456ghi789"; // #nosec — fixture' }],
    [SECRET_NOISE_REASONS.ENV_USAGE, { path: 'src/setup.ps1', line: '$password = ConvertTo-SecureString $env:WINDOWS_SIGNING_CERTIFICATE_PASSWORD' }],
    [SECRET_NOISE_REASONS.BARE_IDENTIFIER, { path: 'src/config.js', line: 'const token = legacy_api_token_reference;' }],
    [SECRET_NOISE_REASONS.EMPTY, { path: 'src/config.ts', line: 'OPENAI_API_KEY=', match: 'OPENAI_API_KEY=' }],
    [SECRET_NOISE_REASONS.EQUALS_KEY, { path: 'src/config.js', line: 'const DATABASE_PASSWORD = "DATABASE_PASSWORD";' }],
    [SECRET_NOISE_REASONS.PLACEHOLDER, { path: 'src/config.js', line: 'const apiKey = "your-api-key-here";' }],
  ];
  /** realistic credentials the policy must NOT swallow (mirrors the rule fixtures). */
  const MUST_SURVIVE = [
    'api_key: "aK3x9Lm2Qp7Rs4Tw8Vb1Yz5Nh0Jc6Df",',
    'const DB_PASSWORD = "sup3r-secret-password-123";',
    '      npm_token: "npm_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c"',
    '      OAUTH_TOKEN: "gho_16C7e42F292c4612E7c09d6B7d89f5a4"',
    '  client_secret: "xK9#mQ2$vL7&pR4!",',
    '  oauth_token: "ya29.a0AfH6SMBx1y2z3w4v5u6t7",',
    '        "apiKey": "xoxb-2481-9374-5H8xQ2eZvKYlo2C9mN4bT7rW",',
    '          DATABASE_URL: mysql://ci:ci-pass-123@mysql:3306/testdb',
    "  url: 'redis://default:r4nd0mTok3n@redis.svc.internal:6379/0',",
    "  url: 'postgres://appuser:S3cret!Pass@db.internal.example.com:5432/appdb',",
    '-----BEGIN RSA PRIVATE KEY-----',
    'const LEGACY_CLOUD_SECRET = "AKIA4T7YQ2W9ZP1LMN6R";',
  ];
  const problems = [];
  for (const [reason, hit] of REACHABLE) {
    const got = classifySecretHit(hit);
    if (!got.suppressed || got.reason !== reason) problems.push(`${reason}: expected, got ${JSON.stringify(got)} for ${JSON.stringify(hit.line)}`);
  }
  for (const line of MUST_SURVIVE) {
    const got = classifySecretHit({ path: 'src/config.js', line, match: line });
    if (got.suppressed) problems.push(`a realistic credential was suppressed (${got.reason}): ${line}`);
  }
  // A reason declared in the constant but absent from REACHABLE would never be
  // tested — fail loudly instead of quietly shrinking the contract.
  const declared = new Set(Object.values(SECRET_NOISE_REASONS));
  const exercised = new Set(REACHABLE.map(([r]) => r));
  // DECLARED_SCOPE belongs to the file-presence matcher and is asserted below.
  exercised.add(SECRET_NOISE_REASONS.DECLARED_SCOPE);
  for (const r of declared) if (!exercised.has(r)) problems.push(`declared reason never exercised: ${r}`);

  // DECLARED_SCOPE + the counted path exclusion, end to end through the engine.
  const { mkdtempSync, writeFileSync, rmSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'dktv-envfile-'));
  try {
    writeFileSync(join(dir, '.env'), 'DATABASE_URL=postgres://user:pass@db.internal:5432/app\n');
    writeFileSync(join(dir, '.envrc'), 'export DATABASE_URL=postgres://user:pass@db.internal:5432/app\n');
    mkdirSync(join(dir, 'examples', 'app'), { recursive: true });
    writeFileSync(join(dir, 'examples', 'app', '.env'), 'DATABASE_URL=postgres://user:pass@db.internal:5432/app\n');
    const res = runDetect(dir, { onlyIds: new Set(['security-env-file-committed-3']) });
    const fired = res.findings.filter((f) => f.rule === 'security-env-file-committed-3').map((f) => f.file);
    const sup = res.suppressions.find((s) => s.rule === 'security-env-file-committed-3');
    const scopeDrops = sup?.by_reason?.[SECRET_NOISE_REASONS.DECLARED_SCOPE] ?? 0;
    if (!fired.includes('.env')) problems.push(`the committed .env did not fire (fired: ${JSON.stringify(fired)})`);
    if (fired.includes('.envrc')) problems.push('a committed .envrc was reported (direnv config is not a secret file)');
    if (scopeDrops < 2) problems.push(`the declared-scope exclusion was not counted (.envrc + examples/app/.env expected, got ${scopeDrops})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (problems.length === 0) {
    console.log(`PASS secret-noise-policy (${REACHABLE.length} reason(s) reachable and counted, ${MUST_SURVIVE.length} realistic credential(s) survive, declared-scope exclusion counted end to end)`);
    pass++;
  } else {
    console.log(`FAIL secret-noise-policy — ${problems.length} problem(s)`);
    for (const p of problems) console.log(`  - ${p}`);
    fail++;
    failures.push('(secret-noise-policy)');
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (tool not implemented)`);
process.exit(fail > 0 ? 1 : 0);
