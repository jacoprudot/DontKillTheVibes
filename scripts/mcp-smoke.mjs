import { spawn } from 'node:child_process';
const [serverPath, tool, argsJson] = process.argv.slice(2);
const child = spawn('node', [serverPath], { stdio: ['pipe','pipe','inherit'] });
const pending = new Map();
let buf = '', nextId = 0;
const call = (method, params) => new Promise((res, rej) => {
  const id = ++nextId;
  pending.set(id, { res, rej });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
child.stdout.on('data', d => {
  buf += d.toString();
  const lines = buf.split('\n'); buf = lines.pop();
  for (const l of lines) {
    let m; try { m = JSON.parse(l); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id).res(m); pending.delete(m.id); }
  }
});
try {
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const r = await call('tools/call', { name: tool, arguments: JSON.parse(argsJson) });
  console.log(JSON.stringify(r).slice(0, 900));
} catch (e) { console.error('SMOKE FAIL:', e.message); process.exit(1); }
finally { child.kill(); }
