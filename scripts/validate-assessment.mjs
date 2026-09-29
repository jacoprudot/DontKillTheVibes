#!/usr/bin/env node
/**
 * validate-assessment.mjs — validate an assessment.json against templates/finding-schema.json
 *
 * Usage: node scripts/validate-assessment.mjs <path-to-assessment.json>
 * Exit 0 = valid, exit 1 = violations found.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(resolve(root, 'templates/finding-schema.json'), 'utf8'));

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-assessment.mjs <assessment.json>');
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
} catch (e) {
  console.error(`INVALID JSON: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warn = [];
const findings = Array.isArray(doc.findings) ? doc.findings : null;

if (!findings) {
  errors.push('missing "findings" array');
} else {
  const seen = new Set();
  findings.forEach((f, i) => {
    const where = `findings[${i}] (${f?.id ?? 'no-id'})`;
    for (const req of schema.required) {
      if (f[req] === undefined || f[req] === null) errors.push(`${where}: missing required field "${req}"`);
    }
    if (f.id !== undefined && !new RegExp(schema.properties.id.pattern).test(f.id))
      errors.push(`${where}: id "${f.id}" does not match pattern ${schema.properties.id.pattern}`);
    if (f.id !== undefined) {
      if (seen.has(f.id)) errors.push(`${where}: duplicate id "${f.id}"`);
      seen.add(f.id);
    }
    if (f.module !== undefined && !schema.properties.module.enum.includes(f.module))
      errors.push(`${where}: module "${f.module}" not in enum [${schema.properties.module.enum.join(', ')}]`);
    if (f.severity !== undefined && !schema.properties.severity.enum.includes(f.severity))
      errors.push(`${where}: severity "${f.severity}" not in enum`);
    if (f.effort !== undefined && !schema.properties.effort.enum.includes(f.effort))
      errors.push(`${where}: effort "${f.effort}" not in enum [${schema.properties.effort.enum.join(', ')}]`);
    if (f.confidence !== undefined) {
      if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1)
        errors.push(`${where}: confidence must be number 0.0-1.0`);
      if (f.confidence !== undefined && f.confidence < 0.6)
        warn.push(`${where}: confidence ${f.confidence} below 0.6 — finding may be speculative`);
    }
    if (f.location !== undefined && typeof f.location === 'object') {
      if (!f.location.file) errors.push(`${where}: location.file is required`);
    }
    if (f.remediation !== undefined && typeof f.remediation === 'string' && f.remediation.length < 20)
      warn.push(`${where}: remediation is very short — must be specific/actionable`);
  });
}

// assessment.json top-level shape per agents/synthesis-agent.md
if (doc.metadata && typeof doc.metadata === 'object') {
  for (const k of ['repo', 'assessed_at', 'toolkit_version']) {
    if (!doc.metadata[k]) warn.push(`metadata.${k} missing`);
  }
} else {
  warn.push('missing "metadata" object (repo, assessed_at, toolkit_version, llm_used)');
}
if (!doc.summary) warn.push('missing "summary" object');
if (!doc.work_plan) warn.push('missing "work_plan" object (phases + dependencies)');

for (const w of warn) console.log(`WARN: ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`ERROR: ${e}`);
  console.log(`\nINVALID: ${errors.length} error(s), ${warn.length} warning(s)`);
  process.exit(1);
}
console.log(`VALID: ${findings.length} findings, ${warn.length} warning(s)`);
