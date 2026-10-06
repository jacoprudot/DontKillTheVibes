#!/usr/bin/env bash
# crossjudge-lote1-9b.sh — Cross-judge the 28 DISPUTED lote-1 claims with a local,
# different-family model (qwen3.5:9b) to test whether the deepseek-chat self-judge's
# non-"real" verdicts (13 citation-mismatch + 12 severity disagreement + 3 ambiguous)
# survive a judge from another family. Lote-1 finding H5 context: cross-family judge
# calibration is mandatory before publishing precision (pilot finding H4).
#
# Only disputed claims are re-judged: the filtered copies in
# benchmark/results-lote1-crossjudge/ contain JUST those findings, so the runs are
# ~4x cheaper than re-judging all 44. The original results-lote1-deepseek/ evidence
# (deepseek-chat judge) stays untouched.
#
# Resumible: judge.mjs skips targets whose scores.json already exists (pass --force).
set -u
set -o pipefail
cd "$(dirname "$0")/.."

JUDGE_MODEL="qwen3.5:9b"
DST="benchmark/results-lote1-crossjudge"
# biggest batch first would give the worst-case timing early, but vegeta is also the
# most interesting (8/10 citation-mismatch claims) — same reasoning as the 27B script.
TARGETS="vegeta sinatra fatfree rich mini-redis"

export LLM_BASE_URL="http://localhost:11434/v1"
export LLM_API_KEY="ollama-local"
export LLM_JUDGE_MODEL="$JUDGE_MODEL"
# qwen3.5 is a thinking-hybrid (warmup answered with a "thinking" field): skip the
# thinking phase or stream:false risks dying on undici's no-bytes body timeout.
export LLM_JUDGE_NO_THINKING=1
export LLM_JUDGE_STREAM=1
export MAX_TOKENS="${MAX_TOKENS:-16384}"

mkdir -p "$DST"
LOG="$DST/crossjudge.log"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== lote-1 cross-judge start (disputed claims only) ==="
log "judge=$JUDGE_MODEL (cross-family vs deepseek-chat) copies in $DST"

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 && break
  sleep 2
done
if ! curl -sf http://localhost:11434/api/tags | grep -q "$JUDGE_MODEL"; then
  log "FATAL: $JUDGE_MODEL not in 'ollama list'"
  exit 2
fi

log "warming $JUDGE_MODEL (first load takes a few minutes) ..."
WARM="$(curl -sf -m 900 http://localhost:11434/api/generate -d "{\"model\":\"$JUDGE_MODEL\",\"prompt\":\"Reply with exactly: OK\",\"stream\":false}" 2>/dev/null | grep -o '"response":"[^"]*"' | head -c 40)"
if [ -z "$WARM" ]; then
  log "FATAL: warmup generation failed — model loaded but not answering"
  exit 2
fi
log "warmup OK ($WARM)"

for target in $TARGETS; do
  if [ -f "$DST/$target/scores.json" ]; then
    log "skip $target — already judged (delete scores.json or use --force to redo)"
    continue
  fi
  log "--- judging $target with $JUDGE_MODEL ---"
  if node benchmark/judge.mjs "$(pwd -W 2>/dev/null || pwd)/$DST/$target" --judge-model "$JUDGE_MODEL" 2>&1 | tee -a "$LOG"; then
    log "judge done: $target"
  else
    log "ERROR: judge failed for $target (rc=$?)"
  fi
  [ "$target" != "mini-redis" ] && { log "cooldown 30s"; sleep 30; }
done

log "=== cross-judge complete — writing SUMMARY.md ==="
{
  echo "# Lote-1 cross-judge — qwen3.5:9b (disputed claims)"
  echo
  echo "Same 28 disputed toolkit claims judged by deepseek-chat (self-judge) and"
  echo "qwen3.5:9b (cross-family). A disputed claim that flips to \"real\" under the"
  echo "cross-family judge was likely a self-judge blind spot; one that stays"
  echo "non-real under both is a genuine toolkit precision problem."
  echo
  for target in $TARGETS; do
    echo "## $target"
    node -e "
      const fs=require('fs');
      const deep=JSON.parse(fs.readFileSync('benchmark/results-lote1-deepseek/$target/scores.json','utf8'));
      const qw=JSON.parse(fs.readFileSync('benchmark/results-lote1-crossjudge/$target/scores.json','utf8'));
      const byId={};
      for (const c of deep.claims.filter(x=>x.arm==='toolkit')) byId[c.source_id]=c.judge?.verdict;
      const flips=[];
      for (const c of qw.claims.filter(x=>x.arm==='toolkit')) {
        const d=byId[c.source_id]||'?', q=c.judge?.verdict||'?';
        flips.push('- '+c.source_id+': deepseek='+d+' -> qwen3.5='+q+(d!==q?'  **FLIP**':''));
      }
      console.log(flips.join('\n'));
    " 2>/dev/null || echo "(scores missing for $target)"
    echo
  done
} | tee "$DST/SUMMARY.md" | tee -a "$LOG"
log "=== done ==="
