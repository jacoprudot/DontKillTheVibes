# Remediation prompts (C2) — one per finding, in report order

Generated deterministically from the rule registry — no LLM wrote these. Every prompt cites its rule. `probado` → direct fix prompt. Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).

⚠️ COVERAGE CAVEAT: coverage could not be computed (the scan failed, or no non-binary file was in scope): an unknown scope is not evidence of health. 0 file(s) are matched by no rule path-glob (listed in findings.json `coverage.uncovered_files`).

