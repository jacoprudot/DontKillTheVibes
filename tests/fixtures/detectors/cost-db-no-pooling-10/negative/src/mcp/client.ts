// cost-db-no-pooling-10 negative (ronda 3, 2026-10-12 adjudication): an MCP
// protocol client, not a database client. The file-level exclude_pattern
// vetoes any file importing @modelcontextprotocol — this file must NOT fire.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export async function callTool(serverUrl: string) {
  const client = new Client({ name: 'demo', version: '1.0.0' });
  await client.connect(new (await import('@modelcontextprotocol/sdk/client/streamableHttp.js')).StreamableHTTPClientTransport(new URL(serverUrl)));
  return client;
}
