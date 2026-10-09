// security-secret-in-code-1 NEGATIVE — PATH noise, the class that produced 63% of
// the sweep's credential findings. Each value here is a realistic-looking secret,
// so only the PATH keeps the rule quiet. This file lives in `tests/`, whose value
// is a fixture: a rule that reports it trains the reader to ignore the rule.
const api_key = "AKIAIOSFODNN7EXAMPLE";

module.exports = { api_key };
