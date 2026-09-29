# Benchmark MCP Security Model

## Threat Model
- **Asset**: User's local system and network
- **Threat**: Malicious skill prompting MCP to execute harmful commands or access unauthorized resources
- **Attack Vector**: Prompt injection via skill instructions attempting to escape sandbox

## Controls Implemented
1. **Sandbox Execution**: All benchmark tools run in isolated temporary directories
   - No access to host filesystem outside workspace
   - No persistent changes to system
2. **Network Restrictions**: 
   - Benchmarks can only connect to specified target URLs
   - No outbound connections except to benchmark targets
   - No inbound connections allowed
3. **Command Allowlisting**: Only approved benchmarking tools allowed
   - WRK, k6, JMeter for load testing
   - perf, VTune, Java Flight Recorder, Python cProfile for profiling
   - No arbitrary shell command execution
4. **Resource Limits**: 
   - Timeout: 60 seconds default for benchmarks
   - Maximum memory: 512MB
   - Maximum CPU time: 30 seconds
   - File size limits for outputs
5. **Audit Logging**: All invocations logged with hash of args/result (no sensitive data)
6. **No Persistent State**: No data retained between invocations
7. **Input Validation**: All inputs sanitized and validated

## Validation
- Run `npm run security:audit` before release
- Penetration test via simulated sandbox escape attempts