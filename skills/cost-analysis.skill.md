---
name: cost-analysis
description: Teach LLM to estimate and optimize operational costs including infrastructure, third-party services, and development expenses
version: 1.0
module: cost
llmCapabilities:
  - Tool use for filesystem and git access
  - Structured output for findings
  - Reasoning over infrastructure, service usage, and cost optimization
inputs:
  - Infrastructure configuration (Dockerfiles, Kubernetes manifests, Terraform)
  - CI/CD configuration (GitHub Actions, GitLab CI, Jenkinsfiles)
  - Third-party service configurations (API keys, service clients)
  - Usage logs or metrics (if available)
  - Dependency manifests (for licensing and service costs)
  - Access to filesystem-mcp and github-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "cost")
  - cost-analysis-summary.json (cost breakdown, optimization opportunities, ROI estimates)
mcpDependencies:
  - filesystem-mcp
  - github-mcp
decisionTrees:
  - GitHub Actions Cost
  - Third-Party API Costs
  - Infrastructure Signals
  - Licensing and Open Source Compliance
  - Development Efficiency
---

# Cost Analyst

Teaches an LLM to act as a cost analyst, estimating operational costs and identifying optimization opportunities to reduce expenses while maintaining or improving service quality.

## When to Use This Skill

Use this skill after establishing project context to evaluate:
- Infrastructure costs (compute, storage, networking, databases)
- Third-party service costs (APIs, SaaS, licensing)
- Development and maintenance costs (CI/CD, testing, technical debt)
- Opportunity costs (performance issues causing lost revenue or users)
- Compliance costs (audit preparation, certification maintenance)

## Inputs

Before using this skill, the LLM should gather:
1. Infrastructure configuration:
   - Dockerfiles (`**/Dockerfile`, `**/docker-compose.yml`)
   - Kubernetes manifests (`**/k8s/**/*.yaml`, `**/helm/**/*`)
   - Terraform (`**/*.tf`, `**/*.tfvars`)
   - Cloud provider specific (`**/aws/**/*`, `**/azure/**/*`, `**/gcp/**/*`)
   - Traditional server configs (`**/httpd.conf`, `**/nginx.conf`)
2. CI/CD configuration:
   - GitHub Actions (`**/.github/workflows/**/*.yml`)
   - GitLab CI (`**/.gitlab-ci.yml`)
   - Jenkins (`**/Jenkinsfile`, `**/jenkins/**/*`)
   - Build scripts (`**/build.sh`, `**/package.json` scripts)
3. Third-party service configurations:
   - API client initialization (`**/src/**/*` with Stripe, Twilio, SendGrid, etc.)
   - Service client configuration (`**/config/**/*`)
   - API key usage (identified via secret detection patterns)
4. Usage logs or metrics (if available in repository):
   - Access logs (`**/logs/**/access.log*`)
   - Application metrics (`**/metrics/**/*`)
   - Monitoring dashboards (exported configs)
5. Dependency manifests:
   - `package.json`, `requirements.txt`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`
   - For identifying licensed components and potential costs
6. Access to the following MCPs:
   - `filesystem-mcp`: For reading configuration and usage files
   - `github-mcp`: For accessing CI/CD usage and repository insights

## Analysis Procedure

### Step 1: Infrastructure Discovery
Use filesystem-mcp to locate infrastructure as code and configuration files.

### Step 2: CI/CD Analysis
Examine CI/CD configuration for usage patterns and optimization opportunities.

### Step 3: Third-Party Service Identification
Identify third-party service usage through code patterns and configuration.

### Step 4: Cost Estimation and Optimization
Apply decision trees to estimate costs and identify savings opportunities.

### Step 5: Output Generation
Emit findings[] array and cost-analysis-summary.json with:
- Infrastructure cost estimates
- Third-party service cost analysis
- Development efficiency metrics
- Licensing and compliance considerations
- Optimization opportunities with ROI estimates

## Decision Trees

### GitHub Actions Cost
```markdown
1. IF actions_minutes_month > 50_000 (private repo)
   → FINDING: cost-gha-high-usage-1 (severity: medium, effort: M)
   - Evidence: "Repository consumed 75,000 GitHub Actions minutes last month"
   - Remediation: "Consider self-hosted runners saving ~$0.008/minute after threshold"
2. IF actions_minutes_month > 10_000 AND public_repo
   → FINDING: cost-gha-public-usage-2 (severity: low, effort: M)
   - Evidence: "Public repo using 15,000 free minutes monthly approaching limit"
   - Remediation: "Monitor usage to avoid unexpected charges if repo goes private"
3. IF workflow_runs_daily > 100 AND many_failures
   → FINDING: cost-gha-wasteful-retries-3 (severity: medium, effort: S)
   - Evidence: "Workflow runs 150 times daily with 40% failure rate"
   - Remediation: "Fix root causes of failures to reduce wasted compute"
4. IF workflow_uses_expensive_os_for_simple_task
   → FINDING: cost-gha-expensive-runner-4 (severity: low, effort: M)
   - Evidence: "Using ubuntu-latest for simple bash script when self-hosted runner available"
   - Remediation: "Use self-hosted runners with appropriate software for cost savings"
5. IF no_caching_dependencies
   → FINDING: cost-gha-no-dependency-cache-5 (severity: medium, effort: M)
   - Evidence: "npm install runs fresh on every workflow execution"
   - Remediation: "Cache node_modules between workflow runs"
6. IF no_artifact_retention_policy
   → FINDING: cost-gha-infinite-artifacts-6 (severity: medium, effort: M)
   - Evidence: "Artifacts retained indefinitely increasing storage costs"
   - Remediation: "Set retention period: keep artifacts for 30 days then delete"
7. IF concurrent_job_limit_not_optimized
   → FINDING: cost-gha-concurrent-limit-7 (severity: low, effort: M)
   - Evidence: "Strategy: max-parallel: 10 when only 2 jobs typically run"
   - Remediation: "Adjust concurrency limits to match actual usage patterns"
8. IF no_selective_branch_tracking
   → FINDING: cost-gha-always-on-8 (severity: low, effort: S)
   - Evidence: "Workflow runs on all branches including feature and dev branches"
   - Remediation: "Use branches: [main, 'releases/**'] to limit workflow triggers"
9. IF no_workflow_timeout
   → FINDING: cost-gha-no-timeout-9 (severity: medium, effort: M)
   - Evidence: "Job lacks timeout - can run indefinitely on stuck process"
   - Remediation: "Set reasonable timeout: timeout-minutes: 60"
10. IF no_matrix_optimization
    → FINDING: cost-gha-matrix-inefficient-10 (severity: medium, effort: M)
    - Evidence: "Matrix runs 24 combinations (3x4x2) when only 6 are needed"
    - Remaining: "Optimize matrix to exclude unnecessary combinations"
```

### Third-Party API Costs
```markdown
1. IF openai_calls_estimated > 1M_tokens_month
   → FINDING: cost-llm-high-usage-1 (severity: medium, effort: M)
   - Evidence: "Application estimates 1.5M OpenAI tokens monthly (~$75 at GPT-3.5-turbo)"
   - Remediation: "Implement caching, use smaller models for simple tasks, optimize prompts"
2. IF openai_calls_estimated > 5M_tokens_month
   → FINDING: cost-llm-very-high-usage-2 (severity: high, effort: L)
   - Evidence: "Application estimates 6M OpenAI tokens monthly (~$300 at GPT-3.5-turbo)"
   - Remediation: "Consider fine-tuning smaller model or implementing response caching"
3. IF external_api_calls_in_loop
   → FINDING: cost-api-in-loop-3 (severity: high, effort: M)
   - Evidence: "Processing 1000 items with individual API calls in for loop"
   - Remediation: "Batch API calls: process 100 items per request instead of 1"
4. IF no_api_rate_limiting_client_side
   → FINDING: cost-api-no-client-rate-limit-4 (severity: medium, effort: M)
   - Evidence: "Application makes requests as fast as possible without throttling"
   - Remediation: "Implement client-side rate limiting to stay within free tiers"
5. IF no_api_response_caching
   → FINDING: cost-api-no-response-cache-5 (severity: medium, effort: M)
   - Evidence: "Identical API calls made repeatedly without caching results"
   - Remediation: "Implement caching layer (Redis, Memorable, or in-memory) for idempotent calls"
6. IF using_expensive_api_when_cheaper_available
   → FINDING: cost-api-wrong-tier-6 (severity: medium, effort: M)
   - Evidence: "Using Stripe for simple card processing when cheaper alternatives exist"
   - Remediation: "Evaluate if lower-cost payment processor meets requirements"
7. IF api_call_without_idempotency_key
   → FINDING: cost-api-no-idempotency-7 (severity: medium, effort: M)
   - Evidence: "Payment API calls lack idempotency key - susceptible to duplicate charges"
   - Remediation: "Add idempotency key header to prevent duplicate charges on retry"
8. IF no_api_error_retry_strategy
   → FINDING: cost-api-no-retry-strategy-8 (severity: medium, effort: M)
   - Evidence: "API errors cause immediate failure instead of intelligent retry"
   - Remediation: "Implement retry strategy with exponential backoff and jitter"
9. IF no_api_usage_monitoring
   → FINDING: cost-api-no-usage-monitoring-9 (severity: medium, effort: M)
   - Evidence: "No tracking of API call volume or cost"
   - Remediation: "Implement API usage monitoring and alerting"
10. IF using_deprecated_api_endpoint
    → FINDING: cost-api-deprecated-endpoint-10 (severity: low, effort: S)
    - Evidence: "Using Twitter API v1.1 when v2 is available and cheaper"
    - Remaining: "Migrate to newer API version for better performance and pricing"
```

### Infrastructure Signals
```markdown
1. IF k8s_requests >> limits_consistently
   → FINDING: cost-overprovisioned-k8s-1 (severity: medium, effort: M)
   - Evidence: "Pods consistently request 8CPU/32GB but only use 2CPU/8GB"
   - Remediation: "Right-size resource requests to match actual usage"
2. IF k8s_limits >> requests_consistently
   → FINDING: cost-overprovisioned-k8s-limits-2 (severity: medium, effort: M)
   - Evidence: "Pods limited to 16CPU/64GB but nodes only have 8CPU/32GB"
   - Remediation: "Adjust limits to match node capacity or add larger nodes"
3. IF database_storage_growing_rapidly_without_archival
   → FINDING: cost-db-growth-3 (severity: medium, effort: M)
   - Evidence: "Users table growing 10GB/day without archival of inactive users"
   - Remediation: "Implement archival strategy for inactive data"
4. IF database_backups_not_optimized
   → FINDING: cost-db-backup-4 (severity: medium, effort: M)
   - Evidence: "Full backups taken daily instead of incremental + weekly full"
   - Remediation: "Implement incremental backup strategy with periodic full backups"
5. IF database_connection_pool_misconfigured
   → FINDING: cost-db-pool-5 (severity: medium, effort: M)
   - Evidence: "Connection pool set to 200 connections when max usage is 20"
   - Remediation: "Right-size connection pool to match actual concurrent usage"
6. IF redis_used_as_primary_database
   → FINDING: cost-redis-as-db-6 (severity: medium, effort: M)
   - Evidence: "Using Redis as primary data store instead of cache layer"
   - Remediation: "Use Redis for caching only; use proper database for persistence"
7. IF cdn_not_used_for_static_assets
   → FINDING: cost-missing-cdn-7 (severity: low, effort: S)
   - Evidence: "Serving 2TB/month of static assets from origin servers"
   - Remediation: "Use CDN to offload static asset delivery and reduce origin load"
8. IF no_image_optimization
   → FINDING: cost-unoptimized-images-8 (severity: medium, effort: M)
   - Evidence: "Serving 5MB JPEG images when WebP at 80% quality would be 800KB"
   - Remediation: "Implement image optimization pipeline (format conversion, compression, resizing)"
9. IF no_http_compression
   → FINDING: cost-no-http-compression-9 (severity: medium, effort: M)
   - Evidence: "API responses not compressed with gzip or Brotli"
   - Remediation: "Enable HTTP compression to reduce bandwidth usage by 60-80%"
10. IF no_database_connection_pooling
    → FINDING: cost-db-no-pooling-10 (severity: high, effort: M)
    - Evidence: "Application creates new database connection per request"
    - Remediation: "Implement connection pooling (HikariCP, PgBouncer, etc.)"
```

### Licensing and Open Source Compliance
```markdown
1. IF license_incompatible_with_commercial_use
   → FINDING: cost-license-incompatible-1 (severity: high, effort: M)
   - Evidence: "GPLv2 dependency in proprietary commercial software"
   - Remediation: "Replace with permissive-licensed alternative or comply with GPL obligations"
2. IF license_requires_attribution_missing
   → FINDING: cost-license-attribution-missing-2 (severity: medium, effort: M)
   - Evidence: "MIT-licensed library used without required attribution in documentation"
   - Remediation: "Add required attribution to documentation and/about page"
3. IF license_requires_share_alike_not_followed
   → FINDING: cost-license-share-alike-3 (severity: high, effort: L)
   - Evidence: "GPL dependency used without making derivative work GPL"
   - Remediation: "Either comply with GPL or replace with compatible alternative"
4. IF patent_licensing_risk_not_evaluated
   → FINDING: cost-patent-risk-4 (severity: medium, effort: M)
   - Evidence: "Using algorithm potentially covered by unsubstantiated patent claims"
   - Remediation: "Conduct patent landscape review or obtain legal opinion"
5. IF no_license_compliance_tracking
   → FINDING: cost-no-license-tracking-5 (severity: medium, effort: M)
   - Evidence: "No process for tracking license obligations of dependencies"
   - Remediation: "Implement automated license compliance checking (FOSSA, Snyk License)"
6. IF using_evaluation_or_non_commercial_license
   → FINDING: cost-non-commercial-use-6 (severity: high, effort: L)
   - Evidence: "Using JetBrains IDE evaluation licenses in production development"
   - Remediation: "Purchase proper commercial licenses or switch to free alternative"
7. IF trademark_infringement_risk
   → FINDING: cost-trademark-risk-7 (severity: medium, effort: M)
   - Evidence: "Using confusingly similar name to established product in same space"
   - Remediation: "Conduct trademark search and choose distinct name"
8. IF exporting_restricted_technology
   → FINDING: cost-export-restriction-8 (severity: high, effort: L)
   - Evidence: "Software contains encryption exceeding country's export limits"
   - Remediation: "Review export controls and obtain necessary licenses if required"
9. IF no_open_source_license_policy
    → FINDING: cost-no-oss-policy-9 (severity: medium, effort: M)
    - Evidence: "No policy governing use of open source components"
    - Remaining: "Create and implement open source use policy"
10. IF using_deprecated_or_unsafe_version
    → FINDING: cost-deprecated-version-10 (severity: medium, effort: M)
    - Evidence: "Using OpenSSL 1.0.1 (vulnerable to Heartbleed) instead of current version"
    - Remediation: "Update to current stable version for security and support"
```

### Development Efficiency
```markdown
1. IF build_time > 10_minutes
   → FINDING: cost-slow-build-1 (severity: medium, effort: M)
   - Evidence: "Average build time 14 minutes slowing down development feedback loop"
   - Remediation: "Optimize build process: incremental builds, caching, parallelization"
2. IF test_suite_time > 30_minutes
   → FINDING: cost-slow-tests-2 (severity: medium, effort: M)
   - Evidence: "Full test suite takes 45 minutes to run"
   - Remediation: "Parallelize tests, use test selection, optimize slow tests"
3. IF no_local_development_setup
   → FINDING: cost-dev-setup-missing-3 (severity: high, effort: M)
   - Evidence: "Developers must share staging environment to test changes"
   - Remediation: "Provide docker-compose or similar for local development"
4. IF no_automated_testing_in_ci
   → FINDING: cost-no-automated-tests-4 (severity: high, effort: M)
   - Evidence: "CI pipeline builds but does not run automated tests"
   - Remediation: "Add automated testing stage to catch regressions early"
5. IF test_flakiness_rate_high
   → FINDING: cost-flaky-tests-5 (severity: medium, effort: M)
   - Evidence: "20% of tests fail intermittently due to timing or external dependencies"
   - Remediation: "Fix flaky tests: use mocks, control timing, isolate dependencies"
6. IF code_review_process_absent
   → FINDING: cost-no-code-review-6 (severity: high, effort: L)
   - Evidence: "Code merged directly to main without review"
   - Remediation: "Implement pull request review process with required approvals"
7. IF no_documentation_or_outdated
   → FINDING: cost-documentation-poor-7 (severity: medium, effort: M)
   - Evidence: "API documentation missing or last updated 6 months ago"
   - Remediation: "Maintain up-to-date documentation as part of definition of done"
8. IF no_knowledge_sharing_process
   → FINDING: cost-no-knowledge-sharing-8 (severity: medium, effort: M)
   - Evidence: "Team relies on tribal knowledge instead of documented processes"
   - Remediation: "Implement regular knowledge sharing sessions and documentation"
9. IF technical_debt_ratio_high
   → FINDING: cost-technical-debt-high-9 (severity: medium, effort: M)
   - Evidence: "Technical debt ratio estimated at 0.45 based on issue backlog"
   - Remediation: "Allocate sprint capacity for technical debt reduction"
10. IF no_performance_budgeting
    → FINDING: cost-no-performance-budget-10 (severity: medium, effort: M)
    - Evidence: "No performance budgets set for page load times or API response times"
    - Remaining: "Establish performance budgets and monitor against them"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "cost"
- `id`: cost-[category]-[number] (e.g., cost-gha-high-usage-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to config/infrastructure file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Service/resource name or config key if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the cost issue
- `remediation`: Specific action to reduce or optimize cost
- `effort`: Estimated effort to implement (XS-S for config changes, M-L for architectural changes)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["infrastructure", "third-party", "licensing", "ci-cd", "development"]
- `relatedFindings`: IDs of related findings (e.g., cost finding related to performance bottlenecks)
- `evidence`: 
  - `snippet`: Relevant config/infrastructure/code excerpt
  - `metric`: Usage quantity, frequency, or cost estimate
  - `benchmark`: Industry standard, historical baseline, or competitive pricing if available

### cost-analysis-summary.json
```json
{
  "infrastructureCosts": {
    "compute": {
      "estimatedMonthly": 1250.00,
      "byService": {
        "ec2": 800.00,
        "eks": 300.00,
        "lambda": 150.00
      },
      "utilization": {
        "averageCpu": 35,
        "averageMemory": 42
      }
    },
    "storage": {
      "estimatedMonthly": 180.00,
      "byService": {
        "s3": 100.00,
        "ebs": 50.00,
        "rds-snapshots": 30.00
      },
      "growthRate": "15% per month"
    },
    "database": {
      "estimatedMonthly": 320.00,
      "byService": {
        "rds": 200.00,
        "dynamodb": 80.00,
        "elasticache": 40.00
      },
      "performance": {
        "averageCpuUtilization": 28,
        "averageStorageUtilization": 55
      }
    },
    "networking": {
      "estimatedMonthly": 90.00,
      "byService": {
        "dataTransfer": 50.00,
        "loadBalancer": 30.00,
        "route53": 10.00
      }
    }
  },
  "thirdPartyServiceCosts": {
    "estimatedMonthly": 475.00,
    "byService": {
      "stripe": 150.00,
      "twilio": 80.00,
      "sendgrid": 60.00,
      "sentry": 50.00,
      "mailchimp": 40.00,
      "intercom": 35.00,
      "hotjar": 30.00,
      "github": 20.00,
      "dockerhub": 10.00
    },
    "usageEfficiency": {
      "apiCallEfficiency": 0.65,
      "batchOpportunities": 4,
      "cachingOpportunities": 6
    }
  },
  "developmentCosts": {
    "estimatedMonthly": 2100.00,
    "byCategory": {
      "developerSalaries": 1800.00,
      "ciCd": 150.00,
      "testingTools": 100.00,
      "projectManagement": 50.00
    },
    "efficiencyMetrics": {
      "buildTimeAverage": "8 minutes",
      "testSuiteTime": "25 minutes",
      "codeReviewCoverage": 0.75,
      "documentationFreshness": "2 weeks",
      "technicalDebtRatio": 0.32
    }
  },
  "licensingCosts": {
    "estimatedMonthly": 0.00,
    "openSourceDependencies": 142,
    "commercialLicenses": 3,
    "licenseIssues": 0,
    "recommendations": [
      "Verify license compliance for all dependencies",
      "Consider contributing back to heavily used open source projects"
    ]
  },
  "optimizationOpportunities": [
    {
      "area": "Infrastructure",
      "opportunity": "Right-size EKS node groups",
      "estimatedMonthlySavings": 180.00,
      "implementationEffort": "M",
      "risk": "Low"
    },
    {
      "area": "Third-Party Services",
      "opportunity": "Implement API response caching",
      "estimatedMonthlySavings": 90.00,
      "implementationEffort": "M",
      "risk": "Low"
    },
    {
      "area": "Development",
      "opportunity": "Reduce build time with incremental compilation",
      "estimatedMonthlySavings": 120.00,
      "implementationEffort": "M",
      "risk": "Low"
    }
  ],
  "totalEstimatedMonthlyCost": 2985.00,
  "totalPotentialMonthlySavings": 390.00,
  "costOptimizationScore": 0.62
}
```

## Examples

### Example 1: High GitHub Actions Usage
**Input**: 
- Repository: Private company repository
- GitHub Actions usage: 65,000 minutes last month
- Current setup: Using GitHub-hosted runners for all workflows
**Analysis**:
- Exceeds 50,000 minute threshold for private repositories
- Incurring charges at $0.008 per minute beyond free tier
**Output**:
- findings[]:
  - cost-gha-high-usage-1 (severity: medium, effort: M):
    - Description: "High GitHub Actions usage incurring charges beyond free tier"
    - Location: GitHub repository usage metrics
    - Remediation: "Consider self-hosted runners for savings of ~$0.008/minute after 50k minutes"
    - Evidence: "65,000 minutes used = 15,000 chargeable minutes at $0.008/min = $120/month"
    - Metric: "Chargeable minutes: 15,000/month"
- cost-analysis-summary.json:
  {
    "infrastructureCosts": {
      "ciCd": {
        "estimatedMonthly": 120.00,
        "byService": {
          "githubActions": 120.00
        }
      }
    }
  }
```

### Example 2: Third-Party API Inefficiency
**Input**: 
- File: `src/services/notificationService.js`
- Content: 
```javascript
class NotificationService {
  async sendWelcomeEmail(userId) {
    const user = await userRepository.findById(userId);
    // INDIVIDUAL API CALLS: Sending emails one by one in loop
    for (const template of user.preferredTemplates) {
      await this.sendGrid.send({
        to: user.email,
        from: 'noreply@example.com',
        templateId: template.id,
        dynamicTemplateData: { name: user.name }
      });
    }
  }
}

// Usage in loop:
users.forEach(user => notificationService.sendWelcomeEmail(user.id));
```
**Analysis**:
- Sending individual API calls for each email template
- No batching - each email requires separate HTTP request to SendGrid
**Output**:
- findings[]:
  - cost-api-in-loop-3 (severity: high, effort: M):
    - Description: "Making individual API calls in loop instead of batching"
    - Location: src/services/notificationService.js line 6
    - Remediation: "Batch email sends: collect all emails and send in single API call"
    - Evidence: "for loop making separate SendGrid API calls for each template"
    - Metric: "Average 3 templates per user = 66% reduction in API calls possible"
  - cost-api-no-response-cache-5 (severity: medium, effort: M):
    - Description: "No caching of API responses"
    - Location: NotificationService class
    - Remediation: "Implement caching layer for idempotent API calls"
    - Evidence: "SendGrid API calls made without checking cache first"
    - Metric: "Cache hit rate: 0% - all requests go to network"
- cost-analysis-summary.json:
  {
    "thirdPartyServiceCosts": {
      "usageEfficiency": {
        "apiCallEfficiency": 0.35,
        "batchOpportunities": 1,
        "cachingOpportunities": 1
      }
    }
  }
```

### Example 3: Overprovisioned Kubernetes Resources
**Input**: 
- File: `k8s/deployment.yaml`
- Content: 
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api-server
        image: api-server:latest
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
```
**Analysis**:
- Container requests 2CPU/4GB but monitoring shows average usage of 0.3CPU/0.8GB
- Limits set to 4CPU/8GB when node capacity is 2CPU/4GB
**Output**:
- findings[]:
  - cost-overprovisioned-k8s-1 (severity: medium, effort: M):
    - Description: "Pod requests significantly exceed actual usage"
    - Location: k8s/deployment.yaml line 10 (resources.requests)
    - Remediation: "Right-size resource requests to match actual usage (e.g., 500mCPU/1Gi)"
    - Evidence: "Requests 2CPU/4Gi vs observed usage 0.3CPU/0.8Gi"
    - Metric: "Overprovisioning ratio: 5.7x CPU, 5x memory"
  - cost-overprovisioned-k8s-limits-2 (severity: medium, effort: M):
    - Description: "Pod limits exceed node capacity causing scheduling issues"
    - Location: k8s/deployment.yaml line 13 (resources.limits)
    - Remediation: "Adjust limits to match node capacity or add larger nodes"
    - Evidence: "Limits 4CPU/4Gi on nodes with 2CPU/4Gi capacity"
    - Metric: "Limit exceeds capacity: 2x CPU, 2x memory"
- cost-analysis-summary.json:
  {
    "infrastructureCosts": {
      "compute": {
        "estimatedMonthly": 480.00,
        "utilization": {
          "averageCpu": 15,
          "averageMemory": 20
        }
      }
    }
  }
```

### Example 4: Licensing Compliance Issue
**Input**: 
- File: `package.json`
- Content: 
```json
{
  "name": "proprietary-software",
  "version": "1.0.0",
  "dependencies": {
    "some-gpl-library": "^2.0.0"
  }
}
```
**Analysis**:
- Using GPLv2-licensed library in proprietary commercial software
- Violates GPL copyleft requirement - would require opening source code
**Output**:
- findings[]:
  - cost-license-incompatible-1 (severity: high, effort: M):
    - Description: "GPLv2 licensed dependency in proprietary commercial software"
    - Location: package.json line 5
    - Remediation: "Replace with permissive-licensed alternative or comply with GPL obligations"
    - Evidence: "some-gpl-library@2.0.0 licensed under GPLv2"
    - Metric: "License risk: high - potential requirement to open source proprietary code"
- cost-analysis-summary.json:
  {
    "licensingCosts": {
      "licenseIssues": 1,
      "recommendations": [
        "Replace some-gpl-library with MIT/BSD-licensed alternative",
        "If keeping GPL dependency, must release source code under GPL"
      ]
    }
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding domain-specific cost analysis patterns (e.g., financial trading systems, video streaming)
2. Enhancing infrastructure cost models with cloud provider specifics (AWS Graviton, Azure Spot, etc.)
3. Adding new finding types for specific cost optimization patterns (e.g., serverless migration benefits)
4. Improving the cost-analysis-summary.json with additional metrics (e.g., unit economics, LTV:CAC ratio)
5. Adding new examples for additional cloud providers and service combinations
6. Improving third-party service analysis with more detailed pricing models and volume tiers
7. Adding development efficiency metrics specific to certain methodologies (Agile, DevOps, etc.)