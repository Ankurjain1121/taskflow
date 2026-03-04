import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TasksByStatusComponent } from './tasks-by-status.component';
import { DashboardService } from '../../../core/services/dashboard.service';

describe('TasksByStatusComponent', () => {
  let component: TasksByStatusComponent;
  let fixture: ComponentFixture<TasksByStatusComponent>;
  let mockDashboardService: any;
  let mockRouter: any;

  const mockData = [
    { status: 'Todo', count: 10, color: '#6366f1' },
    { status: 'In Progress', count: 5, color: '#f97316' },
    { status: 'Done', count: 8, color: '#22c55e' },
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
      getTasksByStatus: vi.fn().mockReturnValue(of(mockData)),
    };

    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TasksByStatusComponent],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksByStatusComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should load tasks by status', async () => {
      await component.loadData();
      expect(mockDashboardService.getTasksByStatus).toHaveBeenCalledWith(
        undefined,
      );
      expect(component.data().length).toBe(3);
      expect(component.loading()).toBe(false);
    });

    it('should handle null response', async () => {
      mockDashboardService.getTasksByStatus.mockReturnValue(of(null));
      await component.loadData();
      expect(component.data()).toEqual([]);
    });

    it('should handle error', async () => {
      mockDashboardService.getTasksByStatus.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await component.loadData();
      expect(component.loading()).toBe(false);
    });
  });

  describe('chartData', () => {
    it('should generate doughnut chart data', () => {
      component.data.set(mockData);
      const chart = component.chartData();
      expect(chart.labels).toEqual(['Todo', 'In Progress', 'Done']);
      expect(chart.datasets[0].data).toEqual([10, 5, 8]);
      expect(chart.datasets[0].backgroundColor).toEqual([
        '#6366f1',
        '#f97316',
        '#22c55e',
      ]);
    });
  });

  describe('onChartClick', () => {
    it('should navigate to my-tasks with status filter', () => {
      component.data.set(mockData);
      component.onChartClick({ element: { index: 1 } });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/my-tasks'], {
        queryParams: { status: 'In Progress' },
      });
    });

    it('should not navigate for invalid index', () => {
      component.data.set(mockData);
      component.onChartClick({ element: { index: 99 } });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should not navigate for null element', () => {
      component.data.set(mockData);
      component.onChartClick({ element: null } as any);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
