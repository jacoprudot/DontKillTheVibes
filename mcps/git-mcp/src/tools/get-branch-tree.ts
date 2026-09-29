import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

export async function getBranchTree(
  gitWrapper: GitWrapper,
  pathGuard: PathGuard,
  args: { max_depth?: number }
) {
  try {
    const branchTree = await gitWrapper.getBranchTree(args.max_depth);
    
    return {
      success: true,
      data: branchTree
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      return {
        success: false,
        error: {
          code: "PATH_ACCESS_DENIED",
          message: error.message,
          retryable: false
        }
      };
    }
    
    return {
      success: false,
      error: {
        code: "GET_BRANCH_TREE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
}