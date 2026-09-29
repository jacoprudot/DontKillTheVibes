---
name: code-quality-assessment
description: Teach LLM to statically analyze code quality including complexity, duplication, and error handling anti-patterns
version: 1.0
module: code
llmCapabilities:
  - Tool use for filesystem and git access
  - Structured output for findings
  - Reasoning over code structure and patterns
inputs:
  - Source code directories (excluding node_modules, vendor, etc.)
  - Linter/config files (.eslintrc, prettier.config, pylint, rubocop)
  - Test files (to gauge test-to-code ratio)
  - Dependency manifests (for outdated/linter-plugin detection)
  - Access to filesystem and git-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "code")
  - code-quality-summary.json (complexity metrics, duplication analysis, test coverage estimates)
mcpDependencies:
  - filesystem
  - git-mcp
decisionTrees:
  - Complexity Thresholds (Per Function)
  - Duplication Detection
  - Error Handling Anti-Patterns
  - Language-Specific Rules (TypeScript/JavaScript, Python, Go)
---

# Code Quality Analyst

Teaches an LLM to act as a code quality expert, performing static analysis to identify maintainability issues, complexity hotspots, and anti-patterns that indicate technical debt.

## When to Use This Skill

Use this skill after establishing project context to evaluate the codebase for:
- Maintainability (complexity, duplication, readability)
- Correctness (error handling, validation, edge cases)
- Consistency (coding standards, naming conventions)
- Testability (test coverage, mocking practices)

## Inputs

Before using this skill, the LLM should gather:
1. Source code files:
   - Application code (`**/*.js`, `**/*.ts`, `**/*.py`, `**/*.java`, `**/*.go`, `**/*.cs`, etc.)
   - Configuration files (`**/*.json`, `**/*.yaml`, `**/*.toml`, `**/*.xml`)
   - Exclude: `node_modules/`, `vendor/`, `dist/`, `build/`, `coverage/`, `.git/`
2. Linter and formatter configuration:
   - ESLint (`.eslintrc.*`, `eslint.config.*`)
   - Prettier (`.prettierrc`, `prettier.config.*`)
   - Pylint (`.pylintrc`, `pyproject.toml` pylint section)
   - Rubocop (`.rubocop.yml`)
   - EditorConfig (`.editorconfig`)
3. Test files:
   - Unit tests (`**/*.test.*`, `**/*_test.*`, `**/tests/**/*`)
   - Integration tests (`**/integration/**/*`)
   - Test configuration (`jest.config.*`, `vitest.config.*`, `pytest.ini`)
4. Dependency manifests:
   - `package.json`, `requirements.txt`, `pom.xml`, `build.gradle`, `Cargo.toml`, `go.mod`
5. Access to the following MCPs:
   - `filesystem`: For reading source code and configuration files
   - `git-mcp`: For analyzing code evolution and identifying hotspots

## Analysis Procedure

### Step 1: Source Discovery
Use filesystem.glob_search to locate all source code files while excluding dependencies and build artifacts.

### Step 2: Complexity Analysis
Apply complexity decision trees to functions/methods using AST-like reasoning (simulated via pattern matching).

### Step 3: Duplication Detection
Identify exact and structural duplication across files using similarity analysis.

### Step 4: Error Handling Evaluation
Review exception handling patterns for anti-patterns that hide or mishandle errors.

### Step 5: Language-Specific Rules
Apply language-specific rulesets based on detected file types.

### Step 6: Output Generation
Emit findings[] array and code-quality-summary.json with:
- Complexity distribution
- Duplication hotspots
- Error handling quality assessment
- Test coverage estimates
- Language-specific observations

## Decision Trees

### Complexity Thresholds (Per Function)
```markdown
1. IF cyclomatic_complexity > 20 → FINDING: code-extreme-complexity-1 (severity: critical, effort: L)
   - Evidence: "Function processOrder has 25 paths through nested conditionals and loops"
   - Remediation: "Break into smaller functions: validateOrder, calculateTax, applyDiscounts"
2. IF cyclomatic_complexity > 15 → FINDING: code-high-complexity-2 (severity: high, effort: M)
   - Evidence: "Function handleUserLogin has 18 distinct paths"
   - Remediation: "Extract password validation and session creation to separate functions"
3. IF cyclomatic_complexity > 10 → FINDING: code-moderate-complexity-3 (severity: medium, effort: S)
   - Evidence: "Function formatAddress has 12 paths through conditional formatting"
   - Remediation: "Consider lookup table or strategy pattern for formatting rules"
4. IF nesting_depth > 5 → FINDING: code-extreme-nesting-4 (severity: high, effort: M)
   - Evidence: "5 levels of nested if/else in data validation function"
   - Remediation: "Use early returns or guard clauses to reduce nesting"
5. IF nesting_depth > 4 → FINDING: code-high-nesting-5 (severity: medium, effort: S)
   - Evidence: "4 levels of nesting in nested loop processing matrix"
   - Remediation: "Extract inner loop to separate function with clear purpose"
6. IF function_lines > 150 → FINDING: code-extreme-length-6 (severity: high, effort: L)
   - Evidence: "Component render method spans 200 lines with mixed concerns"
   - Remediation: "Split into presentational and container components"
7. IF function_lines > 100 → FINDING: code-long-function-7 (severity: medium, effort: M)
   - Evidence: "Helper function utilityFormatData is 120 lines doing multiple transformations"
   - Remediation: "Break into smaller functions: validateInput, transformData, formatOutput"
8. IF function_lines > 50 → FINDING: code-medium-length-8 (severity: low, effort: S)
   - Evidence: "Several utility functions in 60-80 line range"
   - Remediation: "Consider if function does one thing well; split if multiple concerns"
9. IF parameter_count > 7 → FINDING: code-too-many-params-9 (severity: medium, effort: M)
   - Evidence: "Function createUser requires 9 parameters for configuration"
   - Remediation: "Use parameter object or builder pattern"
10. IF parameter_count > 5 → FINDING: code-many-params-10 (severity: low, effort: S)
    - Evidence: "Function connectToDatabase takes host, port, db, user, password, timeout"
    - Remediation: "Consider connection configuration object"
11. IF boolean_parameter_count > 3
    → FINDING: code-boolean-parameter-plague-11 (severity: medium, effort: M)
    - Evidence: "Function processPayment(true, false, true) - what do booleans mean?"
    - Remediation: "Replace booleans with enum or named options object"
12. IF return_statement_count > 6
    → FINDING: code-multiple-return-points-12 (severity: low, effort: S)
    - Evidence: "Function has 8 return statements scattered through logic"
    - Remediation: "Consider single exit point or early validation approach"
```

### Duplication Detection
```markdown
1. IF exact_duplicate_lines >= 30 IN different_files
   → FINDING: code-exact-duplication-massive-1 (severity: high, effort: L)
   - Evidence: "30-line validation block copied in 5 different service files"
   - Remediation: "Extract to shared validation utility or base class"
2. IF exact_duplicate_lines >= 20 IN different_files
   → FINDING: code-exact-duplication-significant-2 (severity: medium, effort: M)
   - Evidence: "20-line API response formatter duplicated in 3 controllers"
   - Remediation: "Create shared response formatter utility"
3. IF exact_duplicate_lines >= 10 IN different_files
   → FINDING: code-exact-duplication-minor-3 (severity: low, effort: S)
   - Evidence: "10-line logging wrapper duplicated across modules"
   - Remediation: "Create shared logging helper or use aspect-oriented approach"
4. IF structural_similarity >= 0.9 AND different_names
   → FINDING: code-structural-duplication-high-4 (severity: medium, effort: M)
   - Evidence: "Two functions with identical logic but different variable names"
   - Remediation: "Extract common algorithm to shared function with parameters"
5. IF structural_similarity >= 0.8 AND different_names
   → FINDING: code-structural-duplication-medium-5 (severity: low, effort: M)
   - Evidence: "Similar validation logic in user and product services"
   - Remediation: "Create shared validation library with configurable rules"
6. IF copy_paste_with_minor_changes
   → FINDING: code-copy-paste-variant-6 (severity: medium, effort: M)
   - Evidence: "Same 15-line pattern with only variable names changed"
   - Remediation: "Parameterize the varying parts and extract to shared function"
7. IF boilerplate_code_in_every_file
   → FINDING: code-boilerplate-repetition-7 (severity: low, effort: S)
   - Evidence: "Same 5-line import/loading pattern in every service file"
   - Remediation: "Create base service class or use dependency injection framework"
```

### Error Handling Anti-Patterns
```markdown
1. IF empty_catch_block
   → FINDING: code-empty-catch-1 (severity: critical, effort: XS)
   - Evidence: "catch (Exception e) { } - silently swallowing all exceptions"
   - Remediation: "At minimum log the exception; preferably handle or rethrow"
2. IF catch_generic_exception AND NOT rethrow
   → FINDING: code-generic-catch-2 (severity: high, effort: S)
   - Evidence: "catch (Exception e) { log.error(e); } - hiding failure from caller"
   - Remediation: "Either handle specific exceptions or rethrow after logging"
3. IF throws_exception_or_returns_null
   → FINDING: code-null-instead-of-exception-3 (severity: medium, effort: S)
   - Evidence: "Function returns null on failure instead of throwing meaningful exception"
   - Remediation: "Throw domain-specific exception or use Optional/Result type"
4. IF no_validation_at_api_boundary
   → FINDING: code-missing-validation-4 (severity: high, effort: M)
   - Evidence: "API endpoint accepts user ID without checking existence or permissions"
   - Remediation: "Add authentication and authorization checks at controller level"
5. IF uses_system_exit_for_flow_control
   → FINDING: code-system-exit-misuse-5 (severity: medium, effort: M)
   - Evidence: "System.exit(1) used for validation failure in library code"
   - Remediation: "Throw exception and let caller decide how to handle failure"
6. IF ignores_return_value
   → FINDING: code-ignores-return-value-6 (severity: medium, effort: M)
   - Evidence: "Call to validation function whose return value is ignored"
   - Remediation: "Check return value or change function to throw exception on failure"
7. IF suppresses_warnings_without_justification
   → FINDING: code-warning-suppression-7 (severity: low, effort: S)
   - Evidence: "@SuppressWarnings('all') used to hide 20 compiler warnings"
   - Remediation: "Fix underlying issues or suppress only specific warnings with justification"
8. IF uses_print_instead_of_logger
   → FINDING: code-print-statement-8 (severity: low, effort: S)
   - Evidence: "System.out.println used for debugging in production code"
   - Remediation: "Use proper logging framework with appropriate log levels"
9. IF catches_error_and_continues
   → FINDING: code-catch-and-continue-9 (severity: medium, effort: M)
   - Evidence: "Loop continues after database connection failure"
   - Remediation: "Break loop or implement retry circuit breaker for critical operations"
10. IF logs_sensitive_information
    → FINDING: code-logs-secrets-10 (severity: critical, effort: XS)
    - Evidence: "Logger.debug(\"Password: \" + password) in authentication flow"
    - Remediation: "Never log credentials, tokens, or PII; use masking if absolutely needed"
```

### Language-Specific Rules

#### TypeScript/JavaScript
```markdown
1. IF `==` used instead of `===`
   → FINDING: code-loose-equality-1 (severity: medium, effort: XS)
   - Evidence: "if (user.status == 'active') - type coercion risks"
   - Remediation: "Use === for strict equality and type safety"
2. IF `!=` used instead of `!==`
   → FINDING: code-loose-inequality-2 (severity: medium, effort: XS)
   - Evidence: "if (user.role != 'admin') - may incorrectly evaluate due to coercion"
   - Remediation: "Use !== for strict inequality"
3. IF `var` used
   → FINDING: code-var-usage-3 (severity: medium, effort: XS)
   - Evidence: "var i = 0; function scoped incorrectly in loops"
   - Remediation: "Use let or const for block scoping"
4. IF promise_not_awaited AND not_fire_and_forget
   → FINDING: code-unhandled-promise-4 (severity: high, effort: S)
   - Evidence: "fetchUserData() called without await - promise ignored"
   - Remediation: "Either await the promise or explicitly handle with .then/.catch"
5. IF promise_chain_missing_catch
   → FINDING: code-promise-chain-missing-catch-5 (severity: medium, effort: S)
   - Evidence: "promise.then().then() without .catch() - unhandled rejection"
   - Remediation: "Always terminate promise chains with .catch() or use try/catch with async/await"
6. IF `any` type in public API
   → FINDING: code-any-type-6 (severity: medium, effort: S)
   - Evidence: "function processData(data: any) - loses type safety"
   - Remediation: "Define specific interface or use generics for flexibility"
7. IF `console.log` in production code
   → FINDING: code-console-log-7 (severity: low, effort: S)
   - Evidence: "Debug statement left in production error handler"
   - Remediation: "Remove or replace with appropriate logging level"
8. IF missing_return_type
   → FINDING: code-missing-return-type-8 (severity: low, effort: S)
   - Evidence: "function processData(input) { return input.trim(); }"
   - Remediation: "Add return type annotation: string"
9. IF nested_ternary_operators
   → FINDING: code-nested-ternary-9 (severity: medium, effort: M)
   - Evidence: "condition ? val1 : condition2 ? val2 : val3 - hard to read"
   - Remediation: "Use if/else statement or extract to helper function"
10. IF callback_hell_detected
    → FINDING: code-callback-hell-10 (severity: medium, effort: M)
    - Evidence: "fs.readFile(..., fs.writeFile(..., fs.chmod(..., ...)))"
    - Remediation: "Use promises with async/await or promises chaining"
```

#### Python
```markdown
1. IF `except:` bare
   → FINDING: code-bare-except-1 (severity: critical, effort: XS)
   - Evidence: "except: pass - catches KeyboardInterrupt and SystemExit"
   - Remediation: "Specify exceptions to catch or use except Exception:"
2. IF bare_except_in_try_with_multiple_except
   → FINDING: code-bare-except-with-others-2 (severity: high, effort: S)
   - Evidence: "except ValueError: ...; except: ... - bare except overrides specificity"
   - Remediation: "Order exceptions from specific to general; avoid bare except"
3. IF mutable_default_argument
   → FINDING: code-mutable-default-3 (severity: high, effort: XS)
   - Evidence: "def process(items=[]): items.append('item') - shared across calls"
   - Remediation: "Use None default and initialize inside function: def process(items=None)"
4. IF sql_string_concatenation
   → FINDING: code-sql-injection-risk-4 (severity: critical, effort: S)
   - Evidence: "query = \"SELECT * FROM users WHERE name = '\" + name + \"'\""
   - Remediation: "Use parameterized queries: cursor.execute(\"SELECT ... WHERE name = %s\", (name,))"
5. IF `print` in production code (outside main/__main__)
   → FINDING: code-print-statement-5 (severity: low, effort: S)
   - Evidence: "Debug print in library function"
   - Remediation: "Use logging module with appropriate level"
6. IF god_object_detected (class > 30 methods OR > 2000 lines)
   → FINDING: code-god-object-6 (severity: high, effort: L)
   - Evidence: "DataManager class handles DB, file I/O, networking, and business logic"
   - Remediation: "Apply Single Responsibility Principle; split into focused classes"
7. IF too_many_attributes (class > 20 attributes)
   → FINDING: code-too-many-attributes-7 (severity: medium, effort: M)
   - Evidence: "User class tracks 25 different properties suggesting poor cohesion"
   - Remediation: "Group related attributes into nested objects or separate classes"
8. IF long_parameter_list (> 5 parameters)
   → FINDING: code-long-parameter-list-8 (severity: medium, effort: M)
   - Evidence: "def create_user(name, email, phone, address, dob, ssn, license, passport)"
   - Remediation: "Use parameter object or builder pattern"
9. IF deep_inheritance_hierarchy (> 5 levels)
   → FINDING: code-deep-inheritance-9 (severity: medium, effort: M)
   - Evidence: "Animal → Mammal → DomesticDog → BreedSpecific → ShowDog → Champion"
   - Remediation: "Consider composition over inheritance for behavioral variation"
10. IF missing_docstring_in_public_api
    → FINDING: code-missing-docstring-10 (severity: low, effort: S)
    - Evidence: "public function calculate_tax() lacks documentation"
    - Remediation: "Add docstring describing purpose, parameters, return value, and exceptions"
```

#### Go
```markdown
1. IF error_not_checked
   → FINDING: code-unchecked-error-1 (severity: high, effort: S)
   - Evidence: "os.Create(file) - ignoring potential permission error"
   - Remediation: "Check error and handle appropriately: if err != nil { return err }"
2. IF error_assigned_not_used
   → FINDING: code-error-assigned-unused-2 (severity: medium, effort: M)
   - Evidence: "_, err := strconv.Atoi(input) - error checked but not used"
   - Remediation: "Either handle error or use blank identifier if truly irrelevant"
3. IF blocking_call_in_goroutine
   → FINDING: code-blocking-in-goroutine-3 (severity: medium, effort: M)
   - Evidence: "time.Sleep(5 * time.Second) in goroutine handling requests"
   - Remediation: "Use context.WithTimeout or non-blocking alternatives"
4. IF mutex_not_used
   → FINDING: code-mutex-missing-4 (severity: medium, effort: M)
   - Evidence: "Multiple goroutines accessing shared map without synchronization"
   - Remediation: "Use sync.Mutex or sync.RWMutex to protect shared state"
5. IF channel_not_closed
   → FINDING: code-channel-not-closed-5 (severity: low, effort: S)
   - Evidence: "Channel used for worker coordination never closed"
   - Remediation: "Close channel when no more values will be sent to prevent goroutine leaks"
6. IF slice_append_in_loop
   → FINDING: code-slice-append-in-loop-6 (severity: medium, effort: M)
   - Evidence: "for i := 0; i < 10000; i++ { slice = append(slice, i) }"
   - Remediation: "Pre-slice with make([]int, 0, 10000) to avoid repeated allocations"
7. IF map_lookup_not_checked
   → FINDING: code-map-lookup-unchecked-7 (severity: medium, effort: M)
   - Evidence: "value := myMap[key] - panics if key doesn't exist"
   - Remediation: "Use value, ok := myMap[key]; if !ok { /* handle missing key */ }"
8. IF interface_bloat (> 10 methods)
   → FINDING: code-interface-bloat-8 (severity: medium, effort: M)
   - Evidence: "Service interface with 12 methods violating ISP"
   - Remediation: "Split into smaller, focused interfaces by concern"
9. IF god_package_detected (> 50 files in package)
   → FINDING: code-god-package-9 (severity: high, effort: L)
   - Evidence: "utils package contains unrelated string, math, networking, and UI functions"
   - Remediation: "Split into domain-specific packages: strutil, mathutil, netutil, uiutil"
10. IF missing_error_handling_in_main
    → FINDING: code-missing-error-main-10 (severity: medium, effort: M)
    - Evidence: "main() function calls functions that can error but doesn't check"
    - Remediation: "Handle errors from initialization and provide meaningful exit codes"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "code"
- `id`: code-[category]-[number] (e.g., code-unhandled-promise-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to source file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Function/method name if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the code quality issue
- `remediation`: Specific code change to fix the issue
- `effort`: Estimated effort to fix (XS-S for simple fixes like == → ===, M-L for refactoring)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["complexity", "duplication", "error-handling", "typescript", "python"]
- `relatedFindings`: IDs of related findings (e.g., complexity finding related to duplication)
- `evidence`: 
  - `snippet`: Relevant code excerpt showing the issue
  - `metric`: Cyclomatic complexity score, line count, duplication percentage, etc.
  - `benchmark`: Linter rule ID or comparable metric if available

### code-quality-summary.json
```json
{
  "languageBreakdown": {
    "JavaScript": { "files": 45, "lines": 12500 },
    "TypeScript": { "files": 78, "lines": 28500 },
    "Python": { "files": 32, "lines": 8900 }
  },
  "complexityMetrics": {
    "averageCyclomaticComplexity": 8.4,
    "maxCyclomaticComplexity": 24,
    "functionsAboveThreshold": { ">10": 32, ">15": 8, ">20": 2 },
    "averageNestingDepth": 2.1,
    "maxNestingDepth": 6,
    "functionsAboveNestingThreshold": { ">3": 18, ">4": 5 },
    "averageFunctionLength": 38,
    "maxFunctionLength": 187,
    "functionsAboveLengthThreshold": { ">50": 42, ">100": 12, ">150": 3 }
  },
  "duplicationAnalysis": {
    "totalLinesDuplicated": 3450,
    "percentageOfCodebase": 8.2,
    "largestDuplicateBlock": { "lines": 87, "files": 3 },
    "duplicateFilesCount": 23,
    "averageDuplicateBlockSize": 24
  },
  "errorHandlingQuality": {
    "totalTryCatchBlocks": 128,
    "emptyCatchBlocks": 3,
    "genericCatchWithoutRethrow": 15,
    "missingValidationAtApiBoundary": 7,
    "uncheckedErrors": 22,
    "printsInsteadOfLogging": 8
  },
  "testCoverageIndicators": {
    "testToSourceRatio": 0.35,
    "testFileCount": 41,
    "averageTestLength": 42,
    "mockingFrameworkUsage": "jest",
    "propertyBasedTesting": "none detected"
  },
  "lintingStatus": {
    "eslintConfigured": true,
    "prettierConfigured": true,
    "totalLintErrors": 0,
    "totalLintWarnings": 12,
    "formatterEnabled": true
  },
  "technicalDebtRatio": 0.28,
  "maintainabilityIndex": 65
}
```

## Examples

### Example 1: JavaScript Promise Anti-Pattern
**Input**: 
- File: `src/services/userService.js`
- Content: 
```javascript
function getUserProfile(userId) {
  return fetch(`/api/users/${userId}`)
    .then(response => response.json())
    .then(data => {
      if (!data.id) throw new Error('Invalid user');
      return data;
    });
}
// Called elsewhere: getUserProfile(123);
```
**Analysis**:
- Promise chain missing .catch() - unhandled rejection if network fails
- Function returns promise but caller doesn't await or handle it
**Output**:
- findings[]:
  - code-promise-chain-missing-catch-1 (severity: medium, effort: S):
    - Description: "Promise chain missing .catch() handler"
    - Location: src/services/userService.js lines 2-8
    - Remediation: "Add .catch(err) => { throw err; } or use try/catch with async/await"
    - Evidence: ".then().then() without .catch() - network errors will be unhandled"
    - Metric: "Unhandled rejection risk: network failure, timeout, 5xx response"
  - code-unhandled-promise-4 (severity: high, effort: S):
    - Description: "Returned promise not handled by caller"
    - Location: Call site where getUserProfile(123) is used
    - Remediation: "Either await the promise or handle with .then/.catch"
    - Evidence: "getUserProfile(123) called without await or .then() handling"
    - Metric: "Silent failure risk: errors in user fetch will be ignored"
- code-quality-summary.json: 
  {
    "errorHandlingQuality": {
      "promiseChainMissingCatch": 2,
      "unhandledPromises": 1
    }
  }
```

### Example 2: Python God Object
**Input**: 
- File: `src/core/datamanager.py`
- Content: 3200-line class with database operations, file I/O, network calls, and business logic
**Analysis**:
- Class violates Single Responsibility Principle
- High coupling to multiple external systems
- Difficult to test and maintain
**Output**:
- findings[]:
  - code-god-object-6 (severity: high, effort: L):
    - Description: "God object managing multiple unrelated concerns"
    - Location: src/core/datamanager.py line 1 (class definition)
    - Remediation: "Split into: DatabaseManager, FileStorage, NotificationService, OrderProcessor"
    - Evidence: "Class handles DB persistence, S3 uploads, email sending, and business rules"
    - Metric: "3200 lines, 47 methods, 12 external dependencies"
- code-quality-summary.json:
  {
    "complexityMetrics": {
      "maxFunctionLength": 89,
      "functionsAboveLengthThreshold": { ">50": 15 }
    },
    "technicalDebtRatio": 0.42,
    "maintainabilityIndex": 38
  }
```

### Example 3: Go Mutex Missing
**Input**: 
- File: `src/cache/mapcache.go`
- Content: 
```go
type MapCache struct {
    data map[string]interface{}
}

func (c *MapCache) Get(key string) interface{} {
    return c.data[key]
}

func (c *MapCache) Set(key string, value interface{}) {
    c.data[key] = value
}
```
**Analysis**:
- Map accessed concurrently without synchronization
- Will cause race conditions under load
**Output**:
- findings[]:
  - code-mutex-missing-1 (severity: medium, effort: M):
    - Description: "Concurrent map access without synchronization"
    - Location: src/cache/mapcache.go line 4 (MapCache struct)
    - Remediation: "Add sync.RWMutex to protect map access"
    - Evidence: "Multiple goroutines can read/write map concurrently causing race conditions"
    - Metric: "Concurrent access risk: high under load"
- code-quality-summary.json:
  {
    "errorHandlingQuality": {
      "raceConditions": 3
    },
    "technicalDebtRatio": 0.31
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding language-specific decision trees for additional languages (Java, C#, Rust, etc.)
2. Enhancing existing language rules with framework-specific patterns (Spring, Django, React)
3. Adding new finding types for specific anti-patterns (e.g., React hooks rules)
4. Improving the code-quality-summary.json with additional metrics (e.g., dependency cycle detection)
5. Adding new examples for additional language/framework combinations
6. Improving the duplication detection with more sophisticated similarity algorithms
7. Adding security-specific code quality findings (e.g., hardcoded secrets, insecure randomness)