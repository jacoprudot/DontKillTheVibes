# Detect hang + coverage fix — 2026-10-07

Closes the two defects the 21-repo sweep (`../detect-sweep-2026-10-07/SWEEP.md`)
proved: (1) one pathological rule silently produced ZERO artifacts for a whole
repo, and (2) "not covered" was rendered as "healthy" (grade A/B).

Nothing here was tuned for a better number. Every number below comes from the
same bounded harness (`run-bounded.ps1`: `Start-Process` + `WaitForExit(cap)` +
`taskkill /T /F`, exactly the shape the sweep used) run twice: BEFORE against a
frozen copy of the pre-fix tree, AFTER against the working tree.

## How BEFORE was measured (this matters)

`scripts/` and `skills/` were copied to `%TEMP%\dktv-before-tree` and
`skills/detectors.json` was restored from `git show HEAD:skills/detectors.json`
(0ee6743). Everything else in the copy is byte-identical to the working tree at
the moment of freezing, so the only difference between BEFORE and AFTER is the
fix under review. The frozen copy was taken **before** any script in
`scripts/` was edited. Wall clock on this machine drifts by ~1 s between runs of
the same repo; the BEFORE hang numbers did not drift — they sat on the cap.

## Reproduce

```powershell
# AFTER (working tree)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File benchmark/detect-hangfix-2026-10-07/run-bounded.ps1 `
  -Name chatbot-ui -Target $PWD\benchmark\work\chatbot-ui `
  -Out $PWD\benchmark\detect-hangfix-2026-10-07/after/chatbot-ui `
  -Reporter $PWD\scripts\detect\report.mjs -CapSeconds 180

# pattern semantics (HEAD vs working tree): 0 differences required
node benchmark/detect-hangfix-2026-10-07/pattern-semantics.cjs

# before/after table
node benchmark/detect-hangfix-2026-10-07/compare.cjs
```

## Result 1 — the two hang repos

| repo | before | after | artifacts after (findings / report / prompts) |
|---|---|---|---|
| chatbot-ui | **timeout @ 180.20 s, ZERO artifacts** | **1.69 s** | 300 827 B / 66 293 B / 54 986 B |
| aurora-synth | **timeout @ 180.16 s, ZERO artifacts** | **2.26 s** | 288 308 B / 63 693 B / 47 316 B |

Single-file bisection from the sweep (`diag/file/…`) said the whole run was lost
inside one `exec()`: `aurora-synth/src/demo/songlib.js` (34 856 B) and
`chatbot-ui/components/utility/global-state.tsx` (10 276 B). Measured after the
fix, with the same rules:

| file | `code-many-params-10` | `code-too-many-params-9` |
|---|---|---|
| `aurora-synth/src/demo/songlib.js` | 4 matches, **0.6 ms** | 3 matches, **0.7 ms** |
| `chatbot-ui/components/utility/global-state.tsx` | 0 matches, **0.3 ms** | 0 matches, **0.3 ms** |

## Result 2 — coverage and grade

`not examined` = non-binary files no regex rule could analyse = files matched by
no rule path-glob **plus** files refused by a read guard. That is the number the
grade uses; both components are reported separately.

| repo | not examined (after) | parts | grade before | grade after |
|---|---|---|---|---|
| cyberpunk-hud | 19 / 25 (76 %) | 19 no-glob + 0 guard | **A** | **C\*** |
| mini-redis | 30 / 33 (91 %) | 30 + 0 | **B** | **C\*** |
| fatfree | 8 / 13 (62 %) | 8 + 0 | C | C (caveat only) |
| sinatra | 267 / 289 (92 %) | 267 + 0 | F·2 | F·2 (caveat only) |
| rich | 187 / 464 (40 %) | 10 + 177 | F·26 | F·26 (caveat only) |
| realworld-control | 6 / 55 (11 %) | 5 + 1 | F·4 | F·4 |
| httpx | 11 / 81 (14 %) | 11 + 0 | F·13 | F·13 |
| deutsia-radio | 18 / 278 (6 %) | 17 + 1 | F·57 | F·57 |
| screenshot-to-code | 12 / 252 (5 %) | 11 + 1 | F·31 | F·31 |
| chatbot-ui | 8 / 302 (3 %) | 6 + 2 | (unknown) | F·28 |
| aurora-synth | 14 / 170 (8 %) | 14 + 0 | (unknown) | F·20 |

Rule implemented (documented in `scripts/lib/health-grade.mjs`): when ≥20 % of a
repo's non-binary files were examined by no regex rule, the letter is **capped at
C**; the asterisk marks a letter the cap actually changed (`F*` would claim an F
was softened when it is already worse than the cap — those repos carry the
caveat without the asterisk). A catch-all glob (`**/*`, used by
`code-boilerplate-repetition-7` and `github-log-pattern-1`) is NOT counted as
coverage: a boilerplate/secret scan touching every file is not language coverage,
and counting it would have kept cyberpunk-hud's A.

## Result 3 — no regression in finding counts (11 repos)

| repo | before s | after s | findings before | findings after | delta |
|---|---|---|---|---|---|
| chatbot-ui | 180.20 (timeout) | 1.69 | — | 533 (det 190 / aus 343) | new |
| aurora-synth | 180.16 (timeout) | 2.26 | — | 512 (det 208 / aus 304) | new |
| cyberpunk-hud | 0.36 | 0.41 | 16 | 16 | 0 |
| deutsia-radio | 54.00 | 1.75 | 410 | 410 | 0 |
| fatfree | 0.37 | 0.49 | 21 | 21 | 0 |
| httpx | 0.69 | 0.75 | 481 | 481 | 0 |
| mini-redis | 0.33 | 0.47 | 33 | 33 | 0 |
| realworld-control | 1.20 | 0.69 | 365 | 361 | **−4** |
| rich | 2.01 | 2.25 | 631 | 631 | 0 |
| screenshot-to-code | 1.63 | 1.73 | 641 | 633 | **−8** |
| sinatra | 0.58 | 0.69 | 188 | 188 | 0 |

Detector counts are identical everywhere (no detector finding was lost). The two
deltas are the whole-file content guard doing its job, and each is named in its
own report (`coverage.skipped.read_guards`):

- `realworld-control` −4: `package-lock.json` (377 230 chars > MAX_CONTENT
  262 144) is no longer regex-scanned. The four lost hits are `ausencia` checks
  that had fired against a machine-generated lockfile
  (`flows-n8n-no-error-handling-1`, `flows-n8n-no-retry-5`,
  `flows-n8n-no-timeout-4`, `performance-no-tech-debt-alloc-9` — one file each).
- `screenshot-to-code` −8: `frontend/pnpm-lock.yaml` (301 384 chars > 262 144),
  same reason, eight `ausencia` rules, one file each.

## Gates (raw)

BEFORE = the first capture, taken on the unmodified tree:

```
=== validate-detectors exit=0 seconds=0.15
=== test-fixtures exit=0 seconds=2.39
=== validate-skills exit=0 seconds=0.09
=== registry-diff exit=0 seconds=0.77
=== validate-assessment exit=0 seconds=0.09        (examples/realworld-assessment/assessment.json)
=== validate-assessment-en exit=1 seconds=0.14     ← see note: wrong path in the first capture
```

The `-en` capture above exited 1 only because the first attempt pointed at
`examples/realworld-assessment/assessment-en.json`, which does not exist; the
file lives at `examples/realworld-assessment-en/assessment.json`. Re-run at
baseline against the real path: `VALID: 6 findings, 0 warning(s)`, exit 0.

AFTER (also saved in `gates-after/*.txt`):

```
=== validate-detectors exit=0
VALID: 368 entries — 135 detector, 51 ausencia, 116 juicio, 66 fuera (registry total 368, 0 missing, 0 deleted)
NOTE: specs are structural declarations. detector/ausencia entries stay PROVISIONAL until their positive/negative fixtures pass (PLAN.md Fase 1).

=== test-fixtures exit=0
PASS code-exact-duplication-massive-1 (positive: 1 finding(s), negative: 0)
… (20 line-fixture PASS lines) …
PASS torture-case (all-module run over adversarial tree: 1661ms, 136 rules, 1 long-line file(s) skipped by guard)
PASS torture-whole-file (comma rules: 17ms, many-params=2, too-many-params=1; full rule set: 681ms, 136 rules, over-content guarded: 2; 1ms budget → 2 named failure(s), cap hits: 0)

22 passed, 0 failed, 0 skipped (tool not implemented)

=== validate-skills exit=0
validate-skills: OK — 8 skill(s) valid
validate-skills: parser self-check OK — skill-metadata parses CRLF and LF inputs identically (2026-10-07 regression locked)

=== registry-diff exit=0
PASS: ruleset unchanged since HEAD — nothing to declare.

=== validate-assessment exit=0        VALID: 7 findings, 0 warning(s)
=== validate-assessment-en exit=0     VALID: 6 findings, 0 warning(s)
```

## Pattern equivalence (the part that is easy to get wrong)

The first unrolling attempt removed the exponential backtracking but narrowed
the rules from "≥ N params" to "exactly N params" (the old segment could swallow
commas, so the pattern really meant "at least N-1 commas"). `pattern-semantics.cjs`
compares HEAD against the working tree over 40 declarations (1–16 parameters,
JS and Python, paren-group arguments, nested calls, arrow functions, multiline
lists, array defaults):

```
code-many-params-10: IDENTICAL on 40 samples
code-too-many-params-9: IDENTICAL on 40 samples
code-long-parameter-list-8: IDENTICAL on 40 samples
TOTAL SEMANTIC DIFFS: 0
```

## Claims in the mission brief that did not reproduce

1. **"a long minified line of comma-separated parenthesised groups"** — the two
   files that actually hung are NOT minified. `aurora-synth/src/demo/songlib.js`
   is 697 lines with a longest line of **178** chars; `chatbot-ui/components/
   utility/global-state.tsx` is 332 lines, longest line **80** chars. The trigger
   is comma/paren density anywhere in the file, because the regex runs over whole
   CONTENT across newlines. The fixture now covers both shapes; the minified one
   is additionally refused by the per-line guard.
2. **"every file before it took ≤169 ms"** — plausible per the sweep's diag, but
   I could not re-verify it: the pre-fix run has no per-rule/per-file timing
   output (that is exactly the gap `timings`/`ruleFailures` now close). Not
   contradicted, just unverifiable from the artifacts.
3. **"no rule path-glob covers GDScript"** — not literally true: two catch-all
   rules (`**/*`) do open `.gd` files. They scan for copyright blocks and logging
   framework names, which is not GDScript coverage in any meaningful sense, so the
   coverage metric excludes catch-all globs and reports them separately. The
   defect (A rendered over 12 unexamined `.gd` files) is real either way.

## Deliberately NOT fixed

- **Hard preemptive timeout for a hang inside a single `exec()`.** Node cannot
  interrupt a synchronous regex, and the honest in-process answer is a step
  budget checked between files/matches — which cannot fire mid-`exec`. What is in
  place instead: the exponential pattern is gone (proved by fixtures), the
  whole-file input is capped at 256 KB (named skip), the per-rule budget turns
  any yielding rule into a named failure, and `report.mjs` writes artifacts even
  if the engine throws. A true hard wall needs the engine in a worker thread or
  child process; `node:worker_threads` does work under this sandbox, but it is an
  architecture change I judged too large for this brief.
- **The CAP is still not enforced inside a single file.** A file with 39 matches
  yields 39 findings for that rule (this is HEAD's behaviour, preserved on purpose
  so no count regresses). It is now *reported* as truncation instead of being
  invisible.
- **`registry-diff` does not fingerprint `skills/detectors.json`**, so a spec
  change needs no changelog entry. Not my mission; noted because this change
  edited three specs.
- **Severity semantics, the ausencia/detector split, and the project's other
  grades (Path A/B/C)** are untouched: `gradeFromFindings` is unchanged, and only
  the deterministic report path uses `gradeWithCoverage`.
- **`.gitignore`, `scripts/lib/skill-metadata.mjs`, `.gitattributes`** — the
  pre-existing dirty entries — were not modified, and nothing was committed.
