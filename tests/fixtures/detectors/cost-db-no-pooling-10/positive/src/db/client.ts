// cost-db-no-pooling-10 positive: a brand new pg Client is opened per call instead of reusing a pool, so this file MUST fire.
import { Client } from 'pg';

export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
