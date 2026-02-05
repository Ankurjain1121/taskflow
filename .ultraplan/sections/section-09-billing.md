# Section 09: Billing & Freemium (Stub Endpoints)

## Overview
Implement freemium business model with **stub endpoints** for future Razorpay integration. Free tier: 1 board, 5 users. 15-day premium trial on sign-up. Paid plans defined but payment processing deferred. Backend: Rust Axum + SQLx. Frontend: Angular 19.

## Risk: [green] - Stubs only, no payment processing
## Dependencies
- Depends on: 02
- Blocks: 12
- Parallel batch: 4

## Tasks

<task type="auto" id="09-01">
  <name>Create subscription schema and plan definitions</name>
  <files>backend/crates/services/src/billing/mod.rs, backend/crates/services/src/billing/plans.rs, backend/crates/db/src/queries/subscriptions.rs</files>
  <action>Create plans.rs with:
- PLAN_FREE = "free", PLAN_PRO = "pro", PLAN_PRO_50 = "pro_50", PLAN_PRO_100 = "pro_100"
- PlanLimits struct: { max_boards, max_users, price_inr }
- get_plan_limits(plan_code) returning limits

Create subscriptions.rs queries:
- get_subscription(pool, tenant_id) -> Option<Subscription>
- create_trial_subscription(pool, tenant_id) -> sets status='trialing', trial_ends_at = now + 15 days
- update_subscription_status(pool, tenant_id, status, plan_code)
- check_trial_expired(pool, tenant_id) -> bool</action>
  <verify>Plans defined. Subscription queries work.</verify>
</task>

<task type="auto" id="09-02">
  <name>Build plan enforcement middleware</name>
  <files>backend/crates/api/src/middleware/plan_limits.rs</files>
  <action>Create plan_limits.rs:
- PlanLimits extractor that reads subscription, applies trial/grace logic
- check_board_limit(pool, tenant_id, limits) -> Result or 403 PLAN_LIMIT
- check_user_limit(pool, workspace_id, limits) -> Result or 403 PLAN_LIMIT
- Graceful fallback to free if no subscription row</action>
  <verify>Limits enforced. Missing subscription defaults to free.</verify>
</task>

<task type="auto" id="09-03">
  <name>Create stub billing REST endpoints</name>
  <files>backend/crates/api/src/routes/billing.rs</files>
  <action>Create billing.rs with STUB endpoints (return mock data, no payment processing):
- GET /api/billing/status -> { plan_code, status, trial_ends_at, limits: { boards_used, boards_max, users_used, users_max } }
- POST /api/billing/upgrade -> { message: "Payment integration pending", redirect_url: null }
- POST /api/billing/cancel -> { message: "Subscription cancelled" } (updates DB status only)
- GET /api/billing/invoices -> [] (empty array)
- POST /api/webhooks/razorpay -> 200 OK (stub, logs request body)

All endpoints return proper structure so frontend can integrate.</action>
  <verify>Endpoints return expected JSON structure. No actual payment calls.</verify>
</task>

<task type="auto" id="09-04">
  <name>Build Angular billing UI with stub service</name>
  <files>frontend/src/app/core/services/billing.service.ts, frontend/src/app/features/settings/billing/billing.component.ts, frontend/src/app/shared/components/plan-badge/plan-badge.component.ts, frontend/src/app/shared/components/upgrade-prompt/upgrade-prompt.component.ts</files>
  <action>Create billing.service.ts calling stub endpoints.

Create plan-badge.component.ts: green=Pro, blue=Trial, orange=PastDue, gray=Free.

Create upgrade-prompt.component.ts as Material Dialog showing "Payment integration coming soon" message with plan benefits list.

Create billing.component.ts at /settings/billing showing:
- Current plan + badge
- Usage bars (from /api/billing/status)
- Trial countdown if applicable
- "Upgrade" button (opens upgrade-prompt dialog)
- Empty invoices section with "No invoices yet"</action>
  <verify>UI renders. Upgrade shows "coming soon". Badge displays correctly.</verify>
</task>
