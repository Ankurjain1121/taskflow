import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportHubComponent } from './report-hub.component';

describe('ReportHubComponent', () => {
  let component: ReportHubComponent;
  let fixture: ComponentFixture<ReportHubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportHubComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportHubComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default active tab as burndown', () => {
    expect(component.activeTab()).toBe('burndown');
  });

  it('should have default range as Last 30 days', () => {
    expect(component.selectedRange().label).toBe('Last 30 days');
    expect(component.selectedRange().days).toBe(30);
  });

  it('should start with no project selected', () => {
    expect(component.selectedProjectId()).toBeNull();
    expect(component.selectedWorkspaceId()).toBeNull();
  });

  it('should clear chart data on workspace change', () => {
    component.burndownData.set([
      { date: '2026-03-01', total_tasks: 10, remaining_tasks: 5 },
    ]);
    component.selectedWorkspaceId.set(null);
    component.onWorkspaceChange();

    expect(component.burndownData()).toEqual([]);
    expect(component.projects()).toEqual([]);
  });

  it('should switch active tab', () => {
    component.onTabChange('burnup');
    expect(component.activeTab()).toBe('burnup');
  });

  it('should have four range options', () => {
    expect(component.rangeOptions.length).toBe(4);
  });
});
