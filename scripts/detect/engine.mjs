/**
 * engine.mjs — the detector engine: runs skills/detectors.json specs against a
 * target repository and returns normalized findings. Pure local execution:
 * nothing is sent anywhere.
 *
 * Tool coverage, stated honestly (PLAN.md Fase 2 requires the degradation to
 * be visible, not silent):
 *   node-matcher  → MATCHER_IMPL in ./matchers.mjs (all 10 matchers)
 *   yaml-check    → regex presence/absence over files matched by file_glob
 *   gitleaks      → LITE: spec.regex executed in-process over the working tree
 *                   (keyword prefilter honored). History specs (path_regex
 *                   touching .git/) are DEGRADED — no binary, no history scan.
 *   semgrep       → DEGRADED. Windows decision per PLAN.md Fase 2 is option (b):
 *                   no Docker dependency; patterns trivial enough to matter are
 *                   ported to node-matcher specs as fixtures earn them.
 *   osv-scanner, npm-audit → DEGRADED (need network or binaries; not vendored)
 *   license-scan, git-log, github-api → DEGRADED (not implemented yet)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openScanRepo } from './scan-repo.mjs';
import { MATCHER_IMPL, takeSkippedLongLineCount } from './matchers.mjs';
import { makeGlobMatcher } from './glob.mjs';
import { loadRules } from '../lib/canonical-registry.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DEGRADED_TOOLS = new Set(['semgrep', 'osv-scanner', 'npm-audit', 'license-scan', 'git-log', 'github-api']);

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function snippet(content, index, len = 120) {
  const start = content.lastIndexOf('\n', index) + 1;
  let end = content.indexOf('\n', index);
  if (end === -1) end = content.length;
  const line = content.slice(start, end).trim();
  return line.length > len ? `${line.slice(0, len)}…` : line;
}

function runYamlCheck(repo, spec) {
  const match = makeGlobMatcher(spec.file_glob);
  // 'm' because workflow patterns use line anchors (`...$`): without it `$`
  // only matches at end of file and a violation mid-file is missed (found by
  // the security-gha-action-unpinned-5 fixture, 2026-10-07).
  const re = new RegExp(spec.pattern, 'm');
  const out = [];
  for (const f of repo.tree.filter((t) => !t.binary && match(t.rel))) {
    const r = repo.readFile(f.rel);
    if (r === null) continue;
    if (spec.check === 'presence') {
      const g = new RegExp(re.source, 'gm');
      let found;
      while ((found = g.exec(r.content)) !== null) {
        out.push({ file: f.rel, line: lineOf(r.content, found.index), evidence: snippet(r.content, found.index) });
        if (out.length >= 20) break;
        if (found.index === g.lastIndex) g.lastIndex++;
      }
    } else if (spec.check === 'absence' && !re.test(r.content)) {
      out.push({ file: f.rel, line: null, evidence: 'pattern not found in file' });
    }
    if (out.length >= 20) break;
  }
  return out;
}

function runGitleaksLite(repo, spec) {
  if (spec.path_regex && new RegExp(spec.path_regex).test('.git/')) {
    return { findings: [], degradedReason: 'spec targets git history; lite runner scans the working tree only (install gitleaks for history)' };
  }
  const re = new RegExp(spec.regex, 'g');
  const keywords = spec.keywords || [];
  const out = [];
  for (const f of repo.tree) {
    if (f.binary) continue;
    const r = repo.readFile(f.rel);
    if (r === null) continue;
    // case-insensitive prefilter: the regexes are (?i:...) but a case-sensitive
    // skip here would silence them (found by the security-secret-in-code-1 fixture)
    if (keywords.length > 0 && !keywords.some((k) => r.content.toLowerCase().includes(k.toLowerCase()))) continue;
    let m;
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(r.content)) !== null) {
      // LITERAL vs VARIABLE (2026-10-07): `api_key = anthropic_api_key` is a
      // variable reference, not a secret — the dominant FP class in real code.
      // An unquoted bare-identifier RHS is a reference; quoted values, PEM
      // headers and connection strings never take this branch.
      const value = m[0].split(/[:=]/).pop().trim();
      if (!/["']/.test(m[0]) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
        if (m.index === g.lastIndex) g.lastIndex++;
        continue;
      }
      out.push({ file: f.rel, line: lineOf(r.content, m.index), evidence: snippet(r.content, m.index) });
      if (out.length >= 20) break;
      if (m.index === g.lastIndex) g.lastIndex++;
    }
    if (out.length >= 20) break;
  }
  return { findings: out };
}

/**
 * @param {string} targetDir directory to scan
 * @param {object} opts
 * @param {Set<string>} [opts.onlyIds] restrict to these rule ids (fixture runner)
 * @param {string} [opts.module] restrict to one module prefix (e.g. 'security')
 * @returns {{findings: object[], degraded: object[], scanned: number, skipped: number, clean: string[], repo: object, timings: Array<{rule: string, ms: number}>, skippedLongLineFiles: number}}
 *          `clean` = ids of mechanical rules that RAN and produced zero findings
 *          (the report's coverage/diff section needs evaluated-but-silent rules,
 *          not just the ones that fired). `timings` exists so a future hang is
 *          diagnosable from output alone — the 2026-10-07 incident cost an hour
 *          precisely because a silent rule gave no trace.
 */
export function runDetect(targetDir, opts = {}) {
  const doc = JSON.parse(readFileSync(join(ROOT, 'skills', 'detectors.json'), 'utf8'));
  const rules = loadRules(join(ROOT, 'skills'));
  const repo = openScanRepo(targetDir);

  const findings = [];
  const degraded = [];
  const clean = [];
  const timings = [];
  let scanned = 0;
  let skipped = 0;
  takeSkippedLongLineCount(); // reset the matcher guard counter for this run
  const sensitiveByRel = new Map(repo.tree.filter((f) => f.sensitive).map((f) => [f.rel, true]));

  for (const [id, entry] of Object.entries(doc)) {
    if (id.startsWith('$')) continue;
    if (!['detector', 'ausencia'].includes(entry.type)) continue;
    if (opts.onlyIds && !opts.onlyIds.has(id)) continue;
    if (opts.module && !id.startsWith(`${opts.module}-`)) continue;

    if (DEGRADED_TOOLS.has(entry.tool)) {
      degraded.push({ tool: entry.tool, rule: id });
      skipped++;
      continue;
    }

    let raw = [];
    let degradedReason = null;
    const t0 = performance.now();
    if (entry.tool === 'node-matcher') {
      const impl = MATCHER_IMPL[entry.spec.matcher];
      if (!impl) {
        degraded.push({ tool: `node-matcher:${entry.spec.matcher}`, rule: id, reason: 'matcher not implemented' });
        skipped++;
        continue;
      }
      raw = impl(repo, entry.spec.params);
      scanned++;
    } else if (entry.tool === 'yaml-check') {
      raw = runYamlCheck(repo, entry.spec);
      scanned++;
    } else if (entry.tool === 'gitleaks') {
      const res = runGitleaksLite(repo, entry.spec);
      raw = res.findings;
      if (res.degradedReason) {
        degraded.push({ tool: 'gitleaks', rule: id, reason: res.degradedReason });
        skipped++;
        continue;
      }
      scanned++;
    } else {
      degraded.push({ tool: String(entry.tool), rule: id, reason: 'unknown tool' });
      skipped++;
      continue;
    }
    timings.push({ rule: id, ms: Math.round((performance.now() - t0) * 10) / 10 });

    const fields = rules.get(id) || {};
    if (raw.length === 0) clean.push(id);
    for (const f of raw) {
      findings.push({
        rule: id,
        module: id.split('-')[0],
        type: entry.type,
        tool: entry.tool,
        severity: fields.severity ?? null,
        effort: fields.effort ?? null,
        file: f.file,
        line: f.line,
        evidence: sensitiveByRel.has(f.file) ? '<redacted: sensitive file>' : f.evidence,
      });
    }
  }

  // exact duplicates can be emitted (overlapping windows, repeated evidence
  // lines): one finding per (rule, file, line, evidence), keeping first order
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.line}|${f.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.rule.localeCompare(b.rule) || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0));
  return { findings: unique, degraded, scanned, skipped, clean, timings, skippedLongLineFiles: takeSkippedLongLineCount(), repo };
}
