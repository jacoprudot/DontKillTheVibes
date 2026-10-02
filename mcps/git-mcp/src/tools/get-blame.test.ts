import { getBlame } from './get-blame.js';
import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

describe('getBlame tool', () => {
  let mockGitWrapper: jest.Mocked<GitWrapper>;
  let mockPathGuard: jest.Mocked<PathGuard>;

  beforeEach(() => {
    mockGitWrapper = {
      getBlame: jest.fn(),
    } as any;

    mockPathGuard = {
      resolveSafePath: jest.fn((p: string) => `/workspace/${p}`),
      isFile: jest.fn(() => true),
    } as any;
  });

  it('should return blame info for existing file', async () => {
    mockGitWrapper.getBlame.mockResolvedValue([
      { line: 1, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 1' },
      { line: 2, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 2' },
    ]);

    const result = await getBlame(mockGitWrapper, mockPathGuard, { file: 'test.txt' });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBe(2);
    expect(mockPathGuard.resolveSafePath).toHaveBeenCalledWith('test.txt');
    expect(mockPathGuard.isFile).toHaveBeenCalled();
    expect(mockGitWrapper.getBlame).toHaveBeenCalledWith('test.txt', undefined, undefined);
  });

  it('should return blame info with line range', async () => {
    mockGitWrapper.getBlame.mockResolvedValue([
      { line: 2, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 2' },
      { line: 3, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 3' },
      { line: 4, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 4' },
    ]);

    const result = await getBlame(mockGitWrapper, mockPathGuard, { 
      file: 'test.txt',
      start_line: 2,
      end_line: 4
    });
    
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(3);
    expect(result.data[0].line).toBe(2);
    expect(result.data[2].line).toBe(4);
    expect(mockGitWrapper.getBlame).toHaveBeenCalledWith('test.txt', 2, 4);
  });

  it('should return blame info from start line', async () => {
    mockGitWrapper.getBlame.mockResolvedValue([
      { line: 3, commit: 'abc123', author: 'Test', time: 1234567890, content: 'line 3' },
    ]);

    const result = await getBlame(mockGitWrapper, mockPathGuard, { 
      file: 'test.txt',
      start_line: 3
    });
    
    expect(result.success).toBe(true);
    expect(result.data[0].line).toBe(3);
    expect(mockGitWrapper.getBlame).toHaveBeenCalledWith('test.txt', 3, undefined);
  });

  it('should return FILE_NOT_FOUND for non-existent file', async () => {
    mockPathGuard.isFile.mockReturnValue(false);

    const result = await getBlame(mockGitWrapper, mockPathGuard, { file: 'nonexistent.txt' });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('FILE_NOT_FOUND');
    expect(result.error?.retryable).toBe(false);
    expect(mockGitWrapper.getBlame).not.toHaveBeenCalled();
  });

  it('should return PATH_ACCESS_DENIED for paths escaping workspace', async () => {
    mockPathGuard.resolveSafePath.mockImplementation(() => {
      throw new Error('Access denied: Path attempts to escape workspace');
    });

    const result = await getBlame(mockGitWrapper, mockPathGuard, { file: '../outside.txt' });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PATH_ACCESS_DENIED');
    expect(result.error?.retryable).toBe(false);
  });

  it('should return GET_BLAME_FAILED for git errors', async () => {
    mockGitWrapper.getBlame.mockRejectedValue(new Error('Git command failed'));

    const result = await getBlame(mockGitWrapper, mockPathGuard, { file: 'test.txt' });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('GET_BLAME_FAILED');
    expect(result.error?.retryable).toBe(true);
  });
});