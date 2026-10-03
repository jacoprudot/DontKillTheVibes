#!/usr/bin/env node
/**
 * canonical-registry.mjs — the ONE place that knows the canonical rule contract.
 *
 * WHY THIS EXISTS
 * ---------------
 * The decision trees in `skills/*.skill.md` are the canonical rule registry. Each rule
 * line declares the rule's id AND its authoritative severity/effort:
 *
 *   → FINDING: security-secret-in-code-1 (severity: critical, effort: XS)
 *
 * A rule is RETIRED by marking it, never by deleting the line — past assessments cite the
 * id and must keep resolving:
 *
 *   → FINDING: old-rule-1 (severity: high, effort: M) [deprecated -> new-rule-2]
 *   → FINDING: old-rule-1 (severity: high, effort: M) [deprecated]
 *
 * Severity and effort are PROPERTIES OF THE RULE. We already know them with certainty,
 * so they must never be an LLM judgement — exactly the same defect class as
 * `metadata.llm_used`, where the model invented three different names until the runner
 * stamped it. A measured B2 run on the control produced 21 findings of which 14 (67%)
 * carried a severity or effort that contradicted the very rule the model had cited
 * (e.g. `security-secret-in-code-1` emitted `high`, rule says `critical`;
 * `database-missing-index-fk-1` emitted `medium`, rule says `high`). An invented
 * severity silently rewrites the whole work plan, because prioritization is
 * severityWeight x moduleWeight x confidence.
 *
 * Before this module, three consumers each parsed (or ignored) the registry on their
 * own: scripts/validate-assessment.mjs (ids + severity/effort checks),
 * scripts/dktv-orchestrate.mjs (ids only) and scripts/dktv-assess.mjs (ids only). Three
 * copies of one contract is three chances to drift. This module is the single source of
 * truth: one parser, one stamping rule, one place to fix.
 *
 * Governance of the registry itself (fingerprint / duplicates) also lives here, so that
 * "what the rules are" and "how the rules are allowed to change" are the same contract.
 *
 * Consumers
 * ---------
 *   - scripts/validate-assessment.mjs : loadRules() to enforce the contract on output.
 *   - scripts/dktv-orchestrate.mjs    : loadRules() for its prompt id list + validation,
 *                                       stampRuleFields() to MAKE the output conform,
 *                                       rulesetFingerprint() to stamp metadata.
 *   - scripts/validate-skills.mjs     : findDuplicateIds() as a hard gate.
 *   - scripts/registry-diff.mjs       : loadRulesFrom() + rulesetFingerprint() to diff the
 *                                       registry against a git ref and gate the changelog.
 *   - scripts/dktv-assess.mjs         : loadRules() only.
 *
 * Dependency-free (node:fs / node:path / node:crypto only), ESM.
 *
 * @typedef {{ severity: string|null, effort: string|null, deprecated: boolean, supersededBy: string|null }} RuleFields
 * @typedef {{ id: string, files: string[], count: number }} DuplicateRuleId
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/** `→ FINDING: <id> (severity: <sev>, effort: <eff>)` — id capture. */
const FINDING_ID_RE = /→\s*FINDING:\s*([A-Za-z0-9-]+)/;
/** severity on the SAME line. Lowercase only: `severity:` is always lowercase in skills/. */
const SEVERITY_RE = /severity:\s*([a-z]+)/;
/** effort on the SAME line; the enum is fixed by templates/finding-schema.json. */
const EFFORT_RE = /effort:\s*(XS|S|M|L|XL)/;
/**
 * Deprecation suffix, appended to the SAME line:
 *   → FINDING: old-rule-1 (severity: high, effort: M) [deprecated -> new-rule-2]
 *   → FINDING: old-rule-1 (severity: high, effort: M) [deprecated]
 * The `-> <id>` half is optional: `[deprecated]` alone is valid.
 */
const DEPRECATED_RE = /\[deprecated(?:\s*->\s*([A-Za-z0-9-]+))?\s*\]/;

/** Default for a rule that declares deprecation nowhere. */
const NOT_DEPRECATED = { deprecated: false, supersededBy: null };

/**
 * Parse the canonical rules out of ONE skill file's text.
 *
 * Only lines that carry `→ FINDING: <id>` are rules; only the id/severity/effort/
 * deprecation on that SAME line are read (the prose around the trees declares none of
 * them). A rule that declares no severity or no effort records `null` for that field —
 * callers must treat null as "unknown", never invent a value.
 *
 * A DUPLICATE id inside one file is deliberately last-wins here (same as before), while
 * `findDuplicateIds()` reports it as a hard error. `definedIn` is the shared bookkeeping
 * that makes that possible: it records every label (= file) that defined each id.
 *
 * @param {string} content skill file text
 * @param {Map<string, RuleFields>} rules destination map (mutated, insertion-ordered)
 * @param {string} [label] name used for duplicate reporting
 * @param {Map<string, string[]>} [definedIn] Map<id, labels> used for duplicate reporting
 */
function parseRuleLines(content, rules, label, definedIn) {
  for (const line of String(content).split(/\r?\n/)) {
    if (!line.includes('FINDING:')) continue;
    const id = line.match(FINDING_ID_RE);
    if (!id) continue;
    const sev = line.match(SEVERITY_RE);
    const eff = line.match(EFFORT_RE);
    const dep = line.match(DEPRECATED_RE);
    rules.set(id[1], {
      severity: sev ? sev[1] : null,
      effort: eff ? eff[1] : null,
      // a rule with no `[deprecated …]` suffix is simply not deprecated
      deprecated: dep ? true : NOT_DEPRECATED.deprecated,
      supersededBy: dep && dep[1] ? dep[1] : null,
    });
    if (definedIn && label) {
      const seen = definedIn.get(id[1]);
      if (seen) seen.push(label);
      else definedIn.set(id[1], [label]);
    }
  }
}

/**
 * Parse the canonical rule registry from `skills/*.skill.md`.
 *
 * Files are read in sorted order and lines in file order, so the Map's iteration order
 * is deterministic.
 *
 * A missing/unreadable directory yields an EMPTY Map (never a throw): the validator
 * depends on that to downgrade its registry check to a warning instead of crashing.
 *
 * @param {string} skillsDir absolute path to the directory holding `*.skill.md`
 * @returns {Map<string, RuleFields>} Map<id, { severity, effort, deprecated, supersededBy }>
 */
export function loadRules(skillsDir) {
  const rules = new Map();
  if (typeof skillsDir !== 'string' || skillsDir.length === 0) return rules;
  if (!existsSync(skillsDir)) return rules;

  let names;
  try {
    names = readdirSync(skillsDir);
  } catch {
    return rules; // unreadable directory: same contract as "no registry"
  }

  for (const name of names.filter((n) => n.endsWith('.skill.md')).sort()) {
    let content;
    try {
      content = readFileSync(join(skillsDir, name), 'utf8');
    } catch {
      continue; // an unreadable skill file contributes no rules; the rest still load
    }
    parseRuleLines(content, rules, `skills/${name}`);
  }
  return rules;
}

/**
 * Parse a registry from in-memory `{ label -> content }` pairs instead of the filesystem.
 *
 * This exists so scripts/registry-diff.mjs can build the BASE registry from the SAME
 * files read at a git ref (`git show <ref>:skills/<file>`), through exactly the same
 * parser as the current registry — two parsers would be one chance for the diff to lie.
 * Pairs are consumed in sorted label order, matching loadRules().
 *
 * @param {Iterable<[string, string]>} entries [label, content] pairs
 * @returns {Map<string, RuleFields>}
 */
export function loadRulesFrom(entries) {
  const rules = new Map();
  const pairs = [...entries]
    .filter(([label, content]) => typeof label === 'string' && typeof content === 'string')
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [label, content] of pairs) parseRuleLines(content, rules, label);
  return rules;
}

/**
 * The ruleset FINGERPRINT: `"<count>-<8 hex>"`.
 *
 * The hash is sha256 of the canonical string — every `${id}|${severity}|${effort}` of the
 * SORTED ids, joined by `\n`, with severity/effort rendered as the empty string when null.
 * Hash-based, not timestamp-based: the same rules always produce the same fingerprint, and
 * ANY add, removal, reclassification or severity/effort change produces a different one.
 *
 * Deliberately does NOT cover `deprecated`/`supersededBy`: retiring a rule is handled by
 * the deprecation convention and must not by itself invalidate past reports.
 *
 * @param {Map<string, RuleFields>} rules
 * @returns {string} e.g. "368-1a2b3c4d"
 */
export function rulesetFingerprint(rules) {
  const entries = [...(rules instanceof Map ? rules.entries() : [])]
    .map(([id, rule]) => ({ id: String(id), rule: rule && typeof rule === 'object' ? rule : {} }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const canonical = entries
    .map(({ id, rule }) => `${id}|${rule.severity ?? ''}|${rule.effort ?? ''}`)
    .join('\n');
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 8);
  return `${entries.length}-${hash}`;
}

/**
 * Every rule id DEFINED MORE THAN ONCE across `skills/*.skill.md`, with the files that
 * define it.
 *
 * `loadRules` is silently last-wins on duplicates, so a duplicated id quietly changes
 * which severity/effort/description wins depending on file order. This function is what
 * makes that visible: scripts/validate-skills.mjs turns each entry into a FAILURE.
 *
 * @param {string} skillsDir absolute path to the directory holding `*.skill.md`
 * @returns {DuplicateRuleId[]} sorted by id; [] when the directory is missing/unreadable
 */
export function findDuplicateIds(skillsDir) {
  if (typeof skillsDir !== 'string' || skillsDir.length === 0) return [];
  if (!existsSync(skillsDir)) return [];

  let names;
  try {
    names = readdirSync(skillsDir);
  } catch {
    return [];
  }

  /** @type {Map<string, string[]>} */
  const definedIn = new Map();
  const rules = new Map(); // parsed but discarded: this function only reports duplicates
  for (const name of names.filter((n) => n.endsWith('.skill.md')).sort()) {
    let content;
    try {
      content = readFileSync(join(skillsDir, name), 'utf8');
    } catch {
      continue;
    }
    parseRuleLines(content, rules, `skills/${name}`, definedIn);
  }

  const out = [];
  for (const [id, files] of definedIn) {
    // `count` is every defining line (the ambiguity), `files` is the set of files it spans
    if (files.length > 1) out.push({ id, files: [...new Set(files)], count: files.length });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Return a SHALLOW COPY of `finding` whose `severity`/`effort` are the rule's declared
 * values. This is the fix, not a check: the finding is made to comply before anyone
 * reads it.
 *
 * Rules of the stamp:
 *   - the rule must exist in `rules` (an unknown id is left ALONE — the id itself is a
 *     separate contract error reported elsewhere);
 *   - a field is only stamped when the rule actually declares it (null => leave the
 *     finding's own value untouched);
 *   - the input object is NEVER mutated; nested objects (location, evidence, …) are
 *     shared by reference, exactly like a spread.
 *
 * A deprecated rule still stamps: it stays in the registry so past reports that cite it
 * keep resolving (see the `[deprecated -> <id>]` convention below), and the validator's
 * response to a deprecated citation is a WARNING, never an error.
 *
 * @param {Record<string, any>} finding
 * @param {Map<string, RuleFields>} rules
 * @returns {Record<string, any>} shallow copy (or the input itself if it is not an object)
 */
export function stampRuleFields(finding, rules) {
  if (finding === null || typeof finding !== 'object' || Array.isArray(finding)) return finding;

  const out = { ...finding };
  if (!rules || typeof rules.get !== 'function' || typeof finding.id !== 'string') return out;

  const rule = rules.get(finding.id);
  if (!rule) return out;
  if (rule.severity !== null && rule.severity !== undefined) out.severity = rule.severity;
  if (rule.effort !== null && rule.effort !== undefined) out.effort = rule.effort;
  return out;
}

/**
 * Does this finding contradict the rule it cites? Measurement counterpart of the
 * validator's severity/effort check, and the number that has to go from 67% to 0.
 *
 * Mirrors the validator exactly: a field is compared only when the rule declares it AND
 * the finding carries it. A finding that omits a required field is a schema error, not a
 * "differs" here; an unknown id is not a diff either (it is a separate contract error).
 *
 * @param {Record<string, any>} finding
 * @param {Map<string, RuleFields>} rules
 * @returns {{ severityDiffers: boolean, effortDiffers: boolean }}
 */
export function diffRuleFields(finding, rules) {
  const out = { severityDiffers: false, effortDiffers: false };
  if (finding === null || typeof finding !== 'object' || Array.isArray(finding)) return out;
  if (!rules || typeof rules.get !== 'function' || typeof finding.id !== 'string') return out;

  const rule = rules.get(finding.id);
  if (!rule) return out;
  if (rule.severity !== null && rule.severity !== undefined
    && finding.severity !== undefined && finding.severity !== rule.severity) {
    out.severityDiffers = true;
  }
  if (rule.effort !== null && rule.effort !== undefined
    && finding.effort !== undefined && finding.effort !== rule.effort) {
    out.effortDiffers = true;
  }
  return out;
}
