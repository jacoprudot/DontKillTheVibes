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
 * Rules whose tools are not implemented in the engine yet are reported as
 * SKIP (with the tool name), never as PASS. Exit 0 = all run fixtures pass,
 * 1 = at least one failure.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDetect } from './engine.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tests', 'fixtures', 'detectors');
const DEGRADED = new Set(['semgrep', 'osv-scanner', 'npm-audit', 'license-scan', 'git-log', 'github-api']);

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

  const probe = runDetect(posDir, { onlyIds: new Set([id]) });
  if (probe.skipped > 0 || probe.degraded.some((d) => DEGRADED.has(d.tool.split(':')[0]))) {
    const tool = probe.degraded[0]?.tool ?? 'unknown';
    console.log(`SKIP ${id} — tool not implemented: ${tool}`);
    skip++;
    continue;
  }

  const pos = probe.findings.filter((f) => f.rule === id).length;
  const neg = runDetect(negDir, { onlyIds: new Set([id]) }).findings.filter((f) => f.rule === id).length;

  if (pos >= 1 && neg === 0) {
    console.log(`PASS ${id} (positive: ${pos} finding(s), negative: 0)`);
    pass++;
  } else {
    console.log(`FAIL ${id} — expected positive>=1, negative=0; got positive=${pos}, negative=${neg}`);
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

  // a tiny budget must DEGRADE TO A NAMED FAILURE, not to a hang and not to silence
  const tight = runDetect(dir, { onlyIds: new Set(COMMA_RULES), ruleBudgetMs: 1 });
  const named = tight.ruleFailures.filter((f) => f.reason === 'budget-exceeded').length;
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
  } else if (named < 1) {
    console.log(`FAIL torture-whole-file — a 1ms per-rule budget produced no NAMED rule failure (ruleFailures=${JSON.stringify(tight.ruleFailures)})`);
    fail++;
    failures.push('(torture-whole-file)');
  } else if (fullWall >= 15000) {
    console.log(`FAIL torture-whole-file — the full rule set took ${fullWall}ms over the adversarial tree (bound: 15000ms)`);
    fail++;
    failures.push('(torture-whole-file)');
  } else {
    console.log(`PASS torture-whole-file (comma rules: ${wall}ms, many-params=${foundMany}, too-many-params=${foundTooMany}; full rule set: ${fullWall}ms, ${full.scanned} rules, over-content guarded: ${full.coverage.skipped.read_guards.length}; 1ms budget → ${named} named failure(s), cap hits: ${capped})`);
    pass++;
  }
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (tool not implemented)`);
process.exit(fail > 0 ? 1 : 0);
