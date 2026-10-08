![DontKillTheVibes Banner](assets/banner.jpg)

# DontKillTheVibes (DKTV) 🚀

![CI](https://github.com/jacoprudot/DontKillTheVibes/actions/workflows/ci.yml/badge.svg)

Turn an LLM loose on your repo and get a **structured, validated 30/60/90-day plan** — not another wall of confident prose.

Free, MIT, LLM-agnostic. Works with Claude Code, Cursor, Gemini, or any OpenAI-compatible endpoint.

**[👉 See a real assessment on a real repository](examples/realworld-assessment-en/)** — raw pipeline output: findings with file:line citations, priority scores, and the plan. Judge for yourself before installing anything.

## ⚠️ Pivot (2026-10-06): the LLM-as-detector paths are retired

**What v0.1.0 was:** an LLM-as-detector toolkit — a digest of your repo fed to a model, 8 specialist agent prompts, a single-pass CLI, and a strict output contract (368 canonical rules owning their own severity/effort). It produced impressively structured reports.

**Why it did not serve vibecoders:** the structure was real but the findings were not actionable. Measured on 10 vibe-coded repos ([evidence](benchmark/results-lote2-crossjudge/VALIDATION-REPORT-REV5.md)): only **60%** of citations resolve to a real line, **88%** of orchestrated findings were unverifiable, and precision over all claims was **24%** (single pass) / **10%** (orchestrator). A user cannot fix a finding they cannot verify — the report read complete and wasn't. The unreliable part was the LLM as *detector*; the asset that survived is the **368-rule registry + contract**.

**New direction**, declared in [PLAN.md](PLAN.md): deterministic detectors (`gitleaks`/`semgrep`/`osv-scanner`) find, the registry translates, code assembles the report — citations valid by construction. Paths A/B/C below stay as **versioned evidence**, not as the recommended path.

## 🔍 See it work (20 seconds, no install)

This is the deterministic path on a public RealWorld app — the same repository the [case study](docs/CASE_STUDY.md) used. One command:

```bash
git clone https://github.com/jacoprudot/dontkillthevibes.git && cd dontkillthevibes
pnpm install && pnpm detect --target examples/detect-realworld/repo
```

Raw signal, straight from the scanner — this exact line is in the repo:

```
src/app/routes/auth/auth.ts:16
  secret: process.env.JWT_SECRET || 'superSecret',
```

What the registry turns it into (`pnpm detect:report --target examples/detect-realworld/repo --out examples/detect-realworld`):

```
security-jwt-weak-3 — CRITICAL, effort XS, score 150
src/app/routes/auth/auth.ts:16  (also :21, and token.utils.ts:4)
Evidence:    secret: process.env.JWT_SECRET || 'superSecret',
Remediation: Use strong random secret (minimum 32 bytes) from secure source
Why first:  critical in the security module outranks everything else — that ordering is arithmetic, not a model's mood
```

**The honest number.** A general single-model pass over the same repo reported **3 findings, 0 security, 0 criticals** ([committed baseline](examples/gemini-baseline/)). It never saw this auth bypass — the most severe thing in the repository. The deterministic detector finds all three sites in 402 ms on the committed snapshot (`pnpm detect`, measured here — no network, no model, no API key), and every citation resolves to a real line *by construction*: the scanner produced the citation by matching the line.

**The caveat, said out loud.** Precision over *all* detector findings is still unmeasured — it stays unclaimed until the human-adjudicated sample exists ([PLAN.md](PLAN.md) Fase 7, declared up front). What you can verify by hand today is every citation; what you cannot yet trust is how often the rule cries wolf. [The full report this demo produced](examples/detect-realworld/report.md) is committed alongside the [snapshot it scanned](examples/detect-realworld/repo/) — reproduce it with that exact command and diff. The `--out` is not decoration: the tool's default output directory is `<target>/.dontkillthevibes/`, i.e. *inside* the frozen snapshot, so without it the committed artifacts stay untouched and the diff is empty. Be exact about what is reproducible: `report.md` and `prompts.md` come out **byte-identical**, and `findings.json` differs in exactly two fields — `generated_at` (a wall-clock timestamp) and `target` (the absolute path of *your* checkout, which `report.md` and `prompts.md` print too). Nothing else varies between runs; the finding counts, ordering and citations are deterministic.

## Overview

**DontKillTheVibes** is a toolkit of opinionated *Skills* (decision-tree analysis), *MCPs* (Model Context Protocol servers), and *Agent definitions* that let your LLM audit a repository and emit an actionable 30/60/90-day work plan.

The LLM proposes findings; **the toolkit disposes**. 368 canonical rules own their own severity and effort — the model can never inflate or invent them. A strict validator enforces the output contract: malformed structure, unknown rule IDs, dangling cross-references and inconsistent tallies never survive validation. That contract is what separates this from "just ask ChatGPT to review my code."

What the validator does **not** do: confirm that a cited line still matches the code. Citation repair is the runner's job (see [Measured results](#measured-results-not-claimed) for how well that works today).

## 🎯 The Vibe Coding Problems We Solve

As teams increasingly rely on AI to write code, several critical risks emerge. DKTV is explicitly designed to catch them:

1. **Silent tech debt accumulation** — LLMs with limited context duplicate logic and patch superficially. The `structure` and `code-quality` skills look at macro-architecture: coupling, dependency cycles, duplication.
2. **Critical security vulnerabilities** — iterative AI bug-fixing inherits insecure patterns (hardcoded secrets, open CORS, leaked errors). The `security` skill is the strongest module: 45 rules, hand-verified ground truth.
3. **Loss of control (black box effect)** — the Synthesis Agent returns control by outputting a structured, prioritized roadmap: what to fix in 30/60/90 days, what blocks what, and *why*.
4. **Hidden costs** — the `cost` and `performance` skills flag API-call-in-loop, missing caches, and sequential-where-parallel patterns.

## ⚡ Quick Start

Three ways to run it, from zero-config to full pipeline:

### Path A — inside your AI agent (zero config, no API key needed)

The toolkit is skills + agents + MCPs: your existing agent subscription does the work.

> ⚠️ **Legacy path.** The 2026-10-06 pivot (see [Pivot](#-pivot-2026-10-06-the-llm-as-detector-paths-are-retired) above) retires the LLM-as-detector paths; this one stays as versioned evidence.

```bash
git clone https://github.com/jacoprudot/dontkillthevibes.git
```

Then, inside the repository you want to assess, tell your agent (Claude Code, Cursor, …):

> "Act as the Synthesis Agent defined in `/path/to/dontkillthevibes/agents/synthesis-agent.md`. Read the skills from `/path/to/dontkillthevibes/skills/` and audit this repository. Generate `assessment.json` and `assessment-report.md`. Validate the JSON with `node /path/to/dontkillthevibes/scripts/validate-assessment.mjs assessment.json` and `node /path/to/dontkillthevibes/scripts/dktv-grade.mjs assessment.json --fix` — fix whatever either reports."

> **Status, honestly:** Path A has produced valid end-to-end assessments, but the prompt above alone is not the whole recipe — the output contract (severity/effort owned by the rule, exact tallies, document shape) lives in the Synthesis Agent's *Output Contract* section and in `templates/minimal-assessment.json`. Follow those and it validates. The fully scripted path below (Path B) is the most thoroughly verified.

Optional power-ups: register the custom MCPs from `mcp_config.json` (deep Git analysis + local benchmarking) — `pnpm install && pnpm build` first, plus a `GITHUB_PERSONAL_ACCESS_TOKEN` if you want the GitHub MCP.

### Path B — CLI runner, single pass

One digest, one LLM call, automatic validation retries. Needs any OpenAI-compatible endpoint (NVIDIA NIM, OpenRouter, …):

```bash
pnpm install && pnpm build
LLM_API_KEY=xxx LLM_MODEL=nvidia/nemotron-3-super-120b-a12b pnpm run dktv:assess --target /path/to/repo
```

**Reasoning models need a bigger completion budget — and a smaller digest.** Nemotron-class models spend thousands of tokens on hidden reasoning before emitting anything. Two failure modes we hit on a real run against a 319-file vibe-coded target (verified Oct 2026):

- **Default budget (8192):** empty response, `finish_reason: length` — all tokens burned on reasoning.
- **Large digest (~107k tokens):** empty response, `finish_reason: stop` — reasoning ends without emitting anything. Even a *valid* JSON can come back with **0 findings**, which the validator accepts silently. If you get "VALID: 0 findings" on a repo that clearly has issues, the model gave up — re-run with a smaller digest.

What worked end-to-end on that target:

```bash
MAX_TOKENS=65536 DIGEST_CONTEXT_CHARS=40000 LLM_API_KEY=xxx LLM_MODEL=nvidia/nemotron-3-super-120b-a12b pnpm run dktv:assess --target /path/to/repo
```

Model IDs move: NIM retires IDs (`moonshotai/kimi-k2-instruct-0905` now 404s) and gates some models per account ("Function not found for account"). Check current IDs on build.nvidia.com; list what your key can actually call with `curl -H "Authorization: Bearer $LLM_API_KEY" https://integrate.api.nvidia.com/v1/models`.

### Path C — 8-agent orchestrator (best recall)

Each of the 8 specialist agents picks the files it needs (round 1), reads them (round 2), reports findings; a deterministic synthesis merges, dedupes, scores and plans. This is the runner that won the benchmark below.

```bash
node scripts/dktv-orchestrate.mjs --target /path/to/repo --out /path/to/repo/.dontkillthevibes
```

Same key/env as Path B. `--dry-run` shows the plan and budgets without calling the API; `--mock` runs fully offline with labelled mock findings.

### Validate the output (all paths)

```bash
node scripts/validate-assessment.mjs assessment.json
```

Enforces the document shape, every field type from `templates/finding-schema.json`, unique finding IDs, that every ID exists as a canonical rule in `skills/*.skill.md`, that `work_plan`/`relatedFindings` reference only real findings, and that `summary` tallies match the findings. If it fails, feed the error back to the LLM and have it fix the JSON until the validator accepts it.

Scope, honestly: the contract guarantees *shape*, not *truth* — a well-formed finding with a wrong line number still validates; the blind-judge benchmark is the counterweight, and we publish its ranges, not decimals. Only `assessment.json` is machine-validated; `assessment-report.md` is rendered from it and has no gate — regenerate it if you edit the JSON. And `overall_health` is nobody's judgement: it is the worst severity present (F = any critical, D = high, C = medium, B = low, A = info-only; E reserved), computed by `scripts/lib/health-grade.mjs`. Path A applies it via `scripts/dktv-grade.mjs`, the CLI runner and the orchestrator stamp it — one repository, one letter, three consumers running the same function.

## Measured results (not claimed)

5 real public repos — the RealWorld API control (named; already public via `examples/`) plus 4 vibe-coded targets kept under neutral labels target-1..target-4 in the evidence (`benchmark/targets.json` publishes which repo each label is, and why — see [`benchmark/README.md` §5b](benchmark/README.md#5b-target-anonymity)) — × 3 approaches × a **blind judge** (a different model, 3 runs per target — we publish ranges, not decimals):

| Arm | What it is | Verified findings |
|---|---|---|
| **A — free prose** | "Audit this repo" in a plain prompt | 64 claims, **0 mechanically decidable** — confident prose with no file:line anchor |
| **B — this toolkit, single pass (Path B)** | Digest in, one validated call | 9/15 real where the judge could verify (pooled 0.6; per-repo 0.2–1.0 over the three targets where B produced a *decidable* precision — B ran on 4, but target-3's 5 claims were 0 real / 0 false, so its precision is `null`) |
| **C — this toolkit, 8-agent orchestrator (Path C)** | Specialists + deterministic synthesis | **21/25 real (pooled 0.84; per-repo 0.625–1.0)** — never behind arm B in any target where the comparison is decidable (arm C vs arm B, 3 of 5: control 1.0 vs 1.0, target-2 0.9 vs 0.2, target-4 1.0 vs 0.333 — arm B was never run on target-1, and its target-3 row has no decidable claim) |

Corrected 2026-10-06: an earlier revision showed 22/25 and 9/14; the raw judge output is 21/25 and 9/15 (`real ÷ real+false` in `benchmark/results/*/scores.json`). The 0.84 that was quoted as the range floor is the pooled arm-C precision, not a per-repo value — the true per-repo range is 0.625–1.0 (0.625, 0.9, 1.0, 1.0, 1.0).

Structural findings beat free prose not because the model is smarter, but because the contract makes every claim checkable. Honest caveats: convenience sample (not representative), judge has run-to-run variance, recall against ground truth is measured only on the control repo. Full evidence is versioned in [`benchmark/results/`](benchmark/results/) and reproducible from [`benchmark/run.mjs`](benchmark/run.mjs) + [`benchmark/judge.mjs`](benchmark/judge.mjs).

## See it on a real repository

[`examples/realworld-assessment/`](examples/realworld-assessment/) — a complete run on the RealWorld API repo: 7 findings traced to canonical rule IDs, including the critical JWT-secret fallback that a plain LLM pass missed. [`examples/realworld-assessment-en/`](examples/realworld-assessment-en/) is the raw English pipeline output for the same repo — exactly what the tool emits, no hand-tuning, validator verdict included.

What the output looks like, end to end:

```text
$ node scripts/validate-assessment.mjs examples/realworld-assessment/assessment.json
VALID: 7 findings, 0 warning(s)
```

…and the generated report hands you the plan:

```text
## 30/60/90 Day Plan
### 30 Days
- `security-jwt-weak-3`: Remove the default value and require JWT_SECRET to be
  set in environment variables (XS)
- `database-sequential-pagination-1`: Execute count and findMany queries
  concurrently using Promise.all in both functions (S)
- `code-any-type-6`: Replace 'any' with a specific type, e.g., define a Query
  interface for the query object (S)
- `code-missing-return-type-8`: Add return type annotation (S)
```

Every finding carries its canonical rule ID, severity, effort, confidence, priority score and a file:line citation — the excerpt above is from the checked-in English example, exactly as the tool emitted it.

## Architecture

- **Skills (`skills/`)**: 8 decision-tree modules (database, code, structure, flows, github, security, cost, performance) declaring **368 canonical rules**, each with owned severity/effort and a fingerprinted registry (`scripts/lib/canonical-registry.mjs`) — the single source of truth for runners *and* validator.
- **MCPs (`mcps/`)**: tools for your LLM — deep Git analysis (blame, diff, branch tree, large files) and localized benchmarking (wrk/k6/perf) that never send your code anywhere.
- **Agents (`agents/`)**: 8 specialist analyst roles + 1 Synthesis Agent (priority = severity × module-weight × confidence). **Legacy** — retired by the 2026-10-06 pivot ([PLAN.md](PLAN.md)); kept on disk as versioned evidence until the benchmark is archived.
- **Runners**: single-pass CLI (`scripts/dktv-assess.mjs`) and the 8-agent orchestrator (`scripts/dktv-orchestrate.mjs`), both stamping rule fields from the registry instead of trusting the model. **Legacy** — same pivot.

## Status (honest)

- **MCPs are tested, not just smoke-tested:** 244 unit tests across both custom MCPs, branch coverage in the mid-80s, enforced 80% gate in CI.
- **Security has its own gates:** `pnpm security:audit` fails on `shell: true`, `execSync`/`exec`/`spawn`, `eval` and `...process.env` spreads under `mcps/*/src`; `scripts/mcp-smoke.mjs` drives the real servers to assert injection guards fire. Every invocation appends a hash-only line to `.dontkillthevibes/audit.log`. What is *not* enforced is listed in `templates/security-model.md`.
- **CI runs all of it** on every push: install → build → test (80% gate) → security audit → skills/MCP validation → assessment-contract validation (both shipped examples) → MCP smoke tests.
- **Known gaps:** the single-pass CLI's recall is capped by the digest budget (that's what the orchestrator exists for); the "Data Availability" rules (cost/performance without runtime metrics) are documented in 5 of the 8 skills but not yet measured against a live server; the benchmark MCP was not exercised live in the shipped example; an empty assessment (zero findings) still passes the contract; a one-command Docker demo is pending; the digest walks files in alphabetical order and stops when the char budget runs out, so a monorepo can be assessed on `packages/a-*` alone and still read as complete; some canonical rules cannot fire from either runner at all — `security-secret-in-history-2` needs git history, and `.git` is in the runners' `SKIP_DIRS`; `scripts/` has no tests, so the 244 tests and the 80% gate cover `mcps/*` only; no cost-per-run figure is published — the runners log token usage (`Tokens: N in / M out`), never dollars.

> Note: commit timestamps reflect the author's system clock.

## Philosophy

Speed shouldn't kill the vibe. This toolkit embodies the "dontkillthevibes" philosophy: give developers powerful, automated assessment that maintains creative flow while proactively paying down technical debt. Free to use, free to adapt (MIT) — fork it, add your own rules, run it on everything.

## Work with me

The toolkit is free and stays free. What it can't do is decide *what matters for your product this quarter* — that part I do.

- **Paid repo audit (async):** I run the toolkit, verify every finding by hand, drop the noise, and send you a prioritized 30/60/90-day plan with the fixes in order.
- **Free 15-minute call:** bring the repo, and I'll tell you the two things that would hurt you first.

→ **[jaco@leongael.xyz](mailto:jaco@leongael.xyz?subject=Repo%20audit&body=Repo%20URL%3A%20%0ATech%20stack%3A%20%0AWhat%20worries%20me%20most%3A%20)**

## License & Contributing

MIT License. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on adding new skills or MCPs — the registry gate in CI will ask you for a changelog entry and a fingerprint update; that's on purpose.
