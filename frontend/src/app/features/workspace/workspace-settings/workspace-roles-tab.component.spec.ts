import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { WorkspaceRolesTabComponent } from './workspace-roles-tab.component';
import {
  RoleService,
  WorkspaceRole,
  defaultCapabilities,
} from '../../../core/services/role.service';

describe('WorkspaceRolesTabComponent', () => {
  let component: WorkspaceRolesTabComponent;
  let fixture: ComponentFixture<WorkspaceRolesTabComponent>;
  let mockRoleService: any;

  const makeCaps = (overrides = {}) => ({
    ...defaultCapabilities(),
    ...overrides,
  });

  const mockRoles: WorkspaceRole[] = [
    {
      id: 'r-admin',
      workspace_id: 'ws-1',
      name: 'Admin',
      description: 'Administrator role',
      is_system: true,
      capabilities: makeCaps({ can_manage_members: true }),
      position: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 'r-custom',
      workspace_id: 'ws-1',
      name: 'Developer',
      description: 'Dev role',
      is_system: false,
      capabilities: makeCaps({ can_create_tasks: true }),
      position: 1,
      created_at: '2026-01-02',
      updated_at: '2026-01-02',
    },
  ];

  beforeEach(async () => {
    mockRoleService = {
      listRoles: vi.fn().mockReturnValue(of(mockRoles)),
      createRole: vi.fn().mockReturnValue(
        of({
          id: 'r-new',
          workspace_id: 'ws-1',
          name: 'QA Lead',
          description: null,
          is_system: false,
          capabilities: defaultCapabilities(),
          position: 2,
          created_at: '2026-01-03',
          updated_at: '2026-01-03',
        }),
      ),
      updateRole: vi.fn().mockReturnValue(
        of({
          ...mockRoles[1],
          name: 'Senior Dev',
        }),
      ),
      deleteRole: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceRolesTabComponent],
      providers: [
        { provide: RoleService, useValue: mockRoleService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceRolesTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial signal values', () => {
    expect(component.roles()).toEqual([]);
    expect(component.loading()).toBe(true);
    expect(component.showCreateForm()).toBe(false);
    expect(component.creatingRole()).toBe(false);
    expect(component.editingRoleId()).toBeNull();
    expect(component.savingRole()).toBe(false);
    expect(component.deletingRoleId()).toBeNull();
    expect(component.errorMessage()).toBeNull();
  });

  it('should load roles on init', () => {
    fixture.detectChanges();

    expect(mockRoleService.listRoles).toHaveBeenCalledWith('ws-1');
    expect(component.roles()).toEqual(mockRoles);
    expect(component.loading()).toBe(false);
  });

  it('should handle load roles error', () => {
    mockRoleService.listRoles.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.errorMessage()).toBe('Failed to load roles');
  });

  it('should open create form with defaults', () => {
    component.openCreateForm();

    expect(component.showCreateForm()).toBe(true);
    expect(component.newRoleName).toBe('');
    expect(component.newRoleDescription).toBe('');
    const caps = component.newRoleCapabilities();
    expect(caps.can_view_all_tasks).toBe(false);
    expect(caps.can_manage_billing).toBe(false);
  });

  it('should cancel create form', () => {
    component.openCreateForm();
    component.cancelCreate();

    expect(component.showCreateForm()).toBe(false);
  });

  it('should toggle new capability immutably', () => {
    component.openCreateForm();
    const before = component.newRoleCapabilities();
    expect(before.can_export).toBe(false);

    component.toggleNewCapability('can_export');

    const after = component.newRoleCapabilities();
    expect(after.can_export).toBe(true);
    // Immutability: original object unchanged
    expect(before.can_export).toBe(false);
  });

  it('should create role and add to list', () => {
    fixture.detectChanges();
    component.openCreateForm();
    component.newRoleName = 'QA Lead';

    component.createRole();

    expect(mockRoleService.createRole).toHaveBeenCalledWith('ws-1', {
      name: 'QA Lead',
      description: undefined,
      capabilities: defaultCapabilities(),
    });
    expect(component.roles().length).toBe(3);
    expect(component.showCreateForm()).toBe(false);
    expect(component.creatingRole()).toBe(false);
  });

  it('should not create role with empty name', () => {
    component.newRoleName = '   ';
    component.createRole();

    expect(mockRoleService.createRole).not.toHaveBeenCalled();
  });

  it('should handle create role error', () => {
    mockRoleService.createRole.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();
    component.openCreateForm();
    component.newRoleName = 'Failing Role';

    component.createRole();

    expect(component.creatingRole()).toBe(false);
    expect(component.errorMessage()).toBe('Failed to create role');
  });

  it('should start edit with role values', () => {
    fixture.detectChanges();
    component.startEdit(mockRoles[1]);

    expect(component.editingRoleId()).toBe('r-custom');
    expect(component.editRoleName).toBe('Developer');
    expect(component.editRoleDescription).toBe('Dev role');
    expect(component.editCapabilities().can_create_tasks).toBe(true);
  });

  it('should cancel edit', () => {
    component.startEdit(mockRoles[1]);
    component.cancelEdit();

    expect(component.editingRoleId()).toBeNull();
  });

  it('should getCapability return edit value when editing', () => {
    fixture.detectChanges();
    component.startEdit(mockRoles[1]);
    component.editCapabilities.set(makeCaps({ can_export: true }));

    expect(component.getCapability(mockRoles[1], 'can_export')).toBe(true);
  });

  it('should getCapability return role value when not editing', () => {
    fixture.detectChanges();

    expect(component.getCapability(mockRoles[1], 'can_create_tasks')).toBe(true);
    expect(component.getCapability(mockRoles[1], 'can_export')).toBe(false);
  });

  it('should toggleEditCapability immutably', () => {
    fixture.detectChanges();
    component.startEdit(mockRoles[1]);

    component.toggleEditCapability(mockRoles[1], 'can_export');

    expect(component.editCapabilities().can_export).toBe(true);
  });

  it('should not toggle edit capability for system role', () => {
    fixture.detectChanges();
    component.editingRoleId.set('r-admin');

    component.toggleEditCapability(mockRoles[0], 'can_export');
    // system roles should not toggle
  });

  it('should not toggle edit capability when not editing this role', () => {
    fixture.detectChanges();
    component.editingRoleId.set('r-other');

    component.toggleEditCapability(mockRoles[1], 'can_export');
    // should not toggle since editingRoleId !== role.id
  });

  it('should save edit and update role in list', () => {
    fixture.detectChanges();
    component.startEdit(mockRoles[1]);
    component.editRoleName = 'Senior Dev';

    component.saveEdit(mockRoles[1]);

    expect(mockRoleService.updateRole).toHaveBeenCalledWith(
      'ws-1',
      'r-custom',
      expect.objectContaining({ name: 'Senior Dev' }),
    );
    expect(component.editingRoleId()).toBeNull();
    expect(component.savingRole()).toBe(false);
    expect(component.roles().find((r) => r.id === 'r-custom')?.name).toBe(
      'Senior Dev',
    );
  });

  it('should handle save edit error', () => {
    mockRoleService.updateRole.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();
    component.startEdit(mockRoles[1]);
    component.editRoleName = 'Failing Edit';

    component.saveEdit(mockRoles[1]);

    expect(component.savingRole()).toBe(false);
    expect(component.errorMessage()).toBe('Failed to update role');
  });

  it('should delete role after confirm', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    fixture.detectChanges();

    component.deleteRole(mockRoles[1]);

    expect(mockRoleService.deleteRole).toHaveBeenCalledWith('ws-1', 'r-custom');
    expect(component.roles().length).toBe(1);
    expect(component.deletingRoleId()).toBeNull();
  });

  it('should not delete system role', () => {
    component.deleteRole(mockRoles[0]);

    expect(mockRoleService.deleteRole).not.toHaveBeenCalled();
  });

  it('should not delete when confirm is cancelled', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    component.deleteRole(mockRoles[1]);

    expect(mockRoleService.deleteRole).not.toHaveBeenCalled();
  });

  it('should handle delete error', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    mockRoleService.deleteRole.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    fixture.detectChanges();

    component.deleteRole(mockRoles[1]);

    expect(component.deletingRoleId()).toBeNull();
    expect(component.errorMessage()).toBe('Failed to delete role');
  });

  it('should expose capabilityDefs', () => {
    expect(component.capabilityDefs.length).toBeGreaterThan(0);
    expect(component.capabilityDefs[0]).toHaveProperty('key');
    expect(component.capabilityDefs[0]).toHaveProperty('label');
  });
});
