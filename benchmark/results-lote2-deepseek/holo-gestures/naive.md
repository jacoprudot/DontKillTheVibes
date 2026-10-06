# Repository Review: `holo-gestures`

Below are the concrete problems I found, grouped by severity. I've tried to be specific about *where* and *why*.

---

## 🔴 Critical / Correctness

### 1. `server.py` docstring contradicts the README and the actual architecture
The module docstring says:

> *"Hand tracking is Google MediaPipe (Apache-2.0) loaded from CDN in the page"*

But the README explicitly claims:

> *"The hand tracking is Google MediaPipe (Apache-2.0), **self-hosted inside this repo** — so ad-blockers, CDN outages, and offline machines can't break it."*

These are mutually exclusive. The README also references a `vendor/` directory (`vendor/wasm/vision_wasm_*.js`, `vision_bundle.mjs`, `three.module.js`) that **does not appear in the file tree** (17 files listed, no `vendor/`). Either:
- the vendor directory was never committed (and the "offline / ad-blocker-proof" claim is false), or
- the docstring is stale.

Either way, one of the two is lying to the user. This is the single biggest issue because the README's core selling point ("no CDN, works offline") is unverifiable from the repo contents.

### 2. `holo.json` ships with an empty folder, but README tells users to edit it
```json
{"folder": ""}
```
The README says *"It ships pointed at `sample-notes/` so it works the second you run it."* That's only true because `notes_dir()` falls back to `sample-notes` when the folder is empty/invalid. The config file itself is misleading — a user reading `holo.json` sees `""` and may think it's broken. Minor, but the README's claim is technically about the fallback, not the config.

### 3. `load_notes` silently truncates and hides errors
```python
for n in sorted(x for x in os.listdir(d) if x.endswith((".md", ".txt")))[:limit]:
```
- `limit=18` is hardcoded; a user with 200 notes sees only 18 with no indication.
- `except OSError: pass` swallows permission errors, missing dirs, etc. The user gets an empty deck with no diagnostic.
- `_note()` reads the whole file into memory then slices to 4000 chars — fine for notes, wasteful for large files, but more importantly the `full` field is truncated at 4000 chars with no ellipsis or flag, so the reader view silently cuts off long notes.

### 4. `PAGE_CACHE` is a one-element list used as a mutable global
```python
PAGE_CACHE = [open(...).read()]
```
This is a hack to avoid a `global` statement. It works, but:
- If `holo.html` is edited while the server runs, the change is never picked up (the comment acknowledges this as intentional for TCC reasons, but it means the documented dev workflow — *"Change something, then run `?probe=1`"* — requires a server restart, which the README doesn't mention).
- If the file is missing at boot, `PAGE_CACHE[0]` is `None` and the handler presumably 500s or serves nothing; there's no user-facing error page.

### 5. `holo.html` is 89 KB in a single file
The README calls it *"one readable HTML file"*. At ~90 KB of inline CSS + JS + HTML, "readable" is a stretch. There's no build step, no module split, no minification — which is fine for a demo, but the claim that *"Every gesture threshold is a named constant near the top"* is hard to verify when the file is this large and the constants are buried in a wall of CSS.

### 6. Duplicate CSS rule
```css
.card p { font-size:11px; line-height:1.55; color:#c9d6d2; white-space:pre-wrap; }
...
.card p { font-size:11px; }
```
The second `.card p` rule is redundant (and appears mid-file, between `#ring .r1` and `#ring .r2`). Looks like a leftover from an edit. Harmless but sloppy.

### 7. `#gl` canvas sizing comment is load-bearing but fragile
The comment explains that `width:100%; height:100%` is required because a `<canvas>` is a replaced element and `inset:0` won't stretch it. This is correct, but it's a landmine: any future refactor that "cleans up" the CSS by removing the redundant-looking `width/height` will silently break rendering on retina displays only. A regression test or a comment in the JS that asserts `canvas.width === innerWidth * dpr` would be safer.

---

## 🟠 Security / Privacy

### 8. `POST /api/state` writes to disk with no validation shown
The docstring says it *"writes state/holo-state.json"*. The handler body is truncated in the provided content, but:
- There's no mention of size limits, content-type checks, or path sanitization.
- `state/` is gitignored, which is good, but a local web server on `localhost:4890` is reachable by any page in the browser (no CSRF protection, no `Origin` check). A malicious site could POST arbitrary JSON to `http://localhost:4890/api/state` while the user has the deck open. For a local prototype this is low-risk, but it's worth a `Origin: http://localhost:4890` check or a random token.

### 9. `notes_dir()` trusts `holo.json` without confinement
```python
d = os.path.expanduser(cfg.get("folder", ""))
if d and os.path.isdir(d):
    return d
```
A user can point this at `/` or `~/.ssh` and the server will happily list `.md`/`.txt` files there. Since it's a local tool the user controls, this is arguably by design — but combined with the unauthenticated HTTP endpoint, any local process (or browser tab) can enumerate files in any directory the user has read access to, filtered to `.md`/`.txt`. Worth a note in the README at minimum.

### 10. `errors="ignore"` on note reads
```python
text = open(path, encoding="utf-8", errors="ignore").read()
```
Silently drops bytes on non-UTF-8 files. For a notes app this is probably fine, but it means a Latin-1 note will render with missing characters and no warning.

---

## 🟡 Repo hygiene / Documentation

### 11. `vendor/` is referenced but absent
Already covered in #1, but worth calling out separately: the `LICENSE` file's third-party section, the README's license section, and the README's "self-hosted" claim all reference `vendor/` contents that aren't in the tree. If this is a `.gitignore` issue, the `.gitignore` doesn't mention `vendor/`. If it's an oversight, the repo is broken as shipped.

### 12. `props/*.glb` are committed as raw binary in the repo
- `apollo-11-module.glb`: ~5 MB
- `triceratops.glb`: ~14 MB

That's ~19 MB of binary in git history, forever. For a demo repo this is a real cost to every clone. Options: Git LFS, a download script, or hosting on a release. The README's one-line install (`git clone ... && python3 server.py`) will be slow on poor connections.

### 13. `LICENSE` copyright year is 2026
```
Copyright (c) 2026 Zubair Trabzada / AI Workshop Studio LLC
```
Either the system clock is wrong, this is a typo, or the repo is from the future. Minor, but it looks like a mistake.

### 14. README claims `?probe=1` runs "26/26" but there's no test file
The probe battery is presumably inline in `holo.html` (which is truncated in the provided content), so this may be fine — but there's no way to run it in CI, no `package.json`, no `Makefile`, no test script. The "workflow" the README describes (*"Change something, then run `?probe=1`"*) is entirely manual and browser-dependent.

### 15. `sample-notes/` filenames are inconsistent
```
04-holo.md
08-second-brain.md
BUILDS/05-galaxy.md
BUILDS/06-v7.md
BUILDS/07-workshop.md
JARVIS/01-jarvis.md
JARVIS/02-the-arrow.md
JARVIS/03-takeover.md
```
Top-level notes are numbered `04`, `08`; subfolder notes restart at `01`. The numbering implies a larger set (01–03, 05–07 missing at top level) that isn't shipped. Either intentional (teasing the paid product) or an incomplete export. The README doesn't explain.

### 16. `server.py` docstring says "port 4890" but `HOLO_PORT` env var overrides it
The docstring is a hardcoded claim; the README documents `HOLO_PORT=4891`. Minor inconsistency.

### 17. No `requirements.txt`, no `pyproject.toml`, no version pin
The README says *"Python 3 is the only requirement (standard library only)"*. That's true for `server.py`, but there's no `python_requires` declaration anywhere, and `ThreadingHTTPServer` requires Python 3.7+. A user on 3.6 gets a confusing `ImportError`. A one-line `# requires Python 3.7+` in the docstring would help.

---

## 🔵 Code quality (from what's visible)

### 18. `_note()` title extraction is fragile
```python
title = (lines[0].lstrip("# ").strip() if lines else n)[:48] or n
```
- `lstrip("# ")` strips *any* leading `#` and space characters, so `## Heading` → `Heading` (fine) but `#hashtag` → `hashtag` (probably not intended).
- If the first non-empty line is body text (no `#`), it becomes the title. That's a reasonable fallback but undocumented.
- `[:48]` truncates mid-word with no ellipsis.

### 19. `rest = [l for l in lines[1:] if not l.startswith("#")]`
This drops *all* heading lines from the body, not just the title. So a note with `# Title\n## Section\nbody` loses `## Section` from the preview. Probably not intended.

### 20. `load_tree()` is defined but its body is truncated in the provided content
Can't fully review, but the docstring says *"One level deep: subfold..."* — the function exists and is presumably used by `/api/notes` or a separate endpoint, but the endpoint list in the docstring only mentions `/api/notes` and `/api/state`. Either `load_tree` is dead code or there's an undocumented endpoint.

### 21. `holo.html` inline JS has no error boundary
The file is 89 KB of inline script. If MediaPipe fails to load (CDN blocked, wasm shim missing, etc.), the user sees a black screen with no message. The `#perm` overlay handles camera permission, but there's no equivalent for "model failed to load". Given the README's emphasis on offline reliability, this is a notable gap.

### 22. `#dbg` is `display:none` with no documented way to enable it
```css
#dbg { ... display:none; ... }
```
Presumably toggled by a query param or key, but the README doesn't mention it. Either document it or remove it.

---

## Summary

| Category | Count |
|---|---|
| Critical (broken claims, missing files) | 2 |
| Correctness / silent failures | 5 |
| Security / privacy | 3 |
| Repo hygiene | 7 |
| Code quality | 5 |

**The two things I'd fix first:**
1. **Reconcile the MediaPipe story** — either commit `vendor/` or fix the README and docstring. Right now the repo's headline feature ("works offline, no CDN") is unverifiable.
2. **Move the `.glb` files out of git** — 19 MB of binary in a demo repo is a real cost, and the README's one-command install will be painful on slow connections.

Everything else is polish, but the silent-truncation issues in `server.py` (`limit=18`, `[:4000]`, `errors="ignore"`, `except OSError: pass`) will bite users with real note collections and are worth addressing before this is presented as a general-purpose tool.
