import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { PeopleHubComponent } from './people-hub.component';
import {
  WorkspaceService,
  TenantMember,
  WorkspaceMatrixEntry,
} from '../../core/services/workspace.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

function makeMember(overrides: Partial<TenantMember> = {}): TenantMember {
  return {
    user_id: 'user-1',
    name: 'Alice Admin',
    email: 'alice@example.com',
    avatar_url: null,
    job_title: null,
    department: null,
    role: 'admin',
    workspace_count: 2,
    created_at: '2026-01-01T00:00:00Z',
    is_org_admin: false,
    ...overrides,
  };
}

function makeMatrixEntry(
  overrides: Partial<WorkspaceMatrixEntry> = {},
): WorkspaceMatrixEntry {
  return {
    workspace_id: 'ws-1',
    workspace_name: 'Engineering',
    is_member: true,
    role: 'member',
    is_org_admin: false,
    ...overrides,
  };
}

const MOCK_MEMBERS: TenantMember[] = [
  makeMember({ user_id: 'u1', name: 'Alice Admin', email: 'alice@co.com', role: 'admin' }),
  makeMember({ user_id: 'u2', name: 'Bob Manager', email: 'bob@co.com', role: 'manager' }),
  makeMember({ user_id: 'u3', name: 'Charlie Member', email: 'charlie@co.com', role: 'member' }),
  makeMember({
    user_id: 'u4',
    name: 'Diana Member',
    email: 'diana@co.com',
    role: 'member',
    is_org_admin: true,
  }),
];

const MOCK_MATRIX: WorkspaceMatrixEntry[] = [
  makeMatrixEntry({ workspace_id: 'ws-1', workspace_name: 'Engineering', is_member: true, role: 'admin' }),
  makeMatrixEntry({ workspace_id: 'ws-2', workspace_name: 'Design', is_member: false, role: null }),
  makeMatrixEntry({
    workspace_id: 'ws-3',
    workspace_name: 'Marketing',
    is_member: true,
    role: 'member',
    is_org_admin: true,
  }),
];

describe('PeopleHubComponent', () => {
  let component: PeopleHubComponent;
  let fixture: ComponentFixture<PeopleHubComponent>;
  let mockWorkspaceService: {
    listTenantMembers: ReturnType<typeof vi.fn>;
    getWorkspaceMatrix: ReturnType<typeof vi.fn>;
    toggleWorkspaceMembership: ReturnType<typeof vi.fn>;
  };
  let mockCtx: { activeWorkspaceId: ReturnType<typeof signal<string | null>> };

  beforeEach(async () => {
    mockWorkspaceService = {
      listTenantMembers: vi.fn().mockReturnValue(of(MOCK_MEMBERS)),
      getWorkspaceMatrix: vi.fn().mockReturnValue(of(MOCK_MATRIX)),
      toggleWorkspaceMembership: vi.fn().mockReturnValue(of({})),
    };

    mockCtx = {
      activeWorkspaceId: signal<string | null>('ws-active-1'),
    };

    await TestBed.configureTestingModule({
      imports: [PeopleHubComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: WorkspaceContextService, useValue: mockCtx },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PeopleHubComponent);
    component = fixture.componentInstance;
  });

  // ---------------------------------------------------------------------------
  // Component creation
  // ---------------------------------------------------------------------------
  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial signal state (before ngOnInit)
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('should have loading=false before init', () => {
      expect(component.loading()).toBe(false);
    });

    it('should have empty members array', () => {
      expect(component.members()).toEqual([]);
    });

    it('should have empty search query', () => {
      expect(component.searchQuery()).toBe('');
    });

    it('should have activeRoleFilter set to "all"', () => {
      expect(component.activeRoleFilter()).toBe('all');
    });

    it('should have selectedMemberId as null', () => {
      expect(component.selectedMemberId()).toBeNull();
    });

    it('should have selectedMember computed as null', () => {
      expect(component.selectedMember()).toBeNull();
    });

    it('should have empty workspace matrix', () => {
      expect(component.workspaceMatrix()).toEqual([]);
    });

    it('should have empty togglingWorkspaces set', () => {
      expect(component.togglingWorkspaces().size).toBe(0);
    });

    it('should expose four role filters', () => {
      expect(component.roleFilters).toHaveLength(4);
      expect(component.roleFilters.map((f) => f.value)).toEqual([
        'all',
        'admin',
        'manager',
        'member',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // Member list loading (ngOnInit)
  // ---------------------------------------------------------------------------
  describe('loadMembers on init', () => {
    it('should call listTenantMembers and populate members', () => {
      fixture.detectChanges(); // triggers ngOnInit

      expect(mockWorkspaceService.listTenantMembers).toHaveBeenCalledOnce();
      expect(component.members()).toEqual(MOCK_MEMBERS);
      expect(component.loading()).toBe(false);
    });

    it('should set loading=true then false during fetch', () => {
      const subject = new Subject<TenantMember[]>();
      mockWorkspaceService.listTenantMembers.mockReturnValue(subject.asObservable());

      fixture.detectChanges();
      expect(component.loading()).toBe(true);

      subject.next(MOCK_MEMBERS);
      subject.complete();
      expect(component.loading()).toBe(false);
    });

    it('should set loading=false on error', () => {
      mockWorkspaceService.listTenantMembers.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      expect(component.members()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Role filtering
  // ---------------------------------------------------------------------------
  describe('role filtering', () => {
    beforeEach(() => {
      fixture.detectChanges(); // load members
    });

    it('should show all members when filter is "all"', () => {
      expect(component.filteredMembers()).toHaveLength(MOCK_MEMBERS.length);
    });

    it('should filter by admin role', () => {
      component.setRoleFilter('admin');
      const filtered = component.filteredMembers();

      expect(filtered.every((m) => m.role === 'admin')).toBe(true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].user_id).toBe('u1');
    });

    it('should filter by manager role', () => {
      component.setRoleFilter('manager');
      const filtered = component.filteredMembers();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].user_id).toBe('u2');
    });

    it('should filter by member role', () => {
      component.setRoleFilter('member');
      const filtered = component.filteredMembers();

      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.user_id)).toEqual(['u3', 'u4']);
    });

    it('should return empty array when no members match role', () => {
      // Override members to only have admins
      component.members.set([MOCK_MEMBERS[0]]);
      component.setRoleFilter('manager');

      expect(component.filteredMembers()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Search / filter by name or email
  // ---------------------------------------------------------------------------
  describe('search filtering', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should filter by name (case-insensitive)', () => {
      component.searchQuery.set('alice');
      const filtered = component.filteredMembers();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Alice Admin');
    });

    it('should filter by email', () => {
      component.searchQuery.set('charlie@co');
      const filtered = component.filteredMembers();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].email).toBe('charlie@co.com');
    });

    it('should return all members for empty search', () => {
      component.searchQuery.set('');
      expect(component.filteredMembers()).toHaveLength(MOCK_MEMBERS.length);
    });

    it('should return empty for non-matching search', () => {
      component.searchQuery.set('zzz-no-match');
      expect(component.filteredMembers()).toHaveLength(0);
    });

    it('should handle whitespace-only search as empty', () => {
      component.searchQuery.set('   ');
      expect(component.filteredMembers()).toHaveLength(MOCK_MEMBERS.length);
    });

    it('should combine search with role filter', () => {
      component.searchQuery.set('diana');
      component.setRoleFilter('member');

      const filtered = component.filteredMembers();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].user_id).toBe('u4');
    });

    it('should return empty when search + role filter mismatch', () => {
      component.searchQuery.set('alice');
      component.setRoleFilter('member'); // Alice is admin, not member

      expect(component.filteredMembers()).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Debounced search input
  // ---------------------------------------------------------------------------
  describe('onSearchInput (debounced)', () => {
    it('should debounce search input and update searchQuery', async () => {
      vi.useFakeTimers();
      fixture.detectChanges();

      component.onSearchInput('al');
      vi.advanceTimersByTime(100);
      expect(component.searchQuery()).toBe(''); // not yet

      component.onSearchInput('ali');
      vi.advanceTimersByTime(100);
      expect(component.searchQuery()).toBe(''); // still debouncing

      vi.advanceTimersByTime(200); // total 300ms since last input
      expect(component.searchQuery()).toBe('ali');
      vi.useRealTimers();
    });

    it('should ignore duplicate values (distinctUntilChanged)', async () => {
      vi.useFakeTimers();
      fixture.detectChanges();

      component.onSearchInput('test');
      vi.advanceTimersByTime(300);
      expect(component.searchQuery()).toBe('test');

      component.onSearchInput('test'); // same value
      vi.advanceTimersByTime(300);
      // Should still be 'test', no extra emission
      expect(component.searchQuery()).toBe('test');
      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Member selection (detail panel)
  // ---------------------------------------------------------------------------
  describe('member selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should set selectedMemberId on selectMember', () => {
      component.selectMember(MOCK_MEMBERS[1]);

      expect(component.selectedMemberId()).toBe('u2');
    });

    it('should compute selectedMember from members list', () => {
      component.selectMember(MOCK_MEMBERS[2]);

      const selected = component.selectedMember();
      expect(selected).not.toBeNull();
      expect(selected!.name).toBe('Charlie Member');
    });

    it('should return null for selectedMember if id not in members', () => {
      component.selectedMemberId.set('non-existent-id');

      expect(component.selectedMember()).toBeNull();
    });

    it('should load workspace matrix on selection', () => {
      component.selectMember(MOCK_MEMBERS[0]);

      expect(mockWorkspaceService.getWorkspaceMatrix).toHaveBeenCalledWith('u1');
      expect(component.workspaceMatrix()).toEqual(MOCK_MATRIX);
      expect(component.matrixLoading()).toBe(false);
    });

    it('should set matrixLoading during workspace matrix fetch', () => {
      const subject = new Subject<WorkspaceMatrixEntry[]>();
      mockWorkspaceService.getWorkspaceMatrix.mockReturnValue(subject.asObservable());

      component.selectMember(MOCK_MEMBERS[0]);
      expect(component.matrixLoading()).toBe(true);

      subject.next(MOCK_MATRIX);
      subject.complete();
      expect(component.matrixLoading()).toBe(false);
    });

    it('should clear workspace matrix before loading new one', () => {
      component.workspaceMatrix.set([makeMatrixEntry()]);

      const subject = new Subject<WorkspaceMatrixEntry[]>();
      mockWorkspaceService.getWorkspaceMatrix.mockReturnValue(subject.asObservable());

      component.selectMember(MOCK_MEMBERS[0]);
      expect(component.workspaceMatrix()).toEqual([]);
    });

    it('should handle workspace matrix load error', () => {
      mockWorkspaceService.getWorkspaceMatrix.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.selectMember(MOCK_MEMBERS[0]);

      expect(component.matrixLoading()).toBe(false);
      expect(component.workspaceMatrix()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Workspace membership toggle
  // ---------------------------------------------------------------------------
  describe('toggleMembership', () => {
    const fakeCheckbox = (checked: boolean) =>
      ({ target: { checked } }) as unknown as Event;

    beforeEach(() => {
      fixture.detectChanges();
      component.selectMember(MOCK_MEMBERS[0]); // sets selectedMemberId to 'u1'
    });

    it('should call toggleWorkspaceMembership with correct params (add)', () => {
      const ws = MOCK_MATRIX[1]; // Design, is_member=false
      component.toggleMembership(ws, fakeCheckbox(true));

      expect(mockWorkspaceService.toggleWorkspaceMembership).toHaveBeenCalledWith(
        'ws-2',
        'u1',
        true,
      );
    });

    it('should call toggleWorkspaceMembership with correct params (remove)', () => {
      const ws = MOCK_MATRIX[0]; // Engineering, is_member=true
      component.toggleMembership(ws, fakeCheckbox(false));

      expect(mockWorkspaceService.toggleWorkspaceMembership).toHaveBeenCalledWith(
        'ws-1',
        'u1',
        false,
      );
    });

    it('should add workspace_id to togglingWorkspaces during toggle', () => {
      const subject = new Subject<unknown>();
      mockWorkspaceService.toggleWorkspaceMembership.mockReturnValue(subject.asObservable());

      const ws = MOCK_MATRIX[1];
      component.toggleMembership(ws, fakeCheckbox(true));

      expect(component.togglingWorkspaces().has('ws-2')).toBe(true);

      subject.next({});
      subject.complete();

      expect(component.togglingWorkspaces().has('ws-2')).toBe(false);
    });

    it('should update workspace matrix entry on success', () => {
      const ws = MOCK_MATRIX[1]; // Design, is_member=false
      component.toggleMembership(ws, fakeCheckbox(true));

      const updated = component.workspaceMatrix().find((e) => e.workspace_id === 'ws-2');
      expect(updated!.is_member).toBe(true);
    });

    it('should revert checkbox on error', () => {
      mockWorkspaceService.toggleWorkspaceMembership.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      const checkboxEl = { checked: true } as HTMLInputElement;
      const event = { target: checkboxEl } as unknown as Event;

      const ws = MOCK_MATRIX[1];
      component.toggleMembership(ws, event);

      expect(checkboxEl.checked).toBe(false); // reverted
      expect(component.togglingWorkspaces().has('ws-2')).toBe(false);
    });

    it('should do nothing if no member is selected', () => {
      component.selectedMemberId.set(null);

      const ws = MOCK_MATRIX[0];
      component.toggleMembership(ws, fakeCheckbox(true));

      expect(mockWorkspaceService.toggleWorkspaceMembership).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------
  describe('getInitials', () => {
    it('should return initials for two-word name', () => {
      expect(component.getInitials('Alice Admin')).toBe('AA');
    });

    it('should return single initial for single name', () => {
      expect(component.getInitials('Alice')).toBe('A');
    });

    it('should truncate to 2 characters for multi-word names', () => {
      expect(component.getInitials('John Michael Smith')).toBe('JM');
    });

    it('should uppercase initials', () => {
      expect(component.getInitials('alice admin')).toBe('AA');
    });

    it('should handle empty string', () => {
      expect(component.getInitials('')).toBe('');
    });
  });

  describe('getRoleBadgeClass', () => {
    it('should return purple classes for admin', () => {
      expect(component.getRoleBadgeClass('admin')).toContain('purple');
    });

    it('should return blue classes for manager', () => {
      expect(component.getRoleBadgeClass('manager')).toContain('blue');
    });

    it('should return green classes for member', () => {
      expect(component.getRoleBadgeClass('member')).toContain('green');
    });

    it('should return muted classes for unknown role', () => {
      expect(component.getRoleBadgeClass('unknown')).toContain('muted');
    });
  });

  describe('getMemberProfileLink', () => {
    it('should return correct profile link when workspace and member selected', () => {
      fixture.detectChanges();
      component.selectedMemberId.set('u1');

      expect(component.getMemberProfileLink()).toBe('/workspace/ws-active-1/team/member/u1');
    });

    it('should return empty string when no workspace active', () => {
      mockCtx.activeWorkspaceId.set(null);
      component.selectedMemberId.set('u1');

      expect(component.getMemberProfileLink()).toBe('');
    });

    it('should return empty string when no member selected', () => {
      expect(component.getMemberProfileLink()).toBe('');
    });
  });
});
