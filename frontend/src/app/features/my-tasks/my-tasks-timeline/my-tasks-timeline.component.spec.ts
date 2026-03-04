import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { of, Subject, EMPTY } from 'rxjs';

import { MyTasksTimelineComponent } from './my-tasks-timeline.component';
import {
  MyTasksService,
  MyTask,
  MyTasksResponse,
  MyTasksSummary,
} from '../../../core/services/my-tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  WebSocketService,
  WebSocketMessage,
} from '../../../core/services/websocket.service';

function createMockTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    due_date: null,
    column_id: 'col-1',
    column_name: 'To Do',
    column_status_mapping: null,
    board_id: 'board-1',
    board_name: 'Main Board',
    workspace_id: 'ws-1',
    workspace_name: 'Workspace',
    labels: [],
    assignees: [],
    created_at: '2026-02-18T10:00:00Z',
    updated_at: '2026-02-18T10:00:00Z',
    ...overrides,
  };
}

describe('MyTasksTimelineComponent', () => {
  let component: MyTasksTimelineComponent;
  let fixture: ComponentFixture<MyTasksTimelineComponent>;

  const mockMyTasksService = {
    getMyTasks: vi
      .fn()
      .mockReturnValue(of({ items: [], next_cursor: null } as MyTasksResponse)),
    getMyTasksSummary: vi.fn().mockReturnValue(
      of({
        total_assigned: 10,
        due_soon: 3,
        overdue: 1,
        completed_this_week: 5,
      } as MyTasksSummary),
    ),
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

  const wsMessages$ = new Subject<WebSocketMessage>();
  const mockWsService = {
    messages$: wsMessages$.asObservable(),
    connect: vi.fn(),
    send: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        MyTasksTimelineComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: MyTasksService, useValue: mockMyTasksService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: WebSocketService, useValue: mockWsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTasksTimelineComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 7 timeline groups configured', () => {
    expect(component.groups).toHaveLength(7);
    const keys = component.groups.map((g) => g.key);
    expect(keys).toEqual([
      'overdue',
      'today',
      'this_week',
      'next_week',
      'later',
      'no_due_date',
      'completed_today',
    ]);
  });

  it('should default viewMode to assigned', () => {
    expect(component.viewMode()).toBe('assigned');
  });

  it('should default collapsed groups to later, no_due_date, and completed_today', () => {
    const collapsed = component.collapsedGroups();
    expect(collapsed.has('later')).toBe(true);
    expect(collapsed.has('no_due_date')).toBe(true);
    expect(collapsed.has('completed_today')).toBe(true);
    expect(collapsed.has('overdue')).toBe(false);
    expect(collapsed.has('today')).toBe(false);
  });

  describe('loadTasks()', () => {
    it('should set loading to true then false after load', async () => {
      const response: MyTasksResponse = { items: [], next_cursor: null };
      mockMyTasksService.getMyTasks.mockReturnValue(of(response));

      await component.loadTasks();

      expect(component.loading()).toBe(false);
      expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
    });

    it('should populate allTasks with response items', async () => {
      const tasks = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
      ];
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: tasks, next_cursor: null }),
      );

      await component.loadTasks();

      expect(component.allTasks()).toHaveLength(2);
    });

    it('should handle error gracefully and set loading to false', async () => {
      mockMyTasksService.getMyTasks.mockReturnValue(
        new (await import('rxjs')).Observable((subscriber) =>
          subscriber.error(new Error('fail')),
        ),
      );

      await component.loadTasks();

      expect(component.loading()).toBe(false);
    });
  });

  describe('loadSummary()', () => {
    it('should populate summary signal', async () => {
      const summary: MyTasksSummary = {
        total_assigned: 20,
        due_soon: 5,
        overdue: 2,
        completed_this_week: 8,
      };
      mockMyTasksService.getMyTasksSummary.mockReturnValue(of(summary));

      await component.loadSummary();

      expect(component.summary()).toEqual(summary);
    });
  });

  describe('toggleGroup()', () => {
    it('should collapse an expanded group', () => {
      // 'overdue' is expanded by default
      expect(component.collapsedGroups().has('overdue')).toBe(false);

      component.toggleGroup('overdue');

      expect(component.collapsedGroups().has('overdue')).toBe(true);
    });

    it('should expand a collapsed group', () => {
      // 'later' is collapsed by default
      expect(component.collapsedGroups().has('later')).toBe(true);

      component.toggleGroup('later');

      expect(component.collapsedGroups().has('later')).toBe(false);
    });

    it('should not mutate the original set (immutability)', () => {
      const originalSet = component.collapsedGroups();

      component.toggleGroup('overdue');

      // The original set should be unchanged; a new set is created
      expect(originalSet.has('overdue')).toBe(false);
      expect(component.collapsedGroups().has('overdue')).toBe(true);
    });
  });

  describe('getGreeting()', () => {
    it('should return a greeting string', () => {
      const greeting = component.getGreeting();
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(
        greeting,
      );
    });
  });

  describe('userName computed', () => {
    it('should derive user name from auth service', () => {
      expect(component.userName()).toBe('Test User');
    });
  });

  describe('groupedTasks computed (groupTasksByTimeline)', () => {
    it('should group a task with no due date into no_due_date', async () => {
      const task = createMockTask({ id: 't-nodate', due_date: null });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      expect(grouped.no_due_date).toHaveLength(1);
      expect(grouped.no_due_date[0].id).toBe('t-nodate');
    });

    it('should group an overdue task into overdue', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2);
      const task = createMockTask({
        id: 't-overdue',
        due_date: yesterday.toISOString(),
      });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      expect(grouped.overdue).toHaveLength(1);
      expect(grouped.overdue[0].id).toBe('t-overdue');
    });

    it('should group a task due today into today', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const task = createMockTask({
        id: 't-today',
        due_date: today.toISOString(),
      });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      expect(grouped.today).toHaveLength(1);
    });

    it('should group a completed-today task into completed_today', async () => {
      const now = new Date();
      const task = createMockTask({
        id: 't-done-today',
        due_date: '2026-02-10T00:00:00Z',
        column_status_mapping: { done: true },
        updated_at: now.toISOString(),
      });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      expect(grouped.completed_today).toHaveLength(1);
    });

    it('should skip non-today completed tasks with due dates', async () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const task = createMockTask({
        id: 't-done-old',
        due_date: lastWeek.toISOString(),
        column_status_mapping: { done: true },
        updated_at: lastWeek.toISOString(),
      });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      // Should not appear in any group (completed, not today, has due date)
      expect(grouped.overdue).toHaveLength(0);
      expect(grouped.completed_today).toHaveLength(0);
    });

    it('should group a task due far in the future into later', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const task = createMockTask({
        id: 't-later',
        due_date: future.toISOString(),
      });
      mockMyTasksService.getMyTasks.mockReturnValue(
        of({ items: [task], next_cursor: null }),
      );

      await component.loadTasks();

      const grouped = component.groupedTasks();
      expect(grouped.later).toHaveLength(1);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should call destroy$ and attempt to unsubscribe from websocket', () => {
      component.ngOnDestroy();
      // Should not throw
      expect(mockWsService.send).toHaveBeenCalledWith('unsubscribe', {
        channel: 'user:user-1',
      });
    });
  });
});
