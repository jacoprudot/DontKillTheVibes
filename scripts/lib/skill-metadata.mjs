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
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = FINDING_RE.exec(lines[i]);
      if (!m) continue;
      const [, id, severity, effort] = m;
      // human name: nearest preceding "IF <name>" line
      let name = null;
      for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
        const im = /^\s*\d*\.\s*IF\s+([a-z0-9_]+)/i.exec(lines[j]);
        if (im) { name = im[1]; break; }
        if (lines[j].includes('→ FINDING:')) break; // previous rule's block: stop
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
