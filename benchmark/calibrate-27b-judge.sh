#!/usr/bin/env bash
# calibrate-27b-judge.sh — Cross-judge calibration: re-judge pilot claims with a
# BIGGER, different-family local model (qwen3.8:27b) to test judge/evaluatee
# blind spots (pilot finding H4: a 7B Qwen judge called a .example.env "critical"
# real — same-family blind spot suspected).
#
# Evidence safety: judge.mjs writes scores.json into the results dir it is given
# and has no output-dir flag, so this script COPIES the per-target evidence into
# benchmark/results-calibrate-27b/ and judges the copies. The original
# benchmark/results-local-qwen/ scores (qwen2.5-coder:7b judge) stay untouched.
#
# Resumable: judge.mjs skips targets whose scores.json already exists (pass
# --force to redo). Re-run this script freely after an interruption.
#
# Order matters: roomgpt FIRST — it holds the H4 claim and is the smallest set
# (10 claims), so the first timing numbers arrive early and scope can be
# re-decided without wasting 27B minutes.

set -u
cd "$(dirname "$0")/.."

JUDGE_MODEL="qwen3.8:27b"
SRC="benchmark/results-local-qwen"
DST="benchmark/results-calibrate-27b"
# roomgpt first (H4 + smallest), then control (has known hallucinated citations:
# will the bigger judge call them false instead of unverifiable?), then chatbot-ui.
TARGETS="roomgpt realworld-control chatbot-ui"

export LLM_BASE_URL="http://localhost:11434/v1"
export LLM_API_KEY="ollama-local"
export LLM_JUDGE_MODEL="$JUDGE_MODEL"
# qwen3.8 is a thinking-hybrid: without this it reasons for thousands of tokens
# and stream:false dies on undici's ~300s no-bytes body timeout ("fetch failed"
# after minutes of real work). judge.mjs gates this behind the env var.
export LLM_JUDGE_NO_THINKING=1
# stream:false dies on undici's 300s HEADERS timeout with slow local endpoints
# (UND_ERR_HEADERS_TIMEOUT, reproduced 2026-10-05) — SSE streaming fixes it.
export LLM_JUDGE_STREAM=1
export MAX_TOKENS="${MAX_TOKENS:-16384}"

mkdir -p "$DST"
LOG="$DST/calibrate.log"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== 27B cross-judge calibration start ==="
log "judge=$JUDGE_MODEL source=$SRC (untouched) copies in $DST"

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 && break
  sleep 2
done
if ! curl -sf http://localhost:11434/api/tags | grep -q "$JUDGE_MODEL"; then
  log "FATAL: $JUDGE_MODEL not in 'ollama list'"
  exit 2
fi
log "preflight OK — model present, daemon up"

# Warm the judge model BEFORE the first real call: loading 19GB takes minutes
# and a request arriving mid-load gets connection failures (seen in the first
# calibration attempt). One tiny generation blocks until the load completes.
log "warming $JUDGE_MODEL (first load takes a few minutes) ..."
WARM="$(curl -sf -m 600 http://localhost:11434/api/generate -d "{\"model\":\"$JUDGE_MODEL\",\"prompt\":\"Reply with exactly: OK\",\"stream\":false}" 2>/dev/null | grep -o '"response":"[^"]*"' | head -c 40)"
if [ -z "$WARM" ]; then
  log "FATAL: warmup generation failed — model loaded but not answering"
  exit 2
fi
log "warmup OK ($WARM) — model resident, judging will not race the load"

for target in $TARGETS; do
  if [ -f "$DST/$target/scores.json" ]; then
    log "skip $target — already judged (scores.json exists; delete it or use --force to redo)"
    continue
  fi
  log "--- copying evidence: $target ---"
  mkdir -p "$DST/$target"
  for f in naive.md digest.json meta.json mapping.json; do
    [ -f "$SRC/$target/$f" ] && cp "$SRC/$target/$f" "$DST/$target/"
  done
  [ -d "$SRC/$target/toolkit" ] && cp -r "$SRC/$target/toolkit" "$DST/$target/"

  log "--- judging $target with $JUDGE_MODEL ---"
  if node benchmark/judge.mjs "$(pwd -W 2>/dev/null || pwd)/$DST/$target" --judge-model "$JUDGE_MODEL" 2>&1 | tee -a "$LOG"; then
    log "judge done: $target"
  else
    log "ERROR: judge failed for $target (rc=$?)"
  fi
  [ "$target" != "chatbot-ui" ] && { log "cooldown 60s"; sleep 60; }
done

log "=== calibration complete — writing SUMMARY.md ==="
{
  echo "# Cross-judge calibration — qwen3.8:27b vs qwen2.5-coder:7b"
  echo
  echo "Same claims, two judges. Compare per-arm precision and, critically,"
  echo "per-claim verdict flips (7B judge -> 27B judge)."
  echo
  for target in $TARGETS; do
    echo "## $target"
    for judge in "$SRC" "$DST"; do
      label="7B"; [ "$judge" = "$DST" ] && label="27B"
      node -e "
        const s=require('./$judge/$target/scores.json');
        const k=s.summary_by_arm.toolkit||{};
        const prec=(k.real+k.falseCount)>0 ? (100*k.real/(k.real+k.falseCount)).toFixed(0)+'%' : 'n/a';
        console.log('- $label judge toolkit:', k.claims??0, 'claims | real', k.real??0, '| false', k.falseCount??0, '| unverif', k.unverifiable??0, '| precision', prec, '| mech-grounded', (k.mechGrounded??0)+'/'+(k.claims??0));
      " 2>/dev/null || echo "- $label judge: no scores"
    done
    echo
  done
} | tee "$DST/SUMMARY.md" | tee -a "$LOG"
log "=== done ==="
