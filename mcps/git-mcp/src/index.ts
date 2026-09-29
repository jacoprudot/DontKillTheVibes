import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers
import { getBlame } from './tools/get-blame.js';
import { getDiffSince } from './tools/get-diff-since.js';
import { getBranchTree } from './tools/get-branch-tree.js';
import { findLargeFiles } from './tools/find-large-files.js';
import { GitWrapper } from './git-wrapper.js';
import { PathGuard } from './path-guard.js';

async function main() {
  const server = new Server(
    {
      name: "git-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
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
            "start_line": {"type": "number", "optional": true},
            "end_line": {"type": "number", "optional": true}
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
            "paths": {"type": "string", "optional": true}
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
            "max_depth": {"type": "number", "optional": true}
          }
        }
      },
      {
        name: "find_large_files",
        description: "Find files larger than a specified size",
        "inputSchema": {
          "type": "object",
          "properties": {
            "size_threshold_mb": {"type": "number", "optional": true}
          }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "get_blame":
          return await getBlame(gitWrapper, request.params.arguments as any);
        case "get_diff_since":
          return await getDiffSince(gitWrapper, request.params.arguments as any);
        case "get_branch_tree":
          return await getBranchTree(gitWrapper, request.params.arguments as any);
        case "find_large_files":
          return await findLargeFiles(gitWrapper, request.params.arguments as any);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
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