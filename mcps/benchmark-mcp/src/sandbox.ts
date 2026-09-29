import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

export class Sandbox {
  private workspaceRoot: string;
  private tempDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    
    // Create a temporary directory for sandbox operations
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dontkillthevibes-'));

    // Ensure the temp dir does not leak if the process exits without cleanup()
    process.on('exit', () => {
      try {
        fs.rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup on exit
      }
    });
    
    // Ensure workspace root exists
    if (!fs.existsSync(this.workspaceRoot)) {
      throw new Error(`Workspace root does not exist: ${this.workspaceRoot}`);
    }
  }

  /**
   * Gets a safe path within the sandbox temp directory
   */
  getTempPath(subPath: string = ''): string {
    return path.join(this.tempDir, subPath);
  }

  /**
   * Executes a command in the sandbox with restrictions
   */
  execSandbox(bin: string, args: string[], options: { timeout?: number; env?: NodeJS.ProcessEnv; cwd?: string } = {}): string {
    try {
      // Caller-supplied env is applied FIRST, then the safe fields are
      // forced on top so options can never override PATH/HOME/TMPDIR.
      // No process.env spread: only a minimal, non-sensitive environment
      // is passed to the child.
      const restrictedEnv: NodeJS.ProcessEnv = {
        ...(options.env || {}),
        PATH: process.env.PATH || '',
        HOME: this.tempDir,
        TMPDIR: this.tempDir
      };

      // Execute command in sandbox safely without shell
      const result = execFileSync(bin, args, {
        timeout: options.timeout || 30000, // 30 seconds default
        env: restrictedEnv,
        cwd: options.cwd || this.tempDir,
        encoding: 'utf8'
      });
      
      return result.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Sandbox command failed: ${error.message}`);
      }
      throw new Error('Sandbox command failed');
    }
  }

  /**
   * Creates a temporary file in the sandbox
   */
  createTempFile(prefix: string = 'tmp', suffix: string = ''): string {
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${suffix}`;
    return path.join(this.tempDir, filename);
  }

  /**
   * Creates a temporary directory in the sandbox
   */
  createTempDir(prefix: string = 'tmp'): string {
    const dirname = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const dirPath = path.join(this.tempDir, dirname);
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }

  /**
   * Cleans up the sandbox (called when instance is destroyed)
   */
  cleanup() {
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  /**
   * Gets the workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}