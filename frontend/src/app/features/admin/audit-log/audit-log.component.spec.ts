import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuditLogComponent } from './audit-log.component';
import { AdminService } from '../../../core/services/admin.service';

describe('AuditLogComponent', () => {
  let component: AuditLogComponent;
  let fixture: ComponentFixture<AuditLogComponent>;
  let mockAdminService: any;

  const mockEntries = [
    {
      id: 'e-1',
      user_id: 'u-1',
      action: 'created',
      entity_type: 'task',
      entity_id: '12345678-abcd-efgh',
      ip_address: '192.168.1.1',
      user_agent: null,
      details: { title: 'New Task' },
      created_at: new Date().toISOString(),
      actor: {
        display_name: 'Alice Smith',
        email: 'alice@example.com',
        avatar_url: null,
      },
    },
    {
      id: 'e-2',
      user_id: 'u-2',
      action: 'deleted',
      entity_type: 'project',
      entity_id: 'abcdef12-3456-7890',
      ip_address: null,
      user_agent: null,
      details: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
      actor: {
        display_name: 'Bob',
        email: 'bob@example.com',
        avatar_url: 'https://example.com/bob.jpg',
      },
    },
  ];

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    mockAdminService = {
      getAuditLog: vi
        .fn()
        .mockReturnValue(of({ items: mockEntries, next_cursor: null })),
      getAuditActions: vi
        .fn()
        .mockReturnValue(of(['created', 'updated', 'deleted'])),
    };

    await TestBed.configureTestingModule({
      imports: [AuditLogComponent],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load audit log and actions on init', () => {
      component.ngOnInit();
      expect(mockAdminService.getAuditLog).toHaveBeenCalled();
      expect(mockAdminService.getAuditActions).toHaveBeenCalled();
      expect(component.entries().length).toBe(2);
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadAuditLog', () => {
    it('should set loading to true then false', () => {
      component.loadAuditLog();
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('should handle error', () => {
      mockAdminService.getAuditLog.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadAuditLog();
      expect(component.error()).toBe(
        'Failed to load audit log. Please try again.',
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadMore', () => {
    it('should not load more when no next cursor', () => {
      component.nextCursor.set(null);
      component.loadMore();
      expect(component.loadingMore()).toBe(false);
    });

    it('should append entries when loading more', () => {
      component.entries.set(mockEntries);
      component.nextCursor.set('cursor-1');
      const moreEntries = [{ ...mockEntries[0], id: 'e-3' }];
      mockAdminService.getAuditLog.mockReturnValue(
        of({ items: moreEntries, next_cursor: null }),
      );
      component.loadMore();
      expect(component.entries().length).toBe(3);
      expect(component.loadingMore()).toBe(false);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when no filters active', () => {
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('should return true when search query is set', () => {
      component.searchQuery = 'test';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('should return true when action is selected', () => {
      component.selectedAction = 'created';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('should return true when entity type is selected', () => {
      component.selectedEntityType = 'task';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('should return true when dateFrom is set', () => {
      component.dateFrom = new Date();
      expect(component.hasActiveFilters()).toBe(true);
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters and reload', () => {
      component.searchQuery = 'test';
      component.selectedAction = 'created';
      component.selectedEntityType = 'task';
      component.dateFrom = new Date();
      component.dateTo = new Date();

      component.clearFilters();

      expect(component.searchQuery).toBe('');
      expect(component.selectedAction).toBeNull();
      expect(component.selectedEntityType).toBeNull();
      expect(component.dateFrom).toBeNull();
      expect(component.dateTo).toBeNull();
      expect(mockAdminService.getAuditLog).toHaveBeenCalled();
    });
  });

  describe('toggleDetails', () => {
    it('should add entry id to expanded set', () => {
      component.toggleDetails('e-1');
      expect(component.expandedDetails().has('e-1')).toBe(true);
    });

    it('should remove entry id when already expanded', () => {
      component.toggleDetails('e-1');
      component.toggleDetails('e-1');
      expect(component.expandedDetails().has('e-1')).toBe(false);
    });
  });

  describe('formatting helpers', () => {
    it('formatRelativeDate should return "Just now" for recent dates', () => {
      const now = new Date().toISOString();
      expect(component.formatRelativeDate(now)).toBe('Just now');
    });

    it('formatRelativeDate should return minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(component.formatRelativeDate(fiveMinAgo)).toBe('5m ago');
    });

    it('formatRelativeDate should return hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      expect(component.formatRelativeDate(twoHoursAgo)).toBe('2h ago');
    });

    it('formatAction should capitalize words', () => {
      expect(component.formatAction('task_created')).toBe('Task Created');
      expect(component.formatAction('created')).toBe('Created');
    });

    it('formatEntityType should capitalize first letter', () => {
      expect(component.formatEntityType('task')).toBe('Task');
      expect(component.formatEntityType('project')).toBe('Project');
    });

    it('formatDetails should return formatted JSON', () => {
      const details = { key: 'value' };
      expect(component.formatDetails(details)).toBe(
        JSON.stringify(details, null, 2),
      );
    });

    it('getInitials should extract initials from name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
      expect(component.getInitials('Bob')).toBe('B');
      expect(component.getInitials('')).toBe('?');
    });

    it('getActionBadgeClass should return correct classes', () => {
      expect(component.getActionBadgeClass('created')).toContain('green');
      expect(component.getActionBadgeClass('deleted')).toContain('red');
      expect(component.getActionBadgeClass('updated')).toContain('blue');
    });

    it('getEntityTypeBadgeClass should return correct classes', () => {
      expect(component.getEntityTypeBadgeClass('task')).toContain('blue');
      expect(component.getEntityTypeBadgeClass('project')).toContain('purple');
      expect(component.getEntityTypeBadgeClass('workspace')).toContain('green');
    });
  });

  describe('actionOptions computed', () => {
    it('should map available actions to select options', () => {
      component.availableActions.set(['created', 'deleted']);
      const options = component.actionOptions();
      expect(options).toEqual([
        { label: 'Created', value: 'created' },
        { label: 'Deleted', value: 'deleted' },
      ]);
    });
  });

  describe('onSearchChange', () => {
    it('should not throw when called', () => {
      expect(() => component.onSearchChange('test')).not.toThrow();
    });
  });
});
