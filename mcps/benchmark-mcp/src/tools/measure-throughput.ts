import { errorResult, successResult, validateHeaders, validateHttpUrl } from '../validation.js';

export async function measureThroughput(
  sandbox: unknown, // kept for handler-signature compatibility; not used
  args: {
    url: string;
    duration_sec: number;
    concurrency: number;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
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

    if (args.duration_sec <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'duration_sec must be positive', false);
    }

    if (args.concurrency <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'concurrency must be positive', false);
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

    // Worker-pool: `concurrency` workers each loop until the duration
    // elapses, issuing requests as fast as they complete.
    const endMs = Date.now() + args.duration_sec * 1000;
    const latencies: number[] = [];
    let successful = 0;
    let errors = 0;

    async function worker(): Promise<void> {
      while (Date.now() < endMs) {
        const start = performance.now();
        try {
          const res = await fetch(url.toString(), {
            method,
            headers,
            ...(body && method !== 'GET' ? { body } : {}),
            signal: AbortSignal.timeout(10000)
          });
          await res.arrayBuffer(); // drain so the connection can be reused
          latencies.push(performance.now() - start);
          successful++;
        } catch {
          errors++;
        }
      }
    }

    const startNs = process.hrtime.bigint();
    await Promise.all(
      Array.from({ length: Math.floor(args.concurrency) }, () => worker())
    );
    const actualDurationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    const rps = actualDurationSec > 0 ? successful / actualDurationSec : 0;

    // Percentiles
    const sorted = [...latencies].sort((a, b) => a - b);
    const percentile = (p: number) =>
      sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]! : 0;

    return successResult({
      rps: Number(rps.toFixed(2)),
      latency_p50: Number(percentile(0.5).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      p99: Number(percentile(0.99).toFixed(2)),
      errors
    });
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error measuring throughput: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}
