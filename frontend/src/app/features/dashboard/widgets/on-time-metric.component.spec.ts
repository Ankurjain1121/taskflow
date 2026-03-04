import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { OnTimeMetricComponent } from './on-time-metric.component';
import { OnTimeMetric } from '../../../core/services/dashboard.service';

describe('OnTimeMetricComponent', () => {
  let component: OnTimeMetricComponent;
  let fixture: ComponentFixture<OnTimeMetricComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnTimeMetricComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OnTimeMetricComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no data', () => {
    fixture.detectChanges();
    expect(component.data()).toBeNull();
    expect(component.percentage()).toBe(0);
  });

  it('should compute percentage from data', () => {
    const metric: OnTimeMetric = {
      on_time_pct: 87.5,
      total_completed: 40,
      on_time_count: 35,
    };
    fixture.componentRef.setInput('data', metric);
    fixture.detectChanges();

    expect(component.percentage()).toBe(88); // rounded
  });

  it('should show green for >= 90% on time', () => {
    fixture.componentRef.setInput('data', {
      on_time_pct: 95,
      total_completed: 100,
      on_time_count: 95,
    });
    fixture.detectChanges();

    expect(component.gaugeColor()).toBe('rgb(16, 185, 129)');
  });

  it('should show amber for 80-89% on time', () => {
    fixture.componentRef.setInput('data', {
      on_time_pct: 85,
      total_completed: 100,
      on_time_count: 85,
    });
    fixture.detectChanges();

    expect(component.gaugeColor()).toBe('rgb(245, 158, 11)');
  });

  it('should show red for < 80% on time', () => {
    fixture.componentRef.setInput('data', {
      on_time_pct: 60,
      total_completed: 100,
      on_time_count: 60,
    });
    fixture.detectChanges();

    expect(component.gaugeColor()).toBe('rgb(239, 68, 68)');
  });

  it('should compute correct dash offset for 50%', () => {
    fixture.componentRef.setInput('data', {
      on_time_pct: 50,
      total_completed: 100,
      on_time_count: 50,
    });
    fixture.detectChanges();

    const circumference = 2 * Math.PI * 50;
    const expectedOffset = circumference - (50 / 100) * circumference;
    expect(component.dashOffset()).toBeCloseTo(expectedOffset, 1);
  });

  it('should compute correct dash array', () => {
    fixture.detectChanges();
    const circumference = 2 * Math.PI * 50;
    expect(component.dashArray()).toBe(`${circumference} ${circumference}`);
  });
});
