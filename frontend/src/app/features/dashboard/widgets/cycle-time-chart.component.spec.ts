import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CycleTimeChartComponent } from './cycle-time-chart.component';
import { CycleTimePoint } from '../../../core/services/dashboard.service';

describe('CycleTimeChartComponent', () => {
  let component: CycleTimeChartComponent;
  let fixture: ComponentFixture<CycleTimeChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleTimeChartComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CycleTimeChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.latestValue()).toBe(0);
  });

  it('should compute latestValue from last data point', () => {
    const points: CycleTimePoint[] = [
      { week_start: '2026-02-17', avg_cycle_days: 3.5 },
      { week_start: '2026-02-24', avg_cycle_days: 2.8 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    expect(component.latestValue()).toBe('2.8');
  });

  it('should generate chart data with correct labels', () => {
    const points: CycleTimePoint[] = [
      { week_start: '2026-02-17', avg_cycle_days: 3.5 },
      { week_start: '2026-02-24', avg_cycle_days: 2.8 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels.length).toBe(2);
    expect(chartData.datasets.length).toBe(1);
    expect(chartData.datasets[0].data).toEqual([3.5, 2.8]);
  });

  it('should have line chart configuration', () => {
    expect(component.chartOptions.responsive).toBe(true);
    expect(component.chartOptions.maintainAspectRatio).toBe(false);
    expect(component.chartOptions.plugins.legend.display).toBe(false);
  });

  it('should format tooltip with days suffix', () => {
    const callback = component.chartOptions.plugins.tooltip.callbacks.label;
    const result = callback({ parsed: { y: 3.456 } });
    expect(result).toBe('3.5 days');
  });

  it('should set y-axis to begin at zero', () => {
    expect(component.chartOptions.scales.y.beginAtZero).toBe(true);
  });
});
