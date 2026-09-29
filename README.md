# dontkillthevibes

LLM-orchestrated assessment toolkit for vibe coders.

## Overview

This toolkit provides a set of skills, MCPs (Model Context Protocol servers), and agent definitions that enable LLMs to assess codebases and generate actionable work plans. The toolkit is designed to be LLM-agnostic and works with any LLM system that supports tool use.

## Features

- **Skills**: Analysis capabilities for database, code, structure, flows, GitHub intelligence, security, cost, and performance
- **MCPs**: Secure data access layers for git and benchmarking (with official servers for GitHub and filesystem)
- **Agents**: Pre-built analyst roles that combine skills and MCPs for specific assessment tasks
- **Synthesis Agent**: Orchestrates all findings into prioritized work plans with effort estimates and dependencies
- **Security**: Built-in security controls to prevent data exfiltration and unauthorized access
- **Extensibility**: Designed for community contributions with clear templates and guidelines

## Getting Started

See the [30-Second Start](#30-second-start) section below for quick setup instructions.

## Philosophy

This toolkit embodies the "dontkillthevibes" philosophy: provide powerful assessment capabilities that help developers maintain their creative flow while improving code quality, security, and performance.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.