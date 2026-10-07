// Correct: read the secret, fail at boot if missing. MUST NOT fire.
export const getSecret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is required at boot');
  return s;
};

export const auth = {
  secret: getSecret(),
};
