import { PathGuard } from './path-guard.js';
import { execFileSync } from 'child_process';
import { statSync } from 'fs';

export class GitWrapper {
  constructor(private pathGuard: PathGuard) {}

  /**
   * Validates a git ref (commit SHA, HEAD, branch/tag name).
   * Rejects anything that could be interpreted as a shell metacharacter
   * or a command-line option. All commands run without a shell
   * (execFileSync), so this is defense-in-depth.
   */
  static validateRef(ref: string): string {
    if (/^[0-9a-f]{7,40}$/i.test(ref)) {
      return ref;
    }
    // Allow refs like HEAD, main, feature/foo, v1.2.3
    if (
      /^[A-Za-z0-9._\/-]+$/.test(ref) &&
      !ref.includes('..') &&
      !ref.startsWith('-')
    ) {
      return ref;
    }
    throw new Error(`Invalid git ref: ${ref}`);
  }

  /**
   * Validates a git pathspec (single relative path used with `--`).
   */
  static validatePathspec(pathspec: string): string {
    if (
      /^[A-Za-z0-9._\/\\-]+$/.test(pathspec) &&
      !pathspec.split(/[\/\\]/).includes('..') &&
      !pathspec.startsWith('-')
    ) {
      return pathspec;
    }
    throw new Error(`Invalid pathspec: ${pathspec}`);
  }

  /**
   * Executes a git command safely
   */
  private execGit(args: string[]): string {
    try {
      const result = execFileSync('git', args, { 
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      });
      return result.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git command failed: ${error.message}`);
      }
      throw new Error('Git command failed');
    }
  }

  /**
   * Gets blame information for a file
   */
  async getBlame(filePath: string, startLine?: number, endLine?: number) {
    // Validate file path
    const safePath = this.pathGuard.resolveSafePath(filePath);
    
    // Check if file exists
    if (!this.pathGuard.isFile(safePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Build git blame command
    const args = ['blame', '--porcelain'];
    if (startLine !== undefined && endLine !== undefined) {
      if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
        throw new Error(`Invalid line range: ${startLine}-${endLine}`);
      }
      args.push(`-L`, `${startLine},${endLine}`);
    } else if (startLine !== undefined) {
      if (!Number.isInteger(startLine) || startLine < 1) {
        throw new Error(`Invalid start line: ${startLine}`);
      }
      args.push(`-L`, `${startLine}`);
    }
    args.push(safePath);
    
    const result = this.execGit(args);
    return this.parseBlameResult(result);
  }

  /**
   * Gets diff since a specific commit
   */
  async getDiffSince(sinceCommit: string, paths?: string) {
    // Validate git ref and pathspec before use
    GitWrapper.validateRef(sinceCommit);
    if (paths) {
      GitWrapper.validatePathspec(paths);
    }

    // Build git diff command
    const args = ['diff', sinceCommit, '--'];
    if (paths) {
      args.push(paths);
    } else {
      args.push('.');
    }
    
    const result = this.execGit(args);
    return this.parseDiffResult(result);
  }

  /**
   * Gets branch tree structure
   */
  async getBranchTree(maxDepth?: number) {
    // Get all branches
    const branchesResult = this.execGit(['branch', '--list']);
    const branches = branchesResult
      .split('\n')
      .map(b => b.trim().replace(/^[\*\s]+/, '')) // Remove * and leading spaces
      .filter(b => b.length > 0);
    
    // Get commit info for each branch
    const branchInfo: Array<{ name: string; commit: string; ahead: number; behind: number }> = [];
    
    for (const branchName of branches) {
      try {
        // Skip branch names that don't pass ref validation
        GitWrapper.validateRef(branchName);

        // Get latest commit for branch
        const commitResult = this.execGit(['rev-parse', branchName]);
        const commit = commitResult.trim();
        
        // Calculate ahead/behind compared to main/master
        let ahead = 0;
        let behind = 0;
        try {
          const mergeBaseResult = this.execGit(['merge-base', 'HEAD', branchName]);
          const mergeBase = mergeBaseResult.trim();
          
          const aheadResult = this.execGit(['rev-list', '--count', `${mergeBase}..${branchName}`]);
          ahead = aheadResult ? parseInt(aheadResult.trim()) : 0;
          
          const behindResult = this.execGit(['rev-list', '--count', `${branchName}..${mergeBase}`]);
          behind = behindResult ? parseInt(behindResult.trim()) : 0;
        } catch (e) {
          // If we can't calculate ahead/behind, continue with zeros
        }
        
        branchInfo.push({
          name: branchName,
          commit,
          ahead,
          behind
        });
      } catch (e) {
        // Skip branches we can't process
        continue;
      }
    }
    
    // Sort by name
    branchInfo.sort((a, b) => a.name.localeCompare(b.name));
    
    // Apply max_depth if specified (simplified - would need actual tree structure for real implementation)
    if (maxDepth !== undefined && maxDepth >= 0) {
      // For simplicity, just limit the number of branches returned
      // In a real implementation, this would refer to actual branch hierarchy depth
      if (branchInfo.length > maxDepth) {
        branchInfo.length = maxDepth;
      }
    }
    
    return branchInfo;
  }

  /**
   * Finds files larger than a specified size
   */
  async findLargeFiles(sizeThresholdMb?: number) {
    const thresholdBytes = (sizeThresholdMb || 10) * 1024 * 1024; // Default 10MB
    
    // Get all files in repository
    const lsFilesResult = this.execGit(['ls-files']);
    const filePaths = lsFilesResult
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
    
    const largeFiles: Array<{ path: string; size_mb: number; commit: string }> = [];
    
    for (const filePath of filePaths) {
      try {
        // Validate file path
        const safePath = this.pathGuard.resolveSafePath(filePath);
        
        // Check if it's a file
        if (!this.pathGuard.isFile(safePath)) {
          continue;
        }
        
        // Get file size
        const stats = statSync(safePath);
        
        const sizeBytes = stats.size;
        if (sizeBytes >= thresholdBytes) {
          // Get latest commit for this file
          try {
            const commitResult = this.execGit(['log', '-1', '--format=%H', '--', filePath]);
            const commit = commitResult.trim();
            
            largeFiles.push({
              path: filePath,
              size_mb: sizeBytes / (1024 * 1024),
              commit
            });
          } catch (e) {
            // If we can't get commit, still include the file
            largeFiles.push({
              path: filePath,
              size_mb: sizeBytes / (1024 * 1024),
              commit: 'unknown'
            });
          }
        }
      } catch (e) {
        // Skip files we can't process
        continue;
      }
    }
    
    // Sort by size descending
    largeFiles.sort((a, b) => b.size_mb - a.size_mb);
    
    return largeFiles;
  }

  /**
   * Parses blame result from git blame --porcelain
   */
  private parseBlameResult(result: string): any {
    // Simplified parser - in production would be more robust
    const lines = result.split('\n');
    const blameInfo: Array<{
      line: number;
      commit: string;
      author: string;
      time: number;
      content: string
    }> = [];
    
    let currentLine = 0;
    let currentCommit = '';
    let currentAuthor = '';
    let currentTime = 0;
    
    for (const line of lines) {
      // Commit line: 40-character hex SHA-1
      if (/^[0-9a-f]{40}/.test(line)) {
        const parts = line.split(' ');
        if (parts.length >= 1) {
          currentCommit = parts[0] || '';
        }
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        const timeStr = line.substring(12);
        currentTime = timeStr ? parseInt(timeStr) * 1000 : 0; // Convert to milliseconds
      } else if (line.startsWith('\t')) {
        // Actual content line
        currentLine++;
        blameInfo.push({
          line: currentLine,
          commit: currentCommit,
          author: currentAuthor,
          time: currentTime,
          content: line.substring(1)
        });
      }
    }
    
    return blameInfo;
  }

  /**
   * Parses diff result from git diff
   */
  private parseDiffResult(result: string): any {
    // Simplified parser - in production would be more robust
    const files: Array<{
      path: string;
      additions: number;
      deletions: number;
      diff: string
    }> = [];
    
    let currentFile: { path: string; additions: number; deletions: number; diff: string } | null = null;
    let currentDiffLines: string[] = [];
    
    const lines = result.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // Save previous file if exists
        if (currentFile) {
          currentFile.diff = currentDiffLines.join('\n');
          files.push(currentFile);
        }
        
        // Start new file
        const parts = line.split(' ');
        if (parts.length >= 4) {
          // Using non-null assertion operator since we've checked length >= 4
          const fromPath = parts[2]!.slice(2); // Remove 'b/'
          const toPath = parts[3]!.slice(2);   // Remove 'b/'
          currentFile = {
            path: toPath,
            additions: 0,
            deletions: 0,
            diff: ''
          };
          currentDiffLines = [];
        }
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        // Skip these lines
        continue;
      } else if (line.startsWith('+')) {
        if (currentFile) {
          currentFile.additions++;
          currentDiffLines.push(line);
        }
      } else if (line.startsWith('-')) {
        if (currentFile) {
          currentFile.deletions++;
          currentDiffLines.push(line);
        }
      } else {
        if (currentFile) {
          currentDiffLines.push(line);
        }
      }
    }
    
    // Don't forget the last file
    if (currentFile) {
      currentFile.diff = currentDiffLines.join('\n');
      files.push(currentFile);
    }
    
    return { files };
  }
}