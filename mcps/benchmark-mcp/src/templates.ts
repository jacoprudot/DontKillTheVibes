import { K6_TEMPLATE, WRK_TEMPLATE, JMETER_TEMPLATE } from './templates-content.js';

export interface EndpointSpec {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Returns a built-in benchmark template by file name. Templates are compiled
 * into the MCP (see templates-content.ts) — never loaded from disk and never
 * user content, so they cannot be tampered with at runtime.
 */
const BUILTIN_TEMPLATES: Record<string, string> = {
  'k6-template.js': K6_TEMPLATE,
  'wrk-template.lua': WRK_TEMPLATE,
  'jmeter-template.jmx': JMETER_TEMPLATE
};

export function loadTemplate(name: string): string {
  const template = BUILTIN_TEMPLATES[name];
  if (template === undefined) {
    throw new Error(`Benchmark template not found: ${name}`);
  }
  return template;
}

/**
 * Builds the k6 options object for a given traffic pattern.
 */
export function buildK6Options(
  trafficPattern: 'steady' | 'spike' | 'ramp',
  vus: number,
  durationSec: number
): unknown {
  const thresholds = {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  };

  switch (trafficPattern) {
    case 'spike':
      return {
        stages: [
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus * 10 },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 4))}s`, target: 0 }
        ],
        thresholds
      };
    case 'ramp':
      return {
        stages: [
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: vus },
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: vus * 5 },
          { duration: `${Math.max(1, Math.floor(durationSec / 3))}s`, target: 0 }
        ],
        thresholds
      };
    case 'steady':
    default:
      return {
        vus,
        duration: `${durationSec}s`,
        thresholds
      };
  }
}

/**
 * Generates a runnable k6 script from the built-in template.
 */
export function buildK6Script(
  endpoints: EndpointSpec[],
  trafficPattern: 'steady' | 'spike' | 'ramp',
  vus: number,
  durationSec: number
): string {
  return loadTemplate('k6-template.js')
    .replace('__OPTIONS__', JSON.stringify(buildK6Options(trafficPattern, vus, durationSec)))
    .replace('__ENDPOINTS__', JSON.stringify(endpoints));
}

/**
 * Generates a wrk Lua script from the built-in template. Endpoints are
 * reduced to path+query because wrk targets a single host.
 */
export function buildWrkScript(endpoints: EndpointSpec[]): string {
  const wrkEndpoints = endpoints.map(ep => {
    const url = new URL(ep.url);
    return {
      path: url.pathname + url.search,
      method: ep.method || 'GET',
      headers: ep.headers || {},
      ...(ep.body ? { body: ep.body } : {})
    };
  });
  return loadTemplate('wrk-template.lua').replace(
    '__ENDPOINTS__',
    JSON.stringify(wrkEndpoints)
  );
}

/**
 * Generates a JMeter test plan from the built-in template.
 */
export function buildJmxTemplate(targetUrl: string, threads: number, durationSec: number): string {
  const url = new URL(targetUrl);
  return loadTemplate('jmeter-template.jmx')
    .replaceAll('__HOST__', url.hostname)
    .replaceAll('__PORT__', url.port || (url.protocol === 'https:' ? '443' : '80'))
    .replaceAll('__PROTOCOL__', url.protocol.replace(':', ''))
    .replaceAll('__PATH__', url.pathname + url.search)
    .replaceAll('__THREADS__', String(threads))
    .replaceAll('__DURATION__', String(durationSec));
}
