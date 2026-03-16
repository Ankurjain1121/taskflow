# /test - Run Tests

Run the test suite for backend (Rust), frontend unit tests (Vitest), and E2E tests (Playwright).

## Quick Start

```bash
/test              # Run all tests (backend + frontend unit)
/test backend      # Rust tests only
/test frontend     # Angular/Vitest unit tests only
/test e2e          # Playwright E2E tests only
/test coverage     # Frontend unit tests with coverage report
/test watch        # Frontend unit tests in watch mode
```

---

## Stack

- **Backend**: Rust 1.93, Tokio async runtime, Cargo test framework
- **Frontend unit**: Vitest (NOT ng test), testing-library, jsdom
- **Frontend E2E**: Playwright (Chromium, headless, 1 worker for stability)

---

## Detailed Commands

### All Tests
```bash
# Run both backend + frontend unit tests
/test
```

**What it does:**
```bash
cd /home/ankur/taskflow/backend && cargo test --workspace 2>&1
cd /home/ankur/taskflow/frontend && npx vitest run 2>&1
```

---

### Backend Tests Only
```bash
/test backend
```

**What it does:**
```bash
cd /home/ankur/taskflow/backend && cargo test --workspace 2>&1
```

**Run specific test:**
```bash
cd /home/ankur/taskflow/backend && cargo test board::tests --lib 2>&1
```

**Run with output:**
```bash
cd /home/ankur/taskflow/backend && cargo test -- --nocapture 2>&1
```

---

### Frontend Unit Tests

#### Run all tests
```bash
/test frontend
```

**What it does:**
```bash
cd /home/ankur/taskflow/frontend && npx vitest run 2>&1
```

#### Watch mode (auto-rerun on file changes)
```bash
/test watch
```

**What it does:**
```bash
cd /home/ankur/taskflow/frontend && npx vitest 2>&1
```

#### Run specific test file
```bash
cd /home/ankur/taskflow/frontend && npx vitest run --reporter=verbose src/app/core/services/task.service.spec.ts 2>&1
```

#### Run tests matching pattern
```bash
cd /home/ankur/taskflow/frontend && npx vitest run --reporter=verbose -t "should create" 2>&1
```

---

### Frontend Coverage Report

```bash
/test coverage
```

**What it does:**
```bash
cd /home/ankur/taskflow/frontend && npx vitest run --coverage 2>&1
# Report: frontend/coverage/index.html
```

**Thresholds (from vite.config.ts):**
- Statements: 60%
- Branches: 60%
- Functions: 60%
- Lines: 60%

---

### E2E Tests (Playwright)

#### Run all E2E tests (headless)
```bash
/test e2e
```

**What it does:**
```bash
cd /home/ankur/taskflow/frontend && npx playwright test --project=chromium 2>&1
```

#### Run specific E2E spec
```bash
cd /home/ankur/taskflow/frontend && npx playwright test e2e/board.spec.ts --project=chromium 2>&1
```

#### Run E2E tests with visible browser (headed)
```bash
cd /home/ankur/taskflow/frontend && npx playwright test --project=chromium --headed 2>&1
```

#### View E2E results
```bash
cd /home/ankur/taskflow/frontend && npx playwright show-report playwright-report
```

#### Debug single test
```bash
cd /home/ankur/taskflow/frontend && npx playwright test --project=chromium --debug e2e/board.spec.ts 2>&1
```

---

## Test Structure

### Backend (Rust)
```
backend/
  crates/
    api/src/
      routes/          # API endpoint handlers
      extractors/      # Auth/role-based access control
      middleware/      # Request processing
    db/src/
      queries/         # Database operations
      models/          # Data types
      migrations/      # SQL migrations
    auth/src/          # JWT, password hashing
    services/src/      # Background jobs, notifications
```

**Test Pattern:**
```rust
#[cfg(test)]
mod tests {
  #[tokio::test]
  async fn test_board_creation() {
    // Arrange
    let db = setup_test_db().await;
    // Act
    let board = create_board(&db, ...).await;
    // Assert
    assert!(board.is_ok());
  }
}
```

### Frontend (Angular + Vitest)
```
frontend/src/
  app/
    core/
      services/        # Business logic, HTTP calls
      guards/          # Route guards
      interceptors/    # HTTP interceptors
    features/          # Feature modules (board, task, etc.)
    shared/            # Reusable components, pipes, utils
```

**Test Pattern (Vitest + TestBed):**
```typescript
import { TestBed } from '@angular/core/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MyService]
    });
    service = TestBed.inject(MyService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });
});
```

---

## Interpreting Results

### Successful Run
```
✓ src/app/core/services/task.service.spec.ts (12 tests)
✓ src/app/features/board/board-view.component.spec.ts (8 tests)
✓ ...

Test Files  2 passed | 0 failed (2)
     Tests  20 passed | 0 failed (20)
```

### Failed Run
```
✗ src/app/core/services/api.service.spec.ts
  ✗ should handle 404 error response
    Expected 404 to equal 200

Test Files  1 failed | 1 passed (2)
     Tests  1 failed | 19 passed (20)
```

---

## On Test Failure

### Step 1 — Identify the problem

**See only failing file names:**
```bash
cd /home/ankur/taskflow/frontend && npx vitest run 2>&1 | grep "FAIL"
```

**See full error for one file:**
```bash
cd /home/ankur/taskflow/frontend && npx vitest run --reporter=verbose src/app/core/services/api.service.spec.ts 2>&1
```

### Step 2 — Common Failure Types

| Issue | Solution | Agent |
|-------|----------|-------|
| **Import/Type errors** | Fix imports, check tsconfig | `build-error-resolver` |
| **Service mock stale** | Update mock in spec to match current service | Manual fix |
| **Signal state assertion wrong** | Use `.signal()` to read value | Manual fix |
| **HTTP mock expectation wrong** | Adjust httpMock.expectOne() pattern | Manual fix |
| **E2E timeout or selector not found** | Increase timeout, verify selector path | `e2e-runner` |
| **Flaky async test** | Add `fakeAsync`, `tick()`, or `waitFor` | Manual fix |

### Step 3 — Use Agents for Complex Failures

**For TypeScript/import errors:**
```bash
# Use build-error-resolver to fix type issues
```

**For E2E failures:**
```bash
# Use e2e-runner to debug Playwright tests
```

**For test logic issues:**
```bash
# Use tdd-guide to write better tests
```

---

## Angular 19 Signal Testing

### Reading Signal Values
```typescript
const component = TestBed.createComponent(MyComponent).componentInstance;
expect(component.mySignal()).toBe('expected-value'); // Call signal to read
```

### Setting Signal Inputs
```typescript
const fixture = TestBed.createComponent(MyComponent);
fixture.componentRef.setInput('myInput', 'new-value'); // Set via componentRef
fixture.detectChanges();
expect(component.mySignal()).toBe('new-value');
```

### Testing Computed Signals
```typescript
it('computed should filter items', () => {
  component.items.set([
    { type: 'A' },
    { type: 'B' }
  ]);

  // Computed signal should update automatically
  expect(component.filteredItems().length).toBe(1);
});
```

### Testing Effect Cleanup
```typescript
it('should clean up effect on destroy', () => {
  const fixture = TestBed.createComponent(MyComponent);
  const subscription = spyOn(RxJsService.prototype, 'cleanup');

  fixture.componentInstance.ngOnDestroy();
  expect(subscription).toHaveBeenCalled();
});
```

---

## Performance Notes

- **Vitest**: 10-20x faster than Karma/Jasmine
- **Serial E2E**: Chromium only, 1 worker for stability (can parallelize later)
- **Coverage thresholds**: 100% target (enforced in vite.config.ts)

---

## Troubleshooting

### "Cannot find module" errors
```bash
cd /home/ankur/taskflow/frontend
npm install  # Reinstall if node_modules corrupted
```

### "Browser not installed" for Playwright
```bash
cd /home/ankur/taskflow/frontend
npx playwright install chromium
```

### Test timeout on VPS
- Increase timeout: `test.setTimeout(30000)` in test file
- Use `--project=chromium` (single browser)
- Check if VPS CPU is under load

### localStorage in tests
```typescript
// localStorage is available in jsdom
localStorage.setItem('key', 'value');
expect(localStorage.getItem('key')).toBe('value');
```

---

## Testing Best Practices

### Unit vs Integration vs E2E

| Type | Scope | Speed | When to Use |
|------|-------|-------|-------------|
| **Unit** | Single function/component | Fast (ms) | Pure logic, utilities, transformations |
| **Integration** | Module + dependencies | Medium (s) | API routes with DB, services with HTTP |
| **E2E** | Full user flow | Slow (10s+) | Critical paths: login, create task, drag-drop |

**Testing pyramid**: Many unit tests, fewer integration, minimal E2E.

### Mocking Strategies

**Backend (Rust)**:
```rust
// Use trait objects for mockable dependencies
#[cfg(test)]
mod tests {
    use mockall::predicate::*;
    // Mock external services, not internal logic
    // Prefer real DB (test transactions) over mocking queries
}
```

**Frontend (Angular + Vitest)**:
```typescript
// Mock HTTP with HttpTestingController
const httpMock = TestBed.inject(HttpTestingController);
const req = httpMock.expectOne('/api/tasks');
req.flush({ success: true, data: mockTasks });

// Mock services with vi.fn()
const mockService = { getTasks: vi.fn().mockReturnValue(of(mockTasks)) };
TestBed.configureTestingModule({
  providers: [{ provide: TaskService, useValue: mockService }]
});
```

### Async Test Handling

**Rust**: Use `#[tokio::test]` for async tests. Wrap DB operations in transactions and roll back.

**Angular**: Use `fakeAsync` + `tick()` for timer-based code, `waitForAsync` for real async, `firstValueFrom` for observables.

```typescript
it('should debounce search', fakeAsync(() => {
  component.searchQuery.set('test');
  tick(300); // wait for debounce
  expect(mockService.search).toHaveBeenCalledWith('test');
}));
```

### Debugging Failing Tests

1. Run the single failing test with verbose output
2. Check if the test is flaky (run 3 times)
3. Verify mocks match current service signatures
4. Check for shared state between tests (missing cleanup)
5. Use `--reporter=verbose` for detailed failure output

---

## CI/CD Testing Instructions

### Required Test Coverage Thresholds

| Suite | Threshold | Blocks Deploy? |
|-------|-----------|----------------|
| Backend (`cargo test`) | All pass | YES |
| Frontend unit (`vitest`) | 100% coverage | YES |
| Frontend E2E (`playwright`) | All pass | YES |
| Clippy warnings | Zero warnings | YES |
| TypeScript (`tsc --noEmit`) | Zero errors | YES |

### Pre-Merge Checklist

Run before merging any PR or deploying:
```bash
# Full validation (backend + frontend build + lint)
./scripts/pre-deploy-check.sh

# Quick check (no Docker build)
./scripts/quick-check.sh
```

### Test Execution Order in CI

1. **Lint & Type Check** (fast, catch early)
   - `cargo clippy -- -D warnings`
   - `npx tsc --noEmit`
2. **Unit Tests** (medium, catch logic bugs)
   - `cargo test --workspace`
   - `npx vitest run --coverage`
3. **E2E Tests** (slow, catch integration bugs)
   - `npx playwright test --project=chromium`
4. **Build Verification** (final gate)
   - `cargo build --release`
   - `npm run build -- --configuration=production`

### Parallel Test Execution

- Backend crate tests run in parallel by default (`cargo test`)
- Frontend Vitest runs test files in parallel by default
- E2E Playwright: use `--workers=1` on VPS (limited resources), `--workers=4` on CI with more CPU
- Backend and frontend test suites can run in parallel in CI (separate jobs)

### Environment Requirements for CI

```yaml
# Required services
- PostgreSQL 16 (for integration tests)
- Redis 7 (for cache/undo tests)

# Required env vars
DATABASE_URL: postgres://test:test@localhost/taskflow_test
REDIS_URL: redis://localhost:6379
JWT_SECRET: test-secret-for-ci
SQLX_OFFLINE: true  # Use cached query metadata
```

---

## Critical Coverage Gaps (TODO)

**Backend (Tier 1 - Security Critical):**
- [ ] Auth extractors (role enforcement) — 50-80 tests needed
- [ ] Board/workspace queries — 100+ tests needed
- [ ] API routes CRUD — 150+ tests needed

**Frontend (Tier 1 - Foundational):**
- [ ] api.service — 40-60 tests (NEW file)
- [ ] presence.service — enhance heartbeat logic tests
- [ ] conflict-notification.service — multi-field scenarios

**E2E (Tier 1 - Core Features):**
- [ ] Kanban drag-drop (move between columns) — 5-7 tests (NEW file: board-kanban-drag-drop.spec.ts)
- [ ] Real-time collaboration (presence, save status) — 3-4 tests
- [ ] Notifications (dismiss, archive, quiet hours) — 2-3 tests

---

## Next Steps

1. **Run full test suite** to establish baseline
2. **Address failing tests** using appropriate agents
3. **Fill coverage gaps** starting with Tier 1 (security-critical items)
4. **Monitor coverage threshold** and aim for 80%+ before production releases

---

*Test infrastructure set up. Ready to run.*
