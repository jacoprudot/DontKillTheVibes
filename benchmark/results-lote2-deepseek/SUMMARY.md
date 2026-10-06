# Lote 2 — deepseek-chat, ALL arms (A naive + B single-pass + C B2 orchestrator)

Model: deepseek-chat · digest 40000 chars · max_tokens 16384
Sample: 10 vibe-coded repos (documented 'built with Claude Code'), 6 languages.
Evidence: benchmark/results-lote2-deepseek (separate from shipped benchmark/results)
NOTE: judge = deepseek-chat self-judge; provisional until the local cross-judge step.

## jarvis-voice
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 37 findings | health: F | criticals: 7
- arm C: 59 findings | health: F | criticals: 4
- judge toolkit: 37 claims | real 1 | false 0 | unverif 36 | precision 100% | mech-grounded 2/37
- judge orchestrated: 59 claims | real 4 | false 8 | unverif 47 | precision 33% | mech-grounded 29/59

## eurekagent
- arms: toolkit:ok naive:ok orchestrated:FAIL
- arm B: 14 findings | health: F | criticals: 2
- arm C: 144 findings | health: F | criticals: 13
- judge toolkit: 14 claims | real 0 | false 0 | unverif 14 | precision n/a | mech-grounded 14/14
- judge orchestrated: 144 claims | real 0 | false 0 | unverif 144 | precision n/a | mech-grounded 41/144

## deutsia-radio
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 6 findings | health: D | criticals: 0
- arm C: 29 findings | health: F | criticals: 1
- judge toolkit: 6 claims | real 1 | false 1 | unverif 4 | precision 50% | mech-grounded 6/6
- judge orchestrated: 29 claims | real 2 | false 1 | unverif 26 | precision 67% | mech-grounded 19/29

## holo-gestures
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 14 findings | health: F | criticals: 1
- arm C: 39 findings | health: F | criticals: 5
- judge toolkit: 14 claims | real 0 | false 0 | unverif 14 | precision n/a | mech-grounded 0/14
- judge orchestrated: 39 claims | real 7 | false 1 | unverif 31 | precision 88% | mech-grounded 29/39

## ai-job-agent
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 12 findings | health: D | criticals: 0
- arm C: 57 findings | health: F | criticals: 4
- judge toolkit: 12 claims | real 7 | false 0 | unverif 5 | precision 100% | mech-grounded 12/12
- judge orchestrated: 57 claims | real 6 | false 0 | unverif 51 | precision 100% | mech-grounded 35/57

## agentgraphed
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 11 findings | health: D | criticals: 0
- arm C: 79 findings | health: F | criticals: 6
- judge toolkit: 11 claims | real 6 | false 0 | unverif 5 | precision 100% | mech-grounded 11/11
- judge orchestrated: 79 claims | real 9 | false 0 | unverif 70 | precision 100% | mech-grounded 79/79

## crypto-claude-desk
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 14 findings | health: F | criticals: 5
- arm C: 76 findings | health: F | criticals: 6
- judge toolkit: 14 claims | real 8 | false 3 | unverif 3 | precision 73% | mech-grounded 14/14
- judge orchestrated: 76 claims | real 0 | false 0 | unverif 76 | precision n/a | mech-grounded 50/76

## cyberpunk-hud
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 15 findings | health: F | criticals: 1
- arm C: 71 findings | health: F | criticals: 2
- judge toolkit: 15 claims | real 3 | false 0 | unverif 12 | precision 100% | mech-grounded 13/15
- judge orchestrated: 71 claims | real 14 | false 0 | unverif 57 | precision 100% | mech-grounded 36/71

## obs-airplay
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 14 findings | health: F | criticals: 1
- arm C: 50 findings | health: F | criticals: 4
- judge toolkit: 14 claims | real 9 | false 2 | unverif 3 | precision 82% | mech-grounded 14/14
- judge orchestrated: 50 claims | real 23 | false 4 | unverif 23 | precision 85% | mech-grounded 39/50

## aurora-synth
- arms: toolkit:ok naive:ok orchestrated:ok
- arm B: 6 findings | health: F | criticals: 1
- arm C: 28 findings | health: F | criticals: 1
- judge toolkit: 6 claims | real 0 | false 2 | unverif 4 | precision 0% | mech-grounded 2/6
- judge orchestrated: 28 claims | real 0 | false 0 | unverif 28 | precision n/a | mech-grounded 19/28

