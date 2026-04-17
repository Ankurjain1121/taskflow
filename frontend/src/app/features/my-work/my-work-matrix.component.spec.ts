import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';

import { MyWorkMatrixComponent } from './my-work-matrix.component';
import {
  EisenhowerService,
  EisenhowerTask,
  EisenhowerMatrixResponse,
} from '../../core/services/eisenhower.service';
import { TaskService } from '../../core/services/task.service';
import { QuickCreateService } from '../../core/services/quick-create.service';

function makeTask(overrides: Partial<EisenhowerTask> = {}): EisenhowerTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    due_date: null,
    project_id: 'proj-1',
    board_name: 'Board A',
    status_id: 'status-1',
    column_name: 'To Do',
    position: '0',
    is_done: false,
    eisenhower_urgency: null,
    eisenhower_importance: null,
    quadrant: 'do_first',
    assignees: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const MOCK_MATRIX: EisenhowerMatrixResponse = {
  do_first: [makeTask({ id: 'task-1', title: 'Urgent Important', priority: 'urgent' })],
  schedule: [makeTask({ id: 'task-2', title: 'Important Not Urgent', quadrant: 'schedule', priority: 'high' })],
  delegate: [],
  eliminate: [makeTask({ id: 'task-3', title: 'Neither', quadrant: 'eliminate', priority: 'low' })],
};

describe('MyWorkMatrixComponent', () => {
  let component: MyWorkMatrixComponent;
  let fixture: ComponentFixture<MyWorkMatrixComponent>;
  let router: Router;

  const mockEisenhowerService = {
    getMatrix: vi.fn().mockReturnValue(of(MOCK_MATRIX)),
    updateTaskOverride: vi.fn().mockReturnValue(of(undefined)),
  };

  const mockTaskService = {
    completeTask: vi.fn().mockReturnValue(of({})),
    uncompleteTask: vi.fn().mockReturnValue(of({})),
  };

  const mockQuickCreateService = {
    openQuickCreate: vi.fn(),
    request: vi.fn().mockReturnValue(null),
    clearRequest: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEisenhowerService.getMatrix.mockReturnValue(of(MOCK_MATRIX));
    mockEisenhowerService.updateTaskOverride.mockReturnValue(of(undefined));
    mockTaskService.completeTask.mockReturnValue(of({}));

    // Clear sessionStorage animation guard for test isolation
    try { sessionStorage.removeItem('matrix-animated'); } catch { /* noop */ }

    await TestBed.configureTestingModule({
      imports: [MyWorkMatrixComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EisenhowerService, useValue: mockEisenhowerService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: QuickCreateService, useValue: mockQuickCreateService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MyWorkMatrixComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with loading false', () => {
      expect(component.loading()).toBe(false);
    });

    it('should start with null matrix', () => {
      expect(component.matrix()).toBeNull();
    });

    it('should have 4 quadrants defined', () => {
      expect(component.quadrants).toHaveLength(4);
      expect(component.quadrants.map((q) => q.key)).toEqual([
        'do_first', 'schedule', 'delegate', 'eliminate',
      ]);
    });

    it('should have 4 drop list IDs', () => {
      expect(component.allDropListIds).toEqual([
        'matrix-do_first', 'matrix-schedule', 'matrix-delegate', 'matrix-eliminate',
      ]);
    });

    it('should have null dragOverQuadrant', () => {
      expect(component.dragOverQuadrant()).toBeNull();
    });

    it('should have null landedTaskId', () => {
      expect(component.landedTaskId()).toBeNull();
    });
  });

  describe('tasksByQuadrant computed', () => {
    it('should return empty arrays when matrix is null', () => {
      const result = component.tasksByQuadrant();
      expect(result.do_first).toEqual([]);
      expect(result.schedule).toEqual([]);
      expect(result.delegate).toEqual([]);
      expect(result.eliminate).toEqual([]);
    });

    it('should return tasks from matrix when loaded', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.matrix()).toBeTruthy();
      });

      const result = component.tasksByQuadrant();
      expect(result.do_first).toHaveLength(1);
      expect(result.do_first[0].title).toBe('Urgent Important');
      expect(result.schedule).toHaveLength(1);
      expect(result.delegate).toHaveLength(0);
      expect(result.eliminate).toHaveLength(1);
    });
  });

  describe('ngOnInit()', () => {
    it('should call getMatrix and populate matrix signal', async () => {
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(mockEisenhowerService.getMatrix).toHaveBeenCalled();
      expect(component.matrix()).toEqual(MOCK_MATRIX);
    });

    it('should set loading to false on error', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      await vi.waitFor(() => {
        expect(component.loading()).toBe(false);
      });

      expect(component.matrix()).toBeNull();
    });
  });

  describe('formatDue()', () => {
    it('should return empty string for null/undefined', () => {
      expect(component.formatDue(null)).toBe('');
      expect(component.formatDue(undefined)).toBe('');
    });

    it('should return "Today" for today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(component.formatDue(today)).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow', () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      expect(component.formatDue(tomorrow)).toBe('Tomorrow');
    });

    it('should return "Xd overdue" for past dates', () => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
      expect(component.formatDue(past)).toMatch(/\dd overdue/);
    });
  });

  describe('isDueOverdue()', () => {
    it('should return false for null/undefined', () => {
      expect(component.isDueOverdue(null)).toBe(false);
      expect(component.isDueOverdue(undefined)).toBe(false);
    });

    it('should return true for past dates', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(component.isDueOverdue(past)).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date(Date.now() + 86400000 * 5).toISOString();
      expect(component.isDueOverdue(future)).toBe(false);
    });
  });

  describe('onTaskClick()', () => {
    it('should navigate to task detail', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.onTaskClick('task-99');
      expect(navigateSpy).toHaveBeenCalledWith(['/task', 'task-99']);
    });
  });

  // ═══════════════════════════════════════════════════
  // NEW TESTS: onDrop (existing gap)
  // ═══════════════════════════════════════════════════

  describe('onDrop()', () => {
    it('should transfer task between quadrants and call updateTaskOverride', async () => {
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const prevData = [component.tasksByQuadrant().do_first[0]];
      const currData: EisenhowerTask[] = [];

      const mockEvent = {
        previousContainer: { id: 'matrix-do_first', data: prevData },
        container: { id: 'matrix-schedule', data: currData },
        previousIndex: 0,
        currentIndex: 0,
      } as any;

      component.onDrop(mockEvent, 'schedule');

      expect(mockEisenhowerService.updateTaskOverride).toHaveBeenCalledWith(
        'task-1', false, true, // schedule = urgency:false, importance:true
      );
      expect(component.landedTaskId()).toBe('task-1');
    });
  });

  // ═══════════════════════════════════════════════════
  // NEW TESTS: Completion checkbox
  // ═══════════════════════════════════════════════════

  describe('onCompleteTask()', () => {
    it('should call stopPropagation on the event', async () => {
      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should add taskId to completingTaskIds set', () => {
      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');
      expect(component.completingTaskIds().has('task-1')).toBe(true);
    });

    it('should call taskService.completeTask', () => {
      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');
      expect(mockTaskService.completeTask).toHaveBeenCalledWith('task-1');
    });

    it('should remove task from quadrant after delay on success', async () => {
      vi.useFakeTimers();

      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');

      // Before timer: task still in set
      expect(component.completingTaskIds().has('task-1')).toBe(true);

      vi.advanceTimersByTime(700);

      // After timer: task removed from quadrant and completing set
      expect(component.tasksByQuadrant().do_first.find(t => t.id === 'task-1')).toBeUndefined();
      expect(component.completingTaskIds().has('task-1')).toBe(false);

      vi.useRealTimers();
    });

    it('should remove taskId from completingTaskIds on error', () => {
      mockTaskService.completeTask.mockReturnValue(throwError(() => new Error('fail')));

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');

      expect(component.completingTaskIds().has('task-1')).toBe(false);
    });

    it('should report isCompleting correctly', () => {
      expect(component.isCompleting('task-1')).toBe(false);

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onCompleteTask(event, 'task-1', 'do_first');

      expect(component.isCompleting('task-1')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════
  // NEW TESTS: Quick-add
  // ═══════════════════════════════════════════════════

  describe('onQuickAdd()', () => {
    it('should call quickCreateService with correct priority for each quadrant', async () => {
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;

      const expectedPriorities: Record<string, string> = {
        do_first: 'urgent',
        schedule: 'high',
        delegate: 'medium',
        eliminate: 'low',
      };

      for (const [quadrant, priority] of Object.entries(expectedPriorities)) {
        mockQuickCreateService.openQuickCreate.mockClear();
        component.onQuickAdd(event, quadrant as any);
        expect(mockQuickCreateService.openQuickCreate).toHaveBeenCalledWith(
          expect.objectContaining({ priority }),
        );
      }
    });

    it('should set dueDate to today for urgent quadrants', async () => {
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;

      component.onQuickAdd(event, 'do_first');
      const call = mockQuickCreateService.openQuickCreate.mock.calls[0][0];
      expect(call.dueDate).toBeInstanceOf(Date);

      mockQuickCreateService.openQuickCreate.mockClear();
      component.onQuickAdd(event, 'schedule');
      const call2 = mockQuickCreateService.openQuickCreate.mock.calls[0][0];
      expect(call2.dueDate).toBeNull();
    });

    it('should pass suggestedProjectId from most common project in quadrant', async () => {
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const event = { stopPropagation: vi.fn() } as unknown as MouseEvent;
      component.onQuickAdd(event, 'do_first');

      const call = mockQuickCreateService.openQuickCreate.mock.calls[0][0];
      // do_first has task-1 with project_id 'proj-1'
      expect(call.projectId).toBe('proj-1');
    });
  });

  // ═══════════════════════════════════════════════════
  // NEW TESTS: hintsByTaskId computed signal
  // ═══════════════════════════════════════════════════

  describe('hintsByTaskId', () => {
    it('should return empty map when matrix is null', () => {
      expect(component.hintsByTaskId().size).toBe(0);
    });

    it('should return manual hint when eisenhower_urgency is set', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [makeTask({ id: 't1', eisenhower_urgency: true })],
        schedule: [], delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      expect(component.hintsByTaskId().get('t1')).toEqual(['manual']);
    });

    it('should return manual hint when eisenhower_importance is set', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [],
        schedule: [makeTask({ id: 't1', eisenhower_importance: true })],
        delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      expect(component.hintsByTaskId().get('t1')).toEqual(['manual']);
    });

    it('should return overdue hint for past due dates', async () => {
      const pastDate = new Date(Date.now() - 3 * 86400000).toISOString();
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [makeTask({ id: 't1', due_date: pastDate, priority: 'urgent' })],
        schedule: [], delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toContain('overdue');
    });

    it('should return due today hint', async () => {
      const today = new Date().toISOString();
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [makeTask({ id: 't1', due_date: today, priority: 'urgent' })],
        schedule: [], delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toContain('due today');
    });

    it('should return due tomorrow hint', async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [makeTask({ id: 't1', due_date: tomorrow, priority: 'urgent' })],
        schedule: [], delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toContain('due tomorrow');
    });

    it('should return urgent priority hint for urgent tasks', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [makeTask({ id: 't1', priority: 'urgent' })],
        schedule: [], delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toContain('urgent priority');
    });

    it('should return high priority hint for high priority tasks', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [],
        schedule: [makeTask({ id: 't1', priority: 'high' })],
        delegate: [], eliminate: [],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toContain('high priority');
    });

    it('should return low priority hint for tasks with no other signals', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of({
        do_first: [], schedule: [], delegate: [],
        eliminate: [makeTask({ id: 't1', priority: 'medium', due_date: null })],
      }));
      component.ngOnInit();
      await vi.waitFor(() => expect(component.matrix()).toBeTruthy());

      const hints = component.hintsByTaskId().get('t1')!;
      expect(hints).toEqual(['low priority']);
    });
  });
});
