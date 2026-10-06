#!/usr/bin/env node
/**
 * validate-detectors.mjs — enforce the detector sidecar contract (PLAN.md, Fase 1).
 *
 * Checks skills/detectors.json against:
 *   1. Shape: every entry has type ∈ {detector, juicio, fuera}; type=detector
 *      requires tool+query+confidence (0..1); any other type must NOT carry
 *      tool/query/confidence (a juicio rule wearing a detector query is the
 *      mis-typed-rule risk from PLAN.md §8).
 *   2. Registry: every key is a canonical rule id that exists in
 *      skills/*.skill.md (via scripts/lib/canonical-registry.mjs), and every
 *      canonical rule id has an entry — the census must close with 0 rules
 *      missing and 0 rules deleted.
 *
 * Exit 0 = VALID, exit 1 = contract violations, exit 2 = unreadable files.
 * Dependency-free (node:fs / node:path only), ESM — same discipline as
 * scripts/lib/canonical-registry.mjs.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from './lib/canonical-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const DETECTORS_FILE = join(SKILLS_DIR, 'detectors.json');

const TYPES = new Set(['detector', 'juicio', 'fuera']);
const TOOLS = new Set(['gitleaks', 'semgrep', 'osv-scanner', 'npm-audit', 'node-matcher', 'yaml-check', 'git-log', 'license-scan']);

function fail(msg) {
  console.error(`INVALID: ${msg}`);
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(readFileSync(DETECTORS_FILE, 'utf8'));
} catch (e) {
  fail(`cannot read/parse ${DETECTORS_FILE}: ${e.message}`);
}

const rules = loadRules(SKILLS_DIR);
const errors = [];
const stats = { detector: 0, juicio: 0, fuera: 0 };

const entries = Object.entries(doc).filter(([k]) => !k.startsWith('$'));
for (const [id, entry] of entries) {
  const where = `detectors.json["${id}"]`;
  if (!rules.has(id)) {
    errors.push(`${where}: "${id}" is not a canonical rule id in skills/*.skill.md`);
    continue;
  }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push(`${where}: entry must be an object`);
    continue;
  }
  const { type, tool, query, confidence } = entry;
  if (!TYPES.has(type)) {
    errors.push(`${where}: type must be one of ${[...TYPES].join(' | ')} (got ${JSON.stringify(type)})`);
    continue;
  }
  stats[type]++;
  if (type === 'detector') {
    if (!TOOLS.has(tool)) errors.push(`${where}: detector entry needs tool ∈ ${[...TOOLS].join(' | ')} (got ${JSON.stringify(tool)})`);
    if (typeof query !== 'string' || query.trim() === '') errors.push(`${where}: detector entry needs a non-empty query`);
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) errors.push(`${where}: detector entry needs confidence ∈ [0,1] (got ${JSON.stringify(confidence)})`);
  } else {
    if (tool !== undefined) errors.push(`${where}: type=${type} must not carry a tool (mis-typed rule?)`);
    if (query !== undefined) errors.push(`${where}: type=${type} must not carry a query (mis-typed rule?)`);
    if (confidence !== undefined) errors.push(`${where}: type=${type} must not carry a confidence (mis-typed rule?)`);
  }
}

// Census closure: every canonical rule id must have an entry (0 missing, 0 deleted).
const classified = new Set(entries.map(([k]) => k));
const missing = [];
for (const id of rules.keys()) {
  if (!classified.has(id)) missing.push(id);
}

if (missing.length > 0) {
  errors.push(`census incomplete: ${missing.length} canonical rule id(s) without an entry (0 borradas/missing is the contract): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
}

if (errors.length > 0) {
  console.log(`INVALID: ${entries.length} entries, ${errors.length} violation(s)`);
  for (const e of errors) console.log(`- ${e}`);
  console.log(`(current census: ${stats.detector} detector, ${stats.juicio} juicio, ${stats.fuera} fuera — registry total ${rules.size})`);
  process.exit(1);
}

console.log(`VALID: ${entries.length} entries — ${stats.detector} detector, ${stats.juicio} juicio, ${stats.fuera} fuera (registry total ${rules.size}, 0 missing, 0 deleted)`);
