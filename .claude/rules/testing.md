# Testing Requirements

## TaskFlow Stack

**Backend (Rust)**: `cargo test` (unit/integration), `cargo tarpaulin` (coverage)
**Frontend (Angular)**: Jasmine/Karma (unit), Playwright (E2E)

## Rust Testing Patterns

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_task() {
        let pool = setup_test_db().await;
        let task_request = CreateTaskRequest {
            title: "Test Task".to_string(),
            status: TaskStatus::Todo,
        };
        let result = create_task(&pool, task_request).await;
        assert!(result.is_ok());
    }
}
```

## Angular Testing with Signals

```typescript
describe('TaskListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskListComponent] // standalone
    }).compileComponents();
  });

  it('should update task count', () => {
    const fixture = TestBed.createComponent(TaskListComponent);
    const component = fixture.componentInstance;
    component.tasks.set([{ id: 1, title: 'Task 1' }]);
    expect(component.taskCount()).toBe(1);
  });
});
```

---

## Minimum Test Coverage: 80%

Test Types (ALL required):
1. **Unit Tests** - Individual functions, utilities, components
2. **Integration Tests** - API endpoints, database operations
3. **E2E Tests** - Critical user flows (framework chosen per language)

## Test-Driven Development

MANDATORY workflow:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (80%+)

## Troubleshooting Test Failures

1. Use **tdd-guide** agent
2. Check test isolation
3. Verify mocks are correct
4. Fix implementation, not tests (unless tests are wrong)

## Agent Support

- **tdd-guide** - Use PROACTIVELY for new features, enforces write-tests-first
