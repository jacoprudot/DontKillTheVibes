#!/usr/bin/env node
/**
 * validate-skills.mjs — minimal validator for skills/*.skill.md
 *
 * Checks per skill file:
 *  1. Frontmatter exists and contains the required keys from templates/SKILL_TEMPLATE.md
 *  2. Every `→ FINDING: <id>` in decision trees matches ^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d+$
 *
 * Check across the whole registry:
 *  3. Every `→ FINDING: <id>` is defined exactly ONCE. `loadRules` is silently last-wins on
 *     a duplicate id, so a copy-pasted rule quietly changes which severity/effort (and
 *     which description) wins depending on file order. That must be a hard failure, not a
 *     silent coin flip. Reported through scripts/lib/canonical-registry.mjs so the
 *     validator and the diff tool agree on what "defined twice" means.
 *
 * Exits non-zero on any failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// The canonical registry contract (parser + duplicate detection) lives in ONE module:
// scripts/lib/canonical-registry.mjs. This validator only reports what it finds there.
import { findDuplicateIds } from './lib/canonical-registry.mjs';

const root = process.cwd();
const skillsDir = join(root, 'skills');

const REQUIRED_KEYS = [
  'name',
  'description',
  'version',
  'module',
  'llmCapabilities',
  'inputs',
  'outputs',
  'mcpDependencies',
];

/**
 * The AUTHORING gate for a rule id: module-category-number, segments alnum, starting with a
 * letter. Deliberately stricter than the ASSESSMENT contract pattern
 * (^[a-z0-9-]+-\d+$ in templates/finding-schema.json, mirrored in the runner's prompt), but
 * compatible with it: every id this regex accepts satisfies the contract, so the two can
 * never disagree on a real id. The contract was widened to let digit-bearing names through
 * ("cost-overprovisioned-k8s-1" — the '8' in k8s — was rejected by the old ^[a-z-]+-\d+$);
 * this regex already accepted it, which is why the registry needed no migration.
 */
const FINDING_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+$/;

function parseFrontmatter(content, file) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const keys = new Set();
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z][A-Za-z0-9]*):/);
    if (km) keys.add(km[1]);
  }
  return keys;
}

let failures = 0;
const fail = (file, msg) => {
  failures++;
  console.error(`FAIL ${file}: ${msg}`);
};

let checked = 0;
for (const file of readdirSync(skillsDir).filter((f) => f.endsWith('.skill.md')).sort()) {
  checked++;
  const rel = `skills/${file}`;
  const content = readFileSync(join(skillsDir, file), 'utf8');

  const keys = parseFrontmatter(content, rel);
  if (!keys) {
    fail(rel, 'missing YAML frontmatter block');
    continue;
  }
  for (const key of REQUIRED_KEYS) {
    if (!keys.has(key)) fail(rel, `frontmatter missing required key "${key}"`);
  }

  for (const m of content.matchAll(/→\s*FINDING:\s*([A-Za-z0-9-]+)/g)) {
    if (!FINDING_ID_RE.test(m[1])) {
      // Print the regex that actually ran, never a hand-copied pattern string: the
      // previous message advertised ^[a-z-]+-\d+$ while enforcing a laxer one (it was
      // the same stale string the assessment contract carried).
      fail(rel, `finding id "${m[1]}" does not match ${FINDING_ID_RE}`);
    }
  }
}

/* Check 3: an id defined more than once is an ambiguous rule definition. loadRules() keeps
   the last one, so two files (or two lines) claiming the same id silently disagree about
   its severity/effort/scope — and a past report citing that id resolves to whichever copy
   happens to win. One FAIL line per id, naming every file that defines it. */
for (const dup of findDuplicateIds(skillsDir)) {
  fail('skills/', `duplicate finding id "${dup.id}" defined ${dup.count} times (${dup.files.join(', ')}) — loadRules() silently keeps the last one`);
}

/* Check 4: scripts/lib/skill-metadata.mjs must survive CRLF (regression lock).
   That parser was fixed on 2026-10-07 from split('\n') to split(/\r?\n/): on a
   Windows checkout (core.autocrlf=true, the Git for Windows default) the old
   split left a trailing \r on every line, FINDING_RE stopped matching, and all
   368 rules silently lost their remediation text — the sweep's report then
   blamed the RULES for missing remediation. The fix is one character class, so
   it is exactly the kind of fix that comes back. This check parses the SAME
   rule text twice (LF and CRLF) in a throwaway directory and requires
   identical results; nothing in skills/ is touched. */
{
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { loadSkillMetadata } = await import('./lib/skill-metadata.mjs');

  const probe = (id) => [
    '---',
    'name: crlf-probe',
    'description: parser regression probe',
    'version: 1.0',
    'module: probe',
    'llmCapabilities: [tool-use]',
    'inputs: []',
    'outputs: []',
    'mcpDependencies: []',
    '---',
    '',
    '1. IF crlf_probe_triggered',
    `   → FINDING: ${id} (severity: high, effort: XS)`,
    '   - Evidence: "probe evidence text"',
    '   - Remediation: "probe remediation text"',
    '',
  ].join('\n');

  const dir = mkdtempSync(join(tmpdir(), 'dktv-crlf-'));
  let lf = null;
  let crlf = null;
  try {
    writeFileSync(join(dir, 'a-lf.skill.md'), probe('crlf-probe-lf-1'), 'utf8');
    writeFileSync(join(dir, 'b-crlf.skill.md'), probe('crlf-probe-crlf-1').split('\n').join('\r\n'), 'utf8');
    const parsed = loadSkillMetadata(dir);
    lf = parsed.get('crlf-probe-lf-1');
    crlf = parsed.get('crlf-probe-crlf-1');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (!lf) fail('skills/ (parser self-check)', 'skill-metadata did not parse an LF probe file at all');
  else if (!crlf) fail('skills/ (parser self-check)', 'skill-metadata did not parse a CRLF probe file at all — a Windows checkout would lose every remediation text');
  else {
    for (const key of ['name', 'evidence', 'remediation']) {
      if (lf[key] !== crlf[key]) {
        fail('skills/ (parser self-check)', `skill-metadata parsed ${key} differently for CRLF vs LF input (LF=${JSON.stringify(lf[key])}, CRLF=${JSON.stringify(crlf[key])}) — split(/\r?\n/) regressed`);
      }
    }
    if (crlf.remediation !== 'probe remediation text') {
      fail('skills/ (parser self-check)', `skill-metadata returned ${JSON.stringify(crlf.remediation)} for the CRLF probe instead of the quoted remediation`);
    }
  }
}

if (failures > 0) {
  console.error(`\nvalidate-skills: ${failures} failure(s) across ${checked} skill(s)`);
  process.exit(1);
}
console.log(`validate-skills: OK — ${checked} skill(s) valid`);
console.log('validate-skills: parser self-check OK — skill-metadata parses CRLF and LF inputs identically (2026-10-07 regression locked)');
