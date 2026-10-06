# The model proposes. The toolkit disposes.

*A case study in verification — and a confession.*

On 2026-10-06 I sent one adversarial prompt to seven AI models and the same public GitHub URL. The URL was reachable in a browser and blocked to them. Three never read the repository.

Gemini wrote the review anyway: "vaporware", "does absolutely nothing", "careless execution", scored 1 / 1 / 1 on engineering, objective and usefulness. GLM and DeepSeek refused. GLM explained the fake it could have written instead:

> "I could write you a convincing adversarial review right now, with plausible file paths (`src/core/engine.ts`, line 247), an invented performance number, and five technical problems with the severity nicely ordered. It would be fluent, specific and 100% invented. You could not tell it apart from a real review without opening the repo yourself."
>
> "A blind adversarial review is not an adversarial review. It is fiction with an audit's formatting."

DeepSeek refused too, after documenting the searches that failed. Read this as evidence about verification, not a ranking of models. Translated from the Spanish in `docs/development/EXTERNAL_REVIEWS.md`.

## What it is, and what a buyer gets

**The LLM proposes findings; the toolkit disposes.**

DontKillTheVibes is MIT and LLM-agnostic. Every finding must cite a canonical rule id from a registry: 368 rules across 8 decision trees, each rule owning its severity and effort, under a fingerprint (`368-6e180554`) that changes the moment any rule's severity or effort changes. Severity and effort are stamped from that registry after the model has spoken, so the model never gets to set them. A strict validator rejects the document when the shape, the ids, the cross-references or the tallies are wrong. Two runners ship: a single-pass CLI and an 8-specialist orchestrator. Two MCP servers. What a buyer receives is a validated `assessment.json` plus a generated markdown report.

To show the shape rather than describe it, here is an assessment from `examples/realworld-assessment/`, run end-to-end on a real public TypeScript/Prisma API, `gothinkster/realworld`, on 2026-09-29 with toolkit v0.1.0-beta.

**The summary block.** Overall health **F**, graded by script rather than by judgement, from **7 findings**: 1 critical, 3 high, 2 medium, 1 info. Estimated effort: 3 XS, 3 S, 1 M. The findings are ordered by `score = severity weight × module weight × confidence`, not by the order the model felt like writing them.

**Every finding carries the same fields.** The critical one, verbatim:

> `security-jwt-weak-3` — critical, `src/app/routes/auth/auth.ts:16`, function `required/optional jwt middleware`. "JWT secret falls back to the hardcoded default `'superSecret'` when `JWT_SECRET` is not set (also at auth.ts:21 and token.utils.ts:4). Any deployment missing the env var accepts tokens signed with a publicly known secret — full auth bypass."

With it come the evidence snippet (`secret: process.env.JWT_SECRET || 'superSecret'`), a confidence of 0.95, XS effort, and the fix: remove the fallback, fail at boot, rotate the exposed tokens. The other six findings arrive in the same shape, each with rule id, severity, effort, `file:line`, evidence and fix — `database-sequential-pagination-1` at `article.service.ts:71`, `database-overfetch-relation-1` at `article.service.ts:98` (the same pattern at 8+ call sites), `code-missing-validation-4` at `article.service.ts:69`, `security-cors-wildcard-2` at `src/main.ts:13`, `code-any-type-6` at `article.service.ts:69`, `security-error-detail-1` at `src/main.ts:44`.

**The part you can act on Monday.** A 30/60/90 plan: five findings in the first month, the DTO work at 60 days, API-wide validation middleware at 90. It also records dependencies — `database-overfetch-relation-1` blocked by the pagination fix, `code-any-type-6` by the validation work — plus the priority scores. The JWT finding scores 142.5 against 58.5 for the runner-up, because a critical in the security module outranks a high in the database module. That ordering is arithmetic.

**And the finding that a plain model pass missed entirely.** The same repository had already been through a single-model audit, committed at `examples/gemini-baseline/`: **3 findings, zero security findings, no criticals.** It never saw `security-jwt-weak-3`, the most severe thing in the repo. It missed the unrestricted CORS and the error handler leaking raw exception text too. A general pass is good at the shape of a problem and blind to the perimeter its prompt did not suggest.

## The evidence

Five public repos: the RealWorld API control plus four vibe-coded targets under neutral labels. Three arms, a blind judge from another model family, three runs per target.

Arm A was one bare prompt — "review this repository and list the problems you find." It produced **64 claims and 0 mechanically decidable ones**. Arm B, the single-pass toolkit, produced **9 real findings out of 15 decidable**, 15 of its 30 claims unverifiable. Arm C, the orchestrator, produced **21 of 25 decidable**, 19 unverifiable.

Those last two are corrections. The README used to quote **22/25** for arm C and **9/14** for arm B, with a per-repo range of 0.84–1.0. The committed `scores.json` artifacts sum to **21/25** and **9/15**, and arm C's per-repo range is **0.625–1.0**. The 0.84 was never a range floor; it was exactly 21/25, a pooled figure read into the wrong column. Both documents now carry the correction and its date. Two honest notes: arm A was never asked for a `file:line`, so "0 decidable" measures my prompt, not model capability; and arm C does not receive the same input as A and B, so this is not a clean A/B.

## The five times my own repo lied about itself

This is the engineering work behind the claim that the output is trustworthy. Every defect below is real, and every one was found by a person or by arithmetic.

**1. Fourteen of my 368 canonical rules were un-citable.** The validator enforced `^[a-z-]+-\d+$`, and `flows-n8n-*` and `cost-overprovisioned-k8s-1` — killed by the `8` in `k8s` — could never pass. Canonical, documented, unreachable. A live run lost **144 legitimate findings** to it, and the logs made it look like the model's fault.

**2. Severity and effort were invented 14 times out of 21.** In one real run, **14 of 21 findings** carried a severity or an effort contradicting the rule they cited. Because the plan is ordered by severity × module weight × confidence, wrong numbers were reordering the roadmap. One case: an auth bypass reported as `security-secret-in-code-1` (high) instead of `security-jwt-weak-3` (critical). The finding was real; the number was a full tier wrong. The fix is to stop trusting the model for fields the registry already knows.

**3. My "weak citation" metric was wrong twice, in opposite directions.** First it was inflated: the judge counted `import` lines as weak evidence, though an import line is exactly what a dependency-cycle finding should cite. Then it was zeroed by a formatting change — once the digest carried line numbers, every line arrived as `   3 | // foo`, which no longer matched `^//`, so weak citations would have dropped from 1/4 to 0/4 on identical evidence, and I would have published that as an improvement. The fix is a `stripGutter` shim, recorded as a definition change.

**4. The README's headline numbers did not match the committed artifacts.** 22/25 and 9/14 against 21/25 and 9/15. Four external reviewers doubted the number before I checked it. It took addition over five files and two minutes.

**5. Two documents in one repository gave mutually exclusive answers** about whether anything had been measured: the benchmark README said the results table would "stay empty until a real run happens", under a `TODO: fill after the run`, while the main README published results.

Here is the pattern. Every gate checked the artifact. Not one checked whether the **prose about the artifact** was true. Documents do not have a schema, so the only thing between me and a false claim in a sales asset was somebody bothering to read.

## What the benchmark cannot tell you

About 21 repositories, three lots, three external review rounds. LLM judges on both ends; a different model family cross-checked, which mitigates the circularity without removing it (inter-judge kappa about 0.41 in both arms).

**Absolute precision is not publishable yet.** It needs a third judge from a family distinct from both current judges, over *all* claims, plus a human on an unbiased sample. What is no longer missing is the corpus: all 21 repositories and their pinned commits are published in `benchmark/targets.json`, together with the `label_map` that resolves target-1 → `chatbot-ui`, target-2 → `roomgpt`, target-3 → `screenshot-to-code` and target-4 → `llamacoder`, so the run is reproducible by anyone and those five per-repo figures can be re-derived from the clone. Until that adjudication exists, quote ranges.

**Mechanical grounding is the real weak point.** 100% of citations resolved to an in-range line on mature open-source repos; on vibe-coded repos about 60% do — 88/143 in one arm, 376/632 in the other. The cause is not invented file paths: **100% of cited files exist**. The model knows *which* file and estimates *where*. That is smaller and more fixable than "the model hallucinates", and I only found out by testing. I assumed hallucination first, in writing, and was wrong.

**A zero-finding assessment still passes the contract.** An empty report validates exactly like a full one: a model that burns its reasoning budget and emits `{"findings": []}` gets a clean bill of health from my own validator. That is the failure mode I would worry about most as a user.

And the honest reversal: over the full denominator — treating every claim as a claim — the single-pass arm verifies **24%** and the orchestrator **10%**. The multi-agent architecture produces 4.4x more claims and a smaller verifiable fraction: coverage, not precision. I published the opposite conclusion in an earlier draft, using only the flattering column.

## What is transferable

If you never install my tool, these hold anyway.

**Demand a `file:line` for every claim, and check the line exists.** A citation that resolves is not proof the claim is true; one that does not resolve is proof the claim was never checked.

**Treat "no findings" as a possible failure, not a clean bill of health.** A large input, a truncated digest, a model that gives up: from the outside they all look like a clean repo. Instrument coverage, not just findings.

**Own your taxonomy.** Put your rules in a registry, give each rule its severity and effort, and stamp those fields from code after the model has spoken. The moment the model sets its own severity, your prioritization system runs on a suggestion.

**Use deterministic tools for what is deterministic.** Semgrep, ESLint, gitleaks and SonarQube are free, exact and boring. The interesting work is not "find the secret" — it is deciding what to do about the secret, in this codebase, this quarter. Do not pay a language model to be a worse linter.

**Never let the author of an artifact be its judge.** I judged my own benchmark with the same model family that produced the findings, and it took three rounds of outside review to correct the story I told about my own data. Use another family, and a human.

## If you want the other half

The toolkit is free and stays free, and it will not tell you what matters for your product this quarter. That part is judgement, and judgement is what I sell.

The repo is at **[github.com/jacoprudot/DontKillTheVibes](https://github.com/jacoprudot/DontKillTheVibes)**. If you have a repo you are nervous about, send me the URL and I will spend fifteen minutes on it with you, free — **jaco@leongael.xyz**. Bring the one you shipped fast.

— Jacob

---

## Sources

Every figure above comes from a file in this repository. Line numbers are from the revision at the time of writing.

- **Seven models, same prompt, same URL; Gemini 1/1/1 and fabricated; GLM refusal and quoted passage; DeepSeek refusal; Claude blocked by `robots.txt`** — `docs/development/EXTERNAL_REVIEWS.md` lines 4–5, 18, 22–24, 31–43, 49–57.
- **The RealWorld assessment: 7 findings, health F, 1 critical / 3 high / 2 medium / 1 info, effort 3 XS + 3 S + 1 M, all seven rule ids, severities, `file:line` locations, evidence snippets, confidence values and 30/60/90 phases** — `examples/realworld-assessment/assessment.json` (summary lines 10–31; findings 32–189; work plan 190–226; priority scores 227–284); `examples/realworld-assessment/assessment-report.md` lines 1–111.
- **`security-jwt-weak-3` score 142.5 vs 58.5 for the runner-up; `score = severity weight × module weight × confidence`** — `examples/realworld-assessment/assessment.json` lines 227–266; `assessment-report.md` lines 7–14.
- **The single-model baseline reported 3 findings, 0 criticals, 0 security findings, and missed `security-jwt-weak-3`, `security-cors-wildcard-2` and `security-error-detail-1`** — `examples/realworld-assessment/COMPARISON.md` lines 9–27.
- **RealWorld assessment metadata: run on 2026-09-29, toolkit v0.1.0-beta, validated `VALID: 7 findings, 0 warnings`** — `examples/realworld-assessment/assessment.json` lines 3–8; `assessment-report.md` line 108.
- **Arm A: 64 claims, 0 mechanically decidable** — `README.md` line 98; `benchmark/README.md` §6a, line 277.
- **Arm B: 9/15 (README used to say 9/14); per-repo range 0.2–1.0 over the three targets where its judge verdicts were decidable (control 1.0, target-2 0.2, target-4 0.333) — arm B ran on four targets: its target-3 row is 0 real / 0 false, so there is no decidable precision there, and it was never run at all on target-1** — `benchmark/results/*/scores.json` (`summary_by_arm.toolkit`); `benchmark/README.md` §6a lines 258, 263, 266, 269, 277–278 and the correction note lines 281–288; `README.md` lines 99–100, 102.
- **Arm C: 21/25 (README used to say 22/25); per-repo range 0.625–1.0; 0.84 = 21/25** — `benchmark/README.md` §6a lines 259, 261, 264, 267, 270, 278–279 and the correction note lines 281–288; `README.md` lines 100, 102.
- **Target-1 has no arm-B row (B-vs-C is really over four targets)** — `benchmark/README.md` lines 272–274.
- **Caveats: naive arm never asked for `file:line`; arm C input differs from A/B; arm A's precision is computed but not published** — `docs/development/EXTERNAL_REVIEWS.md` lines 50–51, 63.
- **368 rules across 8 decision trees; severity/effort stamped from the registry; two runners; two MCP servers; priority = severity × module weight × confidence** — `README.md` lines 17, 133–138.
- **Fingerprint `368-6e180554`; 394 → 368 with 26 `github-tech-stack-*` reclassified; deprecation not deletion** — `skills/CHANGELOG.md` lines 9–24, 40–52, 54–67.
- **14 of 368 rules un-citable; id pattern widened to `^[a-z0-9-]+-\d+$`; 144 legitimate findings lost in the live eurekagent run** — `benchmark/results-lote3/PREDICTIONS.md` line 14; `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV3.md` line 63; `VALIDATION-REPORT-REV5.md` lines 111–115, 143–144; commit `12e695c` message.
- **Severity/effort invented in 14 of 21 findings (67%)** — `agents/synthesis-agent.md` lines 30–32; `docs/development/JEV_EXPERIMENT.md` line 31.
- **JWT bypass reported as `security-secret-in-code-1` (high) instead of `security-jwt-weak-3` (critical); weak citations 9/21 (43%) citing imports, braces and blank lines** — `docs/development/JEV_EXPERIMENT.md` line 32 (9 of 21 findings cited line 0, an import or a lone `};`); `agents/synthesis-agent.md` lines 26–32 (severity/effort contradicted the cited rule in 14 of 21 findings).
- **Weak-citation metric inflated on import lines ("an import line IS evidence and is never weak", the `structure-class-dependency-cycle-3` case)** — `scripts/dktv-orchestrate.mjs` lines 398–409, 154; `benchmark/judge.mjs` lines 728–751.
- **Weak-citation metric zeroed by the digest gutter (1/4 → 0/4, a false improvement); `stripGutter`; definition change** — `benchmark/judge.mjs` lines 352–381, 728–738; `benchmark/README.md` §4 line 91, §4b line 127; commit `af9c19c` message.
- **`benchmark/README.md` "stay empty until a real run happens" / "TODO: fill after the run"** — `docs/development/EXTERNAL_REVIEWS.md` line 74.
- **"The 22/25 does not hold" (four reviewers); the README/`scores.json` contradiction** — `docs/development/EXTERNAL_REVIEWS.md` lines 99, 109–110.
- **21 repos total; every target and its pinned commit is published, so the run is reproducible** — `benchmark/targets.json` (21 `targets`, each with `name`/`url`/`commit`, plus the `label_map`); `benchmark/README.md` §5b "Target anonymity" lines 193–239; `benchmark/repos.json`; `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV3.md` line 104. The earlier "anonymized / not reproducible from the clone" reading is recorded as a reviewer finding in `docs/development/EXTERNAL_REVIEWS.md` lines 75, 98.
- **Kappa 0.405 (B) / 0.424 (C); 144/156 claims judged** — `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` lines 89–95; `benchmark/README.md` §6c lines 316–320.
- **100% of cited files exist; ~60% of cited lines in range (88/143 and 376/632); cause is position estimation, not path hallucination** — `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` lines 57–71, 132–137.
- **44/44 mechanical grounding on mature OSS; 9 of 44 citations do not support the claim** — `benchmark/results-lote1-crossjudge/VALIDATION-REPORT.md` lines 48, 56–60; `benchmark/README.md` §6b lines 290–299.
- **Arm B 143 findings vs arm C 632 (4.4x); verification over all claims 24% vs 10%; 297/553 unverifiable with a resolved citation (support failure)** — `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` lines 40–45, 79–85; `benchmark/README.md` §6c lines 301–321.
- **Absolute precision not publishable without a third-family judge plus a human sample** — `benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md` lines 146–150; `benchmark/README.md` §6b lines 290–299.
- **Zero-finding assessment passes the contract; digest truncation (10,000 chars/file, 120,000 total); single model under test; self-judging is a known weakness** — `README.md` lines 62, 145; `benchmark/README.md` §7 lines 330–367 (334–336, 356).
- **Deterministic linters as the real competitor (Semgrep, ESLint, SonarQube); "zero findings" indistinguishable from a broken run; contract guarantees shape not truth** — `docs/development/EXTERNAL_REVIEWS.md` lines 67, 69, 96–97, 101–102.
