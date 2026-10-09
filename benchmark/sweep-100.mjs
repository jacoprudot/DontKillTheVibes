#!/usr/bin/env node
/**
 * sweep-100.mjs — the deterministic sweep over the pre-registered 100-target sample.
 *
 * ONE COMMAND, ONE HONEST TABLE:
 *
 *   node benchmark/sweep-100.mjs
 *
 * reads benchmark/targets-100.json, runs scripts/detect/report.mjs once per target
 * against benchmark/work100/<name>, and writes:
 *
 *   benchmark/sweep-100/SWEEP-100.json  machine record, one object per target
 *   benchmark/sweep-100/SWEEP-100.md    the publishable human summary
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The 2026-10-07 sweep (benchmark/detect-sweep-2026-10-07/) was aggregated by hand,
 * and hand-aggregation is where an honest tool starts lying. Three specific defects
 * this harness exists to prevent, each one named in the code that handles it:
 *
 *   1. A TIMEOUT IS NOT A ZERO. The project has already been burned by a rule that
 *      never returned (code-many-params-10; the whole run produced ZERO artifacts for
 *      2 of 21 repos). Every child here is bounded by a hard wall-clock timeout
 *      (default 180 s, --timeout to change it) and a timed-out repo is recorded as
 *      status TIMEOUT with every count left null — never 0.
 *
 *   2. A SHALLOW CLONE IS NOT A REPOSITORY. Every git-history rule silently refuses
 *      on a shallow checkout and names SHALLOW_CHECKOUT in cap_truncations. On the
 *      demo snapshot that produced "0 github findings" for a repo whose history was
 *      never fetched. Each target's `git rev-list --count HEAD` is measured BEFORE
 *      the scan and any target with 1 commit is marked SHALLOW; the summary states
 *      how many are shallow and that any history statistic over them is VOID.
 *
 *   3. A REPO WITH ZERO FINDINGS IS NOT CLEAN. The per-area status table
 *      ("NOT EVALUATED" / SIN MOTOR / PARCIAL) survives into the summary, and
 *      detector findings whose remediation is the report's fallback string are NOT
 *      counted as "with a real remediation attached".
 *
 * SANDBOX NOTE (same as scripts/registry-diff.mjs): this repo's Windows sandbox DENIES
 * piped child stdio with EPERM. Every child process here — node and git alike — gets
 * FILE DESCRIPTORS for stdout/stderr, which are read back from disk. Never pass
 * `{ encoding: 'utf8' }` or `{ input: ... }` to a spawn in this file: both mean a pipe.
 *
 * Usage:
 *   node benchmark/sweep-100.mjs [options]
 *
 *   --targets <file>   target list JSON (default: benchmark/targets-100.json)
 *   --work-dir <dir>   where the clones live (default: benchmark/work100)
 *   --out-dir <dir>    where SWEEP-100.{json,md} and runs/ go (default: benchmark/sweep-100)
 *   --report <file>    the report assembler to run (default: scripts/detect/report.mjs)
 *   --timeout <sec>    hard per-repo timeout in seconds (default: 180)
 *   --only <a,b,c>     run just these target names (the aggregate still covers only them)
 *   --help
 *
 * Exit: 0 = every target completed; 1 = at least one target timed out or failed;
 *       2 = usage / the target list could not be read (no partial artifacts written).
 *
 * Dependency-free: node builtins only, ESM.
 */
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, statSync,
  openSync, closeSync, rmSync,
} from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TARGETS = join(REPO_ROOT, 'benchmark', 'targets-100.json');
const DEFAULT_WORK_DIR = join(REPO_ROOT, 'benchmark', 'work100');
const DEFAULT_OUT_DIR = join(REPO_ROOT, 'benchmark', 'sweep-100');
const DEFAULT_REPORT = join(REPO_ROOT, 'scripts', 'detect', 'report.mjs');
const DEFAULT_TIMEOUT_S = 180;

/**
 * The report assembler's fallback string (scripts/detect/report.mjs line ~118). A
 * finding carrying THIS text has no remediation in its rule; it must never be
 * counted as "produced a critical/high finding with a real remediation attached".
 * Its occurrence count is also the CRLF regression sentinel and must be 0.
 */
const NO_REMEDIATION = 'no remediation text in the rule';

/** The bulk artifacts the summary deliberately excludes (see benchmark/.gitignore). */
const BULK_ARTIFACTS = ['findings.json', 'report.md', 'prompts.md'];

/* ------------------------------------------------------------------ args -- */

function usage(code) {
  const stream = code === 0 ? process.stdout : process.stderr;
  stream.write(`usage: node benchmark/sweep-100.mjs [--targets <file>] [--work-dir <dir>] [--out-dir <dir>] [--report <file>] [--timeout <sec>] [--only a,b,c]\n`);
  process.exit(code);
}

const argv = process.argv.slice(2);
const opts = {
  targets: DEFAULT_TARGETS,
  workDir: DEFAULT_WORK_DIR,
  outDir: DEFAULT_OUT_DIR,
  report: DEFAULT_REPORT,
  timeoutS: DEFAULT_TIMEOUT_S,
  only: null,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') usage(0);
  else if (a === '--targets') opts.targets = argv[++i];
  else if (a === '--work-dir') opts.workDir = argv[++i];
  else if (a === '--out-dir') opts.outDir = argv[++i];
  else if (a === '--report') opts.report = argv[++i];
  else if (a === '--timeout') opts.timeoutS = Number(argv[++i]);
  else if (a === '--only') opts.only = String(argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  else { console.error(`Unknown option: ${a}`); usage(2); }
}
if (opts.only && opts.only.length === 0) { console.error('--only was given but listed no target name.'); usage(2); }

const TARGETS_PATH = resolve(opts.targets);
const WORK_DIR = resolve(opts.workDir);
const OUT_DIR = resolve(opts.outDir);
const REPORT_SCRIPT = resolve(opts.report);
const RUNS_DIR = join(OUT_DIR, 'runs');
const TIMEOUT_MS = opts.timeoutS * 1000;
if (!Number.isFinite(TIMEOUT_MS) || TIMEOUT_MS <= 0) { console.error(`--timeout must be a positive number of seconds (got ${opts.timeoutS}).`); usage(2); }

/* --------------------------------------------------------------- helpers -- */

/**
 * Run one child with every stream on a FILE DESCRIPTOR and a hard wall-clock
 * timeout. Returns { status, signal, timedOut, spawnError, stdout, stderr, seconds }.
 *
 * On timeout spawnSync kills the direct child and sets `error.code === 'ETIMEDOUT'`;
 * because the report assembler is a node process whose own children (git) would
 * survive it on Windows, the pid tree is explicitly killed afterwards. That is the
 * exact failure the 2026-10-07 hang produced: a bounded run that left work behind.
 */
function runBounded(cmd, args, { timeoutMs, outFile, errFile }) {
  const outFd = openSync(outFile, 'w');
  const errFd = openSync(errFile, 'w');
  const started = Date.now();
  let res;
  try {
    res = spawnSync(cmd, args, { stdio: ['ignore', outFd, errFd], timeout: timeoutMs, windowsHide: true });
  } catch (e) {
    res = { error: e, status: null, signal: null };
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
  const seconds = (Date.now() - started) / 1000;

  const timedOut = res.error?.code === 'ETIMEDOUT' || (res.signal === 'SIGTERM' && res.status === null);
  if (timedOut && res.pid) {
    // Best effort, never fatal: the artifacts already written stay the evidence.
    try { spawnSync('taskkill', ['/PID', String(res.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 15000 }); } catch { /* keep going */ }
  }

  const readBack = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
  return {
    status: res.status,
    signal: res.signal ?? null,
    pid: res.pid ?? null,
    timedOut,
    cancelled: res.error?.code === 'ENOENT' ? false : res.error?.code === 'ABORT_ERR',
    spawnError: res.error && res.error.code !== 'ETIMEDOUT' ? (res.error.code ?? res.error.message) : null,
    stdout: readBack(outFile),
    stderr: readBack(errFile),
    seconds,
  };
}

/**
 * The commit count, and whether git itself says the checkout is shallow, for ONE
 * target. Captured through file descriptors (the sandbox note at the top) and never
 * inferred from the report: a repo can be shallow without a single history rule
 * having run, and `--depth 1` clones carry a `.git/shallow` marker.
 *
 * A target that is not a git checkout at all (the demo snapshot is one) is NAMED,
 * not silently treated as "0 commits".
 *
 * Bounded at 60 s each: a `git rev-list --count` on a full clone of a huge repository
 * is a real cost, and this probe must not become the hang the detector itself was
 * fixed for. A probe that times out yields `commitCount: null` and a NAMED git_error —
 * which the row reports as "not measured", never as 1 (which would fake SHALLOW).
 */
function probeGit(dir, scratch) {
  const isGit = existsSync(join(dir, '.git'));
  if (!isGit) {
    return { isGit: false, shallowMarker: false, shallowReported: null, commitCount: null, head: null, error: null };
  }
  const marker = existsSync(join(dir, '.git', 'shallow'));

  const countOut = join(scratch, 'git-count.txt');
  const countErr = join(scratch, 'git-count.err');
  const r = runBounded('git', ['-C', dir, 'rev-list', '--count', 'HEAD'], { timeoutMs: 60000, outFile: countOut, errFile: countErr });

  // git's own answer, which stays correct for a full clone with an explicit
  // `--shallow-since` boundary (no .git/shallow marker, still a partial history).
  const shOut = join(scratch, 'git-shallow.txt');
  const shErr = join(scratch, 'git-shallow.err');
  const sh = runBounded('git', ['-C', dir, 'rev-parse', '--is-shallow-repository'], { timeoutMs: 60000, outFile: shOut, errFile: shErr });
  const shallowReported = sh.status === 0 ? sh.stdout.trim() === 'true' : null;

  const headOut = join(scratch, 'git-head.txt');
  const headErr = join(scratch, 'git-head.err');
  const h = runBounded('git', ['-C', dir, 'rev-parse', 'HEAD'], { timeoutMs: 60000, outFile: headOut, errFile: headErr });

  const rawCount = r.stdout.trim();
  const commitCount = r.status === 0 && /^\d+$/.test(rawCount) ? Number(rawCount) : null;
  const head = h.status === 0 ? h.stdout.trim() || null : null;
  let error = null;
  if (commitCount === null) {
    error = `git rev-list --count HEAD failed (exit ${r.status}${r.timedOut ? ', TIMEOUT at 60s' : ''}): ${(r.stderr.trim() || 'no stderr').split('\n')[0]}`;
  } else if (head === null) {
    error = `git rev-parse HEAD failed (exit ${h.status}): ${(h.stderr.trim() || 'no stderr').split('\n')[0]}`;
  }
  return { isGit: true, shallowMarker: marker, shallowReported, commitCount, head, error };
}

/** The repo's own frozen revision + tag, for the summary header. */
function repoRevision() {
  const scratch = join(tmpdir(), `dktv-sweep-self-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  const revOut = join(scratch, 'rev.txt');
  const revErr = join(scratch, 'rev.err');
  const rev = runBounded('git', ['-C', REPO_ROOT, 'rev-parse', '--short', 'HEAD'], { timeoutMs: 30000, outFile: revOut, errFile: revErr });
  const tagOut = join(scratch, 'tag.txt');
  const tagErr = join(scratch, 'tag.err');
  const tag = runBounded('git', ['-C', REPO_ROOT, 'describe', '--tags', '--exact-match', 'HEAD'], { timeoutMs: 30000, outFile: tagOut, errFile: tagErr });
  try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
  return {
    revision: rev.status === 0 ? rev.stdout.trim() : null,
    revisionError: rev.status === 0 ? null : (rev.stderr.trim().split('\n')[0] || 'git rev-parse failed'),
    tag: tag.status === 0 ? tag.stdout.trim() : null,
  };
}

const sha256Like = (p) => {
  try { return statSync(p).size; } catch { return null; }
};

/* ------------------------------------------------------------ read input -- */

if (!existsSync(TARGETS_PATH)) {
  console.error(`Target list not found: ${TARGETS_PATH}`);
  console.error('');
  console.error('This is the pre-registered 100-target sample manifest. It is written by the');
  console.error('clone agent (benchmark/targets-100.json, shape: { selection_rule, frozen_at,');
  console.error('clone, targets: [{ name, url, commit, stars, language, signals, primary_stack }] }).');
  console.error('Nothing was run and no sweep artifacts were written.');
  console.error('');
  console.error(`Run it once the file exists, or point at another list: node benchmark/sweep-100.mjs --targets <file>`);
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(TARGETS_PATH, 'utf8'));
} catch (e) {
  console.error(`Target list is not valid JSON: ${TARGETS_PATH}\n  ${e.message}`);
  console.error('Nothing was run and no sweep artifacts were written.');
  process.exit(2);
}

const targets = Array.isArray(manifest?.targets) ? manifest.targets : null;
if (!targets || targets.length === 0) {
  console.error(`Target list has no "targets" array with entries: ${TARGETS_PATH}`);
  console.error('Nothing was run and no sweep artifacts were written.');
  process.exit(2);
}

const malformed = targets.filter((t) => !t || typeof t.name !== 'string' || t.name.length === 0);
if (malformed.length > 0) {
  console.error(`Target list has ${malformed.length} entr(ies) with no "name": ${TARGETS_PATH}`);
  console.error(`Every target needs a name to point at ${WORK_DIR}/<name>. Nothing was run.`);
  process.exit(2);
}

const selected = opts.only ? targets.filter((t) => opts.only.includes(t.name)) : targets;
if (opts.only) {
  const missing = opts.only.filter((n) => !targets.some((t) => t.name === n));
  if (missing.length > 0) { console.error(`--only names not present in the target list: ${missing.join(', ')}`); process.exit(2); }
}

if (!existsSync(REPORT_SCRIPT)) {
  console.error(`Report assembler not found: ${REPORT_SCRIPT}`);
  console.error('Nothing was run and no sweep artifacts were written.');
  process.exit(2);
}

/* --------------------------------------------------------------- the run -- */

const startedAt = new Date();
const rev = repoRevision();

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(RUNS_DIR, { recursive: true });
const scratch = join(tmpdir(), `dktv-sweep-100-${process.pid}`);
mkdirSync(scratch, { recursive: true });

console.log(`sweep-100 · ${selected.length}${opts.only ? ` of ${targets.length}` : ''} target(s) · timeout ${opts.timeoutS}s/repo`);
console.log(`  targets : ${TARGETS_PATH}`);
console.log(`  clones  : ${WORK_DIR}`);
console.log(`  output  : ${OUT_DIR}`);
console.log(`  revision: ${rev.revision ?? `UNAVAILABLE (${rev.revisionError})`}${rev.tag ? ` (tag ${rev.tag})` : ''}`);
console.log('');

const rows = [];
let index = 0;
for (const t of selected) {
  index++;
  const name = t.name;
  const dir = join(WORK_DIR, name);
  const runDir = join(RUNS_DIR, name);
  mkdirSync(runDir, { recursive: true });

  const stdoutFile = join(runDir, 'stdout.txt');
  const stderrFile = join(runDir, 'stderr.txt');
  const exitFile = join(runDir, 'exit.txt');
  const cmdFile = join(runDir, 'run.cmd');

  // ---- row skeleton: every field present on every row, null where not measured.
  const row = {
    name,
    url: t.url ?? null,
    commit: t.commit ?? null,
    resolved_head: null,
    commit_matches_manifest: null,
    stars: t.stars ?? null,
    language: t.language ?? null,
    primary_stack: t.primary_stack ?? null,
    signals: Array.isArray(t.signals) ? t.signals : [],

    status: null,              // OK | OK (exit N) | TIMEOUT | FAILED | TARGET_MISSING
    checkout: null,            // GIT_CHECKOUT | SHALLOW_CHECKOUT | NOT_GIT_WORKTREE | MISSING
    note: null,
    seconds: null,
    exit_code: null,
    signal: null,

    is_git: null,
    git_commit_count: null,
    git_shallow_marker: null,
    git_shallow_reported: null,
    shallow: null,
    git_error: null,

    total_findings: null,
    detector_findings: null,
    ausencia_findings: null,
    critical: null,
    high: null,
    critical_high: null,
    critical_high_with_real_remediation: null,
    no_remediation_sentinel: null,
    grade_letter: null,
    grade_display: null,
    grade_coverage_limited: null,
    grade_letter_capped: null,
    area_verdicts: [],
    degraded_count: null,
    degraded_rules: [],
    rule_failures_count: null,
    rule_failures: [],
    cap_truncation_count: null,
    cap_truncated_rules: [],
    shallow_checkout_caps: 0,
    coverage_files_total: null,
    coverage_files_text: null,
    coverage_files_not_analysed: null,
    coverage_pct_not_examined: null,
    coverage_files_refused_by_read_guards: null,
    fatal_error: null,
    artifacts_written: [],
    artifacts_missing: [],
    run_dir: relative(REPO_ROOT, runDir).split('\\').join('/'),
  };

  const git = probeGit(dir, scratch);
  row.is_git = git.isGit;
  row.git_commit_count = git.commitCount;
  row.git_shallow_marker = git.shallowMarker;
  row.git_shallow_reported = git.shallowReported;
  row.git_error = git.error;
  row.resolved_head = git.head;
  // Does the tree that was actually scanned carry the commit the manifest pinned?
  // A clone that drifted (or an unpinned placeholder) is recorded, never assumed:
  // "we swept commit X" is a claim about the bytes that were measured.
  row.commit_matches_manifest = (git.head && typeof t.commit === 'string' && t.commit.length >= 7)
    ? (git.head === t.commit || git.head.startsWith(t.commit) || t.commit.startsWith(git.head))
    : null;
  // SHALLOW means one of three independently recorded facts, ORed so no single one can
  // hide it: git's own `--is-shallow-repository`, a `.git/shallow` marker, or a single
  // visible commit (the `--depth 1` shape, and what the brief pins the mark on). An
  // unmeasurable commit count is NOT shallow — it is null and named in git_error.
  row.shallow = git.isGit
    ? Boolean(git.shallowReported === true || git.shallowMarker || git.commitCount === 1)
    : null;

  const flags = [];
  if (!git.isGit) flags.push('NOT A GIT CHECKOUT');
  if (row.shallow) flags.push('SHALLOW');
  if (git.shallowMarker && git.commitCount !== null && git.commitCount !== 1) flags.push(`${git.commitCount} commits visible`);

  // ---- not a checkout / not cloned at all: named, never silently aggregated.
  if (!existsSync(dir)) {
    row.status = 'TARGET_MISSING';
    row.checkout = 'MISSING';
    row.note = `clone directory not found: ${relative(REPO_ROOT, dir).split('\\').join('/')}`;
    rows.push(row);
    console.log(`[${index}/${selected.length}] ${name.padEnd(34)} TARGET_MISSING — ${row.note}`);
    continue;
  }
  if (!git.isGit) {
    row.checkout = 'NOT_GIT_WORKTREE';
    row.note = 'no .git directory: the deterministic engine scans it as a file tree, but no history rule can run (the demo snapshot is this case)';
  } else if (row.shallow) {
    row.checkout = 'SHALLOW_CHECKOUT';
  } else {
    row.checkout = 'GIT_CHECKOUT';
  }

  // ---- run the assembler, bounded. Never reimplemented here: report.mjs owns detection.
  const args = [REPORT_SCRIPT, '--target', dir, '--out', runDir];
  writeFileSync(cmdFile, `"${process.execPath}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}\n`);
  console.log(`[${index}/${selected.length}] ${name.padEnd(34)} running…${flags.length ? ` [${flags.join(', ')}]` : ''}`);
  const run = runBounded(process.execPath, args, { timeoutMs: TIMEOUT_MS, outFile: stdoutFile, errFile: stderrFile });
  writeFileSync(exitFile, `${run.status === null ? '' : run.status}\n`);

  row.seconds = Math.round(run.seconds * 10) / 10;
  row.exit_code = run.status;
  row.signal = run.signal;

  // Artifact census BEFORE parsing: a missing artifact is a statement, not an empty result.
  for (const f of BULK_ARTIFACTS) {
    if (existsSync(join(runDir, f))) row.artifacts_written.push(f);
    else row.artifacts_missing.push(f);
  }

  if (run.timedOut) {
    row.status = 'TIMEOUT';
    row.note = `${row.note ? `${row.note} · ` : ''}exceeded the ${opts.timeoutS}s wall-clock timeout and was killed; every count on this row is NULL, not 0 — a killed run measured nothing`;
    rows.push(row);
    console.log(`[${index}/${selected.length}] ${name.padEnd(34)} TIMEOUT after ${row.seconds}s — no counts, not a zero`);
    continue;
  }

  const findingsPath = join(runDir, 'findings.json');
  if (!existsSync(findingsPath)) {
    row.status = 'FAILED';
    row.note = `report.mjs exited ${run.status ?? '(no exit code)'}${run.spawnError ? ` (${run.spawnError})` : ''} and wrote no findings.json; stderr: ${(run.stderr.trim().split('\n')[0] || 'empty').slice(0, 200)}`;
    rows.push(row);
    console.log(`[${index}/${selected.length}] ${name.padEnd(34)} FAILED — ${row.note}`);
    continue;
  }

  let doc;
  try {
    doc = JSON.parse(readFileSync(findingsPath, 'utf8'));
  } catch (e) {
    row.status = 'FAILED';
    row.note = `findings.json exists but could not be parsed: ${e.message}`;
    rows.push(row);
    console.log(`[${index}/${selected.length}] ${name.padEnd(34)} FAILED — ${row.note}`);
    continue;
  }

  // ---- extract. Every number is read from the document; nothing is inferred.
  const all = Array.isArray(doc.findings) ? doc.findings : [];
  const detectors = all.filter((f) => f.type === 'detector');
  const ausencia = all.filter((f) => f.type === 'ausencia');
  const ch = detectors.filter((f) => f.severity === 'critical' || f.severity === 'high');
  const noRem = all.filter((f) => typeof f.remediation === 'string' && f.remediation.includes(NO_REMEDIATION));

  const caps = Array.isArray(doc.cap_truncations) ? doc.cap_truncations : [];
  const realCaps = caps.filter((c) => typeof c.cap === 'number');
  const shallowCaps = caps.filter((c) => typeof c.cap === 'string' && c.cap.includes('SHALLOW_CHECKOUT'));
  const cov = doc.coverage ?? null;

  row.status = run.status === 0 ? 'OK' : 'OK (exit ' + run.status + ')';
  if (run.status !== 0) row.note = `report.mjs exited ${run.status} (a fatal scan error is written INTO the report); see ${row.run_dir}`;

  const totalFindings = detectors.length + ausencia.length;
  row.total_findings = totalFindings;
  row.detector_findings = detectors.length;
  row.ausencia_findings = ausencia.length;
  row.critical = detectors.filter((f) => f.severity === 'critical').length;
  row.high = detectors.filter((f) => f.severity === 'high').length;
  row.critical_high = ch.length;
  row.critical_high_with_real_remediation = ch.filter((f) => !(typeof f.remediation === 'string' && f.remediation.includes(NO_REMEDIATION))).length;
  row.no_remediation_sentinel = noRem.length;
  row.grade_letter = doc.grade?.letter ?? null;
  row.grade_display = doc.grade?.display ?? null;
  row.grade_coverage_limited = doc.grade?.coverageLimited ?? null;
  row.grade_letter_capped = doc.grade?.letterCapped ?? null;
  row.area_verdicts = Array.isArray(doc.area_verdicts) ? doc.area_verdicts : [];
  row.degraded_count = Array.isArray(doc.degraded) ? doc.degraded.length : (doc.counts?.degraded ?? null);
  row.degraded_rules = [...new Set((Array.isArray(doc.degraded) ? doc.degraded : []).map((d) => d?.rule).filter(Boolean))];
  const rf = Array.isArray(doc.rule_failures) ? doc.rule_failures : [];
  row.rule_failures_count = rf.length;
  row.rule_failures = rf.map((f) => ({ rule: f?.rule ?? null, reason: f?.reason ?? null }));
  row.cap_truncation_count = realCaps.length;
  row.cap_truncated_rules = realCaps.map((c) => c.rule);
  row.shallow_checkout_caps = shallowCaps.length;
  if (cov) {
    row.coverage_files_total = cov.files_total ?? null;
    row.coverage_files_text = cov.files_text ?? null;
    row.coverage_files_not_analysed = cov.files_not_analysed ?? null;
    row.coverage_pct_not_examined = typeof cov.uncovered_ratio === 'number'
      ? Math.round(cov.uncovered_ratio * 1000) / 10
      : (typeof cov.files_not_analysed === 'number' && typeof cov.files_text === 'number' && cov.files_text > 0
        ? Math.round((cov.files_not_analysed / cov.files_text) * 1000) / 10 : null);
    row.coverage_files_refused_by_read_guards = cov.files_refused_by_read_guards ?? null;
  } else {
    row.note = `${row.note ? `${row.note} · ` : ''}coverage block is ABSENT: the scan failed before it was computed — treat every count as unknown, not as zero`;
  }
  row.fatal_error = doc.fatal_error ? { message: doc.fatal_error.message ?? null } : null;

  rows.push(row);
  const bits = [`${row.seconds}s`, `grade ${row.grade_display ?? '?'}`, `det ${row.detector_findings}`, `crit+high ${row.critical_high}`, `gaps ${row.ausencia_findings}`, `cov-not-examined ${row.coverage_pct_not_examined ?? '?'}%`];
  if (row.shallow) bits.push('SHALLOW');
  console.log(`[${index}/${selected.length}] ${name.padEnd(34)} ${row.status.padEnd(4)} ${bits.join(' · ')}`);
}

try { rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }

/* ------------------------------------------------------------ aggregate -- */

const finishedAt = new Date();

/** Bounded-but-honest aggregate: nulls are EXCLUDED from sums and the exclusion is stated. */
const numbers = (key) => rows.map((r) => r[key]).filter((v) => typeof v === 'number');

const tally = (list) => {
  const m = new Map();
  for (const v of list) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
};

/** `tally` as an object, for the JSON contract (a Map serializes as `{value, Count}`, which is not a contract). */
const tallyObj = (list) => Object.fromEntries(tally(list));

const jsonTargets = rows.map((r) => ({ ...r }));
const okRows = rows.filter((r) => /^OK/.test(r.status ?? ''));
const timedOutRows = rows.filter((r) => r.status === 'TIMEOUT');
const failedRows = rows.filter((r) => r.status === 'FAILED');
const notGitRows = rows.filter((r) => r.checkout === 'NOT_GIT_WORKTREE');
const missingRows = rows.filter((r) => r.checkout === 'MISSING');
const gitRows = rows.filter((r) => r.checkout === 'GIT_CHECKOUT' || r.checkout === 'SHALLOW_CHECKOUT');
const shallowRows = rows.filter((r) => r.shallow === true);
const deepRows = gitRows.filter((r) => r.shallow === false);
const measuredRows = rows.filter((r) => typeof r.detector_findings === 'number');

const headlineCleanCritHigh = measuredRows.filter((r) => r.critical_high_with_real_remediation > 0);

const summary = {
  generated_by: 'dktv-sweep-100',
  ran_at: finishedAt.toISOString(),
  started_at: startedAt.toISOString(),
  duration_seconds: Math.round((finishedAt - startedAt) / 100) / 10,

  repo_revision: rev.revision,
  repo_revision_error: rev.revisionError,
  repo_tag: rev.tag,
  targets_file: relative(REPO_ROOT, TARGETS_PATH).split('\\').join('/'),
  selection_rule: manifest.selection_rule ?? null,
  frozen_at: manifest.frozen_at ?? null,
  clone_spec: manifest.clone ?? null,
  work_dir: relative(REPO_ROOT, WORK_DIR).split('\\').join('/'),
  report_script: relative(REPO_ROOT, REPORT_SCRIPT).split('\\').join('/'),
  timeout_seconds_per_repo: opts.timeoutS,

  counts: {
    targets_in_manifest: targets.length,
    targets_run: selected.length,
    ok: okRows.length,
    timed_out: timedOutRows.length,
    failed: failedRows.length,
    target_missing: missingRows.length,
    not_git_worktree: notGitRows.length,
    git_checkouts: gitRows.length,
    shallow: shallowRows.length,
    history_measurable: deepRows.length,
    measured: measuredRows.length,
    pinned_commit_verified: rows.filter((r) => r.commit_matches_manifest === true).length,
    pinned_commit_mismatch: rows.filter((r) => r.commit_matches_manifest === false).length,
    pinned_commit_unverifiable: rows.filter((r) => r.commit_matches_manifest === null).length,
  },
  by_checkout: tallyObj(rows.map((r) => r.checkout ?? '(not probed)')),
  // Which clones do not carry the commit the manifest pinned: a claim about bytes.
  pinned_commit_mismatches: rows.filter((r) => r.commit_matches_manifest === false).map((r) => ({ name: r.name, manifest_commit: r.commit, resolved_head: r.resolved_head })),

  // Headline: repos with >=1 critical-or-high DETECTOR finding carrying a real
  // remediation (report.mjs's fallback string excluded).
  repos_with_crit_high_and_real_remediation: headlineCleanCritHigh.length,
  repos_with_crit_high_and_real_remediation_names: headlineCleanCritHigh.map((r) => r.name),
  no_remediation_sentinel_total: rows.reduce((s, r) => s + (r.no_remediation_sentinel ?? 0), 0),
  no_remediation_sentinel_repos: rows.filter((r) => (r.no_remediation_sentinel ?? 0) > 0).map((r) => `${r.name}:${r.no_remediation_sentinel}`),

  // Distributions are a MEASURED PROPERTY OF THE SAMPLE, not a filter.
  by_primary_stack: tally(selected.map((t) => t.primary_stack ?? '(not declared)')),
  by_signals: tally(selected.flatMap((t) => (Array.isArray(t.signals) && t.signals.length > 0 ? t.signals : ['(no signals declared)']))),
  by_language: tally(selected.map((t) => t.language ?? '(not declared)')),
  by_status: tally(rows.map((r) => r.status)),

  sums_over_measured_rows_only: {
    note: 'TIMEOUT / FAILED / TARGET_MISSING rows are excluded from every sum below; their counts are null by construction.',
    detector_findings: numbers('detector_findings').reduce((a, b) => a + b, 0),
    ausencia_findings: numbers('ausencia_findings').reduce((a, b) => a + b, 0),
    critical: numbers('critical').reduce((a, b) => a + b, 0),
    high: numbers('high').reduce((a, b) => a + b, 0),
    critical_high: numbers('critical_high').reduce((a, b) => a + b, 0),
    cap_truncations: numbers('cap_truncation_count').reduce((a, b) => a + b, 0),
    degraded: numbers('degraded_count').reduce((a, b) => a + b, 0),
    rule_failures: numbers('rule_failures_count').reduce((a, b) => a + b, 0),
    seconds: Math.round(numbers('seconds').reduce((a, b) => a + b, 0) * 10) / 10,
  },

  // Rules the run could not execute, named. Never a silent skip.
  blocked_tools_named: [...new Set(rows.flatMap((r) => r.degraded_rules))].sort(),
  rule_failures_named: tally(rows.flatMap((r) => r.rule_failures.map((f) => f.rule ?? '(engine)'))),
  shallow_repos_names: shallowRows.map((r) => r.name),

  area_status_by_repo: rows.map((r) => ({
    name: r.name,
    status: r.status,
    areas: r.area_verdicts.map((v) => ({ module: v.module, status: v.status, rules_total: v.rules_total, detector_runnable: v.detector_runnable, detector_blocked: v.detector_blocked, juicio: v.juicio, fuera: v.fuera, findings: v.findings, critical_high: v.critical_high, gaps: v.gaps })),
  })),

  targets: jsonTargets,
};

/* ------------------------------------------------------------- json out -- */

// Sizes of the bulk artifacts this harness leaves on disk, measured not guessed.
const bulkSizes = {};
let bulkTotal = 0;
let bulkCount = 0;
for (const r of rows) {
  for (const f of r.artifacts_written) {
    const size = sha256Like(join(REPO_ROOT, r.run_dir, f));
    if (typeof size !== 'number') continue;
    bulkSizes[f] = (bulkSizes[f] ?? 0) + size;
    bulkTotal += size;
    bulkCount++;
  }
}
summary.excluded_bulk = {
  files: bulkCount,
  bytes: bulkTotal,
  mib: Math.round((bulkTotal / 1048576) * 100) / 100,
  by_name_bytes: bulkSizes,
  policy: 'findings.json / report.md / prompts.md are generated per-repo dumps and are gitignored; SWEEP-100.json and SWEEP-100.md (the aggregate) are committed, as are each run\'s run.cmd / stdout.txt / stderr.txt / exit.txt.',
};

const sweepJsonPath = join(OUT_DIR, 'SWEEP-100.json');
writeFileSync(sweepJsonPath, `${JSON.stringify({ summary, targets: jsonTargets }, null, 2)}\n`);

/* --------------------------------------------------------------- md out -- */

const md = [];
md.push(`# SWEEP-100 — deterministic detector over the pre-registered 100-target sample`);
md.push('');
md.push(`- **frozen revision**: \`${rev.revision ?? 'UNAVAILABLE'}\`${rev.tag ? ` (tag \`${rev.tag}\`)` : ''}${rev.revisionError ? ` — ${rev.revisionError}` : ''}`);
md.push(`- **selection rule**: \`${summary.targets_file}\`${manifest.frozen_at ? ` · frozen at ${manifest.frozen_at}` : ''}${manifest.selection_rule ? ` · ${String(manifest.selection_rule).replace(/\s+/g, ' ').slice(0, 300)}` : ''}`);
md.push(`- **sweep ran**: ${startedAt.toISOString()} → ${finishedAt.toISOString()} (${summary.duration_seconds}s wall clock)`);
md.push(`- **engine**: \`${summary.report_script}\` (${summary.report_script === 'scripts/detect/report.mjs' ? 'the same assembler every other report uses' : 'OVERRIDDEN'}) · hard timeout **${opts.timeoutS}s/repo**`);
md.push(`- **clones**: \`${summary.work_dir}\` · **manifest targets**: ${targets.length} · **run in this sweep**: ${selected.length}`);
md.push('');

md.push(`## Headline`);
md.push('');
md.push(`| measure | value |`);
md.push(`|---|---:|`);
md.push(`| targets run | ${selected.length} |`);
md.push(`| completed (report written) | ${okRows.length} |`);
md.push(`| **timed out (killed at ${opts.timeoutS}s — counts NULL, not 0)** | **${timedOutRows.length}** |`);
md.push(`| failed (no findings.json) | ${failedRows.length} |`);
md.push(`| clone directory missing | ${missingRows.length} |`);
md.push(`| not a git checkout (no \`.git\` — the demo-snapshot case; scanned, but no history rule can run) | ${notGitRows.length} |`);
md.push(`| git checkouts | ${gitRows.length} |`);
md.push(`| **shallow (git reports shallow, a \`.git/shallow\` marker, or 1 visible commit)** | **${shallowRows.length}** |`);
md.push(`| history measurable (not shallow) | ${deepRows.length} |`);
md.push(`| **repos with ≥1 critical/high DETECTOR finding WITH a real remediation** | **${headlineCleanCritHigh.length}** |`);
md.push(`| repos with detector findings but NO real remediation text (rule gap) | ${rows.filter((r) => (r.no_remediation_sentinel ?? 0) > 0).length} |`);
md.push(`| clones carrying the manifest's pinned \`commit\` | ${summary.counts.pinned_commit_verified} verified · ${summary.counts.pinned_commit_mismatch} MISMATCH · ${summary.counts.pinned_commit_unverifiable} unverifiable |`);
md.push('');
if (summary.counts.pinned_commit_mismatch > 0) {
  md.push(`⚠️ **${summary.counts.pinned_commit_mismatch} clone(s) do NOT carry the commit the manifest pinned.** The rows below describe the bytes actually scanned, not the pinned revision:`);
  md.push('');
  for (const m of summary.pinned_commit_mismatches) md.push(`- \`${m.name}\` — manifest \`${m.manifest_commit}\` · checked out \`${m.resolved_head ?? 'UNRESOLVED'}\``);
  md.push('');
}
if (summary.counts.pinned_commit_unverifiable > 0) {
  md.push(`\`unverifiable\` = the manifest has no usable \`commit\` for the target, or the clone is not a git checkout (a working tree with no \`.git\` cannot be pinned). It is not a claim of agreement.`);
  md.push('');
}

md.push(`### Shallow checkouts — every history statistic below is VOID on these`);
md.push('');
if (shallowRows.length === 0) {
  md.push(`None. All ${gitRows.length} git checkout(s) carry more than one visible commit, so the git-history rules could produce a real number.`);
} else {
  md.push(`**${shallowRows.length} of ${gitRows.length} git checkout(s) are SHALLOW.** Every \`github-*\` and \`security-secret-in-history-*\` rule silently refuses on these and reports \`0\` while naming \`SHALLOW_CHECKOUT\` in the per-repo \`cap_truncations\`. **A history statistic computed over a shallow clone is not a statistic about the repository — it is a statistic about the clone.** Any aggregate that mixes them with non-shallow repos (this table included) is therefore NOT a history claim.`);
  md.push('');
  md.push(`Shallow repos: ${shallowRows.map((r) => `\`${r.name}\` (${r.git_commit_count ?? '?'} commit${r.git_commit_count === 1 ? '' : 's'}${r.git_shallow_marker ? ', .git/shallow marker' : ''}${r.git_shallow_reported === true ? ', git reports shallow' : ''})`).join(' · ')}`);
  if (deepRows.length > 0 && shallowRows.length > 0) {
    md.push('');
    md.push(`⚠️ **MIXED SET**: ${deepRows.length} measurable vs ${shallowRows.length} shallow. Do not publish a single history number over this run without splitting it in two.`);
  }
}
md.push('');

md.push(`### Distribution by \`primary_stack\` (a measured property of the sample, not a filter)`);
md.push('');
md.push(`| primary_stack | targets |`);
md.push(`|---|---:|`);
for (const [k, v] of summary.by_primary_stack) md.push(`| \`${k}\` | ${v} |`);
md.push('');

md.push(`### Distribution by \`signals\` (a measured property of the sample, not a filter)`);
md.push('');
md.push(`A target can carry several signals, so the column does not sum to the sample size.`);
md.push('');
md.push(`| signal | targets |`);
md.push(`|---|---:|`);
for (const [k, v] of summary.by_signals) md.push(`| \`${k}\` | ${v} |`);
md.push('');

md.push(`### Distribution by \`language\``);
md.push('');
md.push(`| language | targets |`);
md.push(`|---|---:|`);
for (const [k, v] of summary.by_language) md.push(`| \`${k}\` | ${v} |`);
md.push('');

md.push(`## Per-repo results`);
md.push('');
md.push(`Every target in the manifest appears below with its status. \`sec\` is the child's wall-clock time. \`cov!\` is the share of non-binary files no regex rule examined (\`coverage.files_not_analysed / files_text\`) — high \`cov!\` means a low finding count is weak evidence, not good news.`);
md.push('');
md.push(`| # | repo | primary_stack | status | checkout | pinned | sec | grade | det | crit | high | crit+high | with real remediation | ausencia | degraded | rule fail | cap trunc | cov! % |`);
md.push(`|---:|---|---|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
rows.forEach((r, i) => {
  const n = (v) => (v === null || v === undefined ? '—' : v);
  const pin = r.commit_matches_manifest === true ? 'match' : r.commit_matches_manifest === false ? '**DRIFT**' : '—';
  md.push(`| ${i + 1} | \`${r.name}\` | ${n(r.primary_stack)} | ${n(r.status)} | ${n(r.checkout)} | ${pin} | ${n(r.seconds)} | ${n(r.grade_display)} | ${n(r.detector_findings)} | ${n(r.critical)} | ${n(r.high)} | ${n(r.critical_high)} | ${n(r.critical_high_with_real_remediation)} | ${n(r.ausencia_findings)} | ${n(r.degraded_count)} | ${n(r.rule_failures_count)} | ${n(r.cap_truncation_count)} | ${n(r.coverage_pct_not_examined)} |`);
});
md.push('');
md.push(`\`status\` is the run outcome (\`OK\` / \`TIMEOUT\` / \`FAILED\` / \`TARGET_MISSING\`); \`checkout\` is the working tree (\`GIT_CHECKOUT\` / \`SHALLOW_CHECKOUT\` / \`NOT_GIT_WORKTREE\` / \`MISSING\`) — the two are recorded independently so a timeout cannot hide the fact that a target was never a git checkout. \`pinned\` compares the manifest's \`commit\` with the clone's HEAD (\`match\` / \`DRIFT\` / \`—\` unverifiable).`);
md.push('');
md.push(`\`with real remediation\` = critical/high detector findings whose remediation is NOT the report's fallback string ("${NO_REMEDIATION}"). It is the only column here that a reader may promote to a headline claim about remediation text existing.`);
md.push('');

md.push(`## Sums — over measured rows ONLY`);
md.push('');
md.push(`TIMEOUT / FAILED / TARGET_MISSING rows contribute **nothing** to these sums (their counts are null by construction, and a null is not a zero). Measured rows: ${measuredRows.length} of ${rows.length}.`);
md.push('');
const s = summary.sums_over_measured_rows_only;
md.push(`| measure | sum over ${measuredRows.length} measured row(s) |`);
md.push(`|---|---:|`);
md.push(`| detector findings | ${s.detector_findings} |`);
md.push(`| ausencia (checklist gaps) | ${s.ausencia_findings} |`);
md.push(`| critical | ${s.critical} |`);
md.push(`| high | ${s.high} |`);
md.push(`| critical + high | ${s.critical_high} |`);
md.push(`| findings stopped at the 20/rule cap (floors) | ${s.cap_truncations} |`);
md.push(`| degraded (per-repo rule instances with no implemented tool) | ${s.degraded} |`);
md.push(`| rule failures (error/budget) | ${s.rule_failures} |`);
md.push(`| detector seconds | ${s.seconds} |`);
md.push('');
md.push(`The \`degraded\` cell counts **per-repo instances**, so the same unimplemented rule appears once per measured repo that lists it. Distinct degraded rule ids across this run: ${summary.blocked_tools_named.length}.`);

md.push(`## Per-area status — the "NOT EVALUATED" information survives`);
md.push('');
md.push(`\`SIN MOTOR\` = zero runnable mechanical rules for the area (nothing was evaluated) · \`PARCIAL\` = the rules needing judgment or live data are at least as many as the runnable mechanical ones · \`CUBIERTA\` = otherwise. **A 0 in the findings column is a statement about the rules that RAN, never about the area.**`);
md.push('');
md.push(`| repo | area | status | rules | det. runnable | det. blocked | juicio | fuera | findings | crit+high | gaps |`);
md.push(`|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|`);
let anyArea = false;
for (const r of rows) {
  for (const v of r.area_verdicts) {
    anyArea = true;
    md.push(`| \`${r.name}\` | \`${v.module}\` | ${v.status} | ${v.rules_total} | ${v.detector_runnable} | ${v.detector_blocked} | ${v.juicio} | ${v.fuera} | ${v.findings} | ${v.critical_high} | ${v.gaps} |`);
  }
}
if (!anyArea) md.push(`| — | — | no run produced an \`area_verdicts\` block | | | | | | | | |`);
md.push('');
const notEvaluatedAreas = rows.flatMap((r) => r.area_verdicts
  .filter((v) => v.status === 'SIN MOTOR' || v.detector_runnable === 0)
  .map((v) => `${r.name}/${v.module}`));
if (notEvaluatedAreas.length > 0) {
  md.push(`**Areas where no mechanical rule was evaluated at all** (${notEvaluatedAreas.length}) — nothing in these areas was assessed, so their silence carries no information: ${notEvaluatedAreas.map((a) => `\`${a}\``).join(' · ')}`);
  md.push('');
}
const zeroFindingAreas = rows.flatMap((r) => r.area_verdicts
  .filter((v) => v.findings === 0 && v.detector_runnable > 0)
  .map((v) => `${r.name}/${v.module}`));
if (zeroFindingAreas.length > 0) {
  md.push(`**Areas with 0 findings across the rules that RAN** (${zeroFindingAreas.length}) — a 0 here is a statement about those rules, NOT a clean bill of health (each area's \`juicio\` / \`fuera\` / \`det. blocked\` columns above say what was never examined): ${zeroFindingAreas.map((a) => `\`${a}\``).join(' · ')}`);
  md.push('');
}
const allSilentRepos = rows.filter((r) => r.area_verdicts.length > 0 && r.area_verdicts.every((v) => v.findings === 0));
if (allSilentRepos.length > 0) {
  md.push(`**Repos with 0 detector findings in EVERY area** (${allSilentRepos.length}) — do NOT read these as clean: ${allSilentRepos.map((r) => `\`${r.name}\``).join(' · ')}. For each, check the \`cov!\` column and the area table above before repeating any "no findings" claim.`);
  md.push('');
}

md.push(`## What this number is NOT`);
md.push('');
md.push(`1. **Precision is unmeasured.** Every finding is a raw mechanical signal (label \`probado\`). Nothing here was adjudicated by a human, so there is no true-positive rate and no false-positive rate. A count of findings is a count of signals, not a count of defects.`);
md.push(`2. **\`juicio\` rules never ran.** ${rows.length > 0 ? `Across the measured repos the \`area_verdicts\` tables name them per area. ` : ''}These rules require a model to decide (Fase 3 has no engine). Their verdict is absent, not negative — a repo with zero findings may have every \`juicio\` rule outstanding.`);
md.push(`3. **Tools that are not implemented are named, never silent.** ${summary.blocked_tools_named.length > 0 ? `Degraded rule ids across this run: ${summary.blocked_tools_named.length} distinct rule(s): ${summary.blocked_tools_named.slice(0, 40).map((r) => `\`${r}\``).join(', ')}${summary.blocked_tools_named.length > 40 ? ` … +${summary.blocked_tools_named.length - 40} more (full list in SWEEP-100.json \`targets[].degraded_rules\`)` : ''}.` : 'No rule reported a degraded tool in this run.'} Rules the engine actually refused at run time (\`degraded\`) and rules that failed mid-run (\`rule_failures\`) are recorded per repo.`);
if (summary.rule_failures_named.length > 0) {
  md.push(`   - rules that did not complete in at least one repo: ${summary.rule_failures_named.map(([r, n]) => `\`${r}\` (${n})`).join(', ')} — findings for those repos are PARTIAL.`);
} else {
  md.push(`   - 0 rule failures recorded in this run.`);
}
md.push(`4. **The shallow repos' history is VOID.** ${shallowRows.length > 0 ? `${shallowRows.length} repo(s) are shallow (${shallowRows.map((r) => r.name).join(', ')}): \`github-*\` and \`security-secret-in-history-*\` returned 0 by refusing to run, not by finding nothing. No history statistic may be computed over them, alone or mixed.` : 'No repo in this run was shallow.'}`);
md.push(`5. **The 20-findings-per-rule cap makes counts floors, not totals.** ${s.cap_truncations} rule instance(s) stopped at the cap across ${rows.filter((r) => (r.cap_truncation_count ?? 0) > 0).length} repo(s); every affected count is \`≥\` what is shown.`);
md.push(`6. **Coverage is partial by construction.** Unmatched files (\`cov!\` column) mean a low count is weak evidence. Where ≥20% of non-binary files were examined by no rule the grade letter is capped at C and flagged \`coverageLimited\`; the per-repo \`grade_coverage_limited\` field records it.`);
md.push(`7. **This is not a comparison.** The sample is the pre-registered selection in \`${summary.targets_file}\`; the distributions above describe THAT sample. Nothing here ranks stacks, languages or signals against each other — the per-cell n is too small and the sample was not drawn for that.`);
md.push('');

md.push(`## Method (for a re-runner)`);
md.push('');
md.push('```');
md.push(`node benchmark/sweep-100.mjs`);
md.push('```');
md.push('');
md.push(`Per target: (1) \`git rev-list --count HEAD\` and \`git rev-parse HEAD\` in \`${summary.work_dir}/<name>\`, both bounded and captured through file descriptors; (2) \`node ${summary.report_script} --target ${summary.work_dir}/<name> --out ${relative(REPO_ROOT, RUNS_DIR).split('\\').join('/')}/<name>\`, bounded at ${opts.timeoutS}s; (3) the row is read back from that run's \`findings.json\`. A run that times out, fails, is missing, or is not a git checkout is recorded as exactly that — it is never folded into a sum and never shown as 0.`);
md.push('');
md.push(`Per-repo evidence kept in the repo: \`runs/<name>/run.cmd\` (the exact invocation), \`stdout.txt\`, \`stderr.txt\`, \`exit.txt\`. The three bulk dumps per repo (${BULK_ARTIFACTS.join(', ')}) — ${summary.excluded_bulk.files} file(s), ${(summary.excluded_bulk.bytes / 1048576).toFixed(2)} MiB — are gitignored by \`benchmark/.gitignore\`; the aggregate in this file and \`SWEEP-100.json\` is committed. Regenerate any one repo's dumps with its \`run.cmd\`.`);
md.push('');

const sweepMdPath = join(OUT_DIR, 'SWEEP-100.md');
writeFileSync(sweepMdPath, `${md.join('\n')}\n`);

/* ------------------------------------------------------------------ out -- */

console.log('');
console.log(`completed ${okRows.length}/${selected.length} · timeouts ${timedOutRows.length} · failed ${failedRows.length} · missing ${missingRows.length} · not-a-git-checkout ${notGitRows.length}`);
console.log(`shallow ${shallowRows.length}/${gitRows.length} git checkout(s)${shallowRows.length > 0 ? ` — HISTORY STATISTICS ON THESE ARE VOID: ${shallowRows.map((r) => r.name).join(', ')}` : ''}`);
console.log(`repos with ≥1 critical/high detector finding WITH a real remediation: ${headlineCleanCritHigh.length}`);
console.log(`pinned commit: ${summary.counts.pinned_commit_verified} verified · ${summary.counts.pinned_commit_mismatch} MISMATCH · ${summary.counts.pinned_commit_unverifiable} unverifiable`);
console.log(`CRLF sentinel ("${NO_REMEDIATION}"): ${rows.reduce((a, r) => a + (r.no_remediation_sentinel ?? 0), 0)} occurrence(s) — must be 0`);
console.log(`wrote ${relative(process.cwd(), sweepJsonPath)}`);
console.log(`wrote ${relative(process.cwd(), sweepMdPath)}`);

process.exit(okRows.length === selected.length ? 0 : 1);
