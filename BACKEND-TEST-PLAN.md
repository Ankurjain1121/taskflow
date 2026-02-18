# Backend Test Plan — Rust (80%+ Coverage Target)

## Current State
- 74 tests across 37 files (~15% coverage)
- No test infrastructure (no test DB, no mocks, no fixtures)
- Critical gaps: auth, task, board routes + 22 query files

## Architecture
- Rust 1.93 + Axum + SQLx + PostgreSQL 16
- Crates: `api` (routes, middleware, ws), `db` (queries, models), `services`, `auth`
- Tests use `#[cfg(test)]` inline modules + `#[tokio::test]`

---

## Phase 0: Test Infrastructure (DO FIRST)

### 0a. Add test dependencies to Cargo.toml files

**backend/Cargo.toml (workspace):**
```toml
[workspace.dependencies]
# ... existing ...
mockall = "0.13"
```

**backend/crates/api/Cargo.toml:**
```toml
[dev-dependencies]
tokio = { workspace = true, features = ["full", "test-util"] }
serde_json = { workspace = true }
mockall = { workspace = true }
axum-test = "16"
tower = { version = "0.5", features = ["util"] }
```

**backend/crates/db/Cargo.toml:**
```toml
[dev-dependencies]
tokio = { workspace = true, features = ["full", "test-util"] }
serde_json = { workspace = true }
```

**backend/crates/services/Cargo.toml:**
```toml
[dev-dependencies]
tokio = { workspace = true, features = ["full", "test-util"] }
serde_json = { workspace = true }
mockall = { workspace = true }
```

### 0b. Create test helpers module

Create `backend/crates/db/src/test_helpers.rs`:
```rust
#[cfg(test)]
pub mod fixtures {
    use uuid::Uuid;
    use chrono::Utc;

    pub fn random_uuid() -> Uuid {
        Uuid::new_v4()
    }

    pub fn random_email() -> String {
        format!("test-{}@example.com", Uuid::new_v4().as_simple())
    }

    pub fn random_name() -> String {
        format!("Test User {}", &Uuid::new_v4().to_string()[..8])
    }
}
```

### 0c. Verify test setup works
```bash
cd /root/taskflow/backend
cargo test 2>&1 | tail -20
```

---

## Phase 1: Pure Unit Tests (No DB Required) — P1

These test logic, serialization, validation — no database needed.

### 1a. Auth crate expansion (backend/crates/auth/src/)

| File | Current Tests | Add Tests For |
|------|--------------|---------------|
| `jwt.rs` | 1 | Token expiry, invalid secret, refresh token, claims extraction |
| `password.rs` | 1 | Empty password, long password, hash format validation |
| `rbac.rs` | 6 | Edge cases: unknown roles, permission boundaries |

**Target: +12 tests**

### 1b. Model serialization (backend/crates/db/src/models/)

Test all enum serialization/deserialization for:
- `TaskStatus`, `TaskPriority`, `BoardRole`, `InvitationStatus`
- `NotificationType`, `WebhookEvent`, `RecurrencePattern`
- Key struct `FromRow` derivations with mock row data

**Files:** `task.rs`, `board.rs`, `notification.rs`, `webhook.rs`, `invitation.rs`, `recurring.rs`
**Target: +20 tests**

### 1c. Service pure logic (backend/crates/services/src/)

| File | Current Tests | Add Tests For |
|------|--------------|---------------|
| `notifications/events.rs` | 3 | All event type formatting, edge cases |
| `notifications/email.rs` | 2 | Template rendering, HTML escaping |
| `notifications/slack.rs` | 3 | Markdown formatting, mention handling |
| `notifications/whatsapp.rs` | 4 | Message truncation, emoji handling |
| `audit.rs` | 2 | All action types mapping |
| `trash_bin.rs` | 2 | Expiry calculations, type detection |

**Target: +15 tests**

### 1d. Middleware logic (backend/crates/api/src/middleware/)

| File | Add Tests For |
|------|---------------|
| `rate_limit.rs` | Key extraction, window expiry, counter logic |
| `audit.rs` | Action mapping completeness, path parsing |
| `tenant.rs` | Workspace ID extraction, header validation |

**Target: +10 tests**

**Phase 1 Total: ~57 new tests, ~0 DB dependency**

---

## Phase 2: Route Handler Tests (Mock DB) — P1

Use `axum-test` or manual handler invocation with mock state.

### Strategy
For route handlers, test:
1. Request parsing (correct deserialization)
2. Auth extraction (reject unauthenticated)
3. Response format (correct JSON shape)
4. Error responses (404, 403, 422)

### 2a. Health & simple routes
| File | Tests To Add |
|------|-------------|
| `health.rs` | Full handler test with mock pool |
| `onboarding.rs` | Request validation |

### 2b. Auth routes (CRITICAL — security-sensitive)
| Test | What It Validates |
|------|------------------|
| Sign-in with valid credentials | 200 + set-cookie |
| Sign-in with wrong password | 401 |
| Sign-in with nonexistent email | 401 (same error, no enumeration) |
| Sign-up validation | Required fields, email format |
| Token refresh with valid cookie | 200 + new token |
| Token refresh with expired cookie | 401 |
| Password reset request | 200 always (no email enumeration) |

**Target: +10 tests**

### 2c. Task routes (HIGHEST TRAFFIC)
| Test | What It Validates |
|------|------------------|
| Create task — valid | 201 + task JSON |
| Create task — missing title | 422 |
| Create task — non-member board | 403 |
| Get task — exists | 200 + full task |
| Get task — not found | 404 |
| Update task — partial update | 200 |
| Delete task (soft) | 200 |
| Move task between columns | 200 + new column_id |
| Assign task | 200 + assignee |
| Unassign task | 200 |
| Bulk update | 200 + count |

**Target: +15 tests**

### 2d. Board routes
| Test | What It Validates |
|------|------------------|
| Create board | 201 + board JSON + default columns |
| Get board full | 200 + columns + tasks |
| Update board | 200 |
| Delete board | 200 (owner only) |
| Add member | 200 |
| Remove member | 200 |

**Target: +8 tests**

### 2e. Other critical routes
| File | Tests | Priority |
|------|-------|----------|
| `workspace.rs` | CRUD + member management | P1 |
| `column.rs` | CRUD + reorder | P2 |
| `search.rs` | Query parsing, auth filtering | P1 |
| `notification.rs` | List, mark-read, preferences | P2 |
| `comments.rs` | CRUD, mention parsing | P2 |
| `my_tasks.rs` | Filtering, sorting, pagination | P1 |

**Target: +25 tests**

**Phase 2 Total: ~58 new tests**

---

## Phase 3: Query Layer Tests (Needs Test DB) — P2

### Strategy
Use `sqlx::test` with a test database or manual transaction rollback:

```rust
#[sqlx::test]
async fn test_create_task(pool: PgPool) {
    // sqlx::test creates a fresh DB from migrations
    let workspace = create_test_workspace(&pool).await;
    let board = create_test_board(&pool, workspace.id).await;
    let task = create_task(&pool, CreateTaskRequest { ... }).await.unwrap();
    assert_eq!(task.title, "Test Task");
}
```

### 3a. Core query files
| File | Functions to Test | Priority |
|------|------------------|----------|
| `tasks.rs` | create, get, update, delete, move, assign | P1 |
| `boards.rs` | create, get, update, members, columns | P1 |
| `auth.rs` | find_by_email, create_user, update_password | P1 |
| `workspaces.rs` | create, get, members, settings | P1 |
| `columns.rs` | create, reorder, delete | P2 |
| `comments.rs` | CRUD, pagination | P2 |
| `search.rs` | Full-text search, filters | P2 |
| `notifications.rs` | create, mark_read, bulk_read | P2 |

**Target: +40 tests**

### 3b. Complex query validation
| File | What to Test |
|------|-------------|
| `my_tasks.rs` | Sort parameter wiring, pagination correctness |
| `reports.rs` | Burndown calculation, date series |
| `team_overview.rs` | Aggregate query correctness |
| `recurring.rs` | Transaction integrity, recurrence calculation |
| `dashboard.rs` | Stats aggregation, activity timeline |

**Target: +20 tests**

**Phase 3 Total: ~60 new tests**

---

## Phase 4: WebSocket Tests — P3

| Test | What It Validates |
|------|------------------|
| Connection with valid auth | Upgrade succeeds |
| Connection without auth | 401 |
| Channel subscription | Join/leave messages |
| Broadcast on task update | All subscribers receive |
| Concurrent lock safety | No deadlock under load |

**Target: +8 tests**

---

## Execution Summary

| Phase | Tests | DB Required | Complexity | Priority |
|-------|-------|-------------|-----------|----------|
| 0: Infrastructure | 0 | No | Setup | P0 |
| 1: Pure Unit | ~57 | No | LOW | P1 |
| 2: Route Handlers | ~58 | Mock/Real | MEDIUM | P1 |
| 3: Query Layer | ~60 | Yes | HIGH | P2 |
| 4: WebSocket | ~8 | Yes | HIGH | P3 |
| **Total** | **~183** | | | |

After all phases: 74 existing + 183 new = **~257 tests**

---

## Parallel Agent Strategy (for Claude Code)

```
Agent A: Phase 1a + 1b (auth + models — pure unit tests, no DB)
Agent B: Phase 1c + 1d (services + middleware — pure unit tests, no DB)
Agent C: Phase 2a-2c (health + auth + task route tests)
Agent D: Phase 2d-2e (board + other route tests)
```

After Wave 1 passes `cargo test`:
```
Agent E: Phase 3a (core query integration tests)
Agent F: Phase 3b + Phase 4 (complex queries + websocket)
```

### File Ownership (No Overlap)
| Agent | Files |
|-------|-------|
| A | `auth/src/*.rs`, `db/src/models/*.rs` |
| B | `services/src/**/*.rs`, `api/src/middleware/*.rs` |
| C | `api/src/routes/{health,auth,task}.rs` |
| D | `api/src/routes/{board,workspace,column,search,notification,comments,my_tasks}.rs` |
| E | `db/src/queries/{tasks,boards,auth,workspaces,columns,comments}.rs` |
| F | `db/src/queries/{my_tasks,reports,team_overview,recurring,dashboard}.rs`, `api/src/ws/*.rs` |
