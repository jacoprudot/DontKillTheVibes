---
name: structure-assessment
description: Teach LLM to evaluate architectural organization, coupling, cohesion, and pattern adherence
version: 1.0
module: structure
llmCapabilities:
  - Tool use for filesystem and git access
  - Structured output for findings
  - Reasoning over directory structure, imports, and architectural patterns
inputs:
  - Directory structure (package/namespace boundaries)
  - Import/require statements (static analysis)
  - Configuration files (Spring beans, Angular modules, NestJS modules)
  - API route definitions (Express, FastAPI, Django REST)
  - Event/message definitions (if using queues/streams)
  - Access to filesystem-mcp and git-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "structure")
  - architecture-summary.json (coupling metrics, dependency graph, layer violations, pattern adherence)
mcpDependencies:
  - filesystem-mcp
  - git-mcp
decisionTrees:
  - Coupling Analysis
  - Dependency Cycles
  - Layer Violations
  - Pattern Adherence
---

# Structure Analyst

Teaches an LLM to act as an architectural expert, evaluating the structural organization of a codebase to identify coupling issues, dependency cycles, layer violations, and adherence to architectural patterns.

## When to Use This Skill

Use this skill after establishing project context and analyzing code quality to evaluate the structural integrity of the codebase for:
- Maintainability (coupling, cohesion, modularity)
- Correctness (layer adherence, dependency management)
- Scalability (architectural patterns, boundary clarity)
- Evolution readiness (technical debt in architecture, refactoring difficulty)

## Inputs

Before using this skill, the LLM should gather:
1. Directory structure:
   - Source code directories (`**/src/**`, `**/app/**`, `**/lib/**`, `**/pkg/**`)
   - Package/namespace boundaries (`**/src/*/`, `**/app/*/`, `**/pkg/*/`)
   - Configuration directories (`**/config/**`, `**/conf/**`, `**/settings/**`)
2. Import/require statements:
   - Extract from source files (`import`, `require`, `from ... import`, `using`, `#include`)
   - Framework-specific module declarations (`@NgModule`, `@Module`, `@SpringBootApplication`)
3. Configuration files:
   - Dependency injection containers (`**/beans.xml`, `**/applicationContext.xml`)
   - Routing configuration (`**/routes.js`, `**/urls.py`, `**/Startup.cs`)
   - Module declarations (`**/module.ts`, `**/package.json` dependencies)
4. API route definitions:
   - REST controllers (`**/controllers/**/*`, `**/routes/**/*`)
   - GraphQL schemas (`**/schema.graphql`, `**/resolvers/**/*`)
   - gRPC service definitions (`**/proto/**/*`)
5. Event/message definitions:
   - Message queues (`**/consumers/**/*`, `**/handlers/**/*`)
   - Event handlers (`**/events/**/*`, `**/listeners/**/*`)
   - Stream processors (`**/processors/**/*`, `**/workers/**/*`)
6. Access to the following MCPs:
   - `filesystem-mcp`: For reading directory structure and file contents
   - `git-mcp`: For analyzing structural evolution and identifying hotspots

## Analysis Procedure

### Step 1: Structural Discovery
Use filesystem-mcp to map the directory structure and identify package/namespace boundaries.

### Step 2: Import Analysis
Extract and analyze import/require statements from source files to build dependency graphs.

### Step 3: Configuration Review
Examine configuration files for architectural declarations (modules, beans, routes).

### Step 4: API and Event Boundary Analysis
Identify public interfaces and external communication points.

### Step 5: Apply Decision Trees
Evaluate coupling, dependency cycles, layer violations, and pattern adherence.

### Step 6: Output Generation
Emit findings[] array and architecture-summary.json with:
- Coupling/cohesion metrics
- Dependency graph analysis
- Layer violation identification
- Pattern adherence assessment
- Architectural risk evaluation

## Decision Trees

### Coupling Analysis
```markdown
1. IF afferent_coupling > 30 AND efferent_coupling > 30
   → FINDING: structure-high-coupling-1 (severity: high, effort: L)
   - Evidence: "AuthService depended on by 35 modules and depends on 32 modules"
   - Remediation: "Split into focused services: AuthenticationService, AuthorizationService, UserService"
2. IF afferent_coupling > 20 AND efferent_coupling > 20
   → FINDING: structure-high-coupling-2 (severity: medium, effort: M)
   - Evidence: "PaymentProcessor depended on by 25 modules and depends on 18 modules"
   - Remediation: "Evaluate if responsibilities are properly separated"
3. IF instability_index > 0.9
   → FINDING: structure-extremely-unstable-3 (severity: high, effort: L)
   - Evidence: "Module changes 90% of the time when its dependents change (I = 0.9)"
   - Remediation: "Stabilize interface or reduce number of dependents"
4. IF instability_index > 0.8
   → FINDING: structure-highly-unstable-4 (severity: medium, effort: M)
   - Evidence: "Module changes 80% of the time when its dependents change (I = 0.8)"
   - Remediation: "Consider if instability is justified by business volatility"
5. IF lack_of_cohesion_in_methods > 0.8
   → FINDING: structure-low-cohesion-5 (severity: medium, effort: M)
   - Evidence: "Class methods share little common data (LCOM = 0.85)"
   - Remediation: "Split class into multiple classes with focused responsibilities"
6. IF lack_of_cohesion_in_methods > 0.6
   → FINDING: structure-medium-cohesion-6 (severity: low, effort: M)
   - Evidence: "Class methods show moderate lack of common data (LCOM = 0.65)"
   - Remediation: "Review if methods belong together or should be separated"
```

### Dependency Cycles
```markdown
1. IF import_cycle_detected BETWEEN modules
   → FINDING: structure-dependency-cycle-1 (severity: critical, effort: L)
   - Evidence: "UserService → OrderService → InventoryService → UserService"
   - Remediation: "Introduce domain events or shared kernel to break cycle"
2. IF import_cycle_detected BETWEEN packages
   → FINDING: structure-package-dependency-cycle-2 (severity: high, effort: L)
   - Evidence: "pkg/auth → pkg/order → pkg/inventory → pkg/auth"
   - Remediation: "Reorganize package structure or use dependency inversion"
3. IF import_cycle_detected BETWEEN classes
   → FINDING: structure-class-dependency-cycle-3 (severity: medium, effort: M)
   - Evidence: "UserValidator ↔ UserService circular dependency"
   - Remediation: "Introduce interface or use dependency injection to break cycle"
4. IF transitive_dependency_cycle_detected
   → FINDING: structure-transitive-cycle-4 (severity: medium, effort: M)
   - Evidence: "A → B → C → A through intermediate modules"
   - Remediation: "Apply same cycle-breaking techniques at higher granularity"
5. IF framework_specific_cycle_detected
   → FINDING: structure-framework-cycle-5 (severity: medium, effort: M)
   - Evidence: "Angular component → service → component cycle"
   - Remediation: "Use state management service or event-driven communication"
```

### Layer Violations
```markdown
1. IF controller_imports_repository_directly
   → FINDING: structure-layer-violation-1 (severity: high, effort: M)
   - Evidence: "OrderController calls OrderRepository.findById() directly"
   - Remediation: "Call through service layer: orderService.getOrderById(id)"
2. IF service_imports_controller
   → FINDING: structure-inverted-dependency-2 (severity: high, effort: M)
   - Evidence: "NotificationService imports WelcomeController for URL generation"
   - Remediation: "Extract URL generation to utility service or use configuration"
3. IF domain_entity_exports_framework_types
   → FINDING: structure-framework-leak-3 (severity: medium, effort: M)
   - Evidence: "User entity contains HttpServletRequest or Angular ComponentRef"
   - Remediation: "Keep domain entities framework-independent; use DTOs for boundaries"
4. IF repository_contains_business_logic
   → FINDING: structure-repository-logic-4 (severity: medium, effort: M)
   - Evidence: "OrderRepository.applyDiscount() contains promo validation rules"
   - Remediation: "Move business logic to service or domain layer"
5. IF service_contains_sql_queries
   → FINDING: structure-service-sql-5 (severity: medium, effort: M)
   - Evidence: "UserService.contains raw SQL string for complex query"
   - Remediation: "Move query to repository or use criteria builder API"
6. IF controller_contains_business_logic
   → FINDING: structure-controller-logic-6 (severity: medium, effort: M)
   - Evidence: "OrderController calculates tax and applies promotions"
   - Remediation: "Move calculation to service or domain service"
7. IF data_transfer_object_contains_logic
   → FINDING: structure-dto-logic-7 (severity: low, effort: S)
   - Evidence: "UserDTO.hasValidEmail() contains validation logic"
   - Remediation: "Keep DTOs as pure data carriers; move validation to service or validator"
8. IF configuration_contains_business_logic
   → FINDING: structure-config-logic-8 (severity: medium, effort: M)
   - Evidence: "application.yml contains IF/ELSE logic for feature toggles"
   - Remediation: "Use feature flag service or environment-specific configuration"
```

### Pattern Adherence
```markdown
1. IF repository_pattern_claimed BUT repository_accesses_multiple_aggregates
   → FINDING: structure-repository-violation-1 (severity: medium, effort: M)
   - Evidence: "OrderRepository has methods for Customer, Product, and Inventory"
   - Remediation: "Create separate repositories: OrderRepository, CustomerRepository, etc."
2. IF repository_pattern_claimed BUT repository_has_no_crud_abstraction
   → FINDING: structure-repository-no-crud-2 (severity: medium, effort: M)
   - Evidence: "CustomRepository has findByNameAndDate but no standard CRUD methods"
   - Remediation: "Extend base repository or implement standard CRUD interface"
3. IF service_pattern_claimed BUT service_contains_orchestration_logic
   → FINDING: structure-service-orchestration-3 (severity: medium, effort: M)
   - Evidence: "OrderService implements complex saga logic for order fulfillment"
   - Remediation: "Consider dedicated orchestrator or workflow engine"
4. IF factory_pattern_claimed BUT constructor_public
   → FINDING: structure-factory-violation-4 (severity: low, effort: XS)
   - Evidence: "UserFactory has public constructor allowing direct instantiation"
   - Remediation: "Make constructor private and provide static factory method"
5. IF singleton_pattern_claimed BUT multiple_instances_possible
   → FINDING: structure-singleton-violation-5 (severity: medium, effort: M)
   - Evidence: "Logger class has public constructor despite singleton claim"
   - Remediation: "Make constructor private and provide static getInstance() method"
6. IF observer_pattern_claimed BUT tight_coupling
   → FINDING: structure-observer-violation-6 (severity: medium, effort: M)
   - Evidence: "Subject maintains direct references to concrete observers"
   - Remediation: "Use observer interface to decouple subject from observers"
7. IF strategy_pattern_claimed BUT hardcoded_strategy_selection
   → FINDING: structure-strategy-hardcoded-7 (severity: medium, effort: M)
   - Evidence: "PaymentService uses switch statement to select payment strategy"
   - Remediation: "Use configuration or factory to select strategy dynamically"
8. IF template_method_pattern_claimed BUT missing_hook_methods
   → FINDING: structure-template-method-8 (severity: low, effort: S)
   - Evidence: "AbstractParser defines template but no hook methods for customization"
   - Remediation: "Add protected hook methods for subclasses to override"
9. IF decorator_pattern_claimed BUT missing_component_interface
   → FINDING: structure-decorator-violation-9 (severity: low, effort: S)
   - Evidence: "LoggerDecorator extends ConcreteLogger instead of Logger interface"
   - Remediation: "Extend base interface, not concrete implementation"
10. IF adapter_pattern_claimed BUT missing_adaptee_interface
    → FINDING: structure-adapter-violation-10 (severity: low, effort: S)
    - Evidence: "LegacyDatabaseAdapter implements specific database interface"
    - Remediation: "Adapter should work with interface, not concrete implementation"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "structure"
- `id`: structure-[category]-[number] (e.g., structure-layer-violation-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to source/config file (relative to repo root)
  - `line`: Line number where issue occurs
  - `function`: Class/module name or package if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the structural issue
- `remediation`: Specific architectural change to fix the issue
- `effort`: Estimated effort to fix (XS-S for simple fixes like private constructor, M-L for major refactoring)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["coupling", "dependency-cycle", "layer-violation", "microservices", "monolith"]
- `relatedFindings`: IDs of related findings (e.g., structure finding related to code complexity)
- `evidence`: 
  - `snippet`: Relevant import statement, class definition, or configuration excerpt
  - `metric`: Coupling coefficient, cycle length, or violation count
  - `benchmark`: Architectural metric or comparable measurement if available

### architecture-summary.json
```json
{
  "projectStructure": {
    "type": "monolith|microservices|modular-monolith|layered|hexagonal|event-driven",
    "primaryLanguage": "JavaScript/TypeScript/Python/Java/Go/etc",
    "buildSystem": "npm|yarn|pip|maven|gradle|make",
    "dependencyManagement": "internal packages|monorepo|multi-repo"
  },
  "couplingMetrics": {
    "averageAfferentCoupling": 8.4,
    "maxAfferentCoupling": 42,
    "modulesWithHighAfferent": { ">20": 15, ">30": 5 },
    "averageEfferentCoupling": 6.2,
    "maxEfferentCoupling": 35,
    "modulesWithHighEfferent": { ">20": 8, ">30": 2 },
    "averageInstabilityIndex": 0.45,
    "maxInstabilityIndex": 0.89,
    "modulesWithHighInstability": { ">0.8": 8, ">0.9": 3 }
  },
  "cohesionMetrics": {
    "averageLCOM": 0.35,
    "maxLCOM": 0.82,
    "classesWithLowCohesion": { ">0.6": 22, ">0.8": 8 },
    "averageTCC": 0.68,
    "minTCC": 0.25
  },
  "dependencyAnalysis": {
    "totalModules": 156,
    "dependencyCyclesDetected": 3,
    "cycleDetails": [
      {
        "modules": ["UserService", "OrderService", "InventoryService"],
        "cycleType": "direct",
        "severity": "critical"
      }
    ],
    "transitiveCyclesDetected": 5,
    "acyclicModules": 148,
    "dependencyDepth": {
      "average": 3.2,
      "maximum": 8
    }
  },
  "layerViolations": {
    "controllerToRepository": 7,
    "serviceToController": 3,
    "domainEntityFrameworkLeak": 12,
    "repositoryBusinessLogic": 5,
    "serviceSqlQueries": 8,
    "controllerBusinessLogic": 10,
    "dtoLogic": 2,
    "configurationLogic": 4
  },
  "patternAdherence": {
    "repositoryPattern": {
      "claimed": true,
      "violations": 4,
      "adherenceScore": 0.72
    },
    "servicePattern": {
      "claimed": true,
      "violations": 6,
      "adherenceScore": 0.65
    },
    "factoryPattern": {
      "claimed": true,
      "violations": 2,
      "adherenceScore": 0.90
    },
    "singletonPattern": {
      "claimed": true,
      "violations": 1,
      "adherenceScore": 0.95
    },
    "observerPattern": {
      "claimed": true,
      "violations": 3,
      "adherenceScore": 0.80
    },
    "strategyPattern": {
      "claimed": true,
      "violations": 5,
      "adherenceScore": 0.60
    }
  },
  "architecturalRiskScore": 0.58,
  "maintainabilityIndex": 52
}
```

## Examples

### Example 1: Layer Violation in MVC Application
**Input**: 
- File: `src/controllers/OrderController.java`
- Content: 
```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {
    @Autowired
    private OrderRepository orderRepository; // VIOLATION: Should use service
    
    @GetMapping("/{id}")
    public Order getOrder(@PathVariable Long id) {
        return orderRepository.findById(id).orElseThrow(); // Business logic in controller
    }
    
    @PostMapping
    public Order createOrder(@RequestBody OrderDto orderDto) {
        Order order = new Order();
        order.setCustomerId(orderDto.getCustomerId());
        order.setItems(orderDto.getItems());
        // BUSINESS LOGIC: Validation, pricing, etc.
        order.calculateTax();
        order.applyDiscounts();
        return orderRepository.save(order);
    }
}
```
**Analysis**:
- Controller directly uses repository bypassing service layer
- Business logic (tax calculation, discount application) in controller
**Output**:
- findings[]:
  - structure-layer-violation-1 (severity: high, effort: M):
    - Description: "Controller directly accesses repository bypassing service layer"
    - Location: src/controllers/OrderController.java line 8 (OrderRepository field)
    - Remediation: "Inject OrderService instead and delegate to service layer"
    - Evidence: "Autowired OrderRepository in controller"
    - Metric: "Direct repository access in 3 controller methods"
  - structure-controller-logic-1 (severity: medium, effort: M):
    - Description: "Controller contains business logic that should be in service layer"
    - Location: src/controllers/OrderController.java lines 16-24
    - Remediation: "Move tax calculation and discount application to OrderService"
    - Evidence: "order.calculateTax() and order.applyDiscounts() in controller"
    - Metric: "Business logic spread across 4 controller methods"
- architecture-summary.json:
  {
    "layerViolations": {
      "controllerToRepository": 4,
      "serviceToController": 0,
      "domainEntityFrameworkLeak": 0,
      "repositoryBusinessLogic": 0,
      "serviceSqlQueries": 0,
      "controllerBusinessLogic": 4,
      "dtoLogic": 0,
      "configurationLogic": 0
    }
  }
```

### Example 2: Dependency Cycle in Microservices
**Input**: 
- Directory structure:
  - `services/user-service/src/main/java/com/company/userservice/`
  - `services/order-service/src/main/java/com/company/orderservice/`
  - `services/inventory-service/src/main/java/com/company/inventoryservice/`
- Files:
  - `UserService.java`: `@Autowired private InventoryService inventoryService;`
  - `OrderService.java`: `@Autowired private UserService userService;`
  - `InventoryService.java`: `@Autowired private OrderService orderService;`
**Analysis**:
- Clear circular dependency: UserService → InventoryService → OrderService → UserService
**Output**:
- findings[]:
  - structure-dependency-cycle-1 (severity: critical, effort: L):
    - Description: "Circular dependency detected between three services"
    - Location: Multiple files showing the cycle
    - Remediation: "Introduce domain events or shared kernel to break cycle"
    - Evidence: "UserService → InventoryService → OrderService → UserService"
    - Metric: "Cycle length: 3 services"
- architecture-summary.json:
  {
    "dependencyAnalysis": {
      "totalModules": 3,
      "dependencyCyclesDetected": 1,
      "cycleDetails": [
        {
          "modules": ["UserService", "OrderService", "InventoryService"],
          "cycleType": "direct",
          "severity": "critical"
        }
      ],
      "transitiveCyclesDetected": 0,
      "acyclicModules": 0
    }
  }
```

### Example 3: Package Coupling Analysis
**Input**: 
- Directory structure:
  - `src/main/java/com/company/` (monolithic Java application)
- Packages:
  - `com.company.ui`: Swing/GUI components
  - `com.company.db`: Database access layer
  - `com.company.business`: Business logic
  - `com.company.util`: Utility classes
- Dependencies:
  - `ui` depends on: `business` (20 classes), `util` (15 classes)
  - `business` depends on: `db` (18 classes), `util` (10 classes)
  - `db` depends on: `util` (5 classes)
  - `util` depends on: none
**Analysis**:
- High afferent coupling in util package (used by 33 classes)
- Moderate efferent coupling in ui package (depends on 35 classes)
- Util package is stable (low efferent, high afferent) - good
- UI package is unstable (high efferent, moderate afferent) - expected for UI
**Output**:
- findings[]:
  - structure-high-coupling-2 (severity: medium, effort: M):
    - Description: "UI package has high efferent coupling"
    - Location: src/main/java/com/company/ui/package-info.java
    - Remediation: "Consider if UI has too many responsibilities or if dependencies can be reduced"
    - Evidence: "UI depends on 35 classes from business and util packages"
    - Metric: "Efferent coupling: 35"
- architecture-summary.json:
  {
    "couplingMetrics": {
      "averageAfferentCoupling": 12.3,
      "maxAfferentCoupling": 33,
      "modulesWithHighAfferent": { ">20": 1, ">30": 1 },
      "averageEfferentCoupling": 14.7,
      "maxEfferentCoupling": 35,
      "modulesWithHighEfferent": { ">20": 2, ">30": 1 },
      "averageInstabilityIndex": 0.58,
      "maxInstabilityIndex": 0.72
    }
  }
```

## Extensibility

Community contributors can extend this skill by:
1. Adding language-specific structural analysis patterns (e.g., Angular modules, Spring beans)
2. Enhancing coupling metrics with more sophisticated metrics (essentialism, instability)
3. Adding new finding types for specific architectural anti-patterns (e.g., god modules)
4. Improving the architecture-summary.json with additional metrics (e.g., modularity quantification)
5. Adding new examples for additional architectural styles (hexagonal, CQRS, event sourcing)
6. Improving dependency cycle detection with more sophisticated graph algorithms
7. Adding framework-specific layer violation detection (e.g., Clean Architecture layers)