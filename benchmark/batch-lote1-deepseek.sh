#!/usr/bin/env bash
# batch-lote1-deepseek.sh — Lote 1 benchmark batch: 6 new-language repos assessed
# by the DeepSeek API (deepseek-chat, OpenAI-compatible), arms A+B + blind judge.
#
# Why DeepSeek here: cheap enough for batches (~<$1 for the whole lote), fast
# (no reasoning tokens), 128k context fits the 46k-token prompt. Judge = the same
# model (self-judge) for speed — cross-judge against the local 27B remains the
# separate calibration step (protocol established 2026-10-05: 7B vs 27B judges
# disagreed on 2/3 targets, so self-judge numbers are provisional until then).
#
# Evidence goes to benchmark/results-lote1-deepseek/ (BENCH_RESULTS_DIR override),
# never to benchmark/results/ (shipped evidence). Resumable: run.mjs and judge.mjs
# skip existing outputs; re-run this script after an interruption.
#
# Key: read from DEEPSEEK_API_KEY in the usual env files (never printed, never
# stored — the harness reads it from the environment only).

set -u
cd "$(dirname "$0")/.."

MODEL="deepseek-chat"
BASE_URL="https://api.deepseek.com/v1"
RESULTS_SUB="benchmark/results-lote1-deepseek"
RESULTS_ABS="$(pwd -W 2>/dev/null || pwd)/$RESULTS_SUB"
RESULTS_ABS="${RESULTS_ABS//\\//}"
COOLDOWN_SECS="${COOLDOWN_SECS:-120}"
TARGETS="mini-redis vegeta sinatra httpx fatfree rich"

# Key from the usual env files (existence checked, value never printed).
for f in "$HOME/.config/opencode/.env" "$HOME/.env" ".env"; do
  [ -f "$f" ] && { set -a; . "$f" 2>/dev/null; set +a; }
done
if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "FATAL: DEEPSEEK_API_KEY not found in env files. Export it and re-run."
  exit 2
fi

export LLM_BASE_URL="$BASE_URL"
export LLM_API_KEY="$DEEPSEEK_API_KEY"
export LLM_MODEL="$MODEL"
export LLM_JUDGE_MODEL="$MODEL"
export DIGEST_CONTEXT_CHARS="${DIGEST_CONTEXT_CHARS:-40000}"
export MAX_TOKENS="${MAX_TOKENS:-16384}"
export BENCH_RESULTS_DIR="$RESULTS_SUB"

mkdir -p "$RESULTS_SUB"
LOG="$RESULTS_SUB/batch.log"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== lote 1 (deepseek) start ==="
log "model=$MODEL base=$BASE_URL digest_chars=$DIGEST_CONTEXT_CHARS max_tokens=$MAX_TOKENS results=$RESULTS_SUB"

# Budget sanity: refuse to start with a wildly low max_tokens for this model.
if [ "$MAX_TOKENS" -lt 4096 ]; then
  log "FATAL: MAX_TOKENS=$MAX_TOKENS too low for a full assessment document"
  exit 2
fi

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

  [ "$target" != "rich" ] && { log "cooldown ${COOLDOWN_SECS}s"; sleep "$COOLDOWN_SECS"; }
done

log "=== batch complete — writing SUMMARY.md ==="
{
  echo "# Lote 1 — deepseek-chat (DeepSeek API)"
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
        console.log('- findings:', a.findings.length, '| overall_health:', a.summary.overall_health, '| criticals:', a.summary.critical_count, '| llm:', a.metadata.llm_used);
      " 2>/dev/null || echo "- assessment.json present (summary parse failed)"
    else
      echo "- NO toolkit assessment"
    fi
    if [ -f "$d/scores.json" ]; then
      node -e "
        const s = require('./$d/scores.json');
        const k = s.summary_by_arm?.toolkit || {};
        const prec = (k.real + k.falseCount) > 0 ? (100 * k.real / (k.real + k.falseCount)).toFixed(0) + '%' : 'n/a';
        console.log('- judge toolkit:', k.claims ?? 0, 'claims | real', k.real ?? 0, '| false', k.falseCount ?? 0, '| unverif', k.unverifiable ?? 0, '| precision', prec, '| mech-grounded', (k.mechGrounded ?? 0) + '/' + (k.claims ?? 0));
      " 2>/dev/null || echo "- scores.json present (parse failed)"
    else
      echo "- NO judge scores"
    fi
    echo
  done
} | tee "$RESULTS_SUB/SUMMARY.md" | tee -a "$LOG"
log "=== done ==="
