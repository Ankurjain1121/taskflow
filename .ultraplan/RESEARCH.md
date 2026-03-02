# UltraPlan Research: TaskFlow World-Class Improvement

> Generated: 2026-02-25
> Phase: 2/6 - RESEARCH
> Sources: 3 subagents (codebase + web + docs)
> Topics researched: 12 | Libraries analyzed: 8

---

## Research Hypotheses

| # | Hypothesis | Evidence For | Evidence Against | Verdict |
|---|-----------|-------------|-----------------|---------|
| H1 | Angular CDK virtual scrolling + OnPush will achieve sub-200ms for 200+ task boards | OnPush already 100% adopted; CDK virtual scroll renders only visible items; signals used extensively (389 occurrences) | CDK virtual scroll CANNOT be combined with CDK drag-and-drop (broken index calculations, items snap to wrong positions); no official support | **MODIFIED** - Use pagination/collapse for large DnD columns; virtual scroll only for read-only lists |
| H2 | Self-hosted Ollama + Qwen 8B can respond in <3s for task creation/summarization | ollama-rs 0.3.4 is Tokio-native Axum-compatible; Ollama supports structured JSON output; Qwen 8B capable for structured text | GPU required: 18-68 tok/s on GPU vs 1-4 tok/s on CPU; CPU inference unacceptable for interactive use | **MODIFIED** - Achievable only with GPU; need to verify user's Qwen machine has GPU |
| H3 | PrimeNG can be styled to achieve Trello-like clean & friendly aesthetic | definePreset() API allows full override; CSS layer ordering already configured; most visual elements are custom Tailwind; 8 accent color presets exist | PrimeNG Aura theme has dense enterprise feel by default; complex internal DOM on some components | **CONFIRMED** - Infrastructure already in place, moderate effort |
| H4 | UX audit + feature discovery system will be more impactful than adding features | **7 orphaned components** found (automations, sharing, webhooks, import/export, custom fields, milestones); multiple case studies confirm UX > features for engagement | None | **STRONGLY CONFIRMED** - The #1 problem is wiring existing features, not building new ones |
| H5 | Real-time task locking works on existing WebSocket infrastructure | WebSocket handler production-ready with 3 auth methods; Redis pub/sub for channels; BroadcastService with board/user/workspace channels; frontend handler processes task events | Current protocol only supports Auth/Subscribe/Unsubscribe/Ping from client; needs new ClientMessage variants; needs Redis key-value for lock state | **CONFIRMED** - Incremental changes on solid foundation |

---

## Research Topics

| Priority | Topic | Source | Status | Key Finding |
|----------|-------|--------|--------|-------------|
| HIGH | Angular 19 performance | Web + Docs | DONE | OnPush + Signals already adopted; zoneless experimental in v19 |
| HIGH | Ollama/Qwen 8B integration | Web + Docs | DONE | ollama-rs 0.3.4 + structured JSON output; GPU required |
| HIGH | Kanban UX best practices | Web | DONE | Linear philosophy: reduce friction points; rich card previews |
| HIGH | Feature discovery UX | Web | DONE | Progressive disclosure: tours, tooltips, empty states, demo board |
| MEDIUM | Command palette | Web + Docs | DONE | @ngxpert/cmdk 3.x - unstyled, Angular 19 compatible |
| MEDIUM | CDK virtual scrolling | Docs | DONE | Works for read-only; INCOMPATIBLE with CDK DnD |
| MEDIUM | Real-time collaboration | Web + Codebase | DONE | Presence indicators via existing WebSocket; skip CRDTs |
| MEDIUM | PrimeNG theming | Codebase + Docs | DONE | definePreset() + CSS layers + Tailwind = full control |
| MEDIUM | Frontend-backend gap audit | Codebase | DONE | 7 orphaned components, 1 missing feature |
| LOW | Slack/Discord notifications | Web | DONE | Webhook-based, straightforward |
| LOW | Google Calendar sync | Web | DONE | Google Calendar API with OAuth2 |
| LOW | Tailwind CSS 4 new syntax | Docs | DONE | @import, @plugin, @theme blocks |

---

## Codebase Analysis

### Frontend-Backend Gap Summary

| Status | Count | Details |
|--------|-------|---------|
| **COMPLETE** | 38 | Backend + frontend working and accessible |
| **PARTIAL** | 7 | Frontend built but NOT accessible from UI |
| **MISSING** | 1 | No frontend at all (workspace export) |
| **INTERNAL** | 4 | Backend-only (cron, health, helpers, tests) |

### 7 Orphaned Components (CRITICAL)

These components are **fully built** (services + UI) but have **zero navigation paths** to access them:

| # | Feature | Component | Backend | Issue |
|---|---------|-----------|---------|-------|
| 1 | Board Sharing | `share-settings.component.ts` | `board_share.rs` | Not in board settings or board header |
| 2 | Webhooks | `webhook-settings.component.ts` | `webhook.rs` | Not in board settings |
| 3 | Automations | `automation-rules.component.ts` + `rule-builder.component.ts` | `automation.rs` | Not imported/accessible from board view |
| 4 | Import | `import-dialog.component.ts` | `import.rs` | Not imported from any parent |
| 5 | Export | `export-dialog.component.ts` | `export.rs` | Not imported from any parent |
| 6 | Custom Fields Manager | `custom-fields-manager.component.ts` | `custom_field.rs` | Not in board settings (task-level values ARE shown) |
| 7 | Milestones | `milestone-list.component.ts` | `milestone.rs` | Not in board view (can set in create-task-dialog) |

### 1 Missing Feature

| Feature | Backend Endpoint | Frontend |
|---------|-----------------|----------|
| Workspace Export | `GET /workspaces/:id/export` | No service or component |

### Architecture Strengths
- 100% standalone components (no NgModules)
- 100% OnPush change detection in production
- 389 signal/computed/effect usages across 130 files
- Lazy loading on all routes with PreloadAllModules
- Fractional indexing for drag-and-drop positioning
- Optimistic UI for task mutations
- Event coalescing enabled
- Good empty states (7 variants, 25+ usages)
- 4-step onboarding wizard with sample board generation

### Architecture Weaknesses
- Zero virtual scrolling anywhere
- Board settings page overloaded (needs tabbed navigation)
- No top navigation bar (only sidebar + minimal header)
- Help page not linked from sidebar
- Eisenhower Matrix not in sidebar navigation

---

## Technology Decisions

### Decision 1: Large Column Handling Strategy

| Criterion | Weight | Virtual Scroll + DnD | Paginate/Collapse | Swimlanes |
|-----------|--------|---------------------|-------------------|-----------|
| DnD compatibility | 5 | 2 (broken) | 5 (works) | 4 (works with groups) |
| Performance | 4 | 5 (optimal) | 4 (good enough) | 3 (all items rendered per group) |
| UX simplicity | 3 | 3 (scroll behavior) | 4 (familiar) | 5 (organized) |
| Implementation effort | 3 | 1 (no official support) | 5 (simple) | 3 (moderate) |
| **Weighted Total** | | **46** | **69** | **56** |

**Recommendation:** Paginate/Collapse (score: 69)
- Show first 20 tasks per column, "Show N more..." button
- Virtual scroll ONLY for read-only views (My Tasks list, notifications)
- Swimlanes as future enhancement for boards with 100+ tasks

### Decision 2: AI Provider Architecture

| Criterion | Weight | Ollama REST Direct | ollama-rs Crate | Both (REST + Crate) |
|-----------|--------|-------------------|-----------------|---------------------|
| Streaming support | 4 | 4 (manual SSE) | 5 (native stream) | 5 |
| Structured output | 5 | 5 (format param) | 5 (supported) | 5 |
| Error handling | 3 | 3 (HTTP codes) | 5 (Rust types) | 5 |
| Maintenance | 3 | 5 (no dependency) | 4 (crate updates) | 3 (both) |
| **Weighted Total** | | **63** | **72** | **67** |

**Recommendation:** ollama-rs crate (score: 72) - Tokio-native, type-safe, streaming built-in

### Decision 3: Command Palette Library

| Criterion | Weight | @ngxpert/cmdk | Custom Build | PrimeNG SpeedDial |
|-----------|--------|-------------|-------------|-------------------|
| Tailwind styling | 4 | 5 (unstyled) | 5 (full control) | 2 (PrimeNG themed) |
| Keyboard nav | 5 | 5 (built-in) | 3 (build from scratch) | 1 (not designed for this) |
| Search/filter | 4 | 5 (built-in) | 3 (build from scratch) | 1 (not applicable) |
| Effort | 3 | 5 (install + style) | 1 (weeks of work) | 5 (exists) |
| **Weighted Total** | | **80** | **48** | **32** |

**Recommendation:** @ngxpert/cmdk (score: 80) - Unstyled, composable, keyboard-first

---

## Library Documentation Summary

| Library | Version | Use Case | Key API | Gotchas |
|---------|---------|----------|---------|---------|
| Angular CDK DnD | 19.x | Kanban drag-drop | `cdkDrag`, `cdkDropList`, `cdkDropListGroup` | Do NOT combine with virtual scroll |
| Angular CDK Scrolling | 19.x | Read-only list virtual scroll | `CdkVirtualScrollViewport`, `*cdkVirtualFor` | Requires fixed item height; incompatible with DnD |
| PrimeNG 19 | 19.x | UI components + theming | `definePreset()`, `updatePreset()`, CSS layers | Complex internal DOM on some components |
| Tailwind CSS 4 | 4.x | Styling | `@theme`, `@plugin`, container queries | New syntax vs v3; `@import "tailwindcss"` not `@tailwind` |
| @ngxpert/cmdk | 3.x | Command palette | `<cmdk-command>`, `<cmdk-input>`, `<cmdk-item>` | Requires @angular/cdk peer; unstyled by default |
| ollama-rs | 0.3.4 | Ollama client for Rust | `Ollama::generate()`, `generate_stream()` | Enable `stream` feature flag; Tokio runtime required |
| Ollama API | latest | Self-hosted LLM | `/api/generate`, `/api/chat`, `format` param | GPU needed for interactive speed; CPU 1-4 tok/s |
| Angular View Transitions | 19.x | Route animations | `withViewTransitions()` | Chrome/Edge only; graceful degradation on others |

---

## Conflicts Found

### Conflict 1: Virtual Scroll + Drag-and-Drop (RESOLVED)

**Issue:** CDK virtual scroll cannot be combined with CDK drag-and-drop (multiple GitHub issues, broken index calculations)

**Resolution:** Use paginate/collapse for DnD columns. Virtual scroll only for read-only views (My Tasks, notifications). This matches the user's "under 100 users" scale where most columns won't exceed 50 tasks.

### Conflict 2: AI Response Speed Requires GPU (RESOLVED - DEFERRED)

**Issue:** Qwen 8B on CPU generates only 1-4 tokens/second. GPU needed for interactive use.

**Resolution:** User decided to skip AI features for now. Focus entirely on UX improvements, performance, and feature discoverability. AI features will be added in a future phase when GPU availability is confirmed.

### Conflict 3: Board Settings Page Overload (RESOLVED)

**Issue:** Adding 6 more features (sharing, webhooks, automations, import/export, custom fields, milestones) to the already-long board settings page would create a terrible UX.

**Resolution:** Convert board settings to tabbed navigation (already using PrimeNG Tabs in workspace settings). Tabs: General | Columns | Members | Automations | Integrations (webhooks + import/export + sharing) | Custom Fields | Milestones.

---

## Summary and Recommendations

### Implementation Priority Order (Pareto-Optimized)

**Phase A: Wire Orphaned Features (Highest Impact, Lowest Effort)**
1. Add tabbed navigation to board settings
2. Wire 7 orphaned components into board settings tabs
3. Build workspace export frontend
4. Add missing sidebar links (Eisenhower, Help)

**Phase B: Navigation & Discovery UX**
5. Add top navigation bar (search, notifications, quick-create, user menu)
6. Command palette (Cmd+K) with @ngxpert/cmdk
7. Feature tour for first-time users (highlight new features)
8. Contextual tooltips on underused features
9. Feature dashboard page

**Phase C: Performance & Polish**
10. Paginate/collapse for columns with 20+ tasks
11. Virtual scrolling for My Tasks and notification lists
12. Subtle animations (route transitions, card hover, drag feedback)
13. PrimeNG theme polish (Trello-like warmth, rounded corners)
14. Rich task card previews (priority badge, due date, avatar, subtask progress)

**Phase D: Real-Time & Collaboration**
15. Presence indicators (who's viewing this board)
16. Task editing lock (show "Sarah is editing...")
17. Browser push notifications
18. Sound effects for notifications/completions

**Phase E: AI Features**
19. Ollama integration backend (ollama-rs crate)
20. AI chat sidebar UI
21. Smart task creation (natural language → structured task)
22. Board summarizer (daily project status)
23. Task breakdown (big task → subtasks)

**Phase F: Integrations**
24. Slack webhook notifications
25. Discord webhook notifications
26. Google Calendar sync

### Tech Stack Confirmation

| Layer | Technology | Status |
|-------|-----------|--------|
| Backend | Rust 1.93, Axum 0.8, SQLx 0.8 | KEEP |
| Frontend | Angular 19, TypeScript 5.7 | KEEP |
| UI Components | PrimeNG 19 | KEEP + restyle |
| Styling | Tailwind CSS 4 | KEEP |
| Database | PostgreSQL 16, Redis 7 | KEEP |
| Storage | MinIO | KEEP |
| AI | Ollama + Qwen 8B (self-hosted) | NEW |
| Command Palette | @ngxpert/cmdk 3.x | NEW |
| Notifications | Web Push API | NEW |

---

## User Review Status

| Item | Status |
|------|--------|
| Tech stack approved | PENDING |
| Architecture approach approved | PENDING |
| Libraries approved | PENDING |
| Conflicts resolved | PENDING (Conflict 2 needs input) |
| Risks acknowledged | PENDING |
| Ready for PRD | PENDING |
