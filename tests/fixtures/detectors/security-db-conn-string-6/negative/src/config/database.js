// Database configuration — credentials come from the environment,
// never hardcoded. See .env.example for the expected variables.
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  pool: { min: 2, max: 10 },
};

module.exports = config;
