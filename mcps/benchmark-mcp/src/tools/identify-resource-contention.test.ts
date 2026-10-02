import { identifyResourceContention } from './identify-resource-contention.js';
import { Sandbox } from '../sandbox.js';
import { PathGuard } from '../path-guard.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

describe('identifyResourceContention tool', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;
  let pathGuard: PathGuard;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'contention-test-'));
    sandbox = new Sandbox(tempWorkspace);
    pathGuard = new PathGuard(tempWorkspace);
  });

  afterEach(() => {
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  it('should extract lock contention, GC pauses and thread starvation', async () => {
    const profile = path.join(tempWorkspace, 'profile.json');
    fs.writeFileSync(profile, JSON.stringify({
      lock_contention: [
        { function: 'hotLock', contention_percent: 65 },
        { function: 'mildLock', contention_percent: 10 },
        { function: 'midLock', contention_percent: 30 }
      ],
      gc_pauses: [
        { timestamp: '2026-01-01T00:00:00Z', pause_ms: 1500 },
        { pause_ms: 10 }
      ],
      thread_starvation: [
        { thread_id: 'worker-7', delay_ms: 8000 },
        { thread_id: 'worker-8', delay_ms: 100 }
      ]
    }));
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: 'profile.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    const { lock_contention, gc_pauses, thread_starvation, summary } = payload.data;
    // 65% → high, 30% → medium, 10% → low (all above the 5% significance floor)
    expect(lock_contention).toHaveLength(3);
    expect(lock_contention[0].function).toBe('hotLock');
    expect(lock_contention[0].severity).toBe('high');
    expect(lock_contention[2].function).toBe('mildLock');
    expect(lock_contention[2].severity).toBe('low');
    // GC: 1500ms → high; 10ms is below the 50ms floor and skipped
    expect(gc_pauses).toHaveLength(1);
    expect(gc_pauses[0].severity).toBe('high');
    // Threads: 8000ms → high; 100ms is below the 200ms floor and skipped
    expect(thread_starvation).toHaveLength(1);
    expect(thread_starvation[0].thread_id).toBe('worker-7');
    expect(summary.high_severity_issues).toBe(3);
    expect(summary.total_lock_contention).toBe(3);
  });

  it('should accept the alias fields mutex_stats / gc_stats / thread_delays', async () => {
    const profile = path.join(tempWorkspace, 'alias.json');
    fs.writeFileSync(profile, JSON.stringify({
      mutex_stats: [{ function: 'aliasLock', contention_percent: 40 }],
      gc_stats: [{ pause_ms: 500 }],
      thread_delays: [{ delay_ms: 2000 }]
    }));
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: 'alias.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.summary.total_lock_contention).toBe(1);
    expect(payload.data.summary.total_gc_pauses).toBe(1);
    expect(payload.data.summary.total_thread_starvation).toBe(1);
  });

  it('should return empty analysis for a clean profile', async () => {
    const profile = path.join(tempWorkspace, 'clean.json');
    fs.writeFileSync(profile, JSON.stringify({
      lock_contention: [{ function: 'fine', contention_percent: 1 }]
    }));
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: 'clean.json'
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.summary.high_severity_issues).toBe(0);
  });

  it('should reject path traversal outside the workspace', async () => {
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: '../../../../etc/shadow'
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('PATH_ACCESS_DENIED');
  });

  it('should return FILE_NOT_FOUND for missing profiles', async () => {
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: 'missing.json'
    });
    expect(parse(result).error.code).toBe('FILE_NOT_FOUND');
  });

  it('should return INVALID_JSON for malformed profiles', async () => {
    fs.writeFileSync(path.join(tempWorkspace, 'bad.json'), 'not json at all');
    const result = await identifyResourceContention(sandbox, pathGuard, {
      profile_path: 'bad.json'
    });
    expect(parse(result).error.code).toBe('INVALID_JSON');
  });
});
