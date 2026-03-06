import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyTasksTodayComponent } from './my-tasks-today.component';
import { MyTasksService } from '../../../core/services/my-tasks.service';

describe('MyTasksTodayComponent', () => {
  let component: MyTasksTodayComponent;
  let fixture: ComponentFixture<MyTasksTodayComponent>;
  let mockMyTasksService: any;

  // Use local-date format with explicit time to avoid timezone issues
  const now = new Date();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
    12,
    0,
    0,
  );
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
  );
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    12,
    0,
    0,
  );
  const yesterdayStr = yesterday.toISOString();
  const todayStr = today.toISOString();
  const tomorrowStr = tomorrow.toISOString();

  const mockTasks = [
    {
      id: 't-1',
      title: 'Overdue Task',
      due_date: yesterdayStr,
      priority: 'urgent',
      board_name: 'Board A',
      column_name: 'Todo',
      workspace_id: 'ws-1',
    },
    {
      id: 't-2',
      title: 'Today Task',
      due_date: todayStr,
      priority: 'high',
      board_name: 'Board A',
      column_name: 'In Progress',
      workspace_id: 'ws-1',
    },
    {
      id: 't-3',
      title: 'Tomorrow Task',
      due_date: tomorrowStr,
      priority: 'medium',
      board_name: 'Board B',
      column_name: 'Todo',
      workspace_id: 'ws-2',
    },
    {
      id: 't-4',
      title: 'Future Task',
      due_date: '2030-01-01',
      priority: 'low',
      board_name: 'Board B',
      column_name: 'Todo',
      workspace_id: 'ws-2',
    },
    {
      id: 't-5',
      title: 'No Date Task',
      due_date: null,
      priority: 'low',
      board_name: 'Board C',
      column_name: 'Todo',
      workspace_id: 'ws-1',
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

    mockMyTasksService = {
      getMyTasks: vi
        .fn()
        .mockReturnValue(of({ items: mockTasks, total: mockTasks.length })),
    };

    await TestBed.configureTestingModule({
      imports: [MyTasksTodayComponent],
      providers: [
        provideRouter([]),
        { provide: MyTasksService, useValue: mockMyTasksService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTasksTodayComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadTasks', () => {
    it('should load tasks on init and filter to overdue/today/tomorrow', () => {
      component.ngOnInit();
      fixture.detectChanges(); // flush effects
      expect(mockMyTasksService.getMyTasks).toHaveBeenCalled();
      expect(component.loading()).toBe(false);
      // Should include overdue, today, and tomorrow tasks but not future or no-date tasks
      const filtered = component.filteredTasks();
      expect(filtered.length).toBe(3);
    });

    it('should handle load error', () => {
      mockMyTasksService.getMyTasks.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });
  });

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      expect(component.isOverdue({ due_date: yesterdayStr } as any)).toBe(true);
    });

    it('should return false for today', () => {
      expect(component.isOverdue({ due_date: todayStr } as any)).toBe(false);
    });

    it('should return false for no due date', () => {
      expect(component.isOverdue({ due_date: null } as any)).toBe(false);
    });
  });

  describe('isDueToday', () => {
    it('should return true for today', () => {
      expect(component.isDueToday({ due_date: todayStr } as any)).toBe(true);
    });

    it('should return false for yesterday', () => {
      expect(component.isDueToday({ due_date: yesterdayStr } as any)).toBe(
        false,
      );
    });

    it('should return false for no due date', () => {
      expect(component.isDueToday({ due_date: null } as any)).toBe(false);
    });
  });

  describe('isDueTomorrow', () => {
    it('should return true for tomorrow', () => {
      expect(component.isDueTomorrow({ due_date: tomorrowStr } as any)).toBe(
        true,
      );
    });

    it('should return false for today', () => {
      expect(component.isDueTomorrow({ due_date: todayStr } as any)).toBe(
        false,
      );
    });

    it('should return false for no due date', () => {
      expect(component.isDueTomorrow({ due_date: null } as any)).toBe(false);
    });
  });

  describe('getPriorityDotClass', () => {
    it('should return red for urgent', () => {
      expect(component.getPriorityDotClass('urgent')).toBe('bg-red-500');
    });

    it('should return orange for high', () => {
      expect(component.getPriorityDotClass('high')).toBe('bg-orange-500');
    });

    it('should return blue for medium', () => {
      expect(component.getPriorityDotClass('medium')).toBe('bg-blue-500');
    });

    it('should return gray for low', () => {
      expect(component.getPriorityDotClass('low')).toBe('bg-gray-400');
    });

    it('should return gray for unknown', () => {
      expect(component.getPriorityDotClass('unknown')).toBe('bg-gray-400');
    });
  });

  describe('workspace filtering', () => {
    it('should filter tasks by workspace when workspaceId is set', () => {
      fixture.componentRef.setInput('workspaceId', 'ws-1');
      component.ngOnInit();
      fixture.detectChanges();
      // ws-1 has overdue and today tasks (2 tasks)
      const filtered = component.filteredTasks();
      expect(filtered.every((t) => t.workspace_id === 'ws-1')).toBe(true);
    });
  });
});
