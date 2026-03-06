import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { ConfirmationService } from 'primeng/api';

import { EisenhowerMatrixComponent } from './eisenhower-matrix.component';
import {
  EisenhowerService,
  EisenhowerMatrixResponse,
  EisenhowerTask,
  EisenhowerQuadrant,
} from '../../../core/services/eisenhower.service';
import { TaskService } from '../../../core/services/task.service';

function createMockEisenhowerTask(
  overrides: Partial<EisenhowerTask> = {},
): EisenhowerTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    due_date: null,
    project_id: 'board-1',
    project_name: 'Main Board',
    column_id: 'col-1',
    column_name: 'To Do',
    position: '0',
    is_done: false,
    eisenhower_urgency: null,
    eisenhower_importance: null,
    quadrant: 'do_first',
    created_at: '2026-02-18T10:00:00Z',
    updated_at: '2026-02-18T10:00:00Z',
    ...overrides,
  };
}

function createMockMatrix(
  overrides: Partial<EisenhowerMatrixResponse> = {},
): EisenhowerMatrixResponse {
  return {
    do_first: [],
    schedule: [],
    delegate: [],
    eliminate: [],
    ...overrides,
  };
}

describe('EisenhowerMatrixComponent', () => {
  let component: EisenhowerMatrixComponent;
  let fixture: ComponentFixture<EisenhowerMatrixComponent>;

  const mockEisenhowerService = {
    getMatrix: vi.fn().mockReturnValue(of(createMockMatrix())),
    resetAllOverrides: vi.fn().mockReturnValue(of({ tasks_reset: 0 })),
  };

  const mockTaskService = {
    deleteTask: vi.fn().mockReturnValue(of(undefined)),
  };

  const mockConfirmationService = {
    confirm: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [
        EisenhowerMatrixComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: EisenhowerService, useValue: mockEisenhowerService },
        { provide: TaskService, useValue: mockTaskService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EisenhowerMatrixComponent);
    component = fixture.componentInstance;

    // The component provides its own ConfirmationService at component level.
    // Spy on the actual injected instance's confirm method.
    const realConfirmationService =
      fixture.debugElement.injector.get(ConfirmationService);
    mockConfirmationService.confirm = vi.spyOn(
      realConfirmationService,
      'confirm',
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 quadrant configurations', () => {
    expect(component.quadrants).toHaveLength(4);
    const keys = component.quadrants.map((q) => q.key);
    expect(keys).toEqual(['do_first', 'schedule', 'delegate', 'eliminate']);
  });

  it('should have correct quadrant titles', () => {
    const titles = component.quadrants.map((q) => q.title);
    expect(titles).toEqual(['Do First', 'Schedule', 'Delegate', 'Eliminate']);
  });

  it('should have correct quadrant subtitles', () => {
    const subtitles = component.quadrants.map((q) => q.subtitle);
    expect(subtitles).toEqual([
      'Urgent & Important',
      'Not Urgent & Important',
      'Urgent & Not Important',
      'Not Urgent & Not Important',
    ]);
  });

  it('should have actionLabel on delegate and eliminate only', () => {
    const doFirst = component.quadrants.find((q) => q.key === 'do_first');
    const schedule = component.quadrants.find((q) => q.key === 'schedule');
    const delegate = component.quadrants.find((q) => q.key === 'delegate');
    const eliminate = component.quadrants.find((q) => q.key === 'eliminate');

    expect(doFirst?.actionLabel).toBeUndefined();
    expect(schedule?.actionLabel).toBeUndefined();
    expect(delegate?.actionLabel).toBe('Reassign');
    expect(eliminate?.actionLabel).toBe('Archive');
  });

  describe('loadMatrix()', () => {
    it('should set loading to true then false after load', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of(createMockMatrix()));

      await component.loadMatrix();

      expect(component.loading()).toBe(false);
      expect(mockEisenhowerService.getMatrix).toHaveBeenCalled();
    });

    it('should populate matrix signal with response', async () => {
      const matrix = createMockMatrix({
        do_first: [
          createMockEisenhowerTask({ id: 'urgent-1', quadrant: 'do_first' }),
        ],
        schedule: [
          createMockEisenhowerTask({ id: 'sched-1', quadrant: 'schedule' }),
        ],
      });
      mockEisenhowerService.getMatrix.mockReturnValue(of(matrix));

      await component.loadMatrix();

      expect(component.matrix()).toEqual(matrix);
    });

    it('should handle error gracefully', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      await component.loadMatrix();

      expect(component.loading()).toBe(false);
    });
  });

  describe('getTasksByQuadrant()', () => {
    it('should return tasks for a given quadrant', async () => {
      const doFirstTasks = [
        createMockEisenhowerTask({ id: 'u1', quadrant: 'do_first' }),
        createMockEisenhowerTask({ id: 'u2', quadrant: 'do_first' }),
      ];
      const matrix = createMockMatrix({ do_first: doFirstTasks });
      mockEisenhowerService.getMatrix.mockReturnValue(of(matrix));

      await component.loadMatrix();

      const result = component.getTasksByQuadrant('do_first');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('u1');
    });

    it('should return empty array when matrix is null', () => {
      component.matrix.set(null);

      const result = component.getTasksByQuadrant('schedule');
      expect(result).toEqual([]);
    });

    it('should return empty array for quadrant with no tasks', async () => {
      mockEisenhowerService.getMatrix.mockReturnValue(of(createMockMatrix()));

      await component.loadMatrix();

      const result = component.getTasksByQuadrant('eliminate');
      expect(result).toEqual([]);
    });
  });

  describe('resetAllOverrides()', () => {
    it('should call confirmationService.confirm with correct config', () => {
      component.resetAllOverrides();

      expect(mockConfirmationService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Confirm Auto-Sort',
          icon: 'pi pi-refresh',
          acceptLabel: 'Reset',
          rejectLabel: 'Cancel',
        }),
      );
    });

    it('should call eisenhowerService.resetAllOverrides on accept', async () => {
      mockConfirmationService.confirm.mockImplementation((config: any) => {
        config.accept();
      });
      mockEisenhowerService.resetAllOverrides.mockReturnValue(
        of({ tasks_reset: 3 }),
      );
      mockEisenhowerService.getMatrix.mockReturnValue(of(createMockMatrix()));

      component.resetAllOverrides();

      // Give async operations time to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(mockEisenhowerService.resetAllOverrides).toHaveBeenCalled();
    });
  });

  describe('performQuadrantAction()', () => {
    it('should show archive confirmation for eliminate quadrant with tasks', async () => {
      const matrix = createMockMatrix({
        eliminate: [
          createMockEisenhowerTask({ id: 'e1' }),
          createMockEisenhowerTask({ id: 'e2' }),
        ],
      });
      component.matrix.set(matrix);

      await component.performQuadrantAction('eliminate');

      expect(mockConfirmationService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Confirm Archive',
          acceptLabel: 'Archive All',
        }),
      );
    });

    it('should not call confirm for eliminate quadrant with no tasks', async () => {
      component.matrix.set(createMockMatrix({ eliminate: [] }));

      await component.performQuadrantAction('eliminate');

      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });

    it('should delete tasks on eliminate accept', async () => {
      const matrix = createMockMatrix({
        eliminate: [createMockEisenhowerTask({ id: 'del-1' })],
      });
      component.matrix.set(matrix);

      mockConfirmationService.confirm.mockImplementation((config: any) => {
        config.accept();
      });
      mockTaskService.deleteTask.mockReturnValue(of(undefined));
      mockEisenhowerService.getMatrix.mockReturnValue(of(createMockMatrix()));

      await component.performQuadrantAction('eliminate');

      // Give async operations time to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith('del-1');
    });

    it('should show delegate dialog for delegate quadrant', async () => {
      await component.performQuadrantAction('delegate');

      expect(mockConfirmationService.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Delegate Tasks',
          rejectVisible: false,
        }),
      );
    });
  });

  describe('ngOnInit()', () => {
    it('should call loadMatrix', () => {
      const loadMatrixSpy = vi.spyOn(component, 'loadMatrix');

      component.ngOnInit();

      expect(loadMatrixSpy).toHaveBeenCalled();
    });
  });
});
