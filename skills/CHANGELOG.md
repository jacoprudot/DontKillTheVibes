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

## 2026-10-16 — Ausencia scope: exclude lint/test/build configs from the DB-timeout gap checks

**Fingerprint: `368-08ed86b6`** (unchanged — no rule id/severity/effort change) ·
**Specs fingerprint: `368-00247948`** (changed) · **368 canonical finding rules** · 0 ids
added/removed, 0 severities changed.

Why: `content-absence` gap rules fire on every scanned file lacking the pattern; on the demo
repo they reported "DB idle timeout missing" in `.eslintrc.json`, `jest.config.ts`,
`tsconfig.json` and other lint/test/build configs — noise a reader cannot act on (found by
external product review, 2026-10-16).

What: `database-idle-timeout-missing-4` `exclude_glob` extended with
`jest.config.*`, `.eslintrc*`, `.prettierrc*`, `.babelrc*`, `babel.config.*`, `tsconfig.json`
(full-pattern brace alternation, the documented `{README.md,docs/**}` form in `glob.mjs`).
Negative fixtures added for `jest.config.ts` and `.eslintrc.json` (52/52 sets pass). The
per-file semantics of `content-absence` (a repo-level concern reported per file, capped at 20)
is a known class issue, parked for a later round — this entry fixes only the config-file
slice demonstrated in the review.

## 2026-10-15 — Ronda 5 (secret-noise classifier): corpus-backed noise classes for the credential rules

**Fingerprint: `368-08ed86b6`** (unchanged) · **Specs fingerprint: `368-fb05070a`** (unchanged —
this round extends the declared noise POLICY in `scripts/detect/secret-noise.mjs`, no spec or
registry change) · **368 canonical finding rules** · 0 ids added/removed, 0 severities changed.

Targets the two noisiest credential rules of the v4 sweep (pooled 36.6%,
`temp/r5-falses.md`, 68 adjudicated FALSE items): `security-secret-in-code-1` (47 hits, 23.4%
real) and `security-secret-in-history-2` (46 hits, 30.4% real). Both pipelines share the single
classification point `classifySecretHit({path, line, match})`, so every value-shape class below
applies to the working-tree scan AND the git-history scan. All classes are corpus-backed,
conservative and FN-safe; probe: `temp/probe-r5.mjs`. New counted reasons (every one reachable
in the `secret-noise-policy` gate):

- **`value:low-entropy-pattern`** (class B): a ≤16-char block repeated whole ≥2×
  (`c15fc15f…`, `1234567890abcdef1234567890abcdef`), or an ascending (cyclically
  wrapping) run of ≥16 chars over digits/hex/lowercase — deliberate long-line
  fillers and periodic test tokens, never high-entropy credentials.
- **`path:e2e-synthetic-value`** (class A): an `e2e|__tests__|tests?|fixtures?` path segment
  AND a value word from the synthetic-sentinel set — both signals required.
- **`value:self-describing-demo-compound`** (class C): every word of the value in
  PLACEHOLDER_WORDS ∪ a demo vocabulary (`redis-cache-password`, `jwt-signing-secret-key`,
  `default_secret_for_local_dev`); `for` joins PLACEHOLDER_WORDS as a joiner word.
- **`value:template-slot`** (class F): `^[A-Z][A-Z0-9_]+__$` slots (`__APP_VERSION_SLOT__`).
- **`value:route-path-constant`** (class I): `^/[a-z0-9][a-z0-9-]{2,}$` single-segment URL
  constants (`/forgot-password`) — declared risk documented in code.
- **Key-format prefix strip (class E)**: `sk-`/`pk-`/`rk-` (dash only — `sk_live_`, `sk_test_`,
  `phc_` untouched) expose the core to the word/entropy tests
  (`sk-your-actual-api-key-here`, `sk-` + sequential run).
- **`value:known-non-secret-prefix`** (class D): header-only JWT segment (`eyJhbGciOiJ…` with
  no dot — a full signed JWT with dots still reports), kubeseal `Ag`+base64≥40 (verified
  `timescale__pg-aiguide` `fbdf7512c3~1:chart/values/dev.yaml` lines 4/8/10), age public key
  `age1`+bech32.
- **`value:permission-label-with-label-name`** (class G): camelCase label ending
  Token|Key|Secret|Password (`revokeDeployToken`) AND a LABEL|TITLE|NAME|TEXT|DIALOG marker in
  the variable name — both signals required.
- **`value:public-by-design`** (class H): variable named `public*` or value starting
  `public-` (Stytch publishable keys) — accepted risk documented in code.

Fixtures: `security-secret-in-code-1` negative `src/ronda5-noise.yml`, `scripts/e2e/proof.mjs`,
`src/ronda5-labels.js`; positive `src/ronda5-real.js` (sk_live/hex32/hex42/slashed-token/pwd=
shapes must-survive). `security-secret-in-history-2` negative `commits/2024-01-07T0900` and
positive `commits/2024-01-05T1000` (same shapes through the history pipeline;
`expected_positive.txt` 1 → 6). `temp/r5-progress.md` carries the full log.

---

## 2026-10-15 — Ronda 4 (version_audit spec surgery): scoped-emulator paths, value shapes, sqli exclusions, emission dedup, quarantine tier

**Fingerprint: `368-08ed86b6`** (unchanged) · **Specs fingerprint: `368-fb05070a`** (changed —
declared here) · **368 canonical finding rules** · 0 ids added/removed, 0 severities changed.

All changes answer the 2026-10-13 GLM version_audit (28.0% pooled over 343 crit+high findings,
96 real / 247 false, `temp/adjudication-v3-verdict-map-glm.json`); every mechanism was
verified against the real clone before touching code (`temp/probe-r4-investigate.mjs`) and
every fix was probe-validated after (`temp/probe-r4.mjs`): all 18 targeted FALSE ids
suppressed, 0 of the 96 adjudicated REALS killed.

- **`isSecretNoisePath` strips one leading `@` from a directory segment** — npm-scoped
  packages (`packages/@emulators/…`, 18 census items across four credential rules) carry
  fake emulator credentials under a scope the segment comparison could not see.
- **The file-path value test admits absolute paths** (`/usr/local/bin/init-firewall`,
  `/data/wechat-token`): leading slash, extension optional, ≥2 segments — while the
  extension stays REQUIRED for relative paths, so `foo/bar` (possibly `user:pass`) still
  reports. **`your-`/`test-`-family prefix tests also run on a dash-stripped copy** and
  PLACEHOLDER_WORDS gains `secure` — a compose default `${VAR:-your-secure-api-key-here}`
  extracts with a leading dash that used to defeat the `^`-anchored prefix test.
- **`code-sql-injection-risk-4` exclude_line_pattern gains four corpus-backed clauses**:
  `e.g.` may carry whitespace before the quote/brace (docstring examples), single-letter
  internal identifiers (`{h}`), WHERE/ORDER/LIMIT-family tokens with any affix
  (`{time_where}`) keep the bind-evidence clause, and string concat ending in an enumerated
  internal table variable (`"DELETE FROM " + tbl`) — the last one declared PROVISIONAL in
  the spec note until an input-origin mechanism replaces the enumeration.
- **The engine dedups emission by (rule, file, line)** — the git-history secret scan used
  to emit the same location twice (the commit that added the line and the commit that
  removed it: vercel-labs__emulate clerk:68, okta:126, SKILL.md:96). Two DIFFERENT rules on
  the same line are not touched. The history fixture gains `expected_positive.txt` support
  (the runner used to ignore it) and pins exactly 1 — a dedup regression now fails the gate.
- **New `tier: "quarantine"`** (validator-accepted, propagated to findings.json, labelled in
  the report's plan as `[quarantined — precision 0% human-verified, excluded from score]`):
  `cost-db-no-pooling-10` (0/22 real) and `security-gha-pr-target-risk-1` (0/7 real) still
  run; the pooled precision excludes their findings exactly like `judgment`.
- **Regression fixtures** (all inside existing sets — the fixture count is unchanged):
  `security-secret-in-code-1` negative `packages/@emulators/clerk/src/index.ts` +
  `src/round4-path-values.yml`, positive `packages/@infra/config.ts` (FN-safe: a scoped
  package is NOT an emulator); `code-sql-injection-risk-4` negative
  `src/round4_provisional.py`; `security-secret-in-history-2/expected_positive.txt`.

---

## 2026-10-12 — Ronda 3 (adjudication-driven spec surgery): scope gating + noise policy extension

**Fingerprint: `368-08ed86b6`** (unchanged) · **Specs fingerprint: `368-49f988e7`** (changed —
declared here) · **368 canonical finding rules** · 0 ids added/removed, 0 severities changed.

All changes answer the 2026-10-12 GLM adjudication (`temp/adjudication-v2-verdicts.json`,
62 real / 317 falso) consolidated in `docs/internal/CONSOLIDACION-ADJUDICACION-V2.md`. Every
spec change was probe-validated against the adjudicated corpus BEFORE adoption
(`temp/probe-r3.mjs`): **0 adjudicated REALS killed** by any gate; every suppressed FALSE
class is corpus-backed. New matcher params are rule semantics (same class as `path_glob`),
not post-hoc suppressions, so nothing they drop is counted in `suppressions`.

- **`file-content-regex` gains `require_pattern` / `exclude_pattern` (file scope) and
  `exclude_line_pattern` (hit-line scope)** — a hit only counts if the file matches
  `require_pattern` and not `exclude_pattern`, and hit lines matching `exclude_line_pattern`
  are out of the rule's definition. Validator accepts the three as compiling regexes.
- **`cost-db-no-pooling-10`** (0/39 real in the sample): gated to files importing a DB
  library; files importing MCP / vscode-languageserver / net are vetoed. 25 of 39 falsos
  gated out; the 14 remaining are real `pg.Client` hits in one-shot CLI/migration scripts
  (adjudicated not-a-defect) — quarantine candidates, never silently dropped.
- **`github-log-pattern-6`** (1/10 real): TS type unions (`type LogLevel = "debug" | ...`),
  string-literal SSH params and ternary verbosity kwargs excluded at line scope. 9/9 falsos
  suppressed, the 1 real still fires.
- **`code-sql-injection-risk-4`** (14/71 real): line scope removes error/log prose,
  bind-param evidence (`?`, `:name`, `%(name)s`, `VALUES(?)`), internal identifiers
  (`self.X`, UPPER constants, `*col/*field/*clause` names, bare `{table}/{name}`), and
  LIMIT/OFFSET/WHERE templates WITH bind evidence. 37/57 falsos suppressed. DECLARED
  RESIDUAL: dict-subscript (`{data['table']}`) and inline `join()` identifiers stay firing —
  the line regex cannot separate their corpus-falso from their corpus-real (uber__ADR
  sql_toolkit), and FN-safe wins.
- **Secret-noise policy extension** (credential rules): value prefixes (`test-`, `fixture-`,
  `synthetic-`, `dummy-`, `sample-`, `demo-`, `playground…`, `example-`), standalone-word
  `fake` (embedded FAKE kept — the blunt test killed fixture positive `sk_live_FAKE_DO_NOT_USE`),
  x-group placeholders, `example.*/localhost` URLs, file-path values, SOPS `ENC[...]` marker,
  star-history badge URLs (`sealed_token` is public by design); compound-word set extended
  with adjudicated parts (`user_provided_key`, `id_token_from_idp`, `revokeDeployToken`,
  `stytch_session_token`, …); README noise pattern fixed for language+region suffixes
  (README.zh-CN.md); `.lsif` generated index files excluded. 12-survivor gate still green.
- **Fixtures**: regression sets added for every class above (MCP/LSP gating, TS type unions,
  parametrized SQL, ronda-3 placeholder values). Gate: 52/52.

## 2026-10-10 — Fase D (external-review remediation): quarantine + judgment tier + dead-branch gate + adjudicated decisions

**Fingerprint: `368-08ed86b6`** (unchanged) · **Specs fingerprint: `368-393ab466`** (changed —
declared here) · **368 canonical finding rules** · 0 ids added/removed, 0 severities changed.

All four items answer `docs/internal/CRITICA-rondas-1-2-2026-10-10.md` (verified 8/10 exact):

- **D1 Quarantine (GLM #8)** — a PATH-suppressed credential hit whose VALUE survives every
  value test is no longer silently dropped: it lands in `findings.json.quarantined` and a
  own report section ("manual review"), ranked by entropy, capped at 20, carrying NO
  evidence by design. Not findings: publishable precision is untouched. Probe:
  `temp/probe-quarantine.mjs` (README with a real-shaped key → quarantined; placeholder →
  dropped; src key → finding).
- **D2 Tier `judgment` (K3 #2)** — optional entry field; first carrier
  `structure-inverted-dependency-2` (flags any `*Service` file importing anything named
  `*Controller`; a layer graph may fully legitimise that). Findings carry `tier`, the work
  plan labels them `[judgment — needs human context]`, and the Fase-E precision score
  excludes them. Validator accepts only `judgment`.
- **Dead-branch gate (the critic's deepest finding)** — `positive >= 1` per FILE could not
  see a dead regex branch (the sql-injection concat branch lived months at zero). Fixtures
  may now ship `expected_lines.txt` (`repo-relative-path:line` rows); each declared line
  must receive a finding. First pin: `code-sql-injection-risk-4` lines 10/15/19. Tamper-
  tested both directions.
- **D3 Residuals, decided** — `.env.defaults` added to the env-file exclude (dotenv
  convention; a live value there is still caught by the content rules) with a regression
  fixture; `.envrc` stays excluded, deliberate: the file-presence rule stays scoped to
  `.env` while gitleaks content rules still scan `.envrc` — a committed live export there
  is caught. Snake-case tails and prose-comma stay measured-not-fixed (Fase E worklist).
- **gha-secret-leak-3 carve-out audited** — `--password-stdin|file` carve-out is fixture-
  locked for the sound case; confirmed weakness: the exemption is LINE-scoped and masks a
  second `secrets.` exposure on the same line (probe-documented). Declared, not regex-
  fixed; Fase E measures prevalence.
- **logs-secrets-10 post-fix count** — the rule that produced 68 critical findings in the
  v1 sweep now produces **5 over the same 100 pinned repos** (`temp/measure-logs-secrets-10.mjs`).
  Caveat carried from the critic: the 68 came from a directed selection and is not
  projectable; the 5 is a full-corpus count on the same pinned SHAs.

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
