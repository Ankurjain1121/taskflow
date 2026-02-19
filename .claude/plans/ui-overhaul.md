# TaskFlow UI Overhaul: Kanban Board + Color Scheme Redesign

## Context
TaskFlow (Angular 19 + Tailwind CSS 4 + PrimeNG) needs two things: (1) a Planka-inspired kanban board polish, and (2) a full color scheme rethink. Research into Planka (11.5k stars, cloned at /tmp/planka), Sakai (official PrimeNG template), spartan-ng (shadcn for Angular), and shadcn/ui informed this plan.

**Recommended theme repo to clone:** [Sakai-ng](https://github.com/primefaces/sakai-ng) — official PrimeNG admin template with Tailwind v4 plugin, demo at sakai.primeng.org

---

## TASK 1: Kanban Board Overhaul (Planka-inspired)

### Current vs Target

| Element | Current (TaskFlow) | Target (Planka-inspired) |
|---------|-------------------|--------------------------|
| Card shadow | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 0 var(--border)` — paper-on-surface, not floating |
| Card border | 4px left colored border | Full-width 3px top colored bar (rounded top corners) |
| Card hover | Shadow deepens | `bg-[var(--muted)]` tint + action button reveal |
| Card action btns | 3 buttons, opacity-0→1 | Single "..." menu, opacity-0→1 on hover |
| Column width | `w-72` (288px) | `w-[272px]` (Planka standard) |
| Column bg | `var(--muted)` flat | Slightly inset, `var(--muted)` with subtle top-border color accent |
| Column header | Color dot + name | Color accent bar (4px) + bold name + count pill |
| Add card btn | Text link | Planka-style: full-width muted button, `85ms ease` transition |
| Labels on card | Thin `h-1.5` bars | Pill badges showing label name (Planka: `border-radius: 3px`, `text-shadow: 1px 1px 0 rgba(0,0,0,0.2)`) |
| Due date chip | Red text when overdue | Planka chip: `bg-[#db2828] text-white` (overdue), `bg-[#f2711c] text-white` (due soon), `bg-[#21ba45] text-white` (done) |
| Title text | `text-black dark:text-gray-100` | `color: var(--card-foreground)` — token only |
| Drag preview | White glassmorphism | `color-mix(in srgb, var(--card) 92%, transparent)` + blur |
| Transitions | 200ms various | **85ms ease** for buttons (Planka), 200ms for cards |

### Files to Modify

**1. `task-card.component.ts`** — the biggest change
- Replace left border with top color bar
- Title: `text-black dark:text-gray-100` → `style="color: var(--card-foreground)"`
- Bottom divider: `border-gray-100 dark:border-gray-700` → `border-[var(--border)]`
- Action buttons: `bg-white/90 dark:bg-gray-700/90` → `bg-[var(--card)]/90`
- Blocked badge: raw reds → `--status-red-*` tokens
- Timer badge: raw emeralds → `--status-green-*` tokens
- Assignee ring: `ring-white dark:ring-gray-800` → `ring-[var(--card)]`
- "+N" overflow: `bg-gray-200 text-gray-500` → `bg-[var(--secondary)] text-[var(--muted-foreground)]`
- Focus ring: `ring-indigo-500` → `ring-[var(--ring)]`
- Drag preview: `rgba(255,255,255,0.92)` → `color-mix(in srgb, var(--card) 92%, transparent)`
- Labels: change from thin bars to pill badges with name text
- Due date: add chip-style colored background for overdue/due-soon/completed states
- Card shadow: `0 1px 0 color-mix(in srgb, var(--foreground) 12%, transparent)` (Planka-style)

**2. `kanban-column.component.ts`**
- Width: `w-72` → `w-[272px]`
- Add 4px color accent bar at top of column header
- Fallback color: `'#6366f1'` → `'var(--primary)'`
- Done checkmark: `text-green-500` → `text-[var(--success)]`
- WIP warning: `text-amber-600 bg-amber-50` → `--status-amber-*` tokens
- Add card button: match Planka style (full-width, muted bg, `85ms ease` transition)

**3. `board-view.component.ts`**
- "New Task" button: `bg-indigo-600` → `bg-[var(--primary)]`
- Column gap: match Planka's `8px` between columns

**4. `task-group-header.component.ts`**
- Stats badges: `bg-gray-100` → `bg-[var(--secondary)]`
- Completion badges: raw greens/blues → `--status-green/blue-*` tokens
- Buttons: `text-gray-600` → `text-[var(--muted-foreground)]`

**5. `styles.css`** — add new utilities
- `.btn-snappy { transition: background 85ms ease-in, color 85ms ease-in; }`
- Due date chip classes: `.chip-overdue`, `.chip-due-soon`, `.chip-completed`
- Card shimmer animation (Planka's recently-updated sweep)

---

## TASK 2: Full Color Scheme Rethink

### Current Problems (from audit)
1. Dark mode `--border: #334155` is flat gray — doesn't adapt to different surfaces
2. No `--input` token — form fields share `--border` which is too subtle
3. No `@theme inline` — forces `bg-[var(--card)]` everywhere instead of `bg-card`
4. No chart tokens — dashboard widgets hardcode colors
5. Priority badges use saturated fills (`bg-red-500 text-white`) — dated look
6. 30+ hardcoded color locations across board components
7. `getDueDateColor()` returns Tailwind classes that don't adapt to dark mode
8. `COLUMN_STATUS_COLORS` uses old-style `bg-gray-200` with no dark support

### Color System Upgrades

**File: `frontend/src/styles.css`**

#### 2.1 Alpha-channel dark borders (shadcn pattern)
```css
html.dark { --border: rgba(255, 255, 255, 0.1); /* was #334155 */ }
```

#### 2.2 Add `--input` token
```css
:root { --input: #e2e8f0; }
html.dark { --input: rgba(255, 255, 255, 0.15); }
```

#### 2.3 Add `@theme inline` block
Maps CSS vars to native Tailwind utilities (`bg-card`, `text-foreground`, `border-border`):
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-success: var(--success);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

#### 2.4 Chart tokens
```css
:root { --chart-1: #6366f1; --chart-2: #10b981; --chart-3: #f97316; --chart-4: #f59e0b; --chart-5: #8b5cf6; }
html.dark { --chart-1: #818cf8; --chart-2: #34d399; --chart-3: #fb923c; --chart-4: #fcd34d; --chart-5: #a78bfa; }
```

#### 2.5 Due date chip tokens
```css
:root { --chip-overdue: #db2828; --chip-due-soon: #f2711c; --chip-completed: #21ba45; }
html.dark { --chip-overdue: #f87171; --chip-due-soon: #fb923c; --chip-completed: #4ade80; }
```

**File: `frontend/src/app/shared/utils/task-colors.ts`**

#### 2.6 Tinted priority badges (Linear/shadcn style)
```typescript
urgent: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' }
high:   { bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', ... }
medium: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', ... }
low:    { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', ... }
```

#### 2.7 Fix `getDueDateColor()` for dark mode
Return style objects instead of class strings, or use status tokens.

#### 2.8 Fix `COLUMN_STATUS_COLORS` to use tokens
```typescript
default:    { bg: 'bg-[var(--secondary)]', text: 'text-[var(--muted-foreground)]' }
done:       { bg: 'bg-[var(--status-green-bg)]', text: 'text-[var(--status-green-text)]' }
inProgress: { bg: 'bg-[var(--status-blue-bg)]', text: 'text-[var(--status-blue-text)]' }
blocked:    { bg: 'bg-[var(--status-red-bg)]', text: 'text-[var(--status-red-text)]' }
```

---

## Files Modified Summary

| # | File | Task | Changes |
|---|------|------|---------|
| 1 | `styles.css` | Both | Alpha borders, `--input`, `@theme inline`, chart tokens, chip tokens, `.btn-snappy`, shimmer keyframes |
| 2 | `task-colors.ts` | T2 | Tinted badges, fixed `getDueDateColor`, fixed `COLUMN_STATUS_COLORS` |
| 3 | `task-card.component.ts` | T1 | Top color bar, all-token colors, pill labels, due date chips, Planka shadow |
| 4 | `kanban-column.component.ts` | T1 | 272px width, color accent bar, token colors, Planka-style add button |
| 5 | `board-view.component.ts` | T1 | Primary token on New Task button, column gap |
| 6 | `task-group-header.component.ts` | T1 | All badges → status tokens |
| 7 | `board-toolbar.component.ts` | T1 | Assignee avatar gradient → token (minor) |

## Implementation Order (dependency-aware)
1. `styles.css` — alpha borders, `--input`, `@theme inline`, chart/chip tokens, `.btn-snappy`, cleanup
2. `task-colors.ts` — tinted priority badges, fix `getDueDateColor`, fix `COLUMN_STATUS_COLORS`
3. `task-card.component.ts` — top color bar, token colors, pill labels, due date chips, Planka shadow
4. `kanban-column.component.ts` — 272px width, color accent bar, token colors, Planka add button
5. `board-view.component.ts` — primary token on New Task, column gap
6. `task-group-header.component.ts` — all badges → status tokens
7. `board-toolbar.component.ts` — avatar gradient → token (minor)
8. Frontend build check (`./scripts/quick-check.sh --frontend`)

## Cleanup
- Remove dead `.board-columns` CSS (styles.css lines 639-648)
- Remove dead `@keyframes confettiFall` (styles.css line 393)

## Verification
1. `./scripts/quick-check.sh --frontend` — build check after each task
2. Toggle dark/light mode on every modified page
3. Drag a card between columns — verify preview + placeholder look correct
4. Check priority badges in both modes on board + my-tasks
5. Check due date chips render colored backgrounds
6. Rebuild and deploy to VPS

## Sources
- [plankanban/planka](https://github.com/plankanban/planka) (cloned at /tmp/planka) — kanban design patterns
- [primefaces/sakai-ng](https://github.com/primefaces/sakai-ng) — PrimeNG + Tailwind v4 official template
- [spartan-ng/spartan](https://github.com/spartan-ng/spartan) — shadcn for Angular, tinted badge patterns
- [shadcn-ui/ui](https://github.com/shadcn-ui/ui) — `@theme inline`, alpha borders, design tokens
