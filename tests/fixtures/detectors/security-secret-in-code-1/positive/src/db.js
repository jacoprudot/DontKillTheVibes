// TODO(jorge): move to env vars before going public.
const DB_PASSWORD = "sup3r-secret-password-123";
const DB_HOST = "db.internal.example.com";

function connect() {
  return { host: DB_HOST, password: DB_PASSWORD };
}

module.exports = { connect };
