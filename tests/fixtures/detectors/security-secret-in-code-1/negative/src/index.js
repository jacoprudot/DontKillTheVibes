import { config } from './config.js';

export function main() {
  console.log(`starting demo-app (log level: ${config.logLevel})`);
  return config.logLevel;
}

main();
