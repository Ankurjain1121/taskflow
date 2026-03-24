# RESEARCH: H3 Onboarding Checklist — Competitor Analysis & Implementation Patterns
Generated: 2026-03-02
Stack: Angular 19 + TypeScript 5.7 + Tailwind CSS 4 + PrimeNG 19

---

## Competitor Comparison Table

| Tool | Approach | Position/UI | Items | Auto-Detect | Dismiss/Restore | Progress Indicator | Strengths | Weaknesses |
|------|----------|-------------|-------|-------------|-----------------|-------------------|-----------|------------|
| **Monday.com** | Dismissible action cards on dashboard home page; event-driven auto-check + manual | Embedded in dashboard, sticky until completed | 4-6 config + collab steps | Yes (syncs with product usage data) | Dismiss per card; re-appears until done | Per-card completion state | Event-driven auto-check is best-in-class; sticky persistence drives completion | Cards can feel cluttered on dashboard; no unified progress bar |
| **Asana** | "Complete these 8 tasks" action-driven flow + persona-based tooltips | In-product tasks + email sequence | 8 tasks | Yes (task completion triggers) | Can skip tasks | Step counter | Action-not-modal: users do real work while learning; persona-based personalization | 8 items is too many (research says >5 drops completion); email reliance |
| **Notion** | Checklist embedded IN demo content; completing checklist = learning the product | Inline on first page (not floating) | ~5 slash-command tasks | Yes (checklist items are interactive) | Can close page | Visual checklist checkmarks | Genius learn-by-doing: product IS the tutorial; zero separate UI | Only works for doc-centric tools; not transferable to kanban PM tools |
| **ClickUp** | Template-based onboarding; "Welcome Tour" -> "First Task" -> "Team Collaboration 101" stages | Embedded checklist with Docs tutorials | 3 stages, multi-task each | Automations follow up if user stalls | Skip stages | Stage-based progress | Structured stages prevent overwhelm; automation catches drop-offs | Over-engineered for simple PM; complex setup |
| **Linear** | Minimal: no explicit checklist; relies on intuitive UI + live onboarding sessions + video library | No floating panel | None (implicit) | N/A | N/A | N/A | Clean UX; trusts user intelligence; video library for self-serve | No guidance for non-technical users; poor for non-dev audiences |
| **Trello** | Welcome Board auto-generated with demo lists/cards; personalized board name during signup | Pre-populated board (inline) | Board structure IS the demo | Implicit (users interact with real board) | Delete welcome board | N/A | Product-in-action on day 1; zero cognitive overhead | No checklist per se; users may ignore welcome board; no progress tracking |
| **Jira** | Quickstart guide + native Action Items (2025); admin-managed checklist templates | Admin panel + issue-level checklists | Varies by template | Automation rules can auto-check | Admin controls | Step workflow (5-step) | Enterprise-grade; template reusability; automation | Complex setup; not self-serve for end users; admin dependency |
| **Basecamp** | Dedicated "Welcome, [name]!" project with to-do lists tailored to role | Project-based (inline) | Role-specific to-dos | Manager/buddy track alongside | Project can be archived | Project completion | Personalized per role; social (manager/buddy involved) | Requires manual setup per hire; not self-serve product onboarding |
| **Loom** | Collapsible home-page checklist; 4 steps (download, record, share, invite) | Home page, collapsible/restorable | 4 steps | Yes (product actions) | Collapse + restore button | Hybrid: steps-remaining bar + checklist | Best collapse/restore UX; minimal 4 steps; each connects to real action | Limited to simple products; 4 steps may not cover complex PM tools |
| **Slack** | Running checklist in sidebar; progressive setup tips | Sidebar widget | Progressive (unlocks over time) | Yes (channel creation, message sent) | Hides after completion | Progressive (steps unlock) | Progressive disclosure prevents overwhelm; sidebar always visible | Sidebar real estate cost; users may ignore |

---

## Winner Pattern Identification

### Primary Winner: Monday.com + Loom Hybrid

The optimal pattern for TaskBolt combines:

1. **Monday.com's event-driven auto-detection** — checklist items sync with actual product usage data, auto-completing when users perform actions elsewhere in the app
2. **Loom's collapsible/restorable floating panel** — non-blocking, dismissible, always restorable via a small pill button
3. **Loom's 4-step brevity** (extended to 5 for TaskBolt) — research shows >5 items causes completion rates to nosedive

### Why NOT the others:
- **Notion's embedded demo** — only works for doc-centric tools, not kanban boards
- **Asana's 8-item list** — too long; 5 items is the sweet spot
- **Linear's no-checklist** — TaskBolt targets non-tech users who need guidance
- **Trello's welcome board** — no progress tracking or explicit guidance
- **ClickUp's staged system** — over-engineered for a simple activation flow

---

## Key UX & Psychology Insights

### Completion Rate Data (2025 Benchmarks)

| Metric | Value | Source |
|--------|-------|--------|
| Average checklist completion rate | 19.2% (median 10.1%) | Userpilot 2025 Benchmark |
| With gamification (progress bar) | +20-30% lift | ProductLed, Flowjam |
| With Zeigarnik effect (pre-filled progress) | Additional +15-20% lift | Userpilot |
| Checklists >5 items | >50% of users drop off | Chameleon 2025 Benchmark |
| Users who complete onboarding | 80% more likely to become long-term customers | SaaS Factor |
| Users who complete onboarding | 3x higher lifetime value | Omnius |
| ProductFruits customers | 64% activation rate (with adaptive guidance) | ProductFruits |

### Must-Implement Psychology Patterns

1. **Zeigarnik Effect** — Humans remember incomplete tasks more than completed ones. Show progress bar with items already done to trigger completion drive.
2. **Endowed Progress Effect** — Start the progress bar at 20% (1/5 pre-completed) by auto-detecting an already-completed item on first load. Users who feel they've already started are 2x more likely to finish.
3. **Gamification via progress bar** — A visible progress bar increases completion by 20-30%. Use smooth width transitions for satisfying visual feedback.
4. **4-6 items sweet spot** — Research universally shows 3-5 tasks hit the sweet spot. 5 items for TaskBolt is within optimal range.
5. **Non-blocking, dismissible** — Checklist must never block UI. Collapsible + restorable is the gold standard (Loom pattern).

---

## Auto-Detection vs Manual Tracking

### Recommended Hybrid Approach (Monday.com pattern)

| Item | Detection Type | How |
|------|---------------|-----|
| Create your first task | **Auto-detect** | Check dashboard stats or `GET /api/tasks?limit=1` on init |
| Set a due date | **Auto-detect** | Check if any task has `due_date IS NOT NULL` via dashboard data |
| Drag a task between columns | **Manual flag** | Set localStorage flag in CDK drag-drop handler |
| Try keyboard shortcuts | **Manual flag** | Set localStorage flag when `?` shortcut modal opens |
| Invite a teammate | **Auto-detect** | Check `WorkspaceStateService` member count > 1 |

### Auto-Detection Best Practices

- Run auto-detection on service `initialize()`, not continuously
- Cache results: only re-check on page reload or explicit refresh
- Never reverse a completed item (even if the triggering data is deleted)
- Manual flags are set via `markComplete(itemId)` calls in existing handlers (1-line additions)

---

## Angular 19 Implementation Patterns

### Floating Panel: Fixed Position vs CDK Overlay

**Recommendation: Use CSS `position: fixed` (NOT CDK Overlay)**

Rationale:
- CDK Overlay is designed for dynamic positioning relative to trigger elements (dropdowns, tooltips, popovers)
- The onboarding checklist is a **static fixed-position panel** — always bottom-right, not attached to any element
- CSS `fixed` + Tailwind utilities (`fixed bottom-4 right-4`) is simpler, lighter, and requires zero CDK overhead
- CDK Overlay adds unnecessary complexity (OverlayRef, PortalOutlet, GlobalPositionStrategy) for a permanently positioned panel

### Signal Architecture (Angular 19 Modern API)

```typescript
// Service signals (not RxJS Subjects)
readonly items = signal<ChecklistItem[]>([...]);
readonly isDismissed = signal<boolean>(false);
readonly isSkipped = signal<boolean>(false);

// Computed signals (derived state)
readonly completedCount = computed(() => this.items().filter(i => i.completed).length);
readonly progress = computed(() => Math.round((this.completedCount() / this.totalCount()) * 100));
readonly shouldShow = computed(() => !this.isSkipped() && !this.allComplete());

// Effect for localStorage persistence
effect(() => {
  const state = { items: ..., dismissed: ..., skipped: ... };
  localStorage.setItem(`tf_checklist_${userId}`, JSON.stringify(state));
});
```

### Standalone Component Pattern

```typescript
@Component({
  selector: 'app-onboarding-checklist',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },  // Required for fixed positioning
  template: `...`
})
```

### Animation Pattern (CSS-only, no Angular animations module)

```css
/* Slide-in from right */
@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.checklist-panel { animation: slideInRight 0.3s ease-out; }

/* Progress bar smooth fill */
.progress-fill { transition: width 500ms ease-out; }

/* Item completion flash */
.item-complete { animation: greenFlash 0.4s ease-out; }
@keyframes greenFlash {
  0% { background-color: transparent; }
  50% { background-color: rgba(34, 197, 94, 0.15); }
  100% { background-color: transparent; }
}
```

---

## Open-Source Libraries & Patterns Evaluated

### Libraries Considered (and why NOT to use them)

| Library | Type | Why NOT for TaskBolt |
|---------|------|---------------------|
| OnboardJS | React-only headless onboarding engine | React-only; no Angular adapter; adds unnecessary dependency |
| Shepherd.js | Step-by-step product tours | Tooltip-based tours, not checklist panels; that's H4, not H3 |
| Driver.js | Lightweight product tours | Same — tour library, not checklist |
| Intro.js | Product tours + tooltips | Commercial license required; tour-focused, not checklist |
| Appcues | SaaS onboarding platform | Third-party hosted service; unnecessary for a self-hosted checklist |
| Userpilot | Onboarding + analytics platform | Same — external SaaS; overkill |
| ProductFruits | Onboarding widget | Same — external hosted widget |

### Recommendation: Build Custom (No External Dependencies)

**Zero new npm dependencies required.** The checklist is:
- A single Angular service (~150 lines) + single component (~200 lines)
- Uses only Angular signals, computed, effect (already in `@angular/core`)
- Uses only CSS for animations (no `@angular/animations` module needed)
- Uses localStorage for persistence (built-in browser API)
- All styling via Tailwind CSS (already installed) + CSS custom properties (already in use)

This matches the existing TaskBolt pattern: custom components > third-party widgets.

---

## Competitor Pattern Deep Dive

### Monday.com (Primary Reference)

**What they do right:**
- Dashboard home page is the onboarding hub — action cards for config tasks (enable notifications, upload profile photo, invite teammate)
- Event-driven: items auto-complete when user performs the action anywhere in the product
- Sticky: cards persist until completed or explicitly dismissed
- Includes "collaboration steps" — inviting teammates is always an early item (drives viral adoption)

**What TaskBolt should copy:**
- Event-driven auto-detection for 3/5 items
- Dashboard as the checklist home (not a separate page)
- Invite teammate as a checklist item (viral loop)

**What TaskBolt should improve:**
- Monday.com uses separate action cards (no unified panel) — TaskBolt uses a unified panel with progress bar
- Monday.com has no collapse/restore — TaskBolt adds Loom-style collapse

### Loom (Secondary Reference)

**What they do right:**
- 4 steps only (download, record, share, invite) — each is a real product action
- Home page placement — easy to spot
- Collapsible + restorable — non-blocking, user controls visibility
- Hybrid progress: steps-remaining bar + checkmark list
- Each step connects to real product action (not abstract "learn about X")

**What TaskBolt should copy:**
- Collapse to pill button with "(N/5)" count
- Click pill to re-expand
- Each item has CTA button linking to the actual feature

### Slack (Tertiary Reference)

**What they do right:**
- Progressive disclosure — steps unlock as user completes earlier ones
- Sidebar placement keeps checklist always visible

**What TaskBolt should note:**
- Progressive unlocking is overkill for 5 items — all items visible from start is fine
- Sidebar placement costs real estate — floating bottom-right is better

---

## Recommended Positioning & Layout

### Panel Placement: Bottom-Right Fixed

**Why bottom-right:**
- Does not overlap sidebar (left side) or top nav (top)
- Familiar pattern: Intercom, Drift, Crisp chat widgets all use bottom-right
- Users expect help/onboarding content in bottom-right
- Does not interfere with main content scrolling
- Mobile: full-width bottom sheet (below 640px)

### Dimensions

| State | Desktop | Mobile (<640px) |
|-------|---------|-----------------|
| Expanded panel | 360px wide, max-height 80vh, bottom-right | Full width, bottom sheet |
| Collapsed pill | ~200px wide pill button, bottom-right | Same, centered |

### Z-Index

- Panel: `z-50` (above content, below modals)
- Pill button: `z-50` (same level)
- Ensure it sits below PrimeNG dialog overlays (`z-[1000]`)

---

## Implementation Checklist (from research)

### Must-Have (research-validated)
- [x] 5 items (within 3-5 optimal range)
- [x] Progress bar with percentage
- [x] Auto-detection for 3/5 items (Monday.com pattern)
- [x] Dismiss + restore (Loom pattern)
- [x] Skip all option
- [x] localStorage persistence
- [x] Fixed bottom-right positioning
- [x] CTA buttons linking to real features
- [x] Non-blocking (never covers UI content)

### Should-Have (increases completion rates)
- [ ] Endowed Progress Effect: on first load, if any item is already complete, show progress pre-filled (users feel they've already started)
- [ ] Smooth animations: slide-in, progress bar transition, completion flash
- [ ] Celebration message on 100% ("You're all set!") — brief, not confetti (save confetti for I3)
- [ ] Help page "Restart checklist" button

### Nice-to-Have (Phase 2+)
- [ ] Backend persistence via `user_preferences.onboarding_checklist` JSONB column
- [ ] Analytics: track which items users skip, average completion time
- [ ] A/B test: 5 items vs 3 items

---

## Sources

### Competitor Analysis
- [Monday.com Onboarding Flow Analysis (Candu)](https://www.candu.ai/blog/monday-com-onboarding-flow)
- [Notion Onboarding Analysis (Candu)](https://www.candu.ai/blog/how-notion-crafts-a-personalized-onboarding-experience-6-lessons-to-guide-new-users)
- [Notion Lightweight Onboarding (Appcues)](https://goodux.appcues.com/blog/notions-lightweight-onboarding)
- [Linear FTUX Breakdown (Medium)](https://fmerian.medium.com/delightful-onboarding-experience-the-linear-ftux-cf56f3bc318c)
- [Linear Onboarding Flow (PageFlows)](https://pageflows.com/post/desktop-web/onboarding/linear/)
- [Trello Onboarding Flow (Candu)](https://www.candu.ai/blog/designing-a-seamless-sign-up-experience-6-lessons-from-trellos-onboarding-flow)
- [Basecamp Welcoming Walkthrough (Appcues)](https://goodux.appcues.com/blog/basecamps-welcoming-walkthrough)
- [ClickUp New User Onboarding Template](https://clickup.com/templates/new-user-onboarding-t-900902337986)
- [Jira Checklist 2025 Updates (Atlassian Community)](https://community.atlassian.com/forums/App-Central-articles/Jira-Checklist-2025-What-changed-What-s-New/ba-p/2987023)

### Completion Rates & UX Best Practices
- [Userpilot 2025 Checklist Completion Rate Benchmarks](https://userpilot.com/blog/onboarding-checklist-completion-rate-benchmarks/)
- [Progress Bar Psychology (Userpilot)](https://userpilot.com/blog/progress-bar-psychology/)
- [SaaS Onboarding Best Practices 2025 (Insaim)](https://www.insaim.design/blog/saas-onboarding-best-practices-for-2025-examples)
- [SaaS Onboarding Best Practices 2025 (Flowjam)](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist)
- [SaaS Onboarding Best Practices 2025 (ProductLed)](https://productled.com/blog/5-best-practices-for-better-saas-user-onboarding)
- [Chameleon 2025 Onboarding Benchmark Report](https://www.chameleon.io/benchmark-report)
- [Onboarding Gamification Examples (Userpilot)](https://userpilot.com/blog/onboarding-gamification/)
- [Product-Led Onboarding 2025 (Product School)](https://productschool.com/blog/product-strategy/product-led-onboarding)

### Floating Panel & Dismiss/Restore Patterns
- [Onboarding UX Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/onboarding-ux/)
- [Loom Checklist Pattern Analysis (Appcues)](https://www.appcues.com/blog/saas-onboarding-screens)
- [Onboarding Checklists Templates (Candu)](https://www.candu.ai/template-category/onboarding-checklists)
- [ProductFruits Onboarding Checklist](https://productfruits.com/product/onboarding-checklist)
- [SaaS Onboarding UI Examples (SaaSFrame)](https://www.saasframe.io/categories/user-onboarding)

### Progressive Disclosure
- [Progressive Disclosure in UX (LogRocket)](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- [Progressive Disclosure Examples (Userpilot)](https://userpilot.com/blog/progressive-disclosure-examples/)
- [Progressive Disclosure in SaaS UX (Lollypop Design)](https://lollypop.design/blog/2025/may/progressive-disclosure/)

### Angular 19 Implementation
- [Angular CDK Overlay v19+ Tutorial (Brian Treese)](https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/)
- [Angular CDK Overlay Positioning v19+ (Brian Treese)](https://briantree.se/angular-cdk-overlay-tutorial-positioning/)
- [Angular Material CDK Overlay Overview](https://material.angular.dev/cdk/overlay/overview)
- [Angular Material Overlay Complete Guide 2026](https://copyprogramming.com/howto/angular-material-overlay)

### Open-Source Libraries Evaluated
- [OnboardJS (Headless React Onboarding)](https://onboardjs.com/)
- [5 Best React Onboarding Libraries 2026 (OnboardJS)](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [Best Open-Source Product Tour Libraries (UserOrbit)](https://userorbit.com/blog/best-open-source-product-tour-libraries)

### Auto-Detection & Event Tracking
- [Event Data for SaaS (Userpilot)](https://userpilot.com/blog/event-data/)
- [Product Analytics for User Onboarding (Piwik PRO)](https://piwik.pro/blog/product-analytics-track-user-onboarding/)
- [Self-Service SaaS Onboarding Guide (Candu)](https://www.candu.ai/blog/the-complete-guide-to-self-service-saas-onboarding)
