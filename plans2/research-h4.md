# Research H4: Product Tours / Contextual Tooltips

> Generated: 2026-03-02 | Stack: Angular 19 + CDK + Tailwind CSS 4 + PrimeNG 19
> Context: TaskBolt project management SaaS — non-tech-savvy target audience

---

## 1. Competitor Comparison

### How Top PM Tools Implement Product Tours & Contextual Help

| Tool | Approach | Tour Type | Strengths | Weaknesses |
|------|----------|-----------|-----------|------------|
| **Asana** | Empty states as teaching moments; no modal tours; inline micro-copy; guided task creation onboarding ("Complete these 8 tasks") | Contextual / action-driven | 3x higher completion vs linear tours; cleanest UX; users productive in first session; non-blocking | No spotlight overlays; no microvideos; relies heavily on good empty-state copy |
| **Monday.com** | Dismissible action cards on dashboard; AI onboarding agent ("monday Expert" launching 2026); template suggestions; sticky checklist sidebar | Checklist + AI agent | Sticky until completed; re-openable; progressive; AI-powered personalization coming | Heavier UX; action cards can feel intrusive; AI agent not yet shipped |
| **ClickUp** | Template suggestions on empty workspace; short quiz -> video tutorials (core modules); onboarding checklist | Quiz + video + checklist | Good for visual learners; covers hierarchy/tasks/views/inbox; template-first prevents blank canvas | Video-heavy (requires content creation); overwhelming for simple use cases |
| **Linear** | Minimal UI; relies on discoverability; live onboarding sessions; learning library videos; formal onboarding -> 73% faster productivity | Documentation + live sessions | Clean, non-intrusive; teams report high productivity gains | No in-app tours; no contextual tooltips; relies on external docs/videos |
| **Trello** | Welcome Board pre-loaded; 4-step navigation intro tour (tooltips/overlays); asks user to opt into new navigation at end | Welcome board + short tooltip tour | Product-in-action on day 1; short tour (4 steps); opt-in choice at end | Tour limited to navigation; no contextual feature discovery post-onboarding |
| **Notion** | Slash-command discovery via demo checklist; modular onboarding (choose learning path); template recommendations; empty states as tutorials | Demo content + progressive disclosure | Modular = personalized; empty states double as education; removes blank-page anxiety | Steep learning curve despite onboarding; no spotlight tours; complex product surface area |
| **Jira** | Onboarding elements embedded in everyday UI; non-disruptive; admin-panel configuration | Embedded in-context | Non-disruptive; appears in normal workflow | Enterprise-focused; complex admin config; limited per-user customization |
| **Figma** | Animated tooltip sequence; brief copy + feature animation in each tooltip; links to docs for complex features; hover tooltips + help sidebar (always-on) | Animated tooltips + always-on help | Concise copy; animation illustrates feature; non-blocking; always-accessible help sidebar | Requires animation assets; tooltip-heavy can overwhelm if too many |

### Winner Pattern Identification

**Primary winner: Asana pattern** -- contextual, non-blocking, action-driven.
- Empty-state micro-copy as teaching moments (40%+ activation rates vs 25-30% industry norm)
- No forced modal tours (modals get 40% dismissed on sight -- Chameleon 2025 data)
- Hover tooltips with shortcut hints on advanced features
- First-run-only contextual overlays (skippable)

**Secondary influence: Figma pattern** -- animated tooltips with brief copy.
- Tooltip copy kept brief; links to docs for complex features
- Always-accessible ? help sidebar
- Action-triggered (tooltip after user completes specific action)

**Anti-patterns to avoid:**
- ClickUp's video-heavy approach (requires content infrastructure)
- Linear's documentation-only approach (no in-app guidance)
- Long sequential tours >5 steps (completion drops sharply -- Chameleon data)

---

## 2. Product Tour UX: Key Statistics (2025-2026)

| Metric | Value | Source |
|--------|-------|--------|
| Average tour completion rate | 61% | Chameleon 2025 (15M interactions) |
| Modal dismiss rate (on sight) | ~40% | Chameleon 2025 Benchmark |
| Embedded vs popup action rate | 1.5x higher for embedded | Chameleon 2025 Benchmark |
| Self-serve tour completion lift | 123% higher | Chameleon 2025 Benchmark |
| Checklist-triggered tour completion | 21% above average | Chameleon 2025 Benchmark |
| Launcher-driven tour completion | 67% | Chameleon 2025 Benchmark |
| Progress indicator completion boost | +12% | Chameleon 2025 Benchmark |
| Progress indicator dismissal reduction | -20% | Chameleon 2025 Benchmark |
| Max steps before sharp abandonment | 5 | Chameleon 2025 (top 1% tours) |
| Optimal embedded copy length | Max 26 words | Chameleon 2025 Benchmark |
| Interactive onboarding activation lift | 30-40% | Mailmodo / Whatfix 2025 |
| Paid conversion lift from tours | 65% higher | Jimo 2025 case study |
| Activation rate with checklists | 40%+ (vs 25-30% norm) | SaaS Factor 2025 |
| Empty state signup-to-setup improvement | +47% | Eleken case study |
| Users lost in first week (poor onboarding) | 80% | SaaS Factor 2025 |

### Non-Blocking vs Blocking Tours

**Non-blocking (contextual/embedded) wins decisively:**
- Users 1.5x more likely to act on embedded experiences vs pop-ups
- 40% of modals dismissed on sight (within 4 seconds)
- Self-serve (user-initiated) tours: 123% higher completion than auto-triggered
- Top 1% tours: no forced walkthroughs, event-based triggering, max 5 steps
- Contextual guidance users are 123% more likely to complete tours

**Recommended for TaskBolt:** Non-blocking contextual hints + optional (user-skippable) 3-step spotlight on first run.

---

## 3. Spotlight/Coach Mark Implementation Approaches

### SVG Mask vs CSS box-shadow vs Canvas

| Approach | How It Works | Performance | Flexibility | Recommended? |
|----------|-------------|-------------|-------------|-------------|
| **SVG Mask** | Full-screen SVG with `<mask>`: white rect covers all, black rect creates cutout. Applied via `mask="url(#id)"` | Good -- GPU-composited; minimal repaints. Single SVG element | Rounded corners via `rx`; smooth transitions; arbitrary shapes possible | **YES -- Best for TaskBolt** |
| **CSS box-shadow** | Element gets `box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` to cover viewport | **Poor** -- massive box-shadow causes heavy paint; Firefox: 2fps on fixed elements; smartphones unusable | Simple to implement; limited to element shape only | NO -- performance bottleneck |
| **Canvas** | Draw semi-transparent rect on canvas, clear a region for spotlight | Good render perf; GPU-accelerated | Requires manual coordinate math; no DOM event passthrough; accessibility issues | NO -- accessibility/complexity tradeoff |
| **CSS clip-path** | `clip-path: polygon(...)` on overlay div to create cutout | Good -- GPU-composited | Complex polygon math for rounded rects; no `rx` equivalent | NO -- math complexity for rounded cutouts |

### SVG Mask Implementation Pattern (Chosen Approach)

```html
<svg class="fixed inset-0 w-full h-full pointer-events-none z-[60]">
  <defs>
    <mask id="spotlight-mask">
      <rect width="100%" height="100%" fill="white"/>
      <rect [attr.x]="spotX" [attr.y]="spotY"
            [attr.width]="spotW" [attr.height]="spotH"
            rx="8" fill="black"/>
    </mask>
  </defs>
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)"
        mask="url(#spotlight-mask)" pointer-events="all"/>
</svg>
```

**Why SVG Mask wins:**
- GPU-composited rendering (no layout thrashing)
- Native `rx` for rounded corners on cutout
- Single DOM element (vs box-shadow repaint storms)
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)
- Easy to animate cutout position with CSS transitions or Angular signals
- `pointer-events="all"` on overlay blocks interaction outside spotlight
- Can add smooth transition on rect position via `transition` attribute or Angular animation

**Key implementation notes:**
- Use `ResizeObserver` to track target element position changes
- Add 8px padding around target element for visual breathing room
- Transition cutout position with CSS `transition` on rect attributes (or recalculate in signal)
- Keep SVG inline (not external file) to avoid CORS issues with mask references

---

## 4. Open-Source Tour Library Comparison

### Library Comparison Table

| Library | Version | Bundle Size | License | Angular Support | Dependencies | Positioning | Approach |
|---------|---------|-------------|---------|-----------------|--------------|-------------|----------|
| **Driver.js** | 1.4.0 | ~5 KB gzipped | MIT (free commercial) | Framework-agnostic (no wrapper needed) | Zero | CSS-based (box-shadow) | Highlight + popover |
| **Shepherd.js** | 14.5.1 | ~30 KB gzipped | Commercial license required | `angular-shepherd` wrapper (untested on Angular 19) | @floating-ui/dom | Floating UI | Step-based tour |
| **Intro.js** | 8.3.2 | ~10-12.5 KB | AGPL (commercial license $9.99+) | `angular-intro.js` wrapper exists | Zero | CSS-based | Step-based tour |
| **Onborda** | Latest | Small | MIT | Next.js only (not Angular compatible) | Framer Motion | Framer Motion | React/Next.js only |
| **TourGuide.js** | Latest | Small | MIT | Framework-agnostic | Zero | CSS-based | Promise-driven steps |

### Analysis for TaskBolt (Angular 19)

**Driver.js:**
- Pros: Smallest bundle (5KB), MIT license, zero deps, TypeScript-native, works in Angular without wrapper
- Cons: Uses CSS box-shadow for spotlight (performance concern on mobile); no Angular-specific API; imperative style clashes with Angular signal patterns
- Verdict: Good library but box-shadow approach is a performance risk

**Shepherd.js:**
- Pros: Most customizable, uses Floating UI (modern positioning), extensive API, angular-shepherd wrapper exists
- Cons: Commercial license needed; angular-shepherd "not tested" beyond Angular 8; 30KB bundle; wrapper may break on Angular 19 standalone components
- Verdict: Licensing + Angular 19 compatibility risk

**Intro.js:**
- Pros: Mature, stable, Angular wrapper exists, ready-made themes
- Cons: AGPL license (viral) or paid commercial; limited advanced features; imperative API
- Verdict: License is problematic for SaaS

### Recommendation: Custom Implementation (No External Library)

**Rationale:**
1. **TaskBolt already has `@angular/cdk` (Overlay, Portal, A11y)** -- this provides everything needed for positioning
2. **SVG mask approach is superior** to box-shadow (which Driver.js uses) for performance
3. **Signal-based architecture** in plan-h4.md integrates cleanly with Angular 19 patterns
4. **No licensing concerns** -- CDK is MIT
5. **Full control** over UX, animations, accessibility
6. **Bundle cost: ~0 KB additional** (CDK already in bundle)
7. The plan calls for max 3-step spotlight + contextual hints -- too simple to justify a library dependency
8. Libraries are designed for complex multi-page tours; TaskBolt needs lightweight contextual hints

**Use CDK Overlay for hint positioning + custom SVG mask for spotlight. No new npm dependencies.**

---

## 5. Angular 19 CDK Overlay Patterns for Tooltip/Popover Positioning

### FlexibleConnectedPositionStrategy (v19+)

The core positioning API for connecting a floating overlay to a trigger element.

```typescript
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

// Position hint below target with fallback positions
const positionStrategy = this.overlay.position()
  .flexibleConnectedTo(targetElementRef)
  .withPositions([
    // Preferred: below-center
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    // Fallback 1: above-center
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    // Fallback 2: right
    { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 8 },
    // Fallback 3: left
    { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
  ])
  .withDefaultOffsetY(0)
  .withViewportMargin(16);

const overlayRef = this.overlay.create({
  positionStrategy,
  scrollStrategy: this.overlay.scrollStrategies.reposition(),
  hasBackdrop: false,
});

const portal = new ComponentPortal(ContextualHintComponent);
const componentRef = overlayRef.attach(portal);
```

### Key CDK Overlay Patterns for TaskBolt

**1. Scroll strategy:** Use `reposition()` for hints (repositions as user scrolls). Use `block()` for spotlight overlay (prevents scrolling during tour).

**2. Backdrop:** No backdrop for contextual hints (non-blocking). SVG mask serves as custom backdrop for spotlight.

**3. Cleanup:** Always detach overlay in `ngOnDestroy()` to prevent memory leaks.

**4. Standalone component compatibility:** CDK Overlay works with Angular 19 standalone components. Import `OverlayModule` or inject `Overlay` service directly.

**5. Position change notification:**
```typescript
const positionStrategy = this.overlay.position()
  .flexibleConnectedTo(elementRef)
  .withPositions([...]);

positionStrategy.positionChanges.subscribe(change => {
  // Update arrow direction based on which fallback position was used
  this.arrowPosition.set(change.connectionPair.overlayY === 'top' ? 'top' : 'bottom');
});
```

---

## 6. Progressive Hint Triggering Patterns

### Visit-Count-Based Triggers

| Trigger | Condition | Hint |
|---------|-----------|------|
| First board visit | `boardVisitCount === 1` | Spotlight tour (3 steps) |
| 2nd board visit | `boardVisitCount >= 2` | "Press ? for keyboard shortcuts" |
| 3rd board visit | `boardVisitCount >= 3 && !hasDragged` | "Drag cards between columns" |
| 4th board visit | `boardVisitCount >= 4` | "Press Ctrl+K for command palette" |
| 5th board visit | `boardVisitCount >= 5 && !hasUsedFilter` | "Try quick filters" |

### Action-Based Triggers

| Trigger | Condition | Hint |
|---------|-----------|------|
| First task created | `taskCreateCount === 1` | "Drag your new task to change status" |
| Never used search | `searchUseCount === 0 && sessionTime > 120s` | "Press Ctrl+K to search everything" |
| Repeated failed attempt | `failedDragCount >= 2` | Rescue hint: "Click and hold to drag cards" |

### Frequency & Retirement Rules (Best Practice from Chameleon/Userpilot data)

1. **Max 1 hint per session** -- prevents tooltip fatigue
2. **Minimum 2-second delay** before showing any hint (let user orient first)
3. **Permanent dismiss on "Got it"** -- never repeat dismissed hints
4. **Action completion retires hint** -- if user drags a card, retire the drag hint automatically
5. **Skip button always available** -- no trapped states
6. **Progressive delay increase** -- 2s delay on first hint, 5s on subsequent sessions
7. **Session = browser tab lifetime** -- reset session counter on new tab

### Anti-Patterns to Avoid

- Timer-triggered hints when user is actively progressing (interrupt flow)
- Multiple hints visible simultaneously (cognitive overload)
- Hints that block the feature they're explaining
- Repeating dismissed hints in same session
- Showing hints during spotlight tour (one system at a time)

---

## 7. Empty State Design Patterns That Drive Adoption

### Framework: Every Empty State Must Answer 3 Questions

1. **What is this?** -- Clear label/icon for the empty container
2. **Why does it matter?** -- Brief value proposition
3. **What should I do next?** -- Single clear CTA (button or shortcut hint)

### Proven Patterns

| Pattern | Example | Impact |
|---------|---------|--------|
| **Action-oriented copy** | "No tasks yet. Drag a card here or press N to create one." | +47% signup-to-setup conversion (Eleken) |
| **Shortcut hint inline** | "Press N to create a task" displayed in empty column | Accelerates power-user development |
| **Illustration + CTA** | Monochrome illustration + "Create your first task" button | Reduces blank-page anxiety (Notion pattern) |
| **Template suggestion** | "Start from a template" link in empty board | Prevents blank canvas (Airtable/ClickUp pattern) |
| **Demo data** | Pre-seeded Welcome Board with sample tasks | Product-in-action on day 1 (Trello pattern) |
| **Checklist as content** | Empty state IS a checklist: "1. Create task, 2. Assign it, 3. Set a deadline" | 40%+ activation rates (SaaS Factor) |

### TaskBolt Empty State Recommendations

**Kanban column (empty):**
> "No tasks in [Column Name] yet.
> Drag a card here or press **N** to create one."
> [+ Create Task] button

**Board (no columns):**
> "Your board is ready! Add columns to organize your workflow."
> [+ Add Column] button
> "Or start from a template" link

**Filters (no results):**
> "No tasks match your filters.
> Try removing some filters or press **C** to clear all."

**Dashboard (no boards):**
> "Welcome to TaskBolt! Create your first board to get started."
> [+ Create Board] button

---

## 8. Recommended Approach for Angular 19 with CDK

### Architecture Summary

| Component | Approach | Dependency |
|-----------|----------|------------|
| **Spotlight overlay** | Custom SVG mask (`<svg>` + `<mask>` + `<rect>`) with Angular signals for position tracking | None (pure SVG) |
| **Contextual hints** | CDK `FlexibleConnectedPositionStrategy` + `ComponentPortal` for positioning | `@angular/cdk/overlay` (already installed) |
| **Help icon popovers** | CDK Connected Overlay directive or programmatic `Overlay` service | `@angular/cdk/overlay` (already installed) |
| **Hint state management** | Signal-based `FeatureHintsService` with `localStorage` persistence | None (Angular signals) |
| **Empty states** | Enhanced `EmptyStateComponent` with new variants | None (existing component) |
| **Animations** | CSS transitions on opacity + translateY for hints; SVG rect transitions for spotlight | None (CSS only) |

### Why This Over a Library

| Factor | Custom (CDK + SVG) | Driver.js | Shepherd.js |
|--------|-------------------|-----------|-------------|
| Bundle impact | 0 KB (CDK already bundled) | +5 KB | +30 KB |
| License | MIT (CDK) | MIT | Commercial |
| Angular 19 signals | Native integration | Imperative API mismatch | Wrapper not tested on 19 |
| Spotlight performance | SVG mask (GPU) | CSS box-shadow (slow on mobile) | Floating UI (good) |
| Customization | Full control | Limited to Driver.js API | Extensive but constrained |
| Accessibility | Full ARIA control | Basic | Good (keyboard nav) |
| Maintenance | Own code | Dependency updates | Dependency + wrapper updates |
| Complexity for 3-step tour + hints | Low | Overkill | Overkill |

### Implementation Priorities (from plan-h4.md, validated by research)

1. `FeatureHintsService` -- localStorage state tracking with signals (validated: progressive triggers match industry best practice)
2. `SpotlightOverlayComponent` -- SVG mask approach (validated: best performance approach)
3. `ContextualHintComponent` -- CDK overlay positioning (validated: CDK FlexibleConnectedPositionStrategy is production-ready for Angular 19)
4. `FeatureHelpIconComponent` -- CDK connected overlay for ? popovers
5. Enhanced empty states -- action-oriented copy with shortcut hints (validated: +47% conversion improvement)
6. Max 3 spotlight steps + max 1 contextual hint per session (validated: >5 steps = sharp abandonment; top 1% tours use max 5)

---

## Sources

### Competitor Analysis
- [ClickUp vs Asana vs Monday.com comparisons](https://wbcomdesigns.com/clickup-vs-asana-vs-monday-com/)
- [GenAI in Project Management: Asana, ClickUp, Monday, Wrike](https://www.reworked.co/collaboration-productivity/generative-ai-comes-for-project-management-an-overview-of-4-solutions/)
- [Trello navigation tour implementation](https://userguiding.com/blog/product-tour-examples)
- [Linear onboarding documentation](https://linear.app/docs/start-guide)
- [Linear onboarding flow screenshots](https://pageflows.com/post/desktop-web/onboarding/linear/)
- [Figma animated onboarding flow](https://goodux.appcues.com/blog/figmas-animated-onboarding-flow)
- [Jira vs Notion vs Trello comparison](https://enreap.com/jira-vs-notion-vs-trello-how-to-combine-the-right-tools-for-agile-success/)

### Product Tour Statistics & UX
- [Chameleon: 15 Million Product Tour Interactions](https://www.chameleon.io/blog/product-tour-benchmarks-highlights)
- [Chameleon 2025 Benchmark Report](https://www.chameleon.io/benchmark-report)
- [Product Tours for SaaS: Drive Activation (Mailmodo)](https://www.mailmodo.com/guides/product-tours/)
- [How to Create Effective Product Tours 2025 (Whatfix)](https://whatfix.com/product-tour/)
- [Should You Use a Product Tour Tool? (Jimo 2025)](https://jimo.ai/blog/should-you-use-a-product-tour-tool-the-ultimate-guide-for-saas-success-in-2025)
- [How to Create Product Tours Users Love 2026 (Flook)](https://flook.co/blog/posts/product-tours)
- [Product Tours Guide for SaaS (Userpilot)](https://userpilot.com/blog/product-tours/)
- [Product Tour UI/UX Patterns (Appcues)](https://www.appcues.com/blog/product-tours-ui-patterns)
- [Hidden Metrics of Effective Product Tours (Chameleon 2025)](https://www.chameleon.io/blog/effective-product-tour-metrics)

### Spotlight Implementation
- [Dynamic SVG Mask - GitHub Gist](https://gist.github.com/edds/2420298)
- [CSS Clipping and Masking (CSS-Tricks)](https://css-tricks.com/clipping-masking-css/)
- [SVG Clipping and Masking (MDN)](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Clipping_and_masking)
- [CSS box-shadow overlay technique (Use All Five)](https://www.useallfive.com/thoughts/css-trick-overlay-with-box-shadow)
- [Improving SVG Rendering Performance (CodePen)](https://codepen.io/tigt/post/improving-svg-rendering-performance)

### Angular CDK Overlay
- [Angular CDK Overlay Positioning v19+ (Brian Treese)](https://briantree.se/angular-cdk-overlay-tutorial-positioning/)
- [Angular CDK Overlay Basics v19+ (Brian Treese)](https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/)
- [Angular CDK Overlay Animations v19+ (Brian Treese)](https://briantree.se/angular-cdk-overlay-tutorial-adding-animations/)
- [Tooltip with Angular CDK (angular.love)](https://angular.love/tooltip-with-angular-cdk/)
- [Angular CDK Overlay API Reference](https://next.material.angular.dev/docs-content/api-docs/cdk-overlay)
- [FlexibleConnectedPositionStrategy source (GitHub)](https://github.com/angular/components/blob/main/src/cdk/overlay/position/flexible-connected-position-strategy.ts)
- [Custom Popover with Overlay in Angular (Medium)](https://medium.com/@JoaoPoggioli/creating-a-custom-popover-with-overlay-in-angular-dfb330cfd124)

### Tour Library Comparison
- [Best Product Tour JS Libraries (LogRocket)](https://blog.logrocket.com/best-product-tour-js-libraries-frontend-apps/)
- [Best Open-Source Product Tour Libraries (Userorbit)](https://userorbit.com/blog/best-open-source-product-tour-libraries)
- [5 Best React Onboarding Libraries 2026 (OnboardJS)](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [driver.js npm](https://www.npmjs.com/package/driver.js)
- [shepherd.js npm](https://www.npmjs.com/package/shepherd.js)
- [intro.js npm](https://www.npmjs.com/package/intro.js)
- [angular-shepherd GitHub](https://github.com/shipshapecode/angular-shepherd)
- [Driver.js installation docs](https://driverjs.com/docs/installation)

### Progressive Onboarding & Empty States
- [Progressive Onboarding (Userpilot)](https://userpilot.com/blog/progressive-onboarding/)
- [Progressive Onboarding with Contextual Help (SetProduct)](https://www.setproduct.com/blog/how-to-replace-onboarding-with-contextual-help)
- [Onboarding Tooltips for SaaS (Userpilot)](https://userpilot.com/blog/onboarding-tooltips-saas/)
- [Tooltips UX Pattern (Appcues)](https://www.appcues.com/blog/tooltips)
- [SaaS Onboarding UX Design Psychology (UserJot)](https://userjot.com/blog/saas-onboarding-ux-design-psychology)
- [Progressive Onboarding Guide (UserGuiding)](https://userguiding.com/blog/progressive-onboarding)
- [Empty State UX for SaaS Revenue (SaaS Factor)](https://www.saasfactor.co/blogs/empty-state-ux-turn-blank-screens-into-higher-activation-and-saas-revenue)
- [Empty State UX Examples (Eleken)](https://www.eleken.co/blog-posts/empty-state-ux)
- [Empty State UI Pattern (Mobbin)](https://mobbin.com/glossary/empty-state)
- [Empty State in SaaS (Userpilot)](https://userpilot.com/blog/empty-state-saas/)
- [Onboarding Tutorials vs Contextual Help (NN/g)](https://www.nngroup.com/articles/onboarding-tutorials/)
