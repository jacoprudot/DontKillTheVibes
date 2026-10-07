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

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (tool not implemented)`);
process.exit(fail > 0 ? 1 : 0);
