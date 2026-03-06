import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TaskListItemComponent } from './task-list-item.component';
import { MyTask } from '../../../core/services/my-tasks.service';

function createMockTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    priority: 'medium',
    due_date: null,
    column_id: 'col-1',
    column_name: 'To Do',
    column_status_mapping: null,
    project_id: 'board-1',
    project_name: 'Main Board',
    workspace_id: 'ws-1',
    workspace_name: 'Workspace',
    labels: [],
    assignees: [],
    created_at: '2026-02-18T10:00:00Z',
    updated_at: '2026-02-18T10:00:00Z',
    ...overrides,
  };
}

describe('TaskListItemComponent', () => {
  let component: TaskListItemComponent;
  let fixture: ComponentFixture<TaskListItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskListItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskListItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('task', createMockTask());
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('priorityColors', () => {
    it('should return correct colors for medium priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'medium' }),
      );
      const colors = component.priorityColors;
      expect(colors.bg).toBeDefined();
      expect(colors.text).toBeDefined();
    });

    it('should return correct colors for urgent priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'urgent' }),
      );
      const colors = component.priorityColors;
      expect(colors.bg).toContain('red');
    });

    it('should return correct colors for low priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'low' }),
      );
      const colors = component.priorityColors;
      expect(colors.bg).toContain('blue');
    });
  });

  describe('priorityLabel', () => {
    it('should return "Medium" for medium priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'medium' }),
      );
      expect(component.priorityLabel).toBe('Medium');
    });

    it('should return "Urgent" for urgent priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'urgent' }),
      );
      expect(component.priorityLabel).toBe('Urgent');
    });

    it('should return "High" for high priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'high' }),
      );
      expect(component.priorityLabel).toBe('High');
    });

    it('should return "Low" for low priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'low' }),
      );
      expect(component.priorityLabel).toBe('Low');
    });
  });

  describe('dueDateColorClass', () => {
    it('should return muted class for null due date', () => {
      fixture.componentRef.setInput('task', createMockTask({ due_date: null }));
      expect(component.dueDateColorClass).toContain('muted-foreground');
    });

    it('should return overdue class for past date', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      fixture.componentRef.setInput(
        'task',
        createMockTask({ due_date: past.toISOString() }),
      );
      const cls = component.dueDateColorClass;
      expect(cls).toContain('overdue');
    });
  });

  describe('getBorderColor', () => {
    it('should return red for urgent', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'urgent' }),
      );
      expect(component.getBorderColor()).toBe('#ef4444');
    });

    it('should return orange for high', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'high' }),
      );
      expect(component.getBorderColor()).toBe('#f97316');
    });

    it('should return yellow for medium', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'medium' }),
      );
      expect(component.getBorderColor()).toBe('#eab308');
    });

    it('should return blue for low', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'low' }),
      );
      expect(component.getBorderColor()).toBe('#3b82f6');
    });

    it('should return gray for unknown priority', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ priority: 'unknown' as any }),
      );
      expect(component.getBorderColor()).toBe('#9ca3af');
    });
  });

  describe('isDone', () => {
    it('should return false when column_status_mapping is null', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ column_status_mapping: null }),
      );
      expect(component.isDone()).toBe(false);
    });

    it('should return false when done is false', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ column_status_mapping: { done: false } as any }),
      );
      expect(component.isDone()).toBe(false);
    });

    it('should return true when done is true', () => {
      fixture.componentRef.setInput(
        'task',
        createMockTask({ column_status_mapping: { done: true } as any }),
      );
      expect(component.isDone()).toBe(true);
    });
  });

  describe('formatDueDate', () => {
    it('should return empty string for null', () => {
      expect(component.formatDueDate(null)).toBe('');
    });

    it('should return "Today" for today', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      expect(component.formatDueDate(today.toISOString())).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      expect(component.formatDueDate(tomorrow.toISOString())).toBe('Tomorrow');
    });

    it('should return "Overdue" for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      expect(component.formatDueDate(past.toISOString())).toBe('Overdue');
    });

    it('should return localized date for future dates beyond tomorrow', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const result = component.formatDueDate(future.toISOString());
      expect(result).not.toBe('');
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Tomorrow');
      expect(result).not.toBe('Overdue');
    });
  });
});
