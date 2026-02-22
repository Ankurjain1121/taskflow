import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ReportsViewComponent } from './reports-view.component';
import { ReportsService } from '../../../core/services/reports.service';

describe('ReportsViewComponent', () => {
  let component: ReportsViewComponent;
  let fixture: ComponentFixture<ReportsViewComponent>;
  let mockReportsService: any;

  const mockReport = {
    completion_rate: { total: 20, completed: 12, remaining: 8 },
    burndown: [
      { date: '2026-01-01', remaining: 20 },
      { date: '2026-01-05', remaining: 15 },
      { date: '2026-01-10', remaining: 8 },
    ],
    priority_distribution: [
      { priority: 'urgent', count: 3 },
      { priority: 'high', count: 5 },
      { priority: 'medium', count: 8 },
      { priority: 'low', count: 4 },
    ],
    assignee_workload: [
      { user_id: 'u-1', name: 'Alice', total_tasks: 10, completed_tasks: 7 },
    ],
    overdue_analysis: [
      { bucket: '1-3 days', count: 2 },
      { bucket: '4-7 days', count: 1 },
      { bucket: '7+ days', count: 0 },
    ],
  };

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

    mockReportsService = {
      getBoardReport: vi.fn().mockReturnValue(of(mockReport)),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsViewComponent],
      providers: [
        { provide: ReportsService, useValue: mockReportsService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('boardId', 'board-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadReport', () => {
    it('should load report on init', () => {
      component.ngOnInit();
      expect(mockReportsService.getBoardReport).toHaveBeenCalledWith('board-1', 30);
      expect(component.report()).toBeTruthy();
      expect(component.loading()).toBe(false);
    });

    it('should handle load error', () => {
      mockReportsService.getBoardReport.mockReturnValue(throwError(() => new Error('fail')));
      component.ngOnInit();
      expect(component.loading()).toBe(false);
    });
  });

  describe('completionPercent', () => {
    it('should compute correct percentage', () => {
      component.report.set(mockReport as any);
      expect(component.completionPercent()).toBe(60); // 12/20 * 100
    });

    it('should return 0 when report is null', () => {
      component.report.set(null);
      expect(component.completionPercent()).toBe(0);
    });

    it('should return 0 when total is 0', () => {
      component.report.set({ ...mockReport, completion_rate: { total: 0, completed: 0, remaining: 0 } } as any);
      expect(component.completionPercent()).toBe(0);
    });
  });

  describe('pieSegments', () => {
    it('should return segments when report exists', () => {
      component.report.set(mockReport as any);
      const segments = component.pieSegments();
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should return empty array when report is null', () => {
      component.report.set(null);
      expect(component.pieSegments()).toEqual([]);
    });
  });

  describe('burndownYScale', () => {
    it('should return a function', () => {
      component.report.set(mockReport as any);
      const scale = component.burndownYScale();
      expect(typeof scale).toBe('function');
    });
  });

  describe('burndownYTicks', () => {
    it('should return ticks when burndown data exists', () => {
      component.report.set(mockReport as any);
      const ticks = component.burndownYTicks();
      expect(ticks.length).toBeGreaterThan(0);
    });

    it('should return empty array when no burndown data', () => {
      component.report.set({ ...mockReport, burndown: [] } as any);
      expect(component.burndownYTicks()).toEqual([]);
    });
  });

  describe('burndownPoints', () => {
    it('should return points when burndown data exists', () => {
      component.report.set(mockReport as any);
      const points = component.burndownPoints();
      expect(points.length).toBe(3);
      points.forEach(pt => {
        expect(typeof pt.x).toBe('number');
        expect(typeof pt.y).toBe('number');
      });
    });

    it('should return empty array when no data', () => {
      component.report.set(null);
      expect(component.burndownPoints()).toEqual([]);
    });
  });

  describe('burndownLine', () => {
    it('should return a polyline points string', () => {
      component.report.set(mockReport as any);
      const line = component.burndownLine();
      expect(typeof line).toBe('string');
    });
  });

  describe('burndownArea', () => {
    it('should return an area path string', () => {
      component.report.set(mockReport as any);
      const area = component.burndownArea();
      expect(typeof area).toBe('string');
    });
  });

  describe('hasOverdue', () => {
    it('should return true when overdue tasks exist', () => {
      component.report.set(mockReport as any);
      expect(component.hasOverdue()).toBe(true);
    });

    it('should return false when all overdue counts are 0', () => {
      component.report.set({
        ...mockReport,
        overdue_analysis: [{ bucket: '1-3 days', count: 0 }, { bucket: '4-7 days', count: 0 }],
      } as any);
      expect(component.hasOverdue()).toBe(false);
    });

    it('should return false when report is null', () => {
      component.report.set(null);
      expect(component.hasOverdue()).toBe(false);
    });
  });

  describe('maxOverdue', () => {
    it('should return max overdue count', () => {
      component.report.set(mockReport as any);
      expect(component.maxOverdue()).toBe(2);
    });

    it('should return 1 when report is null', () => {
      component.report.set(null);
      expect(component.maxOverdue()).toBe(1);
    });
  });

  describe('onDaysChange', () => {
    it('should update daysBack and reload', () => {
      component.ngOnInit();
      vi.clearAllMocks();

      const event = { target: { value: '7' } } as any;
      component.onDaysChange(event);
      expect(component.daysBack()).toBe(7);
      expect(mockReportsService.getBoardReport).toHaveBeenCalledWith('board-1', 7);
    });
  });

  describe('priorityBarWidth', () => {
    it('should return percentage width for count', () => {
      component.report.set(mockReport as any);
      const width = component.priorityBarWidth(4);
      expect(width).toBe(50); // 4/8 * 100
    });

    it('should return 0 when report is null', () => {
      component.report.set(null);
      expect(component.priorityBarWidth(4)).toBe(0);
    });
  });

  describe('getPriorityColor', () => {
    it('should return a color for known priorities', () => {
      expect(component.getPriorityColor('urgent')).toBeTruthy();
      expect(component.getPriorityColor('high')).toBeTruthy();
    });

    it('should return fallback for unknown', () => {
      expect(component.getPriorityColor('unknown')).toBe('#6b7280');
    });
  });

  describe('workloadBarWidth', () => {
    it('should compute percentage', () => {
      expect(component.workloadBarWidth(7, 10)).toBe(70);
    });

    it('should return 0 when total is 0', () => {
      expect(component.workloadBarWidth(5, 0)).toBe(0);
    });
  });

  describe('overdueBarHeight', () => {
    it('should compute height based on max overdue', () => {
      component.report.set(mockReport as any);
      const height = component.overdueBarHeight(2);
      expect(height).toBe(100); // 2/2 * 100
    });

    it('should enforce minimum height of 4', () => {
      component.report.set(mockReport as any);
      const height = component.overdueBarHeight(0);
      expect(height).toBe(4);
    });
  });
});
