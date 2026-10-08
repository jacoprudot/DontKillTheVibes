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
import { makeGlobMatcher } from './glob.mjs';

export const CAP = 20; // findings per rule per run, keeps reports bounded on big repos

// ---- per-rule run context (step budget + truncation flag) ----
let ruleCtx = null;

/** Called by the engine before each rule; `budgetMs <= 0` disables the budget. */
export function beginRuleContext(id, budgetMs) {
  ruleCtx = {
    id,
    budgetMs,
    deadline: budgetMs > 0 ? performance.now() + budgetMs : Infinity,
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
  if (ruleCtx && !ruleCtx.exceeded && performance.now() > ruleCtx.deadline) ruleCtx.exceeded = true;
  return ruleCtx ? ruleCtx.exceeded : false;
}

/** Records that this rule stopped early because of CAP (never silent). */
export function markCapHit() {
  if (ruleCtx) ruleCtx.capHit = true;
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
