#!/usr/bin/env node
/**
 * dktv-grade.mjs — compute (and optionally stamp) the overall-health letter.
 *
 * Path A runs inside an agent, with no runner to stamp the document. This CLI
 * is how Path A applies the SAME formula the CLI runner and the orchestrator
 * stamp with (scripts/lib/health-grade.mjs) — one function, three consumers,
 * one letter per repository.
 *
 * Usage:
 *   node scripts/dktv-grade.mjs <assessment.json> [--fix]
 *
 * Without --fix: prints the computed letter and whether the document agrees;
 *   exit 1 when they disagree (run with --fix, or correct it manually).
 * With --fix: rewrites summary.overall_health and summary.critical_count in
 *   place, then exits 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gradeFromFindings } from './lib/health-grade.mjs';

const argv = process.argv.slice(2);
const fix = argv.includes('--fix');
const file = argv.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('usage: node scripts/dktv-grade.mjs <assessment.json> [--fix]');
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`cannot read/parse ${file}: ${e.message}`);
  process.exit(2);
}

const grade = gradeFromFindings(doc.findings);
const current = doc.summary?.overall_health;
const detail = `worst=${grade.worstSeverity ?? 'none'} criticals=${grade.criticalCount} findings=${Array.isArray(doc.findings) ? doc.findings.length : 'n/a'}`;

if (current === grade.letter) {
  // `display` (F·3) is presentation only — the document keeps the bare letter, so the
  // agreement check above stays exact. The modifier is what a reader needs to tell
  // "F, one critical" from "F, twenty": in our data 8/10 vibe-coded repos score F.
  console.log(`OK: overall_health "${grade.letter}" matches the formula (display "${grade.display}", ${detail})`);
  process.exit(0);
}

if (!fix) {
  console.log(`MISMATCH: document says "${current ?? '(missing)'}" but the formula computes "${grade.letter}" (display "${grade.display}", ${detail})`);
  console.log(`re-run with --fix to stamp the computed letter`);
  process.exit(1);
}

doc.summary = doc.summary && typeof doc.summary === 'object' ? doc.summary : {};
doc.summary.overall_health = grade.letter;
doc.summary.critical_count = grade.criticalCount;
writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
console.log(`FIXED: stamped overall_health "${grade.letter}", critical_count ${grade.criticalCount} (display "${grade.display}", ${detail})`);
process.exit(0);
