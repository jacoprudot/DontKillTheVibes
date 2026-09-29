import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Import tool handlers
import { runBenchmark } from './tools/run-benchmark.js';
import { profileCode } from './tools/profile-code.js';
import { measureLatency } from './tools/measure-latency.js';
import { measureThroughput } from './tools/measure-throughput.js';
import { analyzeResourceUsage } from './tools/analyze-resource-usage.js';
import { compareBenchmarks } from './tools/compare-benchmarks.js';
import { suggestLoadTest } from './tools/suggest-load-test.js';
import { identifyResourceContention } from './tools/identify-resource-contention.js';
import { Sandbox } from './sandbox.js';
import { PathGuard } from './path-guard.js';
import { logAudit } from './audit-log.js';

async function main() {
  const server = new Server(
    {
      name: "benchmark-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      }
    }
  );

  // Initialize sandbox and path guard
  const sandbox = new Sandbox(process.cwd());
  const pathGuard = new PathGuard(process.cwd());

  // Set up tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_benchmark",
        description: "Run standardized benchmarks (WRK, k6, JMeter) using built-in templates only",
        inputSchema: {
          "type": "object",
          "properties": {
            "template": {"type": "string", "enum": ["wrk", "k6", "jmeter"]},
            "target_url": {"type": "string"},
            "duration_sec": {"type": "number"},
            "connections": {"type": "number"},
            "script": {"type": "string", "description": "NOT SUPPORTED: custom scripts are rejected for security. Only built-in templates run."}
          },
          "required": ["template", "target_url"]
        }
      },
      {
        name: "profile_code",
        description: "Run profilers on code. Only allowlisted binaries (node, python, python3) can be profiled; free-text commands are rejected.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "binary": {"type": "string", "enum": ["node", "python", "python3"]},
            "args": {"type": "array", "items": {"type": "string"}},
            "profiler": {"type": "string", "enum": ["perf", "vtune", "jfr", "cprofile"]},
            "duration_sec": {"type": "number"}
          },
          "required": ["binary", "profiler"]
        }
      },
      {
        name: "measure_latency",
        "description": "Measure endpoint latency",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
            "headers": {"type": "object"},
            "body": {"type": "string"},
            "samples": {"type": "number"}
          },
          "required": ["url"]
        }
      },
      {
        name: "measure_throughput",
        "description": "Measure requests/second under concurrent load",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "duration_sec": {"type": "number"},
            "concurrency": {"type": "number"},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
            "headers": {"type": "object"},
            "body": {"type": "string"}
          },
          "required": ["url", "duration_sec", "concurrency"]
        }
      },
      {
        name: "analyze_resource_usage",
        "description": "Track CPU/memory usage of this process (no pid) or an external pid via tasklist/ps",
        "inputSchema": {
          "type": "object",
          "properties": {
            "pid": {"type": "number"},
            "duration_sec": {"type": "number"},
            "interval_ms": {"type": "number"}
          }
        }
      },
      {
        name: "compare_benchmarks",
        "description": "Compare benchmark results",
        "inputSchema": {
          "type": "object",
          "properties": {
            "baseline_path": {"type": "string"},
            "current_path": {"type": "string"}
          },
          "required": ["baseline_path", "current_path"]
        }
      },
      {
        name: "suggest_load_test",
        "description": "Generate k6 and wrk load test scripts for a traffic pattern",
        "inputSchema": {
          "type": "object",
          "properties": {
            "traffic_pattern": {"type": "string", "enum": ["steady", "spike", "ramp"]},
            "endpoints": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "url": {"type": "string"},
                  "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
                  "headers": {"type": "object"},
                  "body": {"type": "string"}
                },
                "required": ["url"]
              }
            }
          },
          "required": ["traffic_pattern", "endpoints"]
        }
      },
      {
        name: "identify_resource_contention",
        "description": "Detect lock contention, GC pauses, thread starvation",
        "inputSchema": {
          "type": "object",
          "properties": {
            "profile_path": {"type": "string"}
          },
          "required": ["profile_path"]
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const toolName = request.params.name;
    const toolArgs = request.params.arguments;
    try {
      let result: any;
      switch (toolName) {
        case "run_benchmark":
          result = await runBenchmark(sandbox, toolArgs);
          break;
        case "profile_code":
          result = await profileCode(sandbox, toolArgs);
          break;
        case "measure_latency":
          result = await measureLatency(sandbox, toolArgs);
          break;
        case "measure_throughput":
          result = await measureThroughput(sandbox, toolArgs);
          break;
        case "analyze_resource_usage":
          result = await analyzeResourceUsage(sandbox, toolArgs);
          break;
        case "compare_benchmarks":
          result = await compareBenchmarks(sandbox, pathGuard, toolArgs);
          break;
        case "suggest_load_test":
          result = await suggestLoadTest(sandbox, toolArgs);
          break;
        case "identify_resource_contention":
          result = await identifyResourceContention(sandbox, pathGuard, toolArgs);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      logAudit(toolName, toolArgs, result);
      return result;
    } catch (error) {
      const errorPayload = {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        }
      };
      logAudit(toolName, toolArgs, errorPayload);
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(errorPayload)
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Benchmark MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
