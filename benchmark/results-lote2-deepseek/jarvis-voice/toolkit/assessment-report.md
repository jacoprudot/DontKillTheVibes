# Assessment Report: jarvis-voice

- **Repository**: jarvis-voice
- **Date**: 2026-10-05T20:15:37.495Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 7
- **Total Findings**: 37
- **By Severity**: critical 7 · high 10 · medium 18 · low 2
- **Estimated Total Effort**: 7×XS, 7×S, 23×M
- **Top 3 Priorities**:
  - `security-secret-in-code-1` — config.example.json ships placeholder API key fields (anthropic_api_key, elevenlabs_api_key) that users are instructed to fill in and copy… (critical, XS)
  - `security-secret-in-history-2` — config.json is gitignored only now; any earlier commit that included config.json with real Anthropic/ElevenLabs keys would still expose… (critical, S)
  - `security-logs-contain-secrets-12` — server.py prints TTS error bodies and exception text to stdout (e.g. (critical, XS)

---

## Detailed Findings (by Priority)

### Priority 1: `security-secret-in-code-1`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.7
**Location**: `config.example.json:2`
**Description**: config.example.json ships placeholder API key fields (anthropic_api_key, elevenlabs_api_key) that users are instructed to fill in and copy to config.json; the pattern encourages committing real keys, and config.json is only protected by .gitignore.
**Remediation**: Keep only empty-string placeholders in config.example.json, add a startup check that refuses to run if keys look like real values, and document loading keys from environment variables instead of a committed JSON file.
**Depends On**: None | **Blocks**: `security-secret-in-history-2`

### Priority 2: `security-secret-in-history-2`
**Module**: security | **Severity**: critical | **Effort**: S | **Confidence**: 0.6
**Location**: `.gitignore:5`
**Description**: config.json is gitignored only now; any earlier commit that included config.json with real Anthropic/ElevenLabs keys would still expose them in git history, and the README instructs users to paste live keys into that file.
**Remediation**: Run a secret scanner (gitleaks/trufflehog) over full history, rotate any exposed Anthropic and ElevenLabs keys immediately, and add a pre-commit hook that blocks config.json and key-shaped strings.
**Depends On**: `security-secret-in-code-1` | **Blocks**: None

### Priority 3: `security-logs-contain-secrets-12`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6
**Location**: `server.py`
**Description**: server.py prints TTS error bodies and exception text to stdout (e.g. 'TTS error body: {resp.text[:200]}' and 'TTS EXCEPTION: {e}'), and the launch script runs the server in a visible terminal; ElevenLabs error responses can echo request context including the API key header.
**Remediation**: Log only status codes and a redacted error category; never print raw response bodies or exception strings that may contain credentials, and route logs to a file with restricted permissions.
**Depends On**: None | **Blocks**: None

### Priority 4: `security-gha-secret-leak-3`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6
**Location**: `scripts/launch-session.ps1`
**Description**: launch-session.ps1 starts the server via 'cmd /k python server.py' in a visible terminal window, so any credential echoed by server.py (API keys, TTS error bodies) is displayed on screen and persists in the terminal scrollback.
**Remediation**: Start the server without an interactive shell (no 'cmd /k'), redirect stdout/stderr to a log file, and ensure no secret material is ever printed by the server.
**Depends On**: None | **Blocks**: None

### Priority 5: `code-empty-catch-1`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.75
**Location**: `server.py`
**Description**: get_weather_sync() and get_tasks_sync() wrap their entire bodies in bare 'except:' blocks that silently return None/[] — a bare except also swallows KeyboardInterrupt and SystemExit, hiding real failures at startup.
**Remediation**: Catch specific exceptions (urllib.error.URLError, json.JSONDecodeError, OSError) and log them at warning level instead of silently returning empty data.
**Depends On**: None | **Blocks**: None

### Priority 6: `code-bare-except-1`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.75
**Location**: `server.py`
**Description**: Both get_weather_sync() and get_tasks_sync() use a bare 'except:' clause with no exception type, which catches KeyboardInterrupt and SystemExit and makes startup failures undiagnosable.
**Remediation**: Replace 'except:' with 'except Exception as e:' and log the exception; never use a bare except in application code.
**Depends On**: None | **Blocks**: None

### Priority 7: `github-log-pattern-6`
**Module**: github | **Severity**: high | **Effort**: S | **Confidence**: 0.6
**Location**: `server.py`
**Description**: Verbose debug output is printed unconditionally in the production path, including full TTS error bodies and exception strings, with no log-level switch to disable it.
**Remediation**: Introduce a LOG_LEVEL setting and gate verbose output behind it; default to INFO in normal operation and never print raw API response bodies.
**Depends On**: None | **Blocks**: None

### Priority 8: `flows-retry-no-backoff-4`
**Module**: flows | **Severity**: medium | **Effort**: XS | **Confidence**: 0.7
**Location**: `frontend/main.js`
**Description**: The WebSocket reconnect uses a fixed 3000ms setTimeout with no exponential backoff or jitter, so a server that is down causes a steady reconnect storm from every open tab.
**Remediation**: Implement exponential backoff with jitter (e.g. 1s, 2s, 4s, capped at 30s) and stop retrying after a configurable number of attempts.
**Depends On**: None | **Blocks**: None

### Priority 9: `cost-deprecated-version-10`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `requirements.txt`
**Description**: Dependencies use open-ended lower bounds (fastapi>=0.115.0, anthropic>=0.39.0, playwright>=1.40.0) with no upper bounds, so a breaking major release can silently break the assistant on a fresh install.
**Remediation**: Pin exact versions or use compatible-release specifiers (~=) and add a scheduled dependency-update job that runs the test suite.
**Depends On**: None | **Blocks**: None

### Priority 10: `security-no-input-validation-14`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: The WebSocket handler accepts arbitrary JSON text from the browser and passes it straight into the Claude conversation and action parser without validating message shape, size, or origin, so any page or script that can reach ws://localhost:8340/ws can drive the assistant.
**Remediation**: Validate the incoming JSON schema (type, max length), reject unknown fields, and enforce an Origin check plus a shared token on the WebSocket handshake.
**Depends On**: None | **Blocks**: None

### Priority 11: `security-cors-wildcard-2`
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.6
**Location**: `server.py`
**Description**: The FastAPI app is created with no CORS or origin restrictions and the frontend connects to ws://${location.host}/ws, so any local page served from another origin can open the socket and issue voice commands.
**Remediation**: Add CORSMiddleware with an explicit allowlist (http://localhost:8340) and verify the Origin header on WebSocket upgrade before accepting the connection.
**Depends On**: None | **Blocks**: None

### Priority 12: `security-missing-headers-10`
**Module**: security | **Severity**: medium | **Effort**: S | **Confidence**: 0.6
**Location**: `server.py`
**Description**: The FastAPI application serves the UI and WebSocket without any security headers (no CSP, X-Content-Type-Options, X-Frame-Options, or HSTS), leaving the local control surface open to framing and content-sniffing attacks.
**Remediation**: Add a middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on every response.
**Depends On**: None | **Blocks**: None

### Priority 13: `security-file-upload-weak-7`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.6
**Location**: `browser_tools.py`
**Description**: visit() and search_and_read() navigate to URLs derived from model output and page content with no scheme allowlist, so a crafted [ACTION:OPEN] payload or a redirect can drive the headless-visible browser to file:// or javascript: URLs.
**Remediation**: Validate URLs before navigation: allow only http/https schemes, reject localhost/private IP ranges, and resolve redirects against the same allowlist.
**Depends On**: None | **Blocks**: None

### Priority 14: `flows-missing-error-handler-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: The WebSocket endpoint has no global error handling: an exception raised while thinking, synthesizing speech, or executing an action will terminate the socket, and the frontend only reconnects after a 3-second delay with no error surfaced.
**Remediation**: Wrap the per-message handler in try/except, send a structured {type:'error'} frame to the client, and keep the connection alive so the user hears what went wrong.
**Depends On**: `flows-missing-dlq-2` | **Blocks**: None

### Priority 15: `flows-missing-idempotency-3`
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.6
**Location**: `scripts/clap-trigger.py`
**Description**: The clap trigger fires launch-session.ps1 via subprocess.Popen with no idempotency guard beyond an in-process 'triggered' flag; if the script is restarted or two instances run, a double clap launches the entire workspace (Spotify, VS Code, Obsidian, Chrome) twice.
**Remediation**: Write a lock file or use a named mutex before launching, and have launch-session.ps1 check for already-running processes before starting new ones.
**Depends On**: None | **Blocks**: None

### Priority 16: `flows-missing-dlq-2`
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: Action execution failures (SEARCH/OPEN/SCREEN/NEWS) are returned as error strings to the model but never persisted or retried, so a failed browser action is silently dropped and the user receives no durable record of what went wrong.
**Remediation**: Record failed actions to a local dead-letter log with the payload and error, and expose a retry path so transient browser failures can be replayed.
**Depends On**: None | **Blocks**: `flows-missing-error-handler-5`

### Priority 17: `flows-missing-rate-limit-8`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: The WebSocket endpoint and the ElevenLabs TTS calls have no rate limiting, so a stuck speech-recognition loop or a malicious local page can drive unbounded Claude and ElevenLabs API usage and cost.
**Remediation**: Add a per-connection token bucket limiting messages per minute and cap concurrent TTS requests; reject bursts with a status frame.
**Depends On**: None | **Blocks**: None

### Priority 18: `structure-config-logic-8`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `server.py`
**Description**: Configuration values are read at import time with config["anthropic_api_key"] and config["elevenlabs_api_key"] using direct indexing, so a missing key raises KeyError during import and the module cannot be imported for testing.
**Remediation**: Move config loading into a function with explicit validation and clear error messages, and use config.get() with defaults or a validated settings object.
**Depends On**: `cost-no-automated-tests-4` | **Blocks**: None

### Priority 19: `structure-high-coupling-2`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `browser_tools.py`
**Description**: browser_tools.py holds module-level mutable singletons (_browser, _context) shared across all callers, coupling every action to one global browser lifecycle and making concurrent or test use unsafe.
**Remediation**: Encapsulate the browser lifecycle in a class with explicit start/close and inject it into the action handlers instead of using module globals.
**Depends On**: None | **Blocks**: None

### Priority 20: `performance-no-connection-pool-7`
**Module**: performance | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `browser_tools.py`
**Description**: Every search_and_read/visit/fetch_news call opens a new Playwright page and never closes it in the success path (the finally blocks are empty or only close on visit), so pages accumulate in the shared context and degrade browser performance over a session.
**Remediation**: Close the page in a finally block for every function, or reuse a single page and navigate it, and cap the number of open pages.
**Depends On**: None | **Blocks**: `database-missing-app-pool-8`

### Priority 21: `performance-no-adaptive-timeout-6`
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `browser_tools.py`
**Description**: Browser navigation uses fixed timeouts (15000ms for goto, 2000-6000ms wait_for_timeout) regardless of page or network conditions, so slow sites fail while fast sites waste seconds on every command.
**Remediation**: Use wait_until='domcontentloaded' with a shorter base timeout and poll for the target selector with an adaptive deadline instead of fixed sleeps.
**Depends On**: None | **Blocks**: None

### Priority 22: `performance-no-compression-13`
**Module**: performance | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `frontend/main.js`
**Description**: TTS audio is delivered to the browser as base64-encoded MP3 inside JSON WebSocket frames, inflating payload size by ~33% and forcing a full decode on the main thread for every response.
**Remediation**: Send audio as binary WebSocket frames (ArrayBuffer) instead of base64-in-JSON, and stream chunks as they arrive rather than buffering the whole response.
**Depends On**: None | **Blocks**: None

### Priority 23: `cost-llm-high-usage-1`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: Every voice turn sends the full system prompt (personality rules, action documentation, weather and task blocks) plus the entire conversation history to Claude Haiku, and the conversation list is never trimmed, so token usage grows unbounded per session.
**Remediation**: Trim conversation history to the last N turns, cache the static system prompt with prompt caching, and move the action documentation out of the per-turn prompt.
**Depends On**: None | **Blocks**: None

### Priority 24: `cost-api-no-response-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: Weather is fetched from wttr.in at startup and tasks are read from disk on every refresh with no caching or TTL, and repeated identical TTS requests are re-synthesized rather than cached.
**Remediation**: Add a short TTL cache for weather (e.g. 10 minutes) and an LRU cache keyed by text hash for ElevenLabs responses to avoid re-billing identical phrases.
**Depends On**: None | **Blocks**: None

### Priority 25: `cost-api-no-usage-monitoring-9`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: There is no tracking of Anthropic token usage or ElevenLabs character consumption; the only cost signal is a printed TTS chunk size, so a runaway loop would not be noticed until the bill arrives.
**Remediation**: Log per-request token counts from the Anthropic response and character counts sent to ElevenLabs, and alert when daily totals exceed a configured budget.
**Depends On**: None | **Blocks**: None

### Priority 26: `cost-gha-no-dependency-cache-5`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `requirements.txt`
**Description**: requirements.txt pins only lower bounds (>=) with no lockfile, so every install resolves the newest compatible versions and there is no reproducible dependency set to cache or audit.
**Remediation**: Generate a pinned requirements lock (pip-compile or uv lock) and commit it so installs are reproducible and cacheable.
**Depends On**: None | **Blocks**: None

### Priority 27: `github-log-pattern-9`
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `server.py`
**Description**: No logging configuration or log artifacts exist in the repository; all diagnostics go to stdout via print(), so there is no persistent record of assistant errors, TTS failures, or action outcomes.
**Remediation**: Add a logging configuration with a rotating file handler and document where logs are written so failures can be diagnosed after the fact.
**Depends On**: None | **Blocks**: None

### Priority 28: `code-print-statement-5`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `server.py`
**Description**: server.py uses print() for all operational logging (weather, task count, TTS chunk status, TTS errors) instead of the logging module, so log levels and destinations cannot be controlled.
**Remediation**: Replace print() calls with a configured logging.Logger, set the level from config, and write to a rotating file handler.
**Depends On**: None | **Blocks**: None

### Priority 29: `code-print-statement-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `scripts/clap-trigger.py`
**Description**: clap-trigger.py emits all diagnostics via print() with flush=True, giving no log levels or timestamps for a long-running background listener.
**Remediation**: Use the logging module with a timestamped formatter so clap events and errors can be filtered and retained.
**Depends On**: None | **Blocks**: None

### Priority 30: `code-unhandled-promise-4`
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.65
**Location**: `frontend/main.js`
**Description**: startListening() calls recognition.start() inside a try/catch that swallows the error with an empty catch block ('} catch(e) {}'), so a failed recognition start silently leaves the UI in a listening state with no feedback.
**Remediation**: Log the error and surface a status message to the user; retry with backoff instead of discarding the exception.
**Depends On**: None | **Blocks**: None

### Priority 31: `structure-layer-violation-1`
**Module**: structure | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `server.py`
**Description**: server.py mixes configuration loading, weather/task data access, prompt construction, action parsing, TTS synthesis, and WebSocket transport in a single module, so the transport layer directly performs data-access and external-API work.
**Remediation**: Split into modules: config.py (loading/validation), data_sources.py (weather/tasks), llm.py (prompt + Claude calls), tts.py (ElevenLabs), and keep server.py as the thin WebSocket transport.
**Depends On**: `cost-no-automated-tests-4` | **Blocks**: None

### Priority 32: `database-missing-app-pool-8`
**Module**: database | **Severity**: high | **Effort**: M | **Confidence**: 0.6
**Location**: `server.py`
**Description**: A single module-level httpx.AsyncClient is created at import and reused for all ElevenLabs calls with a fixed 30s timeout and no connection-pool limits, so a slow TTS response can exhaust the shared client for every concurrent request.
**Remediation**: Configure explicit httpx.Limits (max_connections, max_keepalive_connections) and per-request timeouts, and close the client on application shutdown.
**Depends On**: `performance-no-connection-pool-7` | **Blocks**: None

### Priority 33: `cost-no-automated-tests-4`
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.75
**Location**: `requirements.txt`
**Description**: The repository contains no test files or test configuration despite shipping a server, browser automation, screen capture, and a clap trigger, so every change is validated only by manually running the assistant.
**Remediation**: Add pytest with unit tests for extract_action, build_system_prompt, and the config loader, plus a smoke test that starts the FastAPI app and opens a WebSocket.
**Depends On**: None | **Blocks**: `structure-layer-violation-1`, `structure-config-logic-8`

### Priority 34: `cost-dev-setup-missing-3`
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `README.md`
**Description**: Setup requires Windows, Python 3.10+, Chrome, Playwright browsers, a microphone, and two paid API keys, but there is no docker-compose, devcontainer, or mock mode, so contributors cannot run or test the project without all external services.
**Remediation**: Add a mock mode that stubs Claude and ElevenLabs responses behind a config flag, and provide a devcontainer or docker-compose for the server and frontend.
**Depends On**: None | **Blocks**: None

### Priority 35: `cost-documentation-poor-7`
**Module**: cost | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `README.md`
**Description**: README documents usage and troubleshooting but never documents the WebSocket message protocol, the [ACTION:*] grammar, or the config.json schema, so the frontend/backend contract is only discoverable by reading server.py.
**Remediation**: Add a protocol section documenting the JSON frames (text, response, status, error) and the action grammar, and keep it in sync with the code.
**Depends On**: None | **Blocks**: None

### Priority 36: `github-commit-history-1`
**Module**: github | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `README.md`
**Description**: The repository is a personal template with a single author and no visible contribution workflow (no CONTRIBUTING, no issue templates, no CI configuration), indicating low maintenance activity and bus-factor risk.
**Remediation**: Add CONTRIBUTING.md, issue/PR templates, and a minimal CI workflow so external contributors can participate safely.
**Depends On**: None | **Blocks**: None

### Priority 37: `flows-missing-timeout-6`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `browser_tools.py`
**Description**: Playwright page.goto calls use a 15-20s timeout but the surrounding operations (wait_for_timeout, page.evaluate, click) have no timeout, so a hung page can block the single shared browser context indefinitely and stall all subsequent voice commands.
**Remediation**: Set explicit timeouts on click/evaluate/wait_for_selector and wrap each browser operation in asyncio.wait_for with a hard ceiling.
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-secret-in-code-1`: Keep only empty-string placeholders in config.example.json, add a startup check that refuses to run if keys look like real values, and document loading keys from environment variables instead of a… (XS)
- `security-secret-in-history-2`: Run a secret scanner (gitleaks/trufflehog) over full history, rotate any exposed Anthropic and ElevenLabs keys immediately, and add a pre-commit hook that blocks config.json and key-shaped strings. (S)
- `security-logs-contain-secrets-12`: Log only status codes and a redacted error category; never print raw response bodies or exception strings that may contain credentials, and route logs to a file with restricted permissions. (XS)
- `security-gha-secret-leak-3`: Start the server without an interactive shell (no 'cmd /k'), redirect stdout/stderr to a log file, and ensure no secret material is ever printed by the server. (XS)
- `code-empty-catch-1`: Catch specific exceptions (urllib.error.URLError, json.JSONDecodeError, OSError) and log them at warning level instead of silently returning empty data. (XS)
- `code-bare-except-1`: Replace 'except:' with 'except Exception as e:' and log the exception; never use a bare except in application code. (XS)
- `github-log-pattern-6`: Introduce a LOG_LEVEL setting and gate verbose output behind it; default to INFO in normal operation and never print raw API response bodies. (S)
- `flows-retry-no-backoff-4`: Implement exponential backoff with jitter (e.g. (XS)
- `cost-deprecated-version-10`: Pin exact versions or use compatible-release specifiers (~=) and add a scheduled dependency-update job that runs the test suite. (M)

### 60 Days
- `security-no-input-validation-14`: Validate the incoming JSON schema (type, max length), reject unknown fields, and enforce an Origin check plus a shared token on the WebSocket handshake. (M)
- `security-cors-wildcard-2`: Add CORSMiddleware with an explicit allowlist (http://localhost:8340) and verify the Origin header on WebSocket upgrade before accepting the connection. (XS)
- `security-missing-headers-10`: Add a middleware that sets Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, and Referrer-Policy on every response. (S)
- `security-file-upload-weak-7`: Validate URLs before navigation: allow only http/https schemes, reject localhost/private IP ranges, and resolve redirects against the same allowlist. (M)
- `flows-missing-error-handler-5`: Wrap the per-message handler in try/except, send a structured {type:'error'} frame to the client, and keep the connection alive so the user hears what went wrong. (M)
- `flows-missing-idempotency-3`: Write a lock file or use a named mutex before launching, and have launch-session.ps1 check for already-running processes before starting new ones. (S)
- `flows-missing-dlq-2`: Record failed actions to a local dead-letter log with the payload and error, and expose a retry path so transient browser failures can be replayed. (M)
- `flows-missing-rate-limit-8`: Add a per-connection token bucket limiting messages per minute and cap concurrent TTS requests; reject bursts with a status frame. (M)
- `structure-config-logic-8`: Move config loading into a function with explicit validation and clear error messages, and use config.get() with defaults or a validated settings object. (M)
- `structure-high-coupling-2`: Encapsulate the browser lifecycle in a class with explicit start/close and inject it into the action handlers instead of using module globals. (M)
- `performance-no-connection-pool-7`: Close the page in a finally block for every function, or reuse a single page and navigate it, and cap the number of open pages. (M)
- `performance-no-adaptive-timeout-6`: Use wait_until='domcontentloaded' with a shorter base timeout and poll for the target selector with an adaptive deadline instead of fixed sleeps. (M)
- `performance-no-compression-13`: Send audio as binary WebSocket frames (ArrayBuffer) instead of base64-in-JSON, and stream chunks as they arrive rather than buffering the whole response. (M)
- `cost-llm-high-usage-1`: Trim conversation history to the last N turns, cache the static system prompt with prompt caching, and move the action documentation out of the per-turn prompt. (M)
- `cost-api-no-response-cache-5`: Add a short TTL cache for weather (e.g. (M)
- `cost-api-no-usage-monitoring-9`: Log per-request token counts from the Anthropic response and character counts sent to ElevenLabs, and alert when daily totals exceed a configured budget. (M)
- `cost-gha-no-dependency-cache-5`: Generate a pinned requirements lock (pip-compile or uv lock) and commit it so installs are reproducible and cacheable. (M)
- `github-log-pattern-9`: Add a logging configuration with a rotating file handler and document where logs are written so failures can be diagnosed after the fact. (M)
- `code-print-statement-5`: Replace print() calls with a configured logging.Logger, set the level from config, and write to a rotating file handler. (S)
- `code-print-statement-8`: Use the logging module with a timestamped formatter so clap events and errors can be filtered and retained. (S)
- `code-unhandled-promise-4`: Log the error and surface a status message to the user; retry with backoff instead of discarding the exception. (S)

### 90 Days
- `structure-layer-violation-1`: Split into modules: config.py (loading/validation), data_sources.py (weather/tasks), llm.py (prompt + Claude calls), tts.py (ElevenLabs), and keep server.py as the thin WebSocket transport. (M)
- `database-missing-app-pool-8`: Configure explicit httpx.Limits (max_connections, max_keepalive_connections) and per-request timeouts, and close the client on application shutdown. (M)
- `cost-no-automated-tests-4`: Add pytest with unit tests for extract_action, build_system_prompt, and the config loader, plus a smoke test that starts the FastAPI app and opens a WebSocket. (M)
- `cost-dev-setup-missing-3`: Add a mock mode that stubs Claude and ElevenLabs responses behind a config flag, and provide a devcontainer or docker-compose for the server and frontend. (M)
- `cost-documentation-poor-7`: Add a protocol section documenting the JSON frames (text, response, status, error) and the action grammar, and keep it in sync with the code. (M)
- `github-commit-history-1`: Add CONTRIBUTING.md, issue/PR templates, and a minimal CI workflow so external contributors can participate safely. (M)

---

## Dependencies
- `structure-layer-violation-1` **Depends On** `cost-no-automated-tests-4` (blocks)
- `structure-config-logic-8` **Depends On** `cost-no-automated-tests-4` (blocks)
- `security-secret-in-history-2` **Depends On** `security-secret-in-code-1` (blocks)
- `flows-missing-error-handler-5` **Depends On** `flows-missing-dlq-2` (blocks)
- `database-missing-app-pool-8` **Depends On** `performance-no-connection-pool-7` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
