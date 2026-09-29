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
import { runBenchmark } from './tools/run-benchmark.js';
import { profileCode } from './tools/profile-code.js';
import { measureLatency } from './tools/measure-latency.js';
import { measureThroughput } from './tools/measure-throughput.js';
import { analyzeResourceUsage } from './tools/analyze-resource-usage.js';
import { compareBenchmarks } from './tools/compare-benchmarks.js';
import { suggestLoadTest } from './tools/suggest-load-test.js';
import { identifyResourceContention } from './tools/identify-resource-contention.js';
import { Sandbox } from './sandbox.js';

async function main() {
  const server = new Server(
    {
      name: "benchmark-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      }
    }
  );

  // Initialize sandbox
  const sandbox = new Sandbox(process.cwd());

  // Set up tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "run_benchmark",
        description: "Run standardized benchmarks (WRK, k6, JMeter)",
        inputSchema: {
          "type": "object",
          "properties": {
            "template": {"type": "string", "enum": ["wrk", "k6", "jmeter"]},
            "target_url": {"type": "string"},
            "duration_sec": {"type": "number", "optional": true},
            "connections": {"type": "number", "optional": true},
            "script": {"type": "string", "optional": true}
          },
          "required": ["template", "target_url"]
        }
      },
      {
        name: "profile_code",
        description: "Run profilers on code",
        "inputSchema": {
          "type": "object",
          "properties": {
            "command": {"type": "string"},
            "profiler": {"type": "string", "enum": ["perf", "vtune", "jfr", "cprofile"]},
            "duration_sec": {"type": "number", "optional": true}
          },
          "required": ["command", "profiler"]
        }
      },
      {
        name: "measure_latency",
        "description": "Measure endpoint latency",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"], "optional": true},
            "headers": {"type": "object", "optional": true},
            "body": {"type": "string", "optional": true},
            "samples": {"type": "number", "optional": true}
          },
          "required": ["url"]
        }
      },
      {
        name: "measure_throughput",
        "description": "Measure requests/second under load",
        "inputSchema": {
          "type": "object",
          "properties": {
            "url": {"type": "string"},
            "duration_sec": {"type": "number", "required": true},
            "concentration": {"type": "number", "required": true},
            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"], "optional": true},
            "headers": {"type": "object", "optional": true},
            "body": {"type": "string", "optional": true}
          },
          "required": ["url", "duration_sec", "concentration"]
        }
      },
      {
        name: "analyze_resource_usage",
        "description": "Track CPU, memory, disk, network usage",
        "inputSchema": {
          "type": "object",
          "properties": {
            "pid": {"type": "number", "optional": true},
            "duration_sec": {"type": "number", "optional": true},
            "interval_ms": {"type": "number", "optional": true}
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
        "description": "Generate load test scenarios",
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
                  "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"], "optional": true},
                  "headers": {"type": "object", "optional": true},
                  "body": {"type": "string", "optional": true}
                }
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

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      switch (request.params.name) {
        case "run_benchmark":
          return await runBenchmark(sandbox, request.params.arguments as any);
        case "profile_code":
          return await profileCode(sandbox, request.params.arguments as any);
        case "measure_latency":
          return await measureLatency(sandbox, request.params.arguments as any);
        case "measure_throughput":
          return await measureThroughput(sandbox, request.params.arguments as any);
        case "analyze_resource_usage":
          return await analyzeResourceUsage(sandbox, request.params.arguments as any);
        case "compare_benchmarks":
          return await compareBenchmarks(sandbox, request.params.arguments as any);
        case "suggest_load_test":
          return await suggestLoadTest(sandbox, request.params.arguments as any);
        case "identify_resource_contention":
          return await identifyResourceContention(sandbox, request.params.arguments as any);
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
  console.error("Benchmark MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});