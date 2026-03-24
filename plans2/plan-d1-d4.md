# Plan: D1-D4 Search & Discovery

> Generated: 2026-03-02 | Stack: Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19, Rust 1.93, Axum 0.8, SQLx 0.8, PostgreSQL 16

---

## Requirements

### D1: Command Palette (Ctrl+K)
Universal command palette accessible via Ctrl+K / Cmd+K from any page. Three modes:
1. **Default** (empty query) -- show recent items (boards + tasks)
2. **Search** (type text) -- fuzzy search across tasks, boards, comments
3. **Commands** (type `>`) -- list of executable actions (navigate, create, toggle)
4. **Prefix filters** -- `#board`, `@user`, `>command` to narrow result type

Keyboard navigation: Up/Down to highlight, Enter to select, Esc to close. Auto-filtering built in.

### D2: Global Search
Full-text search across tasks, boards, and comments with:
- Debounced API calls (200ms)
- Result grouping by entity type (Tasks / Boards / Comments)
- Recency boost in ranking
- Result count display ("12 tasks, 3 boards")
- Highlighted matching text in results

### D3: Search Filters
Filter syntax for power users inside the command palette:
- `assignee:alice` -- filter tasks by assignee name
- `label:urgent` -- filter tasks by label
- `status:done` -- filter tasks by column/status
- `board:marketing` -- scope search to specific board
- Filter chips displayed below search input when active
- Real-time match count preview

### D4: Recent Items / Quick-Jump
- **Sidebar "Recent" section** -- already exists for boards (localStorage)
- **Extend to tasks** -- track recently viewed tasks (localStorage + optional server-side)
- **Command palette default view** -- show recent boards + recent tasks when opened with empty query
- **Server-side recent items** -- persist cross-device via `recent_items` table

### Out of Scope (with reason)
| Feature | Reason |
|---------|--------|
| Saved filter presets (persistent filter sets) | Phase 3 complexity; filter syntax + chips sufficient for MVP |
| Bulk operations on search results | Depends on multi-select infrastructure not yet built |
| Full-text highlight with `<mark>` tags | Requires backend `ts_headline()` integration; defer to Phase 3 |
| Raycast-style Cmd+1-9 favorites | Sidebar favorites already serve this purpose |

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

**D1:** Jira + Height hybrid: Ctrl+K opens modal with three modes: (1) Jump to recent (shown by default), (2) Prefix-based filter (`#board` / `@user` / `>command`), (3) Free-form fuzzy search. Arrow keys to navigate, Enter to select, Esc to close.

**D2:** Notion + Height: fullscreen modal with entity tabs (Tasks / Projects / Users), title-first relevance, recency boost, real-time results as you type.

**D3:** GitHub filter syntax (`assignee:alice label:urgent`) for power users + ClickUp's real-time count preview ("42 tasks match").

**D4:** Notion (Cmd+K shows recents by default) + Jira (persistent "Recent Tasks" sidebar section).

### Single Most Important Gap
**No keyboard navigation in the command palette.** The existing GlobalSearchComponent has no Up/Down/Enter keyboard nav, making it mouse-only. This is the most critical UX gap vs competitors like Linear/Jira/Notion where the entire flow is keyboard-driven.

---

## What Already Exists

### Files That Partially Implement D1-D4

| File | What Exists | What Changes |
|------|-------------|-------------|
| `frontend/src/app/shared/components/global-search/global-search.component.ts` (745 lines) | Ctrl+K modal, search input, debounced API search, command mode (`>`), recent searches (localStorage), result grouping (Tasks/Boards/Comments), navigation on click | **REPLACE** with @ngxpert/cmdk-based command palette. Reuse all business logic (search API call, navigation methods, action definitions). |
| `frontend/src/app/core/services/search.service.ts` (49 lines) | `SearchService.search(query, limit)` calling `GET /api/search` | **EXTEND** with new methods: `searchWithFilters()`, count support |
| `backend/crates/api/src/routes/search.rs` (53 lines) | `GET /api/search?q=&limit=` handler | **EXTEND** with filter params (assignee, label, status, board) |
| `backend/crates/db/src/queries/search.rs` (123 lines) | `search_all()` -- full-text search on tasks (tsvector), ILIKE on boards/comments | **EXTEND** with filter WHERE clauses, recency boost, result counts |
| `frontend/src/app/shared/components/sidebar/sidebar-recent.component.ts` (234 lines) | Recent boards tracked via localStorage on navigation | **KEEP** as-is. Command palette reads from same localStorage key. |
| `frontend/src/app/app.component.ts` (210 lines) | `Ctrl+K` HostListener opens search, `searchOpen` signal | **MODIFY** minor: connect to new command palette component |
| `frontend/src/app/app.component.html` (65 lines) | `<app-global-search>` tag | **MODIFY** replace with `<app-command-palette>` |
| `frontend/src/app/core/services/keyboard-shortcuts.service.ts` (179 lines) | Keyboard shortcut framework | **KEEP** as-is. Command palette pushDisable when open. |
| `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | Search trigger button emitting `searchOpen` | **KEEP** as-is. Already emits the right event. |

### What Needs to Be Built From Scratch

| Component | Reason |
|-----------|--------|
| `command-palette.component.ts` | New component using @ngxpert/cmdk for structured command menu |
| `command-palette.service.ts` | Service to aggregate searchable items, manage recent items, parse filter syntax |
| `recent-items.service.ts` | Service to track + retrieve recent items (localStorage + optional API) |
| Backend: `recent_items` table + API | Server-side persistence of recently viewed items |
| Backend: filtered search endpoint | Extended search with filter params |

---

## Backend Changes

### SQL Migration 1: `recent_items` table

**File:** `backend/crates/db/src/migrations/20260304000001_recent_items.sql`

```sql
-- Recent items table for tracking user's recently viewed entities
CREATE TABLE IF NOT EXISTS recent_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'board')),
    entity_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE INDEX idx_recent_items_user ON recent_items(user_id, viewed_at DESC);
CREATE INDEX idx_recent_items_tenant ON recent_items(tenant_id);
```

### SQL Migration 2: Search improvements

**File:** `backend/crates/db/src/migrations/20260304000002_search_improvements.sql`

```sql
-- Add tsvector to boards for full-text search (tasks already have it)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing boards
UPDATE boards SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
WHERE search_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_boards_search ON boards USING GIN(search_vector);

-- Trigger to keep boards search_vector up to date
CREATE OR REPLACE FUNCTION boards_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_search_vector_trigger
    BEFORE INSERT OR UPDATE OF name, description ON boards
    FOR EACH ROW EXECUTE FUNCTION boards_search_vector_update();

-- Composite index for filtered task search
CREATE INDEX IF NOT EXISTS idx_tasks_board_id_deleted ON tasks(board_id, deleted_at) WHERE deleted_at IS NULL;
```

### New API Routes

**File:** `backend/crates/api/src/routes/recent_items.rs` (CREATE)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/recent-items` | List user's recent items (last 10, with entity names resolved) |
| `POST` | `/api/recent-items` | Record a view event (upsert on user+entity_type+entity_id) |

**File:** `backend/crates/api/src/routes/search.rs` (MODIFY)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search` | **Extended** with optional query params: `assignee`, `label`, `status`, `board_id`; response adds `counts: { tasks, boards, comments }` |

### New DB Queries

**File:** `backend/crates/db/src/queries/recent_items.rs` (CREATE)

- `list_recent_items(pool, user_id, tenant_id, limit)` -- returns recent items with entity names
- `upsert_recent_item(pool, user_id, tenant_id, entity_type, entity_id)` -- insert or update viewed_at

**File:** `backend/crates/db/src/queries/search.rs` (MODIFY)

- `search_all()` -- add optional filter params (assignee_name, label_name, status_name, board_id)
- Add `SearchResultCounts` struct to response
- Add recency boost to task ranking: `ORDER BY ts_rank(...) * (1.0 + 0.2 * (1.0 / (EXTRACT(EPOCH FROM (now() - t.updated_at)) / 86400 + 1)))`

### Backend Model Changes

**File:** `backend/crates/db/src/models/mod.rs` (MODIFY) -- add `recent_items` module
**File:** `backend/crates/db/src/queries/mod.rs` (MODIFY) -- add `pub mod recent_items;`

---

## Frontend Changes

### Install Dependencies

```bash
cd /home/ankur/taskflow/frontend
npm install @ngxpert/cmdk @ngneat/overview@6 @ngneat/until-destroy@10
```

> Note: `@angular/cdk` is already installed (v19.2.19). `@ngneat/overview` and `@ngneat/until-destroy` are peer dependencies of `@ngxpert/cmdk`.

### New Components

#### 1. `command-palette.component.ts`

**Path:** `frontend/src/app/shared/components/command-palette/command-palette.component.ts`
**Selector:** `app-command-palette`

Replaces `GlobalSearchComponent`. Uses `@ngxpert/cmdk` for structured command menu with auto-filtering and keyboard navigation.

**Template sketch:**
```html
@if (isOpen()) {
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
       (click)="close()" (keydown.escape)="close()">
    <div class="w-full max-w-2xl bg-[var(--card)] rounded-xl shadow-2xl border border-[var(--border)] overflow-hidden"
         (click)="$event.stopPropagation()">
      <cmdk-command [label]="'Command Palette'">
        <!-- Search Input -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <i class="pi pi-search text-gray-400"></i>
          <input cmdkInput
                 [(ngModel)]="query"
                 placeholder="Search tasks, boards... (> for commands)"
                 class="flex-1 bg-transparent border-none outline-none text-lg" />
          <kbd class="text-xs px-2 py-0.5 rounded bg-[var(--secondary)]">ESC</kbd>
        </div>

        <!-- Results -->
        <cmdk-list class="max-h-[60vh] overflow-y-auto">
          <div *cmdkEmpty class="py-12 text-center text-[var(--muted-foreground)]">
            No results found
          </div>

          <!-- Recent Items (shown when query is empty) -->
          @if (!query()) {
            <cmdk-group label="Recent">
              @for (item of recentItems(); track item.id) {
                <button cmdkItem [value]="item.searchValue" (selected)="onItemSelect(item)">
                  <i [class]="item.icon"></i>
                  <span>{{ item.name }}</span>
                  <span class="text-xs text-[var(--muted-foreground)]">{{ item.context }}</span>
                </button>
              }
            </cmdk-group>
          }

          <!-- Actions (shown in > command mode or when matching) -->
          <cmdk-group label="Actions">
            @for (action of actions(); track action.id) {
              <button cmdkItem [value]="action.searchValue" (selected)="executeAction(action)">
                <i [class]="action.icon"></i>
                <span>{{ action.label }}</span>
                @if (action.shortcut) {
                  <kbd>{{ action.shortcut }}</kbd>
                }
              </button>
            }
          </cmdk-group>

          <!-- Task Results -->
          @if (taskResults().length > 0) {
            <cmdk-group [label]="'Tasks (' + taskResults().length + ')'">
              @for (task of taskResults(); track task.id) {
                <button cmdkItem [value]="task.title" (selected)="navigateToTask(task)">
                  <i class="pi pi-check-square text-primary"></i>
                  <div>
                    <div>{{ task.title }}</div>
                    <div class="text-xs text-[var(--muted-foreground)]">
                      {{ task.workspace_name }} > {{ task.board_name }}
                    </div>
                  </div>
                </button>
              }
            </cmdk-group>
          }

          <!-- Board Results -->
          @if (boardResults().length > 0) {
            <cmdk-group [label]="'Boards (' + boardResults().length + ')'">
              @for (board of boardResults(); track board.id) {
                <button cmdkItem [value]="board.name" (selected)="navigateToBoard(board)">
                  <i class="pi pi-table text-emerald-500"></i>
                  <div>
                    <div>{{ board.name }}</div>
                    <div class="text-xs text-[var(--muted-foreground)]">{{ board.workspace_name }}</div>
                  </div>
                </button>
              }
            </cmdk-group>
          }

          <!-- Comment Results -->
          @if (commentResults().length > 0) {
            <cmdk-group [label]="'Comments (' + commentResults().length + ')'">
              @for (comment of commentResults(); track comment.id) {
                <button cmdkItem [value]="comment.content" (selected)="navigateToComment(comment)">
                  <i class="pi pi-comment text-amber-500"></i>
                  <div>
                    <div class="truncate">{{ comment.content }}</div>
                    <div class="text-xs text-[var(--muted-foreground)]">
                      on {{ comment.task_title }}
                    </div>
                  </div>
                </button>
              }
            </cmdk-group>
          }
        </cmdk-list>

        <!-- Footer -->
        <div class="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] text-xs text-gray-400">
          <span><kbd>Up/Down</kbd> navigate</span>
          <span><kbd>Enter</kbd> select</span>
          <span><kbd>></kbd> commands</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </cmdk-command>
    </div>
  </div>
}
```

**Signal architecture:**
```typescript
// Inputs
isOpen = input(false);
closed = output<void>();

// Internal state
query = signal('');
loading = signal(false);
activeFilterChips = signal<FilterChip[]>([]);

// Computed
isCommandMode = computed(() => this.query().startsWith('>'));
parsedFilters = computed(() => parseFilterSyntax(this.query()));

// Search results from API (populated by effect + debounce)
taskResults = signal<TaskSearchResult[]>([]);
boardResults = signal<BoardSearchResult[]>([]);
commentResults = signal<CommentSearchResult[]>([]);

// Recent items (merged from localStorage boards + tasks)
recentItems = signal<RecentItem[]>([]);

// Actions list
actions = signal<CommandAction[]>([...]);
```

#### 2. `command-palette.service.ts`

**Path:** `frontend/src/app/core/services/command-palette.service.ts`

Responsibilities:
- Aggregate searchable data sources (boards from workspace, tasks from API, actions)
- Parse filter syntax from query string (`assignee:X`, `label:Y`, etc.)
- Manage recent items (read from localStorage + API, write on navigation)
- Debounced search with filter params

**Key methods:**
```typescript
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private searchService = inject(SearchService);
  private recentItemsService = inject(RecentItemsService);

  // Parse "assignee:alice label:urgent some text" into structured filters
  parseQuery(raw: string): ParsedQuery { ... }

  // Search with parsed filters
  search(parsed: ParsedQuery): Observable<SearchResults> { ... }

  // Get recent items (merged localStorage + API)
  getRecentItems(): RecentItem[] { ... }

  // Record item view
  recordView(entityType: 'task' | 'board', entityId: string): void { ... }
}
```

#### 3. `recent-items.service.ts`

**Path:** `frontend/src/app/core/services/recent-items.service.ts`

Tracks recently viewed items (tasks + boards) in both localStorage and server API.

```typescript
@Injectable({ providedIn: 'root' })
export class RecentItemsService {
  private readonly STORAGE_KEY = 'taskbolt_recent_items';
  private readonly MAX_ITEMS = 10;

  recentItems = signal<RecentItem[]>([]);

  // Record a view (both localStorage and API)
  recordView(item: RecentItem): void { ... }

  // Load from localStorage (instant) + API (async merge)
  loadRecent(): void { ... }

  // Get items for command palette default view
  getForPalette(): RecentItem[] { ... }
}
```

### Modified Components

#### `app.component.html`

**Change:** Replace `<app-global-search>` with `<app-command-palette>`

```html
<!-- Before -->
<app-global-search [isOpen]="searchOpen()" (closed)="closeSearch()" />

<!-- After -->
<app-command-palette [isOpen]="searchOpen()" (closed)="closeSearch()" />
```

#### `app.component.ts`

**Change:** Update import from `GlobalSearchComponent` to `CommandPaletteComponent`

#### `search.service.ts`

**Change:** Add `searchWithFilters()` method and `SearchResultsWithCounts` type

```typescript
export interface SearchResultCounts {
  tasks: number;
  boards: number;
  comments: number;
}

export interface SearchResultsWithCounts extends SearchResults {
  counts: SearchResultCounts;
}

export interface SearchFilters {
  assignee?: string;
  label?: string;
  status?: string;
  board_id?: string;
}

// New method
searchWithFilters(query: string, filters?: SearchFilters, limit?: number): Observable<SearchResultsWithCounts> {
  let params = new HttpParams().set('q', query).set('limit', (limit ?? 20).toString());
  if (filters?.assignee) params = params.set('assignee', filters.assignee);
  if (filters?.label) params = params.set('label', filters.label);
  if (filters?.status) params = params.set('status', filters.status);
  if (filters?.board_id) params = params.set('board_id', filters.board_id);
  return this.http.get<SearchResultsWithCounts>(`${this.apiUrl}/search`, { params });
}
```

#### `sidebar-recent.component.ts`

**Change:** Extend to also track recent tasks (not just boards). Share the same localStorage store with `RecentItemsService`.

---

## Phased Implementation

### Phase 1: Frontend-Only (No Backend Changes)

**Goal:** Replace GlobalSearchComponent with @ngxpert/cmdk-based command palette. Add keyboard navigation, recent items, expanded actions. All data from existing APIs + localStorage.

| Task | Description | Files |
|------|-------------|-------|
| P1.1 | Install `@ngxpert/cmdk` + peer deps | `package.json` |
| P1.2 | Create `CommandPaletteComponent` with @ngxpert/cmdk | `command-palette/command-palette.component.ts` (NEW) |
| P1.3 | Wire Ctrl+K to new component, replace GlobalSearch in app.component | `app.component.ts`, `app.component.html` |
| P1.4 | Add recent items (boards from localStorage, same key as sidebar-recent) | `command-palette.component.ts` |
| P1.5 | Add recent tasks tracking via localStorage | `recent-items.service.ts` (NEW) |
| P1.6 | Expand actions list (10+ commands) | `command-palette.component.ts` |
| P1.7 | Add filter prefix parsing (`>commands`, `#boards`, `@users`) | `command-palette.service.ts` (NEW) |
| P1.8 | Style with Tailwind to match existing UI theme | `command-palette.component.ts` |
| P1.9 | Integrate with KeyboardShortcutsService (pushDisable on open) | `command-palette.component.ts` |
| P1.10 | Record task views from task-detail-page navigation | `task-detail-page.component.ts` (MODIFY) |

**Estimated effort:** 3-4 hours

### Phase 2: Backend Additions (Migrations + Simple Endpoints)

**Goal:** Server-side recent items, enhanced search with filters and recency ranking.

| Task | Description | Files |
|------|-------------|-------|
| P2.1 | Create `recent_items` migration | `20260304000001_recent_items.sql` (NEW) |
| P2.2 | Create search improvements migration (board tsvector) | `20260304000002_search_improvements.sql` (NEW) |
| P2.3 | Create `recent_items.rs` DB queries | `backend/crates/db/src/queries/recent_items.rs` (NEW) |
| P2.4 | Create `recent_items.rs` API route | `backend/crates/api/src/routes/recent_items.rs` (NEW) |
| P2.5 | Register recent_items route in `mod.rs` | `backend/crates/api/src/routes/mod.rs` (MODIFY) |
| P2.6 | Extend `search_all()` with filter params + counts + recency boost | `backend/crates/db/src/queries/search.rs` (MODIFY) |
| P2.7 | Extend search route handler with filter query params | `backend/crates/api/src/routes/search.rs` (MODIFY) |
| P2.8 | Extend `SearchService` with `searchWithFilters()` | `search.service.ts` (MODIFY) |
| P2.9 | Create `RecentItemsService` with API integration | `recent-items.service.ts` (MODIFY) |
| P2.10 | Connect command palette to server-side recent items | `command-palette.component.ts` (MODIFY) |

**Estimated effort:** 3-4 hours

### Phase 3: Advanced Features (Optional, Highest Effort)

**Goal:** Filter chips UI, saved searches, search result highlighting.

| Task | Description | Files |
|------|-------------|-------|
| P3.1 | Parse filter syntax (`assignee:alice label:urgent text`) in command palette | `command-palette.service.ts` (MODIFY) |
| P3.2 | Display filter chips below search input | `command-palette.component.ts` (MODIFY) |
| P3.3 | Add real-time match count from API counts | `command-palette.component.ts` (MODIFY) |
| P3.4 | Add result type tabs (All / Tasks / Boards / Comments) | `command-palette.component.ts` (MODIFY) |
| P3.5 | Highlight matching terms in results via `ts_headline()` | `search.rs` (backend MODIFY), `command-palette.component.ts` (MODIFY) |

**Estimated effort:** 2-3 hours

---

## File Change List

### New Files (9)

| # | File | Description |
|---|------|-------------|
| 1 | `frontend/src/app/shared/components/command-palette/command-palette.component.ts` | @ngxpert/cmdk-based command palette with keyboard nav, search, actions, recent items |
| 2 | `frontend/src/app/core/services/command-palette.service.ts` | Search aggregation, filter syntax parsing, data source management |
| 3 | `frontend/src/app/core/services/recent-items.service.ts` | Recent items tracking (localStorage + API), cross-device sync |
| 4 | `backend/crates/db/src/migrations/20260304000001_recent_items.sql` | `recent_items` table with user/entity/tenant columns |
| 5 | `backend/crates/db/src/migrations/20260304000002_search_improvements.sql` | Board tsvector column, board search GIN index, board search trigger |
| 6 | `backend/crates/db/src/queries/recent_items.rs` | DB queries: list_recent_items, upsert_recent_item |
| 7 | `backend/crates/api/src/routes/recent_items.rs` | API routes: GET /api/recent-items, POST /api/recent-items |
| 8 | `frontend/src/app/shared/components/command-palette/command-palette.component.spec.ts` | Unit tests for command palette |
| 9 | `frontend/src/app/core/services/recent-items.service.spec.ts` | Unit tests for recent items service |

### Modified Files (10)

| # | File | Change |
|---|------|--------|
| 1 | `frontend/package.json` | Add `@ngxpert/cmdk`, `@ngneat/overview`, `@ngneat/until-destroy` |
| 2 | `frontend/src/app/app.component.ts` | Replace GlobalSearchComponent import with CommandPaletteComponent |
| 3 | `frontend/src/app/app.component.html` | Replace `<app-global-search>` with `<app-command-palette>` |
| 4 | `frontend/src/app/core/services/search.service.ts` | Add `searchWithFilters()`, `SearchResultsWithCounts`, `SearchFilters` types |
| 5 | `frontend/src/app/features/task-detail/task-detail-page.component.ts` | Call `RecentItemsService.recordView()` on task navigation |
| 6 | `backend/crates/api/src/routes/mod.rs` | Register `recent_items` router |
| 7 | `backend/crates/api/src/routes/search.rs` | Add optional filter query params (assignee, label, status, board_id) |
| 8 | `backend/crates/db/src/queries/search.rs` | Add filter WHERE clauses, counts, recency boost to `search_all()` |
| 9 | `backend/crates/db/src/queries/mod.rs` | Add `pub mod recent_items;` |
| 10 | `backend/crates/db/src/models/mod.rs` | Add recent_items model if needed |

### Files Deprecated (1)

| # | File | Reason |
|---|------|--------|
| 1 | `frontend/src/app/shared/components/global-search/global-search.component.ts` | Replaced by `command-palette.component.ts`. Keep file but remove from imports. Can be deleted after verification. |

---

## Success Criteria Checklist

### D1: Command Palette
- [ ] Ctrl+K / Cmd+K opens command palette from any page
- [ ] Escape or backdrop click closes it
- [ ] Up/Down arrow keys navigate between results (visible highlight on active item)
- [ ] Enter key selects/navigates to highlighted result
- [ ] Typing `>` switches to command mode, showing action list
- [ ] At least 10 actions available: New Task, New Board, Go to Dashboard, Go to My Tasks, Go to Eisenhower, Toggle Dark Mode, Show Shortcuts, Go to Settings, Go to Profile, Toggle Sidebar
- [ ] Each action shows keyboard shortcut hint if available
- [ ] Search input auto-focuses on open
- [ ] All existing GlobalSearch functionality preserved (search, navigation, recent searches)

### D2: Global Search
- [ ] Typing text triggers API search after 200ms debounce
- [ ] Results grouped by type: Tasks, Boards, Comments (with count in group header)
- [ ] Clicking/Enter on task navigates to board with task param
- [ ] Clicking/Enter on board navigates to board view
- [ ] Loading spinner shown during API call
- [ ] "No results found" shown when search returns empty
- [ ] Results ranked with recency boost (recently updated items rank higher)

### D3: Search Filters
- [ ] `assignee:name` filters tasks by assignee name
- [ ] `label:name` filters tasks by label
- [ ] `status:name` filters tasks by column/status name
- [ ] `board:name` scopes search to specific board
- [ ] Filter chips shown below input when filter syntax detected
- [ ] Removing a chip removes the filter from query

### D4: Recent Items
- [ ] Command palette shows recent items when opened with empty query
- [ ] Recent items include both boards AND tasks
- [ ] Visiting a board page records it as recent (same as sidebar)
- [ ] Visiting a task detail page records it as recent
- [ ] Recent items sorted by most recently visited first
- [ ] Max 10 recent items shown
- [ ] Recent items persist across page reloads (localStorage)
- [ ] (Phase 2) Recent items sync via server API for cross-device access

### Technical
- [ ] `cargo check --workspace --all-targets` passes
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` passes
- [ ] No `.unwrap()` in Rust code
- [ ] All SQL queries use parameterized bindings
- [ ] All new files under 800 lines
- [ ] KeyboardShortcutsService disabled while palette is open (pushDisable/popDisable)
- [ ] No orphaned endpoints (every backend route has frontend consumer)

---

## Key Design Decisions

### Why @ngxpert/cmdk over custom implementation?
The existing GlobalSearchComponent (745 lines) lacks keyboard navigation entirely. Adding Up/Down/Enter handling, active item tracking, scroll-into-view, and auto-filtering manually would add 200+ lines of complex DOM management. `@ngxpert/cmdk` provides all of this out of the box (auto-filtering, keyboard nav, composable groups) with zero styling -- we keep full control of Tailwind styling.

### Why localStorage + API for recent items?
- **localStorage** provides instant load on command palette open (no API latency)
- **Server API** enables cross-device sync and persistence beyond browser cache clears
- **Merge strategy**: localStorage loads first (instant), API response merges in background (deduped by entity_id, sorted by viewed_at)

### Why extend existing search API vs new endpoint?
The existing `GET /api/search` already handles full-text search with tsvector + ILIKE. Adding optional filter params is additive and backward-compatible. A separate endpoint would fragment search logic.

### Why not use PrimeNG Dialog for the overlay?
The command palette needs custom backdrop behavior (click-outside-to-close, Escape handling) and precise positioning (15vh from top). A plain `@if` with fixed positioning + Tailwind is simpler and more predictable than wrapping in PrimeNG Dialog which adds header/footer chrome we don't want.

---

## Sources

- [@ngxpert/cmdk GitHub](https://github.com/ngxpert/cmdk) -- Angular command menu library (v3.x supports Angular 18+19)
- [pacocoursey/cmdk](https://cmdk.paco.me/) -- Original React cmdk (design reference)
- [comp.md D1-D4 section](comp.md#search--discovery-d1d4) -- Competitor analysis
- [section-03-command-palette](.ultraplan/sections/section-03-command-palette.md) -- Original ultraplan
