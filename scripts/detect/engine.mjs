/**
 * engine.mjs — the detector engine: runs skills/detectors.json specs against a
 * target repository and returns normalized findings. Pure local execution:
 * nothing is sent anywhere.
 *
 * Tool coverage, stated honestly (PLAN.md Fase 2 requires the degradation to
 * be visible, not silent):
 *   node-matcher  → MATCHER_IMPL in ./matchers.mjs (all 13 matchers)
 *   yaml-check    → regex presence/absence over files matched by file_glob
 *   gitleaks      → LITE: spec.regex executed in-process over the working tree
 *                   (keyword prefilter honored). History specs (path_regex
 *                   touching .git/) are DEGRADED — no binary, no history scan.
 *   semgrep       → DEGRADED. Windows decision per PLAN.md Fase 2 is option (b):
 *                   no Docker dependency; patterns trivial enough to matter are
 *                   ported to node-matcher specs as fixtures earn them.
 *   osv-scanner, npm-audit → DEGRADED (need network or binaries; not vendored)
 *   license-scan, git-log, github-api → DEGRADED (not implemented yet)
 *
 * FAILURE HONESTY (2026-10-07 sweep, defects 1 and 2). A rule may now end in
 * exactly four named ways, and every one of them reaches the report:
 *   ok / clean        — ran, findings or not
 *   budget-exceeded   — a per-rule STEP BUDGET stopped it; partial findings are
 *                       kept and the rule is named in `ruleFailures`
 *   error             — the matcher threw; the scan continues and the rule is
 *                       named in `ruleFailures`
 *   degraded          — the tool is not implemented (unchanged, already named)
 * Plus `capHits` (a rule stopped at CAP: its count is a FLOOR) and `guardSkips`
 * (files the read guards refused, by name and reason). Coverage — how much of
 * the repo any rule's path-glob even matches — is computed HERE, from the same
 * tree the matchers walk, so there is no second walker and no second truth.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openScanRepo, nameList, MAX_CONTENT, MAX_LINE, READ_CAP } from './scan-repo.mjs';
import { MATCHER_IMPL, CAP, beginRuleContext, endRuleContext } from './matchers.mjs';
import { makeGlobMatcher } from './glob.mjs';
import { loadRules } from '../lib/canonical-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEGRADED_TOOLS = new Set(['semgrep', 'osv-scanner', 'npm-audit', 'license-scan', 'git-log', 'github-api']);

/**
 * Per-rule step budget, in ms. Generous on purpose: it exists to convert an
 * unbounded hang into a NAMED partial failure, not to police slow-but-honest
 * rules (the slowest completing run in the 2026-10-07 sweep spent 109 s over
 * 186 rules). Override with opts.ruleBudgetMs (tests use a tiny value to prove
 * the degradation path).
 */
export const DEFAULT_RULE_BUDGET_MS = 20000;

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function snippet(content, index, len = 120) {
  const start = content.lastIndexOf('\n', index) + 1;
  let end = content.indexOf('\n', index);
  if (end === -1) end = content.length;
  const line = content.slice(start, end).trim();
  return line.length > len ? `${line.slice(0, len)}…` : line;
}

function budgetOver(ctx) {
  if (ctx && !ctx.exceeded && performance.now() > ctx.deadline) ctx.exceeded = true;
  return ctx ? ctx.exceeded : false;
}

function runYamlCheck(repo, spec, ctx) {
  const match = makeGlobMatcher(spec.file_glob);
  // 'm' because workflow patterns use line anchors (`...$`): without it `$`
  // only matches at end of file and a violation mid-file is missed (found by
  // the security-gha-action-unpinned-5 fixture, 2026-10-07).
  const re = new RegExp(spec.pattern, 'm');
  const out = [];
  for (const f of repo.tree.filter((t) => !t.binary && match(t.rel))) {
    if (budgetOver(ctx)) break;
    const r = repo.readRegexText(f.rel);
    if (r === null) continue;
    if (spec.check === 'presence') {
      const g = new RegExp(re.source, 'gm');
      let found;
      while ((found = g.exec(r.content)) !== null) {
        out.push({ file: f.rel, line: lineOf(r.content, found.index), evidence: snippet(r.content, found.index) });
        if (out.length >= CAP) break;
        if (budgetOver(ctx)) break;
        if (found.index === g.lastIndex) g.lastIndex++;
      }
    } else if (spec.check === 'absence' && !re.test(r.content)) {
      out.push({ file: f.rel, line: null, evidence: 'pattern not found in file' });
    }
    if (out.length >= CAP) break;
  }
  return out;
}

function runGitleaksLite(repo, spec, ctx) {
  if (spec.path_regex && new RegExp(spec.path_regex).test('.git/')) {
    return { findings: [], degradedReason: 'spec targets git history; lite runner scans the working tree only (install gitleaks for history)' };
  }
  const re = new RegExp(spec.regex, 'g');
  const keywords = spec.keywords || [];
  const out = [];
  for (const f of repo.tree) {
    if (budgetOver(ctx)) break;
    if (f.binary) continue;
    const r = repo.readRegexText(f.rel);
    if (r === null) continue;
    // case-insensitive prefilter: the regexes are (?i:...) but a case-sensitive
    // skip here would silence them (found by the security-secret-in-code-1 fixture)
    if (keywords.length > 0 && !keywords.some((k) => r.content.toLowerCase().includes(k.toLowerCase()))) continue;
    let m;
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(r.content)) !== null) {
      // LITERAL vs VARIABLE (2026-10-07): `api_key = anthropic_api_key` is a
      // variable reference, not a secret — the dominant FP class in real code.
      // An unquoted bare-identifier RHS is a reference; quoted values, PEM
      // headers and connection strings never take this branch.
      const value = m[0].split(/[:=]/).pop().trim();
      if (!/["']/.test(m[0]) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        if (m.index === g.lastIndex) g.lastIndex++;
        continue;
      }
      out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
      if (out.length >= CAP) break;
      if (budgetOver(ctx)) break;
      if (m.index === g.lastIndex) g.lastIndex++;
    }
    if (out.length >= CAP) break;
  }
  return { findings: out };
}

/**
 * The path-glob(s) a spec applies to, or `null` for "reads the whole tree".
 * ONE place, used by the coverage computation; the matchers read the same
 * param names, so a rule cannot claim coverage of files it never opens.
 */
function pathGlobsFor(entry) {
  const spec = entry.spec || {};
  if (entry.tool === 'node-matcher') {
    const p = spec.params || {};
    if (typeof p.path_glob === 'string') return [p.path_glob];
    if (typeof p.file === 'string') return [p.file];
    return null; // matcher reads repo.tree directly (file-presence/absence)
  }
  if (entry.tool === 'yaml-check') return typeof spec.file_glob === 'string' ? [spec.file_glob] : null;
  return null; // gitleaks-lite: no path filter, it walks the whole tree
}

/** extension key used by the coverage block: lowercased suffix, or '(none)'. */
function extOf(rel) {
  const name = rel.slice(rel.lastIndexOf('/') + 1);
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '(none)';
}

/**
 * A glob that constrains NOTHING (the two-wildcard form, e.g. star-star-slash-star)
 * is not a coverage claim: it matches every file regardless of language, exactly
 * like a whole-tree secret scan. `code-boilerplate-repetition-7` and
 * `github-log-pattern-1` use that glob, and counting it as coverage would have
 * made `cyberpunk-hud`'s 12 GDScript files look "covered" — the very lie this
 * block exists to end. A glob is shape-specific iff it carries at least one
 * alphanumeric literal once wildcards are removed: an extension glob (.gd, .ts),
 * a directory set (entities/models/domain) and a filename (package.json) all
 * qualify; only the bare two-wildcard form is rejected.
 */
export function isCatchAllGlob(glob) {
  return !/[A-Za-z0-9]/.test(String(glob).replace(/[*?]/g, ''));
}

function summarizeRepo(repo) {
  return {
    baseDir: repo.baseDir,
    fileCount: repo.fileCount,
    skippedIgnored: repo.skippedIgnored,
    skippedTestLike: repo.skippedTestLike,
    binaryCount: repo.tree.filter((f) => f.binary).length,
    submodules: repo.submodules,
  };
}

/**
 * Coverage = what the RUNNING rule set can even see. Computed from the same
 * tree the matchers walk (no second walker) over the globs of the rules that
 * actually ran (a degraded tool cannot claim coverage). Whole-tree scanners
 * (gitleaks-lite, file-presence/absence by construction) are reported
 * SEPARATELY: a secret scan touching every file is not language coverage, and
 * pretending otherwise is exactly the "A because nothing was checked" lie.
 */
function computeCoverage(repo, runGlobs, wholeTreeRules) {
  const text = repo.tree.filter((f) => !f.binary);
  const matchers = [...runGlobs].map(makeGlobMatcher);
  const unmatched = [];
  for (const f of text) if (!matchers.some((m) => m(f.rel))) unmatched.push(f.rel);

  // A file no glob matches and a file a read guard refused are equally
  // unexamined by a regex rule, so both belong in the coverage number the grade
  // uses. The reasons are exactly the three that stop content from ever
  // reaching a regex: a minified line, an over-cap content, an over-cap read.
  // (`oversize-content` still reaches complexity-limit/json-field/
  // exact-duplication, so the block reports both components separately instead
  // of pretending they are the same thing.)
  const GUARD_REASONS = new Set(['long-line', 'oversize-content', 'oversize-read-cap']);
  const textRels = new Set(text.map((f) => f.rel));
  const guardRefused = [...new Set(repo.skipLog.filter((s) => GUARD_REASONS.has(s.reason)).map((s) => s.file))].filter((rel) => textRels.has(rel));
  const notAnalysed = new Set([...unmatched, ...guardRefused]);

  const byExt = new Map();
  for (const f of text) {
    const e = extOf(f.rel);
    if (!byExt.has(e)) byExt.set(e, { ext: e, files: 0, uncovered: 0 });
    byExt.get(e).files++;
  }
  for (const rel of notAnalysed) byExt.get(extOf(rel)).uncovered++;

  const binary = repo.tree.filter((f) => f.binary).map((f) => f.rel);
  return {
    files_total: repo.tree.length,
    files_text: text.length,
    files_binary: binary.length,
    files_matched_by_any_rule_glob: text.length - unmatched.length,
    files_matched_by_no_rule_glob: unmatched.length,
    files_refused_by_read_guards: guardRefused.length,
    files_not_analysed: notAnalysed.size,
    // Used by gradeWithCoverage: the share of text files no regex rule examined.
    uncovered_ratio: text.length === 0 ? 0 : Math.round((notAnalysed.size / text.length) * 10000) / 10000,
    uncovered_files: nameList([...notAnalysed]),
    unmatched_files: nameList(unmatched),
    by_extension: [...byExt.values()].sort((a, b) => b.files - a.files || a.ext.localeCompare(b.ext)),
    skipped: {
      gitignored: nameList(repo.skippedIgnored),
      test_like: nameList(repo.skippedTestLike),
      binary: nameList(binary, 100),
      read_guards: repo.skipLog,
    },
    submodules: repo.submodules,
    rules_with_path_glob: runGlobs.size,
    rules_whole_tree: wholeTreeRules,
    read_guard_limits: { max_line: MAX_LINE, max_content: MAX_CONTENT, read_cap: READ_CAP },
  };
}

/**
 * @param {string} targetDir directory to scan
 * @param {object} opts
 * @param {Set<string>} [opts.onlyIds] restrict to these rule ids (fixture runner)
 * @param {string} [opts.module] restrict to one module prefix (e.g. 'security')
 * @param {number} [opts.ruleBudgetMs] per-rule step budget in ms (0 disables)
 * @returns {{findings: object[], degraded: object[], ruleFailures: object[],
 *            capHits: object[], guardSkips: object[], coverage: object,
 *            scanned: number, skipped: number, clean: string[], repo: object,
 *            timings: Array<{rule: string, ms: number}>, skippedLongLineFiles: number}}
 *          `clean` = ids of mechanical rules that RAN and produced zero findings
 *          (the report's coverage/diff section needs evaluated-but-silent rules,
 *          not just the ones that fired). `ruleFailures` names every rule that
 *          timed out or threw; `capHits` names every rule whose count is a floor.
 */
export function runDetect(targetDir, opts = {}) {
  const doc = JSON.parse(readFileSync(join(ROOT, 'skills', 'detectors.json'), 'utf8'));
  const rules = loadRules(join(ROOT, 'skills'));
  const repo = openScanRepo(targetDir);
  const ruleBudgetMs = opts.ruleBudgetMs ?? DEFAULT_RULE_BUDGET_MS;

  const findings = [];
  const degraded = [];
  const ruleFailures = [];
  const capHits = [];
  const clean = [];
  const timings = [];
  const runGlobs = new Set();
  const wholeTreeRules = [];
  let scanned = 0;
  let skipped = 0;
  const sensitiveByRel = new Map(repo.tree.filter((f) => f.sensitive).map((f) => [f.rel, true]));

  for (const [id, entry] of Object.entries(doc)) {
    if (id.startsWith('$')) continue;
    if (!['detector', 'ausencia'].includes(entry.type)) continue;
    if (opts.onlyIds && !opts.onlyIds.has(id)) continue;
    if (opts.module && !id.startsWith(`${opts.module}-`)) continue;

    if (DEGRADED_TOOLS.has(entry.tool)) {
      degraded.push({ tool: entry.tool, rule: id });
      skipped++;
      continue;
    }

    let raw = [];
    const ctx = beginRuleContext(id, ruleBudgetMs);
    const t0 = performance.now();
    let ran = false;
    try {
      if (entry.tool === 'node-matcher') {
        const impl = MATCHER_IMPL[entry.spec.matcher];
        if (!impl) {
          endRuleContext();
          degraded.push({ tool: `node-matcher:${entry.spec.matcher}`, rule: id, reason: 'matcher not implemented' });
          skipped++;
          continue;
        }
        raw = impl(repo, entry.spec.params);
        ran = true;
      } else if (entry.tool === 'yaml-check') {
        raw = runYamlCheck(repo, entry.spec, ctx);
        ran = true;
      } else if (entry.tool === 'gitleaks') {
        const res = runGitleaksLite(repo, entry.spec, ctx);
        raw = res.findings;
        if (res.degradedReason) {
          endRuleContext();
          degraded.push({ tool: 'gitleaks', rule: id, reason: res.degradedReason });
          skipped++;
          continue;
        }
        ran = true;
      } else {
        endRuleContext();
        degraded.push({ tool: String(entry.tool), rule: id, reason: 'unknown tool' });
        skipped++;
        continue;
      }
    } catch (e) {
      // A throwing rule is a NAMED partial failure, never a dead run: the
      // 2026-10-07 sweep lost whole reports because one rule never returned.
      ruleFailures.push({ rule: id, reason: 'error', message: e?.message ?? String(e) });
      ran = true;
      raw = [];
    }
    const finished = endRuleContext();
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    if (ran) scanned++;
    timings.push({ rule: id, ms });

    if (finished && finished.exceeded) {
      ruleFailures.push({
        rule: id,
        reason: 'budget-exceeded',
        budget_ms: ruleBudgetMs,
        elapsed_ms: ms,
        partial_findings: raw.length,
        note: 'partial results kept; the rule stopped early, so its count is a floor',
      });
    }
    if (finished && finished.capHit) {
      capHits.push({ rule: id, cap: CAP, reported: raw.length, note: `stopped at the ${CAP}-findings-per-rule cap: the real count is >= ${raw.length}` });
    }
    // A rule that ran registers its own path scope for the coverage block.
    // Catch-all globs and glob-less rules are recorded as whole-tree: they are
    // not language coverage (see isCatchAllGlob).
    const globs = pathGlobsFor(entry);
    if (globs === null) {
      wholeTreeRules.push({ rule: id, why: 'no path filter: reads every file' });
    } else {
      const specific = globs.filter((g) => !isCatchAllGlob(g));
      if (specific.length === 0) wholeTreeRules.push({ rule: id, why: `catch-all glob ${globs.join(', ')}` });
      for (const g of specific) runGlobs.add(g);
    }

    const fields = rules.get(id) || {};
    if (raw.length === 0) clean.push(id);
    for (const f of raw) {
      findings.push({
        rule: id,
        module: id.split('-')[0],
        type: entry.type,
        tool: entry.tool,
        severity: fields.severity ?? null,
        effort: fields.effort ?? null,
        file: f.file,
        line: f.line,
        evidence: sensitiveByRel.has(f.file) ? '<redacted: sensitive file>' : f.evidence,
      });
    }
  }

  // exact duplicates can be emitted (overlapping windows, repeated evidence
  // lines): one finding per (rule, file, line, evidence), keeping first order
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.line}|${f.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.rule.localeCompare(b.rule) || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0));

  return {
    findings: unique,
    degraded,
    ruleFailures,
    capHits,
    guardSkips: repo.skipLog,
    coverage: computeCoverage(repo, runGlobs, wholeTreeRules),
    scanned,
    skipped,
    clean,
    timings,
    skippedLongLineFiles: repo.skipLog.filter((s) => s.reason === 'long-line').length,
    repo: summarizeRepo(repo),
  };
}
