#!/usr/bin/env node
/**
 * Per-rule statistics over one sweep's runs/ directory: how many of the 100 repos
 * a rule fired on, how many hits, its declared severity, and whether it dominates
 * the critical/high volume. READ-ONLY.
 *
 *   node benchmark/sweep-100-rule-stats.mjs [--runs <dir>] [--type detector|ausencia] [--top N]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let runsDir = join(REPO_ROOT, 'benchmark', 'sweep-100', 'runs');
let type = 'detector';
let top = 200;
let metric = 'hits';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--runs') runsDir = resolve(argv[++i]);
  else if (argv[i] === '--type') type = argv[++i];
  else if (argv[i] === '--top') top = Number(argv[++i]);
  else if (argv[i] === '--metric') metric = argv[++i];
  else { console.error(`Unknown option: ${argv[i]}`); process.exit(2); }
}
const names = readdirSync(runsDir).filter((n) => existsSync(join(runsDir, n, 'findings.json'))).sort();
const stats = new Map();
for (const n of names) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(runsDir, n, 'findings.json'), 'utf8')); } catch { continue; }
  for (const f of doc.findings ?? []) {
    if (f.type !== type) continue;
    if (!stats.has(f.rule)) stats.set(f.rule, { rule: f.rule, severity: f.severity, effort: f.effort, hits: 0, repos: new Set(), crit: 0, high: 0 });
    const s = stats.get(f.rule);
    s.hits++;
    s.repos.add(n);
    if (f.severity === 'critical') s.crit++;
    if (f.severity === 'high') s.high++;
  }
}
const rows = [...stats.values()].map((s) => ({ ...s, repos: s.repos.size, critHigh: s.crit + s.high }));
rows.sort((a, b) => (metric === 'repos' ? b.repos - a.repos || b.hits - a.hits : b.hits - a.hits));
console.log(`type=${type} · repos with dump: ${names.length} · distinct rules fired: ${rows.length}`);
console.log('| rule | sev | effort | hits | repos/100 | critical | high | crit+high |');
console.log('|---|---|---|---:|---:|---:|---:|---:|');
for (const r of rows.slice(0, top)) {
  console.log(`| ${r.rule} | ${r.severity} | ${r.effort} | ${r.hits} | ${r.repos} | ${r.crit} | ${r.high} | ${r.critHigh} |`);
}
const totalCH = rows.reduce((a, r) => a + r.critHigh, 0);
const top5 = rows.slice().sort((a, b) => b.critHigh - a.critHigh).slice(0, 5);
console.log(`\ntotal critical+high (${type}): ${totalCH}`);
console.log(`top 5 by crit+high: ${top5.map((r) => `${r.rule} ${r.critHigh} (${Math.round(r.critHigh / totalCH * 100)}%)`).join(' · ')}`);
console.log(`top 5 share: ${Math.round(top5.reduce((a, r) => a + r.critHigh, 0) / totalCH * 100)}%`);
