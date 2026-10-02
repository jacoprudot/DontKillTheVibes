import { getDiffSince } from './get-diff-since.js';
import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

describe('getDiffSince tool', () => {
  let mockGitWrapper: jest.Mocked<GitWrapper>;
  let mockPathGuard: jest.Mocked<PathGuard>;

  beforeEach(() => {
    mockGitWrapper = {
      getDiffSince: jest.fn(),
    } as any;

    mockPathGuard = {
      resolveSafePath: jest.fn((p: string) => `/workspace/${p}`),
    } as any;
  });

  it('should return diff since a commit', async () => {
    mockGitWrapper.getDiffSince.mockResolvedValue({
      files: [
        { path: 'file1.txt', additions: 5, deletions: 2, diff: '+line\n-line' },
        { path: 'file2.txt', additions: 3, deletions: 0, diff: '+new' },
      ]
    });

    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { since_commit: 'abc123' });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.files).toBeDefined();
    expect(result.data.files.length).toBe(2);
    expect(mockGitWrapper.getDiffSince).toHaveBeenCalledWith('abc123', undefined);
  });

  it('should return diff for specific paths', async () => {
    mockGitWrapper.getDiffSince.mockResolvedValue({
      files: [
        { path: 'file1.txt', additions: 5, deletions: 2, diff: '+line\n-line' },
      ]
    });

    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { 
      since_commit: 'abc123',
      paths: 'file1.txt'
    });
    
    expect(result.success).toBe(true);
    expect(result.data.files.length).toBe(1);
    expect(result.data.files[0].path).toBe('file1.txt');
    expect(mockGitWrapper.getDiffSince).toHaveBeenCalledWith('abc123', 'file1.txt');
  });

  it('should return INVALID_COMMIT for empty commit', async () => {
    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { since_commit: '' });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_COMMIT');
    expect(result.error?.retryable).toBe(false);
    expect(mockGitWrapper.getDiffSince).not.toHaveBeenCalled();
  });

  it('should return INVALID_COMMIT for invalid commit ref', async () => {
    mockGitWrapper.getDiffSince.mockRejectedValue(new Error('Invalid git ref'));

    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { since_commit: 'invalid..ref' });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_COMMIT');
    expect(result.error?.retryable).toBe(false);
  });

  it('should return INVALID_COMMIT for invalid pathspec', async () => {
    mockGitWrapper.getDiffSince.mockRejectedValue(new Error('Invalid pathspec'));

    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { 
      since_commit: 'abc123',
      paths: '../outside'
    });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_COMMIT');
    expect(result.error?.retryable).toBe(false);
  });

  it('should return GET_DIFF_SINCE_FAILED for non-existent commit', async () => {
    mockGitWrapper.getDiffSince.mockRejectedValue(new Error('Git command failed'));

    const result = await getDiffSince(mockGitWrapper, mockPathGuard, { 
      since_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('GET_DIFF_SINCE_FAILED');
    expect(result.error?.retryable).toBe(true);
  });
});