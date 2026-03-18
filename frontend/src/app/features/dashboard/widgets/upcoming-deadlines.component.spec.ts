import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { UpcomingDeadlinesComponent } from './upcoming-deadlines.component';
import {
  DashboardService,
  UpcomingDeadline,
} from '../../../core/services/dashboard.service';

describe('UpcomingDeadlinesComponent', () => {
  let component: UpcomingDeadlinesComponent;
  let fixture: ComponentFixture<UpcomingDeadlinesComponent>;
  let mockDashboardService: {
    getUpcomingDeadlines: ReturnType<typeof vi.fn>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  const mockDeadlines: UpcomingDeadline[] = [
    {
      id: 'd-1',
      title: 'Task A',
      due_date: '2026-03-01',
      priority: 'urgent',
      board_id: 'b-1',
      board_name: 'Board 1',
      days_until_due: 0,
    },
    {
      id: 'd-2',
      title: 'Task B',
      due_date: '2026-03-02',
      priority: 'high',
      board_id: 'b-2',
      board_name: 'Board 2',
      days_until_due: 1,
    },
    {
      id: 'd-3',
      title: 'Task C',
      due_date: '2026-03-05',
      priority: 'medium',
      board_id: 'b-3',
      board_name: 'Board 3',
      days_until_due: 5,
    },
    {
      id: 'd-4',
      title: 'Task D',
      due_date: '2026-03-15',
      priority: 'low',
      board_id: 'b-4',
      board_name: 'Board 4',
      days_until_due: 14,
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

    mockDashboardService = {
      getUpcomingDeadlines: vi.fn().mockReturnValue(of(mockDeadlines)),
    };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [UpcomingDeadlinesComponent],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UpcomingDeadlinesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should set loading to true then false after load', async () => {
      expect(component.loading()).toBe(true);
      await component.loadData();
      expect(component.loading()).toBe(false);
    });

    it('should populate deadlines from service', async () => {
      await component.loadData();
      expect(component.deadlines()).toEqual(mockDeadlines);
      expect(mockDashboardService.getUpcomingDeadlines).toHaveBeenCalledWith(
        14,
        undefined,
      );
    });

    it('should pass workspaceId to service when set', async () => {
      fixture.componentRef.setInput('workspaceId', 'ws-123');
      await component.loadData();
      expect(mockDashboardService.getUpcomingDeadlines).toHaveBeenCalledWith(
        14,
        'ws-123',
      );
    });

    it('should handle null response gracefully', async () => {
      mockDashboardService.getUpcomingDeadlines.mockReturnValue(
        of(null as unknown as UpcomingDeadline[]),
      );
      await component.loadData();
      expect(component.deadlines()).toEqual([]);
      expect(component.loading()).toBe(false);
    });

    it('should handle errors and set loading to false', async () => {
      mockDashboardService.getUpcomingDeadlines.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      await component.loadData();
      expect(component.loading()).toBe(false);
      expect(component.deadlines()).toEqual([]);
    });
  });

  describe('navigateToTask', () => {
    it('should navigate to task route', () => {
      component.navigateToTask(mockDeadlines[0]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 'd-1']);
    });
  });

  describe('getRelativeTime', () => {
    it('should return "Due today" for 0 days', () => {
      expect(component.getRelativeTime(0)).toBe('Due today');
    });

    it('should return "Due tomorrow" for 1 day', () => {
      expect(component.getRelativeTime(1)).toBe('Due tomorrow');
    });

    it('should return "Due in X days" for 2-6 days', () => {
      expect(component.getRelativeTime(3)).toBe('Due in 3 days');
      expect(component.getRelativeTime(6)).toBe('Due in 6 days');
    });

    it('should return "Due in 1 week" for 7 days', () => {
      expect(component.getRelativeTime(7)).toBe('Due in 1 week');
    });

    it('should return "Due in X weeks" for 14+ days', () => {
      expect(component.getRelativeTime(14)).toBe('Due in 2 weeks');
    });
  });

  describe('getUrgencyColor', () => {
    it('should return red for 0 days', () => {
      expect(component.getUrgencyColor(0)).toBe('bg-red-500');
    });

    it('should return orange for 1-2 days', () => {
      expect(component.getUrgencyColor(1)).toBe('bg-orange-500');
      expect(component.getUrgencyColor(2)).toBe('bg-orange-500');
    });

    it('should return yellow for 3-7 days', () => {
      expect(component.getUrgencyColor(3)).toBe('bg-yellow-500');
      expect(component.getUrgencyColor(7)).toBe('bg-yellow-500');
    });

    it('should return blue for 8+ days', () => {
      expect(component.getUrgencyColor(8)).toBe('bg-blue-500');
    });
  });

  describe('getUrgencyTextColor', () => {
    it('should return red text for 0 days', () => {
      expect(component.getUrgencyTextColor(0)).toContain('text-red');
    });

    it('should return orange text for 1-2 days', () => {
      expect(component.getUrgencyTextColor(2)).toContain('text-orange');
    });

    it('should return yellow text for 3-7 days', () => {
      expect(component.getUrgencyTextColor(5)).toContain('text-yellow');
    });

    it('should return blue text for 8+ days', () => {
      expect(component.getUrgencyTextColor(10)).toContain('text-blue');
    });
  });

  describe('getPriorityClass', () => {
    it('should return correct class for urgent', () => {
      expect(component.getPriorityClass('urgent')).toContain('bg-red');
    });

    it('should return correct class for high', () => {
      expect(component.getPriorityClass('high')).toContain('bg-orange');
    });

    it('should return correct class for medium', () => {
      expect(component.getPriorityClass('medium')).toContain('bg-blue');
    });

    it('should return correct class for low', () => {
      expect(component.getPriorityClass('low')).toContain('bg-[var(--muted)]');
    });

    it('should return default class for unknown priority', () => {
      expect(component.getPriorityClass('unknown')).toContain('bg-[var(--muted)]');
    });

    it('should be case insensitive', () => {
      expect(component.getPriorityClass('URGENT')).toContain('bg-red');
      expect(component.getPriorityClass('High')).toContain('bg-orange');
    });
  });

  describe('additional boundary tests', () => {
    it('should request 14 days of deadlines', async () => {
      await component.loadData();
      expect(mockDashboardService.getUpcomingDeadlines).toHaveBeenCalledWith(
        14,
        undefined,
      );
    });

    it('should return "Due in 2 weeks" for 14 days', () => {
      expect(component.getRelativeTime(14)).toBe('Due in 2 weeks');
    });

    it('should handle exactly 7 days', () => {
      expect(component.getRelativeTime(7)).toBe('Due in 1 week');
    });

    it('should handle 4 days', () => {
      expect(component.getRelativeTime(4)).toBe('Due in 4 days');
    });

    it('should show blue urgency for 10 days', () => {
      expect(component.getUrgencyColor(10)).toBe('bg-blue-500');
    });
  });
});
