import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CalendarViewComponent } from './calendar-view.component';
import { TaskService } from '../../../core/services/task.service';

describe('CalendarViewComponent', () => {
  let component: CalendarViewComponent;
  let fixture: ComponentFixture<CalendarViewComponent>;
  let mockTaskService: any;

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, media: query, onchange: null,
          addListener: vi.fn(), removeListener: vi.fn(),
          addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
        })),
      });
    }

    mockTaskService = {
      listCalendarTasks: vi.fn().mockReturnValue(of([
        { id: 't-1', title: 'Task A', priority: 'high', due_date: '2026-02-15', start_date: null, column_id: 'c-1', column_name: 'Todo', is_done: false, milestone_id: null },
      ])),
      updateTask: vi.fn().mockReturnValue(of({})),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [
        { provide: TaskService, useValue: mockTaskService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', 'board-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load tasks on init', () => {
      component.ngOnInit();
      expect(mockTaskService.listCalendarTasks).toHaveBeenCalledWith('board-1', expect.any(String), expect.any(String));
      expect(component.tasks().length).toBe(1);
      expect(component.loading()).toBe(false);
    });

    it('should handle load error', () => {
      mockTaskService.listCalendarTasks.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });
  });

  describe('monthYearLabel', () => {
    it('should return formatted month and year', () => {
      component.currentDate.set(new Date(2026, 5, 1)); // June 2026
      const label = component.monthYearLabel();
      expect(label).toContain('June');
      expect(label).toContain('2026');
    });
  });

  describe('navigation', () => {
    it('should go to previous month', () => {
      component.currentDate.set(new Date(2026, 5, 1)); // June 2026
      component.previousMonth();
      expect(component.currentDate().getMonth()).toBe(4); // May
      expect(mockTaskService.listCalendarTasks).toHaveBeenCalled();
    });

    it('should go to next month', () => {
      component.currentDate.set(new Date(2026, 5, 1)); // June 2026
      component.nextMonth();
      expect(component.currentDate().getMonth()).toBe(6); // July
      expect(mockTaskService.listCalendarTasks).toHaveBeenCalled();
    });

    it('should go to today', () => {
      component.currentDate.set(new Date(2020, 0, 1));
      component.goToToday();
      const now = new Date();
      expect(component.currentDate().getMonth()).toBe(now.getMonth());
      expect(mockTaskService.listCalendarTasks).toHaveBeenCalled();
    });
  });

  describe('calendarCells', () => {
    it('should generate month cells for current month', () => {
      component.currentDate.set(new Date(2026, 1, 1)); // February 2026
      component.tasks.set([]);
      component.calendarView.set('month');
      const cells = component.calendarCells();
      // A calendar grid should have at least 28 cells (days in Feb)
      expect(cells.length).toBeGreaterThanOrEqual(28);
      // Each cell should be divisible by 7 (complete weeks)
      expect(cells.length % 7).toBe(0);
    });

    it('should generate week cells in week view', () => {
      component.calendarView.set('week');
      component.currentDate.set(new Date(2026, 1, 10));
      component.tasks.set([]);
      const cells = component.calendarCells();
      expect(cells.length).toBe(7);
    });

    it('should assign tasks to correct cells', () => {
      component.currentDate.set(new Date(2026, 1, 1)); // February 2026
      component.tasks.set([
        { id: 't-1', title: 'Task', priority: 'high', due_date: '2026-02-15', start_date: null, column_id: 'c-1', column_name: 'Todo', is_done: false, milestone_id: null },
      ]);
      component.calendarView.set('month');
      const cells = component.calendarCells();
      const cellWithTask = cells.find(c => c.tasks.length > 0);
      expect(cellWithTask).toBeTruthy();
      expect(cellWithTask?.dayNumber).toBe(15);
    });
  });

  describe('getTaskBorderColor', () => {
    it('should return red for urgent', () => {
      expect(component.getTaskBorderColor('urgent')).toBe('#ef4444');
    });

    it('should return orange for high', () => {
      expect(component.getTaskBorderColor('high')).toBe('#f97316');
    });

    it('should return yellow for medium', () => {
      expect(component.getTaskBorderColor('medium')).toBe('#eab308');
    });

    it('should return green for low', () => {
      expect(component.getTaskBorderColor('low')).toBe('#22c55e');
    });

    it('should return gray for unknown priority', () => {
      expect(component.getTaskBorderColor('unknown')).toBe('#6b7280');
    });
  });

  describe('onTaskClick', () => {
    it('should emit task id', () => {
      const emitSpy = vi.spyOn(component.taskClicked, 'emit');
      component.onTaskClick({ id: 't-1' } as any);
      expect(emitSpy).toHaveBeenCalledWith('t-1');
    });
  });

  describe('drag and drop', () => {
    it('should set dragged task on drag start', () => {
      const task = { id: 't-1', title: 'Task' } as any;
      const event = {
        dataTransfer: { setData: vi.fn() },
      } as any;
      component.onDragStart(event, task);
      expect(component.draggedTask).toBe(task);
      expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 't-1');
    });

    it('should prevent default on drag over', () => {
      const event = { preventDefault: vi.fn() } as any;
      component.onDragOver(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should update task due date on drop', () => {
      const task = { id: 't-1' } as any;
      component.draggedTask = task;
      const dropDate = new Date(2026, 5, 15);
      const event = { preventDefault: vi.fn() } as any;

      component.onDrop(event, dropDate);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith('t-1', { due_date: expect.any(String) });
      expect(component.draggedTask).toBeNull();
    });

    it('should not update on drop if no dragged task', () => {
      component.draggedTask = null;
      const event = { preventDefault: vi.fn() } as any;
      component.onDrop(event, new Date());
      expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });
  });
});
