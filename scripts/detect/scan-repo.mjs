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
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SKIP_DIRS, SKIP_EXT, SENSITIVE_NAME, loadGitignore } from '../lib/repo-files.mjs';

function toPosix(p) {
  return p.split(sep).join('/');
}

function walk(dir, base, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory: skip rather than fail the whole scan
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, base, out);
    } else if (entry.isFile()) {
      out.push({ rel: toPosix(relative(base, full)), full, name: entry.name, sensitive: SENSITIVE_NAME.test(entry.name) });
    }
  }
}

/**
 * @param {string} target directory to scan
 * @returns {{
 *   baseDir: string,
 *   tree: Array<{rel:string, full:string, name:string, sensitive:boolean, binary:boolean}>,
 *   readFile: (rel:string) => {content:string, sensitive:boolean} | null,
 *   exists: (rel:string) => boolean,
 *   skippedIgnored: string[],
 *   fileCount: number,
 * }}
 */
export function openScanRepo(target) {
  const all = [];
  walk(target, target, all);
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
    const entry = { rel: f.rel, full: f.full, name: f.name, sensitive: f.sensitive, binary: SKIP_EXT.has(ext) };
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

  const readFile = (rel) => {
    const f = resolveRel(rel);
    if (!f || f.binary) return null;
    try {
      if (statSync(f.full).size > 20 * 1024 * 1024) return null;
      return { content: readFileSync(f.full, 'utf8'), sensitive: f.sensitive };
    } catch {
      return null;
    }
  };

  return {
    baseDir: target,
    tree,
    readFile,
    exists: (rel) => resolveRel(rel) !== null,
    skippedIgnored,
    fileCount: tree.length,
  };
}
