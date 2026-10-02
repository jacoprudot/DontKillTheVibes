import { Sandbox } from './sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Sandbox', () => {
  let tempWorkspace: string;
  let sandbox: Sandbox;

  beforeAll(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-test-workspace-'));
    sandbox = new Sandbox(tempWorkspace);
  });

  afterAll(() => {
    sandbox.cleanup();
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create a temp directory', () => {
      expect(fs.existsSync(sandbox.getTempPath())).toBe(true);
    });

    it('should set workspace root', () => {
      expect(sandbox.getWorkspaceRoot()).toBe(tempWorkspace);
    });

    it('should throw for non-existent workspace', () => {
      expect(() => new Sandbox('/non/existent/path'))
        .toThrow('Workspace root does not exist');
    });
  });

  describe('getTempPath', () => {
    it('should return temp directory for empty subpath', () => {
      const result = sandbox.getTempPath();
      expect(result).toBe(sandbox.getTempPath());
    });

    it('should return path within temp directory', () => {
      const result = sandbox.getTempPath('subdir/file.txt');
      expect(result).toContain(sandbox.getTempPath());
      // On Windows, path separators are backslashes
      expect(result.replace(/\\/g, '/')).toContain('subdir/file.txt');
    });
  });

  describe('createTempFile', () => {
    it('should create a unique temp file path', () => {
      const file1 = sandbox.createTempFile('prefix', '.suffix');
      const file2 = sandbox.createTempFile('prefix', '.suffix');
      
      expect(file1).toContain(sandbox.getTempPath());
      expect(file1).toContain('prefix');
      expect(file1).toContain('.suffix');
      expect(file1).not.toBe(file2);
    });

    it('should create file with default prefix/suffix', () => {
      const file = sandbox.createTempFile();
      expect(file).toContain(sandbox.getTempPath());
      expect(file).toContain('tmp');
    });
  });

  describe('createTempDir', () => {
    it('should create a unique temp directory', () => {
      const dir1 = sandbox.createTempDir('myprefix');
      const dir2 = sandbox.createTempDir('myprefix');
      
      expect(dir1).toContain(sandbox.getTempPath());
      expect(dir1).toContain('myprefix');
      expect(dir1).not.toBe(dir2);
      
      // Directory should exist
      expect(fs.existsSync(dir1)).toBe(true);
      expect(fs.statSync(dir1).isDirectory()).toBe(true);
    });
  });

  describe('execSandbox', () => {
    it('should execute allowed commands', () => {
      // Use node for cross-platform echo
      const result = sandbox.execSandbox('node', ['-e', 'console.log("hello world")']);
      expect(result.trim()).toBe('hello world');
    });

    it('should execute commands with custom env', () => {
      const result = sandbox.execSandbox('node', ['-e', 'console.log(process.env.TEST_VAR)'], {
        env: { TEST_VAR: 'test-value' }
      });
      expect(result.trim()).toBe('test-value');
    });

    it('should execute commands in custom cwd', () => {
      fs.writeFileSync(path.join(tempWorkspace, 'test-file.txt'), 'workspace content');
      // Use node to read file cross-platform
      const result = sandbox.execSandbox('node', ['-e', 'console.log(require("fs").readFileSync("test-file.txt", "utf8"))'], { cwd: tempWorkspace });
      expect(result.trim()).toBe('workspace content');
    });

    it('should respect timeout', () => {
      // Use a command that takes long time
      expect(() => sandbox.execSandbox('node', ['-e', 'setTimeout(() => {}, 1000)'], { timeout: 100 }))
        .toThrow('Sandbox command failed');
    });

    it('should fail for non-existent commands', () => {
      expect(() => sandbox.execSandbox('nonexistent-command-xyz', []))
        .toThrow('Sandbox command failed');
    });

    it('should enforce restricted environment', () => {
      const result = sandbox.execSandbox('node', ['-e', 'console.log(process.env.HOME)']);
      expect(result.trim()).toBe(sandbox.getTempPath());
    });
  });

  describe('cleanup', () => {
    it('should remove temp directory', () => {
      const tempDir = sandbox.getTempPath();
      sandbox.cleanup();
      expect(fs.existsSync(tempDir)).toBe(false);
    });

    it('should be idempotent', () => {
      sandbox.cleanup();
      sandbox.cleanup(); // Should not throw
      expect(true).toBe(true);
    });
  });
});