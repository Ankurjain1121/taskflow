import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OverdueTasksTableComponent } from './overdue-tasks-table.component';
import { DashboardService } from '../../../core/services/dashboard.service';

describe('OverdueTasksTableComponent', () => {
  let component: OverdueTasksTableComponent;
  let fixture: ComponentFixture<OverdueTasksTableComponent>;
  let mockDashboardService: any;
  let mockRouter: any;

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    mockDashboardService = {
      getOverdueTasks: vi.fn().mockReturnValue(
        of([
          {
            id: 't-1',
            title: 'Overdue 1',
            project_name: 'Project A',
            priority: 'urgent',
            days_overdue: 5,
          },
          {
            id: 't-2',
            title: 'Overdue 2',
            project_name: 'Project B',
            priority: 'high',
            days_overdue: 2,
          },
        ]),
      ),
    };

    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [OverdueTasksTableComponent],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OverdueTasksTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should load overdue tasks', async () => {
      await component.loadData();
      expect(mockDashboardService.getOverdueTasks).toHaveBeenCalledWith(
        10,
        undefined,
      );
      expect(component.tasks().length).toBe(2);
      expect(component.loading()).toBe(false);
    });

    it('should handle null response', async () => {
      mockDashboardService.getOverdueTasks.mockReturnValue(of(null));
      await component.loadData();
      expect(component.tasks()).toEqual([]);
    });

    it('should handle error', async () => {
      mockDashboardService.getOverdueTasks.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      await component.loadData();
      expect(component.loading()).toBe(false);
    });
  });

  describe('navigateToTask', () => {
    it('should navigate to task route', () => {
      component.navigateToTask({ id: 't-1' } as any);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/task', 't-1']);
    });
  });

  describe('getPriorityClass', () => {
    it('should return red classes for urgent', () => {
      expect(component.getPriorityClass('urgent')).toContain('red');
    });

    it('should return orange classes for high', () => {
      expect(component.getPriorityClass('high')).toContain('orange');
    });

    it('should return blue classes for medium', () => {
      expect(component.getPriorityClass('medium')).toContain('blue');
    });

    it('should return gray classes for low', () => {
      expect(component.getPriorityClass('low')).toContain('gray');
    });

    it('should return default gray for unknown priority', () => {
      expect(component.getPriorityClass('other')).toContain('gray');
    });
  });
});
