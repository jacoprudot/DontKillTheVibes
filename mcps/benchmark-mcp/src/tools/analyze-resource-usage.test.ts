import { analyzeResourceUsage } from './analyze-resource-usage.js';
import { execFileSync } from 'child_process';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execFileSync: jest.fn()
}));

const execFileSyncMock = execFileSync as jest.Mock;

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('analyzeResourceUsage tool', () => {
  describe('self mode', () => {
    it('should sample the current process with memory and CPU shape', async () => {
      const result = await analyzeResourceUsage({} as any, {
        duration_sec: 0.25,
        interval_ms: 50
      });
      const payload = parse(result);
      expect(payload.success).toBe(true);
      expect(payload.data.pid).toBe(process.pid);
      expect(payload.data.samples_count).toBeGreaterThan(0);
      const sample = payload.data.samples[0];
      expect(sample.memory_mb.rss).toBeGreaterThan(0);
      expect(typeof sample.memory_mb.heap_used).toBe('number');
      expect(typeof sample.cpu_ms.user).toBe('number');
      expect(new Date(sample.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should collect multiple samples when duration allows', async () => {
      const result = await analyzeResourceUsage({} as any, {
        duration_sec: 0.35,
        interval_ms: 100
      });
      const payload = parse(result);
      expect(payload.data.samples_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('argument validation', () => {
    it('should keep self mode when pid equals the current process pid', async () => {
    const result = await analyzeResourceUsage({} as any, {
      pid: process.pid,
      duration_sec: 0.2,
      interval_ms: 100
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.pid).toBe(process.pid);
    expect(payload.data.source).toContain('self');
  });

  it('should reject non-positive duration_sec', async () => {
      const result = await analyzeResourceUsage({} as any, { duration_sec: 0 });
      expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
    });

    it('should reject non-positive interval_ms', async () => {
      const result = await analyzeResourceUsage({} as any, { interval_ms: -1 });
      expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
    });

    it('should reject non-integer pids', async () => {
      const result = await analyzeResourceUsage({} as any, { pid: 1.5 });
      expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
    });

    it('should reject negative pids', async () => {
      const result = await analyzeResourceUsage({} as any, { pid: -10 });
      expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
    });
  });

  describe('external pid mode', () => {
    afterEach(() => {
      execFileSyncMock.mockReset();
    });

    it('should parse tasklist output on Windows / ps output on POSIX', async () => {
      execFileSyncMock.mockImplementation((bin: string) => {
        if (process.platform === 'win32') {
          expect(bin).toBe('tasklist');
          return '"chrome.exe","1234","Console","1","123,456 K"';
        }
        expect(bin).toBe('ps');
        return ' 126464  12.5';
      });
      const result = await analyzeResourceUsage({} as any, {
        pid: 1234,
        duration_sec: 0.15,
        interval_ms: 50
      });
      const payload = parse(result);
      expect(payload.success).toBe(true);
      expect(payload.data.pid).toBe(1234);
      expect(payload.data.samples_count).toBeGreaterThan(0);
      expect(payload.data.samples[0].rss_mb).toBeCloseTo(123456 / 1024, 1);
    });

    it('should return EXTERNAL_PID_UNSUPPORTED when the OS tool is unavailable', async () => {
      execFileSyncMock.mockImplementation(() => {
        throw new Error('ps: command not found');
      });
      const result = await analyzeResourceUsage({} as any, {
        pid: 999999,
        duration_sec: 0.15,
        interval_ms: 50
      });
      const payload = parse(result);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('EXTERNAL_PID_UNSUPPORTED');
    });

    it('should return nulls when the OS tool output has no matching line', async () => {
      execFileSyncMock.mockReturnValue('');
      const result = await analyzeResourceUsage({} as any, {
        pid: 5555,
        duration_sec: 0.15,
        interval_ms: 50
      });
      const payload = parse(result);
      expect(payload.success).toBe(true);
      expect(payload.data.samples[0].rss_mb).toBeNull();
      expect(payload.data.samples[0].cpu_percent).toBeNull();
    });

    it('should return nulls for rows missing the memory column or with empty tool output', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        // Row contains the pid but has no "Mem Usage" column
        execFileSyncMock.mockReturnValue('"proc.exe","5555","Console","1"');
        const winResult = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 0.15,
          interval_ms: 50
        });
        const winPayload = parse(winResult);
        expect(winPayload.success).toBe(true);
        expect(winPayload.data.samples[0].rss_mb).toBeNull();

        // Empty tool output: no line matches the pid
        execFileSyncMock.mockReturnValue('');
        const posixResult = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 0.15,
          interval_ms: 50
        });
        const posixPayload = parse(posixResult);
        expect(posixPayload.success).toBe(true);
        expect(posixPayload.data.samples[0].rss_mb).toBeNull();
        expect(posixPayload.data.samples[0].cpu_percent).toBeNull();
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should return nulls for non-numeric memory/CPU fields', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      try {
        // "Mem Usage" column present but not parseable
        execFileSyncMock.mockReturnValue('"proc.exe","5555","Console","1","abc K"');
        const winResult = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 0.15,
          interval_ms: 50
        });
        expect(parse(winResult).data.samples[0].rss_mb).toBeNull();

        // ps columns present but not numeric
        Object.defineProperty(process, 'platform', { value: 'linux' });
        execFileSyncMock.mockReturnValue('abc def');
        const posixResult = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 0.15,
          interval_ms: 50
        });
        const posixPayload = parse(posixResult);
        expect(posixPayload.data.samples[0].rss_mb).toBeNull();
        expect(posixPayload.data.samples[0].cpu_percent).toBeNull();
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should parse ps output on POSIX and report the POSIX source', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      try {
        execFileSyncMock.mockImplementation((bin: string) => {
          expect(bin).toBe('ps');
          return ' 126464  12.5';
        });
        const result = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 0.15,
          interval_ms: 50
        });
        const payload = parse(result);
        expect(payload.success).toBe(true);
        expect(payload.data.source).toContain('ps (POSIX)');
        expect(payload.data.samples[0].rss_mb).toBeCloseTo(126464 / 1024, 1);
        expect(payload.data.samples[0].cpu_percent).toBe(12.5);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });

  describe('error paths', () => {
    afterEach(() => {
      execFileSyncMock.mockReset();
    });

    it('should return INTERNAL_ERROR when args cannot be read', async () => {
      const result = await analyzeResourceUsage({} as any, null as any);
      const payload = parse(result);
      expect(payload.success).toBe(false);
      expect(payload.error.code).toBe('INTERNAL_ERROR');
      expect(payload.error.retryable).toBe(true);
    });

    it('should return MEASUREMENT_FAILED when the self loop collects no samples', async () => {
      // First call computes endMs; subsequent calls report the deadline already
      // reached, so the sampling loop never runs and no samples are collected
      let calls = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() =>
        calls++ === 0 ? 1_000_000 : 1_001_000
      );
      try {
        const result = await analyzeResourceUsage({} as any, {
          duration_sec: 1,
          interval_ms: 50
        });
        const payload = parse(result);
        expect(payload.success).toBe(false);
        expect(payload.error.code).toBe('MEASUREMENT_FAILED');
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('should return MEASUREMENT_FAILED when the external loop collects no samples', async () => {
      // First call computes endMs; subsequent calls report the deadline already
      // reached, so the sampling loop never runs and no samples are collected
      let calls = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() =>
        calls++ === 0 ? 1_000_000 : 1_001_000
      );
      try {
        const result = await analyzeResourceUsage({} as any, {
          pid: 5555,
          duration_sec: 1,
          interval_ms: 50
        });
        const payload = parse(result);
        expect(payload.success).toBe(false);
        expect(payload.error.code).toBe('MEASUREMENT_FAILED');
      } finally {
        nowSpy.mockRestore();
      }
    });
  });
});
