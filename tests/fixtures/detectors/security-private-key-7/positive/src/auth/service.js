import fs from 'node:fs';

const privateKey = fs.readFileSync(new URL('../config/jwt.pem', import.meta.url), 'utf8');

export function signToken(payload) {
  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
}
