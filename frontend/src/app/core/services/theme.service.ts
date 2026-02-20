import { Injectable, signal, computed, effect, inject, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';
import { THEME_VAR_NAMES, ThemeVarName } from '../constants/theme-vars';
import { ACCENT_OVERRIDES } from '../constants/accent-overrides';
import { ThemeApiService } from './theme-api.service';
import { UserPreferencesService } from './user-preferences.service';
import { Theme, AccentColor, ColorMode } from '../../shared/types/theme.types';

const THEME_STORAGE_KEY = 'taskflow-theme';
const ACCENT_STORAGE_KEY = 'taskflow-accent';
const LIGHT_CACHE_KEY = 'taskflow-light-cache';
const DARK_CACHE_KEY = 'taskflow-dark-cache';

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);
  private readonly themeApi = inject(ThemeApiService);
  private readonly userPrefsService = inject(UserPreferencesService);

  // State signals
  private readonly _colorMode = signal<ColorMode>(this.loadFromStorage(THEME_STORAGE_KEY, 'system') as ColorMode);
  private readonly _accent = signal<AccentColor>(this.loadFromStorage(ACCENT_STORAGE_KEY, 'indigo') as AccentColor);
  private readonly _lightSlug = signal<string>('default');
  private readonly _darkSlug = signal<string>('default');
  private readonly _allThemes = signal<Theme[]>([]);
  private readonly _activeTheme = signal<Theme | null>(null);
  private readonly systemPrefersDark = signal<boolean>(this.getSystemPreference());

  // Public readonly signals
  readonly colorMode = this._colorMode.asReadonly();
  readonly accent = this._accent.asReadonly();
  readonly activeTheme = this._activeTheme.asReadonly();
  readonly allThemes = this._allThemes.asReadonly();

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const mode = this._colorMode();
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

    // 2. Fetch themes from API (async, with retry)
    this.loadThemesFromApi();

    // 3. Listen for system preference changes
    this.setupSystemPreferenceListener();

    // 4. Listen for cross-tab storage changes
    this.setupCrossTabSync();

    // 5. React to resolved theme changes
    effect(() => {
      const resolved = this.resolvedTheme();
      this.applyThemeClasses(resolved);
      this.applyFullTheme();
    });

    // 6. Load user preferences for theme settings
    this.loadUserPreferences();
  }

  // ========== Public Methods ==========

  setColorMode(mode: ColorMode): void {
    this._colorMode.set(mode);
    this.saveToStorage(THEME_STORAGE_KEY, mode);
    this.savePreference('color_mode', mode);
  }

  setAccent(accent: AccentColor): void {
    this._accent.set(accent);
    this.saveToStorage(ACCENT_STORAGE_KEY, accent);
    this.applyFullTheme();
    this.savePreference('accent_color', accent);
  }

  setThemeSlug(slug: string): void {
    const isDark = this.isDark();
    if (isDark) {
      this._darkSlug.set(slug);
    } else {
      this._lightSlug.set(slug);
    }
    this.applyFullTheme();
    this.savePreference(isDark ? 'dark_theme_slug' : 'light_theme_slug', slug);
  }

  // ========== Private Methods ==========

  private applyCachedTheme(): void {
    try {
      const isDark = this.isDarkNow();
      const cacheKey = isDark ? DARK_CACHE_KEY : LIGHT_CACHE_KEY;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const theme = JSON.parse(cached) as Theme;
        this._activeTheme.set(theme);
        
        // Also restore accent from storage
        const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor | null;
        if (savedAccent) {
          this._accent.set(savedAccent);
        }
        
        this.applyFullTheme();
      }
    } catch (e) {
      console.warn('Failed to apply cached theme:', e);
      localStorage.removeItem(LIGHT_CACHE_KEY);
      localStorage.removeItem(DARK_CACHE_KEY);
    }
  }

  private loadThemesFromApi(): void {
    this.themeApi.listThemes().pipe(
      // Retry twice with 3 second delay
    ).subscribe({
      next: (response) => {
        if (response.themes.length === 0) return;
        
        this._allThemes.set(response.themes);
        
        // Find and apply the appropriate theme
        const isDark = this.isDarkNow();
        const slug = isDark ? this._darkSlug() : this._lightSlug();
        const theme = response.themes.find(t => t.slug === slug);
        
        if (theme) {
          this._activeTheme.set(theme);
          this.applyFullTheme();
          this.cacheTheme(theme, isDark);
        }
      },
      error: (err) => {
        console.warn('Failed to fetch themes:', err);
      }
    });
  }

  private loadUserPreferences(): void {
    this.userPrefsService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.color_mode) {
          this._colorMode.set(prefs.color_mode as ColorMode);
          this.saveToStorage(THEME_STORAGE_KEY, prefs.color_mode);
        }
        if (prefs.accent_color) {
          this._accent.set(prefs.accent_color as AccentColor);
          this.saveToStorage(ACCENT_STORAGE_KEY, prefs.accent_color);
        }
        if (prefs.light_theme_slug) {
          this._lightSlug.set(prefs.light_theme_slug);
        }
        if (prefs.dark_theme_slug) {
          this._darkSlug.set(prefs.dark_theme_slug);
        }
        
        // Reapply theme with loaded preferences
        this.applyFullTheme();
      },
      error: () => {
        // Use defaults if preferences fail to load
      }
    });
  }

  private savePreference(key: string, value: string): void {
    this.userPrefsService.updatePreferences({ [key]: value }).subscribe({
      error: () => {
        // Non-critical, localStorage is primary
      }
    });
  }

  private applyFullTheme(): void {
    const theme = this._activeTheme();
    if (!theme) return;

    const root = this.document.documentElement;
    const isDark = this.isDark();
    const accent = this._accent();

    // 1. CLEAR all vars (prevents stale contamination)
    for (const name of THEME_VAR_NAMES) {
      root.style.removeProperty(`--${name}`);
    }

    // 2. Apply theme colors (static hex + formula strings)
    const colors = theme.colors as Record<string, string>;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--${key}`, value);
    }

    // 3. Accent overrides ON TOP (5 vars per accent)
    if (accent !== 'indigo') {
      const mode = isDark ? 'dark' : 'light';
      const overrides = ACCENT_OVERRIDES[accent]?.[mode];
      if (overrides) {
        for (const [k, v] of Object.entries(overrides)) {
          root.style.setProperty(`--${k}`, v);
        }
      }
    }

    // 4. Cache accent overrides for FOUC script
    if (accent !== 'indigo') {
      const mode = isDark ? 'dark' : 'light';
      try {
        const overrides = ACCENT_OVERRIDES[accent]?.[mode] ?? {};
        localStorage.setItem('taskflow-accent-overrides', JSON.stringify(overrides));
      } catch {}
    } else {
      localStorage.removeItem('taskflow-accent-overrides');
    }

    // 5. Structural data-attributes
    const personality = theme.personality;
    root.setAttribute('data-sidebar-style', personality.sidebar_style);
    root.setAttribute('data-card-style', personality.card_style);
    root.setAttribute('data-border-radius', personality.border_radius);
    root.setAttribute('data-bg-pattern', personality.background_pattern);

    // 6. Dark class (applied by effect)
    // 7. PrimeNG — accent ramp wins over theme ramp when accent != indigo
    const ramp = (accent !== 'indigo' && ACCENT_OVERRIDES[accent]) 
      ? this.generateAccentRamp(accent, isDark)
      : theme.primeng_ramp as Record<string, string>;
    this.updatePrimeNG(ramp);

    // 8. Cache the theme
    this.cacheTheme(theme, isDark);
  }

  private generateAccentRamp(accent: AccentColor, isDark: boolean): Record<string, string> {
    // Generate a simple ramp for non-indigo accents
    const mode = isDark ? 'dark' : 'light';
    const base = ACCENT_OVERRIDES[accent]?.[mode]?.primary ?? '#6366f1';
    
    // Generate 50-950 shades
    const ramp: Record<string, string> = {};
    for (let i = 0; i <= 9; i++) {
      const shade = (i * 100 + 50).toString();
      const lightness = isDark 
        ? 0.95 - (i * 0.08) 
        : 0.1 + (i * 0.08);
      ramp[shade] = this.adjustLightness(base, lightness);
    }
    ramp['950'] = this.adjustLightness(base, isDark ? 0.05 : 0.95);
    return ramp;
  }

  private adjustLightness(hex: string, lightness: number): string {
    // Simple lightness adjustment
    const hsl = this.hexToHsl(hex);
    hsl.l = Math.max(0, Math.min(1, lightness));
    return this.hslToHex(hsl.h, hsl.s, hsl.l);
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return { h: h * 360, s, l };
  }

  private hslToHex(h: number, s: number, l: number): string {
    h /= 360;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  private applyThemeClasses(resolved: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }

  private cacheTheme(theme: Theme, isDark: boolean): void {
    const cacheKey = isDark ? DARK_CACHE_KEY : LIGHT_CACHE_KEY;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(theme));
    } catch {}
  }

  private updatePrimeNG(ramp: Record<string, string>): void {
    this.primeng.theme.set({
      preset: definePreset(Aura, { semantic: { primary: ramp } }),
      options: {
        darkModeSelector: '.dark',
        cssLayer: {
          name: 'primeng',
          order: 'theme, base, primeng',
        },
      },
    });
  }

  private isDarkNow(): boolean {
    const mode = this._colorMode();
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
      if ([LIGHT_CACHE_KEY, DARK_CACHE_KEY, 'taskflow-accent-overrides', THEME_STORAGE_KEY].includes(e.key ?? '')) {
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
