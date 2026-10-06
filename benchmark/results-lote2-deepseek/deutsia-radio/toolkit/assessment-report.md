# Assessment Report: deutsia-radio

- **Repository**: deutsia-radio
- **Date**: 2026-10-05T20:31:43.423Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 6
- **By Severity**: high 2 · medium 4
- **Estimated Total Effort**: 1×XS, 5×M
- **Top 3 Priorities**:
  - `security-debug-in-prod-1` — The application manifest sets android:usesCleartextTraffic="true", which permits all HTTP (non-TLS) traffic in production. (high, XS)
  - `security-gha-job-no-timeout-7` — None of the four workflows (build.yml, test.yml, trivy.yml, scorecard.yml) set timeout-minutes on their jobs. (medium, M)
  - `security-gha-auto-deploy-prod-9` — The build workflow triggers on every push to main and runs a full Gradle assembleDebug without any environment protection, manual… (high, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-debug-in-prod-1`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.9
**Location**: `app/src/main/AndroidManifest.xml:28`
**Description**: The application manifest sets android:usesCleartextTraffic="true", which permits all HTTP (non-TLS) traffic in production. Combined with the app's clearnet station support, this allows stream URLs and cover-art fetches to be downgraded to plaintext, exposing listening behavior and metadata to network observers.
**Remediation**: Set android:usesCleartextTraffic="false" and add a network security config that whitelists only the specific clearnet hosts that genuinely require HTTP, or migrate all clearnet streams to HTTPS.
**Depends On**: None | **Blocks**: None

### Priority 2: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/build.yml:12`
**Description**: None of the four workflows (build.yml, test.yml, trivy.yml, scorecard.yml) set timeout-minutes on their jobs. A hung Gradle daemon, stalled network fetch, or stuck vulnerability scan can leave a job running indefinitely, consuming runner minutes and blocking the workflow queue.
**Remediation**: Add timeout-minutes: 30 (or an appropriate value) to every job in build.yml, test.yml, trivy.yml, and scorecard.yml.
**Depends On**: None | **Blocks**: None

### Priority 3: `security-gha-auto-deploy-prod-9`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/build.yml:4`
**Description**: The build workflow triggers on every push to main and runs a full Gradle assembleDebug without any environment protection, manual approval, or concurrency guard. Any merge to main immediately produces a build artifact, and there is no gate preventing unreviewed or malicious commits from being built and potentially distributed.
**Remediation**: Add a concurrency group (concurrency: group: build-${{ github.ref }}) and require environment protection rules or manual approval for any step that publishes artifacts to release channels.
**Depends On**: None | **Blocks**: None

### Priority 4: `security-gha-no-container-8`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.github/workflows/build.yml:12`
**Description**: All four workflows run directly on ubuntu-latest runners without a container: directive. Jobs share the runner's filesystem and environment, so a compromised dependency or malicious build script can persist artifacts and environment state across steps and potentially across jobs on the same runner.
**Remediation**: Add a container: directive (e.g., container: eclipse-temurin:17-jdk) to each job to isolate it from the runner host and from other jobs.
**Depends On**: `security-gha-workspace-not-cleaned-6` | **Blocks**: None

### Priority 5: `security-gha-workspace-not-cleaned-6`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `.github/workflows/build.yml:12`
**Description**: None of the four workflows clean up the workspace after execution. Build outputs, Gradle caches, SARIF results, and any secrets materialized during the run remain on the runner, where they could be accessed by subsequent jobs scheduled on the same runner.
**Remediation**: Add a cleanup step at the end of each job (e.g., run: rm -rf ${{ github.workspace }}/*) or use container jobs that discard the workspace automatically.
**Depends On**: None | **Blocks**: `security-gha-no-container-8`

### Priority 6: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `.github/workflows/build.yml:21`
**Description**: The gradle/actions/wrapper-validation step is pinned to a commit SHA but the trailing comment is missing and the SHA is not accompanied by a version tag, making it harder to audit and update. More importantly, the workflow relies on third-party actions (gradle/actions, ossf/scorecard-action, aquasecurity/trivy-action) whose pinned SHAs must be manually maintained; Dependabot is configured for github-actions but the open-pull-requests-limit of 5 may delay critical security updates.
**Remediation**: Ensure all third-party actions are pinned to full commit SHAs with version comments, and consider raising the Dependabot open-pull-requests-limit for github-actions to ensure security updates are not queued behind routine dependency bumps.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-debug-in-prod-1`: Set android:usesCleartextTraffic="false" and add a network security config that whitelists only the specific clearnet hosts that genuinely require HTTP, or migrate all clearnet streams to HTTPS. (XS)
- `security-gha-job-no-timeout-7`: Add timeout-minutes: 30 (or an appropriate value) to every job in build.yml, test.yml, trivy.yml, and scorecard.yml. (M)

### 60 Days
- `security-gha-auto-deploy-prod-9`: Add a concurrency group (concurrency: group: build-${{ github.ref }}) and require environment protection rules or manual approval for any step that publishes artifacts to release channels. (M)
- `security-gha-no-container-8`: Add a container: directive (e.g., container: eclipse-temurin:17-jdk) to each job to isolate it from the runner host and from other jobs. (M)

### 90 Days
- `security-gha-workspace-not-cleaned-6`: Add a cleanup step at the end of each job (e.g., run: rm -rf ${{ github.workspace }}/*) or use container jobs that discard the workspace automatically. (M)
- `security-gha-action-unpinned-5`: Ensure all third-party actions are pinned to full commit SHAs with version comments, and consider raising the Dependabot open-pull-requests-limit for github-actions to ensure security updates are… (M)

---

## Dependencies
- `security-gha-no-container-8` **Depends On** `security-gha-workspace-not-cleaned-6` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
