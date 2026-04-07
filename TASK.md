# Add Due Time for Tasks

## Objective
Add time picker alongside existing due date so users can set both date and time for task deadlines. The DB column (`due_date TIMESTAMPTZ`) already stores full datetime, and the task detail sidebar already has `[showTime]="true"`. The gap is in: create dialogs (no time picker), display functions (show date only, no time), and the card quick-edit picker (date-only inline calendar).

## Key Insight
This is a **frontend-only** change. The DB and backend already handle full `DateTime<Utc>`. The frontend sends `.toISOString()` which includes time. The problem is:
1. Create dialogs don't let users pick a time
2. Display functions strip time info
3. Quick-edit date picker is date-only

## Success Criteria
- [ ] Create task dialog shows time picker alongside due date
- [ ] Quick-create task dialog shows time picker alongside due date
- [ ] Card quick-edit due date picker includes time selection
- [ ] `formatDueDate()` shows time when a non-midnight time is set
- [ ] `formatShortDate()` shows time when a non-midnight time is set
- [ ] Task cards show time alongside date (e.g., "Apr 7, 2:30 PM")
- [ ] List view shows time alongside date
- [ ] Task detail sidebar already works (has showTime) - verify no regression
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` passes

## Implementation Plan

### Step 1: Update display functions
**Files:** `frontend/src/app/shared/utils/task-colors.ts`, `frontend/src/app/features/task-detail/task-detail-helpers.ts`
- Modify `formatDueDate()` to include time when the time component is non-midnight (00:00)
- Modify `formatShortDate()` similarly
- Add helper `hasTimeComponent(dateStr)` to check if time is meaningful

### Step 2: Update Create Task Dialog
**File:** `frontend/src/app/features/project/project-view/create-task-dialog.component.ts`
- Add `[showTime]="true"` and `[hourFormat]="'12'"` to the due date `p-datePicker`
- Same for start date picker

### Step 3: Update Quick-Create Task Dialog
**File:** `frontend/src/app/shared/components/quick-create-task/quick-create-task-dialog.component.ts`
- Add `[showTime]="true"` and `[hourFormat]="'12'"` to the due date `p-datePicker`

### Step 4: Update Card Quick-Edit Due Date Picker
**File:** `frontend/src/app/features/project/project-view/card-quick-edit/pickers/due-date-picker.component.ts`
- Add time selection below the inline calendar
- Add `[showTime]="true"` and `[hourFormat]="'12'"` to `p-datePicker`

### Step 5: Verify & Build
- Run `npx tsc --noEmit`
- Run `npm run build -- --configuration=production`

## Progress Log
