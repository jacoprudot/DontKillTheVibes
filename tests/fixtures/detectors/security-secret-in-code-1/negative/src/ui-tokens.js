// security-secret-in-code-1 negative (2026-10-09 adjudication regressions):
// the keyword must not match as the TAIL of a camelCase identifier (GLM ids
// 240, 241). These name styling tokens and benchmark snapshots, not
// credentials, and must NOT fire. (Ids 259/260 — the `++counter` forms — live
// in counter-token.ts; ids 261–264 were prose verdicts without a surviving
// line, no fixture asserts them.)
export function themeTokens() {
  const colorToken = '--pg-c-objective';
  const policySnapshotToken = 'bundle-bench-snapshot';
  return { colorToken, policySnapshotToken };
}
