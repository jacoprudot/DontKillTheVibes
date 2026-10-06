# Assessment Report: rich

- **Repository**: rich
- **Date**: 2026-10-05T16:15:09.103Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 7
- **By Severity**: high 1 · medium 5 · low 1
- **Estimated Total Effort**: 1×XS, 1×S, 5×M
- **Top 3 Priorities**:
  - `security-gha-overpermissive-2` — The `add-comment` job declares `permissions: issues: write` but also performs `actions/checkout` and runs `pip install FAQtory` plus… (high, XS)
  - `cost-gha-no-dependency-cache-5` — The workflow runs `poetry install` on every matrix leg with no `actions/cache` step for the Poetry virtualenv or pip wheel cache. (medium, M)
  - `cost-gha-always-on-8` — The codespell workflow triggers on `[pull_request, push]` with no branch filter, so it runs on every push to every branch including… (low, S)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.7
**Location**: `.github/workflows/newissue.yml:6`
**Description**: The `add-comment` job declares `permissions: issues: write` but also performs `actions/checkout` and runs `pip install FAQtory` plus `faqtory suggest` against the checked-out repository. The job therefore executes repository-controlled code while holding a write token, and the permission block does not restrict `contents` to read-only.
**Remediation**: Add an explicit least-privilege block: `permissions: { contents: read, issues: write }` so the checkout step cannot push, and consider running the FAQtory step in a job without the write token.
**Evidence**:
```
permissions:
      issues: write
```
**Depends On**: `security-gha-action-unpinned-5` | **Blocks**: None

### Priority 2: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `.github/workflows/pythonpackage.yml:41`
**Description**: The workflow runs `poetry install` on every matrix leg with no `actions/cache` step for the Poetry virtualenv or pip wheel cache. The `if: steps.cached-poetry-dependencies.outputs.cache-hit != 'true'` guard references a cache step that does not exist in the file, so the condition is always true and dependencies are reinstalled from scratch across all 18 legs.
**Remediation**: Add an `actions/cache` step keyed on `poetry.lock` hash before the install step (or use `snok/install-poetry`'s built-in caching), so the existing cache-hit guard becomes meaningful.
**Evidence**:
```
- name: Install dependencies
        run: poetry install
        if: steps.cached-poetry-dependencies.outputs.cache-hit != 'true'
```
**Depends On**: None | **Blocks**: None

### Priority 3: `cost-gha-always-on-8`
**Module**: cost | **Severity**: low | **Effort**: S | **Confidence**: 0.8
**Location**: `.github/workflows/codespell.yml:2`
**Description**: The codespell workflow triggers on `[pull_request, push]` with no branch filter, so it runs on every push to every branch including short-lived feature branches, duplicating work already covered by the pull_request trigger.
**Remediation**: Restrict the push trigger to long-lived branches: `on: { pull_request: {}, push: { branches: [master] } }`.
**Evidence**:
```
on: [pull_request, push]
```
**Depends On**: None | **Blocks**: None

### Priority 4: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/pythonpackage.yml:38`
**Description**: The CI workflow installs Poetry via a mutable tag reference (`snok/install-poetry@v1.3.4`) rather than a pinned commit SHA. A compromised or retagged upstream action could execute arbitrary code in the build job, which has access to the CODECOV_TOKEN secret.
**Remediation**: Pin the action to a full commit SHA (e.g. `snok/install-poetry@<40-char-sha>`) and let Dependabot keep it updated, matching the pattern already used for `peter-evans/create-or-update-comment` in comment.yml.
**Evidence**:
```
uses: snok/install-poetry@v1.3.4
```
**Depends On**: None | **Blocks**: `security-gha-overpermissive-2`

### Priority 5: `security-gha-fork-pr-4`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/newissue.yml:22`
**Description**: The issue-triage workflow uses `juliangruber/read-file-action@v1`, a tag reference rather than a pinned SHA. This workflow runs on `issues: opened` events and reads repository files, so a hijacked action tag would run with the workflow's token.
**Remediation**: Pin `juliangruber/read-file-action` to a specific commit SHA; the sibling `peter-evans/create-or-update-comment` step in the same file already demonstrates the pinned-SHA convention.
**Evidence**:
```
uses: juliangruber/read-file-action@v1
```
**Depends On**: None | **Blocks**: None

### Priority 6: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `.github/workflows/pythonpackage.yml:8`
**Description**: The test matrix job (3 OSes x 6 Python versions) defines no `timeout-minutes`. A hung `poetry install` or a stuck pytest run can occupy a runner indefinitely, and with 18 matrix legs the wasted compute multiplies.
**Remediation**: Add `timeout-minutes: 30` (or a value tuned to observed run time) at the job level so stuck legs are cancelled automatically.
**Evidence**:
```
build:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
```
**Depends On**: None | **Blocks**: None

### Priority 7: `security-gha-no-concurrency-prod-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/codeql.yml:13`
**Description**: The CodeQL `analyze` job has no `timeout-minutes`. CodeQL autobuild and analysis can stall on pathological inputs, and without a timeout the job will consume the default 360-minute budget before failing.
**Remediation**: Add `timeout-minutes: 45` to the `analyze` job to bound CodeQL runtime.
**Evidence**:
```
analyze:
    name: Analyze
    runs-on: ubuntu-latest
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-overpermissive-2`: Add an explicit least-privilege block: `permissions: { contents: read, issues: write }` so the checkout step cannot push, and consider running the FAQtory step in a job without the write token. (XS)
- `cost-gha-no-dependency-cache-5`: Add an `actions/cache` step keyed on `poetry.lock` hash before the install step (or use `snok/install-poetry`'s built-in caching), so the existing cache-hit guard becomes meaningful. (M)
- `cost-gha-always-on-8`: Restrict the push trigger to long-lived branches: `on: { pull_request: {}, push: { branches: [master] } }`. (S)

### 60 Days
- `security-gha-action-unpinned-5`: Pin the action to a full commit SHA (e.g. (M)
- `security-gha-fork-pr-4`: Pin `juliangruber/read-file-action` to a specific commit SHA; the sibling `peter-evans/create-or-update-comment` step in the same file already demonstrates the pinned-SHA convention. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 30` (or a value tuned to observed run time) at the job level so stuck legs are cancelled automatically. (M)
- `security-gha-no-concurrency-prod-10`: Add `timeout-minutes: 45` to the `analyze` job to bound CodeQL runtime. (M)

### 90 Days
- —

---

## Dependencies
- `security-gha-overpermissive-2` **Depends On** `security-gha-action-unpinned-5` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
