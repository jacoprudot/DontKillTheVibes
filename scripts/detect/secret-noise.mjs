/**
 * secret-noise.mjs — the DECLARED and COUNTED suppression policy for the
 * credential rules (`tool: "gitleaks"`), plus the one `file-presence` spec that
 * declares the same path scope.
 *
 * WHY THIS FILE EXISTS (measured 2026-10-08)
 * ------------------------------------------
 * The 100-repo sweep produced 634 hits from the five credential rules
 * (`security-secret-in-code-1`, `security-secret-in-history-2`,
 * `security-oauth-secret-8`, `security-gha-secret-leak-3`,
 * `security-db-conn-string-6`). Hand-triage of that set found that roughly four
 * in five were not credentials at all:
 *
 *   - a hit inside a test / fixture / example / sample / mock / docs path (a
 *     fixture whose whole purpose is to contain a fake key),
 *   - a hit whose "value" is a reference to a variable
 *     (`$env:WINDOWS_SIGNING_CERTIFICATE_PASSWORD`, `process.env.X`,
 *     `{{ $credentials.slackApiKey }}`) — using an env var is the REMEDIATION of
 *     this very rule, not the leak,
 *   - an empty value (`OPENAI_API_KEY=` in a `.template`),
 *   - a value equal to its own key name,
 *   - a placeholder (`your-api-key-here`, `<your-token>`, `xxxx`, an ALL_CAPS
 *     identifier),
 *   - a line that already carries an inline `#nosec` annotation.
 *
 * A credential rule that fires on those is not measuring anything, and a
 * `critical` finding that is 80% wrong destroys the credibility of the 20% that
 * is right — which is the only thing this tool sells.
 *
 * THE TWO RULES THIS FILE OBEYS
 * -----------------------------
 *   1. NOTHING IS SUPPRESSED SILENTLY. Every reason below is a named constant,
 *      every suppression is counted PER RULE, and the count travels with the
 *      run (`findings.json.suppressions`, and the report's "Declared
 *      exclusions" section). A reader can see exactly how much was dropped and
 *      why, and can disagree with the policy by reading this file.
 *   2. A SUPPRESSION IS SCOPED BY DECLARATION, NOT BY TOOL. A spec opts in by
 *      declaring `"noise": "secret"` (gitleaks) or
 *      `params.noise: "secret-path"` (file-presence). The matcher-level
 *      alternative — filtering paths inside the tree walker — was REJECTED: it
 *      would have silently changed `code-empty-catch-1`, `code-sql-injection-risk-4`
 *      and 100+ other rules that legitimately want to look at test files.
 *      `scripts/validate-detectors.mjs` makes the declaration MANDATORY for a
 *      gitleaks spec, so a future credential rule cannot be added without
 *      deciding — silence is not an option the schema offers.
 *
 * WHAT IS DELIBERATELY NOT SUPPRESSED
 * -----------------------------------
 *   - A credential in a root-level `README.md` / `*.md` outside a docs path.
 *     Documentation is the single most common place a real key gets pasted, so
 *     a bare markdown file is NOT noise.
 *     ↳ REVERSED 2026-10-09, with evidence. The human adjudication of the
 *       sweep-100 worklist (temp/adjudication-partial-2026-10-09.json) found
 *       README hits to be placeholders and doc examples in every reviewed
 *       case, while the FP volume they added buried the real findings. README
 *       files (`.md/.markdown/.txt/.rst/.adoc`, any depth) are now a noise
 *       PATH for credential rules, counted under PATH like every other drop —
 *       and the policy can be re-reverted by deleting one line below, with the
 *       count still visible in `suppressions`.
 *   - A value that merely looks unusual. The value tests below only reject
 *     shapes that cannot be a credential (empty, key-name, placeholder word,
 *     a single low-entropy character class); a 40-char high-entropy string in a
 *     non-test path is always reported, whatever its base rate.
 *   - `security-private-key-7`'s PEM header itself: it is matched by regex over
 *     the whole line and has no `key = value` shape, so the VALUE tests skip it.
 *     Only the path scope and an inline `#nosec` can suppress a private-key hit.
 */

/** Every suppression reason this policy can emit. Stable ids: they are keys in output. */
export const SECRET_NOISE_REASONS = Object.freeze({
  PATH: 'path:test-fixture-example-docs',
  DECLARED_SCOPE: 'path:declared-spec-scope',
  ENV_USAGE: 'value:env-var-or-credential-reference',
  BARE_IDENTIFIER: 'value:bare-identifier-reference',
  EMPTY: 'value:empty',
  EQUALS_KEY: 'value:equals-key-name',
  PLACEHOLDER: 'value:placeholder-or-degenerate',
  NOSEC: 'annotation:inline-nosec',
});

/**
 * Directory segments that make a path NOISE for a credential rule. A segment is
 * compared case-insensitively against whole path components (never a substring
 * of one), so `src/latest/` is not `test/` and `contest/` is not `test/`.
 *
 * `docs`/`documentation` are included on purpose: the brief that commissioned
 * this policy names them, and a fenced example credential in a doc page is the
 * canonical false positive. A ROOT-level `README.md` is NOT covered by this list
 * (there is no `docs` segment in `README.md`) — see the header note.
 */
const NOISE_DIR_SEGMENTS = new Set([
  'test', 'tests', '__tests__', 'testing', '__mocks__', 'mock', 'mocks',
  'fixture', 'fixtures', '__fixtures__', 'spec', 'specs', 'testdata',
  'test-data', 'test_data', 'sample', 'samples', 'example', 'examples',
  'demo', 'demos', 'doc', 'docs', 'documentation',
  // 2026-10-09 adjudication: every benchmark/ and integration_test/ hit reviewed
  // was test scaffolding, never a production credential.
  'benchmark', 'benchmarks', 'integration_test', 'integration_tests',
  // 2026-10-09 ronda 2 (GLM §5.6, id 232): `packages/emulate/` in osworld carried
  // oauth fixtures of the form client_secret: "secret_abc123" — an emulator's
  // own fake credentials. A segment match, never a substring: `simulation/`
  // is not `emulate/`.
  'emulate', 'emulators',
]);

/** File-name shapes that are equally noise, wherever they live. */
const NOISE_FILE_PATTERNS = [
  /\.(test|spec|e2e|example|sample|mock|fixture)\.[^.]+$/i,
  /^(?:test|spec)[-_].*$/i,
  /.*[-_](?:test|spec|fixture)s?\.[^.]+$/i,
  /^.*\.(?:example|sample|template)\.[^.]+$/i,
  /^(?:example|sample|template)[-_.].*$/i,
  /.*\.(?:example|sample|template)$/i,
  // 2026-10-09 adjudication (see the header note): README hits were 100%
  // placeholders/doc examples in the reviewed sample. Only prose extensions —
  // a source file named readme-something.ts is still scanned. Ronda 2 (GLM
  // §3.5.1): the pattern covers localized READMEs (README.zh.md, README_de.md)
  // — the universal OSS convention — not just the unilingual one.
  /^readme(?:[._-][a-z]{2,3})?(?:\.(?:md|markdown|txt|rst|adoc))?$/i,
];

/**
 * Is this repo-relative posix path a noise path for a credential rule?
 * @param {string} rel
 * @returns {boolean}
 */
export function isSecretNoisePath(rel) {
  const p = String(rel ?? '').replace(/\\/g, '/');
  if (p === '') return false;
  const parts = p.split('/');
  for (const seg of parts.slice(0, -1)) if (NOISE_DIR_SEGMENTS.has(seg.toLowerCase())) return true;
  const base = parts[parts.length - 1] ?? '';
  return NOISE_FILE_PATTERNS.some((re) => re.test(base));
}

/**
 * A line that already carries an inline suppression annotation. Honoured as the
 * brief requires: the author has declared, in the source, that this is not a
 * secret, and re-reporting it as `critical` is how a tool teaches people to
 * ignore it.
 */
const NOSEC_RE = /#\s*nosec\b|\bnosec\b|NOSONAR|gitleaks:allow|pragma:\s*allowlist\s+secret|detect-secrets:allowlist/i;

/**
 * A reference to a credential held elsewhere. `process.env.API_KEY` is not a
 * leak: it is the FIX for the leak this rule exists to find.
 */
const ENV_USAGE_RE = new RegExp(
  [
    '\\$env:', 'process\\.env', 'os\\.environ', 'os\\.getenv\\(', 'getenv\\(',
    'ENV\\[', 'System\\.getenv', '\\{\\{\\s*\\$credentials', '\\{\\{\\s*secrets\\.',
    '\\$\\{\\{\\s*secrets\\.', 'Deno\\.env\\.get', 'import\\.meta\\.env\\.',
  ].join('|'),
  'i',
);

/** Words that, alone or as the whole compound, mean "this is not a credential". */
const PLACEHOLDER_WORDS = new Set([
  'null', 'none', 'nil', 'undefined', 'true', 'false', 'empty', 'redacted',
  'removed', 'notset', 'changeme', 'changeme', 'password', 'passwd', 'secret',
  'token', 'apikey', 'todo', 'fixme', 'na', 'foo', 'bar', 'baz', 'foobar',
  'hunter2', 'letmein', 'admin', 'root', 'dummy', 'sample', 'example',
  'placeholder', 'test', 'demo', 'yourkey', 'your', 'my', 'here', 'insert',
  'replace', 'value', 'key', 'api', 'client', 'credential', 'credentials',
  'path', 'file',
  // 2026-10-09 ronda 2, GLM id 241 (adjudicated FALSE, evidence-backed — not a
  // speculative addition): `policySnapshotToken = 'bundle-bench-snapshot'` must
  // stay dead when the camelCase recall path re-admits the line. The compound
  // test only fires when EVERY word part is in this set, so a real secret like
  // `bench-snapshot-9xK2…` still survives.
  'bundle', 'bench', 'snapshot',
]);

/** Value SHAPES that cannot be a credential (unquoted; the caller strips quotes). */
const PLACEHOLDER_SHAPE_RE = /^(?:x{3,}|\*{3,}|\.{3,}|_{3,}|-{3,}|<[^>]*>|\$\{[^}]*\}|\{\{[^}]*\}\}|%[A-Za-z_]+%|\?+)$/;
/** An ALL-CAPS SCREAMING_SNAKE identifier (`SOME_ENV_VAR_NAME`): a name, not a value.
 *
 *  The underscore is REQUIRED. Without it this test also swallowed
 *  `AKIA4T7YQ2W9ZP1LMN6R` — a realistic AWS access-key id is all-caps
 *  alphanumeric, so a bare-all-caps test is a false-negative machine. Measured by
 *  the gate (scripts/detect/test-fixtures.mjs, `secret-noise-policy`), not by
 *  inspection. A single all-caps WORD (`SECRET`, `TOKEN`) is still caught, by
 *  PLACEHOLDER_WORDS, which is case-insensitive. */
const ALLCAPS_VALUE_RE = /^\$?\{?[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\}?$/;

/** Split a compound value into its word parts (`ci-pass-123` -> ci, pass, 123). */
function wordParts(value) {
  return String(value).split(/[^A-Za-z0-9]+/).filter(Boolean);
}

/** Shannon entropy in bits per character. */
function entropy(value) {
  const s = String(value);
  if (s.length === 0) return 0;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** How many of {lower, upper, digit, symbol} appear in the value. */
function charClasses(value) {
  let n = 0;
  if (/[a-z]/.test(value)) n++;
  if (/[A-Z]/.test(value)) n++;
  if (/[0-9]/.test(value)) n++;
  if (/[^A-Za-z0-9]/.test(value)) n++;
  return n;
}

/**
 * The VALUE half of a `key = value` / `key: value` line, quotes stripped and a
 * trailing comment removed. `null` when the line has no such shape (a PEM
 * header, a connection string, an n8n `"key": "value"` is fine — that has one).
 */
export function extractValue(line) {
  const text = String(line ?? '');
  // `[ \t]*(.*)` and not `\s*(.+)`: `OPENAI_API_KEY=` is a real hit shape (an
  // empty assignment in a `.template`) and requiring one character hid it from
  // every value test, so it stayed a `critical` finding.
  const m = /^.*?[:=][ \t]*(.*)$/.exec(text);
  if (!m) return null;
  let v = m[1].trim();
  // A trailing comment is only stripped when WHITESPACE precedes it: ` //` or
  // ` #`. Without that requirement the stripper ate the scheme of every
  // connection string (`mysql://…` -> `mysql:`) and the `#` inside a generated
  // token, turning two positive fixtures into "short value" suppressions.
  v = v.replace(/\s+(?:\/\/|#).*$/, '').trim();
  const q = /^(["'`])(.*)\1$/.exec(v);
  if (q) v = q[2];
  return v.replace(/[,;)\]}]+$/, '').trim();
}

/**
 * The KEY half, normalised (lowercased, separators removed), or null.
 *
 * Runs against the whole LINE, not the regex match, because the match starts at
 * the keyword the spec searched for: for `const DATABASE_PASSWORD = "…"` the match
 * is `PASSWORD = "…"`, and comparing the value to `PASSWORD` instead of to
 * `DATABASE_PASSWORD` would miss the very shape this test exists for. A leading
 * declaration keyword is skipped so the real identifier is reached.
 */
export function extractKey(line) {
  const m = /^\s*(?:(?:const|let|var|export|public|private|protected|static|readonly|final|val|def|set|declare)[ \t]+)*([A-Za-z_][A-Za-z0-9_.\-[\]]{0,80})\s*[:=]/.exec(String(line ?? ''));
  return m ? m[1].toLowerCase().replace(/[-_.]/g, '') : null;
}

/** `scheme://user:password@host` -> the password, or null. */
function passwordFromUrl(text) {
  const m = /[a-z][a-z0-9+.\-]*:\/\/([^/\s:@]+):([^/\s@]*)@/i.exec(String(text ?? ''));
  return m ? m[2] : null;
}

/**
 * Is this VALUE unable to be a credential? Returns a reason id or null.
 *
 * The floor was RAISED from the regexes' `{8,}` to 10 characters: below that a
 * value is not distinguishable from an id, a slug or a version. It is NOT
 * raised to 12 — `postgres://appuser:S3cret!Pass@…` in this rule's own positive
 * fixture carries an 11-character password, and a policy that suppresses a
 * proven positive to hit a round number is worse than no policy. The SHAPE half
 * is the second required test: a value drawn from a SINGLE character class is
 * rejected only when it is also low-entropy, so a 16-char lowercase random token
 * survives and `aaaaaaaaaaaaaaaa` does not. Length alone would drop
 * `sk-live-ABCDEFG`; entropy alone would drop a hex token.
 */
/**
 * Single-class entropy floor (NEMO §4, 2026-10-09: "¿de dónde sale el 3.5?").
 * It only fires TOGETHER with `charClasses < 2`, so its job is narrow: reject a
 * value drawn from ONE character class that is ALSO low-entropy. PROVENANCE,
 * measured the day it was named (probe over realistic shapes):
 *
 *   survives (real token shapes):   ghp_ PAT H=4.90 · AWS secret H=4.66 ·
 *     Stripe sk_live H=4.75 · JWT segment H=4.36 · hex-32 H=3.64 ·
 *     lowercase-random-16 H=4.00 — all ≥ 3.5 or multi-class, none near the floor
 *   drops (degenerate shapes):      'a'×16 H=0.00 · 'abcabcabcabc' H=1.58 ·
 *     'passwordpassword' H=2.75 — all single-class AND < 3.5
 *
 * The gap between the lowest survivor (3.64) and the highest drop (2.75) is the
 * margin; 3.5 sits inside it. KNOWN RESIDUAL, declared: a keyboard-walk like
 * 'qwertyuiopasdfgh' is single-class H=4.00 and SURVIVES — entropy cannot see
 * keyboard adjacency, and no adjudicated corpus case justifies a fancier test.
 */
const SINGLE_CLASS_ENTROPY_FLOOR = 3.5;

export function classifySecretValue(value, line, key) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim().replace(/^["'`]|["'`]$/g, '');
  if (v === '') return SECRET_NOISE_REASONS.EMPTY;
  // EQUALS_KEY is tested FIRST, before the shape tests: `DATABASE_PASSWORD =
  // "DATABASE_PASSWORD"` is also an all-caps identifier, and the specific
  // diagnosis is the one worth counting. A reason that only ever appears as a
  // side effect of a broader one is a reason nobody can act on.
  const norm = v.toLowerCase().replace(/[-_.]/g, '');
  const keyNorm = key ?? extractKey(line);
  if (keyNorm && norm === keyNorm) return SECRET_NOISE_REASONS.EQUALS_KEY;
  // Ronda 2 (GLM §5.3, ids 172/286/302): doc placeholders in the form
  // `your-<something>` / `my-<something>` / `insert-…` / `replace-…` —
  // `your-ncbi-api-key`, `your-local-secret`, `your-discord-token`. The
  // compound test below already catches them when EVERY word is in
  // PLACEHOLDER_WORDS, but only after the shape tests and only when the split
  // yields multiple words; the prefix test is the corpus-independent form:
  // the writer is addressing the reader, whatever the words after `your-`
  // are. Placed before the shape tests so the specific diagnosis is counted.
  if (/^(?:your|my|insert|replace)[-_.]/i.test(v)) return SECRET_NOISE_REASONS.PLACEHOLDER;
  // (GLM §5.3, ids 259/260): `const token = ++deploymentRequest.current` —
  // the value extracted from the line is `++deploymentRequest`, a pre-increment
  // of a counter, not a credential. A value that BEGINS with `++`/`--` is an
  // operator application, full stop. This same test covers the CSS-custom-
  // property FP class (`colorToken = '--pg-c-objective'`, id 240): a custom
  // property IS a `--`-prefixed token. (Caveat recorded in the ronda-2 note:
  // this also suppresses a hypothetically-secret variable NAMED `++foo`, which
  // no real codebase writes.)
  if (/^[-+]{2}/.test(v)) return SECRET_NOISE_REASONS.PLACEHOLDER;
  if (PLACEHOLDER_SHAPE_RE.test(v)) return SECRET_NOISE_REASONS.PLACEHOLDER;
  if (ALLCAPS_VALUE_RE.test(v)) return SECRET_NOISE_REASONS.PLACEHOLDER;
  if (PLACEHOLDER_WORDS.has(norm)) return SECRET_NOISE_REASONS.PLACEHOLDER;
  // "made only of credential words": your-api-key-here, fixture-password, ...
  const parts = wordParts(v);
  if (parts.length > 1 && parts.every((w) => PLACEHOLDER_WORDS.has(w.toLowerCase()))) {
    return SECRET_NOISE_REASONS.PLACEHOLDER;
  }
  if (v.length < 10) return SECRET_NOISE_REASONS.PLACEHOLDER;
  if (charClasses(v) < 2 && entropy(v) < SINGLE_CLASS_ENTROPY_FLOOR) return SECRET_NOISE_REASONS.PLACEHOLDER;
  return null;
}

/**
 * The bare-identifier rule the engine already shipped (2026-10-07): an UNQUOTED
 * value that is a lone identifier is a variable reference, not a credential.
 * Moved here so the drop is COUNTED instead of silent.
 */
function isBareIdentifierReference(matchText, value) {
  if (/["']/.test(String(matchText))) return false;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value ?? ''));
}

/**
 * Classify ONE credential hit.
 *
 * @param {{path?: string, line?: string, match?: string, pathIsNoise?: boolean}} hit
 *        `path`    repo-relative posix path (used unless `pathIsNoise` is passed)
 *        `line`    the whole source line the match sits on (annotation checks)
 *        `match`   the text the spec's regex matched (`key = value` shape)
 * @returns {{ suppressed: boolean, reason: string|null }}
 */
export function classifySecretHit(hit = {}) {
  const line = String(hit.line ?? '');
  const match = String(hit.match ?? line);
  const pathIsNoise = hit.pathIsNoise ?? isSecretNoisePath(hit.path);
  if (pathIsNoise) return { suppressed: true, reason: SECRET_NOISE_REASONS.PATH };
  if (NOSEC_RE.test(line) || NOSEC_RE.test(match)) return { suppressed: true, reason: SECRET_NOISE_REASONS.NOSEC };
  if (ENV_USAGE_RE.test(line)) return { suppressed: true, reason: SECRET_NOISE_REASONS.ENV_USAGE };
  const key = extractKey(line) ?? extractKey(match);
  // A connection string is `scheme://user:password@host`: the credential is the
  // PASSWORD, and handing the whole URI to the value tests would test `host`.
  // `extractValue(line)` is the LAST fallback on purpose: a spec whose regex can
  // cross a newline (the pre-2026-10-08 `\s*` in security-secret-in-code-1 made
  // `OPENAI_API_KEY=` + the NEXT line's identifier one match) yields a `match`
  // with no readable value, while the line itself reads as an empty assignment.
  const value = passwordFromUrl(match) ?? passwordFromUrl(line) ?? extractValue(match) ?? extractValue(line);
  if (value !== null && isBareIdentifierReference(match, value)) {
    return { suppressed: true, reason: SECRET_NOISE_REASONS.BARE_IDENTIFIER };
  }
  const valueReason = classifySecretValue(value, match, key);
  if (valueReason) return { suppressed: true, reason: valueReason };
  return { suppressed: false, reason: null };
}

/**
 * The path scope a spec declares with `exclude_glob` is a SUPPRESSION too, and
 * it is counted under its own reason so the two mechanisms never blur: a glob
 * written in the spec vs. the policy in this file.
 */
export function declaredScopeReason() {
  return SECRET_NOISE_REASONS.DECLARED_SCOPE;
}
