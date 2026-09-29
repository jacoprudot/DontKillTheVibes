# Benchmark MCP Server

Provides tools for performance testing and profiling including:
- Running benchmarks (WRK, k6, JMeter)
- Code profiling (perf, VTune, Java Flight Recorder, Python cProfile)
- Latency and throughput measurement
- Resource usage analysis
- Benchmark comparison
- Load test generation
- Resource contention detection

## Tools

- `run_benchmark` - Run standardized benchmarks
- `profile_code` - Run profilers on code
- `measure_latency` - Measure endpoint latency
- `measure_throughput` - Measure requests/second under load
- `analyze_resource_usage` - Track CPU, memory, disk, network usage
- `compare_benchmarks` - Compare benchmark results
- `suggest_load_test` - Generate load test scenarios
- `identify_resource_contention` - Detect lock contention, GC pauses, thread starvation

## Security Model

See [SECURITY.md](./SECURITY.md) for detailed security controls including:
- Sandbox execution for benchmarks (no network access except to target)
- Path allowlisting (restricted to workspace root)
- Command allowlisting (only approved benchmarking tools)
- Resource limits (timeout, memory, CPU)
- No persistent state
- Audit logging

## Usage

This MCP is designed to be used with LLM systems that support the Model Context Protocol.
Benchmark operations run in a secure sandbox with limited access.