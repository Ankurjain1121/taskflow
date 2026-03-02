# Product Requirements Document: TaskFlow World-Class Upgrade

> Generated: 2026-02-25
> Phase: 3/6 - PLAN
> Status: PENDING APPROVAL

---

## 1. What We're Building

**Project:** TaskFlow World-Class Upgrade
**One-liner:** Transform TaskFlow from a feature-rich project management tool into a polished, fast, approachable app that non-tech-savvy teams love using.
**Type:** Improvement to existing web application

TaskFlow already does almost everything a project management tool needs to do - kanban boards, Gantt charts, automations, time tracking, custom fields, and more. The problem is that most of these features are hidden, hard to find, or inaccessible from the interface. A user looking at TaskFlow today sees a kanban board and little else.

This upgrade transforms TaskFlow from "powerful but confusing" to "powerful and delightful." Every feature that already exists in the backend gets a proper, discoverable home on the frontend. The navigation gets rebuilt with a top bar and improved sidebar. Every interaction becomes instant (under 200 milliseconds). And the entire look and feel becomes warm, friendly, and approachable - like Trello, but with more power under the hood.

Think of this as an extreme makeover. The engine is great. Now we're upgrading the body, the dashboard, and the driving experience.

---

## 2. The Problem

**Today, TaskFlow has a hidden features problem.**

The backend has 850+ working endpoints powering 31 database entities, but the frontend only properly surfaces about 70% of them. 7 complete features (automations, board sharing, webhooks, import/export, custom fields management, milestones) are fully built as frontend components but have no navigation path to reach them. They literally exist in the code but no user can access them.

Beyond hidden features, the experience has friction:
- Pages feel slow due to unnecessary full re-renders
- The navigation is sidebar-only, making important actions feel buried
- New users land in an empty workspace with no guidance
- The board view doesn't show enough information on task cards
- There's no quick way to search or jump to anything (no command palette)

**Why existing solutions fall short for TaskFlow's audience:**
- **Trello**: Simple and friendly, but lacks power features (Gantt, automations, time tracking). TaskFlow HAS these features - they just need to be visible.
- **Asana/Monday**: Feature-rich but complex and expensive. Too enterprise-feeling for small teams.
- **Linear**: Fast and beautiful, but developer-focused. Too technical for non-tech teams.

TaskFlow has a unique opportunity: it already has enterprise-level features. It just needs a consumer-level experience.

---

## 3. Who It's For

### Primary Persona: Maya - Small Team Lead

Maya runs a 6-person marketing team at a small agency. She uses email, WhatsApp, and Google Docs daily. She tried Trello (too basic for tracking deadlines) and Asana (too complicated). She wants something that "just works" without reading docs or watching tutorials.

**Maya needs:**
- To see all her team's work at a glance
- To assign tasks by dragging, not through dropdown menus
- To know when something is overdue without checking manually
- To set up simple rules like "when a task is done, notify the team lead"

### Secondary Persona: Alex - Team Member

Alex is a graphic designer on Maya's team. They check tasks on their phone between meetings. They want to quickly see what they need to do today, update progress, and move on.

**Alex needs:**
- A clear "My Tasks" view showing today's work
- To update task status in one click
- To not get overwhelmed by features they don't use

### User Needs Table

| Need | Priority | Feature |
|------|----------|---------|
| Find all features easily | P0 | Tabbed board settings, top nav bar, feature dashboard |
| See team's work at a glance | P0 | Rich task cards with avatars, due dates, priority badges |
| Instant interactions | P0 | Sub-200ms renders, optimistic updates, lazy loading |
| Quick navigation | P0 | Command palette (Ctrl+K), improved sidebar |
| Know who's working on what | P1 | Presence indicators, editing locks |
| Get notified immediately | P1 | Browser push notifications, sound effects |
| Discover new features gradually | P1 | Feature tours, contextual tooltips, empty state prompts |
| Limit work in progress | P2 | Column WIP limits with visual warnings |
| Personalize boards | P2 | Board backgrounds |

---

## 4. What It Does

### P0 - Must Have (Core Upgrade)

- [ ] **Wire Orphaned Features** - Connect 7 existing components (automations, sharing, webhooks, import/export, custom fields, milestones) to proper navigation paths in the UI
- [ ] **Tabbed Board Settings** - Convert the overloaded board settings page into organized tabs: General, Columns, Members, Automations, Integrations, Custom Fields, Milestones
- [ ] **Top Navigation Bar** - Add a persistent top bar with search, notifications, quick-create button, user menu, and board-level actions (view switcher, filters)
- [ ] **Command Palette** - Add Ctrl+K / Cmd+K search that can jump to any board, task, setting, or action instantly
- [ ] **Rich Task Card Previews** - Show priority badge, due date, assignee avatar, subtask progress bar, and labels on every task card at a glance
- [ ] **Performance: Column Pagination** - Paginate kanban columns at 20 tasks with "Show N more..." to keep boards fast
- [ ] **Performance: Read-Only Virtual Scrolling** - Add virtual scrolling to My Tasks, notification lists, and activity feeds for long lists
- [ ] **Workspace Export UI** - Build the missing frontend for the workspace export backend endpoint

### P1 - Should Have (Experience Enhancement)

- [ ] **Quick Filter Buttons** - One-click filter buttons at the top of each board: "My Tasks", "Due This Week", "High Priority"
- [ ] **Feature Discovery System** - Contextual tooltips on underused features, feature tour for new users, rich empty state prompts, and a feature dashboard page
- [ ] **Presence Indicators** - Show which team members are currently viewing the same board, with their avatars in the board header
- [ ] **Task Editing Lock** - When someone opens a task for editing, show "Maya is editing..." badge to others, preventing conflicts
- [ ] **Browser Push Notifications** - Desktop push alerts for mentions, task assignments, and approaching deadlines
- [ ] **Demo Board for New Users** - Pre-filled sample board on first sign-up so new users can explore features before creating anything

### P2 - Nice to Have (Polish & Delight)

- [ ] **Subtle Animations** - Smooth route transitions, card hover effects, celebratory animation on task completion
- [ ] **Board Backgrounds** - Custom background images or colors per board, like Trello
- [ ] **Column WIP Limits** - Visual indicator showing "In Progress: 3/5" with warning color when over limit
- [ ] **Sound Effects** - Subtle notification sounds, task completion ping, drag-and-drop feedback sounds
- [ ] **Essential Keyboard Shortcuts** - 5-10 key shortcuts: N (new task), Ctrl+K (search), arrow keys (navigate), Enter (open)

---

## 5. How It Should Feel

### Visual Mood: Clean & Friendly

TaskFlow should feel like walking into a well-organized, sunlit workspace. Warm colors, rounded corners, playful but professional icons. Think Trello's approachability with Notion's cleanliness.

- **Colors**: Warm primary (indigo/blue with warm undertones), soft backgrounds, colorful status indicators
- **Typography**: Readable, slightly rounded font. Good contrast. Generous line heights.
- **Spacing**: Generous padding, no cramped elements. Cards breathe.
- **Corners**: Rounded everywhere (8-12px radius). Soft shadows, not harsh borders.
- **Icons**: Friendly, filled style (not thin line icons)

### Key Screens

| Screen | Layout | Key Elements |
|--------|--------|-------------|
| Board (Kanban) | Columns filling width, scrollable | Rich cards, column headers with WIP count, quick-add at bottom |
| Board (List) | Table layout with sorting | Inline editing, row hover actions |
| Board (Calendar) | Month/week grid | Tasks as colored blocks, drag to reschedule |
| Board (Gantt) | Timeline with dependency arrows | Zoom controls, milestone markers |
| My Tasks | Timeline groups (Today/This Week/etc.) | Grouped by time, quick checkoff |
| Dashboard | Widget grid | Charts, recent activity, overdue alerts |
| Settings | Tabbed layout | Clean forms, immediate save feedback |

### Interaction Patterns

- **Navigation**: Top bar for primary actions + left sidebar for workspace/board navigation
- **Task detail**: Full-page centered modal overlaying the board (board still visible behind blur)
- **Quick actions**: Command palette for power users, buttons for everyone else
- **Feedback**: Subtle toast messages for success, inline error messages for form validation
- **Transitions**: Smooth 150-200ms fade transitions between pages, no jarring jumps

---

## 6. What It Connects To

| Service | Purpose | Required? | Status |
|---------|---------|-----------|--------|
| PostgreSQL 16 | Primary database | Yes | Existing |
| Redis 7 | Sessions, cache, real-time messaging | Yes | Existing |
| MinIO | File storage (attachments, avatars) | Yes | Existing |
| Ollama (Qwen 8B) | AI features (task creation, summaries) | No | Deferred |
| Slack / Discord | Webhook notifications | No | Planned (Phase F) |
| Google Calendar | Task due date sync | No | Planned (Phase F) |
| Web Push API | Browser push notifications | No | Planned (Phase D) |

### Data Sources

- All data comes from the existing PostgreSQL database
- File attachments served from MinIO
- Real-time updates via existing WebSocket + Redis pub/sub infrastructure

### Import/Export

- Board import from CSV, JSON, and Trello format (backend exists, frontend needs wiring)
- Board export to CSV and JSON (backend exists, frontend needs wiring)
- Workspace export (backend exists, frontend needs building)

---

## 7. What It Does NOT Do

| Feature | Reason |
|---------|--------|
| AI-powered task creation and summaries | Deferred - needs GPU-equipped machine. Will add in future phase. |
| Offline mode | Not needed for under 100 users. Saves significant complexity. |
| Multiple languages (i18n) | English only for now. Can add later if user base demands it. |
| Full WCAG accessibility compliance | Minimal accessibility for now. Focus on core UX. |
| Mobile-native app | Desktop-first. Mobile browser works but isn't the priority. |
| Third-party integrations (Slack, Calendar) | Deferred to Phase F. Focus on core experience first. |
| White-label / custom branding | Not needed at this stage. |
| SAML/SSO enterprise auth | Small team focus. Not enterprise. |
| Custom domains per workspace | Not needed at this scale. |
| Billing / payment system | Business model is a future decision. No monetization yet. |

---

## 8. How We'll Know It Works

### Success Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Page load time | Under 200ms for common pages | Browser DevTools, Lighthouse |
| Task interaction speed | Under 200ms for create/update/move | Performance marks in code |
| Feature discoverability | All 7 orphaned features accessible from UI | Manual navigation test |
| First-time experience | New user creates first task within 2 minutes | Onboarding flow test |
| Command palette responsiveness | Results appear in under 100ms | Stopwatch test |
| Kanban column performance | Smooth at 50+ tasks per column | Manual scroll test |
| Virtual scroll list performance | Smooth at 500+ items | My Tasks with test data |
| Board settings completeness | All features accessible via tabs | Manual navigation |
| Non-tech usability | Non-tech person completes 3 tasks without help | User testing |
| Visual quality | Screenshots match professional quality of Trello/Notion | Side-by-side comparison |

### Definition of Done

- [ ] All 7 orphaned components are wired to navigation paths and accessible
- [ ] Workspace export has frontend UI
- [ ] Top navigation bar is implemented and functional
- [ ] Command palette works with Ctrl+K/Cmd+K
- [ ] Board settings use tabbed navigation
- [ ] Task cards show priority, due date, assignee, subtask progress, labels
- [ ] Kanban columns paginate at 20 tasks
- [ ] My Tasks list uses virtual scrolling
- [ ] Feature tour activates for first-time users
- [ ] Presence indicators show who's viewing a board
- [ ] Task editing lock prevents simultaneous edits
- [ ] Browser push notifications work for mentions and deadlines
- [ ] All pages load in under 200ms
- [ ] No console errors in production build

---

## 9. Business Model

**Current model:** Free / no monetization
**Future model:** To be decided after product is polished

**Current costs (VPS-hosted):**

| Cost | Monthly | Notes |
|------|---------|-------|
| VPS hosting | Already paid | Existing VPS |
| Domain (taskflow.paraslace.in) | Already paid | Existing domain |
| SSL certificate | Free | Let's Encrypt via Certbot |
| External services | $0 | Everything self-hosted |
| **Total** | **$0 incremental** | All improvements are code changes |

---

## 10. Risks & Concerns

| Risk | Likelihood | Impact | Analysis | Mitigation |
|------|-----------|--------|----------|------------|
| CDK virtual scroll + DnD incompatibility | CONFIRMED | MEDIUM | CDK does not support combining virtual scrolling with drag-and-drop. Already discovered in research. | Use paginate/collapse for DnD columns. Virtual scroll only for read-only lists (My Tasks, notifications). |
| PrimeNG styling limitations | LOW | MEDIUM | Some PrimeNG components have complex internal DOM that resists CSS customization. However, most visual chrome is already custom Tailwind. | Use PrimeNG mainly for form controls and overlays. Custom Tailwind for all visual elements (cards, navigation, layout). |
| Performance regression during refactor | MEDIUM | HIGH | Large-scale UI changes could introduce rendering bugs or bundle size increases. | Measure bundle size before/after each phase. Performance budget in angular.json catches regressions. Run Lighthouse after each batch. |
| Feature tour annoyance | MEDIUM | LOW | Overly aggressive onboarding could annoy experienced users. | Make tours dismissible, remember dismissed state, only show for new features or first-time users. |
| WebSocket message format mismatch | MEDIUM | MEDIUM | Backend broadcasts `{event, data}` but frontend reads `{type, payload}`. Adding presence/locking events needs consistent format. | Audit WebSocket message transformation layer end-to-end before adding new event types. |
| Board settings page complexity | LOW | MEDIUM | Converting to tabs + adding 6 more features could create a complex settings experience. | Good tab naming, logical grouping, minimal settings per tab. Progressive disclosure for advanced options. |
| Browser push notification permission | MEDIUM | LOW | Users might deny notification permissions, making push notifications useless. | Request permission at the right moment (after user explicitly enables notifications in settings, not on first visit). |
| Scope creep during "polish" phase | HIGH | MEDIUM | Polish work (animations, backgrounds, sounds) can expand infinitely. | Define specific deliverables per phase. Ship weekly. Mark "done" when defined criteria are met, not when "perfect." |

---

## PRD Approval Status

| Section | Status | Notes |
|---------|--------|-------|
| 1. What We're Building | PENDING | - |
| 2. The Problem | PENDING | - |
| 3. Who It's For | PENDING | - |
| 4. What It Does | PENDING | - |
| 5. How It Should Feel | PENDING | - |
| 6. What It Connects To | PENDING | - |
| 7. What It Does NOT Do | PENDING | - |
| 8. How We'll Know It Works | PENDING | - |
| 9. Business Model | PENDING | - |
| 10. Risks & Concerns | PENDING | - |
