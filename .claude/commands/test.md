# /test - Run Tests

Run the test suite and fix any failures.

## Usage
- `/test` — Run all tests (backend + frontend)
- `/test backend` — Rust tests only
- `/test frontend` — Angular unit tests only
- `/test e2e` — Playwright E2E tests
- `/test coverage` — Run with coverage reporting

## Commands

### All Tests
```bash
# Backend
cd /home/ankur/taskflow/backend && cargo test --workspace 2>&1

# Frontend unit tests
cd /home/ankur/taskflow/frontend && npm test -- --reporter=verbose 2>&1
```

### Backend Only
```bash
cd /home/ankur/taskflow/backend && cargo test --workspace 2>&1
```

### Frontend Only
```bash
cd /home/ankur/taskflow/frontend && npm test -- --reporter=verbose 2>&1
```

### E2E Only
```bash
cd /home/ankur/taskflow/frontend && npm run test:e2e 2>&1
```

### Coverage
```bash
# Frontend coverage
cd /home/ankur/taskflow/frontend && npm test -- --coverage 2>&1
```

## On Failure

If tests fail, spawn parallel agents to fix them:

1. **Backend failures**: Use `build-error-resolver` agent to fix Rust test compilation errors, then fix logic errors
2. **Frontend failures**: Use `build-error-resolver` agent for TypeScript errors, then fix test logic
3. **E2E failures**: Use `e2e-runner` agent to diagnose and fix

Re-run tests after fixes to verify.
