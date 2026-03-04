import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  CdkDragDrop,
  CdkDropList,
  DragDropModule,
} from '@angular/cdk/drag-drop';

import {
  KanbanColumnComponent,
  TaskMoveEvent,
} from './kanban-column.component';
import { Column } from '../../../core/services/board.service';
import { Task } from '../../../core/services/task.service';

// --- Helpers ---

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    column_id: 'col-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    position: 'a0',
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

/**
 * Test host component to set required inputs on KanbanColumnComponent,
 * since input.required() needs to be set from a parent template.
 */
@Component({
  standalone: true,
  imports: [KanbanColumnComponent],
  template: `
    <app-kanban-column
      [column]="column()"
      [tasks]="tasks()"
      [connectedLists]="connectedLists()"
      [celebratingTaskId]="celebratingTaskId()"
      [focusedTaskId]="focusedTaskId()"
      (taskMoved)="onTaskMoved($event)"
      (taskClicked)="onTaskClicked($event)"
      (addTaskClicked)="onAddTaskClicked($event)"
    />
  `,
})
class TestHostComponent {
  column = signal<Column>(makeColumn());
  tasks = signal<Task[]>([]);
  connectedLists = signal<string[]>([]);
  celebratingTaskId = signal<string | null>(null);
  focusedTaskId = signal<string | null>(null);

  taskMovedEvents: TaskMoveEvent[] = [];
  taskClickedEvents: Task[] = [];
  addTaskClickedEvents: string[] = [];

  onTaskMoved(event: TaskMoveEvent) {
    this.taskMovedEvents.push(event);
  }
  onTaskClicked(task: Task) {
    this.taskClickedEvents.push(task);
  }
  onAddTaskClicked(columnId: string) {
    this.addTaskClickedEvents.push(columnId);
  }
}

describe('KanbanColumnComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, DragDropModule, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  // --- Creation ---

  it('should create', () => {
    const kanbanEl = fixture.debugElement.query(
      By.directive(KanbanColumnComponent),
    );
    expect(kanbanEl).toBeTruthy();
    expect(kanbanEl.componentInstance).toBeInstanceOf(KanbanColumnComponent);
  });

  // --- Column Header Rendering ---

  describe('column header', () => {
    it('should display column name', () => {
      const headerText = fixture.nativeElement.textContent;
      expect(headerText).toContain('To Do');
    });

    it('should display task count', () => {
      host.tasks.set([makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })]);
      fixture.detectChanges();

      const headerText = fixture.nativeElement.textContent;
      expect(headerText).toContain('2');
    });

    it('should display 0 task count when empty', () => {
      host.tasks.set([]);
      fixture.detectChanges();

      // The count badge has text-xs and bg-gray-200 classes (not the color dot)
      const countBadge = fixture.debugElement.query(
        By.css('.text-xs.rounded-full'),
      );
      expect(countBadge.nativeElement.textContent.trim()).toBe('0');
    });
  });

  // --- Done Column Indicator ---

  describe('done column indicator', () => {
    it('should show checkmark for done columns', () => {
      host.column.set(makeColumn({ status_mapping: { done: true } }));
      fixture.detectChanges();

      const checkmark = fixture.debugElement.query(
        By.css('.text-\\[var\\(--success\\)\\]'),
      );
      expect(checkmark).toBeTruthy();
    });

    it('should NOT show checkmark for non-done columns', () => {
      host.column.set(makeColumn({ status_mapping: null }));
      fixture.detectChanges();

      const checkmark = fixture.debugElement.query(
        By.css('.text-\\[var\\(--success\\)\\]'),
      );
      expect(checkmark).toBeFalsy();
    });
  });

  // --- WIP Limit ---

  describe('WIP limit', () => {
    it('should show warning when tasks exceed WIP limit', () => {
      host.column.set(makeColumn({ wip_limit: 2 }));
      host.tasks.set([
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
        makeTask({ id: 't3' }),
      ]);
      fixture.detectChanges();

      const warning = fixture.debugElement.query(
        By.css('.text-\\[var\\(--status-amber-text\\)\\]'),
      );
      expect(warning).toBeTruthy();
      expect(warning.nativeElement.textContent).toContain('WIP limit');
      expect(warning.nativeElement.textContent).toContain('2');
    });

    it('should NOT show warning when tasks are at or below WIP limit', () => {
      host.column.set(makeColumn({ wip_limit: 3 }));
      host.tasks.set([makeTask({ id: 't1' }), makeTask({ id: 't2' })]);
      fixture.detectChanges();

      const warning = fixture.debugElement.query(By.css('.text-amber-600'));
      expect(warning).toBeFalsy();
    });

    it('should NOT show warning when no WIP limit is set', () => {
      host.column.set(makeColumn({ wip_limit: null }));
      host.tasks.set([
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
        makeTask({ id: 't3' }),
      ]);
      fixture.detectChanges();

      const warning = fixture.debugElement.query(By.css('.text-amber-600'));
      expect(warning).toBeFalsy();
    });
  });

  // --- Empty State ---

  describe('empty state', () => {
    it('should show "Drop tasks here" when no tasks', () => {
      host.tasks.set([]);
      fixture.detectChanges();

      const emptyText = fixture.nativeElement.textContent;
      expect(emptyText).toContain('Drag tasks here');
    });

    it('should NOT show empty state when tasks exist', () => {
      host.tasks.set([makeTask()]);
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(By.css('.border-dashed'));
      expect(emptyState).toBeFalsy();
    });
  });

  // --- Computed: isDoneColumn ---

  describe('isDoneColumn computed', () => {
    it('should return true when status_mapping.done is true', () => {
      host.column.set(makeColumn({ status_mapping: { done: true } }));
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      expect(kanbanComponent.isDoneColumn()).toBe(true);
    });

    it('should return false when status_mapping is null', () => {
      host.column.set(makeColumn({ status_mapping: null }));
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      expect(kanbanComponent.isDoneColumn()).toBe(false);
    });
  });

  // --- Computed: isOverWipLimit ---

  describe('isOverWipLimit computed', () => {
    it('should return true when task count exceeds wip_limit', () => {
      host.column.set(makeColumn({ wip_limit: 1 }));
      host.tasks.set([makeTask({ id: 't1' }), makeTask({ id: 't2' })]);
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      expect(kanbanComponent.isOverWipLimit()).toBe(true);
    });

    it('should return false when task count equals wip_limit', () => {
      host.column.set(makeColumn({ wip_limit: 2 }));
      host.tasks.set([makeTask({ id: 't1' }), makeTask({ id: 't2' })]);
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      expect(kanbanComponent.isOverWipLimit()).toBe(false);
    });

    it('should return false when no wip_limit is set', () => {
      host.column.set(makeColumn({ wip_limit: null }));
      host.tasks.set([
        makeTask({ id: 't1' }),
        makeTask({ id: 't2' }),
        makeTask({ id: 't3' }),
      ]);
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      expect(kanbanComponent.isOverWipLimit()).toBe(false);
    });
  });

  // --- Add Task Button ---

  describe('add task button', () => {
    it('should emit addTaskClicked with column ID when clicked', () => {
      host.column.set(makeColumn({ id: 'col-99' }));
      fixture.detectChanges();

      const addButton = fixture.debugElement.query(By.css('button'));
      // Find the "Add task" button (the one in the footer)
      const buttons = fixture.debugElement.queryAll(By.css('button'));
      const addTaskBtn = buttons.find((btn) =>
        btn.nativeElement.textContent.includes('Add task'),
      );
      expect(addTaskBtn).toBeTruthy();

      addTaskBtn!.nativeElement.click();
      fixture.detectChanges();

      expect(host.addTaskClickedEvents).toEqual(['col-99']);
    });
  });

  // --- onDrop ---

  describe('onDrop', () => {
    it('should emit taskMoved event with correct data for cross-column move', () => {
      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      const task = makeTask({ id: 'task-1', column_id: 'col-1' });
      const sourceData = [task];
      const targetData: Task[] = [];

      const mockDrop = {
        item: { data: task },
        previousContainer: {
          id: 'column-col-1',
          data: sourceData,
        },
        container: {
          id: 'column-col-2',
          data: targetData,
        },
        previousIndex: 0,
        currentIndex: 0,
      } as unknown as CdkDragDrop<Task[]>;

      kanbanComponent.onDrop(mockDrop);

      expect(host.taskMovedEvents).toHaveLength(1);
      expect(host.taskMovedEvents[0]).toEqual({
        task,
        targetColumnId: 'col-2',
        previousIndex: 0,
        currentIndex: 0,
        previousColumnId: 'col-1',
      });
    });

    it('should emit taskMoved event for same-column reorder', () => {
      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      const task = makeTask({ id: 'task-1', column_id: 'col-1' });
      const containerData = [
        task,
        makeTask({ id: 'task-2', column_id: 'col-1' }),
      ];

      const sameContainer = {
        id: 'column-col-1',
        data: containerData,
      };

      const mockDrop = {
        item: { data: task },
        previousContainer: sameContainer,
        container: sameContainer,
        previousIndex: 0,
        currentIndex: 1,
      } as unknown as CdkDragDrop<Task[]>;

      kanbanComponent.onDrop(mockDrop);

      expect(host.taskMovedEvents).toHaveLength(1);
      expect(host.taskMovedEvents[0].previousColumnId).toBe('col-1');
      expect(host.taskMovedEvents[0].targetColumnId).toBe('col-1');
      expect(host.taskMovedEvents[0].previousIndex).toBe(0);
      expect(host.taskMovedEvents[0].currentIndex).toBe(1);
    });
  });

  // --- onTaskClicked ---

  describe('onTaskClicked', () => {
    it('should emit the clicked task', () => {
      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      const task = makeTask({ id: 'task-5' });
      kanbanComponent.onTaskClicked(task);

      expect(host.taskClickedEvents).toHaveLength(1);
      expect(host.taskClickedEvents[0].id).toBe('task-5');
    });
  });

  // --- onAddTask ---

  describe('onAddTask', () => {
    it('should emit column id', () => {
      host.column.set(makeColumn({ id: 'col-42' }));
      fixture.detectChanges();

      const kanbanComponent = fixture.debugElement.query(
        By.directive(KanbanColumnComponent),
      ).componentInstance as KanbanColumnComponent;

      kanbanComponent.onAddTask();

      expect(host.addTaskClickedEvents).toEqual(['col-42']);
    });
  });

  // --- Rendering tasks ---

  describe('task rendering', () => {
    it('should render task cards for each task', () => {
      host.tasks.set([
        makeTask({ id: 't1', title: 'First' }),
        makeTask({ id: 't2', title: 'Second' }),
        makeTask({ id: 't3', title: 'Third' }),
      ]);
      fixture.detectChanges();

      const taskCards = fixture.debugElement.queryAll(By.css('app-task-card'));
      expect(taskCards).toHaveLength(3);
    });

    // Note: data-task-id attributes were removed from the template;
    // tasks are rendered directly as <app-task-card> components
  });
});
