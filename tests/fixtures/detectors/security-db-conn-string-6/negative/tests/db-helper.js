#!/usr/bin/env node
// security-db-conn-string-6 NEGATIVE — a test-directory path that the tree walker
// does NOT skip (only `__tests__`/`fixtures`/`*.spec.*` are skipped upstream), so
// the credential policy's own path class is what keeps this line quiet.
const pool = {
  connectionString: 'postgres://testuser:T3stP4ssw0rdX@db.internal.example.com:5432/testdb',
};

module.exports = { pool };
