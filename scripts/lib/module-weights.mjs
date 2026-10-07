/**
 * module-weights.mjs — the ONE module-weight table (single source of truth).
 *
 * Extracted from scripts/dktv-orchestrate.mjs (2026-10-07) so the deterministic
 * detector report (scripts/detect/report.mjs) and the multi-agent orchestrator
 * order findings by the SAME weights — two tables would be one chance for the
 * two reports to disagree about priority.
 *
 * The live table is parsed from the "Module Weight" line in
 * agents/synthesis-agent.md; the FALLBACK only exists so runners do not crash
 * on a moved file. Callers must pass the list of module names they know about;
 * modules missing from the parsed table are filled from the fallback with a
 * warning (same behavior the orchestrator had inline).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MODULE_WEIGHT_FALLBACK = {
  security: 1.5, database: 1.3, performance: 1.2, structure: 1.1,
  flows: 1.0, code: 1.0, cost: 0.8, github: 0.7,
};

/**
 * @param {string} root repo root (agents/synthesis-agent.md is read from here)
 * @param {string[]} moduleNames modules the caller knows about
 * @returns {{ weights: Object<string, number>, source: string }}
 */
export function loadModuleWeights(root, moduleNames) {
  const fallback = () => {
    const weights = {};
    for (const mod of moduleNames) weights[mod] = MODULE_WEIGHT_FALLBACK[mod] ?? 1.0;
    console.warn('WARN: module weights unavailable — using fallback table');
    return { weights, source: 'fallback' };
  };

  let text;
  try {
    text = readFileSync(join(root, 'agents', 'synthesis-agent.md'), 'utf8');
  } catch {
    return fallback();
  }
  const m = text.match(/Module Weight[^\n]*\n([^\n]*)/i);
  if (!m) return fallback();
  const weights = {};
  for (const pair of m[1].matchAll(/([a-z]+)\s*:\s*([0-9.]+)/g)) weights[pair[1]] = Number(pair[2]);
  if (!Object.keys(weights).length) return fallback();
  for (const mod of moduleNames) {
    if (!(mod in weights)) {
      console.warn(`WARN: no module weight for "${mod}" in agents/synthesis-agent.md — defaulting to ${MODULE_WEIGHT_FALLBACK[mod]}`);
      weights[mod] = MODULE_WEIGHT_FALLBACK[mod] ?? 1.0;
    }
  }
  return { weights, source: m[1].trim() };
}
