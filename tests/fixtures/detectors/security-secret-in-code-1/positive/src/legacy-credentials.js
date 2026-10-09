// security-secret-in-code-1 POSITIVE — the policy must NOT swallow a real
// credential. Every value below is high-entropy and shaped like the real thing,
// and none of them sits in an excluded path.
//
// (a) a key whose name matched a placeholder word but whose VALUE is a secret:
//     `placeholder` shapes are rejected on the value, never on the key name.
const LEGACY_CLOUD_SECRET = "AKIA4T7YQ2W9ZP1LMN6R";

// (b) a mixed-class value with a single quote-free body, 16+ characters.
const service_token = "sk-live-9f3aB2cD4eF6gH8iJ0kL";

// (c) an .env-style assignment in a source file.
DB_PASSWORD = "q7Zt2Xk9Wm4Pv8Rn1Ls5Yb3Hd6Gf0Jc";

export { LEGACY_CLOUD_SECRET, service_token };
