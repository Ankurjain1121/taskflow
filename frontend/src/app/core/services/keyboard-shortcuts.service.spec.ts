import { TestBed } from '@angular/core/testing';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from './keyboard-shortcuts.service';

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [KeyboardShortcutsService],
    });
    service = TestBed.inject(KeyboardShortcutsService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('register() / unregister()', () => {
    it('should register and retrieve a shortcut', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        ctrl: true,
        description: 'New task',
        category: 'tasks',
        action: () => {},
      };

      service.register('new-task', shortcut);
      const all = service.getAll();
      expect(all.length).toBe(1);
      expect(all[0].key).toBe('n');
    });

    it('should unregister a shortcut by id', () => {
      service.register('test', {
        key: 't',
        description: 'Test',
        category: 'general',
        action: () => {},
      });
      expect(service.getAll().length).toBe(1);

      service.unregister('test');
      expect(service.getAll().length).toBe(0);
    });
  });

  describe('unregisterByCategory()', () => {
    it('should remove all shortcuts in a category', () => {
      service.register('a', {
        key: 'a',
        description: 'A',
        category: 'nav',
        action: () => {},
      });
      service.register('b', {
        key: 'b',
        description: 'B',
        category: 'nav',
        action: () => {},
      });
      service.register('c', {
        key: 'c',
        description: 'C',
        category: 'other',
        action: () => {},
      });

      service.unregisterByCategory('nav');
      const remaining = service.getAll();
      expect(remaining.length).toBe(1);
      expect(remaining[0].category).toBe('other');
    });
  });

  describe('getByCategory()', () => {
    it('should group shortcuts by category', () => {
      service.register('a', {
        key: 'a',
        description: 'A',
        category: 'nav',
        action: () => {},
      });
      service.register('b', {
        key: 'b',
        description: 'B',
        category: 'tasks',
        action: () => {},
      });

      const grouped = service.getByCategory();
      expect(grouped.get('nav')?.length).toBe(1);
      expect(grouped.get('tasks')?.length).toBe(1);
    });
  });

  describe('formatShortcut()', () => {
    it('should format shortcut with modifiers', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        ctrl: true,
        shift: true,
        description: 'New',
        category: 'general',
        action: () => {},
      };

      const formatted = service.formatShortcut(shortcut);
      expect(formatted).toBe('Ctrl+Shift+N');
    });

    it('should format shortcut without modifiers', () => {
      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        description: 'Close',
        category: 'general',
        action: () => {},
      };

      const formatted = service.formatShortcut(shortcut);
      expect(formatted).toBe('Escape');
    });

    it('should format alt modifier', () => {
      const shortcut: KeyboardShortcut = {
        key: 's',
        alt: true,
        description: 'Search',
        category: 'general',
        action: () => {},
      };

      const formatted = service.formatShortcut(shortcut);
      expect(formatted).toBe('Alt+S');
    });
  });

  describe('setEnabled()', () => {
    it('should disable and re-enable shortcut handling', () => {
      let called = false;
      service.register('test', {
        key: 'x',
        description: 'Test',
        category: 'general',
        action: () => {
          called = true;
        },
      });

      service.pushDisable();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      expect(called).toBe(false);

      service.popDisable();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      expect(called).toBe(true);
    });
  });
});
