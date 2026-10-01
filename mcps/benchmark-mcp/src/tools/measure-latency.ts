import { errorResult, successResult, validateHeaders, validateHttpUrl } from '../validation.js';

export async function measureLatency(
  sandbox: unknown, // kept for handler-signature compatibility; not used
  args: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
    samples?: number;
  }
) {
  try {
    // Validate URL — only http/https allowed
    let url: URL;
    try {
      url = validateHttpUrl(args.url);
    } catch (err) {
      return errorResult(
        'INVALID_URL',
        err instanceof Error ? err.message : String(err),
        false
      );
    }

    const method = args.method || 'GET';
    let headers: Record<string, string> = {};
    try {
      headers = validateHeaders(args.headers || {});
    } catch (err) {
      return errorResult(
        'INVALID_HEADERS',
        err instanceof Error ? err.message : String(err),
        false
      );
    }
    const body = args.body || '';
    const samples = args.samples ?? 10; // Default to 10 samples

    if (samples < 1) {
      return errorResult('INVALID_ARGUMENTS', 'samples must be at least 1', false);
    }

    const latencies: number[] = [];
    let errors = 0;

    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      try {
        const res = await fetch(url.toString(), {
          method,
          headers,
          ...(body && method !== 'GET' ? { body } : {}),
          signal: AbortSignal.timeout(10000)
        });
        await res.arrayBuffer();
        latencies.push(performance.now() - start);
      } catch {
        errors++;
      }
    }

    if (latencies.length === 0) {
      return errorResult('MEASUREMENT_FAILED', 'All latency measurements failed', true);
    }

    latencies.sort((a, b) => a - b);
    const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]!;

    return successResult({
      p50: Number(percentile(0.5).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      p99: Number(percentile(0.99).toFixed(2)),
      min: Number(latencies[0]!.toFixed(2)),
      max: Number(latencies[latencies.length - 1]!.toFixed(2)),
      errors,
      samples: latencies.length
    });
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error measuring latency: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}
