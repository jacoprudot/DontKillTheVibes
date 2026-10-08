// code-empty-catch-1 negative: the catch has a body that logs the error, so it must NOT fire even though a naive `catch (err) {` scan would flag it.
import { readFileSync } from 'node:fs';

type AppConfig = {
  port: number;
  logLevel: string;
};

export function loadConfig(path: string): AppConfig {
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw) as AppConfig;
  } catch (err) {
    console.warn(`invalid config at ${path}, falling back to defaults`, err);
    return { port: 3000, logLevel: 'info' };
  }
}
