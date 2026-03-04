import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TaskCardComponent } from './task-card.component';
import { Task } from '../../../core/services/task.service';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    column_id: 'col-1',
    title: 'Test Task',
    description: 'A test task',
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

@Component({
  standalone: true,
  imports: [TaskCardComponent],
  template: `<app-task-card
    [task]="task()"
    [isBlocked]="isBlocked"
    [isCelebrating]="isCelebrating"
    [isFocused]="isFocused"
    [subtaskProgress]="subtaskProgress"
    [hasRunningTimer]="hasRunningTimer"
    (taskClicked)="onTaskClicked($event)"
  />`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {
  task = signal(makeTask());
  isBlocked = false;
  isCelebrating = false;
  isFocused = false;
  subtaskProgress: { completed: number; total: number } | null = null;
  hasRunningTimer = false;
  onTaskClicked = vi.fn();
}

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: TaskCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.children[0].componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return priority label', () => {
    expect(component.priorityLabel).toBe('Medium');
  });

  it('should return priority colors', () => {
    expect(component.priorityColors).toBeTruthy();
  });

  it('should return border color for each priority', () => {
    host.task.set(makeTask({ priority: 'urgent' }));
    fixture.detectChanges();
    expect(component.getBorderColor()).toBe('#ef4444');

    host.task.set(makeTask({ priority: 'high' }));
    fixture.detectChanges();
    expect(component.getBorderColor()).toBe('#f97316');

    host.task.set(makeTask({ priority: 'medium' }));
    fixture.detectChanges();
    expect(component.getBorderColor()).toBe('#eab308');

    host.task.set(makeTask({ priority: 'low' }));
    fixture.detectChanges();
    expect(component.getBorderColor()).toBe('#3b82f6');
  });

  it('should return fallback border color for unknown priority', () => {
    host.task.set(makeTask({ priority: 'unknown' as any }));
    fixture.detectChanges();
    expect(component.getBorderColor()).toBe('#9ca3af');
  });

  it('should get priority flag color', () => {
    const color = component.getPriorityFlagColor();
    expect(typeof color).toBe('string');
  });

  it('should format due date as Today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    expect(component.formatDueDate('2026-03-15')).toBe('Today');
    vi.useRealTimers();
  });

  it('should format due date as Overdue for past dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    expect(component.formatDueDate('2026-03-10')).toBe('Overdue');
    vi.useRealTimers();
  });

  it('should format due date as Tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    expect(component.formatDueDate('2026-03-16')).toBe('Tomorrow');
    vi.useRealTimers();
  });

  it('should format due date as month/day for future dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
    const result = component.formatDueDate('2026-04-01');
    expect(result).toContain('Apr');
    vi.useRealTimers();
  });

  it('should get initials from name', () => {
    expect(component.getInitials('Alice Smith')).toBe('AS');
    expect(component.getInitials('Bob')).toBe('B');
    expect(component.getInitials('John Michael Doe')).toBe('JM');
  });

  it('should get avatar gradient for different indexes', () => {
    expect(component.getAvatarGradient(0)).toContain('gradient');
    expect(component.getAvatarGradient(1)).toContain('gradient');
    expect(component.getAvatarGradient(4)).toBe(component.getAvatarGradient(0)); // wraps
  });

  it('should compute due date colors', () => {
    host.task.set(makeTask({ due_date: '2026-03-01' }));
    fixture.detectChanges();
    expect(component.dueDateColors).toBeTruthy();
  });

  it('should emit taskClicked on card click', () => {
    const mockEvent = {
      target: { closest: vi.fn().mockReturnValue(null) },
    } as any;
    component.onCardClick(mockEvent);
    expect(host.onTaskClicked).toHaveBeenCalled();
  });

  it('should not emit taskClicked when dragging', () => {
    host.onTaskClicked.mockClear();
    const mockEvent = {
      target: {
        closest: vi.fn().mockReturnValue(document.createElement('div')),
      },
    } as any;
    component.onCardClick(mockEvent);
    expect(host.onTaskClicked).not.toHaveBeenCalled();
  });
});
