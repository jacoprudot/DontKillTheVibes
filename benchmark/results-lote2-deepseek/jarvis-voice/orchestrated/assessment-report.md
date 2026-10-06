# Assessment Report: jarvis-voice

- **Repository**: jarvis-voice
- **Date**: 2026-10-05T20:15:58.567Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 4
- **Total Findings**: 59
- **By Severity**: critical 4 · high 9 · medium 38 · low 8
- **By Module**: structure 7 · flows 26 · security 8 · cost 9 · performance 9
- **Estimated Total Effort**: 5×XS, 9×S, 44×M, 1×L
- **Top 3 Priorities**:
  - `security-secret-in-code-1` — API keys (Anthropic and ElevenLabs) are read from config.json and held in module-level globals, and the config file is the sole secret… (critical, XS) (score 105)
  - `flows-fire-and-forget-critical-1` — The double-clap trigger launches the session script with subprocess.Popen and never checks the return code or captures output, so a failed… (critical, M) (score 75)
  - `security-logs-contain-secrets-12` — The TTS error path prints the raw ElevenLabs response body (`resp.text[:200]`) to stdout. (critical, XS) (score 75)

---

## Detailed Findings (by Priority)

### Priority 1: `security-secret-in-code-1` (score 105)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.7 | **Score**: 105
**Location**: `server.py:22`
**Description**: API keys (Anthropic and ElevenLabs) are read from config.json and held in module-level globals, and the config file is the sole secret store; the example config ships placeholder keys and the README/SETUP instruct users to paste real keys into config.json. Any accidental commit or log of this file exposes live credentials.
**Remediation**: Store API keys in environment variables or a secrets manager (e.g. os.environ['ANTHROPIC_API_KEY']) and never persist them in a JSON file inside the repo; keep config.json strictly gitignored and rotate any key that has ever been committed.
**Depends On**: None | **Blocks**: None

### Priority 2: `flows-fire-and-forget-critical-1` (score 75)
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.75 | **Score**: 75
**Location**: `scripts/clap-trigger.py`
**Description**: The double-clap trigger launches the session script with subprocess.Popen and never checks the return code or captures output, so a failed launch is silently lost.
**Remediation**: Capture the Popen handle, monitor the process exit code, and log or notify on non-zero exit instead of fire-and-forget.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 3: `security-logs-contain-secrets-12` (score 75)
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.5 | **Score**: 75
**Location**: `server.py:172`
**Description**: The TTS error path prints the raw ElevenLabs response body (`resp.text[:200]`) to stdout. Error bodies from the ElevenLabs API can echo request context and, combined with the xi-api-key header usage, risk leaking sensitive request/credential material into logs.
**Remediation**: Log only the HTTP status code and a generic error identifier; never print raw upstream response bodies that may contain credential or account details.
**Depends On**: None | **Blocks**: None

### Priority 4: `flows-missing-idempotency-3` (score 70)
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.7 | **Score**: 70
**Location**: `server.py`
**Description**: Incoming WebSocket messages are processed without any idempotency key or deduplication, so a retransmitted or duplicated speech message will trigger repeated LLM calls, TTS synthesis, and browser actions.
**Remediation**: Attach a client-generated message id to each WebSocket payload and track processed ids per session to skip duplicates before invoking the LLM and actions.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 5: `security-no-input-validation-14` (score 45)
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 45
**Location**: `server.py:196`
**Description**: User-supplied text from the WebSocket is passed straight into the LLM and then into action execution. The [ACTION:OPEN] handler passes the model-produced payload directly to browser_tools.open_url without any scheme/host allowlist, so a crafted utterance can drive the browser to arbitrary URLs (including local/internal endpoints).
**Remediation**: Validate and allowlist action payloads before execution: restrict OPEN to http/https schemes, reject localhost/private IP ranges, and validate the action type against a fixed enum.
**Depends On**: None | **Blocks**: None

### Priority 6: `performance-no-connection-pool-7` (score 42)
**Module**: performance | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 42
**Location**: `server.py:34`
**Description**: A single module-level httpx.AsyncClient is created with a fixed 30s timeout and no explicit connection-pool limits, and it is reused for all ElevenLabs TTS calls. There is no configured max_connections/max_keepalive_connections, no keep-alive tuning, and no per-host pool sizing, so concurrent TTS chunk requests can serialize or exhaust the default pool.
**Remediation**: Configure explicit pool limits on the shared client, e.g. httpx.AsyncClient(timeout=30, limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=30)), and ensure the client is closed on shutdown.
**Depends On**: None | **Blocks**: None

### Priority 7: `structure-high-coupling-1` (score 35.75)
**Module**: structure | **Severity**: high | **Effort**: L | **Confidence**: 0.65 | **Score**: 35.75
**Location**: `server.py:44`
**Description**: server.py directly instantiates and holds global clients (anthropic.AsyncAnthropic, httpx.AsyncClient) and imports browser_tools and screen_capture at module scope, tightly coupling the HTTP/WebSocket layer to concrete external integrations and browser automation. Any change to those modules or clients forces changes in the server module.
**Remediation**: Introduce thin service wrappers (e.g. LLMService, TTSService, BrowserService) injected into the request handlers, so server.py depends on abstractions rather than concrete clients and modules.
**Depends On**: None | **Blocks**: `flows-missing-timeout-6`, `flows-missing-error-handler-5`, `flows-error-leaks-stack-6`, `flows-missing-idempotency-3`, `flows-missing-request-id-7`, `flows-missing-rate-limit-8`, `flows-missing-cors-9`, `flows-missing-security-headers-10`, `flows-missing-dlq-2`, `flows-retry-no-backoff-4`, `flows-retry-no-max-5`, `flows-fire-and-forget-critical-1`, `flows-validation-too-early-3`, `flows-message-schema-no-version-1`, `flows-message-breaking-schema-2`, `flows-no-state-persistence-6`, `flows-message-not-encrypted-9`, `flows-message-not-compressed-10`, `flows-missing-circuit-breaker-7`, `flows-missing-visibility-timeout-9`, `flows-consumer-group-lag-3`, `flows-dlq-not-monitored-5`, `flows-dlq-on-repeat-failures-10`, `flows-message-ordering-needed-4`, `flows-message-retention-too-long-7`, `flows-message-retention-too-short-6`

### Priority 8: `flows-message-not-encrypted-9` (score 35)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 35
**Location**: `frontend/main.js:26`
**Description**: The WebSocket connection uses ws:// instead of wss://, so voice transcripts and audio payloads are transmitted in cleartext.
**Remediation**: Use wss:// with TLS termination and derive the scheme from location.protocol (wss when https).
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 9: `flows-missing-dlq-2` (score 30)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.6 | **Score**: 30
**Location**: `server.py`
**Description**: Failed action executions (SEARCH, OPEN, SCREEN, NEWS) are returned as plain strings with no dead-letter or retry queue, so transient browser failures are silently dropped.
**Remediation**: Persist failed actions to a dead-letter store with the payload and error, and expose a replay mechanism for manual or scheduled retry.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 10: `cost-no-automated-tests-4` (score 28)
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7 | **Score**: 28
**Location**: `README.md:5`
**Description**: The repository ships no test suite, no test runner configuration and no CI workflow; verification is entirely manual ('Start the server, open Chrome, check whether Jarvis speaks'). Every change to the prompt, action parsing or TTS pipeline must be validated by hand, which is a recurring engineering-cost drag and a source of regressions.
**Remediation**: Add a minimal pytest suite covering extract_action(), build_system_prompt() and the WebSocket message flow with mocked Anthropic/ElevenLabs clients, and run it in CI on every push.
**Depends On**: None | **Blocks**: None

### Priority 11: `flows-consumer-group-lag-3` (score 27.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `server.py`
**Description**: Messages are processed sequentially per WebSocket with no queue depth monitoring, so a slow LLM/TTS call causes unbounded client-side backlog with no visibility into lag.
**Remediation**: Track and expose pending message count per session and emit a status frame when the backlog exceeds a threshold.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 12: `flows-message-breaking-schema-2` (score 27.5)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.55 | **Score**: 27.5
**Location**: `frontend/main.js`
**Description**: The frontend assumes a fixed message shape ({type, text, audio}) with no tolerant parsing, so any backend schema change breaks the client silently.
**Remediation**: Introduce a versioned message contract and defensive parsing that ignores unknown fields and handles missing ones gracefully.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 13: `flows-dlq-on-repeat-failures-10` (score 25)
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.5 | **Score**: 25
**Location**: `server.py`
**Description**: Repeated failures of the same action (e.g. SEARCH) are retried by the user without any automatic dead-lettering after N attempts, wasting API quota.
**Remediation**: Count consecutive failures per action type and move the action to a dead-letter store after a configurable threshold.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 14: `performance-io-bound-sync-2` (score 19.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 19.2
**Location**: `server.py:48`
**Description**: get_weather_sync performs a blocking urllib.request.urlopen call with a 5s timeout, and refresh_data() invokes it synchronously from the async process_message path when the user says "activate", blocking the event loop for the duration of the network round-trip.
**Remediation**: Make the weather fetch async (use the existing httpx.AsyncClient) or run the blocking call via asyncio.to_thread/run_in_executor so the event loop is not blocked during activation.
**Depends On**: None | **Blocks**: None

### Priority 15: `performance-no-retry-jitter-8` (score 18)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 18
**Location**: `server.py:176`
**Description**: synthesize_speech posts each text chunk to the ElevenLabs API with no retry logic and no backoff/jitter; a transient 429 or 5xx simply drops that chunk (only a print of the error body), producing truncated or missing speech.
**Remediation**: Wrap the TTS POST in a retry loop with exponential backoff plus random jitter (e.g. tenacity or a manual loop with 3 attempts and 0.5s*2^n + random jitter) and treat non-200 responses as retryable.
**Depends On**: None | **Blocks**: None

### Priority 16: `structure-low-cohesion-5` (score 17.6)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 17.6
**Location**: `server.py:21`
**Description**: server.py mixes many unrelated responsibilities in one module: config loading, weather fetching, Obsidian task reading, system-prompt construction, action parsing, ElevenLabs TTS synthesis, action execution, and WebSocket message processing. The module has low cohesion and is a de-facto god module for the backend.
**Remediation**: Split server.py into focused modules: config, weather, tasks, prompt building, action parsing/execution, TTS client, and the FastAPI routes/WebSocket handler, each with a single responsibility.
**Depends On**: None | **Blocks**: None

### Priority 17: `flows-missing-timeout-6` (score 17)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.85 | **Score**: 17
**Location**: `server.py:34`
**Description**: The shared httpx.AsyncClient is created without any timeout configuration, so outbound calls to the Anthropic and ElevenLabs APIs can hang indefinitely and block the WebSocket request flow.
**Remediation**: Instantiate the client with an explicit timeout, e.g. httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)), and apply per-request timeouts on the ElevenLabs TTS call.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 18: `performance-no-response-streaming-5` (score 16.8)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 16.8
**Location**: `server.py:196`
**Description**: synthesize_speech accumulates every chunk's audio into audio_parts and returns b"".join(audio_parts), so the full response audio must be generated and buffered before any of it is sent to the client. The WebSocket handler then base64-encodes the whole buffer, adding latency and memory pressure proportional to reply length.
**Remediation**: Stream audio to the client as each chunk is synthesized (send incremental WebSocket frames or use a streaming response) instead of buffering the entire concatenated audio before sending.
**Depends On**: None | **Blocks**: None

### Priority 19: `security-cors-wildcard-2` (score 16.5)
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.55 | **Score**: 16.5
**Location**: `server.py:36`
**Description**: The FastAPI app is created with no CORS configuration and the WebSocket endpoint accepts connections from any origin. Any web page the user visits can open a WebSocket to the local server and drive the assistant (browser control, screen capture).
**Remediation**: Add CORSMiddleware with an explicit allowlist of trusted origins and validate the Origin header on the /ws WebSocket handshake, rejecting unknown origins.
**Depends On**: None | **Blocks**: None

### Priority 20: `structure-config-logic-8` (score 16.5)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 16.5
**Location**: `server.py:26`
**Description**: Configuration loading and derived constants (API keys, voice id, user name, city, tasks path) are executed as module-level side effects interleaved with application logic in server.py, so importing the module performs I/O and binds config values globally. This couples configuration concerns to the server module and makes the module hard to test or reuse.
**Remediation**: Move config loading into a dedicated config module (e.g. config.py) that exposes a typed settings object, and import that object in server.py instead of reading config.json at import time.
**Depends On**: None | **Blocks**: None

### Priority 21: `flows-missing-error-handler-5` (score 16)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.8 | **Score**: 16
**Location**: `server.py`
**Description**: The WebSocket endpoint has no try/except around message processing; an exception from the LLM call, TTS, or action execution will tear down the connection without sending an error frame to the client.
**Remediation**: Wrap the WebSocket receive/process loop in try/except WebSocketDisconnect and a generic handler that sends a structured error message and keeps the session alive.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 22: `structure-framework-leak-3` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `server.py:209`
**Description**: process_message() couples core conversation/LLM logic directly to the FastAPI WebSocket type by accepting a WebSocket parameter and calling ws.send_json() inside the business logic, leaking the web framework into the domain layer.
**Remediation**: Have process_message() return structured response objects (or yield events) and let the WebSocket route handler perform the ws.send_json() calls, keeping framework concerns at the transport boundary.
**Depends On**: None | **Blocks**: None

### Priority 23: `structure-service-sql-5` (score 15.4)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 15.4
**Location**: `server.py:67`
**Description**: get_tasks_sync() performs direct file I/O (open/readlines) inside what is effectively the service layer of the FastAPI backend, mixing data-access concerns with orchestration logic. The server module reads the Obsidian tasks file directly instead of delegating to a dedicated repository/data-access component.
**Remediation**: Extract the Obsidian task reading into a dedicated data-access module (e.g. tasks_repository.py) exposing a get_open_tasks() function, and have server.py call that abstraction rather than opening files itself.
**Depends On**: None | **Blocks**: None

### Priority 24: `flows-error-leaks-stack-6` (score 15)
**Module**: flows | **Severity**: medium | **Effort**: S | **Confidence**: 0.75 | **Score**: 15
**Location**: `browser_tools.py`
**Description**: search_and_read and visit return the raw exception string (str(e)) to the caller, which is then fed into the LLM context and can surface internal stack/path details to the user.
**Remediation**: Log the full exception server-side and return a generic, user-safe error message such as 'Suche fehlgeschlagen' without the raw exception text.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 25: `flows-missing-rate-limit-8` (score 15)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 15
**Location**: `server.py`
**Description**: The WebSocket endpoint accepts and processes an unbounded stream of messages with no rate limiting, allowing a client to exhaust Anthropic and ElevenLabs quotas or overwhelm the browser automation.
**Remediation**: Add per-session rate limiting (e.g. token bucket or slowapi) on the WebSocket handler and reject or throttle messages that exceed the configured threshold.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 26: `flows-missing-visibility-timeout-9` (score 15)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 15
**Location**: `browser_tools.py`
**Description**: Playwright pages opened for search, visit, and news are never closed on the success path (search_and_read and fetch_news use 'pass' in finally), leaking browser contexts and pages.
**Remediation**: Close pages in a finally block for all browser operations, or reuse a bounded pool of pages with an explicit visibility/lifetime timeout.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 27: `security-missing-headers-10` (score 15)
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.5 | **Score**: 15
**Location**: `server.py:36`
**Description**: The FastAPI application serves the frontend and WebSocket without any security headers (no CSP, X-Content-Type-Options, X-Frame-Options, or HSTS). The page loads external scripts and handles audio/WebSocket data, leaving it open to framing and content-injection attacks.
**Remediation**: Add a middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on all responses.
**Depends On**: None | **Blocks**: None

### Priority 28: `flows-missing-circuit-breaker-7` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 14
**Location**: `server.py`
**Description**: Calls to the ElevenLabs TTS API and Anthropic API have no circuit breaker, so repeated upstream failures keep hammering the providers and delay every response.
**Remediation**: Wrap outbound API calls in a circuit breaker (e.g. pybreaker) that opens after a failure threshold and fails fast with a fallback.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 29: `flows-retry-no-backoff-4` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.7 | **Score**: 14
**Location**: `frontend/main.js`
**Description**: The WebSocket reconnect uses a fixed 3000 ms delay with no exponential backoff or jitter, causing synchronized reconnect storms when the server restarts.
**Remediation**: Implement exponential backoff with jitter for the reconnect timer, e.g. delay = min(30000, base * 2**attempt) + random jitter.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 30: `flows-retry-no-max-5` (score 14)
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.7 | **Score**: 14
**Location**: `frontend/main.js`
**Description**: The reconnect logic retries indefinitely with no maximum attempt count or terminal error state, so a permanently unavailable server results in an endless reconnect loop.
**Remediation**: Cap the number of reconnect attempts and surface a persistent error state to the user after the limit is reached.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 31: `security-gha-action-unpinned-5` (score 13.5)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.45 | **Score**: 13.5
**Location**: `requirements.txt:1`
**Description**: Dependencies are declared with floating version ranges (>=) and no lockfile or hash pinning, so builds resolve to whatever latest version exists at install time. A compromised or malicious upstream release would be pulled in silently.
**Remediation**: Pin dependencies to exact versions and add a lockfile with hashes (e.g. pip-compile --generate-hashes) so installs are reproducible and tamper-evident.
**Depends On**: None | **Blocks**: None

### Priority 32: `performance-no-compression-13` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `server.py:196`
**Description**: Audio returned from ElevenLabs is base64-encoded and sent as a JSON string over the WebSocket, inflating payload size by ~33% with no compression or binary framing, increasing transfer time and memory for every spoken response.
**Remediation**: Send audio as binary WebSocket frames (or apply permessage-deflate/compression) instead of base64 inside JSON to cut payload size and encoding overhead.
**Depends On**: None | **Blocks**: None

### Priority 33: `performance-no-request-collapsing-4` (score 13.2)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 13.2
**Location**: `server.py:74`
**Description**: refresh_data() unconditionally re-fetches weather and re-reads tasks every time a message contains "activate", with no caching or request collapsing; repeated activations trigger duplicate identical network and disk work.
**Remediation**: Cache the weather/task results with a short TTL (e.g. 60s) and collapse concurrent refreshes into a single in-flight fetch so repeated activations do not duplicate the same I/O.
**Depends On**: None | **Blocks**: None

### Priority 34: `structure-service-orchestration-3` (score 12.1)
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 12.1
**Location**: `server.py:216`
**Description**: execute_action() acts as an orchestration dispatcher that directly invokes browser_tools and screen_capture operations and formats their results inline, blending orchestration with presentation formatting of the returned strings.
**Remediation**: Move the per-action result formatting into the respective service modules (returning structured results) and keep execute_action() limited to dispatching to injected services.
**Depends On**: None | **Blocks**: None

### Priority 35: `cost-api-no-usage-monitoring-9` (score 12)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.75 | **Score**: 12
**Location**: `server.py:33`
**Description**: The server calls two metered third-party APIs (Anthropic messages.create and ElevenLabs text-to-speech) but records no usage, cost or quota metrics anywhere — only debug prints of status codes and byte sizes. There is no way to detect runaway spend or an exhausted ElevenLabs free-tier character quota before the assistant silently stops speaking.
**Remediation**: Add per-call usage logging for Anthropic (response.usage tokens) and ElevenLabs (characters synthesized), aggregate them into a counter/metric, and alert when daily cost or monthly character quota approaches a threshold.
**Depends On**: None | **Blocks**: None

### Priority 36: `flows-message-schema-no-version-1` (score 12)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 12
**Location**: `server.py`
**Description**: WebSocket messages exchanged between frontend and backend carry no schema version field, so protocol changes cannot be rolled out compatibly.
**Remediation**: Add a 'version' field to every WebSocket message and have both sides reject or adapt to unknown versions.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 37: `performance-no-keep-alive-9` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `server.py:176`
**Description**: Each TTS request is issued against the ElevenLabs endpoint without any explicit keep-alive/connection-reuse configuration on the request path; combined with the unconfigured shared client this risks repeated TLS/TCP setup per chunk for multi-chunk replies.
**Remediation**: Rely on a single long-lived AsyncClient with keepalive_expiry set and HTTP/1.1 keep-alive enabled, and avoid creating per-call clients so connections are reused across chunks and requests.
**Depends On**: None | **Blocks**: None

### Priority 38: `performance-no-load-testing-3` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `server.py`
**Description**: The project ships no performance/load tests or benchmarks for the voice pipeline (LLM call, TTS synthesis, browser automation); requirements.txt contains only runtime dependencies and there is no test harness exercising latency or concurrency.
**Remediation**: Add a lightweight load/latency test (e.g. locust or a pytest-asyncio benchmark) that measures end-to-end response time for the LLM+TTS path and runs in CI to catch regressions.
**Depends On**: None | **Blocks**: None

### Priority 39: `performance-no-perf-budgets-10` (score 12)
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 12
**Location**: `server.py`
**Description**: No performance budgets or SLOs are defined anywhere in the repository for the interactive voice loop (e.g. max time-to-first-audio, max LLM latency), so regressions in responsiveness cannot be detected or enforced.
**Remediation**: Define explicit budgets such as time-to-first-audio < 1.5s and total response < 4s, document them, and add automated checks that fail when measured latency exceeds the budget.
**Depends On**: None | **Blocks**: None

### Priority 40: `security-unmaintained-dep-4` (score 12)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 12
**Location**: `requirements.txt:1`
**Description**: The dependency set uses open-ended lower bounds with no upper bounds or automated update/vulnerability scanning, so transitive vulnerabilities in fastapi, anthropic, httpx, playwright, or Pillow will not be surfaced or patched systematically.
**Remediation**: Enable Dependabot or pip-audit in CI to monitor dependencies for known CVEs and schedule regular dependency upgrades.
**Depends On**: None | **Blocks**: None

### Priority 41: `security-weak-rng-10` (score 12)
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 12
**Location**: `server.py:89`
**Description**: Conversation sessions are keyed by a session_id supplied by the client with no server-side generation or validation, and no cryptographic randomness is used to establish session identity. A client can impersonate or collide with another session's conversation history.
**Remediation**: Generate session identifiers server-side using secrets.token_urlsafe() and bind them to the WebSocket connection rather than trusting client-provided ids.
**Depends On**: None | **Blocks**: None

### Priority 42: `cost-llm-high-usage-1` (score 11.2)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.7 | **Score**: 11.2
**Location**: `server.py:33`
**Description**: Every user utterance triggers a Claude Haiku call with a large system prompt (personality, action instructions, weather and task blocks) rebuilt on each request via build_system_prompt(), and the full 16-message conversation history is resent every turn. There is no prompt caching, no token accounting and no usage monitoring, so LLM spend scales linearly with conversation length and cannot be observed or capped.
**Remediation**: Enable Anthropic prompt caching for the static system prompt (cache_control on the system block), trim the resent history, and log token usage per request (input/output tokens and estimated cost) so spend can be monitored and budgeted.
**Depends On**: None | **Blocks**: None

### Priority 43: `flows-dlq-not-monitored-5` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 11
**Location**: `server.py`
**Description**: Action failures are only printed to stdout and never routed to a monitored dead-letter channel, so recurring failures go unnoticed.
**Remediation**: Route failed actions to a monitored dead-letter queue with alerting on depth or error rate.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 44: `flows-message-ordering-needed-4` (score 11)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.55 | **Score**: 11
**Location**: `frontend/main.js`
**Description**: Audio responses are queued client-side but user messages are sent immediately, so out-of-order LLM replies can be spoken in the wrong sequence.
**Remediation**: Attach a monotonically increasing sequence number to each message and reorder or drop stale responses on the client.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 45: `cost-api-no-retry-strategy-8` (score 10.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65 | **Score**: 10.4
**Location**: `server.py:34`
**Description**: The ElevenLabs TTS call is wrapped in a bare try/except that logs the exception and drops the chunk, and the Anthropic call has no retry or backoff at all. A transient failure silently loses audio or aborts the turn, and there is no bounded retry policy to distinguish retryable from non-retryable errors.
**Remediation**: Add a bounded retry with exponential backoff and jitter for the Anthropic and ElevenLabs calls, retrying only on 429/5xx responses, and surface a clear error to the client when retries are exhausted.
**Depends On**: None | **Blocks**: None

### Priority 46: `flows-message-retention-too-short-6` (score 10)
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 10
**Location**: `server.py`
**Description**: Only the last 16 messages are sent to the LLM, which can truncate longer multi-turn context and cause the assistant to forget earlier instructions.
**Remediation**: Increase the context window or summarize older turns before truncation to preserve relevant conversation state.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 47: `cost-api-no-client-rate-limit-4` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `server.py:36`
**Description**: The FastAPI app exposes the WebSocket endpoint and the Anthropic/ElevenLabs-backed pipeline with no client-side rate limiting, concurrency cap or per-session throttle. A client that sends messages rapidly (or a reconnecting frontend loop) can drive unbounded paid LLM and TTS calls.
**Remediation**: Add per-session and global rate limiting (e.g. slowapi or a token-bucket guard) on the WebSocket message handler and cap concurrent in-flight LLM/TTS requests to protect against runaway API spend.
**Depends On**: None | **Blocks**: None

### Priority 48: `cost-api-no-response-cache-5` (score 9.6)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6 | **Score**: 9.6
**Location**: `server.py`
**Description**: synthesize_speech() re-requests ElevenLabs TTS for identical text every time it is spoken, and the weather/task greeting is regenerated and re-synthesized on each 'activate'. No response or audio caching exists, so repeated identical phrases are billed repeatedly against the ElevenLabs character quota.
**Remediation**: Cache synthesized audio keyed by (voice_id, model_id, text hash) on disk or in memory and reuse it for repeated phrases such as the activation greeting and fixed status messages.
**Depends On**: None | **Blocks**: None

### Priority 49: `cost-documentation-poor-7` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `CLAUDE.md`
**Description**: Setup and operational knowledge is spread across CLAUDE.md, SETUP.md and README.md with overlapping and partially divergent instructions (e.g. different Task Scheduler commands, different config field descriptions), and there is no single authoritative runbook for cost-relevant operations such as rotating API keys or monitoring API spend.
**Remediation**: Consolidate setup and operations into one authoritative document, remove duplicated/divergent instructions from the other files, and add a short operations section covering API key rotation and usage/cost monitoring.
**Depends On**: None | **Blocks**: None

### Priority 50: `cost-no-performance-budget-10` (score 8)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.5 | **Score**: 8
**Location**: `server.py`
**Description**: The voice pipeline chains an LLM call, a chunked ElevenLabs TTS round-trip and WebSocket delivery with no latency budget, timeout or SLO defined for the end-to-end response. The httpx client uses a flat 30s timeout and TTS chunks are synthesized sequentially, so slow responses are neither measured nor bounded.
**Remediation**: Define an end-to-end response latency budget (e.g. p95 < 3s), instrument each pipeline stage with timing, and fail or degrade gracefully when the budget is exceeded.
**Depends On**: None | **Blocks**: None

### Priority 51: `cost-gha-no-dependency-cache-5` (score 6.4)
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.4 | **Score**: 6.4
**Location**: `requirements.txt`
**Description**: The project pins Python dependencies in requirements.txt and the documented setup runs 'pip install -r requirements.txt' plus 'playwright install chromium' on every fresh environment, with no dependency or browser-binary caching strategy described. Repeated uncached installs of Playwright Chromium and the full dependency set waste CI/setup time and bandwidth.
**Remediation**: Cache the pip wheel directory and the Playwright browser download (e.g. actions/cache on ~/.cache/pip and ~/.cache/ms-playwright) in any CI workflow, and pin exact versions in requirements.txt to make the cache effective.
**Depends On**: None | **Blocks**: None

### Priority 52: `flows-missing-request-id-7` (score 3.75)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.75 | **Score**: 3.75
**Location**: `server.py`
**Description**: No request/correlation id is generated or propagated through the message processing pipeline, making it impossible to correlate a user utterance with its LLM call, TTS request, and action execution in logs.
**Remediation**: Generate a UUID per incoming message, include it in all log lines and outbound API calls, and echo it back in the WebSocket response payload.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 53: `flows-no-state-persistence-6` (score 3.5)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.7 | **Score**: 3.5
**Location**: `server.py`
**Description**: Conversation history is held only in the in-memory 'conversations' dict, so all session state is lost on server restart and cannot be resumed.
**Remediation**: Persist conversation history to a durable store (SQLite/Redis) keyed by session id and reload it on reconnect.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 54: `structure-adapter-violation-10` (score 3.3)
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3.3
**Location**: `browser_tools.py:33`
**Description**: browser_tools.py mixes multiple adapter concerns: Playwright browser lifecycle management (_get_browser), OS-level window manipulation via PowerShell subprocess (_bring_chromium_to_front), HTTP search, and the webbrowser module for opening URLs. These are distinct external-system adapters bundled into one module.
**Remediation**: Separate the Playwright browser adapter, the OS window-focus adapter, and the default-browser opener into distinct modules so each adapter wraps a single external system.
**Depends On**: None | **Blocks**: None

### Priority 55: `flows-missing-security-headers-10` (score 3.25)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.65 | **Score**: 3.25
**Location**: `server.py`
**Description**: The FastAPI application serves the frontend without any security headers (CSP, X-Content-Type-Options, X-Frame-Options), leaving the voice UI exposed to framing and content-injection risks.
**Remediation**: Add middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on all responses.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 56: `flows-message-retention-too-long-7` (score 3)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3
**Location**: `server.py`
**Description**: Conversation history is retained indefinitely in memory with only a 16-message window sent to the LLM, so the full transcript accumulates without any retention policy.
**Remediation**: Apply a bounded retention policy (max messages or TTL) to the conversations dict and evict old sessions.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 57: `flows-missing-cors-9` (score 3)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3
**Location**: `server.py`
**Description**: The FastAPI app is created without CORSMiddleware, so cross-origin browser clients cannot be explicitly restricted and the WebSocket/HTTP surface has no origin policy.
**Remediation**: Add CORSMiddleware with an explicit allow_origins list limited to the local frontend origin instead of relying on default permissive behavior.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 58: `flows-validation-too-early-3` (score 3)
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6 | **Score**: 3
**Location**: `server.py`
**Description**: Action extraction via regex happens on the raw LLM reply before any sanitization, so malformed or injected action tags are executed without a validation stage.
**Remediation**: Validate the extracted action type against an allowlist and sanitize the payload before dispatching to execute_action.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

### Priority 59: `flows-message-not-compressed-10` (score 2.75)
**Module**: flows | **Severity**: low | **Effort**: M | **Confidence**: 0.55 | **Score**: 2.75
**Location**: `server.py`
**Description**: Base64-encoded audio is sent over the WebSocket without compression, significantly inflating bandwidth for every spoken response.
**Remediation**: Enable WebSocket permessage-deflate or compress the audio payload before base64 encoding.
**Depends On**: `structure-high-coupling-1` | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days (Quick Wins)
- `security-secret-in-code-1`: Store API keys in environment variables or a secrets manager (e.g. (XS)
- `flows-fire-and-forget-critical-1`: Capture the Popen handle, monitor the process exit code, and log or notify on non-zero exit instead of fire-and-forget. (M)
- `security-logs-contain-secrets-12`: Log only the HTTP status code and a generic error identifier; never print raw upstream response bodies that may contain credential or account details. (XS)
- `flows-missing-idempotency-3`: Attach a client-generated message id to each WebSocket payload and track processed ids per session to skip duplicates before invoking the LLM and actions. (S)
- `security-no-input-validation-14`: Validate and allowlist action payloads before execution: restrict OPEN to http/https schemes, reject localhost/private IP ranges, and validate the action type against a fixed enum. (M)
- `performance-no-connection-pool-7`: Configure explicit pool limits on the shared client, e.g. (M)
- `structure-high-coupling-1`: Introduce thin service wrappers (e.g. (L)
- `flows-message-not-encrypted-9`: Use wss:// with TLS termination and derive the scheme from location.protocol (wss when https). (M)
- `flows-missing-dlq-2`: Persist failed actions to a dead-letter store with the payload and error, and expose a replay mechanism for manual or scheduled retry. (M)
- `cost-no-automated-tests-4`: Add a minimal pytest suite covering extract_action(), build_system_prompt() and the WebSocket message flow with mocked Anthropic/ElevenLabs clients, and run it in CI on every push. (M)
- `flows-consumer-group-lag-3`: Track and expose pending message count per session and emit a status frame when the backlog exceeds a threshold. (M)
- `flows-message-breaking-schema-2`: Introduce a versioned message contract and defensive parsing that ignores unknown fields and handles missing ones gracefully. (M)
- `flows-dlq-on-repeat-failures-10`: Count consecutive failures per action type and move the action to a dead-letter store after a configurable threshold. (M)
- `performance-io-bound-sync-2`: Make the weather fetch async (use the existing httpx.AsyncClient) or run the blocking call via asyncio.to_thread/run_in_executor so the event loop is not blocked during activation. (M)
- `performance-no-retry-jitter-8`: Wrap the TTS POST in a retry loop with exponential backoff plus random jitter (e.g. (M)
- `structure-low-cohesion-5`: Split server.py into focused modules: config, weather, tasks, prompt building, action parsing/execution, TTS client, and the FastAPI routes/WebSocket handler, each with a single responsibility. (M)
- `flows-missing-timeout-6`: Instantiate the client with an explicit timeout, e.g. (M)
- `performance-no-response-streaming-5`: Stream audio to the client as each chunk is synthesized (send incremental WebSocket frames or use a streaming response) instead of buffering the entire concatenated audio before sending. (M)
**Total Effort**: XL

### 60 Days (Core Fixes)
- `security-cors-wildcard-2`: Add CORSMiddleware with an explicit allowlist of trusted origins and validate the Origin header on the /ws WebSocket handshake, rejecting unknown origins. (XS)
- `structure-config-logic-8`: Move config loading into a dedicated config module (e.g. (M)
- `flows-missing-error-handler-5`: Wrap the WebSocket receive/process loop in try/except WebSocketDisconnect and a generic handler that sends a structured error message and keeps the session alive. (M)
- `structure-framework-leak-3`: Have process_message() return structured response objects (or yield events) and let the WebSocket route handler perform the ws.send_json() calls, keeping framework concerns at the transport boundary. (M)
- `structure-service-sql-5`: Extract the Obsidian task reading into a dedicated data-access module (e.g. (M)
- `flows-error-leaks-stack-6`: Log the full exception server-side and return a generic, user-safe error message such as 'Suche fehlgeschlagen' without the raw exception text. (S)
- `flows-missing-rate-limit-8`: Add per-session rate limiting (e.g. (M)
- `flows-missing-visibility-timeout-9`: Close pages in a finally block for all browser operations, or reuse a bounded pool of pages with an explicit visibility/lifetime timeout. (M)
- `security-missing-headers-10`: Add a middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on all responses. (S)
- `flows-missing-circuit-breaker-7`: Wrap outbound API calls in a circuit breaker (e.g. (M)
- `flows-retry-no-backoff-4`: Implement exponential backoff with jitter for the reconnect timer, e.g. (XS)
- `flows-retry-no-max-5`: Cap the number of reconnect attempts and surface a persistent error state to the user after the limit is reached. (XS)
- `security-gha-action-unpinned-5`: Pin dependencies to exact versions and add a lockfile with hashes (e.g. (M)
**Total Effort**: XL

### 90 Days (Strategic)
- `performance-no-compression-13`: Send audio as binary WebSocket frames (or apply permessage-deflate/compression) instead of base64 inside JSON to cut payload size and encoding overhead. (M)
- `performance-no-request-collapsing-4`: Cache the weather/task results with a short TTL (e.g. (M)
- `structure-service-orchestration-3`: Move the per-action result formatting into the respective service modules (returning structured results) and keep execute_action() limited to dispatching to injected services. (M)
- `cost-api-no-usage-monitoring-9`: Add per-call usage logging for Anthropic (response.usage tokens) and ElevenLabs (characters synthesized), aggregate them into a counter/metric, and alert when daily cost or monthly character quota… (M)
- `flows-message-schema-no-version-1`: Add a 'version' field to every WebSocket message and have both sides reject or adapt to unknown versions. (M)
- `performance-no-keep-alive-9`: Rely on a single long-lived AsyncClient with keepalive_expiry set and HTTP/1.1 keep-alive enabled, and avoid creating per-call clients so connections are reused across chunks and requests. (M)
- `performance-no-load-testing-3`: Add a lightweight load/latency test (e.g. (M)
- `performance-no-perf-budgets-10`: Define explicit budgets such as time-to-first-audio < 1.5s and total response < 4s, document them, and add automated checks that fail when measured latency exceeds the budget. (M)
- `security-unmaintained-dep-4`: Enable Dependabot or pip-audit in CI to monitor dependencies for known CVEs and schedule regular dependency upgrades. (M)
- `security-weak-rng-10`: Generate session identifiers server-side using secrets.token_urlsafe() and bind them to the WebSocket connection rather than trusting client-provided ids. (M)
- `cost-llm-high-usage-1`: Enable Anthropic prompt caching for the static system prompt (cache_control on the system block), trim the resent history, and log token usage per request (input/output tokens and estimated cost) so… (M)
- `flows-dlq-not-monitored-5`: Route failed actions to a monitored dead-letter queue with alerting on depth or error rate. (M)
- `flows-message-ordering-needed-4`: Attach a monotonically increasing sequence number to each message and reorder or drop stale responses on the client. (M)
- `cost-api-no-retry-strategy-8`: Add a bounded retry with exponential backoff and jitter for the Anthropic and ElevenLabs calls, retrying only on 429/5xx responses, and surface a clear error to the client when retries are exhausted. (M)
- `flows-message-retention-too-short-6`: Increase the context window or summarize older turns before truncation to preserve relevant conversation state. (M)
- `cost-api-no-client-rate-limit-4`: Add per-session and global rate limiting (e.g. (M)
- `cost-api-no-response-cache-5`: Cache synthesized audio keyed by (voice_id, model_id, text hash) on disk or in memory and reuse it for repeated phrases such as the activation greeting and fixed status messages. (M)
- `cost-documentation-poor-7`: Consolidate setup and operations into one authoritative document, remove duplicated/divergent instructions from the other files, and add a short operations section covering API key rotation and… (M)
- `cost-no-performance-budget-10`: Define an end-to-end response latency budget (e.g. (M)
- `cost-gha-no-dependency-cache-5`: Cache the pip wheel directory and the Playwright browser download (e.g. (M)
- `flows-missing-request-id-7`: Generate a UUID per incoming message, include it in all log lines and outbound API calls, and echo it back in the WebSocket response payload. (S)
- `flows-no-state-persistence-6`: Persist conversation history to a durable store (SQLite/Redis) keyed by session id and reload it on reconnect. (M)
- `structure-adapter-violation-10`: Separate the Playwright browser adapter, the OS window-focus adapter, and the default-browser opener into distinct modules so each adapter wraps a single external system. (S)
- `flows-missing-security-headers-10`: Add middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on all responses. (S)
- `flows-message-retention-too-long-7`: Apply a bounded retention policy (max messages or TTL) to the conversations dict and evict old sessions. (S)
- `flows-missing-cors-9`: Add CORSMiddleware with an explicit allow_origins list limited to the local frontend origin instead of relying on default permissive behavior. (S)
- `flows-validation-too-early-3`: Validate the extracted action type against an allowlist and sanitize the payload before dispatching to execute_action. (S)
- `flows-message-not-compressed-10`: Enable WebSocket permessage-deflate or compress the audio payload before base64 encoding. (M)
**Total Effort**: XL

---

## Dependencies
- `flows-missing-timeout-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-error-handler-5` **Depends On** `structure-high-coupling-1`
- `flows-error-leaks-stack-6` **Depends On** `structure-high-coupling-1`
- `flows-missing-idempotency-3` **Depends On** `structure-high-coupling-1`
- `flows-missing-request-id-7` **Depends On** `structure-high-coupling-1`
- `flows-missing-rate-limit-8` **Depends On** `structure-high-coupling-1`
- `flows-missing-cors-9` **Depends On** `structure-high-coupling-1`
- `flows-missing-security-headers-10` **Depends On** `structure-high-coupling-1`
- `flows-missing-dlq-2` **Depends On** `structure-high-coupling-1`
- `flows-retry-no-backoff-4` **Depends On** `structure-high-coupling-1`
- `flows-retry-no-max-5` **Depends On** `structure-high-coupling-1`
- `flows-fire-and-forget-critical-1` **Depends On** `structure-high-coupling-1`
- `flows-validation-too-early-3` **Depends On** `structure-high-coupling-1`
- `flows-message-schema-no-version-1` **Depends On** `structure-high-coupling-1`
- `flows-message-breaking-schema-2` **Depends On** `structure-high-coupling-1`
- `flows-no-state-persistence-6` **Depends On** `structure-high-coupling-1`
- `flows-message-not-encrypted-9` **Depends On** `structure-high-coupling-1`
- `flows-message-not-compressed-10` **Depends On** `structure-high-coupling-1`
- `flows-missing-circuit-breaker-7` **Depends On** `structure-high-coupling-1`
- `flows-missing-visibility-timeout-9` **Depends On** `structure-high-coupling-1`
- `flows-consumer-group-lag-3` **Depends On** `structure-high-coupling-1`
- `flows-dlq-not-monitored-5` **Depends On** `structure-high-coupling-1`
- `flows-dlq-on-repeat-failures-10` **Depends On** `structure-high-coupling-1`
- `flows-message-ordering-needed-4` **Depends On** `structure-high-coupling-1`
- `flows-message-retention-too-long-7` **Depends On** `structure-high-coupling-1`
- `flows-message-retention-too-short-6` **Depends On** `structure-high-coupling-1`

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
