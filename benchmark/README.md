# DontKillTheVibes benchmark

A reproducible harness that measures the DontKillTheVibes toolkit against a **naive
LLM pass** on real public repositories.

The question the benchmark answers is deliberately narrow:

> Given **byte-identical input** about the same repository, does the toolkit produce
> more *real*, *grounded* and *actionable* findings than a bare "review this repo"
> prompt - and does it miss fewer security problems?

Nothing in this document is a result. Results live in `benchmark/results/<name>/` and
the table at the bottom of this file, and both stay empty until a real run happens.

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

## 5. How to run

Nothing below has been run with a real model yet. Set the key in the environment only -
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

# fill the four target slots in repos.json first (urls must be real)
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
  meta.json            target, url, resolved commit SHA, model, base URL, ISO timestamp,
                       digest stats, per-arm success, "mock": false
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

## 6. Results

TODO: fill after the run

| Target | Commit | Model | Arm | Claims | Real | Precision | Grounded (judge) | Grounded (mech) | Mean actionability | Security-relevant | Security false negatives |
|---|---|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |

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
