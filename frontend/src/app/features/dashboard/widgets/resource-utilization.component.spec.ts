import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ResourceUtilizationComponent } from './resource-utilization.component';
import { ResourceUtilizationEntry } from '../../../core/services/reports.service';

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
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No utilization data yet');
  });

  describe('chartHeight computed', () => {
    it('should return minimum 200px for small datasets', () => {
      const entries: ResourceUtilizationEntry[] = [
        { user_id: 'u1', user_name: 'Alice', total_estimated_hours: 10, total_actual_hours: 8, task_count: 5 },
      ];
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      // 1 * 40 = 40, Math.max(200, 40) = 200
      expect(component.chartHeight()).toBe('200px');
    });

    it('should scale with entry count (count * 40)', () => {
      const entries: ResourceUtilizationEntry[] = Array.from({ length: 8 }, (_, i) => ({
        user_id: `u${i}`,
        user_name: `User ${i}`,
        total_estimated_hours: 10,
        total_actual_hours: 8,
        task_count: 5,
      }));
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      // 8 * 40 = 320, Math.max(200, 320) = 320
      expect(component.chartHeight()).toBe('320px');
    });
  });

  describe('chartData computed', () => {
    const entries: ResourceUtilizationEntry[] = [
      { user_id: 'u1', user_name: 'Alice', total_estimated_hours: 10, total_actual_hours: 8, task_count: 5 },
      { user_id: 'u2', user_name: 'Bob', total_estimated_hours: 12, total_actual_hours: 14, task_count: 7 },
    ];

    it('should generate grouped bar chart with Planned and Actual datasets', () => {
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const chartData = component.chartData();
      expect(chartData.datasets.length).toBe(2);
      expect(chartData.datasets[0].label).toBe('Planned');
      expect(chartData.datasets[1].label).toBe('Actual');
    });

    it('labels should be user names', () => {
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const chartData = component.chartData();
      expect(chartData.labels).toEqual(['Alice', 'Bob']);
    });

    it('Planned dataset should use blue colors', () => {
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const planned = component.chartData().datasets[0];
      expect(planned.backgroundColor).toContain('59, 130, 246');
      expect(planned.borderColor).toContain('59, 130, 246');
    });

    it('Actual dataset should use green for normal, amber for over-budget', () => {
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const actual = component.chartData().datasets[1];
      const bgColors = actual.backgroundColor as string[];
      // Alice: 8 actual <= 10 planned -> green
      expect(bgColors[0]).toContain('16, 185, 129');
      // Bob: 14 actual > 12 planned -> amber
      expect(bgColors[1]).toContain('245, 158, 11');
    });
  });

  describe('chart options', () => {
    it('should use horizontal bars (indexAxis: y)', () => {
      expect(component.chartOptions.indexAxis).toBe('y');
    });

    it('should have tooltip with hours formatting', () => {
      const callback = component.chartOptions.plugins.tooltip.callbacks.label;
      const result = callback({ dataset: { label: 'Planned' }, parsed: { x: 8.333 } });
      expect(result).toBe('Planned: 8.3h');
    });
  });

  describe('over-budget detection', () => {
    it('should color actual hours amber when exceeding planned', () => {
      const entries: ResourceUtilizationEntry[] = [
        { user_id: 'u1', user_name: 'Alice', total_estimated_hours: 10, total_actual_hours: 15, task_count: 5 },
      ];
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const actual = component.chartData().datasets[1];
      expect((actual.backgroundColor as string[])[0]).toContain('245, 158, 11');
    });

    it('should color actual hours green when within budget', () => {
      const entries: ResourceUtilizationEntry[] = [
        { user_id: 'u1', user_name: 'Alice', total_estimated_hours: 10, total_actual_hours: 8, task_count: 5 },
      ];
      fixture.componentRef.setInput('data', entries);
      fixture.detectChanges();

      const actual = component.chartData().datasets[1];
      expect((actual.backgroundColor as string[])[0]).toContain('16, 185, 129');
    });
  });
});
