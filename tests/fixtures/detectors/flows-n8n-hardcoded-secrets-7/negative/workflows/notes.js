// flows-n8n-hardcoded-secrets-7 NEGATIVE — the newly-excluded shapes. The regex
// matches every line below; the credential policy is what keeps them quiet.

// (1) a placeholder value made of credential words.
const apiKey = "your-api-key-here";

// (2) an inline `#nosec` annotation on a high-entropy value.
const access_token = "xoxb-2481-9374-5H8xQ2eZvKYlo2C9mN4bT7rW"; // #nosec — a sample from the vendor docs

// (3) an n8n credential expression (a reference, not a literal).
const credential = "={{ $credentials.slackApiKey }}";

module.exports = { apiKey, access_token, credential };
