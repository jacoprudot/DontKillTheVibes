#!/usr/bin/env node
/**
 * validate-assessment.mjs — enforce the DontKillTheVibes output contract on an assessment.json
 *
 * Usage: node scripts/validate-assessment.mjs <path-to-assessment.json>
 *        node scripts/validate-assessment.mjs <path> --no-registry
 *
 * What is enforced (exit 1 on any violation):
 *   - document shape: findings / summary / work_plan / metadata present
 *   - every finding validated against templates/finding-schema.json
 *     (required fields, id pattern, module/severity/effort enums, confidence range,
 *      location.file present with an integer line >= 0, description non-empty,
 *      tags / relatedFindings / evidence types)
 *   - finding ids unique
 *   - every finding id exists in the canonical skill registry
 *     (`→ FINDING: <id> (severity: <sev>, effort: <eff>)` lines in skills/*.skill.md)
 *   - every finding's severity and effort match the values the canonical rule declares
 *     (the rule is the authority: prioritization is severityWeight x moduleWeight x
 *      confidence, so an invented severity silently rewrites the whole work plan)
 *   - every id referenced by work_plan phases and dependencies resolves to a finding
 *   - summary tallies agree with the actual findings
 *
 * Warnings (exit 0) are used only for soft signals: low confidence, short
 * remediation, an empty findings list, missing optional metadata fields, a finding that
 * cites a DEPRECATED rule (the id is still canonical on purpose — a report produced before
 * the rule was retired must keep validating) and a metadata.ruleset_version that disagrees
 * with the registry in the working tree (the scores may simply be from an older ruleset).
 *
 * Exit codes: 0 = valid, 1 = violations found, 2 = usage error.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
// The canonical rule contract (ids + declared severity/effort) lives in ONE module:
// scripts/lib/canonical-registry.mjs. This validator only ENFORCES it; the runner
// (scripts/dktv-orchestrate.mjs) consumes the same module to MAKE the output conform.
import { loadRules, rulesetFingerprint } from './lib/canonical-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(resolve(root, 'templates/finding-schema.json'), 'utf8'));

const argv = process.argv.slice(2);
const useRegistry = !argv.includes('--no-registry');
const file = argv.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: node scripts/validate-assessment.mjs <assessment.json> [--no-registry]');
  process.exit(2);
}

/* ---------- canonical rule registry (scripts/lib/canonical-registry.mjs) ---------- */
/**
 * Returns Map<id, { severity, effort, deprecated, supersededBy }>. Each decision-tree rule
 * line declares the authoritative severity/effort for that rule, e.g.
 *   → FINDING: security-secret-in-code-1 (severity: critical, effort: XS)
 * A rule with no declared severity or effort records null for that field, and the
 * corresponding check is skipped for that rule (never invent an error).
 *
 * A rule marked `[deprecated -> <id>]` STAYS canonical on purpose: reports produced before
 * the retirement cite it and must keep validating. Citing it is a WARNING here, not an
 * error (see the deprecation warning below).
 * The parsing itself lives in scripts/lib/canonical-registry.mjs so that the validator
 * and the runner can never disagree about what a rule declares.
 */
const SKILLS_DIR = join(root, 'skills');
// Fingerprint of the registry in the working tree: `"<count>-<8 hex>"`. Stamped into
// metadata.ruleset_version by the runners; compared (as a warning) against the document.
const currentFingerprint = useRegistry ? rulesetFingerprint(loadRules(SKILLS_DIR)) : null;

/* ---------- load document ---------- */
let doc;
try {
  doc = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
} catch (e) {
  console.error(`INVALID JSON: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warn = [];

if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
  console.error('ERROR: assessment document must be a JSON object');
  console.log('\nINVALID: 1 error(s), 0 warning(s)');
  process.exit(1);
}

const rules = useRegistry ? loadRules(SKILLS_DIR) : new Map();
const canonical = new Set(rules.keys());
if (useRegistry && canonical.size === 0) {
  warn.push('no canonical finding ids found in skills/ — registry check skipped');
}
if (useRegistry && canonical.size > 0) {
  let undeclared = 0;
  for (const r of rules.values()) if (r.severity === null || r.effort === null) undeclared++;
  if (undeclared > 0) {
    warn.push(
      `${undeclared} canonical rule(s) declare no severity/effort; those checks are skipped for them`
    );
  }
}

/* ---------- helpers ---------- */
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStrArray = (v) => Array.isArray(v) && v.every(isStr);

/* ---------- findings ---------- */
const findings = Array.isArray(doc.findings) ? doc.findings : null;

if (!findings) {
  errors.push('missing "findings" array');
} else if (findings.length === 0) {
  warn.push('findings array is empty — confirm the repository digest contained files to assess');
}

const knownIds = new Set();
const seen = new Set();

if (findings) {
  findings.forEach((f, i) => {
    const label = isObj(f) && isStr(f.id) ? f.id : 'no-id';
    const where = `findings[${i}] (${label})`;

    if (!isObj(f)) {
      errors.push(`${where}: finding must be a JSON object`);
      return;
    }

    // required keys
    for (const req of schema.required) {
      if (f[req] === undefined || f[req] === null) {
        errors.push(`${where}: missing required field "${req}"`);
      }
    }

    // id
    if (isStr(f.id)) {
      if (!new RegExp(schema.properties.id.pattern).test(f.id)) {
        errors.push(`${where}: id "${f.id}" does not match pattern ${schema.properties.id.pattern}`);
      }
      if (seen.has(f.id)) errors.push(`${where}: duplicate id "${f.id}"`);
      seen.add(f.id);
      knownIds.add(f.id);
      if (canonical.size > 0 && !canonical.has(f.id)) {
        errors.push(
          `${where}: id "${f.id}" is not a canonical rule id — it must come from a decision tree in skills/*.skill.md`
        );
      } else if (canonical.size > 0) {
        // the rule declares the authoritative severity/effort; only compare fields the
        // rule actually declares and the finding actually carries (a missing required
        // field is already reported by the schema check above)
        const rule = rules.get(f.id);
        if (rule.severity !== null && f.severity !== undefined && f.severity !== rule.severity) {
          errors.push(
            `${where}: severity "${f.severity}" does not match the rule's declared severity "${rule.severity}" (${f.id})`
          );
        }
        if (rule.effort !== null && f.effort !== undefined && f.effort !== rule.effort) {
          errors.push(
            `${where}: effort "${f.effort}" does not match the rule's declared effort "${rule.effort}" (${f.id})`
          );
        }
        // Retiring a rule must not invalidate a report that was produced while the rule was
        // live: a deprecated id stays canonical and this is a WARNING, never an error.
        if (rule.deprecated) {
          warn.push(
            rule.supersededBy
              ? `${where}: rule "${f.id}" is deprecated (superseded by ${rule.supersededBy}) — prefer the replacement`
              : `${where}: rule "${f.id}" is deprecated — prefer a current rule`
          );
        }
      }
    } else if (f.id !== undefined) {
      errors.push(`${where}: id must be a string`);
    }

    // enums
    if (f.module !== undefined && !schema.properties.module.enum.includes(f.module)) {
      errors.push(`${where}: module "${f.module}" not in enum [${schema.properties.module.enum.join(', ')}]`);
    }
    if (f.severity !== undefined && !schema.properties.severity.enum.includes(f.severity)) {
      errors.push(
        `${where}: severity "${f.severity}" not in enum [${schema.properties.severity.enum.join(', ')}]`
      );
    }
    if (f.effort !== undefined && !schema.properties.effort.enum.includes(f.effort)) {
      errors.push(`${where}: effort "${f.effort}" not in enum [${schema.properties.effort.enum.join(', ')}]`);
    }

    // confidence
    if (f.confidence !== undefined) {
      if (!isNum(f.confidence) || f.confidence < 0 || f.confidence > 1) {
        errors.push(`${where}: confidence must be a finite number between 0.0 and 1.0`);
      } else if (f.confidence < 0.6) {
        warn.push(`${where}: confidence ${f.confidence} below 0.6 — finding may be speculative`);
      }
    }

    // text
    if (f.description !== undefined) {
      if (!isStr(f.description)) errors.push(`${where}: description must be a string`);
      else if (f.description.trim().length === 0) errors.push(`${where}: description must not be empty`);
    }
    if (f.remediation !== undefined) {
      if (!isStr(f.remediation)) errors.push(`${where}: remediation must be a string`);
      else if (f.remediation.trim().length < 20) {
        warn.push(`${where}: remediation is very short — must be specific/actionable`);
      }
    }

    // location
    if (f.location !== undefined) {
      if (!isObj(f.location)) {
        errors.push(`${where}: location must be an object { file, line }`);
      } else {
        if (!isStr(f.location.file) || f.location.file.trim().length === 0) {
          errors.push(`${where}: location.file is required and must be a non-empty string`);
        }
        if (f.location.line !== undefined) {
          if (!Number.isInteger(f.location.line) || f.location.line < 0) {
            errors.push(`${where}: location.line must be an integer >= 0`);
          }
        }
        if (f.location.function !== undefined && !isStr(f.location.function)) {
          errors.push(`${where}: location.function must be a string`);
        }
        if (f.location.commit !== undefined && !isStr(f.location.commit)) {
          errors.push(`${where}: location.commit must be a string`);
        }
      }
    }

    // optional arrays / evidence
    if (f.tags !== undefined && !isStrArray(f.tags)) {
      errors.push(`${where}: tags must be an array of strings`);
    }
    if (f.relatedFindings !== undefined && !isStrArray(f.relatedFindings)) {
      errors.push(`${where}: relatedFindings must be an array of strings`);
    }
    if (f.evidence !== undefined) {
      if (!isObj(f.evidence)) {
        errors.push(`${where}: evidence must be an object`);
      } else {
        if (f.evidence.snippet !== undefined && !isStr(f.evidence.snippet)) {
          errors.push(`${where}: evidence.snippet must be a string`);
        }
        // A metric is a measurement, and measurements are often described, not
        // numeric ("CVSS 10.0 (Critical)", "write-all vs contents:read"). The 38
        // worked examples in the skills describe them; nothing consumes the field
        // numerically. Accept string or number, mirroring finding-schema.json.
        if (f.evidence.metric !== undefined && !isStr(f.evidence.metric) && !isNum(f.evidence.metric)) {
          errors.push(`${where}: evidence.metric must be a string or a number`);
        }
        if (f.evidence.benchmark !== undefined && !isStr(f.evidence.benchmark)) {
          errors.push(`${where}: evidence.benchmark must be a string`);
        }
      }
    }
  });

  // cross-references inside findings
  if (findings) {
    findings.forEach((f, i) => {
      if (!isObj(f) || !Array.isArray(f.relatedFindings)) return;
      for (const ref of f.relatedFindings) {
        if (isStr(ref) && !seen.has(ref)) {
          errors.push(`findings[${i}] (${f.id ?? 'no-id'}): relatedFindings references unknown id "${ref}"`);
        }
      }
    });
  }
}

/* ---------- metadata / summary ---------- */
if (!isObj(doc.metadata)) {
  errors.push('missing "metadata" object');
} else {
  for (const k of ['repo', 'assessed_at', 'toolkit_version']) {
    if (!doc.metadata[k]) warn.push(`metadata.${k} missing`);
  }
  if (!doc.metadata.llm_used) warn.push('metadata.llm_used missing');
  // Provenance, not contract: the fingerprint the document was scored under is stamped by
  // the runners. A mismatch means the registry moved AFTER this assessment was produced, so
  // the scores may not be comparable with a fresh run — worth saying out loud, never worth
  // rejecting the document (it was valid when it was written).
  const declaredVersion = doc.metadata.ruleset_version;
  if (useRegistry && currentFingerprint && declaredVersion !== undefined && declaredVersion !== null
    && declaredVersion !== currentFingerprint) {
    warn.push(
      `metadata.ruleset_version "${declaredVersion}" was scored under a different ruleset (current "${currentFingerprint}") — scores may not be comparable`
    );
  }
}

if (!isObj(doc.summary)) {
  errors.push('missing "summary" object');
} else if (findings) {
  const s = doc.summary;
  if (s.total_findings !== undefined) {
    if (!Number.isInteger(s.total_findings)) {
      errors.push('summary.total_findings must be an integer');
    } else if (s.total_findings !== findings.length) {
      errors.push(
        `summary.total_findings is ${s.total_findings} but there are ${findings.length} findings`
      );
    }
  }
  if (s.overall_health !== undefined && !/^[A-F]$/.test(String(s.overall_health))) {
    errors.push('summary.overall_health must be a single letter A-F');
  }

  const tally = (key, field) => {
    if (!isObj(s[key])) return;
    const actual = {};
    for (const f of findings) {
      if (!isObj(f) || !isStr(f[field])) continue;
      actual[f[field]] = (actual[f[field]] || 0) + 1;
    }
    for (const [k, v] of Object.entries(s[key])) {
      if (typeof v !== 'number') {
        errors.push(`summary.${key}.${k} must be a number`);
      } else if ((actual[k] || 0) !== v) {
        errors.push(`summary.${key}.${k} is ${v} but the findings contain ${actual[k] || 0}`);
      }
    }
  };
  tally('by_severity', 'severity');
  tally('by_module', 'module');
  tally('effort_estimate', 'effort');
}

/* ---------- work plan ---------- */
if (!isObj(doc.work_plan)) {
  errors.push('missing "work_plan" object');
} else if (findings) {
  const wp = doc.work_plan;
  const referenced = [];
  const collect = (container, key) => {
    if (Array.isArray(container)) {
      for (const entry of container) {
        if (isObj(entry) && Array.isArray(entry[key])) referenced.push(...entry[key]);
      }
    } else if (isObj(container)) {
      for (const v of Object.values(container)) {
        if (Array.isArray(v)) referenced.push(...v);
      }
    }
  };
  collect(wp.phases, 'findings');
  collect(wp.dependencies, 'to');
  // dependencies may be a map { id: [ids] } — capture its keys too
  if (isObj(wp.dependencies) && !Array.isArray(wp.dependencies)) {
    referenced.push(...Object.keys(wp.dependencies));
  }

  for (const ref of referenced) {
    if (!isStr(ref)) {
      errors.push('work_plan references a non-string finding id');
    } else if (!knownIds.has(ref)) {
      errors.push(`work_plan references unknown finding id "${ref}"`);
    }
  }
}

/* ---------- report ---------- */
for (const w of warn) console.log(`WARN: ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`ERROR: ${e}`);
  console.log(`\nINVALID: ${errors.length} error(s), ${warn.length} warning(s)`);
  process.exit(1);
}
console.log(`VALID: ${findings ? findings.length : 0} findings, ${warn.length} warning(s)`);
