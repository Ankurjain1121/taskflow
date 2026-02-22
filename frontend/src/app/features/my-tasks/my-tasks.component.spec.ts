import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { MyTasksComponent } from './my-tasks.component';
import {
  DashboardService,
  MyTask,
} from '../../core/services/dashboard.service';
import { MessageService } from 'primeng/api';

function createMockTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: 'task-1',
    title: 'Test Task',
    board_id: 'b-1',
    board_name: 'Board 1',
    column_name: 'Todo',
    priority: 'medium',
    due_date: null,
    is_done: false,
    ...overrides,
  } as MyTask;
}

describe('MyTasksComponent (parent - with filters)', () => {
  let component: MyTasksComponent;
  let fixture: ComponentFixture<MyTasksComponent>;
  let mockDashboardService: {
    getMyTasks: ReturnType<typeof vi.fn>;
  };
  let messageServiceAddSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
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

    mockDashboardService = {
      getMyTasks: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [MyTasksComponent],
      providers: [
        provideRouter([]),
        { provide: DashboardService, useValue: mockDashboardService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTasksComponent);
    component = fixture.componentInstance;

    // Spy on component-level MessageService (provided by the component itself)
    const componentMessageService =
      fixture.debugElement.injector.get(MessageService);
    messageServiceAddSpy = vi.spyOn(componentMessageService, 'add');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start in loading state', () => {
      expect(component.isLoading()).toBe(true);
    });

    it('should default to all filter', () => {
      expect(component.selectedFilter()).toBe('all');
    });

    it('should start with empty tasks', () => {
      expect(component.allTasks()).toEqual([]);
    });

    it('should have 4 filter options', () => {
      expect(component.filterOptions).toHaveLength(4);
    });
  });

  describe('ngOnInit / loadMyTasks', () => {
    it('should load tasks on init', () => {
      const tasks = [createMockTask()];
      mockDashboardService.getMyTasks.mockReturnValue(of(tasks));

      component.ngOnInit();

      expect(mockDashboardService.getMyTasks).toHaveBeenCalled();
      expect(component.allTasks()).toEqual(tasks);
      expect(component.isLoading()).toBe(false);
    });

    it('should show error toast on load failure', () => {
      mockDashboardService.getMyTasks.mockReturnValue(
        throwError(() => new Error('fail')),
      );

      component.ngOnInit();

      expect(messageServiceAddSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Failed to load your tasks',
        }),
      );
      expect(component.isLoading()).toBe(false);
    });
  });

  describe('setFilter', () => {
    it('should update selectedFilter signal', () => {
      component.setFilter('overdue');
      expect(component.selectedFilter()).toBe('overdue');
    });
  });

  describe('filteredTasks computed', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayDate = new Date(now);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const in10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

    const tasks = [
      createMockTask({ id: 't-overdue', due_date: yesterday.toISOString() }),
      createMockTask({ id: 't-today', due_date: todayDate.toISOString() }),
      createMockTask({ id: 't-week', due_date: in3Days.toISOString() }),
      createMockTask({ id: 't-later', due_date: in10Days.toISOString() }),
      createMockTask({ id: 't-nodate', due_date: null }),
    ];

    beforeEach(() => {
      component.allTasks.set(tasks);
    });

    it('should return all tasks for "all" filter', () => {
      component.selectedFilter.set('all');
      expect(component.filteredTasks()).toHaveLength(5);
    });

    it('should return overdue tasks for "overdue" filter', () => {
      component.selectedFilter.set('overdue');
      const filtered = component.filteredTasks();
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.some((t) => t.id === 't-overdue')).toBe(true);
    });

    it('should return today tasks for "today" filter', () => {
      component.selectedFilter.set('today');
      const filtered = component.filteredTasks();
      expect(filtered.some((t) => t.id === 't-today')).toBe(true);
    });

    it('should return tasks due this week for "week" filter', () => {
      component.selectedFilter.set('week');
      const filtered = component.filteredTasks();
      // Should include today and in3Days, but not overdue or in10Days
      expect(filtered.some((t) => t.id === 't-nodate')).toBe(false);
      expect(filtered.some((t) => t.id === 't-overdue')).toBe(false);
    });

    it('should exclude tasks with no due date from date-based filters', () => {
      component.selectedFilter.set('overdue');
      expect(component.filteredTasks().some((t) => t.id === 't-nodate')).toBe(
        false,
      );
    });
  });

  describe('groupedTasks computed', () => {
    it('should group tasks by board_id', () => {
      component.allTasks.set([
        createMockTask({ id: 't1', board_id: 'b-1' }),
        createMockTask({ id: 't2', board_id: 'b-2' }),
        createMockTask({ id: 't3', board_id: 'b-1' }),
      ]);
      component.selectedFilter.set('all');

      const grouped = component.groupedTasks();

      expect(grouped).toHaveLength(2);
      const b1Group = grouped.find(([boardId]) => boardId === 'b-1');
      expect(b1Group?.[1]).toHaveLength(2);
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct class for urgent', () => {
      expect(component.getPriorityColor('urgent')).toBe('bg-red-500');
    });

    it('should return correct class for high', () => {
      expect(component.getPriorityColor('high')).toBe('bg-orange-500');
    });

    it('should return correct class for medium', () => {
      expect(component.getPriorityColor('medium')).toBe('bg-yellow-500');
    });

    it('should return correct class for low', () => {
      expect(component.getPriorityColor('low')).toBe('bg-blue-500');
    });

    it('should return default class for unknown priority', () => {
      expect(component.getPriorityColor('unknown')).toBe('bg-gray-500');
    });
  });

  describe('getPriorityBadgeClass', () => {
    it('should return correct classes for urgent', () => {
      expect(component.getPriorityBadgeClass('urgent')).toBe(
        'bg-red-100 text-red-800',
      );
    });

    it('should return default classes for unknown', () => {
      expect(component.getPriorityBadgeClass('unknown')).toBe(
        'bg-gray-100 text-gray-800',
      );
    });
  });

  describe('formatDueDate', () => {
    it('should return empty string for null', () => {
      expect(component.formatDueDate(null)).toBe('');
    });

    it('should return "Due today" for today', () => {
      // Pin "now" to midnight so noon-today is ~12 h ahead => diffDays === 0
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 22, 0, 0, 0));
      expect(component.formatDueDate('2026-02-22T12:00:00')).toBe('Due today');
      vi.useRealTimers();
    });

    it('should return "Due tomorrow" for tomorrow', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 22, 0, 0, 0));
      expect(component.formatDueDate('2026-02-23T12:00:00')).toBe(
        'Due tomorrow',
      );
      vi.useRealTimers();
    });

    it('should return "Due in X days" for dates within a week', () => {
      const in5 = new Date();
      in5.setDate(in5.getDate() + 5);
      in5.setHours(12, 0, 0, 0);
      expect(component.formatDueDate(in5.toISOString())).toMatch(
        /^Due in \d+ days$/,
      );
    });

    it('should return "Overdue by X day(s)" for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      expect(component.formatDueDate(past.toISOString())).toMatch(
        /^Overdue by \d+ day\(s\)$/,
      );
    });

    it('should return localized date for dates far in the future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const result = component.formatDueDate(future.toISOString());
      expect(result).not.toBe('');
      expect(result).not.toMatch(/^Due in/);
    });
  });

  describe('isDueToday', () => {
    it('should return false for null', () => {
      expect(component.isDueToday(null)).toBe(false);
    });

    it('should return true for today', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      expect(component.isDueToday(today.toISOString())).toBe(true);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(component.isDueToday(tomorrow.toISOString())).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('should return false for null', () => {
      expect(component.isOverdue(null)).toBe(false);
    });

    it('should return true for past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      expect(component.isOverdue(past.toISOString())).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      expect(component.isOverdue(future.toISOString())).toBe(false);
    });
  });
});
