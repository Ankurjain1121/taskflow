# TASK: Theme System Overhaul — Multi-Theme + Trello-Style Data Viz

## Objective
Replace single hardcoded "Warm Earth" theme with 7 light + 2 dark switchable themes, plus Trello-style bright data viz colors. Per-user theme choice stored in backend.

## Reviews Passed
- CEO Review: CLEAR (Selective Expansion, 5 cherry-picks accepted)
- Eng Review: CLEAR (0 critical gaps)
- Design Review: 9/10 (10 design decisions added)
- Full plan: `docs/designs/theme-system-overhaul.md`
- CEO plan: `~/.gstack/projects/Ankurjain1121-taskflow/ceo-plans/2026-03-21-theme-system-overhaul.md`

## Key Decisions (from reviews)
- Approach: Hybrid CSS + TS (CSS attribute selectors for vars, TS for PrimeNG ramp)
- CSS cascade: :root → [data-theme] → html.dark → html.dark[data-dark-theme]
- Extract theme CSS to theme-palettes.css (styles.css already 1607 lines)
- Data viz colors: theme-independent Trello-style bright (red/green/blue/yellow)
- Priority colors: single PRIORITY_BASE source → derive all variants (DRY)
- Column colors: single array of {light, dark} objects
- Hover preview: CSS-only (no PrimeNG sync during preview)
- LEGACY_THEME_MAP: explicit mapping of old accent values → warm-earth
- Migration: comment acknowledging prior dark_theme_slug history
- VARCHAR(30) for dark_theme column
- Swatch cards: 80px tall, flex-1 wide, 12px gap, 4→3→2 responsive grid
- Active: 2px primary border + bottom-right 16px pill checkmark
- ARIA: role=radiogroup with arrow-key grid nav
- Names below swatches (text-xs, centered)
- Per-user theme choice (not per-workspace)
- Animated transitions via .theme-transitioning (200ms)
- Cmd+K theme switcher with colored circles + names
- Font preload all 7 families in index.html
- Per-theme sidebar colors from palette

## Implementation Phases

### Phase 1: Backend (independent of frontend)
- [x] 1a. Add dark_theme field to UserPreferences model
- [x] 1b. Update VALID_ACCENT_COLORS + add VALID_DARK_THEMES in queries
- [x] 1c. Update validate_theme_preferences() for dark_theme
- [x] 1d. Update upsert() signature + SQL for dark_theme column
- [x] 1e. Update route handler for dark_theme parameter
- [x] 1f. Write migration SQL (UPDATE legacy + ADD COLUMN)
- [x] 1g. Run cargo sqlx prepare --workspace
- [x] 1h. cargo check + clippy

### Phase 2: Frontend Types & Constants (foundation)
- [x] 2a. Update theme.types.ts: LightTheme, DarkTheme types (remove AccentColor)
- [x] 2b. Update color-palettes.ts: THEME_PALETTES + DARK_THEME_PALETTES (7+2 palettes)
- [x] 2c. Update task-colors.ts: Trello-style bright colors, single PRIORITY_BASE source
- [x] 2d. Create theme-palettes.css: extract + add [data-theme] and dark variant blocks
- [x] 2e. Update styles.css: remove per-theme blocks, import theme-palettes.css, add data-viz block

### Phase 3: Frontend Theme Service (core logic)
- [x] 3a. Update theme.service.ts: lightTheme/darkTheme signals, setLightTheme/setDarkTheme
- [x] 3b. Add previewTheme/revertPreview methods
- [x] 3c. Refactor updatePrimeNG to use palette registry + identity check
- [x] 3d. Update debouncedSave/loadUserPreferences for both themes
- [x] 3e. Update cross-tab sync for 2 localStorage keys
- [x] 3f. Add .theme-transitioning animation wiring
- [x] 3g. Add per-theme font + sidebar color application

### Phase 4: Frontend UI (Settings + Cmd+K)
- [x] 4a. Update appearance-section.component.ts: theme picker with swatch cards
- [x] 4b. Add hover preview + revert on leave/destroy
- [x] 4c. Add Cmd+K theme switcher in command-palette.component.ts
- [x] 4d. Update index.html: FOUC script for new localStorage keys + font preloads

### Phase 5: Build + Deploy
- [x] 5a. tsc --noEmit + production build
- [x] 5b. Docker build + deploy
- [ ] 5c. Verify all success criteria (visual QA needed)

## Success Criteria
- [ ] All 7 light themes render correctly with proper contrast
- [ ] Both dark themes render correctly
- [ ] Theme persists across page reload (localStorage + backend)
- [ ] Theme syncs across browser tabs
- [ ] PrimeNG components match active theme
- [ ] Data viz colors are bright Trello-style and theme-independent
- [ ] Settings > Appearance shows theme picker with swatch previews
- [ ] Backend validates new theme IDs (7 light + 2 dark)
- [ ] No regression in Warm Earth appearance
- [ ] Legacy users migrated gracefully
- [ ] No FOUC on initial page load
- [ ] data-accent attribute fully retired

## Progress Log
- 2026-03-21: CEO review CLEARED, Eng review CLEARED, Design review 9/10
- 2026-03-22: Starting TDD implementation
- 2026-03-22: Phase 1 (backend) DONE — model, queries, route, migration, 468 legacy rows migrated
- 2026-03-22: Phase 2 (frontend types/CSS) DONE — types, 9 palettes, task-colors DRY, CSS blocks
- 2026-03-22: Phase 3 (ThemeService) DONE — signals, preview, PrimeNG, cross-tab, transitions
- 2026-03-22: Phase 4 (UI) DONE — swatch picker, Cmd+K, index.html FOUC + fonts
- 2026-03-22: Phase 5 in progress — Docker build running
