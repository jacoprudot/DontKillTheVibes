import pg from 'pg';

// Connection pool configured WITHOUT an idle timeout — the rule must fire.
export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: 'app',
  database: 'app',
  max: 20,
});
