import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';
import { ManageComponent } from './manage.component';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TeamGroupsService } from '../../core/services/team-groups.service';
import { AuthService } from '../../core/services/auth.service';
import { MessageService } from 'primeng/api';

// Mock ResizeObserver for PrimeNG Tabs
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

describe('ManageComponent', () => {
  let component: ManageComponent;
  let fixture: ComponentFixture<ManageComponent>;
  let mockWorkspaceService: Record<string, ReturnType<typeof vi.fn>>;
  let mockTeamGroupsService: Record<string, ReturnType<typeof vi.fn>>;
  let mockAuthService: { currentUser: ReturnType<typeof signal> };
  let paramsSubject: BehaviorSubject<Record<string, string>>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  const mockMembers = [
    { user_id: 'u-1', name: 'Alice', email: 'alice@test.com', avatar_url: null, role: 'owner', joined_at: '2026-01-01' },
    { user_id: 'u-2', name: 'Bob', email: 'bob@test.com', avatar_url: 'https://example.com/bob.jpg', role: 'member', joined_at: '2026-01-15' },
    { user_id: 'u-3', name: 'Carol', email: 'carol@test.com', avatar_url: null, role: 'manager', joined_at: '2026-02-01' },
  ];

  const mockTeams = [
    { id: 't-1', name: 'Frontend', color: '#3B82F6', workspace_id: 'ws-1', member_count: 3, description: null, created_at: '' },
    { id: 't-2', name: 'Backend', color: '#10B981', workspace_id: 'ws-1', member_count: 2, description: null, created_at: '' },
  ];

  const mockWorkspace = {
    id: 'ws-1', name: 'Test Workspace', description: 'A test workspace',
    logo_url: null, created_by_id: 'u-1', created_at: '2026-01-01', updated_at: '2026-01-01',
    members: mockMembers,
  };

  beforeEach(async () => {
    // Use BehaviorSubject so ngOnInit subscription fires immediately
    paramsSubject = new BehaviorSubject<Record<string, string>>({ workspaceId: 'ws-1' });
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    mockWorkspaceService = {
      get: vi.fn().mockReturnValue(of(mockWorkspace)),
      getMembers: vi.fn().mockReturnValue(of(mockMembers)),
      listAllInvitations: vi.fn().mockReturnValue(of([])),
      inviteMember: vi.fn().mockReturnValue(of({})),
      removeMember: vi.fn().mockReturnValue(of({})),
      updateMemberRole: vi.fn().mockReturnValue(of({})),
      searchMembers: vi.fn().mockReturnValue(of([])),
      bulkInviteMembers: vi.fn().mockReturnValue(of({})),
      listTenantMembers: vi.fn().mockReturnValue(of([])),
      bulkAddMembers: vi.fn().mockReturnValue(of({})),
      listJobRoles: vi.fn().mockReturnValue(of([])),
      createJobRole: vi.fn().mockReturnValue(of({})),
      listAllMemberRoles: vi.fn().mockReturnValue(of([])),
      assignJobRole: vi.fn().mockReturnValue(of({})),
      removeJobRole: vi.fn().mockReturnValue(of({})),
      listLabels: vi.fn().mockReturnValue(of([])),
      listAuditLog: vi.fn().mockReturnValue(of([])),
      listAuditActions: vi.fn().mockReturnValue(of([])),
      listTrash: vi.fn().mockReturnValue(of({ items: [], total: 0 })),
    };

    mockTeamGroupsService = {
      listTeams: vi.fn().mockReturnValue(of(mockTeams)),
    };

    mockAuthService = {
      currentUser: signal({
        id: 'u-1', name: 'Alice', email: 'alice@test.com', avatar_url: null,
        role: 'Admin' as const, tenant_id: 't-1', onboarding_completed: true,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ManageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: TeamGroupsService, useValue: mockTeamGroupsService },
        { provide: AuthService, useValue: mockAuthService },
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: {
            params: paramsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable(),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit → subscribes to params → loads data
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ── Hero Section ──────────────────────────────────────────
  describe('Hero Section', () => {
    it('should display member count from loaded workspace', () => {
      expect(component.memberCount()).toBe(3);
    });

    it('should display team count from loaded teams', () => {
      expect(component.teamCount()).toBe(2);
    });

    it('should set loading false after data loads', () => {
      expect(component.loading()).toBe(false);
    });

    it('should extract workspace name', () => {
      expect(component.workspace()?.name).toBe('Test Workspace');
    });
  });

  // ── Tab Navigation ────────────────────────────────────────
  describe('Tab Navigation', () => {
    it('should default to People tab (index 0)', () => {
      expect(component.activeTab()).toBe(0);
    });

    it('should switch tabs on onTabChange', () => {
      component.onTabChange(2);
      expect(component.activeTab()).toBe(2);
    });

    it('should support ?tab=N query param for deep linking', () => {
      queryParamsSubject.next({ tab: '2' });
      fixture.detectChanges();
      expect(component.activeTab()).toBe(2);
    });

    it('should ignore invalid tab query param', () => {
      queryParamsSubject.next({ tab: '99' });
      fixture.detectChanges();
      expect(component.activeTab()).toBe(0);
    });
  });

  // ── RBAC Tab Visibility ───────────────────────────────────
  describe('RBAC Tab Visibility', () => {
    it('should show all 4 tabs for owners', () => {
      // u-1 is owner in mockMembers, current user is u-1
      expect(component.visibleTabs().length).toBe(4);
    });

    it('should show only People and Activity tabs for regular members', () => {
      // Set current user to someone NOT in the members list (treated as non-admin)
      (mockAuthService.currentUser as ReturnType<typeof signal>).set({
        id: 'u-99', name: 'Nobody', email: 'nobody@test.com', avatar_url: null,
        role: 'Member' as const, tenant_id: 't-1', onboarding_completed: true,
      });
      fixture.detectChanges();

      const tabs = component.visibleTabs();
      expect(tabs.length).toBe(2);
      expect(tabs[0].label).toBe('People');
      expect(tabs[1].label).toBe('Activity');
    });

    it('should show all tabs for managers', () => {
      // u-3 is manager, set as current user
      (mockAuthService.currentUser as ReturnType<typeof signal>).set({
        id: 'u-3', name: 'Carol', email: 'carol@test.com', avatar_url: null,
        role: 'Admin' as const, tenant_id: 't-1', onboarding_completed: true,
      });
      fixture.detectChanges();
      expect(component.visibleTabs().length).toBe(4);
    });
  });

  // ── Error Handling ────────────────────────────────────────
  describe('Error Handling', () => {
    it('should show error message when workspace load fails', () => {
      mockWorkspaceService['get'].mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      // Trigger reload
      paramsSubject.next({ workspaceId: 'ws-2' });
      fixture.detectChanges();
      expect(component.errorMessage()).toBeTruthy();
    });

    it('should clear error message after timeout', () => {
      vi.useFakeTimers();
      component.showError('Test error');
      expect(component.errorMessage()).toBe('Test error');
      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
      vi.useRealTimers();
    });
  });

  // ── Data Loading ──────────────────────────────────────────
  describe('Data Loading', () => {
    it('should load workspace data on route param change', () => {
      expect(mockWorkspaceService['get']).toHaveBeenCalledWith('ws-1');
    });

    it('should extract members from workspace response', () => {
      expect(component.members().length).toBe(3);
    });

    it('should reload when workspace ID changes', () => {
      paramsSubject.next({ workspaceId: 'ws-2' });
      fixture.detectChanges();
      expect(mockWorkspaceService['get']).toHaveBeenCalledTimes(2);
      expect(mockWorkspaceService['get']).toHaveBeenCalledWith('ws-2');
    });
  });

  // ── Member Actions ────────────────────────────────────────
  describe('Member Actions', () => {
    it('should remove member from local list', () => {
      expect(component.members().length).toBe(3);
      component.onMemberRemoved('u-2');
      expect(component.members().length).toBe(2);
      expect(component.members().find((m) => m.user_id === 'u-2')).toBeUndefined();
    });
  });

  // ── Utility Methods ───────────────────────────────────────
  describe('Utilities', () => {
    it('should generate initials from name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
    });

    it('should handle single name', () => {
      expect(component.getInitials('Alice')).toBe('A');
    });
  });
});
