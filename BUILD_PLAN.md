# Build Plan: `dontkillthevibes` Assessment Toolkit

> **For Build Agent**: This is the complete implementation specification. Follow every section precisely. The toolkit enables vibe coders' LLMs to assess repositories and generate actionable work plans via specialized skills, MCPs, and pre-built agents.

---

## 1. Repository Overview

| Property | Value |
|----------|-------|
| **Name** | `dontkillthevibes` |
| **Owner** | `jacobprudot` (Leon Gael LLC) |
| **License** | MIT |
| **Primary Language** | TypeScript (Node.js 20+ LTS) for MCPs; Markdown for skills/agents |
| **Target Users** | Vibe coders using LLMs (Claude Code, Gemini, custom agents) |
| **Core Value** | Free, LLM-agnostic assessment toolkit → credibility → paid consulting funnel |

---

## 2. Directory Structure (Exact)

```
dontkillthevibes/
├── skills/
│   ├── database-assessment.skill.md
│   ├── code-quality-assessment.skill.md
│   ├── structure-assessment.skill.md
│   ├── flows-assessment.skill.md
│   ├── github-intelligence.skill.md
│   ├── security-assessment.skill.md
│   ├── cost-analysis.skill.md
│   └── performance-assessment.skill.md
├── mcps/
│   ├── github-mcp/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tools/
│   │   │   │   ├── get-repo-contents.ts
│   │   │   │   ├── get-commit-history.ts
│   │   │   │   ├── get-issues.ts
│   │   │   │   ├── get-workflow-runs.ts
│   │   │   │   ├── get-secrets-status.ts
│   │   │   │   └── get-dependency-graph.ts
│   │   │   ├── github-client.ts
│   │   │   ├── auth.ts
│   │   │   └── rate-limiter.ts
│   │   ├── dist/ (compiled output)
│   │   ├── README.md
│   │   └── SECURITY.md
│   ├── filesystem-mcp/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tools/
│   │   │   │   ├── read-file.ts
│   │   │   │   ├── glob-search.ts
│   │   │   │   ├── parse-log-file.ts
│   │   │   │   └── get-file-metadata.ts
│   │   │   ├── path-guard.ts
│   │   │   └── log-parsers/
│   │   │       ├── json-parser.ts
│   │   │       ├── text-parser.ts
│   │   │       └── csv-parser.ts
│   │   ├── dist/
│   │   ├── README.md
│   │   └── SECURITY.md
│   ├── git-mcp/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tools/
│   │   │   │   ├── get-blame.ts
│   │   │   │   ├── get-diff-since.ts
│   │   │   │   ├── get-branch-tree.ts
│   │   │   │   └── find-large-files.ts
│   │   │   └── git-wrapper.ts
│   │   ├── dist/
│   │   ├── README.md
│   │   └── SECURITY.md
│   └── benchmark-mcp/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── tools/
│       │   │   ├── run-benchmark.ts
│       │   │   ├── profile-code.ts
│       │   │   ├── measure-latency.ts
│       │   │   ├── measure-throughput.ts
│       │   │   ├── analyze-resource-usage.ts
│       │   │   ├── compare-benchmarks.ts
│       │   │   ├── suggest-load-test.ts
│       │   │   └── identify-resource-contention.ts
│       │   ├── sandbox.ts
│       │   └── benchmark-templates/
│       │       ├── wrk-template.lua
│       │       ├── k6-template.js
│       │       └── jmeter-template.jmx
│       ├── dist/
│       ├── README.md
│       └── SECURITY.md
├── agents/
│   ├── database-analyst.md
│   ├── code-quality-analyst.md
│   ├── structure-analyst.md
│   ├── flows-analyst.md
│   ├── github-intelligence-analyst.md
│   ├── security-analyst.md
│   ├── cost-analyst.md
│   ├── performance-analyst.md
│   └── synthesis-agent.md
├── templates/
│   ├── finding-schema.json
│   ├── assessment-report.md
│   ├── assessment.json
│   ├── security-model.md
│   ├── SKILL_TEMPLATE.md
│   └── MCP_TEMPLATE.md
├── examples/
│   ├── sample-assessment/
│   │   ├── repo-with-issues/ (test fixture)
│   │   ├── expected-findings.json
│   │   ├── assessment-report.md
│   │   └── assessment.json
│   ├── claude-code-session.md
│   └── gemini-session.md
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── skill_contribution.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── workflows/
│   │   ├── test-skills.yml
│   │   ├── test-mcps.yml
│   │   └── release.yml
│   └── dependabot.yml
├── docs/
│   ├── architecture.md
│   ├── contributing-skills.md
│   ├── contributing-mcps.md
│   └── security-model.md
├── scripts/
│   ├── validate-skills.ts
│   ├── validate-mcps.ts
│   ├── generate-docs.ts
│   └── run-integration-tests.ts
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── CHANGELOG.md
├── package.json
├── tsconfig.base.json
└── .gitignore
```

---

## 3. Core Specifications

### 3.1 Unified Finding Schema (`templates/finding-schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DontKillTheVibes Finding",
  "type": "object",
  "required": ["id", "module", "severity", "location", "description", "remediation", "effort", "confidence"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z-]+-\\d+$",
      "description": "Unique finding ID: module-category-number (e.g., database-missing-index-1)"
    },
    "module": {
      "type": "string",
      "enum": ["database", "code", "structure", "flows", "security", "cost", "performance", "github"],
      "description": "Which assessment module produced this finding"
    },
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low", "info"],
      "description": "Risk severity for prioritization"
    },
    "location": {
      "type": "object",
      "properties": {
        "file": { "type": "string", "description": "Relative path from repo root" },
        "line": { "type": "integer", "minimum": 0, "description": "Line number (0 if file-level)" },
        "function": { "type": "string", "description": "Function/method name if applicable" },
        "commit": { "type": "string", "description": "Commit SHA if finding is historical" }
      },
      "required": ["file"]
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of the issue"
    },
    "remediation": {
      "type": "string",
      "description": "Specific, actionable fix steps"
    },
    "effort": {
      "type": "string",
      "enum": ["XS", "S", "M", "L", "XL"],
      "description": "Estimated effort to fix"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "How confident the assessor is (0.0-1.0)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Categorization tags (e.g., ['n+1', 'orm', 'postgresql'])"
    },
    "relatedFindings": {
      "type": "array",
      "items": { "type": "string" },
      "description": "IDs of related findings for dependency mapping"
    },
    "evidence": {
      "type": "object",
      "properties": {
        "snippet": { "type": "string", "description": "Code/config snippet showing the issue" },
        "metric": { "type": "number", "description": "Quantitative metric (e.g., complexity score)" },
        "benchmark": { "type": "string", "description": "Benchmark result if applicable" }
      }
    }
  }
}
```

### 3.2 Skill Template (`templates/SKILL_TEMPLATE.md`)

```markdown
---
name: {skill-name}
description: {one-line description of what this skill teaches an LLM to do}
version: 1.0
module: {database|code|structure|flows|security|cost|performance|github}
llmCapabilities:
  - {capability 1}
  - {capability 2}
inputs:
  - {input type 1}
  - {input type 2}
outputs:
  - findings[] (per templates/finding-schema.json)
  - {other output}
mcpDependencies:
  - {mcp-name}
decisionTrees:
  - {decision tree name}
---

# {Skill Name}

{Brief purpose statement}

## When to Use This Skill

{Conditions that should trigger this skill}

## Inputs

{What the LLM needs to gather before using this skill}

## Analysis Procedure

### Step 1: {Step Name}
{Decision tree or detailed procedure}

### Step 2: {Step Name}
...

## Decision Trees

### {Decision Tree Name}
```markdown
1. IF {condition} → FINDING: {finding-id} (severity: {severity})
2. IF {condition} → FINDING: {finding-id} (severity: {severity})
...
```

## Output Format

{How findings should be structured - MUST conform to finding-schema.json}

## Examples

### Example 1: {Scenario}
**Input**: {what LLM sees}
**Analysis**: {step-by-step}
**Output**: {JSON finding}

## Extensibility

{How community can add rules/patterns}
```

### 3.3 Agent Template (`agents/{name}.md`)

```markdown
---
name: {agent-name}
role: {one-line role description}
skills:
  - {skill-file}
mcpServers:
  - {mcp-name}
workflow:
  - step 1
  - step 2
output:
  - findings[] (per finding-schema.json)
  - {other outputs}
---

# {Agent Name}

## Role
{What this agent does}

## Workflow

### 1. {Step}
{Instructions for LLM}

### 2. {Step}
...

## Output Requirements

{Format and content expectations}
```

---

## 4. Skill Specifications (Detailed)

### 4.1 `github-intelligence.skill.md`

**Module**: `github`  
**MCP Dependencies**: `github-mcp`, `filesystem-mcp`, `git-mcp`

**LLM Capabilities Taught**:
- Tech stack inference from files
- Commit history analysis (frequency, refactor ratio)
- Issue/PR health metrics
- Stakeholder mapping
- Log pattern mining

**Decision Trees**:

```markdown
## Tech Stack Inference
1. IF package.json exists → Node.js project
   - IF express in deps → Express
   - IF next in deps → Next.js
   - IF nest in deps → NestJS
2. IF requirements.txt/pyproject.toml → Python
   - IF django → Django
   - IF fastapi → FastAPI
3. IF pom.xml/build.gradle → Java (Maven/Gradle)
4. IF go.mod → Go
5. IF Cargo.toml → Rust
6. IF composer.json → PHP
7. IF Dockerfile → Containerized
8. IF .github/workflows → CI/CD via GitHub Actions

## Commit History Analysis
1. IF commits/week < 2 → stale project
2. IF refactor commits > 30% of total → active refactoring
3. IF merge commits > 50% → heavy branching strategy
4. IF commit messages follow conventional commits → good hygiene

## Issue/PR Health
1. IF median time to first response > 72h → slow triage
2. IF issue closure rate < 50% → backlog growing
3. IF PR review depth < 2 comments → shallow reviews
4. IF stale issues > 30% → poor maintenance
```

**Outputs**:
- `project-profile.json` (tech stack, maturity, stakeholders, pain points)
- `findings[]` (github-* severity findings)

---

### 4.2 `database-assessment.skill.md`

**Module**: `database`  
**MCP Dependencies**: `filesystem-mcp`, `git-mcp`

**LLM Capabilities Taught**:
- Schema analysis (SQL, Prisma, Django, Mongoose, TypeORM)
- Migration health evaluation
- Query anti-pattern detection
- Scalability signal identification

**Decision Trees**:

```markdown
## Missing Index Detection (PostgreSQL/Supabase Focus)
1. IF foreign_key_column AND NOT index_exists(fk_column) 
   → FINDING: database-missing-index-fk-1 (severity: high, effort: S)
   - Evidence: "Column user_id in orders table has FK but no index"
2. IF join_column_in_slow_query_log AND NOT index_exists(join_column)
   → FINDING: database-missing-index-hot-path-2 (severity: medium, effort: S)
3. IF table_rows > 1_000_000 AND seq_scan_in_explain_plan
   → FINDING: database-full-table-scan-3 (severity: critical, effort: M)

## Irreversible Migration Detection
1. IF migration_drops_column AND NOT has_rollback
   → FINDING: database-irreversible-migration-1 (severity: critical, effort: L)
2. IF migration_renames_table AND NOT has_rollback
   → FINDING: database-irreversible-migration-2 (severity: high, effort: L)
3. IF migration_changes_column_type AND data_loss_possible AND NOT has_rollback
   → FINDING: database-risky-migration-3 (severity: high, effort: M)

## N+1 Query Risk
1. IF orm_loop_detected AND relation_not_eager_loaded
   → FINDING: database-n-plus-one-risk-1 (severity: high, effort: M)
   - Evidence: "User.orders accessed in loop without include/join"
2. IF query_count_in_logs > 100_per_request AND same_table
   → FINDING: database-n-plus-one-confirmed-2 (severity: critical, effort: M)

## Connection Pool Misconfiguration
1. IF pool_size > cpu_cores * 4
   → FINDING: database-oversized-pool-1 (severity: medium, effort: XS)
2. IF pool_size < 2 AND concurrent_requests > 10
   → FINDING: database-undersized-pool-2 (severity: high, effort: XS)
```

**PostgreSQL-Specific Rules** (Supabase focus):
- Check for `pg_stat_statements` enablement
- Verify `work_mem` / `maintenance_work_mem` settings
- Detect missing `pg_bloat` monitoring
- Check for unused indexes (`idx_scan = 0`)

---

### 4.3 `code-quality-assessment.skill.md`

**Module**: `code`  
**MCP Dependencies**: `filesystem-mcp`, `git-mcp`

**LLM Capabilities Taught**:
- Complexity metrics (cyclomatic, nesting, function length)
- Duplication detection
- Error handling anti-patterns
- Language-specific rulesets

**Decision Trees**:

```markdown
## Complexity Thresholds (Per Function)
1. IF cyclomatic_complexity > 15 → FINDING: code-high-complexity-1 (severity: high, effort: M)
2. IF cyclomatic_complexity > 10 → FINDING: code-moderate-complexity-2 (severity: medium, effort: S)
3. IF nesting_depth > 4 → FINDING: code-deep-nesting-3 (severity: medium, effort: S)
4. IF function_lines > 100 → FINDING: code-long-function-4 (severity: medium, effort: M)
5. IF parameter_count > 5 → FINDING: code-too-many-params-5 (severity: low, effort: S)

## Duplication Detection
1. IF exact_duplicate_lines > 20 IN different_files
   → FINDING: code-exact-duplication-1 (severity: medium, effort: M)
2. IF structural_similarity > 0.8 AND different_names
   → FINDING: code-structural-duplication-2 (severity: low, effort: M)

## Error Handling Anti-Patterns
1. IF empty_catch_block
   → FINDING: code-empty-catch-1 (severity: high, effort: XS)
2. IF catch_generic_exception AND NOT rethrow
   → FINDING: code-generic-catch-2 (severity: medium, effort: S)
3. IF no_validation_at_api_boundary
   → FINDING: code-missing-validation-3 (severity: high, effort: M)

## Language-Specific Rules

### TypeScript/JavaScript
1. IF `==` used instead of `===` → FINDING: code-loose-equality-1 (severity: low, effort: XS)
2. IF `var` used → FINDING: code-var-usage-2 (severity: low, effort: XS)
3. IF promise_not_awaited AND not_fire_and_forget → FINDING: code-unhandled-promise-3 (severity: high, effort: S)
4. IF `any` type in public API → FINDING: code-any-type-4 (severity: medium, effort: S)

### Python
1. IF `except:` bare → FINDING: code-bare-except-1 (severity: high, effort: XS)
2. IF mutable_default_argument → FINDING: code-mutable-default-2 (severity: high, effort: XS)
3. IF sql_string_concatenation → FINDING: code-sql-injection-risk-3 (severity: critical, effort: S)
4. IF `print` in production code → FINDING: code-print-statement-4 (severity: low, effort: XS)

### Go
1. IF error_not_checked → FINDING: code-unchecked-error-1 (severity: high, effort: S)
2. IF `interface{}` in public API → FINDING: code-empty-interface-2 (severity: medium, effort: S)
```

---

### 4.4 `structure-assessment.skill.md`

**Module**: `structure`  
**MCP Dependencies**: `filesystem-mcp`, `git-mcp`

**LLM Capabilities Taught**:
- Coupling/cohesion metrics
- Dependency cycle detection
- Architectural violation identification
- Pattern adherence verification

**Decision Trees**:

```markdown
## Coupling Analysis
1. IF afferent_coupling > 20 AND efferent_coupling > 20
   → FINDING: structure-high-coupling-1 (severity: high, effort: L)
   - "Module is both heavily depended on and depends heavily on others"
2. IF instability_index > 0.8
   → FINDING: structure-unstable-module-2 (severity: medium, effort: M)

## Dependency Cycles
1. IF import_cycle_detected BETWEEN modules
   → FINDING: structure-dependency-cycle-1 (severity: critical, effort: L)
   - Evidence: "Module A → B → C → A"

## Layer Violations
1. IF controller_imports_repository_directly
   → FINDING: structure-layer-violation-1 (severity: high, effort: M)
2. IF service_imports_controller
   → FINDING: structure-inverted-dependency-2 (severity: high, effort: M)
3. IF domain_entity_exports_framework_types
   → FINDING: structure-framework-leak-3 (severity: medium, effort: M)

## Pattern Adherence
1. IF repository_pattern_claimed BUT repository_accesses_multiple_aggregates
   → FINDING: structure-repository-violation-1 (severity: medium, effort: M)
2. IF factory_pattern_claimed BUT constructor_public
   → FINDING: structure-factory-violation-2 (severity: low, effort: XS)
```

---

### 4.5 `flows-assessment.skill.md`

**Module**: `flows`  
**MCP Dependencies**: `filesystem-mcp`, `github-mcp`

**LLM Capabilities Taught**:
- Request flow analysis (middleware, auth, validation)
- Async processing evaluation
- Event/message flow analysis
- Orchestration health (n8n, Airflow, Temporal, custom)

**Decision Trees**:

```markdown
## Request Flow
1. IF auth_middleware_after_validation
   → FINDING: flows-auth-order-1 (severity: high, effort: S)
2. IF validation_in_controller_NOT_middleware
   → FINDING: flows-validation-placement-2 (severity: medium, effort: S)
3. IF response_transformation_inconsistent
   → FINDING: flows-inconsistent-response-3 (severity: low, effort: M)

## Async Processing
1. IF fire_and_forget_used_for_critical_operation
   → FINDING: flows-fire-and-forget-critical-1 (severity: critical, effort: M)
2. IF no_dead_letter_queue_for_async
   → FINDING: flows-missing-dlq-2 (severity: high, effort: M)
3. IF no_idempotency_key_for_payment
   → FINDING: flows-missing-idempotency-3 (severity: critical, effort: S)
4. IF retry_without_backoff
   → FINDING: flows-retry-no-backoff-4 (severity: medium, effort: XS)

## Orchestration (n8n Specific)
1. IF n8n_workflow_has_no_error_trigger
   → FINDING: flows-n8n-no-error-handling-1 (severity: high, effort: S)
2. IF n8n_code_node_returns_wrong_format
   → FINDING: flows-n8n-code-node-format-2 (severity: high, effort: XS)
3. IF n8n_schedule_trigger_interval_not_array
   → FINDING: flows-n8n-schedule-format-3 (severity: medium, effort: XS)
```

---

### 4.6 `security-assessment.skill.md`

**Module**: `security`  
**MCP Dependencies**: `github-mcp`, `filesystem-mcp`, `git-mcp`

**LLM Capabilities Taught**:
- Secret detection (code + history)
- Dependency vulnerability scanning
- GitHub Actions security audit
- Configuration security review

**Decision Trees**:

```markdown
## Secret Detection
1. IF api_key_pattern IN committed_files
   → FINDING: security-secret-in-code-1 (severity: critical, effort: XS)
2. IF secret_in_git_history (trufflehog/gitleaks patterns)
   → FINDING: security-secret-in-history-2 (severity: critical, effort: S)
3. IF .env_committed
   → FINDING: security-env-file-committed-3 (severity: high, effort: XS)

## Dependency Vulnerabilities
1. IF CVE_critical_in_prod_dependency
   → FINDING: security-cve-critical-1 (severity: critical, effort: S)
2. IF CVE_high_in_prod_dependency
   → FINDING: security-cve-high-2 (severity: high, effort: S)
3. IF unmaintained_dependency > 2_years
   → FINDING: security-unmaintained-dep-3 (severity: medium, effort: M)

## GitHub Actions Security
1. IF workflow_uses_pull_request_target_with_checkout
   → FINDING: security-gha-pr-target-risk-1 (severity: critical, effort: S)
3. IF workflow_permissions_not_restricted
   → FINDING: security-gha-overpermissive-2 (severity: high, effort: XS)
4. IF secret_used_in_log_output
   → FINDING: security-gha-secret-leak-3 (severity: critical, effort: XS)

## Configuration Security
1. IF debug_mode_enabled_in_prod
   → FINDING: security-debug-in-prod-1 (severity: high, effort: XS)
2. IF cors_allows_all_origins
   → FINDING: security-cors-wildcard-2 (severity: medium, effort: XS)
3. IF jwt_secret_default_or_short
   → FINDING: security-jwt-weak-3 (severity: critical, effort: S)
```

---

### 4.7 `cost-analysis.skill.md`

**Module**: `cost`  
**MCP Dependencies**: `github-mcp`, `filesystem-mcp`

**LLM Capabilities Taught**:
- GitHub Actions cost estimation
- Third-party API cost analysis
- Infrastructure cost signals
- Optimization ROI calculation

**Decision Trees**:

```markdown
## GitHub Actions Cost
1. IF actions_minutes_month > 50_000 (private repo)
   → FINDING: cost-gha-high-usage-1 (severity: medium, effort: M)
   - Remediation: "Self-hosted runners save ~$0.008/min"
2. IF workflow_runs_daily > 100 AND many_failures
   → FINDING: cost-gha-wasteful-retries-2 (severity: medium, effort: S)

## Third-Party API Costs
1. IF openai_calls_estimated > 1M_tokens_month
   → FINDING: cost-llm-high-usage-1 (severity: medium, effort: M)
   - Remediation: "Implement caching, use smaller models for simple tasks"
2. IF external_api_calls_in_loop
   → FINDING: cost-api-in-loop-2 (severity: high, effort: M)

## Infrastructure Signals
1. IF k8s_requests >> limits consistently
   → FINDING: cost-overprovisioned-k8s-1 (severity: medium, effort: M)
2. IF database_storage_growing_rapidly_without_archival
   → FINDING: cost-db-growth-2 (severity: medium, effort: M)
3. IF cdn_not_used_for_static_assets
   → FINDING: cost-missing-cdn-3 (severity: low, effort: S)
```

---

### 4.8 `performance-assessment.skill.md`

**Module**: `performance`  
**MCP Dependencies**: `benchmark-mcp`, `filesystem-mcp`, `github-mcp`

**LLM Capabilities Taught**:
- Bottleneck identification from profiles/benchmarks
- Goal-based optimization (latency/throughput/cost)
- Best practice application
- Capacity planning guidance

**Decision Trees**:

```markdown
## Bottleneck Identification
1. IF cpu_profile_shows >50% IN single_function
   → FINDING: performance-cpu-hotspot-1 (severity: high, effort: M)
2. IF memory_profile_shows_leak (growth_without_gc_relief)
   → FINDING: performance-memory-leak-2 (severity: critical, effort: L)
3. IF gc_pause_time > 100ms AND frequent
   → FINDING: performance-gc-pressure-3 (severity: high, effort: M)
4. IF lock_contention > 20%_thread_time
   → FINDING: performance-lock-contention-4 (severity: high, effort: M)
5. IF db_query_time > 50%_request_latency
   → FINDING: performance-db-bottleneck-5 (severity: high, effort: M)

## Goal-Based Optimization

### Latency-Sensitive Systems (API, Real-time)
1. IF p99_latency > SLA_target
   → RECOMMEND: "Add read-through cache for {hot_path}"
   → RECOMMEND: "Move {non_critical} to async processing"
   → RECOMMEND: "Implement circuit breaker for {external_calls}"
2. IF critical_path_length > 3_services
   → FINDING: performance-long-critical-path-1 (severity: high, effort: L)

### Throughput-Oriented Systems (Batch, ETL)
1. IF throughput < target_rps
   → RECOMMEND: "Batch {operations} (current: 1, suggested: 100)"
   → RECOMMEND: "Increase worker pool to {cpu_cores * 2}"
   → RECOMMEND: "Evaluate queue depth and consumer scaling"
2. IF serialization_overhead > 30%_cpu
   → FINDING: performance-serialization-overhead-1 (severity: medium, effort: M)

### Cost-Optimized Systems
1. IF cpu_utilization < 20% sustained
   → FINDING: cost-underutilized-compute-1 (severity: low, effort: S)
2. IF spot_instance_eligible_workloads_on_demand
   → FINDING: cost-spot-eligible-2 (severity: low, effort: M)

## Quick Baseline Protocol (If No Benchmarks Exist)
1. RUN benchmark-mcp.measure_latency on 3 critical endpoints (50 req each)
2. RUN benchmark-mcp.measure_throughput for 30s at 50% expected load
3. RUN benchmark-mcp.analyze_resource_usage during above
4. STORE as `.dontkillthevibes/baseline-{timestamp}.json`
5. ALL findings reference this baseline
```

---

## 5. MCP Specifications (Detailed)

### 5.1 Common MCP Requirements (All)

**Security Model** (mandatory in each `SECURITY.md`):
- Path allowlisting: Only operate under `process.cwd()` or explicit `--workspace` flag
- Command allowlisting: Only pre-approved binaries (no shell execution)
- Resource limits: Timeout 30s default, memory 512MB, CPU quota
- Audit logging: Every call logged to `.dontkillthevibes/audit.log` with timestamp, tool, args hash, result hash
- No network calls except explicitly documented (GitHub MCP → api.github.com only)

**Error Handling**:
- All tools return `{ success: boolean, data?: any, error?: { code: string, message: string } }`
- Never throw; always return error object
- Include `retryable: boolean` for transient errors

**Protocol**: MCP stdio transport (JSON-RPC 2.0)

### 5.2 `github-mcp`

**Tools**:

| Tool | Parameters | Returns |
|------|------------|---------|
| `get_repo_contents` | `{ owner, repo, path?, ref? }` | `{ files: [{ path, type, size, sha }] }` |
| `get_commit_history` | `{ owner, repo, since?, until?, path?, per_page? }` | `{ commits: [{ sha, message, author, date, stats }] }` |
| `get_issues` | `{ owner, repo, state?, labels?, since?, per_page? }` | `{ issues: [{ number, title, state, labels, created, closed, comments }] }` |
| `get_workflow_runs` | `{ owner, repo, workflow_id?, status?, per_page? }` | `{ runs: [{ id, name, status, conclusion, timing, jobs }] }` |
| `get_secrets_status` | `{ owner, repo }` | `{ secrets: [{ name, created, updated }], dependabot_alerts: [] }` |
| `get_dependency_graph` | `{ owner, repo }` | `{ dependencies: [{ name, version, vulnerabilities: [] }] }` |

**Auth**: `GITHUB_TOKEN` env var (required for private repos, optional for public). Validate scopes on startup.

**Rate Limiting**: Respect `x-ratelimit-remaining`; implement exponential backoff.

### 5.3 `filesystem-mcp`

**Tools**:

| Tool | Parameters | Returns |
|------|------------|---------|
| `read_file` | `{ path, encoding?, max_bytes? }` | `{ content, size, encoding }` |
| `glob_search` | `{ pattern, ignore?, max_results? }` | `{ matches: [{ path, size, mtime }] }` |
| `parse_log_file` | `{ path, format?: json|text|csv, since?, until? }` | `{ entries: [{ timestamp, level, message, ... }] }` |
| `get_file_metadata` | `{ path }` | `{ size, mtime, ctime, is_directory, permissions }` |

**Path Guard**: All paths resolved relative to workspace root; reject `..` traversal.

**Log Parsers**: Handle JSON lines, common log format, CSV with headers.

### 5.4 `git-mcp`

**Tools**:

| Tool | Parameters | Returns |
|------|------------|---------|
| `get_blame` | `{ file, start_line?, end_line? }` | `{ lines: [{ line, commit, author, date, content }] }` |
| `get_diff_since` | `{ since_commit, paths? }` | `{ files: [{ path, additions, deletions, diff }] }` |
| `get_branch_tree` | `{ max_depth? }` | `{ branches: [{ name, commit, ahead, behind }] }` |
| `find_large_files` | `{ size_threshold_mb? }` | `{ files: [{ path, size_mb, commit }] }` |

### 5.5 `benchmark-mcp`

**Tools**:

| Tool | Parameters | Returns |
|------|------------|---------|
| `run_benchmark` | `{ template: wrk|k6|jmeter, target_url, duration_sec?, connections?, script? }` | `{ results: { latency_p50, p95, p99, throughput, errors } }` |
| `profile_code` | `{ command, profiler: perf|vtune|jfr|cprofile, duration_sec? }` | `{ profile_path, summary: { hot_functions: [] } }` |
| `measure_latency` | `{ url, method?, headers?, body?, samples? }` | `{ p50, p95, p99, min, max, errors }` |
| `measure_throughput` | `{ url, duration_sec, concurrency, method?, headers?, body? }` | `{ rps, latency_p50, p95, p99, errors }` |
| `analyze_resource_usage` | `{ pid?, duration_sec?, interval_ms? }` | `{ cpu_percent, memory_mb, disk_io, network_io, timestamps }` |
| `compare_benchmarks` | `{ baseline_path, current_path }` | `{ regressions: [], improvements: [], summary }` |
| `suggest_load_test` | `{ traffic_pattern: steady|spike|ramp, endpoints: [] }` | `{ k6_script, wrk_script }` |
| `identify_resource_contention` | `{ profile_path }` | `{ lock_contention: [], gc_pauses: [], thread_starvation: [] }` |

**Sandbox**: 
- Run benchmarks in isolated temp directory
- No network access except to `target_url`
- Kill process on timeout
- Capture stdout/stderr for debugging

---

## 6. Agent Specifications (Detailed)

### 6.1 Specialist Agents (8)

Each agent file follows the template with:
- Exact skill and MCP list
- Step-by-step workflow
- Output format requirements

**Example: `database-analyst.md`**

```markdown
---
name: Database Analyst
role: Analyze database schema, migrations, and query patterns for correctness, performance, and scalability
skills:
  - database-assessment.skill.md
mcpServers:
  - filesystem-mcp
  - git-mcp
workflow:
  1. Use filesystem-mcp to discover schema files (.sql, prisma, models)
  2. Use git-mcp to get migration history
  3. Apply database-assessment.skill decision trees
  4. If query logs available, use filesystem-mcp.parse_log_file
  5. Emit findings[] per finding-schema.json
output:
  - findings[] (module: "database")
  - schema-summary.json (tables, relationships, indexes)
---

# Database Analyst

## Workflow Details

### 1. Schema Discovery
Use filesystem-mcp.glob_search for:
- `**/*.sql`
- `**/schema.prisma`
- `**/models/*.py` (Django)
- `**/entities/*.ts` (TypeORM)
- `**/models/*.js` (Mongoose)

### 2. Migration Analysis
Use git-mcp.get_diff_since to analyze migration files for irreversible changes.

### 3. Assessment Execution
Apply each decision tree from database-assessment.skill.md systematically.

### 4. Output
Emit findings array. Include schema-summary.json with:
{
  "tables": [{"name", "columns", "indexes", "foreign_keys"}],
  "relationships": [{"from", "to", "type"}],
  "migrations_count": number,
  "risky_migrations": []
}
```

---

### 6.2 `synthesis-agent.md` (Critical)

```markdown
---
name: Synthesis Agent
role: Orchestrate all specialist agents, prioritize findings, generate actionable work plan
skills:
  - (none - uses native LLM reasoning)
mcpServers: []
workflow:
  1. Invoke each specialist agent in parallel
  2. Collect all findings[]
  3. Apply prioritization algorithm
  4. Map dependencies between findings
  5. Estimate effort and sequence
  6. Generate Markdown report + JSON summary
output:
  - assessment-report.md (human-readable)
  - assessment.json (machine-readable)
---

# Synthesis Agent

## Prioritization Algorithm

### Severity Weight
critical: 100, high: 50, medium: 20, low: 5, info: 1

### Module Weight (business impact)
security: 1.5, database: 1.3, performance: 1.2, structure: 1.1, flows: 1.0, code: 1.0, cost: 0.8, github: 0.7

### Confidence Multiplier
confidence (0.0-1.0) multiplies final score

### Priority Score = severity_weight * module_weight * confidence

### Dependency Mapping Rules
1. Database findings → block dependent Code/Performance findings
2. Structure findings → block dependent Flows findings
3. Security findings → always highest priority regardless of score
4. GitHub intelligence findings → inform context but rarely block

## Work Plan Generation

### Output: assessment-report.md
```
# Assessment Report: {repo-name}

## Executive Summary
- **Overall Health**: {grade A-F}
- **Critical Findings**: {count}
- **Estimated Total Effort**: {XS-XL breakdown}
- **Top 3 Priorities**: {finding IDs}

## Detailed Findings (by Priority)
### Priority 1: {finding-id}
**Module**: {module} | **Severity**: {severity} | **Effort**: {effort}
**Location**: {file}:{line}
**Description**: {description}
**Remediation**: {remediation}
**Evidence**: {snippet/metric}
**Depends On**: {finding IDs}
**Blocks**: {finding IDs}

...

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- {finding-id}: {remediation} (effort: XS/S)

### 60 Days (Core Fixes)
- {finding-id}: {remediation} (effort: M)

### 90 Days (Strategic)
- {finding-id}: {remediation} (effort: L/XL)

## Appendix
- All findings in JSON: assessment.json
- Methodology: dontkillthevibes toolkit v{version}
```

### Output: assessment.json
```json
{
  "metadata": {
    "repo": "owner/repo",
    "assessed_at": "ISO8601",
    "toolkit_version": "0.1.0",
    "llm_used": "model-name"
  },
  "summary": {
    "total_findings": 42,
    "by_severity": { "critical": 3, "high": 8, "medium": 15, "low": 12, "info": 4 },
    "by_module": { "database": 5, "code": 12, ... },
    "effort_estimate": { "XS": 8, "S": 12, "M": 10, "L": 8, "XL": 4 }
  },
  "findings": [...], // Full finding objects
  "work_plan": {
    "phases": [
      { "name": "30 Days", "findings": ["id1", "id2"], "total_effort": "S" },
      { "name": "60 Days", "findings": ["id3"], "total_effort": "M" },
      { "name": "90 Days", "findings": ["id4"], "total_effort": "L" }
    ],
    "dependencies": { "id3": ["id1"], "id4": ["id2", "id3"] }
  }
}
```

---

## 7. Security Implementation Checklist (Per MCP)

Each MCP must implement and document:

```markdown
# {mcp-name} Security Model

## Threat Model
- **Asset**: User's codebase, GitHub tokens, local files
- **Threat**: Malicious skill prompting MCP to exfiltrate data or execute commands
- **Attack Vector**: Prompt injection via skill instructions

## Controls Implemented
1. **Path Allowlisting**: All file operations restricted to workspace root
2. **Command Allowlisting**: Only approved binaries (no shell)
3. **Resource Limits**: Timeout 30s, Memory 512MB, CPU 50%
4. **Audit Logging**: All invocations logged with hash of args/result
5. **No Persistent State**: No data retained between invocations
6. **Token Handling**: GitHub token never logged, validated for minimal scopes

## Validation
- Run `npm run security:audit` before release
- Penetration test via simulated prompt injection
```

---

## 8. Validation & Testing Requirements

### 8.1 Unit Tests (Per MCP)
- Each tool: 5+ test cases (happy path, edge cases, errors)
- Mock external dependencies (GitHub API, git commands)
- Coverage target: >80%

### 8.2 Integration Tests
- `scripts/run-integration-tests.ts` runs:
  1. Clone test fixture repo
  2. Load all skills into test LLM (mock)
  3. Run full assessment pipeline
  4. Validate outputs against `examples/sample-assessment/expected-findings.json`
  5. Check schema compliance for all findings

### 8.3 Adversarial Test Fixture
Create `examples/sample-assessment/repo-with-issues/` containing:
- Hardcoded secrets in code AND git history
- N+1 query patterns in ORM usage
- Dependency cycle between modules
- GitHub Actions with `pull_request_target` vulnerability
- Memory leak in Node.js endpoint
- Missing indexes on FK columns
- Empty catch blocks
- Overprovisioned k8s resources
- No idempotency on payment endpoint
- 500+ line function with cyclomatic complexity 25

**Expected**: All findings detected with correct severity/module.

### 8.4 Skill Validation Script
`scripts/validate-skills.ts`:
- Verify all skills have required frontmatter fields
- Verify decision trees use valid finding IDs
- Verify output examples conform to finding-schema.json
- Check for broken internal links

---

## 9. Documentation Requirements

### 9.1 `README.md` Must Include
- Toolkit overview + philosophy
- **30-Second Start** (Claude Code, Gemini, custom agent)
- Architecture diagram (Mermaid)
- Skill/MCPs/Agents catalog
- Security model summary
- Contribution guide link
- License badge

### 9.2 `CONTRIBUTING.md`
- Skill contribution process (fork → add skill → PR with test fixture)
- MCP contribution process
- Code style (ESLint + Prettier configs)
- Commit message convention (Conventional Commits)
- Review checklist

### 9.3 `docs/architecture.md`
- System diagram
- Data flow (LLM → skills → MCPs → findings → synthesis)
- Extension points
- Versioning strategy

---

## 10. CI/CD Pipeline (`.github/workflows/`)

### `test-skills.yml`
```yaml
on: [push, pull_request]
jobs:
  validate-skills:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx ts-node scripts/validate-skills.ts
```

### `test-mcps.yml`
```yaml
on: [push, pull_request]
jobs:
  test-mcps:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        mcp: [github-mcp, filesystem-mcp, git-mcp, benchmark-mcp]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd mcps/${{ matrix.mcp }} && npm ci && npm test
```

### `release.yml`
```yaml
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', registry-url: 'https://registry.npmjs.org' }
      - run: npm ci && npm run build:all
      - run: npm publish --access public
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
      - uses: softprops/action-gh-release@v1
        with: { generate_release_notes: true }
```

---

## 11. Build Agent Execution Order

### Phase 1: Foundation (Day 1)
1. Create exact directory structure
2. Write `templates/finding-schema.json`
3. Write `templates/security-model.md`
4. Write `templates/SKILL_TEMPLATE.md`
5. Write `templates/MCP_TEMPLATE.md`
6. Initialize `package.json` with workspaces for MCPs
7. Create base `tsconfig.base.json`

### Phase 2: Skills (Days 2-4)
For each of 8 skills (in order):
1. Write skill file using template
2. Embed all decision trees from spec
3. Include 3+ examples per skill
4. Validate against `finding-schema.json`

### Phase 3: MCPs (Days 5-8)
For each MCP:
1. Initialize Node.js project with TypeScript
2. Implement tools per spec
3. Implement security controls (path guard, sandbox, audit log)
4. Write unit tests (5+ per tool)
5. Write README.md + SECURITY.md
6. Build to `dist/`

### Phase 4: Agents (Day 9)
1. Write 9 agent definition files
2. Ensure synthesis-agent.md has exact prioritization algorithm

### Phase 5: Validation & Examples (Days 10-11)
1. Create test fixture repo with all adversarial issues
2. Write integration test script
3. Run full pipeline, capture outputs
4. Create example assessment reports
5. Write `examples/claude-code-session.md` transcript

### Phase 6: Documentation & Release Prep (Day 12)
1. Write all documentation files
2. Create `.github/` templates
3. Create CI/CD workflows
4. Final validation run

### Phase 7: Release (Day 13)
1. Tag `v0.1.0-beta`
2. Publish to GitHub
3. Announce in communities

---

## 12. Quality Gates (Must Pass Before Release)

| Gate | Criteria |
|------|----------|
| **Schema Compliance** | 100% of skill outputs validate against `finding-schema.json` |
| **Security Audit** | All MCPs pass `npm run security:audit` |
| **Test Coverage** | >80% for MCP code; all skills have 3+ examples |
| **Adversarial Detection** | Test fixture yields all expected findings with correct severity |
| **Documentation Complete** | All MCPs have README+SECURITY; all skills have decision trees |
| **Cross-LLM Test** | At least 2 LLM systems (Claude Code + Gemini) can run full assessment |

---

## 13. Post-Release Roadmap (Not in Build Scope)

- Community skill registry
- Web UI for viewing assessments
- GitHub Action for automated PR assessments
- VS Code extension
- `dontkillthevibes assess` CLI wrapper (optional)

---

## 14. Handoff Notes for Build Agent

1. **Start with Phase 1 exactly** - directory structure and templates are foundational
2. **Skills before MCPs** - skills define what MCPs need to provide
3. **Security first in MCPs** - implement path guards/sandboxing before features
4. **Test fixture early** - build `examples/sample-assessment/repo-with-issues/` in Phase 2 to validate skills as you write them
5. **Synthesis agent last** - depends on all specialist agents' output formats
6. **Document as you go** - each skill/MCP/agent needs its README/SECURITY.md
7. **Version from start** - tag `v0.1.0-beta` on first complete pipeline run

---

## 15. Contact & Escalation

- **Architect**: Jacobo Prudot (Jaco) - `jaco@leongael.xyz`
- **Scope Questions**: Refer to this document; if ambiguous, choose the option that maximizes vibe coder adoption
- **Security Concerns**: Stop and escalate immediately
- **Performance Issues**: Profile before optimizing; benchmark-mcp dogfooding encouraged

---

**End of Build Plan**. This document is the single source of truth for implementation. Any deviation requires architect approval.