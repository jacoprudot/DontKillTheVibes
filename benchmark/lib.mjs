/**
 * benchmark/lib.mjs — shared plumbing for the DontKillTheVibes benchmark harness.
 *
 * Zero dependencies beyond the Node standard library (Node >= 20).
 *
 * WHY THERE IS A CUSTOM "run()" HERE — READ BEFORE CHANGING IT
 * ------------------------------------------------------------
 * This harness is normally run in a confined sandbox where spawning a child
 * process with PIPED stdio fails with `spawn EPERM`. That is the documented
 * sandbox boundary, not a bug in the harness or in Node.
 *
 * So every child process spawned here redirects stdout+stderr to a FILE on
 * disk (an fd opened on a log file) instead of a pipe, and the file is read
 * back afterwards. `stdio: 'ignore'` also works. `stdio: 'pipe'` does NOT work
 * in the sandbox and must not be reintroduced.
 *
 * Consequence to know about: `scripts/dktv-assess.mjs` itself uses
 * `spawnSync(..., { encoding: 'utf8' })` internally to run
 * `scripts/validate-assessment.mjs`, which is a piped spawn. A REAL (non-mock)
 * toolkit-arm run therefore inherits that limitation in a confined sandbox.
 * In `--mock` mode the generated mock runner validates WITHOUT a child process
 * (it imports the validator contract check itself), so the mock end-to-end run
 * is fully verifiable offline.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

export const BENCH_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
export const REPO_ROOT = resolve(BENCH_DIR, '..');
export const WORK_DIR = join(BENCH_DIR, 'work');
export const RESULTS_DIR = join(BENCH_DIR, 'results');
export const TMP_DIR = join(BENCH_DIR, 'tmp');

export const MOCK_BANNER_MD = [
  '> **MOCK OUTPUT - NOT A REAL ASSESSMENT.**',
  '> Produced by `--mock` mode, which makes no network calls and no clones.',
  '> Every claim below is an obviously-fake placeholder. Do not cite it, do not',
  '> compare it against real results, and do not commit it as evidence.',
].join('\n');

export function log(msg) {
  process.stdout.write(`${msg}\n`);
}

export function ok(msg) {
  process.stdout.write(`  OK   ${msg}\n`);
}

export function warn(msg) {
  process.stdout.write(`  WARN ${msg}\n`);
}

export function fail(msg) {
  process.stderr.write(`  FAIL ${msg}\n`);
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  ensureDir(dirname(file));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

export function writeText(file, text) {
  ensureDir(dirname(file));
  writeFileSync(file, text, 'utf8');
  return file;
}

/** POSIX-style, repo-relative path (the format the toolkit's digest uses). */
export function relPosix(base, full) {
  return relative(base, full).split('\\').join('/');
}

/**
 * Minimal, dependency-free CLI parser.
 * spec: { flagName: 'boolean' | 'string' | 'number' }
 */
export function parseCli(argv, spec) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--?/, '');
    const canon = Object.keys(spec).find((k) => k === key);
    if (!canon) throw new Error(`unknown argument: ${argv[i]}`);
    if (spec[canon] === 'boolean') {
      out[canon] = true;
    } else {
      const value = argv[++i];
      if (value === undefined) throw new Error(`--${canon} requires a value`);
      out[canon] = spec[canon] === 'number' ? Number.parseInt(value, 10) : value;
    }
  }
  return out;
}

let runCounter = 0;

/**
 * Run a command with stdout+stderr redirected to a file (never a pipe).
 * Resolves with { status, signal, output, logFile } — it does NOT throw on a
 * non-zero exit, so callers decide what a failure means.
 */
export async function run(command, args, options = {}) {
  const { cwd = REPO_ROOT, env } = options;
  ensureDir(TMP_DIR);
  const logFile = join(TMP_DIR, `spawn-${process.pid}-${runCounter++}.log`);
  const fd = openSync(logFile, 'w');
  let child;
  try {
    child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', fd, fd], // file redirection, never 'pipe' (EPERM in sandbox)
      windowsHide: true,
    });
  } catch (e) {
    closeSync(fd);
    return { status: null, signal: null, output: `spawn failed: ${e.message}`, logFile, spawnError: e };
  }
  const result = await new Promise((res) => {
    child.on('error', (e) => res({ status: null, signal: null, spawnError: e }));
    child.on('close', (status, signal) => res({ status, signal }));
  });
  try {
    closeSync(fd);
  } catch { /* already closed by the child's exit */ }
  let output = '';
  try {
    output = readFileSync(logFile, 'utf8');
  } catch { /* no log produced */ }
  try {
    rmSync(logFile, { force: true });
  } catch { /* best effort */ }
  if (result.spawnError) {
    return { ...result, output: `${output}\nspawn error: ${result.spawnError.message}`.trim(), logFile };
  }
  return { ...result, output, logFile };
}

/** "git rev-parse HEAD" without a pipe: git writes the SHA to a file via -o. */
export async function gitHead(cloneDir) {
  ensureDir(TMP_DIR);
  const headFile = join(TMP_DIR, `head-${process.pid}-${runCounter++}.txt`);
  const r = await run('git', ['-C', cloneDir, 'rev-parse', 'HEAD'], {});
  // `rev-parse` prints to stdout, which is already a file; reuse that output.
  if (r.status === 0) {
    const sha = r.output.trim().split(/\r?\n/).filter(Boolean).pop();
    if (sha && /^[0-9a-f]{7,40}$/i.test(sha)) return sha;
  }
  // Fallback: resolve HEAD from the git plumbing on disk (works for a shallow clone).
  try {
    const gitDirRaw = readFileSync(join(cloneDir, '.git'), 'utf8').trim();
    const gitDir = gitDirRaw.startsWith('gitdir:')
      ? resolve(cloneDir, gitDirRaw.slice('gitdir:'.length).trim())
      : join(cloneDir, '.git');
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
    if (/^[0-9a-f]{40}$/i.test(head)) return head;
    const refPath = join(gitDir, head.replace(/^ref:\s*/, ''));
    if (existsSync(refPath)) return readFileSync(refPath, 'utf8').trim();
  } catch { /* fall through */ }
  rmSync(headFile, { force: true });
  return null;
}

export function hasGit() {
  return new Promise(async (res) => {
    const r = await run('git', ['--version'], {});
    res(r.status === 0);
  });
}

export function isHelp(argv) {
  return argv.includes('--help') || argv.includes('-h');
}
