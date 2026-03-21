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
import { ColorMode } from '../../shared/types/theme.types';

const THEME_KEY = 'taskflow-theme';

export type Theme = 'light' | 'dark' | 'system';

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
      const root = this.document.documentElement;

      root.classList.toggle('dark', resolved === 'dark');

      // Hardcoded to 'earth' — extensible hook for future themes
      root.setAttribute('data-accent', 'earth');

      root.setAttribute('data-sidebar-style', 'light');
      root.setAttribute('data-card-style', 'raised');
      root.setAttribute('data-border-radius', 'medium');
      root.setAttribute('data-bg-pattern', 'none');

      this.updatePrimeNG(resolved === 'dark');
    });

    // Debounced server save effect (only when authenticated)
    effect(() => {
      const theme = this.theme();
      // Only save if authenticated and prefs have been loaded
      if (this.authService.isAuthenticated() && this._prefsLoaded) {
        this.debouncedSave({ color_mode: theme, accent_color: 'earth' });
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

  setColorMode(mode: ColorMode): void {
    this.setTheme(mode as Theme);
  }

  // ========== Private Methods ==========

  private updatePrimeNG(isDark: boolean): void {
    const ramp    = COLOR_PALETTES['earth'];
    const scheme  = isDark ? 'dark' : 'light';
    const base    = isDark ? '#1C1A17' : '#EDE9DD';
    const s1      = isDark ? '#262320' : '#ffffff';
    const s2      = isDark ? '#302D29' : '#F5F2EC';
    const fg      = isDark ? '#E8E4DB' : '#2E2E2E';
    const border  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(46,46,46,0.08)';
    const mutedFg = isDark ? '#8A8580' : '#9F9F9F';
    const primary = ramp['500'] ?? '#BF7B54';
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
        // accent_color from server is ignored — hardcoded to 'earth'
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
