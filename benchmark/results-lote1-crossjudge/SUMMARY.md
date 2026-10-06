# Lote-1 cross-judge — qwen3.5:9b (disputed claims)

Same 28 disputed toolkit claims judged by deepseek-chat (self-judge) and
qwen3.5:9b (cross-family). A disputed claim that flips to "real" under the
cross-family judge was likely a self-judge blind spot; one that stays
non-real under both is a genuine toolkit precision problem.

## vegeta
- code-error-assigned-unused-2: deepseek=unverifiable -> qwen3.5=false  **FLIP**
- cost-gha-no-dependency-cache-5: deepseek=unverifiable -> qwen3.5=real  **FLIP**
- cost-gha-matrix-inefficient-10: deepseek=unverifiable -> qwen3.5=unverifiable
- security-gha-secret-leak-3: deepseek=unverifiable -> qwen3.5=unverifiable
- security-gha-auto-deploy-prod-9: deepseek=unverifiable -> qwen3.5=real  **FLIP**
- code-unchecked-error-1: deepseek=unverifiable -> qwen3.5=unverifiable
- security-gha-overpermissive-2: deepseek=unverifiable -> qwen3.5=real  **FLIP**
- security-gha-job-no-timeout-7: deepseek=unverifiable -> qwen3.5=real  **FLIP**
- code-ignores-return-value-6: deepseek=unverifiable -> qwen3.5=unverifiable

## sinatra
- github-commit-history-2: deepseek=false -> qwen3.5=real  **FLIP**
- cost-gha-no-dependency-cache-5: deepseek=false -> qwen3.5=real  **FLIP**
- cost-gha-always-on-8: deepseek=false -> qwen3.5=real  **FLIP**
- security-gha-fork-pr-4: deepseek=false -> qwen3.5=real  **FLIP**
- security-gha-auto-deploy-prod-9: deepseek=false -> qwen3.5=real  **FLIP**
- security-gha-no-concurrency-prod-10: deepseek=false -> qwen3.5=real  **FLIP**
- security-gha-overpermissive-2: deepseek=false -> qwen3.5=real  **FLIP**
- security-gha-action-unpinned-5: deepseek=false -> qwen3.5=real  **FLIP**

## fatfree
- cost-no-http-compression-9: deepseek=false -> qwen3.5=real  **FLIP**
- security-missing-headers-10: deepseek=false -> qwen3.5=real  **FLIP**
- cost-gha-no-dependency-cache-5: deepseek=false -> qwen3.5=real  **FLIP**
- structure-layer-violation-1: deepseek=false -> qwen3.5=unverifiable  **FLIP**
- flows-missing-rate-limit-8: deepseek=false -> qwen3.5=unverifiable  **FLIP**
- flows-missing-error-handler-5: deepseek=false -> qwen3.5=real  **FLIP**

## rich
(scores missing for rich)

## mini-redis
- flows-missing-error-handler-5: deepseek=unverifiable -> qwen3.5=unverifiable

