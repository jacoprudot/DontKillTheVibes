/**
 * repo-files.mjs — repository walking + sensitive-file filtering (shared helper).
 *
 * Used by scripts/dktv-orchestrate.mjs (B2 multi-agent orchestrator) so that the
 * per-module "which files do I need?" round and the content round see exactly the
 * same view of the repository, with the same security guarantees as
 * scripts/dktv-assess.mjs:
 *
 *   - binary/asset extensions are listed in the tree but never returned as content
 *   - .gitignore is honored (comments/blank lines skipped; `!` negation ignored,
 *     which can only over-exclude, never leak)
 *   - filenames matching the sensitive deny-list are excluded from the TREE as well
 *     as from content, and counted so a runner can report them
 *
 * The deny-list pattern below MIRRORS scripts/dktv-assess.mjs (SENSITIVE_NAME).
 * If that pattern changes there, change it here in the same commit.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/* ---------- filters (mirror of scripts/dktv-assess.mjs) ---------- */
export const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', '.next', '.turbo', '.nuxt',
  'coverage', '.dontkillthevibes', '.cache', 'target', 'vendor', '__pycache__',
]);

export const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.woff', '.woff2',
  '.ttf', '.eot', '.pdf', '.zip', '.gz', '.tgz', '.tar', '.rar', '.7z', '.mp4',
  '.mp3', '.mov', '.wasm', '.exe', '.dll', '.so', '.dylib', '.jar', '.class',
  '.pyc', '.db', '.sqlite', '.bin', '.lock',
]);

/**
 * Filenames that must never leave the machine: the content of these files is sent
 * to an external LLM endpoint, so they are excluded from content AND tree.
 * Kept byte-identical to SENSITIVE_NAME in scripts/dktv-assess.mjs.
 */
export const SENSITIVE_NAME =
  /(^\.env(\..+)?$|\.(pem|key|p12|pfx|jks|keystore)$|^id_(rsa|ed25519|ecdsa|dsa)(\.|$)|\.(secret|secrets|credentials)$|^credentials(\.|$)|^\.npmrc$|^\.netrc$)/i;

/* ---------- helpers ---------- */
function toPosix(p) {
  return p.split(sep).join('/');
}

/**
 * Minimal .gitignore honoring (comments and blank lines skipped; `!` negation
 * unsupported — negated patterns are ignored, which can only over-exclude, never
 * leak). Same semantics as scripts/dktv-assess.mjs:loadGitignore.
 */
export function loadGitignore(target) {
  const gi = join(target, '.gitignore');
  if (!existsSync(gi)) return () => false;
  let raw;
  try {
    raw = readFileSync(gi, 'utf8');
  } catch {
    return () => false;
  }
  const regexes = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('!'))
    .map((p) => {
      const dirOnly = p.endsWith('/');
      const anchored = p.startsWith('/');
      const pat = p.replace(/^\//, '').replace(/\/$/, '');
      let re = pat
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DOUBLESTAR::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DOUBLESTAR::/g, '.*')
        .replace(/\?/g, '[^/]');
      re = anchored ? `^${re}` : `(^|/)${re}`;
      // dirOnly is deliberately not special-cased: the trailing ($|/) already
      // matches both a file and everything under a directory of that name.
      void dirOnly;
      return new RegExp(`${re}($|/)`);
    });
  return (rel) => regexes.some((r) => r.test(rel));
}

export function extOf(name) {
  return name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
}

export function isSensitiveName(name) {
  return SENSITIVE_NAME.test(name);
}

function walk(dir, base, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory: skip rather than fail the whole run
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, base, out);
    } else if (entry.isFile()) {
      out.push({
        rel: toPosix(relative(base, full)),
        full,
        name: entry.name,
        ext: extOf(entry.name),
      });
    }
  }
}

/**
 * Walk a target directory.
 *
 * @param {string} target absolute (or cwd-relative) directory to walk
 * @returns {{
 *   tree: string[],
 *   readFile: (rel: string) => string|null,
 *   withheldSensitive: string[],
 *   skippedIgnored: string[],
 *   binaryFiles: string[],
 *   exists: (rel: string) => boolean,
 *   fileCount: number,
 * }}
 *
 * `tree` is repo-relative, posix-separated, sorted. It contains names only —
 * gitignored files and sensitive files never appear in it. `readFile` returns
 * null (never content) for anything outside the tree, which is what makes the
 * deny-list impossible to bypass by asking for a path directly.
 */
export function openRepo(target) {
  const all = [];
  walk(target, target, all);
  all.sort((a, b) => a.rel.localeCompare(b.rel));

  const isIgnored = loadGitignore(target);
  const tree = [];
  const withheldSensitive = [];
  const skippedIgnored = [];
  const binaryFiles = [];
  const byRel = new Map();
  const byLowerRel = new Map();

  for (const f of all) {
    if (isSensitiveName(f.name)) {
      withheldSensitive.push(f.rel);
      continue;
    }
    if (isIgnored(f.rel)) {
      skippedIgnored.push(f.rel);
      continue;
    }
    tree.push(f.rel);
    byRel.set(f.rel, f);
    byLowerRel.set(f.rel.toLowerCase(), f);
    if (SKIP_EXT.has(f.ext)) binaryFiles.push(f.rel);
  }

  const resolveRel = (rel) => {
    if (typeof rel !== 'string') return null;
    const clean = rel.trim().replace(/^\.\//, '').split('\\').join('/');
    if (!clean || clean.startsWith('/') || clean.includes('..')) return null;
    return byRel.get(clean) || byLowerRel.get(clean.toLowerCase()) || null;
  };

  const exists = (rel) => resolveRel(rel) !== null;

  /** @returns {string|null} file content, or null if not in the tree / binary / unreadable */
  const readFile = (rel) => {
    const f = resolveRel(rel);
    if (!f) return null;             // not in tree (ignored, sensitive, absent)
    if (SKIP_EXT.has(f.ext)) return null; // binary/asset: never read as text
    try {
      if (statSync(f.full).size > 20 * 1024 * 1024) return null; // refuse absurd files
      return readFileSync(f.full, 'utf8');
    } catch {
      return null;
    }
  };

  return {
    baseDir: target,
    tree,
    readFile,
    withheldSensitive,
    skippedIgnored,
    binaryFiles,
    exists,
    fileCount: tree.length,
  };
}
