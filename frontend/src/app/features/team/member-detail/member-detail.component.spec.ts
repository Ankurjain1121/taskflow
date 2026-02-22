import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MemberDetailComponent } from './member-detail.component';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { TeamService } from '../../../core/services/team.service';

describe('MemberDetailComponent', () => {
  let component: MemberDetailComponent;
  let fixture: ComponentFixture<MemberDetailComponent>;
  let mockWorkspaceService: any;
  let mockTeamService: any;

  const mockMembers = [
    { user_id: 'u-1', name: 'Alice Smith', email: 'alice@example.com', avatar_url: null, role: 'admin' as const, joined_at: '2025-01-15T00:00:00Z' },
    { user_id: 'u-2', name: 'Bob', email: 'bob@example.com', avatar_url: 'https://example.com/bob.jpg', role: 'member' as const, joined_at: '2025-06-01T00:00:00Z' },
  ];

  const mockWorkload = [
    { user_id: 'u-1', user_name: 'Alice', user_avatar: null, active_tasks: 5, overdue_tasks: 1, done_tasks: 10, total_tasks: 15, is_overloaded: false },
    { user_id: 'u-2', user_name: 'Bob', user_avatar: null, active_tasks: 3, overdue_tasks: 0, done_tasks: 7, total_tasks: 10, is_overloaded: false },
  ];

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, media: query, onchange: null,
          addListener: vi.fn(), removeListener: vi.fn(),
          addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        })),
      });
    }

    mockWorkspaceService = {
      getMembers: vi.fn().mockReturnValue(of(mockMembers)),
    };

    mockTeamService = {
      getTeamWorkload: vi.fn().mockReturnValue(of(mockWorkload)),
    };

    await TestBed.configureTestingModule({
      imports: [MemberDetailComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: TeamService, useValue: mockTeamService },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ workspaceId: 'ws-1', userId: 'u-1' }) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberDetailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load member and workload data', () => {
      component.ngOnInit();
      expect(component.workspaceId).toBe('ws-1');
      expect(component.userId).toBe('u-1');
      expect(component.member()).toBeTruthy();
      expect(component.member()?.name).toBe('Alice Smith');
      expect(component.workload()?.active_tasks).toBe(5);
      expect(component.loading()).toBe(false);
    });

    it('should handle member not found', () => {
      mockWorkspaceService.getMembers.mockReturnValue(of([]));
      component.ngOnInit();
      expect(component.member()).toBeNull();
    });

    it('should handle errors gracefully', () => {
      mockWorkspaceService.getMembers.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });
  });

  describe('getInitials', () => {
    it('should extract initials', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
      expect(component.getInitials('Bob')).toBe('B');
    });

    it('should limit to 2 characters', () => {
      expect(component.getInitials('John Michael Smith')).toBe('JM');
    });
  });

  describe('getRoleLabel', () => {
    it('should return correct labels', () => {
      expect(component.getRoleLabel('owner')).toBe('Owner');
      expect(component.getRoleLabel('admin')).toBe('Admin');
      expect(component.getRoleLabel('manager')).toBe('Manager');
      expect(component.getRoleLabel('member')).toBe('Member');
      expect(component.getRoleLabel('viewer')).toBe('Viewer');
    });

    it('should return raw role for unknown', () => {
      expect(component.getRoleLabel('custom')).toBe('custom');
    });
  });

  describe('getRoleBadgeClass', () => {
    it('should return purple for owner', () => {
      expect(component.getRoleBadgeClass('owner')).toContain('purple');
    });

    it('should return blue for admin', () => {
      expect(component.getRoleBadgeClass('admin')).toContain('blue');
    });

    it('should return gray for unknown', () => {
      expect(component.getRoleBadgeClass('unknown')).toContain('gray');
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = component.formatDate('2025-06-15T00:00:00Z');
      expect(result).toContain('Jun');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });
  });
});
