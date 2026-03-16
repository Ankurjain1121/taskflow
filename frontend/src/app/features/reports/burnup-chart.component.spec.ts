import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BurnupChartComponent } from './burnup-chart.component';
import { BurnupPoint } from '../../core/services/reports.service';

describe('BurnupChartComponent', () => {
  let component: BurnupChartComponent;
  let fixture: ComponentFixture<BurnupChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BurnupChartComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BurnupChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.latestCompleted()).toBe(0);
  });

  it('should compute latestCompleted from last data point', () => {
    const points: BurnupPoint[] = [
      { date: '2026-03-01', total_scope: 20, completed: 5 },
      { date: '2026-03-08', total_scope: 22, completed: 12 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    expect(component.latestCompleted()).toBe(12);
  });

  it('should generate chart data with two datasets', () => {
    const points: BurnupPoint[] = [
      { date: '2026-03-01', total_scope: 20, completed: 5 },
      { date: '2026-03-08', total_scope: 22, completed: 12 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels.length).toBe(2);
    expect(chartData.datasets.length).toBe(2);
    expect(chartData.datasets[0].label).toBe('Total Scope');
    expect(chartData.datasets[0].data).toEqual([20, 22]);
    expect(chartData.datasets[1].label).toBe('Completed');
    expect(chartData.datasets[1].data).toEqual([5, 12]);
  });

  it('should have area fill on completed line', () => {
    const points: BurnupPoint[] = [
      { date: '2026-03-01', total_scope: 20, completed: 5 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.datasets[1].fill).toBe(true);
    expect(chartData.datasets[0].fill).toBe(false);
  });

  it('should have correct chart options', () => {
    expect(component.chartOptions.responsive).toBe(true);
    expect(component.chartOptions.maintainAspectRatio).toBe(false);
    expect(component.chartOptions.scales.y.beginAtZero).toBe(true);
  });
});
