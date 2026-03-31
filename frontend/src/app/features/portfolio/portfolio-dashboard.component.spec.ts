import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PortfolioDashboardComponent } from './portfolio-dashboard.component';
import {
  PortfolioService,
  PortfolioProject,
  PortfolioMilestone,
} from '../../core/services/portfolio.service';

function makeProject(overrides: Partial<PortfolioProject> = {}): PortfolioProject {
  return {
    id: 'proj-1',
    name: 'Test Project',
    prefix: 'TP',
    description: 'A test project',
    background_color: '#3B82F6',
    progress_pct: 60,
    active_tasks: 12,
    overdue_tasks: 2,
    member_count: 4,
    health: 'on_track',
    next_milestone_name: 'Beta Launch',
    next_milestone_due: '2026-04-15',
    ...overrides,
  };
}

function makeMilestone(overrides: Partial<PortfolioMilestone> = {}): PortfolioMilestone {
  return {
    id: 'ms-1',
    name: 'Beta Launch',
    project_name: 'Test Project',
    project_color: '#3B82F6',
    due_date: '2026-04-15',
    completed_tasks: 5,
    total_tasks: 10,
    ...overrides,
  };
}

describe('PortfolioDashboardComponent', () => {
  let component: PortfolioDashboardComponent;
  let fixture: ComponentFixture<PortfolioDashboardComponent>;
  let portfolioServiceMock: {
    getPortfolio: ReturnType<typeof vi.fn>;
  };

  const mockProjects = [
    makeProject({ id: 'p1', active_tasks: 10, overdue_tasks: 1, progress_pct: 50 }),
    makeProject({ id: 'p2', active_tasks: 8, overdue_tasks: 3, progress_pct: 80 }),
  ];
  const mockMilestones = [
    makeMilestone({ id: 'ms-1', due_date: '2026-05-01' }),
    makeMilestone({ id: 'ms-2', due_date: '2026-04-01', name: 'Alpha' }),
  ];

  beforeEach(async () => {
    portfolioServiceMock = {
      getPortfolio: vi.fn().mockReturnValue(
        of({ projects: mockProjects, milestones: mockMilestones }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PortfolioDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'workspaceId' ? 'ws-123' : null) },
            },
          },
        },
        { provide: PortfolioService, useValue: portfolioServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioDashboardComponent);
    component = fixture.componentInstance;
  });

  // ---------------------------------------------------------------------------
  // Creation
  // ---------------------------------------------------------------------------
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('should start with loading true', () => {
      expect(component.loading()).toBe(true);
    });

    it('should start with empty projects', () => {
      expect(component.projects()).toEqual([]);
    });

    it('should start with empty milestones', () => {
      expect(component.milestones()).toEqual([]);
    });

    it('should set workspaceId from route', () => {
      fixture.detectChanges(); // triggers ngOnInit
      expect(component.workspaceId).toBe('ws-123');
    });
  });

  // ---------------------------------------------------------------------------
  // loadData
  // ---------------------------------------------------------------------------
  describe('loadData', () => {
    it('should load projects and milestones', () => {
      fixture.detectChanges();

      expect(portfolioServiceMock.getPortfolio).toHaveBeenCalledWith('ws-123');
      expect(component.projects()).toHaveLength(2);
      expect(component.milestones()).toHaveLength(2);
      expect(component.loading()).toBe(false);
    });

    it('should sort milestones by due date', () => {
      fixture.detectChanges();

      // Alpha (2026-04-01) should come before Beta (2026-05-01)
      expect(component.milestones()[0].name).toBe('Alpha');
      expect(component.milestones()[1].name).toBe('Beta Launch');
    });

    it('should set error on failure', () => {
      portfolioServiceMock.getPortfolio.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      fixture.detectChanges();

      expect(component.error()).toBe(true);
      expect(component.loading()).toBe(false);
    });

    it('should handle milestones without due dates (sort to end)', () => {
      portfolioServiceMock.getPortfolio.mockReturnValue(
        of({
          projects: [],
          milestones: [
            makeMilestone({ id: 'ms-no-date', due_date: null as unknown as string, name: 'No Date' }),
            makeMilestone({ id: 'ms-dated', due_date: '2026-03-01', name: 'Dated' }),
          ],
        }),
      );
      fixture.detectChanges();

      expect(component.milestones()[0].name).toBe('Dated');
      expect(component.milestones()[1].name).toBe('No Date');
    });
  });

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------
  describe('computed properties', () => {
    beforeEach(() => fixture.detectChanges());

    it('should compute totalActiveTasks', () => {
      expect(component.totalActiveTasks()).toBe(18); // 10 + 8
    });

    it('should compute totalOverdueTasks', () => {
      expect(component.totalOverdueTasks()).toBe(4); // 1 + 3
    });

    it('should compute avgProgress', () => {
      expect(component.avgProgress()).toBe(65); // (50 + 80) / 2
    });

    it('should return 0 avgProgress when no projects', () => {
      component.projects.set([]);
      expect(component.avgProgress()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------
  describe('getHealthClasses', () => {
    it('should return green classes for on_track', () => {
      expect(component.getHealthClasses('on_track')).toContain('green');
    });

    it('should return amber classes for at_risk', () => {
      expect(component.getHealthClasses('at_risk')).toContain('amber');
    });

    it('should return red classes for behind', () => {
      expect(component.getHealthClasses('behind')).toContain('red');
    });

    it('should return muted classes for unknown', () => {
      expect(component.getHealthClasses('unknown')).toContain('muted');
    });
  });

  describe('getHealthLabel', () => {
    it('should return "On Track" for on_track', () => {
      expect(component.getHealthLabel('on_track')).toBe('On Track');
    });

    it('should return "At Risk" for at_risk', () => {
      expect(component.getHealthLabel('at_risk')).toBe('At Risk');
    });

    it('should return "Behind" for behind', () => {
      expect(component.getHealthLabel('behind')).toBe('Behind');
    });

    it('should return raw value for unknown health', () => {
      expect(component.getHealthLabel('custom')).toBe('custom');
    });
  });

  describe('getProgressColor', () => {
    it('should return success color for >= 75%', () => {
      expect(component.getProgressColor(75)).toContain('success');
    });

    it('should return info color for >= 40%', () => {
      expect(component.getProgressColor(50)).toContain('info');
    });

    it('should return warning color for >= 10%', () => {
      expect(component.getProgressColor(20)).toContain('warning');
    });

    it('should return muted color for < 10%', () => {
      expect(component.getProgressColor(5)).toContain('muted');
    });
  });

  describe('getMilestoneProgress', () => {
    it('should calculate percentage', () => {
      expect(component.getMilestoneProgress(makeMilestone({ completed_tasks: 3, total_tasks: 10 }))).toBe(30);
    });

    it('should return 0 when total_tasks is 0', () => {
      expect(component.getMilestoneProgress(makeMilestone({ completed_tasks: 0, total_tasks: 0 }))).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('should format date without year for current year', () => {
      const result = component.formatDate('2026-04-15');
      expect(result).toContain('Apr');
      expect(result).toContain('15');
    });
  });

  describe('getMilestoneDateClass', () => {
    it('should return muted for null dates', () => {
      expect(component.getMilestoneDateClass(null)).toContain('muted');
    });

    it('should return destructive for past dates', () => {
      expect(component.getMilestoneDateClass('2020-01-01')).toContain('destructive');
    });

    it('should return muted for future dates', () => {
      expect(component.getMilestoneDateClass('2030-12-31')).toContain('muted');
    });
  });

  // ---------------------------------------------------------------------------
  // Template rendering
  // ---------------------------------------------------------------------------
  describe('template rendering', () => {
    it('should show stat cards and not loading after data loads', () => {
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
      const statCards = fixture.nativeElement.querySelectorAll('.stat-card');
      expect(statCards.length).toBe(4);
    });

    it('should show stats after loading', () => {
      fixture.detectChanges();

      const statCards = fixture.nativeElement.querySelectorAll('.stat-card');
      expect(statCards.length).toBe(4);
    });

    it('should show project cards', () => {
      fixture.detectChanges();

      const projectCards = fixture.nativeElement.querySelectorAll('.project-card');
      expect(projectCards.length).toBe(2);
    });

    it('should show milestones table', () => {
      fixture.detectChanges();

      const milestoneRows = fixture.nativeElement.querySelectorAll('.milestone-row');
      expect(milestoneRows.length).toBe(2);
    });

    it('should show empty state when no projects', () => {
      portfolioServiceMock.getPortfolio.mockReturnValue(
        of({ projects: [], milestones: [] }),
      );
      fixture.detectChanges();

      const emptyText = fixture.nativeElement.textContent;
      expect(emptyText).toContain('No projects yet');
    });

    it('should show error state with retry button', () => {
      portfolioServiceMock.getPortfolio.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      fixture.detectChanges();

      const errorText = fixture.nativeElement.textContent;
      expect(errorText).toContain('Failed to load');

      const retryBtn = fixture.nativeElement.querySelector('button');
      expect(retryBtn.textContent.trim()).toContain('Retry');
    });
  });
});
