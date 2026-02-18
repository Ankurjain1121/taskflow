import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { of, Subject, throwError } from 'rxjs';

import { TaskDetailPageComponent } from './task-detail-page.component';
import {
  TaskService,
  Task,
  TaskPriority,
} from '../../core/services/task.service';
import { BoardService, Board, Column } from '../../core/services/board.service';
import {
  WorkspaceService,
  Workspace,
} from '../../core/services/workspace.service';

// --- Helpers ---

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    column_id: 'col-1',
    title: 'Test Task',
    description: 'A description',
    priority: 'medium',
    position: 'a0',
    milestone_id: null,
    assignee_id: null,
    due_date: '2026-06-15',
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    assignees: [{ id: 'user-1', display_name: 'Alice', avatar_url: null }],
    labels: [
      {
        id: 'label-1',
        workspace_id: 'ws-1',
        name: 'Bug',
        color: '#ff0000',
        created_at: '2026-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    workspace_id: 'ws-1',
    name: 'Test Board',
    description: null,
    position: 'a0',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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

function makeWorkspace(): Workspace {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    slug: 'test-ws',
    owner_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

// --- Mocks ---

function createMockTaskService() {
  return {
    getTask: vi.fn(),
    updateTask: vi.fn(),
    assignUser: vi.fn(),
    unassignUser: vi.fn(),
    removeLabel: vi.fn(),
    deleteTask: vi.fn(),
  };
}

function createMockBoardService() {
  return {
    getBoard: vi.fn(),
    listColumns: vi.fn(),
  };
}

function createMockWorkspaceService() {
  return {
    get: vi.fn(),
    searchMembers: vi.fn(),
  };
}

describe('TaskDetailPageComponent', () => {
  let component: TaskDetailPageComponent;
  let fixture: ComponentFixture<TaskDetailPageComponent>;
  let mockTaskService: ReturnType<typeof createMockTaskService>;
  let mockBoardService: ReturnType<typeof createMockBoardService>;
  let mockWorkspaceService: ReturnType<typeof createMockWorkspaceService>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockLocation: { back: ReturnType<typeof vi.fn> };
  let routeParams$: Subject<Record<string, string>>;

  const task = makeTask();
  const board = makeBoard();
  const columns = [
    makeColumn({ id: 'col-1', name: 'To Do' }),
    makeColumn({ id: 'col-2', name: 'Done', status_mapping: { done: true } }),
  ];
  const workspace = makeWorkspace();

  beforeEach(async () => {
    mockTaskService = createMockTaskService();
    mockBoardService = createMockBoardService();
    mockWorkspaceService = createMockWorkspaceService();
    mockRouter = { navigate: vi.fn() };
    mockLocation = { back: vi.fn() };
    routeParams$ = new Subject();

    // Default happy-path returns
    mockTaskService.getTask.mockReturnValue(
      of({ ...task, board_id: 'board-1' }),
    );
    mockBoardService.getBoard.mockReturnValue(of(board));
    mockBoardService.listColumns.mockReturnValue(of(columns));
    mockWorkspaceService.get.mockReturnValue(of(workspace));

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent, HttpClientTestingModule],
      providers: [
        { provide: TaskService, useValue: mockTaskService },
        { provide: BoardService, useValue: mockBoardService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: Router, useValue: mockRouter },
        { provide: Location, useValue: mockLocation },
        {
          provide: ActivatedRoute,
          useValue: { params: routeParams$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetailPageComponent);
    component = fixture.componentInstance;
  });

  // --- Creation ---

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Loading ---

  describe('loading task details', () => {
    it('should load task when route params emit a taskId', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(mockTaskService.getTask).toHaveBeenCalledWith('task-1');
      expect(component.task()?.id).toBe('task-1');
      expect(component.loading()).toBe(false);
    });

    it('should set editTitle and editDescription from loaded task', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(component.editTitle()).toBe('Test Task');
      expect(component.editDescription()).toBe('A description');
    });

    it('should load board context after task loads', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(mockBoardService.getBoard).toHaveBeenCalledWith('board-1');
      expect(mockBoardService.listColumns).toHaveBeenCalledWith('board-1');
      expect(component.board()?.name).toBe('Test Board');
      expect(component.columns()).toHaveLength(2);
    });

    it('should load workspace after board loads', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(mockWorkspaceService.get).toHaveBeenCalledWith('ws-1');
      expect(component.workspace()?.name).toBe('Test Workspace');
    });

    it('should set error on 404', () => {
      mockTaskService.getTask.mockReturnValue(
        throwError(() => ({ status: 404 })),
      );

      fixture.detectChanges();
      routeParams$.next({ taskId: 'nonexistent' });

      expect(component.error()).toBe(
        'This task does not exist or has been deleted.',
      );
      expect(component.loading()).toBe(false);
    });

    it('should set generic error on non-404 failure', () => {
      mockTaskService.getTask.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(component.error()).toBe('Failed to load task. Please try again.');
    });

    it('should not reload if taskId has not changed', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
      routeParams$.next({ taskId: 'task-1' });

      expect(mockTaskService.getTask).toHaveBeenCalledTimes(1);
    });
  });

  // --- Computed: column ---

  describe('column computed', () => {
    it('should return the column matching task.column_id', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(component.column()?.id).toBe('col-1');
      expect(component.column()?.name).toBe('To Do');
    });

    it('should return null when task is null', () => {
      expect(component.column()).toBeNull();
    });
  });

  // --- Computed: dueDateValue ---

  describe('dueDateValue computed', () => {
    it('should return a Date object from task.due_date', () => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      const d = component.dueDateValue();
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toContain('2026-06-15');
    });

    it('should return null when task has no due_date', () => {
      mockTaskService.getTask.mockReturnValue(
        of({ ...task, due_date: null, board_id: 'board-1' }),
      );
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });

      expect(component.dueDateValue()).toBeNull();
    });
  });

  // --- Inline Editing ---

  describe('inline editing', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('startEditing should set editingField', () => {
      component.startEditing('title');
      expect(component.editingField()).toBe('title');
    });

    it('stopEditing should clear editingField', () => {
      component.startEditing('title');
      component.stopEditing();
      expect(component.editingField()).toBeNull();
    });

    it('cancelEditing should revert title and clear editingField', () => {
      component.editTitle.set('Changed Title');
      component.cancelEditing('title');

      expect(component.editTitle()).toBe('Test Task');
      expect(component.editingField()).toBeNull();
    });

    it('cancelEditing should revert description and clear editingField', () => {
      component.editDescription.set('Changed Desc');
      component.cancelEditing('description');

      expect(component.editDescription()).toBe('A description');
      expect(component.editingField()).toBeNull();
    });
  });

  // --- Save title ---

  describe('saveTitle', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('should call updateTask with new title', () => {
      const updatedTask = { ...task, title: 'New Title' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.editTitle.set('New Title');
      component.saveTitle();

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        title: 'New Title',
      });
    });

    it('should not call updateTask if title unchanged', () => {
      component.saveTitle();
      expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });

    it('should revert on API error', () => {
      mockTaskService.updateTask.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.editTitle.set('Bad Title');
      component.saveTitle();

      expect(component.editTitle()).toBe('Test Task');
    });
  });

  // --- Save description ---

  describe('saveDescription', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('should call updateTask with new description', () => {
      const updatedTask = { ...task, description: 'Updated Desc' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.editDescription.set('Updated Desc');
      component.saveDescription();

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        description: 'Updated Desc',
      });
    });

    it('should not call updateTask if description unchanged', () => {
      component.saveDescription();
      expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });
  });

  // --- Priority change ---

  describe('onPriorityChange', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('should call updateTask with new priority', () => {
      const updatedTask = { ...task, priority: 'high' as TaskPriority };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onPriorityChange('high');

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ priority: 'high' }),
      );
    });
  });

  // --- Due date change ---

  describe('onDueDateChange', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('should call updateTask with formatted date', () => {
      const updatedTask = { ...task, due_date: '2026-12-25' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onDueDateChange(new Date('2026-12-25'));

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ due_date: '2026-12-25' }),
      );
    });

    it('should call updateTask with null when date cleared', () => {
      const updatedTask = { ...task, due_date: null };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onDueDateChange(null);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ due_date: null }),
      );
    });
  });

  // --- Assignees ---

  describe('assignees', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('toggleAssigneeSearch should toggle search visibility', () => {
      expect(component.showAssigneeSearch()).toBe(false);

      component.toggleAssigneeSearch();
      expect(component.showAssigneeSearch()).toBe(true);

      component.toggleAssigneeSearch();
      expect(component.showAssigneeSearch()).toBe(false);
    });

    it('toggleAssigneeSearch closing should clear query and results', () => {
      component.showAssigneeSearch.set(true);
      component.assigneeQuery.set('alice');
      component.assigneeResults.set([
        { id: 'u1', name: 'Alice', email: 'alice@test.com', avatar_url: null },
      ]);

      component.toggleAssigneeSearch(); // closes

      expect(component.assigneeQuery()).toBe('');
      expect(component.assigneeResults()).toEqual([]);
    });

    it('onAssigneeSearch should not search if query is shorter than 2 chars', () => {
      component.onAssigneeSearch('a');
      expect(mockWorkspaceService.searchMembers).not.toHaveBeenCalled();
      expect(component.assigneeResults()).toEqual([]);
    });

    it('onAssigneeSearch should search workspace members', () => {
      mockWorkspaceService.searchMembers.mockReturnValue(
        of([
          { id: 'u2', name: 'Bob', email: 'bob@test.com', avatar_url: null },
        ]),
      );

      component.onAssigneeSearch('Bo');

      expect(mockWorkspaceService.searchMembers).toHaveBeenCalledWith(
        'ws-1',
        'Bo',
      );
      expect(component.assigneeResults()).toHaveLength(1);
    });

    it('onAssign should call assignUser and update task signal', () => {
      mockTaskService.assignUser.mockReturnValue(of(undefined));

      const member = {
        id: 'u2',
        name: 'Bob',
        email: 'bob@test.com',
        avatar_url: null,
      };
      component.onAssign(member);

      expect(mockTaskService.assignUser).toHaveBeenCalledWith('task-1', 'u2');
      const assignees = component.task()?.assignees ?? [];
      expect(assignees).toHaveLength(2);
      expect(assignees[1].display_name).toBe('Bob');
    });

    it('onUnassign should call unassignUser and remove from task signal', () => {
      mockTaskService.unassignUser.mockReturnValue(of(undefined));

      component.onUnassign({
        id: 'user-1',
        display_name: 'Alice',
        avatar_url: null,
      });

      expect(mockTaskService.unassignUser).toHaveBeenCalledWith(
        'task-1',
        'user-1',
      );
      expect(component.task()?.assignees).toHaveLength(0);
    });
  });

  // --- Labels ---

  describe('labels', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('onRemoveLabel should call removeLabel and update task signal', () => {
      mockTaskService.removeLabel.mockReturnValue(of(undefined));

      component.onRemoveLabel('label-1');

      expect(mockTaskService.removeLabel).toHaveBeenCalledWith(
        'task-1',
        'label-1',
      );
      expect(component.task()?.labels).toHaveLength(0);
    });
  });

  // --- Delete ---

  describe('onDelete', () => {
    beforeEach(() => {
      fixture.detectChanges();
      routeParams$.next({ taskId: 'task-1' });
    });

    it('should call deleteTask when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockTaskService.deleteTask.mockReturnValue(of(undefined));

      component.onDelete();

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should not call deleteTask when cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.onDelete();

      expect(mockTaskService.deleteTask).not.toHaveBeenCalled();
    });
  });

  // --- Helpers ---

  describe('helper methods', () => {
    it('getInitials should return up to 2 uppercase initials', () => {
      expect(component.getInitials('Alice Wonder')).toBe('AW');
      expect(component.getInitials('Bob')).toBe('B');
      expect(component.getInitials('John Doe Smith')).toBe('JD');
    });

    it('getAvatarColor should return a color from the palette', () => {
      const color = component.getAvatarColor('Alice');
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('formatDate should format a date string', () => {
      const formatted = component.formatDate('2026-01-15T10:30:00Z');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2026');
    });

    it('formatShortDate should format without time', () => {
      const formatted = component.formatShortDate('2026-06-15');
      expect(formatted).toContain('Jun');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2026');
    });

    it('getPriorityDisplayLabel should return a label string', () => {
      const label = component.getPriorityDisplayLabel('high');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  // --- goBack ---

  describe('goBack', () => {
    it('should call location.back() when history exists', () => {
      // window.history.length is read-only; stub it via defineProperty
      Object.defineProperty(window, 'history', {
        value: { length: 2 },
        writable: true,
        configurable: true,
      });
      component.goBack();
      expect(mockLocation.back).toHaveBeenCalled();
    });
  });

  // --- Cleanup ---

  describe('ngOnDestroy', () => {
    it('should not throw when unsubscribing', () => {
      fixture.detectChanges();
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
