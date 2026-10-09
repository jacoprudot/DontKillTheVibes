# security-secret-in-history-2 NEGATIVE — the value shapes the credential policy
# excludes: env-var usage, an equals-key value, a placeholder, and an inline
# `#nosec`. Every line MATCHES the spec's regex, so the policy is what silences it.
$password = ConvertTo-SecureString $env:WINDOWS_SIGNING_CERTIFICATE_PASSWORD
const DATABASE_PASSWORD = "DATABASE_PASSWORD";
const apiKey = "your-api-key-here";
const API_KEY = "abc123def456ghi789"; // #nosec 101 -- a test fixture, not a secret
