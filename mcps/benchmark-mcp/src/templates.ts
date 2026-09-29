import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export interface EndpointSpec {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Loads a built-in benchmark template. Only templates shipped in the
 * benchmark-templates directory can be loaded — never user content.
 */
export function loadTemplate(name: string): string {
  const candidates = [
    // src/templates.ts -> src/benchmark-templates (running from source)
    new URL(`./benchmark-templates/${name}`, import.meta.url),
    // dist/templates.js -> dist/benchmark-templates (if copied post-build)
    new URL(`../benchmark-templates/${name}`, import.meta.url),
    // dist/templates.js -> <pkg>/src/benchmark-templates (repo layout)
    new URL(`../src/benchmark-templates/${name}`, import.meta.url),
    // fallback: package root
    new URL(`../../benchmark-templates/${name}`, import.meta.url)
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(fileURLToPath(candidate), 'utf8');
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Benchmark template not found: ${name}`);
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
