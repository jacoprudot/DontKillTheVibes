// code-empty-catch-1 positive: the catch block is empty, so the JSON parse error is swallowed and this file MUST fire.
import { readFileSync } from 'node:fs';

type AppConfig = {
  port: number;
  logLevel: string;
};

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw) as AppConfig;
  } catch (err) {}
  return { port: 3000, logLevel: 'info' };
}
