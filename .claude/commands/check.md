---
name: check
description: Run all code quality checks (build, typecheck, lint)
---

Run all quality checks for the TaskFlow monorepo.

## Backend (Rust)

### 1. Cargo Check (Fast Compilation)
```bash
cd backend && cargo check --workspace --all-targets 2>&1 && cd ..
```

### 2. Clippy (Linter)
```bash
cd backend && cargo clippy --workspace --all-targets -- -D warnings 2>&1 && cd ..
```

### 3. Rustfmt (Format Check)
```bash
cd backend && cargo fmt --all -- --check 2>&1 && cd ..
```

## Frontend (Angular/TypeScript)

### 1. TypeScript Type Check
```bash
cd frontend && npx tsc --noEmit 2>&1 && cd ..
```

### 2. Angular Production Build
```bash
cd frontend && npm run build -- --configuration=production 2>&1 && cd ..
```

---

**Report Summary:**
- List all errors (MUST fix before commit)
- Note warnings (acceptable if documented)
- Overall status: PASS ✅ / FAIL ❌
