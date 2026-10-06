# Assessment Report: eurekagent

- **Repository**: eurekagent
- **Date**: 2026-10-05T20:23:22.648Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 2
- **Total Findings**: 14
- **By Severity**: critical 2 · high 2 · medium 6 · low 3 · info 1
- **Estimated Total Effort**: 3×XS, 4×S, 7×M
- **Top 3 Priorities**:
  - `code-empty-catch-1` — The double-decoding fallback for MCP tool responses swallows JSONDecodeError and TypeError with a bare pass, leaving `parsed` in an… (critical, XS)
  - `code-generic-catch-2` — The hook's top-level exception handler catches the generic Exception and only writes a debug entry plus a stderr print, so any failure in… (high, S)
  - `code-print-statement-5` — The hook writes its error output with `print(..., file=sys.stderr)` rather than the `logging` module, so there is no level control and no… (low, S)

---

## Detailed Findings (by Priority)

### Priority 1: `code-empty-catch-1`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.75
**Location**: `.claude/hooks/log_web_search.py:118`
**Description**: The double-decoding fallback for MCP tool responses swallows JSONDecodeError and TypeError with a bare pass, leaving `parsed` in an unknown state that is then treated as a result list — malformed search payloads are silently dropped or mis-parsed.
**Remediation**: Log the decode failure (or set a sentinel) instead of `pass`, and skip the entry explicitly when the payload cannot be decoded.
**Evidence**:
```
if isinstance(parsed, str):
    try:
        parsed = json.loads(parsed)
    except (json.JSONDecodeError, TypeError):
        pass
```
**Depends On**: None | **Blocks**: None

### Priority 2: `code-generic-catch-2`
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.85
**Location**: `.claude/hooks/log_web_search.py:262`
**Description**: The hook's top-level exception handler catches the generic Exception and only writes a debug entry plus a stderr print, so any failure in the search-logging path is silently swallowed and the caller (Claude Code) never learns that web-search history was not recorded.
**Remediation**: Catch the specific exceptions you can handle (json.JSONDecodeError, OSError, KeyError) and re-raise or exit non-zero for anything else so the hook failure surfaces instead of being hidden behind a debug line.
**Evidence**:
```
try:
    handler(tool_input, tool_response)
except Exception as e:
    _debug({"error": str(e), "tool_name": tool_name, "timestamp": _now()})
    print(f"[log_web_search] ERROR: {e}", file=sys.stderr)
```
**Depends On**: None | **Blocks**: None

### Priority 3: `code-print-statement-5`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.75
**Location**: `.claude/hooks/log_web_search.py:264`
**Description**: The hook writes its error output with `print(..., file=sys.stderr)` rather than the `logging` module, so there is no level control and no way to route hook diagnostics through the host's logging configuration.
**Remediation**: Use `logging.getLogger(__name__).error(...)` (or `warning`) so hook diagnostics respect the standard logging configuration.
**Evidence**:
```
print(f"[log_web_search] ERROR: {e}", file=sys.stderr)
```
**Depends On**: None | **Blocks**: None

### Priority 4: `code-missing-return-type-8`
**Module**: code | **Severity**: low | **Effort**: S | **Confidence**: 0.8
**Location**: `.claude/hooks/log_web_search.py:88`
**Description**: Several handler functions in the hook (`_handle_web_search_prime`, `_handle_web_search`, `_handle_playwright_navigate`, `_handle_playwright_snapshot`) lack return type annotations even though the module otherwise uses `from __future__ import annotations` and annotates parameters.
**Remediation**: Add `-> None` return annotations to all handler functions for consistency with the rest of the module.
**Evidence**:
```
def _handle_web_search_prime(tool_input: dict, tool_response: dict | str | None) -> None:
    query = tool_input.get("search_query", "")
```
**Depends On**: None | **Blocks**: None

### Priority 5: `security-error-detail-1`
**Module**: security | **Severity**: info | **Effort**: XS | **Confidence**: 0.6
**Location**: `.claude/hooks/log_web_search.py:264`
**Description**: The hook prints the raw exception message to stderr, which is surfaced back into the agent session and can leak internal paths or payload fragments from the host environment.
**Remediation**: Log the full exception server-side and emit a generic message (e.g. 'web search logging failed') to the session output.
**Evidence**:
```
print(f"[log_web_search] ERROR: {e}", file=sys.stderr)
```
**Depends On**: None | **Blocks**: None

### Priority 6: `security-no-input-validation-14`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/hooks/protect_result_files.py:88`
**Description**: `_resolve_tool_path` builds a path from the raw tool argument and resolves it without any containment check against the workspace root, so a tool call with an absolute path or `../` traversal is evaluated against whatever it resolves to — the protection logic trusts the caller-supplied path.
**Remediation**: Resolve the path and verify it is inside the expected workspace root (e.g. `/workspace`) before applying any allow/deny decision; reject paths that escape the root outright.
**Evidence**:
```
expanded = Path(raw_path).expanduser()
if not expanded.is_absolute():
    expanded = Path(cwd) / expanded
try:
    return expanded.resolve(strict=False)
```
**Depends On**: None | **Blocks**: None

### Priority 7: `security-gha-secret-leak-3`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.65
**Location**: `.claude/hooks/protect_result_files.py:196`
**Description**: The Bash-command guards rely on regex matching against the raw command string (`_contains_cuda_override`, `_is_write_to_protected_result`, `_contains_internal_dir_shell_op`), which is trivially bypassable with quoting, variable expansion, or base64-encoded payloads — the guard is a string filter, not a validated policy, so protected artifacts can be exfiltrated or overwritten.
**Remediation**: Parse the command with a shell-aware tokenizer (e.g. `shlex`) and evaluate the resolved argv, or move enforcement into the sandbox/container layer rather than pattern-matching command text.
**Evidence**:
```
patterns = [
    r'(?:^|[\s|;&`(])(?:export\s+)?CUDA_VISIBLE_DEVICES\s*=',
    r'\bos\.environ\s*\[\s*([\'"])CUDA_VISIBLE_DEVICES\1\s*\]\s*=',
]
```
**Depends On**: None | **Blocks**: None

### Priority 8: `structure-config-logic-8`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.75
**Location**: `.claude/hooks/log_web_search.py:22`
**Description**: Operational paths (`/workspace/round_state/web_search_history.jsonl`, `.../web_search_hook_debug.jsonl`) are hardcoded as module-level constants, so the hook cannot be pointed at a different workspace or test directory without editing source.
**Remediation**: Read the history/debug paths from environment variables (e.g. `EUREKA_ROUND_STATE_DIR`) with the current values as defaults.
**Evidence**:
```
_HISTORY_PATH = Path("/workspace/round_state/web_search_history.jsonl")
_DEBUG_PATH = Path("/workspace/round_state/web_search_hook_debug.jsonl")
```
**Depends On**: None | **Blocks**: None

### Priority 9: `structure-dto-logic-7`
**Module**: structure | **Severity**: low | **Effort**: S | **Confidence**: 0.7
**Location**: `.claude/hooks/protect_result_files.py:14`
**Description**: The set of protected result filenames and the protected internal directory name are hardcoded module constants, so adding a new controller-owned artifact requires editing the hook source rather than updating configuration.
**Remediation**: Move `PROTECTED_RESULT_FILES` and `PROTECTED_INTERNAL_DIR` into a config file or environment-driven list loaded at hook startup.
**Evidence**:
```
PROTECTED_RESULT_FILES = {"intermediate_results.jsonl", "best_result.jsonl"}
PROTECTED_INTERNAL_DIR = ".eureka_internal"
```
**Depends On**: None | **Blocks**: None

### Priority 10: `code-exact-duplication-significant-2`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/hooks/log_web_search.py:100`
**Description**: The same 'append a fallback entry with empty url/title and a truncated summary' block is repeated three times (unparsable JSON, no text captured, and the WebSearch no-URL case), duplicating the entry schema in several places.
**Remediation**: Introduce a single `_append_fallback(tool, query, summary)` helper and call it from all three sites so the JSONL schema is defined once.
**Evidence**:
```
_append({"tool": "web-search-prime", "query": query,
          "url": "", "title": "", "summary": text[:500],
          "timestamp": _now()})
```
**Depends On**: `code-copy-paste-variant-6` | **Blocks**: None

### Priority 11: `code-copy-paste-variant-6`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/hooks/log_web_search.py:160`
**Description**: `_handle_playwright_navigate` and `_handle_playwright_snapshot` repeat the same 'regex the response text for Page Title / Page URL, then append an entry' pattern with only the field names changed, duplicating the extraction logic.
**Remediation**: Extract a shared `_extract_page_metadata(text) -> tuple[str, str]` helper and have both handlers call it before appending their entries.
**Evidence**:
```
title = ""
m = re.search(r"Page Title:\s*(.+)", text)
if m:
    title = m.group(1).strip()
```
**Depends On**: None | **Blocks**: `code-exact-duplication-significant-2`

### Priority 12: `structure-controller-logic-6`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `.claude/hooks/log_web_search.py:88`
**Description**: The hook module mixes transport concerns (reading the Claude Code event envelope, key-name fallbacks for tool_response/tool_output/tool_result) with domain logic (search-result normalization, URL extraction, summary truncation) in a single file, so the transport contract and the parsing rules cannot evolve independently.
**Remediation**: Split the module into a thin `hook_entrypoint` that extracts the event envelope and a `search_log` module that owns normalization and persistence.
**Evidence**:
```
tool_response = (
    event.get("tool_response")
    or event.get("tool_output")
    or event.get("tool_result")
)
```
**Depends On**: `code-long-function-7` | **Blocks**: None

### Priority 13: `code-long-function-7`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/hooks/log_web_search.py:88`
**Description**: `_handle_web_search_prime` is a ~60-line function that mixes response-shape normalization (string, dict, list, double-encoded JSON) with entry construction and file appending, making the parsing rules hard to follow and test.
**Remediation**: Extract the normalization into a dedicated `_normalize_search_payload(text) -> list[dict]` helper and keep the handler limited to mapping normalized items to history entries.
**Evidence**:
```
def _handle_web_search_prime(tool_input: dict, tool_response: dict | str | None) -> None:
    query = tool_input.get("search_query", "")
    text = _extract_text_from_response(tool_response)
    ...
    if isinstance(parsed, list) and len(parsed) >= 1 and isinstance(parsed[0], dict):
        if "text" in parsed[0] and "title" not in parsed[0]:
```
**Depends On**: None | **Blocks**: `structure-controller-logic-6`

### Priority 14: `code-catch-and-continue-9`
**Module**: code | **Severity**: medium | **Effort**: M | **Confidence**: 0.8
**Location**: `.claude/hooks/log_web_search.py:247`
**Description**: The stdin/JSON parse guard catches bare Exception and returns silently, so a malformed hook payload (or a broken pipe) is indistinguishable from 'no event to process' and the hook exits 0 without logging anything — the failure is absorbed and processing continues as if nothing happened.
**Remediation**: Catch json.JSONDecodeError explicitly and log the raw payload length to stderr before returning, so malformed events are diagnosable rather than invisible.
**Evidence**:
```
try:
    raw = sys.stdin.read()
    event = json.loads(raw) if raw.strip() else {}
except Exception:
    return
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `code-empty-catch-1`: Log the decode failure (or set a sentinel) instead of `pass`, and skip the entry explicitly when the payload cannot be decoded. (XS)
- `code-generic-catch-2`: Catch the specific exceptions you can handle (json.JSONDecodeError, OSError, KeyError) and re-raise or exit non-zero for anything else so the hook failure surfaces instead of being hidden behind a… (S)
- `code-print-statement-5`: Use `logging.getLogger(__name__).error(...)` (or `warning`) so hook diagnostics respect the standard logging configuration. (S)
- `code-missing-return-type-8`: Add `-> None` return annotations to all handler functions for consistency with the rest of the module. (S)
- `security-error-detail-1`: Log the full exception server-side and emit a generic message (e.g. (XS)

### 60 Days
- `security-no-input-validation-14`: Resolve the path and verify it is inside the expected workspace root (e.g. (M)
- `security-gha-secret-leak-3`: Parse the command with a shell-aware tokenizer (e.g. (XS)
- `structure-config-logic-8`: Read the history/debug paths from environment variables (e.g. (M)
- `structure-dto-logic-7`: Move `PROTECTED_RESULT_FILES` and `PROTECTED_INTERNAL_DIR` into a config file or environment-driven list loaded at hook startup. (S)
- `code-exact-duplication-significant-2`: Introduce a single `_append_fallback(tool, query, summary)` helper and call it from all three sites so the JSONL schema is defined once. (M)
- `code-copy-paste-variant-6`: Extract a shared `_extract_page_metadata(text) -> tuple[str, str]` helper and have both handlers call it before appending their entries. (M)

### 90 Days
- `structure-controller-logic-6`: Split the module into a thin `hook_entrypoint` that extracts the event envelope and a `search_log` module that owns normalization and persistence. (M)
- `code-long-function-7`: Extract the normalization into a dedicated `_normalize_search_payload(text) -> list[dict]` helper and keep the handler limited to mapping normalized items to history entries. (M)
- `code-catch-and-continue-9`: Catch json.JSONDecodeError explicitly and log the raw payload length to stderr before returning, so malformed events are diagnosable rather than invisible. (M)

---

## Dependencies
- `structure-controller-logic-6` **Depends On** `code-long-function-7` (blocks)
- `code-exact-duplication-significant-2` **Depends On** `code-copy-paste-variant-6` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
