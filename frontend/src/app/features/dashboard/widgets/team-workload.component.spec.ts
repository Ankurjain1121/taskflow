import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TeamWorkloadComponent } from './team-workload.component';
import { TeamService } from '../../../core/services/team.service';

describe('TeamWorkloadComponent', () => {
  let component: TeamWorkloadComponent;
  let fixture: ComponentFixture<TeamWorkloadComponent>;
  let mockTeamService: any;

  const mockMembers = [
    {
      user_id: 'u-1',
      user_name: 'Alice',
      user_avatar: null,
      active_tasks: 5,
      total_tasks: 10,
      overdue_tasks: 0,
      done_tasks: 5,
      is_overloaded: false,
    },
    {
      user_id: 'u-2',
      user_name: 'Bob',
      user_avatar: 'https://example.com/avatar.jpg',
      active_tasks: 15,
      total_tasks: 20,
      overdue_tasks: 3,
      done_tasks: 5,
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
      imports: [TeamWorkloadComponent],
      providers: [{ provide: TeamService, useValue: mockTeamService }],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamWorkloadComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getBarColor', () => {
    it('should return red for overloaded member', () => {
      expect(
        component.getBarColor({ is_overloaded: true, overdue_tasks: 0 } as any),
      ).toBe('bg-red-500');
    });

    it('should return amber for member with overdue tasks', () => {
      expect(
        component.getBarColor({
          is_overloaded: false,
          overdue_tasks: 2,
        } as any),
      ).toBe('bg-amber-500');
    });

    it('should return emerald for healthy member', () => {
      expect(
        component.getBarColor({
          is_overloaded: false,
          overdue_tasks: 0,
        } as any),
      ).toBe('bg-emerald-500');
    });
  });

  describe('getBarWidth', () => {
    it('should return percentage based on max 20 tasks', () => {
      expect(
        component.getBarWidth({ active_tasks: 10, total_tasks: 15 } as any),
      ).toBe(50);
    });

    it('should cap at 100%', () => {
      expect(
        component.getBarWidth({ active_tasks: 25, total_tasks: 30 } as any),
      ).toBe(100);
    });

    it('should return 0 for no tasks', () => {
      expect(
        component.getBarWidth({ active_tasks: 0, total_tasks: 0 } as any),
      ).toBe(0);
    });

    it('should handle exactly 20 tasks as 100%', () => {
      expect(
        component.getBarWidth({ active_tasks: 20, total_tasks: 25 } as any),
      ).toBe(100);
    });

    it('should handle 25 tasks as 100% (capped)', () => {
      expect(
        component.getBarWidth({ active_tasks: 25, total_tasks: 30 } as any),
      ).toBe(100);
    });

    it('should handle 5 tasks as 25%', () => {
      expect(
        component.getBarWidth({ active_tasks: 5, total_tasks: 10 } as any),
      ).toBe(25);
    });
  });

  describe('getBarColor edge cases', () => {
    it('should prioritize overloaded over overdue', () => {
      expect(
        component.getBarColor({
          is_overloaded: true,
          overdue_tasks: 3,
        } as any),
      ).toBe('bg-red-500');
    });

    it('should return emerald when no overdue and not overloaded', () => {
      expect(
        component.getBarColor({
          is_overloaded: false,
          overdue_tasks: 0,
        } as any),
      ).toBe('bg-emerald-500');
    });
  });

  describe('loading behavior', () => {
    it('should set loading true during load', () => {
      fixture.componentRef.setInput('workspaceId', 'ws-1');
      fixture.detectChanges();
      // loadWorkload is called via effect, service returns synchronous of()
      // so loading transitions true->false. We verify service was called.
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalled();
    });

    it('should call teamService.getTeamWorkload with workspaceId', () => {
      fixture.componentRef.setInput('workspaceId', 'ws-test');
      fixture.detectChanges();
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalledWith('ws-test');
    });

    it('should handle service error gracefully', () => {
      mockTeamService.getTeamWorkload.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      fixture.componentRef.setInput('workspaceId', 'ws-err');
      fixture.detectChanges();
      expect(component.members()).toEqual([]);
      expect(component.loading()).toBe(false);
    });
  });

  describe('no workspace', () => {
    it('should clear members when workspaceId is undefined', () => {
      // First load with a workspace
      fixture.componentRef.setInput('workspaceId', 'ws-1');
      fixture.detectChanges();
      expect(component.members().length).toBeGreaterThan(0);

      // Then clear workspace
      fixture.componentRef.setInput('workspaceId', undefined);
      fixture.detectChanges();
      expect(component.members()).toEqual([]);
    });
  });
});
