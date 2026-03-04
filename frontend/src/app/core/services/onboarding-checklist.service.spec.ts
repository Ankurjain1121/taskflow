import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { OnboardingChecklistService } from './onboarding-checklist.service';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { WorkspaceStateService } from './workspace-state.service';
import { WorkspaceService } from './workspace.service';
import { DashboardStats } from './dashboard.service';

// ---- helpers ----------------------------------------------------------------

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    total_tasks: 0,
    overdue: 0,
    completed_this_week: 0,
    due_today: 0,
    ...overrides,
  };
}

// ---- mocks ------------------------------------------------------------------

const mockCurrentUser = signal<{ id: string } | null>({ id: 'user-1' });

const mockAuthService = {
  currentUser: mockCurrentUser,
};

const mockDashboardService = {
  getStats: vi.fn(() => of(makeStats())),
};

const mockWorkspaceState = {
  workspaces: signal<{ id: string }[]>([]),
};

const mockWorkspaceService = {
  getMembers: vi.fn(() => of([])),
};

// ---- suite ------------------------------------------------------------------

describe('OnboardingChecklistService', () => {
  let service: OnboardingChecklistService;

  beforeEach(() => {
    localStorage.clear();
    mockCurrentUser.set({ id: 'user-1' });
    mockDashboardService.getStats.mockReturnValue(of(makeStats()));
    mockWorkspaceService.getMembers.mockReturnValue(of([]));
    mockWorkspaceState.workspaces.set([]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OnboardingChecklistService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: WorkspaceStateService, useValue: mockWorkspaceState },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
    });

    service = TestBed.inject(OnboardingChecklistService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ---- initial state -------------------------------------------------------

  describe('initial state', () => {
    it('should have 5 default items, all incomplete', () => {
      const items = service.items();
      expect(items.length).toBe(5);
      expect(items.every((i) => !i.completed)).toBe(true);
    });

    it('completedCount() should start at 0', () => {
      expect(service.completedCount()).toBe(0);
    });

    it('totalCount() should return 5', () => {
      expect(service.totalCount()).toBe(5);
    });

    it('progress() should be 0 initially', () => {
      expect(service.progress()).toBe(0);
    });

    it('allComplete() should be false initially', () => {
      expect(service.allComplete()).toBe(false);
    });

    it('isDismissed should start as false', () => {
      expect(service.isDismissed()).toBe(false);
    });

    it('isSkipped should start as false', () => {
      expect(service.isSkipped()).toBe(false);
    });
  });

  // ---- markComplete() ------------------------------------------------------

  describe('markComplete()', () => {
    it('should mark the specified item as completed', () => {
      service.markComplete('create_task');
      const item = service.items().find((i) => i.id === 'create_task');
      expect(item?.completed).toBe(true);
    });

    it('should be idempotent — calling twice does not change count', () => {
      service.markComplete('create_task');
      service.markComplete('create_task');
      expect(service.completedCount()).toBe(1);
    });

    it('should not affect other items', () => {
      service.markComplete('create_task');
      const others = service.items().filter((i) => i.id !== 'create_task');
      expect(others.every((i) => !i.completed)).toBe(true);
    });
  });

  // ---- computed derived state ----------------------------------------------

  describe('progress()', () => {
    it('should return 40 after 2 out of 5 items are completed', () => {
      service.markComplete('create_task');
      service.markComplete('set_due_date');
      expect(service.progress()).toBe(40);
    });

    it('should return 100 when all 5 items are completed', () => {
      service.items().forEach((i) => service.markComplete(i.id));
      expect(service.progress()).toBe(100);
    });
  });

  describe('allComplete()', () => {
    it('should return true only when all 5 items are marked complete', () => {
      expect(service.allComplete()).toBe(false);
      service.items().forEach((i) => service.markComplete(i.id));
      expect(service.allComplete()).toBe(true);
    });
  });

  // ---- dismiss / reopen / skip --------------------------------------------

  describe('dismiss()', () => {
    it('should set isDismissed to true', () => {
      service.dismiss();
      expect(service.isDismissed()).toBe(true);
    });
  });

  describe('reopen()', () => {
    it('should set isDismissed back to false', () => {
      service.dismiss();
      service.reopen();
      expect(service.isDismissed()).toBe(false);
    });
  });

  describe('skipAll()', () => {
    it('should set isSkipped to true', () => {
      service.skipAll();
      expect(service.isSkipped()).toBe(true);
    });
  });

  // ---- shouldShow() --------------------------------------------------------

  describe('shouldShow()', () => {
    it('should be true initially', () => {
      expect(service.shouldShow()).toBe(true);
    });

    it('should be false when isSkipped is true', () => {
      service.skipAll();
      expect(service.shouldShow()).toBe(false);
    });

    it('should be false when allComplete is true', () => {
      service.items().forEach((i) => service.markComplete(i.id));
      expect(service.shouldShow()).toBe(false);
    });
  });

  // ---- initialize() --------------------------------------------------------

  describe('initialize()', () => {
    it('should be idempotent — calling twice does not re-run autoDetect', () => {
      service.initialize();
      service.initialize();
      // autoDetect calls getStats once per initialization; second call is a no-op
      expect(mockDashboardService.getStats).toHaveBeenCalledTimes(1);
    });

    it('should load state from localStorage on initialization', () => {
      // Persist some state manually for user-1
      const storedState = {
        items: {
          create_task: true,
          set_due_date: false,
          try_drag_drop: false,
          explore_shortcuts: false,
          invite_teammate: false,
        },
        dismissed: false,
        skipped: true,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem('tf_checklist_user-1', JSON.stringify(storedState));

      // Re-create the service so it picks up the stored state
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          OnboardingChecklistService,
          { provide: AuthService, useValue: mockAuthService },
          { provide: DashboardService, useValue: mockDashboardService },
          { provide: WorkspaceStateService, useValue: mockWorkspaceState },
          { provide: WorkspaceService, useValue: mockWorkspaceService },
        ],
      });

      const freshService = TestBed.inject(OnboardingChecklistService);
      freshService.initialize();

      const createTaskItem = freshService
        .items()
        .find((i) => i.id === 'create_task');
      expect(createTaskItem?.completed).toBe(true);
      expect(freshService.isSkipped()).toBe(true);
    });

    it('should auto-mark create_task complete when total_tasks > 0', () => {
      mockDashboardService.getStats.mockReturnValue(
        of(makeStats({ total_tasks: 5 })),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'create_task');
      expect(item?.completed).toBe(true);
    });

    it('should NOT auto-mark create_task when total_tasks is 0', () => {
      mockDashboardService.getStats.mockReturnValue(
        of(makeStats({ total_tasks: 0 })),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'create_task');
      expect(item?.completed).toBe(false);
    });

    it('should auto-mark invite_teammate complete when workspace has 2+ members', () => {
      // Provide a workspace so checkWorkspaceMembers is invoked
      mockWorkspaceState.workspaces.set([{ id: 'ws-1' }]);
      mockWorkspaceService.getMembers.mockReturnValue(
        of([
          { user_id: 'u1', name: 'Alice' },
          { user_id: 'u2', name: 'Bob' },
        ]),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'invite_teammate');
      expect(item?.completed).toBe(true);
    });

    it('should NOT auto-mark invite_teammate when workspace has only 1 member', () => {
      mockWorkspaceState.workspaces.set([{ id: 'ws-1' }]);
      mockWorkspaceService.getMembers.mockReturnValue(
        of([{ user_id: 'u1', name: 'Alice' }]),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'invite_teammate');
      expect(item?.completed).toBe(false);
    });

    it('should auto-mark set_due_date when overdue tasks exist', () => {
      mockDashboardService.getStats.mockReturnValue(
        of(makeStats({ overdue: 1 })),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'set_due_date');
      expect(item?.completed).toBe(true);
    });

    it('should auto-mark set_due_date when due_today tasks exist', () => {
      mockDashboardService.getStats.mockReturnValue(
        of(makeStats({ due_today: 2 })),
      );

      service.initialize();

      const item = service.items().find((i) => i.id === 'set_due_date');
      expect(item?.completed).toBe(true);
    });
  });
});
