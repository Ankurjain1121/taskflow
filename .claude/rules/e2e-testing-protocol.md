# E2E Testing Protocol

## Before Writing Any Test

1. **Read the component template** for actual selectors — never assume from memory or old tests
2. **Grep for component usage** in parent templates, not just definition files. A component file existing ≠ it being rendered in the DOM
3. **Check parent component's `imports` array** to verify child components are actually imported
4. **Check backend health** for critical API paths the test will hit (`curl` the endpoint first)
5. **Grep backend for `TODO`, `unimplemented!()`, `Err(.*RowNotFound)`** on endpoints the test depends on — stubbed functions cause cascading E2E failures

## When Running Tests

1. **Run ALL tests once** — capture full console logs via the `console-logger` fixture
2. **Group failures by root cause** (not by test file). Common: backend 500 > wrong selectors > rate limits > timing
3. **Fix highest blast-radius cause first** (e.g., backend 500 that blocks 19 tests before selector fix that blocks 3)
4. **Never fix-and-rerun incrementally** — collect all errors, plan all fixes, then execute

## Test Infrastructure Rules

| Rule | Why |
|------|-----|
| `beforeAll` + `signInTestUser` for shared user state | `beforeEach` + `signUpAndOnboard` creates N users for N tests → hits rate limits |
| `waitForLoadState('networkidle')` for async sidebar/nav | `domcontentloaded` fires before sidebar workspace/project items load |
| Scope selectors to component tag (`app-sign-up input[formControlName="name"]`) | Bare `input#name` matches duplicates across components |
| Never use bare `#id` selectors | IDs can duplicate across simultaneously-rendered components |
| Use `app-sidebar-projects .project-item` for sidebar projects | `app-workspace-item` is orphaned dead code — not rendered anywhere |

## Backend-First Diagnosis

When console logs show **HTTP 5xx**:
1. **STOP fixing frontend tests** — the root cause is backend
2. Run `docker logs taskflow-backend 2>&1 | grep -i "error\|500\|panic" | tail -20`
3. Find the failing endpoint and read its handler code
4. Fix backend → rebuild → redeploy → THEN re-run E2E tests

## Current Dashboard Selectors (Post-Redesign)

| Element | Correct Selector | Wrong Selector |
|---------|-----------------|----------------|
| Greeting heading | `h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening"), h1:has-text("Burning the midnight oil")` | `h1:has-text("Good morning")` only |
| Stat cards | `.stat-card` | `.grid .rounded-xl.shadow-sm` |
| Stat values | `.stat-card-value` | `.text-3xl.font-bold` |
| Error messages | `.pi-exclamation-circle ~ span` | `.bg-red-50 span` |
| Sidebar projects | `app-sidebar-projects .project-item` | `app-workspace-item` |
| My Tasks link | `a[href="/my-tasks"]` (stat card links) | `a[href="/my-tasks"]` in removed section |
| Workspace name input | `app-step-workspace input[formControlName="name"]` | `input#name` |

## Onboarding Flow (4 Steps)

```
workspace → invite → use-case → sample-board → "Go to your board" (NOT "Go to Dashboard")
```

After onboarding, user lands on **board page**, NOT dashboard. Tests needing dashboard must `page.goto('/dashboard')` explicitly.

## Rate Limit Awareness

- Auth endpoints: 20 req/60s shared across sign-up, sign-in, refresh
- Test suite with 6 files creates ~20+ users
- `signUpTestUser` has built-in retry with 15s delay — set `test.setTimeout(120000)` for `beforeAll` blocks
