# DontKillTheVibes (DKTV) 🚀

The LLM-orchestrated assessment toolkit for vibe coders, scale-ups, and fast-moving engineering teams.

## Overview

When you're scaling fast, the codebase can quickly turn into a bottleneck. **DontKillTheVibes** provides a set of highly opinionated *Skills*, *MCPs* (Model Context Protocol servers), and *Agent definitions* that enable your favorite LLMs (Claude Code, Gemini, Cursor) to assess your repository and generate actionable 30/60/90-day work plans.

It's completely LLM-agnostic and relies on strict decision-trees and math-based prioritization to eliminate AI hallucinations and give you real engineering value.

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
   pnpm turbo run build
   ```
3. **Configure MCPs:**
   The framework uses official MCP servers for GitHub and Filesystem, plus custom ones for Git Blame and Benchmarking. Ensure your environment has the required tokens (e.g., `GITHUB_PERSONAL_ACCESS_TOKEN`) set if you plan to use the GitHub MCP.

4. **Run the Synthesis Agent:**
   Open your preferred AI terminal tool (like Claude Code) inside the repository you want to assess, and feed it the Synthesis Agent prompt along with the path to the skills:
   
   > "Act as the Synthesis Agent defined in `/path/to/dontkillthevibes/agents/synthesis-agent.md`. Read the skills from `/path/to/dontkillthevibes/skills/` and audit this repository. Generate the `assessment-report.md` and `assessment.json`."

## Architecture

- **Skills (`skills/`)**: Decision-tree analysis capabilities for Database, Code, Structure, Flows, Security, Cost, and Performance.
- **MCPs (`mcps/`)**: Tools for your LLM. Includes custom servers for deep Git analysis and localized code benchmarking.
- **Agents (`agents/`)**: 8 specialist analyst roles + 1 **Synthesis Agent** that prioritizes findings using a severity × module-weight algorithm.

## Philosophy

Speed shouldn't kill the vibe. This toolkit embodies the "dontkillthevibes" philosophy: provide powerful, automated assessment capabilities that help developers maintain their creative flow while proactively paying down technical debt.

## License & Contributing
MIT License. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on adding new skills or MCPs.