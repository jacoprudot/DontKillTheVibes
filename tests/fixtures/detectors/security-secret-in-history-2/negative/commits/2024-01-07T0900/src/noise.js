// NEGATIVE ronda 5 (2026-10-15): value-shape noise classes through the git
// history pipeline. Every value matches the credential regex (>=16 chars) on
// an ADDED line and must be suppressed by the shared policy. Shapes invented.
export const noise = {
  loop_token: "ab12ab12ab12ab12ab12ab12ab12ab12",
  seq_secret: "0123456789abcdef0123456789abcdef0123",
  redis_password: "redis-cache-password",
  fallback_secret: "default_secret_for_local_dev",
  sandbox_api_key: "sk-your-actual-api-key-here",
  version_token: "__APP_VERSION_SLOT__",
  route_password: "/forgot-password",
  dataset_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  sealed_password: "AgA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6A7B8C9",
  age_token: "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
};
