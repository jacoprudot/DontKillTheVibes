![DontKillTheVibes Banner](assets/banner.jpg)

# DontKillTheVibes (DKTV) 🚀

The LLM-orchestrated assessment toolkit for vibe coders, scale-ups, and fast-moving engineering teams.

## Overview

When you're scaling fast, the codebase can quickly turn into a bottleneck. **DontKillTheVibes** provides a set of highly opinionated *Skills*, *MCPs* (Model Context Protocol servers), and *Agent definitions* that enable your favorite LLMs (Claude Code, Gemini, Cursor) to assess your repository and generate actionable 30/60/90-day work plans.

It's completely LLM-agnostic and relies on strict decision-trees and math-based prioritization to eliminate AI hallucinations and give you real engineering value.

## 🎯 The Vibe Coding Problems We Solve

As teams increasingly rely on AI to write code, several critical risks emerge. **DontKillTheVibes** is explicitly designed to solve them:

1. **Silent Tech Debt Accumulation (Patches over Patches)**
   *The Problem:* LLMs with limited context windows duplicate logic and apply superficial fixes instead of designing global systems.
   *Our Solution:* The `structure-analyst` and `code-quality-analyst` skills are designed to look at the macro-architecture, detecting coupling, dependency cycles, and duplication.
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

4. **Run the Synthesis Agent:**
   Open your preferred AI terminal tool (like Claude Code) inside the repository you want to assess, and feed it the Synthesis Agent prompt along with the path to the skills:
   
   > "Act as the Synthesis Agent defined in `/path/to/dontkillthevibes/agents/synthesis-agent.md`. Read the skills from `/path/to/dontkillthevibes/skills/` and audit this repository. Generate the `assessment-report.md` and `assessment.json`."

## Architecture

- **Skills (`skills/`)**: Decision-tree analysis capabilities for Database, Code, Structure, Flows, Security, Cost, and Performance.
- **MCPs (`mcps/`)**: Tools for your LLM. Includes custom servers for deep Git analysis and localized code benchmarking.
- **Agents (`agents/`)**: 8 specialist analyst roles + 1 **Synthesis Agent** that prioritizes findings using a severity × module-weight algorithm.

## Status (honest)

- MCPs build clean and are covered by security-focused smoke tests (`scripts/mcp-smoke.mjs`); audit trail in `.dontkillthevibes/audit.log`.
- Output contract is enforceable: `scripts/validate-assessment.mjs` validates `assessment.json` against `templates/finding-schema.json`. A real end-to-end run against the RealWorld API ships in `examples/realworld-assessment/`.
- Known gaps: MCP unit tests not yet written (`pnpm test` runs jest but there are no test files yet), CI workflows pending, and the full 8-agent parallel pipeline is executed by the orchestrating LLM rather than a bundled runner.

## Philosophy

Speed shouldn't kill the vibe. This toolkit embodies the "dontkillthevibes" philosophy: provide powerful, automated assessment capabilities that help developers maintain their creative flow while proactively paying down technical debt.

## License & Contributing
MIT License. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on adding new skills or MCPs.