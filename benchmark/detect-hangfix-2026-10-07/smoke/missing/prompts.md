# Remediation prompts (C2) — one per finding, in report order

Generated deterministically from the rule registry — no LLM wrote these. Every prompt cites its rule. `probado` → direct fix prompt. Destructive actions (rotate/revoke/rewrite history) are flagged and must be confirmed by a human — never auto-executed. Only critical/high findings carry prompts (the rest live in the report appendix; a 555KB prompt file is a wall, not a plan).

⚠️ PARTIAL RUN: 1 rule(s) did not complete ((engine)). Prompts below cover the rules that finished only — do not read this file as the complete set of findings.

⚠️ COVERAGE CAVEAT: coverage could not be computed (the scan failed, or no non-binary file was in scope): an unknown scope is not evidence of health. 

