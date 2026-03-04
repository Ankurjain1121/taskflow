import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { WorkloadBalanceComponent } from './workload-balance.component';
import { WorkloadBalanceEntry } from '../../../core/services/dashboard.service';

describe('WorkloadBalanceComponent', () => {
  let component: WorkloadBalanceComponent;
  let fixture: ComponentFixture<WorkloadBalanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkloadBalanceComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkloadBalanceComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
  });

  it('should compute chart height based on entry count', () => {
    const entries: WorkloadBalanceEntry[] = [
      { user_id: 'u1', user_name: 'Alice', active_tasks: 5 },
      { user_id: 'u2', user_name: 'Bob', active_tasks: 8 },
      { user_id: 'u3', user_name: 'Charlie', active_tasks: 12 },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    // Max(200, 3 * 32) = 200 -> "200px"
    expect(component.chartHeight()).toBe('200px');
  });

  it('should show higher chart for many users', () => {
    const entries: WorkloadBalanceEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push({
        user_id: `u${i}`,
        user_name: `User ${i}`,
        active_tasks: i,
      });
    }
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    // Max(200, 10 * 32) = 320 -> "320px"
    expect(component.chartHeight()).toBe('320px');
  });

  it('should color overloaded users in amber', () => {
    const entries: WorkloadBalanceEntry[] = [
      { user_id: 'u1', user_name: 'Alice', active_tasks: 5 },
      { user_id: 'u2', user_name: 'Bob', active_tasks: 15 }, // overloaded (>10)
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    const chartData = component.chartData();
    const bgColors = chartData.datasets[0].backgroundColor;

    // Alice: green, Bob: amber
    expect(bgColors[0]).toContain('16, 185, 129'); // green
    expect(bgColors[1]).toContain('245, 158, 11'); // amber
  });

  it('should generate horizontal bar chart data', () => {
    const entries: WorkloadBalanceEntry[] = [
      { user_id: 'u1', user_name: 'Alice', active_tasks: 5 },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    const chartData = component.chartData();
    expect(chartData.labels).toEqual(['Alice']);
    expect(chartData.datasets[0].data).toEqual([5]);
  });

  it('should have horizontal bar chart options', () => {
    expect(component.chartOptions.indexAxis).toBe('y');
    expect(component.chartOptions.responsive).toBe(true);
  });

  it('should expose overloaded threshold constant', () => {
    expect(component.threshold).toBe(10);
  });
});
