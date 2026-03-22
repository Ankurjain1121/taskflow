import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TasksByPriorityComponent } from './tasks-by-priority.component';
import { DashboardService } from '../../../core/services/dashboard.service';

describe('TasksByPriorityComponent', () => {
  let component: TasksByPriorityComponent;
  let fixture: ComponentFixture<TasksByPriorityComponent>;
  let mockDashboardService: any;
  let mockRouter: any;

  const mockData = [
    { priority: 'urgent', count: 3 },
    { priority: 'high', count: 8 },
    { priority: 'medium', count: 12 },
    { priority: 'low', count: 5 },
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
      getTasksByPriority: vi.fn().mockReturnValue(of(mockData)),
    };

    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TasksByPriorityComponent],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksByPriorityComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should load tasks by priority', async () => {
      await component.loadData();
      expect(mockDashboardService.getTasksByPriority).toHaveBeenCalledWith(
        undefined,
      );
      expect(component.data().length).toBe(4);
      expect(component.loading()).toBe(false);
    });

    it('should handle null response', async () => {
      mockDashboardService.getTasksByPriority.mockReturnValue(of(null));
      await component.loadData();
      expect(component.data()).toEqual([]);
    });

    it('should handle error', async () => {
      mockDashboardService.getTasksByPriority.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await component.loadData();
      expect(component.loading()).toBe(false);
    });
  });

  describe('chartData', () => {
    it('should generate bar chart data', () => {
      component.data.set(mockData);
      const chart = component.chartData();
      expect(chart.labels).toEqual(['urgent', 'high', 'medium', 'low']);
      expect(chart.datasets[0].data).toEqual([3, 8, 12, 5]);
    });
  });

  describe('onChartClick', () => {
    it('should navigate to my-tasks with priority filter', () => {
      component.data.set(mockData);
      component.onChartClick({ element: { index: 0 } });
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/my-tasks'], {
        queryParams: { priority: 'urgent' },
      });
    });

    it('should not navigate for invalid index', () => {
      component.data.set(mockData);
      component.onChartClick({ element: { index: 99 } });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('getPriorityColor', () => {
    it('should return Trello red for urgent', () => {
      expect(component.getPriorityColor('urgent')).toBe('#E8445A');
    });

    it('should return Trello amber for high', () => {
      expect(component.getPriorityColor('high')).toBe('#F5A623');
    });

    it('should return Trello blue for medium', () => {
      expect(component.getPriorityColor('medium')).toBe('#2D5BE3');
    });

    it('should return Trello green for low', () => {
      expect(component.getPriorityColor('low')).toBe('#0FA882');
    });

    it('should return gray for unknown', () => {
      expect(component.getPriorityColor('unknown')).toBe('#9ca3af');
    });

    it('should handle case-insensitive priority matching', () => {
      expect(component.getPriorityColor('URGENT')).toBe('#E8445A');
      expect(component.getPriorityColor('Urgent')).toBe('#E8445A');
      expect(component.getPriorityColor('HIGH')).toBe('#F5A623');
      expect(component.getPriorityColor('High')).toBe('#F5A623');
    });
  });

  it('should start in loading state', () => {
    const freshFixture = TestBed.createComponent(TasksByPriorityComponent);
    const freshComponent = freshFixture.componentInstance;
    expect(freshComponent.loading()).toBe(true);
  });

  it('should pass workspaceId to service', async () => {
    fixture.componentRef.setInput('workspaceId', 'ws-456');
    fixture.detectChanges();
    await component.loadData();
    expect(mockDashboardService.getTasksByPriority).toHaveBeenCalledWith(
      'ws-456',
    );
  });

  it('should use horizontal bar chart (indexAxis: y)', () => {
    expect(component.chartOptions.indexAxis).toBe('y');
  });

  it('should set bar thickness to 28', () => {
    component.data.set(mockData);
    const chart = component.chartData();
    expect(chart.datasets[0].barThickness).toBe(28);
  });
});
