import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers
import { getBlame } from './tools/get-blame.js';
import { getDiffSince } from './tools/get-diff-since.js';
import { getBranchTree } from './tools/get-branch-tree.js';
import { findLargeFiles } from './tools/find-large-files.js';
import { GitWrapper } from './git-wrapper.js';
import { PathGuard } from './path-guard.js';
import { logAudit } from './audit-log.js';

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable: boolean };
}

/**
 * Wraps the internal {success,data,error} contract into a conformant
 * MCP CallToolResult with a content array.
 */
function toCallToolResult(toolName: string, args: unknown, result: ToolResult) {
  logAudit(toolName, args, result);
  if (result.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, data: result.data })
        }
      ]
    };
  }
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          success: false,
          error: result.error ?? { code: 'UNKNOWN_ERROR', message: 'Unknown error', retryable: true }
        })
      }
    ]
  };
}

async function main() {
  const server = new Server(
    {
      name: "git-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      }
    }
  );

  // Initialize path guard and git wrapper
  const pathGuard = new PathGuard(process.cwd());
  const gitWrapper = new GitWrapper(pathGuard);

  // Set up tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_blame",
        description: "Get blame information for a file",
        inputSchema: {
          "type": "object",
          "properties": {
            "file": {"type": "string"},
            "start_line": {"type": "number"},
            "end_line": {"type": "number"}
          },
          "required": ["file"]
        }
      },
      {
        name: "get_diff_since",
        description: "Get changes since a specific commit",
        "inputSchema": {
          "type": "object",
          "properties": {
            "since_commit": {"type": "string"},
            "paths": {"type": "string"}
          },
          "required": ["since_commit"]
        }
      },
      {
        name: "get_branch_tree",
        description: "Get repository branch structure",
        "inputSchema": {
          "type": "object",
          "properties": {
            "max_depth": {"type": "number"}
          }
        }
      },
      {
        name: "find_large_files",
        description: "Find files larger than a specified size",
        "inputSchema": {
          "type": "object",
          "properties": {
            "size_threshold_mb": {"type": "number"}
          }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments;
    try {
      let result: ToolResult;
      switch (toolName) {
        case "get_blame":
          result = await getBlame(gitWrapper, pathGuard, args as any);
          break;
        case "get_diff_since":
          result = await getDiffSince(gitWrapper, pathGuard, args as any);
          break;
        case "get_branch_tree":
          result = await getBranchTree(gitWrapper, pathGuard, args as any);
          break;
        case "find_large_files":
          result = await findLargeFiles(gitWrapper, pathGuard, args as any);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      return toCallToolResult(toolName, args, result);
    } catch (error) {
      const errorObj = {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      };
      logAudit(toolName, args, { success: false, error: errorObj });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: errorObj })
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Git MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
