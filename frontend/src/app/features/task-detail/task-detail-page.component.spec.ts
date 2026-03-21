import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';

import { TaskDetailPageComponent } from './task-detail-page.component';
import {
  TaskService,
  Task,
  TaskPriority,
} from '../../core/services/task.service';
import { ProjectService, Board, Column } from '../../core/services/project.service';
import {
  WorkspaceService,
  Workspace,
} from '../../core/services/workspace.service';
import { AuthService } from '../../core/services/auth.service';
import { RecentItemsService } from '../../core/services/recent-items.service';
import { WorkspaceContextService } from '../../core/services/workspace-context.service';

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
    description: null,
    logo_url: null,
    created_by_id: 'user-1',
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
    listReminders: vi.fn(),
    addWatcher: vi.fn(),
    removeWatcher: vi.fn(),
    setReminder: vi.fn(),
    removeReminder: vi.fn(),
  };
}

function createMockProjectService() {
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
  let mockProjectService: ReturnType<typeof createMockProjectService>;
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

  const mockAuthService = {
    currentUser: signal({
      id: 'user-1',
      email: 'alice@test.com',
      name: 'Alice',
      role: 'Member' as const,
      tenant_id: 't-1',
      onboarding_completed: true,
    }),
  };

  const mockRecentItemsService = {
    recordTaskView: vi.fn(),
  };

  const mockWsContext = {
    activeWorkspaceId: vi.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    mockTaskService = createMockTaskService();
    mockProjectService = createMockProjectService();
    mockWorkspaceService = createMockWorkspaceService();
    mockRouter = { navigate: vi.fn() };
    mockLocation = { back: vi.fn() };
    routeParams$ = new Subject();

    // Default happy-path returns
    mockTaskService.getTask.mockReturnValue(
      of({ ...task, board_id: 'board-1' }),
    );
    mockTaskService.listReminders.mockReturnValue(of([]));
    mockProjectService.getBoard.mockReturnValue(of(board));
    mockProjectService.listColumns.mockReturnValue(of(columns));
    mockWorkspaceService.get.mockReturnValue(of(workspace));

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskService, useValue: mockTaskService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: RecentItemsService, useValue: mockRecentItemsService },
        { provide: WorkspaceContextService, useValue: mockWsContext },
        { provide: Router, useValue: mockRouter },
        { provide: Location, useValue: mockLocation },
        {
          provide: ActivatedRoute,
          useValue: { params: routeParams$.asObservable() },
        },
      ],
    })
      .overrideComponent(TaskDetailPageComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

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
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();

      expect(mockTaskService.getTask).toHaveBeenCalledWith('task-1');
      expect(component.task()?.id).toBe('task-1');
      expect(component.loading()).toBe(false);
    });

    it('should set editTitle and editDescription from loaded task', () => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();

      expect(component.editTitle()).toBe('Test Task');
      expect(component.editDescription()).toBe('A description');
    });

    it('should load board context after task loads', () => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();

      expect(mockProjectService.getBoard).toHaveBeenCalledWith('board-1');
      expect(mockProjectService.listColumns).toHaveBeenCalledWith('board-1');
      expect(component.board()?.name).toBe('Test Board');
      expect(component.columns()).toHaveLength(2);
    });

    it('should load workspace after board loads', () => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();

      expect(mockWorkspaceService.get).toHaveBeenCalledWith('ws-1');
      expect(component.workspace()?.name).toBe('Test Workspace');
    });

    it('should set error on 404', () => {
      mockTaskService.getTask.mockReturnValue(
        throwError(() => ({ status: 404 })),
      );

      routeParams$.next({ taskId: 'nonexistent' });
      fixture.detectChanges();

      expect(component.error()).toBe(
        'This task does not exist or has been deleted.',
      );
      expect(component.loading()).toBe(false);
    });

    it('should set generic error on non-404 failure', () => {
      mockTaskService.getTask.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();

      expect(component.error()).toBe('Failed to load task. Please try again.');
    });
  });

  // --- Title/Description Save (via header component events) ---

  describe('onTitleSaved', () => {
    beforeEach(() => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
    });

    it('should call updateTask with new title', () => {
      const updatedTask = { ...task, title: 'New Title' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onTitleSaved('New Title');

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        title: 'New Title',
      });
    });

    it('should revert on API error', () => {
      mockTaskService.updateTask.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.onTitleSaved('Bad Title');

      expect(component.editTitle()).toBe('Test Task');
    });
  });

  describe('onDescriptionSaved', () => {
    beforeEach(() => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
    });

    it('should call updateTask with new description', () => {
      const updatedTask = { ...task, description: 'Updated Desc' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onDescriptionSaved('Updated Desc');

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        description: 'Updated Desc',
      });
    });

    it('should call updateTask with null when description cleared', () => {
      const updatedTask = { ...task, description: null };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onDescriptionSaved('');

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        description: null,
      });
    });
  });

  // --- Priority change ---

  describe('onPriorityChange', () => {
    beforeEach(() => {
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
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
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
    });

    it('should call updateTask with formatted date', () => {
      const updatedTask = { ...task, due_date: '2026-12-25' };
      mockTaskService.updateTask.mockReturnValue(of(updatedTask));

      component.onDueDateChange(new Date('2026-12-25'));

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ due_date: '2026-12-25T00:00:00.000Z' }),
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
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
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
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
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
      routeParams$.next({ taskId: 'task-1' });
      fixture.detectChanges();
    });

    it('should call deleteTask when confirmed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockTaskService.deleteTask.mockReturnValue(of(undefined));
      // goBack needs history.length > 1 so it calls location.back()
      Object.defineProperty(window, 'history', {
        value: { length: 2 },
        writable: true,
        configurable: true,
      });

      component.onDelete();

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should not call deleteTask when cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.onDelete();

      expect(mockTaskService.deleteTask).not.toHaveBeenCalled();
    });
  });

  // --- goBack ---

  describe('goBack', () => {
    it('should call location.back() when history exists', () => {
      Object.defineProperty(window, 'history', {
        value: { length: 2 },
        writable: true,
        configurable: true,
      });
      component.goBack();
      expect(mockLocation.back).toHaveBeenCalled();
    });
  });
});
