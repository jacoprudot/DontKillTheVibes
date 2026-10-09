#!/usr/bin/env node
/**
 * snapshot-sweep.mjs — freeze the numbers a ruleset change is measured against.
 *
 *   node benchmark/snapshot-sweep.mjs --out <file.json> [--runs <dir>] [--fingerprint <id>]
 *
 * WHY: the 2026-10-08 calibration was decided from a per-area table that existed
 * ONLY in the owner's head, and the sweep that produced it is overwritten by the
 * next run. A before/after comparison whose "before" cannot be re-derived is an
 * assertion. This writes the before-numbers into a small committed JSON, so the
 * next reader can recompute the delta instead of trusting it.
 *
 * READ-ONLY over `runs/`. Dependency-free.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let runsDir = join(REPO_ROOT, 'benchmark', 'sweep-100', 'runs');
let sweepJson = join(REPO_ROOT, 'benchmark', 'sweep-100', 'SWEEP-100.json');
let out = null;
let fingerprint = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--runs') runsDir = resolve(argv[++i]);
  else if (argv[i] === '--sweep-json') sweepJson = resolve(argv[++i]);
  else if (argv[i] === '--out') out = resolve(argv[++i]);
  else if (argv[i] === '--fingerprint') fingerprint = argv[++i];
  else { console.error(`Unknown option: ${argv[i]}`); process.exit(2); }
}
if (!out) { console.error('usage: node benchmark/snapshot-sweep.mjs --out <file.json> [--fingerprint <id>] [--runs <dir>]'); process.exit(2); }

const AREAS = ['code', 'flows', 'database', 'performance', 'cost', 'security', 'github', 'structure'];
const SECRET_RULES = new Set([
  'security-secret-in-code-1', 'security-secret-in-history-2', 'security-oauth-secret-8',
  'security-gha-secret-leak-3', 'security-db-conn-string-6',
]);
/** The wider credential family, for the suppression ledger. */
const WIDER_CREDENTIAL_RULES = new Set([
  ...SECRET_RULES,
  'security-private-key-7',
  'security-env-file-committed-3',
  'code-logs-secrets-10',
  'flows-n8n-hardcoded-secrets-7',
]);
const CREDENTIAL_RULES = WIDER_CREDENTIAL_RULES;

const names = readdirSync(runsDir).filter((n) => existsSync(join(runsDir, n, 'findings.json'))).sort();
const areas = Object.fromEntries(AREAS.map((a) => [a, { detector: 0, detector_repos: 0, ausencia: 0, ausencia_repos: 0, critical: 0, high: 0 }]));
const areaRepos = Object.fromEntries(AREAS.map((a) => [a, { det: new Set(), gap: new Set() }]));
const perRule = new Map();
const suppressions = new Map();
let totalDet = 0; let totalGaps = 0; let totalCrit = 0; let totalHigh = 0;
let ausenciaGraded = 0; let detectorGradedFalse = 0;
let secretTotal = 0;
let widerTotal = 0;
const secretByRule = new Map();

for (const name of names) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(runsDir, name, 'findings.json'), 'utf8')); } catch { continue; }
  for (const f of doc.findings ?? []) {
    const area = f.module ?? String(f.rule ?? '').split('-')[0];
    const row = areas[area];
    if (!row) continue;
    perRule.set(f.rule, perRule.get(f.rule) ?? { rule: f.rule, type: f.type, severity: f.severity, hits: 0, repos: new Set(), critical: 0, high: 0 });
    const pr = perRule.get(f.rule);
    pr.hits++; pr.repos.add(name);
    if (f.type === 'ausencia') {
      row.ausencia++; areaRepos[area].gap.add(name); totalGaps++;
      if (f.severity !== null && f.severity !== undefined) ausenciaGraded++;
      continue;
    }
    if (f.type !== 'detector') continue;
    if (f.graded === false) detectorGradedFalse++;
    row.detector++; areaRepos[area].det.add(name); totalDet++;
    if (f.severity === 'critical') { row.critical++; pr.critical++; totalCrit++; }
    if (f.severity === 'high') { row.high++; pr.high++; totalHigh++; }
    if (WIDER_CREDENTIAL_RULES.has(f.rule)) widerTotal++;
    if (SECRET_RULES.has(f.rule)) {
      secretTotal++;
      secretByRule.set(f.rule, (secretByRule.get(f.rule) ?? 0) + 1);
    }
  }
  for (const s of doc.suppressions ?? []) {
    if (!CREDENTIAL_RULES.has(s.rule)) continue;
    const cur = suppressions.get(s.rule) ?? { rule: s.rule, dropped: 0, reported: 0, by_reason: {} };
    cur.dropped += s.dropped ?? 0;
    cur.reported += s.reported ?? 0;
    for (const [r, n] of Object.entries(s.by_reason ?? {})) cur.by_reason[r] = (cur.by_reason[r] ?? 0) + n;
    suppressions.set(s.rule, cur);
  }
}

for (const a of AREAS) {
  areas[a].detector_repos = areaRepos[a].det.size;
  areas[a].ausencia_repos = areaRepos[a].gap.size;
}

let sweep = null;
try { sweep = JSON.parse(readFileSync(sweepJson, 'utf8')); } catch { /* optional */ }

const snapshot = {
  generated_by: 'dktv-snapshot-sweep',
  frozen_at: new Date().toISOString(),
  ruleset_fingerprint: fingerprint,
  runs_dir: runsDir.replace(`${REPO_ROOT}\\`, '').split('\\').join('/'),
  repos_with_dump: names.length,
  areas,
  totals: {
    detector: totalDet, ausencia: totalGaps, critical: totalCrit, high: totalHigh,
    critical_high: totalCrit + totalHigh,
    // grading checks: both MUST be 0 after the 2026-10-08 calibration
    ausencia_findings_carrying_a_severity: ausenciaGraded,
    detector_findings_marked_ungraded: detectorGradedFalse,
  },
  headline: sweep ? {
    repos_with_crit_high_and_real_remediation: sweep.summary?.repos_with_crit_high_and_real_remediation ?? null,
    repos_with_crit_high_and_real_remediation_names: sweep.summary?.repos_with_crit_high_and_real_remediation_names ?? null,
    no_remediation_sentinel_total: sweep.summary?.no_remediation_sentinel_total ?? null,
    timed_out: sweep.summary?.counts?.timed_out ?? null,
    failed: sweep.summary?.counts?.failed ?? null,
  } : null,
  secret_credential_rules: {
    set: [...SECRET_RULES].sort(),
    total_hits: secretTotal,
    by_rule: Object.fromEntries([...secretByRule].sort()),
  },
  wider_credential_family_total: widerTotal,
  suppressions_by_rule: [...suppressions.values()].sort((a, b) => b.dropped - a.dropped || a.rule.localeCompare(b.rule)),
  per_rule: [...perRule.values()]
    .map((r) => ({ rule: r.rule, type: r.type, severity: r.severity, hits: r.hits, repos: r.repos.size, critical: r.critical, high: r.high, critical_high: r.critical + r.high }))
    .sort((a, b) => b.critical_high - a.critical_high || b.hits - a.hits || a.rule.localeCompare(b.rule)),
};

writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`snapshot written: ${out.replace(`${REPO_ROOT}\\`, '').split('\\').join('/')}`);
console.log(`  repos: ${names.length} · detector ${totalDet} · ausencia ${totalGaps} · critical ${totalCrit} · high ${totalHigh}`);
console.log(`  ausencia findings carrying a severity: ${ausenciaGraded} (must be 0) · detector findings marked ungraded: ${detectorGradedFalse} (must be 0)`);
console.log(`  credential-family hits: ${secretTotal} · suppression ledger rows: ${suppressions.size}`);
