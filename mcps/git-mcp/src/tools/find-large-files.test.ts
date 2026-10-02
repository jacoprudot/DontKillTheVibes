import { findLargeFiles } from './find-large-files.js';
import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

describe('findLargeFiles tool', () => {
  let mockGitWrapper: jest.Mocked<GitWrapper>;
  let mockPathGuard: jest.Mocked<PathGuard>;

  beforeEach(() => {
    mockGitWrapper = {
      findLargeFiles: jest.fn(),
    } as any;

    mockPathGuard = {} as any;
  });

  it('should find files above default threshold (10MB)', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([
      { path: 'large-file.bin', size_mb: 15.5, commit: 'abc123' },
      { path: 'another-large.bin', size_mb: 12.3, commit: 'def456' },
    ]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, {});
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    const largeFile = result.data!.find(f => f.path === 'large-file.bin');
    expect(largeFile).toBeDefined();
    expect(largeFile!.size_mb).toBeGreaterThan(10);
    expect(largeFile!).toHaveProperty('commit');
  });

  it('should use custom threshold', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([
      { path: 'small-file.bin', size_mb: 5, commit: 'abc123' },
    ]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, { size_threshold_mb: 20 });
    
    expect(result.success).toBe(true);
    const largeFile = result.data!.find(f => f.path === 'large-file.bin');
    expect(largeFile).toBeUndefined();
    expect(mockGitWrapper.findLargeFiles).toHaveBeenCalledWith(20);
  });

  it('should return empty array when no files exceed threshold', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, { size_threshold_mb: 100 });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('should sort by size descending', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([
      { path: 'largest.bin', size_mb: 50, commit: 'abc123' },
      { path: 'medium.bin', size_mb: 25, commit: 'def456' },
      { path: 'small.bin', size_mb: 5, commit: 'ghi789' },
    ]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, { size_threshold_mb: 1 });
    
    expect(result.success).toBe(true);
    const data = result.data!;
    for (let i = 1; i < data.length; i++) {
      const prev = data[i-1];
      const curr = data[i];
      if (prev && curr) {
        expect(prev.size_mb).toBeGreaterThanOrEqual(curr.size_mb);
      }
    }
  });

  it('should include commit info for each file', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([
      { path: 'large-file.bin', size_mb: 15, commit: 'abc123' },
      { path: 'another.bin', size_mb: 20, commit: 'def456' },
    ]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, { size_threshold_mb: 1 });
    
    expect(result.success).toBe(true);
    for (const file of result.data!) {
      expect(file).toHaveProperty('commit');
      expect(typeof file.commit).toBe('string');
    }
  });

  it('should handle zero threshold', async () => {
    mockGitWrapper.findLargeFiles.mockResolvedValue([
      { path: 'small.txt', size_mb: 0.001, commit: 'abc123' },
      { path: 'large-file.bin', size_mb: 15, commit: 'def456' },
    ]);

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, { size_threshold_mb: 0 });
    
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThanOrEqual(2);
    expect(mockGitWrapper.findLargeFiles).toHaveBeenCalledWith(0);
  });

  it('should return PATH_ACCESS_DENIED when the guard blocks access', async () => {
    mockGitWrapper.findLargeFiles.mockRejectedValue(new Error('Access denied: path escapes workspace'));

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, {});

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('PATH_ACCESS_DENIED');
    expect(result.error!.retryable).toBe(false);
  });

  it('should return FIND_LARGE_FILES_FAILED for other git errors', async () => {
    mockGitWrapper.findLargeFiles.mockRejectedValue(new Error('git rev-list crashed'));

    const result = await findLargeFiles(mockGitWrapper, mockPathGuard, {});

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('FIND_LARGE_FILES_FAILED');
    expect(result.error!.retryable).toBe(true);
  });
});