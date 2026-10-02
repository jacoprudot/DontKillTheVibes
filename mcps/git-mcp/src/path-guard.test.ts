import { PathGuard } from './path-guard.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PathGuard', () => {
  let tempDir: string;
  let pathGuard: PathGuard;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathguard-test-'));
    
    // Create some test files/directories
    fs.mkdirSync(path.join(tempDir, 'subdir'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');
    fs.writeFileSync(path.join(tempDir, 'subdir', 'nested.txt'), 'nested content');
    
    pathGuard = new PathGuard(tempDir);
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('resolveSafePath', () => {
    it('should return workspace root for empty path', () => {
      const result = pathGuard.resolveSafePath('');
      expect(result).toBe(tempDir);
    });

    it('should return workspace root for whitespace-only path', () => {
      const result = pathGuard.resolveSafePath('   ');
      expect(result).toBe(tempDir);
    });

    it('should resolve relative paths within workspace', () => {
      const result = pathGuard.resolveSafePath('test.txt');
      expect(result).toBe(path.join(tempDir, 'test.txt'));
    });

    it('should resolve nested paths within workspace', () => {
      const result = pathGuard.resolveSafePath('subdir/nested.txt');
      expect(result).toBe(path.join(tempDir, 'subdir', 'nested.txt'));
    });

    it('should reject paths attempting to escape workspace with ..', () => {
      expect(() => pathGuard.resolveSafePath('../outside.txt'))
        .toThrow('Access denied: Path attempts to escape workspace');
    });

    it('should reject paths with .. in the middle', () => {
      expect(() => pathGuard.resolveSafePath('subdir/../../outside.txt'))
        .toThrow('Access denied: Path attempts to escape workspace');
    });

    it('should reject absolute paths outside workspace', () => {
      const outsidePath = path.join(os.tmpdir(), 'outside.txt');
      expect(() => pathGuard.resolveSafePath(outsidePath))
        .toThrow('Access denied: Path attempts to escape workspace');
    });

    it('should handle paths with trailing slashes', () => {
      const result = pathGuard.resolveSafePath('subdir/');
      expect(result).toBe(path.join(tempDir, 'subdir'));
    });
  });

  describe('isFile', () => {
    it('should return true for existing files', () => {
      expect(pathGuard.isFile(path.join(tempDir, 'test.txt'))).toBe(true);
    });

    it('should return false for directories', () => {
      expect(pathGuard.isFile(path.join(tempDir, 'subdir'))).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      expect(pathGuard.isFile(path.join(tempDir, 'nonexistent.txt'))).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for existing directories', () => {
      expect(pathGuard.isDirectory(path.join(tempDir, 'subdir'))).toBe(true);
    });

    it('should return false for files', () => {
      expect(pathGuard.isDirectory(path.join(tempDir, 'test.txt'))).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      expect(pathGuard.isDirectory(path.join(tempDir, 'nonexistent'))).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from workspace root', () => {
      const absolutePath = path.join(tempDir, 'subdir', 'nested.txt');
      const result = pathGuard.getRelativePath(absolutePath);
      // Normalize to forward slashes for cross-platform comparison
      expect(result.replace(/\\/g, '/')).toBe('subdir/nested.txt');
    });

    it('should return empty string for workspace root', () => {
      const result = pathGuard.getRelativePath(tempDir);
      expect(result).toBe('');
    });
  });

  describe('constructor', () => {
    it('should throw error for non-existent workspace root', () => {
      expect(() => new PathGuard('/this/path/does/not/exist'))
        .toThrow('Workspace root does not exist');
    });

    it('should normalize workspace root path', () => {
      const pg = new PathGuard(path.join(tempDir, '.'));
      expect(pg.getRelativePath(pg.resolveSafePath('test.txt')))
        .toBe('test.txt');
    });
  });
});