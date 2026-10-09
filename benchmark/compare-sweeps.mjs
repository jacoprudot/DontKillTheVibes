#!/usr/bin/env node
/**
 * compare-sweeps.mjs — the before/after table for a ruleset calibration.
 *
 *   node benchmark/compare-sweeps.mjs --before <snapshot.json> --after <snapshot.json>
 *
 * Both sides are `benchmark/snapshot-sweep.mjs` output: per-area detector/gap
 * counts, per-rule counts, the headline "repos with a critical/high finding that
 * carries a real remediation", the credential-family totals, and the suppression
 * ledger. Nothing is recomputed here from the raw runs — the two snapshots are the
 * evidence, this only subtracts them, so the delta cannot disagree with either.
 *
 * It also states, per area and per rule, WHICH rule moved and by how much, because
 * "the number went down" is not an explanation and a drop nobody can attribute is
 * a defect (see the brief's own rule: "A drop you cannot explain is a defect").
 *
 * READ-ONLY. Dependency-free.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let beforePath = null;
let afterPath = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--before') beforePath = resolve(argv[++i]);
  else if (argv[i] === '--after') afterPath = resolve(argv[++i]);
  else { console.error(`Unknown option: ${argv[i]}`); process.exit(2); }
}
if (!beforePath || !afterPath) {
  console.error('usage: node benchmark/compare-sweeps.mjs --before <snapshot.json> --after <snapshot.json>');
  process.exit(2);
}
const B = JSON.parse(readFileSync(beforePath, 'utf8'));
const A = JSON.parse(readFileSync(afterPath, 'utf8'));

const AREAS = ['code', 'flows', 'database', 'performance', 'cost', 'security', 'github', 'structure'];
const d = (a, b) => (typeof a === 'number' && typeof b === 'number' ? b - a : null);
const sign = (n) => (n === null ? '—' : n > 0 ? `+${n}` : String(n));

console.log(`before: ${B.ruleset_fingerprint ?? '?'} · ${beforePath.split('\\').pop()}`);
console.log(`after : ${A.ruleset_fingerprint ?? '?'} · ${afterPath.split('\\').pop()}`);
console.log('');
console.log('## Per-area table — before → after');
console.log('');
console.log('| area | detector findings | Δ | repos w/ detector findings | Δ | ausencia gaps | Δ | critical | Δ | high | Δ |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const a of AREAS) {
  const b = B.areas[a] ?? {};
  const x = A.areas[a] ?? {};
  console.log(`| ${a} | ${b.detector} → ${x.detector} | ${sign(d(b.detector, x.detector))} | ${b.detector_repos}/100 → ${x.detector_repos}/100 | ${sign(d(b.detector_repos, x.detector_repos))} | ${b.ausencia} → ${x.ausencia} | ${sign(d(b.ausencia, x.ausencia))} | ${b.critical} → ${x.critical} | ${sign(d(b.critical, x.critical))} | ${b.high} → ${x.high} | ${sign(d(b.high, x.high))} |`);
}
const tb = B.totals; const ta = A.totals;
console.log(`| **total** | **${tb.detector} → ${ta.detector}** | **${sign(d(tb.detector, ta.detector))}** | | | **${tb.ausencia} → ${ta.ausencia}** | **${sign(d(tb.ausencia, ta.ausencia))}** | **${tb.critical} → ${ta.critical}** | **${sign(d(tb.critical, ta.critical))}** | **${tb.high} → ${ta.high}** | **${sign(d(tb.high, ta.high))}** |`);
console.log('');
console.log(`critical + high: **${tb.critical_high} → ${ta.critical_high}** (${sign(d(tb.critical_high, ta.critical_high))})`);
console.log('');

console.log('## Grading checks (both must be 0 after)');
console.log('');
console.log(`- ausencia findings carrying a severity: ${tb.ausencia_findings_carrying_a_severity} → **${ta.ausencia_findings_carrying_a_severity}**`);
console.log(`- detector findings marked ungraded: ${tb.detector_findings_marked_ungraded} → **${ta.detector_findings_marked_ungraded}**`);
console.log('');

console.log('## Headline');
console.log('');
if (B.headline && A.headline) {
  console.log(`- repos with ≥1 critical/high DETECTOR finding WITH a real remediation: **${B.headline.repos_with_crit_high_and_real_remediation}/100 → ${A.headline.repos_with_crit_high_and_real_remediation}/100**`);
  console.log(`- no-remediation sentinel (must be 0): ${B.headline.no_remediation_sentinel_total} → ${A.headline.no_remediation_sentinel_total}`);
  console.log(`- timeouts / failures: ${B.headline.timed_out}/${B.headline.failed} → ${A.headline.timed_out}/${A.headline.failed}`);
}
console.log('');

console.log('## Credential family');
console.log('');
console.log(`- 5-rule triage set (the owner's 634): ${B.secret_credential_rules.total_hits} → **${A.secret_credential_rules.total_hits}**`);
console.log(`  - by rule before: ${Object.entries(B.secret_credential_rules.by_rule).map(([r, n]) => `${r} ${n}`).join(' · ')}`);
console.log(`  - by rule after : ${Object.entries(A.secret_credential_rules.by_rule).map(([r, n]) => `${r} ${n}`).join(' · ')}`);
// The wider credential family is summed from `per_rule` on purpose: a snapshot
// written before that field existed still carries every rule's hits, so the
// comparison works against an older file instead of printing `undefined`.
const WIDER = ['security-secret-in-code-1', 'security-secret-in-history-2', 'security-oauth-secret-8', 'security-gha-secret-leak-3', 'security-db-conn-string-6', 'security-private-key-7', 'security-env-file-committed-3', 'code-logs-secrets-10', 'flows-n8n-hardcoded-secrets-7'];
const familyTotal = (snap) => (snap.per_rule ?? []).filter((r) => WIDER.includes(r.rule)).reduce((a, r) => a + r.hits, 0);
const bFamily = B.wider_credential_family_total ?? familyTotal(B);
const aFamily = A.wider_credential_family_total ?? familyTotal(A);
console.log(`- wider credential family (${WIDER.length} ids) surviving hits: ${bFamily} → ${aFamily} (${sign(aFamily - bFamily)})`);
console.log('');
console.log("## The tool's own suppression ledger (exact, incl. redacted history hits)");
console.log('');
console.log(`- ledger rows (rule × repo): ${B.suppressions_by_rule.reduce((a, s) => a + s.dropped, 0) === 0 ? 0 : B.suppressions_by_rule.length} → ${A.suppressions_by_rule.length}`);
console.log(`- total hits dropped by declared policy: **${B.suppressions_by_rule.reduce((a, s) => a + s.dropped, 0)} → ${A.suppressions_by_rule.reduce((a, s) => a + s.dropped, 0)}**`);
console.log('');
if (A.suppressions_by_rule.length > 0) {
  const reasons = [...new Set(A.suppressions_by_rule.flatMap((s) => Object.keys(s.by_reason)))].sort();
  console.log(`| rule (after) | dropped | reported | ${reasons.map((r) => `\`${r}\``).join(' | ')} |`);
  console.log(`|---|---:|---:|${reasons.map(() => '---:').join('|')}|`);
  for (const s of A.suppressions_by_rule) console.log(`| \`${s.rule}\` | ${s.dropped} | ${s.reported} | ${reasons.map((r) => s.by_reason[r] ?? 0).join(' | ')} |`);
  const byReason = {};
  for (const s of A.suppressions_by_rule) for (const [r, n] of Object.entries(s.by_reason)) byReason[r] = (byReason[r] ?? 0) + n;
  console.log('');
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${r}`);
}
console.log('');

console.log('## Per-rule movements, largest first (this is the explanation, not the delta)');
console.log('');
const byRule = new Map();
for (const r of B.per_rule) byRule.set(r.rule, { rule: r.rule, type: r.type, before: r });
for (const r of A.per_rule) {
  const cur = byRule.get(r.rule) ?? { rule: r.rule, type: r.type, before: null };
  cur.after = r;
  byRule.set(r.rule, cur);
}
const rows = [...byRule.values()].map((r) => ({
  rule: r.rule,
  type: r.after?.type ?? r.before?.type,
  sevBefore: r.before?.severity ?? null,
  sevAfter: r.after?.severity ?? null,
  hitsBefore: r.before?.hits ?? 0,
  hitsAfter: r.after?.hits ?? 0,
  chBefore: r.before?.critical_high ?? 0,
  chAfter: r.after?.critical_high ?? 0,
}));
const moved = rows.filter((r) => r.chBefore !== r.chAfter || r.hitsBefore !== r.hitsAfter || r.sevBefore !== r.sevAfter)
  .sort((a, b) => Math.abs(b.chBefore - b.chAfter) - Math.abs(a.chBefore - a.chAfter) || Math.abs(b.hitsBefore - b.hitsAfter) - Math.abs(a.hitsBefore - a.hitsAfter));
console.log('| rule | type | severity | crit+high | Δ crit+high | hits | Δ hits |');
console.log('|---|---|---|---:|---:|---:|---:|');
for (const r of moved) {
  const sev = r.sevBefore === r.sevAfter ? `\`${r.sevBefore}\`` : `\`${r.sevBefore}\` → \`${r.sevAfter}\``;
  console.log(`| \`${r.rule}\` | ${r.type} | ${sev} | ${r.chBefore} → ${r.chAfter} | ${sign(r.chAfter - r.chBefore)} | ${r.hitsBefore} → ${r.hitsAfter} | ${sign(r.hitsAfter - r.hitsBefore)} |`);
}
console.log('');
console.log(`${moved.length} rule(s) moved in hit count, critical/high volume, or declared severity.`);
