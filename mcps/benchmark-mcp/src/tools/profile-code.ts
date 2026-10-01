import { Sandbox } from '../sandbox.js';
import * as fs from 'fs';
import * as path from 'path';
import { errorResult, successResult } from '../validation.js';

/**
 * Binaries that profile_code is allowed to execute. Free-text shell
 * commands are NOT accepted — the binary must be one of these and every
 * argument is passed as an array element (no shell involved).
 */
const ALLOWED_BINARIES = ['node', 'python', 'python3'] as const;

export async function profileCode(
  sandbox: Sandbox,
  args: {
    binary: string;
    args?: string[];
    profiler: 'perf' | 'vtune' | 'jfr' | 'cprofile';
    duration_sec?: number;
  }
) {
  try {
    // Validate inputs
    if (!args.binary || typeof args.binary !== 'string') {
      return errorResult('INVALID_ARGUMENTS', 'binary is required (one of: node, python, python3)', false);
    }

    const binary = path.basename(args.binary.trim());
    if (!(ALLOWED_BINARIES as readonly string[]).includes(binary)) {
      return errorResult(
        'BINARY_NOT_ALLOWED',
        `Binary "${args.binary}" is not in the allowlist. Allowed: ${ALLOWED_BINARIES.join(', ')}`,
        false
      );
    }

    const targetArgs: string[] = [];
    if (args.args) {
      if (!Array.isArray(args.args)) {
        return errorResult('INVALID_ARGUMENTS', 'args must be an array of strings', false);
      }
      for (const arg of args.args) {
        if (typeof arg !== 'string' || arg.includes('\0')) {
          return errorResult('INVALID_ARGUMENTS', 'each arg must be a string without NUL bytes', false);
        }
        targetArgs.push(arg);
      }
    }

    const durationSec = args.duration_sec ?? 10; // Default 10 seconds

    if (durationSec <= 0) {
      return errorResult('INVALID_ARGUMENTS', 'duration_sec must be positive', false);
    }

    // Create a temporary file for the profile output
    const profileOutputPath = sandbox.getTempPath(`profile-${Date.now()}.out`);

    // Build profiler command based on profiler type
    let profilerBin = '';
    let profilerArgs: string[] = [];

    switch (args.profiler) {
      case 'perf':
        profilerBin = 'perf';
        profilerArgs = ['record', '-o', profileOutputPath, '--', binary, ...targetArgs];
        break;

      case 'vtune':
        profilerBin = 'vtune';
        profilerArgs = ['-collect', 'hotspots', '-result-dir', profileOutputPath, '--', binary, ...targetArgs];
        break;

      case 'jfr':
        // Note: JFR is a Java profiler; it is only meaningful with a Java
        // runtime, which is not in the binary allowlist. Kept for schema
        // compatibility — execution will fail cleanly at runtime.
        return errorResult(
          'PROFILER_NOT_SUPPORTED',
          'jfr requires a Java runtime, which is not in the binary allowlist (node, python, python3)',
          false
        );

      case 'cprofile':
        profilerBin = 'python';
        profilerArgs = ['-m', 'cProfile', '-o', profileOutputPath, binary, ...targetArgs];
        break;

      default:
        return errorResult('INVALID_ARGUMENTS', `Unsupported profiler: ${args.profiler}`, false);
    }

    // Execute the profiling command safely without shell
    try {
      sandbox.execSandbox(profilerBin, profilerArgs, {
        timeout: (durationSec + 30) * 1000 // Add buffer time for profiler overhead
      });
    } catch (execError) {
      // Profiling tools often return non-zero exit codes even on success
      // So we'll check if the output file was created instead
      if (!fs.existsSync(profileOutputPath)) {
        return errorResult(
          'PROFILING_FAILED',
          execError instanceof Error ? execError.message : String(execError),
          true
        );
      }
    }

    // Check if profile output was generated
    if (!fs.existsSync(profileOutputPath)) {
      return errorResult('PROFILING_FAILED', 'No profile output generated', true);
    }

    const profileSummary = {
      profiler: args.profiler,
      binary,
      args: targetArgs,
      duration_sec: durationSec,
      profile_file: path.basename(profileOutputPath),
      size_bytes: fs.statSync(profileOutputPath).size,
      generated_at: new Date().toISOString(),
      summary: {
        message: "Profile data generated successfully. Use specialized tools to analyze the profile file.",
        note: "This implementation focuses on generating profile data. Detailed analysis would require profiler-specific parsers."
      }
    };

    return successResult(profileSummary);
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error profiling code: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}
