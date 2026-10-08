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
 * THE LETTER SATURATES, SO THE LETTER IS NOT TOUCHED. The formula is deliberately
 * volume-immune (F = any critical), and in our measured data 8/10 vibe-coded repos
 * score F — a fair grade that shows a reader nothing about the SIZE of the problem.
 * `display` adds that size as a PRESENTATION-ONLY suffix (`F·3` = grade F, three
 * criticals); the letter, `criticalCount` and the formula are unchanged, and the
 * document's `summary.overall_health` stays the letter alone (schema: A–F).
 *
 * Single source of truth: Path A computes it with scripts/dktv-grade.mjs,
 * Path B (dktv-assess.mjs) and Path C (dktv-orchestrate.mjs) stamp it. All
 * three run THIS function, so the same repository can never receive two
 * different letters.
 *
 * COVERAGE CAP (2026-10-07, defect 2 of the sweep). gradeFromFindings answers
 * "how bad is what we FOUND". It cannot answer "is this repo healthy", because
 * it never sees how much of the repo was even eligible to be looked at: the
 * sweep's `cyberpunk-hud` (12 GDScript files, no rule path-glob covering .gd)
 * scored a flat A on zero detector findings, and A there meant "nothing was
 * checked", not "everything is fine". `gradeWithCoverage()` is the ONE place
 * that closes it, with a rule that is stated rather than implied:
 *
 *   When at least MATERIAL_UNCOVERED_RATIO (20%) of a repo's non-binary files
 *   are matched by no rule path-glob of any rule that actually ran, the letter
 *   is CAPPED AT C and displayed with an asterisk (`C*`). A and B assert "no
 *   medium-or-worse problem was FOUND", which is only a meaningful statement
 *   over code that was examined. The cap only ever lowers a grade (F stays F),
 *   is computed from the engine's own coverage block, and is reported next to
 *   the letter — it is not folded into severity.
 *
 * Callers that have no coverage data (Path A/B/C assessments, which are handed
 * findings only) keep calling gradeFromFindings and are untouched.
 */
const RANK = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const LETTER = ['A', 'B', 'C', 'D', 'F']; // index = rank-1; E unused (reserved)

export const MATERIAL_UNCOVERED_RATIO = 0.2;
export const COVERAGE_CAP_LETTER = 'C';

/**
 * @param {Array<{severity?: string}>} findings
 * @returns {{ letter: string, display: string, criticalCount: number, worstSeverity: string|null }}
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
  const letter = worst === 0 ? 'A' : LETTER[worst - 1];
  return {
    letter,
    // Presentation only: never written into summary.overall_health (the validator's
    // enum is A–F), only printed by the CLIs and the markdown report.
    display: criticalCount > 0 ? `${letter}·${criticalCount}` : letter,
    criticalCount,
    worstSeverity: worst === 0 ? null : Object.keys(RANK).find((k) => RANK[k] === worst),
  };
}

/**
 * Coverage-aware grade — the ONLY entry point that may return an asterisked
 * display (`C*`). See the COVERAGE CAP note in the header for the rule.
 *
 * @param {Array<{severity?: string}>} findings detector findings (same input
 *        gradeFromFindings takes; ausencia hits must stay excluded upstream)
 * @param {{files_text?: number, files_not_analysed?: number,
 *          files_matched_by_no_rule_glob?: number}|null} coverage
 *        the engine's coverage block (scripts/detect/engine.mjs)
 * @returns {{letter: string, display: string, criticalCount: number,
 *            worstSeverity: string|null, coverageLimited: boolean,
 *            letterCapped: boolean, coverage: object|null}}
 */
export function gradeWithCoverage(findings, coverage) {
  const base = gradeFromFindings(findings);
  const filesText = Number.isFinite(coverage?.files_text) ? coverage.files_text : 0;
  // `files_not_analysed` (no rule glob + refused by a read guard) is the honest
  // scope number; the glob-only count is the fallback for a caller that hands
  // over a partial coverage object.
  const uncovered = Number.isFinite(coverage?.files_not_analysed)
    ? coverage.files_not_analysed
    : Number.isFinite(coverage?.files_matched_by_no_rule_glob)
      ? coverage.files_matched_by_no_rule_glob
      : 0;
  // `coverageLimited` states a fact about the repo (coverage IS materially
  // incomplete). `letterCapped` states what the formula did about it. The
  // asterisk marks the second only: writing `F*` would suggest an F was
  // softened when it is already worse than the cap.
  const capped = (detail, reason) => {
    const rankOf = (letter) => LETTER.indexOf(letter) + 1; // 1..5
    const cappedRank = Math.max(rankOf(base.letter), rankOf(COVERAGE_CAP_LETTER));
    const letterCapped = cappedRank > rankOf(base.letter);
    const letter = LETTER[cappedRank - 1];
    return {
      ...base,
      letter,
      display: `${letter}${base.criticalCount > 0 ? `·${base.criticalCount}` : ''}${letterCapped ? '*' : ''}`,
      coverageLimited: true,
      letterCapped,
      coverage: { ...detail, uncapped_letter: base.letter, reason },
    };
  };

  // No coverage data at all (the scan itself failed, or the tree holds no
  // readable file): an unknown scope cannot be called healthy.
  if (!coverage || filesText <= 0) {
    return capped(
      {
        files_text: filesText,
        files_not_analysed: uncovered,
        uncovered_ratio: null,
        material_uncovered_ratio: MATERIAL_UNCOVERED_RATIO,
      },
      'coverage could not be computed (the scan failed, or no non-binary file was in scope): an unknown scope is not evidence of health',
    );
  }

  const ratio = uncovered / filesText;
  const detail = {
    files_text: filesText,
    files_not_analysed: uncovered,
    files_matched_by_no_rule_glob: coverage.files_matched_by_no_rule_glob ?? null,
    files_refused_by_read_guards: coverage.files_refused_by_read_guards ?? null,
    uncovered_ratio: Math.round(ratio * 10000) / 10000,
    material_uncovered_ratio: MATERIAL_UNCOVERED_RATIO,
  };
  if (ratio < MATERIAL_UNCOVERED_RATIO) return { ...base, coverageLimited: false, letterCapped: false, coverage: detail };

  return capped(
    detail,
    `${uncovered} of ${filesText} non-binary files were examined by no regex rule — matched by no rule path-glob or refused by a read guard (${Math.round(ratio * 100)}%): A/B would assert health over code no rule examined, so the letter is capped at ${COVERAGE_CAP_LETTER}`,
  );
}
