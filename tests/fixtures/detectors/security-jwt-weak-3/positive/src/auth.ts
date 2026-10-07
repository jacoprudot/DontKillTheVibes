// The real-world shape that makes this rule matter: an env-var fallback to a
// hardcoded default. MUST fire (all three variants).
export const auth = {
  secret: process.env.JWT_SECRET || 'superSecret',
};

export const alt = process.env.JWT_SECRET ?? 'fallback-secret';

export const config = {
  sessionSecret: 'changeme',
};
