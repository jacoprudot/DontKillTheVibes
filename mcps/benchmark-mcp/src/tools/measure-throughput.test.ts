import { measureThroughput } from './measure-throughput.js';

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

const realFetch = globalThis.fetch;

describe('measureThroughput tool', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('should measure rps with real concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    globalThis.fetch = jest.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return { arrayBuffer: async () => new ArrayBuffer(0) };
    }) as unknown as typeof fetch;

    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: 0.3,
      concurrency: 4
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.rps).toBeGreaterThan(0);
    expect(payload.data.errors).toBe(0);
    for (const key of ['latency_p50', 'p95', 'p99']) {
      expect(typeof payload.data[key]).toBe('number');
    }
    // 4 workers must actually overlap — the old implementation was sequential
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('should reject non-http URLs', async () => {
    const result = await measureThroughput({} as any, {
      url: 'gopher://old',
      duration_sec: 1,
      concurrency: 1
    });
    expect(parse(result).error.code).toBe('INVALID_URL');
  });

  it('should reject non-positive duration_sec', async () => {
    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: 0,
      concurrency: 1
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject non-positive concurrency', async () => {
    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: 1,
      concurrency: -2
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should reject header injection attempts', async () => {
    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: 1,
      concurrency: 1,
      headers: { 'x-evil': 'a"\nHost: evil' }
    });
    expect(parse(result).error.code).toBe('INVALID_HEADERS');
  });

  it('should count request errors without crashing', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: 0.2,
      concurrency: 2
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.errors).toBeGreaterThan(0);
  });

  it('should return INTERNAL_ERROR when argument coercion throws', async () => {
    const evilDuration = {
      valueOf() {
        throw new Error('boom');
      }
    };
    const result = await measureThroughput({} as any, {
      url: 'http://localhost:3000/api',
      duration_sec: evilDuration as any,
      concurrency: 1
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.retryable).toBe(true);
  });
});
