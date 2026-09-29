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