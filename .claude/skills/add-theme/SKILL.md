# Add Theme

Add a new light or dark theme to TaskFlow. Takes 6 colors and generates all required CSS variables, TypeScript palette config, and type definitions.

## Trigger

User says: "add theme", "new theme", "create theme", or provides 6 hex colors for a theme.

## Input

The user provides:
1. **Theme name** (kebab-case slug, e.g. `ocean-breeze`)
2. **6 hex colors** ordered lightest → darkest (the `palette6`)
3. **Font pair** — display + body font families
4. **Light or dark** theme

## 6-Color Architecture

Every theme uses exactly 6 colors. Each color has a fixed role:

```
┌─────────────────────────────────────────┐
│  TOPBAR (C3 light tint)                 │
├────────┬────────────────────────────────┤
│        │  PAGE BACKGROUND (C2)          │
│ SIDE   │                                │
│ BAR    │  ┌──────────┐  ┌──────────┐   │
│ (C3)   │  │ CARD (C1) │  │ CARD (C1) │   │
│        │  │ lightest  │  │ lightest  │   │
│ C5 txt │  │ C6 border │  │ C6 border │   │
│ C6 txt │  │ C5 muted  │  │ C5 muted  │   │
│        │  │ C6 text   │  │ C6 text   │   │
│ C4 btn │  └──────────┘  └──────────┘   │
│        │           C4 buttons           │
└────────┴────────────────────────────────┘
```

### Color Role Map

| Position | Role | CSS Variables | Where Visible |
|----------|------|---------------|---------------|
| **C1** (lightest) | Cards, elevated surfaces | `--card`, `--surface-overlay` | Cards, modals, dropdowns, panels |
| **C2** | Page background | `--background`, `--muted` | Main content area behind cards |
| **C3** | Sidebar chrome | `--sidebar-bg` | Left sidebar background |
| **C3-tint** | Topbar (derived) | `--topbar-bg` | Top navigation bar (lighter than C3) |
| **C4** | Primary accent | `--primary`, `--ring`, `--accent-warm` | Buttons, links, focus rings, active states |
| **C5** | Secondary text | `--muted-foreground` | Labels, descriptions, placeholder text |
| **C6** (darkest) | Primary text + borders | `--foreground`, `--border` basis | Headings, body text, card borders |

### Derived Values (computed from the 6 colors)

| Variable | Derivation |
|----------|-----------|
| `--topbar-bg` | Mix C2 and C3 at ~60/40 (lighter than C3, darker than C2) |
| `--border` | `rgba(C6, 0.15–0.2)` — dark-on-light borders visible against C1 cards |
| `--input` | `rgba(C6, 0.08–0.12)` — subtle input background |
| `--secondary` | `rgba(C6, 0.06–0.1)` — very subtle secondary surface |
| `--card-foreground` | C6 (same as foreground) |
| `--secondary-foreground` | C6 |
| `--accent` | `rgba(C4, 0.1)` |
| `--accent-foreground` | C4 |
| `--accent-warm` | C4 |
| `--accent-warm-light` | `rgba(C4, 0.1)` |
| `--accent-warm-foreground` | C5 |
| `--shadow-glow` | Based on C4 |
| `--widget-hover-border` | `rgba(C4, 0.35)` |
| `--surface-overlay` | `rgba(C1, 0.96)` |

### Sidebar Text — WCAG Contrast Check

The sidebar uses C3 as background. Text contrast MUST meet WCAG AA (4.5:1 for normal text).

**Decision tree:**
1. Calculate contrast ratio of C6 (darkest) against C3
2. If ratio ≥ 4.5:1 → use **dark text** (C6 for primary, darker shade for headings)
3. If ratio < 4.5:1 → use **light text** (white/C1 for primary, rgba for secondary/muted)

**Dark text sidebar** (C3 is light, e.g. #d5d7de):
```css
--sidebar-text-primary: /* darker than C6, ~5:1 contrast */;
--sidebar-text-secondary: C6;
--sidebar-text-muted: C5;
--sidebar-surface: rgba(0,0,0,0.04);
--sidebar-surface-hover: rgba(0,0,0,0.08);
--sidebar-surface-active: rgba(0,0,0,0.12);
--sidebar-border: rgba(0,0,0,0.08);
```

**Light text sidebar** (C3 is dark, e.g. #708173):
```css
--sidebar-text-primary: #ffffff;
--sidebar-text-secondary: rgba(255,255,255,0.75);
--sidebar-text-muted: rgba(255,255,255,0.5);
--sidebar-surface: rgba(255,255,255,0.06);
--sidebar-surface-hover: rgba(255,255,255,0.12);
--sidebar-surface-active: rgba(255,255,255,0.18);
--sidebar-border: rgba(255,255,255,0.1);
```

## Files to Modify (4 files)

### 1. `frontend/src/app/shared/types/theme.types.ts`
Add the new theme slug to the `LightTheme` or `DarkTheme` union type.

### 2. `frontend/src/app/core/constants/color-palettes.ts`
Add entry to `THEME_PALETTES` (light) or `DARK_THEME_PALETTES` (dark).

Required fields:
```typescript
'theme-slug': {
  ramp: {
    '50': '...', '100': '...', '200': '...', '300': '...',
    '400': '...', '500': '...', '600': '...', '700': '...',
    '800': '...', '900': '...', '950': '...',
  },
  surface: {
    base: 'C2',      // --background (page)
    s1: 'C1',        // --card (elevated)
    s2: 'C2',        // secondary surface
    fg: 'C6',        // --foreground
    border: 'rgba(C6, 0.15)',
    mutedFg: 'C5',   // --muted-foreground
  },
  sidebar: {
    bg: 'C3',
    surface: '...',        // see contrast check above
    surfaceHover: '...',
    surfaceActive: '...',
    border: '...',
    textPrimary: '...',    // depends on contrast check
    textSecondary: '...',
    textMuted: '...',
  },
  fontDisplay: "'FontName', system-ui, sans-serif",
  fontBody: "'FontName', system-ui, sans-serif",
  name: 'Theme Name',
  palette6: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  preview: { bg: 'C2', primary: 'C4', fg: 'C6' },
},
```

**PrimeNG ramp:** Generate an 11-step shade ramp (50–950) from C4 (primary accent). Use color mixing:
- 50: mix(C4, white, 90%)
- 100: mix(C4, white, 80%)
- ..through to...
- 500: C4
- ..through to...
- 950: mix(C4, black, 80%)

Also add the slug to the `LIGHT_THEMES` or `DARK_THEMES` array.

### 3. `frontend/src/theme-palettes.css`
Add a CSS block following this template:

```css
/* Theme Name: C1, C2, C3, C4, C5, C6 */
html[data-theme="theme-slug"] {
  --background: C2;
  --card: C1;
  --card-foreground: C6;
  --muted: C2;
  --sidebar-bg: C3;
  --topbar-bg: /* mix(C2, C3, 60/40) */;
  --font-display: 'Font', system-ui, sans-serif;
  --font-body: 'Font', system-ui, sans-serif;
  --border: rgba(C6_r, C6_g, C6_b, 0.15);
  --input: rgba(C6_r, C6_g, C6_b, 0.1);
  --secondary: rgba(C6_r, C6_g, C6_b, 0.08);
  --secondary-foreground: C6;
  --sidebar-surface: /* see contrast check */;
  --sidebar-surface-hover: /* see contrast check */;
  --sidebar-surface-active: /* see contrast check */;
  --sidebar-border: /* see contrast check */;
  --primary: C4;
  --primary-foreground: #ffffff;
  --ring: C4;
  --accent: rgba(C4_r, C4_g, C4_b, 0.1);
  --accent-foreground: C4;
  --accent-warm: C4;
  --accent-warm-light: rgba(C4_r, C4_g, C4_b, 0.1);
  --shadow-glow: 0 0 0 1px rgba(C4_r, C4_g, C4_b, 0.15), 0 8px 32px rgba(C4_r, C4_g, C4_b, 0.12);
  --widget-hover-border: rgba(C4_r, C4_g, C4_b, 0.35);
  --muted-foreground: C5;
  --accent-warm-foreground: C5;
  --sidebar-text-muted: /* see contrast check */;
  --sidebar-text-secondary: /* see contrast check */;
  --foreground: C6;
  --sidebar-text-primary: /* see contrast check */;
  --success: #61BD4F;
  --success-light: rgba(97,189,79,0.1);
  --destructive: #E8445A;
  --destructive-foreground: #ffffff;
  --surface-overlay: rgba(C1_r, C1_g, C1_b, 0.96);
}
```

### 4. `frontend/src/styles.css`
No changes needed — `:root` is the warm-earth default. New themes override via `data-theme`.

## Verification Checklist

After adding a theme:
1. `cd frontend && npx tsc --noEmit` — no type errors
2. `npm run build -- --configuration=production` — build succeeds
3. Switch to the new theme in Settings > Appearance
4. Verify 6 distinct colors visible:
   - [ ] Cards (C1) lighter than background (C2)
   - [ ] Sidebar (C3) distinctly different from background
   - [ ] Topbar (C3-tint) distinct from sidebar but related
   - [ ] Primary accent (C4) on buttons, links
   - [ ] Muted text (C5) on labels, descriptions
   - [ ] Foreground text (C6) on headings, body
5. Sidebar text readable (WCAG AA contrast against C3)
6. Card borders visible against card background
7. Dark mode still works

## Example: Adding "Ocean Breeze"

Given 6 colors: `#e8f4f8, #b8d4e3, #5b9db6, #2d7a9c, #4a6670, #1a2e35`

```
C1=#e8f4f8 (ice blue)     → cards
C2=#b8d4e3 (sky blue)     → background
C3=#5b9db6 (ocean)        → sidebar (dark enough for white text)
C4=#2d7a9c (deep teal)    → accent buttons
C5=#4a6670 (slate)        → muted text
C6=#1a2e35 (midnight)     → foreground text, borders
```

Topbar: mix(#b8d4e3, #5b9db6, 60/40) ≈ #8ab8cc
Contrast check: #ffffff on #5b9db6 = ~3.8:1 (borderline) → use #ffffff for large text, #e8f4f8 (C1) for normal.
