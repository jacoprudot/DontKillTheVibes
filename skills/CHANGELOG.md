# Ruleset CHANGELOG

The canonical rule registry is `skills/*.skill.md`. Every `→ FINDING: <id>` line is a
public id: shipped reports cite it, so adding, removing or re-scoring one changes the
tool's observable contract. This file is the record of those changes.

## Convention

- **Every ruleset change gets a dated entry, newest first.**
- The entry MUST contain the **fingerprint computed after the change**, written verbatim
  (for example `368-6e180554`). The fingerprint is
  `rulesetFingerprint()` from `scripts/lib/canonical-registry.mjs`:
  `"<rule count>-<sha256[0..8]>"` over the canonical string
  `` `${id}|${severity}|${effort}` `` for every rule, ids sorted, joined by `\n`, with
  `null` severity/effort rendered as the empty string. Same rules => same fingerprint; any
  add, removal or severity/effort change => a different fingerprint.
- Each entry lists **what changed**: added ids, removed ids, severity/effort changes,
  deprecations (with their replacement), plus the rule count and, when the change is a
  reclassification, what the ids became instead.
- **Rules are retired by deprecation, never by deletion.** Keep the `→ FINDING:` line and
  append `[deprecated -> <replacement-id>]` (or `[deprecated]` when nothing replaces it):
  the id stays canonical so past reports keep validating, and the validator downgrades a
  citation of it to a warning. A deleted id is a broken report.
- Record **why**, in one line. A bare id list does not explain a reclassification.

## How it is enforced

- `node scripts/registry-diff.mjs [git-ref]` rebuilds the registry from the working tree and
  from the same files at `git-ref` (default `HEAD`), prints ADDED / REMOVED / CHANGED /
  DEPRECATED plus both fingerprints, and gates on this file:
  - fingerprint changed and this file does not mention the new fingerprint => exit 1;
  - an id removed without `[deprecated …]` => exit 1, always;
  - fingerprint unchanged => exit 0 (nothing to declare).
- `pnpm validate:skills` fails on a duplicated rule id (`loadRules` is silently last-wins on
  duplicates, which is how an id can quietly change meaning) and on a malformed id.
- Both are intended to run in CI on every push and pull request.

---

## 2026-10-09 — external-review remediation, ronda 2: value-layer supervivientes + SQL concat gate + recall net + the specs gate

**Fingerprint: `368-08ed86b6`** (unchanged) · **Specs fingerprint: `368-f17003f9`** (changed —
declared here) · **368 canonical finding rules** · 0 ids added or removed, 0 severities
changed — spec-only and policy changes.

Source: `REVISION-GLM-2026-10-09.md` §5, verified independently before touching anything
(8/8 reproduced). The ronda-1 entry below carried this warning: *the ruleset fingerprint
hashes only `id|severity|effort` and is blind to `detectors.json` specs — six specs changed
and no gate saw it.* **That hole is now closed**: `specsFingerprint()` in
`scripts/lib/canonical-registry.mjs` hashes the whole execution contract and
`scripts/registry-diff.mjs` gates it against this changelog exactly like the ruleset
fingerprint. From this entry forward, "fingerprint unchanged" can never again hide a spec
change.

What changed (all measured, none of it silent):

- `scripts/detect/secret-noise.mjs`:
  - README path pattern now covers **localized** READMEs (`README.zh.md`, `README_de.md`,
    `[._-][a-z]{2,3}` segment) — GLM §3.5.1, fixes the FN where the ronda-1 unilingual
    pattern left localized ones scannable.
  - New value test: a value beginning with `++` or `--` is an operator application, not a
    credential (`const token = ++deploymentRequest.current`) — GLM §5.3, ids 259/260.
  - New value test: a value beginning with `your-` / `my-` / `insert-` / `replace-` is the
    writer addressing the reader — GLM §5.3, ids 172/286/302, corpus-independent form of
    the placeholder-word test.
  - `NOISE_DIR_SEGMENTS` += `emulate`, `emulators` (segment match, not substring) —
    GLM §5.6, id 232 (`client_secret: "secret_abc123"` inside an emulator package).
- `skills/detectors.json` — `code-sql-injection-risk-4`, branch 2 (string concatenation)
  gated on real query shape: the concatenated side must carry `SELECT…FROM` / `INSERT INTO`
  / `UPDATE…SET` / `DELETE FROM`, not merely mention the words in prose. Probe
  `temp/probe-r2-sqli.mjs`: 15/15 (concat positives stay live; `print("Error: SELECT
  returned " + str(count))` drops). GLM §5.1.
- `skills/detectors.json` — `security-secret-in-code-1` gains an optional `recall_regex`
  (camelCase PREFIX vars: `accessToken`, `sessionToken`, `clientSecret`): the main regex's
  FP lookbehind had blinded it to them. Engine admits recall hits ONLY through the value
  layer (path policy + `classifySecretValue` must both clear). Probe
  `temp/probe-r2-recall.mjs` BEFORE/AFTER: `accessToken = "eyJ…"` ZERO → LIVE;
  `colorToken = '--pg-c-objective'` stays ZERO with the drop counted. The recall NET
  (true positives minus re-admitted FPs) is measured on the re-sweep, not assumed.
- `skills/detectors.json` — `security-private-key-7` regex widened: `ENCRYPTED PRIVATE KEY`
  (PKCS#8) and `DSA PRIVATE KEY` headers were invisible. Probe: encrypted PEM ZERO → LIVE.
- `scripts/detect/secret-noise.mjs` — PLACEHOLDER_WORDS += `bundle`, `bench`, `snapshot`
  (GLM id 241, adjudicated FALSE — evidence-backed, so the recall path keeps
  `policySnapshotToken = 'bundle-bench-snapshot'` dead). The `++`/`--` guard from above
  also covers the CSS-custom-property class (`--pg-c-objective`) explicitly.
- `scripts/detect/engine.mjs` — `runGitleaksLite` implements the recall path (counted,
  budget- and CAP-respecting); `scripts/validate-detectors.mjs` validates the optional
  field.
- `scripts/lib/canonical-registry.mjs` — new `specsFingerprint()`: sha256 over the whole
  `detectors.json` execution contract (per-id stable JSON, `$`-metadata excluded). NEMO §3
  also closed: `validate-detectors.mjs` now REJECTS a `path_regex` on a working-tree
  gitleaks spec (it is silently ignored by the runner — only `.git/`-targeting specs may
  carry one). NEMO §4 closed: the entropy floor is the named, measured
  `SINGLE_CLASS_ENTROPY_FLOOR` (survivors ≥ 3.64, drops ≤ 2.75; keyboard-walks declared
  as the known residual).
- New negative fixtures: `security-secret-in-code-1` (`src/counter-token.ts` ids 259/260,
  `README_zh.md` id 302, `CONFIGURATION.md` id 286), `flows-n8n-hardcoded-secrets-7`
  (`SKILL.md` id 172), `code-sql-injection-risk-4` (`src/concat_prose.py`). The
  `ui-tokens.js` header comment is corrected: it claimed ids 259–264, it asserts 240/241.
- `docs/RULES.md` regenerated.

Known residual (declared, not fixed here): the D3 set — snake-case `.env`-style variable
tails, prose-comma values, `.envrc` — stays measured in the re-sweep, not regex-fixed.

## 2026-10-09 — external-review remediation, ronda 1: five credential rules, FP supervivientes

**Fingerprint: `368-08ed86b6`** (unchanged — see the hole declared in the ronda-2 header;
this entry is the first one it hides) · **368 canonical finding rules** · 0 ids added or
removed, 0 severities changed.

Measured on the sweep-100 adjudication: of 634 raw credential hits, ~4 in 5 were not
credentials (fixtures/examples, env-var references — the remediation, not the leak —,
empty values, placeholders). The suppression policy moved from inline engine code into the
DECLARED and COUNTED `scripts/detect/secret-noise.mjs`; every drop carries a named reason
and per-rule count in `findings.json.suppressions`.

Spec changes (`skills/detectors.json`, all `noise: "secret"` gitleaks specs):
`security-secret-in-code-1`, `security-secret-in-history-2`, `security-oauth-secret-8`,
`security-gha-secret-leak-3`, `security-db-conn-string-6` — exclude globs widened
(`*.example*`, `*.sample*`, docs paths), the `security-secret-in-history-2` history probe
limited to non-test paths.

Reconciliation: the adjudicated "nimbalyst secrets 20 → 9" count already contains ids
259/260 (adjudicated FALSE in the ronda-1 pass, fixed only in ronda 2). **Do not re-cite
the ronda-1 adjudication numbers until the re-sweep re-measures them** (ronda 2 Fase E).

---

## 2026-10-08 — calibration: metrics become suggestions, an absence stops being a grade

**Fingerprint: `368-08ed86b6`** (was `368-6e180554`) · **368 canonical finding rules** · no
rule added, none removed, **30 severities changed**

Measured on the pre-registered 100-repo sweep (`benchmark/sweep-100.mjs`, 100 full-history
repos, 18 780 detector findings + 38 210 checklist gaps). Five rules produced 76% of all
`critical`/`high` volume, and four in five credential findings were not credentials. Two
independent axes were applied, and every rule below is listed with the axis that moved it.

**A. MACRO — a rule that fires on more than half of 100 real repositories describes the
NORM, not a defect. It cannot carry `critical` or `high`.** (base rate: fired-on / 100)

| rule | was | now | fired on | why |
|---|---|---|---|---|
| `code-extreme-complexity-1` | critical | low | 94/100 | cyclomatic complexity is a metric |
| `code-high-complexity-2` | high | low | 94/100 | cyclomatic complexity is a metric |
| `code-extreme-length-6` | high | low | 94/100 | file length is a metric |
| `flows-n8n-no-error-handling-1` | high | low | 90/100 | ausencia checklist item |
| `flows-dlq-on-repeat-failures-10` | high | low | 85/100 | ausencia checklist item |
| `flows-missing-dlq-2` | high | low | 85/100 | ausencia checklist item |
| `cost-dev-setup-missing-3` | high | low | 76/100 | ausencia checklist item |
| `cost-no-automated-tests-4` | high | low | 74/100 | ausencia checklist item |
| `database-missing-index-fk-1` | high | low | 55/100 | ausencia checklist item |

The six `ausencia` rules keep a catalog severity that no graded output reads any more (see
the engine note below), but the CATALOG is still live in the LLM assessment path
(`scripts/dktv-orchestrate.mjs` `stampRuleFields` scores `severity × module × confidence`),
so a `high` there would have kept corrupting that plan.

**B. NATURE — a metric (complexity, length, parameter count, nesting, duplication size,
size counts) is a SMELL; it is a suggestion, not a graded finding. Destination: `low`.**

| rule | was | now | axis |
|---|---|---|---|
| `code-moderate-complexity-3` | medium | low | cyclomatic complexity |
| `code-extreme-nesting-4` | high | low | nesting depth |
| `code-high-nesting-5` | medium | low | nesting depth |
| `code-long-function-7` | medium | low | function length |
| `code-too-many-params-9` | medium | low | parameter count |
| `code-long-parameter-list-8` | medium | low | parameter count |
| `code-boolean-parameter-plague-11` | medium | low | parameter count |
| `code-exact-duplication-massive-1` | high | low | duplication size |
| `code-exact-duplication-significant-2` | medium | low | duplication size |
| `code-structural-duplication-high-4` | medium | low | duplication |
| `code-copy-paste-variant-6` | medium | low | duplication |
| `code-god-object-6` | high | low | class size (methods / lines) |
| `code-god-package-9` | high | low | package size (file count) |
| `code-interface-bloat-8` | medium | low | method count |
| `code-too-many-attributes-7` | medium | low | attribute count |
| `code-deep-inheritance-9` | medium | low | hierarchy depth |
| `code-mutable-default-3` | high | low | smell (5/100 base rate — rarity does not make a metric critical) |
| `code-generic-catch-2` | high | low | handler breadth: a style shape, not a demonstrated failure |
| `code-bare-except-with-others-2` | high | low | same family as `code-generic-catch-2` |

**C. ERROR SWALLOWING — a real defect, but not the tier of an exposed credential.**

| rule | was | now | why |
|---|---|---|---|
| `code-empty-catch-1` | critical | medium | swallowing an exception is a defect (47/100, under the norm line) but it is not a credential exposure; `medium` keeps it in the 60-day plan |
| `code-bare-except-1` | critical | medium | same defect family as `code-empty-catch-1`; grading one `critical` and the other `medium` would be incoherent |

**Deliberately NOT changed, and why** (the base-rate flag named several of these):

- every breach keeps its grade regardless of base rate: `security-secret-in-code-1`,
  `security-secret-in-history-2`, `security-oauth-secret-8`, `security-private-key-7`,
  `security-db-conn-string-6`, `security-gha-secret-leak-3`, `flows-n8n-hardcoded-secrets-7`,
  `code-sql-injection-risk-4`, `code-logs-secrets-10`, `security-jwt-weak-3`,
  `security-debug-in-prod-1` (pattern tightened, severity kept),
  `security-env-file-committed-3` (path scope tightened, severity kept),
  `security-gha-pr-target-risk-1` (6/100 — the base-rate premise was wrong for it; its spec
  already requires `pull_request_target` within 400 characters of a checkout or a secret);
- `cost-api-in-loop-3`, `cost-db-no-pooling-10`, `database-not-null-violation-4`,
  `database-sequential-pagination-1`, `github-log-pattern-6`, `structure-inverted-dependency-2`:
  behavioural or dangerous-default rules at 1–19/100, not metrics;
- the `medium`-tier metrics are covered by group B (all moved to `low`). The rules left at
  `medium` above are behavioural (`code-system-exit-misuse-5`, `code-map-lookup-unchecked-7`,
  `code-missing-validation-4`, …), not counts.

**What this does to the plan (not a severity change, but part of the same calibration):**
`ausencia` findings now carry `severity: null`, `score: 0`, `phase: null` and
`graded: false` in `findings.json`; they stay in the report as an ordered, ungraded
checklist with their files and "Add: <remediation>" line. `low`/`info` detector findings
are no longer in the 30/60/90 plan either — they are suggestions in the appendix. The plan
is now `critical`/`high` → 30 days, `medium` → 60 days.

**Credential specs tightened in the same entry** (no severity moved; the SPECS did, and the
specs are not covered by the fingerprint): the five credential rules plus
`flows-n8n-hardcoded-secrets-7` now declare `spec.noise: "secret"` and are filtered through
`scripts/detect/secret-noise.mjs`; `security-debug-in-prod-1`'s pattern is anchored and
`security-env-file-committed-3`'s glob no longer matches `.envrc`. Every suppressed hit is
counted per rule and per reason in `findings.json.suppressions`. See
`docs/RULES.md` for the per-rule status that follows from this entry.

## 2026-10-04 — deprecation: flows-missing-security-headers-10

**Fingerprint: `368-6e180554`** (unchanged — deprecation does not alter the canonical
`id|severity|effort` string) · **368 canonical finding rules**

- **Deprecated:** `flows-missing-security-headers-10` (severity: low, effort: S) in
  `skills/flows-assessment.skill.md` is superseded by `security-missing-headers-10`
  (severity: medium, effort: S) in `skills/security-assessment.skill.md`.
- **Why:** both rules described the same defect (missing security headers) with different
  severities, so the 30/60/90 plan changed depending on which one a report cited. The
  security module owns this defect class; citing the flows id now produces a deprecation
  warning, never a scored finding. Detected by an external Path-A audit on 2026-10-04.
- No rules added, none removed, no severity/effort changed by this entry.

## 2026-10-03 — current ruleset

**Fingerprint: `368-6e180554`** · **368 canonical finding rules**

- **Migration (26 ids reclassified, not removed):** all 26 `github-tech-stack-*` rules in
  `skills/github-intelligence.skill.md` were RECLASSIFIED from `→ FINDING:` to
  `→ PROFILE:`. They describe detected stack/profile metadata (framework, hosting, CI,
  package manager…), not defects, so they must not be scored, prioritised or reported as
  findings. They no longer count as canonical finding ids and can no longer appear in an
  assessment's `findings[]`; the `→ PROFILE:` lines keep the metadata contract (id,
  severity, effort) visible in the same decision tree. Measured counts: 394 canonical
  finding rules immediately before the change (commit `1c0474e`), 368 after (394 − 26 =
  368); fingerprint `394-94676d4c` → `368-6e180554`.
- No rules added, none removed, no severity/effort changed by this entry.
- Tooling landed with this entry: `rulesetFingerprint()` and `findDuplicateIds()` in
  `scripts/lib/canonical-registry.mjs`, the `[deprecated -> <id>]` rule convention,
  `scripts/registry-diff.mjs` (this gate), the duplicate-id failure in
  `scripts/validate-skills.mjs`, and the deprecated-rule / `metadata.ruleset_version`
  warnings in `scripts/validate-assessment.mjs`.
- `metadata.ruleset_version` is now stamped by `scripts/dktv-orchestrate.mjs`, so every
  assessment records the fingerprint it was scored under.
