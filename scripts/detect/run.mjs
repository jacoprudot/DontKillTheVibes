#!/usr/bin/env node
/**
 * run.mjs — CLI for the deterministic detector engine (PLAN.md Fase 2).
 *
 *   node scripts/detect/run.mjs --target /path/to/repo [--module security] [--json out.json]
 *
 * Exit codes: 0 = no findings, 1 = findings present, 2 = usage/scan error.
 * Degraded tools (semgrep, osv-scanner, npm-audit, license-scan, git-log,
 * github-api, gitleaks-history) are listed in the summary, never silently
 * skipped. Findings in sensitive-named files carry redacted evidence.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runDetect } from './engine.mjs';

function usage() {
  console.error(`usage: node scripts/detect/run.mjs --target <dir> [--module <name>] [--json <file>]`);
  process.exit(2);
}

const args = process.argv.slice(2);
let target = null;
let module = null;
let jsonOut = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target') target = args[++i];
  else if (args[i] === '--module') module = args[++i];
  else if (args[i] === '--json') jsonOut = args[++i];
  else usage();
}
if (!target) usage();

console.log(`scanning: ${resolve(target)} …`);
let result;
try {
  result = runDetect(resolve(target), { module: module ?? undefined });
} catch (e) {
  console.error(`scan failed: ${e.message}`);
  process.exit(2);
}

const { findings, degraded, scanned, skipped, repo, timings, skippedLongLineFiles } = result;

console.log(`target: ${resolve(target)}`);
console.log(`files scanned: ${repo.fileCount} (gitignored skipped: ${repo.skippedIgnored.length}${repo.skippedTestLike.length ? `; test/spec/fixture files excluded: ${repo.skippedTestLike.length}` : ''}${skippedLongLineFiles ? `; long-line/minified skipped: ${skippedLongLineFiles}` : ''})`);
console.log(`rules run: ${scanned} · skipped (tool not implemented): ${skipped}`);
const slow = timings.filter((t) => t.ms > 500).sort((a, b) => b.ms - a.ms);
if (slow.length > 0) {
  console.log('slowest rules (>500ms):');
  for (const t of slow.slice(0, 10)) console.log(`  ${t.ms}ms  ${t.rule}`);
}
if (degraded.length > 0) {
  console.log('degraded:');
  for (const d of degraded) console.log(`  ${d.rule} — ${d.tool}${d.reason ? ` (${d.reason})` : ''}`);
}
console.log('');

if (findings.length === 0) {
  console.log('no findings');
} else {
  let current = null;
  for (const f of findings) {
    if (f.rule !== current) {
      current = f.rule;
      const sev = f.severity ? ` [${f.severity}]` : '';
      console.log(`${f.rule}${sev} (${f.tool})`);
    }
    const loc = f.line !== null ? `${f.file}:${f.line}` : f.file;
    console.log(`  ${loc}`);
    console.log(`    ${f.evidence}`);
  }
  console.log('');
  console.log(`${findings.length} finding(s) across ${new Set(findings.map((f) => f.rule)).size} rule(s)`);
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ target: resolve(target), generatedBy: 'dktv-detect', findings }, null, 2));
  console.log(`json written: ${jsonOut}`);
}

process.exit(findings.length > 0 ? 1 : 0);
