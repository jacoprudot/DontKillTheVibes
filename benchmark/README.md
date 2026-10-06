# DontKillTheVibes benchmark

A reproducible harness that measures the DontKillTheVibes toolkit against a **naive
LLM pass** on real public repositories.

The question the benchmark answers is deliberately narrow:

> Given **byte-identical input** about the same repository, does the toolkit produce
> more *real*, *grounded* and *actionable* findings than a bare "review this repo"
> prompt - and does it miss fewer security problems?

The runs have happened. The versioned evidence is in `benchmark/results/` (the shipped
5-target run, arms A+B+C), in `benchmark/results-lote1-*` and `benchmark/results-lote2-*`
(those lots plus their cross-judge reports), and in the two earlier judge pilots
(`benchmark/results-local-qwen/`, `benchmark/results-calibrate-27b/`); §6 is the index of
what was measured and where each number comes from. The only lot still pending is
**lote 3**, which is pre-registered in `benchmark/results-lote3/PREDICTIONS.md` and not
yet run.

---

## 1. The two arms

| | Arm A - naive | Arm B - toolkit |
|---|---|---|
| What it is | one bare prompt: *"Review this repository and list the problems you find. Be specific."* | `scripts/dktv-assess.mjs`, the real CLI runner |
| Input | the digest (see §2) | the digest (see §2) |
| Prompt/tooling | no skills, no synthesis agent, no finding schema, no validator | synthesis agent + `skills/*.skill.md` decision trees + finding schema + validator retry loop |
| Output | `results/<name>/naive.md` (free-form Markdown) | `results/<name>/toolkit/assessment.json` (strict schema) |
| Model | the configured model | **the same** configured model |
| Endpoint | the configured `LLM_BASE_URL` | **the same** endpoint |

Arm A intentionally has *no* structural advantage: it is not asked for JSON, not given a
schema, not validated, and never sees the toolkit's prompts or skills. That is the point
of the comparison.

## 2. Both arms receive the same digest - this is the whole point

Before either arm runs, the runner obtains the repository digest once:

```
node scripts/dktv-assess.mjs --target <repo> --emit-digest benchmark/results/<name>/digest.json
```

That file (keys: `tree[]`, `included[{rel,content}]`, `skippedContent[]`,
`skippedSensitive[]`, `chars`) is the **exact** input handed to both arms. The digest is
committed as evidence, so anyone can re-read the input bytes both arms received and
confirm they are identical. Any measured difference therefore comes from the prompt and
tooling, not from one arm getting better or more context.

Files matching the toolkit's sensitive-name rules (`.env*`, keys, credentials) are
excluded from the digest *before* transmission and are listed in `skippedSensitive`.
The count is identical for both arms, and both arms are told those files were withheld.

## 3. Judging protocol

Scoring is **blind**:

1. `benchmark/judge.mjs` pools arm B's findings (from `toolkit/assessment.json`, one
   claim per finding: id + description + location) and arm A's claims (parsed out of
   `naive.md` as free-form Markdown - arm A is never forced through the toolkit schema).
2. The claims are shuffled and relabelled `C1..Cn`. The label → (arm, source id) mapping
   is written to `results/<name>/mapping.json` and is **never** included in the judge prompt.
3. Identifiers are stripped from what the judge sees: the toolkit's rule ids are slugs
   that reveal the module and the rule that fired (`security-jwt-weak-3`), so titles are
   anonymised and known identifiers are redacted. `judge.mjs` aborts if the assembled
   prompt still contains the word `toolkit`, an arm label (`arm A`, `naive arm`, …), or
   any source id. `--dump-prompt <file>` writes the exact prompt to disk so a skeptical
   reader can confirm the blindness by eye - the dump is itself evidence.
4. A **judge model** scores each claim as strict JSON:
   `{"real": bool, "grounded": bool, "actionable": 1-5, "reason": str}`.
   The judge model is recorded in `scores.json`. Use the same judge model for every
   target or the numbers are not comparable.
5. A **human tie-break** decides every case where the judge and the mechanical check
   disagree, and any case the judge answers with low confidence. Human verdicts are
   recorded next to the machine scores, never overwriting them.

Why two reality signals: the judge is an LLM and can be talked into "grounded" by a
confident-sounding sentence. So grounding is *also* checked mechanically (§4) and both
verdicts are kept in `scores.json`.

## 4. Metrics

| Metric | Definition | Where it lives |
|---|---|---|
| Findings / claims | how many distinct problems each arm reported | `scores.json` → `summary_by_arm.<arm>.claims` |
| Precision (is the claim real?) | judge's `real: true` count ÷ judged claims | `summary_by_arm.<arm>.precision` |
| Grounding - judge | judge's `grounded: true` count | `summary_by_arm.<arm>.judgeGrounded` |
| Grounding - mechanical | the cited file **exists** in the target repo **and** the cited line is within the file's line count | `claims[].grounded_mechanical`, `claims[].mechanical` |
| Actionability | judge's 1–5 per claim; reported as the mean | `summary_by_arm.<arm>.meanActionability` |
| Weak citations | cited line carries no evidentiary weight (empty, comment, import/export-from, only braces) — measures findings that cite the import block instead of the handler. Metric only, never affects verdicts. **Definition changed 2026-10-06**: digest content is read WITHOUT the runner's line-number gutter (`stripGutter` in `judge.mjs`), so the metric means the same on pre-gutter and gutter-era digests — but any comparison written before that change is invalid in both directions. | `summary_by_arm.<arm>.weakCitations` |
| **Security false negatives** | security-relevant claims (matched against a security keyword list) that the judge marked `real: false` - i.e. problems an arm raised and the scoring called not real | `summary_by_arm.<arm>.securityFn` |

The security false-negative count is the headline metric. A naive pass that stays silent
about a leaked-secret pattern, an auth bypass or an injection path is worse than one that
says nothing at all, and silence cannot show up in precision. The keyword list used for
the security-relevant flag is in `judge.mjs` (`SECURITY_PATTERNS`) and is intentionally
broad; the `security_relevant` flag per claim is in `scores.json` so it can be audited
or re-derived with a stricter list.

**Mechanical grounding is existence-only.** It proves a citation resolves to a real
line; it does *not* prove the line says what the claim says. Semantic grounding
("does that line actually support this?") is the judge's job, and human review is what
settles it. This limit is stated again in §7.

## 4b. Review checklist (external and self review)

Every validation report must pass these checks BEFORE it is handed to a reviewer.
Each one has caught a real error in an actual round — they are cheap, run them
in order:

1. **Parts must sum to the declared total.** Any claim broken into parts
   (real / false / unverifiable; per-repo rows; per-module counts) must add up
   to the total the same document declares. Three catches in three rounds: a
   column split that didn't sum (rev. 1), a "100%" that contradicted its own
   distribution (rev. 4), a part count that disagreed with its own total
   (fix review). This is the cheapest check in the methodology and the most
   reliable — it is what separates a credible report from one with pretty
   numbers.
2. **The denominator is declared before the result.** "Precision" is quoted
   with its denominator (decidibles vs all claims), because the two tell
   opposite stories when decidable rates differ between arms.
3. **Agreement is corrected for chance.** Raw agreement between two judges is
   reported WITH Cohen's kappa; raw % alone is base-rate inflation.
4. **Every causal claim names the test that would kill it.** A hypothesis that
   no measurement can falsify is narration, not analysis.
5. **Metric definition changes are recorded with a before/after boundary.**
   Comparisons across the boundary are invalid unless a shim (like
   `stripGutter`) makes the metric mean the same thing on both sides.

## 5. How to run

These are the commands the committed runs used. Set the key in the environment only -
the harness never accepts it as a command-line argument, never prints it, and never
writes it to disk.

**Verify the harness offline first (no key, no network, no clone):**

```powershell
node benchmark/run.mjs --help
node benchmark/judge.mjs --help

# full offline self-test - output is labelled MOCK and is NOT evidence
node benchmark/run.mjs --mock
node benchmark/judge.mjs benchmark/results/realworld-control --mock
```

**Real run (one target, then the rest):**

```powershell
$env:LLM_MODEL   = "<model-id>"
$env:LLM_API_KEY = "<key>"          # do not commit this, do not put it in shell history
# optional: $env:LLM_BASE_URL = "https://integrate.api.nvidia.com/v1"

# fill the four target slots in repos.local.json first (urls must be real;
# the tracked repos.json is the label list — its label -> repo mapping is
# published in targets.json, see "Target anonymity")
node benchmark/run.mjs --only realworld-control     # control first
node benchmark/run.mjs                              # everything else

# score it, blind
$env:LLM_JUDGE_MODEL = "<judge-model-id>"
node benchmark/judge.mjs benchmark/results/realworld-control --dump-prompt benchmark/results/realworld-control/judge-prompt.txt
node benchmark/judge.mjs benchmark/results/target-1
```

Useful flags: `--force` re-runs an arm whose output already exists (by default existing
output is reused), `--only <name>` runs one target, `--model`/`--base-url` override env,
`--fixture <dir>` changes the target used by `--mock`.

**What a complete target looks like:**

```
benchmark/results/<name>/
  meta.json            target, resolved commit SHA, model, base URL, ISO timestamp,
                       digest stats, per-arm success, "mock": false. url/target_dir
                       are present during the run and REMOVED for anonymized
                       targets by anonymize-results.mjs
  digest.json          the exact input both arms received
  naive.md             arm A raw response
  toolkit/
    assessment.json    arm B, validated by scripts/validate-assessment.mjs
  mapping.json         blind label -> (arm, source id) mapping
  scores.json          judge verdicts + mechanical grounding, per claim and summarised
  judge-prompt.txt     (optional) the exact blind prompt, for audit
```

`benchmark/work/` holds the shallow clones and is gitignored. `benchmark/results/` is
**not** gitignored: it is the evidence and must be committed. `meta.json` records the
commit resolved by `git rev-parse HEAD`, so a run is reproducible without anyone
hand-pinning a SHA in `repos.json`.

## 5b. Target anonymity

The four vibe-coding targets are published under neutral labels, and the label → repo
mapping is now **published too** (`benchmark/targets.json`, `label_map`):

| Label | Real repo |
|---|---|
| target-1 | `chatbot-ui` — https://github.com/mckaywrigley/chatbot-ui |
| target-2 | `roomgpt` — https://github.com/Nutlope/roomGPT |
| target-3 | `screenshot-to-code` — https://github.com/abi/screenshot-to-code |
| target-4 | `llamacoder` — https://github.com/Nutlope/llamacoder |

Labels are mapped to repositories field-by-field from `LABEL_MAP` in the tracked
`benchmark/anonymize-results.mjs:52-57`; the name → url pairs are the `name` fields in
`benchmark/targets.json`. Nothing in this table was typed from memory.

- **Why the labels existed.** The targets are third-party repositories, and the
  original intent was to avoid putting someone else's repo on a public scoreboard.
- **Why they never actually held.** The mapping shipped from the start in the tracked
  `benchmark/anonymize-results.mjs` (`LABEL_MAP`), and every `results/target-N/meta.json`
  keeps its `commit`, which joins to the repo in `benchmark/targets.json`. The labels
  never protected against a determined reader — and they cost the benchmark its
  credibility: one reviewer read them as cherry-picking and another as
  irreproducibility, the latter calling the benchmark unreproducible from a clone.
- **What changed (2026-10-06).** The mapping is published in `benchmark/targets.json`
  because reproducibility and verifiability matter more than the anonymity that never
  held. The labels stay as they are: they are the committed directory names under
  `benchmark/results/`, and renaming them would rewrite evidence and break every link
  to it. They are now aliases, not a shield.
- `benchmark/repos.json` (tracked) still carries the label list with empty `url`s, and
  `benchmark/repos.local.json` (gitignored) still holds the author-side run list with
  notes and provenance. Those are now a convenience, not a secrecy boundary: `run.mjs`
  reads `repos.local.json` when it exists and falls back to the tracked file, so a
  fresh clone still runs the label list.
- `benchmark/anonymize-results.mjs` is unchanged and still works: it renames
  `results/<real>` to `results/<label>` and scrubs identifying strings from the
  artifacts. It is what produced the labels in the first place, and its `LABEL_MAP` is
  the source of the table above.
- `realworld-control` was never anonymized: it is already public via
  `examples/realworld-assessment`, so naming it leaks nothing that is not already in
  this repo, and the control must be independently reproducible.
- **Declared limitation:** code snippets inside the artifacts (`digest.json`,
  `naive.md`, assessments) are NOT renamed — renaming code would break the
  judge's evidence chain. The scrub only replaces project/repo/author names
  and never repo-internal file paths (`app/api/...`). This no longer needs to
  carry any anonymity weight, since the mapping is public; it is kept only so a
  fresh clone still reads the evidence under the same labels.

## 6. Results

Every number in this section is read off a committed artifact; none is recomputed by
hand. `judge.mjs` writes its own tallies into `scores.json` (`summary_by_arm`, `totals`),
and the later lots are quoted from their committed reports, named inline.

### 6a. Shipped run — `benchmark/results/` (5 targets, arms A + B + C)

Model under test `nvidia/nemotron-3-super-120b-a12b`, judge
`nvidia/nemotron-3-ultra-550b-a55b`, 3 judge runs per target (`judge_runs: 3` in every
`scores.json`). Rows are the `summary_by_arm` values; `precision` is `—` where the judge
left no decidable claim. Commits are abbreviated to 12 hex chars — the full SHA is in
each target's `meta.json` (written by `run.mjs` from `git rev-parse HEAD`).

| Target | Commit | Arm | Claims | Real | False | Unverif. | Precision | Grounded (judge) | Grounded (mech) | Mean actionability | Security-relevant | Security false negatives |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| realworld-control | 30b68e1e8814 | A naive | 8 | 0 | 0 | 8 | — | 0 | 0 | 2.88 | 1 | 0 |
| realworld-control | 30b68e1e8814 | B toolkit | 9 | 7 | 0 | 2 | 1.0 | 7 | 9 | 4.22 | 2 | 0 |
| realworld-control | 30b68e1e8814 | C orchestrated | 9 | 5 | 0 | 4 | 1.0 | 6 | 6 | 3.78 | 5 | 0 |
| target-1 | 81328b61d2a4 | A naive | 19 | 0 | 0 | 19 | — | 0 | 0 | 2.95 | 3 | 0 |
| target-1 | 81328b61d2a4 | C orchestrated | 10 | 5 | 3 | 2 | 0.625 | 8 | 10 | 3.5 | 4 | 2 |
| target-2 | 611398c78da6 | A naive | 16 | 0 | 0 | 16 | — | 1 | 0 | 2.94 | 2 | 0 |
| target-2 | 611398c78da6 | B toolkit | 7 | 1 | 4 | 2 | 0.2 | 1 | 7 | 3.29 | 1 | 1 |
| target-2 | 611398c78da6 | C orchestrated | 14 | 9 | 1 | 4 | 0.9 | 9 | 11 | 3.36 | 2 | 0 |
| target-3 | d026163f586d | A naive | 12 | 0 | 0 | 12 | — | 7 | 0 | 2.75 | 0 | 0 |
| target-3 | d026163f586d | B toolkit | 5 | 0 | 0 | 5 | — | 3 | 4 | 1.8 | 0 | 0 |
| target-3 | d026163f586d | C orchestrated | 5 | 1 | 0 | 4 | 1.0 | 5 | 5 | 2.6 | 3 | 0 |
| target-4 | 75a3a78e1fa0 | A naive | 9 | 0 | 0 | 9 | — | 0 | 0 | 1.89 | 4 | 0 |
| target-4 | 75a3a78e1fa0 | B toolkit | 9 | 1 | 2 | 6 | 0.333 | 2 | 8 | 2.67 | 2 | 1 |
| target-4 | 75a3a78e1fa0 | C orchestrated | 6 | 1 | 0 | 5 | 1.0 | 1 | 6 | 3.17 | 1 | 0 |

Target-1 has no B row because that arm was not run there: its `scores.json` records
`"toolkit": 0` claims, so any B-vs-C statement over five targets is really a statement
over four.

Pooled over the five targets — counts, not rates, straight from those `scores.json`
files: arm A **64 claims, 0 real, 64 unverifiable, 0 mechanically grounded**; arm B
**30 claims, 9 real, 6 false, 15 unverifiable**; arm C **44 claims, 21 real, 4 false,
19 unverifiable**.

> **Known mismatch, resolved 2026-10-06.** The root README used to quote "9/14" (arm B)
> and "22/25" (arm C) for this run; the same pair is repeated in
> `results-lote1-crossjudge/VALIDATION-REPORT.md` §"piloto previo", which is committed
> history and is left as it was. The committed `scores.json` files sum to **9/15** and
> **21/25** (decidable = real + false; the 0.84 quoted in the old "range 0.84–1.0" is
> exactly 21/25, a pooled figure, not a range floor — arm C's true per-repo range is
> 0.625–1.0). The root README now carries the artifact numbers and a visible correction
> line; this file quotes the artifacts, not the summary.

### 6b. Lote 1 — 6 mature OSS repos, arms A + B

Evidence: `benchmark/results-lote1-deepseek/` (self-judge) and
`benchmark/results-lote1-crossjudge/` (cross-family judge). Model and self-judge
`deepseek-chat`; cross-judge `qwen3.5:9b` local. Quoted from
`results-lote1-crossjudge/VALIDATION-REPORT.md` (rev. 2, 2026-10-05): 44 findings,
**16 real / 18 false / 10 unverifiable**, mechanical grounding **44/44**, and 9 of the 44
claims cite a line that exists but does not support the claim. That report declares
precision **not publishable yet** (it needs a third-family judge plus a human sample), so
do not quote a lote-1 precision figure.

### 6c. Lote 2 — 10 vibe-coded repos, arms A + B + C

Evidence: `benchmark/results-lote2-deepseek/` and `benchmark/results-lote2-crossjudge/`.
Quoted from `results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` (2026-10-05):

| metric | Arm B | Arm C |
|---|---|---|
| findings | 143 | 632 (4.4x) |
| decidable | 43 (30%) | 79 (12.5%) |
| precision on decidable | 81% (35/43) | 82% (65/79) |
| precision over ALL claims | 24% (35/143) | 10% (65/632) |
| mechanical grounding | 62% | 59% |
| unverifiable | 100 (70%) | 553 (88%) |
| health F | 8/10 | 8/10 |

Other numbers from the same report: 100% of cited `location.file` values exist in the
target repo; 60% of cited line numbers are in range (88/143 arm B, 376/632 arm C);
inter-judge agreement 144/156 claims (92%) with Cohen's kappa **0.405** (B) and **0.424**
(C); and in arm C, 297 of 553 unverifiable claims (54%) had a citation that did resolve,
which is a support failure, not an anchoring one.

### 6d. Lote 3 — pre-registered, not yet run

`benchmark/results-lote3/PREDICTIONS.md` (committed 2026-10-06) fixes the expected
outcomes before the run and the interpretation of each one. There are no lote-3 result
artifacts in this tree yet. The two earlier judge pilots,
`benchmark/results-local-qwen/` and `benchmark/results-calibrate-27b/`, are summarised
only by their own `SUMMARY.md`.

## 7. Limitations

Stated plainly, because they bound every claim the benchmark can make:

- **Single model.** The whole run uses one model under test (and one judge model). A
  different model may behave differently; this benchmark cannot generalise to "LLMs".
  Self-judging (same model as both arms and judge) is a known weakness - prefer a
  different judge model, and say so if you did not.
- **Digest-based, not MCP-driven.** Both arms are assessed from a static digest produced
  by `--emit-digest`, not by driving the MCP servers. The toolkit's live-repository
  capabilities (git history, running servers, runtime data) are therefore *not* measured.
  Arm B under test is the single-pass CLI runner, which is the strongest fair comparison
  against a naive single pass - but it is not the toolkit's full capability.
- **No live-server performance data.** Findings about runtime performance, load or
  memory are static-review claims; nothing here executes the target repository.
- **Small n.** A control plus a handful of targets is an anecdote with error bars, not a
  study. Do not report percentages without the raw per-claim files next to them.
- **Grounding is existence-only.** See §4: a citation resolving to a real line is
  necessary, not sufficient. Semantic grounding still needs the judge plus a human.
- **Claim parsing for arm A is heuristic.** Free-form Markdown has no schema, so
  `judge.mjs` splits it into candidate claims by headings or by line/bullet boundaries.
  Splitting changes the denominator of every rate for arm A. The chosen split is
  auditable in `mapping.json` / `scores.json`; for a publishable claim, hand-check it.
- **Security keyword matching is a filter, not ground truth.** `SECURITY_PATTERNS` is a
  broad regex list; "security-relevant" is a triage label, and the real judgment is
  human review of those claims.
- **Digest truncation.** Content is capped per file (10 000 chars) and by a total budget
  (default 120 000 chars), and binary/lock files are excluded. Both arms get the same
  truncation, but a problem living only in truncated content is invisible to both.
- **Judge nondeterminism.** Judge temperature is 0 and the shuffle is seeded by target
  name, but model outputs can still vary between calls; re-running the judge may move
  numbers slightly. Keep `scores.json` and the raw judge response.
- **Sandbox note (operational).** In a confined sandbox, spawning a child process with
  piped stdio fails with `EPERM`. This harness works around that by redirecting child
  stdout/stderr to files. `scripts/dktv-assess.mjs` itself validates by spawning
  `validate-assessment.mjs` *with a pipe*, so a real arm-B run inherits that limitation
  in such a sandbox; `--mock` avoids it because the mock runner validates in-process.

## 8. Mock mode

`--mock` exists so the harness can be verified end to end with no API key, no network and
no clone. It uses `--fixture` (default `examples/realworld-assessment`) as the target and
stubs both arms with obviously-fake placeholder content.

Mock output is made impossible to confuse with real output:

- `meta.json` contains `"mock": true`, `commit: "MOCK-NO-COMMIT"`, `model: "MOCK (no model called)"`;
- `naive.md` opens with a `MOCK OUTPUT - NOT A REAL ASSESSMENT` banner;
- `toolkit/assessment.json` carries top-level `"mock": true` and a `mock_notice` string,
  and every finding id/description/remediation is prefixed `[MOCK]` / `MOCK placeholder`;
- `scores.json` records `mock: true` and every judge reason reads `MOCK judge opinion …`.

Mock runs still exercise the real digest writer, the real
`scripts/validate-assessment.mjs` contract, the blind shuffle/redaction, and the real
mechanical grounding check. They are a self-test, never evidence.
