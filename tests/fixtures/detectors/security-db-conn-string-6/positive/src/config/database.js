// Database configuration for the app service.
// TODO(jira-412): move credentials to a secrets manager before going public.
const config = {
  url: 'postgres://appuser:S3cret!Pass@db.internal.example.com:5432/appdb',
  pool: { min: 2, max: 10 },
};

module.exports = config;
