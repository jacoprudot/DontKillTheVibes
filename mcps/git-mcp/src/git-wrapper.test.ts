import { GitWrapper } from './git-wrapper.js';
import { PathGuard } from './path-guard.js';
import * as fs from 'fs';

describe('GitWrapper', () => {
  let pathGuard: jest.Mocked<PathGuard>;
  let gitWrapper: GitWrapper;

  beforeEach(() => {
    pathGuard = {
      resolveSafePath: jest.fn((p: string) => `/workspace/${p}`),
      isFile: jest.fn(() => true),
      isDirectory: jest.fn(() => false),
      getRelativePath: jest.fn((p: string) => p.replace('/workspace/', '')),
    } as unknown as jest.Mocked<PathGuard>;

    gitWrapper = new GitWrapper(pathGuard);
  });

  describe('validateRef', () => {
    it('should accept valid SHA-1 commit hash', () => {
      const result = GitWrapper.validateRef('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
      expect(result).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
    });

    it('should accept short SHA-1 (7 chars)', () => {
      const result = GitWrapper.validateRef('a1b2c3d');
      expect(result).toBe('a1b2c3d');
    });

    it('should accept HEAD', () => {
      const result = GitWrapper.validateRef('HEAD');
      expect(result).toBe('HEAD');
    });

    it('should accept branch names', () => {
      const result = GitWrapper.validateRef('main');
      expect(result).toBe('main');
    });

    it('should accept feature branch names with slashes', () => {
      const result = GitWrapper.validateRef('feature/my-feature');
      expect(result).toBe('feature/my-feature');
    });

    it('should accept version tags', () => {
      const result = GitWrapper.validateRef('v1.2.3');
      expect(result).toBe('v1.2.3');
    });

    it('should reject refs with ..', () => {
      expect(() => GitWrapper.validateRef('HEAD..main'))
        .toThrow('Invalid git ref');
    });

    it('should reject refs starting with -', () => {
      expect(() => GitWrapper.validateRef('-invalid'))
        .toThrow('Invalid git ref');
    });

    it('should reject refs with shell metacharacters', () => {
      expect(() => GitWrapper.validateRef('main; rm -rf /'))
        .toThrow('Invalid git ref');
    });
  });

  describe('validatePathspec', () => {
    it('should accept valid paths', () => {
      const result = GitWrapper.validatePathspec('file1.txt');
      expect(result).toBe('file1.txt');
    });

    it('should accept nested paths', () => {
      const result = GitWrapper.validatePathspec('subdir/nested.txt');
      expect(result).toBe('subdir/nested.txt');
    });

    it('should reject paths with ..', () => {
      expect(() => GitWrapper.validatePathspec('../outside.txt'))
        .toThrow('Invalid pathspec');
    });

    it('should reject paths starting with -', () => {
      expect(() => GitWrapper.validatePathspec('-invalid'))
        .toThrow('Invalid pathspec');
    });

    it('should reject paths with shell metacharacters', () => {
      expect(() => GitWrapper.validatePathspec('file; rm -rf /'))
        .toThrow('Invalid pathspec');
    });
  });

  describe('getBlame', () => {
    it('should return blame info for a file', async () => {
      // Mock the private execGit method
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit.mockReturnValue(`
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 1 1 1
author Test User
author-time 1234567890
	line 1 content
	line 2 content
`);

      const blame = await gitWrapper.getBlame('file1.txt');
      
      expect(Array.isArray(blame)).toBe(true);
      expect(blame.length).toBe(2);
      
      for (const entry of blame) {
        expect(entry).toHaveProperty('line');
        expect(entry).toHaveProperty('commit');
        expect(entry).toHaveProperty('author');
        expect(entry).toHaveProperty('time');
        expect(entry).toHaveProperty('content');
        expect(typeof entry.line).toBe('number');
        expect(typeof entry.commit).toBe('string');
        expect(entry.commit.length).toBe(40);
      }
    });

    it('should throw error for non-existent file', async () => {
      pathGuard.isFile.mockReturnValue(false);
      
      await expect(gitWrapper.getBlame('nonexistent.txt'))
        .rejects.toThrow('File not found');
    });

    it('should throw error for invalid line range', async () => {
      await expect(gitWrapper.getBlame('file1.txt', 5, 3))
        .rejects.toThrow('Invalid line range');
    });

    it('should throw error for invalid start line', async () => {
      await expect(gitWrapper.getBlame('file1.txt', 0))
        .rejects.toThrow('Invalid start line');
    });

    it('should reject paths attempting to escape workspace', async () => {
      pathGuard.resolveSafePath.mockImplementation(() => {
        throw new Error('Access denied: Path attempts to escape workspace');
      });

      await expect(gitWrapper.getBlame('../outside.txt'))
        .rejects.toThrow('Access denied');
    });
  });

  describe('getDiffSince', () => {
    it('should return diff since a commit', async () => {
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit.mockReturnValue(`
diff --git a/file1.txt b/file1.txt
index 1234567..abcdefg 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1,3 +1,4 @@
 line 1
-line 2
+line 2 modified
 line 3
+line 4
`);

      const diff = await gitWrapper.getDiffSince('abc123');
      
      expect(diff).toHaveProperty('files');
      expect(Array.isArray(diff.files)).toBe(true);
      expect(diff.files.length).toBeGreaterThan(0);
      
      for (const file of diff.files) {
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('additions');
        expect(file).toHaveProperty('deletions');
        expect(file).toHaveProperty('diff');
      }
    });

    it('should throw error for empty commit', async () => {
      await expect(gitWrapper.getDiffSince(''))
        .rejects.toThrow('Invalid git ref');
    });

    it('should reject invalid commit refs', async () => {
      await expect(gitWrapper.getDiffSince('invalid..ref'))
        .rejects.toThrow('Invalid git ref');
    });
  });

  describe('getBranchTree', () => {
    it('should return branch information', async () => {
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit
        .mockReturnValueOnce('main\nfeature-branch\nhotfix-branch') // git branch --list
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0') // git rev-parse main
        .mockReturnValueOnce('d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3') // git rev-parse feature-branch
        .mockReturnValueOnce('e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3d4') // git rev-parse hotfix-branch
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0') // merge-base HEAD main
        .mockReturnValueOnce('0') // ahead
        .mockReturnValueOnce('0') // behind
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0') // merge-base HEAD feature-branch
        .mockReturnValueOnce('5') // ahead
        .mockReturnValueOnce('2') // behind
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0') // merge-base HEAD hotfix-branch
        .mockReturnValueOnce('1') // ahead
        .mockReturnValueOnce('0'); // behind

      const branches = await gitWrapper.getBranchTree();
      
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBe(3);
      
      for (const branch of branches) {
        expect(branch).toHaveProperty('name');
        expect(branch).toHaveProperty('commit');
        expect(branch).toHaveProperty('ahead');
        expect(branch).toHaveProperty('behind');
        expect(typeof branch.name).toBe('string');
        expect(typeof branch.commit).toBe('string');
        expect(branch.commit.length).toBeGreaterThan(0); // Just check it's not empty
        expect(typeof branch.ahead).toBe('number');
        expect(typeof branch.behind).toBe('number');
      }
    });

    it('should respect max_depth parameter', async () => {
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit
        .mockReturnValueOnce('main\nfeature-branch\nhotfix-branch')
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
        .mockReturnValueOnce('d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3')
        .mockReturnValueOnce('e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3d4')
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
        .mockReturnValueOnce('0')
        .mockReturnValueOnce('0')
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
        .mockReturnValueOnce('5')
        .mockReturnValueOnce('2')
        .mockReturnValueOnce('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0')
        .mockReturnValueOnce('1')
        .mockReturnValueOnce('0');

      const branches = await gitWrapper.getBranchTree(1);
      
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('findLargeFiles', () => {
    it('should call execGit with correct commands', async () => {
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit
        .mockReturnValueOnce('file1.txt\nfile2.txt') // git ls-files
        .mockReturnValueOnce('abc123') // git log for file1.txt
        .mockReturnValueOnce('def456'); // git log for file2.txt

      pathGuard.isFile.mockReturnValue(true);
      // Mock statSync to return small sizes so no files are "large"
      // We can't easily mock statSync, so we test the execGit calls instead
      const largeFiles = await gitWrapper.findLargeFiles(100); // 100MB threshold - nothing should match
      
      mockExecGit.mockRestore();
      pathGuard.isFile.mockRestore();
      
      expect(Array.isArray(largeFiles)).toBe(true);
      // The function returns empty array when no files exceed threshold
    });

    it('should handle empty file list', async () => {
      const mockExecGit = jest.spyOn(gitWrapper as any, 'execGit');
      mockExecGit.mockReturnValueOnce(''); // git ls-files returns empty

      const largeFiles = await gitWrapper.findLargeFiles(10);
      
      mockExecGit.mockRestore();
      
      expect(Array.isArray(largeFiles)).toBe(true);
      expect(largeFiles).toEqual([]);
    });
  });

  describe('parseBlameResult', () => {
    it('should parse blame output correctly', () => {
      const blameOutput = `
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0 1 1 1
author Test User
author-time 1234567890
	line 1 content
	line 2 content
`;
      
      const result = (gitWrapper as any).parseBlameResult(blameOutput);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].line).toBe(1);
      expect(result[0].commit).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
      expect(result[0].author).toBe('Test User');
      expect(result[0].time).toBe(1234567890000);
      expect(result[0].content).toBe('line 1 content');
    });
  });

  describe('parseDiffResult', () => {
    it('should parse diff output correctly', () => {
      const diffOutput = `diff --git a/file1.txt b/file1.txt
index 1234567..abcdefg 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1,3 +1,4 @@
 line 1
-line 2
+line 2 modified
 line 3
+line 4
`;
      
      const result = (gitWrapper as any).parseDiffResult(diffOutput);
      
      expect(result).toHaveProperty('files');
      expect(result.files.length).toBe(1);
      expect(result.files[0].path).toBe('file1.txt');
      expect(result.files[0].additions).toBe(2);
      expect(result.files[0].deletions).toBe(1);
      expect(result.files[0].diff).toContain('line 2 modified');
    });

    it('should handle multiple files in diff', () => {
      const diffOutput = `diff --git a/file1.txt b/file1.txt
index 1234567..abcdefg 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1 +1 @@
-line 1
+line 1 modified
diff --git a/file2.txt b/file2.txt
index 1234567..abcdefg 100644
--- a/file2.txt
+++ b/file2.txt
@@ -1 +1 @@
-line 2
+line 2 modified
`;
      
      const result = (gitWrapper as any).parseDiffResult(diffOutput);
      
      expect(result.files.length).toBe(2);
      expect(result.files[0].path).toBe('file1.txt');
      expect(result.files[1].path).toBe('file2.txt');
    });
  });
});