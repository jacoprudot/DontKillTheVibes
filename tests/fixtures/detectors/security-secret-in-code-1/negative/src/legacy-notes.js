// security-secret-in-code-1 NEGATIVE — the shapes the credential policy excludes
// (2026-10-08 calibration 3). EVERY line below was measured as a false positive in
// the 100-repo sweep; the rule must stay silent on all of them.
//
// The key names are deliberately the ones the rule's own regex looks for, so the
// only thing keeping a line quiet is the SHAPE, never the keyword.

// (1) env-var USAGE — the remediation of this rule, not the leak. Verbatim from
//     the sweep (a Windows signing script): the regex matches `password =
//     ConvertTo-SecureString` and the identifier is not a credential.
$password = ConvertTo-SecureString $env:WINDOWS_SIGNING_CERTIFICATE_PASSWORD

// (2) a value equal to its own key name.
const DATABASE_PASSWORD = "DATABASE_PASSWORD";

// (3) a placeholder value: the whole value is made of credential words.
const apiKey = "your-api-key-here";
const clientSecret = "SOME_ENV_VAR_NAME";

// (4) a bare unquoted identifier on the right-hand side is a variable reference.
const token = legacy_api_token_reference;

// (5) an inline `#nosec` annotation is a declaration by the author. The VALUE here
//     is high-entropy on purpose: the annotation, not the shape, is what silences it.
const API_KEY = "abc123def456ghi789"; // #nosec 101 -- a test fixture, not a secret

module.exports = { apiKey, clientSecret, token, API_KEY, DATABASE_PASSWORD };
