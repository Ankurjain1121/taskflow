import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OrgCommandCenterComponent } from './org-command-center.component';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';
import { PortfolioService } from '../../core/services/portfolio.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { TeamService } from '../../core/services/team.service';
import { Workspace } from '../../core/services/workspace.service';

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    description: null,
    logo_url: null,
    created_by_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    member_count: 5,
    ...overrides,
  };
}

describe('OrgCommandCenterComponent', () => {
  let fixture: ComponentFixture<OrgCommandCenterComponent>;
  let component: OrgCommandCenterComponent;
  let el: HTMLElement;

  const workspacesSignal = signal<Workspace[]>([]);

  const mockCtx = {
    workspaces: workspacesSignal,
  };

  const mockPortfolioService = {
    getPortfolio: vi.fn().mockReturnValue(of({ projects: [], milestones: [] })),
  };

  const mockDashboardService = {
    getWorkspaceDashboard: vi.fn().mockReturnValue(
      of({
        workspace_id: 'ws-1',
        cycle_time: [],
        velocity: [],
        workload_balance: [],
        on_time: { on_time_pct: 0, total_completed: 0, on_time_count: 0 },
        overdue_aging: { critical: 0, recent: 0 },
      }),
    ),
    getRecentActivity: vi.fn().mockReturnValue(of([])),
    invalidateCache: vi.fn(),
  };

  const mockTeamService = {
    getTeamWorkload: vi.fn().mockReturnValue(of([])),
  };

  beforeEach(async () => {
    workspacesSignal.set([]);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [OrgCommandCenterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: WorkspaceContextService, useValue: mockCtx },
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: TeamService, useValue: mockTeamService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgCommandCenterComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have loading true initially', () => {
      expect(component.loading()).toBe(true);
    });

    it('should have selectedPeriod default to month', () => {
      expect(component.selectedPeriod()).toBe('month');
    });

    it('should have error as null initially', () => {
      expect(component.error()).toBeNull();
    });

    it('should have 4 period options', () => {
      expect(component.periods.length).toBe(4);
      expect(component.periods.map((p) => p.value)).toEqual([
        'week',
        'month',
        'quarter',
        'all',
      ]);
    });
  });

  describe('setPeriod', () => {
    it('should update selectedPeriod', () => {
      component.setPeriod('quarter');
      expect(component.selectedPeriod()).toBe('quarter');
    });

    it('should invalidate dashboard cache', () => {
      component.setPeriod('week');
      expect(mockDashboardService.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('healthScore computed', () => {
    it('should return neutral score when no data', () => {
      fixture.detectChanges();
      // With no projects, no workloads, no velocity:
      // onTimeRate=0.5 (no completions) -> 0.5*40 = 20
      // overdueRatio=0 -> 1*30 = 30
      // workloadBalance=1 (no overloaded / totalMembers=1) -> 1*20 = 20
      // velocityFactor=0.5 (no data) -> 0.5*10 = 5
      // total = 75
      expect(component.healthScore()).toBe(75);
    });
  });

  describe('healthLabel computed', () => {
    it('should return Healthy for score >= 80', () => {
      // Set conditions for high score
      component.onTimePct.set(100);
      component.totalCompleted.set(10);
      component.allProjects.set([]);
      component.allWorkloads.set([]);
      // Score: onTimeRate=1 -> 40, overdueRatio=0 -> 30, workloadBalance=1 -> 20, vel=0.5 -> 5 = 95
      expect(component.healthLabel()).toBe('Healthy');
    });

    it('should return Needs Attention for score 60-79', () => {
      // Default empty state gives ~75
      expect(component.healthLabel()).toBe('Needs Attention');
    });

    it('should return At Risk for score < 60', () => {
      // Force low score: high overdue ratio, low on-time
      component.onTimePct.set(10);
      component.totalCompleted.set(10);
      component.allProjects.set([
        {
          workspace: makeWorkspace(),
          projects: [
            {
              id: 'p1',
              name: 'P1',
              description: null,
              prefix: null,
              background_color: null,
              created_at: '',
              total_tasks: 10,
              completed_tasks: 1,
              overdue_tasks: 8,
              active_tasks: 9,
              member_count: 2,
              progress_pct: 10,
              health: 'behind' as const,
              next_milestone_name: null,
              next_milestone_due: null,
            },
          ],
        },
      ]);
      expect(component.healthScore()).toBeLessThan(60);
      expect(component.healthLabel()).toBe('At Risk');
    });
  });

  describe('healthColor computed', () => {
    it('should return green for healthy', () => {
      component.onTimePct.set(100);
      component.totalCompleted.set(10);
      expect(component.healthColor()).toBe('#5E8C4A');
    });

    it('should return amber for needs attention', () => {
      // Default state: ~75
      expect(component.healthColor()).toBe('#D4A853');
    });
  });

  describe('totalProjects computed', () => {
    it('should sum projects across all groups', () => {
      component.allProjects.set([
        {
          workspace: makeWorkspace({ id: 'ws-1' }),
          projects: [
            { id: 'p1', name: 'A', total_tasks: 0, overdue_tasks: 0 } as any,
            { id: 'p2', name: 'B', total_tasks: 0, overdue_tasks: 0 } as any,
          ],
        },
        {
          workspace: makeWorkspace({ id: 'ws-2' }),
          projects: [
            { id: 'p3', name: 'C', total_tasks: 0, overdue_tasks: 0 } as any,
          ],
        },
      ]);
      expect(component.totalProjects()).toBe(3);
    });
  });

  describe('totalOverdue computed', () => {
    it('should sum overdue tasks across all projects', () => {
      component.allProjects.set([
        {
          workspace: makeWorkspace(),
          projects: [
            { id: 'p1', name: 'A', total_tasks: 10, overdue_tasks: 3 } as any,
            { id: 'p2', name: 'B', total_tasks: 5, overdue_tasks: 1 } as any,
          ],
        },
      ]);
      expect(component.totalOverdue()).toBe(4);
    });
  });

  describe('totalMembers computed', () => {
    it('should prefer workload member count', () => {
      component.allWorkloads.set([
        { user_id: 'u-1', active_tasks: 3 } as any,
        { user_id: 'u-2', active_tasks: 5 } as any,
      ]);
      expect(component.totalMembers()).toBe(2);
    });

    it('should fall back to workspace member_count when no workloads', () => {
      workspacesSignal.set([
        makeWorkspace({ id: 'ws-1', member_count: 10 }),
        makeWorkspace({ id: 'ws-2', member_count: 5 }),
      ]);
      component.allWorkloads.set([]);
      expect(component.totalMembers()).toBe(15);
    });
  });

  describe('template rendering', () => {
    it('should show skeleton when loading', () => {
      component.loading.set(true);
      fixture.detectChanges();
      const skeletons = el.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show empty state when no workspaces and not loading', () => {
      workspacesSignal.set([]);
      component.loading.set(false);
      fixture.detectChanges();
      expect(el.textContent).toContain('Create your first workspace');
    });

    it('should render period toggle buttons', () => {
      fixture.detectChanges();
      const buttons = el.querySelectorAll('button');
      expect(buttons.length).toBe(4);
      expect(buttons[0].textContent?.trim()).toBe('This Week');
      expect(buttons[1].textContent?.trim()).toBe('This Month');
    });

    it('should show title', () => {
      fixture.detectChanges();
      const h1 = el.querySelector('h1');
      expect(h1?.textContent?.trim()).toBe('Organization Overview');
    });
  });

  describe('data loading effect', () => {
    it('should call services when workspaces are set', () => {
      workspacesSignal.set([makeWorkspace()]);
      fixture.detectChanges();

      expect(mockPortfolioService.getPortfolio).toHaveBeenCalledWith('ws-1');
      expect(mockDashboardService.getWorkspaceDashboard).toHaveBeenCalledWith(
        'ws-1',
        'month',
      );
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalledWith('ws-1');
      expect(mockDashboardService.getRecentActivity).toHaveBeenCalledWith(15);
    });

    it('should not call services when workspaces is empty', () => {
      vi.clearAllMocks();
      workspacesSignal.set([]);
      fixture.detectChanges();

      expect(mockPortfolioService.getPortfolio).not.toHaveBeenCalled();
    });

    it('should set loading to false after data loads', async () => {
      workspacesSignal.set([makeWorkspace()]);
      fixture.detectChanges();
      // forkJoin resolves synchronously with our mocked observables
      expect(component.loading()).toBe(false);
    });
  });
});
