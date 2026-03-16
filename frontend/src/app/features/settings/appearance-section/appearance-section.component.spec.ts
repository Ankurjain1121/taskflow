import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AppearanceSectionComponent } from './appearance-section.component';
import {
  ThemeService,
  ACCENT_PRESETS,
} from '../../../core/services/theme.service';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';

describe('AppearanceSectionComponent', () => {
  let component: AppearanceSectionComponent;
  let fixture: ComponentFixture<AppearanceSectionComponent>;

  const mockThemeService = {
    theme: signal('light' as const),
    accent: signal('indigo' as const),
    isDark: signal(false),
    allThemes: signal([]),
    activeTheme: signal(null),
    setTheme: vi.fn(),
    setAccent: vi.fn(),
    setThemeSlug: vi.fn(),
  };

  const mockUserPreferencesService = {
    getPreferences: vi.fn().mockReturnValue(
      of({
        timezone: 'America/New_York',
        date_format: 'dd/MM/yyyy',
        default_project_view: 'list',
        sidebar_density: 'compact',
        language: 'en',
      }),
    ),
    updatePreferences: vi.fn().mockReturnValue(of({})),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserPreferencesService.getPreferences.mockReturnValue(
      of({
        timezone: 'America/New_York',
        date_format: 'dd/MM/yyyy',
        default_project_view: 'list',
        sidebar_density: 'compact',
        language: 'en',
      }),
    );
    mockUserPreferencesService.updatePreferences.mockReturnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [AppearanceSectionComponent, HttpClientTestingModule],
      providers: [
        { provide: ThemeService, useValue: mockThemeService },
        {
          provide: UserPreferencesService,
          useValue: mockUserPreferencesService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppearanceSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should have 3 theme options (light, dark, system)', () => {
      expect(component.themeOptions).toHaveLength(3);
      const values = component.themeOptions.map((o) => o.value);
      expect(values).toContain('light');
      expect(values).toContain('dark');
      expect(values).toContain('system');
    });

    it('should have accent presets from ThemeService', () => {
      expect(component.accentPresets).toBe(ACCENT_PRESETS);
    });

    it('should have timezone options', () => {
      expect(component.timezoneOptions.length).toBeGreaterThan(0);
    });

    it('should have date format options', () => {
      expect(component.dateFormatOptions.length).toBeGreaterThan(0);
    });

    it('should have board view options', () => {
      expect(component.boardViewOptions.length).toBeGreaterThan(0);
    });
  });

  describe('ngOnInit', () => {
    it('should load preferences and update local state', () => {
      component.ngOnInit();

      expect(mockUserPreferencesService.getPreferences).toHaveBeenCalled();
      expect(component.preferences.timezone).toBe('America/New_York');
      expect(component.preferences.dateFormat).toBe('dd/MM/yyyy');
      expect(component.preferences.defaultBoardView).toBe('list');
      expect(component.preferences.sidebarDensity).toBe('compact');
    });

    it('should keep defaults on preferences load error', () => {
      mockUserPreferencesService.getPreferences.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      component.ngOnInit();

      expect(component.preferences.timezone).toBe('UTC');
      expect(component.preferences.dateFormat).toBe('MMM dd, yyyy');
    });
  });

  describe('setTheme', () => {
    it('should delegate to ThemeService', () => {
      component.setTheme('dark');
      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('setTheme (theme slug)', () => {
    it('should delegate to ThemeService.setTheme', () => {
      component.setTheme('dark');
      expect(mockThemeService.setTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('setAccent', () => {
    it('should delegate to ThemeService', () => {
      component.setAccent('rose');
      expect(mockThemeService.setAccent).toHaveBeenCalledWith('rose');
    });
  });

  describe('savePreferences', () => {
    it('should call updatePreferences with mapped values', () => {
      component.preferences = {
        timezone: 'UTC',
        dateFormat: 'yyyy-MM-dd',
        defaultBoardView: 'kanban',
        sidebarDensity: 'comfortable',
        language: 'en',
      };

      component.savePreferences();

      expect(mockUserPreferencesService.updatePreferences).toHaveBeenCalledWith(
        {
          timezone: 'UTC',
          date_format: 'yyyy-MM-dd',
          default_project_view: 'kanban',
          sidebar_density: 'comfortable',
          language: 'en',
        },
      );
    });

    it('should set isSaving during save and reset after', () => {
      component.savePreferences();
      // After sync observable resolves, isSaving should be false
      expect(component.isSaving()).toBe(false);
    });

    it('should handle save error gracefully', () => {
      mockUserPreferencesService.updatePreferences.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      component.savePreferences();

      expect(component.isSaving()).toBe(false);
    });
  });
});
