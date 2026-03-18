import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CompletionTrendComponent } from './completion-trend.component';
import { DashboardService } from '../../../core/services/dashboard.service';

describe('CompletionTrendComponent', () => {
  let component: CompletionTrendComponent;
  let fixture: ComponentFixture<CompletionTrendComponent>;
  let mockDashboardService: any;

  const mockData = [
    { date: '2026-01-01', completed: 3 },
    { date: '2026-01-02', completed: 5 },
    { date: '2026-01-03', completed: 2 },
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
      getCompletionTrend: vi.fn().mockReturnValue(of(mockData)),
    };

    await TestBed.configureTestingModule({
      imports: [CompletionTrendComponent],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CompletionTrendComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should load completion trend data', async () => {
      await component.loadData();
      expect(mockDashboardService.getCompletionTrend).toHaveBeenCalledWith(
        30,
        undefined,
      );
      expect(component.data().length).toBe(3);
      expect(component.totalCompleted()).toBe(10);
      expect(component.loading()).toBe(false);
    });

    it('should handle null response', async () => {
      mockDashboardService.getCompletionTrend.mockReturnValue(of(null));
      await component.loadData();
      expect(component.data()).toEqual([]);
      expect(component.totalCompleted()).toBe(0);
    });

    it('should handle error', async () => {
      mockDashboardService.getCompletionTrend.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await component.loadData();
      expect(component.loading()).toBe(false);
    });
  });

  describe('setDays', () => {
    it('should update selectedDays and reload', async () => {
      await component.loadData();
      vi.clearAllMocks();

      component.setDays(60);
      expect(component.selectedDays()).toBe(60);
      expect(mockDashboardService.getCompletionTrend).toHaveBeenCalledWith(
        60,
        undefined,
      );
    });
  });

  describe('chartData', () => {
    it('should generate chart data from trend points', () => {
      component.data.set(mockData);
      const chart = component.chartData();
      expect(chart.labels.length).toBe(3);
      expect(chart.datasets.length).toBe(1);
      expect(chart.datasets[0].data).toEqual([3, 5, 2]);
    });

    it('should handle empty data', () => {
      component.data.set([]);
      const chart = component.chartData();
      expect(chart.labels).toEqual([]);
      expect(chart.datasets[0].data).toEqual([]);
    });
  });

  it('should start with 30 days selected', () => {
    expect(component.selectedDays()).toBe(30);
  });

  it('should have day options [30, 60, 90]', () => {
    expect(component.dayOptions).toEqual([30, 60, 90]);
  });

  it('should pass selected days to service', async () => {
    component.setDays(90);
    expect(mockDashboardService.getCompletionTrend).toHaveBeenCalledWith(
      90,
      undefined,
    );
  });

  it('should compute totalCompleted as sum of all points', async () => {
    // mockData: 3 + 5 + 2 = 10
    await component.loadData();
    expect(component.totalCompleted()).toBe(10);
  });

  it('should generate line chart with fill and tension', () => {
    component.data.set(mockData);
    const chart = component.chartData();
    expect(chart.datasets[0].fill).toBe(true);
    expect(chart.datasets[0].tension).toBe(0.4);
  });

  it('should use gradient background', () => {
    component.data.set(mockData);
    const chart = component.chartData();
    expect(typeof chart.datasets[0].backgroundColor).toBe('function');
  });

  it('should handle large dataset', async () => {
    const largeData = Array.from({ length: 90 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      completed: i % 5,
    }));
    mockDashboardService.getCompletionTrend.mockReturnValue(of(largeData));
    await component.loadData();
    expect(component.data().length).toBe(90);
  });
});
