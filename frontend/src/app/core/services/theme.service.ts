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
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { COLOR_PALETTES } from '../constants/color-palettes';
import { UserPreferencesService } from './user-preferences.service';
import { AuthService } from './auth.service';
import { AccentColor, ColorMode } from '../../shared/types/theme.types';

const THEME_KEY = 'taskflow-theme';
const ACCENT_KEY = 'taskflow-accent';

export type Theme = 'light' | 'dark' | 'system';
export type { AccentColor } from '../../shared/types/theme.types';

export const ACCENT_PRESETS: {
  value: AccentColor;
  label: string;
  color: string;
}[] = [
  { value: 'blue',   label: 'Blue',   color: '#3b82f6' },
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
  { value: 'green',  label: 'Green',  color: '#22c55e' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'rose',   label: 'Rose',   color: '#f43f5e' },
  { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  { value: 'amber',  label: 'Amber',  color: '#f59e0b' },
  { value: 'slate',  label: 'Slate',  color: '#64748b' },
];

@Injectable({
  providedIn: 'root',
})
export class ThemeService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly authService = inject(AuthService);
  private _prefsLoaded = false;

  readonly theme = signal<Theme>(
    this.loadFromStorage(THEME_KEY, 'system') as Theme,
  );
  readonly accent = signal<AccentColor>(
    this.loadFromStorage(ACCENT_KEY, 'blue') as AccentColor,
  );

  private readonly systemPrefersDark = signal<boolean>(
    this.getSystemPreference(),
  );

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const mode = this.theme();
    return mode === 'system'
      ? this.systemPrefersDark()
        ? 'dark'
        : 'light'
      : mode;
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingSave: Record<string, string> | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.setupSystemPreferenceListener();
    this.setupCrossTabSync();

    // Single effect: apply dark class, data-accent, personality attrs, PrimeNG theme
    effect(() => {
      const resolved = this.resolvedTheme();
      const accent = this.accent();
      const root = this.document.documentElement;

      root.classList.toggle('dark', resolved === 'dark');

      if (accent === 'indigo') {
        root.removeAttribute('data-accent');
      } else {
        root.setAttribute('data-accent', accent);
      }

      root.setAttribute('data-sidebar-style', 'light');
      root.setAttribute('data-card-style', 'raised');
      root.setAttribute('data-border-radius', 'medium');
      root.setAttribute('data-bg-pattern', 'none');

      this.updatePrimeNG(accent, resolved === 'dark');
    });

    // Debounced server save effect (only when authenticated)
    effect(() => {
      const theme = this.theme();
      const accent = this.accent();
      // Only save if authenticated and prefs have been loaded
      if (this.authService.isAuthenticated() && this._prefsLoaded) {
        this.debouncedSave({ color_mode: theme, accent_color: accent });
      }
    });

    // Load user preferences from server once authenticated
    effect(() => {
      if (this.authService.isAuthenticated() && !this._prefsLoaded) {
        this._prefsLoaded = true;
        this.loadUserPreferences();
      }
    });
  }

  // ========== Public Methods ==========

  setTheme(t: Theme): void {
    this.theme.set(t);
    this.saveToStorage(THEME_KEY, t);
  }

  setAccent(a: AccentColor): void {
    this.accent.set(a);
    this.saveToStorage(ACCENT_KEY, a);
  }

  setColorMode(mode: ColorMode): void {
    this.setTheme(mode as Theme);
  }

  // ========== Private Methods ==========

  private updatePrimeNG(accent: AccentColor, isDark: boolean): void {
    const ramp    = COLOR_PALETTES[accent];
    const scheme  = isDark ? 'dark' : 'light';
    const base    = isDark ? '#181b34' : '#f6f7fb';
    const s1      = isDark ? '#30324e' : '#ffffff';
    const s2      = isDark ? '#3a3c58' : '#f8f9fb';
    const fg      = isDark ? '#f8fafc' : '#0f172a';
    const border  = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    const mutedFg = isDark ? '#94a3b8' : '#64748b';
    const primary = ramp['500'] ?? '#6366f1';
    const hi      = ramp['400'] ?? primary;
    const hlPct   = isDark ? '10%' : '8%';
    const hlFPct  = isDark ? '15%' : '12%';

    this.primeng.theme.set({
      preset: definePreset(Aura, {
        semantic: {
          primary: ramp,
          colorScheme: {
            [scheme]: {
              surface: {
                0: base, 50: base,
                100: s1, 200: s1,
                300: s2, 400: s2, 500: s2, 600: s2,
                700: s2, 800: s2, 900: s2, 950: s2,
              },
              text: {
                color: fg,
                hoverColor: fg,
                mutedColor: mutedFg,
              },
              highlight: {
                background: `color-mix(in srgb, ${hi} ${hlPct}, transparent)`,
                focusBackground: `color-mix(in srgb, ${hi} ${hlFPct}, transparent)`,
                color: fg,
                focusColor: fg,
              },
              content: {
                background: s1,
                borderColor: border,
                color: fg,
                hoverBackground: `color-mix(in srgb, ${hi} 6%, ${s1})`,
                hoverColor: fg,
              },
              formField: {
                background: s1,
                borderColor: border,
                color: fg,
                placeholderColor: mutedFg,
                iconColor: mutedFg,
                hoverBorderColor: border,
                focusBorderColor: primary,
              },
              overlay: {
                modal:   { background: s1, borderColor: border, color: fg },
                popover: { background: s1, borderColor: border, color: fg },
              },
              list: {
                option: {
                  focusBackground:    `color-mix(in srgb, ${hi} 8%, ${s1})`,
                  selectedBackground: `color-mix(in srgb, ${hi} ${hlPct}, ${s1})`,
                  color: fg, focusColor: fg, selectedColor: fg,
                },
              },
            },
          },
        },
      }),
      options: {
        darkModeSelector: '.dark',
        cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
      },
    });
  }

  private loadUserPreferences(): void {
    this.userPrefsService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.color_mode) {
          this.theme.set(prefs.color_mode as Theme);
          this.saveToStorage(THEME_KEY, prefs.color_mode);
        }
        if (prefs.accent_color) {
          this.accent.set(prefs.accent_color as AccentColor);
          this.saveToStorage(ACCENT_KEY, prefs.accent_color);
        }
      },
      error: () => {},
    });
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
      if (e.key === THEME_KEY && e.newValue) {
        this.theme.set(e.newValue as Theme);
      }
      if (e.key === ACCENT_KEY && e.newValue) {
        this.accent.set(e.newValue as AccentColor);
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
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
  }

  private debouncedSave(prefs: Record<string, string>): void {
    this._pendingSave = { ...this._pendingSave, ...prefs };
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }
    this._saveTimer = setTimeout(() => {
      const toSave = this._pendingSave;
      this._pendingSave = null;
      this._saveTimer = null;
      if (toSave) {
        this.userPrefsService
          .updatePreferences(toSave)
          .pipe(catchError(() => EMPTY))
          .subscribe();
      }
    }, 500);
  }
}
