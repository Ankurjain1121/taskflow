import { Injectable, signal, computed, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'taskflow-theme';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly _theme = signal<Theme>(this.loadThemeFromStorage());

  private readonly systemPrefersDark = signal<boolean>(
    this.getSystemPreference()
  );

  readonly theme = this._theme.asReadonly();

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const currentTheme = this._theme();
    if (currentTheme === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return currentTheme;
  });

  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    // Apply theme on initialization
    this.applyTheme(this.resolvedTheme());

    // Set up effect to apply theme when it changes
    effect(() => {
      const resolved = this.resolvedTheme();
      this.applyTheme(resolved);
    });

    // Set up system preference listener
    this.setupSystemPreferenceListener();
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    this.saveThemeToStorage(theme);
    this.saveThemeToCookie(theme);
  }

  private applyTheme(resolved: 'light' | 'dark'): void {
    const htmlElement = this.document.documentElement;
    if (resolved === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
  }

  private loadThemeFromStorage(): Theme {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private saveThemeToStorage(theme: Theme): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }

  private saveThemeToCookie(theme: Theme): void {
    if (typeof document !== 'undefined') {
      // Set cookie with 1 year expiration
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `${THEME_STORAGE_KEY}=${theme};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }
  }

  private getSystemPreference(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private setupSystemPreferenceListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      this.systemPrefersDark.set(e.matches);
    };

    this.mediaQuery.addEventListener('change', this.mediaQueryListener);
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
  }
}
