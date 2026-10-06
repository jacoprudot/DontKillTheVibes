# Assessment Report: httpx

- **Repository**: httpx
- **Date**: 2026-10-05T16:09:37.438Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: C
- **Critical Findings**: —
- **Total Findings**: 4
- **By Severity**: medium 4
- **Estimated Total Effort**: 4×M
- **Top 3 Priorities**:
  - `security-gha-action-unpinned-5` — GitHub Actions are referenced by mutable version tags (`actions/checkout@v4`, `actions/setup-python@v6`) rather than pinned to a full… (medium, M)
  - `security-gha-job-no-timeout-7` — The `publish` job defines no `timeout-minutes`, so a hung install/build/publish step can occupy a runner indefinitely and hold the release… (medium, M)
  - `security-gha-no-concurrency-prod-10` — The publish workflow triggers on every pushed tag with no `concurrency` group, so two tag pushes in quick succession can run overlapping… (medium, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/publish.yml:17`
**Description**: GitHub Actions are referenced by mutable version tags (`actions/checkout@v4`, `actions/setup-python@v6`) rather than pinned to a full commit SHA. A compromised or retagged upstream action could execute arbitrary code in the release job, which has access to the `PYPI_TOKEN` secret. The same unpinned pattern also appears in .github/workflows/test-suite.yml (lines 20-21).
**Remediation**: Pin each action to a full commit SHA (e.g. `actions/checkout@<40-char-sha>`) in both publish.yml and test-suite.yml, and let Dependabot keep the pins updated, so a retagged release cannot silently change the executed code.
**Evidence**:
```
- uses: "actions/checkout@v4"
- uses: "actions/setup-python@v6"
```
**Depends On**: `security-gha-no-concurrency-prod-10` | **Blocks**: None

### Priority 2: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/publish.yml:9`
**Description**: The `publish` job defines no `timeout-minutes`, so a hung install/build/publish step can occupy a runner indefinitely and hold the release environment open. The `tests` job in .github/workflows/test-suite.yml (line 10) has the same gap across all five Python matrix legs.
**Remediation**: Add `timeout-minutes: 30` (or an appropriate bound) to the `publish` job and to the `tests` job so a stuck step fails fast instead of running unbounded.
**Evidence**:
```
jobs:
  publish:
    name: "Publish release"
    runs-on: "ubuntu-latest"
```
**Depends On**: None | **Blocks**: None

### Priority 3: `security-gha-no-concurrency-prod-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/publish.yml:3`
**Description**: The publish workflow triggers on every pushed tag with no `concurrency` group, so two tag pushes in quick succession can run overlapping release jobs that race to publish to PyPI and deploy docs.
**Remediation**: Add a `concurrency: { group: publish, cancel-in-progress: false }` block to the workflow so release jobs are serialized and cannot overlap.
**Evidence**:
```
on:
  push:
    tags:
      - '*'
```
**Depends On**: None | **Blocks**: `security-gha-action-unpinned-5`

### Priority 4: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/test-suite.yml:17`
**Description**: The test-suite workflow runs `scripts/install` for each of the five Python matrix entries without any `actions/cache` step for pip packages, so dependencies are re-downloaded and re-built on every run and every matrix leg.
**Remediation**: Add an `actions/cache` (or `actions/setup-python` `cache: pip`) step keyed on the requirements/lockfile hash before `scripts/install` to reuse downloaded wheels across runs and matrix legs.
**Evidence**:
```
- name: "Install dependencies"
        run: "scripts/install"
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-action-unpinned-5`: Pin each action to a full commit SHA (e.g. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 30` (or an appropriate bound) to the `publish` job and to the `tests` job so a stuck step fails fast instead of running unbounded. (M)

### 60 Days
- `security-gha-no-concurrency-prod-10`: Add a `concurrency: { group: publish, cancel-in-progress: false }` block to the workflow so release jobs are serialized and cannot overlap. (M)
- `cost-gha-no-dependency-cache-5`: Add an `actions/cache` (or `actions/setup-python` `cache: pip`) step keyed on the requirements/lockfile hash before `scripts/install` to reuse downloaded wheels across runs and matrix legs. (M)

### 90 Days
- —

---

## Dependencies
- `security-gha-action-unpinned-5` **Depends On** `security-gha-no-concurrency-prod-10` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
