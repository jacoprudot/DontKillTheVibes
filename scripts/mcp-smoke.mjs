#!/usr/bin/env node
/**
 * mcp-smoke.mjs — drive a real custom MCP server over stdio and assert the response.
 *
 * Usage:
 *   node scripts/mcp-smoke.mjs <server.js> <tool> '<json-args>' [--expect <substring>] [--timeout <seconds>]
 *
 * Examples (these are the security regression checks wired into CI):
 *   node scripts/mcp-smoke.mjs mcps/git-mcp/dist/index.js get_diff_since \
 *     '{"since_commit":"HEAD; id"}' --expect INVALID_COMMIT
 *   node scripts/mcp-smoke.mjs mcps/benchmark-mcp/dist/index.js profile_code \
 *     '{"binary":"rm","args":["-rf","/"],"profiler":"perf"}' --expect BINARY_NOT_ALLOWED
 *
 * Exits:
 *   0  response received, and --expect matched when it was supplied
 *   1  failure (no response, server crashed, assertion mismatch, timeout)
 *   2  usage / configuration error (bad args, missing server file)
 *
 * This script exists to catch regressions in the security guards (shell
 * injection, binary allowlist). It always kills the child, and it always
 * terminates: a hung server cannot stall CI indefinitely.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const positional = [];
let expectSubstring = null;
let timeoutSec = 20;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--expect') {
    expectSubstring = argv[++i];
  } else if (argv[i] === '--timeout') {
    timeoutSec = Number(argv[++i]);
  } else {
    positional.push(argv[i]);
  }
}

const [serverPath, tool, argsJson] = positional;
const usage = `Usage: node scripts/mcp-smoke.mjs <server.js> <tool> '<json-args>' [--expect <substring>] [--timeout <seconds>]`;

if (!serverPath || !tool || argsJson === undefined) {
  console.error(usage);
  console.error('Refusing to run: server path, tool name and JSON args are all required.');
  process.exit(2);
}
if (!existsSync(serverPath)) {
  console.error(`Server not found: ${serverPath} (did you run "pnpm build"?).`);
  process.exit(2);
}

let toolArgs;
try {
  toolArgs = JSON.parse(argsJson);
} catch (e) {
  console.error(`Invalid JSON in <json-args>: ${e.message}`);
  process.exit(2);
}
if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
  console.error('--timeout must be a positive number of seconds.');
  process.exit(2);
}

let child;
try {
  child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });
} catch (e) {
  // spawn can throw synchronously (e.g. EPERM under a confined sandbox); without
  // this guard the process dies with an unhandled stack trace instead of a
  // diagnostic a CI reader can act on.
  console.error(`SMOKE FAIL: could not spawn server: ${e.message}`);
  process.exit(1);
}
const pending = new Map();
let buf = '';
let nextId = 0;
let settled = false;

const finish = (code, message) => {
  if (settled) return;
  settled = true;
  clearTimeout(deadline);
  if (message !== undefined) process.stdout.write(`${message}\n`);
  try {
    child.kill();
  } catch {
    // already gone
  }
  // Let stdout flush before the hard exit (piped stdout is asynchronous).
  setTimeout(() => process.exit(code), 50);
};

const deadline = setTimeout(
  () => finish(1, `SMOKE FAIL: timed out after ${timeoutSec}s waiting for ${tool} to respond.`),
  timeoutSec * 1000
);

const call = (method, params) =>
  new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, { res, rej });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });

child.on('error', (err) => finish(1, `SMOKE FAIL: could not spawn server: ${err.message}`));
child.on('exit', (code) => {
  if (!settled) finish(1, `SMOKE FAIL: server exited with code ${code} before answering ${tool}.`);
});

child.stdout.on('data', (d) => {
  buf += d.toString();
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const line of lines) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).res(msg);
      pending.delete(msg.id);
    }
  }
});

try {
  await call('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'dktv-smoke', version: '1' },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const response = await call('tools/call', { name: tool, arguments: toolArgs });
  const serialized = JSON.stringify(response);

  if (expectSubstring !== null && !serialized.includes(expectSubstring)) {
    finish(
      1,
      `SMOKE FAIL: expected "${expectSubstring}" in the response from ${tool}, got: ${serialized.slice(0, 900)}`
    );
  } else {
    const verdict = expectSubstring !== null ? ` (matched "${expectSubstring}")` : '';
    finish(0, `SMOKE OK: ${tool}${verdict} -> ${serialized.slice(0, 900)}`);
  }
} catch (e) {
  finish(1, `SMOKE FAIL: ${e.message}`);
}
