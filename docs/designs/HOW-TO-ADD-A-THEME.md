# How to Add a New Theme to TaskFlow

## What You Need

**6 hex colors**, ordered from lightest to darkest. Example (Sea Foam):

```
#c9dce1  ← Color 1: Lightest (page background)
#b1c4c4  ← Color 2: Light-mid (cards, sidebar, muted surfaces)
#77adab  ← Color 3: Mid-accent (buttons, links, focus rings, primary)
#9b9e9c  ← Color 4: Neutral-mid (muted text, placeholders, borders)
#6f7c7a  ← Color 5: Dark-neutral (secondary text, sidebar labels)
#42514f  ← Color 6: Darkest (body text, headings)
```

Plus:
- **Theme name** (e.g., "Sea Foam")
- **Theme ID** (kebab-case, e.g., `sea-foam`)
- **Font pairing** (display + body fonts from Google Fonts)

## How Each Color Is Used

```
COLOR   CSS VARIABLES                    WHERE IT APPEARS
──────  ──────────────────────────────   ─────────────────────────────
1       --background                     Page background everywhere
        --surface-overlay (at 96%)       Modal/dialog backdrop

2       --card                           Cards, panels, dialog surfaces
        --muted                          Subtle backgrounds, dividers
        --sidebar-bg                     Sidebar + top bar background

3       --primary                        Buttons, links, active states
        --ring                           Focus ring outlines
        --accent-foreground              Accent-colored text
        --accent-warm                    Warm accent variant
        --shadow-glow (at 15%)           Card hover glow effect
        --widget-hover-border (at 35%)   Widget border on hover
        --sidebar-surface-active (20%)   Sidebar active item bg

4       --muted-foreground               Placeholder text, captions
        --accent-warm-foreground         Secondary accent text
        --border (at 30% opacity)        All borders
        --input (at 35% opacity)         Input field borders
        --secondary (at 20% opacity)     Hover backgrounds
        --sidebar-surface (at 15%)       Sidebar item bg
        --sidebar-surface-hover (at 25%) Sidebar item hover bg
        --sidebar-border (at 25%)        Sidebar borders
        --sidebar-text-muted             Sidebar muted labels

5       --secondary-foreground           Secondary text in buttons
        --sidebar-text-secondary         Sidebar secondary labels

6       --foreground                     Main body text, headings
        --card-foreground                Text inside cards
        --sidebar-text-primary           Sidebar primary text
```

## Files to Edit (4 files)

### 1. `frontend/src/app/shared/types/theme.types.ts`

Add your theme ID to the `LightTheme` union type (or `DarkTheme` for dark themes):

```typescript
export type LightTheme = 'white-heaven' | 'sea-foam' | ... | 'your-theme-id';
```

### 2. `frontend/src/app/core/constants/color-palettes.ts`

Add a new entry to `THEME_PALETTES` (or `DARK_THEME_PALETTES`):

```typescript
'your-theme-id': {
  ramp: {
    // Generate 50-950 shade ramp from your Color 3 (primary)
    // Use a tool like https://www.tints.dev/ with your Color 3
    '50': '...', '100': '...', '200': '...', '300': '...',
    '400': '...', '500': '...', '600': '...', '700': '...',
    '800': '...', '900': '...', '950': '...',
  },
  surface: {
    base: 'COLOR_1',   // Page background
    s1: 'COLOR_2',     // Card surfaces
    s2: 'COLOR_3',     // Secondary surfaces
    fg: 'COLOR_6',     // Text color
    border: 'rgba(COLOR_4_RGB, 0.3)',  // Border opacity
    mutedFg: 'COLOR_4', // Muted text
  },
  sidebar: {
    bg: 'COLOR_2',
    surface: 'rgba(COLOR_4_RGB, 0.15)',
    surfaceHover: 'rgba(COLOR_4_RGB, 0.25)',
    surfaceActive: 'rgba(COLOR_3_RGB, 0.2)',
    border: 'rgba(COLOR_4_RGB, 0.25)',
    textPrimary: 'COLOR_6',
    textSecondary: 'COLOR_5',
    textMuted: 'COLOR_4',
  },
  fontDisplay: "'YourFont', system-ui, sans-serif",
  fontBody: "'YourFont', system-ui, sans-serif",
  name: 'Your Theme Name',
  palette6: ['COLOR_1', 'COLOR_2', 'COLOR_3', 'COLOR_4', 'COLOR_5', 'COLOR_6'],
  preview: { bg: 'COLOR_1', primary: 'COLOR_3', fg: 'COLOR_6' },
},
```

Also add your theme ID to the `LIGHT_THEMES` array (or `DARK_THEMES`).

### 3. `frontend/src/theme-palettes.css`

Add a CSS block (copy the pattern from an existing theme):

```css
/* Your Theme: COLOR_1, COLOR_2, COLOR_3, COLOR_4, COLOR_5, COLOR_6 */
html[data-theme="your-theme-id"] {
  --background: COLOR_1;
  --card: COLOR_2;
  --card-foreground: COLOR_6;
  --muted: COLOR_2;
  --sidebar-bg: COLOR_2;
  --primary: COLOR_3;
  --primary-foreground: #ffffff;  /* or COLOR_6 if Color 3 is light */
  --ring: COLOR_3;
  --accent: rgba(COLOR_3_RGB, 0.1);
  --accent-foreground: COLOR_3;
  --accent-warm: COLOR_3;
  --accent-warm-light: rgba(COLOR_3_RGB, 0.1);
  --shadow-glow: 0 0 0 1px rgba(COLOR_3_RGB, 0.15), 0 8px 32px rgba(COLOR_3_RGB, 0.12);
  --widget-hover-border: rgba(COLOR_3_RGB, 0.35);
  --muted-foreground: COLOR_4;
  --accent-warm-foreground: COLOR_4;
  --border: rgba(COLOR_4_RGB, 0.3);
  --input: rgba(COLOR_4_RGB, 0.35);
  --secondary: rgba(COLOR_4_RGB, 0.2);
  --secondary-foreground: COLOR_5;
  --sidebar-surface: rgba(COLOR_4_RGB, 0.15);
  --sidebar-surface-hover: rgba(COLOR_4_RGB, 0.25);
  --sidebar-surface-active: rgba(COLOR_3_RGB, 0.2);
  --sidebar-border: rgba(COLOR_4_RGB, 0.25);
  --sidebar-text-muted: COLOR_4;
  --sidebar-text-secondary: COLOR_5;
  --foreground: COLOR_6;
  --sidebar-text-primary: COLOR_6;
  --success: #61BD4F;
  --success-light: rgba(97,189,79,0.1);
  --destructive: #E8445A;
  --destructive-foreground: #ffffff;
  --surface-overlay: rgba(COLOR_1_RGB, 0.96);
}
```

**IMPORTANT:** Use `html[data-theme="..."]` (with `html` prefix) for CSS specificity.

### 4. Backend: `backend/crates/db/src/queries/user_preferences.rs`

Add your theme ID to `VALID_ACCENT_COLORS` (light) or `VALID_DARK_THEMES` (dark):

```rust
const VALID_ACCENT_COLORS: &[&str] = &[
    "white-heaven", "sea-foam", ..., "your-theme-id",
];
```

### 5. Fonts (if new font family)

Add Google Fonts link in `frontend/src/index.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=YourFont:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

## Checklist

- [ ] Theme ID added to TypeScript type
- [ ] Palette object added to THEME_PALETTES (with all 6 colors in palette6)
- [ ] CSS block added to theme-palettes.css (with `html[data-theme]` prefix)
- [ ] Theme ID added to backend VALID_ACCENT_COLORS
- [ ] Font preload added to index.html (if new font)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` succeeds
- [ ] Visual test: switch to new theme, verify all 6 colors appear in sidebar, topbar, cards, text
- [ ] WCAG AA contrast: check Color 6 text on Color 1 background (minimum 4.5:1)
