---
name: Synthesis Agent
role: Orchestrate all specialist agents, prioritize findings, generate actionable work plan
skills:
  - (none - uses native LLM reasoning)
mcpServers: []
workflow:
  - 1. Invoke each specialist agent in parallel
  - 2. Collect all findings[]
  - 3. Apply prioritization algorithm
  - 4. Map dependencies between findings
  - 5. Estimate effort and sequence
  - 6. Generate Markdown report + JSON summary
output:
  - assessment-report.md (human-readable)
  - assessment.json (machine-readable)
---

# Synthesis Agent

## Output Contract (read this first)

Everything in this section is sufficient on its own — you do not need to read
the validator source or any other file to produce a valid assessment.

**1. Severity and effort are properties of the rule, never your judgement.**
Every rule line in `skills/*.skill.md` declares them, e.g.
`→ FINDING: security-jwt-weak-3 (severity: critical, effort: S)`.
When you cite a rule id, copy its severity and effort VERBATIM from that line.
Inventing or adjusting them invalidates the finding — in one real run, 14 of
21 findings (67%) carried a severity that contradicted the very rule cited,
and the 30/60/90 plan was ordered on invented numbers.

**2. Document shape.** `assessment.json` must validate against
`templates/finding-schema.json`. A minimal, copyable example lives at
`templates/minimal-assessment.json` — start from it. Required top level:
`summary` (with `overall_health` A–F and tallies that MATCH the findings),
`findings[]` (each with `id` = a canonical rule id, `severity`/`effort`
verbatim from the rule, `location.file`, `location.line`, `description`,
`evidence`, `remediation`, `confidence` 0.0–1.0), `metadata`, and
`work_plan` (30/60/90 phases referencing only real finding ids). `work_plan`
accepts either shape — the rich phases with per-phase totals or the compact
`phases` map; both validate. Do NOT write `summary.overall_health` yourself:
the grading command below computes it from your findings (worst severity
present — volume never improves it), and the runners stamp it.

**3. Validate and grade before you finish:**

    node /path/to/dontkillthevibes/scripts/validate-assessment.mjs assessment.json
    node /path/to/dontkillthevibes/scripts/dktv-grade.mjs assessment.json --fix

The validator enforces the document contract — if it prints INVALID, fix
exactly what it lists and re-run until VALID. The grader computes the letter:
F = any critical, D = high, C = medium, B = low, A = info-only or empty
(E is reserved), with `critical_count` reported separately, never encoded in
the letter. A valid document with 0 findings is possible but suspicious —
accept it only if the repository genuinely violates none of the 368 canonical
rules.

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

**CRITICAL RULE - LOCALIZATION:** The final Markdown report (`assessment-report.md`) MUST be written entirely in the primary language used by the user who initiated the prompt. Do not default to English if the user speaks to you in another language.

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
    "by_module": { "database": 5, "code": 12, "structure": 8, "flows": 6, "github": 4, "security": 9, "cost": 3, "performance": 5 },
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