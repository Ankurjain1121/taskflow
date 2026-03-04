import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ShortcutHelpComponent } from './shortcut-help.component';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from '../../../core/services/keyboard-shortcuts.service';

describe('ShortcutHelpComponent', () => {
  let component: ShortcutHelpComponent;
  let fixture: ComponentFixture<ShortcutHelpComponent>;
  let mockShortcutsService: {
    helpRequested$: Subject<void>;
    getByCategory: ReturnType<typeof vi.fn>;
    formatShortcut: ReturnType<typeof vi.fn>;
    pushDisable: ReturnType<typeof vi.fn>;
    popDisable: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
    recentlyUsedIds: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockShortcutsService = {
      helpRequested$: new Subject<void>(),
      getByCategory: vi.fn().mockReturnValue(new Map()),
      formatShortcut: vi.fn((s: KeyboardShortcut) => s.key),
      pushDisable: vi.fn(),
      popDisable: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
      recentlyUsedIds: vi.fn().mockReturnValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [ShortcutHelpComponent],
      providers: [
        { provide: KeyboardShortcutsService, useValue: mockShortcutsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShortcutHelpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should not be visible initially', () => {
      expect(component.visible()).toBe(false);
    });

    it('should have empty categories initially', () => {
      expect(component.filteredCategories()).toEqual([]);
    });
  });

  describe('helpRequested$ subscription', () => {
    it('should become visible when help is requested', () => {
      component.ngOnInit();

      mockShortcutsService.helpRequested$.next();

      expect(component.visible()).toBe(true);
    });

    it('should update categories when help is requested', () => {
      const categoriesMap = new Map<string, KeyboardShortcut[]>();
      categoriesMap.set('Navigation', [
        {
          key: 'g',
          description: 'Go to dashboard',
          category: 'Navigation',
          action: () => {},
        },
      ]);
      categoriesMap.set('Tasks', [
        {
          key: 'n',
          description: 'New task',
          category: 'Tasks',
          action: () => {},
        },
      ]);
      mockShortcutsService.getByCategory.mockReturnValue(categoriesMap);

      component.ngOnInit();
      mockShortcutsService.helpRequested$.next();

      expect(component.filteredCategories()).toHaveLength(2);
      expect(component.filteredCategories()[0].name).toBe('Navigation');
      expect(component.filteredCategories()[1].name).toBe('Tasks');
    });
  });

  describe('close()', () => {
    it('should set visible to false', () => {
      component.visible.set(true);
      component.close();
      expect(component.visible()).toBe(false);
    });
  });

  describe('formatShortcut()', () => {
    it('should delegate to keyboard shortcuts service', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        ctrl: true,
        description: 'New task',
        category: 'Tasks',
        action: () => {},
      };
      mockShortcutsService.formatShortcut.mockReturnValue('Ctrl+N');

      const result = component.formatShortcut(shortcut);

      expect(result).toBe('Ctrl+N');
      expect(mockShortcutsService.formatShortcut).toHaveBeenCalledWith(
        shortcut,
      );
    });
  });

  describe('ngOnDestroy()', () => {
    it('should not throw when destroyed', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });

    it('should handle being called without ngOnInit', () => {
      const freshFixture = TestBed.createComponent(ShortcutHelpComponent);
      const freshComponent = freshFixture.componentInstance;
      // ngOnInit not called, sub is undefined
      expect(() => freshComponent.ngOnDestroy()).not.toThrow();
    });
  });

  describe('template rendering', () => {
    it('should not render content when not visible', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.fixed')).toBeNull();
    });

    it('should render content when visible', () => {
      mockShortcutsService.getByCategory.mockReturnValue(new Map());
      component.ngOnInit();
      mockShortcutsService.helpRequested$.next();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.fixed')).toBeTruthy();
    });

    it('should render category names', () => {
      const categoriesMap = new Map<string, KeyboardShortcut[]>();
      categoriesMap.set('Navigation', [
        {
          key: 'g',
          description: 'Go to dashboard',
          category: 'Navigation',
          action: () => {},
        },
      ]);
      mockShortcutsService.getByCategory.mockReturnValue(categoriesMap);

      component.ngOnInit();
      mockShortcutsService.helpRequested$.next();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Navigation');
      expect(text).toContain('Go to dashboard');
    });
  });
});
