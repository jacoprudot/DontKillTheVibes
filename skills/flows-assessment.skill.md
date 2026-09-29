---
name: flows-assessment
description: Teach LLM to analyze data, control, and workflow dynamics including request flows, async processing, and orchestration health
version: 1.0
module: flows
llmCapabilities:
  - Tool use for filesystem and git access
  - Structured output for findings
  - Reasoning over request flows, async patterns, and workflow definitions
inputs:
  - API route/controllers (REST, GraphQL, gRPC)
  - Webhook/event handlers (Stripe, GitHub, custom)
  - Message queue consumers (RabbitMQ, Kafka, SQS listeners)
  - Orchestration definitions (n8n workflow files, Airflow DAGs, Temporal workflows)
  - State management files (Redux stores, Vuex, NgRx)
  - Background job definitions (Sidekiq, Celery, Hangfire)
  - Access to filesystem-mcp and github-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "flows")
  - flow-analysis-summary.json (request flow analysis, async processing health, orchestration status)
mcpDependencies:
  - filesystem-mcp
  - github-mcp
decisionTrees:
  - Request Flow
  - Async Processing
  - Orchestration (n8n Specific)
  - Event/Message Flows
  - State Management
---

# Flows Analyst

Teaches an LLM to act as a flow analyst, evaluating data movement, control flow, and workflow automation to identify bottlenecks, anti-patterns, and improvement opportunities in how data and control move through a system.

## When to Use This Skill

Use this skill after establishing project context and analyzing code/structure to evaluate:
- Request handling (middleware order, validation placement, response consistency)
- Asynchronous processing (fire-and-forget vs acknowledged, idempotency, retry strategies)
- Event-driven architecture (message schemas, consumer groups, dead letter queues)
- Workflow automation (n8n, Airflow, Temporal - error handling, scheduling, monitoring)
- State management (Redux, Vuex, NgRx - mutability, performance, debugging)

## Inputs

Before using this skill, the LLM should gather:
1. API definitions:
   - REST controllers (`**/controllers/**/*`, `**/routes/**/*`)
   - GraphQL schemas (`**/schema.graphql`, `**/resolvers/**/*`)
   - gRPC service definitions (`**/proto/**/*`)
   - OpenAPI/Swagger specs (`**/swagger.json`, `**/openapi.yaml`)
2. Webhook handlers:
   - Payment webhooks (`**/webhooks/stripe/**/*`, `**/webhooks/paypal/**/*`)
   - GitHub webhooks (`**/webhooks/github/**/*`)
   - Custom webhooks (`**/webhooks/**/*`)
3. Message queue consumers:
   - RabbitMQ (`**/consumers/**/*`, `**/listeners/**/*`)
   - Apache Kafka (`**/consumers/**/*`, `**/handlers/**/*`)
   - Amazon SQS/SNS (`**/listeners/**/*`)
   - Apache Pulsar (`**/consumers/**/*`)
4. Orchestration definitions:
   - n8n workflows (`**/*.json` in workflows directory, `**/workflow*.json`)
   - Airflow DAGs (`**/dags/**/*.py`)
   - Temporal workflows (`**/workflows/**/*`)
   - AWS Step Functions (`**/state-machines/**/*.json`)
   - Google Cloud Workflows (`**/workflows/**/*.yaml`)
5. State management:
   - Redux stores (`**/store/**/*`, `**/redux/**/*`)
   - Vuex stores (`**/store/**/*`)
   - NgRx stores (`**/store/**/*`)
6. Background jobs:
   - Sidekiq workers (`**/workers/**/*`)
   - Celery tasks (`**/tasks/**/*`)
   - Hangfire jobs (`**/jobs/**/*`)
7. Access to the following MCPs:
   - `filesystem-mcp`: For reading workflow and configuration files
   - `github-mcp`: For accessing workflow definitions in repo (if not cloned locally)

## Analysis Procedure

### Step 1: Flow Discovery
Use filesystem-mcp to locate API routes, webhooks, message consumers, workflow definitions, and state management files.

### Step 2: Request Flow Analysis
Apply request flow decision trees to evaluate middleware order, validation placement, and response handling.

### Step 3: Async Processing Evaluation
Apply async processing decision trees to evaluate fire-and-forget usage, idempotency, and retry strategies.

### Step 4: Event/Message Flow Analysis
Apply event/message flow decision trees to evaluate schema evolution, consumer groups, and dead letter handling.

### Step 5: Orchestration Health Check
Apply orchestration decision trees (n8n-specific or general) to evaluate error handling, scheduling, and monitoring.

### Step 6: State Management Review
Apply state management decision trees to evaluate mutability, performance, and debugging capabilities.

### Step 7: Output Generation
Emit findings[] array and flow-analysis-summary.json with:
- Request flow quality assessment
- Async processing health
- Event/flow architecture evaluation
- Orchestration and workflow status
- State management analysis

## Decision Trees

### Request Flow
```markdown
1. IF auth_middleware_after_validation
   → FINDING: flows-auth-order-1 (severity: high, effort: S)
   - Evidence: "Validation middleware runs before auth - wasted effort on unauthenticated requests"
   - Remediation: "Move auth middleware before validation middleware in the stack"
2. IF validation_in_controller_NOT_middleware
   → FINDING: flows-validation-placement-2 (severity: medium, effort: S)
   - Evidence: "UserController.validateInput() duplicates logic available in shared middleware"
   - Remediation: "Extract validation to reusable middleware or validation layer"
3. IF validation_too_early_in_stack
   → FINDING: flows-validation-too-early-3 (severity: low, effort: S)
   - Evidence: "Validation runs before body parsing - validating raw byte stream"
   - Remediation: "Ensure body parsing middleware runs before validation middleware"
4. IF response_transformation_inconsistent
   → FINDING: flows-inconsistent-response-4 (severity: low, effort: M)
   - Evidence: "Some endpoints return {data: X}, others return X directly"
   - Remediation: "Standardize response format across all endpoints"
5. IF no_global_error_handler
   → FINDING: flows-missing-error-handler-5 (severity: medium, effort: M)
   - Evidence: "Express app lacks app.use(errorHandler) - errors crash process"
   - Remediation: "Add global error handling middleware to catch and format errors"
6. IF error_response_leaks_stack_trace
   → FINDING: flows-error-leaks-stack-6 (severity: medium, effort: S)
   - Evidence: "Production error responses include full stack traces"
   - Remediation: "Configure error handler to hide stack traces in production"
7. IF no_request_id_middleware
   → FINDING: flows-missing-request-id-7 (severity: low, effort: S)
   - Evidence: "Requests lack correlation ID for distributed tracing"
   - Remediation: "Add request ID middleware for tracing requests across services"
8. IF no_rate_limiting_on_public_endpoints
   → FINDING: flows-missing-rate-limit-8 (severity: medium, effort: M)
   - Evidence: "Public API endpoints allow unlimited requests enabling abuse"
   - Remediation: "Add rate limiting middleware to prevent abuse and exhaustion"
9. IF no_cors_configuration
   → FINDING: flows-missing-cors-9 (severity: low, effort: S)
   - Evidence: "API accessible from any origin without restriction"
   - Remediation: "Configure CORS policy to restrict origins as needed"
10. IF no_security_headers
    → FINDING: flows-missing-security-headers-10 (severity: low, effort: S)
    - Evidence: "Missing Helmet.js equivalent - no XSS, clickjacking protection"
    - Remediation: "Add security headers middleware (HSTS, CSP, X-Frame-Options, etc)"
```

### Async Processing
```markdown
1. IF fire_and_forget_used_for_critical_operation
   → FINDING: flows-fire-and-forget-critical-1 (severity: critical, effort: M)
   - Evidence: "Payment processing initiated via fire-and-forget - no error handling or confirmation"
   - Remediation: "Use acknowledged async with callback/webhook or synchronous processing for critical ops"
2. IF no_dead_letter_queue_for_async
   → FINDING: flows-missing-dlq-2 (severity: high, effort: M)
   - Evidence: "Failed message processing goes nowhere - poison messages block queue"
   - Remediation: "Configure dead letter queue for failed message inspection and replay"
3. IF no_idempotency_key_for_payment
   → FINDING: flows-missing-idempotency-3 (severity: critical, effort: S)
   - Evidence: "Payment endpoint accepts retryable requests without idempotency checking"
   - Remediation: "Require and validate Idempotency-Key header for payment endpoints"
4. IF retry_without_backoff
   → FINDING: flows-retry-no-backoff-4 (severity: medium, effort: XS)
   - Evidence: "HTTP client retries immediately on 5xx - exacerbates service degradation"
   - Remediation: "Implement exponential backoff with jitter for retry attempts"
5. IF retry_without_max_attempts
   → FINDING: flows-retry-no-max-5 (severity: medium, effort: XS)
   - Evidence: "Retry loop continues indefinitely on persistent failure"
   - Remediation: "Set maximum retry attempts (e.g., 3) before giving up"
6. IF no_timeout_on_external_calls
   → FINDING: flows-missing-timeout-6 (severity: medium, effort: M)
   - Evidence: "HTTP client calls to payment gateway have no timeout - can hang indefinitely"
   - Remediation: "Set reasonable timeout values (e.g., 5s connect, 15s read)"
7. IF no_circuit_breaker_for_external_calls
   → FINDING: flows-missing-circuit-breaker-7 (severity: medium, effort: M)
   - Evidence: "Repeated calls to failing external service waste resources and delay failure detection"
   - Remediation: "Implement circuit breaker pattern to fail fast when service is unhealthy"
8. IF message_processing_not_idempotent
   → FINDING: flows-message-not-idempotent-8 (severity: high, effort: M)
   - Evidence: "Message handler performs non-idempotent operations (e.g., sends email)"
   - Remediation: "Make processing idempotent or use deduplication mechanism"
9. IF no_visibility_timeout_config
   → FINDING: flows-missing-visibility-timeout-9 (severity: medium, effort: M)
   - Evidence: "SQS visibility timeout too short causes duplicate processing"
   - Remediation: "Set visibility timeout to exceed expected processing time"
10. IF no_dead_letter_on_repeated_failures
    → FINDING: flows-dlq-on-repeat-failures-10 (severity: high, effort: M)
    - Evidence: "Messages failing same validation repeatedly stay in main queue"
    - Remediation: "Configure dead letter queue for repeatedly failing messages"
```

### Orchestration (n8n Specific)
```markdown
1. IF n8n_workflow_has_no_error_trigger
   → FINDING: flows-n8n-no-error-handling-1 (severity: high, effort: S)
   - Evidence: "Workflow lacks error trigger node - failures go unnoticed"
   - Remediation: "Add error trigger node connected to notification/escalation flow"
2. IF n8n_code_node_returns_wrong_format
   → FINDING: flows-n8n-code-node-format-2 (severity: high, effort: XS)
   - Evidence: "Code node returns object instead of [{json: {...}}] array format"
   - Remediation: "Return array of objects with json property: [{json: {result: value}}]"
3. IF n8n_schedule_trigger_interval_not_array
   → FINDING: flows-n8n-schedule-format-3 (severity: medium, effort: XS)
   - Evidence: "Schedule trigger uses 'every 5 minutes' instead of [5] for minutes field"
   - Remediation: "Use array format: [5] for minutes, [0,12] for hours, etc."
4. IF n8n_workflow_missing_timeout_handling
   → FINDING: flows-n8n-no-timeout-4 (severity: medium, effort: M)
   - Evidence: "HTTP Request node lacks timeout setting - can hang indefinitely"
   - Remediation: "Set reasonable timeout values on all HTTP Request nodes"
5. IF n8n_workflow_no_retry_on_failed_nodes
   → FINDING: flows-n8n-no-retry-5 (severity: medium, effort: M)
   - Evidence: "Failed nodes (e.g., HTTP Request) don't retry automatically"
   - Remediation: "Enable retry on failed nodes with appropriate backoff"
6. IF n8n_workflow_no_data_validation
   → FINDING: flows-n8n-no-validation-6 (severity: medium, effort: M)
   - Evidence: "Workflow processes data without validating required fields exist"
   - Remediation: "Add IF nodes or Function nodes to validate input data"
7. IF n8n_workflow_hardcoded_secrets
   → FINDING: flows-n8n-hardcoded-secrets-7 (severity: critical, effort: XS)
   - Evidence: "API keys and tokens hardcoded in Function nodes or HTTP headers"
   - Remediation: "Use n8n credentials or environment variables for secrets"
8. IF n8n_workflow_no_logging_or_auditing
   → FINDING: flows-n8n-no-logging-8 (severity: medium, effort: M)
   - Evidence: "Workflow lacks logging or audit trail for debugging"
   - Remediation: "Add Set nodes to log key values or use n8n's built-in execution logging"
9. IF n8n_workflow_no_version_control_comments
   → FINDING: flows-n8n-no-changelog-9 (severity: low, effort: S)
   - Evidence: "Workflow updated but no documentation of what changed"
   - Remediation: "Maintain changelog within workflow description or external documentation"
10. IF n8n_workflow_excessive_node_count
    → FINDING: flows-n8n-too-many-nodes-10 (severity: medium, effort: L)
    - Evidence: "Simple data transfer workflow has 47 nodes"
    - Remediation: "Consolidate sequential functions and remove unnecessary nodes"
```

### Event/Message Flows
```markdown
1. IF message_schema_no_versioning
   → FINDING: flows-message-schema-no-version-1 (severity: medium, effort: M)
   - Evidence: "UserCreated event schema changed breaking existing consumers"
   - Remediation: "Add version field to message schema and support multiple versions"
2. IF message_schema_breaking_change
   → FINDING: flows-message-breaking-schema-2 (severity: high, effort: M)
   - Evidence: "Removed required field from event without deprecation period"
   - Remediation: "Use backward-compatible changes only; add new fields as optional"
3. IF consumer_group_lag_excessive
   → FINDING: flows-consumer-group-lag-3 (severity: high, effort: M)
   - Evidence: "Kubernetes consumer group lag 5000 messages during peak hours"
   - Remediation: "Increase consumer replicas or optimize processing speed"
4. IF no_message_ordering_guarantee_when_needed
   → FINDING: flows-message-ordering-needed-4 (severity: medium, effort: M)
   - Evidence: "Financial transactions processed out of order causing incorrect balances"
   - Remediation: "Use partitioning or sequencing to guarantee order when required"
5. IF dead_letter_queue_not_monitored
   → FINDING: flows-dlq-not-monitored-5 (severity: medium, effort: M)
   - Evidence: "DLQ growing steadily indicates persistent processing issues"
   - Remediation: "Set up alerts on DLQ size and regularly inspect contents"
6. IF message_retention_too_short
   → FINDING: flows-message-retention-too-short-6 (severity: medium, effort: M)
   - Evidence: "Messages deleted after 1 hour - insufficient time for retry processing"
   - Remediation: "Increase retention period to allow for multiple retry attempts"
7. IF message_retention_too_long
   → FINDING: flows-message-retention-too-long-7 (severity: low, effort: S)
   - Evidence: "Messages retained indefinitely increasing storage costs"
   - Remediation: "Implement retention policy based on business requirements"
8. IF no_schema_registry_for_events
   → FINDING: flows-no-schema-registry-8 (severity: medium, effort: M)
   - Evidence: "Services rely on shared understanding of event structure"
   - Remediation: "Use schema registry (Confluent, AWS Glue) for version control and validation"
9. IF message_encryption_not_used_when_required
   → FINDING: flows-message-not-encrypted-9 (severity: high, effort: M)
   - Evidence: "Payment card data transmitted in plaintext over internal network"
   - Remediation: "Encrypt sensitive message payloads using appropriate standards"
10. IF no_message_compression_for_large_payloads
    → FINDING: flows-message-not-compressed-10 (severity: low, effort: M)
    - Evidence: "1MB JSON payloads transmitted without compression wasting bandwidth"
    - Remediation: "Enable compression for payloads exceeding threshold (e.g., 10KB)"
```

### State Management
```markdown
1. IF redux_store_mutations_direct
   → FINDING: flows-redux-mutates-state-1 (severity: high, effort: M)
   - Evidence: "Reducer directly modifies state array: state.items.push(newItem)"
   - Remediation: "Return new state array: return [...state.items, newItem]"
2. IF redux_reducer_side_effects
   → FINDING: flows-redux-side-effects-2 (severity: medium, effort: M)
   - Evidence: "Reducer makes API call or uses Date.now() - impure function"
   - Remediation: "Keep reducers pure; move side effects to middleware or epics"
3. IF vuex_state_not_normalized
   → FINDING: flows-vuex-denormalized-state-3 (severity: medium, effort: M)
   - Evidence: "Nested user objects in posts array causing update complexity"
   - Remediation: "Normalize state: {users: {id: user}, posts: [{userId: 1, ...}]}"
4. IF ngrx_selectors_not_memoized
   → FINDING: flows-ngrx-selectors-not-memoized-4 (severity: medium, effort: M)
   - Evidence: "Selector recalculates expensive computation on every change"
   - Remediation: "Use createSelector to memoize expensive computations"
5. IF state_update_triggers_expensive_computation
   → FINDING: flows-state-expensive-update-5 (severity: medium, effort: M)
   - Evidence: "Every state change triggers full re-render of large component tree"
   - Remediation: "Use selective subscription or change detection optimization"
6. IF no_state_persistence_or_hydration
   → FINDING: flows-no-state-persistence-6 (severity: low, effort: M)
   - Evidence: "State resets on page refresh losing user context"
   - Remediation: "Implement state persistence to localStorage or sessionStorage"
7. IF state_access_patterns_inefficient
   → FINDING: flows-state-inefficient-access-7 (severity: medium, effort: M)
   - Evidence: "Component maps entire state when only needs one field"
   - Remediation: "Use selective subscription (mapState, useSelector) for specific needs"
8. IF excessive_state_nesting
   → FINDING: flows-state-excessive-nesting-8 (severity: low, effort: S)
   - Evidence: "state.ui.theme.colors.primary instead of state.themeColor"
   - Remediation: "Flatten state structure where possible for easier access"
9. IF no_time_travel_debugging
   → FINDING: flows-no-time-travel-9 (severity: low, effort: S)
   - Evidence: "Unable to replay state changes for debugging complex interactions"
   - Remediation: "Enable Redux DevTools or equivalent for time-travel debugging"
10. IF state_initialization_missing_defaults
    → FINDING: flows-state-missing-defaults-10 (severity: medium, effort: M)
    - Evidence: "State property undefined on initialization causing runtime errors"
    - Remediation: "Provide sensible default values for all state properties"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "flows"
- `id`: flows-[category]-[number] (e.g., flows-auth-order-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to flow/workflow/config file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Workflow name, handler name, or state property if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the flow issue
- `remediation`: Specific change to fix the flow issue
- `effort`: Estimated effort to fix (XS-S for config changes, M-L for architectural changes)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["request-flow", "async", "webhook", "n8n", "redux", "kafka"]
- `relatedFindings`: IDs of related findings (e.g., flows finding related to performance bottlenecks)
- `evidence`: 
  - `snippet`: Relevant workflow definition, handler code, or configuration excerpt
  - `metric`: Delay time, failure rate, throughput, or queue depth measurements
  - `benchmark`: SLA, industry standard, or historical baseline if available

### flow-analysis-summary.json
```json
{
  "requestFlowAnalysis": {
    "endpointsAnalyzed": 42,
    "middlewareStackQuality": {
      "authBeforeValidation": 38,
      "validationInMiddleware": 35,
      "globalErrorHandler": 40,
      "requestIdMiddleware": 12,
      "rateLimitingPublic": 18,
      "corsConfigured": 30,
      "securityHeaders": 25
    },
    "responseConsistency": {
      "standardFormatAdherence": 0.78,
      "inconsistentEndpoints": 9,
      "missingErrorHandling": 3
    }
  },
  "asyncProcessingAnalysis": {
    "backgroundJobs": 18,
    "fireAndForgetCritical": 2,
    "missingDlq": 5,
    "missingIdempotency": 3,
    "retryWithoutBackoff": 7,
    "missingTimeouts": 10,
    "missingCircuitBreaker": 12,
    "messageNotIdempotent": 4
  },
  "eventFlowAnalysis": {
    "messageSchemas": 8,
    "schemaVersioning": 3,
    "breakingSchemaChanges": 1,
    "consumerGroups": 5,
    "averageLag": "250 messages",
    "maxLag": "2100 messages",
    "dlqMonitoring": 2,
    "messageRetention": {
      "tooShort": 1,
      "appropriate": 5,
      "tooLong": 2
    },
    "schemaRegistry": 1,
    "encryptionWhenRequired": 4,
    "compressionForLargePayloads": 6
  },
  "orchestrationHealth": {
    "n8nWorkflows": 12,
    "missingErrorTriggers": 5,
    "codeNodeFormatErrors": 8,
    "scheduleFormatErrors": 15,
    "missingTimeouts": 10,
    "missingRetry": 11,
    "missingValidation": 9,
    "hardcodedSecrets": 3,
    "missingLogging": 7,
    "excessiveNodes": 4
  },
  "stateManagementHealth": {
    "reduxStores": 8,
    "directMutations": 2,
    "sideEffectsInReducers": 4,
    "vuexStores": 3,
    "denormalizedState": 5,
    "ngrxStores": 6,
    "unmemoizedSelectors": 10,
    "expensiveUpdates": 3,
    "noPersistence": 5,
    "inefficientAccess": 7,
    "excessiveNesting": 2,
    "noTimeTravel": 9
  },
  "flowRiskScore": 0.52,
  "recommendationPriority": [
    "Add idempotency keys to payment endpoints",
    "Configure dead letter queues for all message queues",
    "Add error triggers to n8n workflows",
    "Fix request/validation middleware order",
    "Add timeouts to external HTTP calls"
  ]
}
```

## Examples

### Example 1: Missing Auth Middleware Order
**Input**: 
- File: `src/middleware/index.js`
- Content: 
```javascript
const express = require('express');
const app = express();

// MIDDLEWARE ORDER: Validation before Auth
app.use(validateRequestBody); // Validation runs first
app.use(authenticateUser);    // Auth runs second

app.post('/api/orders', orderController.createOrder);
```
**Analysis**:
- Validation middleware runs before auth middleware
- Wastes resources validating requests that will be rejected by auth
**Output**:
- findings[]:
  - flows-auth-order-1 (severity: high, effort: S):
    - Description: "Auth middleware runs after validation middleware"
    - Location: src/middleware/index.js lines 7-10
    - Remediation: "Move authenticateUser middleware before validateRequestBody"
    - Evidence: "validateRequestBody runs before authenticateUser in middleware stack"
    - Metric: "Wasted validation cycles on unauthenticated requests"
- flow-analysis-summary.json:
  {
    "requestFlowAnalysis": {
      "middlewareStackQuality": {
        "authBeforeValidation": 0, // This instance fails
        "validationInMiddleware": 1,
        // ... other metrics
      }
    }
  }
```

### Example 2: Fire-and-Forget Payment Processing
**Input**: 
- File: `src/services/paymentService.js`
- Content: 
```javascript
class PaymentService {
  async processPayment(paymentData) {
    // FIRE-AND-FORGET: No await, no error handling
    this.paymentGateway.charge(paymentData.amount, paymentData.token);
    // Returns immediately - caller doesn't know if payment succeeded
    return { status: 'initiated' };
  }
}

// Usage elsewhere:
paymentService.processPayment(paymentDetails);
// Controller returns 200 OK immediately regardless of actual payment result
```
**Analysis**:
- Payment processing initiated but not awaited
- No way to know if payment succeeded or failed
- Critical financial operation lacks confirmation
**Output**:
- findings[]:
  - flows-fire-and-forget-critical-1 (severity: critical, effort: M):
    - Description: "Critical payment processing uses fire-and-forget pattern"
    - Location: src/services/paymentService.js line 5
    - Remediation: "Await the payment gateway call and handle errors appropriately"
    - Evidence: "this.paymentGateway.charge() called without await"
    - Metric: "Financial risk: payments may fail silently"
  - flows-unhandled-promise-2 (severity: high, effort: S):
    - Description: "Returned promise not handled by caller"
    - Location: Controller calling paymentService.processPayment()
    - Remediation: "Either await the promise or handle with .then/.catch"
    - Evidence: "Controller ignores returned promise from payment service"
    - Metric: "Silent failure risk: payment errors ignored"
- flow-analysis-summary.json:
  {
    "asyncProcessingAnalysis": {
      "fireAndForgetCritical": 1,
      "unhandledPromises": 1,
      "missingIdempotency": 0
    }
  }
```

### Example 3: n8n Workflow Missing Error Handling
**Input**: 
- File: `workflows/customer-onboarding.json`
- Content: 
```json
{
  "name": "Customer Onboarding",
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Webhook",
      "position": [250, 300],
      "parameters": {
        "path": "onboard"
      }
    },
    {
      "type": "n8n-nodes-base.function",
      "name": "Process Data",
      "position": [500, 300],
      "parameters": {
        "functionCode": "return [{ json: { ...$json[0], processed: true } }];"
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "name": "Update CRM",
      "position": [750, 300],
      "parameters": {
        "url": "https://crm.example.com/api/customers",
        "method": "POST",
        "jsonParameters": true,
        "options": {
          "bodyContent": "={{ $json }}"
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Process Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process Data": {
      "main": [
        [
          {
            "node": "Update CRM",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```
**Analysis**:
- Workflow lacks error handling - if HTTP Request node fails, failure goes unnoticed
- No notification, logging, or escalation path for failures
**Output**:
- findings[]:
  - flows-n8n-no-error-handling-1 (severity: high, effort: S):
    - Description: "n8n workflow lacks error trigger node"
    - Location: workflows/customer-onboarding.json (workflow definition)
    - Remediation: "Add error trigger node connected to notification/escalation flow"
    - Evidence: "Workflow definition shows no error connections from any node"
    - Metric: "Failure visibility: zero - errors will go unnoticed"
  - flows-n8n-no-timeout-3 (severity: medium, effort: M):
    - Description: "HTTP Request node lacks timeout setting"
    - Location: workflows/customer-onboarding.json (HTTP Request node)
    - Remediation: "Set reasonable timeout values (e.g., 10000ms)"
    - Evidence: "HTTP Request node missing timeout parameter"
    - Metric: "Hang risk: HTTP Request can block indefinitely"
- flow-analysis-summary.json:
  {
    "orchestrationHealth": {
      "n8nWorkflows": 1,
      "missingErrorTriggers": 1,
      "missingTimeouts": 1,
      "codeNodeFormatErrors": 0,
      "scheduleFormatErrors": 0,
      "missingRetry": 0,
      "missingValidation": 0,
      "hardcodedSecrets": 0,
      "missingLogging": 0,
      "excessiveNodes": 0
    }
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding domain-specific flow analysis patterns (e.g., financial transactions, healthcare data)
2. Enhancing async processing rules with language/framework-specific patterns (e.g., .NET Task patterns)
3. Adding new finding types for specific orchestration platforms (Airflow, Temporal, AWS Step Functions)
4. Improving the flow-analysis-summary.json with additional metrics (e.g., throughput analysis, latency distribution)
5. Adding new examples for additional orchestration systems and messaging platforms
6. Improving event/message flow analysis with more sophisticated schema evolution detection
7. Adding security-specific flow findings (e.g., missing encryption, insufficient authentication)