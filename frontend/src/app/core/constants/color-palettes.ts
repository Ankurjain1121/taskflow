import { LightTheme, DarkTheme } from '../../shared/types/theme.types';

/**
 * Theme palette definition for PrimeNG integration and theme switching.
 */
export interface ThemePalette {
  /** 50-950 PrimeNG shade ramp for the primary color */
  ramp: Record<string, string>;
  /** Surface colors for PrimeNG color scheme */
  surface: {
    base: string;
    s1: string;
    s2: string;
    fg: string;
    border: string;
    mutedFg: string;
  };
  /** Sidebar tokens */
  sidebar: {
    bg: string;
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
  /** Display font family */
  fontDisplay: string;
  /** Body font family */
  fontBody: string;
  /** Human-readable theme name */
  name: string;
  /** All 6 user-provided palette colors (light → dark) for swatch preview + derivation */
  palette6: [string, string, string, string, string, string];
  /** Preview swatch colors for theme picker UI */
  preview: {
    bg: string;
    primary: string;
    fg: string;
  };
}

// =============================================================================
// Light theme palettes
// =============================================================================

export const THEME_PALETTES: Record<LightTheme, ThemePalette> = {
  'white-heaven': {
    ramp: {
      '50': '#f5f4f7',
      '100': '#eceaef',
      '200': '#dddbe3',
      '300': '#ceccd6',
      '400': '#c2c0c9',
      '500': '#a8a6b2',
      '600': '#908e9a',
      '700': '#767481',
      '800': '#5e5c68',
      '900': '#46454f',
      '950': '#2e2d36',
    },
    surface: {
      base: '#fefefe',
      s1: '#e8e7ec',
      s2: '#d5d7de',
      fg: '#868698',
      border: 'rgba(213,215,222,0.5)',
      mutedFg: '#aba9b4',
    },
    sidebar: {
      bg: '#f0eff3',
      surface: 'rgba(134,134,152,0.04)',
      surfaceHover: 'rgba(134,134,152,0.08)',
      surfaceActive: 'rgba(134,134,152,0.12)',
      border: 'rgba(134,134,152,0.08)',
      textPrimary: '#3a3a4a',
      textSecondary: '#6a6a7a',
      textMuted: '#868698',
    },
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    name: 'White Heaven',
    palette6: ['#fefefe', '#e8e7ec', '#d5d7de', '#c2c0c9', '#aba9b4', '#868698'],
    preview: { bg: '#fefefe', primary: '#c2c0c9', fg: '#868698' },
  },

  'sea-foam': {
    ramp: {
      '50': '#edf5f5',
      '100': '#d8ebeb',
      '200': '#b8d9d8',
      '300': '#97c6c4',
      '400': '#77adab',
      '500': '#5f9694',
      '600': '#4d7c7a',
      '700': '#3e6463',
      '800': '#304e4d',
      '900': '#233939',
      '950': '#172525',
    },
    surface: {
      base: '#c9dce1',
      s1: '#b1c4c4',
      s2: '#77adab',
      fg: '#42514f',
      border: 'rgba(155,158,156,0.3)',
      mutedFg: '#9b9e9c',
    },
    sidebar: {
      bg: '#bdd3d5',
      surface: 'rgba(119,173,171,0.06)',
      surfaceHover: 'rgba(119,173,171,0.1)',
      surfaceActive: 'rgba(119,173,171,0.16)',
      border: 'rgba(66,81,79,0.08)',
      textPrimary: '#42514f',
      textSecondary: '#5a6e6c',
      textMuted: '#6a7e7c',
    },
    fontDisplay: "'Nunito', system-ui, sans-serif",
    fontBody: "'Nunito Sans', system-ui, sans-serif",
    name: 'Sea Foam',
    palette6: ['#c9dce1', '#b1c4c4', '#77adab', '#9b9e9c', '#6f7c7a', '#42514f'],
    preview: { bg: '#c9dce1', primary: '#77adab', fg: '#42514f' },
  },

  'warm-earth': {
    ramp: {
      '50': '#FBF5F0',
      '100': '#F5E8DC',
      '200': '#EACDB5',
      '300': '#DEAD88',
      '400': '#D4945E',
      '500': '#BF7B54',
      '600': '#A66843',
      '700': '#8B5535',
      '800': '#704328',
      '900': '#5A361F',
      '950': '#3D2414',
    },
    surface: {
      base: '#EDE9DD',
      s1: '#ffffff',
      s2: '#F5F2EC',
      fg: '#2E2E2E',
      border: 'rgba(46,46,46,0.08)',
      mutedFg: '#9F9F9F',
    },
    sidebar: {
      bg: '#F5F2EC',
      surface: 'rgba(191,123,84,0.03)',
      surfaceHover: 'rgba(191,123,84,0.06)',
      surfaceActive: 'rgba(191,123,84,0.1)',
      border: 'rgba(46,46,46,0.06)',
      textPrimary: '#2E2E2E',
      textSecondary: '#5A5550',
      textMuted: '#9F9F9F',
    },
    fontDisplay: "'Syne', system-ui, sans-serif",
    fontBody: "'DM Sans', system-ui, sans-serif",
    name: 'Warm Earth',
    palette6: ['#EDE9DD', '#E8E4DB', '#BF7B54', '#D4A853', '#9F9F9F', '#2E2E2E'],
    preview: { bg: '#EDE9DD', primary: '#BF7B54', fg: '#2E2E2E' },
  },

  'storm-cloud': {
    ramp: {
      '50': '#f2f3f3',
      '100': '#e5e6e7',
      '200': '#cccdd0',
      '300': '#b2b4b7',
      '400': '#9ea1a4',
      '500': '#818283',
      '600': '#6b6c6e',
      '700': '#565758',
      '800': '#424344',
      '900': '#2f3031',
      '950': '#1e1f1f',
    },
    surface: {
      base: '#e8e9e9',
      s1: '#f0f0f1',
      s2: '#dddee0',
      fg: '#3a4242',
      border: 'rgba(58,66,66,0.1)',
      mutedFg: '#7a8282',
    },
    sidebar: {
      bg: '#dddee0',
      surface: 'rgba(158,161,164,0.05)',
      surfaceHover: 'rgba(158,161,164,0.1)',
      surfaceActive: 'rgba(158,161,164,0.16)',
      border: 'rgba(58,66,66,0.08)',
      textPrimary: '#3a4242',
      textSecondary: '#5a6262',
      textMuted: '#7a8282',
    },
    fontDisplay: "'Space Grotesk', system-ui, sans-serif",
    fontBody: "'Work Sans', system-ui, sans-serif",
    name: 'Storm Cloud',
    palette6: ['#e8e9e9', '#cecfd1', '#9ea1a4', '#818283', '#5b6161', '#3a4242'],
    preview: { bg: '#e8e9e9', primary: '#9ea1a4', fg: '#3a4242' },
  },

  'morning-sky': {
    ramp: {
      '50': '#fef8ee',
      '100': '#fdf0d8',
      '200': '#fce3b5',
      '300': '#fbd692',
      '400': '#facc92',
      '500': '#e5b46e',
      '600': '#c49650',
      '700': '#9f7640',
      '800': '#7c5c32',
      '900': '#5a4224',
      '950': '#3a2b17',
    },
    surface: {
      base: '#c6eeea',
      s1: '#d4f4f1',
      s2: '#b8e6e2',
      fg: '#343330',
      border: 'rgba(52,51,48,0.1)',
      mutedFg: '#6a6960',
    },
    sidebar: {
      bg: '#b8e6e2',
      surface: 'rgba(250,204,146,0.08)',
      surfaceHover: 'rgba(250,204,146,0.14)',
      surfaceActive: 'rgba(250,204,146,0.22)',
      border: 'rgba(52,51,48,0.08)',
      textPrimary: '#343330',
      textSecondary: '#525048',
      textMuted: '#6a6960',
    },
    fontDisplay: "'Poppins', system-ui, sans-serif",
    fontBody: "'Poppins', system-ui, sans-serif",
    name: 'Morning Sky',
    palette6: ['#c6eeea', '#f1dafa', '#facc92', '#9d978b', '#343330', '#000000'],
    preview: { bg: '#c6eeea', primary: '#facc92', fg: '#343330' },
  },

  'misty-forest': {
    ramp: {
      '50': '#f0f4f0',
      '100': '#dfe6df',
      '200': '#c4d2c5',
      '300': '#a7bcaa',
      '400': '#8ca890',
      '500': '#708173',
      '600': '#5c6b5e',
      '700': '#4a574c',
      '800': '#3a443b',
      '900': '#2a322b',
      '950': '#1c211c',
    },
    surface: {
      base: '#dae8dc',
      s1: '#e6f0e8',
      s2: '#cdddd0',
      fg: '#101712',
      border: 'rgba(16,23,18,0.1)',
      mutedFg: '#5a6e5c',
    },
    sidebar: {
      bg: '#cdddd0',
      surface: 'rgba(112,129,115,0.05)',
      surfaceHover: 'rgba(112,129,115,0.1)',
      surfaceActive: 'rgba(112,129,115,0.16)',
      border: 'rgba(16,23,18,0.08)',
      textPrimary: '#101712',
      textSecondary: '#3a4a3c',
      textMuted: '#5a6e5c',
    },
    fontDisplay: "'Lora', system-ui, serif",
    fontBody: "'Source Sans 3', system-ui, sans-serif",
    name: 'Misty Forest',
    palette6: ['#dae8dc', '#a8bdae', '#708173', '#48574b', '#2a3326', '#101712'],
    preview: { bg: '#dae8dc', primary: '#708173', fg: '#101712' },
  },

  'modern-dental': {
    ramp: {
      '50': '#f1f4f6',
      '100': '#e2e8ec',
      '200': '#cad4db',
      '300': '#b4c1ca',
      '400': '#a4b2bb',
      '500': '#8a9aa5',
      '600': '#72838e',
      '700': '#5c6b75',
      '800': '#47545c',
      '900': '#333e44',
      '950': '#21292e',
    },
    surface: {
      base: '#e4ebef',
      s1: '#edf2f5',
      s2: '#d8e2e8',
      fg: '#151513',
      border: 'rgba(21,21,19,0.1)',
      mutedFg: '#6a7880',
    },
    sidebar: {
      bg: '#d8e2e8',
      surface: 'rgba(164,178,187,0.06)',
      surfaceHover: 'rgba(164,178,187,0.1)',
      surfaceActive: 'rgba(164,178,187,0.16)',
      border: 'rgba(21,21,19,0.08)',
      textPrimary: '#151513',
      textSecondary: '#3a4448',
      textMuted: '#6a7880',
    },
    fontDisplay: "'Outfit', system-ui, sans-serif",
    fontBody: "'Outfit', system-ui, sans-serif",
    name: 'Modern Dental',
    palette6: ['#e4ebef', '#c7d6df', '#a4b2bb', '#898c8f', '#575553', '#151513'],
    preview: { bg: '#e4ebef', primary: '#a4b2bb', fg: '#151513' },
  },
};

// =============================================================================
// Dark theme palettes
// =============================================================================

export const DARK_THEME_PALETTES: Record<DarkTheme, ThemePalette> = {
  'warm-earth-dark': {
    ramp: {
      '50': '#FBF5F0',
      '100': '#F5E8DC',
      '200': '#EACDB5',
      '300': '#DEAD88',
      '400': '#D4945E',
      '500': '#BF7B54',
      '600': '#A66843',
      '700': '#8B5535',
      '800': '#704328',
      '900': '#5A361F',
      '950': '#3D2414',
    },
    surface: {
      base: '#1C1A17',
      s1: '#262320',
      s2: '#302D29',
      fg: '#E8E4DB',
      border: 'rgba(255,255,255,0.08)',
      mutedFg: '#8A8580',
    },
    sidebar: {
      bg: '#1A1816',
      surface: 'rgba(255,255,255,0.02)',
      surfaceHover: 'rgba(255,255,255,0.06)',
      surfaceActive: 'rgba(212,148,94,0.15)',
      border: 'rgba(255,255,255,0.07)',
      textPrimary: 'rgba(255,255,255,0.95)',
      textSecondary: 'rgba(200,198,192,0.85)',
      textMuted: 'rgba(150,148,142,0.6)',
    },
    fontDisplay: "'Syne', system-ui, sans-serif",
    fontBody: "'DM Sans', system-ui, sans-serif",
    name: 'Warm Earth Dark',
    palette6: ['#1C1A17', '#262320', '#D4945E', '#E0BC6A', '#8A8580', '#E8E4DB'],
    preview: { bg: '#1C1A17', primary: '#D4945E', fg: '#E8E4DB' },
  },

  'purple-night': {
    ramp: {
      '50': '#f3eef8',
      '100': '#e4d9f0',
      '200': '#d0bbe4',
      '300': '#bb9dd8',
      '400': '#a887ce',
      '500': '#9270be',
      '600': '#7a5ba8',
      '700': '#634890',
      '800': '#4e3874',
      '900': '#3a2a58',
      '950': '#261c3c',
    },
    surface: {
      base: '#171821',
      s1: '#1e1f2b',
      s2: '#262736',
      fg: '#E8E4DB',
      border: 'rgba(255,255,255,0.08)',
      mutedFg: '#7a7890',
    },
    sidebar: {
      bg: '#1e1f2b',
      surface: 'rgba(168,135,206,0.04)',
      surfaceHover: 'rgba(168,135,206,0.1)',
      surfaceActive: 'rgba(168,135,206,0.18)',
      border: 'rgba(255,255,255,0.07)',
      textPrimary: 'rgba(255,255,255,0.95)',
      textSecondary: 'rgba(200,196,210,0.85)',
      textMuted: 'rgba(150,145,170,0.6)',
    },
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    name: 'Purple Night',
    palette6: ['#a887ce', '#7b6e7f', '#9c526d', '#4d3e50', '#292631', '#171821'],
    preview: { bg: '#171821', primary: '#a887ce', fg: '#E8E4DB' },
  },
};

// =============================================================================
// Theme lists and legacy mapping
// =============================================================================

export const LIGHT_THEMES: readonly LightTheme[] = [
  'white-heaven',
  'sea-foam',
  'warm-earth',
  'storm-cloud',
  'morning-sky',
  'misty-forest',
  'modern-dental',
] as const;

export const DARK_THEMES: readonly DarkTheme[] = [
  'warm-earth-dark',
  'purple-night',
] as const;

/** Maps old accent_color DB values to new LightTheme names */
export const LEGACY_THEME_MAP: Record<string, LightTheme> = {
  indigo: 'warm-earth',
  blue: 'warm-earth',
  green: 'warm-earth',
  orange: 'warm-earth',
  rose: 'warm-earth',
  violet: 'warm-earth',
  amber: 'warm-earth',
  slate: 'warm-earth',
  earth: 'warm-earth',
};

/**
 * @deprecated Use THEME_PALETTES[theme].ramp instead.
 * Kept for backward compatibility during migration.
 */
export const COLOR_PALETTES: Record<string, Record<string, string>> = {
  earth: THEME_PALETTES['warm-earth'].ramp,
};
