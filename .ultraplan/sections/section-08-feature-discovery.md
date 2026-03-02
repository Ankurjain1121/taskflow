# Section 08: Feature Discovery & Onboarding

> Project: TaskFlow World-Class Upgrade
> Batch: 3 | Tasks: 6 | Risk: GREEN
> PRD Features: P1 - Feature Discovery System, Demo Board for New Users

---

## Overview

Make every feature in TaskFlow discoverable. Non-tech-savvy users should naturally encounter features through contextual hints, guided tours, and inviting empty states. New users get a pre-filled demo board to explore before creating their own.

Four discovery mechanisms:
1. **Feature Tour** - First-time guided walkthrough highlighting key features
2. **Contextual Tooltips** - "Did you know?" hints near underused features
3. **Empty State Prompts** - Inviting CTAs when a feature hasn't been used
4. **Feature Dashboard** - A dedicated page listing everything TaskFlow can do

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | UI-only work with no complex logic |

### Risk Factors
- Complexity: 2 (tour framework, tooltip tracking)
- Novelty: 1 (common SaaS pattern)
- Dependencies: 1 (needs features wired from Section 01)
- Integration: 1 (internal only)
- Data sensitivity: 1 (user preferences only)
- **Total: 6 → GREEN**

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Depends on | Section 01 | Features must be wired before we can point tours at them |
| Depends on | Section 02 | Top nav bar provides anchor points for tooltips |

**Batch:** 3

---

## TDD Test Stubs

1. `FeatureTourService should activate tour for first-time users`
2. `FeatureTourService should NOT show tour for returning users`
3. `FeatureTourService should track which tour steps have been seen`
4. `ContextualTooltipComponent should show hint when user hasn't used a feature`
5. `ContextualTooltipComponent should dismiss permanently when user clicks "Got it"`
6. `FeatureDashboardComponent should list all available features with setup links`
7. `DemoBoardService should create sample board with tasks on first signup`

---

## Tasks

### Task 1: Feature Tour Framework
**Files:** `core/services/feature-tour.service.ts` (CREATE), `shared/components/tour-step/tour-step.component.ts` (CREATE)
**Steps:**
1. Create `FeatureTourService` that manages tour state (current step, dismissed)
2. Create `TourStepComponent` that highlights a target element with spotlight overlay
3. Tour steps: 1) Board view, 2) Board settings tabs, 3) Command palette, 4) Quick filters, 5) My Tasks
4. Store tour completion in user preferences (backend `user_preferences` table)
5. Show tour on first login after the upgrade (one-time)
6. Allow manual re-trigger from Help page
**Done when:** New users see a 5-step guided tour on first login

### Task 2: Contextual Tooltips
**Files:** `shared/components/contextual-tooltip/contextual-tooltip.component.ts` (CREATE)
**Steps:**
1. Create tooltip component that shows near a target element
2. Content: "Did you know? [feature description]. Try it now →"
3. Track dismissed tooltips in localStorage
4. Show max 1 tooltip per session to avoid annoyance
5. Tooltips for: Automations tab, Custom Fields, Time Tracking, Keyboard Shortcuts
**Done when:** Helpful tooltips appear contextually and can be permanently dismissed

### Task 3: Enhanced Empty States
**Files:** Existing `empty-state.component.ts` (MODIFY)
**Steps:**
1. Add new variants: `automations`, `custom-fields`, `webhooks`, `milestones`, `time-tracking`
2. Each variant has: illustration, friendly message, and "Set up now" CTA button
3. CTA navigates to the relevant settings tab or opens setup dialog
4. Example: "No automations yet. Save time by setting up rules - when a task is done, automatically notify the team. Set up your first rule →"
**Done when:** Every empty feature shows an inviting prompt with setup guidance

### Task 4: Feature Dashboard Page
**Files:** `features/feature-dashboard/feature-dashboard.component.ts` (CREATE), `app.routes.ts`
**Steps:**
1. New route: `/features` (or `/tools`)
2. Grid layout showing all TaskFlow capabilities
3. Each card: icon, name, short description, usage status (active/not used), link to configure
4. Categories: Board Views, Task Management, Collaboration, Automation, Analytics
5. Link from sidebar and Help page
**Done when:** Feature dashboard page lists all capabilities with setup links

### Task 5: Demo Board for New Users
**Files:** Backend `onboarding.rs` (MODIFY), frontend onboarding flow
**Steps:**
1. Modify the existing onboarding sample board to be richer
2. Include: 5 sample tasks across 3 columns, 2 with subtasks, 1 with time tracking, labels, and comments
3. Add a "welcome" task at the top explaining how to use the board
4. Include sample automation: "When task moved to Done, mark subtasks complete"
5. Include sample custom field: "Priority" and "Effort" fields
**Done when:** New users land on a feature-rich demo board that showcases capabilities

### Task 6: Help Page Enhancement
**Files:** `features/help/` components, sidebar
**Steps:**
1. Add link to Help page in sidebar (currently missing)
2. Add "Feature Tour" button on Help page to re-trigger the tour
3. Add link to Feature Dashboard from Help page
4. Add FAQ section for common questions
**Done when:** Help page is accessible from sidebar and provides useful guidance

---

## Section Completion Criteria

- [ ] Feature tour activates for new users (5 steps)
- [ ] Contextual tooltips appear for underused features (max 1 per session)
- [ ] Empty states for all new feature areas have inviting CTAs
- [ ] Feature dashboard page lists all capabilities
- [ ] Demo board has rich sample data showcasing features
- [ ] Help page is linked from sidebar and has tour re-trigger
