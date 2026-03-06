import {
  Injectable,
  signal,
  computed,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';
import { Subject, of, EMPTY } from 'rxjs';
import {
  debounceTime,
  switchMap,
  catchError,
  retry,
  filter,
} from 'rxjs/operators';
import { THEME_VAR_NAMES } from '../constants/theme-vars';
import { ACCENT_OVERRIDES } from '../constants/accent-overrides';
import { COLOR_PALETTES } from '../constants/color-palettes';
import { ThemeApiService } from './theme-api.service';
import { UserPreferencesService } from './user-preferences.service';
import { AuthService } from './auth.service';
import {
  Theme as DbTheme,
  AccentColor,
  ColorMode,
} from '../../shared/types/theme.types';

const THEME_STORAGE_KEY = 'taskflow-theme';
const ACCENT_STORAGE_KEY = 'taskflow-accent';
const LIGHT_CACHE_KEY = 'taskflow-light-cache';
const DARK_CACHE_KEY = 'taskflow-dark-cache';

export type Theme = 'light' | 'dark' | 'system';
export type { AccentColor } from '../../shared/types/theme.types';

export const ACCENT_PRESETS: {
  value: AccentColor;
  label: string;
  color: string;
}[] = [
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'green', label: 'Green', color: '#22c55e' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'rose', label: 'Rose', color: '#f43f5e' },
  { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  { value: 'amber', label: 'Amber', color: '#f59e0b' },
  { value: 'slate', label: 'Slate', color: '#64748b' },
];

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);
  private readonly themeApi = inject(ThemeApiService);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly authService = inject(AuthService);
  private _themesLoaded = false;

  // State signals
  readonly theme = signal<Theme>(
    this.loadFromStorage(THEME_STORAGE_KEY, 'system') as Theme,
  );
  readonly accent = signal<AccentColor>(
    this.loadFromStorage(ACCENT_STORAGE_KEY, 'indigo') as AccentColor,
  );
  private readonly _lightSlug = signal<string>('default');
  private readonly _darkSlug = signal<string>('default');
  private readonly _allThemes = signal<DbTheme[]>([]);
  private readonly _cachedTheme = signal<DbTheme | null>(null);
  private readonly _activeTheme = computed<DbTheme | null>(() => {
    const themes = this._allThemes();
    if (themes.length > 0) {
      const isDark = this.isDark();
      const slug = isDark ? this._darkSlug() : this._lightSlug();
      return (
        themes.find((t) => t.slug === slug) ??
        themes.find((t) => t.is_dark === isDark) ??
        null
      );
    }
    return this._cachedTheme();
  });
  private readonly _saveSubject = new Subject<Record<string, string>>();
  private readonly systemPrefersDark = signal<boolean>(
    this.getSystemPreference(),
  );

  // Public computed
  readonly activeTheme = computed(() => this._activeTheme());
  readonly allThemes = computed(() => this._allThemes());

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const mode = this.theme();
    if (mode === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return mode;
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    // 1. Apply cached theme immediately (sync, non-blocking)
    this.applyCachedTheme();

    // 2. Listen for system preference changes
    this.setupSystemPreferenceListener();

    // 3. Listen for cross-tab storage changes
    this.setupCrossTabSync();

    // 4. React to resolved theme or active theme changes
    effect(() => {
      const resolved = this.resolvedTheme();
      this._activeTheme(); // track active theme changes (slug or allThemes)
      this.applyThemeClasses(resolved);
      this.applyFullTheme();
    });

    // 5. Debounced server save (only when authenticated)
    this._saveSubject
      .pipe(
        filter(() => this.authService.isAuthenticated()),
        debounceTime(500),
        switchMap((prefs) =>
          this.userPrefsService
            .updatePreferences(prefs)
            .pipe(catchError(() => EMPTY)),
        ),
      )
      .subscribe();

    // 6. Fetch themes + user preferences only once when authenticated
    effect(() => {
      if (this.authService.isAuthenticated() && !this._themesLoaded) {
        this._themesLoaded = true;
        this.loadThemesFromApi();
        this.loadUserPreferences();
      }
    });
  }

  // ========== Public Methods ==========

  setTheme(t: Theme): void {
    this.theme.set(t);
    this.saveToStorage(THEME_STORAGE_KEY, t);
    this.savePreference('color_mode', t);
  }

  setAccent(a: AccentColor): void {
    this.accent.set(a);
    this.saveToStorage(ACCENT_STORAGE_KEY, a);
    this.applyFullTheme();
    this.savePreference('accent_color', a);
  }

  setColorMode(mode: ColorMode): void {
    this.setTheme(mode as Theme);
  }

  setThemeSlug(slug: string): void {
    const isDark = this.isDark();
    if (isDark) {
      this._darkSlug.set(slug);
    } else {
      this._lightSlug.set(slug);
    }
    this.cacheActiveTheme();
    this.savePreference(isDark ? 'dark_theme_slug' : 'light_theme_slug', slug);
  }

  // ========== Private Methods ==========

  private applyCachedTheme(): void {
    try {
      const isDark = this.isDarkNow();
      const cacheKey = isDark ? DARK_CACHE_KEY : LIGHT_CACHE_KEY;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const theme = JSON.parse(cached) as DbTheme;
        this._cachedTheme.set(theme);

        // Set slug signals from cache so computed stays consistent
        if (isDark) {
          this._darkSlug.set(theme.slug);
        } else {
          this._lightSlug.set(theme.slug);
        }

        const savedAccent = localStorage.getItem(
          ACCENT_STORAGE_KEY,
        ) as AccentColor | null;
        if (savedAccent) {
          this.accent.set(savedAccent);
        }
      }
    } catch (e) {
      localStorage.removeItem(LIGHT_CACHE_KEY);
      localStorage.removeItem(DARK_CACHE_KEY);
    }
  }

  private loadThemesFromApi(): void {
    this.themeApi
      .listThemes()
      .pipe(
        retry({ count: 2, delay: 3000 }),
        catchError(() => of({ themes: [] as DbTheme[] })),
      )
      .subscribe({
        next: (response) => {
          if (response.themes.length === 0) return;
          this._allThemes.set(response.themes); // computed auto-recalculates
          this.cacheActiveTheme();
        },
      });
  }

  private loadUserPreferences(): void {
    this.userPrefsService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.color_mode) {
          this.theme.set(prefs.color_mode as Theme);
          this.saveToStorage(THEME_STORAGE_KEY, prefs.color_mode);
        }
        if (prefs.accent_color) {
          this.accent.set(prefs.accent_color as AccentColor);
          this.saveToStorage(ACCENT_STORAGE_KEY, prefs.accent_color);
        }
        if (prefs.light_theme_slug) {
          this._lightSlug.set(prefs.light_theme_slug);
        }
        if (prefs.dark_theme_slug) {
          this._darkSlug.set(prefs.dark_theme_slug);
        }
        // effect auto-applies; just cache the resolved theme
        this.cacheActiveTheme();
      },
      error: () => {},
    });
  }

  private savePreference(key: string, value: string): void {
    this._saveSubject.next({ [key]: value });
  }

  private applyFullTheme(): void {
    const theme = this._activeTheme();
    const root = this.document.documentElement;
    const isDark = this.isDark();
    const accent = this.accent();

    // Clear all vars (prevents stale contamination)
    for (const name of THEME_VAR_NAMES) {
      root.style.removeProperty(`--${name}`);
    }

    // Apply theme colors - prefer DB theme, fall back to defaults
    if (theme?.colors) {
      for (const [key, value] of Object.entries(theme.colors)) {
        root.style.setProperty(`--${key}`, value);
      }
    } else {
      const colors = this.getThemeColors(isDark);
      for (const [key, value] of Object.entries(colors)) {
        root.style.setProperty(`--${key}`, value);
      }
    }

    // Accent overrides ON TOP
    if (accent !== 'indigo') {
      const mode = isDark ? 'dark' : 'light';
      const overrides = ACCENT_OVERRIDES[accent]?.[mode];
      if (overrides) {
        for (const [k, v] of Object.entries(overrides)) {
          root.style.setProperty(`--${k}`, v);
        }
      }
    }

    // Cache accent overrides for FOUC script
    if (accent !== 'indigo') {
      const mode = isDark ? 'dark' : 'light';
      try {
        localStorage.setItem(
          'taskflow-accent-overrides',
          JSON.stringify(ACCENT_OVERRIDES[accent]?.[mode] ?? {}),
        );
      } catch {}
    } else {
      localStorage.removeItem('taskflow-accent-overrides');
    }

    // Personality data attributes - use theme values or defaults
    const personality = theme?.personality;
    root.setAttribute(
      'data-sidebar-style',
      personality?.sidebar_style ?? 'light',
    );
    root.setAttribute('data-card-style', personality?.card_style ?? 'raised');
    root.setAttribute(
      'data-border-radius',
      personality?.border_radius ?? 'medium',
    );
    root.setAttribute(
      'data-bg-pattern',
      personality?.background_pattern ?? 'none',
    );

    // PrimeNG ramp - accent ramp wins over theme ramp when accent != indigo
    const accentRamp = accent !== 'indigo' ? COLOR_PALETTES[accent] : null;
    const ramp = accentRamp ?? theme?.primeng_ramp;
    if (ramp) {
      const surfaces = theme?.colors
        ? {
            s0: theme.colors['surface-0'],
            s1: theme.colors['surface-1'],
            s2: theme.colors['surface-2'],
            s3: theme.colors['surface-3'],
          }
        : undefined;
      this.updatePrimeNG(ramp, isDark, surfaces);
    }
  }

  private getThemeColors(isDark: boolean): Record<string, string> {
    // Default theme colors
    const lightColors = {
      background: '#F6F7FB',
      foreground: '#0f172a',
      card: '#ffffff',
      'card-foreground': '#0f172a',
      border: '#e2e8f0',
      input: '#e2e8f0',
      muted: '#f8f9fb',
      'muted-foreground': '#64748b',
      primary: '#6366f1',
      'primary-foreground': '#ffffff',
      secondary: '#f1f5f9',
      'secondary-foreground': '#0f172a',
      ring: '#6366f1',
      accent: '#fff7ed',
      'accent-foreground': '#9a3412',
      success: '#10b981',
      'success-light': '#ecfdf5',
      destructive: '#ef4444',
      'destructive-foreground': '#ffffff',
      'sidebar-bg': '#F0F1F5',
      'sidebar-surface': 'rgba(0,0,0,0.03)',
      'sidebar-surface-hover': 'rgba(0,0,0,0.05)',
      'sidebar-surface-active':
        'color-mix(in srgb, var(--primary) 8%, transparent)',
      'sidebar-border': 'rgba(0,0,0,0.08)',
      'sidebar-text-primary': '#0f172a',
      'sidebar-text-secondary': 'rgba(51,65,85,0.85)',
      'sidebar-text-muted': 'rgba(100,116,139,0.6)',
    };

    const darkColors = {
      background: '#181B34',
      foreground: '#f8fafc',
      card: '#30324E',
      'card-foreground': '#f8fafc',
      border: 'rgba(255,255,255,0.1)',
      input: 'rgba(255,255,255,0.15)',
      muted: '#1e293b',
      'muted-foreground': '#94a3b8',
      primary: '#818cf8',
      'primary-foreground': '#ffffff',
      secondary: '#1e293b',
      'secondary-foreground': '#f8fafc',
      ring: '#818cf8',
      accent: '#431407',
      'accent-foreground': '#fed7aa',
      success: '#34d399',
      'success-light': '#064e3b',
      destructive: '#dc2626',
      'destructive-foreground': '#ffffff',
      'sidebar-bg': '#13152A',
      'sidebar-surface': 'rgba(255,255,255,0.03)',
      'sidebar-surface-hover': 'rgba(255,255,255,0.06)',
      'sidebar-surface-active':
        'color-mix(in srgb, var(--primary) 14%, transparent)',
      'sidebar-border': 'rgba(255,255,255,0.05)',
      'sidebar-text-primary': 'rgba(255,255,255,0.95)',
      'sidebar-text-secondary': 'rgba(203,213,225,0.8)',
      'sidebar-text-muted': 'rgba(148,163,184,0.5)',
    };

    return isDark ? darkColors : lightColors;
  }

  private applyThemeClasses(resolved: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private cacheTheme(theme: DbTheme, isDark: boolean): void {
    const cacheKey = isDark ? DARK_CACHE_KEY : LIGHT_CACHE_KEY;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(theme));
    } catch {}
  }

  private cacheActiveTheme(): void {
    const theme = this._activeTheme();
    if (theme) {
      this.cacheTheme(theme, this.isDark());
    }
  }

  private updatePrimeNG(
    ramp: Record<string, string>,
    isDark: boolean,
    surfaces?: { s0?: string; s1?: string; s2?: string; s3?: string },
  ): void {
    const scheme = isDark ? 'dark' : 'light';
    const colorScheme: Record<string, Record<string, unknown>> = {};

    if (surfaces?.s0) {
      const base = surfaces.s0;
      const s1 = surfaces.s1 ?? base;
      const s2 = surfaces.s2 ?? s1;
      const s3 = surfaces.s3 ?? s2;

      colorScheme[scheme] = {
        surface: {
          0: base,
          50: base,
          100: s1,
          200: s1,
          300: s2,
          400: s2,
          500: s3,
          600: s3,
          700: s3,
          800: s3,
          900: s3,
          950: s3,
        },
        highlight: {
          background: `color-mix(in srgb, ${ramp['450'] ?? ramp['550']} 16%, transparent)`,
          focusBackground: `color-mix(in srgb, ${ramp['450'] ?? ramp['550']} 24%, transparent)`,
          color: ramp['450'] ?? ramp['550'],
          focusColor: ramp['350'] ?? ramp['450'] ?? ramp['550'],
        },
      };
    }

    this.primeng.theme.set({
      preset: definePreset(Aura, {
        semantic: { primary: ramp, colorScheme },
      }),
      options: {
        darkModeSelector: '.dark',
        cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
      },
    });
  }

  private isDarkNow(): boolean {
    const mode = this.theme();
    if (mode === 'system') {
      return this.getSystemPreference();
    }
    return mode === 'dark';
  }

  private getSystemPreference(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private setupSystemPreferenceListener(): void {
    if (typeof window === 'undefined') return;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      this.systemPrefersDark.set(e.matches);
    };
    this.mediaQuery.addEventListener('change', this.mediaQueryListener);
  }

  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', (e) => {
      if (
        [
          LIGHT_CACHE_KEY,
          DARK_CACHE_KEY,
          'taskflow-accent-overrides',
          THEME_STORAGE_KEY,
        ].includes(e.key ?? '')
      ) {
        this.applyCachedTheme();
      }
    });
  }

  private loadFromStorage(key: string, fallback: string): string {
    if (typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
  }

  private saveToStorage(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
  }
}
