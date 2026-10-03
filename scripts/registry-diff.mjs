#!/usr/bin/env node
/**
 * registry-diff.mjs — the changelog gate for the canonical rule registry.
 *
 * WHY THIS EXISTS
 * ---------------
 * The rule registry is the tool's public API: every finding id in a shipped report is a
 * promise that `skills/*.skill.md` still defines that id with that severity and that
 * effort. Nothing enforced that promise. The registry went 333 -> 394 -> 368 in a single
 * day and the only record of what moved was a git commit title; a shipped example cited
 * rule ids that did not exist at all; rules were deleted outright, which silently breaks
 * every past report that cites them.
 *
 * This script is the missing process. It rebuilds the registry twice — once from the
 * working tree, once from the SAME files at a git ref — and reports ADDED / REMOVED /
 * CHANGED / DEPRECATED plus both fingerprints. Then it enforces two rules:
 *
 *   1. A CHANGE MUST BE DECLARED. If the fingerprint moved, `skills/CHANGELOG.md` must
 *      contain the new fingerprint. Otherwise the author is told to add an entry. (Same
 *      fingerprint => exit 0: re-running this on an unchanged registry is a no-op.)
 *   2. A REMOVAL MUST BE A DEPRECATION. Deleting a `→ FINDING:` line breaks past reports,
 *      because their ids no longer resolve in the validator. Mark the rule
 *      `[deprecated -> new-rule-id]` instead; it stays in the registry (so old reports
 *      still validate) and the validator downgrades a citation of it to a warning.
 *      A removed id that is NOT marked deprecated is always exit 1.
 *
 * Usage:
 *   node scripts/registry-diff.mjs [git-ref] [--json]
 *
 *   git-ref   ref to diff the working tree against (default: HEAD). Use `HEAD~1`, a tag or
 *             a commit sha to see what a pull request actually changes.
 *   --json    print the report as JSON instead of prose. The gate is still applied and the
 *             exit code is still the gate's.
 *
 * Exit codes: 0 = registry unchanged, or changed and declared; 1 = gate failure;
 *             2 = usage/git error (the diff could not be computed at all).
 *
 * Sandbox note: this repo's Windows sandbox DENIES piped child stdio (spawnSync EPERM), so
 * git output is captured through a FILE DESCRIPTOR and read back from disk. Never pass
 * `{ encoding: 'utf8' }` to the spawn here: that means a pipe.
 */
import {
  readFileSync, readdirSync, existsSync, mkdtempSync, rmSync,
  openSync, closeSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadRules, loadRulesFrom, rulesetFingerprint } from './lib/canonical-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(root, 'skills');
const CHANGELOG_PATH = join(SKILLS_DIR, 'CHANGELOG.md');
const CHANGELOG_REL = 'skills/CHANGELOG.md';

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const ref = argv.find((a) => !a.startsWith('--')) || 'HEAD';

for (const a of argv) {
  if (a.startsWith('--') && a !== '--json') {
    console.error(`Unknown option: ${a}\nUsage: node scripts/registry-diff.mjs [git-ref] [--json]`);
    process.exit(2);
  }
}

/* ---------- current registry (working tree) ---------- */
const skillNames = readdirSync(SKILLS_DIR).filter((n) => n.endsWith('.skill.md')).sort();
if (!skillNames.length) {
  console.error(`No skills/*.skill.md files found in ${SKILLS_DIR} — nothing to diff.`);
  process.exit(2);
}

const current = loadRules(SKILLS_DIR);
if (!current.size) {
  console.error('No `→ FINDING:` rules found in skills/*.skill.md — refusing to diff an empty registry.');
  process.exit(2);
}

/* ---------- base registry (same files, at <ref>) ---------- */
// git writes each blob to a file descriptor, never to a pipe (see the sandbox note above).
const scratchDir = mkdtempSync(join(tmpdir(), 'dktv-registry-diff-'));
const gitErrPath = join(scratchDir, 'git-stderr.txt');

/** Run one `git show` and return { ok, stdout, stderr } — stdout captured via a file. */
function gitShowBlob(spec) {
  const scratch = join(scratchDir, 'blob.txt');
  const outFd = openSync(scratch, 'w');
  const errFd = openSync(gitErrPath, 'w');
  let res;
  try {
    res = spawnSync('git', ['-C', root, 'show', spec], { stdio: ['ignore', outFd, errFd] });
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }
  const stdout = readFileSync(scratch, 'utf8');
  let stderr = '';
  try { stderr = readFileSync(gitErrPath, 'utf8'); } catch { /* keep '' */ }
  return { ok: !res.error && res.status === 0, stdout, stderr: stderr.trim() };
}

const baseEntries = [];
const missingInRef = [];
const gitErrors = [];
for (const name of skillNames) {
  const { ok, stdout, stderr } = gitShowBlob(`${ref}:skills/${name}`);
  if (ok) {
    baseEntries.push([`skills/${name}`, stdout]);
  } else if (/does not exist|exists on disk, but not in|unknown revision|ambiguous argument|invalid object name|Path '.+' does not exist/i.test(stderr)) {
    missingInRef.push(name); // the file did not exist at <ref> => it contributes no base rules
  } else {
    gitErrors.push(`git show ${ref}:skills/${name} — ${stderr || 'failed with no stderr'}`);
  }
}

try { rmSync(scratchDir, { recursive: true, force: true }); } catch { /* best effort */ }

if (gitErrors.length) {
  console.error(`Could not read the base registry at "${ref}":`);
  for (const e of gitErrors) console.error(`  ${e}`);
  console.error('\nIs the ref valid (git ref, tag or sha) and is this a git checkout?');
  process.exit(2);
}
if (missingInRef.length === skillNames.length) {
  console.error(`None of the ${skillNames.length} skill file(s) exist at "${ref}" — refusing to diff against an empty base registry.`);
  console.error(`  first failure: git show ${ref}:skills/${skillNames[0]}`);
  process.exit(2);
}

const base = loadRulesFrom(baseEntries);

/* ---------- the diff ---------- */
/**
 * @typedef {{ severity: string|null, effort: string|null, deprecated: boolean, supersededBy: string|null }} RuleFields
 */
const added = [];
const removed = [];
const removedWithoutDeprecation = [];
const changed = [];
const deprecated = [];

for (const [id, rule] of current) {
  if (!base.has(id)) { added.push(id); continue; }
  const before = base.get(id);
  const severity = before.severity !== rule.severity
    ? { from: before.severity, to: rule.severity } : null;
  const effort = before.effort !== rule.effort
    ? { from: before.effort, to: rule.effort } : null;
  if (severity || effort) changed.push({ id, severity, effort });
  if (!before.deprecated && rule.deprecated) {
    deprecated.push({ id, supersededBy: rule.supersededBy ?? null });
  }
}

for (const [id, rule] of base) {
  if (current.has(id)) continue;
  removed.push(id);
  // A rule that is gone from the registry can no longer resolve the ids cited by reports
  // already shipped. The ONLY acceptable way to retire a rule is to keep the line and mark
  // it `[deprecated …]`.
  if (!rule.deprecated) removedWithoutDeprecation.push(id);
}

changed.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
deprecated.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
added.sort();
removed.sort();
removedWithoutDeprecation.sort();

const baseFingerprint = rulesetFingerprint(base);
const currentFingerprint = rulesetFingerprint(current);
const fingerprintChanged = baseFingerprint !== currentFingerprint;

/* ---------- the changelog gate ---------- */
const changelogExists = existsSync(CHANGELOG_PATH);
const changelogText = changelogExists ? readFileSync(CHANGELOG_PATH, 'utf8') : '';
// "Declared" = the changelog names the NEW fingerprint on some line. Grep-able on purpose:
// the fingerprint is the one string a human cannot typo into a false match.
const declared = changelogText.includes(currentFingerprint);

const failures = [];
if (removedWithoutDeprecation.length) {
  failures.push(
    `${removedWithoutDeprecation.length} rule id(s) were REMOVED without being marked deprecated: ${removedWithoutDeprecation.join(', ')}\n`
    + '    Removal breaks every past report that cites the id (the validator rejects it as non-canonical).\n'
    + '    Keep the line and append `[deprecated -> <replacement-id>]` (or `[deprecated]`) instead of deleting it.'
  );
}
if (fingerprintChanged && !declared) {
  failures.push(
    `the ruleset fingerprint changed (${baseFingerprint} -> ${currentFingerprint}) but ${CHANGELOG_REL} does not mention the new fingerprint.\n`
    + `    Add a dated entry to ${CHANGELOG_REL} that names \`${currentFingerprint}\` and lists these changes.`
  );
}
if (fingerprintChanged && !changelogExists) {
  failures.push(`${CHANGELOG_REL} does not exist — a ruleset change must be recorded there.`);
}
// A changelog that exists but is unreadable is reported rather than ignored.
if (changelogExists && changelogText.length === 0 && fingerprintChanged) {
  failures.push(`${CHANGELOG_REL} is empty — a ruleset change must be declared.`);
}

const pass = failures.length === 0;
const report = {
  ref,
  base_fingerprint: baseFingerprint,
  current_fingerprint: currentFingerprint,
  base_rule_count: base.size,
  current_rule_count: current.size,
  fingerprint_changed: fingerprintChanged,
  added,
  removed,
  removed_without_deprecation: removedWithoutDeprecation,
  changed,
  deprecated,
  changelog: {
    path: CHANGELOG_REL,
    exists: changelogExists,
    mentions_current_fingerprint: declared,
  },
  pass,
  failures,
};

/* ---------- output ---------- */
if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const lines = [];
  lines.push(`registry-diff — ${skillNames.length} skill file(s), base ref "${ref}"`);
  lines.push('');
  lines.push(`fingerprint  base:    ${baseFingerprint}  (${base.size} rules)`);
  lines.push(`fingerprint  current: ${currentFingerprint}  (${current.size} rules)`);
  lines.push(fingerprintChanged
    ? '             CHANGED — this ruleset needs a changelog entry'
    : '             unchanged — no changelog entry required');
  if (missingInRef.length) {
    lines.push(`note: ${missingInRef.length} skill file(s) do not exist at "${ref}" and contributed no base rules: ${missingInRef.join(', ')}`);
  }
  lines.push('');
  lines.push(`ADDED (${added.length})`);
  for (const id of added) lines.push(`  + ${id}`);
  lines.push('');
  lines.push(`REMOVED (${removed.length})`);
  for (const id of removed) {
    lines.push(removedWithoutDeprecation.includes(id)
      ? `  - ${id}   !! NOT deprecated — this breaks past reports`
      : `  - ${id}   (deprecated)`);
  }
  lines.push('');
  lines.push(`CHANGED (${changed.length})`);
  for (const c of changed) {
    const parts = [];
    if (c.severity) parts.push(`severity ${c.severity.from ?? '(none)'} -> ${c.severity.to ?? '(none)'}`);
    if (c.effort) parts.push(`effort ${c.effort.from ?? '(none)'} -> ${c.effort.to ?? '(none)'}`);
    lines.push(`  ~ ${c.id}: ${parts.join(', ')}`);
  }
  lines.push('');
  lines.push(`DEPRECATED (${deprecated.length})`);
  for (const d of deprecated) {
    lines.push(`  ! ${d.id}${d.supersededBy ? ` -> ${d.supersededBy}` : ' (no replacement named)'}`);
  }
  lines.push('');
  lines.push(`CHANGELOG GATE — ${CHANGELOG_REL}`);
  lines.push(`  ${declared ? 'mentions' : 'does NOT mention'} the current fingerprint ${currentFingerprint}`
    + (fingerprintChanged ? '' : ' (not required: the fingerprint is unchanged)'));
  lines.push('');
  if (pass) {
    lines.push(fingerprintChanged
      ? `PASS: ruleset changed and declared in ${CHANGELOG_REL}; no undeclared removals.`
      : `PASS: ruleset unchanged since ${ref} — nothing to declare.`);
  } else {
    for (const f of failures) lines.push(`FAIL: ${f}`);
    lines.push('');
    lines.push(`GATE FAILED (${failures.length} reason(s)).`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

process.exit(pass ? 0 : 1);
