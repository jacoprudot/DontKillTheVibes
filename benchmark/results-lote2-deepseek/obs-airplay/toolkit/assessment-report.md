# Assessment Report: obs-airplay

- **Repository**: obs-airplay
- **Date**: 2026-10-05T20:11:43.520Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 1
- **Total Findings**: 14
- **By Severity**: critical 1 · high 2 · medium 7 · low 4
- **Estimated Total Effort**: 2×XS, 4×S, 8×M
- **Top 3 Priorities**:
  - `security-gha-overpermissive-2` — The workflow does not declare a `permissions:` block, so the GITHUB_TOKEN inherits the repository default (often read/write for all scopes). (high, XS)
  - `security-gha-action-unpinned-5` — Third-party GitHub Actions are referenced by mutable tag (actions/checkout@v4, ilammy/msvc-dev-cmd@v1) instead of a pinned commit SHA,… (medium, M)
  - `security-gha-job-no-timeout-7` — The build job defines no timeout-minutes, so a hung dependency download or compile step can occupy a runner indefinitely, wasting CI… (medium, M)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.8
**Location**: `.github/workflows/build.yml:10`
**Description**: The workflow does not declare a `permissions:` block, so the GITHUB_TOKEN inherits the repository default (often read/write for all scopes). A build job that only checks out code and compiles should run with read-only contents permission.
**Remediation**: Add a top-level `permissions: contents: read` block (and grant additional scopes only to the specific job that needs them).
**Evidence**:
```
jobs:
  build:
    runs-on: windows-latest
```
**Depends On**: `security-gha-action-unpinned-5` | **Blocks**: None

### Priority 2: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.9
**Location**: `.github/workflows/build.yml:15`
**Description**: Third-party GitHub Actions are referenced by mutable tag (actions/checkout@v4, ilammy/msvc-dev-cmd@v1) instead of a pinned commit SHA, exposing the build to supply-chain attacks if the upstream tag is moved or the action repository is compromised.
**Remediation**: Pin every third-party action to a full commit SHA (e.g. actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683) and use Dependabot to keep the pins updated.
**Evidence**:
```
uses: actions/checkout@v4 / uses: ilammy/msvc-dev-cmd@v1
```
**Depends On**: None | **Blocks**: `security-gha-overpermissive-2`

### Priority 3: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/build.yml:10`
**Description**: The build job defines no timeout-minutes, so a hung dependency download or compile step can occupy a runner indefinitely, wasting CI minutes and masking failures.
**Remediation**: Add `timeout-minutes: 60` (or an appropriate value) to the build job definition.
**Evidence**:
```
jobs:
  build:
    runs-on: windows-latest
```
**Depends On**: `cost-gha-no-timeout-9` | **Blocks**: None

### Priority 4: `cost-gha-no-timeout-9`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.github/workflows/build.yml:10`
**Description**: No job timeout is configured, so a stuck build (e.g. a stalled curl download of the FFmpeg or OBS SDK archive) can consume runner minutes without bound, directly increasing GitHub Actions cost.
**Remediation**: Set `timeout-minutes` on the build job and add `--max-time`/`--retry` options to the curl downloads so a hung transfer fails fast.
**Evidence**:
```
jobs:
  build:
    runs-on: windows-latest
```
**Depends On**: None | **Blocks**: `security-gha-job-no-timeout-7`

### Priority 5: `cost-gha-always-on-8`
**Module**: cost | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `.github/workflows/build.yml:3`
**Description**: The workflow triggers on every push and pull_request to master, running the full multi-dependency build for documentation-only or trivial changes.
**Remediation**: Add `paths-ignore` (e.g. '**.md', 'LICENSE', '.gitignore') to the push/pull_request triggers so non-code changes do not consume CI minutes.
**Evidence**:
```
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
```
**Depends On**: None | **Blocks**: None

### Priority 6: `security-weak-rng-10`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `src/airplay-source.c:139`
**Description**: generate_random_mac() seeds the C library PRNG with srand(time(NULL) * getpid()) and derives the MAC address from rand(). The seed is predictable and the generator is not cryptographically secure, so the advertised device identity can be guessed or reproduced by an attacker on the same network.
**Remediation**: Use a cryptographically secure source (BCryptGenRandom on Windows, or RAND_bytes from the already-linked OpenSSL) to generate the random MAC octets instead of srand/rand.
**Evidence**:
```
srand((unsigned)(time(NULL) * getpid()));
int octet = (rand() % 64) << 2 | 0x02;
```
**Depends On**: None | **Blocks**: None

### Priority 7: `code-ignores-return-value-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `src/airplay-source.c:139`
**Description**: The return value of srand() is discarded and, more importantly, the generated MAC is written via snprintf whose truncation result is never checked; callers of generate_random_mac cannot detect a short or failed write. Related: parse_hw_addr() also ignores strtol() error returns, silently producing 0 octets on malformed input.
**Remediation**: Check the snprintf return value against the buffer length and validate strtol() results (errno/endptr) in parse_hw_addr, logging and rejecting malformed input instead of silently continuing.
**Evidence**:
```
snprintf(mac, len, "%02x:%02x:%02x:%02x:%02x:%02x", ...);
hw[(*hw_len)++] = (char)strtol(str + i, NULL, 16);
```
**Depends On**: None | **Blocks**: None

### Priority 8: `code-logs-secrets-10`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6
**Location**: `src/airplay-source.c:216`
**Description**: The video path logs raw packet metadata (byte counts, NAL counts, NTP timestamps) at INFO level for the first five frames. While the current snippet does not print payload bytes, the pattern of logging per-packet protocol details in a media pipeline is a known vector for leaking stream contents or session identifiers if extended; the same file already logs connection lifecycle events that could carry peer identifiers.
**Remediation**: Audit all blog() calls in the media callbacks and ensure no packet payloads, keys, or peer-identifying tokens are logged; gate verbose per-packet logging behind a debug flag that is off in release builds.
**Evidence**:
```
blog(LOG_INFO, "[AirPlay] video_process: %d bytes, %d NALs, ntp=%llu", data->data_len, data->nal_count, (unsigned long long)data->ntp_time_local);
```
**Depends On**: None | **Blocks**: None

### Priority 9: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.85
**Location**: `.github/workflows/build.yml:22`
**Description**: The workflow installs OpenSSL via Chocolatey and clones/builds UxPlay, libplist and the OBS SDK from source on every run with no caching of the downloaded archives or build outputs, so each CI run pays the full download and compile cost.
**Remediation**: Cache deps/ (or the individual archives) with actions/cache keyed on the pinned dependency versions, and cache the libplist/UxPlay build directories so only changed sources recompile.
**Evidence**:
```
- name: Install OpenSSL via Chocolatey
  run: choco install openssl -y --no-progress
- name: Clone UxPlay v1.73.6
```
**Depends On**: None | **Blocks**: None

### Priority 10: `cost-license-incompatible-1`
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `LICENSE:1`
**Description**: The project is licensed LGPL-2.1 and statically links UxPlay (also LGPL) plus libplist (LGPL-2.1) and OpenSSL (Apache-2.0) into a single plugin DLL. LGPL-2.1 requires that users be able to relink the work against a modified version of the LGPL library; shipping a statically linked, non-relinkable DLL without the corresponding object files or a documented relink mechanism is a license-compliance risk.
**Remediation**: Either ship the object files / build scripts needed to relink against modified LGPL components, or switch the LGPL dependencies to dynamic linking, and document the LGPL obligations in the README and installer.
**Evidence**:
```
GNU LESSER GENERAL PUBLIC LICENSE Version 2.1
...
target_link_libraries(obs-airplay-receiver PRIVATE ${UXPLAY_BUILD_DIR}/airplay.lib ...)
```
**Depends On**: `cost-no-license-tracking-5` | **Blocks**: None

### Priority 11: `cost-no-license-tracking-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `README.md:1`
**Description**: The repository credits UxPlay, FFmpeg, libplist and OpenSSL but has no automated license-compliance tracking (no FOSSA/Snyk/licensee config, no NOTICE file, no CI license check) despite bundling FFmpeg LGPL binaries and statically linking multiple LGPL libraries.
**Remediation**: Add a license-scanning step to CI (e.g. licensee or FOSSA) and generate a NOTICE/THIRD-PARTY-LICENSES file listing every bundled dependency and its license text.
**Evidence**:
```
## Credits
- [UxPlay](...) - Open Source AirPlay 2 server
- [FFmpeg](...) - H.264 and AAC-ELD decoding
```
**Depends On**: None | **Blocks**: `cost-license-incompatible-1`

### Priority 12: `code-many-params-10`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.55
**Location**: `src/airplay-source.c:150`
**Description**: parse_hw_addr takes a raw string plus two out-parameters (hw, hw_len) and performs its own length bookkeeping, which is error-prone; the same pattern repeats across the UxPlay callback signatures that pass cls plus several out-params.
**Remediation**: Introduce a small struct (e.g. struct hw_addr { unsigned char bytes[6]; int len; }) and return it by value or via a single out-pointer to reduce parameter count and make the contract explicit.
**Evidence**:
```
static void parse_hw_addr(const char *str, char *hw, int *hw_len)
```
**Depends On**: None | **Blocks**: None

### Priority 13: `code-missing-return-type-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.5
**Location**: `src/airplay-source.c:139`
**Description**: Several file-local helpers (generate_random_mac, parse_hw_addr, reset_timestamp_mapper, map_timestamp) are declared without explicit return-type documentation and the header airplay-source.h is not shown to declare them, reducing the API contract clarity for a C module that is consumed by plugin-main.c.
**Remediation**: Declare all non-static helpers in airplay-source.h with explicit return types and add brief doc comments describing parameters and return values.
**Evidence**:
```
static void generate_random_mac(char *mac, size_t len)
static void parse_hw_addr(const char *str, char *hw, int *hw_len)
```
**Depends On**: None | **Blocks**: None

### Priority 14: `code-print-statement-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `src/airplay-source.c:216`
**Description**: Diagnostic logging is emitted directly from the decode hot path using blog(LOG_INFO, ...) guarded only by a frame counter (video_frame_count < 5). This mixes diagnostic output with production logging and has no runtime toggle, so it cannot be silenced without a rebuild.
**Remediation**: Route diagnostic output through a dedicated debug log level or a runtime-configurable verbosity flag so operators can disable it without recompiling.
**Evidence**:
```
if (ctx->video_frame_count < 5) {
    blog(LOG_INFO, "[AirPlay] video_process: ...");
}
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-overpermissive-2`: Add a top-level `permissions: contents: read` block (and grant additional scopes only to the specific job that needs them). (XS)
- `security-gha-action-unpinned-5`: Pin every third-party action to a full commit SHA (e.g. (M)
- `security-gha-job-no-timeout-7`: Add `timeout-minutes: 60` (or an appropriate value) to the build job definition. (M)
- `cost-gha-no-timeout-9`: Set `timeout-minutes` on the build job and add `--max-time`/`--retry` options to the curl downloads so a hung transfer fails fast. (M)
- `cost-gha-always-on-8`: Add `paths-ignore` (e.g. (S)

### 60 Days
- `security-weak-rng-10`: Use a cryptographically secure source (BCryptGenRandom on Windows, or RAND_bytes from the already-linked OpenSSL) to generate the random MAC octets instead of srand/rand. (M)
- `code-ignores-return-value-6`: Check the snprintf return value against the buffer length and validate strtol() results (errno/endptr) in parse_hw_addr, logging and rejecting malformed input instead of silently continuing. (M)
- `code-logs-secrets-10`: Audit all blog() calls in the media callbacks and ensure no packet payloads, keys, or peer-identifying tokens are logged; gate verbose per-packet logging behind a debug flag that is off in release… (XS)
- `cost-gha-no-dependency-cache-5`: Cache deps/ (or the individual archives) with actions/cache keyed on the pinned dependency versions, and cache the libplist/UxPlay build directories so only changed sources recompile. (M)

### 90 Days
- `cost-license-incompatible-1`: Either ship the object files / build scripts needed to relink against modified LGPL components, or switch the LGPL dependencies to dynamic linking, and document the LGPL obligations in the README… (M)
- `cost-no-license-tracking-5`: Add a license-scanning step to CI (e.g. (M)
- `code-many-params-10`: Introduce a small struct (e.g. (S)
- `code-missing-return-type-8`: Declare all non-static helpers in airplay-source.h with explicit return types and add brief doc comments describing parameters and return values. (S)
- `code-print-statement-8`: Route diagnostic output through a dedicated debug log level or a runtime-configurable verbosity flag so operators can disable it without recompiling. (S)

---

## Dependencies
- `security-gha-overpermissive-2` **Depends On** `security-gha-action-unpinned-5` (blocks)
- `security-gha-job-no-timeout-7` **Depends On** `cost-gha-no-timeout-9` (blocks)
- `cost-license-incompatible-1` **Depends On** `cost-no-license-tracking-5` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
