import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import {
  GanttViewComponent,
  GanttTask,
  GanttDependency,
} from './gantt-view.component';

describe('GanttViewComponent', () => {
  let component: GanttViewComponent;
  let fixture: ComponentFixture<GanttViewComponent>;

  const mockTasks: GanttTask[] = [
    {
      id: 't-1',
      title: 'Task A',
      priority: 'high',
      start_date: '2026-02-01',
      due_date: '2026-02-10',
      column_id: 'c-1',
      column_name: 'Todo',
      is_done: false,
      milestone_id: null,
    },
    {
      id: 't-2',
      title: 'Task B',
      priority: 'medium',
      start_date: '2026-02-05',
      due_date: '2026-02-15',
      column_id: 'c-1',
      column_name: 'In Progress',
      is_done: false,
      milestone_id: null,
    },
    {
      id: 't-3',
      title: 'Task C',
      priority: 'low',
      start_date: null,
      due_date: '2026-02-20',
      column_id: 'c-2',
      column_name: 'Done',
      is_done: true,
      milestone_id: null,
    },
  ];

  const mockDeps: GanttDependency[] = [
    {
      id: 'dep-1',
      source_task_id: 't-1',
      target_task_id: 't-2',
      dependency_type: 'blocks',
    },
  ];

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
      imports: [GanttViewComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(GanttViewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sortedTasks', () => {
    it('should sort tasks by start_date ascending', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      const sorted = component.sortedTasks();
      expect(sorted[0].id).toBe('t-1');
      expect(sorted[1].id).toBe('t-2');
    });

    it('should handle tasks with no start_date using due_date', () => {
      fixture.componentRef.setInput('tasks', [
        {
          id: 't-1',
          title: 'A',
          priority: 'low',
          start_date: null,
          due_date: '2026-03-01',
          column_id: 'c',
          column_name: 'X',
          is_done: false,
          milestone_id: null,
        },
        {
          id: 't-2',
          title: 'B',
          priority: 'low',
          start_date: '2026-01-01',
          due_date: null,
          column_id: 'c',
          column_name: 'X',
          is_done: false,
          milestone_id: null,
        },
      ]);
      fixture.detectChanges();
      const sorted = component.sortedTasks();
      expect(sorted[0].id).toBe('t-2');
    });
  });

  describe('timelineWidth', () => {
    it('should return a positive width when tasks have dates', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      expect(component.timelineWidth()).toBeGreaterThan(0);
    });

    it('should return a width for empty task list', () => {
      fixture.componentRef.setInput('tasks', []);
      fixture.detectChanges();
      expect(component.timelineWidth()).toBeGreaterThan(0);
    });
  });

  describe('todayX', () => {
    it('should return a number', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      expect(typeof component.todayX()).toBe('number');
    });
  });

  describe('dateHeaders', () => {
    it('should generate day headers in day zoom', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      component.zoom.set('day');
      const headers = component.dateHeaders();
      expect(headers.length).toBeGreaterThan(0);
      expect(headers[0].width).toBe(40); // day width
    });

    it('should generate week headers in week zoom', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      component.zoom.set('week');
      const headers = component.dateHeaders();
      expect(headers.length).toBeGreaterThan(0);
      expect(headers[0].width).toBe(7 * 16); // 7 days * dayWidth
    });

    it('should generate month headers in month zoom', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      component.zoom.set('month');
      const headers = component.dateHeaders();
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe('ganttBars', () => {
    it('should generate bars for each task', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.detectChanges();
      const bars = component.ganttBars();
      expect(bars.length).toBe(3);
      bars.forEach((bar) => {
        expect(bar.x).toBeDefined();
        expect(bar.width).toBeGreaterThanOrEqual(0);
        expect(bar.y).toBeDefined();
        expect(bar.color).toBeTruthy();
      });
    });

    it('should handle tasks with only due_date', () => {
      fixture.componentRef.setInput('tasks', [
        {
          id: 't-1',
          title: 'A',
          priority: 'low',
          start_date: null,
          due_date: '2026-02-10',
          column_id: 'c',
          column_name: 'X',
          is_done: false,
          milestone_id: null,
        },
      ]);
      fixture.detectChanges();
      const bars = component.ganttBars();
      expect(bars.length).toBe(1);
    });
  });

  describe('dependencyArrows', () => {
    it('should generate arrows for blocking dependencies', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.componentRef.setInput('dependencies', mockDeps);
      fixture.detectChanges();
      const arrows = component.dependencyArrows();
      expect(arrows.length).toBe(1);
      expect(arrows[0].path).toContain('M');
      expect(arrows[0].path).toContain('C');
    });

    it('should filter out non-blocking dependencies', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.componentRef.setInput('dependencies', [
        {
          id: 'dep-1',
          source_task_id: 't-1',
          target_task_id: 't-2',
          dependency_type: 'related',
        },
      ]);
      fixture.detectChanges();
      expect(component.dependencyArrows().length).toBe(0);
    });

    it('should handle missing source/target in bars', () => {
      fixture.componentRef.setInput('tasks', mockTasks);
      fixture.componentRef.setInput('dependencies', [
        {
          id: 'dep-1',
          source_task_id: 'nonexistent',
          target_task_id: 't-2',
          dependency_type: 'blocks',
        },
      ]);
      fixture.detectChanges();
      expect(component.dependencyArrows().length).toBe(0);
    });
  });

  describe('onTaskClick', () => {
    it('should emit task id', () => {
      const emitSpy = vi.spyOn(component.taskClicked, 'emit');
      component.onTaskClick({ id: 't-1' } as any);
      expect(emitSpy).toHaveBeenCalledWith('t-1');
    });
  });

  describe('getColor', () => {
    it('should return a color for known priority', () => {
      expect(component.getColor('high')).toBeTruthy();
      expect(component.getColor('high')).not.toBe('#6b7280');
    });

    it('should return fallback for unknown priority', () => {
      expect(component.getColor('unknown')).toBe('#6b7280');
    });
  });

  describe('zoom levels', () => {
    it('should change zoom level', () => {
      component.zoom.set('day');
      expect(component.zoom()).toBe('day');
      component.zoom.set('month');
      expect(component.zoom()).toBe('month');
    });
  });
});
