# Lote-2 cross-judge agreement (random sample, no selection bias)

Total acuerdo jueces: 117/144 (81%)
- toolkit: 53/72 (74%)
- orchestrated: 64/72 (89%)

## Disagreements (deepseek -> qwen3.5)
- jarvis-voice-s1 security-secret-in-history-2: deepseek=unverifiable -> qwen=real
- ai-job-agent-s1 security-gha-workspace-not-cleaned-6: deepseek=unverifiable -> qwen=real
- ai-job-agent-s1 security-gha-job-no-timeout-7: deepseek=real -> qwen=unverifiable
- ai-job-agent-s1 cost-gha-no-timeout-9: deepseek=real -> qwen=unverifiable
- ai-job-agent-s1 security-gha-no-container-8: deepseek=unverifiable -> qwen=real
- ai-job-agent-s2 security-gha-job-no-timeout-7: deepseek=real -> qwen=unverifiable
- agentgraphed-s2 security-gha-job-no-timeout-7: deepseek=real -> qwen=unverifiable
- agentgraphed-s2 security-missing-headers-10: deepseek=real -> qwen=unverifiable
- crypto-claude-desk-s1 flows-fire-and-forget-critical-1: deepseek=real -> qwen=unverifiable
- crypto-claude-desk-s1 security-gha-secret-leak-3: deepseek=false -> qwen=real
- crypto-claude-desk-s1 security-secret-in-code-1: deepseek=false -> qwen=unverifiable
- crypto-claude-desk-s1 flows-missing-idempotency-3: deepseek=real -> qwen=unverifiable
- cyberpunk-hud-s1 structure-config-logic-8: deepseek=real -> qwen=unverifiable
- obs-airplay-s1 code-print-statement-8: deepseek=false -> qwen=unverifiable
- obs-airplay-s1 security-weak-rng-10: deepseek=real -> qwen=unverifiable
- obs-airplay-s2 structure-service-sql-5: deepseek=real -> qwen=unverifiable
- aurora-synth-s1 security-env-file-committed-3: deepseek=false -> qwen=real
- aurora-synth-s1 security-secret-in-code-1: deepseek=false -> qwen=real
- agentgraphed-s1-x1: SIN scores (fallo)
- deutsia-radio-s1-x2 security-gha-action-unpinned-5: deepseek=false -> qwen=real
- deutsia-radio-s2-x2: SIN scores (fallo)
- eurekagent-s1-x1 code-generic-catch-2: deepseek=unverifiable -> qwen=real
- eurekagent-s1-x2 structure-controller-logic-6: deepseek=unverifiable -> qwen=real
- eurekagent-s1-x2 structure-dto-logic-7: deepseek=unverifiable -> qwen=real
- eurekagent-s1-x2 structure-config-logic-8: deepseek=unverifiable -> qwen=real
- holo-gestures-s2-x1 cost-license-share-alike-3: deepseek=real -> qwen=unverifiable
- holo-gestures-s2-x1 code-bare-except-1: deepseek=real -> qwen=unverifiable
- holo-gestures-s2-x2 cost-dev-setup-missing-3: deepseek=false -> qwen=real
- jarvis-voice-s2-x1: SIN scores (fallo)
- jarvis-voice-s2-x2 cost-api-no-client-rate-limit-4: deepseek=false -> qwen=unverifiable
