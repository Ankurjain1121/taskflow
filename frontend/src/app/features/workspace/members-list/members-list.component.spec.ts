import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import {
  MembersListComponent,
  MemberWithDetails,
} from './members-list.component';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { AuthService } from '../../../core/services/auth.service';

describe('MembersListComponent', () => {
  let component: MembersListComponent;
  let fixture: ComponentFixture<MembersListComponent>;
  let mockWorkspaceService: any;
  let mockAuthService: any;

  const testMembers: MemberWithDetails[] = [
    {
      user_id: 'u-1',
      workspace_id: 'ws-1',
      role: 'owner',
      display_name: 'Alice Admin',
      email: 'alice@test.com',
      avatar_url: null,
      joined_at: '2026-01-01',
      name: 'Alice Admin',
    },
    {
      user_id: 'u-2',
      workspace_id: 'ws-1',
      role: 'member',
      display_name: 'Bob Member',
      email: 'bob@test.com',
      avatar_url: null,
      joined_at: '2026-01-15',
      name: 'Bob Member',
    },
  ];

  beforeEach(async () => {
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

    mockWorkspaceService = {
      listAllInvitations: vi
        .fn()
        .mockReturnValue(
          of([
            {
              id: 'inv-1',
              email: 'new@test.com',
              role: 'member',
              status: 'pending',
              created_at: '2026-01-20',
            },
          ]),
        ),
      bulkInviteMembers: vi.fn().mockReturnValue(of({})),
      resendInvitation: vi.fn().mockReturnValue(of(void 0)),
      cancelInvitation: vi.fn().mockReturnValue(of(void 0)),
      removeMember: vi.fn().mockReturnValue(of(void 0)),
    };

    mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice Admin',
        email: 'alice@test.com',
        avatar_url: null,
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [MembersListComponent, HttpClientTestingModule],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MembersListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('members', testMembers);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load invitations on init', () => {
    component.ngOnInit();
    expect(mockWorkspaceService.listAllInvitations).toHaveBeenCalledWith(
      'ws-1',
    );
    expect(component.allInvitations().length).toBe(1);
    expect(component.loadingInvitations()).toBe(false);
  });

  it('should handle invitations load error', () => {
    mockWorkspaceService.listAllInvitations.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.loadingInvitations()).toBe(false);
  });

  it('should filter pending and expired invitations', () => {
    component.allInvitations.set([
      {
        id: 'inv-1',
        email: 'a@test.com',
        role: 'member',
        status: 'pending',
        created_at: '2026-01-20',
      } as any,
      {
        id: 'inv-2',
        email: 'b@test.com',
        role: 'member',
        status: 'accepted',
        created_at: '2026-01-20',
      } as any,
      {
        id: 'inv-3',
        email: 'c@test.com',
        role: 'member',
        status: 'expired',
        created_at: '2026-01-20',
      } as any,
    ]);
    const result = component.pendingAndExpiredInvitations();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.status)).toContain('pending');
    expect(result.map((r) => r.status)).toContain('expired');
  });

  it('should identify admin user (owner role)', () => {
    expect(component.isAdmin()).toBe(true);
  });

  it('should return false for isAdmin when no user', () => {
    mockAuthService.currentUser.set(null as any);
    expect(component.isAdmin()).toBe(false);
  });

  it('should return false for isAdmin when user is regular member', () => {
    mockAuthService.currentUser.set({
      ...mockAuthService.currentUser(),
      id: 'u-2',
    });
    expect(component.isAdmin()).toBe(false);
  });

  it('should detect owner', () => {
    expect(component.isOwner(testMembers[0])).toBe(true);
    expect(component.isOwner(testMembers[1])).toBe(false);
  });

  it('should detect self', () => {
    expect(component.isSelf(testMembers[0])).toBe(true);
    expect(component.isSelf(testMembers[1])).toBe(false);
  });

  it('should compute initials', () => {
    expect(component.getInitials('Alice Smith')).toBe('AS');
    expect(component.getInitials('Bob')).toBe('B');
    expect(component.getInitials(undefined)).toBe('?');
    expect(component.getInitials('')).toBe('?');
  });

  it('should get role labels', () => {
    expect(component.getRoleLabel('owner')).toBe('Owner');
    expect(component.getRoleLabel('admin')).toBe('Admin');
    expect(component.getRoleLabel('manager')).toBe('Manager');
    expect(component.getRoleLabel('member')).toBe('Member');
    expect(component.getRoleLabel('unknown')).toBe('unknown');
  });

  it('should get role badge classes', () => {
    expect(component.getRoleBadgeClass('owner')).toContain('7c3aed');
    expect(component.getRoleBadgeClass('admin')).toContain('status-blue');
    expect(component.getRoleBadgeClass('member')).toContain('muted');
    expect(component.getRoleBadgeClass('unknown')).toContain('muted');
  });

  it('should get status labels', () => {
    expect(component.getStatusLabel('pending')).toBe('Pending');
    expect(component.getStatusLabel('accepted')).toBe('Accepted');
    expect(component.getStatusLabel('expired')).toBe('Expired');
    expect(component.getStatusLabel('unknown')).toBe('unknown');
  });

  it('should get status badge classes', () => {
    expect(component.getStatusBadgeClass('pending')).toContain('status-amber');
    expect(component.getStatusBadgeClass('accepted')).toContain('status-green');
    expect(component.getStatusBadgeClass('expired')).toContain('status-red');
    expect(component.getStatusBadgeClass('unknown')).toContain('muted');
  });

  it('should format date', () => {
    const formatted = component.formatDate('2026-01-15T00:00:00Z');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2026');
  });

  it('should open invite dialog', () => {
    component.onInviteMember();
    expect(component.showInviteDialog()).toBe(true);
  });

  it('should handle invite result', () => {
    component.onInviteResult({
      emails: ['new@test.com'],
      role: 'member',
      message: '',
      boardIds: [],
    } as any);
    expect(mockWorkspaceService.bulkInviteMembers).toHaveBeenCalledWith(
      'ws-1',
      ['new@test.com'],
      'member',
      '',
      [],
      undefined,
    );
  });

  it('should handle invite error', () => {
    mockWorkspaceService.bulkInviteMembers.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.onInviteResult({
      emails: ['new@test.com'],
      role: 'member',
      message: '',
      boardIds: [],
    } as any);
    // Should not throw
  });

  it('should resend invitation', () => {
    component.onResendInvitation({ id: 'inv-1' } as any);
    expect(mockWorkspaceService.resendInvitation).toHaveBeenCalledWith('inv-1');
    expect(component.actionInProgress()).toBe(null);
  });

  it('should handle resend invitation error', () => {
    mockWorkspaceService.resendInvitation.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.onResendInvitation({ id: 'inv-1' } as any);
    expect(component.actionInProgress()).toBe(null);
  });

  it('should cancel invitation when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.allInvitations.set([{ id: 'inv-1', email: 'a@test.com' } as any]);
    component.onCancelInvitation({ id: 'inv-1', email: 'a@test.com' } as any);
    expect(mockWorkspaceService.cancelInvitation).toHaveBeenCalledWith('inv-1');
    expect(component.allInvitations().length).toBe(0);
    vi.restoreAllMocks();
  });

  it('should not cancel invitation when not confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.onCancelInvitation({ id: 'inv-1', email: 'a@test.com' } as any);
    expect(mockWorkspaceService.cancelInvitation).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should remove member when confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const emitSpy = vi.spyOn(component.memberRemoved, 'emit');
    component.onRemoveMember(testMembers[1]);
    expect(mockWorkspaceService.removeMember).toHaveBeenCalledWith(
      'ws-1',
      'u-2',
    );
    expect(emitSpy).toHaveBeenCalledWith('u-2');
    expect(component.updatingMember()).toBe(null);
    vi.restoreAllMocks();
  });

  it('should not remove member when not confirmed', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.onRemoveMember(testMembers[1]);
    expect(mockWorkspaceService.removeMember).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('should handle remove member error', () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    mockWorkspaceService.removeMember.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.onRemoveMember(testMembers[1]);
    expect(component.updatingMember()).toBe(null);
    vi.restoreAllMocks();
  });

  it('should filter members by search query', () => {
    component.searchQuery.set('alice');
    const filtered = component.filteredMembers();
    expect(filtered.length).toBe(1);
    expect(filtered[0].user_id).toBe('u-1');
  });

  it('should return all members when search query is empty', () => {
    component.searchQuery.set('');
    expect(component.filteredMembers().length).toBe(2);
  });

  it('should filter members by email', () => {
    component.searchQuery.set('bob@test');
    const filtered = component.filteredMembers();
    expect(filtered.length).toBe(1);
    expect(filtered[0].user_id).toBe('u-2');
  });
});
