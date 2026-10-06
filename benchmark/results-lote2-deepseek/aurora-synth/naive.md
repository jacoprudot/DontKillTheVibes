# Repository Review: aurora-synth

I reviewed the file tree, the seven provided files, and the overall structure. Below are the problems I found, ordered roughly by severity. Since most source files were truncated or omitted, some findings are inferences from structure and the visible code; I flag those explicitly.

---

## 1. Architecture / structural problems

### 1.1 No module system declared, but 171 files with `import`/`export`-style code
`package.json` is not shown, but the tree has `src/**/*.js` with `index.js` barrels (`src/demo/songs/index.js`, `src/demo/tours/index.js`, `src/presets/index.js`) and a `wrangler.jsonc` (Cloudflare Workers). There is no visible bundler config (no `vite.config`, `rollup.config`, `esbuild`, `webpack`, `tsconfig.json`). If these are ES modules loaded directly by the browser, every import path must be exact and the app must be served with correct MIME types — `tools/serve.mjs` presumably handles that, but there is no build step to catch broken imports. **Recommendation:** add a bundler or at least a `tsconfig`/`jsconfig` with `checkJs` so import errors surface at build time.

### 1.2 `tools/` is a second, unversioned application
`tools/video/**` alone contains ~40 files (capture, overlays, timelines, edit, finish, make-assets, make-bed, make-buildlog, make-label, record, xlen, director.html/js, etc.). This is effectively a video-production pipeline living inside the synth repo. It has its own `README.md`, its own `overlays/README.md`, its own `timelines/README.md`, and its own assets (`app-sample.jpg`). This is a large maintenance surface with no tests visible for it. Consider splitting into a separate repo or a workspace package.

### 1.3 Duplicated token fallback blocks
The same `:where(:root) { --bg-0 … --a-red … }` fallback block is copy-pasted in at least `css/components.css`, `css/demo-tools.css`, and partially in `css/jam.css`. Any token change must be made in N places. Extract to a single `css/tokens.css` and import it.

### 1.4 `css/demo.css` is 67 KB
A single stylesheet of 67 KB (and `css/components.css` at 34 KB, `css/demo-tools.css` at 30 KB) is a maintainability problem. These should be split by component, or at minimum by concern (layout / theme / animation).

---

## 2. Correctness / bug risks in the visible code

### 2.1 `@property --dc-a` is declared *after* it is used
In `css/demo.css`:

```css
.dc-btn::before {
  ...
  background: conic-gradient(from var(--dc-a, 0deg), ...);
  animation: dc-rim 6s linear infinite;
}
@property --dc-a { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes dc-rim { to { --dc-a: 360deg; } }
```

`@property` registration order relative to usage is generally fine in CSS, but the bigger issue is **browser support**: `@property` is not supported in older Safari/Firefox. Where it is unsupported, `--dc-a` is an unregistered custom property and the `@keyframes` animation of it will not interpolate — the rim will be static. There is no `@supports` guard. Add a fallback (e.g. a static gradient) or gate the animation.

### 2.2 `mask-composite` / `-webkit-mask-composite` mismatch
```css
-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
-webkit-mask-composite: xor;
mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
```
The standard property uses `exclude` but the prefixed one uses `xor`. These are *not* equivalent in all engines (`xor` vs `exclude` differ in how they treat overlapping regions in some implementations). This is a known footgun; verify the rim renders identically in Chrome and Safari, or use a single technique.

### 2.3 `overflow: hidden; overflow: clip;` pairs
Appears in `.dc` and `.dc__sheet`:
```css
overflow: hidden; overflow: clip; /* clip: never scrolled by scrollIntoView */
```
This is intentional (progressive enhancement), but `overflow: clip` on a scroll container also disables programmatic scrolling in some engines and changes `scrollIntoView` behavior for descendants. The comment acknowledges the intent, but combined with `.dc__body { overflow-y: auto; scroll-behavior: smooth; }` this is fragile. Document the interaction or use `overflow: clip` only where truly needed.

### 2.4 `color-mix(in oklab, …)` used pervasively with no fallback
`color-mix()` is unsupported in Safari < 16.2 and Firefox < 113. The entire visual system (knobs, chips, sliders, panels) depends on it. There is no `@supports` fallback anywhere in the visible CSS. On older browsers the UI will render with transparent/invalid colors. Either add fallbacks or declare a browser support floor in the README.

### 2.5 `oklch(from …)` relative color syntax
```css
@supports (color: oklch(from red l c h)) { .ac-knob { --k-g0: oklch(from var(--k-accent) …); } }
```
This is correctly guarded by `@supports`, which is good. But note the guard tests `oklch(from …)` while the body uses `calc(l - .1)` etc. — fine, but the fallback `--k-g0` defined outside the `@supports` uses `color-mix`, which itself may be unsupported. So on a browser with neither feature, the knob has no gradient. Acceptable degradation, but worth a comment.

### 2.6 `env(safe-area-inset-top)` without `viewport-fit=cover`
`.resume-pill` uses `env(safe-area-inset-top, 0px)`. This only returns non-zero if the page's `<meta name="viewport">` includes `viewport-fit=cover`. `index.html` is not shown, so this cannot be confirmed — but if it is missing, the safe-area handling is dead code. Verify.

### 2.7 `@keyframes mt-eq` animates `background-size` on a multi-layer background
```css
@keyframes mt-eq {
  0%   { background-size: 3px 60%, 3px 100%, 3px 40%; }
  33%  { background-size: 3px 100%, 3px 45%, 3px 80%; }
  ...
}
```
Animating `background-size` is not GPU-accelerated and forces repaint every frame. For a small 12×12 icon this is probably fine, but it is a pattern repeated across the codebase (see also `aurora-shift` on `background-size: 200% 100%` in `.dc-btn__ic` and `.dc__titleMain`). Prefer `transform`/`opacity` for anything that runs continuously.

### 2.8 `animation: dc-rim 6s linear infinite` on a `conic-gradient` with `@property`
Even where `@property` is supported, animating a conic-gradient angle forces the browser to re-rasterize the gradient every frame. On low-end devices this is a measurable cost for a decorative rim. Consider a rotating pseudo-element with `transform: rotate()` instead.

### 2.9 `.ac-knob__aura` uses `display: none` then `display: block` in a media-independent rule
```css
.ac-knob__aura { ... display: none; }
.ac-knob--lg .ac-knob__aura, .ac-knob--xl .ac-knob__aura { display: block; }
```
Fine, but the `opacity: 0` on the base rule means the aura is invisible until something sets opacity — and nothing in the visible CSS does. Either the aura is dead code or the opacity is set elsewhere (likely in JS). If JS-driven, that is a hidden coupling worth documenting.

### 2.10 `clip: rect(0 0 0 0)` in `.ac-sr-only`
```css
clip: rect(0 0 0 0); clip-path: inset(50%);
```
`clip` is deprecated; `clip-path` alone suffices. Harmless but stale.

### 2.11 `-webkit-user-select: none; user-select: none;` on `.ac-knob` etc.
This prevents text selection on labels, which is usually desired for controls, but it also prevents users from copying parameter values. Minor UX issue; consider allowing selection on `.ac-knob__value`.

---

## 3. Accessibility problems

### 3.1 `outline: none` on focusable elements
```css
.ac-knob__dial { outline: none; }
.mt .mt-ask__input:focus-visible { outline: none; }
```
Both are compensated by `:focus-visible` box-shadows, which is acceptable — but the box-shadow focus ring uses `color-mix`, so on unsupported browsers there is **no visible focus indicator at all**. This is a WCAG 2.4.7 failure on those browsers. Provide a solid-color fallback ring.

### 3.2 `aria-pressed` on toggle buttons without `role`
`.mt-chip[aria-pressed="true"]`, `.mt-ab[aria-pressed="true"]` — `aria-pressed` is valid on `button`, so this is fine, but the visual state relies entirely on color/box-shadow. Ensure there is a non-color affordance (the dot in `.mt-chip__dot` helps; `.mt-ab` has none). Add a checkmark or text change.

### 3.3 `prefers-reduced-motion` coverage is partial
Only `.resume-pill__dot` is disabled under reduced motion in the visible CSS. The codebase has many infinite animations: `dc-rim`, `dc-live`, `aurora-shift`, `logo-spin`, `sky`, `mt-eq`, `resume-blink`. None of the others appear to be gated. Add a global reduced-motion block.

### 3.4 `.dc__titleMain` uses `color: transparent` with `background-clip: text`
If `background-clip: text` is unsupported or the gradient fails, the title becomes invisible (transparent text on transparent background). Add a `color` fallback before the `background-clip` declaration.

### 3.5 `env(safe-area-inset-*)` only on one element
`.resume-pill` respects safe areas; the top bar, dock, and `.dc__sheet` (which uses `inset: 14px 14px 12px`) do not appear to. On notched devices the sheet may be clipped. Audit all fixed/absolute overlays.

---

## 4. Internationalization (i18n) problems

### 4.1 Bilingual labels are hardcoded in CSS class names and structure
`.ac-zh`, `.ac-en`, `.jam-bi__main`, `.jam-bi__sub`, `.mt-bi__main`, `.mt-bi__sub` — the UI is built around a fixed zh/en pair. `src/ui/app/i18n.js` exists, but the CSS assumes exactly two languages and a specific DOM shape. Adding a third language requires touching every component. Consider a data-attribute-driven approach.

### 4.2 `:lang(zh)` selector in `css/jam.css`
```css
.jam-bi__sub:lang(zh), .jam-style__sub:lang(zh) { letter-spacing: .05em; }
```
`:lang()` matches the element's language, which is inherited from `<html lang>`. If the page is `lang="en"` but a sub-label contains Chinese text, this rule never fires. The comment says "jam.js swaps them on a language switch" — so the JS must set `lang` on the element. Verify that it does; otherwise this is dead CSS.

### 4.3 `text-transform: uppercase` on Chinese text
`.ac-en`, `.mt-bi__sub`, `.jam-bi__sub` all apply `text-transform: uppercase`. When the "sub" slot holds Chinese (after a language swap), uppercase is a no-op but the `letter-spacing: .12em` remains, which looks wrong for CJK. The `:lang(zh)` override addresses letter-spacing but only if `lang` is set correctly (see 4.2).

---

## 5. Build / tooling problems

### 5.1 `.claude/launch.json` hardcodes port 5173
```json
{ "runtimeArgs": ["tools/serve.mjs"], "port": 5173 }
```
If `tools/serve.mjs` defaults to a different port or reads `PORT` from env, this config is misleading. Also, committing editor/agent-specific config (`.claude/`) to the repo is questionable — it should be in `.gitignore` unless the team standardizes on it.

### 5.2 `.gitignore` does not ignore `.claude/`
Given `.claude/launch.json` is committed, either it is intentional (team uses Claude Code) or an oversight. If intentional, document it; if not, add `.claude/` to `.gitignore`.

### 5.3 `wrangler.jsonc` present but no `wrangler` in devDependencies (not shown)
Cloudflare Workers config implies a deploy target, but there is no visible CI config (`.github/workflows/`), no `deploy` script reference, and no `wrangler.toml`/`wrangler.jsonc` schema validation. Verify the deploy path is documented.

### 5.4 `tools/selfsigned.mjs` + `.cert/` in `.gitignore`
Self-signed cert generation for local HTTPS is a smell: it usually means the app requires a secure context (AudioWorklet, `getUserMedia`, etc.). The `css/compat.css` comment confirms this ("http://<LAN-IP> is not a secure context"). This is a real deployment constraint — document it prominently in the README, and consider whether the app can degrade gracefully on insecure origins (it appears to show a splash warning, which is good).

### 5.5 No test runner config visible
`tools/test.mjs`, `tools/compat-checks.mjs`, `tools/magic-checks.mjs`, `tools/ui-checks.mjs`, `tools/analyze.mjs` — these look like ad-hoc scripts, not a test framework. There is no `vitest`/`jest`/`node:test` config. If these are the test suite, they need a documented entry point (`npm test`) and CI integration.

### 5.6 `tools/video/overlays/assets/app-sample.jpg` committed
Binary asset in the repo. If it is a sample used by the overlay preview, fine, but it bloats the repo and has no provenance. Consider Git LFS or generating it.

---

## 6. Documentation problems

### 6.1 `docs/` mixes HTML demos and Markdown
`docs/components-demo.html`, `docs/jam-demo.html`, `docs/magic-demo.html`, `docs/visuals-demo.html` sit alongside `docs/ARCHITECTURE.md`, `docs/PRESETS.md`, etc. The HTML demos are not linked from the README (not shown) and have no index. Add `docs/README.md` or an index page.

### 6.2 `docs/video/STORYBOARD.md` and `tools/video/README.md` overlap
Two READMEs for the video pipeline (`tools/video/README.md`, `tools/video/overlays/README.md`, `tools/video/timelines/README.md`) plus a storyboard doc. Consolidate or cross-link.

### 6.3 No `CONTRIBUTING.md`, no `CHANGELOG.md`
For a repo this size with a custom build/test pipeline, both are needed.

### 6.4 `LICENSE` present but license type unknown
Not shown. Ensure it is compatible with the bundled fonts (`Inter`, `Noto Sans TC`, `JetBrains Mono` are referenced in CSS but not vendored in the tree — they must be loaded from a CDN or system). If loaded from Google Fonts, note the privacy/offline implications.

---

## 7. Performance problems

### 7.1 `backdrop-filter: blur(20px) saturate(1.25)` on a full-screen overlay
`.dc` applies `backdrop-filter` over the entire viewport. Combined with `.dc__sky i { filter: blur(80px); mix-blend-mode: screen; }` (four large blurred elements animating), this is expensive. On mobile this will drop frames. Consider disabling the sky blur on low-end devices or using a pre-rendered image.

### 7.2 `mix-blend-mode: screen` on animated elements
`.dc__sky i` uses `mix-blend-mode: screen`, which forces the browser to composite the entire stacking context. Four such elements animating at 18–27 s each is a continuous compositing cost. Prefer `opacity` + `background-blend-mode` where possible.

### 7.3 `filter: blur(80px)` on 55vmax × 30vmax elements
Blur radius scales with element size; 80 px blur on a 55vmax element is very expensive. Pre-render to a texture.

### 7.4 `will-change` is absent
None of the continuously animated elements declare `will-change`. This is a double-edged sword (over-use is harmful), but for the few elements that animate forever (`dc-rim`, `logo-spin`, `sky`), promoting them to their own layer would help.

### 7.5 `scroll-behavior: smooth` on `.dc__body`
Smooth scrolling on a large scroll container can cause jank when combined with `backdrop-filter`. Consider `@media (prefers-reduced-motion: reduce) { scroll-behavior: auto; }`.

---

## 8. Security / privacy

### 8.1 `tools/serve.mjs` + self-signed cert
If `tools/serve.mjs` serves the repo root, it may expose `tools/`, `docs/`, and any `.env` files. Verify it restricts to the intended public directory. The `.gitignore` does not list `.env`, so if one exists it is committed.

### 8.2 No CSP visible
`index.html` is not shown, but a synth app that loads AudioWorklets, fonts, and possibly remote assets should have a Content-Security-Policy. Add one.

### 8.3 `wrangler.jsonc` may expose account IDs
Cloudflare `wrangler.jsonc` often contains `account_id` and route patterns. Verify no secrets are committed.

---

## 9. Minor / stylistic

- **Inconsistent class prefixes:** `ac-`, `dc-`, `mt-`, `jam-`, `np__`, `sv-`, `th__`. The `np__`/`sv-`/`th__` prefixes (now-playing, source-viz, theater) are not documented in any of the visible CSS headers. Add a prefix registry to `docs/ARCHITECTURE.md`.
- **`--fs-cap`, `--ls-cap`** are referenced in `css/components.css` but not defined in the fallback block. They must come from `css/style.css`; if that file fails to load, the fallback is incomplete.
- **`--glass-border`** referenced in `css/jam.css` with a fallback, but not in the `:where(:root)` block of `css/components.css` or `css/demo-tools.css`. Inconsistent token sets across files.
- **`--ease-out` / `--ease-spring`** defined in `css/demo-tools.css` fallback but not in `css/components.css` fallback, yet `css/components.css` uses `cubic-bezier` literals. Standardize.
- **`@keyframes aurora-shift`** is referenced in `css/demo.css` but not defined there — it must live in `css/style.css`. Cross-file keyframe dependencies are fragile; document them.
- **`@keyframes logo-spin`** same issue.
- **`@keyframes sky`** same issue.
- **`@keyframes dc-live`** is defined in `css/demo.css` and reused in `css/compat.css`? No — `css/compat.css` defines its own `resume-blink`. Fine, but the naming is inconsistent (`dc-live` vs `resume-blink`).
- **`clip-path: polygon(0 0, 100% 50%, 0 100%)`** for the play triangle in `.mt-play__ic::before` — the `inset: 0 1px 0 2px` makes the triangle asymmetric. Intentional? If so, comment it.
- **`font: 600 11px/1 var(--font-mono)`** in `.ac-bubble-base` — the `font` shorthand resets `font-family` to the fallback if `--font-mono` is undefined. Since `--font-mono` is defined in the fallback block, fine, but fragile.
- **`@media (prefers-reduced-motion: reduce)`** only appears once in the visible CSS. See 3.3.

---

## 10. Things I could not verify (files not provided)

- `package.json` — no scripts, deps, or `type: "module"` visible.
- `index.html` — no viewport meta, CSP, or script loading strategy visible.
- `src/worklet/processor.js` — AudioWorklet correctness, message protocol, and whether it handles `process()` returning `false` (which kills the node).
- `src/dsp/**` — DSP correctness (denormals, NaN handling, parameter smoothing, sample-rate assumptions).
- `src/ui/main.js` — boot sequence, error handling, and whether the splash reset path (referenced in `css/compat.css`) actually clears storage.
- `tools/serve.mjs` — path traversal protection, MIME types, HTTPS cert handling.
- `wrangler.jsonc` — deploy config and secret exposure.

---

## Summary of highest-priority fixes

1. **Add `@supports` fallbacks for `color-mix()` and `@property`** — the entire visual system depends on them, and there is no graceful degradation.
2. **Fix the `mask-composite: xor` vs `exclude` mismatch** in `.dc-btn::before`.
3. **Add a global `prefers-reduced-motion` block** covering all infinite animations.
4. **Provide a solid-color focus ring fallback** so keyboard users are not stranded on browsers without `color-mix`.
5. **Extract the duplicated `:where(:root)` token block** into one file.
6. **Split `css/demo.css` (67 KB)** and document the cross-file `@keyframes` dependencies.
7. **Decide whether `tools/video/**` belongs in this repo** — it is a second application with its own READMEs and assets.
8. **Document the secure-context requirement** (self-signed cert, AudioWorklet) prominently in the README.
9. **Add a test entry point and CI** for the `tools/*-checks.mjs` scripts.
10. **Audit `env(safe-area-inset-*)` usage** across all fixed overlays, not just `.resume-pill`.
