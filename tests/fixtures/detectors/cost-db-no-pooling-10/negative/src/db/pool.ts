// cost-db-no-pooling-10 negative: the module reuses one shared pg Pool, so it must NOT fire; a naive `new ...(Client|Pool)(` or bare `/new \w+/` scan would flag it.
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}
