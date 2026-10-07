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

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (tool not implemented) of ${ids.length} fixture sets`);
process.exit(fail > 0 ? 1 : 0);
