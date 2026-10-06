# Assessment Report: agentgraphed

- **Repository**: agentgraphed
- **Date**: 2026-10-05T20:53:18.311Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: D
- **Critical Findings**: —
- **Total Findings**: 11
- **By Severity**: high 2 · medium 7 · low 2
- **Estimated Total Effort**: 1×XS, 4×S, 6×M
- **Top 3 Priorities**:
  - `security-gha-overpermissive-2` — The publish job grants contents:write at the job level, which is broader than needed for the steps that run. (high, XS)
  - `security-gha-job-no-timeout-7` — The publish job has no timeout-minutes set, unlike the verify-platforms job which sets timeout-minutes: 5. (medium, M)
  - `cost-gha-no-timeout-9` — The CI build job has no timeout-minutes, so a hung `npm run build` or a stuck `agentgraphed` boot loop in the packed-install verification… (medium, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.7
**Location**: `.github/workflows/publish.yml:30`
**Description**: The publish job grants contents:write at the job level, which is broader than needed for the steps that run. The only step requiring write access is the release-creation step; the build, install-verification and npm publish steps run with the same elevated token, so any compromised dependency or action in those steps inherits repository write access.
**Remediation**: Split the release-creation step into its own job with contents:write, and keep the build/publish job at contents:read plus id-token:write. Alternatively scope permissions per-step where the runner supports it.
**Evidence**:
```
permissions:
  contents: write   # softprops/action-gh-release needs this to create the GitHub Release page
  id-token: write   # for npm provenance attestation
```
**Depends On**: `security-gha-no-container-8` | **Blocks**: None

### Priority 2: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/publish.yml:27`
**Description**: The publish job has no timeout-minutes set, unlike the verify-platforms job which sets timeout-minutes: 5. A hung npm publish, network stall, or stuck postinstall script can occupy a runner indefinitely and, because the job holds id-token:write, keep a live OIDC token exchange window open longer than necessary.
**Remediation**: Add `timeout-minutes: 15` (or an appropriate bound) to the publish job, matching the discipline already applied to verify-platforms.
**Evidence**:
```
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
```
**Depends On**: `security-gha-no-concurrency-prod-10` | **Blocks**: None

### Priority 3: `cost-gha-no-timeout-9`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/ci.yml:8`
**Description**: The CI build job has no timeout-minutes, so a hung `npm run build` or a stuck `agentgraphed` boot loop in the packed-install verification step can burn runner minutes up to GitHub's 6-hour default before being reaped. The verification step's own readiness loop only bounds the wait to 30 seconds, but the surrounding process is not bounded.
**Remediation**: Set `timeout-minutes: 20` on the build job so a stuck build or boot is killed and the runner is released promptly.
**Evidence**:
```
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
```
**Depends On**: None | **Blocks**: None

### Priority 4: `code-unhandled-promise-4`
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.6
**Location**: `bin/agentgraphed.js:96`
**Description**: findFreePort constructs a net.Server and listens on a port, but the promise resolves only via the 'error' or 'listening' handlers. If the server emits neither (e.g. the listen call is interrupted), the promise never settles and the CLI hangs before printing the URL. More importantly, the returned promise is awaited in main() without a surrounding try/catch for the 'no free port found' throw path, so a port-exhaustion failure surfaces as an unhandled rejection rather than a clean error message.
**Remediation**: Wrap the findFreePort call in main() in a try/catch that prints a friendly error and exits non-zero, and add a settle guard (e.g. a `settled` flag or a timeout) inside findFreePort so the promise cannot hang indefinitely.
**Evidence**:
```
async function findFreePort(start) {
  for (let p = start; p < start + 100; p++) {
    const ok = await new Promise((res) => {
      const srv = createServer()
        .once('error', () => res(false))
        .once('listening', () => srv.close(() => res(true)));
      srv.listen(p, '127.0.0.1');
    });
    if (ok) return p;
  }
  throw new Error('no free port found');
}
```
**Depends On**: `code-missing-return-type-8` | **Blocks**: None

### Priority 5: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/publish.yml:84`
**Description**: Third-party GitHub Action softprops/action-gh-release is referenced by mutable tag (@v2) rather than a pinned commit SHA. A compromised or retagged upstream release could execute arbitrary code in a workflow that holds contents:write and id-token:write permissions, enabling repository tampering or npm publish hijack.
**Remediation**: Pin every third-party action to a full commit SHA (e.g. softprops/action-gh-release@<40-char-sha>) and let Dependabot/Renovate bump the SHA. Apply the same pinning to actions/checkout and actions/setup-node in ci.yml and publish.yml.
**Evidence**:
```
uses: softprops/action-gh-release@v2
```
**Depends On**: None | **Blocks**: None

### Priority 6: `security-gha-no-concurrency-prod-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.github/workflows/publish.yml:24`
**Description**: The publish workflow has no concurrency group. Two tags pushed in quick succession (or a re-run racing a fresh tag) can start two publish jobs simultaneously; both will attempt `npm publish` and `softprops/action-gh-release` for overlapping refs, producing duplicate releases or a partial publish that leaves the registry and the GitHub Release page inconsistent.
**Remediation**: Add a workflow-level concurrency block, e.g. `concurrency: { group: publish-${{ github.ref }}, cancel-in-progress: false }`, so publishes for the same tag serialize.
**Evidence**:
```
on:
  push:
    tags: ['v*.*.*']

jobs:
  publish:
```
**Depends On**: None | **Blocks**: `security-gha-job-no-timeout-7`

### Priority 7: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.github/workflows/publish.yml:62`
**Description**: The verify-platforms matrix job runs `npm install agentgraphed@<version>` on three OSes with no dependency cache step. Each run downloads the full dependency tree (Next.js, better-sqlite3 prebuilds, recharts, etc.) from the registry, adding minutes to every release across macos-latest, windows-latest and ubuntu-latest.
**Remediation**: Add actions/setup-node with `cache: 'npm'` (or an actions/cache step keyed on the published version) before the install step in verify-platforms to reuse the npm cache across matrix legs.
**Evidence**:
```
      - name: Install + boot from npm
        shell: bash
        run: |
          set -e
          mkdir -p verify && cd verify
          npm init -y > /dev/null
          npm install "agentgraphed@${{ steps.ver.outputs.version }}" --no-audit --no-fund
```
**Depends On**: None | **Blocks**: None

### Priority 8: `code-promise-chain-missing-catch-5`
**Module**: code | **Severity**: medium | **Effort**: S | **Confidence**: 0.65
**Location**: `bin/agentgraphed.js:130`
**Description**: triggerIngest performs a fetch to the local ingest endpoint and awaits res.json(), but the surrounding try/catch only wraps the fetch and the res.ok check. If the response body is not valid JSON (e.g. an HTML error page from the Next.js server), res.json() rejects and the rejection propagates out of triggerIngest into main(), where it is only caught by the top-level main().catch — producing a stack trace instead of the intended graceful '(ingest failed: ...)' warning.
**Remediation**: Move the `return await res.json()` inside the existing try block, or add a `.catch()` on the json() call that logs the parse failure and returns null, matching the function's documented contract of returning null on failure.
**Evidence**:
```
async function triggerIngest(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ingest-local`, { method: 'POST' });
    if (!res.ok) {
      console.warn(`  (ingest endpoint returned ${res.status})`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`  (ingest failed: ${e.message})`);
    return null;
  }
}
```
**Depends On**: None | **Blocks**: None

### Priority 9: `security-gha-no-container-8`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `.github/workflows/publish.yml:28`
**Description**: The publish job runs directly on the ubuntu-latest runner host rather than inside a container. The job installs dependencies (`npm ci`), runs arbitrary package lifecycle scripts, and holds id-token:write; without container isolation, anything written to the runner filesystem or environment persists for the remainder of the job and is shared with the release-creation step.
**Remediation**: Run the build/publish steps inside a `container:` (e.g. node:22-bookworm) so the workspace and environment are isolated from the runner host, or split the release step into a separate job that does not run npm lifecycle scripts.
**Evidence**:
```
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
```
**Depends On**: None | **Blocks**: `security-gha-overpermissive-2`

### Priority 10: `cost-gha-always-on-8`
**Module**: cost | **Severity**: low | **Effort**: S | **Confidence**: 0.65
**Location**: `.github/workflows/ci.yml:5`
**Description**: The CI workflow triggers on every pull_request without a path or branch filter, so documentation-only, screenshot-only, or CHANGELOG-only PRs still run the full build plus the sandboxed install-and-boot verification. The repository contains large binary screenshot assets under docs/screenshots/, making asset-only PRs plausible.
**Remediation**: Add `paths-ignore: ['docs/**', '**.md', 'LICENSE']` to the pull_request trigger, or gate the expensive install-verification step behind a `if:` condition on changed paths.
**Evidence**:
```
on:
  push:
    branches: [main]
  pull_request:
```
**Depends On**: None | **Blocks**: None

### Priority 11: `code-missing-return-type-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `bin/agentgraphed.js:96`
**Description**: findFreePort is declared async but has no JSDoc @returns annotation, and the file mixes JSDoc-style comments elsewhere. Callers cannot tell from the signature whether the function resolves to a number or rejects on exhaustion, which is exactly the ambiguity that produced the unhandled-rejection finding above.
**Remediation**: Add a JSDoc block: `/** @param {number} start @returns {Promise<number>} @throws {Error} when no free port is found */` above findFreePort, and apply the same to pingUntilReady and triggerIngest.
**Evidence**:
```
async function findFreePort(start) {
```
**Depends On**: None | **Blocks**: `code-unhandled-promise-4`

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-overpermissive-2`: Split the release-creation step into its own job with contents:write, and keep the build/publish job at contents:read plus id-token:write. (XS)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 15` (or an appropriate bound) to the publish job, matching the discipline already applied to verify-platforms. (M)
- `cost-gha-no-timeout-9`: Set `timeout-minutes: 20` on the build job so a stuck build or boot is killed and the runner is released promptly. (M)
- `code-unhandled-promise-4`: Wrap the findFreePort call in main() in a try/catch that prints a friendly error and exits non-zero, and add a settle guard (e.g. (S)

### 60 Days
- `security-gha-action-unpinned-5`: Pin every third-party action to a full commit SHA (e.g. (M)
- `security-gha-no-concurrency-prod-10`: Add a workflow-level concurrency block, e.g. (M)
- `cost-gha-no-dependency-cache-5`: Add actions/setup-node with `cache: 'npm'` (or an actions/cache step keyed on the published version) before the install step in verify-platforms to reuse the npm cache across matrix legs. (M)
- `code-promise-chain-missing-catch-5`: Move the `return await res.json()` inside the existing try block, or add a `.catch()` on the json() call that logs the parse failure and returns null, matching the function's documented contract of… (S)

### 90 Days
- `security-gha-no-container-8`: Run the build/publish steps inside a `container:` (e.g. (M)
- `cost-gha-always-on-8`: Add `paths-ignore: ['docs/**', '**.md', 'LICENSE']` to the pull_request trigger, or gate the expensive install-verification step behind a `if:` condition on changed paths. (S)
- `code-missing-return-type-8`: Add a JSDoc block: `/** @param {number} start @returns {Promise<number>} @throws {Error} when no free port is found */` above findFreePort, and apply the same to pingUntilReady and triggerIngest. (S)

---

## Dependencies
- `security-gha-overpermissive-2` **Depends On** `security-gha-no-container-8` (blocks)
- `security-gha-job-no-timeout-7` **Depends On** `security-gha-no-concurrency-prod-10` (blocks)
- `code-unhandled-promise-4` **Depends On** `code-missing-return-type-8` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
