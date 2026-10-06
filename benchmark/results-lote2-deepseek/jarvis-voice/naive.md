# Repository Review: `jarvis-voice`

Below are the problems I found, grouped by severity. I've been specific about file and line/function where possible.

---

## 🔴 Critical / Security

### 1. API keys stored in plaintext `config.json` and read at import time
`server.py` loads `config.json` at module import and pulls `anthropic_api_key` / `elevenlabs_api_key` directly. There's no environment-variable fallback, no keyring, no `.env` support. The `.gitignore` does exclude `config.json`, but:
- `config.example.json` ships with placeholder keys that users are told to overwrite in place, encouraging committing real keys by accident.
- `CLAUDE.md` instructs Claude Code to write API keys into `config.json` — a file that lives in the repo working tree.
- No validation that keys are non-placeholder before use.

### 2. `subprocess` shell injection surface in `browser_tools._bring_chromium_to_front`
The PowerShell command is built as a single string and passed to `subprocess.run([...])`. It's currently static, so not exploitable today, but the pattern (embedding a PowerShell script with escaped quotes inside a Python list) is fragile and easy to break. More importantly, `scripts/launch-session.ps1` interpolates `$WORKSPACE_PATH` and `$BROWSER_URL` from config directly into `Start-Process` argument lists without quoting/validation — a malicious or malformed `config.json` can inject arguments.

### 3. `open_url` / `visit` accept arbitrary URLs with no scheme allowlist
`browser_tools.visit(url)` and `open_url(url)` will happily navigate to `file://`, `javascript:`, `data:`, or internal `http://localhost`/`169.254.169.254` addresses. Since the URL can come from the LLM's `[ACTION:OPEN]` output, this is an SSRF / local-file-read vector. There is no allowlist of schemes (`http`/`https` only) or host filtering.

### 4. `webbrowser.open` executed via `run_in_executor` with no validation
Same as above — `open_url` passes the raw string to the OS default handler, which on Windows can launch arbitrary registered protocols (`ms-msdt:`, `search-ms:`, etc.).

### 5. Bare `except:` clauses swallow everything
`server.py`:
```python
except:
    return None
```
in `get_weather_sync` and `get_tasks_sync`. This catches `KeyboardInterrupt` and `SystemExit` too, and hides real bugs (e.g., malformed JSON, permission errors). Should be `except Exception`.

### 6. `httpx.AsyncClient` created at import, never closed
`http = httpx.AsyncClient(timeout=30)` in `server.py` is a module-level global with no shutdown hook. On reload/restart this leaks connections. There's no `@app.on_event("shutdown")` to `await http.aclose()` or `await browser_tools.close()`.

---

## 🟠 Correctness / Logic Bugs

### 7. `search_and_read` never closes its page
```python
finally:
    pass
```
The `page` created in `search_and_read` is intentionally left open (comment says "keep page open so user can see it"), but this is inconsistent with `visit`, which closes its page. Over a session, every search leaks a tab. Same in `fetch_news` (`finally: pass`). There's no cap on open pages.

### 8. `_get_browser` is not concurrency-safe
```python
if _browser is None:
    pw = await async_playwright().start()
    _browser = await pw.chromium.launch(...)
```
Two concurrent calls (e.g., a SEARCH action and a NEWS action) can both see `_browser is None` and launch two browsers, orphaning one. Needs an `asyncio.Lock`.

### 9. `_bring_chromium_to_front` is synchronous inside async code
It calls `subprocess.run(..., timeout=3)` — a blocking call — directly from an `async def`. This blocks the event loop for up to 3 seconds on every search/news fetch. Should be `asyncio.create_subprocess_exec` or `run_in_executor`.

### 10. `open_url` uses deprecated `asyncio.get_event_loop()`
```python
loop = asyncio.get_event_loop()
```
Deprecated since 3.10 and raises in some contexts. Use `asyncio.get_running_loop()`.

### 11. `ACTION_PATTERN` is greedy and can match mid-text
```python
ACTION_PATTERN = re.compile(r'\[ACTION:(\w+)\]\s*(.*?)$', re.DOTALL | re.MULTILINE)
```
With `re.MULTILINE` and `$`, this matches to end-of-line, but `re.DOTALL` makes `.` match newlines, so `.*?` can span multiple lines. Combined with `search()` (not `findall`), only the first action is ever extracted — a response containing two actions silently drops the second. Also `\w+` allows arbitrary action names that `execute_action` doesn't handle (falls through silently).

### 12. `extract_action` strips text before the action but not after
If the model emits `"Sure. [ACTION:OPEN] http://x.com and also [ACTION:SEARCH] foo"`, the second action is lost and the trailing text is discarded. No validation that the action type is one of the four known types.

### 13. `get_system_prompt` uses `.replace("{time}", ...)` on a string that also contains literal `{weather_block}` f-string braces
The prompt is built with an f-string, so `{time}` is *not* interpolated there (it's escaped as `{{time}}`), then `get_system_prompt` does a string replace. This works but is brittle — any future `{...}` in the prompt will be silently replaced or left literal. Should just be an f-string parameter.

### 14. `WEATHER_INFO = ""` initialized as string, then reassigned to dict/None
```python
WEATHER_INFO = ""
...
def refresh_data():
    global WEATHER_INFO, TASKS_INFO
    WEATHER_INFO = get_weather_sync()  # dict or None
```
The initial `""` is a lie about the type. `build_system_prompt` checks `if WEATHER_INFO:` which works for both, but this is a latent type bug.

### 15. `refresh_data()` is called at import time, blocking startup
`refresh_data()` runs synchronously at module load, doing a network call to `wttr.in` with a 5s timeout. If the network is down, server startup is delayed by 5s. Should be lazy or in a startup event.

### 16. `get_tasks_sync` hardcodes `Tasks.md`
```python
tasks_path = os.path.join(TASKS_FILE, "Tasks.md")
```
The config key is `obsidian_inbox_path` but the filename is hardcoded. Users with a different vault layout get silent empty task lists (the `except:` swallows the `FileNotFoundError`).

### 17. `clap-trigger.py` has a race in the callback
```python
if triggered:
    return
...
triggered = True
```
`triggered` is a module global mutated from the audio callback thread and read from the main thread. No lock. In CPython the GIL makes this mostly safe, but the `last_clap_time` reset and the `Popen` are not atomic with the check. More importantly, `subprocess.Popen` is called *inside the audio callback*, which should be real-time-safe — spawning a process there can cause audio dropouts.

### 18. `clap-trigger.py` never resets `last_clap_time` on timeout
If a single clap is detected and no second clap follows within `MAX_GAP`, `last_clap_time` stays set. The next clap (hours later) will compute `gap > MAX_GAP`, fall into the `else` branch, and be treated as a "first clap" — which is correct. But the log message "First clap detected" is misleading, and there's no explicit timeout reset. Minor, but the state machine is implicit.

### 19. `launch-session.ps1` uses `Start-Sleep -Seconds 3` then queries processes
This is a fixed sleep — on slow machines VS Code/Obsidian may not have a `MainWindowHandle` yet, so `Snap-Window` silently does nothing. No retry loop.

### 20. `launch-session.ps1` `Snap-Window` doesn't check `MainWindowHandle -ne 0`
The callers filter with `Where-Object { $_.MainWindowHandle -ne 0 }`, but `Snap-Window` itself calls `MoveWindow` on whatever it's given. If the filter returns nothing, `$proc` is `$null` and the `if ($proc)` guard catches it — OK. But `ShowWindow($proc.MainWindowHandle, 9)` with a stale handle can throw.

### 21. `frontend/main.js` — `recognition` may be undefined
```js
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    ...
}
...
function startListening() {
    if (isPlaying) return;
    try {
        recognition.start();  // ReferenceError if SpeechRecognition unsupported
```
If the browser doesn't support Web Speech API (Firefox, Safari), `recognition` is `undefined` and `startListening` throws. The `try/catch` catches it, but the UI silently does nothing — no user-facing error. Also `orb.addEventListener('click', ...)` calls `recognition.stop()` unguarded.

### 22. `frontend/main.js` — `isListening` is set but `recognition.onend` also sets it
```js
recognition.onend = () => {
    isListening = false;
    if (!isPlaying) setTimeout(startListening, 300);
};
```
Combined with `startListening` setting `isListening = true` and `recognition.start()` throwing if already started, there's a race where `onend` fires after a manual `stop()` and restarts listening when the user wanted it paused. The `orb` click handler sets `isListening = false` but `onend` will still fire and restart.

### 23. `frontend/main.js` — audio queue never cleared on disconnect
`ws.onclose` reconnects but `audioQueue` and `isPlaying` persist. If the socket drops mid-playback, stale audio plays after reconnect.

### 24. `frontend/main.js` — `unlockAudio` uses a base64 MP3 data URI
The silent MP3 is a hardcoded ~1KB base64 blob. It works, but it's opaque and unmaintainable. Also `document.addEventListener('click', unlockAudio, { once: false })` — the `once: false` is the default and redundant; the listener is never removed, so it fires on every click forever.

### 25. `frontend/main.js` — `ws://` hardcoded
```js
ws = new WebSocket(`ws://${location.host}/ws`);
```
If the page is ever served over HTTPS, this fails (mixed content). Should use `location.protocol === 'https:' ? 'wss:' : 'ws:'`.

### 26. `screen_capture.py` — `ImageGrab.grab()` is Windows/macOS only
On Linux it raises. The README says Windows-only, but there's no guard or clear error. Also `ImageGrab.grab()` captures *all* monitors by default on some platforms — the prompt says "the screen" singular.

### 27. `screen_capture.py` — model name `claude-haiku-4-5-20251001` is hardcoded
No config option. If the model is deprecated, the whole screen-vision feature breaks. Same for the ElevenLabs `model_id: "eleven_turbo_v2_5"` in `server.py`.

### 28. `requirements.txt` missing `sounddevice` and `numpy`
`scripts/clap-trigger.py` imports `sounddevice` and `numpy`, but neither is in `requirements.txt`. The README's "Tech Stack" mentions `sounddevice`, but `pip install -r requirements.txt` won't install it. Users following the manual setup will hit `ModuleNotFoundError`.

### 29. `requirements.txt` pins `websockets` but the app uses FastAPI's WebSocket
FastAPI/Starlette uses `websockets` or `wsproto` under the hood, so it's needed transitively, but it's not directly imported anywhere in the code. Minor, but it's an undeclared transitive dep being pinned explicitly.

### 30. `config.example.json` has `"workspace_path": "C:\\Users\\YOUR_USER\\Desktop\\jarvis_template"` but the repo is `jarvis-voice`
Inconsistent naming — the README says `jarvis-voice-assistant`, the example says `jarvis_template`, the repo is `jarvis-voice`. Users will copy the wrong path.

---

## 🟡 Design / Maintainability

### 31. No tests at all
Zero test files. The action parser, the TTS chunker, the clap state machine, and the config loader are all pure-ish functions that are trivially testable. None are tested.

### 32. No logging framework
Everything is `print(..., flush=True)`. No log levels, no timestamps, no file output. Debugging a running session is painful.

### 33. `server.py` mixes concerns
Config loading, weather fetching, task reading, prompt building, action parsing, TTS, action execution, and WebSocket handling are all in one file. `build_system_prompt` is a 40-line f-string with embedded German grammar rules — should be a template file.

### 34. Hardcoded German everywhere
Prompts, error messages, UI strings, and the `recognition.lang = 'de-DE'` are all hardcoded. The README advertises "Mac Users: tell Claude Code to convert" — but there's no i18n layer, so this is a manual rewrite every time.

### 35. `conversations: dict[str, list]` is never bounded
Per-WebSocket conversation history grows unbounded. No token-count trimming, no max-turns cap. Long sessions will eventually exceed the model's context window and start erroring.

### 36. No rate limiting on the WebSocket
Any client that can reach `localhost:8340` can spam the endpoint, burning Anthropic and ElevenLabs credits. No auth, no origin check, no per-connection rate limit.

### 37. `frontend/index.html` loads `/static/style.css` but there's no static mount shown
`server.py` (truncated) presumably mounts `frontend/` at `/static`, but the HTML references `/static/style.css` and `/static/main.js` while the files are at `frontend/style.css` and `frontend/main.js`. If the mount is `app.mount("/static", StaticFiles(directory="frontend"))`, this works — but it's not visible in the provided excerpt, and the README's project structure doesn't mention the mount.

### 38. `CLAUDE.md` instructs Claude Code to edit `server.py` placeholders
> "ersetze die aktuellen Platzhalter 'Julian', 'KI-Berater und Automatisierungsexperte', 'Sir'"

This means the setup flow *modifies source code* rather than config. The system prompt should be built from `config.json` values (`user_name`, `user_address`, `user_role`), not hardcoded and then find-replaced. As written, every user's `server.py` diverges from upstream, making updates painful.

### 39. `.claude/settings.local.json` is committed with empty permissions
This file is typically machine-local and gitignored. Committing it with `"allow": []` means every user inherits an empty allowlist, and any local changes create merge conflicts. Should be in `.gitignore`.

### 40. `.gitignore` doesn't ignore `.claude/settings.local.json`
See above. Also doesn't ignore `*.mp3`, `*.png`, or any generated audio/screenshot artifacts.

### 41. `README.md` troubleshooting suggests `taskkill /f /im python.exe`
This kills *all* Python processes on the machine, not just Jarvis. Dangerous advice — users running Jupyter, other servers, or system Python will lose work.

### 42. `README.md` says "MIT" license but there's no `LICENSE` file
The repo has no `LICENSE` file despite the README claiming MIT. Legally ambiguous.

### 43. `README.md` clone URL doesn't match the repo name
```
git clone https://github.com/Julian-Ivanov/jarvis-voice-assistant.git
```
But the repo is `jarvis-voice`. Either the README is stale or the repo was renamed without updating docs.

### 44. `SETUP.md` is referenced but not shown
`CLAUDE.md` and `README.md` both point to `SETUP.md` for the actual setup flow. It's in the file tree but not in the provided contents — can't review it, but its absence from the excerpt means I can't verify the setup instructions match the code.

### 45. `browser_tools.py` imports `re`, `unquote`, `parse_qs`, `urlparse` but never uses them
```python
import re
from urllib.parse import unquote, parse_qs, urlparse
```
Dead imports. Also `httpx` is imported but unused in `browser_tools.py`.

### 46. `server.py` imports `base64` but (in the visible portion) never uses it
Likely used in the truncated WebSocket handler, but worth flagging.

### 47. `browser_tools.search_and_read` uses `duckduckgo.com/?q=` not the Lite endpoint
The module docstring says "DuckDuckGo Lite" but the code uses the full JS-heavy `duckduckgo.com`. The `[data-testid="result-title-a"]` selector is fragile and will break when DDG changes their markup. No fallback.

### 48. `browser_tools.fetch_news` hardcodes `worldmonitor.app`
No config option, no fallback source. If the site is down or changes layout, the feature silently returns "News konnten nicht geladen werden".

### 49. `browser_tools` uses a persistent `_context` but `visit` closes pages
`search_and_read` and `fetch_news` leak pages; `visit` closes them. Inconsistent lifecycle. No `page.close()` in `finally` for the leaking ones.

### 50. `frontend/main.js` — `addTranscript` grows unbounded
No cap on transcript DOM nodes. Long sessions will slow the browser.

---

## 🔵 Minor / Style

- `server.py` uses `dict[str, list]` (PEP 585) but `requirements.txt` doesn't pin a minimum Python version beyond the README's "3.10+". Fine, but worth a `python_requires` note.
- `config.example.json` uses `"user_address": "Sir"` — the key name suggests a postal address but it's a form of address. Confusing.
- `scripts/clap-trigger.py` has `#!/usr/bin/env python3` but is Windows-only (uses `powershell`). The shebang is misleading.
- `README.md` has a typo: "Demo & Explaination" → "Explanation".
- `README.md` says "no code written manually" — a nice brag, but it shows: the code has the characteristic LLM-generated pattern of defensive `try/except: pass` everywhere and inconsistent error handling.
- `frontend/style.css` uses `#orb.idle` etc. but `setOrbState` sets `orb.className = state`, which *replaces* all classes. If any other class is ever added to the orb, it's wiped. Should use `classList`.
- `frontend/main.js` `console.log('[jarvis] ...')` left in production code.
- `browser_tools._bring_chromium_to_front` has a comment "Bring the Playwright Chromium window to the foreground on Windows" but the PowerShell also matches `chrome` — it may bring the user's *regular* Chrome to front instead of the Playwright instance.

---

## Summary of highest-priority fixes

1. **Move secrets out of `config.json`** into env vars / OS keyring; validate at startup.
2. **Add URL scheme/host allowlisting** in `browser_tools.visit` and `open_url`.
3. **Fix the `_get_browser` race** with an `asyncio.Lock`.
4. **Close leaked pages** in `search_and_read` and `fetch_news`.
5. **Add `sounddevice` and `numpy` to `requirements.txt`**.
6. **Replace bare `except:`** with `except Exception`.
7. **Add a shutdown hook** to close `httpx.AsyncClient` and the Playwright browser.
8. **Guard `recognition`** in `main.js` for unsupported browsers.
9. **Stop editing `server.py` during setup** — drive the system prompt from config.
10. **Add a `LICENSE` file** and fix the README clone URL.
