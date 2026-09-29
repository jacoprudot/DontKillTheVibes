# Git MCP Security Model

## Threat Model
- **Asset**: User's git repository
- **Threat**: Malicious skill prompting MCP to read sensitive information from git history or execute commands
- **Attack Vector**: Prompt injection via skill instructions attempting to access sensitive commit data

## Controls Implemented
1. **Path Allowlisting**: All file operations restricted to workspace root
   - Resolves all paths relative to workspace
   - Rejects any path containing `..` or absolute paths attempting to escape workspace
2. **Command Allowlisting**: Only git command execution through safe wrapper - no arbitrary shell commands
3. **Resource Limits**: 
   - Timeout: 30 seconds default
   - Maximum blame lines: 10000 configurable
   - Maximum diff size: 10MB configurable
4. **Audit Logging**: All invocations logged with hash of args/result (no sensitive content)
5. **No Persistent State**: No data retained between invocations
6. **Input Sanitization**: All inputs sanitized to prevent injection
7. **Git Command Safety**: Git commands executed with restricted arguments to prevent shell injection

## Validation
- Run `npm run security:audit` before release
- Penetration test via simulated attacks attempting to extract sensitive data from history