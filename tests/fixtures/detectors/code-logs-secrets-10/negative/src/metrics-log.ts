// code-logs-secrets-10 negative (2026-10-09 adjudication regressions):
// - 'Max tokens' logs a numeric LIMIT, not a credential value (Jaco id 3/17).
// - tokenLength logs a length, not the token (Jaco id 3).
// - '[api-keys] DELETE error' names the resource in a generic error log (Jaco ids 19-21).
// None of these may fire.
export function logMetrics(apiRequest: { max_tokens: number }, state: { tokenLength: number }) {
  console.log('Max tokens:', apiRequest.max_tokens);
  logger.info({ tokenLength: state.tokenLength });
  console.error('[api-keys] DELETE error:', new Error('not found'));
}
