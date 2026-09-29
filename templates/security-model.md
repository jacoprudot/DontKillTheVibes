# MCP Security Model

## Threat Model
- **Asset**: User's codebase, GitHub tokens, local files
- **Threat**: Malicious skill prompting MCP to exfiltrate data or execute commands
- **Attack Vector**: Prompt injection via skill instructions

## Controls Implemented
1. **Path Allowlisting**: All file operations restricted to workspace root
2. **Command Allowlisting**: Only approved binaries (no shell)
3. **Resource Limits**: Timeout 30s, Memory 512MB, CPU 50%
4. **Audit Logging**: All invocations logged with hash of args/result
5. **No Persistent State**: No data retained between invocations
6. **Token Handling**: GitHub token never logged, validated for minimal scopes

## Validation
- Run `npm run security:audit` before release
- Penetration test via simulated prompt injection