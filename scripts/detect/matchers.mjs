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
 */
import { makeGlobMatcher } from './glob.mjs';

const CAP = 20; // findings per rule per run, keeps reports bounded on big repos

function filesForGlob(repo, glob) {
  const match = makeGlobMatcher(glob);
  return repo.tree.filter((f) => !f.binary && match(f.rel));
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
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      let n = 0;
      for (const m of iterMatches(re, r.content)) {
        out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
        if (++n >= max) break;
      }
      if (out.length >= CAP) break;
    }
    return out;
  },

  'content-presence'(repo, p) {
    const re = new RegExp(p.pattern);
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      const m = re.exec(r.content);
      if (m) out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
      if (out.length >= CAP) break;
    }
    return out;
  },

  'content-absence'(repo, p) {
    const re = new RegExp(p.pattern);
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      if (!re.test(r.content)) out.push({ file: f.rel, line: null, evidence: 'pattern not found in file' });
      if (out.length >= CAP) break;
    }
    return out;
  },

  'file-presence'(repo, p) {
    const match = makeGlobMatcher(p.path_glob);
    const exclude = p.exclude_glob ? makeGlobMatcher(p.exclude_glob) : null;
    return repo.tree
      .filter((f) => match(f.rel) && !(exclude && exclude(f.rel)))
      .slice(0, CAP)
      .map((f) => ({ file: f.rel, line: null, evidence: 'file exists in repo' }));
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
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      const count = [...iterMatches(re, r.content)].length;
      if (count > p.max) out.push({ file: f.rel, line: null, evidence: `${count} occurrences (max ${p.max})` });
      if (out.length >= CAP) break;
    }
    return out;
  },

  'complexity-limit'(repo, p) {
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      const r = repo.readFile(f.rel);
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
      if (out.length >= CAP) break;
    }
    return out;
  },

  'json-field'(repo, p) {
    const out = [];
    const match = makeGlobMatcher(p.file);
    for (const f of repo.tree.filter((t) => match(t.rel))) {
      const r = repo.readFile(f.rel);
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
      if (out.length >= CAP) break;
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
      const r = repo.readFile(f.rel);
      if (r === null || !SETS_COOKIE.test(r.content)) continue;
      const missing = p.require.filter((flag) => !FLAG_RE[flag].test(r.content));
      if (missing.length > 0) {
        out.push({ file: f.rel, line: null, evidence: `heuristic: file sets cookies but never sets ${missing.join(', ')}` });
      }
      if (out.length >= CAP) break;
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
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      for (const re of PATTERNS) {
        for (const m of iterMatches(re, r.content)) {
          out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
          break; // one finding per pattern per file is enough
        }
        if (out.length >= CAP) break;
      }
      if (out.length >= CAP) break;
    }
    return out;
  },

  'numeric-bound'(repo, p) {
    const re = new RegExp(p.pattern);
    const ops = { gt: (a, b) => a > b, lt: (a, b) => a < b, gte: (a, b) => a >= b, lte: (a, b) => a <= b };
    const cmp = ops[p.op];
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      for (const m of iterMatches(re, r.content)) {
        const num = parseFloat(m[1]);
        if (!Number.isNaN(num) && cmp(num, p.value)) {
          out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: `${num} (${p.op} ${p.value}) — ${snippet(r.content, m.index)}` });
        }
        if (out.length >= CAP) break;
      }
      if (out.length >= CAP) break;
    }
    return out;
  },

  'import-requirement'(repo, p) {
    const any = p.require_any.map((s) => new RegExp(s));
    const none = (p.require_none || []).map((s) => new RegExp(s));
    const out = [];
    for (const f of filesForGlob(repo, p.path_glob)) {
      const r = repo.readFile(f.rel);
      if (r === null) continue;
      const okAny = any.some((re) => re.test(r.content));
      const badNone = none.filter((re) => re.test(r.content));
      if (!okAny || badNone.length > 0) {
        const why = [!okAny ? `none of ${p.require_any.length} required imports found` : null, badNone.length > 0 ? `forbidden import present` : null].filter(Boolean).join('; ');
        out.push({ file: f.rel, line: null, evidence: why });
      }
      if (out.length >= CAP) break;
    }
    return out;
  },
};
