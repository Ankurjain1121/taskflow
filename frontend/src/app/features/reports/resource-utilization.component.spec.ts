import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ResourceUtilizationComponent } from './resource-utilization.component';
import { ResourceEntry } from '../../core/services/reports.service';

describe('ResourceUtilizationComponent', () => {
  let component: ResourceUtilizationComponent;
  let fixture: ComponentFixture<ResourceUtilizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourceUtilizationComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ResourceUtilizationComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toEqual([]);
    expect(component.aggregatedData()).toEqual([]);
  });

  it('should aggregate entries by user', () => {
    const entries: ResourceEntry[] = [
      {
        user_id: 'u1',
        user_name: 'Alice',
        task_count: 3,
        hours_logged: 10,
        week_start: '2026-03-01',
      },
      {
        user_id: 'u1',
        user_name: 'Alice',
        task_count: 5,
        hours_logged: 8,
        week_start: '2026-03-08',
      },
      {
        user_id: 'u2',
        user_name: 'Bob',
        task_count: 4,
        hours_logged: 0,
        week_start: '2026-03-01',
      },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    const agg = component.aggregatedData();
    expect(agg.length).toBe(2);

    const alice = agg.find((e) => e.user_name === 'Alice');
    expect(alice?.task_count).toBe(8);
    expect(alice?.hours_logged).toBe(18);

    const bob = agg.find((e) => e.user_name === 'Bob');
    expect(bob?.task_count).toBe(4);
  });

  it('should detect hours logged', () => {
    const entries: ResourceEntry[] = [
      {
        user_id: 'u1',
        user_name: 'Alice',
        task_count: 3,
        hours_logged: 10,
        week_start: '2026-03-01',
      },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    expect(component.hasHoursLogged()).toBe(true);
  });

  it('should not show hours dataset when all zeros', () => {
    const entries: ResourceEntry[] = [
      {
        user_id: 'u1',
        user_name: 'Alice',
        task_count: 5,
        hours_logged: 0,
        week_start: '2026-03-01',
      },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    expect(component.hasHoursLogged()).toBe(false);
    const chartData = component.chartData();
    expect(chartData.datasets.length).toBe(1);
  });

  it('should color overloaded users in amber', () => {
    const entries: ResourceEntry[] = [
      {
        user_id: 'u1',
        user_name: 'Alice',
        task_count: 5,
        hours_logged: 0,
        week_start: '2026-03-01',
      },
      {
        user_id: 'u2',
        user_name: 'Bob',
        task_count: 15,
        hours_logged: 0,
        week_start: '2026-03-01',
      },
    ];
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    const chartData = component.chartData();
    const bgColors = chartData.datasets[0]
      .backgroundColor as unknown as string[];
    expect(bgColors[0]).toContain('16, 185, 129');
    expect(bgColors[1]).toContain('245, 158, 11');
  });

  it('should compute chart height based on user count', () => {
    const entries: ResourceEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push({
        user_id: `u${i}`,
        user_name: `User ${i}`,
        task_count: i,
        hours_logged: 0,
        week_start: '2026-03-01',
      });
    }
    fixture.componentRef.setInput('data', entries);
    fixture.detectChanges();

    // Max(200, 10 * 36) = 360 -> "360px"
    expect(component.chartHeight()).toBe('360px');
  });

  it('should have horizontal bar chart options', () => {
    expect(component.chartOptions.indexAxis).toBe('y');
    expect(component.chartOptions.responsive).toBe(true);
  });

  it('should expose overloaded threshold constant', () => {
    expect(component.threshold).toBe(10);
  });
});
