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
  do_first: [makeTask({ id: 'task-1', title: 'Urgent Important' })],
  schedule: [makeTask({ id: 'task-2', title: 'Important Not Urgent', quadrant: 'schedule' })],
  delegate: [],
  eliminate: [makeTask({ id: 'task-3', title: 'Neither', quadrant: 'eliminate' })],
};

describe('MyWorkMatrixComponent', () => {
  let component: MyWorkMatrixComponent;
  let fixture: ComponentFixture<MyWorkMatrixComponent>;
  let router: Router;

  const mockEisenhowerService = {
    getMatrix: vi.fn().mockReturnValue(of(MOCK_MATRIX)),
    updateTaskOverride: vi.fn().mockReturnValue(of(undefined)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEisenhowerService.getMatrix.mockReturnValue(of(MOCK_MATRIX));
    mockEisenhowerService.updateTaskOverride.mockReturnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [MyWorkMatrixComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: EisenhowerService, useValue: mockEisenhowerService },
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

  describe('quadrantBorderColor()', () => {
    it('should return color-mix for do_first', () => {
      const color = component.quadrantBorderColor('do_first');
      expect(color).toContain('destructive');
    });

    it('should return color-mix for schedule', () => {
      const color = component.quadrantBorderColor('schedule');
      expect(color).toContain('warning');
    });

    it('should return color-mix for delegate', () => {
      const color = component.quadrantBorderColor('delegate');
      expect(color).toContain('primary');
    });

    it('should return var(--border) for eliminate', () => {
      const color = component.quadrantBorderColor('eliminate');
      expect(color).toBe('var(--border)');
    });
  });

  describe('quadrantBgColor()', () => {
    it('should return color-mix for do_first', () => {
      const color = component.quadrantBgColor('do_first');
      expect(color).toContain('destructive');
    });

    it('should return var(--muted) for eliminate', () => {
      const color = component.quadrantBgColor('eliminate');
      expect(color).toBe('var(--muted)');
    });
  });

  describe('toCard()', () => {
    it('should convert EisenhowerTask to TaskCardData', () => {
      const task = makeTask({
        id: 'task-42',
        title: 'Matrix Card',
        priority: 'high',
        due_date: '2026-04-01',
        column_name: 'In Progress',
        board_name: 'Board X',
        assignees: [{ id: 'user-1', display_name: 'Alice', avatar_url: null }],
      });

      const card = component.toCard(task);
      expect(card.id).toBe('task-42');
      expect(card.title).toBe('Matrix Card');
      expect(card.priority).toBe('high');
      expect(card.due_date).toBe('2026-04-01');
      expect(card.status).toBe('In Progress');
      expect(card.project_name).toBe('Board X');
      expect(card.assignee).toEqual({ id: 'user-1', name: 'Alice' });
    });

    it('should set assignee to null when no assignees', () => {
      const task = makeTask({ assignees: [] });
      const card = component.toCard(task);
      expect(card.assignee).toBeNull();
    });

    it('should default priority to none when empty string', () => {
      const task = makeTask({ priority: '' });
      const card = component.toCard(task);
      expect(card.priority).toBe('none');
    });
  });

  describe('onTaskClick()', () => {
    it('should navigate to task detail', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      component.onTaskClick('task-99');
      expect(navigateSpy).toHaveBeenCalledWith(['/task', 'task-99']);
    });
  });
});
