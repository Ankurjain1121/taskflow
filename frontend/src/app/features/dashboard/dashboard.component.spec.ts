import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import {
  DashboardService,
  DashboardStats,
} from '../../core/services/dashboard.service';
import { WorkspaceStateService } from '../../core/services/workspace-state.service';
import { OnboardingChecklistService } from '../../core/services/onboarding-checklist.service';
import { TaskService } from '../../core/services/task.service';

const MOCK_STATS: DashboardStats = {
  total_tasks: 42,
  overdue: 3,
  completed_this_week: 12,
  due_today: 5,
};

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
    getFocusTasks: vi.fn().mockReturnValue(of([])),
    getStreak: vi.fn().mockReturnValue(of(null)),
    invalidateCache: vi.fn(),
  };

  const mockTaskService = {
    updateTask: vi.fn().mockReturnValue(of({})),
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
    mockDashboardService.getFocusTasks.mockReturnValue(of([]));
    mockDashboardService.getStreak.mockReturnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: WorkspaceStateService, useValue: mockWorkspaceState },
        { provide: TaskService, useValue: mockTaskService },
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
        imports: [DashboardComponent],
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          { provide: AuthService, useValue: nullAuthService },
          { provide: DashboardService, useValue: mockDashboardService },
          { provide: WorkspaceStateService, useValue: mockWorkspaceState },
          { provide: TaskService, useValue: mockTaskService },
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

    it('should call invalidateCache', () => {
      component.ngOnInit();
      expect(mockDashboardService.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('workspaceOptions computed', () => {
    it('should return options when there are multiple workspaces', () => {
      // Trigger effects to copy workspaces from state service
      component.ngOnInit();
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

      // Trigger ngOnInit to set up workspaces via effect
      component.ngOnInit();
      fixture.detectChanges();

      const options = component.workspaceOptions();
      expect(options).toEqual([]);
    });
  });

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

  describe('navigateToOnboarding()', () => {
    it('should navigate to /onboarding', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.navigateToOnboarding();
      expect(navigateSpy).toHaveBeenCalledWith(['/onboarding']);
    });
  });

  describe('toggleFocusMode()', () => {
    it('should toggle focusModeOpen', () => {
      expect(component.focusModeOpen()).toBe(false);
      component.toggleFocusMode();
      expect(component.focusModeOpen()).toBe(true);
      component.toggleFocusMode();
      expect(component.focusModeOpen()).toBe(false);
    });
  });

  describe('closeFocusMode()', () => {
    it('should set focusModeOpen to false', () => {
      component.focusModeOpen.set(true);
      component.closeFocusMode();
      expect(component.focusModeOpen()).toBe(false);
    });
  });

  describe('stats loading', () => {
    it('should load stats via dashboard service', () => {
      component.ngOnInit();
      fixture.detectChanges();

      // Stats are loaded in the effect after workspace state updates
      expect(mockDashboardService.getStats).toHaveBeenCalled();
    });

    it('getStats error should leave stats as null', () => {
      component.stats.set(null);
      mockDashboardService.getStats.mockReturnValue(throwError(() => new Error('fail')));

      component.onWorkspaceChange('ws-1');
      expect(component.stats()).toBeNull();
    });
  });

  describe('onFocusTaskCompleted()', () => {
    it('should call taskService.updateTask', () => {
      component.onFocusTaskCompleted('task-1');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', { status_id: null });
    });
  });
});
