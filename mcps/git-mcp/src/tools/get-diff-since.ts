import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

export async function getDiffSince(
  gitWrapper: GitWrapper,
  pathGuard: PathGuard,
  args: { since_commit: string; paths?: string }
) {
  try {
    // Validate since_commit (basic validation)
    if (!args.since_commit || args.since_commit.trim() === '') {
      return {
        success: false,
        error: {
          code: "INVALID_COMMIT",
          message: "Since commit is required",
          retryable: false
        }
      };
    }
    
    const diffInfo = await gitWrapper.getDiffSince(
      args.since_commit,
      args.paths
    );
    
    return {
      success: true,
      data: diffInfo
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
        code: "GET_DIFF_SINCE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
}