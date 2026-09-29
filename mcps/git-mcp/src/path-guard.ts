import * as path from 'path';
import * as fs from 'fs';

export class PathGuard {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    
    // Ensure workspace root exists
    if (!fs.existsSync(this.workspaceRoot)) {
      throw new Error(`Workspace root does not exist: ${this.workspaceRoot}`);
    }
  }

  /**
   * Resolves a path relative to the workspace root
   * Throws error if path attempts to escape workspace
   */
  resolveSafePath(userPath: string): string {
    // Handle empty path
    if (!userPath || userPath.trim() === '') {
      return this.workspaceRoot;
    }

    // Convert to absolute path relative to workspace
    let absolutePath;
    try {
      absolutePath = path.resolve(this.workspaceRoot, userPath);
    } catch (err) {
      throw new Error(`Invalid path: ${userPath}`);
    }

    // Check if the resolved path is within workspace root
    if (!this.isPathWithinWorkspace(absolutePath)) {
      throw new Error(`Access denied: Path attempts to escape workspace: ${userPath}`);
    }

    return absolutePath;
  }

  /**
   * Checks if a path is within the workspace root
   */
  private isPathWithinWorkspace(testPath: string): boolean {
    // Normalize both paths for comparison
    const workspaceRootNormalized = path.normalize(this.workspaceRoot);
    const testPathNormalized = path.normalize(testPath);
    
    // Check if testPath starts with workspaceRoot
    return testPathNormalized.startsWith(workspaceRootNormalized + path.sep) ||
           testPathNormalized === workspaceRootNormalized;
  }

  /**
   * Gets the relative path from workspace root
   */
  getRelativePath(absolutePath: string): string {
    return path.relative(this.workspaceRoot, absolutePath);
  }

  /**
   * Checks if a path is a directory
   */
  isDirectory(absolutePath: string): boolean {
    try {
      return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
    } catch (err) {
      return false;
    }
  }

  /**
   * Checks if a path is a file
   */
  isFile(absolutePath: string): boolean {
    try {
      return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    } catch (err) {
      return false;
    }
  }
}