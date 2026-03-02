# Technical Plan: TaskFlow World-Class Upgrade

> Generated: 2026-02-25
> Sections: 9 | Tasks: 52 | Batches: 3
> Tech Stack: Rust/Axum + Angular 19 + PrimeNG 19 + Tailwind CSS 4

---

## Project Overview

**Goal:** Transform TaskFlow from "powerful but confusing" to "powerful and delightful" by fixing feature discoverability, achieving sub-200ms interactions, and creating a clean, friendly Trello-like experience.

**Key Insight:** TaskFlow already has 94% feature parity with enterprise PM tools. The problem is 7 fully-built features are unreachable from the UI. The fix is architecture (navigation, layout, discovery), not features.

**Constraints:**
- Keep existing tech stack (Rust + Angular + PrimeNG + Tailwind)
- No AI features in this phase (deferred)
- Desktop-first, mobile secondary
- Under 100 users initially
- Fast iterations, ship weekly

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    TOP NAVIGATION BAR                         │
│  [Breadcrumbs]  [Ctrl+K Search]  [+ Create]  [🔔]  [Avatar] │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│ SIDEBAR  │              MAIN CONTENT AREA                     │
│          │                                                    │
│ Workspace│  ┌─────────────────────────────────────────────┐  │
│ ├ Boards │  │  BOARD VIEW (Kanban/List/Calendar/Gantt)    │  │
│ ├ Teams  │  │  ┌─────────────────────────────────────┐    │  │
│ ├ My Work│  │  │ [Quick Filters: My Tasks | This Week]│    │  │
│ ├ Favs   │  │  └─────────────────────────────────────┘    │  │
│ ├ Help   │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐               │  │
│ └ Feature│  │  │ To │ │ In │ │Rev │ │Done│  ← Columns     │  │
│   Dash.  │  │  │ Do │ │Prog│ │iew │ │    │    with WIP    │  │
│          │  │  │    │ │3/5 │ │    │ │    │    limits       │  │
│          │  │  │┌──┐│ │┌──┐│ │┌──┐│ │┌──┐│               │  │
│          │  │  ││  ││ ││  ││ ││  ││ ││  ││  ← Rich cards  │  │
│          │  │  │└──┘│ │└──┘│ │└──┘│ │└──┘│    with meta   │  │
│          │  │  │Show│ │    │ │    │ │    │               │  │
│          │  │  │more│ │    │ │    │ │    │  ← Pagination  │  │
│          │  │  └────┘ └────┘ └────┘ └────┘               │  │
│          │  └─────────────────────────────────────────────┘  │
│          │                                                    │
│ [Presence│  ┌──────────────────────────────┐                 │
│  Avatars]│  │     COMMAND PALETTE (Ctrl+K)  │  ← Overlay     │
│          │  │  Search boards, tasks, actions │                │
│          │  └──────────────────────────────┘                 │
├──────────┴───────────────────────────────────────────────────┤
│                    TASK DETAIL MODAL                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Title  │ Assignee  │ Priority  │ Due Date              │  │
│  │ Description (Rich Text)                                │  │
│  │ Subtasks │ Comments │ Activity │ Time Tracking          │  │
│  │ Custom Fields │ Dependencies │ Recurring               │  │
│  │ [🔒 Maya is editing...]                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Architecture Patterns

| Component | Pattern | Reason |
|-----------|---------|--------|
| API Layer | REST (existing) | 850+ endpoints already built, no reason to change |
| State Management | Signals + Services | Angular signals for reactivity, services for data fetching |
| Auth | JWT + Refresh (existing) | Argon2 hashing, RBAC, multi-tenancy all working |
| File Handling | Direct upload to MinIO (existing) | Simple, works well at current scale |
| Real-time | WebSocket + Redis pub/sub (existing) | Extending for presence + locking |
| Code Organization | Feature modules (existing) | Standalone components, lazy-loaded routes |
| Error Handling | AppError enum + Toast (existing) | Consistent error handling pattern |
| Rendering | OnPush + Signals (100% adoption) | Optimal for Angular 19 performance |

### Architecture Decision Records

#### ADR 1: Pagination over Virtual Scroll for Kanban
**Context:** Kanban columns need to handle 50+ tasks while supporting drag-and-drop
**Decision:** Use pagination (show 20, expand on click) for DnD columns; virtual scroll only for read-only lists
**Alternatives:** CDK virtual scroll + DnD (broken - incompatible), infinite scroll (poor UX for kanban)
**Consequences:** Slightly more DOM elements than virtual scroll, but DnD works reliably

#### ADR 2: @ngxpert/cmdk for Command Palette
**Context:** Need a command palette that integrates with Angular 19 and can be styled with Tailwind
**Decision:** Use @ngxpert/cmdk 3.x (unstyled, composable, Angular-native)
**Alternatives:** Custom build (weeks of work), PrimeNG SpeedDial (wrong UX pattern)
**Consequences:** New dependency, but lightweight and well-maintained

#### ADR 3: Redis-Based Presence and Locking
**Context:** Need real-time presence and task editing locks
**Decision:** Extend existing WebSocket + Redis infrastructure with new message types and Redis key-value storage
**Alternatives:** Separate presence service (overkill), database polling (too slow), third-party service (against build-everything philosophy)
**Consequences:** Keeps the self-hosted philosophy, minimal new infrastructure

---

## Data Flow

```
User Action
    │
    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Angular     │────▶│  Axum API    │────▶│ PostgreSQL   │
│  Component   │     │  Routes      │     │ (SQLx)       │
│  (Signals)   │     │  (Middleware) │     └──────┬───────┘
└──────┬───────┘     └──────┬───────┘            │
       │                     │                    │
       │                     ▼                    │
       │              ┌──────────────┐            │
       │              │    Redis     │            │
       │              │  (pub/sub +  │            │
       │              │   key/value) │            │
       │              └──────┬───────┘            │
       │                     │                    │
       ▼                     ▼                    │
┌──────────────┐     ┌──────────────┐            │
│  WebSocket   │◀────│  Broadcast   │◀───────────┘
│  Handler     │     │  Service     │
│  (Board Ch.) │     └──────────────┘
└──────────────┘

Key Flows:
1. Task CRUD: Component → HTTP → Axum → SQLx → PostgreSQL → Broadcast → WebSocket → Other clients
2. Presence: Component → WebSocket → Redis Hash → Broadcast → Other clients
3. Locking: Component → WebSocket → Redis SET (TTL) → Broadcast → Other clients
4. Search: Component → HTTP → Axum → PostgreSQL LIKE → Response
5. Push Notify: Notification created → Check push subscription → web-push crate → Browser
```

### Bottlenecks
- **Search**: PostgreSQL LIKE query for large datasets → future: add trigram index or pg_trgm
- **Board load**: Loading all tasks for a board in one request → pagination limits this

### Single Points of Failure
- **Redis**: Used for sessions, pub/sub, presence, and locks. If Redis goes down, real-time features break. Mitigation: Redis is reliable at this scale; app still works without real-time (graceful degradation).
- **PostgreSQL**: All data lives here. Mitigation: Regular backups (add as operational task).

---

## Section Index

| # | Section | Tasks | Risk | Batch | Description |
|---|---------|-------|------|-------|-------------|
| 01 | Board Settings Overhaul | 7 | GREEN | 1 | Wire 7 orphaned features, tabbed settings, workspace export |
| 02 | Top Navigation Bar | 6 | GREEN | 1 | Persistent top bar with search, notifications, quick-create |
| 03 | Command Palette | 5 | GREEN | 1 | Ctrl+K quick navigation with @ngxpert/cmdk |
| 04 | Rich Task Cards & Kanban Polish | 7 | YELLOW | 1 | Card redesign, column pagination, quick filters |
| 05 | List Performance | 5 | YELLOW | 2 | Virtual scrolling for read-only lists |
| 06 | Presence & Collaboration | 6 | YELLOW | 2 | Board presence, task editing locks |
| 07 | Push Notifications & Sounds | 5 | GREEN | 2 | Browser push, sound effects |
| 08 | Feature Discovery & Onboarding | 6 | GREEN | 3 | Tours, tooltips, empty states, demo board |
| 09 | Visual Polish & Animations | 5 | GREEN | 3 | Theme polish, animations, backgrounds, WIP, shortcuts |

---

## Parallel Batch Groups

### Batch 1: Foundation (Start Here - No Dependencies)
Work on all 4 sections simultaneously.

| Section | Risk | Focus |
|---------|------|-------|
| 01 - Board Settings Overhaul | GREEN | Wire orphaned features |
| 02 - Top Navigation Bar | GREEN | New layout with top bar |
| 03 - Command Palette | GREEN | Ctrl+K quick navigation |
| 04 - Rich Cards & Kanban | YELLOW | Card redesign + pagination |

**Expected deliverable:** All features accessible, new layout, rich cards, fast boards

### Batch 2: Enhancement (After Batch 1)
Work on all 3 sections simultaneously.

| Section | Risk | Focus |
|---------|------|-------|
| 05 - List Performance | YELLOW | Virtual scrolling |
| 06 - Presence & Collaboration | YELLOW | Real-time awareness |
| 07 - Push Notifications & Sounds | GREEN | Notification delivery |

**Expected deliverable:** Fast lists, presence indicators, push notifications

### Batch 3: Polish (After Batch 2)
Work on both sections simultaneously.

| Section | Risk | Focus |
|---------|------|-------|
| 08 - Feature Discovery & Onboarding | GREEN | Tours, tooltips, demo board |
| 09 - Visual Polish & Animations | GREEN | Theme, animations, backgrounds |

**Expected deliverable:** Polished, discoverable, delightful experience

---

## Execution Flow

```
BATCH 1 ─────────────────────────────────────────────────────
│                                                             │
│  [01 Board Settings]  [02 Top Nav]  [03 Cmd+K]  [04 Cards]│
│       GREEN              GREEN        GREEN        YELLOW   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                            ▼                                │
│ BATCH 2 ───────────────────────────────────────────────────│
│                                                             │
│  [05 Virtual Scroll]  [06 Presence]  [07 Push Notifications]│
│       YELLOW              YELLOW        GREEN               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                            ▼                                │
│ BATCH 3 ───────────────────────────────────────────────────│
│                                                             │
│  [08 Feature Discovery]  [09 Visual Polish]                │
│       GREEN                  GREEN                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Risk Summary

| Risk Level | Count | Sections |
|------------|-------|----------|
| GREEN | 6 | 01, 02, 03, 07, 08, 09 |
| YELLOW | 3 | 04, 05, 06 |
| RED | 0 | - |

### YELLOW Risk Details

| Section | Risk | Mitigation |
|---------|------|------------|
| 04 - Rich Cards | Rendering performance with rich card data | OnPush + computed signals + profiling |
| 05 - Virtual Scrolling | First virtual scroll implementation, fixed height requirement | Start with simplest list, profile before/after |
| 06 - Presence | Bidirectional WebSocket, Redis lock management | Redis TTL auto-cleanup, heartbeat protocol |

---

## Review Notes

### Review Statistics
- Categories checked: 8/8
- Checks passed: 8/8 (with minor gaps in 3 categories)
- Persona findings: 7 total (2 MEDIUM, 5 LOW)
- Pre-mortem causes found: 3 (one per YELLOW section)
- Confidence: 0.82 (HIGH)

### Refinement Questions
1. "Test orphaned components before wiring?" → User: "Test first, then wire" (safer approach)
2. "Scope down to Batch 1 only?" → User: "Full plan" (all 52 tasks, 9 sections)

### Changes Made During Review

| Change | Section | Reason |
|--------|---------|--------|
| Add testing step before wiring | 01 | User wants orphaned components tested first |
| Push payloads = minimal data | 07 | Security persona: don't leak task content in push |
| Cmd palette uses existing search API (RBAC enforced) | 03 | Security persona: tenant isolation |
| Feature tour skippable at every step | 08 | User advocate: don't trap users |
| Board backgrounds lazy-loaded + compressed | 09 | User advocate: performance concern |
| DnD + pagination edge case test | 04 | Pre-mortem: pagination could break DnD indexes |
| Virtual scroll interactive element test | 05 | Pre-mortem: click handlers could break |
| Redis SET NX for atomic locking | 06 | Pre-mortem: race condition on lock acquisition |

### Confidence Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Completeness | 0.85 | All PRD features covered |
| Technical feasibility | 0.90 | Proven patterns, solid codebase |
| Risk assessment | 0.80 | YELLOW sections correctly identified |
| Effort estimation | 0.65 | Some tasks broad, depends on component state |
| Dependencies | 0.90 | Clean graph, well-ordered |
| **Overall** | **0.82** | **High confidence. Proceed to validation.** |

---

## Section File Manifest

| File | Path |
|------|------|
| Section Index | `.ultraplan/sections/index.md` |
| Section 01 | `.ultraplan/sections/section-01-board-settings-overhaul.md` |
| Section 02 | `.ultraplan/sections/section-02-top-navigation-bar.md` |
| Section 03 | `.ultraplan/sections/section-03-command-palette.md` |
| Section 04 | `.ultraplan/sections/section-04-rich-cards-kanban.md` |
| Section 05 | `.ultraplan/sections/section-05-list-performance.md` |
| Section 06 | `.ultraplan/sections/section-06-presence-collaboration.md` |
| Section 07 | `.ultraplan/sections/section-07-push-notifications.md` |
| Section 08 | `.ultraplan/sections/section-08-feature-discovery.md` |
| Section 09 | `.ultraplan/sections/section-09-visual-polish.md` |

---

## Plan Status

| Attribute | Value |
|-----------|-------|
| Status | COMPLETE |
| Generated | 2026-02-25 |
| Validated | 2026-03-02 |
| Coverage | P0: 100% \| P1: 100% \| P2: 100% |
| Confidence | 0.92/1.0 |
| Sections | 9 |
| Tasks | 52 |
| Batches | 3 |

> This plan was generated by UltraPlan-CT. To update it, run `/ultraplan-ct update`.
