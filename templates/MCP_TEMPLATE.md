# {MCP Name} MCP Server

## Purpose
{Brief description of what this MCP provides}

## Security Model
See templates/security-model.md for the security model these MCPs must follow — it also lists explicitly what is **not** enforced, so do not restate controls that are not implemented.

## Tools

| Tool | Parameters | Returns |
|------|------------|---------|
| {tool-name-1} | {parameters-1} | {returns-1} |
| {tool-name-2} | {parameters-2} | {returns-2} |
| {tool-name-3} | {parameters-3} | {returns-3} |

## Implementation Details
{Specific implementation notes, dependencies, etc.}

## Usage Example
```javascript
// Example of how to use this MCP from an LLM or agent
const result = await mcp.callTool("{tool-name}", { parameters });
```

## Error Handling
All tools return a standardized format:
```javascript
{
  success: boolean,
  data?: any,
  error?: {
    code: string,
    message: string,
    retryable?: boolean
  }
}
```
Never throw exceptions; always return error objects.