import { logAudit } from './audit-log.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Audit Log', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditlog-test-'));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean up audit log before each test
    const auditDir = path.join(tempDir, '.dontkillthevibes');
    if (fs.existsSync(auditDir)) {
      fs.rmSync(auditDir, { recursive: true, force: true });
    }
    // Mock process.cwd to return our temp dir
    jest.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create audit directory and log file', () => {
    logAudit('test_tool', { arg: 'value' }, { success: true });
    
    const auditDir = path.join(tempDir, '.dontkillthevibes');
    const auditLog = path.join(auditDir, 'audit.log');
    
    expect(fs.existsSync(auditDir)).toBe(true);
    expect(fs.existsSync(auditLog)).toBe(true);
  });

  it('should log tool name, args hash, and result hash', () => {
    logAudit('test_tool', { file: 'test.txt' }, { success: true, data: [] });
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8').trim();
    const entry = JSON.parse(content);
    
    expect(entry).toHaveProperty('ts');
    expect(entry).toHaveProperty('tool', 'test_tool');
    expect(entry).toHaveProperty('args_hash');
    expect(entry).toHaveProperty('result_hash');
    expect(typeof entry.args_hash).toBe('string');
    expect(typeof entry.result_hash).toBe('string');
    expect(entry.args_hash.length).toBe(16); // SHA256 truncated to 16 chars
    expect(entry.result_hash.length).toBe(16);
  });

  it('should not log actual content, only hashes', () => {
    const sensitiveArgs = { apiKey: 'secret-key-12345' };
    const sensitiveResult = { data: 'confidential-data' };
    
    logAudit('test_tool', sensitiveArgs, sensitiveResult);
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8');
    
    expect(content).not.toContain('secret-key-12345');
    expect(content).not.toContain('confidential-data');
    expect(content).not.toContain('apiKey');
  });

  it('should handle null args and result', () => {
    logAudit('test_tool', null, null);
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8').trim();
    const entry = JSON.parse(content);
    
    expect(entry.args_hash).toBeDefined();
    expect(entry.result_hash).toBeDefined();
  });

  it('should append multiple entries', () => {
    logAudit('tool1', { a: 1 }, { success: true });
    logAudit('tool2', { b: 2 }, { success: true });
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8').trim();
    const lines = content.split('\n');
    
    expect(lines.length).toBe(2);
    
    const entry1 = JSON.parse(String(lines[0]));
    const entry2 = JSON.parse(String(lines[1]));
    
    expect(entry1.tool).toBe('tool1');
    expect(entry2.tool).toBe('tool2');
  });

  it('should not throw on filesystem errors', () => {
    // Make the audit directory read-only to simulate error
    const auditDir = path.join(tempDir, '.dontkillthevibes');
    fs.mkdirSync(auditDir, { recursive: true });
    fs.chmodSync(auditDir, 0o444);
    
    // This should not throw
    expect(() => logAudit('test_tool', {}, {})).not.toThrow();
    
    // Restore permissions for cleanup
    fs.chmodSync(auditDir, 0o755);
  });

  it('should generate different hashes for different inputs', () => {
    logAudit('tool', { value: 1 }, { data: 'a' });
    logAudit('tool', { value: 2 }, { data: 'b' });
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8').trim();
    const lines = content.split('\n');
    
    // lines is string[], but TypeScript doesn't know it's non-empty
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const entry1 = JSON.parse(String(lines[0]));
    const entry2 = JSON.parse(String(lines[1]));
    
    expect(entry1.args_hash).not.toBe(entry2.args_hash);
    expect(entry1.result_hash).not.toBe(entry2.result_hash);
  });

  it('should include timestamp in ISO format', () => {
    logAudit('test_tool', {}, {});
    
    const auditLog = path.join(tempDir, '.dontkillthevibes', 'audit.log');
    const content = fs.readFileSync(auditLog, 'utf8').trim();
    const entry = JSON.parse(content);
    
    expect(entry.ts).toBeDefined();
    // Verify it's a valid ISO timestamp
    const date = new Date(entry.ts);
    expect(date.toString()).not.toBe('Invalid Date');
    expect(date.getTime()).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds
  });
});