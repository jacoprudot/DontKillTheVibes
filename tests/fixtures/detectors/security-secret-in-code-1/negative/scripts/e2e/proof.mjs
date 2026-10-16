// security-secret-in-code-1 NEGATIVE — ronda 5 (2026-10-15) class A:
// an e2e/ path segment AND a value that names itself synthetic. Both signals
// are required; every value below matches the credential regex (>=16 chars)
// and must be suppressed. Shapes invented for this fixture.
const GH_TOKEN = "ephemeral-fixture-token";
const WEBHOOK_SECRET = "loopback-proof-token";
const PROOF_TOKEN = "controlled-ambient-proof";
