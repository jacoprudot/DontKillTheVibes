// github-log-pattern-6 negative (ronda 3, 2026-10-12 adjudication): TypeScript
// type unions declaring log-level literals, not runtime config pinning debug.
// exclude_line_pattern removes type-declaration lines — this file must NOT fire.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  level: LogLevel;
}

export function makeLogger(config: LoggerConfig) {
  return { level: config.level };
}
