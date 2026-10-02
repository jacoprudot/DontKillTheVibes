import { measureLatency } from './measure-latency.js';

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

function fakeFetch(impl: (url: string, init: any) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>) {
  return jest.fn(impl) as unknown as typeof fetch;
}

const realFetch = globalThis.fetch;

describe('measureLatency tool', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('should measure latency percentiles over N samples', async () => {
    let call = 0;
    globalThis.fetch = fakeFetch(async () => {
      call++;
      await new Promise(r => setTimeout(r, call === 1 ? 5 : 1)); // varied latencies
      return { arrayBuffer: async () => new ArrayBuffer(0) };
    });
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      samples: 10
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.samples).toBe(10);
    expect(payload.data.errors).toBe(0);
    for (const key of ['p50', 'p95', 'p99', 'min', 'max']) {
      expect(typeof payload.data[key]).toBe('number');
    }
    expect(payload.data.min).toBeLessThanOrEqual(payload.data.p50);
    expect(payload.data.p50).toBeLessThanOrEqual(payload.data.p99);
  });

  it('should count failures and still report successful samples', async () => {
    let call = 0;
    globalThis.fetch = fakeFetch(async () => {
      call++;
      if (call % 2 === 0) throw new Error('connection reset');
      return { arrayBuffer: async () => new ArrayBuffer(0) };
    });
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      samples: 10
    });
    const payload = parse(result);
    expect(payload.success).toBe(true);
    expect(payload.data.errors).toBe(5);
    expect(payload.data.samples).toBe(5);
  });

  it('should return MEASUREMENT_FAILED when every sample fails', async () => {
    globalThis.fetch = fakeFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      samples: 3
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('MEASUREMENT_FAILED');
  });

  it('should reject non-http URLs', async () => {
    const result = await measureLatency({} as any, { url: 'file:///etc/passwd' });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_URL');
  });

  it('should reject header injection attempts', async () => {
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      headers: { 'x-evil': 'a"\r\n injected: 1' }
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_HEADERS');
  });

  it('should reject samples < 1', async () => {
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      samples: 0
    });
    expect(parse(result).error.code).toBe('INVALID_ARGUMENTS');
  });

  it('should return INTERNAL_ERROR when argument coercion throws', async () => {
    const evilSamples = {
      valueOf() {
        throw new Error('boom');
      }
    };
    const result = await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      samples: evilSamples as any
    });
    const payload = parse(result);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INTERNAL_ERROR');
    expect(payload.error.retryable).toBe(true);
  });

  it('should send the body for POST requests', async () => {
    const mock = fakeFetch(async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }));
    globalThis.fetch = mock;
    await measureLatency({} as any, {
      url: 'http://localhost:3000/api',
      method: 'POST',
      body: '{"a":1}',
      samples: 1
    });
    expect(mock).toHaveBeenCalledTimes(1);
    const init = (mock as jest.Mock).mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
  });
});
