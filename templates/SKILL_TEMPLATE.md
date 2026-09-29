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