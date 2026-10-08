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
 *                   remediation + label + score + phase + coverage + failures)
 *   report.md     — human artifact: grade, coverage of what was actually
 *                   scanned, rule failures, truncated counts, 30/60/90 plan,
 *                   findings in priority order, coverage diff vs the baseline
 *                   ruleset (paso D)
 *   prompts.md    — C2: one paste-ready remediation prompt per finding, same
 *                   order, each citing its rule, destructive actions flagged
 *
 * NEVER ZERO ARTIFACTS (2026-10-07 sweep, defect 1). The sweep lost the whole
 * report for 2 of 21 repos because one rule never returned and every write
 * happened at the end. Three things now hold:
 *   1. the engine degrades per rule (step budget / error → named `ruleFailures`,
 *      partial findings kept);
 *   2. this file wraps the scan in try/catch — if the engine itself throws, an
 *      honest report is still written, with the fatal error NAMED in it;
 *   3. the coverage block states what the engine could and could not see, and
 *      `gradeWithCoverage` refuses to show an A/B over materially uncovered
 *      code (see scripts/lib/health-grade.mjs for the exact rule).
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
 * Exit: 0 = report written (findings or not), 2 = usage error OR a fatal scan
 *       error (the report is still written in that case — the exit code says
 *       "read it carefully", it never means "no artifacts").
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDetect } from './engine.mjs';
import { loadSkillMetadata } from '../lib/skill-metadata.mjs';
import { loadModuleWeights } from '../lib/module-weights.mjs';
import { computeAreaVerdicts, areaVerdictJson, renderAreaSection } from '../lib/area-verdicts.mjs';
import { gradeWithCoverage } from '../lib/health-grade.mjs';
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

// ---- the scan: bounded per rule, and never allowed to kill the report ----
const EMPTY_SCAN = {
  findings: [],
  degraded: [],
  ruleFailures: [],
  capHits: [],
  guardSkips: [],
  coverage: null,
  scanned: 0,
  skipped: 0,
  clean: [],
  timings: [],
  skippedLongLineFiles: 0,
  repo: { fileCount: 0, skippedIgnored: [], skippedTestLike: [], binaryCount: 0, submodules: { declared: [], uninitialised: [] } },
};
let fatalError = null;
let scan = null;
try {
  scan = runDetect(target, { module: module ?? undefined });
} catch (e) {
  fatalError = { message: e?.message ?? String(e), stack: e?.stack ?? null };
  console.error(`scan failed: ${fatalError.message} — writing a partial report anyway (a failed run is data, silence is not)`);
}
const { findings: raw, degraded, scanned, skipped, clean, repo, ruleFailures: scanFailures, capHits, guardSkips, coverage } = scan ?? EMPTY_SCAN;
const ruleFailures = [...scanFailures];
if (fatalError) ruleFailures.push({ rule: null, reason: 'fatal-scan-error', message: fatalError.message });

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

// STRUCTURAL SPLIT (2026-10-07): an `ausencia` hit is a missing safeguard —
// a checklist gap, not a violation. It fires by construction in almost any
// repo (a missing timeout is missing everywhere), which is why presenting it
// as a severity-stamped finding produced walls of noise. Detector-type
// findings carry the report; ausencia gets its own short grouped section,
// no displayed severity, no C2 prompt.
const detectorFindings = findings.filter((f) => f.type === 'detector');
const ausenciaFindings = findings.filter((f) => f.type === 'ausencia');

// ---- per-area verdicts (2026-10-08) ----
// The findings above are grouped by FILE and the gaps by RULE: nothing said what
// each ASSESSMENT AREA got. An area with zero findings then read as healthy —
// `structure` on the demo repo produced none while 21 of its 29 rules need a
// judgment engine Fase 3 does not have. This block exists so silence is never
// mistaken for a pass; the counts come from skills/detectors.json and the
// blocked-tool set from the engine (see scripts/lib/area-verdicts.mjs).
const areaOpts = { root: ROOT, ruleFailures, degraded, moduleFilter: module ?? null, scanFailed: Boolean(fatalError) };
const areaVerdicts = computeAreaVerdicts(findings, areaOpts);

// The grade answers "how bad is this repo" — checklist gaps don't move it.
// Coverage does: an A/B over code no rule could match is not a health claim.
const grade = gradeWithCoverage(detectorFindings, coverage);

// ---- coverage diff against the baseline ruleset (paso D) ----
const detectorsDoc = JSON.parse(readFileSync(join(ROOT, 'skills', 'detectors.json'), 'utf8'));
const firedRules = new Set(findings.map((f) => f.rule));
const counts = {
  registry: registry.size,
  mechanical: Object.values(detectorsDoc).filter((e) => ['detector', 'ausencia'].includes(e?.type)).length,
  fired: firedRules.size,
  clean: clean.length,
  degraded: degraded.length,
  failed: ruleFailures.length,
  capped: capHits.length,
  guardSkipped: guardSkips.length,
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
  area_verdicts: areaVerdicts.map(areaVerdictJson),
  findings: findings.map((f) => ({ ...f })),
  degraded,
  rule_failures: ruleFailures,
  cap_truncations: capHits,
  guard_skips: guardSkips,
  coverage,
  fatal_error: fatalError,
};
writeFileSync(join(out, 'findings.json'), JSON.stringify(document, null, 2));

// ---- report.md ----
const byPhase = { '30_days': [], '60_days': [], '90_days': [] };
for (const f of detectorFindings) (byPhase[f.phase] ?? byPhase['90_days']).push(f);

const listNames = (names, max = 10) => {
  const shown = names.slice(0, max).map((n) => `\`${n}\``).join(', ');
  return names.length > max ? `${shown} … +${names.length - max} more` : shown;
};

let md = '';
md += `# DontKillTheVibes — deterministic assessment\n\n`;
md += `- target: \`${target}\`\n`;
md += `- files scanned: ${repo.fileCount} · test/spec/fixture files excluded: ${repo.skippedTestLike.length} · rules run: ${scanned} · skipped (tool not implemented): ${skipped}\n`;
md += `- overall health: **${grade.display}** (worst-severity grade over detector findings; ${grade.criticalCount} critical)\n`;
if (grade.coverageLimited) {
  md += `- ⚠️ **coverage caveat${grade.letterCapped ? ' — grade capped' : ' (letter unaffected: already worse than the cap)'}**: ${grade.coverage.reason} (uncapped letter: ${grade.coverage.uncapped_letter})\n`;
}
if (ruleFailures.length > 0) {
  md += `- ⚠️ **${ruleFailures.length} rule(s) did not complete**: ${ruleFailures.map((f) => f.rule ?? '(engine)').join(', ')} — findings below are PARTIAL, see "Rule failures"\n`;
}
md += `- ${detectorFindings.length} detector finding(s) + ${ausenciaFindings.length} checklist gap(s) — an ausencia hit means a safeguard is MISSING, not that a violation was found\n`;
md += `- every detector finding is a raw mechanical signal (label \`probado\`) — verify by hand (file:line) before acting; precision is NOT yet measured (see protocol in PLAN.md)\n\n`;

// ---- per-area verdicts: what was assessed, and what was not (2026-10-08) ----
// Placed BEFORE coverage on purpose: "how much of the tree could a glob match"
// only means something once the reader knows which areas were evaluated at all.
md += renderAreaSection(areaVerdicts, areaOpts);

// ---- coverage of THIS repository (defect 2, 2026-10-07) ----
md += `## Coverage — what this run could actually see\n\n`;
if (!coverage) {
  md += `**UNAVAILABLE**: the scan failed before coverage was computed (see "Rule failures"). Treat every count below as unknown, not as zero.\n\n`;
} else {
  md += `A tool that audits code must never present partial coverage as complete. This block is the machine-readable \`coverage\` object in \`findings.json\`.\n\n`;
  md += `- non-binary files (scan candidates): **${coverage.files_text}** of ${coverage.files_total} files in the tree (${coverage.files_binary} binary)\n`;
  md += `- matched by ≥1 rule path-glob: ${coverage.files_matched_by_any_rule_glob} · **matched by NO rule path-glob: ${coverage.files_matched_by_no_rule_glob}** (${((coverage.files_matched_by_no_rule_glob / coverage.files_text) * 100).toFixed(1)}%)\n`;
  if (coverage.files_matched_by_no_rule_glob > 0) {
    md += `  - not matched by any rule: ${listNames(coverage.unmatched_files.names)}${coverage.unmatched_files.omitted > 0 ? ` … +${coverage.unmatched_files.omitted} more` : ''}\n`;
  }
  md += `- refused by read guards (content never reached a regex): ${coverage.files_refused_by_read_guards} file(s) — named below\n`;
  md += `- **NOT EXAMINED by any regex rule: ${coverage.files_not_analysed} of ${coverage.files_text} (${(coverage.uncovered_ratio * 100).toFixed(1)}%)** — ${coverage.files_matched_by_no_rule_glob} matched by no rule path-glob + ${coverage.files_refused_by_read_guards} refused by a read guard; this is the number the health grade uses\n`;
  md += `- whole-tree rules (no path filter, or a catch-all glob like \`**/*\`: a secret/boilerplate scan touching every file is NOT language coverage): ${coverage.rules_whole_tree.length > 0 ? coverage.rules_whole_tree.map((r) => `\`${r.rule}\``).join(', ') : 'none'}\n`;
  md += `- extensions seen (files, uncovered by any rule): ${coverage.by_extension.map((e) => `\`${e.ext}\` ${e.files}${e.uncovered > 0 ? ` (${e.uncovered} uncovered)` : ''}`).join(' · ')}\n`;
  const sk = coverage.skipped;
  md += `- skipped by declared policy: gitignored ${sk.gitignored.count} · test/spec/fixture ${sk.test_like.count} · binary ${sk.binary.count}\n`;
  md += `- skipped by read guards (named, never silent): ${sk.read_guards.length}\n`;  for (const g of sk.read_guards.slice(0, 20)) md += `  - \`${g.file}\` — ${g.reason} (${g.detail})\n`;
  if (sk.read_guards.length > 20) md += `  - … +${sk.read_guards.length - 20} more (full list in findings.json \`coverage.skipped.read_guards\`)\n`;
  if (sk.gitignored.count > 0) md += `  - gitignored examples: ${listNames(sk.gitignored.names, 5)}\n`;
  if (sk.test_like.count > 0) md += `  - test/spec/fixture examples: ${listNames(sk.test_like.names, 5)}\n`;
  if (coverage.submodules.declared.length > 0) {
    md += `- submodules declared in .gitmodules: ${coverage.submodules.declared.length} · **NOT checked out: ${coverage.submodules.uninitialised.length}**${coverage.submodules.uninitialised.length > 0 ? ` (${listNames(coverage.submodules.uninitialised, 5)}) — code declared there was NOT scanned` : ''}\n`;
  }
  md += `- read-guard limits in force: whole-file regex content ≤ ${coverage.read_guard_limits.max_content} chars · line ≤ ${coverage.read_guard_limits.max_line} chars · reader cap ${coverage.read_guard_limits.read_cap} bytes\n\n`;
}

// ---- rule failures + truncated counts (never silent) ----
md += `## Rule failures (named, never silent)\n\n`;
if (ruleFailures.length === 0) {
  md += `None: every runnable rule ran to completion (${scanned} run). Degraded tools (not implemented) are listed under the ruleset coverage below.\n\n`;
} else {
  md += `These rules did NOT complete. Findings elsewhere in this report are from the rules that did.\n\n`;
  for (const f of ruleFailures) {
    if (f.reason === 'budget-exceeded') md += `- **${f.rule}** — budget-exceeded after ${f.elapsed_ms}ms (per-rule budget ${f.budget_ms}ms); ${f.partial_findings} partial finding(s) kept — its count is a FLOOR\n`;
    else if (f.reason === 'error') md += `- **${f.rule}** — threw: ${f.message}\n`;
    else md += `- **${f.rule ?? '(engine)'}** — ${f.reason}: ${f.message}\n`;
  }
  md += `\n`;
}

md += `## Truncated counts (floors, not totals)\n\n`;
if (capHits.length === 0) {
  md += `No rule hit the ${20}-findings-per-rule cap, so the counts below are totals.\n\n`;
} else {
  md += `The engine stops collecting at ${20} findings per rule (scripts/detect/matchers.mjs CAP). These rules stopped at the cap, so their real counts are HIGHER than what this report shows:\n\n`;
  for (const c of capHits) md += `- **${c.rule}** — stopped at cap ${c.cap}; reported ${c.reported} (real count ≥ ${c.reported})\n`;
  md += `\n`;
}

md += `## Work plan (30/60/90)\n\n`;
md += `Bucketing is deterministic: critical+high → 30 days, medium → 60, low/info → 90; order inside a phase is severity × module weight.\n\n`;
for (const [phase, list] of Object.entries(byPhase)) {
  md += `### ${phase.replace('_', ' ')} (${list.length})\n\n`;
  for (const f of list) md += `- **${f.rule}** [${f.severity}, effort ${f.effort}, score ${f.score}] — ${f.file}${f.line !== null ? `:${f.line}` : ''}\n`;
  md += `\n`;
}

// Presentation (2026-10-07 noise pass): critical+high carry the full detail,
// grouped by file; medium/low/info go to a one-line appendix.
const MAIN_SEV = new Set(['critical', 'high']);
const main = detectorFindings.filter((f) => MAIN_SEV.has(f.severity));
const appendix = detectorFindings.filter((f) => !MAIN_SEV.has(f.severity));

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

md += `## Checklist gaps — ausencia checks (${ausenciaFindings.length})\n\n`;
md += `These prove a safeguard is MISSING (a timeout, a budget, a monitor). They are not violations and carry no severity: a missing thing is missing in every repo until it isn't. Grouped by rule; fix is "add the safeguard", no per-finding prompt needed.\n\n`;
const gapsByRule = new Map();
for (const f of ausenciaFindings) {
  if (!gapsByRule.has(f.rule)) gapsByRule.set(f.rule, { name: f.name, remediation: f.remediation, files: [] });
  gapsByRule.get(f.rule).files.push(f.file);
}
for (const [rule, gap] of [...gapsByRule.entries()].sort((a, b) => b[1].files.length - a[1].files.length || a[0].localeCompare(b[0]))) {
  md += `### ${rule}${gap.name ? ` (${gap.name})` : ''} — ${gap.files.length} file(s)\n\n`;
  md += `Missing in: ${gap.files.slice(0, 8).map((f) => `\`${f}\``).join(', ')}${gap.files.length > 8 ? ` … +${gap.files.length - 8} more` : ''}\n\n`;
  md += `Add: ${gap.remediation}\n\n`;
}

md += `## Coverage vs baseline ruleset (paso D)\n\n`;
md += `- Canonical registry: ${counts.registry} rules\n`;
md += `- Mechanical (detector/ausencia): ${counts.mechanical} — fired: ${counts.fired} · ran clean: ${counts.clean} · not runnable yet (tool degraded, listed in findings.json): ${counts.degraded} · failed (error/budget): ${counts.failed}\n`;
md += `- Findings per rule are capped at 20: ${counts.capped} rule(s) stopped at the cap (their counts are floors)\n`;
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
if (ruleFailures.length > 0) {
  pr += `⚠️ PARTIAL RUN: ${ruleFailures.length} rule(s) did not complete (${ruleFailures.map((f) => f.rule ?? '(engine)').join(', ')}). `;
  pr += `Prompts below cover the rules that finished only — do not read this file as the complete set of findings.\n\n`;
}
if (grade.coverageLimited) {
  pr += `⚠️ COVERAGE CAVEAT: ${grade.coverage.reason}. ${coverage ? `${coverage.files_matched_by_no_rule_glob} file(s) are matched by no rule path-glob (listed in findings.json \`coverage.uncovered_files\`).` : ''}\n\n`;
}
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
console.log(`grade: ${grade.display} · detector findings: ${detectorFindings.length} (main: ${main.length}) · checklist gaps (ausencia): ${ausenciaFindings.length} · clean: ${clean.length} · degraded: ${degraded.length} · juicio not evaluated: ${counts.juicioNotEvaluated}`);
if (coverage) {
  console.log(`coverage: ${coverage.files_text} non-binary file(s) · matched by ≥1 rule path-glob: ${coverage.files_matched_by_any_rule_glob} · NO rule path-glob: ${coverage.files_matched_by_no_rule_glob} · refused by read guards: ${coverage.files_refused_by_read_guards} · NOT examined by any regex rule: ${coverage.files_not_analysed} (${(coverage.uncovered_ratio * 100).toFixed(1)}%)`);
} else {
  console.log('coverage: UNAVAILABLE (scan failed before it was computed)');
}
console.log(`rule failures: ${ruleFailures.length}${ruleFailures.length > 0 ? ` (${ruleFailures.map((f) => f.rule ?? '(engine)').join(', ')})` : ''} · rules stopped at the ${20}-finding cap: ${capHits.length}${capHits.length > 0 ? ` (${capHits.map((c) => c.rule).join(', ')})` : ''}`);
if (fatalError) {
  console.error(`FATAL: the scan threw before completing (${fatalError.message}). The report above was written from partial data and NAMES the failure.`);
  process.exit(2);
}
