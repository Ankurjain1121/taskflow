import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ListViewComponent } from './list-view.component';
import {
  TaskService,
  TaskListResponse,
  TaskListResponseItem,
} from '../../../core/services/task.service';
import { WebSocketService } from '../../../core/services/websocket.service';

function makeTask(overrides: Partial<TaskListResponseItem> = {}): TaskListResponseItem {
  return {
    id: 'task-1',
    title: 'Test Task',
    priority: 'medium',
    status: 'todo',
    column_id: 'col-1',
    column_name: 'To Do',
    due_date: null,
    task_number: 1,
    subtask_completed: 0,
    subtask_total: 0,
    assignees: [],
    labels: [],
    comment_count: 0,
    milestone_name: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const mockResponse: TaskListResponse = {
  tasks: [makeTask()],
  total: 1,
  page: 1,
  page_size: 25,
};

describe('ListViewComponent', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;
  let taskService: { getTaskList: ReturnType<typeof vi.fn>; updateTask: ReturnType<typeof vi.fn>; moveTask: ReturnType<typeof vi.fn> };
  let wsMessages$: Subject<unknown>;

  beforeEach(async () => {
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

    wsMessages$ = new Subject();
    taskService = {
      getTaskList: vi.fn().mockReturnValue(of(mockResponse)),
      updateTask: vi.fn().mockReturnValue(of(makeTask())),
      moveTask: vi.fn().mockReturnValue(of(makeTask())),
    };

    await TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [
        provideRouter([]),
        { provide: TaskService, useValue: taskService },
        {
          provide: WebSocketService,
          useValue: {
            messages$: wsMessages$.asObservable(),
            connect: vi.fn(),
            send: vi.fn(),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
    // Set required input
    (component as any).projectId = signal('project-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load tasks on init', () => {
    component.ngOnInit();
    expect(taskService.getTaskList).toHaveBeenCalledWith('project-1', expect.objectContaining({
      page: 1,
      page_size: 25,
    }));
    expect(component.tasks().length).toBe(1);
    expect(component.totalRecords()).toBe(1);
  });

  it('should render visible columns based on config', () => {
    const visible = component.visibleColumns();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((c) => c.visible)).toBe(true);
  });

  it('should trigger API call on sort change via onLazyLoad', () => {
    component.ngOnInit();
    taskService.getTaskList.mockClear();

    component.onLazyLoad({
      first: 0,
      rows: 25,
      sortField: 'priority',
      sortOrder: 1,
    });

    expect(taskService.getTaskList).toHaveBeenCalledWith('project-1', expect.objectContaining({
      sort_by: 'priority',
      sort_order: 'asc',
    }));
  });

  it('should handle pagination via onLazyLoad', () => {
    component.ngOnInit();
    taskService.getTaskList.mockClear();

    component.onLazyLoad({
      first: 25,
      rows: 25,
      sortField: 'created_at',
      sortOrder: -1,
    });

    expect(taskService.getTaskList).toHaveBeenCalledWith('project-1', expect.objectContaining({
      page: 2,
    }));
  });

  it('should debounce search and reload data', fakeAsync(() => {
    component.ngOnInit();
    taskService.getTaskList.mockClear();

    component.onSearchChange('test query');
    expect(taskService.getTaskList).not.toHaveBeenCalled();

    tick(300);

    expect(taskService.getTaskList).toHaveBeenCalledWith('project-1', expect.objectContaining({
      search: 'test query',
    }));
  }));

  it('should save inline title edit via saveSubject', fakeAsync(() => {
    component.ngOnInit();
    const task = makeTask();
    component.editingCell.set({ taskId: task.id, field: 'title' });
    component.editValue.set('Updated Title');

    component.saveEdit(task);
    tick(300);

    expect(taskService.updateTask).toHaveBeenCalledWith('task-1', { title: 'Updated Title' });
  }));

  it('should toggle column visibility and persist', () => {
    const initialCount = component.visibleColumns().length;
    component.toggleColumnVisibility('task_number', false);
    expect(component.visibleColumns().length).toBe(initialCount - 1);

    const stored = localStorage.getItem('taskflow_list_columns');
    expect(stored).toBeTruthy();
  });

  it('should reload data on WebSocket task events', () => {
    component.ngOnInit();
    taskService.getTaskList.mockClear();

    wsMessages$.next({ type: 'TaskCreated', task: {} });

    expect(taskService.getTaskList).toHaveBeenCalled();
  });

  describe('formatDueDate', () => {
    it('should return "Today" for today\'s date', () => {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(component.formatDueDate(dateStr)).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow\'s date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      expect(component.formatDueDate(dateStr)).toBe('Tomorrow');
    });

    it('should return "Overdue" for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const dateStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      expect(component.formatDueDate(dateStr)).toMatch(/Overdue/);
    });
  });

  describe('getSubtaskPercent', () => {
    it('should calculate percentage correctly', () => {
      const task = makeTask({ subtask_completed: 3, subtask_total: 4 });
      expect(component.getSubtaskPercent(task)).toBe(75);
    });

    it('should return 0 when no subtasks', () => {
      const task = makeTask({ subtask_total: 0 });
      expect(component.getSubtaskPercent(task)).toBe(0);
    });
  });
});
