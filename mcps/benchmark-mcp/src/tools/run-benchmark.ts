import { Sandbox } from '../sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import { errorResult, successResult, validateHttpUrl } from '../validation.js';
import { buildJmxTemplate, buildK6Script, type EndpointSpec } from '../templates.js';

export async function runBenchmark(
  sandbox: Sandbox,
  args: {
    template: 'wrk' | 'k6' | 'jmeter';
    target_url: string;
    duration_sec?: number;
    connections?: number;
    script?: string;
  }
) {
  try {
    // Validate URL — only http/https allowed
    let url: URL;
    try {
      url = validateHttpUrl(args.target_url);
    } catch (err) {
      return errorResult(
        'INVALID_TARGET_URL',
        err instanceof Error ? err.message : String(err),
        false
      );
    }

    // Custom benchmark scripts are rejected: benchmarks may only use the
    // built-in templates, because a user-supplied script is arbitrary code
    // executed by wrk/k6 (inherent RCE otherwise).
    if (args.script) {
      return errorResult(
        'CUSTOM_SCRIPT_FORBIDDEN',
        'Custom benchmark scripts are not allowed. Only the built-in benchmark-templates (wrk/k6/jmeter) may be executed.',
        false
      );
    }

    const durationSec = args.duration_sec ?? 30; // Default 30 seconds
    const connections = args.connections ?? 10; // Default 10 connections

    if (durationSec <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'duration_sec must be positive', false);
    }

    if (connections <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'connections must be positive', false);
    }

    // Create temporary directory for benchmark files
    const benchmarkDir = sandbox.createTempDir(`benchmark-${Date.now()}`);

    let benchmarkBin = '';
    let benchmarkArgs: string[] = [];
    let outputFile = '';
    let useStdout = false;

    switch (args.template) {
      case 'wrk': {
        // WRK benchmark tool — results come from stdout
        benchmarkBin = 'wrk';
        benchmarkArgs = [
          `-t${connections}`,
          `-c${connections}`,
          `-d${durationSec}s`,
          url.toString()
        ];
        useStdout = true;
        break;
      }

      case 'k6': {
        // k6 benchmark tool — script generated from the built-in template,
        // honoring duration_sec (no hardcoded '30s')
        const endpoint: EndpointSpec = { url: url.toString(), method: 'GET' };
        const k6Script = buildK6Script([endpoint], 'steady', connections, durationSec);

        const scriptPath = path.join(benchmarkDir, 'benchmark.js');
        fs.writeFileSync(scriptPath, k6Script, 'utf8');

        benchmarkBin = 'k6';
        benchmarkArgs = ['run', '--duration', `${durationSec}s`, scriptPath];
        useStdout = true;
        break;
      }

      case 'jmeter': {
        // Apache JMeter benchmark tool
        outputFile = path.join(benchmarkDir, 'jmeter-results.jtl');

        const jmxPath = path.join(benchmarkDir, 'test.jmx');
        fs.writeFileSync(jmxPath, buildJmxTemplate(url.toString(), connections, durationSec), 'utf8');

        benchmarkBin = 'jmeter';
        benchmarkArgs = ['-n', '-t', jmxPath, '-l', outputFile];
        break;
      }

      default:
        return errorResult(
          'INVALID_ARGUMENTS',
          `Unsupported benchmark template: ${args.template}`,
          false
        );
    }

    // Execute the benchmark command
    let stdout = '';
    try {
      stdout = sandbox.execSandbox(benchmarkBin, benchmarkArgs, {
        timeout: (durationSec + 30) * 1000 // Add buffer time for benchmark execution
      });
    } catch (execError) {
      // execFileSync surfaces partial stdout on the error object — keep it
      const partialStdout = (execError as { stdout?: unknown })?.stdout;
      if (typeof partialStdout === 'string' && partialStdout.trim() !== '') {
        stdout = partialStdout;
      }
      if (useStdout && !stdout) {
        return errorResult(
          'BENCHMARK_FAILED',
          execError instanceof Error ? execError.message : String(execError),
          true
        );
      }
      if (!useStdout && !fs.existsSync(outputFile)) {
        return errorResult(
          'BENCHMARK_FAILED',
          execError instanceof Error ? execError.message : String(execError),
          true
        );
      }
    }

    // Read and parse the output based on template
    let results: any;

    if (useStdout) {
      if (!stdout || stdout.trim() === '') {
        return errorResult('BENCHMARK_FAILED', 'Benchmark produced no output', true);
      }
      results = args.template === 'wrk' ? parseWrkOutput(stdout) : { raw_output: stdout };
    } else {
      if (!fs.existsSync(outputFile)) {
        return errorResult('BENCHMARK_FAILED', 'No benchmark output generated', true);
      }
      results = parseJmeterOutput(fs.readFileSync(outputFile, 'utf8'));
    }

    return successResult({
      template: args.template,
      target_url: args.target_url,
      duration_sec: durationSec,
      connections: connections,
      results: results,
      completed_at: new Date().toISOString()
    });
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error running benchmark: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}

// Helper function to parse WRK stdout
function parseWrkOutput(output: string): any {
  const lines = output.trim().split('\n');
  const result: any = {
    raw_output: output
  };

  for (const line of lines) {
    if (line.includes('Requests/sec:')) {
      // Real wrk format: "Requests/sec:    999.00" (value AFTER the label)
      const match = line.match(/Requests\/sec:\s+([\d.]+)/);
      if (match && match[1]) {
        result.requests_per_second = parseFloat(match[1]);
      }
    } else if (line.includes('Transfer/sec:')) {
      const match = line.match(/Transfer\/sec:\s+(\S+)/);
      if (match && match[1]) {
        result.transfer_per_second = match[1];
      }
    } else if (/^\s*Latency\s/.test(line)) {
      // Real wrk format: "    Latency   10.00ms   2.00ms   50.00ms   90.00%"
      // (avg, stdev, max) — no "Avg" label on the data line itself.
      const parts = line.trim().split(/\s+/);
      if (parts[1]) {
        result.latency_avg = parts[1];
      }
      if (parts[3]) {
        result.latency_max = parts[3];
      }
    }
  }

  return result;
}

// Helper function to parse JMeter output
function parseJmeterOutput(output: string): any {
  // JMeter output is typically CSV or XML
  return {
    format: 'CSV/XML (JMeter)',
    line_count: output.trim().split('\n').length,
    has_data: output.trim().length > 0,
    raw_output_preview: output.substring(0, Math.min(500, output.length))
  };
}
