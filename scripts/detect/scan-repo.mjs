/**
 * scan-repo.mjs — repository walker for the detector engine.
 *
 * Deliberately NOT scripts/lib/repo-files.mjs: that helper's contract is built
 * for sending content to an external LLM (sensitive files are withheld from
 * the tree entirely). The detector runs 100% locally — nothing leaves the
 * machine — but findings in sensitive-named files (.env, *.pem, *.key …) must
 * never print file CONTENT into a report, only path + line. So this walker:
 *
 *   - lists sensitive files in the tree (their existence IS data: a committed
 *     .env is precisely what security-env-file-committed-3 detects)
 *   - can read their content for matching, flagged `sensitive: true`, and the
 *     engine redacts evidence for those files
 *   - otherwise mirrors repo-files.mjs: same SKIP_DIRS / SKIP_EXT / SENSITIVE_NAME
 *     / .gitignore handling, so the two walkers never disagree about the shape
 *     of a repo. If those filters change in repo-files.mjs, change the import
 *     here by updating repo-files.mjs itself.
 *
 * READ GUARDS (2026-10-07). This module is the ONE place that decides whether a
 * file's content may be handed to a matcher, because the 2026-10-07 sweep
 * proved that "the matcher skipped it" and "nobody told the report" are the
 * same statement in a report that only counts findings:
 *
 *   READ_CAP (512 KB)     — hard ceiling: bundles/lockfiles are not read at all.
 *   MAX_CONTENT (256 KB)  — whole-file regex matchers only: node has no regex
 *                           timeout, and every regex in the registry is a
 *                           line-oriented heuristic. Refused via readRegexText().
 *   MAX_LINE (2000 chars) — any matcher: a minified/generated line is not where
 *                           a line-oriented heuristic applies.
 *
 * Every refusal is appended to `skipLog` NAMED (file + reason + detail), and the
 * engine copies that log into the report's coverage block. Nothing is dropped
 * silently: a skip that is not named is a lie of omission.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SKIP_DIRS, SKIP_EXT, SENSITIVE_NAME, loadGitignore } from '../lib/repo-files.mjs';

export const READ_CAP = 512 * 1024;
export const MAX_CONTENT = 256 * 1024;
export const MAX_LINE = 2000;

function toPosix(p) {
  return p.split(sep).join('/');
}

// NOISE EXCLUSIONS (2026-10-07): test/spec/fixture files are the dominant
// false-positive source for secret/cookie/security heuristics (fake keys,
// example tokens, mocked configs). Skipped by NAME only, counted in the
// output as skippedTestLike — never silently. Deliberate scope: directory
// names __tests__/__mocks__/fixtures/fixture and file names *.test.* /
// *.spec.* / *.e2e.* / *.min.* / *.example* / *.sample* / _test.go /
// test_*.py. A `tests/` directory is NOT excluded wholesale (real code
// lives there too) — only the unambiguous shapes above.
const SKIP_TEST_DIRS = new Set(['__tests__', '__mocks__', 'fixtures', 'fixture']);
const TEST_LIKE_NAME =
  /\.(test|spec|e2e)\.[^.]+$|\.min\.[^.]+$|\.example(\.|$)|\.sample(\.|$)|_test\.go$|^test_[^/]*\.py$/i;

function walk(dir, base, out, skippedTestLike) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory: skip rather than fail the whole scan
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !SKIP_TEST_DIRS.has(entry.name)) walk(full, base, out, skippedTestLike);
    } else if (entry.isFile()) {
      if (TEST_LIKE_NAME.test(entry.name)) {
        skippedTestLike.push(toPosix(relative(base, full)));
        continue;
      }
      let size = 0;
      try {
        size = statSync(full).size;
      } catch {
        continue; // vanished between readdir and stat: not part of the tree
      }
      out.push({ rel: toPosix(relative(base, full)), full, name: entry.name, size, sensitive: SENSITIVE_NAME.test(entry.name) });
    }
  }
}

/**
 * Submodules that are DECLARED in .gitmodules but NOT checked out. This is a
 * coverage fact, not a rule: `fatfree` (2026-10-07 sweep) holds 1 .php file
 * because its framework lives in an un-initialised `lib` submodule, and the
 * resulting grade read as if the repo had been examined. Heuristic, and
 * labelled as one: a declared path is "uninitialised" when it is missing on
 * disk or when the directory is empty.
 */
function findSubmodules(target) {
  const gm = join(target, '.gitmodules');
  if (!existsSync(gm)) return { declared: [], uninitialised: [] };
  let text;
  try {
    text = readFileSync(gm, 'utf8');
  } catch {
    return { declared: [], uninitialised: [] };
  }
  const declared = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*path\s*=\s*(.+?)\s*$/.exec(line);
    if (m) declared.push(toPosix(m[1]));
  }
  const uninitialised = declared.filter((p) => {
    const full = join(target, p);
    if (!existsSync(full)) return true;
    try {
      return readdirSync(full).length === 0;
    } catch {
      return false;
    }
  });
  return { declared, uninitialised };
}

/**
 * @param {string} target directory to scan
 * @returns {{
 *   baseDir: string,
 *   tree: Array<{rel:string, full:string, name:string, size:number, sensitive:boolean, binary:boolean}>,
 *   readFile: (rel:string) => {content:string, sensitive:boolean} | null,
 *   readText: (rel:string) => {content:string, sensitive:boolean} | null,
 *   readRegexText: (rel:string) => {content:string, sensitive:boolean} | null,
 *   skipLog: Array<{file:string, reason:string, detail:string}>,
 *   exists: (rel:string) => boolean,
 *   skippedIgnored: string[],
 *   skippedTestLike: string[],
 *   submodules: {declared: string[], uninitialised: string[]},
 *   fileCount: number,
 * }}
 */
export function openScanRepo(target) {
  // A missing/unreadable target is NOT a repo with zero files. Without this
  // check the walker caught the readdir error and returned an empty tree, which
  // the report rendered as "0 findings" — a perfect example of coverage read as
  // health. Failing here lets report.mjs write an honest partial report that
  // NAMES the error (defect 1: never zero artifacts, never a silent zero).
  let st;
  try {
    st = statSync(target);
  } catch {
    throw new Error(`target does not exist: ${target}`);
  }
  if (!st.isDirectory()) throw new Error(`target is not a directory: ${target}`);

  const all = [];
  const skippedTestLike = [];
  walk(target, target, all, skippedTestLike);
  all.sort((a, b) => a.rel.localeCompare(b.rel));

  const isIgnored = loadGitignore(target);
  const tree = [];
  const skippedIgnored = [];
  const byRel = new Map();
  const byLowerRel = new Map();

  for (const f of all) {
    if (isIgnored(f.rel)) {
      skippedIgnored.push(f.rel);
      continue;
    }
    const ext = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')).toLowerCase() : '';
    const entry = { rel: f.rel, full: f.full, name: f.name, size: f.size, sensitive: f.sensitive, binary: SKIP_EXT.has(ext) };
    tree.push(entry);
    byRel.set(entry.rel, entry);
    byLowerRel.set(entry.rel.toLowerCase(), entry);
  }

  const resolveRel = (rel) => {
    if (typeof rel !== 'string') return null;
    const clean = rel.trim().replace(/^\.\//, '').split('\\').join('/');
    if (!clean || clean.startsWith('/') || clean.includes('..')) return null;
    return byRel.get(clean) || byLowerRel.get(clean.toLowerCase()) || null;
  };

  // Named skip ledger: one entry per (file, reason), shared by every matcher.
  const skipLog = [];
  const skipKeys = new Set();
  const noteSkip = (rel, reason, detail) => {
    const key = `${reason}|${rel}`;
    if (skipKeys.has(key)) return;
    skipKeys.add(key);
    skipLog.push({ file: rel, reason, detail });
  };

  const readFile = (rel) => {
    const f = resolveRel(rel);
    if (!f || f.binary) return null;
    try {
      if (f.size > READ_CAP) return null;
      return { content: readFileSync(f.full, 'utf8'), sensitive: f.sensitive };
    } catch {
      return null;
    }
  };

  /** Content for matchers that do not run a user-supplied regex over the file. */
  const readText = (rel) => {
    const f = resolveRel(rel);
    if (!f) {
      noteSkip(String(rel), 'unresolved', 'not present in the scanned tree');
      return null;
    }
    if (f.binary) {
      noteSkip(f.rel, 'binary-extension', f.name);
      return null;
    }
    if (f.size > READ_CAP) {
      noteSkip(f.rel, 'oversize-read-cap', `${f.size} bytes > READ_CAP ${READ_CAP}`);
      return null;
    }
    let content;
    try {
      content = readFileSync(f.full, 'utf8');
    } catch (e) {
      noteSkip(f.rel, 'unreadable', e?.code ?? String(e));
      return null;
    }
    let lineLen = 0;
    for (let i = 0; i < content.length; i++) {
      const ch = content.charCodeAt(i);
      if (ch === 10 || ch === 13) lineLen = 0;
      else if (++lineLen > MAX_LINE) {
        noteSkip(f.rel, 'long-line', `line longer than MAX_LINE ${MAX_LINE}`);
        return null;
      }
    }
    return { content, sensitive: f.sensitive };
  };

  /**
   * Content for matchers that DO run a user-supplied regex over whole file
   * content — the path MAX_LINE never covered (the 2026-10-07 hang ran inside
   * one exec() on a 34 KB file whose longest line was 178 chars).
   */
  const readRegexText = (rel) => {
    const r = readText(rel);
    if (r === null) return null;
    if (r.content.length > MAX_CONTENT) {
      noteSkip(resolveRel(rel).rel, 'oversize-content', `${r.content.length} chars > MAX_CONTENT ${MAX_CONTENT}`);
      return null;
    }
    return r;
  };

  return {
    baseDir: target,
    tree,
    readFile,
    readText,
    readRegexText,
    skipLog,
    exists: (rel) => resolveRel(rel) !== null,
    skippedIgnored,
    skippedTestLike,
    submodules: findSubmodules(target),
    fileCount: tree.length,
  };
}

/** (count, first `max` names, omitted) — an honest, bounded name list. */
export function nameList(arr, max = 200) {
  const list = Array.isArray(arr) ? arr : [];
  return { count: list.length, names: list.slice(0, max), omitted: Math.max(0, list.length - max) };
}
