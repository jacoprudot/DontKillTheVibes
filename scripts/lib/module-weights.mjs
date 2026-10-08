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
 *
 * MODULE LABELS (2026-10-08) live here too, for the same reason the weights do:
 * the per-area verdicts in the report need a human-readable name per module, and
 * a second module-keyed table somewhere else is one more chance for two reports
 * to disagree about what the areas are. `loadModuleNames()` derives the label
 * from the LIVE source — the `name:` in the frontmatter of the skill file that
 * defines that module's rule ids — and falls back to the module id itself (never
 * an invented label) with a warning.
 *
 * This file never declares a SECOND module list: callers pass the module names
 * they know about (in the detector report, the rule-id prefixes of
 * skills/detectors.json).
 */
import { readFileSync, readdirSync } from 'node:fs';
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

/** `name:` from the LEADING frontmatter block of a skill file, or null. */
function frontmatterName(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const n = /^name:\s*(.+?)\s*$/m.exec(block ? block[1] : text);
  return n ? n[1] : null;
}

/**
 * Human-readable label per module, from the LIVE source.
 *
 * A module OWNS a skill file when that file's `→ FINDING:` lines carry the
 * module's rule-id prefix (the module list itself is the caller's, derived from
 * skills/detectors.json — this file never adds modules). The label is the
 * frontmatter `name:` of the owning file (`code-quality-assessment` for `code`).
 *
 * A module with no owning file falls back to its own id with a warning: a
 * missing label is a cosmetic problem, an invented one is a provenance problem.
 *
 * @param {string} root repo root (skills/*.skill.md is read from here)
 * @param {string[]} moduleNames modules the caller knows about
 * @returns {{ names: Object<string, string>, source: string }}
 */
export function loadModuleNames(root, moduleNames) {
  const byPrefix = new Map();
  let files = [];
  try {
    files = readdirSync(join(root, 'skills')).filter((n) => n.endsWith('.skill.md')).sort();
  } catch {
    files = []; // unreadable skills dir: same contract as "no live labels"
  }

  for (const file of files) {
    let text;
    try {
      text = readFileSync(join(root, 'skills', file), 'utf8');
    } catch {
      continue;
    }
    // which module does this file define? the prefix its rule ids carry.
    const counts = new Map();
    for (const line of text.split(/\r?\n/)) {
      const m = /→\s*FINDING:\s*([A-Za-z0-9-]+)/.exec(line);
      if (!m) continue;
      const prefix = m[1].split('-')[0];
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    if (counts.size === 0) continue;
    const [prefix] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const label = frontmatterName(text);
    if (label && !byPrefix.has(prefix)) byPrefix.set(prefix, label);
  }

  const names = {};
  for (const mod of moduleNames) {
    if (byPrefix.has(mod)) names[mod] = byPrefix.get(mod);
    else {
      names[mod] = mod;
      console.warn(`WARN: no skill module name for "${mod}" in skills/*.skill.md — using the module id as its label`);
    }
  }
  return { names, source: files.length > 0 ? 'skills/*.skill.md frontmatter' : 'module ids (fallback)' };
}
