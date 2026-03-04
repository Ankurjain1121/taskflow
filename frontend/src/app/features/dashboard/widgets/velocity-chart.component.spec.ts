import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { VelocityChartComponent } from './velocity-chart.component';
import { VelocityPoint } from '../../../core/services/dashboard.service';

describe('VelocityChartComponent', () => {
  let component: VelocityChartComponent;
  let fixture: ComponentFixture<VelocityChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VelocityChartComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VelocityChartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.avgVelocity()).toBe(0);
  });

  it('should compute average velocity', () => {
    const points: VelocityPoint[] = [
      { week_start: '2026-02-17', tasks_completed: 5 },
      { week_start: '2026-02-24', tasks_completed: 7 },
      { week_start: '2026-03-03', tasks_completed: 3 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    // (5 + 7 + 3) / 3 = 5
    expect(component.avgVelocity()).toBe(5);
  });

  it('should round average velocity', () => {
    const points: VelocityPoint[] = [
      { week_start: '2026-02-17', tasks_completed: 3 },
      { week_start: '2026-02-24', tasks_completed: 4 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    // (3 + 4) / 2 = 3.5 -> rounded to 4
    expect(component.avgVelocity()).toBe(4);
  });

  it('should generate bar chart data', () => {
    const points: VelocityPoint[] = [
      { week_start: '2026-02-17', tasks_completed: 5 },
      { week_start: '2026-02-24', tasks_completed: 7 },
    ];
    fixture.componentRef.setInput('data', points);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels.length).toBe(2);
    expect(chartData.datasets[0].data).toEqual([5, 7]);
  });

  it('should have bar chart options configured', () => {
    expect(component.chartOptions.responsive).toBe(true);
    expect(component.chartOptions.scales.y.beginAtZero).toBe(true);
  });
});
