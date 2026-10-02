---
name: security-assessment
description: Teach LLM to scan for security risks including secrets, vulnerabilities, and configuration issues
version: 1.0
module: security
llmCapabilities:
  - Tool use for filesystem, git, and github access
  - Structured output for findings
  - Reasoning over code, configuration, and dependency security
inputs:
  - Code files (for secret detection and insecure patterns)
  - Configuration files (for security misconfigurations)
  - Dependency manifests (for vulnerability scanning)
  - Optional: GitHub token (for accessing private repo security features)
  - Access to github, filesystem, and git-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "security")
  - security-summary.json (vulnerability analysis, secret detection results, configuration issues)
mcpDependencies:
  - github
  - filesystem
  - git-mcp
decisionTrees:
  - Secret Detection
  - Dependency Vulnerabilities
  - GitHub Actions Security
  - Configuration Security
---

# Security Analyst

Teaches an LLM to act as a security analyst, scanning for vulnerabilities, secrets, misconfigurations, and other security risks that could compromise the application or data.

## When to Use This Skill

Use this skill after establishing project context to evaluate:
- Secret management (API keys, tokens, credentials in code)
- Dependency security (known vulnerabilities in libraries)
- Infrastructure security (misconfigurations, excessive permissions)
- Application security (insecure patterns, missing protections)
- Compliance (regulatory requirements, data protection)

## Inputs

> **Data Availability:** Rules that require scanning git history for secrets (e.g., `security-secret-in-history-2`) need full repository history access. If unavailable, skip the rule and lower confidence for dependent findings.

Before using this skill, the LLM should gather:
1. Code files:
   - Application code (`**/*.js`, `**/*.ts`, `**/*.py`, `**/*.java`, `**/*.go`, `**/*.cs`, etc.)
   - Configuration files (`**/*.json`, `**/*.yaml`, `**/*.toml`, `**/*.xml`, `**/*.properties`, `**/*.ini`)
   - Exclude: `node_modules/`, `vendor/`, `dist/`, `build/`, `coverage/`, `.git/`
2. Dependency manifests:
   - `package.json`, `requirements.txt`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`
   - Lockfiles: `package-lock.json`, `yarn.lock`, `pipfile.lock`, `poetry.lock`
3. Configuration files:
   - Server/web server configs (`**/nginx.conf`, `**/apache2.conf`, `**/iis.xml`)
   - Database configs (`**/database.yml`, `**/application.properties`)
   - Cloud configs (`**/terraform/**/*`, `**/cloudformation/**/*`)
   - CI/CD configs (`**/.github/workflows/**/*`, `**/.gitlab-ci.yml`)
4. Secret storage locations:
   - Environment files (`.env`, `.env.*`, `.env.local`)
   - Vault/secrets manager configs
5. Access to the following MCPs:
   - `github`: For accessing GitHub security features (secret scanning, Dependabot)
   - `filesystem`: For reading code and configuration files
   - `git-mcp`: For analyzing secret history in git

## Analysis Procedure

### Step 1: Secret Discovery
Use filesystem and git-mcp to search for secrets in code and git history.

### Step 2: Dependency Vulnerability Scan
Use github (if token available) or filesystem to check dependencies against vulnerability databases.

### Step 3: Configuration Security Review
Examine configuration files for security misconfigurations using decision trees.

### Step 4: GitHub Actions Security Audit
If GitHub token available, audit workflows for security issues.

### Step 5: Output Generation
Emit findings[] array and security-summary.json with:
- Secret detection results
- Vulnerability analysis
- Configuration issue identification
- GitHub Actions security findings
- Overall security risk assessment

## Decision Trees

### Secret Detection
```markdown
1. IF api_key_pattern IN committed_files
   → FINDING: security-secret-in-code-1 (severity: critical, effort: XS)
   - Evidence: "AKIA[0-9A-Z]{16} found in src/config/aws.js"
   - Remediation: "Remove key and rotate immediately; use environment variables or secrets manager"
2. IF secret_in_git_history (trufflehog/gitleaks patterns)
   → FINDING: security-secret-in-history-2 (severity: critical, effort: S)
   - Evidence: "AWS secret key found in commit abc123 from 2 weeks ago"
   - Remediation: "Rotate secret immediately; consider git history rewrite if extremely sensitive"
3. IF .env_committed
   → FINDING: security-env-file-committed-3 (severity: high, effort: XS)
   - Evidence: ".env file containing DATABASE_URL found in repository"
   - Remediation: "Add .env to .gitignore and remove from history using git filter-repo"
4. IF encryption_key_weak_or_short
   → FINDING: security-encryption-weak-5 (severity: critical, effort: XS)
   - Evidence: "AES key: '123456789012345' (15 bytes) found in crypto config"
   - Remediation: "Use proper key length (16, 24, or 32 bytes for AES) from secure random source"
5. IF database_connection_string_in_code
   → FINDING: security-db-conn-string-6 (severity: high, effort: XS)
   - Evidence: "postgres://user:password@localhost:5432/db found in database.js"
   - Remediation: "Use environment variables: process.env.DATABASE_URL"
6. IF private_key_in_code
   → FINDING: security-private-key-7 (severity: critical, effort: XS)
   - Evidence: "-----BEGIN RSA PRIVATE KEY----- found in src/ssl/server.key"
   - Remediation: "Store private key in secrets manager; never commit to repository"
7. IF oauth_token_or_secret_in_code
   → FINDING: security-oauth-secret-8 (severity: critical, effort: XS)
   - Evidence: "GitHub token: ghp_... found in integrations/github.js"
   - Remediation: "Use OAuth app credentials stored securely; never commit personal tokens"
8. IF encryption_algorithm_weak
   → FINDING: security-weak-crypto-9 (severity: high, effort: M)
   - Evidence: "Using MD5 or SHA1 for password hashing"
   - Remediation: "Use bcrypt, scrypt, or Argon2 for password hashing"
9. IF random_number_generator_weak
    → FINDING: security-weak-rng-10 (severity: medium, effort: M)
    - Evidence: "Using Math.random() for token generation instead of crypto.randomBytes"
    - Remediation: "Use cryptographically secure random number generator"
```

### Dependency Vulnerabilities
```markdown
1. IF CVE_critical_in_prod_dependency
   → FINDING: security-cve-critical-1 (severity: critical, effort: S)
   - Evidence: "lodash 4.17.10 (CVE-2018-3721) - Prototype pollution leading to RCE"
   - Remediation: "Update to lodash 4.17.21 or later"
2. IF CVE_high_in_prod_dependency
   → FINDING: security-cve-high-2 (severity: high, effort: S)
   - Evidence: "express 4.15.0 (CVE-2017-16112) - Path traversal vulnerability"
   - Remediation: "Update to express 4.18.2 or later"
3. IF CVE_medium_in_prod_dependency
   → FINDING: security-cve-medium-3 (severity: medium, effort: S)
   - Evidence: "jquery 3.3.1 (CVE-2019-11358) - Prototype pollution"
   - Remediation: "Update to jquery 3.5.0 or later"
4. IF unmaintained_dependency > 2_years
   → FINDING: security-unmaintained-dep-4 (severity: medium, effort: M)
   - Evidence: "left-pad 1.1.0 last updated 2016 - no security updates for 6 years"
   - Remediation: "Replace with actively maintained alternative or fork with security patches"
5. IF dependency_with_known_exploit_in_wild
   → FINDING: security-exploit-in-wild-5 (severity: critical, effort: S)
   - Evidence: "Log4j 2.0-beta9 (CVE-2021-44228) - Active exploitation in wild"
   - Remediation: "Update to Log4j 2.17.0 or later immediately"
6. IF license_incompatible_with_commercial_use
   → FINDING: security-license-incompatible-6 (severity: medium, effort: M)
   - Evidence: "GPLv3 dependency in proprietary commercial software"
   - Remediation: "Replace with permissive-licensed alternative or comply with GPL obligations"
7. IF dependency_has_no_security_maintenance
   → FINDING: security-no-security-maintenance-7 (severity: medium, effort: M)
   - Evidence: "Dependency last security update was 3 years ago"
   - Remediation: "Monitor closely or replace with better maintained alternative"
8. IF transitive_dependency_vulnerability
   → FINDING: security-transitive-vuln-8 (severity: medium, effort: S)
   - Evidence: "Dependency A (safe) depends on Dependency B (vulnerable)"
   - Remediation: "Update Dependency A to version that uses safe Dependency B"
9. IF version_control_system_not_secure
   → FINDING: security-vcs-insecure-9 (severity: low, effort: M)
   - Evidence: "Using HTTP instead of HTTPS for git submodules"
   - Remediation: "Use HTTPS or SSH for all git operations"
10. IF binary_dependency_without_source
    → FINDING: security-binary-dep-10 (severity: medium, effort: M)
    - Evidence: "Pre-compiled binary dependency without source code for verification"
    - Remediation: "Prefer source-based dependencies or verify binary integrity"
```

### GitHub Actions Security
```markdown
1. IF workflow_uses_pull_request_target_with_checkout
   → FINDING: security-gha-pr-target-risk-1 (severity: critical, effort: S)
   - Evidence: "workflow_run: workflow_pull_request_target with steps: checkout"
   - Remediation: "Never use pull_request_target with checkout - allows fork PRs to write to base repo"
2. IF workflow_permissions_not_restricted
   → FINDING: security-gha-overpermissive-2 (severity: high, effort: XS)
   - Evidence: "permissions: write-all - grants excessive permissions to workflow"
   - Remediation: "Follow principle of least permission: specify exact permissions needed"
3. IF secret_used_in_log_output
   → FINDING: security-gha-secret-leak-3 (severity: critical, effort: XS)
   - Evidence: "echo \"$API_KEY\" - secret exposed in workflow logs"
   - Remediation: "Never echo secrets; use masking or avoid logging altogether"
4. IF workflow_runs_on_fork_pull_requests
   → FINDING: security-gha-fork-pr-4 (severity: medium, effort: M)
   - Evidence: "on: pull_request_target allows untrusted code from forks"
   - Remediation: "Use pull_request instead of pull_request_target for fork safety"
5. IF action_not_pinned_to_version
   → FINDING: security-gha-action-unpinned-5 (severity: medium, effort: M)
   - Evidence: "uses: actions/checkout@v2 - should specify exact version"
   - Remediation: "Pin actions to specific version SHA to prevent supply chain attacks"
6. IF workspace_not_cleaned
   → FINDING: security-gha-workspace-not-cleaned-6 (severity: medium, effort: M)
   - Evidence: "Job does not clean up workspace - secrets may persist between jobs"
   - Remediation: "Add cleanup step or use container jobs that discard workspace"
7. IF job_without_timeout
   → FINDING: security-gha-job-no-timeout-7 (severity: medium, effort: M)
   - Evidence: "job: build has no timeout setting - can run indefinitely"
   - Remediation: "Set reasonable timeout values for all jobs"
8. IF container_not_used_for_isolation
   → FINDING: security-gha-no-container-8 (severity: medium, effort: M)
   - Evidence: "jobs.runner: ubuntu-latest instead of containerized execution"
   - Remediation: "Use container: directive to isolate jobs from runner and each other"
9. IF deployment_to_production_on_merge
   → FINDING: security-gha-auto-deploy-prod-9 (severity: high, effort: M)
   - Evidence: "on: push to main branch triggers production deployment"
   - Remediation: "Require manual approval or feature flags for production deployment"
10. IF no_concurrency_control_for_production
    → FINDING: security-gha-no-concurrency-prod-10 (severity: medium, effort: M)
    - Evidence: "Multiple deployment jobs can run concurrently to production"
    - Remediation: "Use concurrency: group: production to prevent concurrent deployments"
```

### Configuration Security
```markdown
1. IF debug_mode_enabled_in_prod
   → FINDING: security-debug-in-prod-1 (severity: high, effort: XS)
   - Evidence: "app.set('env', 'development') in production environment"
   - Remediation: "Disable debug mode in production; use separate development configuration"
2. IF cors_allows_all_origins
   → FINDING: security-cors-wildcard-2 (severity: medium, effort: XS)
   - Evidence: "app.use(cors({ origin: true })) - allows any origin"
   - Remediation: "Restrict origins to specific domains: ['https://app.example.com']"
3. IF jwt_secret_default_or_short
   → FINDING: security-jwt-weak-3 (severity: critical, effort: XS)
   - Evidence: "JWT secret: 'secret' or 'changeme' found in auth config"
   - Remediation: "Use strong random secret (minimum 32 bytes) from secure source"
4. IF session_cookie_not_secure
   → FINDING: security-session-cookie-not-secure-3 (severity: medium, effort: XS)
   - Evidence: "Session cookie missing Secure flag - transmitted over HTTP"
   - Remediation: "Set Secure flag for session cookies in HTTPS environments"
5. IF session_cookie_not_http_only
   → FINDING: security-session-cookie-not-http-only-4 (severity: medium, effort: XS)
   - Evidence: "Session cookie missing HttpOnly flag - accessible via JavaScript"
   - Remediation: "Set HttpOnly flag to prevent XSS access to session cookie"
6. IF password_storage_weak
   → FINDING: security-password-weak-5 (severity: critical, effort: M)
   - Evidence: "Storing passwords in plaintext or using weak hashing (MD5)"
   - Remediation: "Use bcrypt, scrypt, or Argon2 with appropriate salt"
7. IF rate_limiting_missing_or_weak
   → FINDING: security-rate-limit-weak-6 (severity: medium, effort: M)
   - Evidence: "No rate limiting on authentication endpoints"
   - Remediation: "Implement rate limiting to prevent brute force attacks"
8. IF file_upload_validation_missing
   → FINDING: security-file-upload-weak-7 (severity: high, effort: M)
   - Evidence: "Accepts .exe files without validation"
   - Remediation: "Validate file type, size, and content; restrict to safe extensions"
9. IF directory_listing_enabled
   → FINDING: security-directory-listing-8 (severity: medium, effort: XS)
   - Evidence: "Apache/nginx configured to show directory listings"
   - Remediation: "Disable directory listing in web server configuration"
10. IF outdated_server_software
    → FINDING: security-outdated-server-9 (severity: medium, effort: M)
    - Evidence: "Running nginx 1.14.0 (2018) instead of current stable version"
    - Remediation: "Update to latest stable version for security patches"
11. IF missing_security_headers
    → FINDING: security-missing-headers-10 (severity: medium, effort: S)
    - Evidence: "No HSTS, CSP, X-Frame-Options, or X-Content-Type-Options headers"
    - Remediation: "Add security headers middleware to protect against common attacks"
12. IF database_connection_no_encryption
    → FINDING: security-db-no-tls-11 (severity: high, effort: M)
    - Evidence: "Connecting to database without TLS/SSL encryption"
    - Remediation: "Enable TLS/SSL for database connections"
13. IF logs_contain_sensitive_information
    → FINDING: security-logs-contain-secrets-12 (severity: critical, effort: XS)
    - Evidence: "Logger.debug(\"Token: \" + authToken) in authentication code"
    - Remediation: "Never log credentials, tokens, or PII; use masking if absolutely needed"
14. IF encryption_keys_rotated_manually
    → FINDING: security-key-rotation-manual-13 (severity: medium, effort: M)
    - Evidence: "Encryption keys changed by manual config edit instead of automated process"
    - Remediation: "Implement automated key rotation schedule and process"
15. IF no_input_validation_at_boundaries
    → FINDING: security-no-input-validation-14 (severity: high, effort: M)
    - Evidence: "API endpoints accept user input without validation or sanitization"
    - Remediation: "Implement comprehensive input validation at all trust boundaries"
16. IF error_detail_exposed_to_client
    → FINDING: security-error-detail-1 (severity: info, effort: XS)
    - Evidence: "Global error handler returns raw err.message with HTTP 500 to the client"
    - Remediation: "Log the full error server-side and return a generic message to the client"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "security"
- `id`: security-[category]-[number] (e.g., security-secret-in-code-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to code/config file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Variable/function name or config key if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the security issue
- `remediation`: Specific action to fix the security issue
- `effort`: Estimated effort to fix (XS for secret removal, S-M for config changes, L for major refactoring)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["secret", "vulnerability", "misconfiguration", "github-actions", "crypto"]
- `relatedFindings`: IDs of related findings (e.g., secret finding related to git history)
- `evidence`: 
  - `snippet`: Relevant code/config excerpt showing the issue
  - `metric`: Number of occurrences, severity score from vulnerability database, etc.
  - `benchmark`: CVE score, security standard, or historical baseline if available

### security-summary.json
```json
{
  "secretDetection": {
    "totalSecretsFound": 7,
    "byType": {
      "apiKeys": 3,
      "databaseCredentials": 2,
      "jwtSecrets": 1,
      "privateKeys": 1
    },
    "inGitHistory": 2,
    "inCommittedFiles": 5,
    "inEnvFiles": 0,
    "severityDistribution": { "critical": 6, "high": 1, "medium": 0, "low": 0 }
  },
  "dependencyVulnerabilities": {
    "totalDependencies": 142,
    "vulnerableDependencies": 8,
    "bySeverity": {
      "critical": 2,
      "high": 3,
      "medium": 3,
      "low": 0
    },
    "unmaintained": 5,
    "licenseIssues": 1,
    "exploitsInWild": 1
  },
  "githubActionsSecurity": {
    "workflowsAnalyzed": 5,
    "criticalIssues": 2,
    "highIssues": 4,
    "mediumIssues": 3,
    "lowIssues": 1,
    "specificIssues": {
      "pullRequestTargetWithCheckout": 1,
      "overlyPermissivePermissions": 3,
      "secretsInLogs": 2,
      "unpinnedActions": 4,
      "noTimeouts": 3
    }
  },
  "configurationSecurity": {
    "configFilesAnalyzed": 28,
    "misconfigurations": 15,
    "bySeverity": {
      "critical": 4,
      "high": 6,
      "medium": 4,
      "low": 1
    },
    "specificIssues": {
      "debugModeInProd": 2,
      "corsWildcard": 3,
      "weakJwtSecret": 1,
      "insecureSessionCookies": 5,
      "weakPasswordStorage": 2,
      "missingRateLimiting": 4,
      "directoryListing": 1,
      "outdatedSoftware": 3,
      "missingSecurityHeaders": 4
    }
  },
  "overallRiskScore": 0.73,
  "complianceStatus": {
    "gdpr": "non-compliant",
    "hipaa": "non-compliant",
    "pciDss": "non-compliant",
    "sox": "partially compliant",
    "iso27001": "non-compliant"
  }
}
```

## Examples

### Example 1: Hardcoded AWS Credentials
**Input**: 
- File: `src/config/aws.js`
- Content: 
```javascript
module.exports = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-west-2'
};
```
**Analysis**:
- AWS access key and secret key hardcoded in source code
- Keys appear to be AWS example keys but pattern matches real keys
**Output**:
- findings[]:
  - security-secret-in-code-1 (severity: critical, effort: XS):
    - Description: "AWS access key ID hardcoded in source code"
    - Location: src/config/aws.js line 2
    - Remediation: "Remove key and use environment variables or AWS Secrets Manager"
    - Evidence: "AKIAIOSFODNN7EXAMPLE matches AWS access key pattern"
    - Metric: "Key validity: requires verification but pattern matches"
  - security-secret-in-code-1 (severity: critical, effort: XS):
    - Description: "AWS secret access key hardcoded in source code (second instance of the same canonical rule)"
    - Location: src/config/aws.js line 3
    - Remediation: "Remove key and use environment variables or AWS Secrets Manager"
    - Evidence: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY matches AWS secret key pattern"
    - Metric: "Key validity: requires verification but pattern matches"
- security-summary.json:
  {
    "secretDetection": {
      "totalSecretsFound": 2,
      "byType": {
        "apiKeys": 2
      },
      "inGitHistory": 0,
      "inCommittedFiles": 2,
      "severityDistribution": { "critical": 2, "high": 0, "medium": 0, "low": 0 }
    }
  }
```

### Example 2: Vulnerable Dependency with Active Exploit
**Input**: 
- File: `package.json`
- Content: 
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "log4j": "2.0-beta9"
  }
}
```
**Analysis**:
- Using Log4j 2.0-beta9 which has CVE-2021-44228 (Log4Shell) with active exploitation
- Critical vulnerability allowing remote code execution via JNDI lookup
**Output**:
- findings[]:
  - security-cve-critical-1 (severity: critical, effort: S):
    - Description: "Log4j 2.0-beta9 contains critical remote code execution vulnerability (CVE-2021-44228)"
    - Location: package.json line 5
    - Remediation: "Update to Log4j 2.17.0 or later immediately"
    - Evidence: "Log4j 2.0-beta9 is vulnerable to CVE-2021-44228 with active exploitation in wild"
    - Metric: "CVSS score: 10.0 (Critical)"
- security-summary.json:
  {
    "dependencyVulnerabilities": {
      "totalDependencies": 1,
      "vulnerableDependencies": 1,
      "bySeverity": { "critical": 1, "high": 0, "medium": 0, "low": 0 },
      "exploitsInWild": 1
    }
  }
```

### Example 3: GitHub Actions Security Misconfiguration
**Input**: 
- File: `.github/workflows/deploy.yml`
- Content: 
```yaml
name: Deploy to Production
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      write-all: true  # EXCESSIVE PERMISSIONS
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - run: echo "$AWS_ACCESS_KEY_ID"  # SECRET IN LOGS
      - run: aws s3 sync ./dist s3://my-prod-bucket/
```
**Analysis**:
- Workflow uses excessive permissions (write-all)
- AWS secrets echoed to logs - major security breach
- No timeout set on job
**Output**:
- findings[]:
  - security-gha-overpermissive-2 (severity: high, effort: XS):
    - Description: "Workflow grants excessively broad permissions"
    - Location: .github/workflows/deploy.yml line 8
    - Remediation: "Follow principle of least permission: specify exact permissions needed"
    - Evidence: "permissions: write-all grants write access to all repository scopes"
    - Metric: "Excessive permissions: write-all vs needed: contents:read, id-token:write"
  - security-gha-secret-leak-3 (severity: critical, effort: XS):
    - Description: "Secret exposed in workflow logs"
    - Location: .github/workflows/deploy.yml line 13
    - Remediation: "Never echo secrets; remove or mask the echo statement"
    - Evidence: "run: echo \"$AWS_ACCESS_KEY_ID\" exposes AWS access key in logs"
    - Metric: "Secret exposure: AWS access key and secret key both at risk"
  - security-gha-job-no-timeout-7 (severity: medium, effort: M):
    - Description: "Job lacks timeout setting"
    - Location: .github/workflows/deploy.yml line 6
    - Remediation: "Set reasonable timeout value for job"
    - Evidence: "Job definition missing timeout: under strategic"
    - Metric: "Hang risk: job could run indefinitely"
- security-summary.json:
  {
    "githubActionsSecurity": {
      "workflowsAnalyzed": 1,
      "criticalIssues": 1,
      "highIssues": 1,
      "mediumIssues": 1,
      "lowIssues": 0,
      "specificIssues": {
        "pullRequestTargetWithCheckout": 0,
        "overlyPermissivePermissions": 1,
        "secretsInLogs": 1,
        "unpinnedActions": 0,
        "noTimeouts": 1
      }
    }
  }
```

### Example 4: Configuration Security Misconfiguration
**Input**: 
- File: `src/config/passport.js`
- Content: 
```javascript
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  function(username, password, done) {
    // WEAK PASSWORD HASHING: Using MD5 instead of bcrypt
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
    User.findOne({ username: username, password: hashedPassword }, function(err, user) {
      return done(err, user);
    });
  }
));
```
**Analysis**:
- Using MD5 for password hashing which is cryptographically broken
- Vulnerable to rainbow table attacks and collision attacks
**Output**:
- findings[]:
  - security-password-weak-5 (severity: critical, effort: M):
    - Description: "Weak password hashing algorithm (MD5) used for authentication"
    - Location: src/config/passport.js line 9
    - Remediation: "Use bcrypt, scrypt, or Argon2 with appropriate salt factor"
    - Evidence: "crypto.createHash('md5') - MD5 is cryptographically broken for password hashing"
    - Metric: "Hash strength: MD5 is effectively insecure for password storage"
- security-summary.json:
  {
    "configurationSecurity": {
      "configFilesAnalyzed": 1,
      "misconfigurations": 1,
      "bySeverity": { "critical": 1, "high": 0, "medium": 0, "low": 0 },
      "specificIssues": {
        "debugModeInProd": 0,
        "corsWildcard": 0,
        "weakJwtSecret": 0,
        "insecureSessionCookies": 0,
        "weakPasswordStorage": 1,
        "missingRateLimiting": 0,
        "directoryListing": 0,
        "outdatedSoftware": 0,
        "missingSecurityHeaders": 0
      }
    }
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding domain-specific security patterns (e.g., financial services, healthcare HIPAA)
2. Enhancing secret detection with additional patterns for cloud providers (Azure, GCP)
3. Adding new finding types for specific compliance requirements (SOC 2, ISO 27001)
4. Improving the security-summary.json with additional metrics (e.g., attack surface analysis)
5. Adding new examples for additional vulnerability types and attack vectors
6. Improving dependency scanning with more comprehensive vulnerability databases
7. Adding security-specific configuration checks for additional technologies (Docker, Kubernetes, etc.)