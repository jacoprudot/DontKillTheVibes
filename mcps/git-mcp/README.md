# Git MCP Server

Provides secure tools for git repository access including:
- Blame analysis
- Diff since commit
- Branch tree
- Large file detection

## Tools

- `get_blame` - Get blame information for a file
- `get_diff_since` - Get changes since a specific commit
- `get_branch_tree` - Get repository branch structure
- `find_large_files` - Find files larger than a specified size

## Security Model

See [SECURITY.md](./SECURITY.md) for detailed security controls including:
- Path allowlisting (restricted to workspace root)
- No persistent state
- Audit logging
- Input validation and sanitization

## Usage

This MCP is designed to be used with LLM systems that support the Model Context Protocol.
All git operations are restricted to the workspace directory for security.