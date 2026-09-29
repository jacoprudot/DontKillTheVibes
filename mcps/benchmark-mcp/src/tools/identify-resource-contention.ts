import { Sandbox } from '../sandbox.js';
import { PathGuard } from '../path-guard.js';
import * as fs from 'fs';
import { errorResult } from '../validation.js';

export async function identifyResourceContention(
  sandbox: Sandbox,
  pathGuard: PathGuard,
  args: {
    profile_path: string;
  }
) {
  try {
    // Resolve path within the workspace root (rejects `..` escapes)
    let profileSafePath: string;
    try {
      profileSafePath = pathGuard.resolveSafePath(args.profile_path);
    } catch (err) {
      return errorResult(
        'PATH_ACCESS_DENIED',
        err instanceof Error ? err.message : String(err),
        false
      );
    }

    // Check if file exists
    if (!fs.existsSync(profileSafePath)) {
      return errorResult('FILE_NOT_FOUND', `Profile file not found: ${args.profile_path}`, false);
    }

    // Read profile data
    let profileData: any;

    try {
      profileData = JSON.parse(fs.readFileSync(profileSafePath, 'utf8'));
    } catch (err) {
      return errorResult(
        'INVALID_JSON',
        `Invalid JSON in profile file: ${err instanceof Error ? err.message : String(err)}`,
        false
      );
    }
    
    // Analyze profile for resource contention issues
    const lockContention: Array<{
      function: string;
      contention_percent: number;
      severity: 'high' | 'medium' | 'low';
    }> = [];
    
    const gcPauses: Array<{
      timestamp: string;
      pause_ms: number;
      severity: 'high' | 'medium' | 'low';
    }> = [];
    
    const threadStarvation: Array<{
      thread_id: string;
      delay_ms: number;
      severity: 'high' | 'medium' | 'low';
    }> = [];
    
    // Extract lock contention information
    // This would depend on the profiler output format
    // For this implementation, we'll look for common patterns
    
    // Look for mutex lock times, critical section durations, etc.
    if (profileData.lock_contention || profileData.mutex_stats) {
      const lockData = profileData.lock_contention || profileData.mutex_stats;
      
      if (Array.isArray(lockData)) {
        for (const lock of lockData) {
          if (lock.function && lock.contention_percent !== undefined) {
            let severity: 'high' | 'medium' | 'low' = 'low';
            
            if (lock.contention_percent > 50) {
              severity = 'high';
            } else if (lock.contention_percent > 20) {
              severity = 'medium';
            } else if (lock.contention_percent > 5) {
              severity = 'low';
            } else {
              continue; // Skip insignificant contention
            }
            
            lockContention.push({
              function: lock.function,
              contention_percent: Number(lock.contention_percent.toFixed(2)),
              severity
            });
          }
        }
      }
    }
    
    // Extract GC pause information
    if (profileData.gc_pauses || profileData.gc_stats) {
      const gcData = profileData.gc_pauses || profileData.gc_stats;
      
      if (Array.isArray(gcData)) {
        for (const gc of gcData) {
          let severity: 'high' | 'medium' | 'low' = 'low';
          
          if (gc.pause_ms !== undefined) {
            if (gc.pause_ms > 1000) { // >1 second
              severity = 'high';
            } else if (gc.pause_ms > 200) { // >200ms
              severity = 'medium';
            } else if (gc.pause_ms > 50) { // >50ms
              severity = 'low';
            } else {
              continue; // Skip insignificant pauses
            }
            
            gcPauses.push({
              timestamp: gc.timestamp || new Date().toISOString(),
              pause_ms: Number(gc.pause_ms.toFixed(2)),
              severity
            });
          }
        }
      }
    }
    
    // Extract thread starvation information
    // This would look for threads that are blocked or waiting excessively
    if (profileData.thread_starvation || profileData.thread_delays) {
      const threadData = profileData.thread_starvation || profileData.thread_delays;
      
      if (Array.isArray(threadData)) {
        for (const thread of threadData) {
          let severity: 'high' | 'medium' | 'low' = 'low';
          
          if (thread.delay_ms !== undefined) {
            if (thread.delay_ms > 5000) { // >5 seconds
              severity = 'high';
            } else if (thread.delay_ms > 1000) { // >1 second
              severity = 'medium';
            } else if (thread.delay_ms > 200) { // >200ms
              severity = 'low';
            } else {
              continue; // Skip insignificant delays
            }
            
            threadStarvation.push({
              thread_id: thread.thread_id || `thread_${Math.floor(Math.random() * 1000)}`,
              delay_ms: Number(thread.delay_ms.toFixed(2)),
              severity
            });
          }
        }
      }
    }
    
    // Sort by severity and magnitude
    lockContention.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.contention_percent - a.contention_percent;
    });
    
    gcPauses.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.pause_ms - a.pause_ms;
    });
    
    threadStarvation.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.delay_ms - a.delay_ms;
    });
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            data: {
              lock_contention: lockContention.slice(0, 10), // Limit to top 10
              gc_pauses: gcPauses.slice(0, 10), // Limit to top 10
              thread_starvation: threadStarvation.slice(0, 10), // Limit to top 10
              summary: {
                total_lock_contention: lockContention.length,
                total_gc_pauses: gcPauses.length,
                total_thread_starvation: threadStarvation.length,
                high_severity_issues:
                  lockContention.filter(l => l.severity === 'high').length +
                  gcPauses.filter(g => g.severity === 'high').length +
                  threadStarvation.filter(t => t.severity === 'high').length,
                analysis_timestamp: new Date().toISOString()
              }
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error identifying resource contention: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}