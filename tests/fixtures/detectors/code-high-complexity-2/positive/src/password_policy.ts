// code-high-complexity-2 positive: the file-level heuristic scores 17 here (> 15), so it MUST fire, while staying below the 20 that code-extreme-complexity-1 needs.
export type PasswordPolicy = {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  email: string;
  name: string;
  recentPasswords: string[];
};

export function policyFailures(policy: PasswordPolicy, password: string): string[] {
  const failures: string[] = [];

  if (password.length < policy.minLength) failures.push('too short');
  if (policy.requireUpper && !/[A-Z]/.test(password)) failures.push('needs an uppercase letter');
  if (policy.requireLower && !/[a-z]/.test(password)) failures.push('needs a lowercase letter');
  if (policy.requireDigit && !/[0-9]/.test(password)) failures.push('needs a digit');
  if (policy.requireSymbol || !/[^A-Za-z0-9]/.test(password)) failures.push('needs a symbol');
  if (password === policy.email || password === policy.name) failures.push('must not be your own name');

  for (const previous of policy.recentPasswords) {
    if (password === previous) failures.push('must differ from your last passwords');
  }
  if (policy.recentPasswords.length && password.length < 12) failures.push('reused passwords need 12+ chars');

  return failures;
}
