# TaskFlow Competitor Analysis

> Single source of competitor intelligence for all TASK.md features.
> Generated: 2026-03-02 | Covers features A1–I5

---

## Navigation & Layout (A1–A4)

> Status: ✅ All Done. Competitor framing added for reference.

### A1: Top Navigation Bar

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Persistent top bar: breadcrumb trail, search trigger (Cmd+K), notifications bell, user avatar | Action hub — search + notify + identity always visible |
| Notion | Minimal breadcrumb + share/publish + comments in top bar | Minimal — only contextual actions visible |
| ClickUp | Top bar: quick-create (+), global search, inbox, avatar | Icon-first, label-optional |
| Asana | Top bar with: global search, home, inbox, create, avatar | Five-zone layout with labeled icons |
| Jira | Top bar: search, create, apps, notifications, help, profile | Dense icon tray — enterprise pattern |
| Monday.com | Top nav with: search, notifications, help, avatar; workspace label prominent | Workspace-first identity |
| GitHub | Top bar: logo, search, notifications, avatar, +create | Minimal — developer-centric |

**Winner pattern:** Persistent top nav with 5 zones: Logo/home · Breadcrumbs (context) · Search trigger (Cmd+K) · Notifications bell · User avatar. Actions are icon-first, label on hover. Linear/Asana pattern.

**TaskFlow status:** ✅ Implemented — `top-nav.component.ts`, `app.component.ts`.
**Reference:** [section-02-top-navigation-bar](.ultraplan/sections/section-02-top-navigation-bar.md)

---

### A2: Sidebar Redesign

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Collapsible left nav: Teams (with sub-sections: Issues, Cycles, Projects) + My account section at bottom | Team-grouped hierarchy, avatar footer |
| Notion | Wiki-style sidebar: workspace pages in tree; collapse to icon-only rail | Tree nav — works for docs, less for tasks |
| ClickUp | Space → Folder → List hierarchy with colored icons; pinnable sidebar items | Deep hierarchy, heavy nesting |
| Asana | Projects/Tasks listed directly; Portfolios + Goals in sidebar; Team section | Flat-ish, role-aware |
| Trello | Boards as top-level items; recent boards + starred boards sections | Board-centric, no sub-hierarchy |

**Winner pattern:** Collapsible sidebar with user profile footer (avatar + name + status), notification badge on bell, section grouping (Workspaces, Favorites, Recent), collapsible to icon-rail. Board hover shows quick-action icons. Linear pattern.

**TaskFlow status:** ✅ Implemented — `sidebar.component.ts`.
**Reference:** [mutable-bubbling-parnas](.claude/plans/mutable-bubbling-parnas.md)

---

### A3: Breadcrumbs

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | `Team > Project > Issue` in top bar; clicking parent navigates up | Static trail, no dropdown |
| Jira | `Project > Board > Issue` with chevrons; click = navigate | In top bar, consistent |
| Asana | `Workspace > Team > Project` as text links in header | Text links, consistent |
| Notion | Full page path as breadcrumb above page title; parent pages clickable | Inline path — works as document title |
| GitHub | `Owner / Repo / Path > File` — canonical file breadcrumbs | Slash-separated, always visible |

**Winner pattern:** `Workspace > Board > [Task]` displayed in top bar. Each segment is a clickable link. Board name resolved from router params via in-memory cache to avoid flicker. Notify on stale state.

**TaskFlow status:** ✅ Implemented — board name resolution fixed, BoardService injection + in-memory cache + stale-response guard.
**Reference:** [mutable-bubbling-parnas](.claude/plans/mutable-bubbling-parnas.md)

---

### A4: Layout Grid

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | CSS variables for all spacing/sizing; no hardcoded pixels; `height: 100dvh` on root | Variable-driven layout, dynamic viewport |
| Figma | Strict CSS grid with named template areas; overflow: hidden everywhere except designated scroll containers | Named areas prevent overflow leaks |
| GitHub | `min-height: 100vh` on body; sticky top nav; scrolling only in main content area | Classic sticky-nav + scrollable body pattern |
| Notion | Variable sidebar width via CSS custom property; board area = remaining viewport | Flexible sidebar = rest of viewport |
| Tailwind CSS (pattern) | `h-screen`, `flex-col`, `overflow-hidden` on root → overflow-y-auto on scroll containers | Utility-driven full-viewport layout |

**Winner pattern:** CSS custom properties (`--nav-height`, `--sidebar-width`, `--sidebar-width-collapsed`) drive all sizing. `overflow: clip` on route-transition-wrapper prevents scrollbar flash. Board root uses `calc(100dvh - var(--nav-height))` for height.

**TaskFlow status:** ✅ Implemented — CSS variables, overflow:clip, dvh calc.
**Reference:** [performance-optimization](.claude/plans/performance-optimization.md)

---

## Kanban Board (B1–B8)

> Full analysis: **[RESEARCH.md](RESEARCH.md)** — 10 competitors × 8 features, 400+ lines, 3-phase implementation plan included.

### B1: Rich Task Cards

**Winner pattern:** Priority + title (full width) + assignee avatar (right) + due date chip (color-coded) + label chips (truncated) + subtask progress bar (bottom). TaskFlow already matches; gap: no "expanded" mode showing description preview.

**Reference:** [RESEARCH.md#b1-rich-task-cards](RESEARCH.md) · [stateless-weaving-orbit](.claude/plans/stateless-weaving-orbit.md)

---

### B2: Column Pagination

**Winner pattern:** Show 20 → "Show N more" button → count in header badge. TaskFlow kanban-column already has this; gap: count badge in column header missing, no server-side pagination for very large boards.

**Reference:** [RESEARCH.md#b2-column-pagination](RESEARCH.md)

---

### B3: Quick Filter Bar

**Winner pattern:** Horizontal pill buttons for 4–6 preset quick filters. Active = filled/teal. Multi-select = AND logic. X to clear individual. "Clear all" link when any active. Gap: Overdue filter missing, "Clear all" missing, active chip style missing.

**Reference:** [RESEARCH.md#b3-quick-filter-bar](RESEARCH.md)

---

### B4: Card Density Toggle

**Winner pattern:** 3-option toggle (compact/comfortable/expanded) in board toolbar. Persist in localStorage. Linear/ClickUp pattern. Gap: expanded mode + persistence + toolbar toggle UI missing.

**Reference:** [RESEARCH.md#b4-card-density-toggle](RESEARCH.md)

---

### B5: Column Customization

**Winner pattern:** Color swatch picker on column header (hover to reveal). WIP limit badge "n/limit" turns red when exceeded. Gap: icon field missing from DB + column icon picker UI missing.

**Reference:** [RESEARCH.md#b5-column-customization](RESEARCH.md)

---

### B6: Swimlanes

**Winner pattern:** "Group by" dropdown → horizontal row bands. Each band = one CDK drop list group. Drag within row = normal; drag across rows = reassign group property. "None" row catches unassigned items.

**Reference:** [RESEARCH.md#b6-swimlanes](RESEARCH.md)

---

### B7: Board Keyboard Shortcuts

**Winner pattern:** `?` opens shortcuts modal, `Ctrl+K` = command palette, `N` = new task, `F` = focus filter, `C` = clear filters, `1-9` = scroll to column. Gap: column jump shortcuts (1–9), shortcut modal component.

**Reference:** [RESEARCH.md#b7-board-level-keyboard-shortcuts](RESEARCH.md)

---

### B8: Card Quick-Edit

**Winner pattern:** (1) Title: single-click → inline text edit. (2) Other fields (assignee, due date, priority): hover → small CDK Overlay popover. Gap: date picker popover, assignee picker popover, priority picker on hover.

**Reference:** [RESEARCH.md#b8-card-quick-edit](RESEARCH.md) · [mutable-zooming-moler](.claude/plans/mutable-zooming-moler.md)

---

## Board Settings & Orphaned Features (C1–C9)

**Plan reference:** [section-01-board-settings-overhaul](.ultraplan/sections/section-01-board-settings-overhaul.md)

### C1: Board Color/Background

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | 70+ open-source theme presets + custom theme builder | Theme library with sharing |
| Trello | Board backgrounds: solid colors, gradients, custom images via Power-Ups | Flexible visual customization |
| ClickUp | Column color grouping by status field; workspace themes | Field-driven colors |
| Jira | Workspace-level only; no per-board theming | System-level, not per-board |
| Asana | No board background customization | Structural over visual |
| Notion | No board background | Layout-focused |
| Monday.com | Workspace color themes only | Org-level theming |

**Winner pattern:** Trello's per-board background picker (solid colors, gradients, image upload) + Linear's preset theme library. Users can personalize without overwhelming the UI.

**TaskFlow gap:** No board-level color/background. Should add: predefined color themes, optional image upload, light/dark toggle per board.

---

### C2: Board Archiving

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Trello | "Close board" — soft delete, hidden but recoverable | Non-destructive, safe default |
| ClickUp | Archive spaces/lists; granular container-level | Recursive archiving |
| Linear | Archive entire projects (teams) | Project-level only |
| Asana | Project archiving; boards are views | View-based limit |
| Monday.com | Delete boards (hard delete) | No recovery |
| Notion | Database-level archive | Archive container, not view |

**Winner pattern:** Trello's soft-delete ("close board") with recovery window (30+ days). Hidden from sidebar but data preserved. Restore-from-archive action in settings.

**TaskFlow gap:** No board archiving. Add: soft-delete, recovery window, sidebar "Archived Boards" section, restore action.

---

### C3: Column Management

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| ClickUp | Inline drag-to-reorder + context menu (rename, delete) | Smooth inline UX |
| Trello | Drag-to-reorder + list menu (rename, archive, delete) | Simple list menu |
| Jira | Board Settings > Columns; maps statuses to columns; admin-only | Configuration panel, not inline |
| Linear | Status management in project settings; automatic board mapping | Status-first model |
| Asana | Drag-to-reorder; rename inline on column header | Inline rename on click |
| Notion | Group by property; changing property changes columns | Property-driven |

**Winner pattern:** Inline drag-to-reorder + right-click context menu for rename/delete. "Add column" button at end of board. Delete shows impact preview ("3 tasks will move to Unassigned").

**TaskFlow gap:** Column reorder exists. Missing: add column directly on board, inline rename (no modal), delete with impact preview.

---

### C4: Member Permissions Per Board

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Trello | Per-board member roster; roles: admin / member / observer | Clear per-board role assignment |
| Jira | Project permission schemes with role matrix (admin-managed) | Enterprise-grade, complex |
| Asana | Project roles: owner / editor / commenter / viewer | 4-tier role model per project |
| ClickUp | Guest access to specific spaces | Guest-scoped container access |
| Linear | Workspace-level roles only; no per-board | Simpler, coarser |
| Notion | Database-level access controls | Database, not view-specific |

**Winner pattern:** Per-board member list with roles (Owner / Editor / Viewer). Invite by email to board without requiring workspace access first.

**TaskFlow gap:** No board-level permissions. Add: per-board member list, role assignment, board-level invite link.

---

### C5: Board Templates

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Template marketplace (library) + custom template export | Curated + extensible |
| Monday.com | Workflow templates with automations included | High-value bundled templates |
| ClickUp | Space/List templates; apply at creation | Template applied at creation |
| Trello | Power-Up community templates | Ecosystem-sourced |
| Notion | Clone database as template | Clone-based |
| Linear | Clone project with workflows and views | Deep clone |
| Airtable | Wizard-based template selection | Use-case-driven |

**Winner pattern:** Save board as template (columns, statuses, custom fields) → built-in library (6–10 curated templates) + custom templates. Apply template to new or existing board.

**TaskFlow gap:** No board templates. Add: save-as-template action, template library (Software Sprint, Marketing Campaign, Bug Tracker, etc.), apply-template modal.

---

### C6: Export (CSV / Excel / JSON)

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| ClickUp | CSV, Excel, JSON, XML, TSV directly from List/Table views | Widest format coverage, no row limits |
| Asana | CSV export (140k row limit) | Native CSV, limited |
| Monday.com | Excel export (10k item limit) | Per-view, limited size |
| Jira | Plugin-based Excel export for reports | Plugin-dependent |
| Linear | API-only (GraphQL JSON) | Developer-facing |
| Trello | JSON via API; CSV via Power-Ups | API-primary |
| Plane | Open API + webhooks | Developer-facing |

**Winner pattern:** ClickUp: multi-format export (CSV, Excel, JSON) from board UI with no row limits. Include all task fields + custom fields in export.

**TaskFlow gap:** No export feature. Add: CSV export (tasks + all fields), Excel export with column headers, JSON full-schema export. Per-board export button in board settings.

---

### C7: Webhook Management

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| ClickUp | UI-based webhook configuration + 1000+ app marketplace | Click-to-configure; pre-built integrations |
| Linear | Webhooks in workspace settings; GitHub/Slack integrations | Workspace-level registry |
| Jira | Admin-panel webhook registry; bidirectional sync | Admin-managed |
| Asana | API webhooks + integration marketplace | API-primary |
| Plane | Open API + OAuth apps; multi-directional sync | Developer-friendly |
| Trello | API webhooks; limited UI | API-primary |

**Winner pattern:** Webhook management UI: create (URL + secret + event types), test (send sample payload), delete. Event types per board: task.created, task.moved, task.updated, task.deleted. First built-in target: Slack.

**TaskFlow gap:** No webhooks or integrations. Add: webhook management page, event type selection, test-fire button, Slack as first built-in integration.

---

### C8: Board Duplication

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Trello | Single-click board copy (lists, cards, settings) | Easiest UX |
| ClickUp | Recursive duplication: Space/List + automations + custom fields | Deep clone |
| Linear | Clone project with workflows, views, custom fields | Feature-complete clone |
| Asana | Duplicate project with full task hierarchy | Project-level duplication |
| Monday.com | Duplicate board including columns and automations | Board-level with automation carry |
| Notion | Duplicate database with all pages | Database clone |

**Winner pattern:** Duplicate board → modal with checkboxes: ✓ Columns ✓ Custom fields ✓ Members ✓ Include sample tasks. Result = private copy in same workspace.

**TaskFlow gap:** No board duplication. Add: duplicate action in board options menu, duplication modal with selective options, duplicate progress indicator.

---

### C9: Board-Level Settings Panel

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Trello | Comprehensive settings sidebar (General, Organization, Automations, Power-Ups) | Single panel, all settings visible |
| Jira | "Board Settings" modal with collapsible sections (Columns, Fields, Automations) | Modal + sections |
| Linear | Project settings side panel (team, members, workflows, visibility) | Side panel in context |
| Asana | Project settings sidebar with collapsible sections (Members, Access, Automation) | Right sidebar |
| Plane | Persistent left sidebar settings (cycles, modules, members, automations) | Persistent sidebar |
| Notion | Gear icon → properties and settings pane (top-right access) | Gear-icon pattern |

**Winner pattern:** Settings panel (slide-over or dedicated route) with sections: General (name, description, visibility) · Members (add/remove/roles) · Columns (add/rename/delete) · Customization (background, colors) · Export & Archive. Accessed via ⚙ gear icon in board header.

**TaskFlow gap:** No dedicated board settings panel. Add: board settings route or slide-over, section-tabbed layout, all C1–C8 settings consolidated here.

---

## Search & Discovery (D1–D4)

**Plan reference:** [section-03-command-palette](.ultraplan/sections/section-03-command-palette.md)

### D1: Command Palette (Ctrl+K)

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Ctrl+K universal with context-aware category grouping | Context grouping, no fuzzy |
| Notion | Cmd+K for quick-switcher (recents first); Cmd+F for page search | Dual-mode: jump vs. search |
| Jira | Cmd+K: command palette; "/" prefix for work item search | Prefix-based filtering |
| ClickUp | Cmd+K: AI Command Bar with "go" / "create" command types | AI-powered command types |
| Height | Cmd+K for navigation; "#" filters to lists only | Prefix filtering, minimal |
| GitHub | No command palette (uses search bar) | Search-bar-first |
| Asana | Ctrl+K for search (recently updated from Tab+/) | Search-first, minimal commands |
| Raycast | Cmd+Space system-level; Cmd+1-9 for favorites | Favorites + keyboard assignment |

**Winner pattern:** Jira + Height hybrid: Ctrl+K opens modal with three modes: (1) Jump to recent (shown by default), (2) Prefix-based filter (`#board` / `@user` / `>command`), (3) Free-form fuzzy search. ↑↓ to navigate, Enter to select, Esc to close.

**TaskFlow gap:** No command palette. Build Ctrl+K with recents first, prefix filters, keyboard navigation, result type grouping (Tasks / Boards / Users / Commands).

---

### D2: Global Search

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Notion | Cmd+P fullscreen modal; "Best Matches" ranking; title-first | Real-time relevance with recency bias |
| Height | Fullscreen modal with tabs: Tasks / Lists / Users + smart filters | Modal-dominant with type tabs |
| Jira | "/" opens modal; JQL-powered basic + advanced mode | Dual mode for skill levels |
| GitHub | Global search bar; type-specific tabs (Issues, PRs, Discussions) | Unified + type-tabbed |
| ClickUp | Global search + Cmd+K; filter persistence | Dual entry points |
| Asana | Cmd+K search; limited entity types | Simple, basic |
| Monday.com | Ctrl+B "Search Everything" | Different shortcut; search-only |

**Winner pattern:** Notion + Height: fullscreen modal with entity tabs (Tasks / Projects / Users), title-first relevance, recency boost, real-time results as you type.

**TaskFlow gap:** Basic search exists but lacks: recency-based ranking, result tabs by type, fullscreen modal, filter preview ("X tasks match").

---

### D3: Search Filters

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| GitHub | Query syntax: `assignee:`, `label:`, `status:`, logical operators | Filter syntax language |
| Jira | Basic UI filters + Advanced JQL syntax (two modes) | Beginner + power-user modes |
| ClickUp | Filter panel + "Apply → show match count" pattern | Real-time feedback + count preview |
| Height | Smart filters + bulk operations on filtered results | Filter-to-action flow |
| Asana | Basic sidebar filters; limited advanced options | UI-driven, limited |
| Notion | Sort options only (not faceted filtering) | Minimal filtering |

**Winner pattern:** GitHub filter syntax (`assignee:alice label:urgent`) for power users + ClickUp's real-time count preview ("42 tasks match") before applying + Height's bulk-select-on-filter (select all filtered → bulk update).

**TaskFlow gap:** Basic filters exist. Missing: filter syntax language, real-time match count preview, filter persistence (save filter sets), bulk operations on filtered results.

---

### D4: Recent Items / Quick-Jump

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Notion | Cmd+K shows recently viewed first; implicit tracking | Recency-first, no explicit pinning |
| Jira | "Recent Issues" sidebar section + in Cmd+K | Persistent sidebar + command palette |
| Raycast | Cmd+1-9 hotkeys for favorites | Explicit shortcut for top 9 items |
| GitHub | Recent repos/issues in search dropdown + sidebar | Implicit tracking, multiple entry points |
| ClickUp | Recent searches (not items) navigable with < > | Reuses searches, not accessed items |
| Height | Not documented | Gap identified |

**Winner pattern:** Notion (Cmd+K shows recents by default) + Jira (persistent "Recent Tasks" sidebar section) + Raycast (explicit Cmd+1–9 for pinned favorites).

**TaskFlow gap:** No recent items. Add: sidebar "Recent" section (last 5–8 tasks/boards), Cmd+K shows recents first, favoriting/pinning mechanism, auto-track on task open/edit.

---

## Performance (E1–E3)

> Full plans:
> - [section-05-list-performance](.ultraplan/sections/section-05-list-performance.md)
> - [performance-optimization](.claude/plans/performance-optimization.md)
> - `plans2/plan-7.md`

### E1: Virtual Scrolling / List Performance

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | CDK Virtual Scroll in list views; `ChangeDetectionStrategy.OnPush` throughout | Only render visible rows; push-only change detection |
| Jira | Backlog virtual scroll; JQL index for filter performance | Server-side filtering + virtual scroll |
| Notion | Incremental load (load more); table view uses virtualization | Load-on-scroll, not full virtual DOM |
| ClickUp | Pagination + "load more"; server-side filtering | Paginated with client-side caching |
| GitHub | Paginated lists (25/50/100 items) | Server pagination, no client virtual scroll |

**Winner pattern:** `@angular/cdk/scrolling` CdkVirtualScrollViewport for task lists >100 items. `OnPush` everywhere. Computed signals for filtered/sorted data (no intermediate observables).

**TaskFlow gap:** Referenced in existing performance plan. Key gaps: no virtual scroll on large task lists, missing OnPush on some components.

---

### E2: Optimistic Updates

**Winner pattern:** See F2 (Real-Time Collaboration). Kanban card moves should be instant client-side; server confirmation in background; rollback on error with toast notification.

---

### E3: Bundle Size / Load Time

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Route-level code splitting; prefetch on hover | Lazy modules + hover prefetch |
| Notion | Chunked bundles; deferred loading of rarely-used features | Defer heavy features |
| Vite/Angular | Lazy routes, esbuild, tree-shaking | Framework-standard optimizations |

**Winner pattern:** Angular 19 lazy routes (already configured), deferred loading for heavy features (board settings, export, webhooks), `@defer` blocks for below-the-fold content.

**TaskFlow gap:** Referenced in existing performance plan. Key gap: `@defer` not yet used for below-fold content, some heavy PrimeNG modules not tree-shaken.

---

## Real-Time Collaboration (F1–F3)

**Plan reference:** [section-06-presence-collaboration](.ultraplan/sections/section-06-presence-collaboration.md)

### F1: Presence Indicators

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Figma | Multi-cursor: live colored cursors with name labels; avatar stack in top bar; "Follow Mode" | Live cursor + label + follow mode |
| Notion | WebSocket live cursors with profile photos; colored per user (<500ms sync) | Colored cursors + presence list |
| Google Docs | Cursor badges with user colors; avatar stack top-right | Named cursor badges |
| Jira | Avatar stack on board; highlights card being edited; cell outline per editor | Editing state per card, no cursors |
| ClickUp | Live cursor display for active users; real-time sync | Live cursor + auto-save 1.5s |
| Height | Live cursors on same page (H2.0 multiplayer) | Cursor tracking per page |
| Linear | Online status icons next to user names | Status icons, no cursors |

**Winner pattern:** Figma's avatar stack (max 5 + counter) in top bar + Jira's "editing" outline on the task card being edited. For TaskFlow (board-level): avatar stack showing who's on this board, highlight ring on card being dragged/edited by another user.

**TaskFlow gap:** No presence indicators. Add: WebSocket-based presence; avatar stack in board header; card highlight when another user is dragging/editing it.

---

### F2: Optimistic UI Updates

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Google Docs | OT: immediate keystroke echo; 50ms burst grouping; server resolves ordering | Zero-latency feedback; server corrects retroactively |
| Notion | No locks; immediate view of edits; WebSocket pushes within 500ms | Zero-lock concurrent editing |
| ClickUp | Immediate visual feedback; auto-save 1.5s after typing stops | Immediate + background save |
| Figma | Instant canvas update; server corrects if conflict; multi-user undo stack | Client-side preview before server ack |
| Jira | Blocking: only one user edits a field at a time | Prevents concurrency via lock |
| Monday.com | Instant drag-drop; live widget sync | Immediate visual, event-bus ordering |

**Winner pattern:** Google Docs + Notion hybrid: immediate client-side optimistic move → server confirms → rollback with undo-style notification if rejected. No blocking locks. Show "Saving..." / "Saved" indicators.

**TaskFlow gap:** Board state service has `boardState` signal with optimistic update + rollback pattern at `:256`. Gap: status changes and task edits outside drag-drop don't use optimistic pattern yet.

---

### F3: Conflict Resolution

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Google Docs | Operational Transformation (OT); character-level merge; server assigns sequence | Perfect for text fields |
| Notion | Last-Write-Wins (LWW) with timestamps; block-level locking for large edits | Simple, predictable for structured data |
| Figma | Server coordinates via version vectors; client-side preview; per-user undo stack | Object-level CRDT-like |
| ClickUp | Last-save-wins (implicit); no conflict UI shown | Silent override |
| Jira | Blocking: deny concurrent edits on same field | No conflict possible (prevents concurrency) |
| Height | Server timestamp ordering | Timestamp-based LWW |

**Winner pattern:** OT for text fields (description, comments) + LWW for discrete fields (status, assignee, priority). On conflict: toast notification "Status changed by X (4s ago) while you edited — your change was applied." Two strategies, two field types.

**TaskFlow gap:** No conflict detection. Add: per-field strategy (text → OT, enum → LWW + notification), conflict toast, "what changed while you were editing" summary.

---

## Notifications & Feedback (G1–G3)

**Plan reference:** [section-07-push-notifications](.ultraplan/sections/section-07-push-notifications.md)

### G1: In-App Notification Center

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Inbox groups similar events; collapses old activity; "Pulse" feed for cross-workspace | Smart grouping + digest |
| Asana | Two-pane inbox: list (left) + context detail (right); filters by person/type/unread | Two-pane + rich filters |
| ClickUp | Date-grouped + source-grouped; "Important" vs "Other" tabs | Dual importance categorization |
| Notion | Thread-grouped updates; @mentions, replies, reminders | Conversation-thread grouping |
| Jira | Notifications tab; role-based filtering; marketplace extensibility | Role-aware filters |
| Monday.com | Bell dropdown + "Update Feed" news-feed for subscribed boards | Separate bell + activity feed |
| GitHub | Inbox with read/unread; filter by repo/type; archive/snooze/mute | Inbox Zero model |

**Winner pattern:** Linear's smart grouping + Asana's two-pane layout. Collapse consecutive activity from same source; show preview + full context on expand. Filters: person / type / read status. Actions: archive / snooze / mark read.

**TaskFlow gap:** No notification center. Add: bell icon with unread badge, grouped notification list, two-pane layout (preview + detail), filters, archive/snooze actions.

---

### G2: Web Push Notifications

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Browser push opt-in; per-user configurable | User preference-driven |
| ClickUp | Browser + desktop push; multi-channel strategy | Unified channel approach |
| GitHub | Web push for repo activity; standard Notification API | Standard browser API |
| Browser Standard | `Notification.requestPermission()` on user gesture only; double opt-in: custom UI → browser dialog | Custom pre-permission UI required |
| Linear | Web push for Inbox (implied) | Standard approach |
| Notion | Mobile-first; limited web push | Mobile-primary |

**Winner pattern:** Double opt-in: custom "Enable notifications for real-time task updates" prompt → on Enable click → `Notification.requestPermission()`. Handle denied gracefully (show "enable in browser settings" guide). Push only high-priority events (assignments, @mentions, due today).

**TaskFlow gap:** No web push. Add: custom pre-permission UI with value explanation, permission flow, do-not-disturb time windows, push only for high-priority events.

---

### G3: Notification Preferences

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Per-type toggles × channels × frequency matrix | Fine-grained type + channel + frequency |
| Slack | Per-channel: All / Mentions only / Mute; keyword alerts | Granular per-source |
| ClickUp | Important vs Other tabs; time-of-day scheduling | Dual-importance + scheduling |
| Linear | Pulse daily/weekly digest | Digest frequency choice |
| Notion | Per-type on/off toggles | Simple toggle per type |
| Jira | Admin-controlled + user email prefs | Limited user control |
| GitHub | Per-repo watch settings; digest for security | Context-scoped prefs |

**Winner pattern:** Asana's matrix: notification types × delivery channels × frequency. Add per-board overrides and quiet hours. Types: assigned / mentioned / comment / status change / due today. Channels: in-app / email / push. Frequency: real-time / daily digest / weekly.

**TaskFlow gap:** No notification preferences. Add: global preferences page with type × channel × frequency matrix, per-board overrides, quiet hours (start/end time), @mention specificity.

---

## Onboarding & Feature Discovery (H1–H5)

**Plan reference:** [section-08-feature-discovery](.ultraplan/sections/section-08-feature-discovery.md)

### H1: Empty State Design

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Notion | Empty state doubles as demo checklist — educational + functional | Removes blank-page anxiety |
| Airtable | Eliminate empty states via pre-populated templates | Zero blank states by design |
| Asana | Personality copy + "Start building in 2 minutes" | Action-framed copy |
| ClickUp | Template suggestions on empty workspace | Prevents blank canvas |
| Trello | Welcome Board pre-loaded with demo data | Product in action on day 1 |
| Linear | Monochrome illustration + focused CTA | Minimal, inline with brand |
| Figma | Minimal canvas + sample projects in sidebar | Trusts user, provides examples |

**Winner pattern:** Notion's double-duty: empty state is a demo checklist users interact with to learn. OR Airtable's: never show blank — auto-populate with sample data. Both cut time-to-value by 40%+.

**TaskFlow gap:** Blank kanban columns with no context. Add: illustrated empty state per column ("No tasks yet — drag here or press N to create"), or pre-seeded demo board.

---

### H2: Sample Data on Signup

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Personalized dashboard from signup survey (role/use case) | Use-case-driven personalization |
| Airtable | Wizard: choose use case → template loads + data import | Async wizard, realistic demo data |
| Trello | Welcome Board auto-generated | Pre-filled on day 1 |
| Monday.com | Template library on first workspace creation | Template on creation |
| Linear | Sample project with issue templates (legacy) | Pre-built issues |
| Notion | Template recommendations during signup wizard | User selects use case |
| Figma | Sample files in sidebar | Discoverable, optional |

**Winner pattern:** Asana's "What are you building?" signup question → maps to sample board with 5–10 realistic demo tasks. Include "Delete this sample project" CTA prominently.

**TaskFlow gap:** No signup template flow. Add: 1-question signup step (Software team / Marketing team / Personal) → auto-seeded sample board.

---

### H3: Onboarding Checklist

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Monday.com | Dismissible action cards on dashboard; includes config + collaboration steps | Sticky until completed, dismissible |
| Notion | Checklist embedded in demo content (completing it = learning the product) | Checklist IS the demo |
| Asana | "Complete these 8 tasks" action-driven flow | Action-not-modal |
| Slack | Running checklist in sidebar; progressive setup | Progressive: sidebar tips |
| Airtable | Micro-tasks + 14-day followup email sequence | Nurture sequence |
| Linear | Minimal; relies on UI discovery | No explicit checklist |

**Winner pattern:** Monday.com's dismissible side-panel checklist with 4–6 high-impact actions: Create first task → Invite teammate → Set a deadline → Try drag-reorder → Explore keyboard shortcuts → Mark a task done. Progress bar. Re-openable after dismiss.

**TaskFlow gap:** No onboarding checklist. Add: sticky side-panel "Getting Started" with 5 steps, progress bar, dismiss + re-open toggle, skip-tutorial option.

---

### H4: Product Tours / Contextual Tooltips

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Empty states act as tooltips (on-page, not modal) | Non-blocking in-context teaching |
| Airtable | Short 30–60s microvideos per feature | Context-aware video snippets |
| Figma | Hover tooltips + optional help sidebar (always-on) | Non-blocking, always accessible |
| Slack | Contextual onboarding messages baked into channels | Contextual messages in flow |
| Notion | Slash-command discovery via demo checklist | Progressive disclosure |
| Monday.com | Action card tooltips + "Learn more" links | Workflow-integrated |

**Winner pattern:** Asana pattern: no modal tours. Instead: (1) empty-state micro-copy as contextual teaching moments, (2) hover tooltips with shortcut hint on advanced features, (3) optional microvideos (30–60s GIFs) behind ? icons, (4) first-run-only contextual overlays. Completion rate 3× higher than Shepherd-style linear tours.

**TaskFlow gap:** Basic tooltips only. Add: empty-state micro-copy, ? icons on advanced features, first-run contextual overlays for drag-reorder / filters / keyboard shortcuts.

---

### H5: Keyboard Shortcut Discovery Modal

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Figma | ? key → interactive shortcuts panel showing recently used shortcuts in blue | Interactive + usage-tracking |
| Linear | Keyboard shortcuts help feature (panel, ? key) | Panel-based |
| Gmail / GitHub | ? key → multi-column modal list, ESC to close | Classic pattern |
| Trello | ? key → shortcuts reference page | Standard list |
| Slack | Cmd+K command palette + help search | Search-first |
| Notion | Full shortcuts docs + Cmd/Ctrl reference | Comprehensive docs |

**Winner pattern:** Figma's interactive panel + command palette. ? key → panel with categorized shortcuts, recently used highlighted. Cmd+K also shows shortcut hints per result. Lazy-load obscure shortcuts.

**TaskFlow gap:** No keyboard shortcut discovery. Add: ? key shortcut modal with categories (Board / Tasks / Navigation / Global), shortcut hints on hover for UI elements, command palette shows keyboard shortcut for each action.

---

## Visual Polish (I1–I5)

**Plan reference:** [section-09-visual-polish](.ultraplan/sections/section-09-visual-polish.md)

### I1: Micro-Animations

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Spring physics: stiffness=100, damping=10, mass=1; cubic-bezier for timing | Tunable spring, sensible defaults |
| Framer Motion | Physics spring via stiffness/damping/mass + velocity incorporation | Velocity-aware natural motion |
| Figma | Smart Animate: matches layers by name, applies transitions to changed properties | Automatic motion from design intent |
| ClickUp | Drag feedback: shadows, scale transforms, drop zone highlights, release animation | Contextual interaction feedback |
| Monday.com | All interactions under 1s; 200–500ms micro-transitions standard | Performance-first, clear feedback |
| Notion | Spring timing with velocity-awareness and gesture continuation | Gesture-continuation physics |
| Height | Animations + audio + visual refinement (cohesive system) | Holistic: motion + sound |

**Winner pattern:** Spring physics (stiffness=100, damping=10) for drag feedback on kanban cards. Scale 1.02 + shadow on drag lift. Ease-out on drop settlement. Inertial scroll momentum on release. Optional: Asana-style celebration creatures.

**TaskFlow gap:** Basic CSS transitions. Missing: spring physics on card drag, scale/shadow feedback during drag, ease-out on drop, subtle hover transitions (card lift on hover).

---

### I2: Skeleton Screens

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| LinkedIn | Content-shape matching + shimmer gradient animation | Skeleton mirrors final layout |
| YouTube | Pulse/shimmer at 1.5–2s cycle; gentle, slow | Slow pulse prevents annoyance |
| Facebook | Shape-matching for photos, comments, list items | Reduces cognitive load |
| Material UI | `<Skeleton>` component; pulse or wave variants; theme-aware | Framework component |
| NN/G | Only for loads >1s; skip for video/file uploads (use progress bar) | Context-aware usage |

**Winner pattern:** CSS-only shimmer gradient (`linear-gradient` + `background-position` animation) for task card skeletons matching card shape (rounded rectangle + 2 text lines + avatar circle). Show only for loads >500ms.

**TaskFlow gap:** No skeleton screens. Add: task card skeleton component, column skeleton, board loading skeleton. CSS shimmer via `@keyframes`. Show only when load >500ms (delay class).

---

### I3: Celebration Animations

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Asana | Random celebration creatures (unicorn, yeti, narwhal, phoenix) fly across; optional setting | Optional, variety prevents fatigue |
| ClickUp | Confetti on inbox zero, goal completion, notification clear | Milestone-based, not per-task |
| Height | Cohesive animation + sound design | Holistic celebration system |
| Lottie | dotLottie JSON animations; 600% smaller than GIF; scales infinitely | Performance-first animation delivery |
| GitHub | Community: confetti on PR merge, milestone | Contextual meaningful moments |

**Winner pattern:** Optional confetti (user can disable) on "task marked done" + optional creature fly-by on "board completed". Use dotLottie format for performance. Throttle: max 1 per 5 seconds. Only primary actions trigger (not comments, assignments).

**TaskFlow gap:** No celebrations. Add: optional confetti on task completion via @ngxs/lottie or CSS confetti, per-user setting to enable/disable, throttle logic.

---

### I4: Dark Mode Quality

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | LCH color space (perceptually uniform); 3 CSS variables per theme: base / accent / contrast | Minimal variables, automated high-contrast |
| Notion | Semantic tokens referencing base tokens; `prefers-color-scheme` + CSS variables | Semantic layer, dual token sets |
| Figma | 3-tier token system: base colors → semantic tokens → component variants | Design-to-code consistency |
| Carbon Design System | Semantic tokens for fg/bg/interactive; component-level color mapping | IBM standard, comprehensive |
| Anti-pattern | `filter: invert(1)` — breaks brand colors, icon intent, contrast | Never invert — use tokens |

**Winner pattern:** Semantic token layer: `--color-surface` / `--color-on-surface` / `--color-primary` / `--color-on-primary`. Separate light and dark value sets. LCH color space for perceptual uniformity. Automated high-contrast variant for accessibility.

**TaskFlow gap:** Basic CSS dark mode with limited contrast tuning. Add: semantic token layer (50+ variables), LCH-aware palette, automated WCAG contrast validation, Figma token sync.

---

### I5: CSS Transitions & Page Transitions

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Angular 17+ | `withViewTransitions()` in router; `::view-transition-old/new` pseudo-elements | Native browser View Transitions API |
| Framer Motion | `motion.div` + `layoutId` for shared-element transitions; stagger children | Declarative spring + stagger |
| Linear | Smooth route transitions with spring easing; slide-in side panels | Continuous, momentum-preserving |
| Monday.com | Visual progress during navigation; transitions <1s | Performance-first transitions |
| Best practice | 200–500ms for micro-transitions; respect `prefers-reduced-motion`; define in global CSS | Accessible, consistent |

**Winner pattern:** Angular's `withViewTransitions()` for route-level fade-through + custom `::view-transition` overrides for slide-in panels. Define all timing constants in `:root` CSS variables. Respect `@media (prefers-reduced-motion: reduce)`.

**TaskFlow gap:** Basic route fade only. Add: `withViewTransitions()` if not already enabled, `prefers-reduced-motion` guard, panel slide-in animation for task-detail sidebar, staggered list-item reveals on board load.

---

*Last updated: 2026-03-02 — Covers features A1–I5 (19 feature groups, 44 sub-features)*
