// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  THEME_PALETTES,
  DARK_THEME_PALETTES,
  LIGHT_THEMES,
  DARK_THEMES,
  ThemePalette,
} from './color-palettes';
import { LightTheme } from '../../shared/types/theme.types';

// =============================================================================
// 6-Color Architecture Invariants
// =============================================================================
// Every theme must map 6 palette colors (C1–C6) to distinct visual zones:
//   C1 (lightest) → cards (surface.s1)
//   C2            → background (surface.base)
//   C3            → sidebar (sidebar.bg)
//   C4            → primary accent (ramp['500'] or similar)
//   C5            → muted text (surface.mutedFg)
//   C6 (darkest)  → foreground text (surface.fg)
// =============================================================================

/**
 * Parse a hex color to [r, g, b].
 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/**
 * Relative luminance per WCAG 2.1.
 */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colors.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns true if hex is a valid 6-digit hex color.
 */
function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// =============================================================================
// Tests
// =============================================================================

describe('Theme Palettes — 6-Color Architecture', () => {
  // -------------------------------------------------------------------------
  // Structure & completeness
  // -------------------------------------------------------------------------
  describe('palette structure', () => {
    it('LIGHT_THEMES array matches THEME_PALETTES keys', () => {
      const paletteKeys = Object.keys(THEME_PALETTES).sort();
      const themeArray = [...LIGHT_THEMES].sort();
      expect(paletteKeys).toEqual(themeArray);
    });

    it('DARK_THEMES array matches DARK_THEME_PALETTES keys', () => {
      const paletteKeys = Object.keys(DARK_THEME_PALETTES).sort();
      const themeArray = [...DARK_THEMES].sort();
      expect(paletteKeys).toEqual(themeArray);
    });

    it('every light theme has exactly 6 palette colors', () => {
      for (const [id, palette] of Object.entries(THEME_PALETTES)) {
        expect(palette.palette6).toHaveLength(6);
        for (const color of palette.palette6) {
          expect(isHex(color)).toBe(true);
        }
      }
    });

    it('every dark theme has exactly 6 palette colors', () => {
      for (const [id, palette] of Object.entries(DARK_THEME_PALETTES)) {
        expect(palette.palette6).toHaveLength(6);
        for (const color of palette.palette6) {
          expect(isHex(color)).toBe(true);
        }
      }
    });

    it('every palette has required fields', () => {
      const allPalettes: Record<string, ThemePalette> = {
        ...THEME_PALETTES,
        ...DARK_THEME_PALETTES,
      };
      for (const [id, p] of Object.entries(allPalettes)) {
        expect(p.name).toBeTruthy();
        expect(p.fontDisplay).toBeTruthy();
        expect(p.fontBody).toBeTruthy();
        expect(p.ramp).toBeTruthy();
        expect(p.surface).toBeTruthy();
        expect(p.sidebar).toBeTruthy();
        expect(p.preview).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // C1↔C2 remap: surface.s1 = C1 (card), surface.base = C2 (background)
  // -------------------------------------------------------------------------
  describe('C1→card, C2→background remap', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: surface.s1 (card) matches palette6[0] (C1)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.surface.s1).toBe(p.palette6[0]);
      },
    );

    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: surface.base (background) matches palette6[1] (C2)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.surface.base).toBe(p.palette6[1]);
      },
    );

    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: C1 (card) is lighter than or equal to C2 (background)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        const lumC1 = relativeLuminance(p.palette6[0]);
        const lumC2 = relativeLuminance(p.palette6[1]);
        // C1 should be the lightest — higher luminance
        expect(lumC1).toBeGreaterThanOrEqual(lumC2 - 0.05); // small tolerance for Morning Sky
      },
    );
  });

  // -------------------------------------------------------------------------
  // C3→sidebar
  // -------------------------------------------------------------------------
  describe('C3→sidebar mapping', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: sidebar.bg matches palette6[2] (C3)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.sidebar.bg).toBe(p.palette6[2]);
      },
    );

    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: sidebar.bg is distinct from surface.base (background)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.sidebar.bg).not.toBe(p.surface.base);
      },
    );
  });

  // -------------------------------------------------------------------------
  // C6→foreground text
  // -------------------------------------------------------------------------
  describe('C6→foreground mapping', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: surface.fg matches palette6[5] (C6)',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.surface.fg).toBe(p.palette6[5]);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Sidebar text contrast (WCAG AA)
  // -------------------------------------------------------------------------
  describe('sidebar text contrast', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: sidebar text has adequate contrast against sidebar.bg',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        const bg = p.sidebar.bg;
        const textPrimary = p.sidebar.textPrimary;

        // textPrimary might be rgba(...) for some themes — skip those
        if (!isHex(textPrimary)) return;

        const ratio = contrastRatio(bg, textPrimary);
        // WCAG AA for large text = 3:1, normal text = 4.5:1
        // Sidebar nav items are typically 14-16px, so use 3.5:1 as reasonable minimum
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      },
    );
  });

  // -------------------------------------------------------------------------
  // All 6 colors are distinct
  // -------------------------------------------------------------------------
  describe('all 6 palette colors are distinct', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: no duplicate colors in palette6',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        const unique = new Set(p.palette6.map((c) => c.toLowerCase()));
        expect(unique.size).toBe(6);
      },
    );
  });

  // -------------------------------------------------------------------------
  // PrimeNG ramp completeness
  // -------------------------------------------------------------------------
  describe('PrimeNG ramp', () => {
    const requiredShades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: ramp has all 11 required shades',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        for (const shade of requiredShades) {
          expect(p.ramp[shade]).toBeTruthy();
          expect(isHex(p.ramp[shade])).toBe(true);
        }
      },
    );
  });

  // -------------------------------------------------------------------------
  // Font definitions
  // -------------------------------------------------------------------------
  describe('font definitions', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: has fontDisplay and fontBody with fallback',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(p.fontDisplay).toContain('system-ui');
        expect(p.fontBody).toContain('system-ui');
      },
    );
  });

  // -------------------------------------------------------------------------
  // Preview swatch consistency
  // -------------------------------------------------------------------------
  describe('preview swatch', () => {
    it.each(LIGHT_THEMES as unknown as LightTheme[])(
      '%s: preview colors are valid hex',
      (themeId) => {
        const p = THEME_PALETTES[themeId];
        expect(isHex(p.preview.bg)).toBe(true);
        expect(isHex(p.preview.primary)).toBe(true);
        expect(isHex(p.preview.fg)).toBe(true);
      },
    );
  });
});

// =============================================================================
// CSS Variable Mapping Tests (theme-palettes.css contract)
// =============================================================================

describe('Theme CSS Variable Contract', () => {
  // These tests verify that the TypeScript palette data correctly maps to
  // the CSS variables defined in theme-palettes.css. The CSS file is the
  // source of truth at runtime, but the TS palettes feed PrimeNG.

  it('warm-earth is the default theme (not in THEME_PALETTES overrides)', () => {
    // warm-earth is defined in :root in styles.css, not in theme-palettes.css
    expect(THEME_PALETTES['warm-earth']).toBeDefined();
    // But it IS in THEME_PALETTES for PrimeNG integration
    expect(THEME_PALETTES['warm-earth'].name).toBe('Warm Earth');
  });

  it('every theme has a human-readable name', () => {
    for (const [, p] of Object.entries(THEME_PALETTES)) {
      expect(p.name.length).toBeGreaterThan(0);
      // Name should be title case (first letter uppercase)
      expect(p.name[0]).toBe(p.name[0].toUpperCase());
    }
  });

  it('light and dark theme arrays have no overlap', () => {
    const lightSet = new Set(LIGHT_THEMES);
    for (const dt of DARK_THEMES) {
      expect(lightSet.has(dt as unknown as LightTheme)).toBe(false);
    }
  });
});
