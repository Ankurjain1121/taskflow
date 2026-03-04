/**
 * Canonical variable manifest
 * Used to clear all theme variables before applying a new theme
 * to prevent stale contamination.
 */

export const THEME_VAR_NAMES = [
  // Base colors
  'background',
  'foreground',
  'card',
  'card-foreground',
  'border',
  'input',
  'muted',
  'muted-foreground',

  // Primary colors
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'ring',
  'accent',
  'accent-foreground',

  // Semantic colors
  'success',
  'success-light',
  'destructive',
  'destructive-foreground',

  // Sidebar
  'sidebar-bg',
  'sidebar-surface',
  'sidebar-surface-hover',
  'sidebar-surface-active',
  'sidebar-border',
  'sidebar-text-primary',
  'sidebar-text-secondary',
  'sidebar-text-muted',

  // Surfaces
  'surface-0',
  'surface-1',
  'surface-2',
  'surface-3',

  // Shadows
  'shadow-xs',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-glow',
  'widget-hover-border',

  // Charts
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',

  // Status chips
  'chip-overdue',
  'chip-due-soon',
  'chip-completed',

  // Status backgrounds
  'status-red-bg',
  'status-red-border',
  'status-red-text',
  'status-green-bg',
  'status-green-border',
  'status-green-text',
  'status-blue-bg',
  'status-blue-border',
  'status-blue-text',
  'status-amber-bg',
  'status-amber-border',
  'status-amber-text',
] as const;

export type ThemeVarName = (typeof THEME_VAR_NAMES)[number];
