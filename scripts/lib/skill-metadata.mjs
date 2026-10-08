/**
 * skill-metadata.mjs — per-rule display metadata parsed from skills/*.skill.md.
 *
 * The skills already carry, per rule, the human-readable pieces the report
 * needs (PLAN.md Fase 4: "la remediación escrita en el skill"):
 *
 *   2. IF cors_allows_any_origin
 *      → FINDING: security-cors-wildcard-2 (severity: medium, effort: XS)
 *      - Evidence: "allows any origin"
 *      - Remediation: "Restrict origins to specific domains"
 *
 * This parser extracts { name, evidence, remediation, skillFile } per rule id,
 * line-oriented (no nested-regex fragility). The report embeds this text
 * verbatim — "sin prosa generada": if the text does not suffice, the RULE is
 * improved, not the report.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const FINDING_RE = /→\s*FINDING:\s*([a-z0-9-]+)\s*\(severity:\s*([^,)]+),\s*effort:\s*([^)]+)\)/;
const QUOTED_RE = /^"(.*)"\s*$/;

/**
 * @param {string} skillsDir directory holding *.skill.md
 * @returns {Map<string, {name: string|null, evidence: string|null, remediation: string|null, skillFile: string}>}
 */
export function loadSkillMetadata(skillsDir) {
  const out = new Map();
  let files;
  try {
    files = readdirSync(skillsDir).filter((n) => n.endsWith('.skill.md')).sort();
  } catch {
    return out;
  }
  for (const file of files) {
    let content;
    try {
      content = readFileSync(join(skillsDir, file), 'utf8');
    } catch {
      continue;
    }
    // Split on /\r?\n/, NOT '\n'. A Windows checkout (core.autocrlf=true, the
    // Git for Windows default) leaves a trailing \r that broke FINDING_RE, so
    // every rule silently lost its remediation and the report blamed the rule.
    // Found 2026-10-07 by an external review; canonical-registry.mjs:93 was
    // already CRLF-safe, so the two parsers of the same format disagreed.
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = FINDING_RE.exec(lines[i]);
      if (!m) continue;
      const [, id, severity, effort] = m;
      // human name: the rule's OWN "IF <name>" token.
      //
      // DEFECT 6b (measured 2026-10-08). The walk below used to be BACKWARD-ONLY,
      // so a rule written on ONE line — `6. IF file_lines > 150 → FINDING:
      // code-extreme-length-6` — never saw its own token: it took the nearest
      // preceding IF line, i.e. the PREVIOUS rule's condition. docs/RULES.md
      // printed `nesting_depth` for code-extreme-length-6 while
      // skills/code-quality-assessment.skill.md declares `file_lines`. Two rules
      // that share a condition name (nesting_depth on rules 4 and 5) hid it.
      //
      // Fix, in the same parser (no second parser): read this line FIRST — the
      // one-line form is the common one — and only fall back to the backward walk
      // for the two-line form:
      //   11. IF boolean_parameter_count > 3
      //       → FINDING: code-boolean-parameter-plague-11 (...)
      // The backward walk now stops at a line that already carries `→ FINDING:`
      // BEFORE testing it for an IF token, so a continuation line can never
      // borrow the previous block's condition.
      let name = null;
      const own = /^\s*\d*\.\s*IF\s+([a-z0-9_]+)/i.exec(lines[i]);
      if (own) name = own[1];
      else {
        for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
          if (lines[j].includes('→ FINDING:')) break; // previous rule's block: stop
          const im = /^\s*\d*\.\s*IF\s+([a-z0-9_]+)/i.exec(lines[j]);
          if (im) { name = im[1]; break; }
        }
      }
      let evidence = null;
      let remediation = null;
      for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
        const ev = /^\s*-\s*Evidence:\s*(.*)$/.exec(lines[j]);
        if (ev) { evidence = unquote(ev[1]); continue; }
        const rm = /^\s*-\s*Remediation:\s*(.*)$/.exec(lines[j]);
        if (rm) { remediation = unquote(rm[1]); break; }
        if (FINDING_RE.test(lines[j])) break;
      }
      out.set(id, { id, name, severity: severity.trim(), effort: effort.trim(), evidence, remediation, skillFile: basename(file) });
    }
  }
  return out;
}

function unquote(s) {
  const t = s.trim();
  const m = QUOTED_RE.exec(t);
  return m ? m[1] : t || null;
}
