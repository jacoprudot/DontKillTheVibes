import jwt from 'jsonwebtoken';

// Real case-study shape: signing tokens with a publicly known default.
export const sign = (id: string) =>
  jwt.sign({ user: { id } }, process.env.JWT_SECRET || 'superSecret', {
    expiresIn: '1h',
  });
