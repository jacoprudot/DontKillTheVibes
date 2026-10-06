# Assessment Report: crypto-claude-desk

- **Repository**: crypto-claude-desk
- **Date**: 2026-10-05T20:59:56.772Z
- **Model**: deepseek-chat
- **Toolkit Version**: 0.1.0-beta

---

## Executive Summary
- **Overall Health**: F
- **Critical Findings**: 5
- **Total Findings**: 14
- **By Severity**: critical 5 · high 5 · medium 3 · low 1
- **Estimated Total Effort**: 4×XS, 3×S, 7×M
- **Top 3 Priorities**:
  - `security-gha-secret-leak-3` — The workflow interpolates raw prediction data and verdict JSON directly into agent prompts via template literals (JSON.stringify(done)),… (critical, XS)
  - `security-secret-in-code-1` — The workflow hardcodes a list of specific cryptocurrency symbols (bitcoin, ethereum, solana, avalanche-2, aptos, chainlink, uniswap, aave,… (critical, XS)
  - `code-logs-secrets-10` — The workflow logs the full verdicts JSON (JSON.stringify(done)) into the synthesis agent prompt. (critical, XS)

---

## Detailed Findings (by Priority)

### Priority 1: `security-gha-secret-leak-3`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6
**Location**: `.claude/workflows/close-learning.js:78`
**Description**: The workflow interpolates raw prediction data and verdict JSON directly into agent prompts via template literals (JSON.stringify(done)), which are then passed to LLM agents. If any prediction or trade record contains API keys, exchange credentials, or PII stored in the SQLite DB, this data is echoed into the agent context and potentially into logs. There is no masking or redaction step.
**Remediation**: Redact or mask sensitive fields before interpolating DB records into agent prompts. Add a sanitization helper that strips keys matching /key|secret|token|password/i from objects before JSON.stringify. Never pass raw credential-bearing records to LLM prompts.
**Evidence**:
```
`Eres el learning-agent. Acabas de validar ${done.length} predicciones. Veredictos:
   ${JSON.stringify(done)}`
```
**Depends On**: None | **Blocks**: None

### Priority 2: `security-secret-in-code-1`
**Module**: security | **Severity**: critical | **Effort**: XS | **Confidence**: 0.5
**Location**: `.claude/workflows/close-learning.js:44`
**Description**: The workflow hardcodes a list of specific cryptocurrency symbols (bitcoin, ethereum, solana, avalanche-2, aptos, chainlink, uniswap, aave, pendle, worldcoin, jito) directly in the agent prompt string. While not a credential, this pattern of embedding configuration data in workflow code means any future addition of API keys or exchange credentials would follow the same hardcoding pattern. More critically, the prompt instructs the agent to call get_crypto_prices() with no authentication context, and the workflow has no mechanism to inject secrets securely.
**Remediation**: Move symbol lists and any configuration to environment variables or a config file loaded at runtime. Establish a pattern where secrets are injected via environment variables (process.env) and never appear in workflow source. Add a pre-commit hook (gitleaks/trufflehog) to catch future secret commits.
**Evidence**:
```
(bitcoin, ethereum, solana, avalanche-2, aptos, chainlink, uniswap, aave, pendle, worldcoin, jito...)
```
**Depends On**: None | **Blocks**: None

### Priority 3: `code-logs-secrets-10`
**Module**: code | **Severity**: critical | **Effort**: XS | **Confidence**: 0.6
**Location**: `.claude/workflows/close-learning.js:78`
**Description**: The workflow logs the full verdicts JSON (JSON.stringify(done)) into the synthesis agent prompt. If verdicts contain evaluation text that includes sensitive market data, position sizes, or account balances from the trading DB, this information is exposed in agent context and potentially in execution logs. The log() call at line 78 also outputs prediction counts without redaction.
**Remediation**: Redact sensitive fields before logging or interpolating into prompts. Create a sanitizeForLog() helper that strips balance, position, and credential fields. Never log full DB records; log only IDs and aggregate counts.
**Evidence**:
```
log(`${done.length}/${preds.length} evaluadas · ${correct} correctas`)
```
**Depends On**: None | **Blocks**: None

### Priority 4: `security-gha-overpermissive-2`
**Module**: security | **Severity**: high | **Effort**: XS | **Confidence**: 0.7
**Location**: `.claude-plugin/plugin.json:1`
**Description**: The plugin manifest declares an MCP server configuration file (mcp-servers.plugin.json) and the marketplace/plugin metadata grants broad capabilities without any permission scoping. The plugin.json exposes 9 MCP servers (95 tools) to every agent invocation with no least-privilege restriction, meaning any agent can invoke any tool including trade execution and DB writes.
**Remediation**: Scope MCP server exposure per agent in each agent's frontmatter (mcpServers list) and remove the global mcpServers reference from plugin.json, or document an explicit allow-list. Follow the principle of least privilege: agents that only read market data should not have crypto-learning-db write tools.
**Evidence**:
```
"mcpServers": "./mcp-servers.plugin.json"
```
**Depends On**: None | **Blocks**: None

### Priority 5: `flows-missing-idempotency-3`
**Module**: flows | **Severity**: critical | **Effort**: S | **Confidence**: 0.7
**Location**: `.claude/workflows/close-learning.js:70`
**Description**: The workflow calls validate_prediction() for each expired prediction without any idempotency guard. If the workflow is re-run (e.g., after a partial failure or manual retry), already-validated predictions could be re-validated, corrupting the track record with duplicate evaluations and skewing accuracy metrics used for trading decisions.
**Remediation**: Add an idempotency check: before calling validate_prediction(), verify the prediction is still in 'pending' status. Use a unique run ID or transaction to ensure each prediction is validated exactly once. The MCP tool should reject validation of already-validated predictions.
**Evidence**:
```
3. Guarda el resultado llamando validate_prediction() de crypto-learning-db con:
          - prediction_id = '${p.id}'
```
**Depends On**: `flows-fire-and-forget-critical-1` | **Blocks**: None

### Priority 6: `flows-fire-and-forget-critical-1`
**Module**: flows | **Severity**: critical | **Effort**: M | **Confidence**: 0.8
**Location**: `.claude/workflows/close-learning.js:78`
**Description**: The workflow's Phase 2 uses pipeline() to evaluate predictions in parallel, but the verdicts array is filtered with .filter(Boolean) and the count of failures is never surfaced or retried. If an agent fails silently (returns null/undefined), the prediction remains unvalidated with no error handling, no dead-letter mechanism, and no alerting. Critical learning-loop data is silently dropped.
**Remediation**: Track failed evaluations explicitly: capture rejected promises, log failures with prediction IDs, and implement a retry or dead-letter queue for unvalidated predictions. Surface a failure count in the final report so operators know the loop is incomplete.
**Evidence**:
```
const done = verdicts.filter(Boolean)
const correct = done.filter((v) => v.outcome === 'correct').length
```
**Depends On**: None | **Blocks**: `flows-missing-dlq-2`, `flows-missing-error-handler-5`, `code-unhandled-promise-4`, `flows-missing-idempotency-3`

### Priority 7: `flows-missing-dlq-2`
**Module**: flows | **Severity**: high | **Effort**: M | **Confidence**: 0.75
**Location**: `.claude/workflows/close-learning.js:78`
**Description**: The learning workflow has no dead-letter queue or failure persistence. When an agent evaluation fails (network error, MCP timeout, malformed response), the prediction is silently skipped. There is no mechanism to inspect, replay, or alert on failed validations, meaning the learning loop can silently degrade over time.
**Remediation**: Implement a dead-letter mechanism: persist failed prediction IDs with error context to a separate table or file, and add a replay command. Alert when the failure rate exceeds a threshold (e.g., >10% of predictions in a run).
**Evidence**:
```
const done = verdicts.filter(Boolean)
```
**Depends On**: `flows-fire-and-forget-critical-1` | **Blocks**: None

### Priority 8: `security-no-input-validation-14`
**Module**: security | **Severity**: high | **Effort**: M | **Confidence**: 0.75
**Location**: `.claude/workflows/close-learning.js:60`
**Description**: The workflow passes prediction fields (p.id, p.symbol, p.prediction, p.target_value, p.timeframe_hours, p.created_at) directly into agent prompt strings and MCP tool calls without validation or sanitization. A malicious or corrupted prediction record in the SQLite DB could inject prompt instructions (prompt injection) into the learning-agent, causing it to execute unintended tool calls or exfiltrate data.
**Remediation**: Validate and sanitize all DB-sourced fields before interpolation. Use structured schemas (already defined as EXPIRED_SCHEMA) to enforce types, and escape or reject values containing prompt-injection patterns. Consider passing data as structured tool arguments rather than string interpolation.
**Evidence**:
```
Predicción [${p.id}] · ${p.symbol}
       Enunciado: "${p.prediction}"
```
**Depends On**: None | **Blocks**: None

### Priority 9: `code-unhandled-promise-4`
**Module**: code | **Severity**: high | **Effort**: S | **Confidence**: 0.8
**Location**: `.claude/workflows/close-learning.js:60`
**Description**: The pipeline() call evaluates predictions in parallel but the result is used without checking for rejected promises. The .filter(Boolean) pattern silently discards null/undefined results from failed agents, meaning promise rejections or agent failures are swallowed without logging or error propagation.
**Remediation**: Wrap the pipeline in try/catch or use Promise.allSettled semantics to capture both fulfilled and rejected results. Log rejected evaluations with their prediction IDs and error messages before filtering.
**Evidence**:
```
const verdicts = await pipeline(
  preds,
  (p) =>
    agent(...)
)

const done = verdicts.filter(Boolean)
```
**Depends On**: `flows-fire-and-forget-critical-1` | **Blocks**: None

### Priority 10: `flows-missing-error-handler-5`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/workflows/close-learning.js:78`
**Description**: The workflow lacks a global error handler. If Phase 1 (discovery) throws, the workflow returns early with a success-shaped object ({evaluated: 0, verdicts: [], report: '...'}) that is indistinguishable from a legitimate 'no expired predictions' result. Operators cannot tell the difference between 'nothing to do' and 'discovery failed'.
**Remediation**: Distinguish error states from empty states: return an explicit error field or throw on discovery failure. Add structured logging with error context so failures are visible in workflow execution logs.
**Evidence**:
```
if (!preds.length) {
  log('No hay predicciones expiradas pendientes. El loop ya está al día.')
  return { evaluated: 0, verdicts: [], report: 'Sin predicciones expiradas por validar.' }
}
```
**Depends On**: `flows-fire-and-forget-critical-1` | **Blocks**: None

### Priority 11: `flows-missing-timeout-6`
**Module**: flows | **Severity**: medium | **Effort**: M | **Confidence**: 0.65
**Location**: `.claude/workflows/close-learning.js:44`
**Description**: The workflow invokes external MCP tools (get_crypto_prices, fetch_ohlcv_data, find_expired_predictions) and LLM agents without any timeout configuration. If an MCP server hangs or an agent stalls, the workflow can block indefinitely, preventing the learning loop from completing and leaving predictions unvalidated.
**Remediation**: Set explicit timeouts on all MCP tool calls and agent invocations. Add a workflow-level timeout that aborts and reports partial results. Configure retry with exponential backoff for transient failures.
**Evidence**:
```
1. Usa get_crypto_prices() (crypto-data MCP) para obtener el precio actual
```
**Depends On**: None | **Blocks**: None

### Priority 12: `structure-config-logic-8`
**Module**: structure | **Severity**: medium | **Effort**: M | **Confidence**: 0.7
**Location**: `.claude/workflows/close-learning.js:44`
**Description**: Business logic (the list of tracked cryptocurrency symbols) is embedded directly in the workflow's agent prompt string rather than in a configuration file. This couples the learning workflow to a hardcoded symbol list, requiring code changes to add or remove tracked assets, and duplicates configuration that likely exists elsewhere in the system.
**Remediation**: Extract the symbol list to a configuration file (e.g., config/symbols.json or environment variable) and load it at workflow start. Reference the config in the prompt template rather than hardcoding.
**Evidence**:
```
(bitcoin, ethereum, solana, avalanche-2, aptos, chainlink, uniswap, aave, pendle, worldcoin, jito...)
```
**Depends On**: None | **Blocks**: None

### Priority 13: `cost-no-automated-tests-4`
**Module**: cost | **Severity**: high | **Effort**: M | **Confidence**: 0.65
**Location**: `.claude/workflows/close-learning.js:1`
**Description**: The learning workflow (close-learning.js) has no associated test file in the tests/ directory. The tests/ directory contains tests for MCP servers (test_crypto_*.py) but no tests for the workflow orchestration logic, meaning the learning loop's correctness (prediction discovery, evaluation, synthesis) is unverified and regressions go undetected.
**Remediation**: Add tests for the workflow logic: mock MCP tool responses and verify that expired predictions are discovered, evaluated, and that failures are handled correctly. Test the empty-state and error-state paths separately.
**Evidence**:
```
tests/ directory contains test_crypto_*.py but no test for .claude/workflows/close-learning.js
```
**Depends On**: None | **Blocks**: None

### Priority 14: `flows-missing-request-id-7`
**Module**: flows | **Severity**: low | **Effort**: S | **Confidence**: 0.6
**Location**: `.claude/workflows/close-learning.js:1`
**Description**: The workflow has no correlation ID or run identifier. Logs from different workflow executions cannot be correlated, making debugging of the learning loop difficult when multiple runs overlap or when tracing a specific prediction's validation across phases.
**Remediation**: Generate a unique run ID at workflow start and include it in all log messages and agent labels. Pass it to MCP tool calls where supported for end-to-end tracing.
**Evidence**:
```
export const meta = {
  name: 'close-learning',
```
**Depends On**: None | **Blocks**: None

---

## 30/60/90 Day Plan
### 30 Days
- `security-gha-secret-leak-3`: Redact or mask sensitive fields before interpolating DB records into agent prompts. (XS)
- `security-secret-in-code-1`: Move symbol lists and any configuration to environment variables or a config file loaded at runtime. (XS)
- `code-logs-secrets-10`: Redact sensitive fields before logging or interpolating into prompts. (XS)
- `security-gha-overpermissive-2`: Scope MCP server exposure per agent in each agent's frontmatter (mcpServers list) and remove the global mcpServers reference from plugin.json, or document an explicit allow-list. (XS)
- `flows-missing-idempotency-3`: Add an idempotency check: before calling validate_prediction(), verify the prediction is still in 'pending' status. (S)

### 60 Days
- `flows-fire-and-forget-critical-1`: Track failed evaluations explicitly: capture rejected promises, log failures with prediction IDs, and implement a retry or dead-letter queue for unvalidated predictions. (M)
- `flows-missing-dlq-2`: Implement a dead-letter mechanism: persist failed prediction IDs with error context to a separate table or file, and add a replay command. (M)
- `security-no-input-validation-14`: Validate and sanitize all DB-sourced fields before interpolation. (M)
- `code-unhandled-promise-4`: Wrap the pipeline in try/catch or use Promise.allSettled semantics to capture both fulfilled and rejected results. (S)
- `flows-missing-error-handler-5`: Distinguish error states from empty states: return an explicit error field or throw on discovery failure. (M)

### 90 Days
- `flows-missing-timeout-6`: Set explicit timeouts on all MCP tool calls and agent invocations. (M)
- `structure-config-logic-8`: Extract the symbol list to a configuration file (e.g., config/symbols.json or environment variable) and load it at workflow start. (M)
- `cost-no-automated-tests-4`: Add tests for the workflow logic: mock MCP tool responses and verify that expired predictions are discovered, evaluated, and that failures are handled correctly. (M)
- `flows-missing-request-id-7`: Generate a unique run ID at workflow start and include it in all log messages and agent labels. (S)

---

## Dependencies
- `flows-missing-dlq-2` **Depends On** `flows-fire-and-forget-critical-1` (blocks)
- `flows-missing-error-handler-5` **Depends On** `flows-fire-and-forget-critical-1` (blocks)
- `code-unhandled-promise-4` **Depends On** `flows-fire-and-forget-critical-1` (blocks)
- `flows-missing-idempotency-3` **Depends On** `flows-fire-and-forget-critical-1` (blocks)

---

## Appendix
- All findings in JSON: `assessment.json`
- Methodology: dontkillthevibes toolkit v0.1.0-beta
