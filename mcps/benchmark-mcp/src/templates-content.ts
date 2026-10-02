/**
 * Built-in benchmark templates, embedded as constants.
 *
 * The templates are compiled into the MCP rather than read from disk: a
 * disk-resident template could be tampered with between build and execution,
 * and user-supplied scripts are rejected outright (see run-benchmark.ts).
 * Only these built-in templates may ever be executed.
 *
 * Placeholders replaced by the server before execution:
 *   k6:  __OPTIONS__, __ENDPOINTS__
 *   wrk: __ENDPOINTS__ (paths on the single target host)
 *   jmx: __HOST__, __PORT__, __PROTOCOL__, __PATH__, __THREADS__, __DURATION__
 */

export const K6_TEMPLATE = `// Built-in k6 benchmark template for benchmark-mcp.
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
`;

export const WRK_TEMPLATE = `-- Built-in wrk benchmark template for benchmark-mcp.
-- The server replaces the ENDPOINTS placeholder below before execution.
-- wrk connects to a single host (given on the command line); each endpoint's
-- path must be a path+query on that host.

local endpoints = __ENDPOINTS__
local idx = 0

request = function()
  idx = idx + 1
  local ep = endpoints[((idx - 1) % #endpoints) + 1]
  wrk.method = ep.method or "GET"
  wrk.path = ep.path
  wrk.body = ep.body
  wrk.headers = ep.headers or {}
  return wrk.format()
end

done = function(summary, latency, requests)
  -- Let wrk print its standard summary; nothing extra needed here.
end
`;

export const JMETER_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Built-in JMeter test plan template for benchmark-mcp.
     Placeholders replaced by the MCP before execution:
       __HOST__      - target hostname
       __PORT__      - target port (may be empty)
       __PROTOCOL__  - http or https
       __PATH__      - path + query
       __THREADS__   - number of threads (connections)
       __DURATION__  - duration in seconds
-->
<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.4.1">
  <hashTree>
    <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="Benchmark Test Plan" enabled="true">
      <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
        <collectionProp name="Arguments.arguments"/>
      </elementProp>
    </TestPlan>
    <hashTree>
      <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Thread Group" enabled="true">
        <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
        <elementProp name="ThreadGroup.main_controller" elementType="LoopController">
          <stringProp name="LoopController.continue_forever">false</stringProp>
          <stringProp name="LoopController.loops">-1</stringProp>
        </elementProp>
        <stringProp name="ThreadGroup.num_threads">__THREADS__</stringProp>
        <stringProp name="ThreadGroup.ramp_time">1</stringProp>
        <boolProp name="ThreadGroup.scheduler">true</boolProp>
        <stringProp name="ThreadGroup.duration">__DURATION__</stringProp>
        <stringProp name="ThreadGroup.delay">0</stringProp>
      </ThreadGroup>
      <hashTree>
        <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="HTTP Request" enabled="true">
          <elementProp name="HTTPsampler.Arguments" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>
          <stringProp name="HTTPSampler.domain">__HOST__</stringProp>
          <stringProp name="HTTPSampler.port">__PORT__</stringProp>
          <stringProp name="HTTPSampler.protocol">__PROTOCOL__</stringProp>
          <stringProp name="HTTPSampler.path">__PATH__</stringProp>
          <stringProp name="HTTPSampler.method">GET</stringProp>
          <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
          <boolProp name="HTTPSampler.use_keepalive">true</boolProp>
        </HTTPSamplerProxy>
        <hashTree/>
      </hashTree>
    </hashTree>
  </hashTree>
</jmeterTestPlan>
`;
