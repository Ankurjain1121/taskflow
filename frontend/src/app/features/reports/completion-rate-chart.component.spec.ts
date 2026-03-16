import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CompletionRateChartComponent } from './completion-rate-chart.component';
import { CompletionRatePoint } from '../../core/services/reports.service';

describe('CompletionRateChartComponent', () => {
  let component: CompletionRateChartComponent;
  let fixture: ComponentFixture<CompletionRateChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompletionRateChartComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CompletionRateChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.latestRate()).toBe(0);
  });

  it('should compute latest rate as percentage', () => {
    const points: CompletionRatePoint[] = [
      { week_start: '2026-03-01', completed: 3, total: 10 },
      { week_start: '2026-03-08', completed: 7, total: 10 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    expect(component.latestRate()).toBe(70);
  });

  it('should handle zero total gracefully', () => {
    const points: CompletionRatePoint[] = [
      { week_start: '2026-03-01', completed: 0, total: 0 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    expect(component.latestRate()).toBe(0);
  });

  it('should generate chart data with two datasets', () => {
    const points: CompletionRatePoint[] = [
      { week_start: '2026-03-01', completed: 3, total: 10 },
      { week_start: '2026-03-08', completed: 7, total: 12 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels.length).toBe(2);
    expect(chartData.datasets.length).toBe(2);
    expect(chartData.datasets[0].label).toBe('Completed');
    expect(chartData.datasets[0].data).toEqual([3, 7]);
    expect(chartData.datasets[1].label).toBe('Total');
    expect(chartData.datasets[1].data).toEqual([10, 12]);
  });

  it('should have correct chart options', () => {
    expect(component.chartOptions.responsive).toBe(true);
    expect(component.chartOptions.maintainAspectRatio).toBe(false);
    expect(component.chartOptions.scales.y.beginAtZero).toBe(true);
  });

  it('should format tooltip with task count', () => {
    const callback = component.chartOptions.plugins.tooltip.callbacks.label;
    const result = callback({
      dataset: { label: 'Completed' },
      parsed: { y: 7 },
    });
    expect(result).toBe('Completed: 7 tasks');
  });
});
