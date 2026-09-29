import { Sandbox } from '../sandbox.js';
import { PathGuard } from '../path-guard.js';
import * as fs from 'fs';
import { errorResult } from '../validation.js';

export async function compareBenchmarks(
  sandbox: Sandbox,
  pathGuard: PathGuard,
  args: {
    baseline_path: string;
    current_path: string;
  }
) {
  try {
    // Resolve paths within the workspace root (rejects `..` escapes)
    let baselineSafePath: string;
    let currentSafePath: string;
    try {
      baselineSafePath = pathGuard.resolveSafePath(args.baseline_path);
      currentSafePath = pathGuard.resolveSafePath(args.current_path);
    } catch (err) {
      return errorResult(
        'PATH_ACCESS_DENIED',
        err instanceof Error ? err.message : String(err),
        false
      );
    }
    
    // Check if files exist
    if (!fs.existsSync(baselineSafePath)) {
      return errorResult('FILE_NOT_FOUND', `Baseline file not found: ${args.baseline_path}`, false);
    }
    
    if (!fs.existsSync(currentSafePath)) {
      return errorResult('FILE_NOT_FOUND', `Current file not found: ${args.current_path}`, false);
    }

    // Read benchmark files
    let baselineData: any;
    let currentData: any;

    try {
      baselineData = JSON.parse(fs.readFileSync(baselineSafePath, 'utf8'));
    } catch (err) {
      return errorResult(
        'INVALID_JSON',
        `Invalid JSON in baseline file: ${err instanceof Error ? err.message : String(err)}`,
        false
      );
    }

    try {
      currentData = JSON.parse(fs.readFileSync(currentSafePath, 'utf8'));
    } catch (err) {
      return errorResult(
        'INVALID_JSON',
        `Invalid JSON in current file: ${err instanceof Error ? err.message : String(err)}`,
        false
      );
    }
    
    // Extract key metrics for comparison
    // Assuming standard format from our benchmark tools
    const baselineMetrics = extractMetrics(baselineData);
    const currentMetrics = extractMetrics(currentData);
    
    const regressions: Array<{
      metric: string;
      baseline: number;
      current: number;
      change_percent: number;
      severity: 'high' | 'medium' | 'low';
    }> = [];
    
    const improvements: Array<{
      metric: string;
      baseline: number;
      current: number;
      change_percent: number;
    }> = [];
    
    // Compare common metrics
    const allMetrics = new Set([
      ...Object.keys(baselineMetrics),
      ...Object.keys(currentMetrics)
    ]);
    
    for (const metric of allMetrics) {
      const baselineValue = baselineMetrics[metric];
      const currentValue = currentMetrics[metric];
      
      // Skip if either value is not a number
      if (typeof baselineValue !== 'number' || typeof currentValue !== 'number') {
        continue;
      }
      
      // Skip if baseline is zero to avoid division by zero
      if (baselineValue === 0) {
        continue;
      }
      
      const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
      
      // For latency metrics, higher is worse (regression)
      // For throughput/RPS metrics, higher is better (improvement)
      const isLatencyMetric = metric.toLowerCase().includes('latency') || 
                             metric.toLowerCase().includes('time');
      const isThroughputMetric = metric.toLowerCase().includes('rps') || 
                                metric.toLowerCase().includes('throughput') ||
                                metric.toLowerCase().includes('requests');
      
      let severity: 'high' | 'medium' | 'low' = 'low';
      if (isLatencyMetric) {
        // Latency: higher is worse
        if (changePercent > 50) {
          severity = 'high';
        } else if (changePercent > 20) {
          severity = 'medium';
        } else if (changePercent > 5) {
          severity = 'low';
        } else {
          continue; // Insignificant change
        }
        
        if (changePercent > 0) { // Regression (higher latency)
          regressions.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change_percent: Number(changePercent.toFixed(2)),
            severity
          });
        } else { // Improvement (lower latency)
          improvements.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change_percent: Number(changePercent.toFixed(2))
          });
        }
      } else if (isThroughputMetric) {
        // Throughput: higher is better
        if (changePercent < -50) {
          severity = 'high';
        } else if (changePercent < -20) {
          severity = 'medium';
        } else if (changePercent < -5) {
          severity = 'low';
        } else {
          continue; // Insignificant change
        }
        
        if (changePercent < 0) { // Regression (lower throughput)
          regressions.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change_percent: Number(changePercent.toFixed(2)),
            severity
          });
        } else { // Improvement (higher throughput)
          improvements.push({
            metric,
            baseline: baselineValue,
            current: currentValue,
            change_percent: Number(changePercent.toFixed(2))
          });
        }
      }
      // For other metrics, we'll just report significant changes
      else {
        const absChangePercent = Math.abs(changePercent);
        if (absChangePercent > 20) {
          if (changePercent > 0) {
            regressions.push({
              metric,
              baseline: baselineValue,
              current: currentValue,
              change_percent: Number(changePercent.toFixed(2)),
              severity: 'medium'
            });
          } else {
            improvements.push({
              metric,
              baseline: baselineValue,
              current: currentValue,
              change_percent: Number(changePercent.toFixed(2))
            });
          }
        }
      }
    }
    
    // Sort by severity and magnitude
    regressions.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return Math.abs(b.change_percent) - Math.abs(a.change_percent);
    });
    
    improvements.sort((a, b) => 
      Math.abs(b.change_percent) - Math.abs(a.change_percent)
    );
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            data: {
              regressions: regressions.slice(0, 10), // Limit to top 10
              improvements: improvements.slice(0, 10), // Limit to top 10
              summary: {
                total_regressions: regressions.length,
                total_improvements: improvements.length,
                high_severity_regressions: regressions.filter(r => r.severity === 'high').length,
                comparison_timestamp: new Date().toISOString()
              }
            }
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return errorResult(
      'INTERNAL_ERROR',
      `Error comparing benchmarks: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}

// Helper function to extract metrics from benchmark data
function extractMetrics(data: any): Record<string, number> {
  const metrics: Record<string, number> = {};
  
  // Flatten the data object to find numeric values
  function flattenObject(obj: any, prefix = '') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'number' && !isNaN(value)) {
          metrics[fullKey] = value;
        } else if (value !== null && typeof value === 'object') {
          flattenObject(value, fullKey);
        }
      }
    }
  }
  
  flattenObject(data);
  return metrics;
}