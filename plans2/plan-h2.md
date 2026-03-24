# Plan H2: Sample Data on Signup

> Feature: H2 — Sample Data on Signup
> Phase: H — Onboarding & Feature Discovery
> Status: PLANNED
> Created: 2026-03-02

---

## Requirements

**H2 means:** When a new user signs up, they are asked a single use-case question ("What are you building?") and receive a pre-seeded sample board with 8-10 realistic demo tasks tailored to their answer. The sample board showcases TaskBolt's features (labels, priorities, due dates, subtasks, assignees) so the user immediately sees the product in action. A prominent "Delete this sample board" CTA is always visible.

### Sub-features IN SCOPE

1. **Use-case selection step** — Single question during onboarding: "What will you use TaskBolt for?" with 4 use-case cards (Software Dev, Marketing, Personal Tasks, Design & Creative)
2. **Use-case-driven sample board generation** — Backend creates a board with columns, 8-10 tasks, labels, subtasks, and due dates specific to the selected use-case
3. **Realistic demo data per use-case** — Each use-case gets different column names, task titles, labels, and priorities that feel like a real project
4. **"Delete this sample board" CTA** — Visible banner on the generated board with a one-click delete action
5. **Navigate to board after creation** — After sample board is generated, user goes directly to the board (not dashboard) for immediate engagement
6. **Skip option** — User can skip the use-case question and get the generic "Getting Started" board (current behavior preserved)

### Sub-features OUT OF SCOPE (with reason)

- **AI-generated sample data** — Overengineered for a 1-question flow; static templates provide enough variety
- **Use-case survey with multiple questions** — Violates KISS; Asana's single-question pattern achieves 90% of the value
- **Custom sample data upload / import** — Separate feature (C6 Export/Import already exists)
- **Personalized dashboard based on use-case** — Future H3/H4 work, not part of H2

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> **Asana's "What are you building?" signup question** maps to a sample board with 5-10 realistic demo tasks. Include "Delete this sample project" CTA prominently.

| Product | Approach |
|---------|----------|
| Asana | Personalized dashboard from signup survey (role/use case) |
| Airtable | Wizard: choose use case → template loads + data import |
| Trello | Welcome Board auto-generated (no personalization) |
| Monday.com | Template library on first workspace creation |
| Linear | Sample project with issue templates |

### Single Most Important Gap

TaskBolt currently generates a **generic "Getting Started" board** with 6 vague tasks like "Explore the Kanban board" and "Try dragging tasks between columns." These feel like tutorial instructions, not real work. **The gap is personalization** — users don't see themselves in the sample data. Asana's use-case question gives users a board that looks like their actual project from day one, cutting time-to-value by 40%.

---

## What Already Exists

### Backend

| File | What Exists | What Needs to Change |
|------|-------------|---------------------|
| `backend/crates/services/src/sample_board.rs` | `generate_sample_board()` creates 1 fixed board (4 cols, 6 tasks, 3 labels) | Add `use_case: &str` param, 4 template configurations |
| `backend/crates/api/src/routes/onboarding.rs` | `POST /generate-sample-board` accepts `{ workspace_id }` | Add `use_case` field to request DTO |
| `backend/crates/services/src/board_templates.rs` | Static `TEMPLATES` array (blank, kanban, scrum, etc.) | Read-only reference; sample_board.rs will have its own configs |
| `backend/crates/db/src/models/user_preferences.rs` | `UserPreferences` struct (timezone, theme, etc.) | No change needed (use_case stored in localStorage for now) |

### Frontend

| File | What Exists | What Needs to Change |
|------|-------------|---------------------|
| `frontend/src/app/features/onboarding/onboarding.component.ts` | 3-step full flow: workspace → invite → sample-board | Insert use-case step between invite and sample-board (4 steps) |
| `frontend/src/app/features/onboarding/step-sample-board/step-sample-board.component.ts` | Static "Generate Sample Board" button + preview | Pass `use_case` to API, show use-case-specific preview, add "Go to Board" instead of "Go to Dashboard" |
| `frontend/src/app/core/services/onboarding.service.ts` | `generateSampleBoard(workspaceId)` | Add `useCase` param |
| `frontend/src/app/features/onboarding/step-welcome/step-welcome.component.ts` | Welcome for abbreviated (invited) flow | No change needed |

### What Needs to Be Built from Scratch

| Component | File | Purpose |
|-----------|------|---------|
| StepUseCaseComponent | `frontend/src/app/features/onboarding/step-use-case/step-use-case.component.ts` | Use-case selection card grid |
| SampleBoardBannerComponent | `frontend/src/app/features/board/sample-board-banner/sample-board-banner.component.ts` | "This is a sample board — Delete it" banner |

---

## Backend Changes

### SQL Migrations

**Migration: Add `is_sample` flag to boards table**

File: `backend/crates/db/src/migrations/YYYYMMDDHHMMSS_board_is_sample.sql`

```sql
-- Mark boards as sample/demo boards for easy identification and deletion
ALTER TABLE boards
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookup of sample boards
CREATE INDEX IF NOT EXISTS idx_boards_is_sample ON boards(is_sample) WHERE is_sample = true;
```

This allows the frontend to show the "Delete sample board" banner on any board where `is_sample = true`.

### API Route Changes

**File: `backend/crates/api/src/routes/onboarding.rs`**

1. Modify `GenerateSampleBoardRequest` to include optional `use_case`:
   ```rust
   #[derive(Debug, Deserialize)]
   pub struct GenerateSampleBoardRequest {
       pub workspace_id: Uuid,
       pub use_case: Option<String>,  // NEW: "software", "marketing", "personal", "design"
   }
   ```

2. Pass `use_case` through to `generate_sample_board()`:
   ```rust
   let use_case = payload.use_case.as_deref().unwrap_or("software");
   let board_id = generate_sample_board(&state.db, workspace_id, user_id, tenant_id, use_case).await?;
   ```

3. Add `GenerateSampleBoardResponse` to include `workspace_id` for navigation:
   ```rust
   pub struct GenerateSampleBoardResponse {
       pub board_id: Uuid,
       pub workspace_id: Uuid,  // NEW: needed for frontend routing
   }
   ```

**File: `backend/crates/api/src/routes/board.rs`** (or new endpoint)

4. No new endpoint needed for sample board deletion — the existing `DELETE /api/boards/:id` handles this. The frontend just needs to know which boards are samples (from `is_sample` field in board response).

### Backend Service Changes

**File: `backend/crates/services/src/sample_board.rs`**

Refactor `generate_sample_board()` to accept `use_case` and dispatch to template configs:

```rust
pub async fn generate_sample_board(
    pool: &PgPool,
    workspace_id: Uuid,
    created_by_id: Uuid,
    tenant_id: Uuid,
    use_case: &str,       // NEW parameter
) -> Result<Uuid, SampleBoardError> {
```

Add 4 template configurations as static data:

| Use Case | Board Name | Columns | Tasks (8-10) | Labels |
|----------|-----------|---------|------|--------|
| `software` | "Sprint Board" | Backlog, To Do, In Progress, Code Review, Done | "Set up CI/CD pipeline", "Design user authentication", "Create API documentation", "Fix login page bug", "Add dark mode support", "Write unit tests for auth", "Implement search feature", "Review pull request #42" | Bug, Feature, Tech Debt |
| `marketing` | "Campaign Tracker" | Ideas, Planning, In Progress, Review, Published | "Write blog post on product launch", "Design social media graphics", "Plan email newsletter", "Create landing page copy", "Set up analytics tracking", "Schedule social media posts", "Review competitor analysis", "Film product demo video" | Content, Social, Email |
| `personal` | "My Projects" | To Do, Doing, Waiting, Done | "Plan weekend project", "Read 'Atomic Habits' book", "Organize digital photos", "Learn basic cooking recipes", "Set up home office", "Create monthly budget", "Exercise 3x this week", "Call dentist for appointment" | Health, Learning, Home |
| `design` | "Design Sprint" | Research, Wireframes, Design, Feedback, Shipped | "Create user persona cards", "Wireframe onboarding flow", "Design component library", "Prototype mobile navigation", "Conduct usability test", "Design dark mode palette", "Create icon set", "Review design system tokens" | UX Research, UI Design, Prototype |

Each template also includes:
- 2 tasks with subtasks (2-3 subtasks each)
- 3 tasks with due dates (spread across next 7 days)
- All tasks get the first label attached
- Varying priorities (2 high, 3 medium, 3 low)
- Board created with `is_sample = true`

### DB Model Changes

**File: `backend/crates/db/src/models/board.rs`**

Add `is_sample` field to the Board struct:
```rust
pub is_sample: bool,
```

Update all board queries that return Board structs to include `is_sample` in SELECT.

---

## Frontend Changes

### New Components

#### 1. StepUseCaseComponent

**File:** `frontend/src/app/features/onboarding/step-use-case/step-use-case.component.ts`
**Selector:** `app-step-use-case`

**Purpose:** Single-question use-case selection during onboarding.

**Signals:**
- `selectedUseCase = signal<string | null>(null)` — currently selected use-case
- `useCases` — static array of 4 use-case options

**Inputs/Outputs:**
- `completed = output<string>()` — emits the selected use-case ID

**Template sketch:**
```html
<div class="space-y-6">
  <div class="text-center mb-8">
    <h2>What will you use TaskBolt for?</h2>
    <p>We'll set up a sample board to get you started.</p>
  </div>

  <div class="grid grid-cols-2 gap-4">
    @for (useCase of useCases; track useCase.id) {
      <button (click)="select(useCase.id)"
        [class.border-blue-500]="selectedUseCase() === useCase.id"
        class="p-5 border-2 rounded-xl text-left hover:border-blue-400 transition-all">
        <div class="text-3xl mb-3">{{ useCase.icon }}</div>
        <h3 class="font-semibold">{{ useCase.title }}</h3>
        <p class="text-sm text-muted-foreground mt-1">{{ useCase.description }}</p>
      </button>
    }
  </div>

  <button (click)="continue()" [disabled]="!selectedUseCase()"
    class="w-full py-3 bg-blue-600 text-white rounded-lg">
    Continue
  </button>

  <button (click)="skip()" class="w-full text-sm text-muted-foreground">
    Skip — I'll start from scratch
  </button>
</div>
```

**Use-case cards:**

| ID | Icon | Title | Description |
|----|------|-------|-------------|
| `software` | Code icon (SVG) | Software Development | Sprints, bugs, features, code reviews |
| `marketing` | Megaphone icon (SVG) | Marketing & Content | Campaigns, content calendar, analytics |
| `personal` | User icon (SVG) | Personal Tasks | Habits, goals, errands, learning |
| `design` | Paintbrush icon (SVG) | Design & Creative | Wireframes, prototypes, design reviews |

#### 2. SampleBoardBannerComponent

**File:** `frontend/src/app/features/board/sample-board-banner/sample-board-banner.component.ts`
**Selector:** `app-sample-board-banner`

**Purpose:** Dismissible banner shown at the top of a sample board.

**Inputs:**
- `boardId = input.required<string>()`
- `workspaceId = input.required<string>()`

**Outputs:**
- `deleted = output<void>()`

**Template sketch:**
```html
@if (!dismissed()) {
  <div class="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200
              dark:bg-amber-900/20 dark:border-amber-800">
    <div class="flex items-center gap-2">
      <svg class="w-4 h-4 text-amber-600"><!-- info icon --></svg>
      <span class="text-sm text-amber-800 dark:text-amber-300">
        This is a sample board to help you explore TaskBolt.
      </span>
    </div>
    <div class="flex items-center gap-3">
      <button (click)="deleteBoard()" class="text-sm text-red-600 hover:text-red-700 font-medium">
        Delete this board
      </button>
      <button (click)="dismiss()" class="text-amber-600 hover:text-amber-700">
        <svg class="w-4 h-4"><!-- x icon --></svg>
      </button>
    </div>
  </div>
}
```

**Signals:**
- `dismissed = signal(false)`
- `isDeleting = signal(false)`

**Behavior:**
- "Delete this board" calls `DELETE /api/boards/:id`, then navigates to dashboard
- Dismiss just hides the banner (persists in localStorage key `tf_sample_banner_dismissed_${boardId}`)

### Modified Components

#### 3. OnboardingComponent

**File:** `frontend/src/app/features/onboarding/onboarding.component.ts`

**Changes:**
- Import `StepUseCaseComponent`
- Add `'use-case'` step to `fullFlowSteps` array (between invite and sample-board)
- Add `useCase = signal<string>('software')` to track selection
- Add `onUseCaseSelected(useCase: string)` handler
- Flow becomes: workspace → invite → use-case → sample-board (4 steps)
- Pass `useCase()` to `StepSampleBoardComponent`

Updated flow:
```typescript
private fullFlowSteps: FullFlowStep[] = [
  { id: 'workspace', label: 'Create Workspace' },
  { id: 'invite', label: 'Invite Team' },
  { id: 'use-case', label: 'Use Case' },       // NEW
  { id: 'sample-board', label: 'Sample Board' },
];
```

#### 4. StepSampleBoardComponent

**File:** `frontend/src/app/features/onboarding/step-sample-board/step-sample-board.component.ts`

**Changes:**
- Add `useCase = input<string>('software')` input
- Pass `useCase` to `onboardingService.generateSampleBoard()`
- Update preview to show use-case-specific column names and task counts
- Change "Go to Dashboard" to "Go to your board" — navigates to `/workspace/:wid/board/:bid`
- After generation, store `boardId` and `workspaceId` for navigation

Updated `sampleColumns` becomes a computed based on `useCase`:
```typescript
sampleColumnsMap: Record<string, SampleColumn[]> = {
  software: [
    { name: 'Backlog', color: '#94a3b8', taskCount: 2 },
    { name: 'To Do', color: '#6366f1', taskCount: 2 },
    { name: 'In Progress', color: '#3b82f6', taskCount: 2 },
    { name: 'Code Review', color: '#f59e0b', taskCount: 1 },
    { name: 'Done', color: '#22c55e', taskCount: 1 },
  ],
  marketing: [...],
  personal: [...],
  design: [...],
};
```

#### 5. OnboardingService

**File:** `frontend/src/app/core/services/onboarding.service.ts`

**Changes:**
- Update `generateSampleBoard()` signature:
  ```typescript
  generateSampleBoard(workspaceId: string, useCase?: string): Observable<GenerateSampleBoardResponse>
  ```
- Update `GenerateSampleBoardResponse` to include `workspace_id`:
  ```typescript
  export interface GenerateSampleBoardResponse {
    board_id: string;
    workspace_id: string;
  }
  ```

#### 6. BoardViewComponent (or board-view template)

**File:** `frontend/src/app/features/board/board-view/board-view.component.ts`

**Changes:**
- Add `<app-sample-board-banner>` conditionally at top of board when `board.is_sample === true`
- Import `SampleBoardBannerComponent`
- Handle `deleted` event to navigate away

#### 7. BoardService / Board Model

**File:** `frontend/src/app/shared/types/board.ts` (or wherever Board interface lives)

**Changes:**
- Add `is_sample: boolean` to Board interface

---

## Phased Implementation

### Phase 1 — Frontend-only (no backend changes)

**Goal:** Add the use-case selection step to onboarding. The backend still creates the same generic board, but the frontend collects the use-case choice and passes it (backend ignores it for now).

| # | Task | File |
|---|------|------|
| 1.1 | Create `StepUseCaseComponent` with 4 use-case cards | `frontend/.../onboarding/step-use-case/step-use-case.component.ts` |
| 1.2 | Modify `OnboardingComponent` to insert use-case step into flow | `frontend/.../onboarding/onboarding.component.ts` |
| 1.3 | Update `StepSampleBoardComponent` preview to be use-case-aware | `frontend/.../onboarding/step-sample-board/step-sample-board.component.ts` |
| 1.4 | Update `OnboardingService.generateSampleBoard()` to accept `useCase` param | `frontend/.../core/services/onboarding.service.ts` |
| 1.5 | After generation, navigate to board instead of dashboard | `frontend/.../onboarding/step-sample-board/step-sample-board.component.ts` |

**Estimated effort:** 2-3 hours

### Phase 2 — Backend: Use-case-driven sample boards

**Goal:** Backend generates different sample boards based on `use_case` parameter.

| # | Task | File |
|---|------|------|
| 2.1 | Create migration: `ALTER TABLE boards ADD COLUMN is_sample BOOLEAN` | `backend/crates/db/src/migrations/YYYYMMDD_board_is_sample.sql` |
| 2.2 | Update Board model to include `is_sample` | `backend/crates/db/src/models/board.rs` |
| 2.3 | Update all board SELECT queries to include `is_sample` | `backend/crates/db/src/queries/boards.rs` |
| 2.4 | Refactor `generate_sample_board()` to accept `use_case` and create 4 template configs | `backend/crates/services/src/sample_board.rs` |
| 2.5 | Update `GenerateSampleBoardRequest` to include `use_case` field | `backend/crates/api/src/routes/onboarding.rs` |
| 2.6 | Add subtasks to sample board generation (2-3 subtasks per 2 tasks) | `backend/crates/services/src/sample_board.rs` |
| 2.7 | Add due dates to sample tasks (spread across next 7 days) | `backend/crates/services/src/sample_board.rs` |
| 2.8 | Set `is_sample = true` on generated boards | `backend/crates/services/src/sample_board.rs` |
| 2.9 | Run `cargo sqlx prepare` and update SQLx cache | (command) |

**Estimated effort:** 3-4 hours

### Phase 3 — Sample Board Banner & Delete

**Goal:** Show a banner on sample boards with a "Delete this board" action.

| # | Task | File |
|---|------|------|
| 3.1 | Create `SampleBoardBannerComponent` | `frontend/.../board/sample-board-banner/sample-board-banner.component.ts` |
| 3.2 | Add banner to `BoardViewComponent` when `board.is_sample === true` | `frontend/.../board/board-view/board-view.component.ts` |
| 3.3 | Add `is_sample` to frontend Board interface | `frontend/src/app/shared/types/...` |
| 3.4 | Handle board deletion in banner (call existing DELETE endpoint, navigate to dashboard) | `frontend/.../board/sample-board-banner/sample-board-banner.component.ts` |

**Estimated effort:** 1-2 hours

---

## File Change List

| # | File (absolute path) | Action | Description |
|---|---------------------|--------|-------------|
| 1 | `frontend/src/app/features/onboarding/step-use-case/step-use-case.component.ts` | CREATE | Use-case selection card grid (4 options) with skip button |
| 2 | `frontend/src/app/features/onboarding/onboarding.component.ts` | MODIFY | Insert use-case step into full flow (4 steps), add useCase signal, pass to sample-board |
| 3 | `frontend/src/app/features/onboarding/step-sample-board/step-sample-board.component.ts` | MODIFY | Accept useCase input, dynamic preview columns, navigate to board after generation |
| 4 | `frontend/src/app/core/services/onboarding.service.ts` | MODIFY | Add useCase param to generateSampleBoard(), update response type |
| 5 | `frontend/src/app/features/board/sample-board-banner/sample-board-banner.component.ts` | CREATE | Amber banner with "Delete this board" CTA and dismiss button |
| 6 | `frontend/src/app/features/board/board-view/board-view.component.ts` | MODIFY | Import and conditionally render SampleBoardBannerComponent |
| 7 | `backend/crates/db/src/migrations/YYYYMMDDHHMMSS_board_is_sample.sql` | CREATE | Add is_sample BOOLEAN column to boards table |
| 8 | `backend/crates/db/src/models/board.rs` | MODIFY | Add is_sample field to Board struct |
| 9 | `backend/crates/db/src/queries/boards.rs` (or equivalent) | MODIFY | Include is_sample in all SELECT queries returning Board |
| 10 | `backend/crates/services/src/sample_board.rs` | MODIFY | Accept use_case param, 4 template configs with realistic data, subtasks, due dates |
| 11 | `backend/crates/api/src/routes/onboarding.rs` | MODIFY | Add use_case to GenerateSampleBoardRequest, pass to service, return workspace_id |
| 12 | Frontend Board interface (wherever defined) | MODIFY | Add is_sample: boolean |

---

## Success Criteria Checklist

- [ ] **Use-case step visible:** During onboarding full flow, a "What will you use TaskBolt for?" screen appears with 4 cards (Software, Marketing, Personal, Design) between the invite step and sample board step
- [ ] **Selection highlight:** Clicking a use-case card highlights it with a blue border; the Continue button is disabled until a card is selected
- [ ] **Skip works:** "Skip" link bypasses use-case selection and creates the default generic board
- [ ] **Preview matches selection:** The sample board preview in step 4 shows column names and task counts matching the selected use-case
- [ ] **Board generated with correct data:** Selecting "Software" creates a board named "Sprint Board" with columns Backlog/To Do/In Progress/Code Review/Done and 8 software-related tasks
- [ ] **Board generated with correct data:** Selecting "Marketing" creates "Campaign Tracker" with Ideas/Planning/In Progress/Review/Published columns
- [ ] **Board generated with correct data:** Selecting "Personal" creates "My Projects" with To Do/Doing/Waiting/Done columns
- [ ] **Board generated with correct data:** Selecting "Design" creates "Design Sprint" with Research/Wireframes/Design/Feedback/Shipped columns
- [ ] **Subtasks present:** At least 2 tasks per template have 2-3 subtasks
- [ ] **Due dates present:** At least 3 tasks per template have due dates within the next 7 days
- [ ] **Labels present:** Each template creates 3 use-case-specific labels, attached to relevant tasks
- [ ] **Navigate to board:** After sample board generation, clicking the CTA navigates to `/workspace/:wid/board/:bid` (the actual board, not the dashboard)
- [ ] **Sample banner visible:** The generated board shows an amber banner at the top: "This is a sample board to help you explore TaskBolt."
- [ ] **Delete works:** Clicking "Delete this board" on the banner deletes the board and navigates to dashboard
- [ ] **Banner dismissible:** Clicking "X" on the banner hides it; persistence in localStorage
- [ ] **is_sample flag:** Board created with `is_sample = true` in database
- [ ] **Abbreviated flow unchanged:** Invited users still see the welcome → sample-board flow (no use-case question)
- [ ] **cargo check passes:** `cd backend && cargo check --workspace --all-targets`
- [ ] **cargo clippy passes:** `cd backend && cargo clippy --workspace --all-targets -- -D warnings`
- [ ] **tsc passes:** `cd frontend && npx tsc --noEmit`
- [ ] **Frontend build passes:** `cd frontend && npm run build -- --configuration=production`
- [ ] **No orphaned code:** Every new backend endpoint has a frontend consumer; every frontend API call has a backend handler
