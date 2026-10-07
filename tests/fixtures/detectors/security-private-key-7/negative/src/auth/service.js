import fs from 'node:fs';

const publicKey = fs.readFileSync(new URL('../config/jwt.pub', import.meta.url), 'utf8');

export function verifyToken(token) {
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}
