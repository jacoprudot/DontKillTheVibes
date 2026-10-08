#!/usr/bin/env node
/**
 * area-verdicts.mjs — one verdict per ASSESSMENT AREA (the skill modules).
 *
 * THE DEFECT THIS FILE EXISTS FOR (2026-10-08). The deterministic report graded
 * the repository and then grouped its output by FILE (findings) and by RULE
 * (checklist gaps). It never said anything per assessment area, so an area that
 * produced zero findings was indistinguishable from an area that was fine.
 * `structure` (architecture) is the live example: 0 findings on the demo repo,
 * 21 of its 29 rules are `juicio` (Fase 3 — no engine exists) and 1 is blocked
 * (semgrep, not implemented in the runner), and the report was silent about all
 * of it. Silence read as health — one storey above the "no rule path-glob
 * matches anything, grade stays A" defect the coverage block already fixed.
 *
 * ONE SOURCE OF TRUTH, by construction:
 *   - the module LIST is the set of rule-id prefixes in skills/detectors.json
 *     (derived at call time; this file declares no module list of its own);
 *   - weights and human labels come from scripts/lib/module-weights.mjs;
 *   - the blocked-tool list is DEGRADED_TOOLS from scripts/detect/engine.mjs —
 *     the exact set the runner skips on (never re-derived here);
 *   - rules the engine refused at RUN TIME for a spec reason (a gitleaks spec
 *     that needs git history, a matcher that does not exist) come from the
 *     engine's own `degraded` record of this run — also never re-derived;
 *   - every rule count is read from skills/detectors.json at call time.
 *
 * STATUS RULE (also printed in the report, so the reader sees the criterion):
 *   `SIN MOTOR`  zero runnable mechanical rules for the area (nothing evaluated)
 *   `PARCIAL`    juicio + fuera >= the runnable mechanical rules
 *   `CUBIERTA`   otherwise
 *
 * NON-NEGOTIABLE: `areaNote()` never lets zero findings read as health. For an
 * area that produced none it states, with counts, which rules RAN and found
 * nothing and which rules were NOT EVALUATED and why (judgment / live data /
 * blocked tool). "0 findings" is a statement about the rules that ran, never
 * about the area.
 *
 * Dependency-free (node builtins only), ESM.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEGRADED_TOOLS } from '../detect/engine.mjs';
import { loadModuleWeights, loadModuleNames } from './module-weights.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The status vocabulary, in one place (the legend and the computation agree). */
export const AREA_STATUS = Object.freeze({
  SIN_MOTOR: 'SIN MOTOR',
  PARCIAL: 'PARCIAL',
  CUBIERTA: 'CUBIERTA',
});

/** The exact shape of one `area_verdicts` row in findings.json. */
export const AREA_VERDICT_FIELDS = Object.freeze([
  'module', 'name', 'status', 'rules_total', 'detector_runnable', 'detector_blocked',
  'ausencia', 'juicio', 'fuera', 'findings', 'critical_high', 'gaps',
]);

/**
 * Per-area verdicts for one run.
 *
 * @param {Array<{module?: string, rule?: string, type?: string, severity?: string|null}>} findings
 *        findings of THIS run (detector AND ausencia; the report passes its
 *        enriched list, the CLI passes the engine's raw list — same fields used)
 * @param {object} [opts]
 * @param {string} [opts.root] repo root (skills/detectors.json lives there)
 * @param {Array<{rule: string|null, reason: string}>} [opts.ruleFailures]
 *        rules that did not complete (budget/error): their area's "ran" drops
 * @param {Array<{rule: string, tool: string, reason?: string}>} [opts.degraded]
 *        the engine's `degraded` record for THIS run: rules it refused to run
 *        (a spec needing git history, an unimplemented matcher, an unknown
 *        tool). Without it a refused rule would be counted as runnable.
 * @param {string|null} [opts.moduleFilter] value of --module, when the caller
 *        restricted the scan: every other area is reported as not scanned
 * @param {boolean} [opts.scanFailed] the engine threw before completing
 * @returns {object[]} one row per module, ordered by module weight (the same
 *          weights the work plan orders by), then by module id
 */
export function computeAreaVerdicts(findings = [], opts = {}) {
  const root = opts.root ?? ROOT;
  const doc = JSON.parse(readFileSync(join(root, 'skills', 'detectors.json'), 'utf8'));
  const runtimeDegraded = new Set((opts.degraded ?? []).map((d) => d?.rule).filter(Boolean));

  const byModule = new Map();
  const rowFor = (mod) => {
    let row = byModule.get(mod);
    if (!row) {
      row = {
        module: mod,
        rules_total: 0,
        detector: 0,
        detector_runnable: 0,
        detector_blocked: 0,
        ausencia: 0,
        ausencia_runnable: 0,
        ausencia_blocked: 0,
        juicio: 0,
        fuera: 0,
        blocked_tools: new Set(),
        blocked_specs: new Set(),
        tool_blocked_count: 0,
        ausencia_blocked_tools: new Set(),
        findings: 0,
        critical_high: 0,
        gaps: 0,
        failed: 0,
      };
      byModule.set(mod, row);
    }
    return row;
  };

  // ---- registry facts: rules per module per type per tool (canonical source)
  for (const [id, entry] of Object.entries(doc)) {
    if (id.startsWith('$')) continue;
    const row = rowFor(id.split('-')[0]);
    row.rules_total++;
    const type = entry?.type;
    if (type === 'detector' || type === 'ausencia') {
      // Two ways a mechanical rule cannot run, both recorded by the ENGINE:
      // its tool is not implemented at all, or this RUN refused the spec
      // (gitleaks history, unimplemented matcher, unknown tool).
      const toolBlocked = DEGRADED_TOOLS.has(entry.tool);
      const blocked = toolBlocked || runtimeDegraded.has(id);
      if (toolBlocked) {
        row.blocked_tools.add(String(entry.tool));
        row.tool_blocked_count++;
      } else if (blocked) row.blocked_specs.add(id);
      if (type === 'detector') {
        row.detector++;
        if (blocked) row.detector_blocked++;
        else row.detector_runnable++;
      } else {
        row.ausencia++;
        if (blocked) {
          row.ausencia_blocked++;
          if (toolBlocked) row.ausencia_blocked_tools.add(String(entry.tool));
        } else row.ausencia_runnable++;
      }
    } else if (type === 'juicio') row.juicio++;
    else if (type === 'fuera') row.fuera++;
  }

  // ---- this run's output, per module (never inferred from another count)
  for (const f of findings) {
    const mod = f?.module ?? String(f?.rule ?? '').split('-')[0];
    const row = byModule.get(mod);
    if (!row) continue; // a finding for an unknown module: never invent an area
    if (f.type === 'ausencia') row.gaps++;
    else if (f.type === 'detector') {
      row.findings++;
      if (f.severity === 'critical' || f.severity === 'high') row.critical_high++;
    }
  }

  // ---- rules that did not complete (their area was NOT fully evaluated) ----
  for (const rf of opts.ruleFailures ?? []) {
    if (!rf?.rule) continue;
    const row = byModule.get(String(rf.rule).split('-')[0]);
    if (row) row.failed++;
  }

  const modules = [...byModule.keys()].sort();
  const { weights } = loadModuleWeights(root, modules);
  const { names } = loadModuleNames(root, modules);

  return modules
    .map((mod) => {
      const row = byModule.get(mod);
      const runnable = row.detector_runnable + row.ausencia_runnable;
      const status = runnable === 0
        ? AREA_STATUS.SIN_MOTOR
        : (row.juicio + row.fuera >= runnable ? AREA_STATUS.PARCIAL : AREA_STATUS.CUBIERTA);
      return {
        ...row,
        name: names[mod] ?? mod,
        status,
        // internal (used by the note/table renderers, not part of the JSON row)
        weight: weights[mod] ?? 1.0,
        runnable_mechanical: runnable,
        blocked_tools: [...row.blocked_tools].sort(),
        blocked_specs: [...row.blocked_specs].sort(),
        ausencia_blocked_tools: [...row.ausencia_blocked_tools].sort(),
      };
    })
    .sort((a, b) => b.weight - a.weight || a.module.localeCompare(b.module));
}

/**
 * One `area_verdicts` row, projected to EXACTLY the documented contract — an
 * internal bookkeeping field (weight, runnable_mechanical, blocked_tools) must
 * not leak into the machine contract by accident.
 */
export function areaVerdictJson(v) {
  const out = {};
  for (const k of AREA_VERDICT_FIELDS) out[k] = v[k];
  return out;
}

/** `1 rule` but `2 rules` — the notes are read by humans. */
function plural(n, one, many) {
  return n === 1 ? one : many;
}

/**
 * The sentence a reader needs for ONE area: what ran, and what did not.
 *
 * Deliberately shared by report.md and the CLI stdout: two wordings for the
 * same verdict would be two chances for the two entry points to disagree.
 */
export function areaNote(v, opts = {}) {
  if (opts.moduleFilter && v.module !== opts.moduleFilter) {
    return `${v.module} — not scanned in this run (--module ${opts.moduleFilter}); the rule counts are registry facts, its findings/gaps do not apply.`;
  }
  if (opts.scanFailed) {
    return `${v.module} — NOT EVALUATED: the scan failed before completing (named in "Rule failures"); nothing in this area was assessed.`;
  }

  const ran = Math.max(0, v.runnable_mechanical - v.failed);
  const blockedTotal = v.detector_blocked + v.ausencia_blocked;
  const notEvaluated = v.juicio + v.fuera + blockedTotal;
  const reasons = [];
  if (v.juicio > 0) reasons.push(`${v.juicio} ${plural(v.juicio, 'needs', 'need')} judgment — Fase 3 has no engine`);
  if (v.fuera > 0) reasons.push(`${v.fuera} ${plural(v.fuera, 'is', 'are')} \`fuera\` — need runtime/live data`);
  if (v.tool_blocked_count > 0) reasons.push(`${v.tool_blocked_count} blocked — tool not implemented: ${v.blocked_tools.join(', ')}`);
  if (v.blocked_specs.length > 0) reasons.push(`${v.blocked_specs.length} blocked — spec this runner refuses: ${v.blocked_specs.join(', ')}`);
  const notEvaluatedDetail = notEvaluated > 0
    ? `${notEvaluated} of ${v.rules_total} rules (${reasons.join(' · ')})`
    : null;

  if (ran === 0) {
    return `${v.module} — NOT EVALUATED: no runnable mechanical rule in this area${notEvaluatedDetail ? ` — ${notEvaluatedDetail}` : ''}. 0 findings here means only that.`;
  }

  let s = `${v.module} — 0 findings across ${ran} ${plural(ran, 'rule', 'rules')} that WERE evaluated`;
  if (v.gaps > 0) s += ` · ${v.gaps} checklist ${plural(v.gaps, 'gap', 'gaps')}`;
  if (v.failed > 0) s += ` · ${v.failed} ${plural(v.failed, 'rule', 'rules')} did not complete (see "Rule failures")`;
  if (notEvaluatedDetail) {
    s += ` · NOT EVALUATED: ${notEvaluatedDetail} — the rest of the area was not assessed, so 0 findings is not a clean bill of health.`;
  } else {
    s += ` — every applicable rule ran; the mechanical layer found nothing.`;
  }
  return s;
}

/**
 * The report.md section. Placed after the health/grade line and BEFORE the
 * coverage section: a reader must learn what was assessed before learning how
 * much of the tree a glob matched.
 */
export function renderAreaSection(verdicts, opts = {}) {
  const lines = [];
  lines.push(`## Areas — what was assessed, and what was not`);
  lines.push('');
  lines.push(`One row per assessment area (the skill modules; the rule-id prefixes of \`skills/detectors.json\`, which is also where every rule count below is read from). \`det. runnable\` = \`detector\` rules the runner executed · \`det. blocked\` = \`detector\` rules the runner could NOT execute (tool not implemented, or a spec this run refused) · \`ausencia\` = checklist rules · \`juicio\` = rules a model must decide (Fase 3 — no engine in this report) · \`fuera\` = declared out of scope · \`findings\`/\`crit+high\`/\`gaps\` = this run's output.`);
  lines.push('');
  lines.push(`**A 0 in the findings column is a statement about the rules that RAN, never about the area.** Status rule: \`SIN MOTOR\` = zero runnable mechanical rules for the area (nothing was evaluated) · \`PARCIAL\` = the rules needing judgment or live data (\`juicio\` + \`fuera\`) are at least as many as the runnable mechanical ones · \`CUBIERTA\` = otherwise.`);
  lines.push('');
  if (opts.moduleFilter) {
    lines.push(`⚠️ This run was restricted with \`--module ${opts.moduleFilter}\`: findings/gaps below exist only for that area; the rule counts are registry facts for every area.`);
    lines.push('');
  }
  lines.push(`| area | status | rules | det. runnable | det. blocked | ausencia | juicio | fuera | findings | crit+high | gaps |`);
  lines.push(`|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const v of verdicts) {
    lines.push(`| \`${v.module}\` (${v.name}) | ${v.status} | ${v.rules_total} | ${v.detector_runnable} | ${v.detector_blocked} | ${v.ausencia} | ${v.juicio} | ${v.fuera} | ${v.findings} | ${v.critical_high} | ${v.gaps} |`);
  }
  lines.push('');

  const unrun = [];
  for (const v of verdicts) {
    const bits = [];
    if (v.ausencia_blocked > 0) bits.push(`${v.ausencia_blocked} \`ausencia\`${v.ausencia_blocked_tools.length > 0 ? ` (missing tool: ${v.ausencia_blocked_tools.join(', ')})` : ''}`);
    if (v.blocked_specs.length > 0) bits.push(`refused spec: ${v.blocked_specs.map((id) => `\`${id}\``).join(', ')}`);
    if (bits.length > 0) unrun.push(`\`${v.module}\` ${bits.join(' · ')}`);
  }
  if (unrun.length > 0) {
    lines.push(`Mechanical rules this run could not execute (named, never silent; the full engine record is under "Coverage vs baseline ruleset"): ${unrun.join(' · ')}.`);
    lines.push('');
  }

  const silent = verdicts.filter((v) => v.findings === 0);
  if (silent.length > 0) {
    lines.push(`Zero-finding areas — a 0 is never a pass. Each line states how many rules RAN and found nothing, and how many were NOT EVALUATED, and why:`);
    lines.push('');
    for (const v of silent) lines.push(`- ${areaNote(v, opts)}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * The same block for stdout (the signal CLI). Uses `areaNote()` verbatim, so
 * `node scripts/detect/run.mjs` and `report.md` cannot drift apart.
 */
export function formatAreaSummary(verdicts, opts = {}) {
  const lines = [];
  lines.push('areas — what was assessed, and what was not:');
  lines.push(`  status rule: SIN MOTOR = zero runnable mechanical rules · PARCIAL = juicio + fuera >= runnable mechanical rules · CUBIERTA = otherwise`);
  if (opts.moduleFilter) lines.push(`  NOTE: --module ${opts.moduleFilter} restricted the scan; other areas show registry counts only`);
  const width = Math.max(8, ...verdicts.map((v) => v.module.length));
  for (const v of verdicts) {
    lines.push(
      `  ${v.module.padEnd(width)}  ${v.status.padEnd(9)} rules ${v.rules_total} · det-runnable ${v.detector_runnable} · det-blocked ${v.detector_blocked} · ausencia ${v.ausencia} · juicio ${v.juicio} · fuera ${v.fuera} · findings ${v.findings} (crit+high ${v.critical_high}) · gaps ${v.gaps}`,
    );
  }
  const silent = verdicts.filter((v) => v.findings === 0);
  if (silent.length > 0) {
    lines.push('  0 findings is not health:');
    for (const v of silent) lines.push(`  ${areaNote(v, opts)}`);
  }
  return lines;
}
