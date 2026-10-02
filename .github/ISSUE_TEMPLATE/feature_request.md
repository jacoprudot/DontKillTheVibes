---
name: Feature request
about: Suggest a new skill, rule, MCP tool or integration
title: "[feature] "
labels: enhancement
---

## Problem
What can't you assess today?

## Proposal

## Where it belongs
- [ ] New skill (`skills/*.skill.md`)
- [ ] New rule in an existing decision tree
- [ ] New MCP tool
- [ ] Docs

## Notes for a new rule
Rules must define an explicit threshold and carry a canonical finding id of the form
`→ FINDING: <module>-<category>-<n>`. The id must not collide with an existing one —
run `pnpm validate:skills` and see the id conventions in `templates/SKILL_TEMPLATE.md`.
