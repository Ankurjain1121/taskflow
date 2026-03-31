import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';

import { MyWorkTimelineComponent } from './my-work-timeline.component';
import {
  MyTasksService,
  MyTask,
  MyTasksResponse,
} from '../../core/services/my-tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { WebSocketService } from '../../core/services/websocket.service';

function makeTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    due_date: null,
    status_id: null,
    status_name: 'To Do',
    is_done: false,
    board_id: 'board-1',
    board_name: 'Board Alpha',
    workspace_id: 'ws-1',
    position: '0',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MOCK_RESPONSE: MyTasksResponse = {
  items: [
    makeTask({ id: 'overdue-1', title: 'Overdue', due_date: '2020-01-01' }),
    makeTask({ id: 'today-1', title: 'Due Today', due_date: todayStr() }),
    makeTask({ id: 'no-date-1', title: 'No Date', due_date: null }),
    makeTask({ id: 'done-1', title: 'Done Task', is_done: true, due_date: todayStr() }),
  ],
  next_cursor: null,
};

describe('MyWorkTimelineComponent', () => {
  let component: MyWorkTimelineComponent;
  let fixture: ComponentFixture<MyWorkTimelineComponent>;
  let router: Router;

  const wsMessages$ = new Subject<{ type: string; payload?: unknown }>();

  const mockMyTasksService = {
    getMyTasks: vi.fn().mockReturnValue(of(MOCK_RESPONSE)),
  };

  const mockAuthService = {
    currentUser: signal({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      role: 'Member' as const,
      tenant_id: 'tenant-1',
      onboarding_completed: true,
    }),
  };

  const mockWsService = {
    connect: vi.fn(),
    send: vi.fn(),
    messages$: wsMessages$.asObservable(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMyTasksService.getMyTasks.mockReturnValue(of(MOCK_RESPONSE));

    await TestBed.configureTestingModule({
      imports: [MyWorkTimelineComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MyTasksService, useValue: mockMyTasksService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebSocketService, useValue: mockWsService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MyWorkTimelineComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with loading true', () => {
      expect(component.loading()).toBe(true);
    });

    it('should start with empty allTasks', () => {
      expect(component.allTasks()).toEqual([]);
    });

    it('should have later and no_due_date collapsed by default', () => {
      expect(component.collapsed().has('later')).toBe(true);
      expect(component.collapsed().has('no_due_date')).toBe(true);
      expect(component.collapsed().has('overdue')).toBe(false);
      expect(component.collapsed().has('today')).toBe(false);
    });

    it('should have 6 groups defined', () => {
      expect(component.groups).toHaveLength(6);
      expect(component.groups.map((g) => g.key)).toEqual([
        'overdue', 'today', 'this_week', 'next_week', 'later', 'no_due_date',
      ]);
    });
  });

  describe('ngOnInit()', () => {
    it('should load tasks and set loading to false', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(mockMyTasksService.getMyTasks).toHaveBeenCalledWith({
        sort_by: 'due_date',
        sort_order: 'asc',
        limit: 200,
      });
      expect(component.allTasks().length).toBeGreaterThan(0);
    });

    it('should set up WebSocket subscription', () => {
      component.ngOnInit();
      expect(mockWsService.connect).toHaveBeenCalled();
      expect(mockWsService.send).toHaveBeenCalledWith('subscribe', {
        channel: 'user:user-1',
      });
    });

    it('should set loading to false on error', async () => {
      mockMyTasksService.getMyTasks.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(component.allTasks()).toEqual([]);
    });
  });

  describe('groupedTasks computed (groupByTimeline)', () => {
    it('should group overdue tasks', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      const grouped = component.groupedTasks();
      expect(grouped.overdue.some((t) => t.id === 'overdue-1')).toBe(true);
    });

    it('should group today tasks', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      const grouped = component.groupedTasks();
      expect(grouped.today.some((t) => t.id === 'today-1')).toBe(true);
    });

    it('should group tasks with no due date', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      const grouped = component.groupedTasks();
      expect(grouped.no_due_date.some((t) => t.id === 'no-date-1')).toBe(true);
    });

    it('should exclude done tasks', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      const grouped = component.groupedTasks();
      const allGrouped = [
        ...grouped.overdue,
        ...grouped.today,
        ...grouped.this_week,
        ...grouped.next_week,
        ...grouped.later,
        ...grouped.no_due_date,
      ];
      expect(allGrouped.find((t) => t.id === 'done-1')).toBeUndefined();
    });

    it('should group this_week tasks correctly', async () => {
      const thisWeekDate = daysFromNow(3);
      const today = new Date();
      const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

      // Only set this test up if 3 days from now is still this week
      const testDate = new Date(thisWeekDate);
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      if (testDate >= tomorrow && testDate <= endOfWeek) {
        mockMyTasksService.getMyTasks.mockReturnValue(of({
          items: [makeTask({ id: 'week-1', title: 'This Week', due_date: thisWeekDate })],
          next_cursor: null,
        }));
        component.ngOnInit();
        await vi.waitFor(() => {
          expect(component.loading()).toBe(false);
        });

        const grouped = component.groupedTasks();
        expect(grouped.this_week.some((t) => t.id === 'week-1')).toBe(true);
      }
    });

    it('should return all empty arrays when no tasks', () => {
      component.allTasks.set([]);
      const grouped = component.groupedTasks();
      expect(grouped.overdue).toEqual([]);
      expect(grouped.today).toEqual([]);
      expect(grouped.this_week).toEqual([]);
      expect(grouped.next_week).toEqual([]);
      expect(grouped.later).toEqual([]);
      expect(grouped.no_due_date).toEqual([]);
    });
  });

  describe('toggleGroup()', () => {
    it('should collapse an expanded group', () => {
      expect(component.collapsed().has('overdue')).toBe(false);
      component.toggleGroup('overdue');
      expect(component.collapsed().has('overdue')).toBe(true);
    });

    it('should expand a collapsed group', () => {
      expect(component.collapsed().has('later')).toBe(true);
      component.toggleGroup('later');
      expect(component.collapsed().has('later')).toBe(false);
    });

    it('should not affect other groups when toggling', () => {
      component.toggleGroup('overdue');
      expect(component.collapsed().has('overdue')).toBe(true);
      expect(component.collapsed().has('later')).toBe(true);
      expect(component.collapsed().has('today')).toBe(false);
    });
  });

  describe('toCards()', () => {
    it('should convert MyTask[] to TaskCardData[]', () => {
      const tasks: MyTask[] = [
        makeTask({
          id: 'c-1',
          title: 'Card 1',
          priority: 'high',
          due_date: '2026-05-01',
          status_name: 'In Progress',
          board_name: 'Board B',
          assignees: [{ id: 'u-1', display_name: 'Bob', avatar_url: null }],
        }),
      ];

      const cards = component.toCards(tasks);
      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe('c-1');
      expect(cards[0].title).toBe('Card 1');
      expect(cards[0].priority).toBe('high');
      expect(cards[0].due_date).toBe('2026-05-01');
      expect(cards[0].status).toBe('In Progress');
      expect(cards[0].project_name).toBe('Board B');
      expect(cards[0].assignee).toEqual({ id: 'u-1', name: 'Bob' });
    });

    it('should return empty array for empty input', () => {
      expect(component.toCards([])).toEqual([]);
    });

    it('should set assignee to null when no assignees', () => {
      const tasks: MyTask[] = [makeTask({ assignees: undefined })];
      const cards = component.toCards(tasks);
      expect(cards[0].assignee).toBeNull();
    });
  });

  describe('onTaskClick()', () => {
    it('should navigate to task detail', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.onTaskClick('task-55');
      expect(navigateSpy).toHaveBeenCalledWith(['/task', 'task-55']);
    });
  });

  describe('WebSocket task reload', () => {
    it('should reload tasks on task:assigned message', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      vi.clearAllMocks();
      mockMyTasksService.getMyTasks.mockReturnValue(of(MOCK_RESPONSE));

      wsMessages$.next({ type: 'task:assigned' });
      await vi.waitFor(() => {
        expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
      });
    });

    it('should reload tasks on task:updated message', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      vi.clearAllMocks();
      mockMyTasksService.getMyTasks.mockReturnValue(of(MOCK_RESPONSE));

      wsMessages$.next({ type: 'task:updated' });
      await vi.waitFor(() => {
        expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
      });
    });

    it('should not reload on unrelated message types', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      vi.clearAllMocks();
      wsMessages$.next({ type: 'comment:created' });

      // Give it a tick, then verify no reload
      await new Promise((r) => setTimeout(r, 50));
      expect(mockMyTasksService.getMyTasks).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should not throw when called', () => {
      component.ngOnInit();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
