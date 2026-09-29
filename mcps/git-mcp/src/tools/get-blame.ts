import { GitWrapper } from '../git-wrapper.js';
import { PathGuard } from '../path-guard.js';

export async function getBlame(
  gitWrapper: GitWrapper,
  pathGuard: PathGuard,
  args: { file: string; start_line?: number; end_line?: number }
) {
  try {
    // Validate file path
    const safePath = pathGuard.resolveSafePath(args.file);
    
    // Check if file exists
    if (!pathGuard.isFile(safePath)) {
      return {
        success: false,
        error: {
          code: "FILE_NOT_FOUND",
          message: `File not found: ${args.file}`,
          retryable: false
        }
      };
    }
    
    const blameInfo = await gitWrapper.getBlame(
      args.file,
      args.start_line,
      args.end_line
    );
    
    return {
      success: true,
      data: blameInfo
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
        code: "GET_BLAME_FAILED",
        message: error instanceof Error ? error.message : String(error),
        retryable: true
      }
    };
  }
}