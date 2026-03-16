import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

import { ProjectViewComponent } from './board-view.component';
import {
  ProjectService,
  ProjectFullResponse,
  Column,
} from '../../../core/services/board.service';
import {
  TaskService,
  Task,
  TaskListItem,
} from '../../../core/services/task.service';
import { TaskGroupService } from '../../../core/services/task-group.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { AuthService } from '../../../core/services/auth.service';
import { DependencyService } from '../../../core/services/dependency.service';
import { MilestoneService } from '../../../core/services/milestone.service';
import { KeyboardShortcutsService } from '../../../core/services/keyboard-shortcuts.service';
import { TaskMoveEvent } from '../kanban-column/kanban-column.component';
import { TaskFilters } from '../board-toolbar/board-toolbar.component';

// --- Helpers ---

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    column_id: 'col-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    position: 'a1',
    milestone_id: null,
    assignee_id: null,
    due_date: null,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    assignees: [],
    labels: [],
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: 'col-1',
    board_id: 'board-1',
    name: 'To Do',
    position: 'a0',
    color: '#6366f1',
    status_mapping: null,
    wip_limit: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const EMPTY_FILTERS: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateStart: null,
  dueDateEnd: null,
  labelIds: [],
  overdue: false,
};

// --- Mocks ---

function createMockProjectService() {
  return {
    getBoardFull: vi.fn(),
    createColumn: vi.fn(),
    listColumns: vi.fn(),
  };
}

function createMockTaskService() {
  return {
    moveTask: vi.fn(),
    createTask: vi.fn(),
    listFlat: vi.fn(),
    listGanttTasks: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
    updateTask: vi.fn(),
  };
}

function createMockTaskGroupService() {
  return {
    listGroupsWithStats: vi.fn().mockReturnValue(of([])),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    toggleCollapse: vi.fn(),
    deleteGroup: vi.fn(),
  };
}

function createMockWebSocketService() {
  return {
    connect: vi.fn(),
    send: vi.fn(),
    messages$: new Subject<{ type: string; payload: unknown }>(),
  };
}

function createMockAuthService() {
  return {
    currentUser: vi.fn().mockReturnValue({ id: 'user-1' }),
  };
}

function createMockDependencyService() {
  return {
    getBoardDependencies: vi.fn(),
  };
}

function createMockMilestoneService() {
  return {
    list: vi.fn().mockReturnValue(of([])),
  };
}

function createMockKeyboardShortcutsService() {
  return {
    register: vi.fn(),
    unregisterByCategory: vi.fn(),
    helpRequested$: new Subject<void>(),
  };
}

describe('ProjectViewComponent', () => {
  let component: ProjectViewComponent;
  let fixture: ComponentFixture<ProjectViewComponent>;
  let mockProjectService: ReturnType<typeof createMockProjectService>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockTaskGroupService: ReturnType<typeof createMockTaskGroupService>;
  let mockWsService: ReturnType<typeof createMockWebSocketService>;
  let mockRouter: Router;
  let routeParams$: Subject<Record<string, string>>;

  const col1 = makeColumn({ id: 'col-1', name: 'To Do', position: 'a0' });
  const col2 = makeColumn({
    id: 'col-2',
    name: 'In Progress',
    position: 'a1',
  });
  const col3 = makeColumn({
    id: 'col-3',
    name: 'Done',
    position: 'a2',
    status_mapping: { done: true },
  });

  const boardFullResponse: ProjectFullResponse = {
    project: {
      id: 'board-1',
      workspace_id: 'ws-1',
      name: 'Test Board',
      description: 'A test board',
      position: 'a0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      statuses: [
        { ...col1, id: 'col-1', project_id: 'board-1', name: 'To Do', color: '#6366f1', type: 'not_started' as const, position: 'a0', is_default: true, created_at: '2026-01-01T00:00:00Z' },
        { ...col2, id: 'col-2', project_id: 'board-1', name: 'In Progress', color: '#6366f1', type: 'active' as const, position: 'a1', is_default: false, created_at: '2026-01-01T00:00:00Z' },
        { ...col3, id: 'col-3', project_id: 'board-1', name: 'Done', color: '#6366f1', type: 'done' as const, position: 'a2', is_default: false, created_at: '2026-01-01T00:00:00Z', status_mapping: { done: true } },
      ] as any,
    },
    tasks: [
      {
        id: 'task-1',
        title: 'Task One',
        description: null,
        priority: 'medium',
        due_date: null,
        column_id: 'col-1',
        status_id: 'col-1',
        status_name: 'To Do',
        status_color: '#6366f1',
        status_type: 'not_started',
        position: 'a0',
        group_id: null,
        task_list_id: null,
        milestone_id: null,
        created_by_id: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        subtask_completed: 0,
        subtask_total: 0,
        has_running_timer: false,
        comment_count: 0,
        assignees: [{ id: 'user-1', display_name: 'Alice', avatar_url: null }],
        labels: [{ id: 'label-1', name: 'Bug', color: '#ff0000' }],
      },
      {
        id: 'task-2',
        title: 'Task Two',
        description: null,
        priority: 'high',
        due_date: '2026-03-01',
        column_id: 'col-2',
        status_id: 'col-2',
        status_name: 'In Progress',
        status_color: '#6366f1',
        status_type: 'active',
        position: 'a0',
        group_id: null,
        task_list_id: null,
        milestone_id: null,
        created_by_id: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        subtask_completed: 0,
        subtask_total: 0,
        has_running_timer: false,
        comment_count: 0,
        assignees: [],
        labels: [],
      },
    ],
    members: [
      {
        user_id: 'user-1',
        board_id: 'board-1',
        role: 'editor' as const,
        name: 'Alice',
        email: 'alice@test.com',
      },
    ],
    meta: {
      total_task_count: 2,
      current_limit: 100,
      current_offset: 0,
    },
  };

  beforeEach(async () => {
    mockProjectService = createMockProjectService();
    mockTaskService = createMockTaskService();
    mockTaskGroupService = createMockTaskGroupService();
    mockWsService = createMockWebSocketService();
    routeParams$ = new Subject();

    mockProjectService.getBoardFull.mockReturnValue(of(boardFullResponse));
    mockTaskService.listFlat.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ProjectViewComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: TaskGroupService, useValue: mockTaskGroupService },
        { provide: WebSocketService, useValue: mockWsService },
        { provide: AuthService, useValue: createMockAuthService() },
        { provide: DependencyService, useValue: createMockDependencyService() },
        { provide: MilestoneService, useValue: createMockMilestoneService() },
        { provide: MessageService, useValue: new MessageService() },
        {
          provide: KeyboardShortcutsService,
          useValue: createMockKeyboardShortcutsService(),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: routeParams$.asObservable(),
            queryParams: of({}),
            snapshot: { queryParams: {} },
          },
        },
      ],
    })
      .overrideComponent(ProjectViewComponent, {
        set: { template: '<div></div>', schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectViewComponent);
    component = fixture.componentInstance;
    mockRouter = TestBed.inject(Router);
    vi.spyOn(mockRouter, 'navigate');
  });

  // --- Creation ---

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Board Loading ---

  describe('loadBoard (via ngOnInit route params)', () => {
    it('should load board data when route params emit', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });

      expect(mockProjectService.getBoardFull).toHaveBeenCalledWith('board-1');
      expect(component.state.board()?.name).toBe('Test Board');
      expect(component.state.columns()).toHaveLength(3);
      expect(component.state.loading()).toBe(false);
    });

    it('should set boardState with tasks grouped by column_id', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });

      const state = component.state.boardState();
      expect(state['col-1']).toHaveLength(1);
      expect(state['col-1'][0].id).toBe('task-1');
      expect(state['col-2']).toHaveLength(1);
      expect(state['col-2'][0].id).toBe('task-2');
      expect(state['col-3']).toHaveLength(0);
    });

    it('should set loading=false and show error on failure', () => {
      mockProjectService.getBoardFull.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });

      expect(component.state.loading()).toBe(false);
      expect(component.state.errorMessage()).toBe('Failed to load board');
    });
  });

  // --- filterTasks ---

  describe('filterTasks (via filteredBoardState)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should return all tasks when no filters are active', () => {
      const filtered = component.getFilteredTasksForColumn('col-1');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task-1');
    });

    it('should filter by search text (case-insensitive)', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        search: 'task one',
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should filter by priority', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        priorities: ['high'],
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(1);
    });

    it('should filter by assignee IDs', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        assigneeIds: ['user-1'],
      });

      // task-1 has user-1 as assignee
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      // task-2 has no assignees
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should filter by due date range', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        dueDateStart: '2026-02-01',
        dueDateEnd: '2026-04-01',
      });

      // task-1 has no due_date, so excluded
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
      // task-2 has due_date 2026-03-01, within range
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(1);
    });

    it('should exclude tasks with no due_date when due date filter is active', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        dueDateStart: '2025-01-01',
        dueDateEnd: null,
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
    });

    it('should filter by label IDs', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        labelIds: ['label-1'],
      });

      // task-1 has label-1
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      // task-2 has no labels
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should combine multiple filters (AND logic)', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        search: 'Task',
        priorities: ['medium'],
      });

      // task-1: medium priority, title matches -> included
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      // task-2: high priority -> excluded
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });
  });

  // --- onTaskMoved ---

  describe('onTaskMoved', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should update boardState optimistically and call moveTask API', () => {
      mockTaskService.moveTask.mockReturnValue(of(makeTask()));

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-1' }),
        targetColumnId: 'col-2',
        previousColumnId: 'col-1',
        previousIndex: 0,
        currentIndex: 0,
      };

      component.dragDrop.onTaskMoved(event);

      expect(mockTaskService.moveTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status_id: 'col-2',
          position: expect.any(String),
        }),
      );
    });

    it('should rollback boardState on API error', () => {
      mockTaskService.moveTask.mockReturnValue(
        throwError(() => new Error('Server error')),
      );

      const snapshotBefore = structuredClone(component.state.boardState());

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-1' }),
        targetColumnId: 'col-2',
        previousColumnId: 'col-1',
        previousIndex: 0,
        currentIndex: 0,
      };

      component.dragDrop.onTaskMoved(event);

      // boardState should revert to snapshot
      expect(component.state.boardState()).toEqual(snapshotBefore);
      expect(component.state.errorMessage()).toBe(
        'Failed to move task. Reverted.',
      );
    });

    it('should celebrate when task moves to a done column', () => {
      vi.useFakeTimers();
      mockTaskService.moveTask.mockReturnValue(of(makeTask()));

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-1' }),
        targetColumnId: 'col-3', // Done column
        previousColumnId: 'col-1',
        previousIndex: 0,
        currentIndex: 0,
      };

      component.dragDrop.onTaskMoved(event);

      expect(component.state.celebratingTaskId()).toBe('task-1');

      vi.advanceTimersByTime(1200);
      expect(component.state.celebratingTaskId()).toBeNull();

      vi.useRealTimers();
    });

    it('should NOT celebrate when reordering within the done column', () => {
      mockTaskService.moveTask.mockReturnValue(of(makeTask()));

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-3' }),
        targetColumnId: 'col-3',
        previousColumnId: 'col-3',
        previousIndex: 0,
        currentIndex: 1,
      };

      component.dragDrop.onTaskMoved(event);

      expect(component.state.celebratingTaskId()).toBeNull();
    });

    it('should compute new position between existing tasks', () => {
      // Put two tasks in col-2 so we can insert between them
      component.state.boardState.update((state) => ({
        ...state,
        'col-2': [
          makeTask({ id: 'task-A', column_id: 'col-2', position: 'a0' }),
          makeTask({ id: 'task-B', column_id: 'col-2', position: 'a2' }),
        ],
      }));

      mockTaskService.moveTask.mockReturnValue(of(makeTask()));

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-1', position: 'a1' }),
        targetColumnId: 'col-2',
        previousColumnId: 'col-1',
        previousIndex: 0,
        currentIndex: 1, // between task-A and task-B
      };

      component.dragDrop.onTaskMoved(event);

      const moveCallArgs = mockTaskService.moveTask.mock.calls[0];
      const newPosition = moveCallArgs[1].position;
      // Position should be between 'a0' and 'a2'
      expect(newPosition > 'a0').toBe(true);
      expect(newPosition < 'a2').toBe(true);
    });
  });

  // --- Computed signals ---

  describe('computed signals', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('connectedColumnIds should return column IDs prefixed with "column-"', () => {
      const ids = component.state.connectedColumnIds();
      expect(ids).toEqual(['column-col-1', 'column-col-2', 'column-col-3']);
    });

    it('allAssignees should aggregate unique assignees from all tasks', () => {
      const assignees = component.state.allAssignees();
      expect(assignees).toHaveLength(1);
      expect(assignees[0].id).toBe('user-1');
    });

    it('allLabels should aggregate unique labels from all tasks', () => {
      const labels = component.state.allLabels();
      expect(labels).toHaveLength(1);
      expect(labels[0].id).toBe('label-1');
    });
  });

  // --- View mode ---

  describe('view mode', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should default to list view', () => {
      expect(component.viewMode()).toBe('list');
    });

    it('should switch to list view and load flat tasks', () => {
      const mockTasks: TaskListItem[] = [];
      mockTaskService.listFlat.mockReturnValue(of(mockTasks));

      component.onViewModeChanged('list');

      expect(component.viewMode()).toBe('list');
      expect(mockTaskService.listFlat).toHaveBeenCalledWith('board-1');
    });
  });

  // --- Selection / Bulk ---

  describe('selection management', () => {
    it('should toggle task selection', () => {
      component.state.toggleTaskSelection('task-1');
      expect(component.state.selectedTaskIds()).toEqual(['task-1']);

      component.state.toggleTaskSelection('task-2');
      expect(component.state.selectedTaskIds()).toEqual(['task-1', 'task-2']);

      component.state.toggleTaskSelection('task-1');
      expect(component.state.selectedTaskIds()).toEqual(['task-2']);
    });

    it('should clear selection', () => {
      component.state.toggleTaskSelection('task-1');
      component.state.clearSelection();

      expect(component.state.selectedTaskIds()).toEqual([]);
      expect(component.state.selectionMode()).toBe(false);
    });
  });

  // --- Error management ---

  describe('error management', () => {
    it('should clear error', () => {
      component.state.showError('Something failed');
      expect(component.state.errorMessage()).toBe('Something failed');

      component.state.clearError();
      expect(component.state.errorMessage()).toBeNull();
    });
  });

  // --- Task update ---

  describe('onTaskUpdated', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should update the task in boardState', () => {
      const updated = makeTask({
        id: 'task-1',
        column_id: 'col-1',
        title: 'Updated Title',
      });
      // updateTaskInState uses status_id to find the bucket
      (updated as any).status_id = 'col-1';

      component.state.updateTaskInState(updated);

      const tasks = component.state.boardState()['col-1'];
      expect(tasks[0].title).toBe('Updated Title');
    });
  });

  // --- Navigation ---

  describe('navigation', () => {
    it('onTaskClicked should navigate to /task/:id', () => {
      component.router.navigate(['/task', 'task-99']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-99']);
    });

    it('onListTaskClicked should navigate to /task/:id', () => {
      component.router.navigate(['/task', 'task-42']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-42']);
    });
  });

  // --- Task Detail ---

  describe('closeTaskDetail', () => {
    it('should set selectedTaskId to null', () => {
      component.state.selectedTaskId.set('task-1');
      component.state.selectedTaskId.set(null);
      expect(component.state.selectedTaskId()).toBeNull();
    });
  });

  // --- Create Task ---

  describe('onCreateTask', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should set up dialog with first column', () => {
      component.onCreateTask();
      expect(component.showCreateTaskDialog).toBe(true);
      expect(component.createTaskDialogColumnId).toBe('col-1');
    });

    it('should not open dialog when no columns exist', () => {
      component.state.columns.set([]);
      component.onCreateTask();
      expect(component.showCreateTaskDialog).toBeFalsy();
    });
  });

  describe('onAddTaskToColumn', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should set up dialog with the specified column', () => {
      component.onAddTaskToColumn('col-2');
      expect(component.showCreateTaskDialog).toBe(true);
      expect(component.createTaskDialogColumnId).toBe('col-2');
      expect(component.createTaskDialogColumnName).toBe('In Progress');
    });

    it('should do nothing if column not found', () => {
      component.onAddTaskToColumn('nonexistent');
      expect(component.showCreateTaskDialog).toBeFalsy();
    });
  });

  // --- Create Column ---

  describe('onAddColumn', () => {
    it('should show create column dialog', () => {
      component.onAddColumn();
      expect(component.showCreateColumnDialog).toBe(true);
    });
  });

  // --- Task Group Operations ---

  describe('onCreateGroup', () => {
    it('should show create group dialog', () => {
      component.onCreateGroup();
      expect(component.showCreateGroupDialog).toBe(true);
    });
  });

  // --- Multiple filter combinations ---

  describe('filterTasks advanced edge cases', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should return empty array for non-existent column', () => {
      const filtered = component.getFilteredTasksForColumn('nonexistent');
      expect(filtered).toHaveLength(0);
    });

    it('should handle description search', () => {
      // task-1 has null description, task-2 has null description
      component.state.filters.set({
        ...EMPTY_FILTERS,
        search: 'nonexistent description',
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should handle empty assigneeIds filter', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        assigneeIds: [],
      });

      // Empty array means no filter
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(1);
    });

    it('should handle empty priorities filter', () => {
      component.state.filters.set({
        ...EMPTY_FILTERS,
        priorities: [],
      });

      // Empty array means no filter
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(1);
    });
  });

  // --- Error management ---

  describe('error management', () => {
    it('should clear error', () => {
      component.state.showError('Something failed');
      expect(component.state.errorMessage()).toBe('Something failed');

      component.state.clearError();
      expect(component.state.errorMessage()).toBeNull();
    });

    it('should overwrite previous error', () => {
      component.state.showError('First error');
      component.state.showError('Second error');
      expect(component.state.errorMessage()).toBe('Second error');
    });
  });

  // --- Selection / Bulk ---

  describe('selection management', () => {
    it('should toggle task selection', () => {
      component.state.toggleTaskSelection('task-1');
      expect(component.state.selectedTaskIds()).toEqual(['task-1']);

      component.state.toggleTaskSelection('task-2');
      expect(component.state.selectedTaskIds()).toEqual(['task-1', 'task-2']);

      component.state.toggleTaskSelection('task-1');
      expect(component.state.selectedTaskIds()).toEqual(['task-2']);
    });

    it('should clear selection', () => {
      component.state.toggleTaskSelection('task-1');
      component.state.clearSelection();

      expect(component.state.selectedTaskIds()).toEqual([]);
      expect(component.state.selectionMode()).toBe(false);
    });

    it('should reset selectionMode to false when clearing selection', () => {
      component.state.selectionMode.set(true);
      component.state.toggleTaskSelection('task-1');
      component.state.clearSelection();

      expect(component.state.selectionMode()).toBe(false);
      expect(component.state.selectedTaskIds()).toEqual([]);
    });
  });

  // --- Navigation ---

  describe('navigation', () => {
    it('onTaskClicked should navigate to /task/:id', () => {
      component.router.navigate(['/task', 'task-99']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-99']);
    });

    it('onListTaskClicked should navigate to /task/:id', () => {
      component.router.navigate(['/task', 'task-42']);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-42']);
    });
  });

  // --- View mode edge cases ---

  describe('view mode edge cases', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });
    });

    it('should switch back to kanban from list', () => {
      const mockTasks: TaskListItem[] = [];
      mockTaskService.listFlat.mockReturnValue(of(mockTasks));

      component.onViewModeChanged('list');
      expect(component.viewMode()).toBe('list');

      component.onViewModeChanged('kanban');
      expect(component.viewMode()).toBe('kanban');
    });
  });

  // --- List View Optimistic Update ---

  describe('onListStatusChanged', () => {
    it('should optimistically update flatTasks status fields', () => {
      fixture.detectChanges();

      // Set up columns directly (avoid relying on route param loading)
      component.state.columns.set([col1, col2, col3]);

      // Set up flat tasks directly
      const flatTask = {
        id: 'task-1',
        title: 'Task One',
        description: null,
        priority: 'medium' as any,
        due_date: null,
        status_id: 'col-1',
        status_name: 'To Do',
        status_color: '#6366f1',
        status_type: null,
        task_list_id: null,
        task_list_name: null,
        position: 'a0',
        created_by_id: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      component.state.flatTasks.set([flatTask]);

      mockTaskService.moveTask.mockReturnValue(of(makeTask()));

      component.onListStatusChanged({
        taskId: 'task-1',
        statusId: 'col-2',
      });

      const updated = component.state.flatTasks().find(
        (t) => t.id === 'task-1',
      );
      expect(updated?.status_id).toBe('col-2');
      expect(updated?.status_name).toBe('In Progress');
    });
  });

  // --- Cleanup ---

  describe('ngOnDestroy', () => {
    it('should unsubscribe from WS on destroy', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', projectId: 'board-1' });

      component.ngOnDestroy();

      expect(mockWsService.send).toHaveBeenCalledWith('unsubscribe', {
        channel: 'project:board-1',
      });
    });
  });
});
