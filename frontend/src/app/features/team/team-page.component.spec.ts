import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TeamPageComponent } from './team-page.component';
import { WorkspaceService } from '../../core/services/workspace.service';
import { TeamService } from '../../core/services/team.service';

describe('TeamPageComponent', () => {
  let component: TeamPageComponent;
  let fixture: ComponentFixture<TeamPageComponent>;
  let mockWorkspaceService: any;
  let mockTeamService: any;

  beforeEach(async () => {
    mockWorkspaceService = {
      list: vi.fn().mockReturnValue(
        of([
          {
            id: 'ws-1',
            name: 'Workspace 1',
            description: null,
            logo_url: null,
            created_by_id: 'u-1',
            created_at: '',
            updated_at: '',
          },
        ]),
      ),
    };

    mockTeamService = {
      getTeamWorkload: vi.fn().mockReturnValue(
        of([
          {
            user_id: 'u-1',
            user_name: 'Alice',
            active_tasks: 5,
            done_tasks: 10,
            overdue_tasks: 1,
            is_overloaded: false,
          },
          {
            user_id: 'u-2',
            user_name: 'Bob Smith',
            active_tasks: 12,
            done_tasks: 3,
            overdue_tasks: 4,
            is_overloaded: true,
          },
        ]),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TeamPageComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: TeamService, useValue: mockTeamService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load team data on init', () => {
    component.ngOnInit();
    expect(mockWorkspaceService.list).toHaveBeenCalled();
    expect(mockTeamService.getTeamWorkload).toHaveBeenCalledWith('ws-1');
    expect(component.loading()).toBe(false);
    expect(component.workspaceTeams().length).toBe(1);
    expect(component.workspaceTeams()[0].members.length).toBe(2);
  });

  it('should handle empty workspaces', () => {
    mockWorkspaceService.list.mockReturnValue(of([]));
    component.loadTeamData();
    expect(component.workspaceTeams()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('should handle workspace list error', () => {
    mockWorkspaceService.list.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.loadTeamData();
    expect(component.error()).toBe(
      'Failed to load workspaces. Please try again.',
    );
    expect(component.loading()).toBe(false);
  });

  it('should compute initials', () => {
    expect(component.getInitials('Alice Smith')).toBe('AS');
    expect(component.getInitials('Bob')).toBe('B');
  });

  it('should compute total active tasks', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 5,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
      {
        user_id: 'u-2',
        user_name: 'B',
        active_tasks: 7,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    expect(component.getTotalActive(members)).toBe(12);
  });

  it('should compute average per member', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 6,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
      {
        user_id: 'u-2',
        user_name: 'B',
        active_tasks: 4,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    expect(component.getAvgPerMember(members)).toBe(5);
  });

  it('should return 0 average for empty members', () => {
    expect(component.getAvgPerMember([])).toBe(0);
  });

  it('should count overloaded members', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 5,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: true,
      },
      {
        user_id: 'u-2',
        user_name: 'B',
        active_tasks: 3,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    expect(component.getOverloadedCount(members)).toBe(1);
  });

  it('should sort members by active tasks descending', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 3,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
      {
        user_id: 'u-2',
        user_name: 'B',
        active_tasks: 8,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    const sorted = component.getSortedMembers(members);
    expect(sorted[0].user_name).toBe('B');
    expect(sorted[1].user_name).toBe('A');
  });

  it('should compute max tasks with minimum of 10', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 3,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    expect(component.getMaxTasks(members)).toBe(10);
  });

  it('should compute max tasks when above 10', () => {
    const members = [
      {
        user_id: 'u-1',
        user_name: 'A',
        active_tasks: 15,
        done_tasks: 0,
        overdue_tasks: 0,
        is_overloaded: false,
      },
    ];
    expect(component.getMaxTasks(members)).toBe(15);
  });

  it('should compute bar width percentage', () => {
    expect(component.getBarWidth(5, 10)).toBe(50);
    expect(component.getBarWidth(0, 10)).toBe(2); // minimum 2%
  });
});
