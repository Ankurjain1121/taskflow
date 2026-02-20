/**
 * Accent color overrides
 * 
 * Each accent overrides exactly 5 CSS variables.
 * These are applied ON TOP of theme colors when accent != 'indigo'.
 */

import { AccentColor } from '../../shared/types/theme.types';

interface AccentOverrides {
  primary: string;
  'primary-foreground': string;
  ring: string;
  'chart-1': string;
  'chart-5': string;
}

interface AccentModeOverrides {
  light: AccentOverrides;
  dark: AccentOverrides;
}

export const ACCENT_OVERRIDES: Record<AccentColor, AccentModeOverrides> = {
  indigo: {
    // Indigo is the default - no override needed
    light: { primary: '#6366f1', 'primary-foreground': '#ffffff', ring: '#6366f1', 'chart-1': '#6366f1', 'chart-5': '#8b5cf6' },
    dark: { primary: '#818cf8', 'primary-foreground': '#ffffff', ring: '#818cf8', 'chart-1': '#818cf8', 'chart-5': '#a78bfa' }
  },
  blue: {
    light: { primary: '#2563eb', 'primary-foreground': '#ffffff', ring: '#2563eb', 'chart-1': '#2563eb', 'chart-5': '#3b82f6' },
    dark: { primary: '#60a5fa', 'primary-foreground': '#1e3a5f', ring: '#60a5fa', 'chart-1': '#60a5fa', 'chart-5': '#93c5fd' }
  },
  green: {
    light: { primary: '#16a34a', 'primary-foreground': '#ffffff', ring: '#16a34a', 'chart-1': '#16a34a', 'chart-5': '#22c55e' },
    dark: { primary: '#4ade80', 'primary-foreground': '#14532d', ring: '#4ade80', 'chart-1': '#4ade80', 'chart-5': '#86efac' }
  },
  orange: {
    light: { primary: '#ea580c', 'primary-foreground': '#ffffff', ring: '#ea580c', 'chart-1': '#ea580c', 'chart-5': '#f97316' },
    dark: { primary: '#fb923c', 'primary-foreground': '#431407', ring: '#fb923c', 'chart-1': '#fb923c', 'chart-5': '#fdba74' }
  },
  rose: {
    light: { primary: '#e11d48', 'primary-foreground': '#ffffff', ring: '#e11d48', 'chart-1': '#e11d48', 'chart-5': '#f43f5e' },
    dark: { primary: '#fb7185', 'primary-foreground': '#4c0519', ring: '#fb7185', 'chart-1': '#fb7185', 'chart-5': '#fda4af' }
  },
  violet: {
    light: { primary: '#7c3aed', 'primary-foreground': '#ffffff', ring: '#7c3aed', 'chart-1': '#7c3aed', 'chart-5': '#8b5cf6' },
    dark: { primary: '#a78bfa', 'primary-foreground': '#2e1065', ring: '#a78bfa', 'chart-1': '#a78bfa', 'chart-5': '#c4b5fd' }
  },
  amber: {
    light: { primary: '#d97706', 'primary-foreground': '#ffffff', ring: '#d97706', 'chart-1': '#d97706', 'chart-5': '#f59e0b' },
    dark: { primary: '#fbbf24', 'primary-foreground': '#451a03', ring: '#fbbf24', 'chart-1': '#fbbf24', 'chart-5': '#fcd34d' }
  },
  slate: {
    light: { primary: '#475569', 'primary-foreground': '#ffffff', ring: '#475569', 'chart-1': '#475569', 'chart-5': '#64748b' },
    dark: { primary: '#94a3b8', 'primary-foreground': '#0f172a', ring: '#94a3b8', 'chart-1': '#94a3b8', 'chart-5': '#cbd5e1' }
  }
};
