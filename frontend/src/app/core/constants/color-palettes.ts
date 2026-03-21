import { AccentColor } from '../../shared/types/theme.types';

/**
 * Full Tailwind 50-950 shade ramps for PrimeNG's definePreset().
 * Used by ThemeService.updatePrimeNG() to sync PrimeNG component
 * highlights (dropdowns, dialogs, date pickers) with the theme.
 *
 * Currently ships a single "earth" (burnt orange) ramp.
 * Extensible: add 'ocean', 'forest', etc. ramps here for future themes.
 */
export const COLOR_PALETTES: Record<AccentColor, Record<string, string>> = {
  earth: {
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
};
