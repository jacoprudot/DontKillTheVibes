// security-secret-in-history-2 NEGATIVE — a FIXTURE path inside the history. The
// value is a realistic-looking key, so only the credential policy's path class
// keeps the history scan silent. `tests/` is NOT in HISTORY_SKIP_TEST_DIRS
// (`__tests__`/`fixtures` only), so this line reaches the policy.
const api_key = "AKIAIOSFODNN7EXAMPLE";
