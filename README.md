![DontKillTheVibes Banner](assets/banner.jpg)

# DontKillTheVibes (DKTV) 🚀

The LLM-orchestrated assessment toolkit for vibe coders, scale-ups, and fast-moving engineering teams.

> **Want this run on *your* repo, read by a human?**
> I audit codebases like yours and hand you the 30/60/90-day plan, finding by finding, with the noise removed.
> → [Request a free 15-minute audit](mailto:jaco@leongael.xyz?subject=Repo%20audit&body=Repo%20URL%3A%20%0ATech%20stack%3A%20%0AWhat%20worries%20me%20most%3A%20)

## Overview

When you're scaling fast, the codebase can quickly turn into a bottleneck. **DontKillTheVibes** provides a set of highly opinionated *Skills*, *MCPs* (Model Context Protocol servers), and *Agent definitions* that enable your favorite LLMs (Claude Code, Gemini, Cursor) to assess your repository and generate actionable 30/60/90-day work plans.

It's completely LLM-agnostic: strict decision-trees and math-based prioritization constrain the analysis, and a validator enforces the output contract. The LLM proposes findings; the validator disposes — malformed structure, unknown rule IDs, dangling cross-references and inconsistent tallies never survive validation.

What the validator does **not** do: confirm that a cited line number still matches the code. Grounding is a prompt-level obligation, not a runtime check.

## 🎯 The Vibe Coding Problems We Solve

As teams increasingly rely on AI to write code, several critical risks emerge. **DontKillTheVibes** is explicitly designed to solve them:

1. **Silent Tech Debt Accumulation (Patches over Patches)**
   *The Problem:* LLMs with limited context windows duplicate logic and apply superficial fixes instead of designing global systems.
   *Our Solution:* The `structure-assessment` and `code-quality-assessment` skills (driven by the `structure-analyst` and `code-quality-analyst` agents) look at the macro-architecture, detecting coupling, dependency cycles, and duplication.
2. **Critical Security Vulnerabilities**
   *The Problem:* Iterative AI bug-fixing often introduces or inherits insecure patterns (open databases, data leaks).
   *Our Solution:* The `security-analyst` enforces strict security reviews on inputs, secrets, and cloud configurations.
3. **Loss of Control (The Black Box Effect)**
   *The Problem:* Without senior supervision, AI-generated code becomes unmaintainable. When a production crash happens, no one knows how to debug it.
   *Our Solution:* The `Synthesis Agent` returns control to the developer by outputting a structured, human-readable 30/60/90-day architectural roadmap. It maps dependencies so you understand *exactly* what the code is doing.
4. **Hidden Costs & Professional Stagnation**
   *The Problem:* Massive token consumption via endless prompt regeneration, coupled with developers losing their analytical edge.
   *Our Solution:* The `cost-analyst` identifies infrastructure and API bloat, while the toolkit as a whole explains the *why* behind architectural decisions, acting as an automated senior mentor.

## ⚡ 30-Second Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jacoprudot/dontkillthevibes.git
   cd dontkillthevibes
   ```
2. **Install dependencies & Build:**
   ```bash
   npm install -g pnpm
   pnpm install
   pnpm build
   ```
3. **Configure MCPs:**
   The framework uses official MCP servers for GitHub and Filesystem, plus custom ones for Git Blame and Benchmarking (registered in `mcp_config.json`; build with `pnpm build` before connecting). Ensure your environment has the required tokens (e.g., `GITHUB_PERSONAL_ACCESS_TOKEN`) set if you plan to use the GitHub MCP.

4. **Run the assessment (LLM-orchestrated):**
   Open your preferred AI terminal tool (like Claude Code) inside the repository you want to assess, and feed it the Synthesis Agent prompt along with the path to the skills:
   
   > "Act as the Synthesis Agent defined in `/path/to/dontkillthevibes/agents/synthesis-agent.md`. Read the skills from `/path/to/dontkillthevibes/skills/` and audit this repository. Generate the `assessment-report.md` and `assessment.json`."
   
   Note: this path is orchestrated by *your* LLM following the skill and agent definitions. Alternatively, use the bundled CLI runner (single-pass: one LLM call plus automatic validation retries) against any OpenAI-compatible endpoint, e.g. NVIDIA NIM:
   ```bash
   LLM_API_KEY=xxx LLM_MODEL=moonshotai/kimi-k2-instruct-0905 pnpm run dktv:assess --target /path/to/repo
   ```
   The decision-trees are deterministic logic with explicit thresholds, but their interpretation against your code is done by the LLM.

5. **Validate the output:**
   ```bash
   node scripts/validate-assessment.mjs assessment.json
   ```
   It enforces the document shape, every field type from `templates/finding-schema.json`, unique finding IDs, that every ID exists as a canonical rule in `skills/*.skill.md`, that `work_plan` and `relatedFindings` reference only real findings, and that `summary` tallies match the findings. If it passes, you have a structured report free of format hallucinations — if it fails, feed the validation error back to the LLM and have it fix the JSON until the validator accepts it. Pass `--no-registry` if you are validating against a custom skill set.

## See it on a real repository

[`examples/realworld-assessment/`](examples/realworld-assessment/) is a complete end-to-end run: 7 findings traced to canonical rule IDs, prioritized with the severity × module-weight algorithm, and enforced by the validator. The raw `assessment.json` and the human report are both checked in — including the critical JWT-secret fallback that a plain LLM pass had missed.

The automated pipeline emits `assessment.json` plus a generated `assessment-report.md` covering findings, severities, priority scores and the 30/60/90-day plan. The checked-in report additionally carries hand-written prose: that part is authored by a human, not generated, and the tool does not claim to produce it.

Want that for your codebase? → [Request a free 15-minute audit](mailto:jaco@leongael.xyz?subject=Repo%20audit&body=Repo%20URL%3A%20%0ATech%20stack%3A%20%0AWhat%20worries%20me%20most%3A%20)

## Architecture

- **Skills (`skills/`)**: Decision-tree analysis capabilities for Database, Code, Structure, Flows, GitHub, Security, Cost, and Performance (8 skills, each with explicit thresholds and canonical finding IDs).
- **MCPs (`mcps/`)**: Tools for your LLM. Includes custom servers for deep Git analysis and localized code benchmarking.
- **Agents (`agents/`)**: 8 specialist analyst roles + 1 **Synthesis Agent** that prioritizes findings using a severity × module-weight algorithm.

## Status (honest)

- **MCPs are tested, not just smoke-tested:** 244 unit tests across both custom MCPs, with branch coverage in the mid-80s — above the enforced 80% threshold (coverage collection is on by default; the only exclusions are each server's `src/index.ts` stdio wiring, `*.d.ts` and the test files themselves).
- **Security has its own gates:** `pnpm security:audit` fails on `shell: true`, `execSync`/`exec`/`spawn`, `eval` and `...process.env` spreads under `mcps/*/src`, and `scripts/mcp-smoke.mjs` drives the real servers over stdio to assert the injection guards fire (`INVALID_COMMIT`, `BINARY_NOT_ALLOWED`). Every invocation appends a hash-only line to `.dontkillthevibes/audit.log`. What is *not* enforced is listed explicitly in `templates/security-model.md`.
- **CI runs all of it** on every push: `.github/workflows/ci.yml` does install → build → test (80% gate) → security audit → skills/MCP validation → assessment-contract validation → MCP smoke tests.
- **Output contract is enforceable:** `scripts/validate-assessment.mjs` validates `assessment.json` against `templates/finding-schema.json` and additionally rejects unknown rule IDs, dangling `work_plan`/`relatedFindings` references and summary tallies that disagree with the findings. A real end-to-end run against the RealWorld API ships in `examples/realworld-assessment/`.
- **Known gaps:** the CLI runner is single-pass (repo digest in, one LLM call, validation retries) — it does not yet replicate the full 8-agent parallel pipeline with MCP-driven file reading; the "Data Availability" rules (cost/performance analysts without runtime metrics) are documented in 5 of the 8 skills but not yet measured in a real run; the benchmark MCP was not exercised against a live server in the shipped example; a second versioned example and a one-command executable demo are pending.

> Note: commit timestamps reflect the author's system clock.

## Philosophy

Speed shouldn't kill the vibe. This toolkit embodies the "dontkillthevibes" philosophy: provide powerful, automated assessment capabilities that help developers maintain their creative flow while proactively paying down technical debt.

## Work with me

The toolkit is free and stays free. What it can't do is decide *what matters for your product this quarter* — that part I do.

- **Paid repo audit (async):** I run the toolkit, verify every finding by hand, drop the noise, and send you a prioritized 30/60/90-day plan with the fixes in order.
- **Free 15-minute call:** bring the repo, and I'll tell you the two things that would hurt you first.

→ **[jaco@leongael.xyz](mailto:jaco@leongael.xyz?subject=Repo%20audit&body=Repo%20URL%3A%20%0ATech%20stack%3A%20%0AWhat%20worries%20me%20most%3A%20)**

## License & Contributing
MIT License. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on adding new skills or MCPs.