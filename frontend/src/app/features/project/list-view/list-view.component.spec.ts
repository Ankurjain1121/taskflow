import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ListViewComponent } from './list-view.component';
import { TaskListItem } from '../../../core/services/task.service';
import { TaskGroupWithStats } from '../../../core/services/task-group.service';

function makeTask(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: 'task-1',
    title: 'Test',
    description: null,
    priority: 'medium' as TaskListItem['priority'],
    due_date: null,
    status_id: null,
    status_name: null,
    status_color: null,
    status_type: null,
    task_list_id: null,
    task_list_name: null,
    position: '1000',
    created_by_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    total_logged_minutes: 0,
    ...overrides,
  };
}

function makeGroup(
  id: string,
  name: string,
  position: string,
  overrides: Partial<TaskGroupWithStats> = {},
): TaskGroupWithStats {
  return {
    group: {
      id,
      name,
      color: '#3b82f6',
      position,
      collapsed: false,
      tenant_id: 't1',
      created_by_id: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
    },
    task_count: 5,
    completed_count: 2,
    estimated_hours: null,
    ...overrides,
  };
}

describe('ListViewComponent', () => {
  let component: ListViewComponent;
  let fixture: ComponentFixture<ListViewComponent>;

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

    await TestBed.configureTestingModule({
      imports: [ListViewComponent],
      providers: [provideRouter([])],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ListViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getPriorityHexColor', () => {
    it('should return a color string for known priorities', () => {
      const color = component.getPriorityHexColor('urgent');
      expect(color).toBeTruthy();
      expect(typeof color).toBe('string');
    });

    it('should return a color for medium priority', () => {
      expect(component.getPriorityHexColor('medium')).toBeTruthy();
    });
  });

  describe('getPriorityLabelText', () => {
    it('should return human-readable label', () => {
      const label = component.getPriorityLabelText('urgent');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it('should return label for low priority', () => {
      expect(component.getPriorityLabelText('low')).toBeTruthy();
    });
  });

  describe('getDueDateColorClass', () => {
    it('should return CSS class strings for a date', () => {
      const cls = component.getDueDateColorClass('2026-01-01');
      expect(typeof cls).toBe('string');
    });

    it('should handle null due date', () => {
      const cls = component.getDueDateColorClass(null);
      expect(typeof cls).toBe('string');
    });
  });

  describe('onRowClick', () => {
    it('should emit taskClicked with task id', () => {
      const emitSpy = vi.spyOn(component.taskClicked, 'emit');
      const task = { id: 'task-1', title: 'Test' } as TaskListItem;
      component.onRowClick(task);
      expect(emitSpy).toHaveBeenCalledWith('task-1');
    });
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

    it('should return "Overdue (Xd)" for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const dateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
      const result = component.formatDueDate(dateStr);
      expect(result).toMatch(/Overdue/);
    });

    it('should return formatted date for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const dateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      const result = component.formatDueDate(dateStr);
      expect(result).not.toBe('Today');
      expect(result).not.toBe('Tomorrow');
      expect(result).not.toMatch(/Overdue/);
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = component.formatDate('2026-03-15');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  // === New tests for row grouping refactor ===

  describe('sortedTasks', () => {
    it('should sort tasks by group position, then by task position', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');
      const groupB = makeGroup('g-b', 'Beta', '2000');

      fixture.componentRef.setInput('groups', [groupA, groupB]);
      fixture.componentRef.setInput('tasks', [
        makeTask({ id: 't3', task_list_id: 'g-b', position: '2000' }),
        makeTask({ id: 't1', task_list_id: 'g-a', position: '1000' }),
        makeTask({ id: 't2', task_list_id: 'g-a', position: '2000' }),
        makeTask({ id: 't4', task_list_id: 'g-b', position: '1000' }),
      ]);

      const ids = component.sortedTasks().map((t) => t.id);
      expect(ids).toEqual(['t1', 't2', 't4', 't3']);
    });

    it('should place null task_list_id tasks last', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');

      fixture.componentRef.setInput('groups', [groupA]);
      fixture.componentRef.setInput('tasks', [
        makeTask({ id: 't2', task_list_id: null, position: '1000' }),
        makeTask({ id: 't1', task_list_id: 'g-a', position: '1000' }),
      ]);

      const ids = component.sortedTasks().map((t) => t.id);
      expect(ids).toEqual(['t1', 't2']);
    });
  });

  describe('displayTasks', () => {
    it('should return all tasks when no groups are collapsed', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');
      const groupB = makeGroup('g-b', 'Beta', '2000');

      fixture.componentRef.setInput('groups', [groupA, groupB]);
      fixture.componentRef.setInput('tasks', [
        makeTask({ id: 't1', task_list_id: 'g-a', position: '1000' }),
        makeTask({ id: 't2', task_list_id: 'g-a', position: '2000' }),
        makeTask({ id: 't3', task_list_id: 'g-b', position: '1000' }),
      ]);

      expect(component.displayTasks().length).toBe(3);
    });

    it('should keep one sentinel task for collapsed groups', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');
      const groupB = makeGroup('g-b', 'Beta', '2000', {
        group: {
          id: 'g-b',
          name: 'Beta',
          color: '#f00',
          position: '2000',
          collapsed: true,
          tenant_id: 't1',
          created_by_id: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      });

      fixture.componentRef.setInput('groups', [groupA, groupB]);
      fixture.componentRef.setInput('tasks', [
        makeTask({ id: 't1', task_list_id: 'g-a', position: '1000' }),
        makeTask({ id: 't2', task_list_id: 'g-b', position: '1000' }),
        makeTask({ id: 't3', task_list_id: 'g-b', position: '2000' }),
        makeTask({ id: 't4', task_list_id: 'g-b', position: '3000' }),
      ]);

      const display = component.displayTasks();
      // 1 from group A + 1 sentinel from collapsed group B = 2
      expect(display.length).toBe(2);
      expect(display[0].id).toBe('t1');
      // Sentinel is the first task from group B
      expect(display[1].task_list_id).toBe('g-b');
    });

    it('should never filter out null task_list_id tasks', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000', {
        group: {
          id: 'g-a',
          name: 'Alpha',
          color: '#f00',
          position: '1000',
          collapsed: true,
          tenant_id: 't1',
          created_by_id: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      });

      fixture.componentRef.setInput('groups', [groupA]);
      fixture.componentRef.setInput('tasks', [
        makeTask({ id: 't1', task_list_id: 'g-a', position: '1000' }),
        makeTask({ id: 't2', task_list_id: null, position: '1000' }),
        makeTask({ id: 't3', task_list_id: null, position: '2000' }),
      ]);

      const display = component.displayTasks();
      const nullTasks = display.filter((t) => t.task_list_id === null);
      expect(nullTasks.length).toBe(2);
    });
  });

  describe('customSortFn', () => {
    it('should preserve group ordering when sorting by a column', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');
      const groupB = makeGroup('g-b', 'Beta', '2000');

      fixture.componentRef.setInput('groups', [groupA, groupB]);
      fixture.componentRef.setInput('tasks', []);
      fixture.detectChanges();

      const data = [
        makeTask({
          id: 't1',
          task_list_id: 'g-a',
          priority: 'low' as TaskListItem['priority'],
        }),
        makeTask({
          id: 't2',
          task_list_id: 'g-a',
          priority: 'urgent' as TaskListItem['priority'],
        }),
        makeTask({
          id: 't3',
          task_list_id: 'g-b',
          priority: 'high' as TaskListItem['priority'],
        }),
        makeTask({
          id: 't4',
          task_list_id: 'g-b',
          priority: 'low' as TaskListItem['priority'],
        }),
      ];

      component.customSortFn({ data, field: 'priority', order: 1 });

      // Group A tasks should come before group B tasks
      expect(data[0].task_list_id).toBe('g-a');
      expect(data[1].task_list_id).toBe('g-a');
      expect(data[2].task_list_id).toBe('g-b');
      expect(data[3].task_list_id).toBe('g-b');
    });

    it('should sort within groups by the selected column', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');

      fixture.componentRef.setInput('groups', [groupA]);
      fixture.componentRef.setInput('tasks', []);
      fixture.detectChanges();

      const data = [
        makeTask({ id: 't1', task_list_id: 'g-a', title: 'Zebra' }),
        makeTask({ id: 't2', task_list_id: 'g-a', title: 'Apple' }),
        makeTask({ id: 't3', task_list_id: 'g-a', title: 'Mango' }),
      ];

      component.customSortFn({ data, field: 'title', order: 1 });

      expect(data.map((t) => t.title)).toEqual(['Apple', 'Mango', 'Zebra']);
    });
  });

  describe('getGroupData', () => {
    it('should return the correct group for a valid ID', () => {
      const groupA = makeGroup('g-a', 'Alpha', '1000');
      const groupB = makeGroup('g-b', 'Beta', '2000');

      fixture.componentRef.setInput('groups', [groupA, groupB]);
      fixture.detectChanges();

      const result = component.getGroupData('g-a');
      expect(result).toBeDefined();
      expect(result!.group.name).toBe('Alpha');
    });

    it('should return undefined for unknown ID', () => {
      fixture.componentRef.setInput('groups', []);
      fixture.detectChanges();

      expect(component.getGroupData('nonexistent')).toBeUndefined();
    });

    it('should return undefined for null ID', () => {
      fixture.componentRef.setInput('groups', []);
      fixture.detectChanges();

      expect(component.getGroupData(null)).toBeUndefined();
    });
  });

  describe('getCompletionPct', () => {
    it('should calculate percentage correctly', () => {
      const group = makeGroup('g-a', 'Alpha', '1000', {
        task_count: 10,
        completed_count: 3,
      });
      expect(component.getCompletionPct(group)).toBe(30);
    });

    it('should return 0 for empty groups', () => {
      const group = makeGroup('g-a', 'Alpha', '1000', {
        task_count: 0,
        completed_count: 0,
      });
      expect(component.getCompletionPct(group)).toBe(0);
    });

    it('should return 0 for undefined group', () => {
      expect(component.getCompletionPct(undefined)).toBe(0);
    });
  });

  describe('getCompletionClassFromPct', () => {
    it('should return green class for 100%', () => {
      const cls = component.getCompletionClassFromPct(100);
      expect(cls).toContain('status-green');
    });

    it('should return blue class for partial progress', () => {
      const cls = component.getCompletionClassFromPct(50);
      expect(cls).toContain('status-blue');
    });

    it('should return secondary class for 0%', () => {
      const cls = component.getCompletionClassFromPct(0);
      expect(cls).toContain('secondary');
    });
  });

  describe('isGroupCollapsed', () => {
    it('should return false for null taskListId', () => {
      expect(component.isGroupCollapsed(null)).toBe(false);
    });

    it('should return true for a collapsed group', () => {
      const group = makeGroup('g-a', 'Alpha', '1000', {
        group: {
          id: 'g-a',
          name: 'Alpha',
          color: '#f00',
          position: '1000',
          collapsed: true,
          tenant_id: 't1',
          created_by_id: 'user-1',
          created_at: '2026-01-01T00:00:00Z',
        },
      });

      fixture.componentRef.setInput('groups', [group]);
      fixture.detectChanges();

      expect(component.isGroupCollapsed('g-a')).toBe(true);
    });

    it('should return false for an expanded group', () => {
      const group = makeGroup('g-a', 'Alpha', '1000');
      fixture.componentRef.setInput('groups', [group]);
      fixture.detectChanges();

      expect(component.isGroupCollapsed('g-a')).toBe(false);
    });
  });

  describe('startTitleEdit', () => {
    it('should scope to closest td when event target is provided', () => {
      const task = makeTask({ id: 'task-1', title: 'Original' });
      // Create a mock event with a target inside a td
      const mockTd = document.createElement('td');
      const mockDiv = document.createElement('div');
      mockTd.appendChild(mockDiv);
      const mockEvent = { target: mockDiv } as unknown as MouseEvent;

      component.startTitleEdit(task, mockEvent);

      expect(component.editingTitleTaskId()).toBe('task-1');
      expect(component.editingTitleValue()).toBe('Original');
    });
  });

  describe('onToggleGroupById', () => {
    it('should emit groupToggled with the correct group', () => {
      const group = makeGroup('g-a', 'Alpha', '1000');
      fixture.componentRef.setInput('groups', [group]);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.groupToggled, 'emit');
      component.onToggleGroupById('g-a');

      expect(emitSpy).toHaveBeenCalledWith(group);
    });

    it('should not emit for null taskListId', () => {
      const emitSpy = vi.spyOn(component.groupToggled, 'emit');
      component.onToggleGroupById(null);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit for unknown group ID', () => {
      fixture.componentRef.setInput('groups', []);
      fixture.detectChanges();

      const emitSpy = vi.spyOn(component.groupToggled, 'emit');
      component.onToggleGroupById('nonexistent');
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
