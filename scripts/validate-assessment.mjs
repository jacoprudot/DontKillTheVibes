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
 *     (`→ FINDING: <id>` lines in skills/*.skill.md)
 *   - every id referenced by work_plan phases and dependencies resolves to a finding
 *   - summary tallies agree with the actual findings
 *
 * Warnings (exit 0) are used only for soft signals: low confidence, short
 * remediation, an empty findings list, missing optional metadata fields.
 *
 * Exit codes: 0 = valid, 1 = violations found, 2 = usage error.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(resolve(root, 'templates/finding-schema.json'), 'utf8'));

const argv = process.argv.slice(2);
const useRegistry = !argv.includes('--no-registry');
const file = argv.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Usage: node scripts/validate-assessment.mjs <assessment.json> [--no-registry]');
  process.exit(2);
}

/* ---------- canonical rule registry (skills/*.skill.md) ---------- */
function loadCanonicalIds() {
  const ids = new Set();
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return ids;
  for (const f of readdirSync(skillsDir).filter((n) => n.endsWith('.skill.md')).sort()) {
    const content = readFileSync(join(skillsDir, f), 'utf8');
    for (const m of content.matchAll(/→\s*FINDING:\s*([A-Za-z0-9-]+)/g)) ids.add(m[1]);
  }
  return ids;
}

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

const canonical = useRegistry ? loadCanonicalIds() : new Set();
if (useRegistry && canonical.size === 0) {
  warn.push('no canonical finding ids found in skills/ — registry check skipped');
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
        if (f.evidence.metric !== undefined && !isNum(f.evidence.metric)) {
          errors.push(`${where}: evidence.metric must be a number`);
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
