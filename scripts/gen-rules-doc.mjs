#!/usr/bin/env node
/**
 * gen-rules-doc.mjs — generate docs/RULES.md, the human-reviewable catalog of the
 * canonical rule registry.
 *
 * THE DEFECT THIS FILE EXISTS FOR (2026-10-08). The project ships 368 canonical
 * rules, and they were not reviewable by a human: the registry lives as prose
 * decision trees across eight skills/*.skill.md files plus the machine-readable
 * sidecar skills/detectors.json, and there was no public catalog. The owner is
 * about to publish the repository and asked, literally, "where do I see and
 * review the rules you are applying?" — and the honest answer was "nowhere
 * good". This generator produces that catalog, and it is the only place that
 * renders the registry for a human.
 *
 * ONE SOURCE OF TRUTH PER FIELD, by construction (no second parser, no second
 * list — a second copy is one more chance for the catalog to contradict the
 * rules the engine actually applies):
 *   - rule id, severity, effort, deprecation ....... loadRules()            (scripts/lib/canonical-registry.mjs)
 *   - condition, evidence, remediation, skill ...... loadSkillMetadata()    (scripts/lib/skill-metadata.mjs)
 *   - type, tool, spec ............................. skills/detectors.json  (the single source for these)
 *   - "tool not implemented" ....................... DEGRADED_TOOLS        (scripts/detect/engine.mjs)
 *   - area weights + human labels .................. loadModuleWeights() / loadModuleNames()
 *   - the area LIST ................................ the rule-id prefixes of skills/detectors.json (derived here)
 *   - the severity ordering ........................ templates/finding-schema.json severity enum
 *   - proven / declared, per rule .................. tests/fixtures/detectors/<id>/{positive,negative}/ (read from disk)
 *
 * Nothing in this file hardcodes a rule count, an area list, a tool list or a
 * proven-rule list.
 *
 * PROVENANCE (added 2026-10-08, second pass). The first version of this catalog
 * listed the rules but did not separate a rule that has been DEMONSTRATED from
 * one that is merely ASSERTED — a feature list, not an audit. The owner's
 * requirement is that the rules be editable, extendable and VALIDATABLE, so
 * every rule row now carries `proven` or `declared`, derived by reading the same
 * fixture tree the gate reads (tests/fixtures/detectors/<rule-id>/{positive,
 * negative}/): `proven` when both directories exist and each holds at least one
 * file, `declared` otherwise. This generator deliberately does NOT execute the
 * gate — that is `node scripts/detect/test-fixtures.mjs` — so the marker means
 * exactly "the fixture evidence for this rule exists on disk", never "the gate
 * was run and passed inside this process".
 *
 * DETERMINISM. Running this generator twice on unchanged sources must produce a
 * byte-identical file: every map is explicitly sorted, the `skills/` directory is
 * read in sorted order by the loaders, and there is exactly ONE wall-clock input
 * — the generation date. That date is pinnable and is pinned in this order:
 *   --date=YYYY-MM-DD  >  SOURCE_DATE_EPOCH (seconds, reproducible-builds
 *   convention)  >  the current UTC date.
 * With --date or SOURCE_DATE_EPOCH the output is reproducible forever; without
 * them, two runs on the same UTC day are byte-identical. (Deliberately NOT read
 * from `git`: spawning git would capture stdout through a pipe, which the DSH
 * Windows sandbox refuses — and a checkout's mtimes are not reproducible.)
 *
 * Usage:
 *   node scripts/gen-rules-doc.mjs                 # write docs/RULES.md
 *   node scripts/gen-rules-doc.mjs --check         # verify it is up to date (CI), exit 1 if stale
 *   node scripts/gen-rules-doc.mjs --date=2026-10-08
 *
 * Exit codes: 0 ok · 1 stale/unwritable (--check) · 2 usage/read error.
 * Dependency-free (node: builtins only), ESM.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules, rulesetFingerprint } from './lib/canonical-registry.mjs';
import { loadSkillMetadata } from './lib/skill-metadata.mjs';
import { DEGRADED_TOOLS } from './detect/engine.mjs';
import { loadModuleWeights, loadModuleNames } from './lib/module-weights.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const DETECTORS_FILE = join(SKILLS_DIR, 'detectors.json');
const OUT_FILE = join(ROOT, 'docs', 'RULES.md');
const SCHEMA_FILE = join(ROOT, 'templates', 'finding-schema.json');
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'detectors');
const COMMAND = 'node scripts/gen-rules-doc.mjs';

/**
 * The status vocabulary. These five words are the contract the deterministic
 * report also uses — the catalog must not invent a sixth meaning for a rule.
 * `UNCLASSIFIED` is not part of it: it can only appear when detectors.json is
 * missing a canonical rule id, which scripts/validate-detectors.mjs already
 * fails on, and it is printed with a warning when it happens.
 */
const STATUS = Object.freeze({
  RUNNABLE: 'runnable',
  BLOCKED: 'blocked',
  AUSENCIA: 'ausencia',
  JUICIO: 'juicio',
  FUERA: 'fuera',
  UNCLASSIFIED: 'unclassified',
});

const STATUS_LEGEND = Object.freeze({
  [STATUS.RUNNABLE]: 'a `detector` rule whose tool this runner implements — it can fire today',
  [STATUS.BLOCKED]: 'a `detector` rule whose tool this runner does NOT implement (`DEGRADED_TOOLS`) — it can never fire today',
  [STATUS.AUSENCIA]: 'a checklist / absence check: a hit proves a safeguard is MISSING, not that a violation was found',
  [STATUS.JUICIO]: 'needs a model to decide a closed question (Fase 3 — no engine exists) — NOT enforced today',
  [STATUS.FUERA]: 'declared out of scope by design — never enforced',
  [STATUS.UNCLASSIFIED]: 'canonical rule with no entry in `skills/detectors.json` — a contract violation to fix, NOT a status',
});

const EMPTY = '—'; // em dash: an absent value, never an invented one

function die(code, message) {
  console.error(message);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// inputs
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { check: false, date: null, help: false };
  for (const arg of argv) {
    if (arg === '--check') opts.check = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg.startsWith('--date=')) opts.date = arg.slice('--date='.length);
    else die(2, `unknown argument: ${arg}\nusage: ${COMMAND} [--check] [--date=YYYY-MM-DD]`);
  }
  return opts;
}

const HELP = `${COMMAND} — generate docs/RULES.md from the canonical rule registry.

usage:
  ${COMMAND} [--check] [--date=YYYY-MM-DD]

  (no flag)            write docs/RULES.md
  --check              exit 1 if docs/RULES.md differs from the sources
  --date=YYYY-MM-DD    pin the generation date (default: SOURCE_DATE_EPOCH, else UTC today)
`;

/** `YYYY-MM-DD` if the string is a real calendar date, else null. */
function isoDateOrNull(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const ok = probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return ok ? value : null;
}

/**
 * The generation date, and WHERE it came from (printed in the header so a reader
 * knows whether the file is reproducible or was generated against a clock).
 * @returns {{ date: string, source: string }}
 */
function resolveDate(cliDate) {
  if (cliDate !== null && cliDate !== undefined) {
    const d = isoDateOrNull(cliDate);
    if (!d) die(2, `--date must be a real YYYY-MM-DD date (got ${JSON.stringify(cliDate)})`);
    return { date: d, source: '`--date`' };
  }
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && epoch !== '') {
    const n = Number(epoch);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      die(2, `SOURCE_DATE_EPOCH must be a non-negative integer (seconds since epoch), got ${JSON.stringify(epoch)}`);
    }
    const d = new Date(n * 1000);
    if (Number.isNaN(d.getTime())) die(2, `SOURCE_DATE_EPOCH out of range: ${epoch}`);
    return { date: d.toISOString().slice(0, 10), source: '`SOURCE_DATE_EPOCH`' };
  }
  return { date: new Date().toISOString().slice(0, 10), source: 'UTC clock (pin with `--date=` or `SOURCE_DATE_EPOCH`)' };
}

/**
 * The canonical severity ordering, read from templates/finding-schema.json (the
 * file that defines the enum). Never invented here: if the schema is missing or
 * carries no severity enum, the caller gets an empty list and sorts by id only,
 * with a warning — an invented ordering would be the invented-severity defect
 * all over again.
 * @returns {string[]} e.g. ['critical','high','medium','low','info']
 */
function loadSeverityOrder() {
  try {
    const schema = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'));
    const enumList = schema?.properties?.severity?.enum;
    if (Array.isArray(enumList) && enumList.length > 0 && enumList.every((s) => typeof s === 'string')) {
      return [...enumList];
    }
  } catch {
    // fall through to the warning below
  }
  console.warn(`WARN: no severity enum in ${SCHEMA_FILE} — rules sort by id only`);
  return [];
}

/** Map<id, {type, tool, spec}> from the sidecar, `$`-prefixed keys ignored. */
function loadClassifications() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(DETECTORS_FILE, 'utf8'));
  } catch (e) {
    die(2, `cannot read/parse ${DETECTORS_FILE}: ${e.message}`);
  }
  const out = new Map();
  for (const [id, entry] of Object.entries(doc)) {
    if (id.startsWith('$')) continue;
    out.set(id, entry && typeof entry === 'object' ? entry : {});
  }
  return out;
}

// ---------------------------------------------------------------------------
// the fixture gate's tree: proven vs declared
// ---------------------------------------------------------------------------

/**
 * The provenance vocabulary: exactly two words, and they are the point of this
 * catalog. The fixture gate (scripts/detect/test-fixtures.mjs) requires a rule
 * to fire on `positive/` and stay silent on `negative/` before its spec stops
 * being provisional; a rule with that evidence on disk is `proven`, one without
 * it is `declared` — an assertion nobody has tested yet. There is deliberately
 * no third value: a rule with only one side of the pair is `declared`, because
 * half a gate proves nothing. The marker is FIXTURE PRESENCE, nothing more:
 * whether those fixtures PASS is the gate's verdict to give, and it SKIPs any
 * rule whose tool this runner does not implement.
 */
const PROVENANCE = Object.freeze({ PROVEN: 'proven', DECLARED: 'declared' });

/**
 * True when `dir` exists and holds at least one file anywhere beneath it. The
 * entries are sorted before recursing so the short-circuit cannot depend on
 * readdir order (no platform guarantees it).
 */
function hasFileEverywhere(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && hasFileEverywhere(join(dir, entry.name))) return true;
  }
  return false;
}

/**
 * Read the fixture tree once and report which rule ids are PROVEN. The rule id
 * is the directory name, exactly as scripts/detect/test-fixtures.mjs reads it —
 * no id, no count and no list of "proven" rules is written down in this file;
 * adding or deleting a fixture set on disk changes the catalog on the next run.
 * @returns {{ proven: Set<string>, fixtureIds: string[], rootExists: boolean }}
 */
function loadFixtureProvenance() {
  let entries;
  try {
    entries = readdirSync(FIXTURES_DIR, { withFileTypes: true });
  } catch {
    return { proven: new Set(), fixtureIds: [], rootExists: false };
  }
  const fixtureIds = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const proven = new Set();
  for (const id of fixtureIds) {
    const positive = hasFileEverywhere(join(FIXTURES_DIR, id, 'positive'));
    const negative = hasFileEverywhere(join(FIXTURES_DIR, id, 'negative'));
    if (positive && negative) proven.add(id);
  }
  return { proven, fixtureIds, rootExists: true };
}

// ---------------------------------------------------------------------------
// markdown helpers (deterministic: no locale-dependent formatting anywhere)
// ---------------------------------------------------------------------------

/**
 * One line, no cell-breaking pipe. A `|` inside a GFM table cell must be escaped
 * even inside a code span, otherwise the row gains a column. `\\|` (a literal
 * backslash before a pipe, e.g. the regex `\|`) becomes `\\\|`, which GFM reads
 * as an escaped backslash followed by an escaped pipe — the raw text survives.
 */
function cellText(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

/** A code span wide enough for any backtick run inside `value`, pipe-escaped. */
function cellCode(value) {
  const s = String(value).replace(/\r?\n/g, ' ');
  let maxRun = 0;
  for (const m of s.matchAll(/`+/g)) maxRun = Math.max(maxRun, m[0].length);
  const fence = '`'.repeat(maxRun + 1);
  const pad = s.startsWith('`') || s.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${cellText(s)}${pad}${fence}`;
}

const EMPTY_CELL = EMPTY;
const tableRow = (cells) => `| ${cells.join(' | ')} |`;

function pct(part, total) {
  if (!total) return EMPTY;
  return `${Math.round((part / total) * 100)}%`;
}

/** `detector 25 (runnable 17, blocked 8) · ausencia 3 · juicio 17 · fuera 0` */
function typeBreakdown(stats) {
  const bits = [`\`detector\` ${stats.detector} (runnable ${stats.detectorRunnable}, blocked ${stats.detectorBlocked})`];
  bits.push(`\`ausencia\` ${stats.ausencia}`);
  bits.push(`\`juicio\` ${stats.juicio}`);
  bits.push(`\`fuera\` ${stats.fuera}`);
  if (stats.unclassified > 0) bits.push(`\`unclassified\` ${stats.unclassified}`);
  return bits.join(' · ');
}

function emptyStats() {
  return {
    total: 0, proven: 0, declared: 0,
    detector: 0, detectorRunnable: 0, detectorBlocked: 0,
    ausencia: 0, ausenciaRunnable: 0, ausenciaBlocked: 0,
    juicio: 0, fuera: 0, unclassified: 0,
    ausenciaBlockedTools: new Set(), blockedTools: new Set(), tools: new Set(),
  };
}

function addStats(target, source) {
  target.total += source.total;
  target.proven += source.proven;
  target.declared += source.declared;
  target.detector += source.detector;
  target.detectorRunnable += source.detectorRunnable;
  target.detectorBlocked += source.detectorBlocked;
  target.ausencia += source.ausencia;
  target.ausenciaRunnable += source.ausenciaRunnable;
  target.ausenciaBlocked += source.ausenciaBlocked;
  target.juicio += source.juicio;
  target.fuera += source.fuera;
  target.unclassified += source.unclassified;
  for (const t of source.ausenciaBlockedTools) target.ausenciaBlockedTools.add(t);
  for (const t of source.blockedTools) target.blockedTools.add(t);
  for (const t of source.tools) target.tools.add(t);
}

/** Deterministic set-to-list for prose. */
const sortedList = (set) => [...set].sort().join(', ');

// ---------------------------------------------------------------------------
// the model: classify every canonical rule, grouped by area
// ---------------------------------------------------------------------------

/**
 * @returns {{
 *   areas: Array<{ id: string, name: string, weight: number, skillFiles: string[], stats: object, rules: object[] }>,
 *   rules: Map<string, object>, totals: object, registry: Map<string, object>,
 *   fingerprint: string, extras: string[], severityOrder: string[],
 *   fixtures: { proven: Set<string>, fixtureIds: string[], rootExists: boolean },
 *   unmatchedFixtures: string[],
 * }}
 */
function buildModel() {
  const registry = loadRules(SKILLS_DIR);
  const metadata = loadSkillMetadata(SKILLS_DIR);
  const classified = loadClassifications();
  const fixtures = loadFixtureProvenance();
  const severityOrder = loadSeverityOrder();
  const rank = new Map(severityOrder.map((s, i) => [s, i]));

  const ids = [...registry.keys()].sort();
  const unknownType = [];
  const rules = new Map();

  for (const id of ids) {
    const rule = registry.get(id);
    const entry = classified.get(id);
    const meta = metadata.get(id) ?? null;
    const severity = rule.severity ?? null;
    const effort = rule.effort ?? null;
    const type = entry && typeof entry.type === 'string' ? entry.type : null;
    const tool = entry && typeof entry.tool === 'string' ? entry.tool : null;
    const spec = entry && entry.spec !== undefined ? entry.spec : null;
    let status;
    if (type === 'detector') status = tool !== null && DEGRADED_TOOLS.has(tool) ? STATUS.BLOCKED : STATUS.RUNNABLE;
    else if (type === 'ausencia') status = STATUS.AUSENCIA;
    else if (type === 'juicio') status = STATUS.JUICIO;
    else if (type === 'fuera') status = STATUS.FUERA;
    else {
      status = STATUS.UNCLASSIFIED;
      unknownType.push(`${id} (type=${JSON.stringify(type)})`);
    }
    rules.set(id, {
      id,
      severity,
      effort,
      deprecated: rule.deprecated === true,
      supersededBy: rule.supersededBy ?? null,
      condition: meta?.name ?? null,
      remediation: meta?.remediation ?? null,
      evidence: meta?.evidence ?? null,
      skillFile: meta?.skillFile ?? null,
      type,
      tool,
      spec,
      // A tool the runner does not implement blocks the rule whether it is a
      // detector or an ausencia check (the engine skips both by tool).
      toolBlocked: tool !== null && DEGRADED_TOOLS.has(tool),
      status,
      // Provenance comes from the fixture tree on disk, never from a list here.
      proven: fixtures.proven.has(id),
    });
  }

  // The area list is DERIVED: the rule-id prefixes of the canonical registry,
  // which is the same derivation scripts/lib/area-verdicts.mjs uses. A prefix
  // present in detectors.json but with no canonical rule is surfaced as an extra.
  const areaIds = [...new Set([...ids, ...classified.keys()].map((id) => id.split('-')[0]))].sort();
  const { weights, source: weightSource } = loadModuleWeights(ROOT, areaIds);
  const { names } = loadModuleNames(ROOT, areaIds);

  const byArea = new Map(areaIds.map((a) => [a, { rules: [], stats: emptyStats() }]));
  for (const id of ids) {
    const area = byArea.get(id.split('-')[0]);
    const rule = rules.get(id);
    area.rules.push(rule);
    const s = area.stats;
    s.total++;
    if (rule.proven) s.proven++;
    else s.declared++;
    if (rule.status === STATUS.RUNNABLE) {
      s.detector++;
      s.detectorRunnable++;
    } else if (rule.status === STATUS.BLOCKED) {
      s.detector++;
      s.detectorBlocked++;
      s.blockedTools.add(rule.tool);
    } else if (rule.status === STATUS.AUSENCIA) {
      s.ausencia++;
      if (rule.toolBlocked) {
        s.ausenciaBlocked++;
        s.ausenciaBlockedTools.add(rule.tool);
      } else s.ausenciaRunnable++;
    } else if (rule.status === STATUS.JUICIO) s.juicio++;
    else if (rule.status === STATUS.FUERA) s.fuera++;
    else s.unclassified++;
    if (rule.tool !== null) s.tools.add(rule.tool);
  }

  // Severity first (canonical enum order), then id — ascending, stable, total.
  const rankOf = (sev) => (rank.has(sev) ? rank.get(sev) : severityOrder.length);
  for (const area of byArea.values()) {
    area.rules.sort((a, b) => rankOf(a.severity) - rankOf(b.severity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  // Fixed area order: by module weight (the same weights the work plan orders
  // by), then by area id. Ties are broken by id, never by map insertion order.
  const areas = areaIds
    .map((id) => ({
      id,
      name: names[id] ?? id,
      weight: weights[id],
      skillFiles: [...new Set(byArea.get(id).rules.map((r) => r.skillFile).filter(Boolean))].sort(),
      stats: byArea.get(id).stats,
      rules: byArea.get(id).rules,
    }))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const extras = [...classified.keys()].filter((id) => !registry.has(id)).sort();
  // A fixture directory whose name is not a canonical rule id is evidence for
  // nothing in this catalog; surface it rather than letting it sit there.
  const unmatchedFixtures = fixtures.fixtureIds.filter((id) => !registry.has(id));
  const totals = emptyStats();
  for (const area of areas) addStats(totals, area.stats);

  return { areas, rules, totals, registry, fingerprint: rulesetFingerprint(registry), extras, unknownType, severityOrder, weightSource, fixtures, unmatchedFixtures };
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

function renderHeader(model, generated) {
  const { totals, fingerprint } = model;
  const L = [];
  L.push('# Canonical rule catalog');
  L.push('');
  L.push('> **GENERATED FILE — DO NOT EDIT BY HAND.** Every line below is produced from');
  L.push('> the canonical sources; a hand edit is silently overwritten on the next run and');
  L.push('> fails `' + COMMAND + ' --check`. To change a rule, change the skill or');
  L.push('> `skills/detectors.json`, then regenerate.');
  L.push('');
  L.push(`- **Regenerate with:** \`${COMMAND}\``);
  L.push(`- **Verify the file is up to date:** \`${COMMAND} --check\` (exit 1 when stale)`);
  L.push(`- **Ruleset fingerprint:** \`${fingerprint}\` — from \`rulesetFingerprint()\` in \`scripts/lib/canonical-registry.mjs\`: \`<count>-<sha256(id|severity|effort)>\`, so any added, removed, reclassified or re-scored rule changes it.`);
  L.push(`- **Generation date:** ${generated.date} — from ${generated.source}. Regeneration is otherwise deterministic: the registry has ${totals.total} rules in ${model.areas.length} areas, of which **${totals.proven} are \`proven\`** (fixture-gated) and **${totals.declared} are \`declared\`** (asserted, no fixture).`);
  L.push('- **Sources (one source of truth per field — no second parser, no second list):**');
  L.push('  - `skills/*.skill.md` → rule id, severity, effort, deprecation (`loadRules()` in `scripts/lib/canonical-registry.mjs`) and the verbatim condition / remediation text (`loadSkillMetadata()` in `scripts/lib/skill-metadata.mjs`).');
  L.push('  - `skills/detectors.json` → `type`, `tool`, `spec` (the single source for these three).');
  L.push('  - `scripts/detect/engine.mjs` → `DEGRADED_TOOLS`, the tools this runner does NOT implement.');
  L.push('  - `scripts/lib/module-weights.mjs` → the area weights used for ordering, and the human label per area.');
  L.push('  - `templates/finding-schema.json` → the severity ordering (`critical` → `info`).');
  L.push('  - `tests/fixtures/detectors/<rule-id>/positive/` + `.../negative/` → the `proven` / `declared` marker: a rule is `proven` only when both directories exist and each holds at least one file. Read from the filesystem at generation time — no rule id and no count is hardcoded, so adding a fixture changes the catalog on the next run.');
  L.push('  - The area list itself is derived at generation time from the rule-id prefixes of `skills/detectors.json`; nothing above hardcodes a count, an area, a tool or a proven rule.');
  L.push('');
  L.push('## How to read this catalog');
  L.push('');
  L.push('Every canonical rule appears exactly once, under its area, with the status the');
  L.push('deterministic runner would give it **today**:');
  L.push('');
  L.push(tableRow(['status', 'meaning']));
  L.push(tableRow(['---', '---']));
  for (const status of [STATUS.RUNNABLE, STATUS.BLOCKED, STATUS.AUSENCIA, STATUS.JUICIO, STATUS.FUERA]) {
    L.push(tableRow([`\`${status}\``, STATUS_LEGEND[status]]));
  }
  if (totals.unclassified > 0) {
    L.push(tableRow([`\`${STATUS.UNCLASSIFIED}\``, `${STATUS_LEGEND[STATUS.UNCLASSIFIED]} — ${totals.unclassified} rule(s) affected`]));
  }
  L.push('');
  L.push('- The `provenance` column is the audit column: **`proven` = demonstrated, `declared` = only asserted.** A rule is `proven` when `tests/fixtures/detectors/<rule-id>/positive/` and `.../negative/` both exist and are non-empty on disk — the evidence `node scripts/detect/test-fixtures.mjs` needs to show the rule fires on what it targets and stays silent on what it should not flag. A rule with no fixture, or with only one side, is `declared`: an untested assertion. The marker is read from disk at generation time; nothing here lists which rules are proven.');
  L.push('- `blocked`, `juicio` and `fuera` rules are **not enforced today**. They are listed so the claim is reviewable, not to imply coverage.');
  L.push('- An `ausencia` rule runs, but a hit only proves that a safeguard is **missing**; it never proves a violation. `ausencia` rules whose tool is not implemented are marked `(not implemented)` and can never fire.');
  L.push(`- The raw \`spec\` is shown for \`detector\` rules only, verbatim from \`skills/detectors.json\` (one line, in a code span). Specifications are structural declarations and stay **provisional** until their positive/negative fixtures pass (PLAN.md Fase 1) — \`${COMMAND}\` does not judge whether a spec is a *good* detector for its rule.`);
  if (model.rules.size > 0) {
    const missingCondition = [...model.rules.values()].filter((r) => r.condition === null).length;
    if (missingCondition > 0) {
      L.push(`- ${missingCondition} rule(s) carry no \`IF <name>\` token: their skill states the condition in prose (usually inside backticks, e.g. “IF \`==\` used instead of \`===\`”), which the shared skill parser does not turn into a name, so the condition column shows ${EMPTY} rather than an invented label. The remediation text and the owning skill file are still shown.`);
    }
  }
  L.push('- A `deprecated` rule is kept (never deleted) so past reports keep resolving. It stays listed with its current classification, marked `deprecated → <successor>`.');
  L.push('');
  return L;
}

function renderSummary(model) {
  const { areas, totals } = model;
  const L = [];
  L.push(`## Summary — the ${areas.length} assessment areas`);
  L.push('');
  L.push('One row per area. This is the first question to ask of the ruleset: **how much of');
  L.push('each area can actually fire today?** `det. runnable` is that number; everything');
  L.push('else is either blocked, checklist-only, or waiting on a model.');
  L.push('');
  L.push('The second question is the audit question: **how much of each area has been');
  L.push('demonstrated rather than merely asserted?** `proven / declared` answers it —');
  L.push('`proven` rules carry a non-empty positive **and** negative fixture set on disk,');
  L.push('`declared` rules carry none.');
  L.push('');
  L.push(tableRow(['area', 'rules', 'proven / declared', 'det. runnable', 'det. blocked', 'ausencia', 'juicio', 'fuera', '% enforced']));
  L.push(tableRow(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
  for (const area of areas) {
    const s = area.stats;
    L.push(tableRow([
      `[\`${area.id}\`](#${anchor(areaHeading(area))}) — ${cellText(area.name)} (weight ${weightLabel(area.weight)})`,
      String(s.total), `${s.proven} / ${s.declared}`, String(s.detectorRunnable), String(s.detectorBlocked),
      String(s.ausencia), String(s.juicio), String(s.fuera),
      pct(s.detectorRunnable, s.total),
    ]));
  }
  L.push(tableRow([
    '**TOTAL**',
    `**${totals.total}**`, `**${totals.proven} / ${totals.declared}**`, `**${totals.detectorRunnable}**`, `**${totals.detectorBlocked}**`,
    `**${totals.ausencia}**`, `**${totals.juicio}**`, `**${totals.fuera}**`,
    `**${pct(totals.detectorRunnable, totals.total)}**`,
  ]));
  L.push('');
  L.push(`- The area totals sum to the registry total (${areas.map((a) => a.stats.total).join(' + ')} = ${totals.total}), and the type columns sum to it as well: \`detector\` ${totals.detector} (runnable ${totals.detectorRunnable} + blocked ${totals.detectorBlocked}) + \`ausencia\` ${totals.ausencia} + \`juicio\` ${totals.juicio} + \`fuera\` ${totals.fuera} = ${totals.total}.`);
  L.push(`- \`proven / declared\` splits every area by the evidence on disk: \`proven\` = a non-empty \`tests/fixtures/detectors/<rule-id>/positive/\` **and** \`.../negative/\`, \`declared\` = no such pair, so the two numbers always sum to \`rules\`. It is independent of \`det. runnable\`: one is about tested evidence, the other about which tool this runner implements.`);
  L.push(`- **Audit headline: ${totals.proven} of ${totals.total} rules (${pct(totals.proven, totals.total)}) are \`proven\` — demonstrated by fixtures — and ${totals.declared} (${pct(totals.declared, totals.total)}) are \`declared\`, asserted with no fixture.** Run \`node scripts/detect/test-fixtures.mjs\` to execute the gate those ${totals.proven} evidence sets feed.`);
  L.push(`- \`% enforced\` = \`det. runnable ÷ rules\`: the share of the area whose violations a deterministic detector can *prove* today. \`ausencia\` rules also execute but are excluded here, because they prove only the absence of a guard.`);
  L.push(`- **${pct(totals.detectorRunnable, totals.total)} of the ruleset (${totals.detectorRunnable} of ${totals.total}) is runnable by the deterministic engine today.** ${totals.detectorBlocked} \`detector\` rules are blocked by an unimplemented tool, ${totals.ausencia} are checklist checks, ${totals.juicio} need a model (Fase 3) and ${totals.fuera} are declared out of scope.`);
  L.push(`- Areas are ordered by module weight — the same weights the work plan orders by — read live from \`scripts/lib/module-weights.mjs\`, whose source line is: \`${model.weightSource}\`.`);
  if (totals.ausenciaBlocked > 0) {
    L.push(`- Of the ${totals.ausencia} \`ausencia\` checks, ${totals.ausenciaBlocked} ${totals.ausenciaBlocked === 1 ? 'also needs' : 'also need'} a tool this runner does not implement (${sortedList(totals.ausenciaBlockedTools)}) and can never fire today.`);
  }
  L.push('');
  return L;
}

/**
 * GitHub-style heading anchor: lowercase, drop punctuation (the em dash leaves
 * the two spaces around it behind), spaces → hyphens. So the heading
 * `security — security-assessment` anchors as `#security--security-assessment`.
 */
function anchor(id) {
  return String(id).toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
}

/** The exact `## ` heading text of an area section — its anchor is derived from this. */
function areaHeading(area) {
  return `${area.id} — ${area.name}`;
}

/** `1` → `1.0`, `1.25` → `1.25`: weights read as weights, never rounded. */
function weightLabel(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight)) return EMPTY;
  return Number.isInteger(weight) ? weight.toFixed(1) : String(weight);
}

/** `1 rule` / `2 rules` — the counts here are small enough that "(s)" reads badly. */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function renderRuleRow(rule) {
  const ruleCell = [`\`${rule.id}\``];
  if (rule.deprecated) {
    ruleCell.push(rule.supersededBy ? `**deprecated → \`${rule.supersededBy}\`**` : '**deprecated**');
  }
  let toolSpec;
  if (rule.status === STATUS.RUNNABLE) {
    toolSpec = `${cellCode(rule.tool)} — ${cellCode(JSON.stringify(rule.spec))}`;
  } else if (rule.status === STATUS.BLOCKED) {
    toolSpec = `${cellCode(rule.tool)} (not implemented) — ${cellCode(JSON.stringify(rule.spec))}`;
  } else if (rule.status === STATUS.AUSENCIA) {
    toolSpec = rule.tool === null
      ? EMPTY_CELL
      : (rule.toolBlocked ? `${cellCode(rule.tool)} (not implemented)` : cellCode(rule.tool));
  } else {
    toolSpec = EMPTY_CELL;
  }
  return tableRow([
    ruleCell.join(' '),
    `\`${rule.status}\``,
    rule.proven ? `\`${PROVENANCE.PROVEN}\`` : `\`${PROVENANCE.DECLARED}\``,
    rule.severity === null ? EMPTY_CELL : `\`${rule.severity}\``,
    rule.effort === null ? EMPTY_CELL : `\`${rule.effort}\``,
    rule.condition === null ? EMPTY_CELL : cellCode(rule.condition),
    rule.remediation === null ? EMPTY_CELL : cellCode(rule.remediation),
    toolSpec,
  ]);
}

function renderArea(area) {
  const s = area.stats;
  const L = [];
  L.push(`## ${areaHeading(area)}`);
  L.push('');
  L.push(`- **Skill source:** ${area.skillFiles.length ? area.skillFiles.map((f) => `\`skills/${f}\``).join(', ') : `${EMPTY} (no skill file declares a rule in this area)`}`);
  L.push(`- **Rules:** ${s.total} — ${typeBreakdown(s)}`);
  L.push(`- **Demonstrated:** ${s.proven} of ${s.total} ${s.total === 1 ? 'rule' : 'rules'} are \`${PROVENANCE.PROVEN}\` (a non-empty \`positive/\` and \`negative/\` fixture set exists on disk); the other ${s.declared} ${s.declared === 1 ? 'is' : 'are'} \`${PROVENANCE.DECLARED}\` — asserted, not yet demonstrated.`);
  L.push(`- **Enforced today:** ${s.detectorRunnable} of ${s.total} rules run (${pct(s.detectorRunnable, s.total)}). The other ${s.total - s.detectorRunnable}: ${plural(s.detectorBlocked, 'blocked `detector` rule', 'blocked `detector` rules')}${s.detectorBlocked > 0 ? ` — tool not implemented (${sortedList(s.blockedTools)})` : ''} · ${plural(s.ausencia, 'checklist-only rule', 'checklist-only rules')} · ${plural(s.juicio, 'rule needing', 'rules needing')} judgment (Fase 3) · ${plural(s.fuera, 'rule', 'rules')} out of scope.`);
  if (s.ausenciaBlocked > 0) {
    L.push(`- ${s.ausenciaBlocked} of the ${s.ausencia} \`ausencia\` ${s.ausencia === 1 ? 'check' : 'checks'} ${s.ausenciaBlocked === 1 ? 'needs' : 'need'} an unimplemented tool (${sortedList(s.ausenciaBlockedTools)}) and can never fire today.`);
  }
  L.push('');
  L.push(tableRow(['rule', 'status', 'provenance', 'severity', 'effort', 'condition', 'remediation (verbatim)', 'tool / spec']));
  L.push(tableRow(['---', '---', '---', '---', '---', '---', '---', '---']));
  for (const rule of area.rules) L.push(renderRuleRow(rule));
  L.push('');
  return L;
}

function renderIntegrity(model) {
  const { totals, registry, extras, unknownType, fixtures, unmatchedFixtures } = model;
  const deprecated = [...model.rules.values()].filter((r) => r.deprecated);
  const L = [];
  L.push('## Integrity of this catalog');
  L.push('');
  L.push(`- Canonical rules parsed from \`skills/*.skill.md\`: **${registry.size}**.`);
  L.push(`- Rules classified in \`skills/detectors.json\`: **${totals.total - totals.unclassified}**.`);
  L.push(`- Rules catalogued above: **${totals.total}** (${totals.total === registry.size ? `equals the registry total ${registry.size}` : `DIFFERS from the registry total ${registry.size}`}).`);
  L.push(`- Retired rules kept in the catalog (\`deprecated\`, never deleted, so past reports that cite them keep resolving): **${deprecated.length}**${deprecated.length > 0 ? ` — ${deprecated.map((r) => `\`${r.id}\`${r.supersededBy ? ` → \`${r.supersededBy}\`` : ''}`).join(', ')}` : ''}.`);
  if (!fixtures.rootExists) {
    L.push(`- **WARNING — no fixture directory at \`tests/fixtures/detectors/\`:** every rule is rendered \`${PROVENANCE.DECLARED}\` because none can be shown to be \`${PROVENANCE.PROVEN}\`. This is a missing-evidence statement, not a pass.`);
  }
  L.push(`- Fixture provenance read live from \`tests/fixtures/detectors/\`: **${fixtures.fixtureIds.length}** rule id(s) have a fixture directory, **${totals.proven}** have a non-empty \`positive/\` **and** \`negative/\` set and are therefore \`${PROVENANCE.PROVEN}\`${totals.proven > 0 ? ` (${[...fixtures.proven].sort().map((id) => `\`${id}\``).join(', ')})` : ''}; the other **${totals.declared}** rules are \`${PROVENANCE.DECLARED}\`. Run \`node scripts/detect/test-fixtures.mjs\` to execute the gate over these sets.`);
  if (unmatchedFixtures.length > 0) {
    L.push(`- **WARNING — ${unmatchedFixtures.length} fixture director${unmatchedFixtures.length === 1 ? 'y' : 'ies'} name a rule that is not in the canonical registry:** ${unmatchedFixtures.map((id) => `\`${id}\``).join(', ')} — evidence for nothing this catalog lists.`);
  }
  if (extras.length > 0) {
    L.push(`- **WARNING — ${extras.length} \`skills/detectors.json\` entry(ies) name a rule that no skill declares** (scripts/validate-detectors.mjs fails on this): ${extras.map((id) => `\`${id}\``).join(', ')}.`);
  }
  if (totals.unclassified > 0) {
    L.push(`- **WARNING — ${totals.unclassified} canonical rule(s) have no \`skills/detectors.json\` entry** (scripts/validate-detectors.mjs fails on this): ${[...model.rules.values()].filter((r) => r.status === STATUS.UNCLASSIFIED).map((r) => `\`${r.id}\``).join(', ')}.`);
  }
  if (unknownType.length > 0) {
    L.push(`- **WARNING — ${unknownType.length} entry(ies) carry an unknown \`type\`:** ${unknownType.map((s) => `\`${s}\``).join(', ')}.`);
  }
  L.push(`- Blocked-tool set (from \`scripts/detect/engine.mjs\`): ${[...DEGRADED_TOOLS].sort().map((t) => `\`${t}\``).join(', ')}.`);
  L.push(`- Tools declared in this ruleset (from \`skills/detectors.json\`): ${sortedList(totals.tools).split(', ').map((t) => `\`${t}\``).join(', ') || EMPTY}.`);
  L.push('');
  L.push(`Regenerate with \`${COMMAND}\`; verify with \`${COMMAND} --check\`.`);
  L.push('');
  return L;
}

function render(model, generated) {
  const L = [
    ...renderHeader(model, generated),
    ...renderSummary(model),
    ...model.areas.flatMap((area) => renderArea(area)),
    ...renderIntegrity(model),
  ];
  // Exactly one trailing newline; LF only, whatever the platform.
  return `${L.join('\n').replace(/\n+$/, '')}\n`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function printSummary(model, generated) {
  const { totals, areas } = model;
  const pad = (n) => String(n).padStart(4);
  console.log(`docs/RULES.md — ${totals.total} rules in ${areas.length} areas (fingerprint ${model.fingerprint}, date ${generated.date})`);
  console.log(`  detector  ${pad(totals.detector)}  (runnable ${totals.detectorRunnable}, blocked ${totals.detectorBlocked})`);
  console.log(`  ausencia  ${pad(totals.ausencia)}${totals.ausenciaBlocked > 0 ? `  (${totals.ausenciaBlocked} ${totals.ausenciaBlocked === 1 ? 'needs' : 'need'} an unimplemented tool: ${sortedList(totals.ausenciaBlockedTools)})` : ''}`);
  console.log(`  juicio    ${pad(totals.juicio)}  (Fase 3 — no engine)`);
  console.log(`  fuera     ${pad(totals.fuera)}`);
  if (totals.unclassified > 0) console.log(`  unclassified ${pad(totals.unclassified)}  (no detectors.json entry — contract violation)`);
  console.log(`  enforced today: ${totals.detectorRunnable}/${totals.total} runnable detectors (${pct(totals.detectorRunnable, totals.total)})`);
  console.log(`  proven    ${pad(totals.proven)}  (non-empty positive/ + negative/ fixtures on disk — ${pct(totals.proven, totals.total)} of the registry)`);
  console.log(`  declared  ${pad(totals.declared)}  (no fixture — asserted, not demonstrated)`);
  console.log(`  areas (by weight): ${areas.map((a) => `${a.id}(${a.stats.detectorRunnable}/${a.stats.total})`).join(' · ')}`);
  console.log(`  proven by area:    ${areas.map((a) => `${a.id}(${a.stats.proven}/${a.stats.total})`).join(' · ')}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  const model = buildModel();
  const generated = resolveDate(opts.date);
  const text = render(model, generated);

  if (model.unknownType.length > 0) {
    console.warn(`WARN: ${model.unknownType.length} detectors.json entry(ies) with an unknown type: ${model.unknownType.join(', ')}`);
  }
  if (model.extras.length > 0) {
    console.warn(`WARN: ${model.extras.length} detectors.json entry(ies) not in the canonical registry: ${model.extras.join(', ')}`);
  }
  if (model.totals.unclassified > 0) {
    console.warn(`WARN: ${model.totals.unclassified} canonical rule(s) have no detectors.json entry (run node scripts/validate-detectors.mjs)`);
  }
  if (!model.fixtures.rootExists) {
    console.warn(`WARN: no fixture directory at ${rel(FIXTURES_DIR)} — every rule renders as \`${PROVENANCE.DECLARED}\``);
  }
  if (model.unmatchedFixtures.length > 0) {
    console.warn(`WARN: ${model.unmatchedFixtures.length} fixture director${model.unmatchedFixtures.length === 1 ? 'y' : 'ies'} name a rule that is not in the canonical registry: ${model.unmatchedFixtures.join(', ')}`);
  }

  if (opts.check) {
    if (!existsSync(OUT_FILE)) die(1, `STALE: ${rel(OUT_FILE)} does not exist — run ${COMMAND}`);
    const current = readFileSync(OUT_FILE, 'utf8');
    if (current === text) {
      console.log(`UP TO DATE: ${rel(OUT_FILE)} matches the canonical sources.`);
      printSummary(model, generated);
      return;
    }
    // The generation date is the ONE wall-clock input; if it is the only
    // difference, the file is current and regenerating would only restamp it.
    const strip = (s) => s.replace(/^- \*\*Generation date:\*\*.*$/m, '- **Generation date:** <stripped>');
    if (strip(current) === strip(text)) {
      const fileDate = /^- \*\*Generation date:\*\* (\S+)/m.exec(current)?.[1] ?? '?';
      console.log(`UP TO DATE: ${rel(OUT_FILE)} matches the canonical sources (only the generation date differs: file ${fileDate}, now ${generated.date}).`);
      printSummary(model, generated);
      return;
    }
    console.error(`STALE: ${rel(OUT_FILE)} differs from the canonical sources — run ${COMMAND} and commit the result.`);
    process.exit(1);
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, text, 'utf8');
  printSummary(model, generated);
}

const rel = (p) => p.startsWith(ROOT) ? p.slice(ROOT.length + 1).replace(/\\/g, '/') : p;

main();
