# Repository Review: crypto-claude-desk

Below are the problems I found, grouped by severity. I've focused on concrete, verifiable issues from the files provided.

---

## Critical / Correctness Bugs

### 1. `close-learning.js` — `return` at top level of a workflow file
```js
if (!preds.length) {
  log('No hay predicciones expiradas pendientes. El loop ya está al día.')
  return { evaluated: 0, verdicts: [], report: '...' }
}
```
`return` is used at module top level (outside any function). In an ES module this is a **syntax error** (`SyntaxError: Illegal return statement`). The same applies to the final `return { evaluated: done.length, ... }` at the bottom. If the workflow runtime wraps this in a function, fine — but nothing in the file indicates that, and the file is named `.js` with `export const meta`, i.e. a plain ESM module. This will fail to load.

### 2. `close-learning.js` — `pipeline` is used but never imported/defined
```js
const verdicts = await pipeline(preds, (p) => agent(...))
```
`agent`, `phase`, `log`, and `pipeline` are all used as globals. There is no import, no `require`, no declaration. Either the runtime injects them (undocumented here) or this file is broken. Given `meta` is explicitly `export`ed, the inconsistency suggests the globals are assumed — worth documenting or importing.

### 3. `close-learning.js` — schema/return mismatch
The `VERDICT_SCHEMA` requires `id`, `outcome`, `evaluation`. But the prompt tells the agent to call `validate_prediction()` with `actual_outcome` and `is_correct`, while the schema uses `actual_value` and `outcome` (enum). The agent is being asked to produce two different shapes for the same data. The `correct` count is computed from `v.outcome === 'correct'`, but the tool call uses `is_correct=true`. These can silently diverge.

### 4. `close-learning.js` — `find_expired_predictions` argument is a stringified JSON
```js
find_expired_predictions(current_prices='{"BTC/USDT": ..., "ETH/USDT": ..., ...}')
```
The prompt literally contains `...` placeholders inside the JSON string. If the model copies this verbatim, the tool receives invalid JSON. The instruction is ambiguous about whether the agent must fill in real numbers.

### 5. `close-learning.js` — hardcoded symbol list is stale/fragile
The discovery prompt hardcodes `bitcoin, ethereum, solana, avalanche-2, aptos, chainlink, uniswap, aave, pendle, worldcoin, jito...`. This will silently miss any symbol not in the list, and the trailing `...` is not valid syntax for the agent to expand reliably.

### 6. `agents/learning-agent.md` — tool/permission contradiction
Frontmatter declares:
```yaml
tools: Read, Grep, Write
disallowedTools: Edit, Bash, WebSearch, WebFetch
```
But Mission 1 says *"Use crypto-data MCP to verify what actually happened"* and Mission 2 step 3 says *"Use crypto-data MCP to verify what actually happened (price action)"*. The agent has `mcpServers: [crypto-data, crypto-learning-db]` so MCP tools are available — but the `tools:` list only enumerates built-ins. Depending on how the runtime merges `tools` and `mcpServers`, the MCP tools may be filtered out. This is at minimum confusing and at worst disables the agent's primary data source.

### 7. `agents/learning-agent.md` — Mission 4 references a tool that isn't in the declared MCP set
Mission 4 Step 1b calls `find_expired_predictions(current_prices='{"BTC/USDT": ...}')`. The `...` is again a literal placeholder in documentation. Also, the agent is told to "write an evaluation and validate as above" but the schema in the workflow expects `outcome`/`actual_value`, while the doc shows `is_correct`/`error_margin`. Inconsistent contracts between the agent doc and the workflow that drives it.

### 8. `agents/portfolio-manager.md` — PnL formula ignores fees/funding and is wrong for shorts with leverage
```
For SHORT:
  pnl_percent = ((entry_price - exit_price) / entry_price) * 100 * leverage
```
This is directionally correct but:
- No funding cost for futures (the agent is explicitly told to trade futures with 2–5x leverage).
- No fees/slippage, despite the risk-specialist computing spread/slippage.
- `pnl_usd = usd_amount * (pnl_percent / 100)` — if `usd_amount` is notional (already × leverage), this double-counts leverage. The doc never clarifies whether `usd_amount` is margin or notional. This is a real accounting bug waiting to happen.

### 9. `agents/portfolio-manager.md` — position sizing table is internally inconsistent
| Signal Strength | Base Size | With High Confidence (>1.2) | With Low Confidence (<0.8) |
| Weak | 2-5% | 5% | 2% |
| Strong | 10-20% | 15-20% | 10% |

"High confidence" for a *weak* signal (5%) is larger than "low confidence" for a *strong* signal (10%)? The table conflates signal strength and confidence without defining how they combine. Also "max 50% of portfolio allocated" vs "max 3 open trades" — with 20% per trade, 3 trades = 60% > 50%. The constraints contradict.

### 10. `agents/portfolio-manager.md` — leverage table vs. spot/futures table conflict
The leverage table says "Swing: 2-5x default, 1-3x high vol". The spot/futures table says "SPOT book: Leverage always 1x". A swing trade on spot would violate one of the two tables. No rule is given for which wins.

### 11. `agents/risk-specialist.md` — "AMPLIFY downside risk score by 10-15" is unitless
```
STRONG_OUTFLOW + falling stablecoin supply → AMPLIFY downside risk score by 10-15
```
10–15 what? Points? Percent? The risk score scale is defined as 0–100 ("EXTREME (>90%)"), so presumably points — but it's not stated, and the agent is a language model that will guess. Same for "REDUCE risk score by 5-10".

### 12. `agents/risk-specialist.md` — Step 0 track-record call has no `strategy_type`
```js
get_prediction_track_record(agent="risk-specialist", symbol="...")
```
The portfolio-manager doc says the key question is setup reliability and passes `strategy_type`. The risk-specialist omits it, so it gets a symbol-wide aggregate that mixes setups. Inconsistent methodology across agents.

---

## Configuration / Packaging Issues

### 13. `.claude-plugin/marketplace.json` — `source: "./"` with a nested plugin
```json
"plugins": [{ "name": "crypto-trading-desk", "source": "./", ... }]
```
The marketplace root *is* the plugin root. This works only if the marketplace file and plugin file coexist at the repo root, which they do — but it means the marketplace can never host a second plugin, and `source: "./"` is fragile if the repo is ever vendored. More importantly, `marketplace.json` declares `metadata.version: 1.1.2` and the plugin declares `version: 1.1.2` — three places to bump (marketplace metadata, marketplace plugin entry, plugin.json). They will drift.

### 14. `.claude-plugin/plugin.json` — `mcpServers` points to a file, not an object
```json
"mcpServers": "./mcp-servers.plugin.json"
```
The Claude plugin schema expects `mcpServers` to be an object (or a path to a JSON file, depending on version). If the runtime expects inline config, this silently no-ops. Worth verifying against the actual plugin spec version.

### 15. `.claude/launch.json` — `runtimeExecutable: "npm"` with `--prefix`
```json
"runtimeArgs": ["--prefix", "dashboard", "run", "dev:next"]
```
`npm --prefix dashboard run dev:next` works, but `npm` on Windows is `npm.cmd`. Also `dev:next` must exist in `dashboard/package.json` — not shown, so unverifiable. The `port: 3000` is declared but Next.js default is 3000 anyway; if `dev:next` sets a different port, this is wrong.

### 16. `.gitignore` — ignores `data/reports/*` but the app reads from it
```
data/reports/*
!data/reports/.gitkeep
```
The portfolio-manager and learning-agent read `data/reports/`. Fine for runtime, but the `.example` files under `data/trades/` are committed while `data/reports/` has no example. New users get no template for report structure. Also `data/db/` is ignored — good — but `data/trades/*.json` (non-example) is ignored while the MCP server presumably writes there; if the DB is the source of truth, the JSON ignores are vestigial and confusing.

### 17. `.gitignore` — `data/create/*` and `data/logs/*` are ignored but no `.gitkeep` is committed for them
Only `data/reports/.gitkeep` and `data/logs/.gitkeep` are un-ignored. `data/create/` has no `.gitkeep`, so the directory won't exist on a fresh clone and any code writing to it will fail unless it `mkdir -p`s first.

### 18. `.python-version` says `3.12` but `pyproject.toml` is not shown
Can't verify `requires-python`. If `pyproject.toml` says `>=3.11` or `>=3.13`, the two disagree. Worth checking.

---

## Documentation / Consistency Issues

### 19. `agents/market-monitor.md` — "NEVER use crypto-data for prices" but `crypto-data` is the only MCP listed for metadata
The agent has `mcpServers: [crypto-data, crypto-futures, crypto-exchange]`. The doc says use `crypto-exchange` for prices and `crypto-data` for metadata. But the "Parallel Execution" section lists `get_exchange_prices + get_all_tickers + compare_exchange_prices` (exchange) *and* `get_fear_greed_index + get_global_market_stats + ...` (data) in the same message — fine. However, the agent's `tools:` line is `WebSearch, Read, Write` with `disallowedTools: Edit`. MCP tools are not in `tools:`. Same ambiguity as #6.

### 20. `agents/news-sentiment.md` — `maxTurns: 20` with a very long execution strategy
The agent is told to do 5+ WebSearches, WebFetches, Polymarket queries, and a track-record call, then write a report. 20 turns is tight for multi-symbol analysis. Either the limit is too low or the strategy is too ambitious. No guidance on prioritization when turns run out.

### 21. `agents/news-sentiment.md` — sentiment scale is inconsistent
```
EXTREME BULLISH (>+80)
MODERATE BULLISH (+40 to +80)
NEUTRAL (-40 to +40)
MODERATE BEARISH (-80 to -40)
EXTREME BEARISH (<-80)
```
Boundaries overlap at exactly +80, +40, -40, -80. Minor, but a model will pick arbitrarily. Also the report format says `SENTIMENT SCORE: +XX / -XX (out of 100)` — the scale is -100..+100, not 0..100, so "out of 100" is misleading.

### 22. `agents/news-sentiment.md` — Polymarket example is stale
```
"BTC $150k by Jun30: 1.35% YES (HIGH_CONFIDENCE NO)"
```
Hardcoded example with a specific date and probability. Models tend to anchor on examples; this will bias outputs. Should be a generic placeholder.

### 23. `agents/learning-agent.md` — "FIVE missions" but Mission 4 has a "Step 1b" and Mission 5 is pattern library
The numbering is fine, but Mission 4 Step 1b ("Auto-find Expired Predictions") duplicates the entire `close-learning.js` workflow. Two implementations of the same logic (workflow vs. agent doc) will drift. The workflow is the automated path; the agent doc should reference it rather than re-specify.

### 24. `agents/learning-agent.md` — `maxTurns: 15` for five missions
Mission 1 alone requires 3 MCP calls + memory + grep. Mission 2 requires 3+ calls. Mission 3, 4, 5 each require multiple calls. 15 turns is not enough to do all five in one invocation. Either the agent is expected to do one mission per invocation (not stated) or the limit is wrong.

### 25. `agents/portfolio-manager.md` — "max 3 open trades, max 50% of portfolio allocated" but no definition of "portfolio"
Is it total equity, spot balance, futures balance, or combined? The doc says "Two Books, Two Mindsets" and `get_portfolio_state()` returns "balances, open trades, stats" — but the 50% cap is not scoped to a book. A spot trade and a futures trade could each be 50% of their respective books = 100% total exposure.

### 26. `agents/portfolio-manager.md` — Polymarket veto thresholds are arbitrary and undocumented
```
< 30% probability → downgrade conviction
< 15% probability AND on-chain confirms outflows → REJECT
```
No rationale, no source. These are magic numbers that will be applied inconsistently. Also "downgrade conviction by one level (high→medium, medium→low)" — what happens to "low"? Undefined.

### 27. `agents/portfolio-manager.md` — `record_trade` field list vs. `learning` JSON
The doc says `record_trade()` takes "ALL fields including the `learning` JSON" with sub-fields `entry_thesis`, `market_context`, `setup_type`, `conviction_level`, `edge_description`, `what_could_go_wrong`. But the "Trade fields include" list earlier says `learning (JSON)` without enumerating. If the MCP server validates the JSON schema, a mismatch will fail at runtime. Not verifiable from the files shown.

### 28. `agents/risk-specialist.md` — "Step 5.5" inserted between Step 5 and Step 6
Cosmetic, but the numbering (Step 0, 1, 2, 3, 4, 5, 5.5, 6, 7) suggests the doc was patched rather than revised. Same pattern in portfolio-manager (Step 4.5, 5.5). This is a smell that the docs are append-only and will accumulate contradictions.

### 29. `agents/risk-specialist.md` — DefiLlama chain names are hardcoded
```
get_chain_tvl_change(chain="Ethereum", days=7)
get_chain_tvl_change(chain="Solana", days=7)
```
If the trade is on Avalanche, Aptos, or Jito (all mentioned in the learning-agent's symbol list), the risk-specialist has no guidance. The doc says "if the trade is SOL-related" but not "if the trade is X-related, use chain Y". Mapping is missing.

### 30. `agents/risk-specialist.md` — "AMPLIFY downside risk score by 10-15" applied to a 0-100 scale
If the base risk score is already 85 (HIGH), adding 15 gives 100 (EXTREME) — fine. But if the base is 95, adding 15 gives 110, which is off-scale. No clamping rule.

---

## Cross-Cutting / Architectural Issues

### 31. No single source of truth for MCP tool names
`get_crypto_prices` (crypto-data) vs `get_exchange_prices` (crypto-exchange) vs `get_all_tickers`. The market-monitor doc explicitly says never use `get_crypto_prices` for prices, but the learning-agent's workflow (`close-learning.js`) uses `get_crypto_prices()` for prices. **Direct contradiction between the workflow and the agent docs.** The workflow will get stale CoinGecko data while the docs say to use exchange data.

### 32. `close-learning.js` uses `get_crypto_prices` (crypto-data) for prices
```js
Usa get_crypto_prices() (crypto-data MCP) para obtener el precio actual
```
This violates the market-monitor's own rule ("NEVER use crypto-data for prices"). The workflow should use `crypto-exchange`. This is a real data-quality bug in the learning loop — predictions will be validated against stale prices.

### 33. `close-learning.js` — `fetch_ohlcv_data` from `crypto-exchange` but the agent's MCP list doesn't include it
The learning-agent frontmatter lists `mcpServers: [crypto-data, crypto-learning-db]`. The workflow tells the agent to call `fetch_ohlcv_data(...)` from `crypto-exchange`. The agent doesn't have that server. The workflow will fail at the tool call.

### 34. `close-learning.js` — `validate_prediction()` argument names don't match the agent doc
Workflow: `prediction_id`, `actual_outcome/valor real`, `evaluation`.
Agent doc: `prediction_id`, `actual_outcome`, `is_correct`, `error_margin`, `evaluation`.
The workflow omits `is_correct` and `error_margin`, which the agent doc says are required. The MCP server will either reject the call or default them, silently corrupting the track record.

### 35. `close-learning.js` — `get_prediction_track_record()` called with no args in synthesis
```js
Llama get_prediction_track_record() de crypto-learning-db para ver la precisión por tipo de setup
```
The agent doc shows this tool takes `symbol`, `strategy_type`, `agent`, `prediction_type`. Calling it with no args may return everything (context bloat) or error. The synthesis prompt then asks for "precisión por tipo de setup" — but the tool's output shape is not documented, so the model may hallucinate the breakdown.

### 36. `close-learning.js` — `generate_summary()` "si corresponde" is undefined
"Opcional: llama generate_summary() si corresponde generar un resumen de periodo." The model has no way to know when it "corresponds". Either always call it or define the condition.

### 37. `close-learning.js` — `NO uses la herramienta Edit` repeated three times
The learning-agent's `disallowedTools` already includes `Edit`. Repeating the instruction in every prompt is a sign the author doesn't trust the frontmatter to be enforced. If it isn't enforced, that's a security issue; if it is, the repetition is noise.

### 38. `close-learning.js` — `pipeline` vs `agent` semantics
`pipeline(preds, (p) => agent(...))` — if `pipeline` is a concurrency-limited map, fine. If it's a sequential reducer, the "en paralelo" comment is wrong. The file claims parallel evaluation but uses an undefined primitive. No import, no doc.

### 39. `close-learning.js` — `verdicts.filter(Boolean)` silently drops failures
If an agent call fails and returns `null`/`undefined`, the failure is swallowed. `done.length` will be less than `preds.length`, and the log says "X/Y evaluadas" — but the synthesis prompt says "Acabas de validar ${done.length} predicciones" without mentioning the failures. Silent data loss in the learning loop.

### 40. `close-learning.js` — `correct` is computed but only used in the log and return
```js
const correct = done.filter((v) => v.outcome === 'correct').length
```
The synthesis agent is given `done` (the full verdicts) but not `correct`. It's asked to compute accuracy itself via `get_prediction_track_record()`. Redundant and potentially inconsistent (the workflow's count vs. the DB's count).

### 41. `agents/learning-agent.md` — `memory: project` but no memory schema
The agent is told to "update your persistent memory with pattern library" but there's no schema, no file path, no format. The `.gitignore` ignores `.claude/agent-memory/`, so memory is local-only — meaning patterns learned by one user are never shared. For a "self-evolving platform" this is a significant limitation, and it's not documented.

### 42. `agents/portfolio-manager.md` — `memory: project` same issue
Same as above. The "self-evolving" claim in the marketplace description rests on memory that is gitignored and per-user.

### 43. `agents/portfolio-manager.md` — "There are no formulas. You are the consensus engine"
This is an explicit instruction to *not* use deterministic logic. Combined with `model: opus` and `maxTurns: 15`, the final trade decision is entirely LLM judgment. For a system that records PnL and claims to learn, the lack of any deterministic guardrail (e.g., hard R/R check, hard exposure check) is a design risk. The "EXECUTE if R/R > 2:1" is a rule, but the doc immediately says "There are no formulas" — contradictory.

### 44. `agents/portfolio-manager.md` — "max 3 open trades" but no per-symbol limit
Could open 3 trades all on BTC. No correlation check is mandated at decision time (risk-specialist computes correlation, but portfolio-manager isn't told to enforce a correlation cap).

### 45. `agents/portfolio-manager.md` — `get_portfolio_state()` called twice (Step 0 and Step 6.1)
Redundant. If state changes between calls (another agent closes a trade), the decision and execution see different states. No locking/transaction semantics documented.

### 46. `agents/portfolio-manager.md` — trade ID generation is racy
```
Generate trade ID: trade_XXX (increment from last)
```
If two portfolio-manager invocations run concurrently (the workflow uses `pipeline` for parallel evaluation), both read the same "last" ID and generate the same new ID. No atomic counter. This is a real bug if the system ever runs concurrent decisions.

### 47. `agents/portfolio-manager.md` — `close_trade` doesn't validate exit price against SL/TP
The doc says "When closing a trade (manually or because SL/TP hit)" but the tool signature is `close_trade(trade_id, exit_price, close_reason)`. Nothing checks that `exit_price` is consistent with the recorded SL/TP. An LLM could close at a price that never existed. No validation layer.

### 48. `agents/portfolio-manager.md` — PnL formula doesn't handle liquidation
With 10x leverage and a 10% adverse move, the position is liquidated. The formula gives `pnl_percent = -100%`, `pnl_usd = -usd_amount`. But real liquidation happens before -100% due to maintenance margin, and the loss is capped at margin, not notional. The formula is wrong for the leveraged futures book the agent is explicitly told to run.

### 49. `agents/portfolio-manager.md` — "Two Books" table truncated in the provided file
The file is 12965 bytes and truncated at "SL distance | 8-15% from entry (let thesis breathe) | 2-4% from entry". The rest of the table (TP, sizing, etc.) is not shown. Can't fully review, but the truncation itself suggests the doc is long enough that agents may not read it all within `maxTurns: 15`.

### 50. `agents/risk-specialist.md` — file truncated
Same issue. The provided content cuts off at "MODERATE (40-70%): Monitor c". The full risk-level definitions are not reviewable.

---

## Minor / Hygiene

### 51. `.claude-plugin/marketplace.json` — `owner` has no `email` or `url`
Schema may require it. Also `metadata.description` duplicates `plugins[0].description` almost verbatim.

### 52. `.claude-plugin/plugin.json` — `author.name` is "Crypto Trading Desk Contributors" but `repository` is a personal GitHub URL
Inconsistent attribution. Also `license: MIT` in plugin.json but no `LICENSE` file content shown (only the filename in the tree). Verify the LICENSE file actually contains MIT text.

### 53. `.claude/launch.json` — `version: "0.0.1"`
The plugin is at 1.1.2. The launch config version is unrelated but confusingly low.

### 54. `.gitignore` — `GUIA-DEL-PROYECTO.md` is ignored
A Spanish-named personal guide is gitignored. Fine, but it means the repo's primary docs are in English while the workflow file (`close-learning.js`) and some agent prompts are in Spanish. **Mixed-language codebase.** The workflow's `meta.description` is Spanish, the agent prompts are Spanish, but the agent `.md` files are English. This will confuse contributors and may cause the model to switch languages mid-task.

### 55. `close-learning.js` — Spanish prompts, English schemas
The `VERDICT_SCHEMA` enum is `['correct', 'incorrect', 'partial']` (English) but the prompt says "se CUMPLIÓ, NO se cumplió, o fue PARCIAL" (Spanish). The model must map Spanish reasoning to English enum values. Works, but fragile.

### 56. `close-learning.js` — `phase('Descubrir')` etc. use Spanish phase names
If the runtime or UI expects English phase names, this breaks. If not, it's just inconsistent with the rest of the repo.

### 57. `agents/market-monitor.md` — `model: haiku` for a "real-time market intelligence" agent
Haiku is the cheapest/fastest model. The agent is asked to do WebSearch for whale alerts, arbitrage scans, and multi-source synthesis. Quality will suffer. The choice is presumably cost-driven, but it's not documented as a tradeoff.

### 58. `agents/news-sentiment.md` — `model: sonnet` but `maxTurns: 20`
Sonnet with 20 turns for multi-symbol news analysis is tight. See #20.

### 59. `agents/learning-agent.md` — `model: opus` with `maxTurns: 15`
Opus is the most expensive model. 15 turns for five missions is both expensive and insufficient. See #24.

### 60. No tests for the workflow file
`tests/` covers the MCP servers (`test_crypto_*.py`) but there is no test for `close-learning.js` or any of the agent prompt contracts. The workflow is the most complex piece of logic in the repo and is untested.

### 61. No CI configuration
No `.github/workflows/`, no `Makefile`, no `tox.ini`. The `tests/` directory exists but nothing runs it automatically. `pyproject.toml` is present but its `[tool.pytest]` config is not shown.

### 62. `dashboard/` has its own `CLAUDE.md` and `AGENTS.md`
Two agent-instruction files in a subdirectory. If the root `CLAUDE.md` also has instructions, they may conflict. The root `CLAUDE.md` content is not shown, so unverifiable — but the duplication is a smell.

### 63. `dashboard/server/pty-server.mjs` — a PTY server in a web dashboard
Exposing a PTY over HTTP is a significant security surface. No auth is mentioned in the file tree. If this is reachable from the network, it's a remote code execution vector. Worth a dedicated security review.

### 64. `dashboard/src/app/api/ohlcv/route.ts` and `api/price/route.ts` — no rate limiting mentioned
These proxy market data. If they're public, they can be abused to exhaust upstream API quotas.

### 65. `mcp-servers/crypto_ultra_simple.py` — name suggests a toy implementation
Alongside `crypto_exchange_ccxt_ultra.py`, `crypto_advanced_indicators.py`, etc. The naming is inconsistent (`ultra_simple` vs `_ultra`). Possibly dead code.

### 66. `mcp-servers/validators.py` — a shared validators module
Good practice, but no indication of which servers use it. If only some do, validation is inconsistent across the 9 servers.

### 67. `data/trades/*.json.example` files exist but the DB is the source of truth
The `.gitignore` ignores the real JSON files, and the docs say "Always prefer crypto-learning-db tools over reading JSON files directly." So why do the JSON files exist at all? Either they're a migration artifact or a fallback. Undocumented.

### 68. `skills/` directory has 8 skills but no index
`analyze`, `close-trade`, `create`, `monitor`, `portfolio`, `quick`, `setup`, `validate-predictions`. No `skills/README.md` or manifest. Discoverability relies on the plugin runtime.

### 69. `hooks/hooks.json` and `hooks/post-setup.sh` — no documentation of what they do
The file tree shows them but the contents aren't provided. A `post-setup.sh` hook that runs arbitrary code on install is a supply-chain risk if not reviewed.

### 70. `bin/autopilot.sh` and `bin/sync-plugin-db.sh` — no documentation
Two shell scripts in `bin/` with no README. `autopilot.sh` in particular sounds like it runs the full agent loop unattended — a significant operational risk if it can place paper trades without human review.

---

## Summary of the Most Important Fixes

1. **`close-learning.js` is broken**: top-level `return`, undefined `pipeline`/`agent`/`phase`/`log`, schema/tool-call mismatch, and it uses `get_crypto_prices` (stale) instead of `crypto-exchange` for validation prices.
2. **Agent MCP tool access is ambiguous**: `tools:` lists only built-ins while `mcpServers:` lists servers; the workflow assumes tools the agent may not have.
3. **PnL math is wrong for leveraged futures**: no fees, no funding, no liquidation, and `usd_amount` semantics are undefined.
4. **Position sizing and exposure limits contradict each other** (50% cap vs. 3×20% trades; spot 1x vs. swing 2-5x).
5. **Trade ID generation is racy** and there's no atomic counter.
6. **The learning loop validates against stale prices**, undermining the entire "self-evolving" claim.
7. **Mixed Spanish/English** across prompts, schemas, and docs.
8. **No tests or CI for the workflow layer**, which is the most complex and highest-risk code.
9. **`pty-server.mjs` is an unauthenticated RCE surface** if exposed.
10. **Memory is gitignored**, so "learning" is per-user and non-portable — a fundamental limitation of the product's core value proposition.
