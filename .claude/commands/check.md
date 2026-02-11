---
name: check
description: Run all code quality checks (build, typecheck, lint)
---

Run all quality checks for the TaskFlow monorepo:

```bash
cd frontend && npx ng build --configuration=production 2>&1
```

Report: errors (must fix), warnings (acceptable), and build status.
