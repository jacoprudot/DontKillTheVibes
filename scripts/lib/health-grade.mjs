/**
 * health-grade.mjs — the ONE implementation of the overall-health formula.
 *
 * The letter is a function of the WORST severity present, never an average:
 * averaging penalises repositories that report few findings and rewards noise
 * (a repo with 2 criticals and nothing else must not score worse than one
 * with 1 critical plus a pile of trivia). Monotone, volume-immune, gapless:
 *
 *   F = any critical   D = any high (no critical)   C = any medium
 *   B = any low        A = info-only or zero findings
 *
 * E is reserved and unused in v0.1.0 (the validator's enum spans A–F, five
 * severities map to five letters). `critical_count` is reported separately in
 * `summary`, never encoded into the letter.
 *
 * Single source of truth: Path A computes it with scripts/dktv-grade.mjs,
 * Path B (dktv-assess.mjs) and Path C (dktv-orchestrate.mjs) stamp it. All
 * three run THIS function, so the same repository can never receive two
 * different letters.
 */
const RANK = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const LETTER = ['A', 'B', 'C', 'D', 'F']; // index = rank-1; E unused (reserved)

/**
 * @param {Array<{severity?: string}>} findings
 * @returns {{ letter: string, criticalCount: number, worstSeverity: string|null }}
 */
export function gradeFromFindings(findings) {
  let worst = 0;
  let criticalCount = 0;
  for (const f of Array.isArray(findings) ? findings : []) {
    const rank = RANK[f?.severity];
    if (rank === undefined) continue;
    if (rank > worst) worst = rank;
    if (f.severity === 'critical') criticalCount++;
  }
  return {
    letter: worst === 0 ? 'A' : LETTER[worst - 1],
    criticalCount,
    worstSeverity: worst === 0 ? null : Object.keys(RANK).find((k) => RANK[k] === worst),
  };
}
