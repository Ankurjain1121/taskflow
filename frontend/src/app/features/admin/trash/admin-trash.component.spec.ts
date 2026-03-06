import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AdminTrashComponent } from './admin-trash.component';
import { AdminService, TrashItem } from '../../../core/services/admin.service';

describe('AdminTrashComponent', () => {
  let component: AdminTrashComponent;
  let fixture: ComponentFixture<AdminTrashComponent>;
  let mockAdminService: any;

  const mockItems: TrashItem[] = [
    {
      id: 'tr-1',
      entity_type: 'task',
      entity_id: 'ent-1',
      name: 'Deleted Task',
      deleted_by: { id: 'u-1', display_name: 'Alice Smith', avatar_url: null },
      deleted_at: new Date(Date.now() - 3600000).toISOString(),
      expires_at: new Date(Date.now() + 86400000 * 25).toISOString(),
      metadata: null,
    },
    {
      id: 'tr-2',
      entity_type: 'project',
      entity_id: 'ent-2',
      name: 'Deleted Board',
      deleted_by: {
        id: 'u-2',
        display_name: 'Bob',
        avatar_url: 'https://example.com/bob.jpg',
      },
      deleted_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      expires_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      metadata: null,
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
      getTrashItems: vi
        .fn()
        .mockReturnValue(of({ items: mockItems, next_cursor: null })),
      restoreItem: vi.fn().mockReturnValue(of(void 0)),
      permanentlyDelete: vi.fn().mockReturnValue(of(void 0)),
      emptyTrash: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminTrashComponent],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTrashComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadTrashItems', () => {
    it('should load trash items on init', () => {
      component.ngOnInit();
      expect(mockAdminService.getTrashItems).toHaveBeenCalled();
      expect(component.items().length).toBe(2);
      expect(component.loading()).toBe(false);
    });

    it('should handle errors', () => {
      mockAdminService.getTrashItems.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadTrashItems();
      expect(component.error()).toBe(
        'Failed to load trash items. Please try again.',
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('onTabChange', () => {
    it('should set entity type filter and reload', () => {
      component.onTabChange('task');
      expect(component.selectedTabValue()).toBe('task');
      expect(mockAdminService.getTrashItems).toHaveBeenCalled();
    });

    it('should clear filter for "all" tab', () => {
      component.onTabChange('all');
      expect(component.selectedTabValue()).toBe('all');
    });

    it('should handle numeric tab values', () => {
      component.onTabChange(0);
      expect(component.selectedTabValue()).toBe('0');
    });
  });

  describe('loadMore', () => {
    it('should not load when no cursor', () => {
      component.nextCursor.set(null);
      component.loadMore();
      expect(component.loadingMore()).toBe(false);
    });

    it('should append items', () => {
      component.items.set(mockItems);
      component.nextCursor.set('cursor-1');
      mockAdminService.getTrashItems.mockReturnValue(
        of({ items: [{ ...mockItems[0], id: 'tr-3' }], next_cursor: null }),
      );
      component.loadMore();
      expect(component.items().length).toBe(3);
    });
  });

  describe('onRestoreItem', () => {
    it('should restore item and remove from list', () => {
      component.items.set([...mockItems]);
      component.onRestoreItem(mockItems[0]);
      expect(mockAdminService.restoreItem).toHaveBeenCalledWith(
        'task',
        'ent-1',
      );
      expect(component.items().length).toBe(1);
      expect(component.processingItem()).toBeNull();
    });

    it('should handle restore error', () => {
      mockAdminService.restoreItem.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.items.set([...mockItems]);
      component.onRestoreItem(mockItems[0]);
      expect(component.items().length).toBe(2); // not removed
      expect(component.processingItem()).toBeNull();
    });
  });

  describe('onDeleteForever', () => {
    it('should set itemToDelete and show dialog', () => {
      component.onDeleteForever(mockItems[0]);
      expect(component.itemToDelete()).toBe(mockItems[0]);
      expect(component.showDeleteDialog).toBe(true);
    });
  });

  describe('confirmDeleteForever', () => {
    it('should permanently delete item', () => {
      component.items.set([...mockItems]);
      component.itemToDelete.set(mockItems[0]);
      component.showDeleteDialog = true;
      component.confirmDeleteForever();
      expect(component.showDeleteDialog).toBe(false);
      expect(mockAdminService.permanentlyDelete).toHaveBeenCalledWith(
        'task',
        'ent-1',
      );
      expect(component.items().length).toBe(1);
    });

    it('should do nothing if no item to delete', () => {
      component.itemToDelete.set(null);
      component.confirmDeleteForever();
      expect(mockAdminService.permanentlyDelete).not.toHaveBeenCalled();
    });
  });

  describe('onEmptyTrash', () => {
    it('should show empty trash dialog', () => {
      component.onEmptyTrash();
      expect(component.showEmptyTrashDialog).toBe(true);
    });
  });

  describe('confirmEmptyTrash', () => {
    it('should empty trash and clear items', () => {
      component.items.set([...mockItems]);
      component.showEmptyTrashDialog = true;
      component.confirmEmptyTrash();
      expect(component.showEmptyTrashDialog).toBe(false);
      expect(mockAdminService.emptyTrash).toHaveBeenCalled();
      expect(component.items()).toEqual([]);
    });
  });

  describe('formatting helpers', () => {
    it('getInitials should handle names', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
      expect(component.getInitials('Bob')).toBe('B');
      expect(component.getInitials('')).toBe('?');
    });

    it('formatEntityType should capitalize', () => {
      expect(component.formatEntityType('task')).toBe('Task');
      expect(component.formatEntityType('project')).toBe('Project');
    });

    it('getEntityPrimeIcon should return correct icons', () => {
      expect(component.getEntityPrimeIcon('task')).toBe('pi-check-circle');
      expect(component.getEntityPrimeIcon('project')).toBe('pi-th-large');
      expect(component.getEntityPrimeIcon('workspace')).toBe('pi-building');
      expect(component.getEntityPrimeIcon('unknown')).toBe('pi-file');
    });

    it('getEntityIconClass should return correct classes', () => {
      expect(component.getEntityIconClass('task')).toContain('blue');
      expect(component.getEntityIconClass('project')).toContain('purple');
      expect(component.getEntityIconClass('workspace')).toContain('green');
    });

    it('formatExpiresIn should handle expired items', () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      expect(component.formatExpiresIn(expired)).toBe('Expired');
    });

    it('formatExpiresIn should show days', () => {
      const inFiveDays = new Date(Date.now() + 86400000 * 5).toISOString();
      expect(component.formatExpiresIn(inFiveDays)).toContain('days');
    });

    it('getExpiryBadgeClass should return red for expired', () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      expect(component.getExpiryBadgeClass(expired)).toContain('red');
    });

    it('getExpiryBadgeClass should return orange for 1-3 days', () => {
      const inTwoDays = new Date(Date.now() + 86400000 * 2).toISOString();
      expect(component.getExpiryBadgeClass(inTwoDays)).toContain('orange');
    });

    it('formatRelativeDate should return relative time', () => {
      const now = new Date().toISOString();
      expect(component.formatRelativeDate(now)).toBe('Just now');
    });
  });
});
