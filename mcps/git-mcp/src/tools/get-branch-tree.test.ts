import { getBranchTree } from './get-branch-tree.js';
import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

describe('getBranchTree tool', () => {
  let mockGitWrapper: jest.Mocked<GitWrapper>;
  let mockPathGuard: jest.Mocked<PathGuard>;

  beforeEach(() => {
    mockGitWrapper = {
      getBranchTree: jest.fn(),
    } as any;

    mockPathGuard = {} as any;
  });

  it('should return branch information', async () => {
    mockGitWrapper.getBranchTree.mockResolvedValue([
      { name: 'main', commit: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', ahead: 0, behind: 0 },
      { name: 'feature-branch', commit: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3', ahead: 5, behind: 2 },
      { name: 'hotfix-branch', commit: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3d4', ahead: 1, behind: 0 },
    ]);

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, {});
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data!.length).toBe(3);
    
    for (const branch of result.data!) {
      expect(branch).toHaveProperty('name');
      expect(branch).toHaveProperty('commit');
      expect(branch).toHaveProperty('ahead');
      expect(branch).toHaveProperty('behind');
      expect(typeof branch.commit).toBe('string');
      expect(branch.commit.length).toBe(40);
    }
  });

  it('should respect max_depth parameter', async () => {
    mockGitWrapper.getBranchTree.mockResolvedValue([
      { name: 'main', commit: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', ahead: 0, behind: 0 },
      { name: 'feature-branch', commit: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0a1b2c3', ahead: 5, behind: 2 },
    ]);

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, { max_depth: 2 });
    
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeLessThanOrEqual(2);
    expect(mockGitWrapper.getBranchTree).toHaveBeenCalledWith(2);
  });

  it('should return empty array for max_depth 0', async () => {
    mockGitWrapper.getBranchTree.mockResolvedValue([]);

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, { max_depth: 0 });
    
    expect(result.success).toBe(true);
    expect(result.data!.length).toBe(0);
  });

  it('should handle negative max_depth gracefully', async () => {
    mockGitWrapper.getBranchTree.mockResolvedValue([
      { name: 'main', commit: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', ahead: 0, behind: 0 },
    ]);

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, { max_depth: -1 });
    
    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThanOrEqual(0);
    expect(mockGitWrapper.getBranchTree).toHaveBeenCalledWith(-1);
  });

  it('should return PATH_ACCESS_DENIED when the guard blocks access', async () => {
    mockGitWrapper.getBranchTree.mockRejectedValue(new Error('Access denied: path escapes workspace'));

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, {});

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('PATH_ACCESS_DENIED');
    expect(result.error!.retryable).toBe(false);
  });

  it('should return GET_BRANCH_TREE_FAILED for other git errors', async () => {
    mockGitWrapper.getBranchTree.mockRejectedValue(new Error('git for-each-ref crashed'));

    const result = await getBranchTree(mockGitWrapper, mockPathGuard, {});

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('GET_BRANCH_TREE_FAILED');
    expect(result.error!.retryable).toBe(true);
  });
});