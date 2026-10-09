# SWEEP-100 — deterministic detector over the pre-registered 100-target sample

- **frozen revision**: `d216b12`
- **selection rule**: `benchmark/targets-100.json` · frozen at 2026-10-09T01:51:57.036Z · benchmark/SELECTION-100.md
- **sweep ran**: 2026-10-09T05:50:15.568Z → 2026-10-09T06:10:02.834Z (1187.3s wall clock)
- **engine**: `scripts/detect/report.mjs` (the same assembler every other report uses) · hard timeout **180s/repo**
- **clones**: `benchmark/work100` · **manifest targets**: 100 · **run in this sweep**: 100

## Headline

| measure | value |
|---|---:|
| targets run | 100 |
| completed (report written) | 100 |
| **timed out (killed at 180s — counts NULL, not 0)** | **0** |
| failed (no findings.json) | 0 |
| clone directory missing | 0 |
| not a git checkout (no `.git` — the demo-snapshot case; scanned, but no history rule can run) | 0 |
| git checkouts | 100 |
| **shallow (git reports shallow, a `.git/shallow` marker, or 1 visible commit)** | **0** |
| history measurable (not shallow) | 100 |
| **repos with ≥1 critical/high DETECTOR finding WITH a real remediation** | **63** |
| repos with detector findings but NO real remediation text (rule gap) | 0 |
| clones carrying the manifest's pinned `commit` | 100 verified · 0 MISMATCH · 0 unverifiable |

### Shallow checkouts — every history statistic below is VOID on these

None. All 100 git checkout(s) carry more than one visible commit, so the git-history rules could produce a real number.

### Distribution by `primary_stack` (a measured property of the sample, not a filter)

| primary_stack | targets |
|---|---:|
| `node` | 48 |
| `python` | 31 |
| `next` | 19 |
| `unknown` | 2 |

### Distribution by `signals` (a measured property of the sample, not a filter)

A target can carry several signals, so the column does not sum to the sample size.

| signal | targets |
|---|---:|
| `(no signals declared)` | 53 |
| `claude-md` | 27 |
| `next` | 19 |
| `python-requirements` | 10 |
| `shadcn` | 6 |
| `cursorrules` | 1 |

### Distribution by `language`

| language | targets |
|---|---:|
| `TypeScript` | 50 |
| `Python` | 32 |
| `JavaScript` | 16 |
| `GDScript` | 1 |
| `Rust` | 1 |

## Per-repo results

Every target in the manifest appears below with its status. `sec` is the child's wall-clock time. `cov!` is the share of non-binary files no regex rule examined (`coverage.files_not_analysed / files_text`) — high `cov!` means a low finding count is weak evidence, not good news.

| # | repo | primary_stack | status | checkout | pinned | sec | grade | det | crit | high | crit+high | with real remediation | ausencia | degraded | rule fail | cap trunc | cov! % |
|---:|---|---|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | `pyupio__safety` | python | OK | GIT_CHECKOUT | match | 6.8 | F·15 | 275 | 15 | 0 | 15 | 15 | 507 | 39 | 0 | 24 | 12 |
| 2 | `doobidoo__mcp-memory-service` | python | OK | GIT_CHECKOUT | match | 17.6 | F·44 | 387 | 44 | 1 | 45 | 45 | 636 | 39 | 0 | 38 | 5.3 |
| 3 | `unjs__fontaine` | node | OK | GIT_CHECKOUT | match | 9.6 | C | 112 | 0 | 0 | 0 | 0 | 482 | 39 | 0 | 19 | 24.6 |
| 4 | `xiufengsun__TokenTracker` | node | OK | GIT_CHECKOUT | match | 18.4 | F·47 | 459 | 47 | 3 | 50 | 50 | 647 | 39 | 0 | 38 | 8.3 |
| 5 | `unadlib__mutative` | next | OK | GIT_CHECKOUT | match | 7.7 | C | 169 | 0 | 0 | 0 | 0 | 484 | 39 | 0 | 19 | 7 |
| 6 | `tsingyuai__growth-lab` | python | OK | GIT_CHECKOUT | match | 4.1 | F·6 | 106 | 6 | 0 | 6 | 6 | 401 | 39 | 0 | 8 | 4 |
| 7 | `openclaw__clawsweeper` | node | OK | GIT_CHECKOUT | match | 29.8 | F·59 | 406 | 59 | 0 | 59 | 59 | 648 | 39 | 0 | 36 | 1.2 |
| 8 | `deer-flow__llm-space` | node | OK | GIT_CHECKOUT | match | 12.5 | D | 288 | 0 | 3 | 3 | 3 | 482 | 39 | 0 | 32 | 2 |
| 9 | `RedPlanetHQ__core` | node | OK | GIT_CHECKOUT | match | 24.8 | F·9 | 393 | 9 | 30 | 39 | 39 | 616 | 39 | 0 | 38 | 5.6 |
| 10 | `astrofox-io__astrofox` | next | OK | GIT_CHECKOUT | match | 14.1 | C | 253 | 0 | 0 | 0 | 0 | 406 | 39 | 0 | 29 | 11.2 |
| 11 | `LingyiChen-AI__JadeAI` | next | OK | GIT_CHECKOUT | match | 8.9 | F·20 | 305 | 20 | 1 | 21 | 21 | 479 | 39 | 0 | 27 | 2.2 |
| 12 | `ai-that-works__ai-that-works` | next | OK | GIT_CHECKOUT | match | 16.2 | F·30 | 326 | 30 | 1 | 31 | 31 | 491 | 40 | 0 | 34 | 32.1 |
| 13 | `szczyglis-dev__py-gpt` | python | OK | GIT_CHECKOUT | match | 44 | F·20 | 380 | 20 | 0 | 20 | 20 | 486 | 40 | 0 | 38 | 28.4 |
| 14 | `opensheetmusicdisplay__opensheetmusicdisplay` | node | OK | GIT_CHECKOUT | match | 14.6 | C | 287 | 0 | 0 | 0 | 0 | 332 | 39 | 0 | 26 | 50.4 |
| 15 | `reactnativecn__react-native-update` | node | OK | GIT_CHECKOUT | match | 9.7 | D | 277 | 0 | 1 | 1 | 1 | 513 | 39 | 0 | 29 | 29.7 |
| 16 | `microsoft__vscode-js-debug` | node | OK | GIT_CHECKOUT | match | 15.7 | D | 285 | 0 | 5 | 5 | 5 | 456 | 39 | 0 | 31 | 40.7 |
| 17 | `jeffbski__wait-on` | node | OK | GIT_CHECKOUT | match | 4.6 | F·1 | 60 | 1 | 0 | 1 | 1 | 357 | 39 | 0 | 8 | 10.2 |
| 18 | `zer0yu__CyberSecurityRSS` | python | OK | GIT_CHECKOUT | match | 4.4 | C | 36 | 0 | 0 | 0 | 0 | 52 | 39 | 0 | 0 | 36.4 |
| 19 | `aipoch__medical-research-skills` | python | OK | GIT_CHECKOUT | match | 47.2 | F·44 | 318 | 44 | 1 | 45 | 45 | 544 | 40 | 0 | 35 | 13.6 |
| 20 | `ifandelse__machina.js` | node | OK | GIT_CHECKOUT | match | 6.7 | F·2 | 166 | 2 | 0 | 2 | 2 | 534 | 39 | 0 | 25 | 10.9 |
| 21 | `chengzuopeng__stock-sdk` | node | OK | GIT_CHECKOUT | match | 7.2 | F·8 | 215 | 8 | 0 | 8 | 8 | 369 | 39 | 0 | 22 | 5.5 |
| 22 | `OpenBMB__StaffDeck` | python | OK | GIT_CHECKOUT | match | 12.2 | F·24 | 358 | 24 | 0 | 24 | 24 | 476 | 40 | 0 | 31 | 3.6 |
| 23 | `webpack__minimizer-webpack-plugin` | node | OK | GIT_CHECKOUT | match | 5.9 | C | 77 | 0 | 0 | 0 | 0 | 347 | 39 | 0 | 13 | 29.9 |
| 24 | `ShenSeanChen__waku-agent` | python | OK | GIT_CHECKOUT | match | 7.8 | F·15 | 255 | 15 | 0 | 15 | 15 | 463 | 39 | 0 | 25 | 11.3 |
| 25 | `microsoft__vscode-eslint` | node | OK | GIT_CHECKOUT | match | 6.6 | F·6 | 108 | 6 | 1 | 7 | 7 | 419 | 39 | 0 | 19 | 11.6 |
| 26 | `Zoo-Code-Org__Zoo-Code` | node | OK | GIT_CHECKOUT | match | 31.2 | F·6 | 397 | 6 | 2 | 8 | 8 | 620 | 39 | 0 | 35 | 2.8 |
| 27 | `zhangxiangliang__stock-api` | node | OK | GIT_CHECKOUT | match | 4.5 | F·2 | 74 | 2 | 0 | 2 | 2 | 389 | 39 | 0 | 15 | 10.3 |
| 28 | `electric-capital__open-dev-data` | python | OK | GIT_CHECKOUT | match | 33.4 | F·3 | 69 | 3 | 0 | 3 | 3 | 156 | 39 | 0 | 0 | 9 |
| 29 | `filiksyos__gitreverse` | next | OK | GIT_CHECKOUT | match | 5.3 | D | 182 | 0 | 2 | 2 | 2 | 378 | 39 | 0 | 20 | 7.3 |
| 30 | `helallao__perplexity-ai` | python | OK | GIT_CHECKOUT | match | 4.5 | C | 126 | 0 | 0 | 0 | 0 | 223 | 39 | 0 | 7 | 9.5 |
| 31 | `VoidenHQ__voiden` | node | OK | GIT_CHECKOUT | match | 13.4 | F·5 | 340 | 5 | 2 | 7 | 7 | 551 | 40 | 0 | 32 | 7 |
| 32 | `danielwh2__cuelume` | node | OK | GIT_CHECKOUT | match | 4.2 | C | 34 | 0 | 0 | 0 | 0 | 221 | 39 | 0 | 0 | 30.3 |
| 33 | `rq__django-rq` | python | OK | GIT_CHECKOUT | match | 5 | F·3 | 97 | 3 | 1 | 4 | 4 | 219 | 39 | 0 | 9 | 26.8 |
| 34 | `kadirnar__whisper-plus` | python | OK | GIT_CHECKOUT | match | 4.9 | C | 148 | 0 | 0 | 0 | 0 | 249 | 39 | 0 | 11 | 13.8 |
| 35 | `feitangyuan__onetake` | python | OK | GIT_CHECKOUT | match | 4.6 | C | 134 | 0 | 0 | 0 | 0 | 166 | 39 | 0 | 1 | 13.2 |
| 36 | `uber__ADR` | python | OK | GIT_CHECKOUT | match | 9.2 | F·34 | 321 | 34 | 0 | 34 | 34 | 493 | 40 | 0 | 25 | 11.8 |
| 37 | `marmelab__json-graphql-server` | node | OK | GIT_CHECKOUT | match | 5.4 | B | 31 | 0 | 0 | 0 | 0 | 337 | 39 | 0 | 14 | 10.2 |
| 38 | `nodejs__llhttp` | node | OK | GIT_CHECKOUT | match | 4.8 | C | 84 | 0 | 0 | 0 | 0 | 318 | 39 | 0 | 5 | 18.8 |
| 39 | `TanShilongMario__PromptFill` | node | OK | GIT_CHECKOUT | match | 12.7 | D | 227 | 0 | 1 | 1 | 1 | 301 | 39 | 0 | 21 | 10.2 |
| 40 | `kswedberg__jquery-smooth-scroll` | node | OK | GIT_CHECKOUT | match | 4.7 | C | 49 | 0 | 0 | 0 | 0 | 149 | 39 | 0 | 0 | 65.8 |
| 41 | `nbubna__store` | node | OK | GIT_CHECKOUT | match | 4.9 | C | 79 | 0 | 0 | 0 | 0 | 297 | 39 | 0 | 13 | 29.7 |
| 42 | `databricks-solutions__ai-dev-kit` | python | OK | GIT_CHECKOUT | match | 8.3 | F·26 | 281 | 26 | 0 | 26 | 26 | 506 | 40 | 0 | 28 | 5 |
| 43 | `severity1__claude-code-prompt-improver` | python | OK | GIT_CHECKOUT | match | 3.8 | C | 27 | 0 | 0 | 0 | 0 | 163 | 39 | 0 | 1 | 8 |
| 44 | `timbrel__GitSavvy` | python | OK | GIT_CHECKOUT | match | 7.3 | F·5 | 247 | 5 | 0 | 5 | 5 | 280 | 39 | 0 | 18 | 38.5 |
| 45 | `MicrosoftDocs__mcp` | node | OK | GIT_CHECKOUT | match | 4 | D | 42 | 0 | 1 | 1 | 1 | 341 | 39 | 0 | 8 | 13 |
| 46 | `shadcnstudio__shadcn-studio` | next | OK | GIT_CHECKOUT | match | 10.7 | C | 199 | 0 | 0 | 0 | 0 | 371 | 39 | 0 | 25 | 13.2 |
| 47 | `c15t__c15t` | next | OK | GIT_CHECKOUT | match | 18 | F·18 | 314 | 18 | 5 | 23 | 23 | 633 | 39 | 0 | 32 | 9 |
| 48 | `vstorm-co__full-stack-ai-agent-template` | python | OK | GIT_CHECKOUT | match | 17.1 | F·11 | 346 | 11 | 4 | 15 | 15 | 578 | 39 | 0 | 33 | 5.6 |
| 49 | `Swatinem__rust-cache` | node | OK | GIT_CHECKOUT | match | 30.9 | C | 43 | 0 | 0 | 0 | 0 | 431 | 39 | 0 | 7 | 23.9 |
| 50 | `aeonfun__opendia` | node | OK | GIT_CHECKOUT | match | 5.3 | F·2 | 83 | 2 | 5 | 7 | 7 | 274 | 39 | 0 | 6 | 12.8 |
| 51 | `balajmarius__svg2jsx` | next | OK | GIT_CHECKOUT | match | 5 | C | 14 | 0 | 0 | 0 | 0 | 322 | 39 | 0 | 14 | 9.7 |
| 52 | `JohnHeibel__PDoomVideo` | node | OK | GIT_CHECKOUT | match | 4.7 | C | 134 | 0 | 0 | 0 | 0 | 241 | 39 | 0 | 1 | 12 |
| 53 | `nuxt-community__auth-module` | node | OK | GIT_CHECKOUT | match | 6.9 | C | 108 | 0 | 0 | 0 | 0 | 381 | 39 | 0 | 17 | 14.1 |
| 54 | `wiedehopf__tar1090` | node | OK | GIT_CHECKOUT | match | 9.9 | C | 130 | 0 | 0 | 0 | 0 | 193 | 39 | 0 | 1 | 56.9 |
| 55 | `openupm__openupm` | node | OK | GIT_CHECKOUT | match | 22.5 | C | 36 | 0 | 0 | 0 | 0 | 355 | 39 | 0 | 8 | 0.1 |
| 56 | `silvertakana__worldwideview` | next | OK | GIT_CHECKOUT | match | 21.5 | F·43 | 361 | 43 | 3 | 46 | 46 | 684 | 39 | 0 | 34 | 7.3 |
| 57 | `zanwei__design-dna` | node | OK | GIT_CHECKOUT | match | 3.6 | C | 3 | 0 | 0 | 0 | 0 | 30 | 39 | 0 | 0 | 13.3 |
| 58 | `PowerShell__vscode-powershell` | node | OK | GIT_CHECKOUT | match | 8.3 | F·2 | 123 | 2 | 0 | 2 | 2 | 420 | 39 | 0 | 16 | 40.2 |
| 59 | `microsoft__vscode-mssql` | node | OK | GIT_CHECKOUT | match | 50.5 | F·2 | 419 | 2 | 14 | 16 | 16 | 613 | 40 | 0 | 38 | 9 |
| 60 | `DanKE123abc__NoUnityCN` | next | OK | GIT_CHECKOUT | match | 4.9 | C | 93 | 0 | 0 | 0 | 0 | 282 | 39 | 0 | 4 | 5.2 |
| 61 | `hanshuaikang__nezha` | node | OK | GIT_CHECKOUT | match | 6.6 | C | 229 | 0 | 0 | 0 | 0 | 361 | 39 | 0 | 24 | 20.6 |
| 62 | `parse-community__parse-server-example` | node | OK | GIT_CHECKOUT | match | 9 | C | 13 | 0 | 0 | 0 | 0 | 300 | 39 | 0 | 4 | 33.3 |
| 63 | `opennextjs__opennextjs-cloudflare` | next | OK | GIT_CHECKOUT | match | 11.8 | D | 236 | 0 | 1 | 1 | 1 | 496 | 39 | 0 | 24 | 14.9 |
| 64 | `chinesehuazhou__python-weekly` | next | OK | GIT_CHECKOUT | match | 6.6 | F·2 | 203 | 2 | 0 | 2 | 2 | 389 | 39 | 0 | 20 | 2.1 |
| 65 | `evoluhq__evolu` | next | OK | GIT_CHECKOUT | match | 19.2 | C | 208 | 0 | 0 | 0 | 0 | 518 | 39 | 0 | 26 | 8.2 |
| 66 | `karlicoss__promnesia` | python | OK | GIT_CHECKOUT | match | 7.5 | F·2 | 194 | 2 | 1 | 3 | 3 | 372 | 39 | 0 | 21 | 32.5 |
| 67 | `RubinLabs26__ISpotify` | python | OK | GIT_CHECKOUT | match | 4.4 | F·10 | 181 | 10 | 0 | 10 | 10 | 372 | 39 | 0 | 12 | 18 |
| 68 | `valqore__valqore` | python | OK | GIT_CHECKOUT | match | 4.1 | C | 47 | 0 | 0 | 0 | 0 | 419 | 39 | 0 | 9 | 6.7 |
| 69 | `kajisho5__ffmpeg-skill` | python | OK | GIT_CHECKOUT | match | 7.3 | F·7 | 256 | 7 | 0 | 7 | 7 | 495 | 39 | 0 | 27 | 2.6 |
| 70 | `valor-software__ng2-file-upload` | node | OK | GIT_CHECKOUT | match | 5.9 | F·1 | 37 | 1 | 0 | 1 | 1 | 410 | 39 | 0 | 15 | 21.9 |
| 71 | `1lck__Lithe-IDEA` | node | OK | GIT_CHECKOUT | match | 40.5 | F·16 | 373 | 16 | 4 | 20 | 20 | 660 | 39 | 0 | 37 | 12.6 |
| 72 | `ARC-MX__sgcc_electricity_new` | python | OK | GIT_CHECKOUT | match | 4.9 | F·20 | 152 | 20 | 0 | 20 | 20 | 216 | 39 | 0 | 3 | 16.1 |
| 73 | `coji__natural-japanese` | python | OK | GIT_CHECKOUT | match | 4.5 | C | 78 | 0 | 0 | 0 | 0 | 140 | 39 | 0 | 1 | 29.6 |
| 74 | `evloghq__evlog` | next | OK | GIT_CHECKOUT | match | 17.7 | F·5 | 271 | 5 | 2 | 7 | 7 | 634 | 39 | 0 | 31 | 8.7 |
| 75 | `nearform__graphql-hooks` | node | OK | GIT_CHECKOUT | match | 7.3 | F·1 | 81 | 1 | 0 | 1 | 1 | 475 | 39 | 0 | 19 | 13.6 |
| 76 | `vercel__react-tweet` | next | OK | GIT_CHECKOUT | match | 5.4 | C | 31 | 0 | 0 | 0 | 0 | 396 | 39 | 0 | 18 | 25.5 |
| 77 | `vercel-labs__emulate` | next | OK | GIT_CHECKOUT | match | 10.5 | F·65 | 333 | 65 | 1 | 66 | 66 | 454 | 39 | 0 | 30 | 5.3 |
| 78 | `AminForou__mcp-gsc` | python | OK | GIT_CHECKOUT | match | 4 | F·2 | 32 | 2 | 0 | 2 | 2 | 61 | 39 | 0 | 0 | 26.3 |
| 79 | `Jesseovo__last30days-skill-cn` | python | OK | GIT_CHECKOUT | match | 5.9 | C | 237 | 0 | 0 | 0 | 0 | 251 | 39 | 0 | 18 | 4 |
| 80 | `bugy__script-server` | python | OK | GIT_CHECKOUT | match | 8.7 | F·4 | 242 | 4 | 0 | 4 | 4 | 423 | 39 | 0 | 25 | 24.2 |
| 81 | `zcpua__midjourney-api` | node | OK | GIT_CHECKOUT | match | 4.6 | F·8 | 127 | 8 | 0 | 8 | 8 | 355 | 39 | 0 | 17 | 4.6 |
| 82 | `u14app__neo-chat` | next | OK | GIT_CHECKOUT | match | 14.3 | F·14 | 305 | 14 | 4 | 18 | 18 | 546 | 39 | 0 | 33 | 7.4 |
| 83 | `xushanpei__open-file-viewer` | node | OK | GIT_CHECKOUT | match | 7.1 | C | 181 | 0 | 0 | 0 | 0 | 441 | 40 | 0 | 23 | 22.1 |
| 84 | `stripe__ai` | node | OK | GIT_CHECKOUT | match | 10 | F·29 | 288 | 29 | 5 | 34 | 34 | 642 | 39 | 0 | 33 | 17.9 |
| 85 | `trustedsec__hate_crack` | python | OK | GIT_CHECKOUT | match | 8 | F·6 | 245 | 6 | 0 | 6 | 6 | 324 | 39 | 0 | 17 | 17.2 |
| 86 | `DHTMLX__gantt` | node | OK | GIT_CHECKOUT | match | 17.1 | D | 204 | 0 | 1 | 1 | 1 | 359 | 39 | 0 | 22 | 32 |
| 87 | `timescale__pg-aiguide` | python | OK | GIT_CHECKOUT | match | 5.1 | F·18 | 128 | 18 | 16 | 34 | 34 | 476 | 39 | 0 | 14 | 8.7 |
| 88 | `TencentEdgeOne__edgeone-makers-tools` | node | OK | GIT_CHECKOUT | match | 5 | F·4 | 30 | 4 | 0 | 4 | 4 | 177 | 39 | 0 | 2 | 12.2 |
| 89 | `facebookresearch__MetaCLIP` | python | OK | GIT_CHECKOUT | match | 6.6 | C | 177 | 0 | 0 | 0 | 0 | 353 | 39 | 0 | 24 | 6.4 |
| 90 | `nimbalyst__nimbalyst` | node | OK | GIT_CHECKOUT | match | 59.8 | F·48 | 480 | 48 | 8 | 56 | 56 | 636 | 40 | 0 | 41 | 3.4 |
| 91 | `XiaoMaColtAI__math-modeling-skill` | python | OK | GIT_CHECKOUT | match | 6.7 | C | 231 | 0 | 0 | 0 | 0 | 282 | 40 | 0 | 20 | 28 |
| 92 | `dyrector-io__dyrectorio` | next | OK | GIT_CHECKOUT | match | 19.4 | F·31 | 289 | 31 | 2 | 33 | 33 | 623 | 39 | 0 | 27 | 5.3 |
| 93 | `Aas-ee__open-webSearch` | node | OK | GIT_CHECKOUT | match | 5.5 | D | 222 | 0 | 5 | 5 | 5 | 372 | 39 | 0 | 24 | 4 |
| 94 | `Julian-Ivanov__jarvis-voice-assistant` | node | OK | GIT_CHECKOUT | match | 3.7 | F·2 | 23 | 2 | 0 | 2 | 2 | 59 | 39 | 0 | 0 | 28.6 |
| 95 | `aomkoyo__obs-airplay-receiver` | node | OK | GIT_CHECKOUT | match | 3.7 | C | 23 | 0 | 0 | 0 | 0 | 28 | 39 | 0 | 0 | 61.1 |
| 96 | `tokio-rs__mini-redis` | unknown | OK | GIT_CHECKOUT | match | 3.9 | C | 4 | 0 | 0 | 0 | 0 | 31 | 39 | 0 | 0 | 90.9 |
| 97 | `gothinkster__node-express-realworld-example-app` | node | OK | GIT_CHECKOUT | match | 4.4 | F·3 | 31 | 3 | 2 | 5 | 5 | 331 | 39 | 0 | 14 | 10.9 |
| 98 | `AkbarDevop__ai-job-agent` | node | OK | GIT_CHECKOUT | match | 4 | F·1 | 109 | 1 | 0 | 1 | 1 | 206 | 39 | 0 | 3 | 6.8 |
| 99 | `hi-godot__cyberpunk-hud-demo` | unknown | OK | GIT_CHECKOUT | match | 4 | C* | 0 | 0 | 0 | 0 | 0 | 16 | 39 | 0 | 0 | 76 |
| 100 | `hugoguerrap__crypto-claude-desk` | next | OK | GIT_CHECKOUT | match | 5.2 | F·6 | 177 | 6 | 0 | 6 | 6 | 319 | 39 | 0 | 13 | 6 |

`status` is the run outcome (`OK` / `TIMEOUT` / `FAILED` / `TARGET_MISSING`); `checkout` is the working tree (`GIT_CHECKOUT` / `SHALLOW_CHECKOUT` / `NOT_GIT_WORKTREE` / `MISSING`) — the two are recorded independently so a timeout cannot hide the fact that a target was never a git checkout. `pinned` compares the manifest's `commit` with the clone's HEAD (`match` / `DRIFT` / `—` unverifiable).

`with real remediation` = critical/high detector findings whose remediation is NOT the report's fallback string ("no remediation text in the rule"). It is the only column here that a reader may promote to a headline claim about remediation text existing.

## Sums — over measured rows ONLY

TIMEOUT / FAILED / TARGET_MISSING rows contribute **nothing** to these sums (their counts are null by construction, and a null is not a zero). Measured rows: 100 of 100.

| measure | sum over 100 measured row(s) |
|---|---:|
| detector findings | 18404 |
| ausencia (checklist gaps) | 38210 |
| critical | 817 |
| high | 139 |
| critical + high | 956 |
| findings stopped at the 20/rule cap (floors) | 1834 |
| degraded (per-repo rule instances with no implemented tool) | 3911 |
| rule failures (error/budget) | 0 |
| detector seconds | 1142.9 |

The `degraded` cell counts **per-repo instances**, so the same unimplemented rule appears once per measured repo that lists it. Distinct degraded rule ids across this run: 41.
## Per-area status — the "NOT EVALUATED" information survives

`SIN MOTOR` = zero runnable mechanical rules for the area (nothing was evaluated) · `PARCIAL` = the rules needing judgment or live data are at least as many as the runnable mechanical ones · `CUBIERTA` = otherwise. **A 0 in the findings column is a statement about the rules that RAN, never about the area.**

| repo | area | status | rules | det. runnable | det. blocked | juicio | fuera | findings | crit+high | gaps |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `pyupio__safety` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 5 | 0 | 8 |
| `pyupio__safety` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `pyupio__safety` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 139 |
| `pyupio__safety` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `pyupio__safety` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 256 | 14 | 20 |
| `pyupio__safety` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 142 |
| `pyupio__safety` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 11 | 0 | 57 |
| `pyupio__safety` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `doobidoo__mcp-memory-service` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 16 | 15 | 18 |
| `doobidoo__mcp-memory-service` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `doobidoo__mcp-memory-service` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 23 | 0 | 148 |
| `doobidoo__mcp-memory-service` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `doobidoo__mcp-memory-service` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 274 | 21 | 40 |
| `doobidoo__mcp-memory-service` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 8 | 8 | 220 |
| `doobidoo__mcp-memory-service` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 29 | 0 | 69 |
| `doobidoo__mcp-memory-service` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 37 | 1 | 1 |
| `unjs__fontaine` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 4 |
| `unjs__fontaine` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 110 |
| `unjs__fontaine` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 114 |
| `unjs__fontaine` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `unjs__fontaine` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 98 | 0 | 20 |
| `unjs__fontaine` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 186 |
| `unjs__fontaine` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 10 | 0 | 47 |
| `unjs__fontaine` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `xiufengsun__TokenTracker` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 59 | 35 | 35 |
| `xiufengsun__TokenTracker` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `xiufengsun__TokenTracker` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 21 | 0 | 145 |
| `xiufengsun__TokenTracker` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `xiufengsun__TokenTracker` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 327 | 11 | 20 |
| `xiufengsun__TokenTracker` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 222 |
| `xiufengsun__TokenTracker` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 27 | 3 | 84 |
| `xiufengsun__TokenTracker` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 24 | 0 | 1 |
| `unadlib__mutative` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 8 | 0 | 5 |
| `unadlib__mutative` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 111 |
| `unadlib__mutative` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 18 | 0 | 115 |
| `unadlib__mutative` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `unadlib__mutative` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 125 | 0 | 20 |
| `unadlib__mutative` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 174 |
| `unadlib__mutative` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 14 | 0 | 58 |
| `unadlib__mutative` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `tsingyuai__growth-lab` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 6 | 6 | 0 |
| `tsingyuai__growth-lab` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 134 |
| `tsingyuai__growth-lab` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 12 | 0 | 128 |
| `tsingyuai__growth-lab` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `tsingyuai__growth-lab` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 86 | 0 | 7 |
| `tsingyuai__growth-lab` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 103 |
| `tsingyuai__growth-lab` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 28 |
| `tsingyuai__growth-lab` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `openclaw__clawsweeper` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 45 | 42 | 16 |
| `openclaw__clawsweeper` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 120 |
| `openclaw__clawsweeper` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 24 | 0 | 160 |
| `openclaw__clawsweeper` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `openclaw__clawsweeper` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 276 | 1 | 20 |
| `openclaw__clawsweeper` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 18 | 16 | 226 |
| `openclaw__clawsweeper` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 12 | 0 | 106 |
| `openclaw__clawsweeper` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 31 | 0 | 0 |
| `deer-flow__llm-space` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 6 |
| `deer-flow__llm-space` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 126 |
| `deer-flow__llm-space` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 19 | 0 | 99 |
| `deer-flow__llm-space` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `deer-flow__llm-space` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 237 | 0 | 27 |
| `deer-flow__llm-space` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 170 |
| `deer-flow__llm-space` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 26 | 2 | 53 |
| `deer-flow__llm-space` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 6 | 1 | 1 |
| `RedPlanetHQ__core` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 22 | 5 | 43 |
| `RedPlanetHQ__core` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 8 | 8 | 140 |
| `RedPlanetHQ__core` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 21 | 0 | 143 |
| `RedPlanetHQ__core` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `RedPlanetHQ__core` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 270 | 2 | 20 |
| `RedPlanetHQ__core` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 3 | 2 | 215 |
| `RedPlanetHQ__core` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 53 | 22 | 54 |
| `RedPlanetHQ__core` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 16 | 0 | 1 |
| `astrofox-io__astrofox` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `astrofox-io__astrofox` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 104 |
| `astrofox-io__astrofox` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 17 | 0 | 90 |
| `astrofox-io__astrofox` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `astrofox-io__astrofox` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 211 | 0 | 20 |
| `astrofox-io__astrofox` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 157 |
| `astrofox-io__astrofox` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 6 | 0 | 34 |
| `astrofox-io__astrofox` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 19 | 0 | 1 |
| `LingyiChen-AI__JadeAI` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 25 | 18 | 32 |
| `LingyiChen-AI__JadeAI` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 115 |
| `LingyiChen-AI__JadeAI` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 19 | 0 | 97 |
| `LingyiChen-AI__JadeAI` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `LingyiChen-AI__JadeAI` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 238 | 2 | 20 |
| `LingyiChen-AI__JadeAI` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 163 |
| `LingyiChen-AI__JadeAI` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 19 | 1 | 52 |
| `LingyiChen-AI__JadeAI` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 0 |
| `ai-that-works__ai-that-works` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 7 | 7 | 38 |
| `ai-that-works__ai-that-works` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 1 | 0 | 129 |
| `ai-that-works__ai-that-works` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 21 | 0 | 89 |
| `ai-that-works__ai-that-works` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `ai-that-works__ai-that-works` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 293 | 22 | 40 |
| `ai-that-works__ai-that-works` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 2 | 2 | 151 |
| `ai-that-works__ai-that-works` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 1 | 0 | 43 |
| `ai-that-works__ai-that-works` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `szczyglis-dev__py-gpt` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 0 | 0 | 1 |
| `szczyglis-dev__py-gpt` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `szczyglis-dev__py-gpt` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 3 | 0 | 102 |
| `szczyglis-dev__py-gpt` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `szczyglis-dev__py-gpt` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 334 | 20 | 40 |
| `szczyglis-dev__py-gpt` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 153 |
| `szczyglis-dev__py-gpt` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 21 | 0 | 49 |
| `szczyglis-dev__py-gpt` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 22 | 0 | 1 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 2 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 107 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 71 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 226 | 0 | 23 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 101 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 0 | 27 |
| `opensheetmusicdisplay__opensheetmusicdisplay` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 32 | 0 | 1 |
| `reactnativecn__react-native-update` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 13 | 0 | 1 |
| `reactnativecn__react-native-update` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 121 |
| `reactnativecn__react-native-update` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 124 |
| `reactnativecn__react-native-update` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `reactnativecn__react-native-update` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 209 | 0 | 20 |
| `reactnativecn__react-native-update` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 190 |
| `reactnativecn__react-native-update` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 31 | 1 | 56 |
| `reactnativecn__react-native-update` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `microsoft__vscode-js-debug` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 41 |
| `microsoft__vscode-js-debug` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 106 |
| `microsoft__vscode-js-debug` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 19 | 0 | 94 |
| `microsoft__vscode-js-debug` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `microsoft__vscode-js-debug` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 258 | 0 | 20 |
| `microsoft__vscode-js-debug` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 166 |
| `microsoft__vscode-js-debug` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 8 | 5 | 28 |
| `microsoft__vscode-js-debug` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `jeffbski__wait-on` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 1 | 4 |
| `jeffbski__wait-on` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 105 |
| `jeffbski__wait-on` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 83 |
| `jeffbski__wait-on` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `jeffbski__wait-on` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 35 | 0 | 11 |
| `jeffbski__wait-on` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 104 |
| `jeffbski__wait-on` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 49 |
| `jeffbski__wait-on` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `zer0yu__CyberSecurityRSS` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `zer0yu__CyberSecurityRSS` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 12 |
| `zer0yu__CyberSecurityRSS` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 18 |
| `zer0yu__CyberSecurityRSS` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `zer0yu__CyberSecurityRSS` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 32 | 0 | 0 |
| `zer0yu__CyberSecurityRSS` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 7 |
| `zer0yu__CyberSecurityRSS` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 13 |
| `zer0yu__CyberSecurityRSS` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `aipoch__medical-research-skills` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 11 | 11 | 2 |
| `aipoch__medical-research-skills` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `aipoch__medical-research-skills` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 1 | 0 | 120 |
| `aipoch__medical-research-skills` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `aipoch__medical-research-skills` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 271 | 24 | 38 |
| `aipoch__medical-research-skills` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 10 | 10 | 188 |
| `aipoch__medical-research-skills` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 55 |
| `aipoch__medical-research-skills` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 22 | 0 | 1 |
| `ifandelse__machina.js` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 2 | 2 |
| `ifandelse__machina.js` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 118 |
| `ifandelse__machina.js` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 131 |
| `ifandelse__machina.js` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `ifandelse__machina.js` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 145 | 0 | 20 |
| `ifandelse__machina.js` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 210 |
| `ifandelse__machina.js` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 6 | 0 | 52 |
| `ifandelse__machina.js` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 13 | 0 | 1 |
| `chengzuopeng__stock-sdk` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 11 | 8 | 5 |
| `chengzuopeng__stock-sdk` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 104 |
| `chengzuopeng__stock-sdk` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 13 | 0 | 95 |
| `chengzuopeng__stock-sdk` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `chengzuopeng__stock-sdk` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 171 | 0 | 20 |
| `chengzuopeng__stock-sdk` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 110 |
| `chengzuopeng__stock-sdk` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 34 |
| `chengzuopeng__stock-sdk` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 16 | 0 | 1 |
| `OpenBMB__StaffDeck` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 10 | 7 | 12 |
| `OpenBMB__StaffDeck` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 135 |
| `OpenBMB__StaffDeck` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 4 | 0 | 106 |
| `OpenBMB__StaffDeck` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `OpenBMB__StaffDeck` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 313 | 16 | 40 |
| `OpenBMB__StaffDeck` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 145 |
| `OpenBMB__StaffDeck` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 23 | 0 | 37 |
| `OpenBMB__StaffDeck` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 7 | 0 | 1 |
| `webpack__minimizer-webpack-plugin` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 3 |
| `webpack__minimizer-webpack-plugin` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `webpack__minimizer-webpack-plugin` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 3 | 0 | 83 |
| `webpack__minimizer-webpack-plugin` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `webpack__minimizer-webpack-plugin` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 66 | 0 | 20 |
| `webpack__minimizer-webpack-plugin` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 102 |
| `webpack__minimizer-webpack-plugin` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 35 |
| `webpack__minimizer-webpack-plugin` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `ShenSeanChen__waku-agent` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 10 |
| `ShenSeanChen__waku-agent` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `ShenSeanChen__waku-agent` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 107 |
| `ShenSeanChen__waku-agent` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `ShenSeanChen__waku-agent` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 244 | 15 | 37 |
| `ShenSeanChen__waku-agent` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 109 |
| `ShenSeanChen__waku-agent` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 0 | 59 |
| `ShenSeanChen__waku-agent` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `microsoft__vscode-eslint` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 8 | 6 | 1 |
| `microsoft__vscode-eslint` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 107 |
| `microsoft__vscode-eslint` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 96 |
| `microsoft__vscode-eslint` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `microsoft__vscode-eslint` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 93 | 0 | 20 |
| `microsoft__vscode-eslint` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 166 |
| `microsoft__vscode-eslint` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 5 | 1 | 28 |
| `microsoft__vscode-eslint` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `Zoo-Code-Org__Zoo-Code` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 1 | 19 |
| `Zoo-Code-Org__Zoo-Code` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 120 |
| `Zoo-Code-Org__Zoo-Code` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 33 | 0 | 151 |
| `Zoo-Code-Org__Zoo-Code` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 1 | 0 | 0 |
| `Zoo-Code-Org__Zoo-Code` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 291 | 3 | 20 |
| `Zoo-Code-Org__Zoo-Code` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 23 | 2 | 226 |
| `Zoo-Code-Org__Zoo-Code` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 14 | 2 | 83 |
| `Zoo-Code-Org__Zoo-Code` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 33 | 0 | 1 |
| `zhangxiangliang__stock-api` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 2 | 4 |
| `zhangxiangliang__stock-api` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 104 |
| `zhangxiangliang__stock-api` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 96 |
| `zhangxiangliang__stock-api` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `zhangxiangliang__stock-api` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 62 | 0 | 20 |
| `zhangxiangliang__stock-api` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 117 |
| `zhangxiangliang__stock-api` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 6 | 0 | 47 |
| `zhangxiangliang__stock-api` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `electric-capital__open-dev-data` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 3 | 0 | 2 |
| `electric-capital__open-dev-data` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 48 |
| `electric-capital__open-dev-data` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 56 |
| `electric-capital__open-dev-data` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `electric-capital__open-dev-data` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 62 | 3 | 6 |
| `electric-capital__open-dev-data` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 21 |
| `electric-capital__open-dev-data` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 22 |
| `electric-capital__open-dev-data` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `filiksyos__gitreverse` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 3 | 0 | 16 |
| `filiksyos__gitreverse` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 112 |
| `filiksyos__gitreverse` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 6 | 0 | 86 |
| `filiksyos__gitreverse` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `filiksyos__gitreverse` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 159 | 0 | 20 |
| `filiksyos__gitreverse` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 110 |
| `filiksyos__gitreverse` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 14 | 2 | 33 |
| `filiksyos__gitreverse` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `helallao__perplexity-ai` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 0 | 3 |
| `helallao__perplexity-ai` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 59 |
| `helallao__perplexity-ai` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 84 |
| `helallao__perplexity-ai` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `helallao__perplexity-ai` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 118 | 0 | 8 |
| `helallao__perplexity-ai` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 32 |
| `helallao__perplexity-ai` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 7 | 0 | 36 |
| `helallao__perplexity-ai` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `VoidenHQ__voiden` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 10 | 4 | 23 |
| `VoidenHQ__voiden` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 116 |
| `VoidenHQ__voiden` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 122 |
| `VoidenHQ__voiden` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `VoidenHQ__voiden` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 258 | 1 | 20 |
| `VoidenHQ__voiden` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 6 | 0 | 194 |
| `VoidenHQ__voiden` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 17 | 1 | 75 |
| `VoidenHQ__voiden` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 29 | 1 | 1 |
| `danielwh2__cuelume` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `danielwh2__cuelume` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 74 |
| `danielwh2__cuelume` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 43 |
| `danielwh2__cuelume` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `danielwh2__cuelume` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 33 | 0 | 9 |
| `danielwh2__cuelume` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 73 |
| `danielwh2__cuelume` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 21 |
| `danielwh2__cuelume` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `rq__django-rq` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 1 | 1 |
| `rq__django-rq` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 59 |
| `rq__django-rq` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 77 |
| `rq__django-rq` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `rq__django-rq` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 92 | 2 | 20 |
| `rq__django-rq` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 32 |
| `rq__django-rq` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 29 |
| `rq__django-rq` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `kadirnar__whisper-plus` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 3 |
| `kadirnar__whisper-plus` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 66 |
| `kadirnar__whisper-plus` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 85 |
| `kadirnar__whisper-plus` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `kadirnar__whisper-plus` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 141 | 0 | 20 |
| `kadirnar__whisper-plus` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 40 |
| `kadirnar__whisper-plus` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 34 |
| `kadirnar__whisper-plus` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 3 | 0 | 1 |
| `feitangyuan__onetake` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `feitangyuan__onetake` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 41 |
| `feitangyuan__onetake` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 61 |
| `feitangyuan__onetake` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `feitangyuan__onetake` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 125 | 0 | 9 |
| `feitangyuan__onetake` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 25 |
| `feitangyuan__onetake` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 7 | 0 | 29 |
| `feitangyuan__onetake` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `uber__ADR` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 14 | 10 | 4 |
| `uber__ADR` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `uber__ADR` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 144 |
| `uber__ADR` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `uber__ADR` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 274 | 19 | 20 |
| `uber__ADR` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 5 | 5 | 145 |
| `uber__ADR` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 6 | 0 | 39 |
| `uber__ADR` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 22 | 0 | 1 |
| `marmelab__json-graphql-server` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `marmelab__json-graphql-server` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 101 |
| `marmelab__json-graphql-server` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 79 |
| `marmelab__json-graphql-server` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `marmelab__json-graphql-server` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 29 | 0 | 20 |
| `marmelab__json-graphql-server` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 107 |
| `marmelab__json-graphql-server` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 28 |
| `marmelab__json-graphql-server` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `nodejs__llhttp` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 4 |
| `nodejs__llhttp` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 104 |
| `nodejs__llhttp` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 18 | 0 | 82 |
| `nodejs__llhttp` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `nodejs__llhttp` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 57 | 0 | 12 |
| `nodejs__llhttp` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 89 |
| `nodejs__llhttp` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 8 | 0 | 26 |
| `nodejs__llhttp` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `TanShilongMario__PromptFill` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `TanShilongMario__PromptFill` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 100 |
| `TanShilongMario__PromptFill` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 12 | 0 | 68 |
| `TanShilongMario__PromptFill` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `TanShilongMario__PromptFill` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 204 | 0 | 20 |
| `TanShilongMario__PromptFill` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 88 |
| `TanShilongMario__PromptFill` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 7 | 1 | 24 |
| `TanShilongMario__PromptFill` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `kswedberg__jquery-smooth-scroll` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `kswedberg__jquery-smooth-scroll` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 55 |
| `kswedberg__jquery-smooth-scroll` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 32 |
| `kswedberg__jquery-smooth-scroll` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `kswedberg__jquery-smooth-scroll` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 48 | 0 | 7 |
| `kswedberg__jquery-smooth-scroll` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 42 |
| `kswedberg__jquery-smooth-scroll` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 12 |
| `kswedberg__jquery-smooth-scroll` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `nbubna__store` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 6 |
| `nbubna__store` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 101 |
| `nbubna__store` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 68 |
| `nbubna__store` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `nbubna__store` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 78 | 0 | 20 |
| `nbubna__store` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 76 |
| `nbubna__store` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 25 |
| `nbubna__store` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `databricks-solutions__ai-dev-kit` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 2 | 2 | 2 |
| `databricks-solutions__ai-dev-kit` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `databricks-solutions__ai-dev-kit` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 142 |
| `databricks-solutions__ai-dev-kit` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `databricks-solutions__ai-dev-kit` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 275 | 24 | 39 |
| `databricks-solutions__ai-dev-kit` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 142 |
| `databricks-solutions__ai-dev-kit` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 40 |
| `databricks-solutions__ai-dev-kit` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `severity1__claude-code-prompt-improver` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `severity1__claude-code-prompt-improver` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 57 |
| `severity1__claude-code-prompt-improver` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 29 |
| `severity1__claude-code-prompt-improver` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `severity1__claude-code-prompt-improver` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 26 | 0 | 1 |
| `severity1__claude-code-prompt-improver` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 67 |
| `severity1__claude-code-prompt-improver` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 8 |
| `severity1__claude-code-prompt-improver` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `timbrel__GitSavvy` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 6 | 0 | 2 |
| `timbrel__GitSavvy` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 71 |
| `timbrel__GitSavvy` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 91 |
| `timbrel__GitSavvy` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `timbrel__GitSavvy` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 237 | 5 | 20 |
| `timbrel__GitSavvy` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 44 |
| `timbrel__GitSavvy` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 51 |
| `timbrel__GitSavvy` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `MicrosoftDocs__mcp` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 3 |
| `MicrosoftDocs__mcp` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 101 |
| `MicrosoftDocs__mcp` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 82 |
| `MicrosoftDocs__mcp` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `MicrosoftDocs__mcp` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 38 | 0 | 18 |
| `MicrosoftDocs__mcp` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 110 |
| `MicrosoftDocs__mcp` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 1 | 26 |
| `MicrosoftDocs__mcp` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `shadcnstudio__shadcn-studio` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `shadcnstudio__shadcn-studio` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 100 |
| `shadcnstudio__shadcn-studio` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 80 |
| `shadcnstudio__shadcn-studio` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `shadcnstudio__shadcn-studio` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 195 | 0 | 20 |
| `shadcnstudio__shadcn-studio` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 146 |
| `shadcnstudio__shadcn-studio` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 24 |
| `shadcnstudio__shadcn-studio` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `c15t__c15t` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 18 | 17 | 20 |
| `c15t__c15t` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 128 |
| `c15t__c15t` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 29 | 0 | 149 |
| `c15t__c15t` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `c15t__c15t` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 226 | 0 | 20 |
| `c15t__c15t` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 226 |
| `c15t__c15t` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 19 | 5 | 89 |
| `c15t__c15t` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 21 | 0 | 1 |
| `vstorm-co__full-stack-ai-agent-template` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 8 | 2 | 5 |
| `vstorm-co__full-stack-ai-agent-template` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `vstorm-co__full-stack-ai-agent-template` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 145 |
| `vstorm-co__full-stack-ai-agent-template` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `vstorm-co__full-stack-ai-agent-template` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 291 | 7 | 40 |
| `vstorm-co__full-stack-ai-agent-template` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 2 | 2 | 184 |
| `vstorm-co__full-stack-ai-agent-template` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 28 | 0 | 63 |
| `vstorm-co__full-stack-ai-agent-template` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 17 | 4 | 1 |
| `Swatinem__rust-cache` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 14 |
| `Swatinem__rust-cache` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 117 |
| `Swatinem__rust-cache` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 118 |
| `Swatinem__rust-cache` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `Swatinem__rust-cache` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 27 | 0 | 7 |
| `Swatinem__rust-cache` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 113 |
| `Swatinem__rust-cache` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 15 | 0 | 61 |
| `Swatinem__rust-cache` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `aeonfun__opendia` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 2 |
| `aeonfun__opendia` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 98 |
| `aeonfun__opendia` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 9 | 0 | 64 |
| `aeonfun__opendia` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `aeonfun__opendia` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 66 | 2 | 4 |
| `aeonfun__opendia` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 84 |
| `aeonfun__opendia` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 8 | 5 | 21 |
| `aeonfun__opendia` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `balajmarius__svg2jsx` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `balajmarius__svg2jsx` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 101 |
| `balajmarius__svg2jsx` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 70 |
| `balajmarius__svg2jsx` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `balajmarius__svg2jsx` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 12 | 0 | 20 |
| `balajmarius__svg2jsx` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 102 |
| `balajmarius__svg2jsx` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 1 | 0 | 27 |
| `balajmarius__svg2jsx` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `JohnHeibel__PDoomVideo` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `JohnHeibel__PDoomVideo` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 88 |
| `JohnHeibel__PDoomVideo` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 7 | 0 | 53 |
| `JohnHeibel__PDoomVideo` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `JohnHeibel__PDoomVideo` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 123 | 0 | 16 |
| `JohnHeibel__PDoomVideo` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 62 |
| `JohnHeibel__PDoomVideo` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 21 |
| `JohnHeibel__PDoomVideo` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `nuxt-community__auth-module` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 0 | 5 |
| `nuxt-community__auth-module` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `nuxt-community__auth-module` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 4 | 0 | 87 |
| `nuxt-community__auth-module` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `nuxt-community__auth-module` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 94 | 0 | 20 |
| `nuxt-community__auth-module` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 118 |
| `nuxt-community__auth-module` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 7 | 0 | 47 |
| `nuxt-community__auth-module` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `wiedehopf__tar1090` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `wiedehopf__tar1090` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 86 |
| `wiedehopf__tar1090` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 42 |
| `wiedehopf__tar1090` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `wiedehopf__tar1090` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 68 | 0 | 12 |
| `wiedehopf__tar1090` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 34 |
| `wiedehopf__tar1090` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 18 | 0 | 18 |
| `wiedehopf__tar1090` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 44 | 0 | 1 |
| `openupm__openupm` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 3 |
| `openupm__openupm` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 120 |
| `openupm__openupm` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 5 | 0 | 109 |
| `openupm__openupm` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `openupm__openupm` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 13 | 0 | 2 |
| `openupm__openupm` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 103 |
| `openupm__openupm` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 17 |
| `openupm__openupm` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 16 | 0 | 1 |
| `silvertakana__worldwideview` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 58 | 35 | 46 |
| `silvertakana__worldwideview` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 127 |
| `silvertakana__worldwideview` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 160 |
| `silvertakana__worldwideview` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `silvertakana__worldwideview` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 232 | 7 | 20 |
| `silvertakana__worldwideview` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 226 |
| `silvertakana__worldwideview` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 27 | 3 | 104 |
| `silvertakana__worldwideview` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 23 | 0 | 1 |
| `zanwei__design-dna` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `zanwei__design-dna` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 4 |
| `zanwei__design-dna` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 10 |
| `zanwei__design-dna` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `zanwei__design-dna` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 0 | 0 | 0 |
| `zanwei__design-dna` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 5 |
| `zanwei__design-dna` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 10 |
| `zanwei__design-dna` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `PowerShell__vscode-powershell` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 2 | 4 |
| `PowerShell__vscode-powershell` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 108 |
| `PowerShell__vscode-powershell` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 103 |
| `PowerShell__vscode-powershell` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `PowerShell__vscode-powershell` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 116 | 0 | 20 |
| `PowerShell__vscode-powershell` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 151 |
| `PowerShell__vscode-powershell` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 33 |
| `PowerShell__vscode-powershell` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `microsoft__vscode-mssql` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 1 | 44 |
| `microsoft__vscode-mssql` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 138 |
| `microsoft__vscode-mssql` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 21 | 0 | 134 |
| `microsoft__vscode-mssql` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 33 | 11 | 0 |
| `microsoft__vscode-mssql` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 307 | 0 | 20 |
| `microsoft__vscode-mssql` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 4 | 1 | 218 |
| `microsoft__vscode-mssql` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 30 | 2 | 58 |
| `microsoft__vscode-mssql` | `github` | CUBIERTA | 32 | 17 | 2 | 1 | 11 | 23 | 1 | 1 |
| `DanKE123abc__NoUnityCN` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `DanKE123abc__NoUnityCN` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 92 |
| `DanKE123abc__NoUnityCN` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 62 |
| `DanKE123abc__NoUnityCN` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `DanKE123abc__NoUnityCN` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 92 | 0 | 20 |
| `DanKE123abc__NoUnityCN` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 89 |
| `DanKE123abc__NoUnityCN` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 17 |
| `DanKE123abc__NoUnityCN` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `hanshuaikang__nezha` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 5 | 0 | 2 |
| `hanshuaikang__nezha` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `hanshuaikang__nezha` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 88 |
| `hanshuaikang__nezha` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `hanshuaikang__nezha` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 199 | 0 | 20 |
| `hanshuaikang__nezha` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 115 |
| `hanshuaikang__nezha` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 23 | 0 | 32 |
| `hanshuaikang__nezha` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `parse-community__parse-server-example` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 2 |
| `parse-community__parse-server-example` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 98 |
| `parse-community__parse-server-example` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 64 |
| `parse-community__parse-server-example` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `parse-community__parse-server-example` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 7 | 0 | 10 |
| `parse-community__parse-server-example` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 104 |
| `parse-community__parse-server-example` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 0 | 21 |
| `parse-community__parse-server-example` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `opennextjs__opennextjs-cloudflare` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 0 | 7 |
| `opennextjs__opennextjs-cloudflare` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 114 |
| `opennextjs__opennextjs-cloudflare` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 22 | 0 | 113 |
| `opennextjs__opennextjs-cloudflare` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `opennextjs__opennextjs-cloudflare` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 183 | 0 | 20 |
| `opennextjs__opennextjs-cloudflare` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 0 | 186 |
| `opennextjs__opennextjs-cloudflare` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 23 | 1 | 55 |
| `opennextjs__opennextjs-cloudflare` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 6 | 0 | 1 |
| `chinesehuazhou__python-weekly` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `chinesehuazhou__python-weekly` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 122 |
| `chinesehuazhou__python-weekly` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 86 |
| `chinesehuazhou__python-weekly` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `chinesehuazhou__python-weekly` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 193 | 2 | 23 |
| `chinesehuazhou__python-weekly` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 108 |
| `chinesehuazhou__python-weekly` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 0 | 48 |
| `chinesehuazhou__python-weekly` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `evoluhq__evolu` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 4 |
| `evoluhq__evolu` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 113 |
| `evoluhq__evolu` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 18 | 0 | 121 |
| `evoluhq__evolu` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `evoluhq__evolu` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 158 | 0 | 20 |
| `evoluhq__evolu` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 198 |
| `evoluhq__evolu` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 15 | 0 | 61 |
| `evoluhq__evolu` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 17 | 0 | 1 |
| `karlicoss__promnesia` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 3 | 0 | 1 |
| `karlicoss__promnesia` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 127 |
| `karlicoss__promnesia` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 77 |
| `karlicoss__promnesia` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `karlicoss__promnesia` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 177 | 2 | 39 |
| `karlicoss__promnesia` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 99 |
| `karlicoss__promnesia` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 0 | 28 |
| `karlicoss__promnesia` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 3 | 1 | 1 |
| `RubinLabs26__ISpotify` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 1 | 4 |
| `RubinLabs26__ISpotify` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 110 |
| `RubinLabs26__ISpotify` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 121 |
| `RubinLabs26__ISpotify` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `RubinLabs26__ISpotify` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 166 | 9 | 20 |
| `RubinLabs26__ISpotify` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 72 |
| `RubinLabs26__ISpotify` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 10 | 0 | 44 |
| `RubinLabs26__ISpotify` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 3 | 0 | 1 |
| `valqore__valqore` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 2 |
| `valqore__valqore` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 126 |
| `valqore__valqore` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 113 |
| `valqore__valqore` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `valqore__valqore` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 24 | 0 | 4 |
| `valqore__valqore` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 135 |
| `valqore__valqore` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 22 | 0 | 38 |
| `valqore__valqore` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `kajisho5__ffmpeg-skill` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 8 | 2 | 5 |
| `kajisho5__ffmpeg-skill` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 136 |
| `kajisho5__ffmpeg-skill` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 6 | 0 | 122 |
| `kajisho5__ffmpeg-skill` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `kajisho5__ffmpeg-skill` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 213 | 5 | 21 |
| `kajisho5__ffmpeg-skill` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 160 |
| `kajisho5__ffmpeg-skill` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 0 | 50 |
| `kajisho5__ffmpeg-skill` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 20 | 0 | 1 |
| `valor-software__ng2-file-upload` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 0 | 4 |
| `valor-software__ng2-file-upload` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 104 |
| `valor-software__ng2-file-upload` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 95 |
| `valor-software__ng2-file-upload` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `valor-software__ng2-file-upload` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 30 | 0 | 20 |
| `valor-software__ng2-file-upload` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 1 | 1 | 150 |
| `valor-software__ng2-file-upload` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 36 |
| `valor-software__ng2-file-upload` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `1lck__Lithe-IDEA` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 16 | 9 | 44 |
| `1lck__Lithe-IDEA` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 123 |
| `1lck__Lithe-IDEA` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 22 | 0 | 156 |
| `1lck__Lithe-IDEA` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `1lck__Lithe-IDEA` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 268 | 3 | 21 |
| `1lck__Lithe-IDEA` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 4 | 4 | 226 |
| `1lck__Lithe-IDEA` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 38 | 2 | 89 |
| `1lck__Lithe-IDEA` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 25 | 2 | 1 |
| `ARC-MX__sgcc_electricity_new` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 11 | 8 | 2 |
| `ARC-MX__sgcc_electricity_new` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 66 |
| `ARC-MX__sgcc_electricity_new` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 72 |
| `ARC-MX__sgcc_electricity_new` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `ARC-MX__sgcc_electricity_new` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 120 | 12 | 6 |
| `ARC-MX__sgcc_electricity_new` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 49 |
| `ARC-MX__sgcc_electricity_new` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 21 | 0 | 20 |
| `ARC-MX__sgcc_electricity_new` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `coji__natural-japanese` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 0 | 1 |
| `coji__natural-japanese` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 42 |
| `coji__natural-japanese` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 48 |
| `coji__natural-japanese` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `coji__natural-japanese` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 74 | 0 | 1 |
| `coji__natural-japanese` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 30 |
| `coji__natural-japanese` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 1 | 0 | 17 |
| `coji__natural-japanese` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `evloghq__evlog` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 3 | 1 | 38 |
| `evloghq__evlog` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 122 |
| `evloghq__evlog` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 19 | 0 | 150 |
| `evloghq__evlog` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `evloghq__evlog` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 180 | 2 | 20 |
| `evloghq__evlog` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 3 | 2 | 226 |
| `evloghq__evlog` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 30 | 1 | 77 |
| `evloghq__evlog` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 36 | 1 | 1 |
| `nearform__graphql-hooks` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 9 | 1 | 6 |
| `nearform__graphql-hooks` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 107 |
| `nearform__graphql-hooks` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 4 | 0 | 107 |
| `nearform__graphql-hooks` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `nearform__graphql-hooks` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 59 | 0 | 20 |
| `nearform__graphql-hooks` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 174 |
| `nearform__graphql-hooks` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 5 | 0 | 60 |
| `nearform__graphql-hooks` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 4 | 0 | 1 |
| `vercel__react-tweet` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 0 | 3 |
| `vercel__react-tweet` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 102 |
| `vercel__react-tweet` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 87 |
| `vercel__react-tweet` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `vercel__react-tweet` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 28 | 0 | 20 |
| `vercel__react-tweet` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 154 |
| `vercel__react-tweet` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 1 | 0 | 29 |
| `vercel__react-tweet` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `vercel-labs__emulate` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 51 | 46 | 34 |
| `vercel-labs__emulate` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `vercel-labs__emulate` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 19 | 0 | 90 |
| `vercel-labs__emulate` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `vercel-labs__emulate` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 232 | 0 | 20 |
| `vercel-labs__emulate` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 19 | 19 | 157 |
| `vercel-labs__emulate` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 4 | 1 | 49 |
| `vercel-labs__emulate` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 8 | 0 | 1 |
| `AminForou__mcp-gsc` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `AminForou__mcp-gsc` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 22 |
| `AminForou__mcp-gsc` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 14 |
| `AminForou__mcp-gsc` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `AminForou__mcp-gsc` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 24 | 2 | 0 |
| `AminForou__mcp-gsc` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 19 |
| `AminForou__mcp-gsc` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 7 | 0 | 5 |
| `AminForou__mcp-gsc` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `Jesseovo__last30days-skill-cn` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `Jesseovo__last30days-skill-cn` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 74 |
| `Jesseovo__last30days-skill-cn` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 87 |
| `Jesseovo__last30days-skill-cn` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `Jesseovo__last30days-skill-cn` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 233 | 0 | 13 |
| `Jesseovo__last30days-skill-cn` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 44 |
| `Jesseovo__last30days-skill-cn` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 31 |
| `Jesseovo__last30days-skill-cn` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `bugy__script-server` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `bugy__script-server` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 133 |
| `bugy__script-server` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 86 |
| `bugy__script-server` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `bugy__script-server` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 225 | 4 | 40 |
| `bugy__script-server` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 3 | 0 | 138 |
| `bugy__script-server` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 12 | 0 | 25 |
| `bugy__script-server` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `zcpua__midjourney-api` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 8 | 8 | 1 |
| `zcpua__midjourney-api` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `zcpua__midjourney-api` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 90 |
| `zcpua__midjourney-api` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `zcpua__midjourney-api` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 115 | 0 | 20 |
| `zcpua__midjourney-api` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 107 |
| `zcpua__midjourney-api` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 33 |
| `zcpua__midjourney-api` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `u14app__neo-chat` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 21 | 11 | 44 |
| `u14app__neo-chat` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 112 |
| `u14app__neo-chat` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 10 | 0 | 120 |
| `u14app__neo-chat` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `u14app__neo-chat` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 230 | 0 | 20 |
| `u14app__neo-chat` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 3 | 3 | 194 |
| `u14app__neo-chat` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 14 | 4 | 55 |
| `u14app__neo-chat` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 27 | 0 | 1 |
| `xushanpei__open-file-viewer` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 0 | 0 | 2 |
| `xushanpei__open-file-viewer` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 107 |
| `xushanpei__open-file-viewer` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 2 | 0 | 102 |
| `xushanpei__open-file-viewer` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `xushanpei__open-file-viewer` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 157 | 0 | 20 |
| `xushanpei__open-file-viewer` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 167 |
| `xushanpei__open-file-viewer` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 42 |
| `xushanpei__open-file-viewer` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 22 | 0 | 1 |
| `stripe__ai` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 20 | 20 | 46 |
| `stripe__ai` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `stripe__ai` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 10 | 0 | 140 |
| `stripe__ai` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `stripe__ai` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 208 | 2 | 40 |
| `stripe__ai` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 7 | 7 | 209 |
| `stripe__ai` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 42 | 5 | 66 |
| `stripe__ai` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `trustedsec__hate_crack` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 5 |
| `trustedsec__hate_crack` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 101 |
| `trustedsec__hate_crack` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 101 |
| `trustedsec__hate_crack` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `trustedsec__hate_crack` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 241 | 6 | 17 |
| `trustedsec__hate_crack` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 55 |
| `trustedsec__hate_crack` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 44 |
| `trustedsec__hate_crack` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `DHTMLX__gantt` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 0 | 1 |
| `DHTMLX__gantt` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 102 |
| `DHTMLX__gantt` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 7 | 0 | 82 |
| `DHTMLX__gantt` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `DHTMLX__gantt` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 170 | 0 | 20 |
| `DHTMLX__gantt` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 126 |
| `DHTMLX__gantt` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 23 | 1 | 27 |
| `DHTMLX__gantt` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 3 | 0 | 1 |
| `timescale__pg-aiguide` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 20 | 8 | 7 |
| `timescale__pg-aiguide` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 123 |
| `timescale__pg-aiguide` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 4 | 0 | 114 |
| `timescale__pg-aiguide` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `timescale__pg-aiguide` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 81 | 10 | 29 |
| `timescale__pg-aiguide` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 151 |
| `timescale__pg-aiguide` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 23 | 16 | 51 |
| `timescale__pg-aiguide` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `TencentEdgeOne__edgeone-makers-tools` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 4 | 4 | 3 |
| `TencentEdgeOne__edgeone-makers-tools` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 60 |
| `TencentEdgeOne__edgeone-makers-tools` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 22 | 0 | 38 |
| `TencentEdgeOne__edgeone-makers-tools` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `TencentEdgeOne__edgeone-makers-tools` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 0 | 0 | 0 |
| `TencentEdgeOne__edgeone-makers-tools` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 58 |
| `TencentEdgeOne__edgeone-makers-tools` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 3 | 0 | 17 |
| `TencentEdgeOne__edgeone-makers-tools` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `facebookresearch__MetaCLIP` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `facebookresearch__MetaCLIP` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 122 |
| `facebookresearch__MetaCLIP` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 5 | 0 | 80 |
| `facebookresearch__MetaCLIP` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `facebookresearch__MetaCLIP` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 171 | 0 | 20 |
| `facebookresearch__MetaCLIP` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 100 |
| `facebookresearch__MetaCLIP` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 30 |
| `facebookresearch__MetaCLIP` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `nimbalyst__nimbalyst` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 23 | 20 | 46 |
| `nimbalyst__nimbalyst` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 140 |
| `nimbalyst__nimbalyst` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 145 |
| `nimbalyst__nimbalyst` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 36 | 0 | 0 |
| `nimbalyst__nimbalyst` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 328 | 16 | 20 |
| `nimbalyst__nimbalyst` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 13 | 12 | 224 |
| `nimbalyst__nimbalyst` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 32 | 5 | 60 |
| `nimbalyst__nimbalyst` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 28 | 3 | 1 |
| `XiaoMaColtAI__math-modeling-skill` | `security` | CUBIERTA | 45 | 16 | 9 | 17 | 0 | 0 | 0 | 1 |
| `XiaoMaColtAI__math-modeling-skill` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 80 |
| `XiaoMaColtAI__math-modeling-skill` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 3 | 0 | 93 |
| `XiaoMaColtAI__math-modeling-skill` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `XiaoMaColtAI__math-modeling-skill` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 226 | 0 | 22 |
| `XiaoMaColtAI__math-modeling-skill` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 51 |
| `XiaoMaColtAI__math-modeling-skill` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 34 |
| `XiaoMaColtAI__math-modeling-skill` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `dyrector-io__dyrectorio` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 39 | 19 | 34 |
| `dyrector-io__dyrectorio` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 2 | 2 | 140 |
| `dyrector-io__dyrectorio` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 14 | 0 | 148 |
| `dyrector-io__dyrectorio` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `dyrector-io__dyrectorio` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 186 | 9 | 20 |
| `dyrector-io__dyrectorio` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 5 | 3 | 219 |
| `dyrector-io__dyrectorio` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 30 | 0 | 61 |
| `dyrector-io__dyrectorio` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 13 | 0 | 1 |
| `Aas-ee__open-webSearch` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 5 | 0 | 18 |
| `Aas-ee__open-webSearch` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 103 |
| `Aas-ee__open-webSearch` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 12 | 0 | 90 |
| `Aas-ee__open-webSearch` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `Aas-ee__open-webSearch` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 196 | 0 | 20 |
| `Aas-ee__open-webSearch` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 106 |
| `Aas-ee__open-webSearch` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 9 | 5 | 34 |
| `Aas-ee__open-webSearch` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `Julian-Ivanov__jarvis-voice-assistant` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 2 | 2 | 0 |
| `Julian-Ivanov__jarvis-voice-assistant` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 16 |
| `Julian-Ivanov__jarvis-voice-assistant` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 19 |
| `Julian-Ivanov__jarvis-voice-assistant` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `Julian-Ivanov__jarvis-voice-assistant` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 21 | 0 | 2 |
| `Julian-Ivanov__jarvis-voice-assistant` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 12 |
| `Julian-Ivanov__jarvis-voice-assistant` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 9 |
| `Julian-Ivanov__jarvis-voice-assistant` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `aomkoyo__obs-airplay-receiver` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 1 | 0 | 1 |
| `aomkoyo__obs-airplay-receiver` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 8 |
| `aomkoyo__obs-airplay-receiver` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 5 |
| `aomkoyo__obs-airplay-receiver` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `aomkoyo__obs-airplay-receiver` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 18 | 0 | 0 |
| `aomkoyo__obs-airplay-receiver` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 4 |
| `aomkoyo__obs-airplay-receiver` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 9 |
| `aomkoyo__obs-airplay-receiver` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `tokio-rs__mini-redis` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `tokio-rs__mini-redis` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 10 |
| `tokio-rs__mini-redis` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 7 |
| `tokio-rs__mini-redis` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `tokio-rs__mini-redis` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 0 | 0 | 0 |
| `tokio-rs__mini-redis` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 4 |
| `tokio-rs__mini-redis` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 8 |
| `tokio-rs__mini-redis` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |
| `gothinkster__node-express-realworld-example-app` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 3 | 3 | 0 |
| `gothinkster__node-express-realworld-example-app` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 2 | 2 | 103 |
| `gothinkster__node-express-realworld-example-app` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 70 |
| `gothinkster__node-express-realworld-example-app` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `gothinkster__node-express-realworld-example-app` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 23 | 0 | 20 |
| `gothinkster__node-express-realworld-example-app` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 112 |
| `gothinkster__node-express-realworld-example-app` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 25 |
| `gothinkster__node-express-realworld-example-app` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 1 | 0 | 1 |
| `AkbarDevop__ai-job-agent` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 1 |
| `AkbarDevop__ai-job-agent` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 74 |
| `AkbarDevop__ai-job-agent` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 20 | 0 | 55 |
| `AkbarDevop__ai-job-agent` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `AkbarDevop__ai-job-agent` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 87 | 1 | 2 |
| `AkbarDevop__ai-job-agent` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 50 |
| `AkbarDevop__ai-job-agent` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 2 | 0 | 23 |
| `AkbarDevop__ai-job-agent` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `hi-godot__cyberpunk-hud-demo` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `hi-godot__cyberpunk-hud-demo` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 0 |
| `hi-godot__cyberpunk-hud-demo` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 0 | 0 | 6 |
| `hi-godot__cyberpunk-hud-demo` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `hi-godot__cyberpunk-hud-demo` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 0 | 0 | 0 |
| `hi-godot__cyberpunk-hud-demo` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 0 |
| `hi-godot__cyberpunk-hud-demo` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 9 |
| `hi-godot__cyberpunk-hud-demo` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 0 | 0 | 1 |
| `hugoguerrap__crypto-claude-desk` | `security` | CUBIERTA | 45 | 17 | 8 | 17 | 0 | 0 | 0 | 0 |
| `hugoguerrap__crypto-claude-desk` | `database` | PARCIAL | 32 | 7 | 0 | 9 | 9 | 0 | 0 | 105 |
| `hugoguerrap__crypto-claude-desk` | `performance` | PARCIAL | 71 | 2 | 0 | 32 | 29 | 8 | 0 | 80 |
| `hugoguerrap__crypto-claude-desk` | `structure` | PARCIAL | 29 | 7 | 1 | 21 | 0 | 0 | 0 | 0 |
| `hugoguerrap__crypto-claude-desk` | `code` | CUBIERTA | 59 | 26 | 18 | 13 | 0 | 167 | 6 | 24 |
| `hugoguerrap__crypto-claude-desk` | `flows` | CUBIERTA | 50 | 11 | 6 | 14 | 1 | 0 | 0 | 81 |
| `hugoguerrap__crypto-claude-desk` | `cost` | PARCIAL | 50 | 8 | 4 | 10 | 16 | 0 | 0 | 28 |
| `hugoguerrap__crypto-claude-desk` | `github` | CUBIERTA | 32 | 18 | 1 | 1 | 11 | 2 | 0 | 1 |

**Areas with 0 findings across the rules that RAN** (386) — a 0 here is a statement about those rules, NOT a clean bill of health (each area's `juicio` / `fuera` / `det. blocked` columns above say what was never examined): `pyupio__safety/database` · `pyupio__safety/performance` · `pyupio__safety/structure` · `doobidoo__mcp-memory-service/database` · `doobidoo__mcp-memory-service/structure` · `unjs__fontaine/security` · `unjs__fontaine/database` · `unjs__fontaine/structure` · `unjs__fontaine/flows` · `xiufengsun__TokenTracker/database` · `xiufengsun__TokenTracker/structure` · `unadlib__mutative/database` · `unadlib__mutative/structure` · `unadlib__mutative/flows` · `tsingyuai__growth-lab/database` · `tsingyuai__growth-lab/structure` · `tsingyuai__growth-lab/flows` · `tsingyuai__growth-lab/cost` · `openclaw__clawsweeper/database` · `openclaw__clawsweeper/structure` · `deer-flow__llm-space/security` · `deer-flow__llm-space/database` · `deer-flow__llm-space/structure` · `deer-flow__llm-space/flows` · `RedPlanetHQ__core/structure` · `astrofox-io__astrofox/security` · `astrofox-io__astrofox/database` · `astrofox-io__astrofox/structure` · `astrofox-io__astrofox/flows` · `LingyiChen-AI__JadeAI/database` · `LingyiChen-AI__JadeAI/structure` · `LingyiChen-AI__JadeAI/flows` · `ai-that-works__ai-that-works/structure` · `szczyglis-dev__py-gpt/security` · `szczyglis-dev__py-gpt/database` · `szczyglis-dev__py-gpt/structure` · `szczyglis-dev__py-gpt/flows` · `opensheetmusicdisplay__opensheetmusicdisplay/security` · `opensheetmusicdisplay__opensheetmusicdisplay/database` · `opensheetmusicdisplay__opensheetmusicdisplay/structure` · `opensheetmusicdisplay__opensheetmusicdisplay/flows` · `reactnativecn__react-native-update/database` · `reactnativecn__react-native-update/structure` · `reactnativecn__react-native-update/flows` · `microsoft__vscode-js-debug/security` · `microsoft__vscode-js-debug/database` · `microsoft__vscode-js-debug/structure` · `microsoft__vscode-js-debug/flows` · `microsoft__vscode-js-debug/github` · `jeffbski__wait-on/database` · `jeffbski__wait-on/structure` · `jeffbski__wait-on/flows` · `jeffbski__wait-on/github` · `zer0yu__CyberSecurityRSS/security` · `zer0yu__CyberSecurityRSS/database` · `zer0yu__CyberSecurityRSS/performance` · `zer0yu__CyberSecurityRSS/structure` · `zer0yu__CyberSecurityRSS/flows` · `aipoch__medical-research-skills/database` · `aipoch__medical-research-skills/structure` · `ifandelse__machina.js/database` · `ifandelse__machina.js/performance` · `ifandelse__machina.js/structure` · `ifandelse__machina.js/flows` · `chengzuopeng__stock-sdk/database` · `chengzuopeng__stock-sdk/structure` · `chengzuopeng__stock-sdk/flows` · `OpenBMB__StaffDeck/database` · `OpenBMB__StaffDeck/structure` · `webpack__minimizer-webpack-plugin/security` · `webpack__minimizer-webpack-plugin/database` · `webpack__minimizer-webpack-plugin/structure` · `webpack__minimizer-webpack-plugin/flows` · `ShenSeanChen__waku-agent/security` · `ShenSeanChen__waku-agent/database` · `ShenSeanChen__waku-agent/performance` · `ShenSeanChen__waku-agent/structure` · `ShenSeanChen__waku-agent/flows` · `microsoft__vscode-eslint/database` · `microsoft__vscode-eslint/structure` · `microsoft__vscode-eslint/flows` · `microsoft__vscode-eslint/github` · `Zoo-Code-Org__Zoo-Code/database` · `zhangxiangliang__stock-api/database` · `zhangxiangliang__stock-api/structure` · `zhangxiangliang__stock-api/flows` · `electric-capital__open-dev-data/database` · `electric-capital__open-dev-data/performance` · `electric-capital__open-dev-data/structure` · `electric-capital__open-dev-data/flows` · `filiksyos__gitreverse/database` · `filiksyos__gitreverse/structure` · `filiksyos__gitreverse/flows` · `filiksyos__gitreverse/github` · `helallao__perplexity-ai/database` · `helallao__perplexity-ai/performance` · `helallao__perplexity-ai/structure` · `helallao__perplexity-ai/flows` · `helallao__perplexity-ai/github` · `VoidenHQ__voiden/database` · `VoidenHQ__voiden/structure` · `danielwh2__cuelume/security` · `danielwh2__cuelume/database` · `danielwh2__cuelume/performance` · `danielwh2__cuelume/structure` · `danielwh2__cuelume/flows` · `danielwh2__cuelume/cost` · `rq__django-rq/database` · `rq__django-rq/performance` · `rq__django-rq/structure` · `kadirnar__whisper-plus/security` · `kadirnar__whisper-plus/database` · `kadirnar__whisper-plus/performance` · `kadirnar__whisper-plus/structure` · `kadirnar__whisper-plus/flows` · `feitangyuan__onetake/security` · `feitangyuan__onetake/database` · `feitangyuan__onetake/performance` · `feitangyuan__onetake/structure` · `feitangyuan__onetake/flows` · `uber__ADR/database` · `uber__ADR/performance` · `uber__ADR/structure` · `marmelab__json-graphql-server/security` · `marmelab__json-graphql-server/database` · `marmelab__json-graphql-server/performance` · `marmelab__json-graphql-server/structure` · `marmelab__json-graphql-server/flows` · `marmelab__json-graphql-server/github` · `nodejs__llhttp/security` · `nodejs__llhttp/database` · `nodejs__llhttp/structure` · `nodejs__llhttp/flows` · `TanShilongMario__PromptFill/security` · `TanShilongMario__PromptFill/database` · `TanShilongMario__PromptFill/structure` · `TanShilongMario__PromptFill/flows` · `kswedberg__jquery-smooth-scroll/security` · `kswedberg__jquery-smooth-scroll/database` · `kswedberg__jquery-smooth-scroll/performance` · `kswedberg__jquery-smooth-scroll/structure` · `kswedberg__jquery-smooth-scroll/flows` · `kswedberg__jquery-smooth-scroll/cost` · `nbubna__store/security` · `nbubna__store/database` · `nbubna__store/performance` · `nbubna__store/structure` · `nbubna__store/flows` · `nbubna__store/cost` · `databricks-solutions__ai-dev-kit/database` · `databricks-solutions__ai-dev-kit/performance` · `databricks-solutions__ai-dev-kit/structure` · `databricks-solutions__ai-dev-kit/flows` · `severity1__claude-code-prompt-improver/security` · `severity1__claude-code-prompt-improver/database` · `severity1__claude-code-prompt-improver/performance` · `severity1__claude-code-prompt-improver/structure` · `severity1__claude-code-prompt-improver/flows` · `severity1__claude-code-prompt-improver/cost` · `timbrel__GitSavvy/database` · `timbrel__GitSavvy/performance` · `timbrel__GitSavvy/structure` · `timbrel__GitSavvy/flows` · `timbrel__GitSavvy/github` · `MicrosoftDocs__mcp/security` · `MicrosoftDocs__mcp/database` · `MicrosoftDocs__mcp/performance` · `MicrosoftDocs__mcp/structure` · `MicrosoftDocs__mcp/flows` · `shadcnstudio__shadcn-studio/security` · `shadcnstudio__shadcn-studio/database` · `shadcnstudio__shadcn-studio/performance` · `shadcnstudio__shadcn-studio/structure` · `shadcnstudio__shadcn-studio/flows` · `shadcnstudio__shadcn-studio/cost` · `c15t__c15t/database` · `c15t__c15t/structure` · `vstorm-co__full-stack-ai-agent-template/database` · `vstorm-co__full-stack-ai-agent-template/performance` · `vstorm-co__full-stack-ai-agent-template/structure` · `Swatinem__rust-cache/security` · `Swatinem__rust-cache/database` · `Swatinem__rust-cache/performance` · `Swatinem__rust-cache/structure` · `Swatinem__rust-cache/flows` · `aeonfun__opendia/security` · `aeonfun__opendia/database` · `aeonfun__opendia/structure` · `aeonfun__opendia/flows` · `aeonfun__opendia/github` · `balajmarius__svg2jsx/security` · `balajmarius__svg2jsx/database` · `balajmarius__svg2jsx/performance` · `balajmarius__svg2jsx/structure` · `balajmarius__svg2jsx/flows` · `JohnHeibel__PDoomVideo/security` · `JohnHeibel__PDoomVideo/database` · `JohnHeibel__PDoomVideo/structure` · `JohnHeibel__PDoomVideo/flows` · `JohnHeibel__PDoomVideo/cost` · `nuxt-community__auth-module/database` · `nuxt-community__auth-module/structure` · `nuxt-community__auth-module/flows` · `wiedehopf__tar1090/security` · `wiedehopf__tar1090/database` · `wiedehopf__tar1090/performance` · `wiedehopf__tar1090/structure` · `wiedehopf__tar1090/flows` · `openupm__openupm/security` · `openupm__openupm/database` · `openupm__openupm/structure` · `openupm__openupm/flows` · `silvertakana__worldwideview/database` · `silvertakana__worldwideview/structure` · `zanwei__design-dna/security` · `zanwei__design-dna/database` · `zanwei__design-dna/structure` · `zanwei__design-dna/code` · `zanwei__design-dna/flows` · `zanwei__design-dna/cost` · `PowerShell__vscode-powershell/database` · `PowerShell__vscode-powershell/structure` · `PowerShell__vscode-powershell/flows` · `microsoft__vscode-mssql/database` · `DanKE123abc__NoUnityCN/security` · `DanKE123abc__NoUnityCN/database` · `DanKE123abc__NoUnityCN/performance` · `DanKE123abc__NoUnityCN/structure` · `DanKE123abc__NoUnityCN/flows` · `DanKE123abc__NoUnityCN/cost` · `hanshuaikang__nezha/database` · `hanshuaikang__nezha/performance` · `hanshuaikang__nezha/structure` · `hanshuaikang__nezha/flows` · `parse-community__parse-server-example/security` · `parse-community__parse-server-example/database` · `parse-community__parse-server-example/performance` · `parse-community__parse-server-example/structure` · `parse-community__parse-server-example/flows` · `opennextjs__opennextjs-cloudflare/database` · `opennextjs__opennextjs-cloudflare/structure` · `chinesehuazhou__python-weekly/security` · `chinesehuazhou__python-weekly/database` · `chinesehuazhou__python-weekly/performance` · `chinesehuazhou__python-weekly/structure` · `chinesehuazhou__python-weekly/flows` · `evoluhq__evolu/security` · `evoluhq__evolu/database` · `evoluhq__evolu/structure` · `evoluhq__evolu/flows` · `karlicoss__promnesia/database` · `karlicoss__promnesia/structure` · `karlicoss__promnesia/flows` · `RubinLabs26__ISpotify/database` · `RubinLabs26__ISpotify/performance` · `RubinLabs26__ISpotify/structure` · `RubinLabs26__ISpotify/flows` · `valqore__valqore/security` · `valqore__valqore/database` · `valqore__valqore/performance` · `valqore__valqore/structure` · `valqore__valqore/flows` · `kajisho5__ffmpeg-skill/database` · `kajisho5__ffmpeg-skill/structure` · `kajisho5__ffmpeg-skill/flows` · `valor-software__ng2-file-upload/database` · `valor-software__ng2-file-upload/performance` · `valor-software__ng2-file-upload/structure` · `1lck__Lithe-IDEA/database` · `1lck__Lithe-IDEA/structure` · `ARC-MX__sgcc_electricity_new/database` · `ARC-MX__sgcc_electricity_new/performance` · `ARC-MX__sgcc_electricity_new/structure` · `ARC-MX__sgcc_electricity_new/flows` · `ARC-MX__sgcc_electricity_new/github` · `coji__natural-japanese/database` · `coji__natural-japanese/performance` · `coji__natural-japanese/structure` · `coji__natural-japanese/flows` · `evloghq__evlog/database` · `evloghq__evlog/structure` · `nearform__graphql-hooks/database` · `nearform__graphql-hooks/structure` · `nearform__graphql-hooks/flows` · `vercel__react-tweet/database` · `vercel__react-tweet/performance` · `vercel__react-tweet/structure` · `vercel__react-tweet/flows` · `vercel-labs__emulate/database` · `vercel-labs__emulate/structure` · `AminForou__mcp-gsc/security` · `AminForou__mcp-gsc/database` · `AminForou__mcp-gsc/performance` · `AminForou__mcp-gsc/structure` · `AminForou__mcp-gsc/flows` · `Jesseovo__last30days-skill-cn/security` · `Jesseovo__last30days-skill-cn/database` · `Jesseovo__last30days-skill-cn/performance` · `Jesseovo__last30days-skill-cn/structure` · `Jesseovo__last30days-skill-cn/flows` · `bugy__script-server/security` · `bugy__script-server/database` · `bugy__script-server/performance` · `bugy__script-server/structure` · `zcpua__midjourney-api/database` · `zcpua__midjourney-api/performance` · `zcpua__midjourney-api/structure` · `zcpua__midjourney-api/flows` · `u14app__neo-chat/database` · `u14app__neo-chat/structure` · `xushanpei__open-file-viewer/security` · `xushanpei__open-file-viewer/database` · `xushanpei__open-file-viewer/structure` · `xushanpei__open-file-viewer/flows` · `xushanpei__open-file-viewer/cost` · `stripe__ai/database` · `stripe__ai/structure` · `trustedsec__hate_crack/security` · `trustedsec__hate_crack/database` · `trustedsec__hate_crack/performance` · `trustedsec__hate_crack/structure` · `trustedsec__hate_crack/flows` · `DHTMLX__gantt/database` · `DHTMLX__gantt/structure` · `DHTMLX__gantt/flows` · `timescale__pg-aiguide/database` · `timescale__pg-aiguide/structure` · `timescale__pg-aiguide/flows` · `timescale__pg-aiguide/github` · `TencentEdgeOne__edgeone-makers-tools/database` · `TencentEdgeOne__edgeone-makers-tools/structure` · `TencentEdgeOne__edgeone-makers-tools/code` · `TencentEdgeOne__edgeone-makers-tools/flows` · `facebookresearch__MetaCLIP/security` · `facebookresearch__MetaCLIP/database` · `facebookresearch__MetaCLIP/structure` · `facebookresearch__MetaCLIP/flows` · `facebookresearch__MetaCLIP/cost` · `nimbalyst__nimbalyst/database` · `XiaoMaColtAI__math-modeling-skill/security` · `XiaoMaColtAI__math-modeling-skill/database` · `XiaoMaColtAI__math-modeling-skill/structure` · `XiaoMaColtAI__math-modeling-skill/flows` · `XiaoMaColtAI__math-modeling-skill/cost` · `dyrector-io__dyrectorio/structure` · `Aas-ee__open-webSearch/database` · `Aas-ee__open-webSearch/structure` · `Aas-ee__open-webSearch/flows` · `Aas-ee__open-webSearch/github` · `Julian-Ivanov__jarvis-voice-assistant/database` · `Julian-Ivanov__jarvis-voice-assistant/performance` · `Julian-Ivanov__jarvis-voice-assistant/structure` · `Julian-Ivanov__jarvis-voice-assistant/flows` · `Julian-Ivanov__jarvis-voice-assistant/cost` · `Julian-Ivanov__jarvis-voice-assistant/github` · `aomkoyo__obs-airplay-receiver/database` · `aomkoyo__obs-airplay-receiver/performance` · `aomkoyo__obs-airplay-receiver/structure` · `aomkoyo__obs-airplay-receiver/flows` · `tokio-rs__mini-redis/security` · `tokio-rs__mini-redis/database` · `tokio-rs__mini-redis/performance` · `tokio-rs__mini-redis/structure` · `tokio-rs__mini-redis/code` · `tokio-rs__mini-redis/flows` · `gothinkster__node-express-realworld-example-app/performance` · `gothinkster__node-express-realworld-example-app/structure` · `gothinkster__node-express-realworld-example-app/flows` · `AkbarDevop__ai-job-agent/security` · `AkbarDevop__ai-job-agent/database` · `AkbarDevop__ai-job-agent/structure` · `AkbarDevop__ai-job-agent/flows` · `AkbarDevop__ai-job-agent/github` · `hi-godot__cyberpunk-hud-demo/security` · `hi-godot__cyberpunk-hud-demo/database` · `hi-godot__cyberpunk-hud-demo/performance` · `hi-godot__cyberpunk-hud-demo/structure` · `hi-godot__cyberpunk-hud-demo/code` · `hi-godot__cyberpunk-hud-demo/flows` · `hi-godot__cyberpunk-hud-demo/cost` · `hi-godot__cyberpunk-hud-demo/github` · `hugoguerrap__crypto-claude-desk/security` · `hugoguerrap__crypto-claude-desk/database` · `hugoguerrap__crypto-claude-desk/structure` · `hugoguerrap__crypto-claude-desk/flows` · `hugoguerrap__crypto-claude-desk/cost`

**Repos with 0 detector findings in EVERY area** (1) — do NOT read these as clean: `hi-godot__cyberpunk-hud-demo`. For each, check the `cov!` column and the area table above before repeating any "no findings" claim.

## What this number is NOT

1. **Precision is unmeasured.** Every finding is a raw mechanical signal (label `probado`). Nothing here was adjudicated by a human, so there is no true-positive rate and no false-positive rate. A count of findings is a count of signals, not a count of defects.
2. **`juicio` rules never ran.** Across the measured repos the `area_verdicts` tables name them per area. These rules require a model to decide (Fase 3 has no engine). Their verdict is absent, not negative — a repo with zero findings may have every `juicio` rule outstanding.
3. **Tools that are not implemented are named, never silent.** Degraded rule ids across this run: 41 distinct rule(s): `code-bare-except-1`, `code-bare-except-with-others-2`, `code-boolean-parameter-plague-11`, `code-callback-hell-10`, `code-catch-and-continue-9`, `code-deep-inheritance-9`, `code-error-assigned-unused-2`, `code-extreme-nesting-4`, `code-high-nesting-5`, `code-loose-equality-1`, `code-loose-inequality-2`, `code-missing-error-main-10`, `code-nested-ternary-9`, `code-print-statement-5`, `code-print-statement-8`, `code-slice-append-in-loop-6`, `code-unchecked-error-1`, `code-var-usage-3`, `cost-deprecated-version-10`, `cost-license-incompatible-1`, `cost-license-share-alike-3`, `cost-non-commercial-use-6`, `flows-error-leaks-stack-6`, `flows-fire-and-forget-critical-1`, `flows-message-breaking-schema-2`, `flows-missing-timeout-6`, `flows-ngrx-selectors-not-memoized-4`, `flows-redux-mutates-state-1`, `flows-redux-side-effects-2`, `github-commit-history-9`, `github-issue-health-12`, `security-cve-critical-1`, `security-cve-high-2`, `security-cve-medium-3`, `security-exploit-in-wild-5`, `security-license-incompatible-6`, `security-no-security-maintenance-7`, `security-secret-in-history-2`, `security-transitive-vuln-8`, `security-unmaintained-dep-4` … +1 more (full list in SWEEP-100.json `targets[].degraded_rules`). Rules the engine actually refused at run time (`degraded`) and rules that failed mid-run (`rule_failures`) are recorded per repo.
   - 0 rule failures recorded in this run.
4. **The shallow repos' history is VOID.** No repo in this run was shallow.
5. **The 20-findings-per-rule cap makes counts floors, not totals.** 1834 rule instance(s) stopped at the cap across 90 repo(s); every affected count is `≥` what is shown.
6. **Coverage is partial by construction.** Unmatched files (`cov!` column) mean a low count is weak evidence. Where ≥20% of non-binary files were examined by no rule the grade letter is capped at C and flagged `coverageLimited`; the per-repo `grade_coverage_limited` field records it.
7. **This is not a comparison.** The sample is the pre-registered selection in `benchmark/targets-100.json`; the distributions above describe THAT sample. Nothing here ranks stacks, languages or signals against each other — the per-cell n is too small and the sample was not drawn for that.

## Method (for a re-runner)

```
node benchmark/sweep-100.mjs
```

Per target: (1) `git rev-list --count HEAD` and `git rev-parse HEAD` in `benchmark/work100/<name>`, both bounded and captured through file descriptors; (2) `node scripts/detect/report.mjs --target benchmark/work100/<name> --out benchmark/sweep-100/runs/<name>`, bounded at 180s; (3) the row is read back from that run's `findings.json`. A run that times out, fails, is missing, or is not a git checkout is recorded as exactly that — it is never folded into a sum and never shown as 0.

Per-repo evidence kept in the repo: `runs/<name>/run.cmd` (the exact invocation), `stdout.txt`, `stderr.txt`, `exit.txt`. The three bulk dumps per repo (findings.json, report.md, prompts.md) — 300 file(s), 38.80 MiB — are gitignored by `benchmark/.gitignore`; the aggregate in this file and `SWEEP-100.json` is committed. Regenerate any one repo's dumps with its `run.cmd`.

