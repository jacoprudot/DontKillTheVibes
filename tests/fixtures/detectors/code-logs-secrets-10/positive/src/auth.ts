// code-logs-secrets-10 positive: the debug log prints the submitted password, so this file MUST fire.
import type { Request, Response } from 'express';
import { verifyPassword } from './passwords';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  console.log('login attempt', email, password);

  const ok = await verifyPassword(email, password);
  if (!ok) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }
  res.json({ ok: true });
}
