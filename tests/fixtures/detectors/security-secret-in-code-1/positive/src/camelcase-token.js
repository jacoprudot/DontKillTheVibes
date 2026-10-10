// Positive, GLM ronda 2 §5.4 (the camelCase recall net): a real token assigned
// to a camelCase variable (`accessToken`) is the exact shape the main regex's
// lookbehind blinded the rule to. `security-secret-in-code-1` must fire here
// via the recall path — the value is a high-entropy JWT-like string that
// survives the value layer.
export function session() {
  const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  return { headers: { authorization: `Bearer ${accessToken}` } };
}
