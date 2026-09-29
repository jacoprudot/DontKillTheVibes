import * as path from 'path';
import * as fs from 'fs';

/**
 * Mirrors git-mcp's PathGuard: resolves user-supplied paths relative to the
 * workspace root and rejects any path that escapes it (lexical check).
 *
 * Caveat: this is a lexical containment check. A symlink inside the
 * workspace pointing outside is NOT followed by this guard; the check is
 * performed on the resolved path string only.
 */
export class PathGuard {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);

    if (!fs.existsSync(this.workspaceRoot)) {
      throw new Error(`Workspace root does not exist: ${this.workspaceRoot}`);
    }
  }

  resolveSafePath(userPath: string): string {
    if (!userPath || userPath.trim() === '') {
      return this.workspaceRoot;
    }

    let absolutePath: string;
    try {
      absolutePath = path.resolve(this.workspaceRoot, userPath);
    } catch {
      throw new Error(`Invalid path: ${userPath}`);
    }

    const rootNormalized = path.normalize(this.workspaceRoot);
    const testNormalized = path.normalize(absolutePath);

    if (
      testNormalized !== rootNormalized &&
      !testNormalized.startsWith(rootNormalized + path.sep)
    ) {
      throw new Error(`Access denied: Path attempts to escape workspace: ${userPath}`);
    }

    return absolutePath;
  }

  isFile(absolutePath: string): boolean {
    try {
      return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    } catch {
      return false;
    }
  }
}
