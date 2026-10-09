// security-oauth-secret-8 NEGATIVE — the newly-excluded shapes for this spec.
// The rule's regex is `(client[_-]?secret|oauth[_-]?(secret|token))\s*[:=]\s*['"][^'"]{8,}['"]`,
// so every line below MATCHES the regex and the credential policy is what keeps
// it quiet.

// (1) value equal to its own key name.
const client_secret = "client_secret";

// (2) a placeholder value.
const clientSecret = "your-client-secret";
const oauth_token = "REPLACE_ME_WITH_TOKEN";

// (3) an inline `#nosec` annotation (high-entropy value on purpose).
const oauth_secret = "aB3dE5gH7jK9mN1p"; // #nosec — generated at runtime in CI

// (4) an env-var reference: the regex matches `oauth_secret = "..."`, and the
//     identifier on the right is a variable, not a credential.
const oauthToken = "process.env.OAUTH_TOKEN_PLACEHOLDER";

module.exports = { client_secret, clientSecret, oauth_token, oauth_secret, oauthToken };
