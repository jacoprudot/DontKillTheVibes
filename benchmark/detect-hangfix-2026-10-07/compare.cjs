/**
 * compare.cjs — before/after table for the 2026-10-07 hang/coverage fixes.
 *
 * Run from the repo root:
 *   node benchmark/detect-hangfix-2026-10-07/compare.cjs
 *
 * BEFORE = the frozen pre-fix tree (scripts/ + skills/ copied to a temp dir with
 *          skills/detectors.json restored from 0ee6743), run through the same
 *          bounded harness as AFTER (run-bounded.ps1, hard 180 s cap).
 * AFTER  = the working tree.
 *
 * A drop in detector findings is a regression unless explained; the script
 * prints the delta for every repo and the per-rule delta when one exists.
 */
const fs = require('node:fs');
const path = require('node:path');

const here = __dirname;
const readJsonl = (f) => {
  const p = path.join(here, f);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
};

const rows = new Map();
const put = (side, rec) => {
  if (!rows.has(rec.name)) rows.set(rec.name, { name: rec.name });
  rows.get(rec.name)[side] = rec;
};
for (const f of ['before.jsonl', 'before-extra.jsonl', 'before-hang.jsonl']) for (const r of readJsonl(f)) put('before', r);
for (const f of ['after-regress.jsonl', 'after-hang.jsonl']) for (const r of readJsonl(f)) put('after', r);

const summary = (dir) => {
  const p = path.join(dir, 'findings.json');
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const det = d.findings.filter((f) => f.type === 'detector').length;
  const aus = d.findings.filter((f) => f.type === 'ausencia').length;
  return {
    total: d.findings.length,
    detector: det,
    ausencia: aus,
    grade: d.grade.display,
    capped: (d.cap_truncations || []).length,
    failures: (d.rule_failures || []).length,
    uncovered: d.coverage ? d.coverage.files_not_analysed : null,
    unmatched: d.coverage ? d.coverage.files_matched_by_no_rule_glob : null,
    filesText: d.coverage ? d.coverage.files_text : null,
    rules: {},
  };
};
const ruleCounts = (dir) => {
  const p = path.join(dir, 'findings.json');
  if (!fs.existsSync(p)) return null;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = {};
  for (const f of d.findings) out[f.rule] = (out[f.rule] || 0) + 1;
  return out;
};

console.log('repo | before | after');
console.log('---');
for (const [name, row] of [...rows.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const b = row.before || {};
  const a = row.after || {};
  const bs = b.findings_json_bytes >= 0 && b.findings_json_bytes !== undefined ? `${b.seconds}s/${b.findings_json_bytes}B` : `TIMEOUT@${b.seconds ?? '?'}s/NO ARTIFACTS`;
  const as = a.findings_json_bytes >= 0 && a.findings_json_bytes !== undefined ? `${a.seconds}s/${a.findings_json_bytes}B` : `TIMEOUT@${a.seconds ?? '?'}s/NO ARTIFACTS`;
  const sb = b.findings_json_bytes >= 0 && b.findings_json_bytes !== undefined ? summary(path.join(here, 'before', name)) : null;
  const sa = a.findings_json_bytes >= 0 && a.findings_json_bytes !== undefined ? summary(path.join(here, 'after', name)) : null;
  const fmt = (s) => (s ? `${s.total} (det ${s.detector}/aus ${s.ausencia}) grade ${s.grade} cap ${s.capped} fail ${s.failures} notExamined ${s.uncovered}/${s.filesText} (noGlob ${s.unmatched})` : '—');
  console.log(`${name}`);
  console.log(`  time   before ${bs}   ->   after ${as}`);
  console.log(`  counts before ${fmt(sb)}`);
  console.log(`         after ${fmt(sa)}`);
  if (sb && sa && sb.total !== sa.total) {
    const rb = ruleCounts(path.join(here, 'before', name));
    const ra = ruleCounts(path.join(here, 'after', name));
    const deltas = [];
    for (const k of new Set([...Object.keys(rb), ...Object.keys(ra)])) {
      const x = rb[k] || 0;
      const y = ra[k] || 0;
      if (x !== y) deltas.push(`${k}: ${x}->${y}`);
    }
    console.log(`  PER-RULE DELTA: ${deltas.join(' | ') || '(none: duplicates/order only)'}`);
  }
}
