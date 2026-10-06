#!/usr/bin/env bash
# crossjudge-lote2-9b.sh — Lote 2 cross-judge with the selection-bias fix
# (VALIDATION-REPORT rev.2, correction Q4): qwen3.5:9b judges a SEEDED RANDOM
# STRATIFIED SAMPLE (8 claims per repo x arm) instead of only the self-judge's
# rejects. DeepSeek already judged all claims, so the same sampled claims carry
# BOTH verdicts -> judge agreement is measurable without selection on the
# dependent variable. Sampling plan: results-lote2-crossjudge/sampling-plan.json
# (reproducible: seeded RNG, sort by source_id).
#
# Paced (owner condition): 45s cooldown between batches, 90s every 5 batches.
# Local 9B on the tuned daemon (ctx 16384, KV q4, ~27 t/s). Resumible:
# judge.mjs skips dirs whose scores.json exists.
set -u
set -o pipefail
cd "$(dirname "$0")/.."

JUDGE_MODEL="qwen3.5:9b"
DST="benchmark/results-lote2-crossjudge"
export LLM_BASE_URL="http://localhost:11434/v1"
export LLM_API_KEY="ollama-local"
export LLM_JUDGE_MODEL="$JUDGE_MODEL"
export LLM_JUDGE_NO_THINKING=1
export LLM_JUDGE_STREAM=1
export MAX_TOKENS="${MAX_TOKENS:-16384}"

mkdir -p "$DST"
LOG="$DST/crossjudge.log"
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== lote-2 cross-judge start (random sample, selection-bias fixed) ==="
log "judge=$JUDGE_MODEL batches=$(ls -d "$DST"/*/ 2>/dev/null | wc -l)"

for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf http://localhost:11434/api/tags > /dev/null 2>&1 && break
  sleep 2
done
if ! curl -sf http://localhost:11434/api/tags | grep -q "$JUDGE_MODEL"; then
  log "FATAL: $JUDGE_MODEL not in 'ollama list'"
  exit 2
fi

log "warming $JUDGE_MODEL ..."
WARM="$(curl -sf -m 900 http://localhost:11434/api/generate -d "{\"model\":\"$JUDGE_MODEL\",\"prompt\":\"Reply with exactly: OK\",\"stream\":false}" 2>/dev/null | grep -o '"response":"[^"]*"' | head -c 40)"
[ -z "$WARM" ] && { log "FATAL: warmup failed"; exit 2; }
log "warmup OK ($WARM)"

n=0
for dir in "$DST"/*/; do
  target=$(basename "$dir")
  case "$target" in *.*) continue;; esac
  [ -f "$dir/scores.json" ] && { log "skip $target — already judged"; continue; }
  n=$((n+1))
  log "--- judging $target ---"
  if node benchmark/judge.mjs "$(pwd -W 2>/dev/null || pwd)/$DST/$target" --judge-model "$JUDGE_MODEL" 2>&1 | tee -a "$LOG"; then
    log "judge done: $target"
  else
    log "ERROR: judge failed for $target (rc=$?)"
  fi
  sleep 45
  [ $((n % 5)) -eq 0 ] && { log "extra cooldown 90s (batch $n)"; sleep 90; }
done

log "=== cross-judge complete — writing AGREEMENT summary ==="
node -e "
  const fs=require('fs');
  const plan=JSON.parse(fs.readFileSync('$DST/sampling-plan.json','utf8'));
  const agree={total:0,agree:0};
  const byArm={toolkit:{total:0,agree:0},orchestrated:{total:0,agree:0}};
  const flips=[];
  for (const [batch,p] of Object.entries(plan)) {
    const f='$DST/'+batch+'/scores.json';
    if (!fs.existsSync(f)) { flips.push('- '+batch+': SIN scores (fallo)'); continue; }
    const s=JSON.parse(fs.readFileSync(f,'utf8'));
    for (const c of s.claims) {
      const dv=p.deepseek_verdicts[c.source_id], qv=c.judge?.verdict;
      if (!dv||!qv) continue;
      agree.total++; byArm[p.arm].total++;
      if (dv===qv) { agree.agree++; byArm[p.arm].agree++; }
      else flips.push('- '+batch+' '+c.source_id+': deepseek='+dv+' -> qwen='+qv);
    }
  }
  console.log('# Lote-2 cross-judge agreement (random sample, no selection bias)');
  console.log('');
  console.log('Total acuerdo jueces:', agree.agree+'/'+agree.total, '('+Math.round(100*agree.agree/agree.total)+'%)');
  for (const [arm,a] of Object.entries(byArm)) console.log('- '+arm+':', a.agree+'/'+a.total, '('+Math.round(100*a.agree/a.total)+'%)');
  console.log('');
  console.log('## Disagreements (deepseek -> qwen3.5)');
  console.log(flips.join('\n'));
" | tee "$DST/AGREEMENT.md" | tee -a "$LOG"
log "=== done ==="
