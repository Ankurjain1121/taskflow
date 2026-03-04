import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpComponent } from './help.component';
import {
  KeyboardShortcutsService,
  KeyboardShortcut,
} from '../../core/services/keyboard-shortcuts.service';

describe('HelpComponent', () => {
  let component: HelpComponent;
  let fixture: ComponentFixture<HelpComponent>;
  let mockShortcutsService: {
    getByCategory: ReturnType<typeof vi.fn>;
    formatShortcut: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockShortcutsService = {
      getByCategory: vi.fn().mockReturnValue(new Map()),
      formatShortcut: vi.fn().mockReturnValue('Ctrl + S'),
    };

    await TestBed.configureTestingModule({
      imports: [HelpComponent],
      providers: [
        {
          provide: KeyboardShortcutsService,
          useValue: mockShortcutsService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have features array with 8 items', () => {
      expect(component.features).toHaveLength(8);
    });

    it('should have faqs array with 5 items', () => {
      expect(component.faqs).toHaveLength(5);
    });

    it('should start with empty shortcutGroups', () => {
      expect(component.shortcutGroups()).toEqual([]);
    });
  });

  describe('features', () => {
    it('should include Kanban Boards feature', () => {
      const kanban = component.features.find(
        (f) => f.title === 'Kanban Boards',
      );
      expect(kanban).toBeDefined();
      expect(kanban?.description).toContain('Drag-and-drop');
    });

    it('should include all expected feature titles', () => {
      const titles = component.features.map((f) => f.title);
      expect(titles).toContain('Kanban Boards');
      expect(titles).toContain('Reports & Analytics');
      expect(titles).toContain('Calendar View');
      expect(titles).toContain('Recurring Tasks');
      expect(titles).toContain('Time Tracking');
      expect(titles).toContain('Dependencies');
      expect(titles).toContain('Workflow Automation');
      expect(titles).toContain('Client Portal');
    });
  });

  describe('faqs', () => {
    it('should include task deletion FAQ', () => {
      const faq = component.faqs.find((f) => f.q.includes('delete a task'));
      expect(faq).toBeDefined();
      expect(faq?.a).toContain('Archive');
    });
  });

  describe('ngOnInit', () => {
    it('should call refreshShortcuts', () => {
      const refreshSpy = vi.spyOn(component, 'refreshShortcuts');
      component.ngOnInit();
      expect(refreshSpy).toHaveBeenCalledOnce();
    });
  });

  describe('refreshShortcuts', () => {
    it('should populate shortcutGroups from service', () => {
      const shortcutMap = new Map<string, KeyboardShortcut[]>();
      shortcutMap.set('Board', [
        {
          key: 'n',
          ctrl: true,
          description: 'New task',
          category: 'Board',
          action: () => {},
        },
      ]);
      shortcutMap.set('General', [
        {
          key: '?',
          description: 'Show help',
          category: 'General',
          action: () => {},
        },
      ]);
      mockShortcutsService.getByCategory.mockReturnValue(shortcutMap);

      component.refreshShortcuts();

      expect(component.shortcutGroups()).toHaveLength(2);
      const categories = component.shortcutGroups().map((g) => g.category);
      expect(categories).toContain('Board');
      expect(categories).toContain('General');
    });

    it('should set empty array when no shortcuts registered', () => {
      mockShortcutsService.getByCategory.mockReturnValue(new Map());

      component.refreshShortcuts();

      expect(component.shortcutGroups()).toEqual([]);
    });
  });

  describe('formatShortcut', () => {
    it('should delegate to service formatShortcut', () => {
      const shortcut: KeyboardShortcut = {
        key: 's',
        ctrl: true,
        description: 'Save',
        category: 'General',
        action: () => {},
      };

      mockShortcutsService.formatShortcut.mockReturnValue('Ctrl + S');

      const result = component.formatShortcut(shortcut);

      expect(mockShortcutsService.formatShortcut).toHaveBeenCalledWith(
        shortcut,
      );
      expect(result).toBe('Ctrl + S');
    });
  });
});
