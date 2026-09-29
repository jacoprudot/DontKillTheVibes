import { Sandbox } from '../sandbox.js';
import { errorResult, successResult, validateHeaders, validateHttpUrl } from '../validation.js';
import { buildK6Script, buildWrkScript } from '../templates.js';

export async function suggestLoadTest(
  sandbox: Sandbox,
  args: {
    traffic_pattern: 'steady' | 'spike' | 'ramp';
    endpoints: Array<{
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      headers?: Record<string, string>;
      body?: string;
    }>;
  }
) {
  try {
    if (!args.endpoints || args.endpoints.length === 0) {
      return errorResult('INVALID_ARGUMENTS', 'endpoints array must contain at least one endpoint', false);
    }

    if (!['steady', 'spike', 'ramp'].includes(args.traffic_pattern)) {
      return errorResult(
        'INVALID_ARGUMENTS',
        `traffic_pattern must be one of: steady, spike, ramp (got ${args.traffic_pattern})`,
        false
      );
    }

    // Validate each endpoint
    const endpoints = [];
    for (const endpoint of args.endpoints) {
      try {
        validateHttpUrl(endpoint.url);
        if (endpoint.headers) {
          validateHeaders(endpoint.headers);
        }
      } catch (err) {
        return errorResult(
          'INVALID_ENDPOINT',
          `Invalid endpoint ${endpoint.url}: ${err instanceof Error ? err.message : String(err)}`,
          false
        );
      }
      endpoints.push({
        url: endpoint.url,
        method: endpoint.method || 'GET',
        ...(endpoint.headers ? { headers: endpoint.headers } : {}),
        ...(endpoint.body ? { body: endpoint.body } : {})
      });
    }

    const k6Script = buildK6Script(endpoints, args.traffic_pattern, 10, 30);
    const wrkScript = buildWrkScript(endpoints);

    return successResult({
      traffic_pattern: args.traffic_pattern,
      k6_script: k6Script,
      wrk_script: wrkScript
    });
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error generating load test suggestions: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}
