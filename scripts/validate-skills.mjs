#!/usr/bin/env node
/**
 * validate-skills.mjs — minimal validator for skills/*.skill.md
 *
 * Checks per skill file:
 *  1. Frontmatter exists and contains the required keys from templates/SKILL_TEMPLATE.md
 *  2. Every `→ FINDING: <id>` in decision trees matches ^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d+$
 *
 * Exits non-zero on any failure.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

if (failures > 0) {
  console.error(`\nvalidate-skills: ${failures} failure(s) across ${checked} skill(s)`);
  process.exit(1);
}
console.log(`validate-skills: OK — ${checked} skill(s) valid`);
