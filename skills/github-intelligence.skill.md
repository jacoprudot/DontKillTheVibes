---
name: github-intelligence
description: Teach LLM to extract project understanding from GitHub including tech stack, maturity, and collaboration health
version: 1.0
module: github
llmCapabilities:
  - Tool use for GitHub API and filesystem access
  - Structured output for findings
  - Reasoning over commit history and issue data
inputs:
  - Repository URL (with optional GitHub token for private repos)
  - Access to github, filesystem, and git-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "github")
  - project-profile.json (tech stack, maturity, stakeholders, pain points)
mcpDependencies:
  - github
  - filesystem
  - git-mcp
decisionTrees:
  - Tech Stack Inference
  - Commit History Analysis
  - Issue/PR Health
  - Log Pattern Mining
---

# GitHub Intelligence Analyst

Teaches an LLM to act as a project archaeologist, extracting comprehensive understanding of a repository's purpose, technology stack, maturity level, and collaboration health from GitHub data and repository contents.

## When to Use This Skill

Use this skill as the **first step** in any repository assessment to establish context before diving into technical analysis. Essential for understanding what the project is, who uses it, and how it's maintained.

## Inputs

Before using this skill, the LLM should gather:
1. Repository URL (format: `owner/repo` or full GitHub URL)
2. Optional: GitHub token (for private repo access or increased rate limits)
3. Access to the following MCPs:
   - `github`: For API access to repo data
   - `filesystem`: For reading repository contents (if cloned locally)
   - `git-mcp`: For Git history analysis

## Analysis Procedure

### Step 1: Repository Discovery
Use github.get_repo_contents to examine the repository structure and identify key files that indicate technology purpose.

### Step 2: Tech Stack Inference
Apply the Tech Stack Inference decision tree to determine primary languages, frameworks, and architectural patterns.

### Step 3: Commit History Analysis
Use github.get_commit_history and git-mcp tools to analyze development patterns over time.

### Step 4: Issue/PR Health Assessment
Use github.get_issues and related tools to evaluate collaboration and maintenance health.

### Step 5: Log Pattern Mining
If repository is cloned locally, use filesystem to search for and analyze log files for operational insights.

### Step 6: Synthesize Project Profile
Combine all findings into a project-profile.json that summarizes:
- Inferred purpose and target audience
- Technology stack (language, framework, database, etc.)
- Maturity indicators (age, activity level, release patterns)
- Stakeholder map (maintainers, contributors)
- Preliminary pain points from issue analysis

## Decision Trees

### Tech Stack Inference
```markdown
1. IF package.json exists → Node.js project
   - IF express in deps → Express (severity: info)
   - IF next in deps → Next.js (severity: info)
   - IF nest in deps → Nest.js (severity: info)
   - IF react in deps → React frontend (severity: info)
   - IF typescript in deps → TypeScript usage (severity: info)
2. IF requirements.txt/pyproject.toml → Python project
   - IF django → Django (severity: info)
   - IF fastapi → FastAPI (severity: info)
   - IF flask → Flask (severity: info)
   - IF pandas/numpy → Data science focus (severity: info)
3. IF pom.xml/build.gradle → Java project (Maven/Gradle)
   - IF spring-boot → Spring Boot (severity: info)
   - IF maven → Maven build (severity: info)
   - IF gradle → Gradle build (severity: info)
4. IF go.mod → Go project (severity: info)
5. IF Cargo.toml → Rust project (severity: info)
6. IF composer.json → PHP project (severity: info)
7. IF Dockerfile → Containerized deployment (severity: info)
   - IF docker-compose.yml → Multi-service orchestration (severity: info)
   - IF k8s/ OR kubernetes/ → Kubernetes manifests (severity: info)
8. IF .github/workflows → CI/CD via GitHub Actions (severity: info)
   - IF .gitlab-ci.yml → GitLab CI (severity: info)
   - IF jenkins/ → Jenkins CI (severity: info)
9. IF README.md contains badges → Evaluate badge ecosystem (severity: info)
10. IF multiple language files detected → Polyglot project (severity: low)
```

### Commit History Analysis
```markdown
1. IF commits/week < 2 → stale project (severity: medium)
2. IF commits/week > 20 → highly active (severity: info)
3. IF refactor commits > 30% of total → active refactoring (severity: info)
4. IF feature commits > 50% → feature-focused development (severity: info)
5. IF bugfix commits > 40% → quality-focused maintenance (severity: info)
6. IF merge commits > 50% → heavy branching strategy (severity: medium)
7. IF squash merges > 70% → clean history preference (severity: info)
8. IF commit messages follow conventional commits → good hygiene (severity: info)
9. IF average commit size > 500 lines → large commits (severity: medium)
10. IF late-night commits common → potential burnout indicator (severity: low)
```

### Issue/PR Health
```markdown
1. IF median time to first response > 72h → slow triage (severity: medium)
2. IF median time to first response < 6h → responsive maintenance (severity: info)
3. IF issue closure rate < 50% → backlog growing (severity: high)
4. IF issue closure rate > 80% → healthy resolution rate (severity: info)
5. IF PR review depth < 2 comments → shallow reviews (severity: medium)
6. IF PR review depth > 10 comments → thorough review process (severity: info)
7. IF stale issues > 30% → poor maintenance (severity: medium)
8. IF stale issues < 10% → good issue hygiene (severity: info)
9. IF PR merge rate < 50% → review bottleneck (severity: medium)
10. IF PR merge rate > 80% → efficient review process (severity: info)
11. IF labeled issues < 20% → poor categorization (severity: medium)
12. IF labeled issues > 80% → good organization (severity: info)
```

### Log Pattern Mining
```markdown
1. IF application logs found → operational visibility (severity: info)
2. IF error logs show repeating patterns → chronic issues (severity: medium)
3. IF access logs show traffic patterns → usage insights (severity: info)
4. IF security logs show attempts → threat landscape (severity: medium)
5. IF audit logs missing → compliance gap (severity: medium)
6. IF debug logs in production → security risk (severity: high)
7. IF log rotation configured → good ops practice (severity: info)
8. IF centralized logging → mature observability (severity: info)
9. IF no logs found → observability gap (severity: medium)
10. IF structured logs (JSON) → machine-readable (severity: info)
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "github"
- `id`: github-[category]-[number] (e.g., github-tech-stack-1)
- `severity`: Based on decision tree assessment
- `location`: Typically file-level (line: 0) or specific config files
- `description`: Human-readable description of the insight
- `remediation`: Actionable steps if this represents an improvement opportunity
- `effort`: Estimated effort to address (usually XS-S for GitHub insights)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["tech-stack", "maturity", "collaboration"]
- `relatedFindings`: IDs of related findings from other modules

### project-profile.json
```json
{
  "name": "repository-name",
  "description": "Inferred purpose and target audience",
  "techStack": {
    "language": "primary language (e.g., JavaScript, Python)",
    "framework": "primary framework (e.g., Express, Django, React)",
    "database": "detected database technology (if any)",
    "frontend": "frontend technology (if web app)",
    "infrastructure": "deployment targets (e.g., Docker, Kubernetes, AWS)",
    "testing": "testing frameworks detected",
    "ciCd": "CI/CD systems detected"
  },
  "maturity": {
    "ageMonths": approximate age from earliest commit,
    "activityLevel": "stale/low/medium/high based on commit frequency",
    "releaseFrequency": "estimated releases per month",
    "contributorCount": number of unique contributors,
    "maintainerCount": number of users with merge permissions
  },
  "stakeholders": {
    "primaryMaintainers": ["list of top contributors"],
    "organization": "github organization or user",
    "funding": "detected sponsorship or funding indicators"
  },
  "preliminaryPainPoints": [
    "Summary of concerning patterns from issue analysis",
    "Example: 'High bug report volume suggests quality issues'",
    "Example: 'Slow response times indicate maintenance capacity limits'"
  ],
  "repositoryHealth": {
    "documentationQuality": "assessed from README and docs",
    "testingCoverage": "inferred from test file presence",
    "securityPractices": "inferred from security-related files",
    "communityHealth": "assessed from issue/PR dynamics"
  }
}
```

## Examples

### Example 1: Node.js Express API
**Input**: Repository URL: `https://github.com/company/api-service`
**Analysis**:
- package.json exists with express, mongoose, dotenv
- .github/workflows/ci.yml shows GitHub Actions CI
- README.md shows API documentation with Postman collection
- Commit history: 15 commits/week, 25% refactor, 50% feature
- Issues: median response 4h, closure rate 75%, PR review depth 8 comments
- No logs found in repository (expected for API service)
**Output**:
- findings[]: 
  - github-tech-stack-1 (severity: info, effort: XS): "Node.js/Express API with MongoDB"
  - github-maturity-1 (severity: info, effort: XS): "Active project with good maintenance practices"
  - github-collaboration-1 (severity: info, effort: XS): "Responsive team with thorough review process"
- project-profile.json: 
  {
    "name": "api-service",
    "description": "RESTful API service for internal tools",
    "techStack": {
      "language": "JavaScript",
      "framework": "Express.js",
      "database": "MongoDB via Mongoose",
      "frontend": "none",
      "infrastructure": "Docker containers",
      "testing": "Jest",
      "ciCd": "GitHub Actions"
    },
    "maturity": {
      "ageMonths": 18,
      "activityLevel": "high",
      "releaseFrequency": "2 per month",
      "contributorCount": 5,
      "maintainerCount": 2
    },
    "stakeholders": {
      "primaryMaintainers": ["tech-lead", "senior-dev"],
      "organization": "company",
      "funding": "none detected"
    },
    "preliminaryPainPoints": [],
    "repositoryHealth": {
      "documentationQuality": "good",
      "testingCoverage": "estimated 70%",
      "securityPractices": "environment variables used, no secrets detected",
      "communityHealth": "healthy"
    }
  }
```

### Example 2: Neglected Python Project
**Input**: Repository URL: `https://github.com/user/old-project`
**Analysis**:
- requirements.txt shows Django 1.8 (unsupported)
- No CI/CD configuration found
- Commit history: 0.5 commits/week, mostly typo fixes
- Issues: median response 30 days, closure rate 20%, many stale issues
- README.md outdated, missing installation instructions
**Output**:
- findings[]:
  - github-tech-stack-1 (severity: info, effort: XS): "Python/Django 1.8 (outdated)"
  - github-maturity-2 (severity: medium, effort: S): "Stale project with low activity"
  - github-collaboration-2 (severity: high, effort: M): "Poor maintenance responsiveness"
  - github-documentation-3 (severity: medium, effort: M): "Outdated documentation"
- project-profile.json:
  {
    "name": "old-project",
    "description": "Legacy web application, likely abandoned",
    "techStack": {
      "language": "Python",
      "framework": "Django 1.8 (unsupported)",
      "database": "likely PostgreSQL or SQLite",
      "frontend": "jQuery",
      "infrastructure": "likely traditional VM",
      "testing": "unittest",
      "ciCd": "none detected"
    },
    "maturity": {
      "ageMonths": 36,
      "activityLevel": "low",
      "releaseFrequency": "0 per year",
      "contributorCount": 1,
      "maintainerCount": 1
    },
    "stakeholders": {
      "primaryMaintainers": ["user"],
      "organization": "none",
      "funding": "none detected"
    },
    "preliminaryPainPoints": [
      "Uses unsupported Django 1.8 version - security risk",
      "No CI/CD or automated testing",
      "Documentation outdated and incomplete",
      "Very slow issue response indicates abandonment risk"
    ],
    "repositoryHealth": {
      "documentationQuality": "poor",
      "testingCoverage": "estimated <30%",
      "securityPractices": "multiple gaps due to outdated framework",
      "communityHealth": "poor"
    }
  }
```

### Example 3: High-Performance Go Microservice
**Input**: Repository URL: `https://github.com/company/high-frequency-trader`
**Analysis**:
- go.mod shows Go 1.20 with gin-gonic/gin and gorilla/websocket
- Dockerfile uses multi-stage build with distroless base
- .github/workflows/benchmarks.yml runs performance tests on every push
- Commit history: 45 commits/week, 50% refactor, 30% feature optimization
- Issues: median response 2h, closure rate 92%, PR review depth 15 comments
- No logs found (expected for compiled binary service)
**Output**:
- findings[]: 
  - github-tech-stack-1 (severity: info, effort: XS): "Go/Gin microservice with WebSocket support"
  - github-maturity-1 (severity: info, effort: XS): "High-frequency trading system with extreme performance focus"
  - github-collaboration-1 (severity: info, effort: XS): "Elite team with rapid response and deep review process"
- project-profile.json: 
  {
    "name": "high-frequency-trader",
    "description": "Low-latency trading platform for institutional clients",
    "techStack": {
      "language": "Go",
      "framework": "Gin-Gonic for HTTP, Gorilla/WebSocket",
      "database": "Redis for caching, PostgreSQL for persistence",
      "frontend": "React with WebSocket connections",
      "infrastructure": "Kubernetes on bare metal servers",
      "testing": "Go testing framework + Benchstat",
      "ciCd": "GitHub Actions with performance gates"
    },
    "maturity": {
      "ageMonths": 14,
      "activityLevel": "extreme",
      "releaseFrequency": "50 per day",
      "contributorCount": 8,
      "maintainerCount": 3
    },
    "stakeholders": {
      "primaryMaintainers": ["lead-engineer", "quant-researcher", "devops-architect"],
      "organization": "company",
      "funding": "Series B funding detected"
    },
    "preliminaryPainPoints": [],
    "repositoryHealth": {
      "documentationQuality": "excellent (includes performance benchmarks)",
      "testingCoverage": "estimated 85%",
      "securityPractices": "hardware security modules, regular penetration testing",
      "communityHealth": "exceptional"
    }
  }

## Extensibility

Community contributors can extend this skill by:
1. Adding new patterns to the decision trees (e.g., for emerging frameworks)
2. Adding language-specific detection rules
3. Enhancing the project-profile.json with additional metadata fields
4. Adding new finding types for specific GitHub behaviors
5. Improving the examples section with additional language/framework combinations