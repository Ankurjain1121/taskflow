import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { BoardViewComponent } from './board-view.component';
import {
  BoardService,
  BoardFullResponse,
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
};

// --- Mocks ---

function createMockBoardService() {
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
  };
}

describe('BoardViewComponent', () => {
  let component: BoardViewComponent;
  let fixture: ComponentFixture<BoardViewComponent>;
  let mockBoardService: ReturnType<typeof createMockBoardService>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockTaskGroupService: ReturnType<typeof createMockTaskGroupService>;
  let mockWsService: ReturnType<typeof createMockWebSocketService>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
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

  const boardFullResponse: BoardFullResponse = {
    board: {
      id: 'board-1',
      workspace_id: 'ws-1',
      name: 'Test Board',
      description: 'A test board',
      position: 'a0',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      columns: [col1, col2, col3],
    },
    tasks: [
      {
        id: 'task-1',
        title: 'Task One',
        description: null,
        priority: 'medium',
        due_date: null,
        column_id: 'col-1',
        position: 'a0',
        group_id: null,
        milestone_id: null,
        created_by_id: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        subtask_completed: 0,
        subtask_total: 0,
        has_running_timer: false,
        comment_count: 0,
        assignees: [
          { id: 'user-1', display_name: 'Alice', avatar_url: null },
        ],
        labels: [
          { id: 'label-1', name: 'Bug', color: '#ff0000' },
        ],
      },
      {
        id: 'task-2',
        title: 'Task Two',
        description: null,
        priority: 'high',
        due_date: '2026-03-01',
        column_id: 'col-2',
        position: 'a0',
        group_id: null,
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
  };

  beforeEach(async () => {
    mockBoardService = createMockBoardService();
    mockTaskService = createMockTaskService();
    mockTaskGroupService = createMockTaskGroupService();
    mockWsService = createMockWebSocketService();
    mockRouter = { navigate: vi.fn() };
    routeParams$ = new Subject();

    mockBoardService.getBoardFull.mockReturnValue(of(boardFullResponse));

    await TestBed.configureTestingModule({
      imports: [BoardViewComponent, HttpClientTestingModule],
      providers: [
        { provide: BoardService, useValue: mockBoardService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: TaskGroupService, useValue: mockTaskGroupService },
        { provide: WebSocketService, useValue: mockWsService },
        { provide: AuthService, useValue: createMockAuthService() },
        { provide: DependencyService, useValue: createMockDependencyService() },
        { provide: MilestoneService, useValue: createMockMilestoneService() },
        {
          provide: KeyboardShortcutsService,
          useValue: createMockKeyboardShortcutsService(),
        },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { params: routeParams$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BoardViewComponent);
    component = fixture.componentInstance;
  });

  // --- Creation ---

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Board Loading ---

  describe('loadBoard (via ngOnInit route params)', () => {
    it('should load board data when route params emit', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });

      expect(mockBoardService.getBoardFull).toHaveBeenCalledWith('board-1');
      expect(component.board()?.name).toBe('Test Board');
      expect(component.columns()).toHaveLength(3);
      expect(component.loading()).toBe(false);
    });

    it('should set boardState with tasks grouped by column_id', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });

      const state = component.boardState();
      expect(state['col-1']).toHaveLength(1);
      expect(state['col-1'][0].id).toBe('task-1');
      expect(state['col-2']).toHaveLength(1);
      expect(state['col-2'][0].id).toBe('task-2');
      expect(state['col-3']).toHaveLength(0);
    });

    it('should set loading=false and show error on failure', () => {
      mockBoardService.getBoardFull.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });

      expect(component.loading()).toBe(false);
      expect(component.errorMessage()).toBe('Failed to load board');
    });
  });

  // --- filterTasks ---

  describe('filterTasks (via filteredBoardState)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });
    });

    it('should return all tasks when no filters are active', () => {
      const filtered = component.getFilteredTasksForColumn('col-1');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('task-1');
    });

    it('should filter by search text (case-insensitive)', () => {
      component.onFiltersChanged({
        ...EMPTY_FILTERS,
        search: 'task one',
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should filter by priority', () => {
      component.onFiltersChanged({
        ...EMPTY_FILTERS,
        priorities: ['high'],
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(1);
    });

    it('should filter by assignee IDs', () => {
      component.onFiltersChanged({
        ...EMPTY_FILTERS,
        assigneeIds: ['user-1'],
      });

      // task-1 has user-1 as assignee
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      // task-2 has no assignees
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should filter by due date range', () => {
      component.onFiltersChanged({
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
      component.onFiltersChanged({
        ...EMPTY_FILTERS,
        dueDateStart: '2025-01-01',
        dueDateEnd: null,
      });

      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(0);
    });

    it('should filter by label IDs', () => {
      component.onFiltersChanged({
        ...EMPTY_FILTERS,
        labelIds: ['label-1'],
      });

      // task-1 has label-1
      expect(component.getFilteredTasksForColumn('col-1')).toHaveLength(1);
      // task-2 has no labels
      expect(component.getFilteredTasksForColumn('col-2')).toHaveLength(0);
    });

    it('should combine multiple filters (AND logic)', () => {
      component.onFiltersChanged({
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
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });
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

      component.onTaskMoved(event);

      expect(mockTaskService.moveTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          column_id: 'col-2',
          position: expect.any(String),
        }),
      );
    });

    it('should rollback boardState on API error', () => {
      mockTaskService.moveTask.mockReturnValue(
        throwError(() => new Error('Server error')),
      );

      const snapshotBefore = structuredClone(component.boardState());

      const event: TaskMoveEvent = {
        task: makeTask({ id: 'task-1', column_id: 'col-1' }),
        targetColumnId: 'col-2',
        previousColumnId: 'col-1',
        previousIndex: 0,
        currentIndex: 0,
      };

      component.onTaskMoved(event);

      // boardState should revert to snapshot
      expect(component.boardState()).toEqual(snapshotBefore);
      expect(component.errorMessage()).toBe(
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

      component.onTaskMoved(event);

      expect(component.celebratingTaskId()).toBe('task-1');

      vi.advanceTimersByTime(1200);
      expect(component.celebratingTaskId()).toBeNull();

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

      component.onTaskMoved(event);

      expect(component.celebratingTaskId()).toBeNull();
    });

    it('should compute new position between existing tasks', () => {
      // Put two tasks in col-2 so we can insert between them
      component.boardState.update((state) => ({
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

      component.onTaskMoved(event);

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
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });
    });

    it('connectedColumnIds should return column IDs prefixed with "column-"', () => {
      const ids = component.connectedColumnIds();
      expect(ids).toEqual(['column-col-1', 'column-col-2', 'column-col-3']);
    });

    it('allAssignees should aggregate unique assignees from all tasks', () => {
      const assignees = component.allAssignees();
      expect(assignees).toHaveLength(1);
      expect(assignees[0].id).toBe('user-1');
    });

    it('allLabels should aggregate unique labels from all tasks', () => {
      const labels = component.allLabels();
      expect(labels).toHaveLength(1);
      expect(labels[0].id).toBe('label-1');
    });
  });

  // --- View mode ---

  describe('view mode', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });
    });

    it('should default to kanban view', () => {
      expect(component.viewMode()).toBe('kanban');
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
      component.toggleTaskSelection('task-1');
      expect(component.selectedTaskIds()).toEqual(['task-1']);

      component.toggleTaskSelection('task-2');
      expect(component.selectedTaskIds()).toEqual(['task-1', 'task-2']);

      component.toggleTaskSelection('task-1');
      expect(component.selectedTaskIds()).toEqual(['task-2']);
    });

    it('should clear selection', () => {
      component.toggleTaskSelection('task-1');
      component.clearSelection();

      expect(component.selectedTaskIds()).toEqual([]);
      expect(component.selectionMode()).toBe(false);
    });
  });

  // --- Error management ---

  describe('error management', () => {
    it('should clear error', () => {
      // Trigger an error first
      component['showError']('Something failed');
      expect(component.errorMessage()).toBe('Something failed');

      component.clearError();
      expect(component.errorMessage()).toBeNull();
    });
  });

  // --- Task update ---

  describe('onTaskUpdated', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });
    });

    it('should update the task in boardState', () => {
      const updated = makeTask({
        id: 'task-1',
        column_id: 'col-1',
        title: 'Updated Title',
      });

      component.onTaskUpdated(updated);

      const tasks = component.boardState()['col-1'];
      expect(tasks[0].title).toBe('Updated Title');
    });
  });

  // --- Navigation ---

  describe('navigation', () => {
    it('onTaskClicked should navigate to /task/:id', () => {
      const task = makeTask({ id: 'task-99' });
      component.onTaskClicked(task);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-99']);
    });

    it('onListTaskClicked should navigate to /task/:id', () => {
      component.onListTaskClicked('task-42');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'task-42']);
    });
  });

  // --- Cleanup ---

  describe('ngOnDestroy', () => {
    it('should unregister shortcuts and unsubscribe from WS', () => {
      fixture.detectChanges();
      routeParams$.next({ workspaceId: 'ws-1', boardId: 'board-1' });

      const shortcutsService = TestBed.inject(KeyboardShortcutsService);
      component.ngOnDestroy();

      expect(shortcutsService.unregisterByCategory).toHaveBeenCalledWith(
        'Board',
      );
      expect(mockWsService.send).toHaveBeenCalledWith('unsubscribe', {
        channel: 'board:board-1',
      });
    });
  });
});
