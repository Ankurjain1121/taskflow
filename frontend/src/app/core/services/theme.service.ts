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
import {
  THEME_PALETTES,
  DARK_THEME_PALETTES,
  LIGHT_THEMES,
  DARK_THEMES,
  LEGACY_THEME_MAP,
} from '../constants/color-palettes';
import { UserPreferencesService } from './user-preferences.service';
import { AuthService } from './auth.service';
import { ColorMode, LightTheme, DarkTheme } from '../../shared/types/theme.types';

const THEME_KEY = 'taskflow-theme';
const LIGHT_THEME_KEY = 'taskflow-light-theme';
const DARK_THEME_KEY = 'taskflow-dark-theme';

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

  // ========== Public Signals ==========

  readonly theme = signal<Theme>(
    this.loadFromStorage(THEME_KEY, 'system') as Theme,
  );

  readonly lightTheme = signal<LightTheme>(
    this.loadFromStorage(LIGHT_THEME_KEY, 'warm-earth') as LightTheme,
  );

  readonly darkTheme = signal<DarkTheme>(
    this.loadFromStorage(DARK_THEME_KEY, 'warm-earth-dark') as DarkTheme,
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

  // ========== Private State ==========

  private readonly _previewing = signal(false);
  private _lastPrimeNGIdentity = '';
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingSave: Record<string, string> | null = null;
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private _storageListener: ((e: StorageEvent) => void) | null = null;

  constructor() {
    this.setupSystemPreferenceListener();
    this.setupCrossTabSync();

    // Main effect: apply theme attributes, fonts, sidebar colors, PrimeNG
    effect(() => {
      const resolved = this.resolvedTheme();
      const lt = this.lightTheme();
      const dt = this.darkTheme();
      const root = this.document.documentElement;
      const isDark = resolved === 'dark';

      root.classList.toggle('dark', isDark);

      // Set data-theme from lightTheme (always present for CSS cascade)
      if (!this._previewing()) {
        root.setAttribute('data-theme', lt);
      }

      // Set data-dark-theme only when dark mode is active
      if (isDark) {
        root.setAttribute('data-dark-theme', dt);
      } else {
        root.removeAttribute('data-dark-theme');
      }

      // Structural attributes
      root.setAttribute('data-sidebar-style', 'light');
      root.setAttribute('data-card-style', 'raised');
      root.setAttribute('data-border-radius', 'medium');
      root.setAttribute('data-bg-pattern', 'none');

      this.updatePrimeNG(isDark);
    });

    // Debounced server save effect (only when authenticated)
    effect(() => {
      const mode = this.theme();
      const lt = this.lightTheme();
      const dt = this.darkTheme();
      if (this.authService.isAuthenticated() && this._prefsLoaded) {
        this.debouncedSave({
          color_mode: mode,
          accent_color: lt,
          dark_theme: dt,
        });
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

  setLightTheme(t: LightTheme): void {
    this.addTransitionClass();
    this.lightTheme.set(t);
    this.saveToStorage(LIGHT_THEME_KEY, t);
  }

  setDarkTheme(t: DarkTheme): void {
    this.addTransitionClass();
    this.darkTheme.set(t);
    this.saveToStorage(DARK_THEME_KEY, t);
  }

  /** CSS-only preview: sets data-theme without saving or syncing PrimeNG */
  previewTheme(t: LightTheme): void {
    this._previewing.set(true);
    this.document.documentElement.setAttribute('data-theme', t);
  }

  /** CSS-only preview for dark themes: sets data-dark-theme without saving */
  previewDarkTheme(t: DarkTheme): void {
    this._previewing.set(true);
    this.document.documentElement.setAttribute('data-dark-theme', t);
  }

  /** Revert a CSS-only preview to the committed theme values */
  revertPreview(): void {
    if (this._previewing()) {
      this._previewing.set(false);
      this.document.documentElement.setAttribute('data-theme', this.lightTheme());
      if (this.isDark()) {
        this.document.documentElement.setAttribute('data-dark-theme', this.darkTheme());
      } else {
        this.document.documentElement.removeAttribute('data-dark-theme');
      }
    }
  }

  // ========== Private Methods ==========

  private updatePrimeNG(isDark: boolean): void {
    if (!this.primeng?.theme) {
      return;
    }

    const lt = this.lightTheme();
    const dt = this.darkTheme();
    const identity = isDark ? `${dt}:dark` : `${lt}:light`;

    // Skip if already applied
    if (identity === this._lastPrimeNGIdentity) {
      return;
    }
    this._lastPrimeNGIdentity = identity;

    const palette = isDark
      ? DARK_THEME_PALETTES[dt]
      : THEME_PALETTES[lt];

    const { base, s1, s2, fg, border, mutedFg } = palette.surface;
    const { ramp } = palette;
    const scheme = isDark ? 'dark' : 'light';
    const primary = ramp['500'] ?? '#BF7B54';
    const hi = ramp['400'] ?? primary;
    const hlPct = isDark ? '10%' : '8%';
    const hlFPct = isDark ? '15%' : '12%';

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

  private addTransitionClass(): void {
    const root = this.document.documentElement;
    root.classList.add('theme-transitioning');
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 200);
  }

  private loadUserPreferences(): void {
    this.userPrefsService.getPreferences().subscribe({
      next: (prefs) => {
        if (prefs.color_mode) {
          this.theme.set(prefs.color_mode as Theme);
          this.saveToStorage(THEME_KEY, prefs.color_mode);
        }

        // Restore light theme
        if (prefs.accent_color) {
          const raw = prefs.accent_color;
          if ((LIGHT_THEMES as readonly string[]).includes(raw)) {
            this.lightTheme.set(raw as LightTheme);
            this.saveToStorage(LIGHT_THEME_KEY, raw);
          } else if (LEGACY_THEME_MAP[raw]) {
            this.lightTheme.set(LEGACY_THEME_MAP[raw]);
            this.saveToStorage(LIGHT_THEME_KEY, LEGACY_THEME_MAP[raw]);
          }
          // else keep default 'warm-earth'
        }

        // Restore dark theme
        if (prefs.dark_theme) {
          const raw = prefs.dark_theme;
          if ((DARK_THEMES as readonly string[]).includes(raw)) {
            this.darkTheme.set(raw as DarkTheme);
            this.saveToStorage(DARK_THEME_KEY, raw);
          }
          // else keep default 'warm-earth-dark'
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
    this._storageListener = (e: StorageEvent) => {
      if (e.key === THEME_KEY && e.newValue) {
        this.theme.set(e.newValue as Theme);
      }
      if (e.key === LIGHT_THEME_KEY && e.newValue) {
        this.lightTheme.set(e.newValue as LightTheme);
        // Only sync PrimeNG if light mode is active
        if (!this.isDark()) {
          this.updatePrimeNG(false);
        }
      }
      if (e.key === DARK_THEME_KEY && e.newValue) {
        this.darkTheme.set(e.newValue as DarkTheme);
        // Only sync PrimeNG if dark mode is active
        if (this.isDark()) {
          this.updatePrimeNG(true);
        }
      }
    };
    window.addEventListener('storage', this._storageListener);
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
    if (this._storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this._storageListener);
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
