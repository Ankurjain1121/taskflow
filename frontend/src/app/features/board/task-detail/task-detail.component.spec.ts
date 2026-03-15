import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TaskDetailComponent } from './task-detail.component';
import { TaskService } from '../../../core/services/task.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { ProjectService } from '../../../core/services/board.service';
import { DependencyService } from '../../../core/services/dependency.service';
import { MilestoneService } from '../../../core/services/milestone.service';
import { CustomFieldService } from '../../../core/services/custom-field.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { TimeTrackingService } from '../../../core/services/time-tracking.service';
import { ConfirmationService, MessageService } from 'primeng/api';

describe('TaskDetailComponent', () => {
  let component: TaskDetailComponent;
  let fixture: ComponentFixture<TaskDetailComponent>;
  let mockTaskService: any;
  let mockWorkspaceService: any;
  let mockDependencyService: any;
  let mockMilestoneService: any;
  let mockCustomFieldService: any;
  let mockRecurringService: any;
  let mockTimeTrackingService: any;
  let mockConfirmationService: any;

  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    description: 'A description',
    priority: 'medium' as const,
    due_date: '2026-03-01',
    column_id: 'col-1',
    board_id: 'board-1',
    position: 0,
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    assignees: [{ id: 'u-1', display_name: 'Alice', avatar_url: null }],
    labels: [{ id: 'label-1', name: 'Bug', color: '#ff0000' }],
    milestone_id: 'ms-1',
  };

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

    mockTaskService = {
      getTask: vi.fn().mockReturnValue(of(mockTask)),
      updateTask: vi
        .fn()
        .mockReturnValue(of({ ...mockTask, title: 'Updated' })),
      deleteTask: vi.fn().mockReturnValue(of(void 0)),
      assignUser: vi.fn().mockReturnValue(of(void 0)),
      unassignUser: vi.fn().mockReturnValue(of(void 0)),
      removeLabel: vi.fn().mockReturnValue(of(void 0)),
      listFlat: vi.fn().mockReturnValue(
        of([
          { id: 'task-2', title: 'Other Task', column_name: 'Todo' },
          { id: 'task-3', title: 'Another Task', column_name: 'Done' },
        ]),
      ),
      listCalendarTasks: vi.fn().mockReturnValue(of([])),
    };

    mockWorkspaceService = {
      searchMembers: vi
        .fn()
        .mockReturnValue(of([{ id: 'u-2', name: 'Bob', avatar_url: null }])),
    };

    mockDependencyService = {
      listDependencies: vi.fn().mockReturnValue(
        of([
          {
            id: 'dep-1',
            source_task_id: 'task-1',
            target_task_id: 'task-2',
            dependency_type: 'blocks',
            related_task_id: 'task-2',
          },
          {
            id: 'dep-2',
            source_task_id: 'task-3',
            target_task_id: 'task-1',
            dependency_type: 'blocks',
            related_task_id: 'task-3',
          },
          {
            id: 'dep-3',
            source_task_id: 'task-1',
            target_task_id: 'task-4',
            dependency_type: 'related',
            related_task_id: 'task-4',
          },
        ]),
      ),
      createDependency: vi.fn().mockReturnValue(
        of({
          id: 'dep-new',
          source_task_id: 'task-1',
          target_task_id: 'task-5',
          dependency_type: 'blocks',
          related_task_id: 'task-5',
        }),
      ),
      deleteDependency: vi.fn().mockReturnValue(of(void 0)),
    };

    mockMilestoneService = {
      list: vi.fn().mockReturnValue(
        of([
          { id: 'ms-1', name: 'Milestone 1' },
          { id: 'ms-2', name: 'Milestone 2' },
        ]),
      ),
      assignTask: vi.fn().mockReturnValue(of(void 0)),
      unassignTask: vi.fn().mockReturnValue(of(void 0)),
    };

    mockCustomFieldService = {
      getTaskValues: vi.fn().mockReturnValue(
        of([
          {
            field_id: 'cf-1',
            value_text: 'hello',
            value_number: null,
            value_date: null,
            value_bool: null,
          },
        ]),
      ),
      setTaskValues: vi.fn().mockReturnValue(of(void 0)),
    };

    mockRecurringService = {
      getConfig: vi.fn().mockReturnValue(of(null)),
      createConfig: vi
        .fn()
        .mockReturnValue(of({ id: 'rec-1', pattern: 'daily' })),
      updateConfig: vi
        .fn()
        .mockReturnValue(of({ id: 'rec-1', pattern: 'weekly' })),
      deleteConfig: vi.fn().mockReturnValue(of(void 0)),
    };

    mockTimeTrackingService = {
      listEntries: vi.fn().mockReturnValue(of([])),
      startTimer: vi.fn().mockReturnValue(
        of({
          id: 'te-1',
          started_at: new Date().toISOString(),
          is_running: true,
        }),
      ),
      stopTimer: vi.fn().mockReturnValue(
        of({
          id: 'te-1',
          started_at: '2026-01-01T09:00:00Z',
          ended_at: '2026-01-01T10:00:00Z',
          is_running: false,
        }),
      ),
      createManualEntry: vi.fn().mockReturnValue(
        of({
          id: 'te-2',
          started_at: '2026-01-01T09:00:00Z',
          ended_at: '2026-01-01T10:00:00Z',
          is_running: false,
        }),
      ),
      deleteEntry: vi.fn().mockReturnValue(of(void 0)),
    };

    mockConfirmationService = {
      confirm: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TaskDetailComponent, HttpClientTestingModule],
      providers: [
        { provide: TaskService, useValue: mockTaskService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        {
          provide: ProjectService,
          useValue: { getBoard: vi.fn().mockReturnValue(of(null)) },
        },
        { provide: DependencyService, useValue: mockDependencyService },
        { provide: MilestoneService, useValue: mockMilestoneService },
        { provide: CustomFieldService, useValue: mockCustomFieldService },
        { provide: RecurringService, useValue: mockRecurringService },
        { provide: TimeTrackingService, useValue: mockTimeTrackingService },
        MessageService,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetailComponent);
    component = fixture.componentInstance;
    // Get the component-level ConfirmationService and replace its confirm method
    const injector = fixture.debugElement.injector;
    const confirmService = injector.get(ConfirmationService);
    mockConfirmationService = confirmService;
    vi.spyOn(confirmService, 'confirm');
    // Set required inputs
    fixture.componentRef.setInput('taskId', 'task-1');
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('boardId', 'board-1');
  });

  afterEach(() => {
    // Clean up timers
    component?.ngOnDestroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadTask (ngOnInit)', () => {
    it('should load task and related data on init', () => {
      component.ngOnInit();
      expect(mockTaskService.getTask).toHaveBeenCalledWith('task-1');
      expect(component.task()?.title).toBe('Test Task');
      expect(component.loading()).toBe(false);
    });

    it('should load dependencies after task', () => {
      component.ngOnInit();
      expect(mockDependencyService.listDependencies).toHaveBeenCalledWith(
        'task-1',
      );
      expect(component.dependencies().length).toBe(3);
    });

    it('should load milestones after task', () => {
      component.ngOnInit();
      expect(mockMilestoneService.list).toHaveBeenCalledWith('board-1');
      expect(component.milestones().length).toBe(2);
    });

    it('should set selectedMilestone when task has milestone_id', () => {
      component.ngOnInit();
      expect(component.selectedMilestone()?.id).toBe('ms-1');
    });

    it('should set selectedMilestone to null when task has no milestone_id', () => {
      mockTaskService.getTask.mockReturnValue(
        of({ ...mockTask, milestone_id: null }),
      );
      component.ngOnInit();
      expect(component.selectedMilestone()).toBeNull();
    });

    it('should load custom fields after task', () => {
      component.ngOnInit();
      expect(mockCustomFieldService.getTaskValues).toHaveBeenCalledWith(
        'task-1',
      );
      expect(component.customFields().length).toBe(1);
    });

    it('should load recurring config after task', () => {
      component.ngOnInit();
      expect(mockRecurringService.getConfig).toHaveBeenCalledWith('task-1');
    });

    it('should load time entries after task', () => {
      component.ngOnInit();
      expect(mockTimeTrackingService.listEntries).toHaveBeenCalledWith(
        'task-1',
      );
    });

    it('should handle task load error gracefully', () => {
      mockTaskService.getTask.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      expect(component.loading()).toBe(false);
      expect(component.task()).toBeNull();
    });

    it('should set recurring config to null on error', () => {
      mockRecurringService.getConfig.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      expect(component.recurringConfig()).toBeNull();
    });
  });

  describe('ngOnChanges', () => {
    it('should reload task when taskId changes (not first change)', () => {
      component.ngOnInit();
      vi.clearAllMocks();

      component.ngOnChanges({
        taskId: {
          currentValue: 'task-2',
          previousValue: 'task-1',
          firstChange: false,
          isFirstChange: () => false,
        },
      } as any);

      expect(mockTaskService.getTask).toHaveBeenCalled();
    });

    it('should not reload on first change', () => {
      component.ngOnChanges({
        taskId: {
          currentValue: 'task-1',
          previousValue: undefined,
          firstChange: true,
          isFirstChange: () => true,
        },
      } as any);

      expect(mockTaskService.getTask).not.toHaveBeenCalled();
    });
  });

  describe('onClose', () => {
    it('should emit closed event', () => {
      const closedSpy = vi.spyOn(component.closed, 'emit');
      component.onClose();
      expect(closedSpy).toHaveBeenCalled();
    });
  });

  describe('onTitleSave', () => {
    it('should update task with new title', () => {
      component.ngOnInit();
      component.onTitleSave('New Title');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        title: 'New Title',
      });
    });
  });

  describe('onDescriptionSave', () => {
    it('should update task with new description', () => {
      component.ngOnInit();
      component.onDescriptionSave('New desc');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        description: 'New desc',
      });
    });

    it('should set description to null when empty', () => {
      component.ngOnInit();
      component.onDescriptionSave('');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        description: null,
      });
    });
  });

  describe('onPriorityChange', () => {
    it('should update task with new priority', () => {
      component.ngOnInit();
      component.onPriorityChange('high' as any);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        priority: 'high',
      });
    });
  });

  describe('onDueDateChange', () => {
    it('should update task with new due date', () => {
      component.ngOnInit();
      component.onDueDateChange('2026-06-01');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        due_date: '2026-06-01',
      });
    });

    it('should set due_date to null when empty', () => {
      component.ngOnInit();
      component.onDueDateChange('');
      expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-1', {
        due_date: null,
      });
    });
  });

  describe('onAssigneeSearchChange', () => {
    it('should clear results when query is too short', () => {
      component.onAssigneeSearchChange('a');
      expect(component.memberSearchResults()).toEqual([]);
      expect(mockWorkspaceService.searchMembers).not.toHaveBeenCalled();
    });

    it('should clear results when query is empty', () => {
      component.onAssigneeSearchChange('');
      expect(component.memberSearchResults()).toEqual([]);
    });

    it('should search members when query is long enough', () => {
      component.onAssigneeSearchChange('bo');
      expect(mockWorkspaceService.searchMembers).toHaveBeenCalledWith(
        'ws-1',
        'bo',
      );
      expect(component.memberSearchResults().length).toBe(1);
    });

    it('should clear results on search error', () => {
      mockWorkspaceService.searchMembers.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.onAssigneeSearchChange('bo');
      expect(component.memberSearchResults()).toEqual([]);
    });
  });

  describe('onAssign', () => {
    it('should assign user and update task assignees', () => {
      component.ngOnInit();
      const member = { id: 'u-2', name: 'Bob', avatar_url: null };
      const emitSpy = vi.spyOn(component.taskUpdated, 'emit');

      component.onAssign(member as any);

      expect(mockTaskService.assignUser).toHaveBeenCalledWith('task-1', 'u-2');
      expect(component.task()?.assignees?.length).toBe(2);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should not assign if task is null', () => {
      component.task.set(null);
      component.onAssign({ id: 'u-2', name: 'Bob', avatar_url: null } as any);
      expect(mockTaskService.assignUser).not.toHaveBeenCalled();
    });
  });

  describe('onUnassign', () => {
    it('should unassign user and update task', () => {
      component.ngOnInit();
      const assignee = { id: 'u-1', display_name: 'Alice', avatar_url: null };
      const emitSpy = vi.spyOn(component.taskUpdated, 'emit');

      component.onUnassign(assignee as any);

      expect(mockTaskService.unassignUser).toHaveBeenCalledWith(
        'task-1',
        'u-1',
      );
      expect(component.task()?.assignees?.length).toBe(0);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should not unassign if task is null', () => {
      component.task.set(null);
      component.onUnassign({
        id: 'u-1',
        display_name: 'Alice',
        avatar_url: null,
      } as any);
      expect(mockTaskService.unassignUser).not.toHaveBeenCalled();
    });
  });

  describe('onRemoveLabel', () => {
    it('should remove label from task', () => {
      component.ngOnInit();
      const emitSpy = vi.spyOn(component.taskUpdated, 'emit');

      component.onRemoveLabel('label-1');

      expect(mockTaskService.removeLabel).toHaveBeenCalledWith(
        'task-1',
        'label-1',
      );
      expect(component.task()?.labels?.length).toBe(0);
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should not remove label if task is null', () => {
      component.task.set(null);
      component.onRemoveLabel('label-1');
      expect(mockTaskService.removeLabel).not.toHaveBeenCalled();
    });
  });

  describe('onMilestoneChange', () => {
    it('should assign milestone when milestoneId is provided', () => {
      component.ngOnInit();
      const emitSpy = vi.spyOn(component.taskUpdated, 'emit');

      component.onMilestoneChange('ms-2');

      expect(mockMilestoneService.assignTask).toHaveBeenCalledWith(
        'task-1',
        'ms-2',
      );
      expect(component.task()?.milestone_id).toBe('ms-2');
      expect(component.selectedMilestone()?.id).toBe('ms-2');
      expect(emitSpy).toHaveBeenCalled();
    });

    it('should clear milestone when milestoneId is empty', () => {
      component.ngOnInit();
      component.onMilestoneChange('');

      expect(mockMilestoneService.unassignTask).toHaveBeenCalledWith('task-1');
      expect(component.task()?.milestone_id).toBeNull();
      expect(component.selectedMilestone()).toBeNull();
    });

    it('should not change milestone if task is null', () => {
      component.task.set(null);
      component.onMilestoneChange('ms-2');
      expect(mockMilestoneService.assignTask).not.toHaveBeenCalled();
    });
  });

  describe('onDelete', () => {
    it('should open confirmation dialog', () => {
      component.ngOnInit();
      component.onDelete();
      expect(mockConfirmationService.confirm).toHaveBeenCalled();
    });

    it('should delete task when accepted', () => {
      component.ngOnInit();
      const closedSpy = vi.spyOn(component.closed, 'emit');
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onDelete();

      expect(mockTaskService.deleteTask).toHaveBeenCalledWith('task-1');
      expect(closedSpy).toHaveBeenCalled();
    });

    it('should not delete if task is null', () => {
      component.task.set(null);
      component.onDelete();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });
  });

  describe('dependency handlers', () => {
    it('should categorize dependencies into blocking, blockedBy, and related', () => {
      component.ngOnInit();
      expect(component.blockingDeps().length).toBe(1);
      expect(component.blockedByDeps().length).toBe(1);
      expect(component.relatedDeps().length).toBe(1);
    });

    it('should search dependencies by filtering board tasks', () => {
      component.ngOnInit();
      component.onDepSearchChange('Other');
      // Should lazy-load board tasks first, then filter
      expect(mockTaskService.listFlat).toHaveBeenCalledWith('board-1');
    });

    it('should clear dep search results for short query', () => {
      component.onDepSearchChange('a');
      expect(component.depSearchResults()).toEqual([]);
    });

    it('should add dependency', () => {
      component.ngOnInit();
      component.onAddDependency({
        targetTaskId: 'task-5',
        depType: 'blocks' as any,
      });
      expect(mockDependencyService.createDependency).toHaveBeenCalledWith(
        'task-1',
        'task-5',
        'blocks',
      );
      expect(component.dependencies().length).toBe(4);
    });

    it('should remove dependency', () => {
      component.ngOnInit();
      component.onRemoveDependency('dep-1');
      expect(mockDependencyService.deleteDependency).toHaveBeenCalledWith(
        'dep-1',
      );
      expect(component.dependencies().length).toBe(2);
    });
  });

  describe('custom field handlers', () => {
    it('should update custom field value', () => {
      component.ngOnInit();
      component.onCustomFieldChanged({
        fieldId: 'cf-1',
        field: 'value_text',
        value: 'updated',
      });
      expect(component.customFields()[0].value_text).toBe('updated');
    });

    it('should debounce saveCustomFields', fakeAsync(() => {
      component.ngOnInit();
      component.saveCustomFields();
      expect(mockCustomFieldService.setTaskValues).not.toHaveBeenCalled();
      tick(500);
      expect(mockCustomFieldService.setTaskValues).toHaveBeenCalledWith(
        'task-1',
        expect.any(Array),
      );
    }));

    it('should not save if custom fields are empty', fakeAsync(() => {
      component.customFields.set([]);
      component.saveCustomFields();
      tick(500);
      expect(mockCustomFieldService.setTaskValues).not.toHaveBeenCalled();
    }));
  });

  describe('recurring handlers', () => {
    it('should create recurring config when none exists', () => {
      component.ngOnInit();
      component.onSaveRecurring({
        pattern: 'daily' as any,
        intervalDays: null,
        maxOccurrences: null,
      });
      expect(mockRecurringService.createConfig).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ pattern: 'daily' }),
      );
    });

    it('should update recurring config when one exists', () => {
      component.ngOnInit();
      component.recurringConfig.set({ id: 'rec-1', pattern: 'daily' } as any);
      component.onSaveRecurring({
        pattern: 'weekly' as any,
        intervalDays: null,
        maxOccurrences: null,
      });
      expect(mockRecurringService.updateConfig).toHaveBeenCalledWith(
        'rec-1',
        expect.objectContaining({ pattern: 'weekly' }),
      );
    });

    it('should include interval_days for custom pattern', () => {
      component.ngOnInit();
      component.onSaveRecurring({
        pattern: 'custom' as any,
        intervalDays: 5,
        maxOccurrences: 10,
      });
      expect(mockRecurringService.createConfig).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          pattern: 'custom',
          interval_days: 5,
          max_occurrences: 10,
        }),
      );
    });

    it('should open confirmation dialog for remove recurring', () => {
      component.recurringConfig.set({ id: 'rec-1' } as any);
      component.onRemoveRecurring();
      expect(mockConfirmationService.confirm).toHaveBeenCalled();
    });

    it('should delete recurring config when confirmed', () => {
      component.recurringConfig.set({ id: 'rec-1' } as any);
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );
      component.onRemoveRecurring();
      expect(mockRecurringService.deleteConfig).toHaveBeenCalledWith('rec-1');
      expect(component.recurringConfig()).toBeNull();
    });

    it('should not remove recurring if config is null', () => {
      component.recurringConfig.set(null);
      component.onRemoveRecurring();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });
  });

  describe('time tracking handlers', () => {
    it('should start timer', () => {
      component.ngOnInit();
      component.onStartTimer();
      expect(mockTimeTrackingService.startTimer).toHaveBeenCalledWith('task-1');
      expect(component.runningTimerForTask()).toBeTruthy();
      expect(component.timeEntries().length).toBe(1);
    });

    it('should stop timer', () => {
      component.ngOnInit();
      component.runningTimerForTask.set({
        id: 'te-1',
        started_at: '2026-01-01T09:00:00Z',
        is_running: true,
      } as any);
      component.timeEntries.set([
        {
          id: 'te-1',
          started_at: '2026-01-01T09:00:00Z',
          is_running: true,
        } as any,
      ]);

      component.onStopTimer();

      expect(mockTimeTrackingService.stopTimer).toHaveBeenCalledWith('te-1');
      expect(component.runningTimerForTask()).toBeNull();
    });

    it('should not stop timer if no running timer', () => {
      component.runningTimerForTask.set(null);
      component.onStopTimer();
      expect(mockTimeTrackingService.stopTimer).not.toHaveBeenCalled();
    });

    it('should submit manual time log', () => {
      component.ngOnInit();
      component.onSubmitLogTime({
        hours: 1,
        minutes: 30,
        description: 'Work',
        date: '2026-01-01',
      });
      expect(mockTimeTrackingService.createManualEntry).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ duration_minutes: 90 }),
      );
      expect(component.timeEntries().length).toBe(1);
    });

    it('should not submit time log with zero duration', () => {
      component.onSubmitLogTime({
        hours: 0,
        minutes: 0,
        description: '',
        date: '2026-01-01',
      });
      expect(mockTimeTrackingService.createManualEntry).not.toHaveBeenCalled();
    });

    it('should delete time entry', () => {
      component.timeEntries.set([{ id: 'te-1' } as any, { id: 'te-2' } as any]);
      component.onDeleteTimeEntry('te-1');
      expect(mockTimeTrackingService.deleteEntry).toHaveBeenCalledWith('te-1');
      expect(component.timeEntries().length).toBe(1);
    });

    it('should clear running timer when deleting the running entry', () => {
      component.runningTimerForTask.set({ id: 'te-1' } as any);
      component.timeEntries.set([{ id: 'te-1' } as any]);
      component.onDeleteTimeEntry('te-1');
      expect(component.runningTimerForTask()).toBeNull();
    });

    it('should start elapsed timer when time entries contain a running entry', () => {
      const runningEntry = {
        id: 'te-1',
        started_at: new Date().toISOString(),
        is_running: true,
      };
      mockTimeTrackingService.listEntries.mockReturnValue(of([runningEntry]));
      component.ngOnInit();
      expect(component.runningTimerForTask()?.id).toBe('te-1');
    });
  });

  describe('ngOnDestroy', () => {
    it('should clean up timer interval', fakeAsync(() => {
      component.ngOnInit();
      component.onStartTimer();
      tick(2000);
      component.ngOnDestroy();
      // Should not throw
      expect(component.elapsedTime()).toBe('00:00:00');
    }));
  });
});
