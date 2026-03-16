import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BurndownChartComponent } from './burndown-chart.component';
import { BurndownPoint } from '../../core/services/reports.service';

describe('BurndownChartComponent', () => {
  let component: BurndownChartComponent;
  let fixture: ComponentFixture<BurndownChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BurndownChartComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BurndownChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.latestRemaining()).toBe(0);
  });

  it('should compute latestRemaining from last data point', () => {
    const points: BurndownPoint[] = [
      { date: '2026-03-01', total_tasks: 20, remaining_tasks: 15 },
      { date: '2026-03-08', total_tasks: 22, remaining_tasks: 10 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    expect(component.latestRemaining()).toBe(10);
  });

  it('should generate chart data with two datasets', () => {
    const points: BurndownPoint[] = [
      { date: '2026-03-01', total_tasks: 20, remaining_tasks: 15 },
      { date: '2026-03-08', total_tasks: 22, remaining_tasks: 10 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels.length).toBe(2);
    expect(chartData.datasets.length).toBe(2);
    expect(chartData.datasets[0].label).toBe('Total Scope');
    expect(chartData.datasets[0].data).toEqual([20, 22]);
    expect(chartData.datasets[1].label).toBe('Remaining');
    expect(chartData.datasets[1].data).toEqual([15, 10]);
  });

  it('should have correct chart options', () => {
    expect(component.chartOptions.responsive).toBe(true);
    expect(component.chartOptions.maintainAspectRatio).toBe(false);
    expect(component.chartOptions.plugins.legend.display).toBe(false);
    expect(component.chartOptions.scales.y.beginAtZero).toBe(true);
  });

  it('should format tooltip with task count', () => {
    const callback = component.chartOptions.plugins.tooltip.callbacks.label;
    const result = callback({
      dataset: { label: 'Remaining' },
      parsed: { y: 12 },
    });
    expect(result).toBe('Remaining: 12 tasks');
  });
});
