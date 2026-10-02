## What this changes

## Why

## Checklist
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (the 80% coverage gate is enforced)
- [ ] `pnpm security:audit` passes
- [ ] `pnpm validate:skills` and `pnpm validate:mcps` pass
- [ ] `node scripts/validate-assessment.mjs examples/realworld-assessment/assessment.json` passes
- [ ] If I added a finding rule, its `→ FINDING:` id is unique and every example uses canonical ids
- [ ] If I touched an MCP tool, I introduced no `shell: true` / `execSync` / `...process.env`
- [ ] Docs updated (README, `templates/`, or the relevant `SECURITY.md`)
