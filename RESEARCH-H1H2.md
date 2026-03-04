# RESEARCH: H1 Empty State Design + H2 Sample Data on Signup
Generated: 2026-03-02
Stack: Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19, Rust 1.93/Axum 0.8, PostgreSQL 16

---

## INSTALL

```bash
cd /home/ankur/taskflow/frontend && npm i driver.js
```

One new dependency. Everything else already in the stack or custom-built.

---

## DEPENDENCIES

| package | version | purpose |
|---------|---------|---------|
| driver.js | 1.4.0 | Product tour engine (~5KB gzip, MIT, 441K dl/wk) |

## ALREADY IN STACK (no install needed)

| package | purpose |
|---------|---------|
| PrimeNG 19 | Tooltips, toasts, buttons |
| Angular CDK 19 | Overlay for feature discovery popovers |
| Tailwind CSS 4 | All styling |

## OPTIONAL

| package | version | purpose |
|---------|---------|---------|
| ngx-lottie | 13.0.1 | Animated empty state illustrations (adds ~50KB) |

---

## COMPETITOR ANALYSIS: H1 — EMPTY STATE DESIGN

### Winner Patterns by Type

| Empty State Type | Best Example | Pattern |
|------------------|-------------|---------|
| **First-use / Onboarding** | Notion | Template-as-tutorial: empty state doubles as interactive checklist |
| **Kanban-specific** | Trello | Pre-populated welcome board — never show empty board to new users |
| **User-cleared / Celebratory** | Todoist | #TodoistZero: warm illustration + "All caught up!" + social moment |
| **No search results** | Notion | Gentle alternative suggestion: "Try searching for something else" |
| **Inline section** | Asana | Inline guidance replacing tooltips: "Start building in 2 minutes" |

### Full Competitor Matrix

| Product | Illustration? | CTA? | Teaches product? | Copy tone |
|---------|--------------|------|-------------------|-----------|
| Notion | Minimal, monochrome | Yes (template links) | Heavy (learn-by-doing) | Clean, instructional |
| Asana | Custom branded + GIFs | Yes (action-framed) | Moderate (why + how) | Encouraging, speed-focused |
| Linear | Static monochrome SVG | Yes (single CTA) | Minimal (trust the UI) | Direct, sparse |
| ClickUp | Branded colorful | Yes (Get Started) | Moderate (contextual) | Helpful |
| Monday.com | Colorful branded | Yes (dual-path: template OR scratch) | Strong (template-driven) | Motivational |
| Trello | Board IS the illustration | Yes (first card = instruction) | Very strong (learn-by-doing) | Casual, playful |
| Airtable | N/A (wizard prevents blank) | Yes (wizard + checklist) | Strong (wizard teaches) | Time-transparent |
| Todoist | Muted, peaceful | Celebratory (not action) | Minimal (empty = reward) | Zen, warm |

### Conversion Data

| Metric | Impact | Source |
|--------|--------|--------|
| Optimized empty states | **60% activation improvement**, 25% churn reduction | SaaS Factor |
| Customer lifetime value | **30-40% higher CLV** | SaaS Factor |
| 25% activation increase | **34% rise in MRR** over 12 months | Userpilot |
| Time to first value | **Under 2 minutes** ideal | ProductLed |
| Pre-loaded demo data | **Beats text tooltips** for engagement | ProductLed |

### Recommended Empty State Anatomy

```
┌──────────────────────────────────────────┐
│                                          │
│        [SVG Illustration]                │
│        (unDraw, brand-colored)           │
│                                          │
│   Headline (16-18px, semibold)           │
│   "No tasks in this column yet"          │
│                                          │
│   Body (14px, muted gray)               │
│   "Drag tasks here or press N            │
│    to create a new one"                  │
│                                          │
│   [ + Create Task ]  (Primary CTA)       │
│                                          │
│   Shortcut hint: "Press N" (badge)       │
│                                          │
└──────────────────────────────────────────┘
```

Spacing: 16px illustration→headline, 8px headline→body, 16px body→CTA.

---

## COMPETITOR ANALYSIS: H2 — SAMPLE DATA ON SIGNUP

### Signup Survey Comparison

| Product | Survey? | Questions | Use-case categories | Auto-populates data? |
|---------|---------|-----------|--------------------|--------------------|
| Monday.com | Yes | 1-at-a-time animated | Projects, CRM, Marketing, Design, Software, IT, Ops, HR | Yes (full boards) |
| Notion | Yes | 3-path (Personal/School/Team) | By function | Yes (5 templates) |
| Asana | Yes | Role + function | Marketing, Engineering, IT, etc. | No (user creates own) |
| Airtable | Yes | Role + AI prompt (2025) | AI-generated from description | Yes (AI-generated base) |
| ClickUp | Yes | 7-step survey | Engineering, Marketing, Ops, Personal | Template-based |
| Linear | No | None (opinionated) | Assumes software team | Yes (demo workspace) |
| Trello | No | Minimal | N/A | 3 empty lists only |
| Todoist | Minimal | N/A | N/A | Welcome project (5-7 tasks) |
| Jira | Yes | Project type (Scrum/Kanban) | Dozens of templates | Opt-in sample board |

### Sample Data Quantities

| Product | Sample items | Realistic? | Deletable? | Time to product |
|---------|-------------|-----------|-----------|----------------|
| Monday.com | 10-20+ rows | Yes | Individual delete | ~1 min |
| Notion | 5 templates + guide | Yes (functional) | Page deletion | ~50s personal |
| Linear | ~10-15 issues | Yes (perfection model) | Delete-to-replace | ~2 min |
| Todoist | 5-7 tasks | Instructional | Complete/delete | ~1 min |
| Airtable | Variable (AI) | Contextual | Modify/delete | ~1 min |

### Key Metrics

| Metric | Value | Source |
|--------|-------|--------|
| Users who complete onboarding | **80% more likely** to become long-term customers | Chameleon |
| Completed onboarding users | **3x higher LTV** | Onramp |
| 30% TTV reduction | **15-25% conversion increase** | OpenView |
| 3-step tours | **72% completion rate** | Appcues |
| 7-step tours | **16% completion rate** (massive drop-off) | Appcues |
| Personalized onboarding | **30% more engagement** | UserPilot |
| Average checklist completion | **19.2%** (median 10.1%) | UserPilot |
| Checklist completers | **3x more likely** to convert to paid | UserPilot |
| Users inactive within 2 weeks | **98%+** | Amplitude |

---

## WHAT ALREADY EXISTS IN TASKFLOW

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| EmptyStateComponent | Built, **UNUSED** | `shared/components/empty-state/` | 7 variants, 211 lines, only in spec file |
| Onboarding wizard | Fully implemented | `features/onboarding/` | 3-step full + 2-step abbreviated flow |
| OnboardingService | Fully implemented | `core/services/onboarding.service.ts` | 5 API methods |
| Sample board (backend) | Fully implemented | `backend/crates/services/src/sample_board.rs` | 4 columns, 6 tasks, 3 labels |
| Onboarding API | Fully implemented | `backend/crates/api/src/routes/onboarding.rs` | 5 endpoints, 361 lines |
| Help page | Fully implemented | `features/help/help.component.ts` | Getting started, features, FAQ, shortcuts |
| Shortcut help modal | Fully implemented | `shared/components/shortcut-help/` | ? key trigger, search, categories |
| **Tour system** | **NOT implemented** | N/A | No tour library, no guided walkthrough |
| **Contextual tooltips** | **NOT implemented** | N/A | No "Did you know?" system |
| **Feature discovery** | **NOT implemented** | N/A | No progressive disclosure |
| **Onboarding checklist** | **NOT implemented** | N/A | No getting-started tracker |

### Critical Finding: 18 Empty State Locations Use Ad-Hoc Inline HTML

The existing EmptyStateComponent is never used in production. All empty states are scattered inline HTML:
- Kanban columns, dashboard, workspace, favorites, notifications
- Board sub-views (list, gantt, swimlane)
- Workspace settings (labels, teams, API keys)
- Milestones, time tracking, custom fields, comments, activity

---

## LIBRARY DECISIONS

### Tour Library: driver.js v1.4.0

| Criterion | driver.js | shepherd.js | intro.js |
|-----------|-----------|-------------|----------|
| License | **MIT** | AGPL-3.0 | AGPL-3.0 |
| Bundle | **~5KB gzip** | ~15KB | ~12KB |
| Downloads/wk | **441K** | 229K | 187K |
| Dependencies | **Zero** | Multiple | Multiple |
| Angular 19 | Works (DOM-based) | Via wrapper | No wrapper |
| Commercial use | **Free** | Paid license required | Paid license required |

**driver.js wins on every dimension.** AGPL on shepherd/intro is a deal-breaker for commercial SaaS.

### Illustration Source: unDraw

- Free for commercial use, no attribution required
- SVG format with on-site color customization (match TaskFlow brand)
- Consistent visual style across 500+ illustrations
- Zero runtime cost (static SVG assets)

### Tooltips: CDK Overlay + PrimeNG (already installed)

- Zero additional bundle size
- Full control over feature discovery UX
- Signal-compatible dismiss tracking

### Checklist: Custom build with Angular signals + localStorage

- No library needed — straightforward UI
- `signal()` + `effect()` for automatic localStorage persistence
- `computed()` for progress percentage

---

## ARCHITECTURE PATTERNS (from open-source PM tools)

### Empty State Component (Plane pattern adapted for Angular)

```
shared/components/empty-state/
  empty-state.component.ts          # Unified component (compact + detailed modes)
  empty-state-config.ts             # Data-driven variant registry (18 variants)
  empty-state.types.ts              # Shared interfaces
```

**Key pattern: Data-driven config map**
```typescript
// empty-state-config.ts
export const EMPTY_STATE_CONFIG: Record<string, EmptyStateVariant> = {
  'kanban-column': {
    title: 'No tasks yet',
    description: 'Drag tasks here or press N to create',
    icon: 'pi-inbox',
    size: 'compact',
    shortcutHint: 'N',
  },
  'dashboard': {
    title: 'Welcome to TaskFlow',
    description: 'Create your first board to get started',
    icon: 'pi-th-large',
    ctaLabel: 'Create Board',
    size: 'detailed',
  },
  // ... 16 more variants
};
```

### Onboarding State Service (Signal-based)

```typescript
@Injectable({ providedIn: 'root' })
export class OnboardingStateService {
  private readonly state = signal<OnboardingState>(this.load());

  readonly progress = computed(() => this.state().completedSteps.length / TOTAL_STEPS);
  readonly showChecklist = computed(() => !this.state().dismissed && this.progress() < 1);

  constructor() {
    effect(() => localStorage.setItem('tf_onboarding', JSON.stringify(this.state())));
  }

  completeStep(id: string) {
    this.state.update(s => ({
      ...s,
      completedSteps: [...new Set([...s.completedSteps, id])],
    }));
  }
}
```

### Backend Seeding (Plane pattern adapted for Rust)

- JSON seed files in `backend/crates/db/src/seeds/data/`
- ID mapping dictionaries for cross-entity references
- Bot user attribution (not workspace creator)
- Single transaction for atomicity
- Configurable per use-case template

---

## TOP 10 RULES FOR IMPLEMENTATION

1. **4 empty state variants minimum**: First-use, no-results, user-cleared (celebratory), error. Each TaskFlow view needs its own contextual empty state.

2. **Pre-populate 1 sample board with 8-12 realistic tasks**: Spread across columns, with priorities, due dates, labels. Label with "Sample" banner. One-click delete.

3. **Keep onboarding to 3-5 steps max**: 3-step = 72% completion vs 16% for 7 steps. Target: use-case question → explore board → create first task.

4. **Personalize via 1-question survey**: "What will you use TaskFlow for?" → maps to 4 templates (Software Dev, Marketing, Personal, Design). 30% more engagement.

5. **Reach aha moment in first session**: For PM tools = "teammate notified someone completed a task." Drive to: create task + invite teammate.

6. **Copy: encouraging + instructional**: "You haven't created any boards yet" not "No data." Single headline + explanation + single CTA. Clarity over cleverness.

7. **Use flat/minimal SVGs from unDraw**: Brand-colored, contextual per feature. Not bright or distracting. Zero runtime cost.

8. **Single primary CTA per empty state**: Illustration → headline → explanation → button. Max 2 actions. Generous whitespace.

9. **Accessibility from day one**: `role="status"` + `aria-live="polite"` for dynamic states. `aria-describedby` for tooltips. Escape dismissal. `prefers-reduced-motion`. Keyboard nav.

10. **Sample data must be easily removable**: Prominent "Clear sample data" action. Auto-suggest clearing after user creates 3+ own tasks. `is_sample` flag on boards.

---

## SOURCES

### Empty State UX
- [NN/g - Designing Empty States](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Material Design - Empty States](https://m1.material.io/patterns/empty-states.html)
- [Carbon Design System - Empty States](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Eleken - Empty State UX Rules](https://www.eleken.co/blog-posts/empty-state-ux)
- [Toptal - Empty States UX](https://www.toptal.com/designers/ux/empty-state-ux-design)

### Competitor Analysis
- [Appcues - Trello Demo Board](https://goodux.appcues.com/blog/trellos-demo-kanban-board)
- [UserOnboarding - Asana Empty States](https://useronboarding.academy/user-onboarding-inspirations/asana-empty-state-onboarding)
- [Candu - Monday.com Onboarding](https://www.candu.ai/blog/monday-com-onboarding-flow)
- [Candu - Notion Personalized Onboarding](https://www.candu.ai/blog/how-notion-crafts-a-personalized-onboarding-experience-6-lessons-to-guide-new-users)
- [Candu - Linear Anti-Onboarding](https://www.candu.ai/blog/the-anti-onboarding-strategy-how-linear-converts-philosophy-into-product-adoption)
- [Candu - Airtable Wizard](https://www.candu.ai/blog/airtables-best-wizard-onboarding-flow)

### Activation & Conversion Data
- [Userpilot - Activation Metrics](https://userpilot.com/blog/activation-metrics-saas/)
- [SaaS Factor - Empty State Activation](https://www.saasfactor.co/blogs/empty-state-ux-turn-blank-screens-into-higher-activation-and-saas-revenue)
- [Amplitude - Time to Value](https://amplitude.com/blog/time-to-value-drives-user-retention)
- [Appcues - Checklist Completion](https://www.appcues.com/blog/best-checklist-examples)
- [UserPilot - Checklist Benchmarks 2025](https://userpilot.com/blog/onboarding-checklist-completion-rate-benchmarks/)
- [Agile Growth Labs - Activation Benchmarks 2025](https://www.agilegrowthlabs.com/blog/user-activation-rate-benchmarks-2025/)

### Libraries
- [driver.js (MIT)](https://driverjs.com) — [GitHub](https://github.com/kamranahmedse/driver.js)
- [unDraw Illustrations](https://undraw.co/) — [License](https://undraw.co/license)
- [ngx-lottie](https://github.com/ngx-lottie/ngx-lottie)

### Architecture References
- [Plane GitHub (40k stars)](https://github.com/makeplane/plane) — empty states, workspace seeding
- [Focalboard GitHub (22k stars)](https://github.com/mattermost-community/focalboard) — onboarding tours, template duplication

### Accessibility
- [W3C WAI - Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- [W3C - ARIA22 role=status](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
- [W3C - prefers-reduced-motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39)
- [MDN - ARIA Live Regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)
