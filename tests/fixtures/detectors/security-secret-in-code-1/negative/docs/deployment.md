# security-secret-in-code-1 NEGATIVE — a `docs/` page is documentation, and a
# fenced example credential there is the canonical false positive. The value is
# realistic on purpose: only the path class keeps it silent.

```bash
export API_KEY="AKIAIOSFODNN7EXAMPLE"
export DB_PASSWORD="sup3r-secret-password-123"
```
