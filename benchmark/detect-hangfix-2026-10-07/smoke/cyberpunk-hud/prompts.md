# Remediation prompts (C2) — one per finding, in report order

Generated deterministically from the rule registry — no LLM wrote these. Every prompt cites its rule. `probado` → direct fix prompt. Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).

⚠️ COVERAGE CAVEAT: 19 of 25 non-binary files are matched by no rule path-glob (76%): A/B would assert health over code no rule examined, so the letter is capped at C. 19 file(s) are matched by no rule path-glob (listed in findings.json `coverage.uncovered_files`).

