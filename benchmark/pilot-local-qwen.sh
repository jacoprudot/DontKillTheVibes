#!/usr/bin/env bash
# pilot-local-qwen.sh — Local-only pilot: qwen2.5-coder:7b via Ollama on the 5
# shipped benchmark targets (realworld-control + the 4 vibe-coding targets).
#
# Purpose: robustness data point, not headline numbers. Measures whether a 7B
# local model can produce output that validates against the contract, and what
# the judge (same model, local) thinks of its claims. Zero API cost.
#
# Evidence goes to benchmark/results-local-qwen/ (BENCH_RESULTS_DIR override),
# NEVER to benchmark/results/ (shipped evidence). Resumable: run.mjs and
# judge.mjs skip work whose output already exists — re-run this script after an
# interruption and it continues where it stopped.
#
# Prerequisites (done by the session before launch):
#   - ollama serve running with OLLAMA_CONTEXT_LENGTH=49152,
#     OLLAMA_KV_CACHE_TYPE=q8_0, OLLAMA_KEEP_ALIVE=2m (see pilot-ollama-serve.sh)
#   - model qwen2.5-coder:7b present (ollama list)
#
# Pacing: sequential targets, COOLDOWN_SECS pause between targets so the laptop
# cools. Keep the machine plugged in and prevent sleep — a suspended laptop
# kills this run.

set -u
cd "$(dirname "$0")/.."

MODEL="qwen2.5-coder:7b"
BASE_URL="http://localhost:11434/v1"
RESULTS_SUB="benchmark/results-local-qwen"
RESULTS_ABS="$(pwd -W 2>/dev/null || pwd)/$RESULTS_SUB"
RESULTS_ABS="${RESULTS_ABS//\\//}"
COOLDOWN_SECS="${COOLDOWN_SECS:-300}"
TARGETS="realworld-control roomgpt screenshot-to-code llamacoder chatbot-ui"

export LLM_BASE_URL="$BASE_URL"
export LLM_API_KEY="ollama-local"          # never leaves the machine; Ollama ignores it
export LLM_MODEL="$MODEL"
export LLM_JUDGE_MODEL="$MODEL"
export DIGEST_CONTEXT_CHARS="${DIGEST_CONTEXT_CHARS:-20000}"
export MAX_TOKENS="${MAX_TOKENS:-16384}"
export BENCH_RESULTS_DIR="$RESULTS_SUB"

mkdir -p "$RESULTS_SUB"
LOG="$RESULTS_SUB/pilot.log"

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== pilot start ==="
log "model=$MODEL base=$BASE_URL digest_chars=$DIGEST_CONTEXT_CHARS max_tokens=$MAX_TOKENS results=$RESULTS_SUB"

# ---- preflight: daemon up, model present, one smoke generation ----
if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
  log "FATAL: ollama daemon not reachable at :11434 — start it with pilot-ollama-serve.sh first"
  exit 2
fi
if ! curl -sf http://localhost:11434/api/tags | grep -q "$MODEL"; then
  log "FATAL: model $MODEL not found in 'ollama list' — pull it first"
  exit 2
fi
SMOKE="$(curl -sf http://localhost:11434/api/generate -d "{\"model\":\"$MODEL\",\"prompt\":\"Reply with exactly: OK\",\"stream\":false}" 2>/dev/null | grep -o '"response":"[^"]*"' | head -c 80)"
if [ -z "$SMOKE" ]; then
  log "FATAL: smoke generation failed — daemon up but model not answering"
  exit 2
fi
log "preflight OK (smoke: $SMOKE)"

# ---- main loop ----
for target in $TARGETS; do
  log "--- target: $target ---"
  if node benchmark/run.mjs --only "$target" 2>&1 | tee -a "$LOG"; then
    log "run.mjs done: $target"
  else
    log "ERROR: run.mjs failed for $target (continuing with next target)"
  fi

  if [ -f "$RESULTS_SUB/$target/toolkit/assessment.json" ]; then
    if node benchmark/judge.mjs "$RESULTS_ABS/$target" --judge-model "$MODEL" 2>&1 | tee -a "$LOG"; then
      log "judge done: $target"
    else
      log "ERROR: judge failed for $target"
    fi
  else
    log "skip judge: no toolkit assessment for $target"
  fi

  # cooldown between targets (skip after the last one)
  if [ "$target" != "chatbot-ui" ]; then
    log "cooldown ${COOLDOWN_SECS}s"
    sleep "$COOLDOWN_SECS"
  fi
done

# ---- summary ----
log "=== pilot complete — writing SUMMARY.md ==="
{
  echo "# Local pilot — qwen2.5-coder:7b (Ollama)"
  echo
  echo "Model: $MODEL · digest $DIGEST_CONTEXT_CHARS chars · max_tokens $MAX_TOKENS"
  echo "Evidence: $RESULTS_SUB (separate from shipped benchmark/results)"
  echo
  for target in $TARGETS; do
    d="$RESULTS_SUB/$target"
    echo "## $target"
    if [ -f "$d/toolkit/assessment.json" ]; then
      node -e "
        const a = require('./$d/toolkit/assessment.json');
        console.log('- findings:', a.findings.length, '| overall_health:', a.summary.overall_health, '| criticals:', a.summary.critical_count);
      " 2>/dev/null || echo "- assessment.json present (summary parse failed)"
    else
      echo "- NO toolkit assessment"
    fi
    if [ -f "$d/scores.json" ]; then
      node -e "
        const s = require('./$d/scores.json');
        const j = s.judge || s;
        console.log('- judge:', JSON.stringify(j).slice(0, 300));
      " 2>/dev/null || echo "- scores.json present (parse failed)"
    else
      echo "- NO judge scores"
    fi
    echo
  done
} | tee "$RESULTS_SUB/SUMMARY.md" | tee -a "$LOG"
log "=== done ==="
