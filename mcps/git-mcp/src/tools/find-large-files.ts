import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

export async function findLargeFiles(
  gitWrapper: GitWrapper,
  pathGuard: PathGuard,
  args: { size_threshold_mb?: number }
) {
  try {
    const largeFiles = await gitWrapper.findLargeFiles(args.size_threshold_mb);
    
    return {
      success: true,
      data: largeFiles
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
        code: "FIND_LARGE_FILES_FAILED",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
}