import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
  DashboardStats,
  DashboardActivityEntry,
} from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { TeamGroupsService } from '../../core/services/team-groups.service';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { ReportsService } from '../../core/services/reports.service';

const MOCK_STATS: DashboardStats = {
  total_tasks: 42,
  overdue: 3,
  completed_this_week: 12,
  due_today: 5,
};

const MOCK_ACTIVITY: DashboardActivityEntry[] = [
  {
    id: 'act-1',
    action: 'created',
    entity_type: 'task',
    entity_id: 'task-1',
    metadata: { task_title: 'New Task' },
    created_at: '2026-02-18T10:00:00Z',
    actor_name: 'Alice',
    actor_avatar_url: null,
  },
  {
    id: 'act-2',
    action: 'moved',
    entity_type: 'task',
    entity_id: 'task-2',
    metadata: null,
    created_at: '2026-02-18T09:00:00Z',
    actor_name: 'Bob',
    actor_avatar_url: 'https://example.com/avatar.png',
  },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let router: Router;

  const mockAuthService = {
    currentUser: signal({
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      avatar_url: null,
      role: 'Member' as const,
      tenant_id: 'tenant-1',
      onboarding_completed: true,
    }),
  };

  const mockDashboardService = {
    getStats: vi.fn().mockReturnValue(of(MOCK_STATS)),
    getRecentActivity: vi.fn().mockReturnValue(of(MOCK_ACTIVITY)),
    getWorkspaceDashboard: vi.fn().mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null })),
    getTeamDashboard: vi.fn().mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null })),
    getPersonalDashboard: vi.fn().mockReturnValue(of({ cycle_time: [], velocity: [], on_time: null })),
    exportDashboardCsv: vi.fn(),
  };

  const mockReportsService = {
    getUtilizationByWorkspace: vi.fn().mockReturnValue(of([])),
  };

  const mockTeamGroupsService = {
    listTeams: vi.fn().mockReturnValue(of([])),
  };

  const mockWorkspaceState = {
    workspaces: signal([
      {
        id: 'ws-1',
        name: 'Workspace 1',
        slug: 'ws-1',
        owner_id: 'user-1',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'ws-2',
        name: 'Workspace 2',
        slug: 'ws-2',
        owner_id: 'user-1',
        created_at: '',
        updated_at: '',
      },
    ]),
    loading: signal(false),
    currentWorkspaceId: signal(null as string | null),
    selectWorkspace: vi.fn(),
    loadWorkspaces: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Polyfill window.matchMedia for vitest (jsdom) environment
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

    // Polyfill IntersectionObserver for @defer (on viewport)
    if (!globalThis.IntersectionObserver) {
      (globalThis as Record<string, unknown>).IntersectionObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      };
    }

    // Re-set default mock return values after clearAllMocks
    mockDashboardService.getStats.mockReturnValue(of(MOCK_STATS));
    mockDashboardService.getRecentActivity.mockReturnValue(of(MOCK_ACTIVITY));
    mockDashboardService.getWorkspaceDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));
    mockDashboardService.getTeamDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));
    mockDashboardService.getPersonalDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], on_time: null }));
    mockReportsService.getUtilizationByWorkspace.mockReturnValue(of([]));
    mockTeamGroupsService.listTeams.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: WorkspaceStateService, useValue: mockWorkspaceState },
        { provide: TeamGroupsService, useValue: mockTeamGroupsService },
        { provide: ReportsService, useValue: mockReportsService },
        { provide: OnboardingChecklistService, useValue: {
          initialize: vi.fn(),
          shouldShow: signal(false),
          items: signal([]),
          completedCount: signal(0),
          totalCount: signal(0),
          allComplete: signal(false),
          isDismissed: signal(false),
          isSkipped: signal(false),
          toggle: vi.fn(),
          dismiss: vi.fn(),
          skip: vi.fn(),
          reset: vi.fn(),
        } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit()', () => {
    it('should set userName from auth service', () => {
      component.ngOnInit();
      expect(component.userName()).toBe('Alice');
    });

    it('should redirect to sign-in if user is not authenticated', async () => {
      // Recreate component with null user
      const nullAuthService = { currentUser: signal(null) };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [
          DashboardComponent,
          HttpClientTestingModule,
          RouterTestingModule.withRoutes([]),
        ],
        providers: [
          { provide: AuthService, useValue: nullAuthService },
          { provide: DashboardService, useValue: mockDashboardService },
          { provide: WorkspaceStateService, useValue: mockWorkspaceState },
          { provide: TeamGroupsService, useValue: { listTeams: vi.fn().mockReturnValue(of([])) } },
          { provide: OnboardingChecklistService, useValue: {
            initialize: vi.fn(),
            shouldShow: signal(false),
            items: signal([]),
            completedCount: signal(0),
            totalCount: signal(0),
            allComplete: signal(false),
            isDismissed: signal(false),
            isSkipped: signal(false),
            toggle: vi.fn(),
            dismiss: vi.fn(),
            skip: vi.fn(),
            reset: vi.fn(),
          } },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const newRouter = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(newRouter, 'navigate');

      const newFixture = TestBed.createComponent(DashboardComponent);
      const newComponent = newFixture.componentInstance;
      newComponent.ngOnInit();

      expect(navigateSpy).toHaveBeenCalledWith(['/auth/sign-in']);
    });

    it('should call loadWorkspaces', () => {
      component.ngOnInit();
      expect(mockWorkspaceState.loadWorkspaces).toHaveBeenCalled();
    });
  });

  describe('getGreeting()', () => {
    it('should return a valid greeting', () => {
      const greeting = component.getGreeting();
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(
        greeting,
      );
    });
  });

  describe('formatAction()', () => {
    it('should map known actions', () => {
      expect(component.formatAction('created')).toBe('created');
      expect(component.formatAction('commented')).toBe('commented on');
      expect(component.formatAction('attached')).toBe('attached a file to');
      expect(component.formatAction('status_changed')).toBe(
        'changed status of',
      );
      expect(component.formatAction('priority_changed')).toBe(
        'changed priority of',
      );
    });

    it('should return the action string as-is for unknown actions', () => {
      expect(component.formatAction('some_unknown_action')).toBe(
        'some_unknown_action',
      );
    });
  });

  describe('formatRelativeTime()', () => {
    it('should return "just now" for very recent times', () => {
      const now = new Date().toISOString();
      expect(component.formatRelativeTime(now)).toBe('just now');
    });

    it('should return minutes ago for times within an hour', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      expect(component.formatRelativeTime(tenMinsAgo)).toBe('10m ago');
    });

    it('should return hours ago for times within a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
      expect(component.formatRelativeTime(threeHoursAgo)).toBe('3h ago');
    });

    it('should return days ago for times within a week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      expect(component.formatRelativeTime(twoDaysAgo)).toBe('2d ago');
    });

    it('should return formatted date for times older than a week', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const result = component.formatRelativeTime(twoWeeksAgo);
      // Should be a localized date string, not relative
      expect(result).not.toContain('ago');
    });
  });

  describe('getActionBadgeClass()', () => {
    it('should return green classes for created', () => {
      expect(component.getActionBadgeClass('created')).toContain(
        'bg-green-100',
      );
    });

    it('should return red classes for deleted', () => {
      expect(component.getActionBadgeClass('deleted')).toContain('bg-red-100');
    });

    it('should return blue classes for moved', () => {
      expect(component.getActionBadgeClass('moved')).toContain('bg-blue-100');
    });

    it('should return blue classes for status_changed', () => {
      expect(component.getActionBadgeClass('status_changed')).toContain(
        'bg-blue-100',
      );
    });

    it('should return purple classes for commented', () => {
      expect(component.getActionBadgeClass('commented')).toContain(
        'bg-purple-100',
      );
    });

    it('should return amber classes for assigned', () => {
      expect(component.getActionBadgeClass('assigned')).toContain(
        'bg-amber-100',
      );
    });

    it('should return default classes for unknown', () => {
      expect(component.getActionBadgeClass('other')).toContain(
        'bg-[var(--secondary)]',
      );
    });
  });

  describe('displayedActivity computed', () => {
    it('should show only first 5 activities by default', () => {
      const manyActivities: DashboardActivityEntry[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `act-${i}`,
          action: 'created',
          entity_type: 'task',
          entity_id: `task-${i}`,
          metadata: null,
          created_at: new Date().toISOString(),
          actor_name: `User ${i}`,
          actor_avatar_url: null,
        }),
      );
      component.recentActivity.set(manyActivities);
      component.showAllActivity.set(false);

      expect(component.displayedActivity()).toHaveLength(5);
    });

    it('should show all activities when showAllActivity is true', () => {
      const manyActivities: DashboardActivityEntry[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `act-${i}`,
          action: 'created',
          entity_type: 'task',
          entity_id: `task-${i}`,
          metadata: null,
          created_at: new Date().toISOString(),
          actor_name: `User ${i}`,
          actor_avatar_url: null,
        }),
      );
      component.recentActivity.set(manyActivities);
      component.showAllActivity.set(true);

      expect(component.displayedActivity()).toHaveLength(10);
    });
  });

  describe('workspaceOptions computed', () => {
    it('should return options when there are multiple workspaces', () => {
      // Trigger effects to copy workspaces from state service
      fixture.detectChanges();

      const options = component.workspaceOptions();
      expect(options.length).toBe(3); // "All Workspaces" + 2 workspace options
      expect(options[0]).toEqual({ label: 'All Workspaces', value: null });
      expect(options[1]).toEqual({ label: 'Workspace 1', value: 'ws-1' });
    });

    it('should return empty array when there is 1 or fewer workspaces', () => {
      mockWorkspaceState.workspaces.set([
        {
          id: 'ws-1',
          name: 'Only One',
          slug: 'ws-1',
          owner_id: 'u1',
          created_at: '',
          updated_at: '',
        },
      ]);

      const options = component.workspaceOptions();
      expect(options).toEqual([]);
    });
  });

  // Note: summaryStats was removed from the component; stats are used directly in the template

  describe('activeWorkspaceId computed', () => {
    it('should return undefined when selectedWorkspaceId is null', () => {
      component.selectedWorkspaceId.set(null);
      expect(component.activeWorkspaceId()).toBeUndefined();
    });

    it('should return the workspace ID when selected', () => {
      component.selectedWorkspaceId.set('ws-1');
      expect(component.activeWorkspaceId()).toBe('ws-1');
    });
  });

  describe('onWorkspaceChange()', () => {
    it('should update selectedWorkspaceId and call selectWorkspace', () => {
      component.onWorkspaceChange('ws-2');

      expect(component.selectedWorkspaceId()).toBe('ws-2');
      expect(mockWorkspaceState.selectWorkspace).toHaveBeenCalledWith('ws-2');
    });

    it('should handle null value', () => {
      component.onWorkspaceChange(null);

      expect(component.selectedWorkspaceId()).toBeNull();
      expect(mockWorkspaceState.selectWorkspace).toHaveBeenCalledWith(null);
    });
  });

  describe('setActiveView()', () => {
    it('should update activeView signal and reload metrics', () => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockDashboardService.getPersonalDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], on_time: null }));

      component.setActiveView('personal');

      expect(component.activeView()).toBe('personal');
      expect(mockDashboardService.getPersonalDashboard).toHaveBeenCalled();
    });
  });

  describe('onTeamChange()', () => {
    it('should update selectedTeamId and reload metrics', () => {
      component.ngOnInit();
      component.activeView.set('team');
      vi.clearAllMocks();
      mockDashboardService.getTeamDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));

      component.onTeamChange('team-1');

      expect(component.selectedTeamId()).toBe('team-1');
      expect(mockDashboardService.getTeamDashboard).toHaveBeenCalledWith('team-1');
    });
  });

  describe('hasAnyMetrics computed', () => {
    it('should return true when any metric data exists', () => {
      component.metricsCycleTime.set([{ week_start: '2026-02-17', avg_cycle_days: 3.5 }]);
      expect(component.hasAnyMetrics()).toBe(true);
    });

    it('should return true when onTime metric exists', () => {
      component.metricsOnTime.set({ on_time_pct: 90, total_completed: 10, on_time_count: 9 });
      expect(component.hasAnyMetrics()).toBe(true);
    });

    it('should return false when all metric arrays are empty', () => {
      component.metricsCycleTime.set([]);
      component.metricsVelocity.set([]);
      component.metricsWorkload.set([]);
      component.metricsOnTime.set(null);
      expect(component.hasAnyMetrics()).toBe(false);
    });
  });

  describe('loadMetrics() behavior', () => {
    beforeEach(() => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockDashboardService.getPersonalDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], on_time: null }));
      mockDashboardService.getTeamDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));
      mockDashboardService.getWorkspaceDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));
      mockReportsService.getUtilizationByWorkspace.mockReturnValue(of([]));
    });

    it('personal view should call getPersonalDashboard', () => {
      component.setActiveView('personal');
      expect(mockDashboardService.getPersonalDashboard).toHaveBeenCalled();
    });

    it('team view with teamId should call getTeamDashboard', () => {
      component.activeView.set('team');
      component.selectedTeamId.set('team-1');
      vi.clearAllMocks();
      mockDashboardService.getTeamDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));

      component.onTeamChange('team-1');
      expect(mockDashboardService.getTeamDashboard).toHaveBeenCalledWith('team-1');
    });

    it('team view without teamId should NOT call getTeamDashboard', () => {
      component.activeView.set('team');
      component.selectedTeamId.set(null);
      vi.clearAllMocks();
      mockDashboardService.getTeamDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));

      component.setActiveView('team');
      expect(mockDashboardService.getTeamDashboard).not.toHaveBeenCalled();
      expect(component.metricsLoading()).toBe(false);
    });

    it('workspace view with wsId should call getWorkspaceDashboard', () => {
      component.selectedWorkspaceId.set('ws-1');
      vi.clearAllMocks();
      mockDashboardService.getWorkspaceDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));
      mockReportsService.getUtilizationByWorkspace.mockReturnValue(of([]));

      component.setActiveView('workspace');
      expect(mockDashboardService.getWorkspaceDashboard).toHaveBeenCalledWith('ws-1');
    });

    it('workspace view without wsId should NOT call getWorkspaceDashboard', () => {
      component.selectedWorkspaceId.set(null);
      vi.clearAllMocks();
      mockDashboardService.getWorkspaceDashboard.mockReturnValue(of({ cycle_time: [], velocity: [], workload_balance: [], on_time: null }));

      component.setActiveView('workspace');
      expect(mockDashboardService.getWorkspaceDashboard).not.toHaveBeenCalled();
      expect(component.metricsLoading()).toBe(false);
    });

    it('metrics error should set metricsLoading to false', () => {
      mockDashboardService.getPersonalDashboard.mockReturnValue(throwError(() => new Error('fail')));

      component.setActiveView('personal');
      expect(component.metricsLoading()).toBe(false);
    });
  });

  describe('exportMetricsCsv()', () => {
    it('should call exportDashboardCsv with combined data', () => {
      component.metricsCycleTime.set([
        { week_start: '2026-02-17', avg_cycle_days: 3.5 },
      ]);
      component.metricsVelocity.set([
        { week_start: '2026-02-17', tasks_completed: 5 },
      ]);

      component.exportMetricsCsv();

      expect(mockDashboardService.exportDashboardCsv).toHaveBeenCalledWith([
        { week_start: '2026-02-17', avg_cycle_days: 3.5, tasks_completed: 5 },
      ]);
    });

    it('should not call export when data is empty', () => {
      component.metricsCycleTime.set([]);
      component.metricsVelocity.set([]);

      component.exportMetricsCsv();

      expect(mockDashboardService.exportDashboardCsv).not.toHaveBeenCalled();
    });
  });

  describe('teamOptions computed', () => {
    it('should map teams to label/value pairs', () => {
      component.teams.set([
        { id: 'team-1', name: 'Alpha Team', description: null, color: '#000', workspace_id: 'ws-1', member_count: 3, created_at: '' },
        { id: 'team-2', name: 'Beta Team', description: null, color: '#000', workspace_id: 'ws-1', member_count: 2, created_at: '' },
      ]);

      const options = component.teamOptions();
      expect(options).toEqual([
        { label: 'Alpha Team', value: 'team-1' },
        { label: 'Beta Team', value: 'team-2' },
      ]);
    });
  });

  describe('navigateToOnboarding()', () => {
    it('should navigate to /onboarding', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.navigateToOnboarding();
      expect(navigateSpy).toHaveBeenCalledWith(['/onboarding']);
    });
  });

  describe('stats loading error', () => {
    it('getStats error should leave stats as null', () => {
      component.stats.set(null);
      mockDashboardService.getStats.mockReturnValue(throwError(() => new Error('fail')));
      // Directly trigger workspace change which calls loadStats internally
      component.onWorkspaceChange('ws-1');
      expect(component.stats()).toBeNull();
    });

    it('getRecentActivity error should leave recentActivity empty', () => {
      mockDashboardService.getRecentActivity.mockReturnValue(throwError(() => new Error('fail')));
      component.recentActivity.set([]);
      component.onWorkspaceChange('ws-1');
      expect(component.recentActivity()).toEqual([]);
    });
  });
});
