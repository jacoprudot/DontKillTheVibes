# Assessment Report: sinatra

- **Repository**: sinatra
- **Date**: 2026-10-05T16:06:50.875Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 9
- **By Severity**: high 2 · medium 5 · low 1 · info 1
- **Estimated Total Effort**: 2×XS, 1×S, 6×M
- **Top 3 Priorities**:
  - `security-gha-overpermissive-2` — The release job requests `id-token: write` but does not declare `contents: read`. (high, XS)
  - `security-gha-action-unpinned-5` — The release workflow uses third-party actions pinned only to mutable version tags (actions/checkout@v4, ruby/setup-ruby@v1,… (medium, M)
  - `security-gha-no-concurrency-prod-10` — The release job has no concurrency control. (medium, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.7
**Location**: `.github/workflows/release.yml:12`
**Description**: The release job requests `id-token: write` but does not declare `contents: read`. When a workflow omits the `permissions` map entirely for other scopes, the repository/org default token permissions apply, which may grant broader access than the job needs. The job only needs to read the repo and mint an OIDC token.
**Remediation**: Declare the full least-privilege set explicitly: `permissions: { contents: read, id-token: write }`, and set the repository default workflow token permission to read-only.
**Evidence**:
```
permissions:
  id-token: write # for trusted publishing
```
**Depends On**: None | **Blocks**: `security-gha-action-unpinned-5`

### Priority 2: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/release.yml:19`
**Description**: The release workflow uses third-party actions pinned only to mutable version tags (actions/checkout@v4, ruby/setup-ruby@v1, rubygems/configure-rubygems-credentials@v1.0.0). A compromised or retagged upstream action could execute arbitrary code in a job that holds id-token: write and publishes gems to rubygems.org.
**Remediation**: Pin every action to a full commit SHA (e.g. actions/checkout@<sha> # v4.x.y) and let Dependabot keep the SHAs current. This is especially important for the release job, which has trusted-publishing credentials.
**Evidence**:
```
- uses: actions/checkout@v4
- uses: ruby/setup-ruby@v1
- uses: rubygems/configure-rubygems-credentials@v1.0.0
```
**Depends On**: `security-gha-overpermissive-2` | **Blocks**: None

### Priority 3: `security-gha-no-concurrency-prod-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/release.yml:9`
**Description**: The release job has no concurrency control. Two tags pushed in quick succession (or a tag push racing a workflow_dispatch run) will start two release jobs that both execute `rake release:sinatra` etc., risking duplicate or interleaved gem pushes to rubygems.org.
**Remediation**: Add a top-level `concurrency: { group: release, cancel-in-progress: false }` to release.yml so only one release pipeline can run at a time.
**Evidence**:
```
jobs:
  release:
    if: github.repository == 'sinatra/sinatra'
    runs-on: ubuntu-latest
```
**Depends On**: None | **Blocks**: `security-gha-auto-deploy-prod-9`

### Priority 4: `security-gha-auto-deploy-prod-9`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/release.yml:4`
**Description**: Pushing any tag matching v* automatically triggers the full release job, which builds and pushes all three gems to rubygems.org with no environment protection, manual approval, or concurrency guard. A mistyped or maliciously pushed tag immediately publishes to the public registry.
**Remediation**: Gate the release job behind a protected GitHub Environment (e.g. `environment: release`) requiring reviewer approval, and add a `concurrency: { group: release, cancel-in-progress: false }` block so two tag pushes cannot publish concurrently.
**Evidence**:
```
on:
  push:
    tags:
      - v*
  workflow_dispatch:
```
**Depends On**: `security-gha-no-concurrency-prod-10` | **Blocks**: None

### Priority 5: `cost-gha-always-on-8`
**Module**: cost | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `.github/workflows/test.yml:4`
**Description**: The test workflow triggers on pushes to every branch (`branches: ['**']`) in addition to pull_request. For a repo with many feature branches this duplicates the full ~20-leg matrix for each push and again when the PR is opened/updated, roughly doubling CI consumption for no additional signal.
**Remediation**: Restrict push triggers to long-lived branches (`branches: [main]`) and rely on `pull_request` for feature branches, or add a `paths-ignore` filter for docs-only changes.
**Evidence**:
```
on:
  push:
    branches:
      - '**'
  pull_request:
```
**Depends On**: None | **Blocks**: None

### Priority 6: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `.github/workflows/test.yml:160`
**Description**: The sinatra job installs system packages (pandoc, nodejs, libxml2-dev, libxslt-dev, libyaml-dev) via apt-get on every matrix leg, and the sinatra-contrib step runs `bundle install` again inside the working directory rather than relying on the cached bundler path. With a matrix of ~20 ruby/rack/puma/tilt/zeitwerk combinations this multiplies runner minutes and network egress.
**Remediation**: Cache the apt packages (e.g. actions/cache on /var/cache/apt) or bake a container image with the native deps, and ensure `bundler-cache: true` covers the sinatra-contrib Gemfile (set `working-directory` on the setup-ruby step or add a second cache key) so `bundle install` in the contrib step is a no-op.
**Evidence**:
```
- name: Install dependencies
  run: |
    sudo apt-get update
    sudo apt-get install --yes \
      pandoc \
      nodejs \
      pkg-config \
      libxml2-dev \
      libxslt-dev \
      libyaml-dev
```
**Depends On**: None | **Blocks**: None

### Priority 7: `cost-gha-matrix-inefficient-10`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `.github/workflows/test.yml:75`
**Description**: The sinatra job matrix expands to roughly 20 combinations (7 ruby versions x rubyopt x rack/puma/tilt/rack_session/zeitwerk variants plus includes). Several combinations are redundant for signal: the `rubyopt: --enable-frozen-string-literal` axis is applied to every ruby version, and the rack/puma/tilt/zeitwerk head variants are only meaningful on one ruby. This multiplies runner minutes without proportional coverage.
**Remediation**: Reduce the matrix by pinning the frozen-string-literal axis to a single ruby version, and move the head-dependency variants into a separate, smaller job that runs only on the latest stable ruby. Use `exclude:` to drop combinations already covered by `include:`.
**Evidence**:
```
matrix:
  puma:
    - stable
  rack:
    - stable
  rack_session:
    - stable
  tilt:
    - stable
  zeitwerk:
    - stable
  ruby:
    - "2.7"
    ...
  rubyopt:
    - "--enable-frozen-string-literal --debug-frozen-string-literal"
```
**Depends On**: None | **Blocks**: None

### Priority 8: `github-commit-history-2`
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.9
**Location**: `CHANGELOG.md:1`
**Description**: The changelog shows a steady, active release cadence (4.2.1 on 2025-10-10, 4.2.0 on 2025-10-08, 4.1.1 on 2024-11-20, 4.1.0 on 2024-11-18), confirming the project is actively maintained. Recorded as a positive maturity signal, not a defect.
**Remediation**: No action required — continue the current release cadence and keep the changelog entries linked to their pull requests.
**Evidence**:
```
## 4.2.1 / 2025-10-10

* Fix: Revert "`PATH_INFO` can never be empty" ([#2124](https://github.com/sinatra/sinatra/pull/2124))
```
**Depends On**: None | **Blocks**: None

### Priority 9: `security-gha-fork-pr-4`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/test.yml:47`
**Description**: The test workflow references actions by mutable tags (actions/checkout@v5, ruby/setup-ruby@v1, zzak/action-discord@v6). The Discord action in particular is a third-party action that receives secrets.GITHUB_TOKEN and secrets.DISCORD_WEBHOOK; a tag move would exfiltrate those secrets. This is the same unpinned-action class as the release workflow but in a separate file, so it is tracked separately.
**Remediation**: Pin all actions to full commit SHAs, including zzak/action-discord, and enable Dependabot for github-actions to keep pins updated.
**Evidence**:
```
- uses: zzak/action-discord@v6
  if: failure() && github.ref_name == 'main'
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-overpermissive-2`: Declare the full least-privilege set explicitly: `permissions: { contents: read, id-token: write }`, and set the repository default workflow token permission to read-only. (XS)
- `security-gha-action-unpinned-5`: Pin every action to a full commit SHA (e.g. (M)
- `security-gha-no-concurrency-prod-10`: Add a top-level `concurrency: { group: release, cancel-in-progress: false }` to release.yml so only one release pipeline can run at a time. (M)

### 60 Days
- `security-gha-auto-deploy-prod-9`: Gate the release job behind a protected GitHub Environment (e.g. (M)
- `cost-gha-always-on-8`: Restrict push triggers to long-lived branches (`branches: [main]`) and rely on `pull_request` for feature branches, or add a `paths-ignore` filter for docs-only changes. (S)
- `cost-gha-no-dependency-cache-5`: Cache the apt packages (e.g. (M)

### 90 Days
- `cost-gha-matrix-inefficient-10`: Reduce the matrix by pinning the frozen-string-literal axis to a single ruby version, and move the head-dependency variants into a separate, smaller job that runs only on the latest stable ruby. (M)
- `github-commit-history-2`: No action required — continue the current release cadence and keep the changelog entries linked to their pull requests. (XS)

---

## Dependencies
- `security-gha-auto-deploy-prod-9` **Depends On** `security-gha-no-concurrency-prod-10` (blocks)
- `security-gha-action-unpinned-5` **Depends On** `security-gha-overpermissive-2` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
