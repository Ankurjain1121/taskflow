import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CapabilityMatrixComponent } from './capability-matrix.component';
import {
  RoleService,
  WorkspaceRole,
  Capabilities,
} from '../../../core/services/role.service';

function makeCapabilities(
  overrides: Partial<Capabilities> = {},
): Capabilities {
  return {
    can_view_all_tasks: false,
    can_create_tasks: false,
    can_edit_own_tasks: false,
    can_edit_all_tasks: false,
    can_delete_tasks: false,
    can_manage_members: false,
    can_manage_project_settings: false,
    can_manage_automations: false,
    can_export: false,
    can_manage_billing: false,
    can_invite_members: false,
    can_manage_roles: false,
    ...overrides,
  };
}

function makeRole(overrides: Partial<WorkspaceRole> = {}): WorkspaceRole {
  return {
    id: 'role-1',
    workspace_id: 'ws-1',
    name: 'Member',
    description: null,
    is_system: true,
    capabilities: makeCapabilities(),
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const MOCK_ROLES: WorkspaceRole[] = [
  makeRole({
    id: 'role-admin',
    name: 'Admin',
    capabilities: makeCapabilities({
      can_view_all_tasks: true,
      can_create_tasks: true,
      can_edit_all_tasks: true,
      can_delete_tasks: true,
      can_manage_members: true,
      can_manage_roles: true,
    }),
  }),
  makeRole({
    id: 'role-member',
    name: 'Member',
    capabilities: makeCapabilities({
      can_view_all_tasks: true,
      can_create_tasks: true,
      can_edit_own_tasks: true,
    }),
  }),
];

describe('CapabilityMatrixComponent', () => {
  let component: CapabilityMatrixComponent;
  let fixture: ComponentFixture<CapabilityMatrixComponent>;
  let mockRoleService: { listRoles: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockRoleService = {
      listRoles: vi.fn().mockReturnValue(of(MOCK_ROLES)),
    };

    await TestBed.configureTestingModule({
      imports: [CapabilityMatrixComponent],
      providers: [{ provide: RoleService, useValue: mockRoleService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CapabilityMatrixComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with loading true', () => {
      expect(component.loading()).toBe(true);
    });

    it('should start with empty roles', () => {
      expect(component.roles()).toEqual([]);
    });

    it('should start with no error message', () => {
      expect(component.errorMessage()).toBeNull();
    });

    it('should have 12 capability items', () => {
      expect(component.capabilityItems).toHaveLength(12);
    });

    it('should have 6 skeleton rows', () => {
      expect(component.skeletonRows).toHaveLength(6);
    });
  });

  describe('ngOnInit / loadRoles', () => {
    it('should call roleService.listRoles with workspaceId on init', () => {
      fixture.detectChanges(); // triggers ngOnInit
      expect(mockRoleService.listRoles).toHaveBeenCalledWith('ws-1');
    });

    it('should populate roles on success', () => {
      fixture.detectChanges();
      expect(component.roles()).toEqual(MOCK_ROLES);
    });

    it('should set loading to false after success', () => {
      fixture.detectChanges();
      expect(component.loading()).toBe(false);
    });

    it('should set error message on failure', () => {
      mockRoleService.listRoles.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      fixture.detectChanges();
      expect(component.errorMessage()).toBe("Couldn't load roles");
      expect(component.loading()).toBe(false);
    });

    it('should clear error and reload on retry', () => {
      // First call fails
      mockRoleService.listRoles.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      fixture.detectChanges();
      expect(component.errorMessage()).toBe("Couldn't load roles");

      // Retry succeeds
      mockRoleService.listRoles.mockReturnValue(of(MOCK_ROLES));
      component.loadRoles();
      expect(component.errorMessage()).toBeNull();
      expect(component.roles()).toEqual(MOCK_ROLES);
      expect(component.loading()).toBe(false);
    });
  });

  describe('getRoleCap', () => {
    it('should return true for enabled capability', () => {
      const role = makeRole({
        capabilities: makeCapabilities({ can_create_tasks: true }),
      });
      expect(component.getRoleCap(role, 'can_create_tasks')).toBe(true);
    });

    it('should return false for disabled capability', () => {
      const role = makeRole({
        capabilities: makeCapabilities({ can_create_tasks: false }),
      });
      expect(component.getRoleCap(role, 'can_create_tasks')).toBe(false);
    });

    it('should return false when capabilities is null/undefined', () => {
      const role = makeRole();
      (role as unknown as { capabilities: null }).capabilities = null;
      expect(component.getRoleCap(role, 'can_create_tasks')).toBe(false);
    });
  });

  describe('capabilityItems structure', () => {
    it('should have items for all categories', () => {
      const categories = [
        ...new Set(component.capabilityItems.map((i) => i.category)),
      ];
      expect(categories).toEqual(['TASKS', 'PROJECT', 'WORKSPACE', 'DATA']);
    });

    it('TASKS category should have 5 items', () => {
      const tasks = component.capabilityItems.filter(
        (i) => i.category === 'TASKS',
      );
      expect(tasks).toHaveLength(5);
    });

    it('each item should have key, label, and category', () => {
      for (const item of component.capabilityItems) {
        expect(item.key).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.category).toBeTruthy();
      }
    });
  });

  describe('template rendering', () => {
    it('should show skeleton while loading', () => {
      fixture.detectChanges();
      // loading is set to false synchronously by the mock, so we need
      // to check before init
      component.loading.set(true);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const pulseElements = el.querySelectorAll('.animate-pulse');
      expect(pulseElements.length).toBeGreaterThan(0);
    });

    it('should show error message with retry button on error', () => {
      mockRoleService.listRoles.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain("Couldn't load roles");
      const retryButton = el.querySelector('button');
      expect(retryButton?.textContent).toContain('Retry');
    });

    it('should render table with role columns after load', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const headers = el.querySelectorAll('th');
      // 1 "Capability" header + 2 role headers
      expect(headers.length).toBe(3);
      expect(headers[1]?.textContent?.trim()).toBe('Admin');
      expect(headers[2]?.textContent?.trim()).toBe('Member');
    });

    it('should render allowed and denied indicators', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const allowed = el.querySelectorAll('[aria-label="allowed"]');
      const denied = el.querySelectorAll('[aria-label="denied"]');
      // Admin has 6 allowed, Member has 3 allowed = 9 total allowed
      // Admin has 6 denied, Member has 9 denied = 15 total denied
      expect(allowed.length).toBe(9);
      expect(denied.length).toBe(15);
    });

    it('retry button should call loadRoles', () => {
      mockRoleService.listRoles.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      fixture.detectChanges();

      const loadSpy = vi.spyOn(component, 'loadRoles');
      const el = fixture.nativeElement as HTMLElement;
      const retryButton = el.querySelector('button') as HTMLButtonElement;
      retryButton.click();
      expect(loadSpy).toHaveBeenCalled();
    });
  });
});
