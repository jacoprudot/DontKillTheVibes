#!/usr/bin/env node
/**
 * validate-detectors.mjs — enforce the detector sidecar contract (PLAN.md, Fase 1).
 *
 * Post-audit (2026-10-06) this validates STRUCTURE FOR REAL, not prose:
 *   1. Shape: type ∈ {detector, ausencia, juicio, fuera}; detector/ausencia
 *      require tool+spec; juicio/fuera must NOT carry tool/spec (a juicio rule
 *      wearing a detector spec is the mis-typed-rule risk from PLAN.md §8).
 *   2. Spec is STRUCTURED per tool and must parse:
 *      - gitleaks:    spec.regex compiles (new RegExp); path_regex compiles.
 *      - semgrep:     spec.pattern non-empty; spec.languages ⊆ known list.
 *      - osv-scanner: at least one of severity_min | kev_only | unmaintained_months
 *                     | transitive; severity_min ∈ LOW|MEDIUM|HIGH|CRITICAL.
 *      - npm-audit:   spec.severity_min ∈ enum.
 *      - node-matcher: spec.matcher ∈ MATCHERS registry; params present and the
 *                     declared regex params compile.
 *      - yaml-check:  spec.check ∈ {presence, absence}; spec.pattern compiles.
 *      - git-log:     spec.check ∈ known checks.
 *      - license-scan: spec.allowlist non-empty SPDX-ish strings.
 *      - github-api:  spec.check ∈ known checks; threshold_days int when present.
 *   3. Registry closure: every canonical rule id has exactly one entry and no
 *      entry invents an id (census: 0 missing / 0 deleted).
 *
 * What this does NOT validate (stated, not hidden): that a spec is a GOOD
 * detector for the rule. That is what the positive/negative fixtures earn in
 * Fase 1/Fase 2 — until a fixture passes, every detector/ausencia spec is
 * provisional. `confidence` was removed for the same reason: a number without
 * a fixture is the invented-severity defect all over again.
 *
 * Exit 0 = VALID, exit 1 = contract violations, exit 2 = unreadable files.
 * Dependency-free (node:fs / node:path only), ESM.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from './lib/canonical-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const DETECTORS_FILE = join(SKILLS_DIR, 'detectors.json');

const TYPES = new Set(['detector', 'ausencia', 'juicio', 'fuera']);
const MECHANICAL = new Set(['detector', 'ausencia']);
const TOOLS = new Set(['gitleaks', 'semgrep', 'osv-scanner', 'npm-audit', 'node-matcher', 'yaml-check', 'git-log', 'license-scan', 'github-api']);
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const LANGUAGES = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rust', 'java', 'rb', 'php', 'cs', 'c', 'cpp', 'kt', 'swift', 'dart']);
const GIT_LOG_CHECKS = new Set(['single-root-commit', 'no-merge-refs', 'squash-dominance', 'commit-message-pattern', 'no-conventional-commits', 'changelog-present', 'branch-divergence', 'commit-rate', 'commit-size-lines', 'commit-hour-distribution', 'schema-breaking-change']);
const GITHUB_API_CHECKS = new Set(['issue-staleness', 'issue-response-time', 'label-hygiene', 'pr-review-coverage']);

/**
 * node-matcher matcher registry — the closed vocabulary the Fase 2 matcher
 * must implement. `req` params must be present and typed; `opt` params are
 * validated only when present. Every regex param listed here is compiled by
 * this validator (V8 syntax: inline flags must be scoped, e.g. (?i:...)).
 */
const MATCHERS = {
  'file-content-regex': { req: { regex: ['pattern'] }, opt: { strings: ['path_glob'], ints: ['max_matches'] } },
  'content-presence': { req: { regex: ['pattern'], strings: ['path_glob'] } },
  'content-absence': { req: { regex: ['pattern'], strings: ['path_glob'] } },
  'file-presence': { req: { strings: ['path_glob'] }, opt: { strings: ['exclude_glob'] } },
  'file-absence': { req: { strings: ['path_glob'] } },
  'max-occurrences': { req: { regex: ['pattern'], strings: ['path_glob'], ints: ['max'] } },
  'complexity-limit': { req: { strings: ['path_glob', 'metric'], ints: ['max'] } },
  'json-field': { req: { strings: ['file', 'field'] }, opt: { bools: ['absent'] } },
  'cookie-flags': { req: { strings: ['path_glob'], lists: ['require'] } },
  'cors-wildcard': { req: { strings: ['path_glob'] } },
  'numeric-bound': { req: { regex: ['pattern'], strings: ['path_glob', 'op'], numbers: ['value'] } },
  'import-requirement': { req: { strings: ['path_glob'], lists: ['require_any'] }, opt: { lists: ['require_none'] } }
};
const COMPLEXITY_METRICS = new Set(['cyclomatic', 'nesting', 'line-count']);
const NUMERIC_OPS = new Set(['gt', 'lt', 'gte', 'lte']);
const COOKIE_FLAGS = new Set(['secure', 'httponly', 'samesite']);

function fail(msg) {
  console.error(`INVALID: ${msg}`);
  process.exit(2);
}

function compiles(re) {
  try { new RegExp(re); return true; } catch { return false; }
}

const SPEC_CHECKERS = {
  gitleaks(id, spec, err) {
    if (typeof spec.regex !== 'string' || !compiles(spec.regex)) err.push(`${id}: gitleaks spec.regex must be a compiling regex string`);
    if (spec.path_regex !== undefined && (typeof spec.path_regex !== 'string' || !compiles(spec.path_regex))) err.push(`${id}: gitleaks spec.path_regex must compile`);
    if (spec.keywords !== undefined && (!Array.isArray(spec.keywords) || spec.keywords.some(k => typeof k !== 'string'))) err.push(`${id}: gitleaks spec.keywords must be a string array`);
  },
  semgrep(id, spec, err) {
    if (typeof spec.pattern !== 'string' || spec.pattern.trim() === '') err.push(`${id}: semgrep spec.pattern must be a non-empty string`);
    if (!Array.isArray(spec.languages) || spec.languages.length === 0 || spec.languages.some(l => !LANGUAGES.has(l))) err.push(`${id}: semgrep spec.languages must be a non-empty subset of ${[...LANGUAGES].join(',')}`);
  },
  'osv-scanner'(id, spec, err) {
    const keys = ['severity_min', 'kev_only', 'unmaintained_months', 'transitive'].filter(k => spec[k] !== undefined);
    if (keys.length === 0) err.push(`${id}: osv-scanner spec needs at least one of severity_min | kev_only | unmaintained_months | transitive`);
    if (spec.severity_min !== undefined && !SEVERITIES.has(spec.severity_min)) err.push(`${id}: osv-scanner spec.severity_min must be ${[...SEVERITIES].join('|')}`);
    if (spec.unmaintained_months !== undefined && (!Number.isInteger(spec.unmaintained_months) || spec.unmaintained_months < 1)) err.push(`${id}: unmaintained_months must be a positive integer`);
  },
  'npm-audit'(id, spec, err) {
    if (!SEVERITIES.has(spec.severity_min)) err.push(`${id}: npm-audit spec.severity_min must be ${[...SEVERITIES].join('|')}`);
  },
  'node-matcher'(id, spec, err) {
    const m = MATCHERS[spec.matcher];
    if (!m) { err.push(`${id}: node-matcher spec.matcher must be one of ${Object.keys(MATCHERS).join(', ')}`); return; }
    if (typeof spec.params !== 'object' || spec.params === null || Array.isArray(spec.params)) { err.push(`${id}: node-matcher spec.params must be an object`); return; }
    const p = spec.params;
    const checkGroup = (group, required) => {
      if (!group) return;
      for (const [kind, keys] of Object.entries(group)) {
        for (const k of keys) {
          if (p[k] === undefined) {
            if (required) err.push(`${id}: node-matcher params.${k} is required`);
            continue;
          }
          if (kind === 'regex' && (typeof p[k] !== 'string' || !compiles(p[k]))) err.push(`${id}: node-matcher params.${k} must be a compiling regex`);
          if (kind === 'strings' && (typeof p[k] !== 'string' || p[k] === '')) err.push(`${id}: node-matcher params.${k} must be a non-empty string`);
          if (kind === 'ints' && !Number.isInteger(p[k])) err.push(`${id}: node-matcher params.${k} must be an integer`);
          if (kind === 'numbers' && typeof p[k] !== 'number') err.push(`${id}: node-matcher params.${k} must be a number`);
          if (kind === 'lists' && (!Array.isArray(p[k]) || p[k].length === 0)) err.push(`${id}: node-matcher params.${k} must be a non-empty array`);
        }
      }
    };
    checkGroup(m.req, true);
    checkGroup(m.opt, false);
    if (spec.matcher === 'complexity-limit' && !COMPLEXITY_METRICS.has(p.metric)) err.push(`${id}: complexity-limit params.metric must be ${[...COMPLEXITY_METRICS].join('|')}`);
    if (spec.matcher === 'numeric-bound' && !NUMERIC_OPS.has(p.op)) err.push(`${id}: numeric-bound params.op must be ${[...NUMERIC_OPS].join('|')}`);
    if (spec.matcher === 'cookie-flags' && (Array.isArray(p.require) && p.require.some(f => !COOKIE_FLAGS.has(f)))) err.push(`${id}: cookie-flags params.require values must be in ${[...COOKIE_FLAGS].join('|')}`);
  },
  'yaml-check'(id, spec, err) {
    if (typeof spec.file_glob !== 'string' || spec.file_glob === '') err.push(`${id}: yaml-check spec.file_glob must be a non-empty string`);
    if (spec.check !== 'presence' && spec.check !== 'absence') err.push(`${id}: yaml-check spec.check must be presence | absence`);
    if (typeof spec.pattern !== 'string' || !compiles(spec.pattern)) err.push(`${id}: yaml-check spec.pattern must be a compiling regex`);
  },
  'git-log'(id, spec, err) {
    if (!GIT_LOG_CHECKS.has(spec.check)) err.push(`${id}: git-log spec.check must be one of ${[...GIT_LOG_CHECKS].join(', ')}`);
    if (spec.threshold !== undefined && (!Number.isInteger(spec.threshold) || spec.threshold < 1)) err.push(`${id}: git-log spec.threshold must be a positive integer`);
  },
  'license-scan'(id, spec, err) {
    if (!Array.isArray(spec.allowlist) || spec.allowlist.length === 0 || spec.allowlist.some(l => typeof l !== 'string' || l === '')) err.push(`${id}: license-scan spec.allowlist must be a non-empty string array`);
  },
  'github-api'(id, spec, err) {
    if (!GITHUB_API_CHECKS.has(spec.check)) err.push(`${id}: github-api spec.check must be one of ${[...GITHUB_API_CHECKS].join(', ')}`);
    for (const k of ['threshold_days', 'threshold']) {
      if (spec[k] !== undefined && (!Number.isInteger(spec[k]) || spec[k] < 1)) err.push(`${id}: github-api spec.${k} must be a positive integer`);
    }
  }
};

let doc;
try {
  doc = JSON.parse(readFileSync(DETECTORS_FILE, 'utf8'));
} catch (e) {
  fail(`cannot read/parse ${DETECTORS_FILE}: ${e.message}`);
}

const rules = loadRules(SKILLS_DIR);
const errors = [];
const stats = { detector: 0, ausencia: 0, juicio: 0, fuera: 0 };

const entries = Object.entries(doc).filter(([k]) => !k.startsWith('$'));
for (const [id, entry] of entries) {
  const where = `detectors.json["${id}"]`;
  if (!rules.has(id)) { errors.push(`${where}: "${id}" is not a canonical rule id in skills/*.skill.md`); continue; }
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`${where}: entry must be an object`); continue; }
  const { type, tool, spec, confidence, query } = entry;
  if (!TYPES.has(type)) { errors.push(`${where}: type must be one of ${[...TYPES].join(' | ')} (got ${JSON.stringify(type)})`); continue; }
  stats[type]++;
  if (confidence !== undefined) errors.push(`${where}: confidence was removed by the 2026-10-06 audit — a number without a fixture is the invented-severity defect; it returns only when a fixture earns it`);
  if (query !== undefined) errors.push(`${where}: query (prose) was replaced by structured spec by the 2026-10-06 audit — prose validated nothing`);
  if (MECHANICAL.has(type)) {
    if (!TOOLS.has(tool)) { errors.push(`${where}: ${type} entry needs tool ∈ ${[...TOOLS].join(' | ')} (got ${JSON.stringify(tool)})`); continue; }
    if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) { errors.push(`${where}: ${type} entry needs a structured spec object`); continue; }
    SPEC_CHECKERS[tool](where, spec, errors);
  } else {
    if (tool !== undefined) errors.push(`${where}: type=${type} must not carry a tool (mis-typed rule?)`);
    if (spec !== undefined) errors.push(`${where}: type=${type} must not carry a spec (mis-typed rule?)`);
  }
}

const classified = new Set(entries.map(([k]) => k));
const missing = [];
for (const id of rules.keys()) if (!classified.has(id)) missing.push(id);
if (missing.length > 0) errors.push(`census incomplete: ${missing.length} canonical rule id(s) without an entry (0 missing is the contract): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);

if (errors.length > 0) {
  console.log(`INVALID: ${entries.length} entries, ${errors.length} violation(s)`);
  for (const e of errors) console.log(`- ${e}`);
  console.log(`(current census: ${stats.detector} detector, ${stats.ausencia} ausencia, ${stats.juicio} juicio, ${stats.fuera} fuera — registry total ${rules.size})`);
  process.exit(1);
}

console.log(`VALID: ${entries.length} entries — ${stats.detector} detector, ${stats.ausencia} ausencia, ${stats.juicio} juicio, ${stats.fuera} fuera (registry total ${rules.size}, 0 missing, 0 deleted)`);
console.log('NOTE: specs are structural declarations. detector/ausencia entries stay PROVISIONAL until their positive/negative fixtures pass (PLAN.md Fase 1).');
