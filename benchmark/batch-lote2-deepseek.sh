#!/usr/bin/env bash
# batch-lote2-deepseek.sh — Lote 2 benchmark batch: 10 vibe-coded/AI-built repos
# (all documented "built with Claude Code"), assessed by the DeepSeek API
# (deepseek-chat, OpenAI-compatible) with ALL THREE ARMS: A naive + B single-pass
# toolkit + C B2 orchestrator (8 specialist agents). Lote 1 ran A+B only; the
# owner asked for full-toolkit evidence (2026-10-05): stop measuring the cheap
# arm and measure the architecture.
#
# Paced on purpose (owner condition): COOLDOWN_SECS default 180s between targets
# so the local machine (digest, validation, clone) breathes. The GPU-heavy local
# cross-judge (qwen3.5:9b) is a separate step after this batch.
#
# Judge: deepseek-chat self-judge per target (same protocol as lote 1). Numbers
# are provisional by definition — the established cross-judge step (local
# qwen3.5:9b, results-lote1-crossjudge protocol) re-judges the disputed claims.
#
# Evidence goes to benchmark/results-lote2-deepseek/ (BENCH_RESULTS_DIR override),
# never to benchmark/results/ (shipped evidence). Resumable: run.mjs and judge.mjs
# skip existing outputs; re-run this script after an interruption.
#
# Key: read from DEEPSEEK_API_KEY in the usual env files (never printed, never
# stored — the harness reads it from the environment only).

set -u
set -o pipefail
cd "$(dirname "$0")/.."

MODEL="deepseek-chat"
BASE_URL="https://api.deepseek.com/v1"
RESULTS_SUB="benchmark/results-lote2-deepseek"
RESULTS_ABS="$(pwd -W 2>/dev/null || pwd)/$RESULTS_SUB"
RESULTS_ABS="${RESULTS_ABS//\\//}"
COOLDOWN_SECS="${COOLDOWN_SECS:-180}"
TARGETS="jarvis-voice eurekagent deutsia-radio holo-gestures ai-job-agent agentgraphed crypto-claude-desk cyberpunk-hud obs-airplay aurora-synth"

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

log "=== lote 2 (deepseek, ALL ARMS incl. B2 orchestrator) start ==="
log "model=$MODEL base=$BASE_URL digest_chars=$DIGEST_CONTEXT_CHARS max_tokens=$MAX_TOKENS cooldown=${COOLDOWN_SECS}s results=$RESULTS_SUB"

if [ "$MAX_TOKENS" -lt 4096 ]; then
  log "FATAL: MAX_TOKENS=$MAX_TOKENS too low for a full assessment document"
  exit 2
fi

LAST_TARGET="aurora-synth"
for target in $TARGETS; do
  log "--- target: $target ---"
  if node benchmark/run.mjs --only "$target" --arm-c 2>&1 | tee -a "$LOG"; then
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

  [ "$target" != "$LAST_TARGET" ] && { log "cooldown ${COOLDOWN_SECS}s"; sleep "$COOLDOWN_SECS"; }
done

log "=== batch complete — writing SUMMARY.md ==="
{
  echo "# Lote 2 — deepseek-chat, ALL arms (A naive + B single-pass + C B2 orchestrator)"
  echo
  echo "Model: $MODEL · digest $DIGEST_CONTEXT_CHARS chars · max_tokens $MAX_TOKENS"
  echo "Sample: 10 vibe-coded repos (documented 'built with Claude Code'), 6 languages."
  echo "Evidence: $RESULTS_SUB (separate from shipped benchmark/results)"
  echo "NOTE: judge = deepseek-chat self-judge; provisional until the local cross-judge step."
  echo
  for target in $TARGETS; do
    d="$RESULTS_SUB/$target"
    echo "## $target"
    node -e "
      const fs = require('fs');
      const meta = JSON.parse(fs.readFileSync('$d/meta.json', 'utf8'));
      const arms = meta.arms || {};
      console.log('- arms:', Object.entries(arms).map(([k,v]) => k + ':' + (v.ok?'ok':'FAIL')).join(' '));
    " 2>/dev/null || echo "- meta.json missing"
    if [ -f "$d/toolkit/assessment.json" ]; then
      node -e "
        const a = require('./$d/toolkit/assessment.json');
        console.log('- arm B:', a.findings.length, 'findings | health:', a.summary.overall_health, '| criticals:', a.summary.critical_count);
      " 2>/dev/null || echo "- assessment.json present (summary parse failed)"
    else
      echo "- NO arm B assessment"
    fi
    if [ -f "$d/orchestrated/assessment.json" ]; then
      node -e "
        const a = require('./$d/orchestrated/assessment.json');
        console.log('- arm C:', a.findings.length, 'findings | health:', a.summary.overall_health, '| criticals:', a.summary.critical_count);
      " 2>/dev/null || echo "- orchestrated/assessment.json present (summary parse failed)"
    else
      echo "- NO arm C assessment"
    fi
    if [ -f "$d/scores.json" ]; then
      node -e "
        const s = require('./$d/scores.json');
        for (const arm of ['toolkit', 'orchestrated']) {
          const k = s.summary_by_arm?.[arm];
          if (!k) continue;
          const prec = (k.real + k.falseCount) > 0 ? (100 * k.real / (k.real + k.falseCount)).toFixed(0) + '%' : 'n/a';
          console.log('- judge', arm + ':', k.claims ?? 0, 'claims | real', k.real ?? 0, '| false', k.falseCount ?? 0, '| unverif', k.unverifiable ?? 0, '| precision', prec, '| mech-grounded', (k.mechGrounded ?? 0) + '/' + (k.claims ?? 0));
        }
      " 2>/dev/null || echo "- scores.json present (parse failed)"
    else
      echo "- NO judge scores"
    fi
    echo
  done
} | tee "$RESULTS_SUB/SUMMARY.md" | tee -a "$LOG"
log "=== done ==="
