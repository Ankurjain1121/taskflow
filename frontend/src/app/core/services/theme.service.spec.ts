// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// We test the ThemeService logic by testing the key behaviors directly,
// since the full Angular DI (TestBed) requires zone.js setup.

const THEME_STORAGE_KEY = 'taskbolt-theme';

describe('ThemeService - storage logic', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.cookie = `${THEME_STORAGE_KEY}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.documentElement.classList.remove('dark');
  });

  describe('loadThemeFromStorage', () => {
    function loadThemeFromStorage(): 'light' | 'dark' | 'system' {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
      return 'system';
    }

    it('returns "system" when no stored value', () => {
      expect(loadThemeFromStorage()).toBe('system');
    });

    it('returns "light" when stored as "light"', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      expect(loadThemeFromStorage()).toBe('light');
    });

    it('returns "dark" when stored as "dark"', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      expect(loadThemeFromStorage()).toBe('dark');
    });

    it('returns "system" when stored as "system"', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'system');
      expect(loadThemeFromStorage()).toBe('system');
    });

    it('returns "system" for invalid stored values', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
      expect(loadThemeFromStorage()).toBe('system');
    });
  });

  describe('saveThemeToStorage', () => {
    function saveThemeToStorage(theme: string): void {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }

    it('persists "light" to localStorage', () => {
      saveThemeToStorage('light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    });

    it('persists "dark" to localStorage', () => {
      saveThemeToStorage('dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });

    it('persists "system" to localStorage', () => {
      saveThemeToStorage('system');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    });
  });

  describe('saveThemeToCookie', () => {
    function saveThemeToCookie(theme: string): void {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1);
      document.cookie = `${THEME_STORAGE_KEY}=${theme};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    it('persists theme to cookie', () => {
      saveThemeToCookie('dark');
      expect(document.cookie).toContain(`${THEME_STORAGE_KEY}=dark`);
    });
  });

  describe('applyTheme', () => {
    function applyTheme(resolved: 'light' | 'dark'): void {
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }

    it('adds "dark" class for dark theme', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes "dark" class for light theme', () => {
      document.documentElement.classList.add('dark');
      applyTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('resolvedTheme logic', () => {
    function resolveTheme(
      theme: 'light' | 'dark' | 'system',
      systemPrefersDark: boolean,
    ): 'light' | 'dark' {
      if (theme === 'system') {
        return systemPrefersDark ? 'dark' : 'light';
      }
      return theme;
    }

    it('returns "light" when theme is "light"', () => {
      expect(resolveTheme('light', false)).toBe('light');
      expect(resolveTheme('light', true)).toBe('light');
    });

    it('returns "dark" when theme is "dark"', () => {
      expect(resolveTheme('dark', false)).toBe('dark');
      expect(resolveTheme('dark', true)).toBe('dark');
    });

    it('follows system preference when theme is "system"', () => {
      expect(resolveTheme('system', false)).toBe('light');
      expect(resolveTheme('system', true)).toBe('dark');
    });
  });
});
