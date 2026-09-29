---
name: database-assessment
description: Teach LLM to analyze database schema, migrations, and query patterns for correctness, performance, and scalability, and scalability
version: 1.0
module: database
llmCapabilities:
  - Tool use for filesystem and git access
  - Structured output for findings
  - Reasoning over schema definitions and migration history
inputs:
  - Schema files (.sql, prisma, Django models, TypeORM entities, Mongoose schemas)
  - Migration scripts
  - Optional: query logs
  - Access to filesystem-mcp and git-mcp
outputs:
  - findings[] (per templates/finding-schema.json with module: "database")
  - schema-summary.json (tables, relationships, indexes, migration analysis)
mcpDependencies:
  - filesystem-mcp
  - git-mcp
decisionTrees:
  - Missing Index Detection (PostgreSQL/Supabase Focus)
  - Irreversible Migration Detection
  - N+1 Query Risk
  - Connection Pool Misconfiguration
  - PostgreSQL-Specific Rules (Supabase focus)
---

# Database Analyst

Teaches an LLM to act as a database specialist, analyzing schema design, migration safety, query efficiency, and scalability readiness of a project's data layer.

## When to Use This Skill

Use this skill after establishing project context with github-intelligence.skill to evaluate the database layer for:
- Correctness (data integrity, constraint enforcement)
- Performance (query efficiency, indexing strategy)
- Scalability (sharding readiness, connection handling)
- Maintenance safety (migration practices, schema evolution)

## Inputs

Before using this skill, the LLM should gather:
1. Schema definition files:
   - SQL files (`**/*.sql`)
   - Prisma schema (`**/schema.prisma`)
   - Django models (`**/models/*.py`)
   - TypeORM entities (`**/entities/*.ts`)
   - Mongoose schemas (`**/models/*.js`)
   - Sequelize models (`**/models/*.js`)
   - Hibernate/JPA entities (`**/*.java`)
2. Migration scripts:
   - Flyway (`**/sql/migration/*.sql`)
   - Liquibase (`**/changelog/*.xml`)
   - Alembic (`**/versions/*.py`)
   - Sequelize (`**/migrations/*.js`)
   - Django (`**/migrations/*.py`)
   - Entity Framework (`**/Migrations/*.cs`)
3. Optional: Query logs if available (slow query logs, application logs with SQL)
4. Access to the following MCPs:
   - `filesystem-mcp`: For reading schema and migration files
   - `git-mcp`: For analyzing migration history and schema evolution over time

## Analysis Procedure

### Step 1: Schema Discovery
Use filesystem-mcp.glob_search to locate all schema definition files in the repository.

### Step 2: Migration Analysis
Use git-mcp.get_diff_since and filesystem-mcp to locate and analyze migration scripts.

### Step 3: Schema Evaluation
Apply each decision tree from this skill to evaluate:
- Indexing strategies
- Migration safety
- Query anti-patterns (if logs available)
- Connection pool configuration
- PostgreSQL-specific optimizations

### Step 4: Output Generation
Emit findings[] array and schema-summary.json with:
- Discovered tables, columns, relationships
- Index analysis
- Migration risk assessment
- Scalability indicators

## Decision Trees

### Missing Index Detection (PostgreSQL/Supabase Focus)
```markdown
1. IF foreign_key_column AND NOT index_exists(fk_column) 
   → FINDING: database-missing-index-fk-1 (severity: high, effort: S)
   - Evidence: "Column user_id in orders table has FK but no index"
   - Remediation: "CREATE INDEX idx_orders_user_id ON orders(user_id);"
2. IF join_column_in_slow_query_log AND NOT index_exists(join_column)
   → FINDING: database-missing-index-hot-path-2 (severity: medium, effort: S)
   - Evidence: "Join on product_id in order_items table appears frequently in slow queries"
   - Remediation: "CREATE INDEX idx_order_items_product_id ON order_items(product_id);"
3. IF table_rows > 1_000_000 AND seq_scan_in_explain_plan
   → FINDING: database-full-table-scan-3 (severity: critical, effort: M)
   - Evidence: "Large table user_sessions (2.1M rows) shows sequential scan in EXPLAIN"
   - Remediation: "Analyze query patterns and add appropriate indexes; consider partitioning"
4. IF where_column_used_frequently AND NOT index_exists(where_column)
   → FINDING: database-missing-index-where-4 (severity: medium, effort: S)
   - Evidence: "Column status in jobs table used in WHERE clauses but not indexed"
   - Remediation: "CREATE INDEX idx_jobs_status ON jobs(status);"
5. IF composite_where_conditions AND NOT composite_index_exists
   → FINDING: database-missing-composite-index-5 (severity: medium, effort: M)
   - Evidence: "Queries frequently filter on (user_id, created_at) but no composite index"
   - Remediation: "CREATE INDEX idx_events_user_created ON events(user_id, created_at);"
```

### Irreversible Migration Detection
```markdown
1. IF migration_drops_column AND NOT has_rollback
   → FINDING: database-irreversible-migration-1 (severity: critical, effort: L)
   - Evidence: "Migration V2__drop_unused_column.sql drops column without backup strategy"
   - Remediation: "Add data backup step before column drop or provide restore procedure"
2. IF migration_renames_table AND NOT has_rollback
   → FINDING: database-irreversible-migration-2 (severity: high, effort: L)
   - Evidence: "Migration renames users to legacy_users without data preservation plan"
   - Remediation: "Implement table rename with data migration or provide rollback script"
3. IF migration_changes_column_type AND data_loss_possible AND NOT has_rollback
   → FINDING: database-risky-migration-3 (severity: high, effort: M)
   - Evidence: "Changing VARCHAR(255) to VARCHAR(50) may truncate existing data"
   - Remediation: "Add data validation/truncation step or provide data migration script"
4. IF migration_adds_not_null_without_default
   → FINDING: database-not-null-violation-4 (severity: high, effort: M)
   - Evidence: "Adding NOT NULL column without DEFAULT value will fail on existing rows"
   - Remediation: "Provide DEFAULT value or make column nullable initially"
5. IF migration_performs_heavy_operation_on_large_table
   → FINDING: database-heavy-migration-5 (severity: medium, effort: L)
   - Evidence: "Adding index on large table during peak hours may cause downtime"
   - Remediation: "Schedule during maintenance window or use concurrent index creation"
```

### N+1 Query Risk
```markdown
1. IF orm_loop_detected AND relation_not_eager_loaded
   → FINDING: database-n-plus-one-risk-1 (severity: high, effort: M)
   - Evidence: "User.orders accessed in loop without include/join in UserService.java"
   - Remediation: "Use JOIN or FETCH to load related data in single query"
2. IF query_count_in_logs > 100_per_request AND same_table
   → FINDING: database-n-plus-one-confirmed-2 (severity: critical, effort: M)
   - Evidence: "Application logs show 150 SELECT queries to orders_per_user per request"
   - Remediation: "Implement batch loading or JOIN to reduce query count"
3. IF orm_lazy_loading_enabled AND high_traffic_endpoints
   → FINDING: database-lazy-loading-danger-3 (severity: medium, effort: M)
   - Evidence: "Lazy loading enabled on User.orders in API endpoint with 1000 RPM"
   - Remediation: "Consider eager loading or explicit JOIN for high-traffic paths"
4. IF missing_select_related_or_prefetch_related
   → FINDING: database-missing-prefetch-4 (severity: medium, effort: M)
   - Evidence: "Django ORM access to related objects without select_related/prefetch_related"
   - Remediation: "Use select_related for ForeignKey, prefetch_related for ManyToMany"
5. IF orm_iteration_over_large_resultset
   → FINDING: database-iteration-overload-5 (severity: high, effort: M)
   - Evidence: "Code iterates over QuerySet without pagination or chunking"
   - Remediation: "Use iterator(), yield_per(), or add pagination limits"
```

### Connection Pool Misconfiguration
```markdown
1. IF pool_size > cpu_cores * 4
   → FINDING: database-oversized-pool-1 (severity: medium, effort: XS)
   - Evidence: "Connection pool set to 100 on 4-core CPU"
   - Remediation: "Set pool_size to 2-4x CPU cores (8-16 for this system)"
2. IF pool_size < 2 AND concurrent_requests > 10
   → FINDING: database-undersized-pool-2 (severity: high, effort: XS)
   - Evidence: "Pool size of 1 with expected 50 concurrent users"
   - Remediation: "Increase pool size to handle expected concurrent load"
3. IF connection_timeout > 30_seconds
   → FINDING: database-connection-timeout-high-3 (severity: medium, effort: XS)
   - Evidence: "Connection timeout set to 120 seconds masks pool exhaustion"
   - Remediation: "Reduce timeout to 30s and monitor for actual pool exhaustion"
4. IF idle_timeout_not_configured
   → FINDING: database-idle-timeout-missing-4 (severity: low, effort: XS)
   - Evidence: "Connections may remain idle indefinitely consuming resources"
   - Remediation: "Set appropriate idle connection timeout (e.g., 300 seconds)"
5. IF max_lifetime_not_configured
   → FINDING: database-max-lifetime-missing-5 (severity: low, effort: XS)
   - Evidence: "Connections may accumulate metadata over time"
   - Remediation: "Set maximum connection lifetime to prevent resource leaks (e.g., 3600s)"
```

### PostgreSQL-Specific Rules (Supabase focus)
```markdown
1. IF pg_stat_statements_not_enabled
   → FINDING: database-pg-stat-statements-disabled-1 (severity: medium, effort: XS)
   - Evidence: "pg_stat_statements extension not enabled in shared_preload_libraries"
   - Remediation: "Add 'pg_stat_statements' to shared_preload_libraries and restart"
2. IF work_mem_too_low
   → FINDING: database-work-mem-too-low-2 (severity: medium, effort: XS)
   - Evidence: "work_mem setting of 4MB may cause excessive disk sorting"
   - Remediation: "Increase work_mem to 64MB (25% of available RAM per concurrent operation)"
3. IF maintenance_work_mem_too_low
   → FINDING: database-maintenance-work-mem-too-low-3 (severity: medium, effort: XS)
   - Evidence: "maintenance_work_mem of 16MB slows VACUUM and index creation"
   - Remediation: "Increase to 256MB for better maintenance performance"
4. IF effective_cache_poorly_configured
   → FINDING: database-effective-cache-misconfigured-4 (severity: medium, effort: XS)
   - Evidence: "effective_cache_value should reflect OS + DB cache availability"
   - Remediation: "Set to 50-70% of available RAM for query planner accuracy"
5. IF missing_pg_bloat_monitoring
   → FINDING: database-missing-bloat-monitoring-5 (severity: medium, effort: M)
   - Evidence: "No monitoring for table/index bloat which degrades performance over time"
   - Remediation: "Install pg_extension or schedule regular bloat reports"
6. IF unused_indexes_detected
   → FINDING: database-unused-indexes-6 (severity: low, effort: S)
   - Evidence: "Index idx_old_column shows zero scans over monitoring period"
   - Remediation: "Consider removing unused indexes to reduce write overhead"
7. IF index_bloat_significant
   → FINDING: database-index-bloat-7 (severity: medium, effort: M)
   - Evidence: "Index bloat > 30% indicates maintenance opportunity"
   - Remediation: "REINDEX CONCURRENTLY to remove bloat without locking"
8. IF missing_connection_pooling_in_application
   → FINDING: database-missing-app-pool-8 (severity: high, effort: M)
   - Evidence: "Application creates new connections per request instead of pooling"
   - Remediation: "Implement connection pooling (e.g., PgBouncer, HikariCP)"
9. IF statement_timeout_not_configured
   → FINDING: database-statement-timeout-missing-9 (severity: medium, effort: XS)
   - Evidence: "Long-running queries can block resources indefinitely"
   - Remediation: "Set statement_timeout to prevent runaway queries (e.g., 5000ms)"
10. IF lock_timeout_not_configured
    → FINDING: database-lock-timeout-missing-10 (severity: medium, effort: XS)
    - Evidence: "Row locks can block transactions indefinitely"
    - Remediation: "Set lock_timeout to prevent indefinite blocking (e.g., 1000ms)"
```

## Output Format

### findings[] Array
Each finding must conform to the finding-schema.json with:
- `module`: "database"
- `id`: database-[category]-[number] (e.g., database-missing-index-fk-1)
- `severity`: Based on decision tree assessment
- `location`: 
  - `file`: Path to schema/migration file (relative to repo root)
  - `line`: Line number where issue occurs (0 if file-level)
  - `function`: Table/column name or migration version if applicable
  - `commit`: Commit SHA if finding is historical (from git analysis)
- `description`: Human-readable description of the database issue
- `remediation`: Specific SQL or schema change to fix the issue
- `effort`: Estimated effort to fix (XS-S for simple index adds, M-L for schema migrations)
- `confidence`: Assessor confidence in the finding (0.0-1.0)
- `tags`: Relevant tags like ["postgresql", "index", "migration", "n+1", "supabase"]
- `relatedFindings`: IDs of related findings (e.g., performance bottlenecks caused by missing index)
- `evidence`: 
  - `snippet`: Relevant schema/migration excerpt
  - `metric`: Table size, query frequency, or other quantitative measure
  - `benchmark`: EXPLAIN ANALYZE results if available

### schema-summary.json
```json
{
  "databaseType": "postgresql|mysql|mongodb|etc",
  "host": "localhost or connection string (credentials removed)",
  "port": 5432,
  "schemaName": "public",
  "tables": [
    {
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "UUID",
          "nullable": false,
          "default": "gen_random_uuid()",
          "isPrimaryKey": true,
          "isForeignKey": false,
          "references": null
        },
        {
          "name": "email",
          "type": "VARCHAR(255)",
          "nullable": false,
          "default": null,
          "isPrimaryKey": false,
          "isForeignKey": false,
          "references": null
        }
      ],
      "indexes": [
        {
          "name": "users_pkey",
          "columns": ["id"],
          "isUnique": true,
          "isPrimary": true
        },
        {
          "name": "idx_users_email",
          "columns": ["email"],
          "isUnique": true,
          "isPrimary": false
        }
      ],
      "foreignKeys": [],
      "rowCount": 15420,
      "sizeMB": 2.3
    }
  ],
  "relationships": [
    {
      "name": "orders_user_id_fkey",
      "sourceTable": "orders",
      "sourceColumn": "user_id",
      "targetTable": "users",
      "targetColumn": "id"
    }
  ],
  "indexAnalysis": {
    "totalIndexes": 24,
    "unusedIndexes": 3,
    "duplicateIndexes": 0,
    "missingForeignKeyIndexes": 2,
    "avgIndexSizeMB": 0.8
  },
  "migrationAnalysis": {
    "totalMigrations": 42,
    "irreversibleMigrations": 2,
    "riskyMigrations": 5,
    "lastMigration": "V42__add_index_to_orders",
    "migrationsPerMonth": 2.1
  },
  "connectionPool": {
    "recommendedSize": 20,
    "currentConfiguration": "unknown (application-level)",
    "supportsPooling": true
  },
  "postgresSpecific": {
    "pgStatStatementsEnabled": false,
    "workMem": "4MB",
    "maintenanceWorkMem": "64MB",
    "effectiveCacheSize": "256MB",
    "bloatPercentage": 12.5,
    "longestRunningTransaction": "5 minutes"
  }
}
```

## Examples

### Example 1: E-commerce Missing Index
**Input**: 
- Schema file: `prisma/schema.prisma` with User, Order, OrderItem models
- Migration files: `prisma/migrations/` with V1__initial.sql, V2__add_indexes.sql
- Query logs: Show frequent joins on OrderItem.order_id
**Analysis**:
- OrderItem model has order_id relation but no explicit index
- Slow query log shows OrderItem.order_id in WHERE clauses without index
- Table OrderItem has 2.4M rows
**Output**:
- findings[]:
  - database-missing-index-fk-1 (severity: high, effort: S): 
    - Description: "Foreign key column order_id in OrderItem table lacks index"
    - Location: prisma/schema.prisma line 45 (OrderItem model)
    - Remediation: "Add @@index([order_id]) to OrderItem model"
    - Evidence: "OrderItem.order_id references Order.id but no index exists"
    - Metric: "OrderItem table: 2.4M rows"
  - database-missing-index-hot-path-2 (severity: medium, effort: S):
    - Description: "Join column order_id in OrderItem appears in slow queries without index"
    - Location: Slow query log excerpt
    - Remediation: "CREATE INDEX idx_orderitem_order ON OrderItem(order_id);"
    - Evidence: "Query: SELECT * FROM OrderItem WHERE order_id = ? took 2.4s"
    - Metric: "Appears in 12% of slow queries"
- schema-summary.json: Includes table definitions with missing index flags

### Example 2: Risky Migration Pattern
**Input**:
- Migration file: `V3__change_email_length.sql`
- Content: `ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(100);`
- Application logs: Show email addresses up to 150 characters in use
**Analysis**:
- Migration reduces column length from 255 to 100 characters
- Existing data may be truncated causing data loss
- No data validation or backup strategy in migration
**Output**:
- findings[]:
  - database-risky-migration-3 (severity: high, effort: M):
    - Description: "Migration reduces email column length risking data truncation"
    - Location: V3__change_email_length.sql line 1
    - Remediation: "Add data validation step before type change or use VARCHAR(255)"
    - Evidence: "ALTER COLUMN email TYPE VARCHAR(100) may truncate existing data"
    - Metric: "Max email length in logs: 152 characters"
- schema-summary.json: Migration marked as risky with data loss warning

### Example 3: Connection Pool Misconfiguration
**Input**:
- Application config: `application.properties` with `spring.datasource.hikari.maximum-pool-size=2`
- Infrastructure: 8-core CPU, expected 100 concurrent API requests
**Analysis**:
- Connection pool severely undersized for expected load
- Will cause connection wait times and timeouts under load
**Output**:
- findings[]:
  - database-undersized-pool-2 (severity: high, effort: XS):
    - Description: "Connection pool size too small for expected concurrent load"
    - Location: application.properties line 12
    - Remediation: "Increase maximum-pool-size to 40-80 based on concurrent request expectations"
    - Evidence: "Pool size of 2 with expected 100 concurrent users"
    - Metric: "Expected wait time >5s under load"
- schema-summary.json: Connection pool configuration flagged as inadequate

## Extensibility

Community contributors can extend this skill by:
1. Adding database-specific decision trees for MySQL, SQL Server, MongoDB, etc.
2. Enhancing the PostgreSQL/Supabase rules with additional performance tuning
3. Adding ORM-specific detection patterns (Hibernate, Entity Framework, etc.)
4. Improving the schema-summary.json with additional metadata fields
5. Adding new finding types for specific anti-patterns (e.g., EF core specific)
6. Improving examples with additional database systems and scenarios