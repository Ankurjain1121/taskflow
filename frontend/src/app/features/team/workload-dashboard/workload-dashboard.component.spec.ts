import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { WorkloadDashboardComponent } from './workload-dashboard.component';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';

describe('WorkloadDashboardComponent', () => {
  let component: WorkloadDashboardComponent;
  let fixture: ComponentFixture<WorkloadDashboardComponent>;
  let mockTeamService: any;

  const mockMembers: MemberWorkload[] = [
    {
      user_id: 'u-1',
      user_name: 'Alice Smith',
      user_avatar: null,
      active_tasks: 3,
      overdue_tasks: 0,
      done_tasks: 10,
      total_tasks: 13,
      is_overloaded: false,
    },
    {
      user_id: 'u-2',
      user_name: 'Bob',
      user_avatar: 'https://example.com/bob.jpg',
      active_tasks: 8,
      overdue_tasks: 2,
      done_tasks: 5,
      total_tasks: 13,
      is_overloaded: false,
    },
    {
      user_id: 'u-3',
      user_name: 'Carol Jones',
      user_avatar: null,
      active_tasks: 15,
      overdue_tasks: 5,
      done_tasks: 3,
      total_tasks: 18,
      is_overloaded: true,
    },
  ];

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

    mockTeamService = {
      getTeamWorkload: vi.fn().mockReturnValue(of(mockMembers)),
    };

    await TestBed.configureTestingModule({
      imports: [WorkloadDashboardComponent],
      providers: [
        { provide: TeamService, useValue: mockTeamService },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ workspaceId: 'ws-1' }) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkloadDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load workload data', () => {
      component.ngOnInit();
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalledWith('ws-1');
      expect(component.members()).toEqual(mockMembers);
      expect(component.loading()).toBe(false);
    });

    it('should handle errors', () => {
      mockTeamService.getTeamWorkload.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      expect(component.error()).toBe(
        'Failed to load workload data. Please try again.',
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('computed signals', () => {
    beforeEach(() => {
      component.members.set(mockMembers);
    });

    it('sortedMembers should sort by active_tasks descending', () => {
      const sorted = component.sortedMembers();
      expect(sorted[0].user_name).toBe('Carol Jones');
      expect(sorted[1].user_name).toBe('Bob');
      expect(sorted[2].user_name).toBe('Alice Smith');
    });

    it('totalActiveTasks should sum active tasks', () => {
      expect(component.totalActiveTasks()).toBe(26); // 3+8+15
    });

    it('avgTasksPerMember should compute average', () => {
      expect(component.avgTasksPerMember()).toBe(9); // Math.round(26/3)
    });

    it('avgTasksPerMember should return 0 for empty list', () => {
      component.members.set([]);
      expect(component.avgTasksPerMember()).toBe(0);
    });

    it('overloadedCount should count overloaded members', () => {
      expect(component.overloadedCount()).toBe(1);
    });

    it('completionRate should compute percentage', () => {
      // total_tasks: 13+13+18=44, done: 10+5+3=18 => 18/44*100 = 41%
      expect(component.completionRate()).toBe(41);
    });

    it('completionRate should return 0 for empty list', () => {
      component.members.set([]);
      expect(component.completionRate()).toBe(0);
    });
  });

  describe('getInitials', () => {
    it('should extract initials', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
      expect(component.getInitials('Bob')).toBe('B');
    });
  });

  describe('getBarWidth', () => {
    it('should calculate width based on max tasks', () => {
      component.members.set(mockMembers);
      // maxTasks = max(15, 10) = 15. barWidth(3) = max(3/15 * 100, 2) = 20
      const width = component.getBarWidth(3);
      expect(width).toBeGreaterThan(2);
    });

    it('should return minimum 2%', () => {
      component.members.set(mockMembers);
      expect(component.getBarWidth(0)).toBe(2);
    });
  });
});
