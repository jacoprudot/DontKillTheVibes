/**
 * report-renderer.mjs — deterministic assessment.json -> assessment-report.md renderer.
 *
 * WHY THIS EXISTS
 * ---------------
 * Both automated runners emit `assessment.json` (the machine contract) but no
 * `assessment-report.md` (the artifact a human actually reads). Until now that markdown
 * only existed in `examples/realworld-assessment/`, written by hand. This module is the
 * SHARED renderer so `scripts/dktv-orchestrate.mjs` and `scripts/dktv-assess.mjs` produce
 * the same human artifact from the same document — one renderer, two callers.
 *
 * SHAPE OF THE INPUT (two shapes are alive in this repo — HANDOFF.md gap #8)
 * ------------------------------------------------------------------------
 * `agents/synthesis-agent.md` documents: work_plan.phases = ARRAY of
 * {name, findings[], total_effort}, work_plan.dependencies = MAP {id: [ids]}.
 * `scripts/dktv-assess.mjs` documents: work_plan.phases = OBJECT
 * {30_days:[...], 60_days:[...], 90_days:[...]}, work_plan.dependencies = ARRAY of
 * {from, to, type}. BOTH are accepted here, in every combination.
 *
 * HARD RULE — RENDER ONLY WHAT IS IN THE DOCUMENT
 * -----------------------------------------------
 * This renderer never invents a finding, a score, a line number, a date, a model name or
 * a count, and it never computes or "improves" a severity. Everything it prints is read
 * out of `doc` (or out of `options`, which overrides `doc.metadata` when provided). When a
 * field is absent the line is omitted or an explicit '—' is printed. The one derivation it
 * performs is `Blocks`, which is the inverse of the document's own `Depends On` edges — the
 * same inversion the reference report shows (it lists `code-any-type-6` as blocked by
 * `code-missing-validation-4`, which only exists as that edge in the JSON).
 *
 * ORDERING
 * --------
 * Detailed findings are ordered by DESCENDING SCORE whenever the document carries a usable
 * `priority_scores` board, using the orchestrator's own comparator
 * (`b.score - a.score || a.id.localeCompare(b.id)` — see the `priority_scores` construction
 * in scripts/dktv-orchestrate.mjs), so the printed `(score N)` notes are strictly descending
 * down the document. A finding with no score entry in a board that does carry scores is
 * appended after the scored ones in the fallback order below (never dropped, never guessed
 * at). With NO usable scores the order is exactly what it always was: `work_plan.phases`
 * order when phases exist (the assessment's authored priority signal), else descending
 * severity. "Top 3 Priorities" is the first three of whichever order applies, so the heading
 * numbers and the Top-3 list can never disagree. Findings that no phase mentions are
 * appended afterwards in document order, never dropped. The 30/60/90 plan itself is NOT
 * reordered: its phase grouping is authored content, not a sort order.
 *
 * PRIORITY SCORES (additive)
 * --------------------------
 * The document may carry the orchestrator's own score board in `priority_scores`
 * (ARRAY of {id, severity, module, confidence, score, canonical_rule}). When an entry
 * resolves for a finding, its score is printed in the reference report's own notation —
 * `(score 142.5)` in the Top-3 line, in the `### Priority N:` heading and as a
 * `**Score**` field in the finding's metadata line. The number is printed exactly as the
 * document carries it: never recomputed, never rounded, never zero-filled. A document
 * without `priority_scores`, or one in which a finding has no entry (or the field is
 * malformed), renders byte-identically to the pre-score renderer — no `0`, no placeholder,
 * no empty label.
 *
 * DETERMINISM
 * -----------
 * Same input + same options => byte-identical output. No network, no randomness, no clock
 * (a timestamp is used only when the caller passes `options.generatedAt`), no locale APIs.
 * This module imports nothing but node builtins — in fact nothing at all; it is pure.
 *
 * LABELS
 * ------
 * `es` and `en` label tables both exist; `es` is the default because the reference rendering
 * (examples/realworld-assessment/assessment-report.md) is the Spanish one. For every label
 * that the reference actually contains, `es` keeps the reference's exact string — those
 * headings ARE English in the reference ("## Executive Summary", "**Severity**", "Depends
 * On: None"), which itself mixes English structure with Spanish prose. Only labels with no
 * counterpart in the reference (provenance, the extra summary keys, the dependencies section,
 * empty states) are localized, so `es` is Spanish where Spanish is free to choose and
 * byte-identical to the reference where it is not. `en` is English throughout.
 */

/* ---------- label tables ---------- */
const ABSENT = '—';

const LABELS = {
  es: {
    reportTitle: 'Assessment Report',
    provenance: {
      repo: 'Repository',
      date: 'Date',
      model: 'Model',
      toolkitVersion: 'Toolkit Version',
      commit: 'Commit',
    },
    summary: {
      heading: 'Executive Summary',
      health: 'Overall Health',
      critical: 'Critical Findings',
      total: 'Total de hallazgos',
      bySeverity: 'Por severidad',
      byModule: 'Por módulo',
      effort: 'Estimated Total Effort',
      top: 'Top 3 Priorities',
    },
    detailedFindings: 'Detailed Findings (by Priority)',
    priority: 'Priority',
    finding: {
      module: 'Module',
      severity: 'Severity',
      effort: 'Effort',
      confidence: 'Confidence',
      score: 'Score',
      location: 'Location',
      description: 'Description',
      remediation: 'Remediation',
      evidence: 'Evidence',
      dependsOn: 'Depends On',
      blocks: 'Blocks',
      none: 'None',
    },
    plan: '30/60/90 Day Plan',
    planTotalEffort: 'Esfuerzo total',
    dependencies: 'Dependencias',
    appendix: 'Appendix',
    appendixJson: 'All findings in JSON',
    appendixMethodology: 'Methodology',
    appendixRun: 'Run',
    noFindings: 'El documento no contiene hallazgos.',
  },
  en: {
    reportTitle: 'Assessment Report',
    provenance: {
      repo: 'Repository',
      date: 'Date',
      model: 'Model',
      toolkitVersion: 'Toolkit Version',
      commit: 'Commit',
    },
    summary: {
      heading: 'Executive Summary',
      health: 'Overall Health',
      critical: 'Critical Findings',
      total: 'Total Findings',
      bySeverity: 'By Severity',
      byModule: 'By Module',
      effort: 'Estimated Total Effort',
      top: 'Top 3 Priorities',
    },
    detailedFindings: 'Detailed Findings (by Priority)',
    priority: 'Priority',
    finding: {
      module: 'Module',
      severity: 'Severity',
      effort: 'Effort',
      confidence: 'Confidence',
      score: 'Score',
      location: 'Location',
      description: 'Description',
      remediation: 'Remediation',
      evidence: 'Evidence',
      dependsOn: 'Depends On',
      blocks: 'Blocks',
      none: 'None',
    },
    plan: '30/60/90 Day Plan',
    planTotalEffort: 'Total Effort',
    dependencies: 'Dependencies',
    appendix: 'Appendix',
    appendixJson: 'All findings in JSON',
    appendixMethodology: 'Methodology',
    appendixRun: 'Run',
    noFindings: 'The document contains no findings.',
  },
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const EFFORT_ORDER = ['XS', 'S', 'M', 'L', 'XL'];

/* ---------- small helpers (pure) ---------- */
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Resolve 'es' | 'en' | 'es-MX' | 'EN' ... to a label table key; unknown -> 'en' (the default). */
function resolveLanguage(language) {
  const raw = str(language);
  if (!raw) return 'en';
  const base = raw.toLowerCase().split(/[-_]/)[0];
  if (Object.prototype.hasOwnProperty.call(LABELS, raw.toLowerCase())) return raw.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(LABELS, base)) return base;
  return 'en';
}

/**
 * Make arbitrary document text safe to drop into a markdown paragraph.
 *
 * The document is LLM prose, so it can contain markdown. The two things that can actually
 * break the surrounding document are (a) fenced code blocks — a run of 3+ backticks or
 * tildes, which would swallow every following section — and (b) a continuation line that
 * opens a new block (heading, list item, quote, table row, setext underline). Both are
 * neutralized with backslash escapes; single/double backticks are left alone so inline code
 * still renders as inline code.
 */
function sanitizeProse(input) {
  let t = String(input).replace(/\r\n?/g, '\n');
  t = t.replace(/`{3,}/g, (run) => run.replace(/`/g, '\\`'));
  t = t.replace(/~{3,}/g, (run) => run.replace(/~/g, '\\~'));
  t = t.split('\n').map((line) => {
    let out = line.replace(/^(\s*)(#{1,6}\s|>|[-+*](?=\s)|\d+[.)](?=\s)|\|)/, '$1\\$2');
    out = out.replace(/^(\s*)([-=*_]{3,}\s*)$/, '$1\\$2'); // thematic break / setext underline
    return out;
  }).join('\n');
  return t.replace(/\s+$/, ''); // never let a value end with blank lines: the caller decides spacing
}

/** Collapse a value to a single line (for list entries) and clip it on a word boundary. */
function oneLine(input) {
  return sanitizeProse(input).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.replace(/\s+\S*$/, '');
  return `${(atWord.length > max * 0.5 ? atWord : cut).trimEnd()}…`;
}

/** First sentence of a description, used for the Top-3 list. */
function firstSentence(text) {
  const t = oneLine(text);
  const m = t.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : t;
}

/**
 * Wrap text in a fence that is strictly longer than any backtick run inside it, so the
 * snippet can itself contain fences and still not terminate the block.
 */
function fencedCode(input) {
  const text = String(input).replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  if (!text.trim()) return null;
  const runs = text.match(/`+/g) || [];
  const longest = runs.reduce((acc, r) => Math.max(acc, r.length), 0);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text}\n${fence}`;
}

/** `key value · key value` over the keys that exist, canonical order first, extras after. */
function mapLine(record, order) {
  if (!isObj(record)) return null;
  const keys = [
    ...order.filter((k) => Object.prototype.hasOwnProperty.call(record, k)),
    ...Object.keys(record).filter((k) => !order.includes(k)),
  ];
  if (!keys.length) return null;
  return keys
    .map((k) => `${k} ${record[k]}`)
    .join(' · ');
}

/** `3×XS, 3×S, 1×M` over the keys that exist. */
function effortLine(record) {
  if (!isObj(record)) return null;
  const keys = [
    ...EFFORT_ORDER.filter((k) => Object.prototype.hasOwnProperty.call(record, k)),
    ...Object.keys(record).filter((k) => !EFFORT_ORDER.includes(k)),
  ];
  if (!keys.length) return null;
  return keys.map((k) => `${record[k]}×${k}`).join(', ');
}

const idOf = (v) => {
  if (typeof v === 'string') return str(v);
  if (isObj(v)) return str(v.id) || str(v.finding_id) || str(v.finding) || str(v.findingId);
  return null;
};

/** '30_days' -> '30 Days'; used only when the object shape gives no phase name. */
function humanizeKey(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/(^|\s)([a-z])/g, (m, sp, ch) => `${sp}${ch.toUpperCase()}`);
}

/* ---------- document shape normalization ---------- */

/**
 * Accept BOTH phase shapes and return a single normalized list.
 * ARRAY of {name, findings[], total_effort} | OBJECT {30_days: [ids|objects], ...}
 * @returns {Array<{name: string, ids: string[], totalEffort: string|null}>}
 */
function normalizePhases(workPlan) {
  if (!isObj(workPlan)) return [];
  const raw = workPlan.phases;
  if (Array.isArray(raw)) {
    return raw.filter(isObj).map((p) => ({
      name: str(p.name) || ABSENT,
      ids: Array.isArray(p.findings) ? p.findings.map(idOf).filter(Boolean) : [],
      totalEffort: str(p.total_effort) || (num(p.total_effort) !== null ? String(p.total_effort) : null),
    }));
  }
  if (isObj(raw)) {
    return Object.keys(raw).map((key) => ({
      name: humanizeKey(key),
      ids: (Array.isArray(raw[key]) ? raw[key] : []).map(idOf).filter(Boolean),
      totalEffort: null,
    }));
  }
  return [];
}

/**
 * Accept BOTH dependency shapes: MAP {id: [ids it depends on]} and ARRAY of {from,to,type}.
 * @returns {Array<{from: string|null, to: string|null, type: string|null, raw: any}>|null}
 *   null means "the document has no dependencies key at all" (section omitted);
 *   an empty array means "the key exists but is empty" (section printed with '—').
 */
function normalizeDependencies(workPlan) {
  if (!isObj(workPlan) || !Object.prototype.hasOwnProperty.call(workPlan, 'dependencies')) return null;
  const raw = workPlan.dependencies;
  const edges = [];
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (typeof e === 'string') { edges.push({ from: null, to: str(e), type: null, raw: e }); continue; }
      if (!isObj(e)) continue;
      const from = str(e.from) || str(e.source) || str(e.id) || str(e.finding);
      const to = str(e.to) || str(e.target) || str(e.depends_on) || str(e.dependency);
      const type = str(e.type) || str(e.kind);
      if (from || to) edges.push({ from, to, type, raw: e });
    }
    return edges;
  }
  if (isObj(raw)) {
    for (const id of Object.keys(raw)) {
      const deps = Array.isArray(raw[id]) ? raw[id] : [raw[id]];
      for (const d of deps) {
        const to = idOf(d);
        if (!to) continue;
        edges.push({ from: id, to, type: isObj(d) ? str(d.type) || str(d.kind) : null, raw: d });
      }
    }
    return edges;
  }
  return [];
}

/**
 * Build the id -> score lookup out of the document's `priority_scores`, tolerating every
 * plausible shape and silently skipping anything it cannot resolve.
 *
 * ACCEPTED
 *   ARRAY  [{id, score, ...}]           <- what scripts/dktv-orchestrate.mjs emits
 *   ARRAY  [{canonical_rule, score}]    <- same board keyed by the rule id instead
 *   MAP    {id: score}
 *   MAP    {id: {score}} / {id: {id, score}}
 * Every other shape (string, number, null, array of junk) resolves to an empty map, which
 * renders exactly like a document with no `priority_scores` at all. Only finite numbers are
 * accepted as scores: a missing/NaN/string score is omitted, never coerced or defaulted.
 *
 * @returns {Map<string, number>} may be empty; never null
 */
function normalizePriorityScores(raw) {
  const scores = new Map();
  const set = (key, value) => {
    const id = str(key);
    const score = num(value);
    if (!id || score === null || scores.has(id)) return; // first entry wins: deterministic
    scores.set(id, score);
  };
  const record = (entry) => {
    if (!isObj(entry)) return; // junk entries are skipped, never guessed at
    const id = str(entry.id) || str(entry.finding_id) || str(entry.findingId) || str(entry.finding) || str(entry.canonical_rule);
    set(id, entry.score);
  };
  if (Array.isArray(raw)) {
    // a bare string is an id with no score and a bare number has no id: both unresolvable
    for (const entry of raw) record(entry);
    return scores;
  }
  if (isObj(raw)) {
    for (const key of Object.keys(raw)) {
      const value = raw[key];
      if (isObj(value)) record({ id: str(value.id) || key, score: value.score });
      else set(key, value);
    }
  }
  return scores;
}

/** The reference report's own score notation: `(score 142.5)`, printed verbatim. */
const scoreNote = (score) => (score === undefined ? '' : ` (score ${score})`);

/**
 * Fallback priority order, used whenever the document carries no usable score for the
 * findings in question: `work_plan.phases` order when phases exist, else descending
 * severity (stable, document order breaks ties). This is byte-for-byte the pre-score
 * behaviour — `allowed` is the full finding list on that path, so the membership guard
 * below is inert.
 *
 * @param {Array<object>} findings the findings this call is allowed to emit
 * @param {Array<{name: string, ids: string[], totalEffort: string|null}>} phases
 * @param {Map<string, object>} byId
 */
function orderByPhasesOrSeverity(findings, phases, byId) {
  const allowed = new Set(findings); // a phase id may only emit a finding this call was given
  if (phases.length) {
    const seen = new Set();
    const out = [];
    for (const phase of phases) {
      for (const id of phase.ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const f = byId.get(id);
        if (f && allowed.has(f)) out.push(f);
      }
    }
    for (const f of findings) {
      const id = str(f.id);
      if (id && seen.has(id)) continue;
      if (out.includes(f)) continue;
      if (id) seen.add(id);
      out.push(f);
    }
    return out;
  }
  const rank = (s) => {
    const i = SEVERITY_ORDER.indexOf(s);
    return i === -1 ? SEVERITY_ORDER.length : i;
  };
  return findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f.severity) - rank(b.f.severity) || a.i - b.i)
    .map((x) => x.f);
}

/**
 * Priority order: descending score (id ascending on ties, the orchestrator's own
 * comparator) when the document carries scores for at least one finding, else the
 * phases/severity fallback above.
 *
 * @param {Array<object>} findings
 * @param {Array<{name: string, ids: string[], totalEffort: string|null}>} phases
 * @param {Map<string, object>} byId
 * @param {Map<string, number>} scores from `normalizePriorityScores`; may be empty
 */
function orderFindings(findings, phases, byId, scores) {
  if (scores && scores.size) {
    const scored = [];
    const unscored = [];
    for (const f of findings) {
      const id = str(f.id);
      if (id && scores.has(id)) scored.push({ f, id, score: scores.get(id) });
      else unscored.push(f); // no score entry: never guessed at, never dropped
    }
    if (scored.length) {
      // Same comparator as the orchestrator's `priority_scores` sort.
      scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return [...scored.map((x) => x.f), ...orderByPhasesOrSeverity(unscored, phases, byId)];
    }
  }
  return orderByPhasesOrSeverity(findings, phases, byId);
}

/* ---------- section builders ---------- */

function renderProvenance(L, { repo, date, model, toolkit, commit }) {
  const lines = [
    `- **${L.provenance.repo}**: ${repo || ABSENT}`,
    `- **${L.provenance.date}**: ${date || ABSENT}`,
    `- **${L.provenance.model}**: ${model || ABSENT}`,
    `- **${L.provenance.toolkitVersion}**: ${toolkit || ABSENT}`,
  ];
  // the commit line only exists when a commit was actually supplied
  if (commit) lines.push(`- **${L.provenance.commit}**: ${commit}`);
  return lines;
}

function renderExecutiveSummary(L, summary, ordered, scores) {
  const bySeverity = isObj(summary.by_severity) ? summary.by_severity : null;
  const critical = bySeverity && num(bySeverity.critical) !== null ? bySeverity.critical : null;
  const lines = [`## ${L.summary.heading}`];
  lines.push(`- **${L.summary.health}**: ${str(summary.overall_health) || ABSENT}`);
  lines.push(`- **${L.summary.critical}**: ${critical === null ? ABSENT : critical}`);
  if (num(summary.total_findings) !== null) lines.push(`- **${L.summary.total}**: ${summary.total_findings}`);
  const sev = mapLine(bySeverity, SEVERITY_ORDER);
  if (sev) lines.push(`- **${L.summary.bySeverity}**: ${sev}`);
  const mod = mapLine(summary.by_module, []);
  if (mod) lines.push(`- **${L.summary.byModule}**: ${mod}`);
  const eff = effortLine(summary.effort_estimate);
  if (eff) lines.push(`- **${L.summary.effort}**: ${eff}`);
  if (ordered.length) {
    lines.push(`- **${L.summary.top}**:`);
    for (const f of ordered.slice(0, 3)) {
      const id = str(f.id) || ABSENT;
      const bits = [str(f.severity), str(f.effort)].filter(Boolean).join(', ');
      const text = str(f.description) ? clip(firstSentence(f.description), 140) : '';
      // `(score N)` is appended exactly as the reference report prints it; with no score
      // for this id the line below is byte-identical to the pre-score renderer.
      const tail = [text, bits ? `(${bits})` : ''].filter(Boolean).join(' ') + scoreNote(str(f.id) ? scores.get(str(f.id)) : undefined);
      lines.push(`  - \`${id}\`${tail ? ` — ${tail}` : ''}`);
    }
  }
  return lines;
}

function renderFinding(L, finding, index, depMaps, score) {
  const id = str(finding.id) || ABSENT;
  // The score rides in the priority heading in the reference report's notation. When the
  // document carries none for this finding, `scoreNote` is empty and this heading — and
  // every line below it — is byte-identical to the pre-score renderer.
  const lines = [`### ${L.priority} ${index + 1}: \`${id}\`${scoreNote(score)}`];

  const head = [];
  if (str(finding.module)) head.push(`**${L.finding.module}**: ${oneLine(String(finding.module))}`);
  if (str(finding.severity)) head.push(`**${L.finding.severity}**: ${oneLine(String(finding.severity))}`);
  if (str(finding.effort)) head.push(`**${L.finding.effort}**: ${oneLine(String(finding.effort))}`);
  if (num(finding.confidence) !== null) head.push(`**${L.finding.confidence}**: ${finding.confidence}`);
  if (score !== undefined) head.push(`**${L.finding.score}**: ${score}`); // omitted entirely when absent
  if (head.length) lines.push(head.join(' | '));

  const loc = isObj(finding.location) ? finding.location : {};
  const file = str(loc.file);
  const line = num(loc.line);
  if (file) {
    // line 0 (and a missing line) is file-level: print the file alone, never a fake ":0"
    const ref = line !== null && line > 0 ? `${file}:${line}` : file;
    const fn = str(loc.function);
    lines.push(`**${L.finding.location}**: \`${ref}\`${fn ? ` (${fn})` : ''}`);
  } else {
    lines.push(`**${L.finding.location}**: ${ABSENT}`);
  }

  if (str(finding.description)) lines.push(`**${L.finding.description}**: ${sanitizeProse(finding.description)}`);
  if (str(finding.remediation)) lines.push(`**${L.finding.remediation}**: ${sanitizeProse(finding.remediation)}`);

  const ev = isObj(finding.evidence) ? finding.evidence : null;
  if (ev) {
    const meta = [];
    if (num(ev.metric) !== null) meta.push(`metric: ${ev.metric}`);
    if (str(ev.benchmark)) meta.push(`benchmark: ${ev.benchmark}`);
    const snippet = str(ev.snippet) ? fencedCode(ev.snippet) : null;
    if (snippet) {
      lines.push(`**${L.finding.evidence}**:${meta.length ? ` ${meta.join(' · ')}` : ''}`);
      lines.push(snippet);
    } else if (meta.length) {
      lines.push(`**${L.finding.evidence}**: ${meta.join(' · ')}`);
    }
  }

  const deps = depMaps.dependsOn.get(id) || [];
  const blocks = depMaps.blocks.get(id) || [];
  const fmt = (ids) => (ids.length ? ids.map((x) => `\`${x}\``).join(', ') : L.finding.none);
  lines.push(`**${L.finding.dependsOn}**: ${fmt(deps)} | **${L.finding.blocks}**: ${fmt(blocks)}`);
  return lines;
}

function renderPlan(L, phases, byId) {
  const lines = [`## ${L.plan}`];
  if (!phases.length) { lines.push(`- ${ABSENT}`); return lines; }
  phases.forEach((phase, i) => {
    if (i > 0 && lines[lines.length - 1] !== '') lines.push('');
    lines.push(`### ${phase.name}`);
    if (!phase.ids.length) { lines.push(`- ${ABSENT}`); }
    for (const id of phase.ids) {
      const f = byId.get(id);
      const effort = f && str(f.effort) ? ` (${f.effort})` : '';
      // The reference's plan lines are one short phrase per finding, not the full
      // remediation (which is already printed in full above): use the first sentence and
      // cap it, so nothing is paraphrased and nothing is invented.
      const text = f && str(f.remediation) ? clip(firstSentence(f.remediation), 200) : null;
      lines.push(`- \`${id}\`${text ? `: ${text}` : ''}${effort}`);
    }
    if (phase.totalEffort) lines.push(`**${L.planTotalEffort}**: ${phase.totalEffort}`);
  });
  return lines;
}

function renderDependencies(L, edges) {
  const lines = [`## ${L.dependencies}`];
  if (!edges || !edges.length) { lines.push(`- ${ABSENT}`); return lines; }
  for (const e of edges) {
    const from = e.from ? `\`${e.from}\`` : ABSENT;
    const to = e.to ? `\`${e.to}\`` : ABSENT;
    lines.push(`- ${from} **${L.finding.dependsOn}** ${to}${e.type ? ` (${e.type})` : ''}`);
  }
  return lines;
}

function renderAppendix(L, { toolkit, runType }) {
  const lines = [`## ${L.appendix}`];
  lines.push(`- ${L.appendixJson}: \`assessment.json\``);
  lines.push(`- ${L.appendixMethodology}: dontkillthevibes toolkit v${toolkit || ABSENT}`);
  if (runType) lines.push(`- ${L.appendixRun}: ${oneLine(runType)}`);
  return lines;
}

/* ---------- the renderer ---------- */

/**
 * Render an assessment document as markdown.
 *
 * @param {object} doc  {metadata, summary, findings[], work_plan:{phases, dependencies}}
 * @param {object} [options] {language='en', repo, commit, model, generatedAt, toolkitVersion}
 *   Non-empty options win over the document's own metadata.
 * @returns {string} markdown, LF line endings, exactly one trailing newline
 */
export function renderReport(doc, options = {}) {
  const d = isObj(doc) ? doc : {};
  const o = isObj(options) ? options : {};
  const L = LABELS[resolveLanguage(o.language)];

  const meta = isObj(d.metadata) ? d.metadata : {};
  const summary = isObj(d.summary) ? d.summary : {};
  const findings = (Array.isArray(d.findings) ? d.findings : []).filter(isObj);
  const workPlan = isObj(d.work_plan) ? d.work_plan : null;

  const byId = new Map();
  for (const f of findings) {
    const id = str(f.id);
    if (id && !byId.has(id)) byId.set(id, f);
  }

  const phases = normalizePhases(workPlan);
  const edges = normalizeDependencies(workPlan);
  // Additive: an empty map (no/malformed priority_scores) reproduces the old output exactly.
  const scores = normalizePriorityScores(d.priority_scores);
  // The score board, when present, IS the priority order (and the Top-3 line follows it).
  const ordered = orderFindings(findings, phases, byId, scores);

  // Depends On / Blocks per finding, both derived from the document's own edges.
  const dependsOn = new Map();
  const blocks = new Map();
  const push = (map, key, value) => {
    if (!key || !value || key === value) return;
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).includes(value)) map.get(key).push(value);
  };
  for (const e of edges || []) { push(dependsOn, e.from, e.to); push(blocks, e.to, e.from); }

  const repo = str(o.repo) || str(meta.repo);
  const date = str(o.generatedAt) || str(meta.assessed_at);
  const model = str(o.model) || str(meta.llm_used) || str(meta.model);
  const toolkit = str(o.toolkitVersion) || str(meta.toolkit_version);
  const commit = str(o.commit) || str(meta.commit);

  // Assembly. `blank()` collapses repeated separators instead of a global newline squeeze:
  // a fenced evidence snippet may legitimately contain blank lines and must never be
  // reflowed by the renderer.
  const lines = [];
  const blank = () => { if (lines.length && lines[lines.length - 1] !== '') lines.push(''); };
  const rule = () => { blank(); lines.push('---'); blank(); };

  lines.push(`# ${L.reportTitle}: ${repo || ABSENT}`);
  blank();
  lines.push(...renderProvenance(L, { repo, date, model, toolkit, commit }));
  rule();
  lines.push(...renderExecutiveSummary(L, summary, ordered, scores));
  rule();
  lines.push(`## ${L.detailedFindings}`);
  blank();
  if (!ordered.length) {
    lines.push(`_${L.noFindings}_`);
  } else {
    ordered.forEach((f, i) => {
      if (i > 0) blank();
      const id = str(f.id);
      lines.push(...renderFinding(L, f, i, { dependsOn, blocks }, id ? scores.get(id) : undefined));
    });
  }
  rule();
  if (workPlan) {
    lines.push(...renderPlan(L, phases, byId));
    rule();
  }
  if (edges) {
    lines.push(...renderDependencies(L, edges));
    rule();
  }
  lines.push(...renderAppendix(L, { toolkit, runType: str(meta.run_type) }));

  return `${lines.join('\n').trimEnd()}\n`;
}

export { LABELS, ABSENT, normalizePhases, normalizeDependencies, normalizePriorityScores };
