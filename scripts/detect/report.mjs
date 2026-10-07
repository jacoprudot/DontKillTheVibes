#!/usr/bin/env node
/**
 * report.mjs — PLAN.md Fase 4 + C2: the deterministic report assembler.
 *
 *   node scripts/detect/report.mjs --target <dir> [--module <name>] [--out <dir>]
 *
 * Turns raw engine signals into the deliverable, with ZERO generated prose
 * (PLAN.md: "Sin prosa generada. Si el texto de remediación de una regla no
 * basta, se mejora la regla — no se le pide al modelo"):
 *
 *   findings.json — machine contract (finding + rule + severity/effort +
 *                   remediation + label + score + phase)
 *   report.md     — human artifact: grade, 30/60/90 plan, findings in priority
 *                   order, coverage diff against the baseline ruleset (paso D)
 *   prompts.md    — C2: one paste-ready remediation prompt per finding, same
 *                   order, each citing its rule, destructive actions flagged
 *
 * Labels: every finding here comes from the deterministic engine, so every
 * finding is `probado`. `juzgado` arrives only when a juicio rule is
 * evaluated by an LLM (Fase 3) — until then juicio rules appear in the
 * coverage section as "not evaluated", never as findings.
 *
 * Ordering: severity × module weight. `confidence` does NOT participate: it
 * was removed from the sidecar by the 2026-10-06 audit (a number without a
 * fixture is the invented-severity defect) — PLAN.md's "× confidence" predates
 * that removal and is documented here, not silently applied.
 *
 * Exit: 0 = report written (findings or not), 2 = usage/scan error.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDetect } from './engine.mjs';
import { loadSkillMetadata } from '../lib/skill-metadata.mjs';
import { loadModuleWeights } from '../lib/module-weights.mjs';
import { gradeFromFindings } from '../lib/health-grade.mjs';
import { loadRules } from '../lib/canonical-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Mirrors scripts/dktv-orchestrate.mjs SEVERITY_WEIGHT (the LLM path's scoring).
// Kept numeric-identical on purpose: the same repo must not get two priorities.
const SEVERITY_WEIGHT = { critical: 100, high: 50, medium: 20, low: 5, info: 1 };
const PHASE_OF = { critical: '30_days', high: '30_days', medium: '60_days', low: '90_days', info: '90_days' };
const DESTRUCTIVE_RE = /rotat|revoke|force.?push|rewrite.{0,20}histor|purges? (the )?history|destr/i;

function usage() {
  console.error('usage: node scripts/detect/report.mjs --target <dir> [--module <name>] [--out <dir>]');
  process.exit(2);
}

const args = process.argv.slice(2);
let target = null;
let module = null;
let out = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target') target = args[++i];
  else if (args[i] === '--module') module = args[++i];
  else if (args[i] === '--out') out = args[++i];
  else usage();
}
if (!target) usage();
target = resolve(target);
out = out ? resolve(out) : join(target, '.dontkillthevibes');

const registry = loadRules(join(ROOT, 'skills'));
const meta = loadSkillMetadata(join(ROOT, 'skills'));
const { weights: moduleWeights } = loadModuleWeights(ROOT, [...new Set([...registry.keys()].map((id) => id.split('-')[0]))]);

const { findings: raw, degraded, scanned, skipped, clean, repo } = runDetect(target, { module: module ?? undefined });

// ---- enrich: score, phase, label, remediation, destructive flag ----
const findings = raw.map((f) => {
  const m = meta.get(f.rule) || {};
  const sevWeight = SEVERITY_WEIGHT[f.severity] ?? 0;
  const score = sevWeight * (moduleWeights[f.module] ?? 1.0);
  const remediation = m.remediation ?? '(no remediation text in the rule — improve the rule, not the report)';
  return {
    ...f,
    name: m.name ?? null,
    remediation,
    label: 'probado',
    score,
    phase: PHASE_OF[f.severity] ?? '90_days',
    destructive: DESTRUCTIVE_RE.test(remediation),
  };
});
findings.sort((a, b) => b.score - a.score || a.rule.localeCompare(b.rule) || String(a.file).localeCompare(String(b.file)));

const grade = gradeFromFindings(findings);

// ---- coverage diff against the baseline ruleset (paso D) ----
const detectorsDoc = JSON.parse(readFileSync(join(ROOT, 'skills', 'detectors.json'), 'utf8'));
const firedRules = new Set(findings.map((f) => f.rule));
const counts = {
  registry: registry.size,
  mechanical: Object.values(detectorsDoc).filter((e) => ['detector', 'ausencia'].includes(e?.type)).length,
  fired: firedRules.size,
  clean: clean.length,
  degraded: degraded.length,
  juicioNotEvaluated: Object.values(detectorsDoc).filter((e) => e?.type === 'juicio').length,
  fuera: Object.values(detectorsDoc).filter((e) => e?.type === 'fuera').length,
};

// ---- findings.json ----
mkdirSync(out, { recursive: true });
const document = {
  generated_by: 'dktv-detect-report',
  target,
  generated_at: new Date().toISOString(),
  label_legend: { probado: 'mechanically proven by the deterministic engine', juzgado: 'LLM-judged (none in this report)' },
  grade,
  counts,
  module_weights: moduleWeights,
  findings: findings.map((f) => ({ ...f })),
  degraded,
};
writeFileSync(join(out, 'findings.json'), JSON.stringify(document, null, 2));

// ---- report.md ----
const byPhase = { '30_days': [], '60_days': [], '90_days': [] };
for (const f of findings) (byPhase[f.phase] ?? byPhase['90_days']).push(f);

let md = '';
md += `# DontKillTheVibes — deterministic assessment\n\n`;
md += `- target: \`${target}\`\n`;
md += `- files scanned: ${repo.fileCount} · test/spec/fixture files excluded: ${repo.skippedTestLike.length} · rules run: ${scanned} · skipped (tool not implemented): ${skipped}\n`;
md += `- overall health: **${grade.display}** (worst-severity grade; ${grade.criticalCount} critical)\n`;
md += `- every finding is a raw mechanical signal (label \`probado\`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)\n\n`;

md += `## Work plan (30/60/90)\n\n`;
md += `Bucketing is deterministic: critical+high → 30 days, medium → 60, low/info → 90; order inside a phase is severity × module weight.\n\n`;
for (const [phase, list] of Object.entries(byPhase)) {
  md += `### ${phase.replace('_', ' ')} (${list.length})\n\n`;
  for (const f of list) md += `- **${f.rule}** [${f.severity}, effort ${f.effort}, score ${f.score}] — ${f.file}${f.line !== null ? `:${f.line}` : ''}\n`;
  md += `\n`;
}

// Presentation (2026-10-07 noise pass): critical+high carry the full detail,
// grouped by file; medium/low/info go to a one-line appendix. 695 undifferentiated
// findings is a wall, not a plan — severity is the first filter a human applies.
const MAIN_SEV = new Set(['critical', 'high']);
const main = findings.filter((f) => MAIN_SEV.has(f.severity));
const appendix = findings.filter((f) => !MAIN_SEV.has(f.severity));

md += `## Findings — critical & high (${main.length}), grouped by file\n\n`;
const byFile = new Map();
for (const f of main) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
for (const [file, list] of [...byFile.entries()].sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))) {
  md += `### \`${file}\` (${list.length})\n\n`;
  for (const f of list) {
    md += `- **${f.rule}** [${f.severity}, effort ${f.effort}]${f.line !== null ? ` line ${f.line}` : ''} — ${f.evidence}\n`;
    md += `  Remediation: ${f.remediation}${f.destructive ? ' ⚠️ destructive — confirm first' : ''} — rule: skills/${(meta.get(f.rule) || {}).skillFile ?? '?'}\n`;
  }
  md += `\n`;
}

md += `## Appendix: medium / low / info (${appendix.length})\n\n`;
md += `One line each, priority order. These are signals, not the plan — verify before acting.\n\n`;
let lastRule = null;
for (const f of appendix) {
  if (f.rule !== lastRule) {
    lastRule = f.rule;
    md += `- **${f.rule}** [${f.severity}]\n`;
  }
  md += `  - ${f.file}${f.line !== null ? `:${f.line}` : ''} — ${f.evidence.slice(0, 100)}\n`;
}
md += `\n`;

md += `## Coverage vs baseline ruleset (paso D)\n\n`;
md += `- Canonical registry: ${counts.registry} rules\n`;
md += `- Mechanical (detector/ausencia): ${counts.mechanical} — fired: ${counts.fired} · ran clean: ${counts.clean} · not runnable yet (tool degraded, listed in findings.json): ${counts.degraded}\n`;
md += `- \`juicio\`: ${counts.juicioNotEvaluated} — not evaluated by this engine (Fase 3; would carry label \`juzgado\`)\n`;
md += `- \`fuera\`: ${counts.fuera} — out of scope by design\n\n`;
md += `Degraded tools (named, never silent): ${degraded.map((d) => `${d.rule} (${d.tool})`).join(', ') || 'none'}\n`;

writeFileSync(join(out, 'report.md'), md);

// ---- prompts.md (C2) ----
let pr = '';
pr += `# Remediation prompts (C2) — one per finding, in report order\n\n`;
pr += `Generated deterministically from the rule registry — no LLM wrote these. `;
pr += `Every prompt cites its rule. \`probado\` → direct fix prompt. `;
pr += `Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. `;
pr += `Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).\n\n`;
let rank = 0;
for (const f of main) {
  rank++;
  const loc = `${f.file}${f.line !== null ? `:${f.line}` : ''}`;
  const task = f.type === 'ausencia'
    ? `The repository is MISSING a safeguard required by rule ${f.rule}. Add it.`
    : `Find every occurrence of this issue in the repository and fix it.`;
  const prompt = [
    `You are fixing one finding in the repository at ${target}.`,
    ``,
    `Rule: ${f.rule}${f.name ? ` (${f.name})` : ''} — severity ${f.severity}, effort ${f.effort}.`,
    `Location: ${loc}`,
    `Evidence: ${f.evidence}`,
    `Remediation (from the rule registry, skills/${(meta.get(f.rule) || {}).skillFile ?? '?'}): ${f.remediation}`,
    ``,
    `${task} Follow the remediation exactly. Do not change unrelated code. After fixing, list each file changed and why.`,
    f.destructive ? `WARNING: this remediation involves a DESTRUCTIVE action (credential rotation / history rewrite class). Do NOT execute destructive steps automatically — list them and ask for confirmation first.` : null,
  ].filter(Boolean).join('\n');
  pr += `## ${rank}. ${f.rule} [${f.severity}] — ${loc}\n\n`;
  pr += `Rule cited: ${f.rule} (score ${f.score}, label \`${f.label}\`)\n\n`;
  pr += '```text\n' + prompt + '\n```\n\n';
}
writeFileSync(join(out, 'prompts.md'), pr);

console.log(`report written: ${join(out, 'report.md')}`);
console.log(`prompts written: ${join(out, 'prompts.md')}`);
console.log(`findings written: ${join(out, 'findings.json')}`);
console.log(`grade: ${grade.display} · findings: ${findings.length} across ${firedRules.size} rule(s) · clean: ${clean.length} · degraded: ${degraded.length} · juicio not evaluated: ${counts.juicioNotEvaluated}`);
