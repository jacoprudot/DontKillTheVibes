---
name: performance-assessment
description: Teach LLM to identify performance bottlenecks and apply optimization best practices based on system goals
version: 1.0
module: performance
llmCapabilities:
  - Tool use for filesystem, git, and benchmark access
  - Structured output for findings
  - Reasoning over profiles, benchmarks, and system goals
inputs:
  - Performance benchmarks/load test results (if available)
  - Profiling data (CPU, memory, I/O profiles)
  - Configuration files (thread pools, timeouts, cache settings)
  - Architecture diagrams or component interaction descriptions
  - System goals/SLAs (latency, throughput, availability targets)
  - Infrastructure specs (CPU, memory, network, storage)
  - Access to benchmark-mcp, filesystem, and github
outputs:
  - findings[] (per templates/finding-schema.json with module: "performance")
  - performance-analysis-summary.json (bottleneck analysis, optimization recommendations, capacity planning)
mcpDependencies:
  - benchmark-mcp
  - filesystem
  - github
decisionTrees:
  - Bottleneck Identification
  - Goal-Based Optimization (Latency-Sensitive, Throughput-Oriented, Cost-Optimized)
  - Best Practice Application
  - Capacity Planning Guidance
  - Quick Baseline Protocol
---

# Performance Analyst

Teaches an LLM to act as a performance analyst, identifying bottlenecks, applying optimization best practices, and providing capacity planning guidance based on measured performance and system goals.

## When to Use This Skill

Use this skill after establishing project context and analyzing code/structure/flows to evaluate:
- Response latency and throughput characteristics
- Resource utilization efficiency (CPU, memory, I/O, network)
- Bottleneck identification in critical paths
- Optimization opportunities based on system goals (latency, throughput, cost)
- Capacity planning for future growth
- Regression detection from previous performance baselines

## Inputs

> **Data Availability:** Rules that require cache hit rates or live profiling metrics need runtime telemetry (benchmark-mcp or APM data). If unavailable, skip the rule and lower confidence for dependent findings.

Before using this skill, the LLM should gather:
1. Performance data (if available):
   - Benchmark results (WRK, k6, JMeter, Artillery)
   - Load test results
   - Stress test results
   - Spike test results
2. Profiling data:
   - CPU profiles (perf, VTune, Java Flight Recorder, Python cProfile)
   - Memory profiles (heap snapshots, allocation traces)
   - I/O profiles (disk, network, database query profiles)
   - Garbage collection logs (GC logs, GC tracing)
3. Configuration files:
   - Thread pool configurations (`**/config/**/*`)
   - Timeout settings (`**/config/**/*`)
   - Cache configurations (Redis, Memcached, Caffeine, Guava)
   - Database connection pool settings
   - Web server configurations (nginx, Apache, IIS)
4. Architecture descriptions:
   - Component diagrams (`**/docs/architecture/**/*`)
   - Service mesh configurations (`**/istio/**/*`, `**/linkerd/**/*`)
   - API gateway configurations (`**/api-gateway/**/*`)
   - Micro-service definitions (`**/services/**/*`)
5. System goals and SLAs:
   - Performance requirements documents
   - Service level agreements (SLAs)
   - Performance budgets
   - Monitoring alerts and thresholds
6. Infrastructure specifications:
   - Infrastructure as code (Terraform, CloudFormation)
   - Container specifications (Dockerfiles, Kubernetes manifests)
   - Bare metal specifications
7. Access to the following MCPs:
   - `benchmark-mcp`: For running benchmarks and profiling
   - `filesystem`: For reading configuration and code files
   - `github`: For accessing repository information and workflows

## Analysis Procedure

### Step 1: Baseline Establishment
If no performance data available, use Quick Baseline Protocol to establish baseline measurements.

### Step 2: Bottleneck Identification
Apply bottleneck identification decision trees to profiling and benchmark data.

### Step 3: Goal-Based Optimization
Apply goal-based optimization decision trees based on system goals (latency, throughput, cost).

### Step 4: Best Practice Application
Apply best practice decision trees for common performance optimizations.

### Step 5: Capacity Planning Guidance
Apply capacity planning decision trees for future growth planning.

### Step 6: Output Generation
Emit findings[] array and performance-analysis-summary.json with:
- Identified bottlenecks with severity and impact
- Optimization recommendations with effort estimates
- Capacity planning guidance
- Regression analysis (if baseline available)
- Performance score and recommendations

## Decision Trees

### Bottleneck Identification
```markdown
1. IF cpu_profile_shows >50% IN single_function
   → FINDING: performance-cpu-hotspot-1 (severity: high, effort: M)
   - Evidence: "Function processPayment uses 65% of CPU time in profile"
   - Remediation: "Optimize algorithm or consider caching frequently computed values"
2. IF cpu_profile_shows >70% IN_kernel_or_library
   → FINDING: performance-cpu-kernel-heavy-2 (severity: medium, effort: M)
   - Evidence: "80% of CPU time spent in database driver or network stack"
   - Remediation: "Optimize queries or reduce network calls; consider connection pooling"
3. IF memory_profile_shows_leak (growth_without_gc_relief)
   → FINDING: performance-memory-leak-3 (severity: critical, effort: L)
   - Evidence: "Heap snapshot shows steady growth of 50MB/hour during 2-hour test"
   - Remediation: "Identify and fix objects not being garbage collected (event listeners, caches, etc.)"
4. IF gc_pause_time > 100ms AND frequent
   → FINDING: performance-gc-pressure-4 (severity: high, effort: M)
   - Evidence: "GC pauses averaging 120ms every 10 seconds during peak load"
   - Remediation: "Tune GC settings or reduce object allocation rate"
5. IF gc_pause_time > 500ms AND occasional
   → FINDING: performance-gc-major-pause-5 (severity: medium, effort: M)
   - Evidence: "Occasional 600ms GC pauses during garbage collection cycles"
   - Remediation: "Consider GC tuning or incremental/tri-color GC algorithms"
6. IF lock_contention > 20%_thread_time
   → FINDING: performance-lock-contention-6 (severity: high, effort: M)
   - Evidence: "Threads spend 35% of time waiting for locks in thread profile"
   - Remediation: "Reduce lock scope, use lock-free data structures, or increase partitioning"
7. IF db_query_time > 50%_request_latency
   → FINDING: performance-db-bottleneck-7 (severity: high, effort: M)
   - Evidence: "Database queries account for 180ms of 350ms average request latency"
   - Remediation: "Optimize queries, add indexes, or consider read replicas"
8. IF external_api_time > 30%_request_latency
   → FINDING: performance-external-api-8 (severity: high, effort: M)
   - Evidence: "Payment gateway calls account for 120ms of 400ms request latency"
   - Remediation: "Implement caching, circuit breaker, or asynchronous processing"
9. IF serialization_time > 25%_request_latency
   → FINDING: performance-serialization-9 (severity: medium, effort: M)
   - Evidence: "JSON serialization/deserialization takes 80ms of 300ms processing time"
   - Remediation: "Consider protobuf, Avro, or MessagePack for high-throughput scenarios"
10. IF template_rendering_time > 40%_request_latency
    → FINDING: performance-template-rendering-10 (severity: medium, effort: M)
    - Evidence: "Template rendering takes 150ms of 350ms page load time"
    - Remediation: "Consider caching rendered templates or using streaming templates"
11. IF image_processing_time > 50%_request_latency
    → FINDING: performance-image-processing-11 (severity: high, effort: M)
    - Evidence: "Image resizing and compression takes 200ms of 350ms request time"
    - Remediation: "Offload image processing to background workers or use CDN image optimization"
12. IF encryption_decryption_time > 30%_request_latency
    → FINDING: performance-encryption-12 (severity: medium, effort: M)
    - Evidence: "AES encryption/decryption takes 120ms of 350ms processing time"
    - Remediation: "Consider hardware acceleration or reduce encryption frequency"
13. IF no_compression_used_for_large_responses
    → FINDING: performance-no-compression-13 (severity: medium, effort: M)
    - Evidence: "API responses averaging 2MB without compression"
    - Remediation: "Enable gzip or Brotli compression for responses >1KB"
14. IF dns_lookup_time > 50ms
    → FINDING: performance-dns-lookup-14 (severity: medium, effort: M)
    - Evidence: "DNS lookup takes 80ms adding significant latency to external calls"
    - Remediation: "Use DNS caching or consider internal service discovery"
15. IF tcp_handshake_time > 100ms
    → FINDING: performance-tcp-handshake-15 (severity: medium, effort: M)
    - Evidence: "TCP handshake takes 150ms adding latency to new connections"
    - Remediation: "Use connection pooling or HTTP keep-alive to reuse connections"
16. IF ssl_handshake_time > 200ms
    → FINDING: performance-ssl-handshake-16 (severity: medium, effort: M)
    - Evidence: "TLS handshake takes 250ms adding latency to HTTPS calls"
    - Remediation: "Use session resumption or OCSP stapling to reduce handshake cost"
17. IF queue_wait_time > 25%_processing_time
    → FINDING: performance-queue-wait-17 (severity: medium, effort: M)
    - Evidence: "Messages wait 150ms in queue before processing (total processing 500ms)"
    - Remediation: "Increase worker count or optimize processing speed"
18. IF worker_idle_time > 60%_total_time
    → FINDING: performance-worker-idle-18 (severity: low, effort: M)
    - Evidence: "Worker pool 80% idle during peak load indicating over-provisioning"
    - Remediation: "Right-size worker pool to match actual concurrent workload"
19. IF cache_hit_rate < 50%_for_read_heavy_workload
    → FINDING: performance-cache-miss-rate-19 (severity: medium, effort: M)
    - Evidence: "Cache hit rate of 35% on read-heavy workload (70% reads)"
    - Remediation: "Review cache key strategy, TTL values, or cache size"
20. IF cache_eviction_rate_high
    → FINDING: performance-cache-eviction-high-20 (severity: medium, effort: M)
    - Evidence: "Cache eviction rate of 80% indicating cache too small for workload"
    - Remediation: "Increase cache size or review TTL and eviction policy"
```

### Goal-Based Optimization

#### Latency-Sensitive Systems (API, Real-time, Trading)
```markdown
1. IF p99_latency > SLA_target
   → RECOMMEND: "Add read-through cache for {hot_path} identified in profiling"
   → RECOMMEND: "Move {non_critical} operations to async processing (e.g., emails, notifications)"
   → RECOMMEND: "Implement circuit breaker for {external_calls} showing high latency/variability"
2. IF critical_path_length > 3_services
   → FINDING: performance-long-critical-path-1 (severity: high, effort: L)
   - Evidence: "Request flows through API Gateway → Auth Service → User Service → Order Service → Payment Service"
   - Remediation: "Consider service consolidation or API composition to reduce hops"
3. IF serialization_format_inefficient
   → FINDING: performance-serialization-format-2 (severity: medium, effort: M)
   - Evidence: "Using JSON for high-frequency internal service communication"
   - Remediation: "Consider protobuf, gRPC, or Thrift for service-to-service communication"
4. IF transport_protocol_inefficient
   → FINDING: performance-transport-protocol-3 (severity: medium, effort: M)
   - Evidence: "Using HTTP/1.1 for high-frequency service communication"
   - Remediation: "Consider HTTP/2, gRPC, or WebSocket for better multiplexing"
5. IF no_request_collapsing
   → FINDING: performance-no-request-collapsing-4 (severity: medium, effort: M)
   - Evidence: "Multiple identical requests hitting server simultaneously"
   - Remediation: "Implement request collapsing or deduplication at edge or service level"
6. IF no_response_streaming_for_large_data
   → FINDING: performance-no-response-streaming-5 (severity: medium, effort: M)
   - Evidence: "Returning 10MB JSON array instead of streaming results"
   - Remediation: "Use streaming responses for large datasets (e.g., CSV export, log streaming)"
7. IF no_adaptive_timeout
   → FINDING: performance-no-adaptive-timeout-6 (severity: medium, effort: M)
   - Evidence: "Using fixed 5s timeout regardless of network conditions or service health"
   - Remediation: "Implement adaptive timeout based on recent performance or service health"
8. IF no_connection_pooling
   → FINDING: performance-no-connection-pool-7 (severity: high, effort: M)
   - Evidence: "Creating new connections for each request instead of reusing"
   - Remediation: "Implement connection pooling for databases, HTTP clients, and message brokers"
9. IF no_round_robin_load_balancing
    → FINDING: performance-no-lb-round-robin-8 (severity: medium, effort: M)
    - Evidence: "Load balancer using sticky sessions when not required"
    - Remediation: "Use round-robin or least connections load balancing for better distribution"
10. IF no_http_keep_alive
    → FINDING: performance-no-keep-alive-9 (severity: medium, effort: M)
    - Evidence: "HTTP client not using keep-alive - establishing new TCP connection per request"
    - Remediation: "Enable HTTP keep-alive to reuse connections"
11. IF no_tcp_nodelay
    → FINDING: performance-no-tcp-nodelay-10 (severity: low, effort: S)
    - Evidence: "TCP_NODELAY not set - Nagle's algorithm delaying small packet transmission"
    - Remediation: "Set TCP_NODELAY=true for low-latency requirements"
12. IF no_udp_when_appropriate
    → FINDING: performance-no-udp-11 (severity: low, effort: S)
    - Evidence: "Using TCP for real-time updates where occasional loss is acceptable"
    - Remediation: "Use UDP for real-time data where timeliness matters more than reliability"
```

#### Throughput-Oriented Systems (Batch, ETL, Streaming)
```markdown
1. IF throughput < target_rps
   → RECOMMEND: "Batch {operations} (current: 1, suggested: {batch_size})"
   → RECOMMEND: "Increase worker pool to {cpu_cores * 2} for CPU-bound work"
   → RECOMMEND: "Evaluate queue depth and consumer scaling for message-driven systems"
2. IF batch_size_suboptimal
   → FINDING: performance-suboptimal-batch-1 (severity: medium, effort: M)
   - Evidence: "Processing files one by one instead of in batches of 100"
   - Remediation: "Increase batch size to reduce per-item overhead (e.g., database transactions)"
3. IF io_bound_not_using_async
   → FINDING: performance-io-bound-sync-2 (severity: medium, effort: M)
   - Evidence: "Reading large files synchronously blocking thread pool"
   - Remediation: "Use asynchronous I/O or dedicate threads for I/O operations"
4. IF compression_not_used_for_internal_communication
   → FINDING: performance-no-internal-compression-3 (severity: medium, effort: M)
   - Evidence: "Transferring large JSON objects between services without compression"
   - Remediation: "Enable compression (gzip, Snappy, LZ4) for high-volume internal communication"
5. IF serialization_format_inefficient_for_throughput
   → FINDING: performance-serialization-format-4 (severity: medium, effort: M)
   - Evidence: "Using JSON for high-throughput internal communication"
   - Remediation: "Consider protobuf, Avro, or MessagePack for better throughput"
6. IF no_pipelining_in_stages
   → FINDING: performance-no-pipelining-5 (severity: medium, effort: M)
   - Evidence: "ETL process waits for full extraction before starting transformation"
   - Remediation: "Implement pipelining: start transformation as soon as first data available"
7. IF no_windowing_for_batch_processing
   → FINDING: performance-no-windowing-6 (severity: medium, effort: M)
   - Evidence: "Processing all events in window instead of sliding window for real-time insights"
   - Remediation: "Use sliding window or tumbling window for appropriate use cases"
8. IF no_checkpointing_in_long_runs
   → FINDING: performance-no-checkpointing-7 (severity: medium, effort: M)
   - Evidence: "Long-running batch job has no checkpointing - must restart from beginning on failure"
   - Remediation: "Add checkpointing to allow restart from last successful point"
9. IF no_partitioning_for_parallelism
    → FINDING: performance-no-partitioning-8 (severity: medium, effort: M)
    - Evidence: "Processing single partition when data is partitioned by key"
    - Remediation: "Process all partitions in parallel to utilize full cluster capacity"
10. IF no_resource_isolation_for_noisy_neighbors
    → FINDING: performance-no-resource-isolation-9 (severity: medium, effort: M)
    - Evidence: "CPU-intensive and I/O-intensive workloads sharing same resource pool"
    - Remediation: "Use resource quotas or separate resource pools for different workload types"
11. IF no_backpressure_handling
    → FINDING: performance-no-backpressure-10 (severity: medium, effort: M)
    - Evidence: "Downstream service overwhelmed but upstream keeps sending at full rate"
    - Remediation: "Implement backpressure signaling (e.g., Reactive Streams, Flow Control)"
```

#### Cost-Optimized Systems
```markdown
1. IF cpu_utilization < 20% sustained
   → FINDING: performance-underutilized-compute-1 (severity: low, effort: S)
   - Evidence: "Average CPU utilization 15% over 24-hour period"
   - Remediation: "Right-size instances or use autoscaling to match demand"
2. IF memory_utilization < 25% sustained
   → FINDING: performance-underutilized-memory-2 (severity: low, effort: S)
   - Evidence: "Average memory utilization 18% over 24-hour period"
   - Remediation: "Right-size instances or use autoscaling to match demand"
3. IF storage_utilization < 15% sustained
   → FINDING: performance-underutilized-storage-3 (severity: low, effort: S)
   - Evidence: "Average storage utilization 12% over 24-hour period"
   - Remediation: "Right-size storage or implement lifecycle policies to reduce costs"
4. IF spot_instance_eligible_workloads_on_demand
   → FINDING: performance-spot-eligible-4 (severity: low, effort: M)
   - Evidence: "Batch processing workloads suitable for spot instances running on demand"
   - Remediation: "Use spot instances with fallback to on-demand for fault tolerance"
5. IF reserved_instance_opportunity
   → FINDING: performance-reserved-instance-5 (severity: low, effort: M)
   - Evidence: "Steady-state workload running on on-demand instances for 3+ months"
   - Remediation: "Purchase reserved instances or savings plans for 30-50% cost reduction"
6. IF database_index_overuse
   → FINDING: performance-db-index-overuse-6 (severity: medium, effort: M)
   - Evidence: "Table has 15 indexes but only 3 used regularly based on query analysis"
   - Remediation: "Remove unused indexes to reduce write overhead and storage costs"
7. IF database_connection_pool_oversized
   → FINDING: performance-db-pool-oversized-7 (severity: medium, effort: M)
   - Evidence: "Connection pool set to 100 connections when peak usage is 15"
   - Remediation: "Right-size connection pool to match actual concurrent usage"
8. IF log_retention_too_long
   → FINDING: performance-log-retention-too-long-8 (severity: low, effort: M)
   - Evidence: "Logs retained indefinitely increasing storage costs"
   - Remediation: "Implement log rotation and retention policy (e.g., keep 30 days)"
9. IF log_retention_too_short
   → FINDING: performance-log-retention-too-short-9 (severity: low, effort: M)
   - Evidence: "Debug logs retained only 1 hour insufficient for troubleshooting"
   - Remediation: "Adjust retention to balance troubleshooting needs and storage costs"
10. IF no_data_archiving_strategy
    → FINDING: performance-no-data-archiving-10 (severity: medium, effort: M)
    - Evidence: "All data kept in hot storage indefinitely"
    - Remediation: "Implement hot/warm/cold storage strategy based on access patterns"
```

### Best Practice Application
```markdown
1. IF database_connection_not_pooled
   → FINDING: performance-db-no-pooling-1 (severity: high, effort: M)
   - Evidence: "Application creates new database connection per HTTP request"
   - Remediation: "Implement connection pooling (HikariCP for Java, node-postgres pool for JS)"
2. IF http_client_no_connection_pooling
   → FINDING: performance-http-no-pooling-2 (severity: medium, effort: M)
   - Evidence: "Using fetch/XMLHttpRequest without connection reuse"
   - Remediation: "Use HTTP client with connection pooling (axios, http/nodejs)"
3. IF no_request_id_for_tracing
   → FINDING: performance-no-request-id-3 (severity: medium, effort: M)
   - Evidence: "Requests lack correlation ID for distributed tracing"
   - Remediation: "Add request ID middleware for tracing requests across services"
4. IF no_circuit_breaker_for_external_calls
   → FINDING: performance-no-circuit-breaker-4 (severity: medium, effort: M)
   - Evidence: "Direct calls to external services without failure protection"
   - Remediation: "Implement circuit breaker pattern (Hystrix, resilience4j, oxyd)"
5. IF no_bulkhead_isolation
   → FINDING: performance-no-bulkhead-5 (severity: medium, effort: M)
   - Evidence: "All services share same thread pool - slow service affects all"
   - Remediation: "Implement bulkhead pattern to isolate critical services"
6. IF no_rate_limiting_for_self_protection
   → FINDING: performance-no-self-rate-limit-6 (severity: medium, effort: M)
   - Evidence: "Service accepts unlimited requests enabling self-DDoS"
   - Remediation: "Implement rate limiting to protect service from overload"
7. IF no_graceful_degradation
   → FINDING: performance-no-graceful-degradation-7 (severity: medium, effort: M)
   - Evidence: "Service returns 503 when any dependency degraded instead of partial functionality"
   - Remediation: "Implement graceful degradation: show cached data or limited functionality"
8. IF no_retry_jitter
   → FINDING: performance-no-retry-jitter-8 (severity: medium, effort: M)
   - Evidence: "Retry uses fixed delay (1s, 2s, 4s, 8s) causing thundering herd problem"
   - Remediation: "Add jitter to retry delays: randomize between 0.5x and 1.5x of base delay"
9. IF no_adaptive_concurrency
   → FINDING: performance-no-adaptive-concurrency-9 (severity: medium, effort: M)
   - Evidence: "Fixed thread pool size regardless of workload characteristics"
   - Remediation: "Implement adaptive thread pool that grows/shrinks based on load"
10. IF no_priority_queuing
    → FINDING: performance-no-priority-queuing-10 (severity: medium, effort: M)
    - Evidence: "All requests processed FIFO regardless of importance or SLA"
    - Remediation: "Implement priority queuing: high priority requests bypass queue"
```

### Capacity Planning Guidance
```markdown
1. IF growth_rate_exceeds_capacity_in_6_months
   → FINDING: performance-cap-exceeded-in-6mo-1 (severity: high, effort: L)
   - Evidence: "Current capacity supports 1000 RPM but growth projects 1800 RPM in 6 months"
   - Remediation: "Plan capacity increase: horizontal scaling, vertical scaling, or optimization"
2. IF resource_exhaustion_predicted_in_3_months
   → FINDING: performance-resource-exhausted-in-3mo-2 (severity: medium, effort: M)
   - Evidence: "Memory growth trend indicates OOM in 3 months at current rate"
   - Remediation: "Plan memory increase: optimize usage, increase instance size, or horizontal scale"
3. IF no_load_testing_strategy
   → FINDING: performance-no-load-testing-3 (severity: medium, effort: M)
   - Evidence: "No regular load testing to validate capacity assumptions"
   - Remediation: "Implement regular load testing (monthly or quarterly) as part of CI/CD"
4. IF no_chaos_engineering_practice
   → FINDING: performance-no-chaos-engineering-4 (severity: medium, effort: M)
   - Evidence: "No practice of injecting failures to test resilience"
   - Remediation: "Implement chaos engineering: latency injection, fault injection, etc."
5. IF no_performance_regression_detection
   → FINDING: performance-no-regression-detection-5 (severity: medium, effort: M)
   - Evidence: "No automatic detection of performance regressions in CI/CD"
   - Remediation: "Implement performance regression detection: compare against baseline"
6. IF no_service_level_objectives
   → FINDING: performance-no-slo-6 (severity: low, effort: M)
   - Evidence: "No defined SLOs for latency, availability, or error rates"
   - Remediation: "Define SLOs based on user expectations and business requirements"
7. IF no_error_budget_policy
   → FINDING: performance-no-error-budget-7 (severity: low, effort: M)
   - Evidence: "No policy governing how much unreliability is acceptable"
   - Remediation: "Define error budget: e.g., 99.9% availability allows 43m downtime/month"
8. IF no_cost_performance_tradeoff_analysis
    → FINDING: performance-no-cost-perf-tradeoff-8 (severity: medium, effort: M)
    - Evidence: "Decisions made without considering cost-performance tradeoffs"
    - Remediation: "Implement cost-performance analysis for optimization decisions"
9. IF no_technical_debt_allocation
    → FINDING: performance-no-tech-debt-alloc-9 (severity: low, effort: M)
    - Evidence: "No dedicated time for addressing performance technical debt"
    - Remediation: "Allocate sprint capacity (e.g., 20%) for performance improvements"
10. IF no_performance_budgets_per_team
    → FINDING: performance-no-perf-budgets-10 (severity: medium, effort: M)
    - Evidence: "Teams operate without performance budgets for their services"
    - Remediation: "Assign performance budgets to teams: e.g., API team: 95th percentile < 200ms"
```

### Quick Baseline Protocol (If No Benchmarks Exist)
```markdown
1. RUN benchmark-mcp.measure_latency on 3 critical endpoints (50 req each)
2. RUN benchmark-mcp.measure_throughput for 30s at 50% expected load
3. RUN benchmark-mcp.analyze_resource_usage during above
4. STORE as `.dontkillthevibes/baseline-{timestamp}.json`
5. ALL findings reference this baseline
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "performance"
- `id`: performance-[category]-[number] (e.g., performance-cpu-hotspot-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to config/code/profile file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Function/service/resource name if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the performance issue
- `remediation`: Specific action to fix or optimize the performance issue
- `effort`: Estimated effort to implement (XS-S for config changes, M-L for architectural changes)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["cpu", "memory", "io", "latency", "throughput", "database", "external-api"]
- `relatedFindings`: IDs of related findings (e.g., performance bottleneck causing cost increase)
- `evidence`: 
  - `snippet`: Relevant code/config/profile excerpt
  - `metric`: Utilization percentage, time measurement, operation count, etc.
  - `benchmark`: Baseline measurement, industry standard, or SLA if available

### performance-analysis-summary.json
```json
{
  "baselineInfo": {
    "timestamp": "2026-09-28T14:30:00Z",
    "endpointCount": 5,
    "testDuration": "30 seconds",
    "loadLevel": "50% expected"
  },
  "resourceUtilization": {
    "cpu": {
      "average": 45,
      "peak": 78,
      "distribution": { "0-20%": 10, "20-40%": 20, "40-60%": 35, "60-80%": 25, "80-100%": 10 }
    },
    "memory": {
      "average": 62,
      "peak": 89,
      "growthRate": "2.3 MB/hour",
      "garbageCollection": {
        "frequency": "every 45s",
        "averagePauseTime": "85ms",
        "majorPauseFrequency": "every 15m"
      }
    },
    "disk": {
      "readIOPS": 120,
      "writeIOPS": 45,
      "utilization": 38
    },
    "network": {
      "incomingMbps": 12.5,
      "outgoingMbps": 8.3,
      "utilization": 22
    }
  },
  "bottlenecks": [
    {
      "type": "cpu",
      "location": "src/services/orderService.js:calculateTax",
      "impact": "high",
      "evidence": "Function uses 35% of CPU time",
      "recommendation": "Optimize tax calculation algorithm or cache frequently used rates"
    },
    {
      "type": "memory",
      "location": "src/services/userService.js:userCache",
      "impact": "medium",
      "evidence": "Cache growth rate 5MB/hour without eviction",
      "recommendation": "Implement LRU eviction policy or TTL-based expiration"
    }
  ],
  "latencyMetrics": {
    "p50": 120,
    "p95": 280,
    "p99": 450,
    "max": 1200,
    "byEndpoint": {
      "/api/orders": { "p50": 95, "p95": 210, "p99": 380 },
      "/api/users/{id}": { "p50": 150, "p95": 320, "p99": 500 },
      "/api/payments": { "p50": 200, "p95": 450, "p99": 800 }
    }
  },
  "throughputMetrics": {
    "requestsPerSecond": {
      "average": 85,
      "peak": 140,
      "sustained": 70
    },
    "byEndpoint": {
      "/api/orders": { "average": 30, "peak": 50, "sustained": 25 },
      "/api/users/{id}": { "average": 25, "peak": 40, "sustained": 20 },
      "/api/payments": { "average": 15, "peak": 25, "sustained": 10 }
    }
  },
  "optimizationRecommendations": [
    {
      "area": "CPU",
      "recommendation": "Optimize tax calculation algorithm",
      "estimatedImprovement": "40% reduction in CPU usage",
      "effort": "M",
      "risk": "Low"
    },
    {
      "area": "Memory",
      "recommendation": "Implement cache eviction policy",
      "estimatedImprovement": "Eliminate memory growth",
      "effort": "S",
      "risk": "Low"
    },
    {
      "area": "Database",
      "recommendation": "Add index on user_id in orders table",
      "estimatedImprovement": "60% reduction in query time",
      "effort": "S",
      "risk": "Low"
    }
  ],
  "capacityPlanning": {
    "currentCapacity": {
      "maxRps": 140,
      "safeRps": 100
    },
    "growthProjection": {
      "3Months": "120 RPS",
      "6Months": "180 RPS",
      "12Months": "250 RPS"
    },
    "scalingRecommendations": [
      {
        "timeframe": "3Months",
        "action": "Horizontal scaling: add 1 more instance",
        "expectedCapacity": "160 RPS"
      },
      {
        "timeframe": "6Months",
        "action": "Horizontal scaling: add 2 more instances",
        "expectedCapacity": "220 RPS"
      },
      {
        "timeframe": "12Months",
        "action": "Vertical scaling: upgrade to larger instances",
        "expectedCapacity": "300 RPS"
      }
    ]
  },
  "regressionAnalysis": {
    "baselineCompared": "2026-09-01T10:00:00Z",
    "improvements": [
      {
        "area": "Database",
        "change": "-25% query time",
        "significance": "improvement"
      }
    ],
    "regressions": [
      {
        "area": "External API",
        "change": "+40% latency",
        "significance": "regression"
      }
    ],
    "overallTrend": "stable"
  },
  "performanceScore": 0.68
}
```

## Examples

### Example 1: CPU Hotspot in Tax Calculation
**Input**: 
- CPU profile from benchmark-mcp.profile_code
- Content: Shows function `calculateTax` in `src/services/orderService.js` using 65% CPU
- Code: Complex tax calculation with nested loops and repeated database lookups
**Analysis**:
- Function is CPU hotspot consuming majority of processing time
- Opportunity for algorithmic optimization or caching
**Output**:
- findings[]:
  - performance-cpu-hotspot-1 (severity: high, effort: M):
    - Description: "CPU hotspot in tax calculation function"
    - Location: src/services/orderService.js line 45 (calculateTax function)
    - Remediation: "Optimize algorithm or implement caching of frequently used tax rates"
    - Evidence: "Function uses 65% of CPU time according to profile"
    - Metric: "CPU usage: 65% of total"
- performance-analysis-summary.json:
  {
    "bottlenecks": [
      {
        "type": "cpu",
        "location": "src/services/orderService.js:calculateTax",
        "impact": "high",
        "evidence": "Function uses 65% of CPU time",
        "recommendation": "Optimize tax calculation algorithm or cache frequently used rates"
      }
    ]
  }
```

### Example 2: Memory Leak in User Cache
**Input**: 
- Memory heap snapshot from benchmark-mcp.profile_code
- Content: Shows steady growth of `userCache` Map object
- Code: `userCache = new Map()` with periodic additions but no removals
**Analysis**:
- Cache grows indefinitely without eviction policy
- Will eventually cause OutOfMemoryError
**Output**:
- findings[]:
  - performance-memory-leak-3 (severity: critical, effort: L):
    - Description: "Memory leak in user cache lacking eviction policy"
    - Location: src/services/userService.js line 12 (userCache initialization)
    - Remediation: "Implement LRU eviction policy or TTL-based expiration"
    - Evidence: "Heap snapshot shows steady growth of userCache object"
    - Metric: "Growth rate: 5MB/hour"
- performance-analysis-summary.json:
  {
    "bottlenecks": [
      {
        "type": "memory",
        "location": "src/services/userService.js:userCache",
        "impact": "medium",
        "evidence": "Cache growth rate 5MB/hour without eviction",
        "recommendation": "Implement LRU eviction policy or TTL-based expiration"
      }
    ]
  }
```

### Example 3: Database Query Bottleneck
**Input**: 
- Database query profile from benchmark-mcp.profile_code
- Content: Shows `SELECT * FROM orders WHERE user_id = ?` taking 180ms
- Code: OrderService.getUserOrders() performing sequential queries in loop
**Analysis**:
- Query lacks index on user_id column causing full table scan
- N+1 query pattern: 1 query to get user IDs, then N queries to get orders
**Output**:
- findings[]:
  - performance-db-bottleneck-7 (severity: high, effort: M):
    - Description: "Database query bottleneck due to missing index"
    - Location: src/services/orderService.js line 22 (getUserOrders function)
    - Remediation: "Add index on user_id column in orders table"
    - Evidence: "Query takes 180ms due to full table scan on orders table"
    - Metric: "Query time: 180ms (expected: <20ms with index)"
  - database-n-plus-one-risk-1 (severity: high, effort: M):
    - Description: "N+1 query risk in order retrieval"
    - Location: src/services/orderService.js line 20-25
    - Remediation: "Use JOIN to fetch user and orders in single query"
    - Evidence: "Loop making separate queries for each user's orders"
    - Metric: "Query count: 1 + N instead of 1"
- performance-analysis-summary.json:
  {
    "bottlenecks": [
      {
        "type": "database",
        "location": "src/services/orderService.js:getUserOrders",
        "impact": "high",
        "evidence": "Query takes 180ms due to full table scan on orders table",
        "recommendation": "Add index on user_id column in orders table"
      }
    ],
    "latencyMetrics": {
      "p50": 350,
      "p95": 620,
      "p99": 950
    }
  }
```

### Example 4: Latency-Sensitive Optimization Opportunity
**Input**: 
- SLA: 95th percentile latency < 200ms
- Current p95 latency: 380ms
- Profiling shows: 
  - 100ms in external payment gateway call
  - 80ms in database query
  - 100ms in template rendering
  - 100ms in business logic
**Analysis**:
- Multiple components contributing to latency exceeding SLA
- Opportunities for caching, async processing, and optimization
**Output**:
- findings[]:
  - performance-external-api-8 (severity: high, effort: M):
    - Description: "External API call contributing significantly to latency"
    - Location: src/services/paymentService.js line 15 (processPayment)
    - Remediation: "Implement caching or asynchronous processing for payment gateway"
    - Evidence: "Payment gateway call takes 100ms of 380ms latency"
    - Metric: "External API time: 100ms"
  - performance-db-bottleneck-7 (severity: high, effort: M):
    - Description: "Database query bottleneck due to missing index"
    - Location: src/services/orderService.js line 8 (getOrderDetails)
    - Remediation: "Add index on order_id column in order_details table"
    - Evidence: "Database query takes 80ms of 380ms latency"
    - Metric: "Database time: 80ms"
  - performance-template-rendering-10 (severity: medium, effort: M):
    - Description: "Template rendering contributing to latency"
    - Location: src/views/orderConfirmation.js line 12 (render function)
    - Remediation: "Consider caching rendered templates or using streaming templates"
    - Evidence: "Template rendering takes 100ms of 380ms latency"
    - Metric: "Template time: 100ms"
- performance-analysis-summary.json:
  {
    "latencyMetrics": {
      "p95": 380,
      "target": 200
    },
    "optimizationRecommendations": [
      {
        "area": "External API",
        "recommendation": "Implement caching for payment gateway responses",
        "estimatedImprovement": "50% reduction in API latency",
        "effort": "M",
        "risk": "Low"
      },
      {
        "area": "Database",
        "recommendation": "Add index on order_id column",
        "estimatedImprovement": "60% reduction in query time",
        "effort": "S",
        "risk": "Low"
      },
      {
        "area": "Template Rendering",
        "recommendation": "Cache rendered templates",
        "estimatedImprovement": "40% reduction in rendering time",
        "effort": "M",
        "risk": "Low"
      }
    ]
  }
```

### Example 5: Baseline Establishment and Regression Detection
**Input**: 
- Baseline from 2026-09-01: p95 latency 250ms
- Current measurement: p95 latency 320ms
- No other changes in code or infrastructure
**Analysis**:
- Performance regression detected: 28% increase in latency
- Likely cause: recent deployment or configuration change
**Output**:
- findings[]:
  - performance-no-regression-detection-5 (severity: medium, effort: M):
    - Description: "Performance regression detected in 95th percentile latency"
    - Location: Performance comparison between baselines
    - Remediation: "Investigate recent changes for performance impact"
    - Evidence: "Baseline p95: 250ms, Current p95: 320ms (+28%)"
    - Metric: "Latency increase: 70ms"
- performance-analysis-summary.json:
  {
    "baselineInfo": {
      "timestamp": "2026-09-28T14:30:00Z",
      "comparedToBaseline": "2026-09-01T10:00:00Z"
    },
    "latencyMetrics": {
      "p95": 320,
      "p95Baseline": 250,
      "p95Change": "+28%"
    },
    "regressionAnalysis": {
      "baselineCompared": "2026-09-01T10:00:00Z",
      "regressions": [
        {
          "area": "Latency",
          "change": "+28%",
          "significance": "regression"
        }
      ],
      "overallTrend": "degrading"
    }
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding domain-specific performance patterns (e.g., financial trading systems, real-time gaming)
2. Enhancing bottleneck detection with more sophisticated profiling analysis (e.g., flame graphs, call graphs)
3. Adding new finding types for specific performance anti-patterns (e.g., Thundering herd, cache stampede)
4. Improving the performance-analysis-summary.json with additional metrics (e.g., Apdex score, user satisfaction correlation)
5. Adding new examples for additional bottleneck types and optimization scenarios
6. Improving goal-based optimization with more specific recommendations for different architectures
7. Adding capacity planning models for different growth patterns (exponential, seasonal, step-function)