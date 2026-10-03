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
      fail(rel, `finding id "${m[1]}" does not match ^[a-z-]+-\\d+$`);
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

if (failures > 0) {
  console.error(`\nvalidate-skills: ${failures} failure(s) across ${checked} skill(s)`);
  process.exit(1);
}
console.log(`validate-skills: OK — ${checked} skill(s) valid`);
