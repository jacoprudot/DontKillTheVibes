# Contributing to dontkillthevibes

Thank you for considering contributing to the dontkillthevibes toolkit! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

Please use the [issue template](.github/ISSUE_TEMPLATE/bug_report.md) to report bugs. Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)

### Suggesting Features

Please use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) to suggest new features or improvements.

### Submitting Code Changes

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Ensure your code follows our coding standards
5. Add or update tests as needed
6. Submit a pull request using the [pull request template](.github/PULL_REQUEST_TEMPLATE.md)

## Coding Standards

### Skills
- Follow the [SKILL_TEMPLATE.md](templates/SKILL_TEMPLATE.md) format
- Include clear decision trees with actionable findings
- Provide comprehensive examples
- Ensure all outputs conform to the finding-schema.json
- Add appropriate module and version information

## Rule changes

The `→ FINDING:` lines in `skills/*.skill.md` are the canonical rule registry, and every id
in it is public API: shipped assessments cite those ids, and `scripts/validate-assessment.mjs`
resolves them here. Changes are governed — see [skills/CHANGELOG.md](skills/CHANGELOG.md)
for the history and the record format.

### Adding a rule
1. Add the line to the right decision tree, in the right module's skill file:
   `   → FINDING: module-thing-7 (severity: high, effort: M)`
2. Use a unique id matching `^[a-z][a-z0-9]*(-[a-z0-9]+)*-\d+$` and put it in exactly one
   place. A duplicated id is a hard failure: `loadRules` silently keeps the last one, so the
   two copies would disagree about severity/effort/scope.
3. Run `pnpm validate:skills` (frontmatter, id shape, duplicate ids) and
   `node scripts/registry-diff.mjs` (fingerprint + changelog gate).
4. Record the change in `skills/CHANGELOG.md` with the new fingerprint (see below).

### Changing severity or effort
Severity and effort are properties of the rule and are stamped onto findings from there, so
changing them changes scores and work plans of every future report. Edit the value on the
rule's own line and record the change — `node scripts/registry-diff.mjs` prints it as
`CHANGED (id: severity a->b, effort a->b)`.

### Deprecating a rule
Never delete a `→ FINDING:` line: a deleted id breaks every assessment that already cites it.
Retire the rule by marking it on the same line:

```text
   → FINDING: old-rule-1 (severity: high, effort: M) [deprecated -> new-rule-2]
   → FINDING: old-rule-2 (severity: low, effort: S) [deprecated]
```

- The rule STAYS in the registry, so old reports keep resolving its id.
- `[deprecated -> new-rule-2]` names the replacement; `[deprecated]` alone is valid when
  nothing replaces it.
- `scripts/validate-assessment.mjs` warns (never errors) on a document citing a deprecated
  rule: `WARN: <where>: rule "<id>" is deprecated (superseded by <x>) — prefer the replacement`.
- `node scripts/registry-diff.mjs` treats a deprecated removal as declared and refuses a
  raw one with exit 1.

### Recording a ruleset change (required)
Every change to the registry must be recorded in [skills/CHANGELOG.md](skills/CHANGELOG.md),
newest entry first, with the **fingerprint of the new ruleset** written verbatim in the
entry. The fingerprint is `"<rule count>-<8 hex>"`, computed by `rulesetFingerprint()` in
`scripts/lib/canonical-registry.mjs` over every `id|severity|effort` (sorted ids, newline
joined). Get the current value with:

```bash
node -e "import('./scripts/lib/canonical-registry.mjs').then(m=>console.log(m.rulesetFingerprint(m.loadRules('skills'))))"
```

### CI
`pnpm validate:skills` and `node scripts/registry-diff.mjs` both run in CI, alongside the
shipped-example validation. A ruleset change whose new fingerprint is not in
`skills/CHANGELOG.md` fails the build, and so does removing an id without deprecating it.

### MCPs
- Follow the [MCP_TEMPLATE.md](templates/MCP_TEMPLATE.md) format
- Implement all required security controls (path allowlisting, command allowlisting, resource limits, audit logging)
- Provide comprehensive documentation
- Include unit tests for all tools
- Follow MCP stdio transport protocol

### Documentation
- Keep documentation up to date with code changes
- Write clear, concise explanations
- Include examples where helpful
- Follow the existing documentation style

## Development Process

1. Fork the repo and clone locally
2. Install dependencies: `pnpm install`
3. Create feature branch: `git checkout -b feature/amazing-feature`
4. Make changes
5. Build: `pnpm build` — Validate skills: `pnpm validate:skills` — Run tests: `pnpm test`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open pull request

## Pull Request Process

1. Update README.md if needed with new features
2. Update documentation as required
3. The pull request will be reviewed by maintainers
4. Address any feedback from reviewers
5. Once approved, maintainers will merge the PR

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project, you agree to abide by its terms.

## Getting Help

If you need help, please:
1. Check the existing documentation
2. Search existing issues
3. Ask in the project discussions
4. As a last resort, open a new issue

Thank you again for contributing to dontkillthevibes!