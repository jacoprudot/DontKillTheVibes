# Assessment Report: holo-gestures

- **Repository**: holo-gestures
- **Date**: 2026-10-05T20:41:24.478Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 5
- **Total Findings**: 39
- **By Severity**: critical 5 · high 6 · medium 23 · low 4 · info 1
- **By Module**: code 4 · structure 3 · flows 8 · security 5 · cost 7 · performance 3 · github 9
- **Estimated Total Effort**: 7×XS, 6×S, 25×M, 1×L
- **Top 3 Priorities**:
  - `code-bare-except-1` — `notes_dir()` wraps config loading in a bare `except Exception: pass`, silently swallowing every failure (malformed JSON, permission… (critical, XS) (score 90)
  - `security-logs-contain-secrets-12` — The /api/diag and /api/state handlers persist the entire client-supplied JSON payload to disk (state/holo-diag.json,… (critical, XS) (score 75)
  - `flows-fire-and-forget-critical-1` — The state write is fire-and-forget: the tmp-file write and os.replace are wrapped in `except OSError: pass`, and the handler returns… (critical, M) (score 60)

---

## Detailed Findings (by Priority)

### Priority 1: `code-bare-except-1` (score 90)
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.9 | **Score**: 90
**Location**: `server.py:31`
**Description**: `notes_dir()` wraps config loading in a bare `except Exception: pass`, silently swallowing every failure (malformed JSON, permission errors, unexpected bugs) and falling back to sample-notes with no signal that the user's configured folder was ignored.
**Remediation**: Catch only the expected exceptions (json.JSONDecodeError, OSError) and log the failure, e.g. `except (OSError, json.JSONDecodeError) as e: print(f'holo.json unreadable: {e}', file=sys.stderr)` before falling back.
**Depends On**: None | **Blocks**: None

### Priority 2: `security-logs-contain-secrets-12` (score 75)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.5 | **Score**: 75
**Location**: `server.py:137`
**Description**: The /api/diag and /api/state handlers persist the entire client-supplied JSON payload to disk (state/holo-diag.json, state/holo-state.json) without filtering. If the page ever includes tokens, session data, or other sensitive fields in its crash/state reports, they are written to disk in cleartext and retained.
**Remediation**: Whitelist the fields that are persisted (e.g. only known diagnostic keys) and strip or redact anything that looks like a credential, token, or secret before writing to state/*.json.
**Depends On**: None | **Blocks**: None

### Priority 3: `flows-fire-and-forget-critical-1` (score 60)
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.6 | **Score**: 60
**Location**: `server.py:131`
**Description**: The state write is fire-and-forget: the tmp-file write and os.replace are wrapped in `except OSError: pass`, and the handler returns {"ok": True} even when the write failed. The caller (the deck page) has no way to learn that the state transition it reported was never persisted, so a dropped write is silently lost.
**Remediation**: Propagate write failures to the caller: return a non-2xx status with an error body when the tmp write or os.replace raises, and log the OSError so the failure is observable rather than swallowed.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 4: `flows-missing-idempotency-3` (score 60)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.6 | **Score**: 60
**Location**: `server.py:126`
**Description**: POST /api/state is a state-mutating endpoint with no idempotency key or deduplication: each request overwrites state/holo-state.json and stamps a fresh `data["ts"] = time.time()`. A retried or duplicated delivery (network retry, double gesture event) is applied again as a distinct state transition rather than being recognised as the same command.
**Remediation**: Accept an Idempotency-Key header (or a client-supplied event id) on POST /api/state, persist the last processed keys, and return the previous result without re-writing state when a duplicate key arrives.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 5: `security-no-input-validation-14` (score 48.75)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.65 | **Score**: 48.75
**Location**: `server.py:137`
**Description**: do_POST reads the request body and passes it straight to json.loads with no size limit, no schema validation, and no type checking before writing it to state/holo-state.json and state/holo-diag.json. A client can post an arbitrarily large body (Content-Length is trusted) or arbitrary JSON structure, which is persisted verbatim.
**Remediation**: Cap the accepted Content-Length (reject bodies over a small limit), validate that the parsed payload is a JSON object with expected keys/types, and reject or truncate anything that does not match the expected schema before persisting.
**Depends On**: None | **Blocks**: None

### Priority 6: `code-missing-validation-4` (score 37.5)
**Module**: code | **Severity**: high | **Effort**: M | **Confidence**: 0.75 | **Score**: 37.5
**Location**: `server.py:156`
**Description**: `/api/diag` and `/api/state` read `Content-Length` and pass the raw body straight to `json.loads` with no size cap, content-type check, or schema validation; an arbitrarily large body is read into memory and any JSON shape is accepted and persisted.
**Remediation**: Cap the accepted body size (reject Content-Length above e.g. 64 KB with 413), verify the Content-Type is application/json, and validate the parsed object against an expected schema before writing it.
**Depends On**: None | **Blocks**: None

### Priority 7: `security-debug-in-prod-1` (score 37.5)
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.5 | **Score**: 37.5
**Location**: `server.py:137`
**Description**: The /api/diag endpoint accepts arbitrary client crash reports and writes them to state/holo-diag.json with no authentication and no gating. This diagnostic surface is always enabled in the shipped server rather than being limited to a debug mode.
**Remediation**: Gate the /api/diag endpoint behind an explicit debug flag (e.g. HOLO_DEBUG=1) or remove it from the default build so diagnostic ingestion is not exposed in normal operation.
**Depends On**: None | **Blocks**: None

### Priority 8: `security-gha-secret-leak-3` (score 24.5)
**Module**: github | **Severity**: critical | **Effort**: XS | **Confidence**: 0.35 | **Score**: 24.5
**Location**: `server.py`
**Description**: The repository ships a self-hosted MediaPipe/three.js vendor bundle and a server that serves arbitrary files under vendor/ and props/, but there is no CI workflow, no secret scanning, and no dependency/secret maintenance configuration anywhere in the provided files. The README instructs users to re-download MediaPipe and re-apply a local wasm shim, which means third-party binaries are vendored into the repo without any automated provenance or secret-leak check.
**Remediation**: Add a GitHub Actions workflow that runs gitleaks/trufflehog on every push and PR, pins the vendored MediaPipe/three.js artifacts to a checksummed release, and documents the exact upstream commit for each vendor file.
**Depends On**: None | **Blocks**: None

### Priority 9: `cost-license-share-alike-3` (score 24)
**Module**: cost | **Severity**: high | **Effort**: L | **Confidence**: 0.6 | **Score**: 24
**Location**: `LICENSE:1`
**Description**: The project is declared MIT while it redistributes Apache-2.0 licensed MediaPipe code in vendor/. The MIT declaration alone does not cover the vendored Apache-2.0 components, creating a mixed-license distribution where the Apache-2.0 obligations (NOTICE, license retention, patent grant) apply to the bundled files but are not reflected in the repository's licensing documentation.
**Remediation**: Document the per-directory licensing explicitly (e.g. a vendor/LICENSE or LICENSE-APACHE-2.0 plus a NOTICE file) so the Apache-2.0 terms governing vendor/ are clearly separated from the MIT-licensed original code.
**Depends On**: None | **Blocks**: None

### Priority 10: `cost-no-automated-tests-4` (score 24)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 24
**Location**: `README.md:24`
**Description**: The README describes the entire verification workflow as manually opening ?probe=1 in a browser and eyeballing '26/26'. There is no automated test suite, no CI configuration, and no scripted way to run the probe battery, so regressions depend on a human remembering to run a manual in-browser check.
**Remediation**: Add an automated test runner (e.g. a headless-browser script that loads ?probe=1 and asserts the 26/26 result) and wire it into CI so the gesture engine is verified on every change without manual steps.
**Depends On**: None | **Blocks**: None

### Priority 11: `security-missing-headers-10` (score 21)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.7 | **Score**: 21
**Location**: `server.py:78`
**Description**: The _send helper emits only Content-Type, Cache-Control (for HTML) and Content-Length. No security headers are set on any response: no X-Content-Type-Options: nosniff, no Content-Security-Policy, no X-Frame-Options/frame-ancestors, and no Referrer-Policy. The page loads third-party-derived JS/wasm and renders user note content, so the absence of CSP and nosniff weakens the browser's defenses.
**Remediation**: Add security headers in _send: X-Content-Type-Options: nosniff, a restrictive Content-Security-Policy (default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'), X-Frame-Options: DENY, and Referrer-Policy: no-referrer.
**Depends On**: None | **Blocks**: None

### Priority 12: `cost-dev-setup-missing-3` (score 20)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.5 | **Score**: 20
**Location**: `README.md:21`
**Description**: Onboarding relies on a single clone-and-run command with no documented development setup: no guidance on running the probe battery in CI, no linting/formatting setup, no contribution workflow, and no explanation of the gesture-threshold constants beyond a one-line mention. New contributors must reverse-engineer the workflow from the README prose.
**Remediation**: Add a DEVELOPMENT.md (or README section) covering local setup, how to run ?probe=1 and ?sim=1, the meaning of the gesture threshold constants, and the expected contribution/verification workflow.
**Depends On**: None | **Blocks**: None

### Priority 13: `performance-io-bound-sync-2` (score 19.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 19.2
**Location**: `server.py:70`
**Description**: The request handler performs blocking synchronous file I/O on every request: load_notes() and load_tree() call os.listdir plus open().read() for each note file (up to 18 notes / 14 files per folder) directly inside the ThreadingHTTPServer handler thread. Each /api/notes or /api/tree request re-reads and re-parses every markdown file from disk synchronously, so latency scales with the number of notes and disk speed, and concurrent requests each repeat the full scan.
**Remediation**: Cache the parsed notes/tree in memory with an mtime-based invalidation (or a short TTL), and/or move the directory scan and file reads off the request path into a background refresh so handlers serve pre-built JSON instead of doing synchronous disk I/O per request.
**Depends On**: None | **Blocks**: None

### Priority 14: `performance-no-compression-13` (score 18)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 18
**Location**: `server.py:88`
**Description**: _send() writes the response body with only Content-Type and Content-Length headers; no Content-Encoding is ever negotiated. The HTML page, JSON note payloads (bodies up to 420/4000 chars each) and the self-hosted vendor JS/WASM assets are all served uncompressed, inflating transfer size and parse time on every load.
**Remediation**: Add gzip/deflate response compression (e.g. gzip.compress on text/html, application/json and text/javascript bodies when the client sends Accept-Encoding: gzip) and set the Content-Encoding header accordingly.
**Depends On**: None | **Blocks**: None

### Priority 15: `security-directory-listing-8` (score 18)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.6 | **Score**: 18
**Location**: `server.py:113`
**Description**: The /vendor/ and /props/ static file handler serves any file under those directories based on the raw request path, with only a normpath/".." check. There is no allowlist of extensions or filenames, so any file placed in vendor/ or props/ (or reachable via the normalized path) is served to any client that can reach the server.
**Remediation**: Restrict the static handler to an explicit allowlist of extensions (e.g. .mjs, .js, .wasm, .glb) and reject anything else with 404; also resolve the final path with os.path.realpath and verify it is contained within the intended vendor/props directory before serving.
**Depends On**: None | **Blocks**: None

### Priority 16: `code-catch-and-continue-9` (score 17)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 17
**Location**: `server.py:178`
**Description**: The state write is wrapped in `try: ... except OSError: pass` and the handler unconditionally returns `{"ok": true}`; a failed disk write (full disk, permissions) is swallowed and the client is told the state was saved when it was not.
**Remediation**: On OSError, return a 500 with the error detail (or at minimum log it) so the caller knows the state was not persisted, instead of reporting success.
**Depends On**: None | **Blocks**: None

### Priority 17: `structure-config-logic-8` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `server.py:31`
**Description**: Configuration loading and resolution logic (reading holo.json, expanding the folder path, validating the directory, and falling back to sample-notes) is embedded directly in the HTTP server module rather than being isolated in a dedicated configuration component. This couples the request-handling layer to filesystem/config concerns and makes the config source hard to swap or test independently.
**Remediation**: Extract config loading into a separate module (e.g. config.py) exposing a load_config() function that returns a resolved settings object; have server.py import and consume it instead of reading holo.json inline.
**Depends On**: None | **Blocks**: `flows-missing-cors-9`, `flows-missing-rate-limit-8`, `flows-missing-request-id-7`, `flows-missing-security-headers-10`, `flows-error-leaks-stack-6`, `flows-missing-idempotency-3`, `flows-missing-timeout-6`, `flows-fire-and-forget-critical-1`

### Priority 18: `performance-no-keep-alive-9` (score 14.4)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 14.4
**Location**: `server.py:88`
**Description**: _send() sets Content-Length but never sets Connection: keep-alive or the HTTP/1.1 protocol version explicitly, and the handler does not manage persistent connections. The page pulls the HTML plus multiple vendor JS/WASM/GLB assets, so each asset can incur a fresh TCP connection and handshake instead of reusing one connection.
**Remediation**: Serve HTTP/1.1 with explicit Connection: keep-alive (and a bounded idle timeout) so the browser can reuse a single TCP connection for the page and all vendor/props assets.
**Depends On**: None | **Blocks**: None

### Priority 19: `structure-controller-logic-6` (score 14.3)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 14.3
**Location**: `server.py:96`
**Description**: The do_GET handler is a single controller method that inlines routing, static-file serving, path-traversal guarding, MIME resolution, directory listing for props, and JSON serialization of notes/tree. Business and I/O logic is embedded directly in the HTTP controller instead of being delegated to dedicated handlers/services, making the routing layer hard to test and extend.
**Remediation**: Move each route's logic into dedicated handler functions or a small router/service layer (e.g. serve_page(), serve_static(), notes_service.list()), leaving do_GET to only dispatch based on the parsed path.
**Depends On**: None | **Blocks**: None

### Priority 20: `flows-missing-rate-limit-8` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `server.py:126`
**Description**: do_POST accepts unlimited requests to /api/diag and /api/state with no rate limiting, throttling or request-size cap beyond the client-supplied Content-Length. A local or cross-origin caller can flood the endpoints, forcing a disk write (state/holo-diag.json, state/holo-state.json) on every request.
**Remediation**: Enforce a per-client request rate limit (token bucket keyed on client address) and cap the accepted Content-Length (e.g. reject bodies over 64 KB) before reading and persisting them.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 21: `structure-service-sql-5` (score 13.2)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 13.2
**Location**: `server.py:37`
**Description**: The _note() helper mixes data-access concerns (opening and reading note files from disk) with presentation/formatting logic (deriving the title, stripping markdown headers, truncating body and full text). This is data-access logic leaking into what should be a thin service/formatting layer, making the file-reading path and the formatting rules impossible to change or test independently.
**Remediation**: Split _note() into a repository function that only reads raw file content and a separate formatter/service function that derives title/body/full from that content, so each concern can evolve and be tested on its own.
**Depends On**: None | **Blocks**: None

### Priority 22: `flows-error-leaks-stack-6` (score 13)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.65 | **Score**: 13
**Location**: `server.py:122`
**Description**: The POST handlers swallow every exception with a bare `except Exception: data = {}` and then return {"ok": True} regardless of whether the body was valid JSON or the state write succeeded. The client is told the operation succeeded even when parsing or persistence failed, so failures are invisible and cannot be diagnosed from the response.
**Remediation**: Distinguish parse failures from write failures: return HTTP 400 with a generic error message for malformed JSON and HTTP 500 when the state file cannot be written, and log the exception server-side without exposing internals to the client.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 23: `flows-missing-timeout-6` (score 13)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 13
**Location**: `server.py:128`
**Description**: The POST handlers read the request body with `self.rfile.read(n)` where n comes straight from the Content-Length header, with no socket timeout configured on the handler or the ThreadingHTTPServer. A client that announces a large Content-Length and then stalls holds a worker thread indefinitely, and enough such connections exhaust the thread pool.
**Remediation**: Set a socket timeout on the server (e.g. H.timeout = 10 and ThreadingHTTPServer.timeout) and cap the accepted Content-Length before calling rfile.read so a slow or stalled client cannot pin a worker thread.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 24: `code-ignores-return-value-6` (score 12)
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 12
**Location**: `server.py:135`
**Description**: In `do_GET`, `self._send(200, body, "text/html; charset=utf-8")` is returned but the earlier `return self._send(500, ...)` path shows the pattern; more importantly the `_send` call for the 404 fallback at the end of the vendor branch is returned while the inner `except OSError: pass` discards the read failure and falls through to a generic 404, masking the real error.
**Remediation**: Distinguish a missing file (404) from a read failure (500) by logging the OSError and returning an explicit 500 response instead of silently falling through to the generic 404.
**Depends On**: None | **Blocks**: None

### Priority 25: `cost-license-attribution-missing-2` (score 11.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 11.2
**Location**: `LICENSE:27`
**Description**: The repo bundles third-party components (Google MediaPipe Tasks Vision, three.js) in vendor/ and redistributes them, but the LICENSE file only lists component names and license names without including the full Apache-2.0 license text or the required copyright/NOTICE attribution for the bundled Apache-2.0 MediaPipe code. Apache-2.0 redistribution requires retaining the license text and NOTICE, and the README even documents that the vendored wasm glue was modified (HOLO SHIM) without a modification notice.
**Remediation**: Add the full Apache-2.0 license text and Google's NOTICE/copyright for the vendored MediaPipe files under vendor/, and add a modification notice for the HOLO SHIM changes, so redistribution complies with Apache-2.0 attribution requirements.
**Depends On**: None | **Blocks**: None

### Priority 26: `cost-documentation-poor-7` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `server.py:12`
**Description**: The server exposes several endpoints (/api/notes, /api/tree, /api/props, /api/diag, /api/state, /vendor/, /props/) but only the top-of-file docstring documents a subset of them, and the README documents none of the HTTP API. The /api/diag and /api/state write paths and the /vendor//props/ static-serving behavior are undocumented for consumers.
**Remediation**: Document every HTTP endpoint (method, path, request/response shape, and side effects such as writing state/holo-state.json) in the README or a dedicated API doc so the server contract is discoverable.
**Depends On**: None | **Blocks**: None

### Priority 27: `cost-no-license-tracking-5` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `LICENSE`
**Description**: Third-party dependencies are vendored directly into the repository (vendor/ MediaPipe and three.js, props/ Smithsonian models) with no machine-readable license manifest or dependency-tracking file, so there is no automated way to audit which licenses are present or detect when attribution obligations change on update.
**Remediation**: Add a dependency/license manifest (e.g. a generated THIRD_PARTY_LICENSES file or SBOM) listing each vendored component, its version, license, and source, and regenerate it when dependencies are updated.
**Depends On**: None | **Blocks**: None

### Priority 28: `cost-no-oss-policy-9` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `README.md`
**Description**: The project self-hosts and redistributes third-party dependencies (MediaPipe, three.js) and ships Smithsonian CC0 models, but there is no documented open-source policy or dependency-license review process describing how third-party components are vetted, attributed, or updated. The README only mentions licenses in passing.
**Remediation**: Add a short OSS/dependency policy section (or CONTRIBUTING/DEPENDENCIES doc) that records each third-party component, its license, its source URL, and the process for reviewing and updating vendored dependencies.
**Depends On**: None | **Blocks**: None

### Priority 29: `security-cors-wildcard-2` (score 7)
**Module**: github | **Severity**: medium | **Effort**: XS | **Confidence**: 0.5 | **Score**: 7
**Location**: `server.py`
**Description**: The HTTP handler sets no CORS headers and performs no Origin validation on state-changing POSTs to /api/state and /api/diag. Because the server listens on 127.0.0.1, any web page the user visits can issue a cross-origin POST to these endpoints (simple request, no preflight) and overwrite state/holo-state.json or state/holo-diag.json.
**Remediation**: Reject POSTs whose Origin/Referer is not the local deck, require a custom header (which forces a preflight) or a per-boot CSRF token, and return 403 otherwise.
**Depends On**: None | **Blocks**: None

### Priority 30: `security-gha-job-no-timeout-7` (score 7)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 7
**Location**: `server.py`
**Description**: server.py runs a ThreadingHTTPServer with no request timeout, no read timeout, and no maximum request body size; do_POST reads `Content-Length` bytes straight from the socket. A slow or oversized POST to /api/state or /api/diag can hold a worker thread indefinitely. No CI job timeout exists either, since no workflow is present.
**Remediation**: Set `timeout` on the handler (e.g. `BaseHTTPRequestHandler.timeout = 10`), reject Content-Length above a small cap, and add `timeout-minutes` to any CI job that is introduced.
**Depends On**: None | **Blocks**: None

### Priority 31: `security-no-security-maintenance-7` (score 6.3)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 6.3
**Location**: `README.md`
**Description**: The repository has no SECURITY.md, no dependabot/renovate configuration, and no documented vulnerability-reporting process, despite vendoring third-party binaries (MediaPipe wasm glue, three.js) that the README itself says must be manually patched after re-download. There is no mechanism to learn about or ship security updates for those vendored components.
**Remediation**: Add a SECURITY.md with a private disclosure channel and enable Dependabot (or Renovate) for the vendored JS/wasm artifacts and any future package manifests.
**Depends On**: None | **Blocks**: None

### Priority 32: `github-commit-history-1` (score 5.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 5.6
**Location**: `README.md`
**Description**: The README documents a workflow of `git pull` on a moving branch with no release tags, no CHANGELOG, and no versioned releases, so users cannot pin to a known-good revision and there is no auditable history of what changed between installs.
**Remediation**: Cut tagged releases (semver) for the deck, add a CHANGELOG.md, and instruct users to check out a tag rather than pulling the default branch.
**Depends On**: None | **Blocks**: None

### Priority 33: `github-issue-health-1` (score 5.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 5.6
**Location**: `README.md`
**Description**: The repository provides no issue templates, no contribution guide, and no documented support channel other than an external community link, so bug reports about the vendored MediaPipe shim or the probe battery have no structured intake path.
**Remediation**: Add .github/ISSUE_TEMPLATE/bug_report.md and feature_request.md, plus a CONTRIBUTING.md describing how to run `?probe=1` and report the 26/26 result.
**Depends On**: None | **Blocks**: None

### Priority 34: `security-gha-action-unpinned-5` (score 5.6)
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 5.6
**Location**: `README.md:21`
**Description**: The README's install instructions rely on `git clone`/`git pull` of a moving branch and `npx @gltf-transform/cli copy in.glb out.glb`, which fetches and executes an unpinned npm package at run time. There is no lockfile, no pinned version, and no CI workflow pinning actions to commit SHAs, so a compromised upstream release executes on the user's machine.
**Remediation**: Pin the gltf-transform CLI to an exact version (e.g. `npx @gltf-transform/cli@4.0.0`) and, if CI is added, pin every GitHub Action to a full commit SHA rather than a mutable tag.
**Depends On**: None | **Blocks**: None

### Priority 35: `flows-missing-cors-9` (score 3.75)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.75 | **Score**: 3.75
**Location**: `server.py:88`
**Description**: The HTTP server sends no Access-Control-Allow-Origin or any CORS headers on any response (the _send helper only sets Content-Type, Cache-Control and Content-Length). Any web page the user visits can issue cross-origin requests to http://localhost:4890/api/state, /api/diag, /api/notes and /api/tree; the POST endpoints accept JSON bodies and write to disk, so a malicious page can silently drive the deck's state hook.
**Remediation**: Add explicit CORS handling in _send: emit Access-Control-Allow-Origin with a strict allowlist (e.g. http://localhost:4890 only), handle OPTIONS preflight, and reject requests whose Origin header is not the local deck origin.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 36: `flows-missing-request-id-7` (score 3.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.7 | **Score**: 3.5
**Location**: `server.py:88`
**Description**: Responses carry no correlation identifier: _send writes only Content-Type, Cache-Control and Content-Length, and neither do_GET nor do_POST reads or echoes an X-Request-ID header. With ThreadingHTTPServer handling requests concurrently, the quiet log_message override means there is no way to correlate a client-side failure with a server-side event.
**Remediation**: Read an incoming X-Request-ID header (or generate a UUID when absent), include it in every response via _send, and log it alongside the request path and status code.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 37: `flows-missing-security-headers-10` (score 3.5)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.7 | **Score**: 3.5
**Location**: `server.py:91`
**Description**: The HTML response for / and /holo.html sets only Content-Type and Cache-Control; no X-Content-Type-Options, Content-Security-Policy, X-Frame-Options or Referrer-Policy headers are emitted. The page loads self-hosted wasm/JS and renders camera-derived content, so the absence of a CSP and nosniff leaves the deck without defence-in-depth against injected or mis-sniffed content.
**Remediation**: In _send, add X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: no-referrer and a Content-Security-Policy that allows only 'self' plus the inline styles/scripts the deck actually needs.
**Depends On**: `structure-config-logic-8` | **Blocks**: None

### Priority 38: `security-vcs-insecure-9` (score 1.57)
**Module**: github | **Severity**: low | **Effort**: M | **Confidence**: 0.45 | **Score**: 1.57
**Location**: `.gitignore`
**Description**: .gitignore excludes state/, server.log, and __pycache__/ but does not exclude local configuration or generated artifacts that may contain user paths or note content. holo.json is committed with an empty folder value, and any local edit pointing at a private notes directory would be tracked by git and pushed to the public repository.
**Remediation**: Ignore holo.json (or a holo.local.json override), add a holo.json.example template, and ignore any state/ or log artifacts that could contain note text or filesystem paths.
**Depends On**: None | **Blocks**: None

### Priority 39: `github-log-pattern-1` (score 0.39)
**Module**: github | **Severity**: info | **Effort**: XS | **Confidence**: 0.55 | **Score**: 0.39
**Location**: `server.py`
**Description**: The handler overrides log_message to silence all request logging, and the only startup output is a single print of the port and notes directory. There is no structured logging, no request IDs, and no error logging, so failures in /api/notes, /api/tree, or the state writers are invisible.
**Remediation**: Emit structured JSON logs with a request id for each request, log exceptions from the OSError handlers instead of swallowing them, and keep a rotating server.log (already gitignored).
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `code-bare-except-1`: Catch only the expected exceptions (json.JSONDecodeError, OSError) and log the failure, e.g. (XS)
- `security-logs-contain-secrets-12`: Whitelist the fields that are persisted (e.g. (XS)
- `flows-fire-and-forget-critical-1`: Propagate write failures to the caller: return a non-2xx status with an error body when the tmp write or os.replace raises, and log the OSError so the failure is observable rather than swallowed. (M)
- `flows-missing-idempotency-3`: Accept an Idempotency-Key header (or a client-supplied event id) on POST /api/state, persist the last processed keys, and return the previous result without re-writing state when a duplicate key… (S)
- `security-no-input-validation-14`: Cap the accepted Content-Length (reject bodies over a small limit), validate that the parsed payload is a JSON object with expected keys/types, and reject or truncate anything that does not match… (M)
- `code-missing-validation-4`: Cap the accepted body size (reject Content-Length above e.g. (M)
- `security-debug-in-prod-1`: Gate the /api/diag endpoint behind an explicit debug flag (e.g. (XS)
- `security-gha-secret-leak-3`: Add a GitHub Actions workflow that runs gitleaks/trufflehog on every push and PR, pins the vendored MediaPipe/three.js artifacts to a checksummed release, and documents the exact upstream commit for… (XS)
- `cost-license-share-alike-3`: Document the per-directory licensing explicitly (e.g. (L)
- `cost-no-automated-tests-4`: Add an automated test runner (e.g. (M)
- `security-missing-headers-10`: Add security headers in _send: X-Content-Type-Options: nosniff, a restrictive Content-Security-Policy (default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'),… (S)
- `cost-dev-setup-missing-3`: Add a DEVELOPMENT.md (or README section) covering local setup, how to run ?probe=1 and ?sim=1, the meaning of the gesture threshold constants, and the expected contribution/verification workflow. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `performance-io-bound-sync-2`: Cache the parsed notes/tree in memory with an mtime-based invalidation (or a short TTL), and/or move the directory scan and file reads off the request path into a background refresh so handlers… (M)
- `performance-no-compression-13`: Add gzip/deflate response compression (e.g. (M)
- `security-directory-listing-8`: Restrict the static handler to an explicit allowlist of extensions (e.g. (XS)
- `code-catch-and-continue-9`: On OSError, return a 500 with the error detail (or at minimum log it) so the caller knows the state was not persisted, instead of reporting success. (M)
- `structure-config-logic-8`: Extract config loading into a separate module (e.g. (M)
- `performance-no-keep-alive-9`: Serve HTTP/1.1 with explicit Connection: keep-alive (and a bounded idle timeout) so the browser can reuse a single TCP connection for the page and all vendor/props assets. (M)
- `structure-controller-logic-6`: Move each route's logic into dedicated handler functions or a small router/service layer (e.g. (M)
- `flows-missing-rate-limit-8`: Enforce a per-client request rate limit (token bucket keyed on client address) and cap the accepted Content-Length (e.g. (M)
- `structure-service-sql-5`: Split _note() into a repository function that only reads raw file content and a separate formatter/service function that derives title/body/full from that content, so each concern can evolve and be… (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `flows-error-leaks-stack-6`: Distinguish parse failures from write failures: return HTTP 400 with a generic error message for malformed JSON and HTTP 500 when the state file cannot be written, and log the exception server-side… (S)
- `flows-missing-timeout-6`: Set a socket timeout on the server (e.g. (M)
- `code-ignores-return-value-6`: Distinguish a missing file (404) from a read failure (500) by logging the OSError and returning an explicit 500 response instead of silently falling through to the generic 404. (M)
- `cost-license-attribution-missing-2`: Add the full Apache-2.0 license text and Google's NOTICE/copyright for the vendored MediaPipe files under vendor/, and add a modification notice for the HOLO SHIM changes, so redistribution complies… (M)
- `cost-documentation-poor-7`: Document every HTTP endpoint (method, path, request/response shape, and side effects such as writing state/holo-state.json) in the README or a dedicated API doc so the server contract is discoverable. (M)
- `cost-no-license-tracking-5`: Add a dependency/license manifest (e.g. (M)
- `cost-no-oss-policy-9`: Add a short OSS/dependency policy section (or CONTRIBUTING/DEPENDENCIES doc) that records each third-party component, its license, its source URL, and the process for reviewing and updating vendored… (M)
- `security-cors-wildcard-2`: Reject POSTs whose Origin/Referer is not the local deck, require a custom header (which forces a preflight) or a per-boot CSRF token, and return 403 otherwise. (XS)
- `security-gha-job-no-timeout-7`: Set `timeout` on the handler (e.g. (M)
- `security-no-security-maintenance-7`: Add a SECURITY.md with a private disclosure channel and enable Dependabot (or Renovate) for the vendored JS/wasm artifacts and any future package manifests. (M)
- `github-commit-history-1`: Cut tagged releases (semver) for the deck, add a CHANGELOG.md, and instruct users to check out a tag rather than pulling the default branch. (M)
- `github-issue-health-1`: Add .github/ISSUE_TEMPLATE/bug_report.md and feature_request.md, plus a CONTRIBUTING.md describing how to run `?probe=1` and report the 26/26 result. (M)
- `security-gha-action-unpinned-5`: Pin the gltf-transform CLI to an exact version (e.g. (M)
- `flows-missing-cors-9`: Add explicit CORS handling in _send: emit Access-Control-Allow-Origin with a strict allowlist (e.g. (S)
- `flows-missing-request-id-7`: Read an incoming X-Request-ID header (or generate a UUID when absent), include it in every response via _send, and log it alongside the request path and status code. (S)
- `flows-missing-security-headers-10`: In _send, add X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: no-referrer and a Content-Security-Policy that allows only 'self' plus the inline styles/scripts the deck… (S)
- `security-vcs-insecure-9`: Ignore holo.json (or a holo.local.json override), add a holo.json.example template, and ignore any state/ or log artifacts that could contain note text or filesystem paths. (M)
- `github-log-pattern-1`: Emit structured JSON logs with a request id for each request, log exceptions from the OSError handlers instead of swallowing them, and keep a rotating server.log (already gitignored). (XS)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-cors-9` **Depends On** `structure-config-logic-8`
- `flows-missing-rate-limit-8` **Depends On** `structure-config-logic-8`
- `flows-missing-request-id-7` **Depends On** `structure-config-logic-8`
- `flows-missing-security-headers-10` **Depends On** `structure-config-logic-8`
- `flows-error-leaks-stack-6` **Depends On** `structure-config-logic-8`
- `flows-missing-idempotency-3` **Depends On** `structure-config-logic-8`
- `flows-missing-timeout-6` **Depends On** `structure-config-logic-8`
- `flows-fire-and-forget-critical-1` **Depends On** `structure-config-logic-8`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
