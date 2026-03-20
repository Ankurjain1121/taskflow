import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReportsComponent } from './reports.component';
import { PortfolioService } from '../../core/services/portfolio.service';

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let mockPortfolioService: any;

  const mockProjects = [
    {
      id: 'p-1',
      name: 'Project Alpha',
      description: null,
      prefix: null,
      background_color: '#6366f1',
      created_at: '2026-01-01',
      total_tasks: 20,
      completed_tasks: 14,
      overdue_tasks: 2,
      active_tasks: 6,
      member_count: 3,
      progress_pct: 70,
      health: 'on_track',
      next_milestone_name: null,
      next_milestone_due: null,
    },
    {
      id: 'p-2',
      name: 'Project Beta',
      description: null,
      prefix: null,
      background_color: '#f59e0b',
      created_at: '2026-01-01',
      total_tasks: 10,
      completed_tasks: 3,
      overdue_tasks: 4,
      active_tasks: 7,
      member_count: 2,
      progress_pct: 30,
      health: 'behind',
      next_milestone_name: null,
      next_milestone_due: null,
    },
  ];

  beforeEach(async () => {
    mockPortfolioService = {
      getPortfolio: vi.fn().mockReturnValue(
        of({ projects: mockProjects, milestones: [] }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'workspaceId' ? 'ws-1' : null),
              },
            },
          },
        },
        { provide: PortfolioService, useValue: mockPortfolioService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(ReportsComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load workspace projects on init', () => {
    fixture.detectChanges();
    expect(mockPortfolioService.getPortfolio).toHaveBeenCalledWith('ws-1');
    expect(component.projects().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should compute health score from total/completed tasks', () => {
    fixture.detectChanges();
    // total tasks: 20 + 10 = 30, completed: 14 + 3 = 17
    // score = Math.round(17/30 * 100) = 57
    expect(component.healthScore()).toBe(57);
  });

  it('should compute totalActiveTasks', () => {
    fixture.detectChanges();
    expect(component.totalActiveTasks()).toBe(13);
  });

  it('should compute totalOverdueTasks', () => {
    fixture.detectChanges();
    expect(component.totalOverdueTasks()).toBe(6);
  });

  it('should show empty state when no projects', () => {
    mockPortfolioService.getPortfolio.mockReturnValue(
      of({ projects: [], milestones: [] }),
    );
    fixture.detectChanges();
    expect(component.projects().length).toBe(0);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(false);
  });

  it('should show error state on API failure', () => {
    mockPortfolioService.getPortfolio.mockReturnValue(
      throwError(() => new Error('API Error')),
    );
    fixture.detectChanges();
    expect(component.error()).toBe(true);
    expect(component.loading()).toBe(false);
  });

  it('should return green color for score >= 70', () => {
    expect(component.getProgressColor(75)).toBe('#22c55e');
  });

  it('should return amber color for score 40-69', () => {
    expect(component.getProgressColor(50)).toBe('#3b82f6');
  });

  it('should return correct health label', () => {
    expect(component.getHealthLabel('on_track')).toBe('On Track');
    expect(component.getHealthLabel('at_risk')).toBe('At Risk');
    expect(component.getHealthLabel('behind')).toBe('Behind');
  });

  it('should handle zero total tasks without NaN', () => {
    mockPortfolioService.getPortfolio.mockReturnValue(
      of({
        projects: [{
          ...mockProjects[0],
          total_tasks: 0,
          completed_tasks: 0,
          active_tasks: 0,
          overdue_tasks: 0,
          progress_pct: 0,
        }],
        milestones: [],
      }),
    );
    fixture.detectChanges();
    expect(component.healthScore()).toBe(0);
    expect(Number.isNaN(component.healthScore())).toBe(false);
  });
});
