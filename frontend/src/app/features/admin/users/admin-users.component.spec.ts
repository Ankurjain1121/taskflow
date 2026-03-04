import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService, AdminUser } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;
  let mockAdminService: any;
  let mockAuthService: any;

  const mockUsers: AdminUser[] = [
    {
      id: 'u-1',
      email: 'alice@example.com',
      display_name: 'Alice Smith',
      avatar_url: null,
      role: 'admin',
      workspace_count: 3,
      created_at: '2025-01-15T00:00:00Z',
      last_active_at: new Date().toISOString(),
      email_verified: true,
    },
    {
      id: 'u-2',
      email: 'bob@example.com',
      display_name: 'Bob Jones',
      avatar_url: 'https://example.com/bob.jpg',
      role: 'manager',
      workspace_count: 1,
      created_at: '2025-06-01T00:00:00Z',
      last_active_at: null,
      email_verified: true,
    },
    {
      id: 'u-3',
      email: 'carol@example.com',
      display_name: 'Carol',
      avatar_url: null,
      role: 'member',
      workspace_count: 2,
      created_at: '2025-09-01T00:00:00Z',
      last_active_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      email_verified: false,
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
      getUsers: vi.fn().mockReturnValue(of(mockUsers)),
      updateUserRole: vi.fn().mockReturnValue(of(void 0)),
      deleteUser: vi.fn().mockReturnValue(of(void 0)),
    };

    mockAuthService = {
      currentUser: vi.fn().mockReturnValue({ id: 'u-1' }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadUsers', () => {
    it('should load users on init', () => {
      component.ngOnInit();
      expect(mockAdminService.getUsers).toHaveBeenCalled();
      expect(component.users().length).toBe(3);
      expect(component.loading()).toBe(false);
    });

    it('should handle errors', () => {
      mockAdminService.getUsers.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.loadUsers();
      expect(component.error()).toBe('Failed to load users. Please try again.');
      expect(component.loading()).toBe(false);
    });
  });

  describe('computed stats', () => {
    it('should compute adminCount', () => {
      component.users.set(mockUsers);
      expect(component.adminCount()).toBe(1);
    });

    it('should compute managerCount', () => {
      component.users.set(mockUsers);
      expect(component.managerCount()).toBe(1);
    });

    it('should compute memberCount', () => {
      component.users.set(mockUsers);
      expect(component.memberCount()).toBe(1);
    });
  });

  describe('isSelf', () => {
    it('should return true for current user', () => {
      expect(component.isSelf(mockUsers[0])).toBe(true);
    });

    it('should return false for other users', () => {
      expect(component.isSelf(mockUsers[1])).toBe(false);
    });
  });

  describe('onRoleChange', () => {
    it('should not call service when role is unchanged', () => {
      component.onRoleChange(mockUsers[0], 'admin');
      expect(mockAdminService.updateUserRole).not.toHaveBeenCalled();
    });

    it('should update role via service', () => {
      component.users.set([...mockUsers]);
      component.onRoleChange(mockUsers[1], 'admin');
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        'u-2',
        'admin',
      );
      expect(component.users().find((u) => u.id === 'u-2')?.role).toBe('admin');
    });

    it('should handle role change error', () => {
      mockAdminService.updateUserRole.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.users.set([...mockUsers]);
      component.onRoleChange(mockUsers[1], 'admin');
      expect(component.updatingUser()).toBeNull();
    });
  });

  describe('onRemoveUser', () => {
    it('should set user to remove and show dialog', () => {
      component.onRemoveUser(mockUsers[1]);
      expect(component.userToRemove()).toBe(mockUsers[1]);
      expect(component.showRemoveDialog).toBe(true);
    });
  });

  describe('confirmRemoveUser', () => {
    it('should delete user and remove from list', () => {
      component.users.set([...mockUsers]);
      component.userToRemove.set(mockUsers[1]);
      component.showRemoveDialog = true;
      component.confirmRemoveUser();
      expect(component.showRemoveDialog).toBe(false);
      expect(mockAdminService.deleteUser).toHaveBeenCalledWith('u-2');
      expect(component.users().length).toBe(2);
    });

    it('should do nothing when no user to remove', () => {
      component.userToRemove.set(null);
      component.confirmRemoveUser();
      expect(mockAdminService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('getUserMenuItems', () => {
    it('should return menu items for a user', () => {
      const items = component.getUserMenuItems(mockUsers[1]);
      expect(items.length).toBe(5); // 3 roles + separator + remove
    });

    it('should disable current role option', () => {
      const items = component.getUserMenuItems(mockUsers[1]);
      const managerItem = items.find((i) => i.label === 'Make Manager');
      expect(managerItem?.disabled).toBe(true);
    });
  });

  describe('formatting helpers', () => {
    it('getInitials should extract initials', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
      expect(component.getInitials('Bob')).toBe('B');
      expect(component.getInitials('')).toBe('?');
    });

    it('formatRole should capitalize', () => {
      expect(component.formatRole('admin')).toBe('Admin');
      expect(component.formatRole('member')).toBe('Member');
    });

    it('getRoleBadgeClass should return correct classes', () => {
      expect(component.getRoleBadgeClass('admin')).toContain('purple');
      expect(component.getRoleBadgeClass('manager')).toContain('blue');
    });

    it('formatDate should format date string', () => {
      const result = component.formatDate('2025-06-15T00:00:00Z');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('formatRelativeDate should return relative time', () => {
      const now = new Date().toISOString();
      expect(component.formatRelativeDate(now)).toBe('Just now');
    });

    it('formatRelativeDate should return minutes ago', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(component.formatRelativeDate(fiveMinAgo)).toBe('5m ago');
    });
  });
});
