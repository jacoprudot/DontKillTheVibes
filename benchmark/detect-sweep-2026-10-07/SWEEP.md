# Detect sweep — 2026-10-07 (Fase 7: does the detector actually work on real repos?)

Deterministic detector + report assembler run, unmodified, over every target pinned in
`benchmark/targets.json`. **Nothing was fixed, tuned or re-run for a better number.**

- 21 targets, 21 clones present under `benchmark/work/` (`missing: 0`).
- 19 runs completed (`exit 0`), **2 timed out** at the 180 s hard cap.
- 5 824 findings assembled: **2 091 detector** + 3 733 ausencia (checklist gaps).
- **0 occurrences** of the fallback remediation string anywhere → the CRLF regression is gone.

Raw artifacts per repo live in `runs/<name>/` (`run.cmd`, `stdout.txt`, `stderr.txt`,
`exit.txt`, `findings.json`, `report.md`, `prompts.md`). Timeout diagnostics live in `diag/`.

## Raw command line

Each repo was invoked through a generated one-repo `.cmd` wrapper (used instead of
`pnpm` so no wrapper noise is in the numbers), with a hard 180 000 ms wall-clock cap
enforced by `Start-Process … -PassThru` + `WaitForExit(180000)` + `taskkill /PID <pid> /T /F`
on expiry:

```bat
@echo off
"C:\Program Files\nodejs\node.exe" "scripts\detect\report.mjs" --target "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\work\<name>" --out "C:\Users\jfpru\Desktop\proyectos\DontKillTheVibes\benchmark\detect-sweep-2026-10-07\runs\<name>" > "…\stdout.txt" 2> "…\stderr.txt"
echo %ERRORLEVEL% > "…\exit.txt"
```

i.e. exactly the prescribed `node scripts/detect/report.mjs --target benchmark/work/<name> --out <out>/<name>`,
with `--out` redirected so no clone was written to.

`git clone` was never attempted (sandbox blocks it); the 21 pre-existing clones were reused.
Environment: Node v24.14.1, Windows PowerShell 5.1.

## Parser version in play (important)

```
git rev-parse --short HEAD  ->  0ee6743
```

**HEAD does not contain the CRLF fix.** `git show HEAD:scripts/lib/skill-metadata.mjs`
still has `content.split('\n')`; the fix (`split(/\r?\n/)`) exists only as an
**uncommitted working-tree modification** in this checkout:

| | HEAD (`0ee6743`) | working tree (what this sweep ran) |
|---|---|---|
| `scripts/lib/skill-metadata.mjs` blob | `7c07ab6a3786` | sha256 `5384AB37F219A2E6316E4CEBB4DA43349F29F557BE0222F98F5EA4A4B4CE6F9E` |
| split | `content.split('\n')` | `content.split(/\r?\n/)` |

So: the 0-fallback result below is real **for this working tree only**. A fresh clone of
`0ee6743` on a `core.autocrlf=true` Windows checkout would still reproduce the bug.
`scripts/lib/canonical-registry.mjs` was already CRLF-safe, which is why the two parsers
of the same format disagreed.

## Per-repo table

`seconds` = wall clock of the whole `report.mjs` process. `critical/high` and `crit+high`
count **detector** findings only (ausencia carries no severity by design).

| repo | seconds | total | detector | ausencia | critical | high | crit+high | grade | degraded | fallback | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| realworld-control | 1.98 | 365 | 30 | 335 | 4 | 6 | 10 | F·4 | 50 | 0 | ok |
| roomgpt | 1.24 | 191 | 20 | 171 | 0 | 3 | 3 | D | 50 | 0 | ok |
| screenshot-to-code | 3.09 | 641 | 229 | 412 | 31 | 47 | 78 | F·31 | 50 | 0 | ok |
| llamacoder | 9.67 | 569 | 219 | 350 | 24 | 42 | 66 | F·24 | 50 | 0 | ok |
| chatbot-ui | **180.05** | – | – | – | – | – | – | – | – | – | **TIMEOUT** |
| httpx | 1.07 | 481 | 186 | 295 | 13 | 40 | 53 | F·13 | 50 | 0 | ok |
| rich | 4.04 | 631 | 229 | 402 | 26 | 62 | 88 | F·26 | 50 | 0 | ok |
| mini-redis | 0.37 | 33 | 2 | 31 | 0 | 0 | 0 | B | 50 | 0 | ok |
| vegeta | 0.59 | 277 | 135 | 142 | 11 | 28 | 39 | F·11 | 50 | 0 | ok |
| fatfree | 0.43 | 21 | 2 | 19 | 0 | 0 | 0 | C | 50 | 0 | ok |
| sinatra | 0.94 | 188 | 12 | 176 | 2 | 0 | 2 | F·2 | 50 | 0 | ok |
| jarvis-voice | 0.43 | 80 | 21 | 59 | 4 | 5 | 9 | F·4 | 50 | 0 | ok |
| eurekagent | 1.76 | 462 | 240 | 222 | 52 | 65 | 117 | F·52 | 50 | 0 | ok |
| deutsia-radio | 109.47 | 410 | 244 | 166 | 57 | 41 | 98 | F·57 | 50 | 0 | ok |
| holo-gestures | 0.43 | 49 | 17 | 32 | 7 | 5 | 12 | F·7 | 50 | 0 | ok |
| ai-job-agent | 0.92 | 316 | 110 | 206 | 10 | 17 | 27 | F·10 | 50 | 0 | ok |
| agentgraphed | 31.82 | 544 | 199 | 345 | 22 | 41 | 63 | F·22 | 50 | 0 | ok |
| crypto-claude-desk | 30.06 | 501 | 175 | 326 | 22 | 37 | 59 | F·22 | 50 | 0 | ok |
| cyberpunk-hud | 0.41 | 16 | 0 | 16 | 0 | 0 | 0 | A | 50 | 0 | ok |
| obs-airplay | 0.41 | 49 | 21 | 28 | 3 | 6 | 9 | F·3 | 50 | 0 | ok |
| aurora-synth | **180.07** | – | – | – | – | – | – | – | – | – | **TIMEOUT** |

## Aggregate

| metric | value |
|---|---|
| clones present / targets | 21 / 21 |
| completed `exit 0` | 19 |
| timed out (killed at 180 s) | 2 — `chatbot-ui`, `aurora-synth` |
| errored / missing | 0 / 0 |
| total findings | 5 824 |
| … detector | 2 091 |
| … ausencia | 3 733 |
| detector critical | 288 |
| detector high | 445 |
| detector crit+high | 733 |
| detector medium / low / info | 760 / 590 / 8 |
| wall-clock sum (21 attempts) | 559.25 s |
| mean over 21 attempts | 26.63 s |
| mean over 19 completed | 10.48 s |
| max over 19 completed | 109.47 s (`deutsia-radio`) |
| repos with ≥1 detector crit/high | **16** of 19 completed (84.2 %); 16 of 21 attempted (76.2 %) |
| repos with zero detector crit/high | 3 — `mini-redis`, `fatfree`, `cyberpunk-hud` |
| repos with zero detector findings at all | 1 — `cyberpunk-hud` |
| repos with ≥1 crit/high detector finding **with a real remediation** | **16** (all 16 that have any crit/high) |
| degraded/unimplemented rules named in coverage block | 50 in every one of the 19 reports (identical set: `semgrep`, `osv-scanner`, `license-scan`, `git-log`, `github-api` rules) |
| fallback-remediation occurrences in `report.md` | **0** (also 0 in `prompts.md` and `findings.json`) |
| report.md bytes / prompts.md bytes, summed | 738 230 / 591 605 |

## The number that matters

**16 of 21 pinned targets (76 %) produced at least one `critical` or `high` DETECTOR
finding carrying real remediation text from the rule registry** — not the fallback string,
`critical`/`high` only, ausencia excluded. Over the 19 repos that actually finished, that
is 16/19 = 84 %. The 2 timeouts are **unknown**, not zero.

## Regression check — fallback remediation

The string `no remediation text in the rule` occurs **0 times**, in every repo, in
`report.md`, `prompts.md` and `findings.json` (verified three ways:
`report.md` text scan, `prompts.md` text scan, and a scan of the `remediation` field of
every finding in `findings.json`). The CRLF parser fix holds for this working tree.
Caveat above: the fix is **not committed**, so HEAD alone would still fail this check.

## Surprises (nothing summarised away)

1. **2/21 repos produce NO output at all, and it is one single rule.**
   Per-rule bisection (`diag/<name>/diag.log`, one rule per `runDetect` call with
   progressive output) shows both hangs stall on **`code-many-params-10`** with no
   subsequent `DONE`. It is a `node-matcher` / `file-content-regex` spec whose pattern is
   six nested `(?:\([^()]*\)[^()]*)*` groups separated by `,` — catastrophic backtracking.
   `report.mjs` writes `findings.json` / `report.md` / `prompts.md` only at the very end,
   so one pathological rule means **zero artifacts for the whole repo** (run dirs contain
   only `run.cmd` and empty stdout/stderr). The failure is total, not partial.
2. **The existing guard does not close it.** `matchers.mjs:33` skips files containing a
   line longer than `MAX_LINE = 2000`, but the regex is executed over the **whole file
   content**, not line by line, so a short-line file still gets the full backtracking
   search. Per-file bisection (`diag/file/…`) names the trigger:
   - `aurora-synth` → `src/demo/songlib.js` (34 856 bytes) — exceeds 75 s on that one file
     (13 files done before it, all ≤ 94 ms).
   - `chatbot-ui` → `components/utility/global-state.tsx` (10 276 bytes) — exceeds 75 s on
     that one file (9 files done before it, all ≤ 169 ms).
   It is not repo size: chatbot-ui is only 320 files / 1.9 MB.
3. **Counts are floors, not totals.** `matchers.mjs:19` caps each rule at
   `CAP = 20` findings per run. Several repos sit at exactly 20 for one rule
   (e.g. `mini-redis` = 2 × `cost-gha-always-on-8`), so the real violation counts are
   higher and the detector deliberately truncates.
4. **Two targets are effectively unscanned, and their grades are flattering.**
   - `cyberpunk-hud`: 12 `.gd` (GDScript) files, **0 detector findings → grade A**. No
     path glob in the ruleset covers GDScript; A means "no covered file fired", not "healthy".
   - `mini-redis`: Rust, 34 files, 2 detector findings (both `cost-gha-always-on-8`, a
     GitHub-Actions rule) → grade B, again an uncovered-language artifact.
     `fatfree`: the pinned commit's framework lives in the `lib` submodule
     (`bcosca/fatfree-core`), which is **not checked out** — the working tree holds
     **1 `.php` file**; 14 files scanned, 2 detector findings → grade C.
   Any dashboard reading these as "clean repos" is reading language coverage, not health.
5. **Severity is not a scale of "how broken".** 288 criticals across 19 repos, 15 of them
   graded `F·n`; the letter saturates at the first critical, so `F·2` (sinatra) and
   `F·57` (deutsia-radio) differ only by the presentation suffix.
6. **Wall clock is bimodal and unrelated to repo size.** `mini-redis` (34 files) 0.37 s vs
   `deutsia-radio` (311 files, 5.8 MB) 109.47 s and `chatbot-ui` (320 files, 1.9 MB)
   > 180 s. The slow-but-completing runs are dominated by the same comma-counting family
   of rules, not by I/O.
7. **Pre-existing dirty working tree (not touched by this sweep):** `.gitignore` and
   `scripts/lib/skill-metadata.mjs` were already modified and `.gitattributes` already
   untracked before the sweep started — the skill-metadata modification *is* the CRLF fix
   being validated here. This sweep added only `benchmark/detect-sweep-2026-10-07/`.
