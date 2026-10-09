#!/usr/bin/env node
/**
 * sweep-100-by-area.mjs — per-AREA aggregation of one sweep's runs/ directory,
 * plus the secret/credential triage the 2026-10-08 calibration was written from.
 *
 *   node benchmark/sweep-100-by-area.mjs [--runs <dir>] [--json]
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * benchmark/sweep-100.mjs aggregates PER REPO and per AREA VERDICT, but the
 * calibration decision was made from a table that does not exist anywhere in the
 * repository: detector findings / repos, ausencia gaps / repos, critical, high,
 * per AREA, summed over the 100 runs. The owner produced it by hand. A number
 * that decided a ruleset change must be reproducible by the next reader, or the
 * "before → after" comparison is an assertion about a number nobody can re-derive.
 *
 * It also reproduces the secret triage (test/fixture path · placeholder value ·
 * value == key name · candidate) from the SAME findings.json dumps, so the 83%
 * false-positive claim has a classifier, not just a memory of one.
 *
 * READS ONLY. It never scans a repository and never writes anything: it reads
 * `runs/<name>/findings.json` and prints. A repo whose dump is missing is NAMED,
 * never folded in as zero.
 *
 * Dependency-free: node builtins only, ESM.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let runsDir = join(REPO_ROOT, 'benchmark', 'sweep-100', 'runs');
let asJson = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--runs') runsDir = resolve(argv[++i]);
  else if (argv[i] === '--json') asJson = true;
  else if (argv[i] === '--help' || argv[i] === '-h') {
    console.log('usage: node benchmark/sweep-100-by-area.mjs [--runs <dir>] [--json]');
    process.exit(0);
  } else { console.error(`Unknown option: ${argv[i]}`); process.exit(2); }
}

const AREAS = ['code', 'flows', 'database', 'performance', 'cost', 'security', 'github', 'structure'];

/* ------------------------------------------------------------- triage ----- */

/** Path classes that make a secret hit a non-secret. Ordered; first match wins. */
const PATH_CLASSES = [
  // test / fixture / example / sample / mock / docs — the class the brief excluded
  [/(^|\/)(tests?|__tests__|__mocks__|mocks?|fixtures?|__fixtures__|spec|specs|e2e|testdata|test-data|test_data|samples?|examples?|demos?|docs?|documentation)(\/|$)/i, 'test/fixture/example'],
  [/\.(test|spec|e2e|example|sample|mock)\.[^./]+$/i, 'test/fixture/example'],
  [/(^|\/)(test_[^/]*|[^/]*_test)\.(py|go|rb|rs|java|cs|php|kt|swift|dart)$/i, 'test/fixture/example'],
  [/(^|\/)[^/]*(Tests?|Fixtures?|Specs?|Examples?|Samples?)[^/]*\//, 'test/fixture/example'],
];

/**
 * Values that are placeholders, not credentials. Three tests, because a single
 * case-insensitive alternation would also swallow a legitimate mixed-case
 * value: the WORD list is case-insensitive, the SHAPE list is not, and
 * "an ALL-CAPS identifier" is its own uppercase-only check.
 */
const PLACEHOLDER_WORD_RE = new RegExp(
  `^(?:${[
    'null', 'none', 'nil', 'undefined', 'true', 'false', 'empty', 'redacted',
    'removed', 'not[-_]?set', 'changeme', 'change[-_]?me', 'password', 'passwd',
    'secret', 'token', 'apikey', 'api[-_]key', 'todo', 'fixme', 'n/a', 'na',
    'foo', 'bar', 'baz', 'foobar', 'hunter2', 'letmein', 'admin', 'root',
    '123456', 'abc123', 'test123', 'dummy', 'sample', 'example', 'placeholder',
    'your[-_]?(?:api|secret|access|private|client)[-_]?(?:key|token|secret|id)?',
  ].join('|')})$`,
  'i',
);
const PLACEHOLDER_SHAPE_RE = /^(?:x{3,}|\*{3,}|\.{3,}|_{3,}|-{3,}|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|%[A-Z_]+%|[?]+)$/;
const ALLCAPS_VALUE_RE = /^["']?\$?\{?[A-Z][A-Z0-9_]{2,}\}?["']?$/;

/**
 * The VALUE half of a `key = value` / `key: value` line, or null when the line
 * does not have that shape (a bare PEM header, an .env path hit, …).
 */
export function extractValue(evidence) {
  const m = /^[^:=]{0,80}[:=]\s*(.+)$/.exec(String(evidence ?? '').trim());
  if (!m) return null;
  let v = m[1].trim();
  v = v.replace(/[,;]\s*(\/\/|#).*$/, '').replace(/\s+(\/\/|#).*$/, '').trim();
  const q = /^(["'])(.*)\1$/.exec(v);
  if (q) v = q[2];
  return v;
}

/** The KEY half, lowercased with separators stripped, or null. */
export function extractKey(evidence) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_.\-[\]]{0,80})\s*[:=]/.exec(String(evidence ?? '').trim());
  return m ? m[1].toLowerCase().replace(/[-_.]/g, '') : null;
}

/**
 * Classify ONE secret-rule finding. Order matters and is the whole point of the
 * exercise: a hit in a test file is a test hit even when its value also looks
 * like a placeholder, and `env-usage` is checked before `placeholder` because
 * `process.env.OPENAI_API_KEY` is the REMEDIATION, not the leak.
 */
export function classifySecret(f) {
  const file = String(f.file ?? '');
  const ev = String(f.evidence ?? '');
  for (const [re, cls] of PATH_CLASSES) if (re.test(file)) return { cls, why: 'path' };
  if (/(?:\$env:|process\.env|os\.environ|getenv\(|ENV\[|System\.getenv|\{\{\s*\$credentials|secrets\.)/i.test(ev)) {
    return { cls: 'env-var usage', why: 'usage' };
  }
  if (/\bnosec\b|#nosec|NOSONAR|gitleaks:allow|pragma: allowlist secret/i.test(ev)) return { cls: 'nosec-annotated', why: 'nosec' };
  const value = extractValue(ev);
  const key = extractKey(ev);
  if (value !== null) {
    const bare = value.trim().replace(/^["']|["']$/g, '');
    if (bare === '') return { cls: 'empty value', why: 'empty' };
    if (PLACEHOLDER_WORD_RE.test(bare) || PLACEHOLDER_SHAPE_RE.test(bare) || ALLCAPS_VALUE_RE.test(bare)) {
      return { cls: 'placeholder', why: 'placeholder' };
    }
    if (key && bare.toLowerCase().replace(/[-_.]/g, '') === key) return { cls: 'value == key name', why: 'value==key' };
    if (bare.length < 12) return { cls: 'placeholder', why: 'short-value' };
  }
  return { cls: 'candidate', why: 'none' };
}

const SECRET_RULES = new Set([
  'security-secret-in-code-1',
  'security-secret-in-history-2',
  'security-oauth-secret-8',
  'security-gha-secret-leak-3',
  'security-db-conn-string-6',
]);
/**
 * The wider credential family, reported separately so the two never blur. These
 * four ids are NOT in the 634: `private-key-7` 11, `code-logs-secrets-10` 68,
 * `flows-n8n-hardcoded-secrets-7` 213, `env-file-committed-3` 6 hits on the
 * 2026-10-08 sweep — adding them moves the total to 932.
 */
const WIDER_CREDENTIAL_RULES = new Set([
  ...SECRET_RULES,
  'security-private-key-7',
  'security-logs-contain-secrets-12',
  'code-logs-secrets-10',
  'security-env-file-committed-3',
  'flows-n8n-hardcoded-secrets-7',
]);

/* ----------------------------------------------------------- aggregate ---- */

if (!existsSync(runsDir)) {
  console.error(`runs directory not found: ${runsDir}`);
  process.exit(2);
}
const names = readdirSync(runsDir).filter((n) => existsSync(join(runsDir, n, 'findings.json'))).sort();
const missing = readdirSync(runsDir).filter((n) => !existsSync(join(runsDir, n, 'findings.json'))).sort();

const blank = () => Object.fromEntries(AREAS.map((a) => [a, { det: 0, crit: 0, high: 0, gaps: 0, det_repos: new Set(), gap_repos: new Set() }]));
const areas = blank();
let totalDet = 0; let totalGaps = 0; let totalCrit = 0; let totalHigh = 0;

const triage = new Map();          // cls -> count
const triageByRule = new Map();    // rule -> Map(cls -> count)
let secretTotal = 0;
const secretRulesSeen = new Set();
const secretExamples = new Map();  // rule -> candidate examples
let widerTotal = 0;
const suppressionLedger = new Map();   // rule -> {dropped, reported, by_reason}
let suppressionRows = 0;

for (const name of names) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(runsDir, name, 'findings.json'), 'utf8')); } catch { continue; }
  // The tool's OWN decision ledger: exact, per rule and per reason, including the
  // history scan whose evidence is redacted and therefore un-classifiable offline.
  for (const s of Array.isArray(doc.suppressions) ? doc.suppressions : []) {
    if (!WIDER_CREDENTIAL_RULES.has(s.rule)) continue;
    suppressionRows++;
    const cur = suppressionLedger.get(s.rule) ?? { rule: s.rule, dropped: 0, reported: 0, by_reason: {} };
    cur.dropped += s.dropped ?? 0;
    cur.reported += s.reported ?? 0;
    for (const [r, n] of Object.entries(s.by_reason ?? {})) cur.by_reason[r] = (cur.by_reason[r] ?? 0) + n;
    suppressionLedger.set(s.rule, cur);
  }
  const findings = Array.isArray(doc.findings) ? doc.findings : [];
  for (const f of findings) {
    const area = f.module ?? String(f.rule ?? '').split('-')[0];
    const row = areas[area];
    if (!row) continue;
    if (f.type === 'ausencia') { row.gaps++; row.gap_repos.add(name); totalGaps++; continue; }
    if (f.type !== 'detector') continue;
    row.det++; row.det_repos.add(name); totalDet++;
    if (f.severity === 'critical') { row.crit++; totalCrit++; }
    if (f.severity === 'high') { row.high++; totalHigh++; }

    if (WIDER_CREDENTIAL_RULES.has(f.rule)) widerTotal++;
    if (SECRET_RULES.has(f.rule)) {
      secretTotal++;
      secretRulesSeen.add(f.rule);
      const { cls } = classifySecret(f);
      triage.set(cls, (triage.get(cls) ?? 0) + 1);
      if (!triageByRule.has(f.rule)) triageByRule.set(f.rule, new Map());
      const m = triageByRule.get(f.rule);
      m.set(cls, (m.get(cls) ?? 0) + 1);
      if (cls === 'candidate') {
        if (!secretExamples.has(f.rule)) secretExamples.set(f.rule, []);
        const list = secretExamples.get(f.rule);
        if (list.length < 12) list.push(`${name} · ${f.file}:${f.line ?? '?'} · ${String(f.evidence).slice(0, 110)}`);
      }
    }
  }
}

const out = {
  runs_dir: runsDir.replace(`${REPO_ROOT}\\`, '').split('\\').join('/'),
  repos_with_dump: names.length,
  repos_without_dump: missing,
  areas: {},
  totals: { detector: totalDet, ausencia: totalGaps, critical: totalCrit, high: totalHigh, critical_high: totalCrit + totalHigh },
  secret_triage: { rules_counted: [...secretRulesSeen].sort(), total: secretTotal, classes: Object.fromEntries([...triage].sort((a, b) => b[1] - a[1])) },
  wider_credential_family_total: widerTotal,
  suppression_ledger: {
    rows: suppressionRows,
    total_dropped: [...suppressionLedger.values()].reduce((a, s) => a + s.dropped, 0),
    by_rule: [...suppressionLedger.values()].sort((a, b) => b.dropped - a.dropped || a.rule.localeCompare(b.rule)),
  },
};
for (const a of AREAS) {
  const r = areas[a];
  out.areas[a] = { detector: r.det, detector_repos: r.det_repos.size, ausencia: r.gaps, ausencia_repos: r.gap_repos.size, critical: r.crit, high: r.high };
}

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`runs: ${runsDir}`);
console.log(`repos with findings.json: ${names.length}${missing.length ? ` · WITHOUT a dump (excluded, named): ${missing.join(', ')}` : ''}`);
console.log('');
console.log('| area | detector findings | repos | ausencia gaps | repos | critical | high |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const a of AREAS) {
  const r = out.areas[a];
  console.log(`| ${a} | ${r.detector} | ${r.detector_repos}/100 | ${r.ausencia} | ${r.ausencia_repos}/100 | ${r.critical} | ${r.high} |`);
}
console.log(`| **total** | **${totalDet}** | | **${totalGaps}** | | **${totalCrit}** | **${totalHigh}** |`);
console.log('');
console.log(`secret/credential triage (rules: ${out.secret_triage.rules_counted.join(', ')})`);
console.log(`  total hits: ${secretTotal}`);
for (const [cls, n] of [...triage].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${String(Math.round((n / secretTotal) * 1000) / 10).padStart(5)}%  ${cls}`);
}
console.log('');
console.log('per rule:');
for (const [rule, m] of [...triageByRule].sort()) {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${rule} — ${total}: ${[...m].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
}
console.log('');
console.log('candidate examples (the hits that SURVIVE the classifier and must be read by hand):');
for (const [rule, list] of secretExamples) {
  console.log(`  ${rule}:`);
  for (const e of list) console.log(`    - ${e}`);
}
console.log('');
console.log(`THE TOOL'S OWN LEDGER — declared exclusions, summed over ${names.length} runs (exact, incl. history hits whose evidence is redacted)`);
if (suppressionRows === 0) {
  console.log('  no suppression rows: no spec declared a noise policy, or none dropped a hit (a pre-2026-10-08 run is this case)');
} else {
  const allReasons = [...new Set(suppressionLedger.values().flatMap((s) => Object.keys(s.by_reason)))].sort();
  console.log(`| rule | dropped | reported | ${allReasons.map((r) => `\`${r}\``).join(' | ')} |`);
  console.log(`|---|---:|---:|${allReasons.map(() => '---:').join('|')}|`);
  for (const s of [...suppressionLedger.values()].sort((a, b) => b.dropped - a.dropped || a.rule.localeCompare(b.rule))) {
    console.log(`| \`${s.rule}\` | ${s.dropped} | ${s.reported} | ${allReasons.map((r) => s.by_reason[r] ?? 0).join(' | ')} |`);
  }
  const byReason = {};
  for (const s of suppressionLedger.values()) for (const [r, n] of Object.entries(s.by_reason)) byReason[r] = (byReason[r] ?? 0) + n;
  console.log(`total dropped: **${Object.values(byReason).reduce((a, b) => a + b, 0)}**`);
  for (const [r, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${r}`);
}
console.log('');
console.log(`wider credential family (10 ids incl. private-key/logs/env-file/n8n) surviving hits: ${widerTotal}`);
