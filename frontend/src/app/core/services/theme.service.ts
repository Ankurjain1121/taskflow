import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { PrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';
import { COLOR_PALETTES } from '../constants/color-palettes';

export type Theme = 'light' | 'dark' | 'system';
export type Palette = 'default' | 'dracula' | 'dimmed';
export type AccentColor =
  | 'indigo'
  | 'blue'
  | 'green'
  | 'orange'
  | 'rose'
  | 'violet'
  | 'amber'
  | 'slate';

const THEME_STORAGE_KEY = 'taskflow-theme';
const PALETTE_STORAGE_KEY = 'taskflow-palette';
const ACCENT_STORAGE_KEY = 'taskflow-accent';

export const PALETTE_PRESETS: {
  value: Palette;
  label: string;
  darkOnly: boolean;
}[] = [
  { value: 'default', label: 'Default', darkOnly: false },
  { value: 'dracula', label: 'Dracula', darkOnly: true },
  { value: 'dimmed', label: 'Dimmed', darkOnly: true },
];

export const ACCENT_PRESETS: {
  value: AccentColor;
  label: string;
  color: string;
}[] = [
  { value: 'indigo', label: 'Indigo', color: '#6366f1' },
  { value: 'blue', label: 'Blue', color: '#2563eb' },
  { value: 'green', label: 'Green', color: '#16a34a' },
  { value: 'orange', label: 'Orange', color: '#ea580c' },
  { value: 'rose', label: 'Rose', color: '#e11d48' },
  { value: 'violet', label: 'Violet', color: '#7c3aed' },
  { value: 'amber', label: 'Amber', color: '#d97706' },
  { value: 'slate', label: 'Slate', color: '#475569' },
];

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);

  private readonly _theme = signal<Theme>(this.loadFromStorage(THEME_STORAGE_KEY, 'system') as Theme);
  private readonly _palette = signal<Palette>(this.loadFromStorage(PALETTE_STORAGE_KEY, 'default') as Palette);
  private readonly _accent = signal<AccentColor>(this.loadFromStorage(ACCENT_STORAGE_KEY, 'indigo') as AccentColor);

  private readonly systemPrefersDark = signal<boolean>(
    this.getSystemPreference(),
  );

  readonly theme = this._theme.asReadonly();
  readonly palette = this._palette.asReadonly();
  readonly accent = this._accent.asReadonly();

  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const currentTheme = this._theme();
    if (currentTheme === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return currentTheme;
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    this.applyTheme(this.resolvedTheme());
    this.applyPalette(this._palette());
    this.applyAccent(this._accent());
    this.updatePrimeNGAccent(this._accent());

    effect(() => {
      const resolved = this.resolvedTheme();
      this.applyTheme(resolved);
      // Reset palette when switching to light (palettes are dark-only)
      if (resolved === 'light' && this._palette() !== 'default') {
        this.setPalette('default');
      }
    });

    this.setupSystemPreferenceListener();
  }

  setTheme(theme: Theme): void {
    this._theme.set(theme);
    this.saveToStorage(THEME_STORAGE_KEY, theme);
    this.saveThemeToCookie(theme);
  }

  setPalette(palette: Palette): void {
    this._palette.set(palette);
    this.saveToStorage(PALETTE_STORAGE_KEY, palette);
    this.applyPalette(palette);
  }

  setAccent(accent: AccentColor): void {
    this._accent.set(accent);
    this.saveToStorage(ACCENT_STORAGE_KEY, accent);
    this.applyAccent(accent);
    this.updatePrimeNGAccent(accent);
  }

  private applyTheme(resolved: 'light' | 'dark'): void {
    const htmlElement = this.document.documentElement;
    if (resolved === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      // Remove palette classes when going light
      htmlElement.classList.remove('dracula', 'dimmed');
    }
  }

  private applyPalette(palette: Palette): void {
    const htmlElement = this.document.documentElement;
    htmlElement.classList.remove('dracula', 'dimmed');
    if (palette !== 'default') {
      htmlElement.classList.add(palette);
    }
  }

  private applyAccent(accent: AccentColor): void {
    const htmlElement = this.document.documentElement;
    if (accent === 'indigo') {
      htmlElement.removeAttribute('data-accent');
    } else {
      htmlElement.setAttribute('data-accent', accent);
    }
  }

  private updatePrimeNGAccent(accent: AccentColor): void {
    const palette = COLOR_PALETTES[accent];
    this.primeng.theme.set({
      preset: definePreset(Aura, { semantic: { primary: palette } }),
      options: {
        darkModeSelector: '.dark',
        cssLayer: {
          name: 'primeng',
          order: 'theme, base, primeng',
        },
      },
    });
  }

  private loadFromStorage(key: string, fallback: string): string {
    if (typeof localStorage === 'undefined') {
      return fallback;
    }
    return localStorage.getItem(key) || fallback;
  }

  private saveToStorage(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }

  private saveThemeToCookie(theme: Theme): void {
    if (typeof document !== 'undefined') {
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
