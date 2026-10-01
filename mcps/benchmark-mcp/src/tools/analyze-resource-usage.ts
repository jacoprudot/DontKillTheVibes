import { execFileSync } from 'child_process';
import { errorResult, successResult } from '../validation.js';

export async function analyzeResourceUsage(
  sandbox: unknown, // kept for handler-signature compatibility; not used
  args: {
    pid?: number;
    duration_sec?: number;
    interval_ms?: number;
  }
) {
  try {
    const durationSec = args.duration_sec ?? 5; // Default 5 seconds
    const intervalMs = args.interval_ms ?? 1000; // Default 1 second intervals

    if (durationSec <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'duration_sec must be positive', false);
    }

    if (intervalMs <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'interval_ms must be positive', false);
    }

    // Validate pid if provided
    const targetPid = args.pid;
    if (targetPid !== undefined) {
      if (!Number.isInteger(targetPid) || targetPid <= 0) {
        return errorResult('INVALID_ARGUMENTS', 'pid must be a positive integer', false);
      }
      if (targetPid !== process.pid) {
        return analyzeExternalPid(targetPid, durationSec, intervalMs);
      }
    }

    return analyzeSelf(durationSec, intervalMs);
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error analyzing resource usage: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}

/**
 * Samples the MCP server process itself using accurate Node APIs.
 * CPU usage is reported as the delta consumed over each interval.
 */
async function analyzeSelf(durationSec: number, intervalMs: number) {
  const samples: Array<{
    timestamp: string;
    memory_mb: { rss: number; heap_total: number; heap_used: number; external: number };
    cpu_ms: { user: number; system: number };
  }> = [];

  const endMs = Date.now() + durationSec * 1000;
  let prevCpu = process.cpuUsage();

  while (Date.now() < endMs) {
    const sampleStart = Date.now();
    const mem = process.memoryUsage();
    const cpuNow = process.cpuUsage();
    const cpuDelta = process.cpuUsage(prevCpu); // microseconds consumed since last sample
    prevCpu = cpuNow;

    samples.push({
      timestamp: new Date().toISOString(),
      memory_mb: {
        rss: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        heap_total: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
        heap_used: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        external: Number((mem.external / (1024 * 1024)).toFixed(2))
      },
      cpu_ms: {
        user: Number((cpuDelta.user / 1000).toFixed(2)),
        system: Number((cpuDelta.system / 1000).toFixed(2))
      }
    });

    const wait = intervalMs - (Date.now() - sampleStart);
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }

  if (samples.length === 0) {
    return errorResult('MEASUREMENT_FAILED', 'No samples collected', true);
  }

  return successResult({
    pid: process.pid,
    source: 'self (process.memoryUsage/cpuUsage)',
    samples_count: samples.length,
    interval_ms: intervalMs,
    samples
  });
}

/**
 * Samples an external process with the OS process snapshot tool.
 * Windows: tasklist (RSS only; no per-process CPU without WMI/powershell).
 * POSIX: ps (RSS + %CPU averaged over the process lifetime).
 * This is a best-effort minimal parser, not a profiler.
 */
async function analyzeExternalPid(pid: number, durationSec: number, intervalMs: number) {
  const samples: Array<{
    timestamp: string;
    rss_mb: number | null;
    cpu_percent: number | null;
  }> = [];

  const endMs = Date.now() + durationSec * 1000;

  const snapshot = (): { rssMb: number | null; cpuPct: number | null } => {
    if (process.platform === 'win32') {
      // tasklist: CSV output, columns include "Mem Usage" like "123,456 K"
      const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        timeout: 10000
      });
      const line = out.trim().split('\n').find(l => l.includes(String(pid)));
      if (!line) return { rssMb: null, cpuPct: null };
      const cols = line.split('","').map(c => c.replace(/^"|"$/g, ''));
      const memStr = cols[4]; // "Mem Usage" column
      const kb = memStr ? parseInt(memStr.replace(/[^\d]/g, ''), 10) : NaN;
      return { rssMb: isNaN(kb) ? null : Number((kb / 1024).toFixed(2)), cpuPct: null };
    }
    // POSIX: ps -o rss= -o pcpu=
    const out = execFileSync('ps', ['-p', String(pid), '-o', 'rss=', '-o', 'pcpu='], {
      encoding: 'utf8',
      timeout: 10000
    });
    const parts = out.trim().split(/\s+/);
    const rssKb = parts[0] ? parseInt(parts[0], 10) : NaN;
    const pcpu = parts[1] ? parseFloat(parts[1]) : NaN;
    return {
      rssMb: isNaN(rssKb) ? null : Number((rssKb / 1024).toFixed(2)),
      cpuPct: isNaN(pcpu) ? null : pcpu
    };
  };

  while (Date.now() < endMs) {
    const sampleStart = Date.now();
    try {
      const { rssMb, cpuPct } = snapshot();
      samples.push({
        timestamp: new Date().toISOString(),
        rss_mb: rssMb,
        cpu_percent: cpuPct
      });
    } catch (err) {
      return errorResult(
        'EXTERNAL_PID_UNSUPPORTED',
        `Cannot sample external pid ${pid}: ${err instanceof Error ? err.message : String(err)}. ` +
        'External pid sampling requires tasklist (Windows) or ps (POSIX).',
        false
      );
    }
    const wait = intervalMs - (Date.now() - sampleStart);
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }

  if (samples.length === 0) {
    return errorResult('MEASUREMENT_FAILED', 'No samples collected', true);
  }

  return successResult({
    pid,
    source: process.platform === 'win32' ? 'tasklist (Windows)' : 'ps (POSIX)',
    note: process.platform === 'win32'
      ? 'Windows tasklist does not provide per-process CPU percentage; cpu_percent is null.'
      : 'cpu_percent is the average over the process lifetime, not per-interval.',
    samples_count: samples.length,
    interval_ms: intervalMs,
    samples
  });
}
