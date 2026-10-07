import jwt from 'jsonwebtoken';

// Correct: no fallback literal anywhere. MUST NOT fire.
export const sign = (id: string, secret: string) =>
  jwt.sign({ user: { id } }, secret, { expiresIn: '1h' });

export const verify = (token: string) =>
  jwt.verify(token, process.env.JWT_SECRET!);
