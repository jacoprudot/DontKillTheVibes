# Assessment Report: ai-job-agent

- **Repository**: ai-job-agent
- **Date**: 2026-10-05T20:45:41.133Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 12
- **By Severity**: high 1 · medium 9 · low 2
- **Estimated Total Effort**: 1×XS, 2×S, 9×M
- **Top 3 Priorities**:
  - `security-gha-overpermissive-2` — The workflow does not declare a top-level `permissions:` block, so every job inherits the repository default token scope (historically… (high, XS)
  - `security-gha-job-no-timeout-7` — None of the three jobs (smoke, lint, skill-files) declare timeout-minutes, so a hung npm install or shellcheck apt-get can occupy a runner… (medium, M)
  - `cost-gha-no-timeout-9` — Jobs lack a timeout-minutes setting, so a stuck npm install or shellcheck apt-get can burn the full 360-minute default runner allocation… (medium, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.8
**Location**: `.github/workflows/test.yml:1`
**Description**: The workflow does not declare a top-level `permissions:` block, so every job inherits the repository default token scope (historically read-write for all scopes), violating least privilege for a read-only CI pipeline.
**Remediation**: Add a top-level `permissions: contents: read` block (and per-job overrides only where needed) to restrict the GITHUB_TOKEN to the minimum required scope.
**Evidence**:
```
name: smoke + lint

on:
  push:
    branches: [main]
```
**Depends On**: `security-gha-action-unpinned-5` | **Blocks**: None

### Priority 2: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `.github/workflows/test.yml:9`
**Description**: None of the three jobs (smoke, lint, skill-files) declare timeout-minutes, so a hung npm install or shellcheck apt-get can occupy a runner for the default 360 minutes.
**Remediation**: Add `timeout-minutes: 15` (or an appropriate value) to each job definition in the workflow.
**Evidence**:
```
jobs:
  smoke:
    name: smoke test (sandboxed)
    runs-on: ubuntu-latest
    steps:
```
**Depends On**: `cost-gha-no-timeout-9` | **Blocks**: None

### Priority 3: `cost-gha-no-timeout-9`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/test.yml:9`
**Description**: Jobs lack a timeout-minutes setting, so a stuck npm install or shellcheck apt-get can burn the full 360-minute default runner allocation and inflate GitHub Actions minutes consumption.
**Remediation**: Set `timeout-minutes: 15` on each job to cap wasted runner minutes on hung steps.
**Evidence**:
```
jobs:
  smoke:
    name: smoke test (sandboxed)
    runs-on: ubuntu-latest
```
**Depends On**: None | **Blocks**: `security-gha-job-no-timeout-7`

### Priority 4: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `.github/workflows/test.yml:20`
**Description**: The smoke job runs `npm install --no-audit --no-fund` on every workflow execution without an actions/cache step, so node_modules is re-downloaded from the registry on every push and PR.
**Remediation**: Add an actions/cache step keyed on `${{ hashFiles('package-lock.json') }}` (or use actions/setup-node's built-in `cache: npm`) to reuse the npm cache between runs.
**Evidence**:
```
- name: Install dependencies
        run: npm install --no-audit --no-fund
```
**Depends On**: None | **Blocks**: None

### Priority 5: `cost-gha-wasteful-retries-3`
**Module**: cost | **Severity**: medium | **Effort**: S | **Confidence**: 0.75
**Location**: `.github/workflows/test.yml:44`
**Description**: The shellcheck step is marked `continue-on-error: true` and swallows failures with `|| true`, so lint regressions never fail the build and the job re-runs on every push without ever converging on a clean state.
**Remediation**: Remove `continue-on-error: true` and the trailing `|| true` once the existing shellcheck warnings are triaged, so the lint job actually gates merges and stops re-running against the same failures.
**Evidence**:
```
- name: ShellCheck (warn-only, doesn't fail build)
        continue-on-error: true
        run: |
          sudo apt-get update && sudo apt-get install -y shellcheck
          shellcheck bin/*.sh skills/install.sh || true
```
**Depends On**: `cost-gha-always-on-8` | **Blocks**: None

### Priority 6: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/test.yml:14`
**Description**: GitHub Actions are referenced by mutable tags (actions/checkout@v4, actions/setup-node@v4) rather than pinned to a full commit SHA, leaving the CI supply chain open to tag-mutation attacks.
**Remediation**: Pin each action to a full 40-character commit SHA (e.g. actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11) and use Dependabot to keep the pins updated.
**Evidence**:
```
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```
**Depends On**: None | **Blocks**: `security-gha-overpermissive-2`

### Priority 7: `security-gha-no-concurrency-prod-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/test.yml:4`
**Description**: The workflow triggers on every push to main without a `concurrency:` group, so rapid successive pushes can run overlapping smoke/lint jobs against the same branch and race on shared resources.
**Remediation**: Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` at the workflow level to serialize runs per ref.
**Evidence**:
```
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```
**Depends On**: None | **Blocks**: None

### Priority 8: `cost-gha-always-on-8`
**Module**: cost | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `.github/workflows/test.yml:4`
**Description**: The workflow runs on every push to main and every PR targeting main with no path filter, so documentation-only or config-only changes still trigger the full smoke + lint + skill-files matrix.
**Remediation**: Add a `paths:` filter (e.g. `paths: ['scripts/**', 'bin/**', 'skills/**', 'package.json', '.github/workflows/**']`) so doc-only commits skip the CI matrix.
**Evidence**:
```
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```
**Depends On**: None | **Blocks**: `cost-gha-wasteful-retries-3`

### Priority 9: `code-ignores-return-value-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `bin/job-agent.sh:47`
**Description**: The tmux split-window and select-pane calls in the already-inside-tmux branch are invoked without checking their exit status, so a failed split silently leaves the user without a dashboard pane.
**Remediation**: Check the return value of `tmux split-window` and `tmux select-pane` and print a diagnostic (or fall back to the two-tab path) when either fails.
**Evidence**:
```
tmux split-window -v -p 40 "$DASHBOARD_CMD"
  tmux select-pane -U
  exit 0
```
**Depends On**: None | **Blocks**: None

### Priority 10: `security-gha-no-container-8`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `.github/workflows/test.yml:11`
**Description**: Jobs run directly on the ubuntu-latest host runner rather than inside a container, so the smoke test's sandboxed-HOME install and the shellcheck apt-get install share the runner filesystem with any future untrusted step.
**Remediation**: Wrap each job in a `container:` directive (e.g. node:20-bookworm) so the job executes in an isolated filesystem and cannot persist state between jobs.
**Evidence**:
```
runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
```
**Depends On**: None | **Blocks**: None

### Priority 11: `security-gha-workspace-not-cleaned-6`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.55
**Location**: `.github/workflows/test.yml:24`
**Description**: The smoke job installs dependencies and runs install.sh against a sandboxed HOME but never cleans the workspace, so any secrets or artifacts written by the smoke test persist on the runner for the remainder of the job.
**Remediation**: Add a final `- name: Cleanup` step that removes the sandbox directory and any generated config, or run the smoke test inside a container job so the workspace is discarded automatically.
**Evidence**:
```
- name: Run smoke test
        run: npm run smoke
```
**Depends On**: None | **Blocks**: None

### Priority 12: `cost-gha-expensive-runner-4`
**Module**: cost | **Severity**: low | **Effort**: M | **Confidence**: 0.5
**Location**: `.github/workflows/test.yml:11`
**Description**: All three jobs run on ubuntu-latest GitHub-hosted runners even though the workload is a lightweight Node smoke test and a shellcheck pass, which could run on a smaller or self-hosted runner.
**Remediation**: Evaluate running the lint and skill-files jobs on a self-hosted runner or a smaller GitHub-hosted runner to reduce per-minute cost for this low-resource workload.
**Evidence**:
```
runs-on: ubuntu-latest
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-overpermissive-2`: Add a top-level `permissions: contents: read` block (and per-job overrides only where needed) to restrict the GITHUB_TOKEN to the minimum required scope. (XS)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 15` (or an appropriate value) to each job definition in the workflow. (M)
- `cost-gha-no-timeout-9`: Set `timeout-minutes: 15` on each job to cap wasted runner minutes on hung steps. (M)
- `cost-gha-no-dependency-cache-5`: Add an actions/cache step keyed on `${{ hashFiles('package-lock.json') }}` (or use actions/setup-node's built-in `cache: npm`) to reuse the npm cache between runs. (M)
- `cost-gha-wasteful-retries-3`: Remove `continue-on-error: true` and the trailing `|| true` once the existing shellcheck warnings are triaged, so the lint job actually gates merges and stops re-running against the same failures. (S)

### 60 Days
- `security-gha-action-unpinned-5`: Pin each action to a full 40-character commit SHA (e.g. (M)
- `security-gha-no-concurrency-prod-10`: Add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` at the workflow level to serialize runs per ref. (M)
- `cost-gha-always-on-8`: Add a `paths:` filter (e.g. (S)
- `code-ignores-return-value-6`: Check the return value of `tmux split-window` and `tmux select-pane` and print a diagnostic (or fall back to the two-tab path) when either fails. (M)

### 90 Days
- `security-gha-no-container-8`: Wrap each job in a `container:` directive (e.g. (M)
- `security-gha-workspace-not-cleaned-6`: Add a final `- name: Cleanup` step that removes the sandbox directory and any generated config, or run the smoke test inside a container job so the workspace is discarded automatically. (M)
- `cost-gha-expensive-runner-4`: Evaluate running the lint and skill-files jobs on a self-hosted runner or a smaller GitHub-hosted runner to reduce per-minute cost for this low-resource workload. (M)

---

## Dependencies
- `security-gha-overpermissive-2` **Depends On** `security-gha-action-unpinned-5` (blocks)
- `security-gha-job-no-timeout-7` **Depends On** `cost-gha-no-timeout-9` (blocks)
- `cost-gha-wasteful-retries-3` **Depends On** `cost-gha-always-on-8` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
