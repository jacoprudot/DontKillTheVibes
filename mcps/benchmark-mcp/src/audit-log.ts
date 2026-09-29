import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

/**
 * Minimal audit log: appends one JSON line per tool invocation to
 * .dontkillthevibes/audit.log in the workspace root.
 * Only hashes of args/results are recorded — never the content itself.
 * Failures are swallowed: auditing must never break a tool call.
 */
function hash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .substring(0, 16);
}

export function logAudit(tool: string, args: unknown, result: unknown): void {
  try {
    const dir = path.join(process.cwd(), '.dontkillthevibes');
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      tool,
      args_hash: hash(args),
      result_hash: hash(result)
    });
    fs.appendFileSync(path.join(dir, 'audit.log'), line + '\n', 'utf8');
  } catch {
    // Ignore audit failures
  }
}
