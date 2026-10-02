import { compareBenchmarks } from './compare-benchmarks.js';
import { Sandbox } from '../sandbox.js';
import { PathGuard } from '../path-guard.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// existsSync is a non-configurable getter on the real fs module, so it cannot
// be spied on directly; wrap it here to make the INTERNAL_ERROR path testable.
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: jest.fn((p: fs.PathLike) => actual.existsSync(p))
  };
});

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('compareBenchmarks tool', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;
  let pathGuard: PathGuard;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'compare-test-'));
    sandbox = new Sandbox(tempWorkspace);
    pathGuard = new PathGuard(tempWorkspace);
  });

  afterEach(() => {
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  function writeJson(name: string, data: unknown) {
    const p = path.join(tempWorkspace, name);
    fs.writeFileSync(p, JSON.stringify(data));
    return name;
  }

  it('should detect latency regressions and throughput regressions', async () => {
    const baseline = writeJson('baseline.json', {
      results: { latency_p50: 100, latency_p99: 200, rps: 1000, errors: 0 }
    });
    const current = writeJson('current.json', {
      results: { latency_p50: 170, latency_p99: 400, rps: 400, errors: 0 }
    });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const { regressions, summary } = payload.data;
    expect(summary.total_regressions).toBeGreaterThanOrEqual(2);
    expect(summary.high_severity_regressions).toBeGreaterThanOrEqual(2);
    const rpsReg = regressions.find((r: any) => r.metric.includes('rps'));
    expect(rpsReg.change_percent).toBe(-60);
    expect(rpsReg.severity).toBe('high');
    expect(regressions[0].severity).toBe('high');
  });

  it('should report improvements when latency drops', async () => {
    const baseline = writeJson('b.json', { results: { latency_p50: 100 } });
    const current = writeJson('c.json', { results: { latency_p50: 50 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.summary.total_improvements).toBe(1);
    expect(payload.data.improvements[0].change_percent).toBe(-50);
  });

  it('should reject path traversal outside the workspace', async () => {
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: '../../etc/passwd',
      current_path: 'c.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PATH_ACCESS_DENIED');
  });

  it('should return FILE_NOT_FOUND for missing files', async () => {
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: 'nope.json',
      current_path: 'also-nope.json'
    });
    expect(parse(result).error.code).toBe('FILE_NOT_FOUND');
  });

  it('should return INVALID_JSON for malformed benchmark files', async () => {
    fs.writeFileSync(path.join(tempWorkspace, 'bad.json'), '{not json');
    const good = writeJson('good.json', { results: { rps: 1 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: 'bad.json',
      current_path: good
    });
    expect(parse(result).error.code).toBe('INVALID_JSON');
  });

  it('should ignore zero baselines to avoid division by zero', async () => {
    const baseline = writeJson('b0.json', { results: { rps: 0, latency_p50: 0 } });
    const current = writeJson('c0.json', { results: { rps: 500, latency_p50: 80 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.summary.total_regressions).toBe(0);
    expect(payload.data.summary.total_improvements).toBe(0);
  });

  it('should report throughput improvements when rps rises', async () => {
    const baseline = writeJson('bt.json', { results: { rps: 1000 } });
    const current = writeJson('ct.json', { results: { rps: 1800 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.summary.total_improvements).toBe(1);
    expect(payload.data.improvements[0].change_percent).toBe(80);
    expect(payload.data.summary.total_regressions).toBe(0);
  });

  it('should flag other metrics that change significantly in either direction', async () => {
    const baseline = writeJson('bo.json', { results: { errors: 10 } });
    const currentUp = writeJson('co-up.json', { results: { errors: 20 } });
    const up = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: currentUp
    }));
    expect(up.data.summary.total_regressions).toBe(1);
    expect(up.data.regressions[0].metric).toContain('errors');
    expect(up.data.regressions[0].severity).toBe('medium');

    const currentDown = writeJson('co-down.json', { results: { errors: 4 } });
    const down = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: currentDown
    }));
    expect(down.data.summary.total_improvements).toBe(1);
  });

  it('should skip non-numeric and missing metrics silently', async () => {
    const baseline = writeJson('bm.json', { results: { rps: 100, note: 'abc', nested: { x: 1 } } });
    const current = writeJson('cm.json', { results: { note: 'def', nested: { x: 1 } } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    // rps has no current value, note is not numeric, nested.x unchanged
    expect(payload.data.summary.total_regressions).toBe(0);
    expect(payload.data.summary.total_improvements).toBe(0);
  });

  it('should return FILE_NOT_FOUND when only the current file is missing', async () => {
    const baseline = writeJson('b-only.json', { results: { rps: 100 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: 'missing-current.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FILE_NOT_FOUND');
    expect(payload.error.message).toContain('Current file not found');
  });

  it('should return INVALID_JSON for a malformed current file', async () => {
    fs.writeFileSync(path.join(tempWorkspace, 'bad-current.json'), '{oops');
    const good = writeJson('good-baseline.json', { results: { rps: 1 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: good,
      current_path: 'bad-current.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_JSON');
    expect(payload.error.message).toContain('current file');
  });

  it('should classify latency changes into medium, low, and insignificant buckets', async () => {
    const baseline = writeJson('lat-b.json', { results: { latency_p50: 100 } });
    // +30% -> medium regression
    const medium = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: writeJson('lat-m.json', { results: { latency_p50: 130 } })
    }));
    expect(medium.data.regressions).toHaveLength(1);
    expect(medium.data.regressions[0].severity).toBe('medium');
    expect(medium.data.regressions[0].change_percent).toBe(30);

    // +8% -> low regression
    const low = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: writeJson('lat-l.json', { results: { latency_p50: 108 } })
    }));
    expect(low.data.regressions).toHaveLength(1);
    expect(low.data.regressions[0].severity).toBe('low');

    // +2% -> insignificant, skipped entirely
    const none = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: writeJson('lat-n.json', { results: { latency_p50: 102 } })
    }));
    expect(none.data.summary.total_regressions).toBe(0);
    expect(none.data.summary.total_improvements).toBe(0);
  });

  it('should classify latency improvements of medium and low magnitude', async () => {
    const baseline = writeJson('lati-b.json', { results: { latency_p50: 100 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: writeJson('lati-c.json', { results: { latency_p50: 70 } })
    });
    const payload = parse(result);
    expect(payload.data.summary.total_improvements).toBe(1);
    expect(payload.data.improvements[0].severity).toBeUndefined();
    expect(payload.data.improvements[0].change_percent).toBe(-30);
  });

  it('should classify throughput via name variants and skip insignificant changes', async () => {
    const baseline = writeJson('thr-b.json', {
      results: { throughput_avg: 100, requests_count: 100, rps_small: 100 }
    });
    const current = writeJson('thr-c.json', {
      results: { throughput_avg: 70, requests_count: 102, rps_small: 110 }
    });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    // throughput_avg: -30% -> medium regression
    expect(payload.data.regressions).toHaveLength(1);
    expect(payload.data.regressions[0].metric).toBe('results.throughput_avg');
    expect(payload.data.regressions[0].severity).toBe('medium');
    // rps_small: +10% -> low-severity throughput improvement
    expect(payload.data.summary.total_improvements).toBe(1);
    expect(payload.data.improvements[0].change_percent).toBe(10);
    // requests_count: +2% -> insignificant
  });

  it('should detect time-named latency metrics', async () => {
    const baseline = writeJson('time-b.json', { results: { response_time: 100 } });
    const current = writeJson('time-c.json', { results: { response_time: 160 } });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    });
    const payload = parse(result);
    expect(payload.data.regressions).toHaveLength(1);
    expect(payload.data.regressions[0].metric).toBe('results.response_time');
    expect(payload.data.regressions[0].severity).toBe('high');
  });

  it('should sort mixed-severity regressions high first and improvements by magnitude', async () => {
    const baseline = writeJson('sort-b.json', {
      results: { latency_p50: 100, rps: 1000, other_a: 100, other_b: 100 }
    });
    const current = writeJson('sort-c.json', {
      results: { latency_p50: 160, rps: 700, other_a: 150, other_b: 160 }
    });
    const payload = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    }));
    // regressions: latency +60% (high) must come first, then mediums by magnitude
    expect(payload.data.regressions.map((r: any) => r.severity))
      .toEqual(['high', 'medium', 'medium', 'medium']);
    expect(payload.data.regressions[0].metric).toContain('latency');
  });

  it('should sort multiple improvements by absolute change percent', async () => {
    const baseline = writeJson('imp-b.json', { results: { latency_a: 100, latency_b: 100 } });
    const current = writeJson('imp-c.json', { results: { latency_a: 40, latency_b: 80 } });
    const payload = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    }));
    expect(payload.data.summary.total_improvements).toBe(2);
    expect(payload.data.improvements[0].change_percent).toBe(-60);
    expect(payload.data.improvements[1].change_percent).toBe(-20);
  });

  it('should ignore null metrics when flattening', async () => {
    const baseline = writeJson('null-b.json', { results: { rps: 100, extra: null } });
    const current = writeJson('null-c.json', { results: { rps: 100, extra: null } });
    const payload = parse(await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: baseline,
      current_path: current
    }));
    expect(payload.success).toBe(true);
    expect(payload.data.summary.total_regressions).toBe(0);
  });

  it('should return INTERNAL_ERROR when the filesystem read fails unexpectedly', async () => {
    (fs.existsSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('disk error');
    });
    const result = await compareBenchmarks(sandbox, pathGuard, {
      baseline_path: 'x.json',
      current_path: 'y.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.retryable).toBe(true);
  });
});
