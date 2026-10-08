// code-logs-secrets-10 negative: the secret noun appears INSIDE the log message — the message
// names the token, it does not carry its value — so it must NOT fire. This is the measured
// defect 5: `logger.error("token refresh failed for the user")` fired before, because the
// pattern stopped at the noun and never asked whether a VALUE followed it. The old fixture
// kept the trigger words in the comment above the call instead, which tested the comment,
// not the log line.
import { logger } from './logger';

export function logLoginFailure(email: string, reason: string) {
  logger.error('token refresh failed for the user');
  logger.warn('login failed for', email, reason);
}
