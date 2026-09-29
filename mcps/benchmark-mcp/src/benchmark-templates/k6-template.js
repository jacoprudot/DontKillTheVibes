// Built-in k6 benchmark template for benchmark-mcp.
// The server replaces the OPTIONS and ENDPOINTS placeholders below before
// execution. Do not edit by hand; the server regenerates this per run.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = __OPTIONS__;

const latencyTrend = new Trend('endpoint_latency');
const ENDPOINTS = __ENDPOINTS__;

export default function () {
  for (const ep of ENDPOINTS) {
    const params = { headers: ep.headers || {} };
    const body = ep.body !== undefined && ep.body !== null ? ep.body : null;
    const res = http.request(ep.method || 'GET', ep.url, body, params);
    check(res, {
      'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    latencyTrend.add(res.timings.duration);
  }
  sleep(1);
}
