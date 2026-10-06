# Cross-judge calibration — qwen3.8:27b vs qwen2.5-coder:7b

Same claims, two judges. Compare per-arm precision and, critically,
per-claim verdict flips (7B judge -> 27B judge).

## roomgpt
- 7B judge toolkit: 2 claims | real 2 | false 0 | unverif 0 | precision 100% | mech-grounded 2/2
- 27B judge toolkit: 2 claims | real 0 | false 1 | unverif 1 | precision 0% | mech-grounded 2/2

## realworld-control
- 7B judge toolkit: 2 claims | real 0 | false 0 | unverif 2 | precision n/a | mech-grounded 0/2
- 27B judge toolkit: 2 claims | real 0 | false 0 | unverif 2 | precision n/a | mech-grounded 0/2

## chatbot-ui
- 7B judge toolkit: 2 claims | real 2 | false 0 | unverif 0 | precision 100% | mech-grounded 2/2
- 27B judge toolkit: 2 claims | real 0 | false 0 | unverif 2 | precision n/a | mech-grounded 2/2

