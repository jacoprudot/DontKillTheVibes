/**
 * matchers.mjs — executable implementations of the node-matcher registry
 * declared in scripts/validate-detectors.mjs (MATCHERS). The validator checks
 * that specs are well-formed; THIS module is what actually runs them. Keep the
 * two in sync: a matcher name accepted by the validator must exist here, and
 * vice versa.
 *
 * Every matcher receives (repo, params) where repo is the openScanRepo() handle
 * and returns raw findings: {file, line|null, evidence}. Evidence may contain
 * matched text; the ENGINE redacts it for sensitive-named files — matchers
 * never have to think about the deny-list.
 *
 * Heuristic matchers (complexity-limit non-line-count metrics, cookie-flags,
 * cors-wildcard) say so in their evidence string. Honesty over cleverness: a
 * crude heuristic that declares itself beats a smart one that hides it.
 *
 * WHAT ACTUALLY RUNS WHERE (2026-10-07 fixes):
 *   - File READS go through repo.readText() / repo.readRegexText() (see
 *     scan-repo.mjs). Every refusal is named in the engine's coverage block;
 *     a matcher never learns that a file was skipped without the report
 *     learning it too.
 *   - A per-rule STEP BUDGET (beginRuleContext/endRuleContext, driven by the
 *     engine) is checked between files and between matches. Node cannot
 *     interrupt a single exec(), so the budget cannot save a pattern that
 *     backtracks forever inside one call — that is what unrolling the pattern
 *     (skills/detectors.json) and the whole-file content cap are for. What the
 *     budget does guarantee: a matcher that keeps yielding stops at a NAMED
 *     failure instead of running to the wall clock, and the findings it already
 *     collected are kept.
 *   - CAP (findings per rule per run) is a TRUNCATION, not a total. When a
 *     matcher stops at the cap it says so via markCapHit(); the engine turns
 *     that into a named truncation in findings.json and report.md. Counts were
 *     previously floors masquerading as totals (2026-10-07 sweep, surprise 3).
 */
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { makeGlobMatcher } from './glob.mjs';
import { SKIP_DIRS } from '../lib/repo-files.mjs';

export const CAP = 20; // findings per rule per run, keeps reports bounded on big repos

// ---- per-rule run context (step budget + truncation flag) ----
let ruleCtx = null;

/**
 * Called by the engine before each rule.
 *
 * THREE CASES, and the middle one exists so the degradation path can be tested
 * deterministically instead of by racing the wall clock:
 *   budgetMs > 0   — normal wall-clock budget: deadline = now + budgetMs.
 *   budgetMs === 0 — ALREADY EXHAUSTED, by construction: the deadline is `now`
 *                    and `budgetExceeded()` compares with `>=`, so the FIRST
 *                    between-step check of any rule that has a step to take is
 *                    guaranteed to trip (performance.now() is monotonic
 *                    non-decreasing). No timing assumption, no flake.
 *   budgetMs < 0   — disables the budget entirely (deadline = Infinity).
 * Before 2026-10-08 `0` meant "disabled" and the fixture gate used a 1 ms
 * budget to probe the degradation path; that raced the clock, because a rule
 * can finish its last — and most expensive — step after its final check and
 * end with nobody observing the deadline (measured: 8 of 10 gate runs saw no
 * named failure and reported a false FAIL). Nothing in the repo passed 0 to
 * mean "disabled" (grep: only the gate passes an explicit ruleBudgetMs).
 */
export function beginRuleContext(id, budgetMs) {
  ruleCtx = {
    id,
    budgetMs,
    deadline: budgetMs >= 0 ? performance.now() + budgetMs : Infinity,
    exceeded: false,
    capHit: false,
  };
  return ruleCtx;
}

/** Called by the engine after each rule; returns the context (or null). */
export function endRuleContext() {
  const ctx = ruleCtx;
  ruleCtx = null;
  return ctx;
}

function budgetExceeded() {
  // `>=`, not `>`: with a 0 ms budget the deadline IS the moment the rule
  // began, and a `>` comparison would still depend on the clock having ticked
  // (Windows performance.now() steps in 100 ns units) before the first check.
  // At the deadline-or-later the budget is spent; a one-tick difference is
  // meaningless for the 20 s default.
  if (ruleCtx && !ruleCtx.exceeded && performance.now() >= ruleCtx.deadline) ruleCtx.exceeded = true;
  return ruleCtx ? ruleCtx.exceeded : false;
}

/**
 * Records that this rule stopped early because of a CAP (never silent).
 *
 * Two shapes, one mechanism. No arguments = the original per-rule findings cap
 * (`CAP`, declared by the engine). With arguments = a cap the matcher itself
 * owns, named in the label: the history matcher passes e.g.
 * `('MAX_COMMITS=2000', 'git log -n 2000 ...')` or `('SHALLOW_CHECKOUT', ...)`.
 * The engine copies the label into the report's truncation row, so a truncated
 * history scan can never read as a complete one.
 */
export function markCapHit(label, note) {
  if (!ruleCtx) return;
  ruleCtx.capHit = true;
  if (label) (ruleCtx.capLabels ?? (ruleCtx.capLabels = [])).push(String(label));
  if (note) (ruleCtx.capNotes ?? (ruleCtx.capNotes = [])).push(String(note));
}

function filesForGlob(repo, glob, excludeGlob) {
  const match = makeGlobMatcher(glob);
  const exclude = excludeGlob ? makeGlobMatcher(excludeGlob) : null;
  return repo.tree.filter((f) => !f.binary && match(f.rel) && !(exclude && exclude(f.rel)));
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function* iterMatches(re, content) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(content)) !== null) {
    yield m;
    if (m.index === g.lastIndex) g.lastIndex++;
  }
}

function snippet(content, index, len = 120) {
  const start = content.lastIndexOf('\n', index) + 1;
  let end = content.indexOf('\n', index);
  if (end === -1) end = content.length;
  const line = content.slice(start, end).trim();
  return line.length > len ? `${line.slice(0, len)}…` : line;
}

export const MATCHER_IMPL = {
  'file-content-regex'(repo, p) {
    const re = new RegExp(p.pattern);
    const max = p.max_matches ?? CAP;
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      let n = 0;
      for (const m of iterMatches(re, r.content)) {
        out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
        if (++n >= max) break;
        if (budgetExceeded()) break;
      }
      // CAP is enforced ACROSS files, exactly as before this change: a single
      // file may push a rule past 20, so the reported count is a floor either
      // way — which is why the truncation is printed instead of assumed.
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'content-presence'(repo, p) {
    const re = new RegExp(p.pattern);
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      const m = re.exec(r.content);
      if (m) out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'content-absence'(repo, p) {
    const re = new RegExp(p.pattern);
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob, p.exclude_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      if (!re.test(r.content)) out.push({ file: f.rel, line: null, evidence: 'pattern not found in file' });
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'file-presence'(repo, p) {
    const match = makeGlobMatcher(p.path_glob);
    const exclude = p.exclude_glob ? makeGlobMatcher(p.exclude_glob) : null;
    const all = repo.tree.filter((f) => match(f.rel) && !(exclude && exclude(f.rel)));
    if (all.length > CAP) markCapHit(); // exact: the tree knows the real total
    return all.slice(0, CAP).map((f) => ({ file: f.rel, line: null, evidence: 'file exists in repo' }));
  },

  'file-absence'(repo, p) {
    const match = makeGlobMatcher(p.path_glob);
    const found = repo.tree.some((f) => match(f.rel));
    return found ? [] : [{ file: '(repo root)', line: null, evidence: `no file matches ${p.path_glob}` }];
  },

  'max-occurrences'(repo, p) {
    const re = new RegExp(p.pattern, 'g');
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      let count = 0;
      for (const _ of iterMatches(re, r.content)) {
        count++;
        if (budgetExceeded()) break;
      }
      if (count > p.max) out.push({ file: f.rel, line: null, evidence: `${count} occurrences (max ${p.max})` });
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'complexity-limit'(repo, p) {
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readText(f.rel);
      if (r === null) continue;
      if (p.metric === 'line-count') {
        const n = r.content.split('\n').length;
        if (n > p.max) out.push({ file: f.rel, line: null, evidence: `${n} lines (max ${p.max})` });
      } else if (p.metric === 'cyclomatic') {
        // heuristic: file-level count of branch points, NOT a real per-function cyclomatic count
        const n = 1 + (r.content.match(/\b(if|for|while|case|catch)\b|&&|\|\|/g) || []).length;
        if (n > p.max) out.push({ file: f.rel, line: null, evidence: `heuristic cyclomatic ≈ ${n} (max ${p.max}); file-level approximation, not per-function` });
      } else if (p.metric === 'nesting') {
        // heuristic: max bracket nesting depth of the whole file
        let depth = 0, maxDepth = 0;
        for (const ch of r.content) {
          if (ch === '{' || ch === '(' || ch === '[') { depth++; if (depth > maxDepth) maxDepth = depth; }
          else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
        }
        if (maxDepth > p.max) out.push({ file: f.rel, line: null, evidence: `heuristic max nesting depth ${maxDepth} (max ${p.max}); file-level approximation` });
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'json-field'(repo, p) {
    const out = [];
    const match = makeGlobMatcher(p.file);
    for (const f of repo.tree.filter((t) => match(t.rel))) {
      if (budgetExceeded()) break;
      const r = repo.readText(f.rel);
      if (r === null) continue;
      let doc;
      try {
        doc = JSON.parse(r.content);
      } catch {
        out.push({ file: f.rel, line: null, evidence: 'file does not parse as JSON' });
        continue;
      }
      let val = doc;
      for (const key of p.field.split('.')) {
        if (val === null || typeof val !== 'object') { val = undefined; break; }
        val = val[key];
      }
      const present = val !== undefined;
      if (p.absent ? present : !present) {
        out.push({ file: f.rel, line: null, evidence: `field "${p.field}" is ${present ? 'present' : 'missing'} (required ${p.absent ? 'absent' : 'present'})` });
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'cookie-flags'(repo, p) {
    // heuristic: if a file sets cookies at all, every required flag must appear
    // somewhere in that file. Per-cookie precision needs AST/HTTP inspection.
    const SETS_COOKIE = /set-cookie|res\.cookie\s*\(|\.cookie\s*\(|session\s*[:=]/i;
    const FLAG_RE = { secure: /\bsecure\b/i, httponly: /\bhttponly\b/i, samesite: /\bsamesite\b/i };
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null || !SETS_COOKIE.test(r.content)) continue;
      const missing = p.require.filter((flag) => !FLAG_RE[flag].test(r.content));
      if (missing.length > 0) {
        out.push({ file: f.rel, line: null, evidence: `heuristic: file sets cookies but never sets ${missing.join(', ')}` });
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'cors-wildcard'(repo, p) {
    const PATTERNS = [
      /access-control-allow-origin["'\s]*[:=,]\s*["']?\*/i,
      /\borigin\s*:\s*["']\*["']/i,                       // cors({ origin: '*' }) and friends
      /allow_?origins?\s*[:=]\s*\[?\s*["']?\*/i,          // FastAPI allow_origins=["*"], CORS_ORIGINS=*
      /origins\s*=\s*["'][^"']*\*[^"']*["']/i,            // @CrossOrigin(origins = "*")
      /\.allowedOrigins?\s*\(\s*["']\*["']/i,             // Spring allowedOrigins("*")
    ];
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      for (const re of PATTERNS) {
        for (const m of iterMatches(re, r.content)) {
          out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
          break; // one finding per pattern per file is enough
        }
        if (out.length >= CAP) break;
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'numeric-bound'(repo, p) {
    const re = new RegExp(p.pattern);
    const ops = { gt: (a, b) => a > b, lt: (a, b) => a < b, gte: (a, b) => a >= b, lte: (a, b) => a <= b };
    const cmp = ops[p.op];
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      for (const m of iterMatches(re, r.content)) {
        const num = parseFloat(m[1]);
        if (!Number.isNaN(num) && cmp(num, p.value)) {
          out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: `${num} (${p.op} ${p.value}) — ${snippet(r.content, m.index)}` });
        }
        if (out.length >= CAP) break;
        if (budgetExceeded()) break;
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  'import-requirement'(repo, p) {
    const any = p.require_any.map((s) => new RegExp(s));
    const none = (p.require_none || []).map((s) => new RegExp(s));
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readRegexText(f.rel);
      if (r === null) continue;
      const okAny = any.some((re) => re.test(r.content));
      const badNone = none.filter((re) => re.test(r.content));
      if (!okAny || badNone.length > 0) {
        const why = [!okAny ? `none of ${p.require_any.length} required imports found` : null, badNone.length > 0 ? `forbidden import present` : null].filter(Boolean).join('; ');
        out.push({ file: f.rel, line: null, evidence: why });
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },

  // Rolling-hash O(n) implementation — see the registry note in
  // scripts/validate-detectors.mjs for why this exists (catastrophic regex).
  'exact-duplication'(repo, p) {
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      if (budgetExceeded()) break;
      const r = repo.readText(f.rel);
      if (r === null) continue;
      const dup = findRepeatedWindow(r.content, p.min_chars);
      if (dup) {
        out.push({ file: f.rel, line: dup.line, evidence: `block of ${p.min_chars}+ chars repeated at offset ${dup.first} and ${dup.second}` });
      }
      if (out.length >= CAP) { markCapHit(); break; }
    }
    return out;
  },
};

/**
 * Find the first window of exactly n characters that appears twice in text.
 * Rolling hash over char codes, mod 2^32 (Math.imul keeps it in int32 range);
 * hash hits are verified by direct comparison, so collisions never false-positive.
 * Returns {first, second, line} or null.
 */
function findRepeatedWindow(text, n) {
  if (text.length < n * 2 || n < 1) return null;
  const BASE = 257;
  let hash = 0;
  let highest = 1; // BASE^(n-1) mod 2^32 (Math.imul wraps consistently)
  for (let i = 0; i < n - 1; i++) highest = Math.imul(highest, BASE);
  for (let i = 0; i < n; i++) hash = (Math.imul(hash, BASE) + text.charCodeAt(i)) | 0;
  const seen = new Map([[hash, [0]]]);
  for (let i = 1; i + n <= text.length; i++) {
    // H_i = (H_{i-1} - c_{i-1}·B^{n-1})·B + c_{i+n-1}   (mod 2^32)
    hash = (Math.imul((hash - Math.imul(text.charCodeAt(i - 1), highest)) | 0, BASE) + text.charCodeAt(i + n - 1)) | 0;
    const start = i;
    const candidates = seen.get(hash);
    if (candidates) {
      const win = text.slice(start, start + n);
      for (const prev of candidates) {
        if (text.slice(prev, prev + n) === win) {
          return { first: prev, second: start, line: lineOf(text, prev) };
        }
      }
      candidates.push(start);
      if (candidates.length > 64) candidates.shift(); // bound collision-list growth
    } else {
      seen.set(hash, [start]);
    }
  }
  return null;
}

// ===========================================================================
// GIT HISTORY — the `git-log` tool, and the gitleaks spec that scans history
// ===========================================================================
/**
 * WHY THIS SECTION EXISTS (2026-10-08). Two families of spec could not run at
 * all: the 11 `git-log` rules (commit-rate, message patterns, merge topology,
 * squash dominance, commit size, author hour distribution, schema-breaking
 * change) and `security-secret-in-history-2` — the one rule whose whole point
 * is the scariest finding this tool can produce: a credential that was
 * committed and later deleted, still readable in the git history. Both failed
 * for the same structural reason: nobody ran git.
 *
 * HOW GIT IS RUN (three constraints, all of them real in this repo):
 *   1. ARGUMENT ARRAY, no shell. `execFileSync('git', [ ...args ])` — never a
 *      command string, never `shell: true` (the project's security gate forbids
 *      exec/eval/shell:true).
 *   2. NO PIPES. This repo's Windows sandbox denies piped child stdio
 *      (spawn/exec with `stdio: 'pipe'` fails EPERM — measured, and documented
 *      in registry-diff.mjs). Output is captured through a FILE DESCRIPTOR into
 *      the OS temp dir and read back, capped at MAX_DIFF_BYTES.
 *   3. BOUNDED BY CONSTRUCTION. Every command gets a timeout; the commit walk is
 *      capped at MAX_COMMITS; every byte of git output read into memory is
 *      capped at MAX_DIFF_BYTES; and every one of those caps is NAMED in the
 *      run's output (markCapHit → report.md "Truncated counts" + findings.json
 *      cap_truncations) when it is hit. A 50k-commit repository cannot hang the
 *      scan, and it cannot make the scan's zero mean "clean".
 *
 * WHAT A CAP DOES TO AN ANSWER (the honesty rule this file enforces):
 *   - A POSITIVE finding is always sound: it exists in the bytes that were read.
 *   - A ZERO on an incomplete history is NOT a measurement. Every rule that
 *     derives a STATISTIC from the commit set refuses to fire when the history
 *     is incomplete (`SHALLOW_CHECKOUT`, commit cap, byte cap, timeout), and the
 *     cap is named instead. On these machines every `benchmark/work` clone is a
 *     depth-1 shallow clone (1 commit visible), so those rules correctly report
 *     nothing and say why — a "0 findings on clean history" that came from a
 *     shallow clone would be the exact lie this project exists to prevent.
 *   - The one exception is a monotone floor: a `>` threshold on a rate that is
 *     already exceeded by the commits we DID see can fire, because more history
 *     can only raise a floor. Its evidence says the count is a floor.
 *   - A shallow clone's BOUNDARY commits (the ones `.git/shallow` grafts a parent
 *     away from) are skipped by the secret scan: git has no parent to diff them
 *     against, so it prints their entire tree as added lines. That is a
 *     truncation artifact and it is named in the SHALLOW_CHECKOUT cap note; on a
 *     depth-1 clone those lines are exactly the working tree, which
 *     security-secret-in-code-1 already scans.
 *
 * WHAT THE CHECKS OPERATIONALISE (specs carry only `check` + `threshold`; where
 * that is genuinely ambiguous the spec must say more, and the runner refuses to
 * guess — see the `op` / `pattern` requirements below. Those fields were added
 * to skills/detectors.json for the 6 rules that were ambiguous):
 *   commit-rate             commits/week over the `windowDays` window ENDING AT
 *                           THE NEWEST COMMIT (never at wall-clock now: a scan
 *                           result must depend on the repository alone, or the
 *                           fixture gate becomes a clock race). Direction comes
 *                           from spec.op (`lt` = low activity, `gt` = high).
 *   commit-message-pattern  share of subjects matching the named heuristic
 *                           (spec.pattern: refactor|feature|bugfix|conventional).
 *   no-merge-refs           share of commits with more than one parent.
 *   squash-dominance        share of subjects ending in `(#N)` — the local-git
 *                           proxy for a squashed PR merge; git cannot tell a
 *                           squash merge from a hand-written `(#N)` subject, so
 *                           the heuristic is stated in the evidence.
 *   commit-size-lines       mean (insertions + deletions) per commit from
 *                           `git log --shortstat`; merges have no diffstat and
 *                           count as 0, which the evidence states.
 *   commit-hour-distribution share of AUTHOR hours in [00:00, 06:00) in the
 *                           author's own recorded UTC offset.
 *   schema-breaking-change  NOT IMPLEMENTED, on purpose: "a required field was
 *                           removed from an event without a deprecation period"
 *                           needs the event schema's field model and its
 *                           consumers, which git history alone does not carry.
 *                           The rule is refused BY NAME (degraded) rather than
 *                           approximated — do not inflate "runnable".
 */
export const GIT_LIMITS = Object.freeze({
  timeoutMs: 15000,
  maxCommits: 2000,
  // 16 MiB: the `git log -p` stream is read through this ceiling. Measured here:
  // this repository's own 82-commit history produces a 28 MB unified=0 diff, so
  // the cap is REAL and it is hit — which is exactly why it must be named in the
  // output instead of silently shortening the history. Raising it trades memory
  // (the capped buffer is held as a string during the scan) for older history.
  maxDiffBytes: 16 * 1024 * 1024,
  windowDays: 28,
});

const GIT_NO_HISTORY_RE = /does not have any commits yet|ambiguous argument 'HEAD'|unknown revision or path not in the working tree|bad revision/i;

/**
 * Path noise the WORKING-TREE scan already excludes, mirrored for the history
 * scan. MIRRORS SKIP_TEST_DIRS / TEST_LIKE_NAME in ./scan-repo.mjs — those two
 * are module-local there and cannot be imported, so keep them in sync by hand
 * (same convention as SENSITIVE_NAME in ../lib/repo-files.mjs). Without this,
 * every committed fixture full of fake keys becomes a critical history finding
 * on the project's own repository.
 *
 * Deliberately NOT mirrored: .gitignore. An ignored-but-committed `.env` is
 * precisely the leak this scan exists to find, so ignoring .gitignore here is
 * the point, not an oversight.
 */
const HISTORY_SKIP_TEST_DIRS = new Set(['__tests__', '__mocks__', 'fixtures', 'fixture']);
const HISTORY_TEST_LIKE_NAME =
  /\.(test|spec|e2e)\.[^.]+$|\.min\.[^.]+$|\.example(\.|$)|\.sample(\.|$)|_test\.go$|^test_[^/]*\.py$/i;

function historyPathIsNoise(rel) {
  const parts = String(rel).split('/');
  for (const p of parts.slice(0, -1)) if (SKIP_DIRS.has(p) || HISTORY_SKIP_TEST_DIRS.has(p)) return true;
  return HISTORY_TEST_LIKE_NAME.test(parts[parts.length - 1]);
}

function normalizeGitLimits(partial) {
  const out = { ...GIT_LIMITS };
  if (partial && typeof partial === 'object') {
    for (const k of ['timeoutMs', 'maxCommits', 'maxDiffBytes', 'windowDays']) {
      const v = Number(partial[k]);
      if (Number.isFinite(v) && v > 0) out[k] = Math.floor(v);
    }
  }
  return out;
}

/** Read at most `maxBytes` of a file, reporting whether it was cut. */
function readCapped(path, maxBytes) {
  let fd = -1;
  try {
    const size = statSync(path).size;
    const n = Math.min(size, maxBytes);
    if (n <= 0) return { text: '', size, truncated: size > maxBytes };
    const buf = Buffer.allocUnsafe(n);
    fd = openSync(path, 'r');
    let off = 0;
    while (off < n) {
      const got = readSync(fd, buf, off, n - off, off);
      if (got <= 0) break;
      off += got;
    }
    return { text: buf.subarray(0, off).toString('utf8'), size, truncated: size > maxBytes };
  } catch {
    return { text: '', size: 0, truncated: false };
  } finally {
    if (fd >= 0) { try { closeSync(fd); } catch { /* already closed */ } }
  }
}

/**
 * Run one git command inside the target and capture it through a file
 * descriptor (see constraint 2 in the section doc). Never throws: every failure
 * mode comes back as data so the caller can NAME it instead of losing the scan.
 *
 * @returns {{ok: boolean, status: number|null, timedOut: boolean, stdout: string,
 *            bytes: number, truncated: boolean, stderr: string,
 *            spawnError: {code: string|null, signal: string|null}|null,
 *            timeoutMs: number}}
 */
function gitCapture(target, args, opts = {}) {
  const maxBytes = opts.maxBytes ?? GIT_LIMITS.maxDiffBytes;
  const timeoutMs = opts.timeoutMs ?? GIT_LIMITS.timeoutMs;
  let dir = null;
  try {
    dir = mkdtempSync(join(tmpdir(), 'dktv-git-'));
  } catch (e) {
    return { ok: false, status: null, timedOut: false, stdout: '', bytes: 0, truncated: false, stderr: '', spawnError: { code: 'SCRATCH', signal: null }, timeoutMs, message: e?.message ?? String(e) };
  }
  const outPath = join(dir, 'stdout');
  const errPath = join(dir, 'stderr');
  let outFd = -1;
  let errFd = -1;
  let status = 0;
  let spawnError = null;
  try {
    outFd = openSync(outPath, 'w');
    errFd = openSync(errPath, 'w');
    try {
      execFileSync('git', ['-C', target, '-c', 'core.quotepath=false', ...args], {
        stdio: ['ignore', outFd, errFd],
        timeout: timeoutMs,
        windowsHide: true,
      });
    } catch (e) {
      status = typeof e?.status === 'number' ? e.status : null;
      spawnError = { code: e?.code ?? null, signal: e?.signal ?? null };
    }
  } catch (e) {
    spawnError = { code: e?.code ?? 'STDIO', signal: null };
  } finally {
    if (outFd >= 0) { try { closeSync(outFd); } catch { /* already closed */ } }
    if (errFd >= 0) { try { closeSync(errFd); } catch { /* already closed */ } }
  }
  const out = readCapped(outPath, maxBytes);
  const err = readCapped(errPath, 8192);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir, best effort */ }
  return {
    ok: status === 0 && spawnError === null,
    status,
    spawnError,
    timedOut: spawnError?.code === 'ETIMEDOUT' || spawnError?.signal === 'SIGTERM',
    stdout: out.text,
    bytes: out.size,
    truncated: out.truncated,
    stderr: err.text.trim(),
    timeoutMs,
  };
}

/** One sentence naming a failed git command (never empty, never a stack trace). */
function gitFailure(what, res) {
  if (res.spawnError?.code === 'ENOENT') return `${what} failed: git is not on PATH`;
  if (res.timedOut) return `${what} was killed after GIT_TIMEOUT_MS=${res.timeoutMs}`;
  const first = (res.stderr || '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return `${what} failed (git exit ${res.status ?? 'killed'}): ${first.slice(0, 200) || 'no stderr'}`;
}

/** A scan target is a checkout only if the directory ITSELF carries `.git`. */
export function isGitCheckout(target) {
  return existsSync(join(target, '.git'));
}

/**
 * Resolve the git dir of a checkout, following a `.git` FILE (linked worktree)
 * and `commondir`. Returns null when the target is not a checkout.
 */
function resolveGitDirs(target) {
  const dotGit = join(target, '.git');
  let gitDir = dotGit;
  try {
    if (statSync(dotGit).isFile()) {
      const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'));
      if (m) {
        const p = m[1].trim();
        gitDir = isAbsolute(p) ? p : join(target, p);
      }
    } else {
      statSync(dotGit); // throws when `.git` is missing entirely
    }
  } catch {
    return null;
  }
  let commonDir = gitDir;
  try {
    const cd = readFileSync(join(gitDir, 'commondir'), 'utf8').trim();
    if (cd) commonDir = isAbsolute(cd) ? cd : join(gitDir, cd);
  } catch { /* not a linked worktree */ }
  return { gitDir, commonDir };
}

/**
 * Is this checkout shallow? Read from the filesystem, not from a subprocess:
 * `git clone --depth N` writes `<gitdir>/shallow`, and a linked worktree keeps
 * it in the common dir. A shallow checkout CANNOT answer a history question —
 * this is the difference between "no secret in history" and "no secret in the
 * one commit this clone has".
 */
export function isShallowCheckout(target) {
  const dirs = resolveGitDirs(target);
  if (!dirs) return false;
  return existsSync(join(dirs.commonDir, 'shallow')) || existsSync(join(dirs.gitDir, 'shallow'));
}

/**
 * The commits `.git/shallow` grafts a parent away from ("boundary" commits).
 *
 * WHY THEY MATTER: for a boundary commit git has no parent to diff against, so
 * `git log -p` prints its ENTIRE TREE as added lines. That is a truncation
 * artifact, not a change — attributing those lines to that commit would be
 * false, and on a depth-1 clone it would also duplicate every working-tree
 * finding at critical severity. Those diffs are skipped BY NAME (see the
 * SHALLOW_CHECKOUT cap note), while still scanning everything above the
 * boundary, which is where a shallow clone's real changes live.
 */
export function shallowBoundaryCommits(target) {
  const dirs = resolveGitDirs(target);
  if (!dirs) return new Set();
  for (const p of [join(dirs.commonDir, 'shallow'), join(dirs.gitDir, 'shallow')]) {
    try {
      return new Set(readFileSync(p, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
    } catch { /* try the next location */ }
  }
  return new Set();
}

/**
 * gitleaks specs whose path_regex targets git metadata = a history scan.
 *
 * This is the SAME test the old gitleaks-lite branch used (`.test('.git/')`),
 * kept deliberately so no spec changes route. Known sharp edge, inherited: a
 * catch-all path_regex (e.g. `.*`, which also matches `.git/`) would be routed
 * to the history scan. No spec in skills/detectors.json does that today (the
 * only path_regex values are this one and an n8n workflow glob), and a spec that
 * wants the working tree should not carry a path_regex matching `.git/`.
 */
export function isHistoryPathSpec(spec) {
  if (!spec || typeof spec.path_regex !== 'string') return false;
  try {
    return new RegExp(spec.path_regex).test('.git/') || new RegExp(spec.path_regex).test('.git\\');
  } catch {
    return false;
  }
}

const LOG_META_FORMAT = '%H%x1f%cI%x1f%ct%x1f%P%x1f%ad%x1f%s';

function parseLogRecords(text) {
  const commits = [];
  for (const line of String(text).split('\n')) {
    if (!line) continue;
    const f = line.split('\x1f');
    if (f.length < 6) continue; // a record cut by the byte cap is dropped, not guessed at
    const subject = f.slice(5).join('\x1f'); // the subject may itself contain the separator
    commits.push({
      sha: f[0],
      iso: f[1],
      ct: Number.parseInt(f[2], 10) || 0,
      parents: f[3] ? f[3].split(' ').filter(Boolean) : [],
      hour: Number.parseInt(f[4], 10),
      subject,
    });
  }
  return commits;
}

/**
 * One bounded read of the commit set, shared by every `git-log` check.
 * `complete` means: not shallow AND every commit in the repository's visible
 * history was inspected AND nothing was cut by a byte cap.
 */
function readHistory(target, limits) {
  const capLabels = [];
  const capNotes = [];
  const shallow = isShallowCheckout(target);
  if (shallow) {
    capLabels.push('SHALLOW_CHECKOUT: history incomplete, a 0 here is not proof of absence');
    capNotes.push('the checkout is SHALLOW (.git/shallow): the commits this clone does not carry cannot be inspected, so a statistic over the visible commits is not a statistic about the repository');
  }

  const count = gitCapture(target, ['rev-list', '--count', 'HEAD'], { maxBytes: 4096, timeoutMs: limits.timeoutMs });
  let total = 0;
  if (count.ok) {
    const n = Number.parseInt(count.stdout.trim(), 10);
    total = Number.isFinite(n) ? n : 0;
  } else if (!GIT_NO_HISTORY_RE.test(count.stderr)) {
    return { degradedReason: gitFailure('git rev-list --count HEAD', count) };
  }
  if (count.truncated) {
    capLabels.push(`MAX_DIFF_BYTES=${limits.maxDiffBytes}: git output truncated, counts are floors`);
    capNotes.push('the commit count was cut by the byte cap');
  }

  const log = gitCapture(
    target,
    ['log', '--no-color', '--date=format:%H', `--pretty=format:${LOG_META_FORMAT}`, '-n', String(limits.maxCommits)],
    { maxBytes: limits.maxDiffBytes, timeoutMs: limits.timeoutMs },
  );
  let commits = [];
  if (log.ok) commits = parseLogRecords(log.stdout);
  else if (!GIT_NO_HISTORY_RE.test(log.stderr)) return { degradedReason: gitFailure('git log', log) };

  const cappedCommits = total > commits.length;
  if (cappedCommits) {
    capLabels.push(`MAX_COMMITS=${limits.maxCommits}: only the newest ${limits.maxCommits} of ${total} commits inspected, counts are floors`);
    capNotes.push(`git log was limited to the newest ${limits.maxCommits} of ${total} commit(s); older history was NOT inspected`);
  }
  if (log.truncated) {
    capLabels.push(`MAX_DIFF_BYTES=${limits.maxDiffBytes}: git output truncated, counts are floors`);
    capNotes.push('the commit metadata was cut by the byte cap and read only partially');
  }

  return {
    commits,
    total,
    inspected: commits.length,
    shallow,
    complete: !shallow && !cappedCommits && !log.truncated && !count.truncated,
    capLabels: [...new Set(capLabels)],
    capNote: capNotes.join('; '),
  };
}

function readShortstat(target, limits) {
  const res = gitCapture(
    target,
    ['log', '--no-color', '--shortstat', '--pretty=format:%x1e%H', '-n', String(limits.maxCommits)],
    { maxBytes: limits.maxDiffBytes, timeoutMs: limits.timeoutMs },
  );
  if (!res.ok && !GIT_NO_HISTORY_RE.test(res.stderr)) return { degradedReason: gitFailure('git log --shortstat', res) };
  const changed = new Map();
  for (const rec of res.stdout.split('\x1e')) {
    const nl = rec.indexOf('\n');
    if (nl === -1) continue;
    const sha = rec.slice(0, nl).trim();
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) continue;
    const ins = /(\d+) insertions?\(\+\)/.exec(rec);
    const del = /(\d+) deletions?\(-\)/.exec(rec);
    changed.set(sha, (ins ? Number(ins[1]) : 0) + (del ? Number(del[1]) : 0));
  }
  return { changed, truncated: res.truncated };
}

function statFinding(evidence) {
  return { file: '(git history)', line: null, evidence };
}

function scopeLine(data, limits) {
  return data.complete
    ? `scope: complete visible history, ${data.inspected} commit(s) inspected`
    : `scope: INCOMPLETE history — ${data.inspected} commit(s) inspected, capped by ${data.capLabels.join('+')} (window ${limits.windowDays}d); the real history is larger`;
}

function windowStats(commits, windowDays) {
  if (commits.length === 0) return { newest: null, oldest: null, start: 0, inWindow: [] };
  const byCt = [...commits].sort((a, b) => b.ct - a.ct);
  const newest = byCt[0];
  const oldest = byCt[byCt.length - 1];
  const start = newest.ct - windowDays * 86400;
  return { newest, oldest, start, inWindow: byCt.filter((c) => c.ct >= start) };
}

/** The three keyword categories of `commit-message-pattern`, as documented heuristics. */
const MESSAGE_PATTERNS = Object.freeze({
  refactor: /\b(refactor\w*|restructur\w*|reorgani[sz]\w*|cleanup|clean[ -]up|simplif\w*|tidy|deduplicat\w*|rename[sd]?|extract\w*|move[sd]?)\b/i,
  feature: /\b(feat|feature|add|adds|added|implement\w*|introduc\w*|support\w*|create[sd]?|new)\b/i,
  bugfix: /\b(fix|fixes|fixed|bug|bugfix|hotfix|patch\w*|repair\w*|resolve[sd]?|issue)\b/i,
});
const CONVENTIONAL_SUBJECT_RE = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]*\))?!?:\s/;
const SQUASH_SUBJECT_RE = /\(#\d+\)\s*$/;

const GIT_LOG_CHECKS = {
  'commit-rate'(spec, data, limits) {
    const t = Number(spec.threshold);
    if (spec.op !== 'lt' && spec.op !== 'gt') {
      return { degradedReason: `spec is ambiguous: check "commit-rate" carries only threshold ${JSON.stringify(spec.threshold)} while two rules share it in opposite directions; add "op": "lt" | "gt"` };
    }
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (data.total === 0) {
      if (spec.op !== 'lt') return { findings: [] };
      return { findings: [statFinding(`0 commits in the repository history — 0.00 commits/week < ${t}; there is no history to measure (${scopeLine(data, limits)})`)] };
    }
    const { newest, oldest, start, inWindow } = windowStats(data.commits, limits.windowDays);
    if (!newest) return { findings: [] };
    const rate = inWindow.length / (limits.windowDays / 7);
    // The window is fully visible when we hold all history, or when the oldest
    // commit we inspected is at least as old as the window start.
    const windowComplete = data.complete || (oldest !== null && oldest.ct <= start);
    const rateText = `${rate.toFixed(2)} commits/week over the ${limits.windowDays}-day window ending ${String(newest.iso).slice(0, 10)} (${inWindow.length} commit(s) in the window)`;
    if (spec.op === 'gt' && rate > t) {
      return { findings: [statFinding(`${rateText}${windowComplete ? '' : ' — a FLOOR: the window is only partially visible'}; threshold: > ${t}; ${scopeLine(data, limits)}`)] };
    }
    if (spec.op === 'lt' && windowComplete && rate < t) {
      return { findings: [statFinding(`${rateText}; threshold: < ${t}; the window is fully visible (${scopeLine(data, limits)})`)] };
    }
    return { findings: [] };
  },

  'commit-message-pattern'(spec, data, limits) {
    const t = Number(spec.threshold);
    const kind = spec.pattern;
    if (kind !== 'conventional' && !MESSAGE_PATTERNS[kind]) {
      return { degradedReason: `spec is ambiguous: check "commit-message-pattern" is shared by four rules and carries only threshold ${JSON.stringify(spec.threshold)}; add "pattern": "refactor" | "feature" | "bugfix" | "conventional"` };
    }
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (!data.complete || data.commits.length === 0) return { findings: [] };
    const re = kind === 'conventional' ? CONVENTIONAL_SUBJECT_RE : MESSAGE_PATTERNS[kind];
    const matched = data.commits.filter((c) => re.test(c.subject)).length;
    const share = (matched / data.commits.length) * 100;
    if (share > t) {
      return { findings: [statFinding(`${share.toFixed(1)}% of the ${data.commits.length} inspected commit subjects match the "${kind}" heuristic (${matched} of ${data.commits.length}); threshold: > ${t}%; heuristic: subject matching, not a semantic classification of the change; ${scopeLine(data, limits)}`)] };
    }
    return { findings: [] };
  },

  'no-merge-refs'(spec, data, limits) {
    const t = Number(spec.threshold);
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (!data.complete || data.commits.length === 0) return { findings: [] };
    const merges = data.commits.filter((c) => c.parents.length > 1).length;
    const share = (merges / data.commits.length) * 100;
    if (share > t) {
      return { findings: [statFinding(`${share.toFixed(1)}% of the ${data.commits.length} inspected commits have more than one parent (${merges} merge commit(s)); threshold: > ${t}%; ${scopeLine(data, limits)}`)] };
    }
    return { findings: [] };
  },

  'squash-dominance'(spec, data, limits) {
    const t = Number(spec.threshold);
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (!data.complete || data.commits.length === 0) return { findings: [] };
    const squash = data.commits.filter((c) => SQUASH_SUBJECT_RE.test(c.subject)).length;
    const share = (squash / data.commits.length) * 100;
    if (share > t) {
      return { findings: [statFinding(`${share.toFixed(1)}% of the ${data.commits.length} inspected commit subjects end in "(#N)" (${squash} commit(s)); threshold: > ${t}%; heuristic: local git cannot distinguish a squashed PR merge from a hand-written "(#N)" subject, so this is the proxy for "merges that were squashed"; ${scopeLine(data, limits)}`)] };
    }
    return { findings: [] };
  },

  'commit-size-lines'(spec, data, limits) {
    const t = Number(spec.threshold);
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (!data.complete || data.commits.length === 0 || !data.changed) return { findings: [] };
    const total = data.commits.reduce((sum, c) => sum + (data.changed.get(c.sha) ?? 0), 0);
    const mean = total / data.commits.length;
    const merges = data.commits.filter((c) => !data.changed.has(c.sha)).length;
    if (mean > t) {
      return { findings: [statFinding(`mean ${mean.toFixed(1)} changed line(s) per commit over ${data.commits.length} inspected commit(s) (${total} line(s) total); threshold: > ${t}; ${merges} merge commit(s) carry no diffstat and count as 0; ${scopeLine(data, limits)}`)] };
    }
    return { findings: [] };
  },

  'commit-hour-distribution'(spec, data, limits) {
    const t = Number(spec.threshold);
    if (!Number.isFinite(t)) return { degradedReason: 'spec.threshold must be a number' };
    if (!data.complete || data.commits.length === 0) return { findings: [] };
    const late = data.commits.filter((c) => Number.isFinite(c.hour) && c.hour >= 0 && c.hour < 6).length;
    const share = (late / data.commits.length) * 100;
    if (share > t) {
      return { findings: [statFinding(`${share.toFixed(1)}% of the ${data.commits.length} inspected commits were AUTHORED between 00:00 and 05:59 in the author's own recorded UTC offset (${late} commit(s)); threshold: > ${t}%; heuristic: a fixed 00:00-06:00 band, not a per-developer sleep schedule; ${scopeLine(data, limits)}`)] };
    }
    return { findings: [] };
  },
};

/**
 * Run one `git-log` spec against the scan target.
 *
 * @returns {{findings: object[], degradedReason?: string}}
 */
export function runGitLog(repo, spec, opts = {}) {
  const limits = normalizeGitLimits(opts.gitLimits);
  const check = String(spec?.check ?? '');
  const impl = GIT_LOG_CHECKS[check];
  if (!impl) {
    return {
      findings: [],
      degradedReason: `git-log check "${check || '(none)'}" has no implementation in this runner and is left degraded rather than approximated (known unimplemented: schema-breaking-change — see the section note in matchers.mjs)`,
    };
  }
  const target = repo.baseDir;
  if (!isGitCheckout(target)) {
    return { findings: [], degradedReason: 'target is not a git checkout (no .git directory): git-history checks cannot run here' };
  }
  const info = readHistory(target, limits);
  if (info.degradedReason) return { findings: [], degradedReason: info.degradedReason };
  if (!info.complete) markCapHit(info.capLabels.join('+'), info.capNote);

  const data = { ...info, limits };
  if (check === 'commit-size-lines') {
    const stats = readShortstat(target, limits);
    if (stats.degradedReason) return { findings: [], degradedReason: stats.degradedReason };
    if (stats.truncated) {
      markCapHit(`MAX_DIFF_BYTES=${limits.maxDiffBytes}: git output truncated, the size statistic is refused`, 'git log --shortstat output was cut by the byte cap: the per-commit size statistic would be computed over a partial commit set and is therefore refused');
      return { findings: [] };
    }
    data.changed = stats.changed;
  }
  const res = impl(spec, data, limits);
  if (res.degradedReason) return { findings: [], degradedReason: res.degradedReason };
  return { findings: res.findings ?? [] };
}

// ---- the history secret scan (gitleaks spec with a .git/ path_regex) ----

/** Strip the `a/`/`b/` diff prefix and any quoting from a diff path. */
function diffPath(p) {
  let s = String(p).trim();
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  if (s.startsWith('a/') || s.startsWith('b/')) s = s.slice(2);
  return s;
}

/**
 * Does this ONE added/removed diff line contain the spec's secret pattern?
 * The literal-vs-variable rule mirrors runGitleaksLite in ./engine.mjs (an
 * unquoted bare-identifier RHS is a reference, not a credential).
 */
function lineHasSecret(text, re, keywords) {
  if (keywords.length > 0 && !keywords.some((k) => text.toLowerCase().includes(String(k).toLowerCase()))) return false;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = g.exec(text)) !== null) {
    const value = m[0].split(/[:=]/).pop().trim();
    if (!/["']/.test(m[0]) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      if (m.index === g.lastIndex) g.lastIndex++;
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Walk `git log -p` output and emit REDACTED findings.
 *
 * THE REDACTION IS STRUCTURAL, NOT A FILTER: this function never keeps the
 * matched text, and no byte of the diff enters the evidence string. A filter can
 * be defeated by a pattern nobody anticipated; a construction that only ever
 * concatenates metadata (commit, date, path, line, side) and a fixed placeholder
 * cannot print a value it never reads. The value is simply not stored anywhere,
 * at any point, in the finding.
 */
function diffSecretFindings(diffText, spec, skipCommits = new Set()) {
  const re = new RegExp(spec.regex);
  const keywords = Array.isArray(spec.keywords) ? spec.keywords : [];
  const out = [];
  const seen = new Set();
  let commits = 0;
  let skippedGrafted = 0;
  const add = (rec) => {
    if (out.length >= CAP) { markCapHit(); return; }
    // Commit is part of the key: the commit that ADDED the line and the commit
    // that REMOVED it are two different remediation facts (one is "it is here",
    // the other is "rewriting that commit removes it").
    const key = `${rec.sha}|${rec.path}|${rec.line}|${rec.side}`;
    if (seen.has(key)) return;
    seen.add(key);
    const date = String(rec.iso).slice(0, 10) || 'date unknown';
    out.push({
      file: rec.path,
      line: rec.line,
      evidence: `git history: commit ${String(rec.sha).slice(0, 10)} (${date}) ${rec.side} line in ${rec.path}:${rec.line} matched a secret pattern — content withheld (<redacted: secret value in git history>)`,
    });
  };

  for (const rec of String(diffText).split('\x1e')) {
    if (!rec) continue;
    const nl = rec.indexOf('\n');
    const header = nl === -1 ? rec : rec.slice(0, nl);
    const sep = header.indexOf('\x1f');
    const sha = (sep === -1 ? header : header.slice(0, sep)).trim();
    const iso = sep === -1 ? '' : header.slice(sep + 1).trim();
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) continue; // partial record from a byte cap: dropped
    commits++;
    if (skipCommits.has(sha)) { skippedGrafted++; continue; } // shallow boundary: whole tree shown as "added"
    const body = nl === -1 ? '' : rec.slice(nl + 1);
    let path = null;
    let newLine = 0;
    let oldLine = 0;
    for (const raw of body.split('\n')) {
      if (raw.startsWith('diff --git ')) { path = null; continue; }
      if (raw.startsWith('--- ')) { const p = raw.slice(4).trim(); path = p === '/dev/null' ? null : diffPath(p); continue; }
      if (raw.startsWith('+++ ')) { const p = raw.slice(4).trim(); if (p !== '/dev/null') path = diffPath(p); continue; }
      if (raw.startsWith('@@')) {
        const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (m) { oldLine = Number(m[1]); newLine = Number(m[2]); }
        continue;
      }
      if (raw.startsWith('+')) {
        if (path && !historyPathIsNoise(path) && lineHasSecret(raw.slice(1), re, keywords)) add({ sha, iso, path, line: newLine, side: 'added' });
        newLine++;
        continue;
      }
      if (raw.startsWith('-')) {
        if (path && !historyPathIsNoise(path) && lineHasSecret(raw.slice(1), re, keywords)) add({ sha, iso, path, line: oldLine, side: 'removed' });
        oldLine++;
        continue;
      }
      if (raw.startsWith(' ')) { newLine++; oldLine++; continue; }
      // 'index …', 'new file mode …', 'Binary files … differ', '\ No newline …': no line to scan
    }
  }
  return { findings: out, commits, skippedGrafted };
}

/**
 * The gitleaks history spec: scan every added/removed line of `git log -p`
 * inside the target, emitted REDACTED (see diffSecretFindings).
 *
 * @returns {{findings: object[], degradedReason?: string}}
 */
export function runGitHistorySecrets(repo, spec, opts = {}) {
  const limits = normalizeGitLimits(opts.gitLimits);
  const target = repo.baseDir;
  if (!isGitCheckout(target)) {
    return { findings: [], degradedReason: 'target is not a git checkout (no .git directory): the git-history secret scan cannot run here' };
  }
  const shallow = isShallowCheckout(target);
  const count = gitCapture(target, ['rev-list', '--count', 'HEAD'], { maxBytes: 4096, timeoutMs: limits.timeoutMs });
  let total = 0;
  if (count.ok) {
    const n = Number.parseInt(count.stdout.trim(), 10);
    total = Number.isFinite(n) ? n : 0;
  } else if (!GIT_NO_HISTORY_RE.test(count.stderr)) {
    return { findings: [], degradedReason: gitFailure('git rev-list --count HEAD', count) };
  }

  const res = gitCapture(
    target,
    ['log', '-p', '--no-color', '--unified=0', '--no-renames', '--pretty=format:%x1e%H%x1f%cI', '-n', String(limits.maxCommits)],
    { maxBytes: limits.maxDiffBytes, timeoutMs: limits.timeoutMs },
  );
  if (!res.ok && !res.timedOut && !GIT_NO_HISTORY_RE.test(res.stderr)) {
    return { findings: [], degradedReason: gitFailure('git log -p', res) };
  }

  const scan = diffSecretFindings(res.stdout, spec, shallow ? shallowBoundaryCommits(target) : new Set());

  const labels = [];
  const notes = [];
  if (shallow) {
    labels.push('SHALLOW_CHECKOUT: history not fully present, a 0 here is not proof of absence');
    notes.push(`the checkout is SHALLOW (.git/shallow): only the commits this clone carries were scanned, and ${scan.skippedGrafted} grafted boundary commit(s) were skipped because git shows their whole tree as "added" — a truncation artifact, not a change (the working-tree secret rule covers those lines); a secret in the missing history CANNOT be found, so zero findings here is not proof of absence`);
  }
  if (total > limits.maxCommits) {
    labels.push(`MAX_COMMITS=${limits.maxCommits}: only the newest ${limits.maxCommits} of ${total} commits scanned`);
    notes.push(`git log -p was limited to the newest ${limits.maxCommits} of ${total} commit(s): a secret that only ever existed in the older history would NOT be reported`);
  }
  if (res.truncated) {
    labels.push(`MAX_DIFF_BYTES=${limits.maxDiffBytes}: diff stream truncated, a match beyond it is not reported`);
    notes.push(`the diff stream was cut at MAX_DIFF_BYTES=${limits.maxDiffBytes} bytes: the newest ${scan.commits} commit(s) were scanned, the older ones were NOT, so a secret that only ever existed there would NOT be reported`);
  }
  if (res.timedOut) {
    labels.push(`GIT_TIMEOUT_MS=${limits.timeoutMs}: git log -p killed, the diff stream is partial`);
    notes.push(`git log -p was killed at the per-command timeout: the diff stream is partial (the newest ${scan.commits} commit(s) were scanned)`);
  }
  if (labels.length > 0) markCapHit([...new Set(labels)].join('+'), notes.join('; '));

  return { findings: scan.findings };
}
