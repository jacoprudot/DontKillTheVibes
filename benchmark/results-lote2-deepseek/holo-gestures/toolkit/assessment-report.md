# Assessment Report: holo-gestures

- **Repository**: holo-gestures
- **Date**: 2026-10-05T20:41:11.140Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 1
- **Total Findings**: 14
- **By Severity**: critical 1 · high 3 · medium 7 · low 2 · info 1
- **Estimated Total Effort**: 3×XS, 3×S, 8×M
- **Top 3 Priorities**:
  - `code-empty-catch-1` — server.py contains two silent exception swallowers: `except Exception: pass` in notes_dir() and `except OSError: pass` in load_notes(). (critical, XS)
  - `code-generic-catch-2` — The holo.json loader catches the broadest possible exception type (`except Exception`) and does not rethrow or log. (high, S)
  - `security-cors-wildcard-2` — server.py serves the deck and the /api/notes and /api/state endpoints over plain HTTP on localhost with no CORS policy, no origin check,… (medium, XS)

---

## Detailed Findings (by Priority)

### Priority 1: `code-empty-catch-1`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.85
**Location**: `server.py`
**Description**: server.py contains two silent exception swallowers: `except Exception: pass` in notes_dir() and `except OSError: pass` in load_notes(). A malformed holo.json, a permissions error, or a missing notes directory all produce an empty or fallback result with zero signal, making the failure mode indistinguishable from 'the user has no notes'.
**Remediation**: Replace both bare swallows with explicit handling: log the exception (or re-raise a domain-specific error) so the operator can see why the configured folder was rejected, and keep the sample-notes fallback only for the genuinely-absent-config case.
**Evidence**:
```
try:
        cfg = json.load(open(os.path.join(ROOT, "holo.json")))
        d = os.path.expanduser(cfg.get("folder", ""))
        if d and os.path.isdir(d):
            return d
    except Exception:
        pass
```
**Depends On**: `security-error-detail-1` | **Blocks**: None

### Priority 2: `code-generic-catch-2`
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.8
**Location**: `server.py`
**Description**: The holo.json loader catches the broadest possible exception type (`except Exception`) and does not rethrow or log. This hides JSON decode errors, permission errors, and unexpected type errors behind the same silent fallback, so a corrupted config is never surfaced to the user.
**Remediation**: Catch the specific exceptions expected (json.JSONDecodeError, OSError) and log them; let genuinely unexpected exceptions propagate so they are visible during development.
**Evidence**:
```
except Exception:
        pass
```
**Depends On**: `security-error-detail-1` | **Blocks**: None

### Priority 3: `security-cors-wildcard-2`
**Module**: security | **Severity**: medium | **Effort**: XS | **Confidence**: 0.75
**Location**: `server.py`
**Description**: server.py serves the deck and the /api/notes and /api/state endpoints over plain HTTP on localhost with no CORS policy, no origin check, and no authentication. Any web page the user visits while the server is running can issue cross-origin requests to http://localhost:4890/api/notes and read the contents of the user's notes folder, and can POST to /api/state to write state/holo-state.json.
**Remediation**: Add an explicit Origin/Referer allowlist check on /api/* handlers (reject anything not from http://localhost:4890), and set an explicit `Access-Control-Allow-Origin: http://localhost:4890` header rather than leaving CORS unset.
**Evidence**:
```
GET  /api/notes      → [{name, title, body}] from the folder in holo.json
```
**Depends On**: None | **Blocks**: None

### Priority 4: `security-error-detail-1`
**Module**: security | **Severity**: info | **Effort**: XS | **Confidence**: 0.65
**Location**: `server.py`
**Description**: The notes loader swallows all exceptions with a bare `except Exception: pass` around the holo.json read and a bare `except OSError: pass` around the directory listing, so a misconfigured folder silently falls back to sample-notes with no diagnostic. Conversely, the page cache falls back to `PAGE_CACHE = [None]` on OSError, which will surface as an opaque failure rather than a clear error to the user.
**Remediation**: Log the swallowed exception at warning level (or return a structured error) instead of silently passing, and return an explicit 500 with a generic message plus a server-side log entry when holo.html cannot be read at boot.
**Evidence**:
```
except Exception:
        pass
    return os.path.join(ROOT, "sample-notes")
```
**Depends On**: None | **Blocks**: `code-empty-catch-1`, `code-generic-catch-2`

### Priority 5: `security-no-input-validation-14`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `server.py`
**Description**: The /api/state POST endpoint is described as writing state/holo-state.json but the handler performs no validation of the request body, content type, or size. An unauthenticated local caller (or any page able to reach localhost:4890) can write arbitrary JSON into the state directory, and the notes loader reads holo.json's `folder` value with os.path.expanduser and passes it straight to os.listdir without confining it to the repo — a crafted holo.json can point the server at any directory the process can read.
**Remediation**: Validate the POST body against a strict schema, cap its size, and reject non-JSON content types. Confine the notes folder to an allowlisted root (or require an explicit opt-in flag) before calling os.listdir on the expanded path.
**Evidence**:
```
POST /api/state      → future Jarvis hook: writes state/holo-state.json so the big brain can react to what the hands did
```
**Depends On**: `flows-missing-error-handler-5` | **Blocks**: None

### Priority 6: `code-missing-validation-4`
**Module**: code | **Severity**: high | **Effort**: M | **Confidence**: 0.75
**Location**: `server.py`
**Description**: The HTTP request handler exposes /api/notes and /api/state without any validation at the API boundary: no method check beyond the routing table, no content-type enforcement, no body size limit, and no authorization. The docstring itself flags /api/state as a 'future Jarvis hook' that writes to disk, which means an unvalidated write path is already documented as intended behavior.
**Remediation**: Add explicit method and content-type validation, enforce a maximum request body size, and gate /api/state behind a local-only check (e.g. verify the client address is loopback) before performing any filesystem write.
**Evidence**:
```
POST /api/state      → future Jarvis hook: writes state/holo-state.json
```
**Depends On**: `flows-missing-rate-limit-8` | **Blocks**: None

### Priority 7: `flows-missing-error-handler-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `server.py`
**Description**: There is no global error handler in server.py. Exceptions raised inside the request handler (for example from the unvalidated /api/state write, or from a notes directory that disappears between the isdir check and the listdir call) will surface as the default BaseHTTPRequestHandler traceback response rather than a structured error, and the client receives no consistent error contract.
**Remediation**: Override handle_one_request or wrap the routing logic in a try/except that logs the exception server-side and returns a consistent JSON error envelope with an appropriate status code.
**Evidence**:
```
class BaseHTTPRequestHandler
```
**Depends On**: None | **Blocks**: `security-no-input-validation-14`

### Priority 8: `flows-missing-rate-limit-8`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `server.py`
**Description**: The local HTTP server exposes /api/notes and /api/state with no rate limiting, no request size cap, and no concurrency bound beyond ThreadingHTTPServer's unbounded thread-per-request model. A runaway page or a loop can spawn unbounded threads and repeatedly re-read the notes directory, and the /api/state write path can be hammered without throttling.
**Remediation**: Add a simple token-bucket or fixed-window rate limit on /api/* and cap concurrent request threads; reject oversized bodies before reading them into memory.
**Evidence**:
```
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
```
**Depends On**: None | **Blocks**: `code-missing-validation-4`

### Priority 9: `security-gha-action-unpinned-5`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `README.md`
**Description**: No CI/CD workflow files exist in the repository, so the README's stated verification workflow ('run ?probe=1 and make sure it still says 26/26') is entirely manual and unpinned. There is no automated pipeline pinning actions to SHAs, no automated test gate, and no supply-chain control over the build. The README instructs contributors to run `npx @gltf-transform/cli copy in.glb out.glb`, which pulls an unpinned npm package at run time.
**Remediation**: Add a GitHub Actions workflow that runs the ?probe=1 battery headlessly on every push, and pin any third-party actions to full commit SHAs. Replace the ad-hoc `npx @gltf-transform/cli` instruction with a pinned devDependency version.
**Evidence**:
```
Change something, then run `?probe=1` and make sure it still says 26/26. That's the whole workflow.
```
**Depends On**: `security-gha-job-no-timeout-7` | **Blocks**: None

### Priority 10: `security-gha-job-no-timeout-7`
**Module**: security | **Severity**: medium | **Effort**: M | **Confidence**: 0.6
**Location**: `README.md`
**Description**: The project has no CI jobs at all, so no job timeout, concurrency control, or isolation exists for the only automated verification path (the in-page ?probe=1 battery). Long-running or hung verification is undetectable and unbounded.
**Remediation**: Introduce a CI job with an explicit `timeout-minutes` and `concurrency` group so the probe battery cannot hang indefinitely and parallel runs cannot collide.
**Evidence**:
```
?probe=1 — the built-in test battery runs the real engine on synthetic frames (26/26)
```
**Depends On**: None | **Blocks**: `security-gha-action-unpinned-5`

### Priority 11: `code-long-function-7`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `server.py`
**Description**: server.py mixes several concerns in a single module: HTTP routing and request handling, configuration loading with fallback, filesystem traversal, markdown parsing and truncation, and page caching. The _note function alone performs file reading, title extraction, heading stripping, and two separate truncation limits (420 and 4000 chars) with magic numbers inline.
**Remediation**: Split the module into focused units: a config loader, a notes repository (filesystem + parsing), and a thin HTTP handler. Extract the 420/4000 truncation limits into named constants.
**Evidence**:
```
return {"name": n, "title": title, "body": "\n".join(rest)[:420],
            "full": "\n".join(lines[1:])[:4000]}
```
**Depends On**: None | **Blocks**: None

### Priority 12: `code-ignores-return-value-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.55
**Location**: `server.py`
**Description**: The page cache is populated as `PAGE_CACHE = [None]` when holo.html cannot be read at boot, but nothing in the shown code checks for that sentinel before serving. The comment explains the caching rationale (macOS TCC losing file access) yet the failure path stores a None that will be served as the page body unless a downstream check exists outside the visible snippet.
**Remediation**: Check PAGE_CACHE[0] is not None in the GET / handler and return an explicit 500 with a clear message when the page failed to load at boot, rather than serving a None body.
**Evidence**:
```
try:
    PAGE_CACHE = [open(os.path.join(ROOT, "holo.html"), "rb").read()]
except OSError:
    PAGE_CACHE = [None]
```
**Depends On**: None | **Blocks**: None

### Priority 13: `code-print-statement-5`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `server.py`
**Description**: server.py uses the stdlib http.server ThreadingHTTPServer with no logging configuration. The default BaseHTTPRequestHandler log_message writes to stderr in an unstructured, unconfigurable format, and the module docstring gives no indication of a logging setup, so operational visibility into request handling, errors, and the notes-folder fallback is effectively absent.
**Remediation**: Configure the logging module at startup (level, format, destination) and override log_message to emit structured records, so request handling and the sample-notes fallback are observable.
**Evidence**:
```
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
```
**Depends On**: None | **Blocks**: None

### Priority 14: `code-missing-docstring-10`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `server.py`
**Description**: The public helper functions in server.py (notes_dir, _note, load_notes, load_tree) lack docstrings. Only the module-level docstring and load_tree carry any documentation, and load_tree's docstring is truncated mid-sentence ('One level deep: subfold...'), leaving the tree-loading contract undocumented.
**Remediation**: Add concise docstrings to notes_dir, _note, load_notes, and load_tree describing parameters, return shape, and the fallback behavior, and complete the truncated load_tree docstring.
**Evidence**:
```
def load_tree(limit_files=14):
    """One level deep: subfold
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `code-empty-catch-1`: Replace both bare swallows with explicit handling: log the exception (or re-raise a domain-specific error) so the operator can see why the configured folder was rejected, and keep the sample-notes… (XS)
- `code-generic-catch-2`: Catch the specific exceptions expected (json.JSONDecodeError, OSError) and log them; let genuinely unexpected exceptions propagate so they are visible during development. (S)
- `security-cors-wildcard-2`: Add an explicit Origin/Referer allowlist check on /api/* handlers (reject anything not from http://localhost:4890), and set an explicit `Access-Control-Allow-Origin: http://localhost:4890` header… (XS)
- `security-error-detail-1`: Log the swallowed exception at warning level (or return a structured error) instead of silently passing, and return an explicit 500 with a generic message plus a server-side log entry when holo.html… (XS)

### 60 Days
- `security-no-input-validation-14`: Validate the POST body against a strict schema, cap its size, and reject non-JSON content types. (M)
- `code-missing-validation-4`: Add explicit method and content-type validation, enforce a maximum request body size, and gate /api/state behind a local-only check (e.g. (M)
- `flows-missing-error-handler-5`: Override handle_one_request or wrap the routing logic in a try/except that logs the exception server-side and returns a consistent JSON error envelope with an appropriate status code. (M)
- `flows-missing-rate-limit-8`: Add a simple token-bucket or fixed-window rate limit on /api/* and cap concurrent request threads; reject oversized bodies before reading them into memory. (M)

### 90 Days
- `security-gha-action-unpinned-5`: Add a GitHub Actions workflow that runs the ?probe=1 battery headlessly on every push, and pin any third-party actions to full commit SHAs. (M)
- `security-gha-job-no-timeout-7`: Introduce a CI job with an explicit `timeout-minutes` and `concurrency` group so the probe battery cannot hang indefinitely and parallel runs cannot collide. (M)
- `code-long-function-7`: Split the module into focused units: a config loader, a notes repository (filesystem + parsing), and a thin HTTP handler. (M)
- `code-ignores-return-value-6`: Check PAGE_CACHE[0] is not None in the GET / handler and return an explicit 500 with a clear message when the page failed to load at boot, rather than serving a None body. (M)
- `code-print-statement-5`: Configure the logging module at startup (level, format, destination) and override log_message to emit structured records, so request handling and the sample-notes fallback are observable. (S)
- `code-missing-docstring-10`: Add concise docstrings to notes_dir, _note, load_notes, and load_tree describing parameters, return shape, and the fallback behavior, and complete the truncated load_tree docstring. (S)

---

## Dependencies
- `code-empty-catch-1` **Depends On** `security-error-detail-1` (blocks)
- `code-generic-catch-2` **Depends On** `security-error-detail-1` (blocks)
- `security-no-input-validation-14` **Depends On** `flows-missing-error-handler-5` (blocks)
- `code-missing-validation-4` **Depends On** `flows-missing-rate-limit-8` (blocks)
- `security-gha-action-unpinned-5` **Depends On** `security-gha-job-no-timeout-7` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
