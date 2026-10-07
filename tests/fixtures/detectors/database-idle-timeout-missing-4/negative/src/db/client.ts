import pg from 'pg';

// Idle timeout IS configured — the rule must NOT fire.
export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: 'app',
  database: 'app',
  max: 20,
  idleTimeoutMillis: 30000,
});
