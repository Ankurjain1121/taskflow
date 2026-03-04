// Theme types for the database-driven theming system

export interface ThemeColors {
  // Base colors
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  border: string;
  input: string;
  muted: string;
  'muted-foreground': string;

  // Primary colors
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  ring: string;
  accent: string;
  'accent-foreground': string;

  // Semantic colors
  success: string;
  'success-light': string;
  destructive: string;
  'destructive-foreground': string;

  // Sidebar
  'sidebar-bg': string;
  'sidebar-surface': string;
  'sidebar-surface-hover': string;
  'sidebar-surface-active': string;
  'sidebar-border': string;
  'sidebar-text-primary': string;
  'sidebar-text-secondary': string;
  'sidebar-text-muted': string;

  // Surfaces
  'surface-0': string;
  'surface-1': string;
  'surface-2': string;
  'surface-3': string;

  // Shadows
  'shadow-xs': string;
  'shadow-sm': string;
  'shadow-md': string;
  'shadow-lg': string;
  'shadow-glow': string;
  'widget-hover-border': string;

  // Charts
  'chart-1': string;
  'chart-2': string;
  'chart-3': string;
  'chart-4': string;
  'chart-5': string;

  // Status chips
  'chip-overdue': string;
  'chip-due-soon': string;
  'chip-completed': string;

  // Status backgrounds
  'status-red-bg': string;
  'status-red-border': string;
  'status-red-text': string;
  'status-green-bg': string;
  'status-green-border': string;
  'status-green-text': string;
  'status-blue-bg': string;
  'status-blue-border': string;
  'status-blue-text': string;
  'status-amber-bg': string;
  'status-amber-border': string;
  'status-amber-text': string;
}

export interface ThemePersonality {
  sidebar_style: 'light' | 'dark' | 'tinted';
  card_style: 'flat' | 'raised' | 'bordered';
  border_radius: 'small' | 'medium' | 'large';
  background_pattern: 'none' | 'dots' | 'grid' | 'waves';
}

export interface ThemePreview {
  sidebar_color: string;
  background_color: string;
  card_color: string;
  primary_color: string;
  sidebar_is_dark: boolean;
}

export interface Theme {
  slug: string;
  name: string;
  category:
    | 'clean'
    | 'dark-sidebar'
    | 'tinted'
    | 'famous'
    | 'bold'
    | 'specialty';
  description: string;
  is_dark: boolean;
  sort_order: number;
  is_active: boolean;
  colors: ThemeColors;
  personality: ThemePersonality;
  preview: ThemePreview;
  primeng_ramp: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ThemeListResponse {
  themes: Theme[];
}

export type AccentColor =
  | 'indigo'
  | 'blue'
  | 'green'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'amber'
  | 'slate';
export type ColorMode = 'light' | 'dark' | 'system';

export interface ThemeUserPrefs {
  light_theme_slug: string;
  dark_theme_slug: string;
  accent_color: AccentColor;
  color_mode: ColorMode;
}
