# TaskFlow Workspace Competitive Gap Analysis & Implementation Plan

## Context

Comprehensive competitive analysis against top 10 PM tools (Asana, Monday.com, Jira, Trello, ClickUp, Notion, Linear, Basecamp, Wrike, Smartsheet) revealed 22 missing workspace features. Additionally, a local Ollama instance on a separate VPS enables AI-powered features.

**Target audience**: Non-tech-savvy users. Prioritize simplicity and ease of use.

---

## Competitor Landscape

| Competitor | Workspace Term | Hierarchy Depth | Standout Feature |
|---|---|---|---|
| Asana | Organization/Workspace | 5 levels | 15-second undo toast, Portfolios |
| Monday.com | Workspace | 6 levels | AI workspace builder, 200+ templates |
| Jira | Site/Spaces | 5 levels | Permission schemes, JQL cross-search |
| Trello | Workspace | 4 levels | B key board switcher, simplicity |
| ClickUp | Workspace | 7 levels | 15+ view types, profile hover cards |
| Notion | Workspace | Infinite (pages) | Real-time cursors, Figma-style collab |
| Linear | Workspace | 5 levels | <50ms transitions, IndexedDB caching |
| Basecamp | Account (HQ+Teams) | 3 levels | Flat-rate pricing, built-in chat |
| Wrike | Account (Spaces) | 5 levels | Cross-tagging, space-level workflows |
| Smartsheet | Account (Workspaces) | 4 levels | Cross-sheet formulas, Control Center |

---

## TaskFlow Current State (What Works)

- Multi-workspace support with instant switching (signal-based, no reload)
- 5 role tiers: Owner, Admin, Manager, Member, Viewer
- Open/Closed workspace visibility with discovery page
- Sidebar with collapsible sections, Recent (5 boards), Favorites
- Full member management (search, bulk invite, role changes)
- Workspace settings: 5 tabs (General, Members, Teams, Integrations, Advanced)
- Logo upload, API keys, soft-delete
- Responsive mobile with overlay sidebar
- Deep linking for all routes
- WebSocket pub/sub with Redis broadcast
- Full-text search (tsvector on tasks)
- Audit logging (activity_log table)
- Automation engine (triggers/actions/logs)
- Custom fields at board level (5 types)
- Export (CSV/JSON for boards)
- Global search with Cmd+K command palette
- Keyboard shortcuts service
- Toast notification system

---

## HEAD-TO-HEAD: TaskFlow vs Competitors

| Feature | All 10 Competitors | TaskFlow |
|---|---|---|
| Guest/External access | Yes (all 10) | MISSING |
| Workspace templates | Yes (9/10) | MISSING |
| Custom fields per workspace | Yes (9/10) | Board-level only |
| Workspace automations | Yes (10/10) | Board-level only |
| Trash / Recycle bin | Yes (10/10, 30-day) | MISSING |
| Audit logs UI | Yes (8/10, Enterprise) | Backend exists, no UI |
| Workspace data export | Yes (10/10) | Board-level only |
| Workspace-level labels | Yes (9/10) | Board-level only |
| Custom statuses per workspace | Yes (8/10) | MISSING |
| Breadcrumb navigation | Yes (8/10) | MISSING |
| Online presence indicators | Yes (ClickUp, Notion) | MISSING |
| Profile hover cards | Yes (ClickUp, Monday) | MISSING |
| Drag-and-drop sidebar | Yes (7/10) | MISSING |
| Right-click context menus | Yes (Jira, ClickUp) | MISSING |
| Undo toast pattern | Yes (Asana best) | MISSING |

---

# IMPLEMENTATION PLAN

## Implementation Order

Phase 1 Foundation: F7 Undo Toast, F3 Breadcrumbs, F19 Skeleton Shimmer, F22 Empty States, F18 Keyboard Shortcuts
Phase 2 Core Data: F4 Labels, F6 Statuses, F11 Audit Log UI
Phase 3 Trash and Export: F1 Trash/Recycle Bin, F5 Workspace Export
Phase 4 Access and Templates: F2 Guest Access, F8 Templates, F15 Onboarding Wizard
Phase 5 Advanced Workspace: F9 Custom Fields, F10 Automations, F16 Notifications
Phase 6 UX Polish: F12 DnD Sidebar, F14 Hover Cards, F17 Context Menus, F13 Presence
Phase 7 Premium: F20 Cursors, F21 Offline Mode
Phase 8 AI: pgvector setup, Semantic search, Generative features, Advanced AI

---

# TIER 1: TABLE STAKES (7 Features)

## F1: Trash / Recycle Bin (30-day recovery)

Current State: trash_bin.rs service exists, admin_trash.rs route (admin-only), deleted_at on tasks/boards/workspaces. Columns and comments lack deleted_at.

Migration 20260224000001_trash_soft_delete_columns.sql:
- ALTER TABLE board_columns ADD COLUMN deleted_at TIMESTAMPTZ
- ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMPTZ
- Add deleted_by_id UUID to tasks, boards, workspaces, board_columns, comments
- Create partial indexes on deleted_at IS NOT NULL

Backend API:
- GET /api/workspaces/{id}/trash - List trash items
- POST /api/workspaces/{id}/trash/restore - Restore item (Manager+)
- DELETE /api/workspaces/{id}/trash/{type}/{id} - Permanent delete (Admin+)
- POST /api/undo/{undo_token} - Undo within 15s (Redis token with TTL)

New files: routes/workspace_trash.rs, routes/undo.rs
Frontend: trash.component.ts, trash.service.ts, sidebar trash nav item with count badge

Files: ~15 | Risk: Medium

## F2: Guest Access (External Users)

Migration 20260224000002_guest_access.sql:
- ALTER TYPE workspace_member_role ADD VALUE 'guest'
- CREATE TABLE guest_item_access (workspace_id, user_id, board_id, permission CHECK view/comment/edit, expires_at)
- ALTER TABLE invitations ADD COLUMN is_guest BOOLEAN, guest_permissions VARCHAR

Backend API:
- POST /api/workspaces/{id}/guests - Invite guest
- GET /api/workspaces/{id}/guests - List guests
- PATCH /api/workspaces/{id}/guests/{user_id} - Update permissions
- DELETE /api/workspaces/{id}/guests/{user_id} - Remove guest
- Modify board.rs, task_crud.rs, comments.rs to check guest_item_access

New files: routes/guest.rs, guest.service.ts
Frontend: Guest invitation dialog, guest section in member list, hide workspace items for guests

Files: ~18 | Risk: High

## F3: Breadcrumb Navigation

No DB/backend changes needed.

Frontend:
- New breadcrumb.service.ts: Subscribe to Router events, parse route params, resolve names with caching
- New breadcrumb.component.ts: PrimeNG p-breadcrumb or custom, clickable, truncation
- Modify layout.component.ts: Replace empty div with <app-breadcrumb>

Route mapping: /dashboard -> Dashboard, /workspace/:id -> WorkspaceName, /workspace/:id/board/:id -> WorkspaceName > BoardName

Files: ~4 | Risk: Low

## F4: Workspace-Level Labels/Tags

Migration 20260224000003_workspace_labels.sql:
- ALTER TABLE labels ADD COLUMN workspace_id UUID (migrate from board_id)
- UPDATE labels SET workspace_id from boards.workspace_id
- Make workspace_id NOT NULL, board_id nullable
- Add tenant_id, created_by_id, UNIQUE(workspace_id, name)

Backend API:
- GET/POST /api/workspaces/{id}/labels
- PUT/DELETE /api/workspaces/{id}/labels/{label_id}
- POST/DELETE /api/tasks/{task_id}/labels

New files: routes/label.rs, queries/labels.rs, label.service.ts, label-manager.component.ts, label-picker.component.ts
Modify: task-card (display), task-filter-bar (filter by label), workspace settings (Labels tab)

Files: ~14 | Risk: Medium

## F5: Workspace Data Export

No DB changes. Modify export.rs to add workspace-level export:
- GET /api/workspaces/{id}/export?format=csv|json
- CSV: all tasks with board_name column
- JSON: full workspace structure

Fix existing workspace-advanced-tab export button (endpoint didn't exist). Add CSV option.

Files: ~4 | Risk: Low

## F6: Custom Task Statuses per Workspace

Migration 20260224000004_workspace_statuses.sql:
- CREATE TABLE workspace_statuses (id, workspace_id, name, color, category CHECK not_started/in_progress/done/cancelled, position, is_default)
- Seed defaults: To Do, In Progress, Done, Blocked for all existing workspaces
- ALTER TABLE board_columns ADD COLUMN workspace_status_id

Backend API:
- GET/POST /api/workspaces/{id}/statuses
- PUT/DELETE /api/workspaces/{id}/statuses/{id}
- PATCH /api/workspaces/{id}/statuses/reorder

New files: routes/workspace_status.rs, queries/workspace_statuses.rs, workspace-status.service.ts, status-manager.component.ts
Modify: board creation to auto-create columns from workspace statuses

Files: ~12 | Risk: Medium

## F7: Enhanced Undo Toast Pattern

No DB/backend changes.

Extend ToastNotification interface:
- Add severity: info/success/warning/error
- Add actions: ToastAction[] with label + callback
- Add progress: boolean (countdown bar)
- Add showUndo() convenience method (15s default)

Modify toast.component.ts: action buttons, progress bar animation, severity styling
New: utils/confirm-action.ts utility
Replace confirm() in ~15 files with undo toast pattern

Files: ~20 | Risk: Low

---

# TIER 2: COMPETITIVE ADVANTAGE (7 Features)

## F8: Workspace Templates (5-10 Presets)

Store as JSON fixtures compiled into Rust binary: Agile Sprint, Content Calendar, Product Launch, Bug Tracking, Event Planning, Client Project, Marketing Campaign

Backend:
- GET /api/workspace-templates
- POST /api/workspaces/from-template

New: fixtures/workspace_templates.rs
Frontend: Template selection grid in create-workspace-dialog

Complexity: Medium

## F9: Workspace-Level Custom Fields

Migration: CREATE TABLE workspace_custom_fields. ALTER board_custom_fields ADD workspace_field_id.
Auto-create board_custom_fields for each board. New boards inherit workspace fields.

Backend: GET/POST /api/workspaces/{id}/custom-fields, PUT/DELETE /api/workspace-custom-fields/{id}
Frontend: workspace-custom-fields-tab in settings, show "(workspace)" badge on inherited fields

Complexity: High

## F10: Enhanced Workspace Automations

Migration: ALTER TABLE automation_rules ADD workspace_id. ADD new trigger/action enum values (task_overdue, member_added, move_to_board, archive_task).

Backend: GET/POST /api/workspaces/{id}/automations. Modify engine for workspace-level rules.
Frontend: workspace-automations-tab, cross-board action support in rule builder

Complexity: High

## F11: Audit Log UI

Migration: ALTER TABLE activity_log ADD workspace_id.
Backend: GET /api/workspaces/{id}/audit-log (reuse admin_audit patterns)
Frontend: workspace-audit-log-tab (reuse admin audit-log component patterns)

Complexity: Low

## F12: Drag-and-Drop Sidebar

Migration: ALTER TABLE user_preferences ADD sidebar_workspace_order UUID[], sidebar_favorite_order UUID[].
Frontend: Angular CDK DragDropModule on workspace items and favorites. Persist order via user-preferences service.

Complexity: Medium

## F13: Online Presence Indicators

Redis: HSET presence:{workspace_id} {user_id} {timestamp}
Backend: New ws/presence.rs with set_online/set_offline/get_online_users. Modify ws handler for heartbeat.
REST fallback: GET /api/workspaces/{id}/presence
Frontend: presence.service.ts, presence-indicator.component.ts (green/gray dot)

Complexity: Medium-High

## F14: Profile Hover Cards

No DB/backend changes (data exists: name, email, avatar, job_title, department, timezone).
Frontend: profile-hover-card.component.ts (PrimeNG Popover), hover-card.directive.ts ([appHoverCard]="userId")

Complexity: Low | Depends on: F13 for online status

---

# TIER 3: PREMIUM POLISH (8 Features)

## F15: Onboarding Wizard
Enhance existing onboarding: Step 1 template selection, Step 2 invite, Step 3 configure board. Depends on F8.
Complexity: Medium

## F16: Per-Workspace Notification Preferences
Migration: ADD workspace_id to notification_preferences, update unique constraint.
Backend: GET/PUT /api/workspaces/{id}/notification-preferences. Lookup: workspace-specific first, fallback global.
Complexity: Medium

## F17: Right-Click Context Menus
PrimeNG ContextMenu on workspace/board/task/member items. No DB changes.
Complexity: Low-Medium

## F18: Enhanced Keyboard Shortcuts
Multi-key sequences: G+D (dashboard), G+M (my tasks), G+T (team), N (new task), [ (collapse sidebar).
Add pendingKey state with 500ms timeout. Update help dialog.
Complexity: Low

## F19: Skeleton Shimmer Animations
Reusable skeleton.component with shimmer CSS (linear-gradient animation). Variants: board, task-list, dashboard.
Replace spinners throughout app.
Complexity: Low

## F20: Real-Time Cursors
WebSocket: CursorUpdate message type, relay to channel. Frontend: cursor-presence.service, editing-indicator.component.
Complexity: High | Depends on: F13

## F21: Offline Mode
Service Worker + IndexedDB cache. Queue mutations for sync. "You're offline" banner.
Complexity: Very High | Consider deferring

## F22: Empty State Illustrations
SVG illustrations for each empty state variant. Upgrade text-only CTAs.
Complexity: Low

---

# AI INTEGRATION (Ollama on Separate VPS)

## AI Phase 1: Foundation

1.1 Switch postgres image to pgvector/pgvector:pg16

1.2 Migration 20260224100001_ai_embeddings.sql:
- CREATE EXTENSION vector
- CREATE TABLE ai_embeddings (entity_type, entity_id, tenant_id, content_hash, embedding vector(768))
- HNSW index for cosine similarity
- CREATE TABLE workspace_ai_settings (feature flags per workspace)
- CREATE TABLE ai_usage_log (usage tracking)

1.3 Add pgvector crate (0.4 with sqlx feature)

1.4 Ollama client module: services/ai/ with client.rs (embed, generate, chat, health_check), types.rs, embeddings.rs

1.5 Add OllamaClient to AppState (Option<OllamaClient> for graceful degradation)

1.6 Nginx proxy on Ollama VPS with API key auth, SSL, rate limiting, streaming support

1.7 Embedding pipeline background job: every 5 min, batch 50 tasks, SHA-256 content hash skips unchanged

Env vars: OLLAMA_URL, OLLAMA_API_KEY, OLLAMA_EMBED_MODEL, OLLAMA_CHAT_MODEL, AI_ENABLED

## AI Phase 2: Core Features

Semantic Search: GET /api/ai/search?q=&mode=hybrid - embed query, cosine similarity, merge with tsvector
Auto-Categorization: POST /api/ai/categorize - suggest type/labels/priority (user confirms)
Duplicate Detection: POST /api/ai/check-duplicates - warn on >75% similar tasks

Frontend: AI toggle in global search, "AI Suggest" in task create, duplicate warning banner

## AI Phase 3: Generative Features

Task Suggestions: POST /api/ai/generate-tasks - SSE streaming via Axum Sse
AI Workspace Templates: POST /api/ai/generate-workspace - AI-generated structure from description
Board Summarization: GET /api/boards/{id}/ai/summary - cached in Redis 15min

## AI Phase 4: Advanced

NL Automations: POST /api/ai/parse-automation - parse English into automation rule JSON
Smart Assignment: POST /api/ai/suggest-assignees - embedding similarity + workload
Activity Digest: GET /api/workspaces/{id}/ai/digest - AI-summarized daily/weekly

## AI Error Handling

- AI_ENABLED=false: routes return 400, frontend hides AI UI
- Ollama unreachable: routes return 503, degrade to non-AI behavior
- Embedding fails: task creation NOT blocked (async), retry next sync
- Rate limits: search 30/min, generate 10/min per user

---

# NEW FILES SUMMARY

Backend (~15 new files):
- routes: workspace_trash.rs, undo.rs, guest.rs, label.rs, workspace_status.rs, ai.rs
- queries: labels.rs, workspace_statuses.rs, ai_embeddings.rs
- models: ai_embedding.rs
- services/ai: mod.rs, client.rs, embeddings.rs, types.rs
- jobs: embedding_sync.rs
- fixtures: workspace_templates.rs

Frontend (~25 new files):
- services: breadcrumb, label, workspace-status, trash, guest, presence, ai
- components: breadcrumb, label-picker, presence-indicator, profile-hover-card, skeleton (4 variants), context-menu (4 variants)
- directives: hover-card
- features: trash page, label-manager, status-manager, settings tabs (5 new)
- utils: confirm-action

Migrations (~8 files):
- 20260224000001 through 20260224000007 (workspace features)
- 20260224100001 (AI embeddings)

---

# SUCCESS CRITERIA

Tier 1:
- Trash: 30-day recovery, undo toast 15s, non-admin access
- Guest: invite to specific boards, view/comment/edit permissions enforced
- Breadcrumbs: every page, clickable, truncation
- Labels: workspace-scoped, CRUD in settings, picker on tasks, filterable
- Export: workspace CSV/JSON with all boards
- Statuses: workspace definitions, semantic categories, auto-create on new boards
- Undo: action buttons, progress bar, replace confirm() calls

Tier 2:
- Templates: 5+ presets, create-from-template works
- Custom fields: workspace-level, propagate to boards
- Automations: workspace-scoped, cross-board actions
- Audit: filterable log in workspace settings
- DnD: reorder sidebar, persists across reloads
- Presence: green/gray dots, <30s disconnect detection
- Hover cards: name, role, timezone, local time

AI:
- pgvector installed, embeddings auto-generated
- Semantic search with similarity scores
- Graceful degradation when Ollama is down
- All checks pass: cargo check, clippy, tsc, npm build
