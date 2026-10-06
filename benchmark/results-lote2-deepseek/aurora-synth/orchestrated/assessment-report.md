# Assessment Report: aurora-synth

- **Repository**: aurora-synth
- **Date**: 2026-10-05T21:16:09.713Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 1
- **Total Findings**: 28
- **By Severity**: critical 1 · high 5 · medium 19 · low 2 · info 1
- **By Module**: structure 5 · security 4 · cost 4 · performance 6 · github 9
- **Estimated Total Effort**: 4×XS, 2×S, 21×M, 1×L
- **Top 3 Priorities**:
  - `structure-layer-violation-1` — The UI state store (src/ui/app/store.js) is documented as pure logic with no DOM, yet it imports the DSP parameter schema directly from… (high, M) (score 38.5)
  - `structure-high-coupling-1` — The application entry point imports and wires nearly every subsystem at once (audio, keyboard, dom, i18n, store, controls, library,… (high, L) (score 35.75)
  - `security-gha-secret-leak-3` — The dev server generates and stores a private TLS key under `.cert/` in the repository working tree; `.gitignore` excludes `.cert/` but… (critical, XS) (score 24.5)

---

## Detailed Findings (by Priority)

### Priority 1: `structure-layer-violation-1` (score 38.5)
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 38.5
**Location**: `src/ui/app/store.js:18`
**Description**: The UI state store (src/ui/app/store.js) is documented as pure logic with no DOM, yet it imports the DSP parameter schema directly from '../../dsp/params.js' and re-implements DSP concerns (normalised-space interpolation, engine/FX gate tables, structural-change detection for osc/phys rebuilds). The UI layer reaches straight into the DSP layer instead of going through the audio bridge (src/ui/audio.js), which the architecture explicitly designates as the only UI→Synth boundary.
**Remediation**: Move the patch-blending/structural-change logic (GATES, STRUCTURAL, lerpParam, blendFilterGroup, blendModSlot) into a DSP-side module (e.g. src/dsp/patchBlend.js) and have the store consume it through the audio bridge, so the UI layer no longer imports DSP internals directly.
**Depends On**: None | **Blocks**: None

### Priority 2: `structure-high-coupling-1` (score 35.75)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.65 | **Score**: 35.75
**Location**: `src/ui/main.js:7`
**Description**: The application entry point imports and wires nearly every subsystem at once (audio, keyboard, dom, i18n, store, controls, library, presetBrowser, topbar, playView, editor, keyboardDock, modals, patchTools, fallbackVisuals, compat) and additionally dynamically imports presets, visuals, filter, fm, wavetables, phrases, demo center and automation. main.js therefore knows the concrete shape of every module, so any change to a view or helper ripples into the entry point.
**Remediation**: Introduce a composition root that receives already-constructed subsystems (or a small registry/factory per feature area) so main.js only orchestrates boot order and no longer imports each concrete module directly.
**Depends On**: None | **Blocks**: None

### Priority 3: `security-gha-secret-leak-3` (score 24.5)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.35 | **Score**: 24.5
**Location**: `tools/serve.mjs:37`
**Description**: The dev server generates and stores a private TLS key under `.cert/` in the repository working tree; `.gitignore` excludes `.cert/` but the key file is created with normal filesystem permissions and the server code reads it from a path that a misconfigured deploy or a `git add -f` could commit, exposing the private key.
**Remediation**: Keep generated keys outside the repository (e.g. under the OS temp/config dir), assert the `.cert/` ignore rule in CI, and add a pre-commit/CI check that fails if any `*.pem` private key is staged.
**Depends On**: None | **Blocks**: None

### Priority 4: `cost-no-automated-tests-4` (score 24)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 24
**Location**: `package.json:9`
**Description**: The test script is a single hand-rolled runner (`node tools/test.mjs`) with no CI workflow, no coverage gate and no automated regression detection in the repository; nothing runs the suite on push or pull request, so regressions in the DSP/preset/song suites can land unnoticed.
**Remediation**: Add a CI workflow (e.g. .github/workflows/test.yml) that runs `npm test` on every push and pull request, and publish the pass/fail status as a required check before merge.
**Depends On**: None | **Blocks**: None

### Priority 5: `security-directory-listing-8` (score 22.5)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.75 | **Score**: 22.5
**Location**: `tools/serve.mjs`
**Description**: The dev server serves an HTML directory listing for any folder that has no index.html (listing() is called from handler() when stat.isDirectory() and no index file exists). Combined with `npm run lan` (HOST=0.0.0.0), the whole project tree — including source, tools and any non-dot file — is browsable by anyone on the LAN.
**Remediation**: Disable directory listings by default (return 404 for directories without an index.html) or gate them behind an explicit --list flag that is off in --lan mode.
**Depends On**: None | **Blocks**: None

### Priority 6: `security-missing-headers-10` (score 21)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.7 | **Score**: 21
**Location**: `tools/serve.mjs`
**Description**: serveFile() sets only Content-Type, Cache-Control, Accept-Ranges, X-Content-Type-Options and Last-Modified. No Content-Security-Policy, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy or Strict-Transport-Security is emitted, so the served app (and the LAN https mode) has no browser-enforced hardening against framing, referrer leakage or injected content.
**Remediation**: Add a response header block with Content-Security-Policy (default-src 'self'), X-Frame-Options: DENY (or CSP frame-ancestors 'none'), Referrer-Policy: no-referrer and Strict-Transport-Security when serving over https.
**Depends On**: None | **Blocks**: None

### Priority 7: `security-gha-auto-deploy-prod-9` (score 19.25)
**Module**: github | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 19.25
**Location**: `wrangler.jsonc:6`
**Description**: The deploy configuration targets the production custom domain `aurora.pixbvr.com` directly, and `npm run deploy` builds and deploys in one step with no staging environment, no manual approval gate and no environment separation, so any local or automated invocation publishes straight to production.
**Remediation**: Add a staging route/environment (e.g. a `staging.aurora.pixbvr.com` route or a separate wrangler environment) and require an explicit, reviewed promotion step before the production custom domain is updated.
**Depends On**: None | **Blocks**: None

### Priority 8: `security-gha-action-unpinned-5` (score 18)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 18
**Location**: `package.json:12`
**Description**: The deploy script runs `npx wrangler deploy` without a pinned version, so the deploy tooling is fetched from the registry at run time and can resolve to any (including a compromised) release.
**Remediation**: Pin wrangler to an exact version in devDependencies (e.g. "wrangler": "3.x.y") and invoke it via the local binary instead of npx, or use `npx wrangler@<exact-version>`.
**Depends On**: None | **Blocks**: None

### Priority 9: `performance-no-load-testing-3` (score 16.8)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 16.8
**Location**: `package.json:6`
**Description**: The only test script is `node tools/test.mjs`; there is no load/stress/soak test harness anywhere in the project scripts, even though the app is a real-time AudioWorklet DSP engine whose failure mode is audio dropouts under sustained polyphony (the code itself documents 7 underruns at the first demo beat and a CPU governor that caps polyphony above 72% render load). No script exercises sustained multi-part playback, maximum polyphony, or long sessions.
**Remediation**: Add a load/soak test script (e.g. `npm run test:load`) that renders the heaviest factory songs offline at 48 kHz with maximum polyphony for several minutes, asserts the measured render load stays below the governor threshold, and fails on any underrun or dropped note.
**Depends On**: None | **Blocks**: None

### Priority 10: `performance-no-regression-detection-5` (score 16.8)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 16.8
**Location**: `package.json:6`
**Description**: `npm test` runs tools/test.mjs only; there is no benchmark or performance-regression detection step in the scripts, so a change that doubles DSP cost (e.g. in the oscillator BLEP tables, reverb FDN, or FM index clamping) would pass CI silently. The codebase contains measurable hot paths and even a profiling hook (Ensemble.profile, slot.cpuMs) that nothing in the build/test pipeline uses.
**Remediation**: Add a benchmark script that renders fixed reference patches/songs offline, records per-part CPU ms via the existing Ensemble.profile hook, stores the baseline, and fails CI when render time regresses beyond a set threshold.
**Depends On**: None | **Blocks**: None

### Priority 11: `performance-no-perf-budgets-10` (score 15.6)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 15.6
**Location**: `src/worklet/processor.js`
**Description**: The worklet measures render load (busyMs/wallFrames) and reacts to it with a CPU governor (GOV_HIGH = 0.72), but there is no declared performance budget or regression gate: no target for render load, no maximum allowed underruns, no CI check that fails when a change pushes the DSP past the budget. The governor is a runtime mitigation, not a budget.
**Remediation**: Define explicit budgets (e.g. render load < 60% at 16 voices / 48 kHz, zero underruns on the reference songs) and enforce them in CI with an offline render benchmark that fails the build when the budget is exceeded.
**Depends On**: None | **Blocks**: None

### Priority 12: `security-unmaintained-dep-4` (score 15)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 15
**Location**: `package.json:12`
**Description**: package.json declares no dependencies or devDependencies at all, so there is no lockfile and no dependency/version tracking; the only third-party code pulled in is the unpinned `npx wrangler` at deploy time, which is never audited or updated deliberately.
**Remediation**: Declare the deploy toolchain (wrangler) as a pinned devDependency, commit package-lock.json, and run `npm audit` in CI so dependency versions are tracked and reviewed.
**Depends On**: None | **Blocks**: None

### Priority 13: `performance-no-backpressure-10` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `src/worklet/processor.js`
**Description**: The main thread posts messages (noteOn/noteOff/param/patch/songLoad/warmup) to the worklet port with no backpressure or queue-depth control; `post()` in src/ui/audio.js swallows failures and never checks whether the audio thread is keeping up. A burst of parameter or note messages (e.g. dragging a knob at pointer rate, or a scripted demo) can queue unboundedly on the audio thread and add latency or cause dropouts, with no signal back to the UI to throttle.
**Remediation**: Track outstanding messages (e.g. a sequence number echoed in state messages) and throttle/coalesce UI parameter updates when the worklet falls behind; drop or merge redundant param messages instead of queueing them all.
**Depends On**: None | **Blocks**: None

### Priority 14: `security-gha-overpermissive-2` (score 14)
**Module**: github | **Severity**: high | **Effort**: XS | **Confidence**: 0.4 | **Score**: 14
**Location**: `wrangler.jsonc:6`
**Description**: The deploy uses a Cloudflare API token that must be able to publish to the production custom domain, and the repository defines no scoping or least-privilege guidance for it; a token with account-wide Workers permissions would let any contributor with access to the deploy secret modify unrelated Cloudflare resources.
**Remediation**: Document and enforce a least-privilege Cloudflare API token scoped to only the `aurora-synth` Worker and its route, stored as a protected secret, and rotate it on contributor changes.
**Depends On**: None | **Blocks**: None

### Priority 15: `performance-no-adaptive-timeout-6` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `src/ui/audio.js:29`
**Description**: The worklet handshake uses a fixed READY_TIMEOUT_MS = 6000 timeout with no adaptation to device speed or load; on a slow device where the AudioWorklet module load plus Synth construction legitimately takes longer, startup fails outright rather than extending the wait, and on a fast device the user waits the same fixed budget before any error is reported.
**Remediation**: Make the ready timeout adaptive: start with a short probe interval, extend the deadline while the worklet is still reporting progress (e.g. module loaded, processor constructed), and only fail after a bounded maximum.
**Depends On**: None | **Blocks**: None

### Priority 16: `structure-config-logic-8` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `src/ui/app/patchTools.js:16`
**Description**: patchTools.js mixes pure patch-generation logic (mutate/randomPatch) with hardcoded configuration data: MUTATE_SKIP/GENTLE/MIX/FEEDBACK regexes, ADJ/NOUN/ADJ_ZH/NOUN_ZH name tables, CAT_ZH, RECIPES and CAT_TRIM_DB gain-staging constants are embedded in the module body rather than declared as data.
**Remediation**: Extract the name word-lists, category trim table and mutation regexes into a dedicated data/config module (e.g. src/ui/app/patchTools.config.js) and import them, keeping patchTools.js limited to the generation algorithms.
**Depends On**: None | **Blocks**: None

### Priority 17: `structure-service-orchestration-3` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `src/ui/demo/jam.js:13`
**Description**: createJamPanel is a single service that orchestrates many unrelated responsibilities: it injects its own CSS, loads/persists settings from localStorage, picks backing presets, generates songs, drives the ensemble transport (songLoad/songPlay/songQueue/songPart), tracks playback state and renders the whole panel UI. Business orchestration, persistence and presentation are fused in one module.
**Remediation**: Split the jam panel into a pure generator/settings module (state + persistence + song generation) and a thin view module that renders it, delegating transport calls to the audio bridge.
**Depends On**: None | **Blocks**: None

### Priority 18: `cost-slow-build-1` (score 8.8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 8.8
**Location**: `tools/build-site.mjs:14`
**Description**: The build copies the whole `src` tree and `tools/phrases.mjs` into dist/ with fs.cpSync and then walks the output to count bytes, with no incremental or cached path; every deploy re-copies and re-stats every file even when nothing changed.
**Remediation**: Skip unchanged files by comparing mtime/size against the existing dist/ copy (or hash the source tree and short-circuit the copy), so repeat builds only touch modified files.
**Depends On**: None | **Blocks**: None

### Priority 19: `cost-gha-no-dependency-cache-5` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `package.json:12`
**Description**: The deploy script runs `npx wrangler deploy`, which resolves and downloads the wrangler package on every invocation because there is no lockfile, no node_modules and no cached toolchain; each deploy pays the full download/install cost.
**Remediation**: Pin wrangler as a devDependency with a committed lockfile (or cache the npx/wrangler install directory in CI) so the CLI is fetched once and reused across deploys.
**Depends On**: None | **Blocks**: None

### Priority 20: `cost-no-performance-budget-10` (score 7.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 7.2
**Location**: `tools/test.mjs`
**Description**: The test runner measures CPU/real-time ratios and render times but there is no enforced performance budget or regression threshold in the repo configuration; slow renders are reported, not failed, so performance can silently degrade.
**Remediation**: Define explicit budgets (e.g. max render CPU per preset, max build time, max bundle bytes) and fail the test suite when a measured value exceeds its budget.
**Depends On**: None | **Blocks**: None

### Priority 21: `security-gha-job-no-timeout-7` (score 5.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 5.6
**Location**: `package.json:9`
**Description**: The deploy script performs a network install plus an upload with no timeout or retry bound; a hung `npx wrangler deploy` (network stall, API outage) will block the job indefinitely instead of failing fast.
**Remediation**: Wrap the deploy step with a bounded timeout (e.g. `timeout 300 npx wrangler deploy` or a CI `timeout-minutes` on the job) so a stalled deploy fails and can be retried rather than hanging.
**Depends On**: None | **Blocks**: None

### Priority 22: `security-gha-no-concurrency-prod-10` (score 5.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 5.6
**Location**: `package.json:9`
**Description**: The deploy command has no concurrency control or lock: two overlapping `npm run deploy` invocations (e.g. a manual run during an automated one) can race, each rebuilding `dist/` and uploading assets, leaving production in an indeterminate state.
**Remediation**: Guard deploys with a lock or a CI concurrency group (e.g. `concurrency: { group: deploy-prod, cancel-in-progress: false }` in the workflow, or a lockfile check in the deploy script) so only one production deployment runs at a time.
**Depends On**: None | **Blocks**: None

### Priority 23: `security-gha-workspace-not-cleaned-6` (score 4.9)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.35 | **Score**: 4.9
**Location**: `tools/build-site.mjs:13`
**Description**: The build deletes and recreates `dist/` in the working tree and copies the whole `src` tree into it, but nothing cleans the workspace afterwards; on a shared or self-hosted runner the generated `dist/` (and any credentials left in the environment) persists between jobs.
**Remediation**: Clean the workspace after deploy (remove `dist/` and any generated artifacts) or run the deploy in an ephemeral container/runner so build output and environment state do not leak into subsequent jobs.
**Depends On**: None | **Blocks**: None

### Priority 24: `github-commit-history-1` (score 4.2)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.3 | **Score**: 4.2
**Location**: `README.md`
**Description**: The repository documents a large, feature-complete project (100 presets, 6 demo songs, video pipeline, 47-agent build) but the provided history surface shows no evidence of a conventional commit history, changelog or release tagging discipline, making it hard to audit what changed between versions.
**Remediation**: Adopt a documented commit convention (e.g. Conventional Commits) and maintain a CHANGELOG.md plus git tags for releases so changes between published versions are auditable.
**Depends On**: None | **Blocks**: None

### Priority 25: `github-issue-health-1` (score 4.2)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.3 | **Score**: 4.2
**Location**: `README.md`
**Description**: The README provides no issue template, contribution guide or support/contact path, so bug reports and feature requests arrive unstructured and cannot be triaged consistently.
**Remediation**: Add `.github/ISSUE_TEMPLATE/` (bug report + feature request) and a CONTRIBUTING.md describing how to report issues, including the required environment details (browser, Node version, sample rate).
**Depends On**: None | **Blocks**: None

### Priority 26: `performance-no-slo-6` (score 3.6)
**Module**: performance | **Severity**: low | **Effort**: M | **Confidence**: 0.6 | **Score**: 3.6
**Location**: `src/worklet/processor.js`
**Description**: The audio engine has no documented service-level objective: no stated target for maximum render load, maximum acceptable underrun rate, or maximum startup/warm-up latency. The 72% governor threshold, the 16-quantum warm-up and the 6 s ready timeout exist as constants but are not tied to any declared SLO that could be monitored or alerted on.
**Remediation**: Document and instrument an SLO for the audio path (e.g. p99 render load < 70%, zero underruns per 10-minute session, ready within 2 s) and surface it in the state messages so it can be monitored.
**Depends On**: None | **Blocks**: None

### Priority 27: `structure-dto-logic-7` (score 3.03)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.55 | **Score**: 3.03
**Location**: `src/ui/demo/songsView.js:23`
**Description**: songsView.js carries song-definition parsing/derivation logic (noteEvents normalising sequencer events and tuple forms, songScale/keyLabel key parsing, descOf language resolution) inside the view module, so the view both transforms the song DTO and renders it.
**Remediation**: Move the song DTO normalisation helpers (noteEvents, songScale, keyLabel, descOf) into a shared demo/song-utils module and have the view import them, keeping the view limited to rendering.
**Depends On**: None | **Blocks**: None

### Priority 28: `github-log-pattern-1` (score 0.24)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.35 | **Score**: 0.24
**Location**: `tools/test.mjs`
**Description**: The test runner prints results to stdout with ad-hoc formatting and only writes a machine-readable report when `--json report.json` is passed; without it, CI logs contain no structured, parseable test output, so failures cannot be aggregated or trended.
**Remediation**: Always emit a structured report (JUnit XML or JSON) from the test runner and upload it as a CI artifact, so test results are machine-readable and can be tracked over time.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `structure-layer-violation-1`: Move the patch-blending/structural-change logic (GATES, STRUCTURAL, lerpParam, blendFilterGroup, blendModSlot) into a DSP-side module (e.g. (M)
- `structure-high-coupling-1`: Introduce a composition root that receives already-constructed subsystems (or a small registry/factory per feature area) so main.js only orchestrates boot order and no longer imports each concrete… (L)
- `security-gha-secret-leak-3`: Keep generated keys outside the repository (e.g. (XS)
- `cost-no-automated-tests-4`: Add a CI workflow (e.g. (M)
- `security-directory-listing-8`: Disable directory listings by default (return 404 for directories without an index.html) or gate them behind an explicit --list flag that is off in --lan mode. (XS)
- `security-missing-headers-10`: Add a response header block with Content-Security-Policy (default-src 'self'), X-Frame-Options: DENY (or CSP frame-ancestors 'none'), Referrer-Policy: no-referrer and Strict-Transport-Security when… (S)
- `security-gha-auto-deploy-prod-9`: Add a staging route/environment (e.g. (M)
- `security-gha-action-unpinned-5`: Pin wrangler to an exact version in devDependencies (e.g. (M)
- `performance-no-load-testing-3`: Add a load/soak test script (e.g. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `performance-no-regression-detection-5`: Add a benchmark script that renders fixed reference patches/songs offline, records per-part CPU ms via the existing Ensemble.profile hook, stores the baseline, and fails CI when render time… (M)
- `performance-no-perf-budgets-10`: Define explicit budgets (e.g. (M)
- `security-unmaintained-dep-4`: Declare the deploy toolchain (wrangler) as a pinned devDependency, commit package-lock.json, and run `npm audit` in CI so dependency versions are tracked and reviewed. (M)
- `performance-no-backpressure-10`: Track outstanding messages (e.g. (M)
- `security-gha-overpermissive-2`: Document and enforce a least-privilege Cloudflare API token scoped to only the `aurora-synth` Worker and its route, stored as a protected secret, and rotate it on contributor changes. (XS)
- `performance-no-adaptive-timeout-6`: Make the ready timeout adaptive: start with a short probe interval, extend the deadline while the worklet is still reporting progress (e.g. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `structure-config-logic-8`: Extract the name word-lists, category trim table and mutation regexes into a dedicated data/config module (e.g. (M)
- `structure-service-orchestration-3`: Split the jam panel into a pure generator/settings module (state + persistence + song generation) and a thin view module that renders it, delegating transport calls to the audio bridge. (M)
- `cost-slow-build-1`: Skip unchanged files by comparing mtime/size against the existing dist/ copy (or hash the source tree and short-circuit the copy), so repeat builds only touch modified files. (M)
- `cost-gha-no-dependency-cache-5`: Pin wrangler as a devDependency with a committed lockfile (or cache the npx/wrangler install directory in CI) so the CLI is fetched once and reused across deploys. (M)
- `cost-no-performance-budget-10`: Define explicit budgets (e.g. (M)
- `security-gha-job-no-timeout-7`: Wrap the deploy step with a bounded timeout (e.g. (M)
- `security-gha-no-concurrency-prod-10`: Guard deploys with a lock or a CI concurrency group (e.g. (M)
- `security-gha-workspace-not-cleaned-6`: Clean the workspace after deploy (remove `dist/` and any generated artifacts) or run the deploy in an ephemeral container/runner so build output and environment state do not leak into subsequent jobs. (M)
- `github-commit-history-1`: Adopt a documented commit convention (e.g. (M)
- `github-issue-health-1`: Add `.github/ISSUE_TEMPLATE/` (bug report + feature request) and a CONTRIBUTING.md describing how to report issues, including the required environment details (browser, Node version, sample rate). (M)
- `performance-no-slo-6`: Document and instrument an SLO for the audio path (e.g. (M)
- `structure-dto-logic-7`: Move the song DTO normalisation helpers (noteEvents, songScale, keyLabel, descOf) into a shared demo/song-utils module and have the view import them, keeping the view limited to rendering. (S)
- `github-log-pattern-1`: Always emit a structured report (JUnit XML or JSON) from the test runner and upload it as a CI artifact, so test results are machine-readable and can be tracked over time. (XS)
**Total Effort**: XL

---

## Dependencies
- —

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
