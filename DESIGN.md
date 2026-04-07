# Design System: TaskBolt

## 1. Visual Theme & Atmosphere

**Mood:** Warm, grounded, industrially refined. The interface feels like a sunlit workshop — purposeful without pretension, inviting without being casual. Surfaces have the quality of aged parchment and terracotta, with generous white space that lets content breathe. The aesthetic sits between Linear's surgical precision and Monday.com's vibrancy, borrowing TickTick's polish and Trello's approachability.

**Density:** Progressive. Dashboards are scannable summaries; detail views reveal comprehensiveness on demand. Default state is always calm, never overwhelming.

**Philosophy:** Color is earned by meaning (status, priority, progress) — never decorative. Every pixel serves comprehension. Motion is encouraged but respects `prefers-reduced-motion`. The UI should feel like a helpful teammate, not a bureaucratic tool.

**Anti-patterns (strictly forbidden):** Purple/violet/indigo accents, purple-to-blue gradients, gradient text, mesh gradient backgrounds, glowing borders, gradient avatars, pure `#000`/`#fff` on large surfaces, colored dots on every nav item.

---

## 2. Color Palette & Roles

### Default Theme: Warm Earth

#### Light Mode

| Role | Color | Hex | Description |
|------|-------|-----|-------------|
| **Background** | Warm Parchment | `#E8E4DB` | Main canvas — a sun-bleached linen tone, never stark white |
| **Card Surface** | Aged Cream | `#EDE9DD` | Slightly lifted surface for cards and panels |
| **Foreground** | Charcoal Earth | `#2E2E2E` | Primary text — warm near-black, never pure black |
| **Primary Action** | Fired Terracotta | `#A0663E` | Buttons, links, focus rings — the brand anchor |
| **Accent** | Kiln Copper | `#BF7B54` | Sidebar background, accent highlights, secondary emphasis |
| **Accent Warm** | Desert Gold | `#D4A853` | Complementary warm accent for badges and highlights |
| **Muted Foreground** | Dusty Clay | `#6B6360` | Secondary text, timestamps, metadata |
| **Success** | Olive Grove | `#5E8C4A` | Completion states, positive indicators |
| **Destructive** | Kiln Red | `#B81414` | Error states, delete actions — red reserved exclusively for danger |
| **Border** | Sandstone Veil | `rgba(159,159,159,0.25)` | Subtle dividers, barely visible until needed |
| **Input** | Sandstone Whisper | `rgba(159,159,159,0.15)` | Form field backgrounds |
| **Topbar** | Sunbaked Clay | `#D4A088` | Top navigation bar gradient anchor |

#### Dark Mode

| Role | Color | Hex | Description |
|------|-------|-----|-------------|
| **Background** | Charred Earth | `#1C1A17` | Deep warm dark — not blue-black, brown-black |
| **Card Surface** | Dark Walnut | `#262320` | Elevated surfaces in dark mode |
| **Foreground** | Warm Parchment | `#E8E4DB` | Primary text flips to the light background tone |
| **Primary Action** | Burnished Bronze | `#996535` | Slightly muted primary for dark surfaces |
| **Accent** | Amber Copper | `#D4945E` | Brighter accent to maintain contrast on dark |
| **Muted Foreground** | Stone Gray | `#9A9590` | Secondary text in dark mode |
| **Success** | Spring Leaf | `#7AAF60` | Lighter green for dark mode readability |
| **Destructive** | Signal Red | `#D42020` | Slightly brighter red for dark contrast |
| **Sidebar** | Deep Espresso | `#1A1816` | Near-black warm sidebar |

### Data Visualization Colors

| Swatch | Light | Dark | Purpose |
|--------|-------|------|---------|
| **Status Red** | `#E8445A` | `#F4707F` | Overdue, urgent, blocked |
| **Status Green** | `#3D9E3A` | `#7DD868` | Complete, on-track |
| **Status Blue** | `#2D5BE3` | `#5B82F0` | In-progress, active |
| **Status Amber** | `#9A6A08` | `#F5C060` | Due soon, warning |

### Priority Colors

| Priority | Light | Dark | Meaning |
|----------|-------|------|---------|
| **Urgent** | `#E8445A` | `#F4707F` | Coral-crimson — demands immediate attention |
| **High** | `#9A6A08` | `#F5C060` | Burnished amber — important but not critical |
| **Medium** | `#2D5BE3` | `#5B82F0` | Cobalt blue — steady, working-priority |
| **Low** | `#0C8A6B` | `#3DC9A5` | Forest teal — calm, can wait |

### Label Preset Colors (Trello-inspired)

`#E8445A` `#9A6A08` `#61BD4F` `#0079BF` `#C377E0` `#00C2E0` `#FF78CB` `#51E898` `#344563` `#B3BAC5`

---

## 3. Typography Rules

**Architecture:** Dual-font pairing per theme. Display font carries personality; body font carries clarity.

### Warm Earth (Default)

| Usage | Font | Character |
|-------|------|-----------|
| **Display / Headings** | Syne | Geometric, bold, contemporary — gives headings a confident, editorial presence |
| **Body / UI** | DM Sans | Clean, open letterforms, highly readable at small sizes — the workhorse |
| **Fallback chain** | `system-ui, sans-serif` | Graceful degradation |

### Per-Theme Font Pairs

| Theme | Display | Body |
|-------|---------|------|
| White Heaven | Inter | Inter |
| Sea Foam | Nunito | Nunito Sans |
| Storm Cloud | Space Grotesk | Space Grotesk |
| Misty Forest | Lora | Source Sans 3 |
| Cosmic | Playfair Display | Lato |
| Mindful | Merriweather | Open Sans |

**Weight usage:** Regular (400) for body, Medium (500) for labels and secondary headings, Semibold (600) for section headings, Bold (700) for page titles and stats. No thin (100-300) weights in UI text.

---

## 4. Component Stylings

### Buttons

- **Shape:** Generously rounded corners (`border-radius: var(--radius)` = 1.25rem default) — pill-like but not fully rounded
- **Primary:** Fired Terracotta (`#A0663E`) fill, white text, subtle shadow on hover
- **Secondary:** Translucent accent tint (`rgba(191,123,84,0.08)`) with warm foreground text
- **Destructive:** Reserved exclusively for delete/danger — Kiln Red fill
- **Interaction:** All buttons scale to 96% on `:active` for tactile feedback. 150ms ease transition on color, background, border, shadow, and opacity
- **Focus:** Double-ring focus indicator — 2px background gap + 4px primary-tinted outer ring

### Cards & Containers

- **Corner roundness:** Softly rounded (1.25rem default), configurable via `data-border-radius` attribute (small: 0.5rem, medium: 1.25rem, large: 1.25rem)
- **Three style variants:**
  - **Raised (default):** Whisper-soft warm shadow (`0 2px 8px rgba(46,46,46,0.06)`)
  - **Flat:** No shadow, single border — clean and utilitarian
  - **Bordered:** No shadow, 2px border — pronounced boundary
- **Hover lift:** Cards translate upward 2px with shadow promotion to medium on hover
- **Background:** Aged Cream (`#EDE9DD`) light / Dark Walnut (`#262320`) dark

### Inputs & Forms

- **Border:** Translucent sandstone stroke (`rgba(159,159,159,0.15)` background fill)
- **Focus:** Double-ring style matching buttons — primary-tinted outer glow
- **Disabled state:** Muted background at 50% opacity (dark mode specific handling)
- **Placeholder:** Muted foreground color, never black

### Sidebar

- **Light mode:** Rich Kiln Copper (`#BF7B54`) background with a subtle top-to-bottom gradient (lighter at top, slightly darker at bottom via `color-mix`)
- **Dark mode:** Deep Espresso (`#1A1816`) — nearly invisible, letting content own the stage
- **Width:** 16rem expanded, 3.5rem collapsed
- **Text hierarchy:** Three tiers — primary (near-black/near-white), secondary (warm mid-tone), muted (subdued warm)
- **Surface states:** Transparent overlays that darken progressively: rest (4% black), hover (8%), active (12%)

### Topbar

- **Light mode:** Sunbaked Clay (`#D4A088`) with a subtle left-to-right gradient mixing in primary
- **Dark mode:** Matches the dark background surface (`#211F1C`)
- **Height:** 56px fixed

---

## 5. Layout Principles

### Whitespace Strategy

- **Generous breathing room:** White space is a feature, not wasted space. Content areas have comfortable padding (16-24px typical)
- **Progressive density:** Summary views are airy; detail views compress to show more data
- **Consistent rhythm:** 4px base unit. Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px

### Grid & Alignment

- **Sidebar + content:** Fixed sidebar (16rem) with fluid content area
- **Kanban boards:** Horizontal scroll with fixed-width columns
- **Dashboard:** CSS Grid-based stat cards and widget layout
- **Navigation height:** 56px fixed topbar, content below fills remaining viewport

### Scrollbar Styling

- **Width:** 6px thin scrollbars (both axes)
- **Track:** Transparent — never visible as a gutter
- **Thumb:** Slate-tinted translucent (`rgba(100,116,139,0.3)`), fully rounded
- **Dark mode:** White-tinted translucent (`rgba(255,255,255,0.15)`)

---

## 6. Elevation & Depth System

Five shadow tiers, all warm-tinted (using `rgba(46,46,46,...)` not cool gray):

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(46,46,46,0.04)` | Barely-there lift for inline elements |
| `--shadow-sm` | `0 2px 8px rgba(46,46,46,0.06), 0 1px 3px rgba(46,46,46,0.04)` | Default card elevation |
| `--shadow-md` | `0 8px 24px rgba(46,46,46,0.08), 0 4px 8px rgba(46,46,46,0.05)` | Hover states, dropdowns |
| `--shadow-lg` | `0 20px 56px rgba(46,46,46,0.1), 0 8px 16px rgba(46,46,46,0.06)` | Modals, floating panels |
| `--shadow-xl` | `0 28px 72px rgba(46,46,46,0.12), 0 12px 24px rgba(46,46,46,0.08)` | Full-screen overlays |
| `--shadow-glow` | `0 0 0 1px rgba(165,106,66,0.12), 0 8px 32px rgba(165,106,66,0.1)` | Focus glow, widget hover emphasis |

**Surface overlay:** Semi-transparent card color at 96% opacity for modal backdrops — maintains theme warmth.

---

## 7. Motion & Animation

**Philosophy:** Animations add personality and polish. Motion is encouraged (not minimal). Respect `prefers-reduced-motion`.

### Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Primary easing — fast start, smooth deceleration |
| `--ease-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful overshoot for celebrations |
| `--ease-standard` | `cubic-bezier(0.22, 1, 0.36, 1)` | General purpose, slightly snappy |
| `--duration-fast` | `150ms` | Hover states, micro-interactions |
| `--duration-normal` | `300ms` | Page transitions, panel slides |

### Animation Library

| Animation | Character | Duration |
|-----------|-----------|----------|
| `fadeInUp` | Content enters from below — arrival with presence | 500ms expo |
| `fadeIn` | Simple opacity entrance — subtle and smooth | 400ms ease |
| `slideInRight` | Panel slides in from right — drawer behavior | 500ms expo |
| `scaleIn` | Grows from 95% — dialog/modal entrance | 400ms expo |
| `springIn` | Scale with overshoot (85% -> 103% -> 98% -> 100%) — celebratory | 500ms expo |
| `gentleFloat` | Subtle up-down bob — idle state indicator | Continuous |
| `shimmer` | Loading skeleton gradient sweep — progress indication | 1.5s infinite |

### Stagger Delays

List items animate in sequence using `.stagger-1` through `.stagger-8` classes (60ms increments). Creates a waterfall entrance effect.

### Route Transitions

View Transition API: outgoing view fades out in 120ms, incoming view fades in over 280ms with expo easing. Quick but not jarring.

### Interactive Feedback

- **Button press:** `transform: scale(0.96)` on `:active` — tactile click
- **Card hover:** `translateY(-2px)` + shadow promotion — gentle lift
- **Link underline:** Width animates from 0 to 100% on hover via `::after` pseudo-element
- **Theme change:** 300ms transition on background, color, border, and shadow across all elements

---

## 8. Theme System Architecture

### 29 Complete Themes

**13 Light:** White Heaven, Sea Foam, Warm Earth (default), Storm Cloud, Morning Sky, Misty Forest, Modern Dental, Cosmic, Mindful, Purple Scale, Pastel Rose, French Blues, Sunset Website

**16 Dark:** Warm Earth Dark (default), Purple Night, Cherry Blossom, Sunset Dusk, Purple Haze, Ocean Deep, Luna, Coffee, Moon, Wine, Gold Crimson, Pink Gray, Yellow Dark, Forest Night, Bloodstone, Red Noir

### Token Architecture

| Layer | File | Responsibility |
|-------|------|---------------|
| **Semantic tokens** | `styles.css` `:root` / `html.dark` | Default Warm Earth light/dark values, shadows, layout, transitions, fonts |
| **Theme palettes** | `theme-palettes.css` | CSS `[data-theme]` / `[data-dark-theme]` selectors with full variable overrides per theme |
| **Structural variants** | `themes.css` | Card style, border radius, sidebar style, background patterns — no color values |
| **Palette definitions** | `color-palettes.ts` | `THEME_PALETTES` (light) + `DARK_THEME_PALETTES` (dark) — 50-950 ramp, surface, sidebar, fonts per theme |
| **Status/priority colors** | `task-colors.ts` | Priority, status, label, column colors — theme-independent data visualization |
| **Theme orchestration** | `theme.service.ts` | Signal-based: `lightTheme`/`darkTheme`/`theme` signals, PrimeNG preset sync, DB persistence, cross-tab sync, CSS-only preview mode |

### Theme Application Flow

1. User selects theme in settings
2. `ThemeService` updates signals + sets `data-theme`/`data-dark-theme` attributes on `<html>`
3. CSS selectors in `theme-palettes.css` activate, overriding `:root` variables
4. PrimeNG preset is recalculated from the palette's 50-950 ramp
5. Preference is persisted to database + `localStorage` (cross-tab sync via `StorageEvent`)
6. System preference detection via `matchMedia('prefers-color-scheme: dark')`

### Configurable Structural Variants

- **Card style:** `flat` | `raised` (default) | `bordered` — via `data-card-style` attribute
- **Border radius:** `small` (0.5rem) | `medium` (1.25rem, default) | `large` (1.25rem)
- **Background pattern:** `none` | `dots` | `grid` | `waves` — subtle body `::before` overlay

---

## 9. Accessibility

- **WCAG AA compliance** required across all themes
- **Focus states:** Visible double-ring focus indicator on all interactive elements (`*:focus-visible`)
- **Mouse users:** Focus ring suppressed on click (`*:focus:not(:focus-visible)`)
- **Color independence:** Never rely on color alone — use icons, labels, and patterns alongside color
- **Reduced motion:** All animations wrapped in `@media (prefers-reduced-motion: no-preference)` or have `prefers-reduced-motion: reduce` overrides
- **Selection highlight:** Uses primary color at 25% opacity for text selection
- **Contrast:** Foreground/background combinations tested per-theme; dark mode foreground is the light mode background color (guaranteed readable pair)

---

## 10. Glass & Surface Effects

| Utility | Background | Blur | Border | Usage |
|---------|-----------|------|--------|-------|
| `.glass` | 70% white (light) / 70% charred earth (dark) | 12px | 20% white / 6% white | Floating overlays, command palettes |
| `.glass-light` | 70% white | 12px | 30% white | Light-only glass panels |
| `.glass-dark` | 75% charred earth | 16px | 6% white | Dark-only glass panels |
| `.glass-subtle` | 40% white / 40% charred earth | 8px | 15% / 4% white | Background blur without heavy frost |

Surface elevation tokens (`--surface-0` through `--surface-3`) provide four depth levels for layered layouts without shadow dependency.
