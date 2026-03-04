import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { TeamOverviewComponent } from './team-overview.component';
import {
  TeamService,
  MemberWorkload,
} from '../../../core/services/team.service';
import { WebSocketService } from '../../../core/services/websocket.service';

describe('TeamOverviewComponent', () => {
  let component: TeamOverviewComponent;
  let fixture: ComponentFixture<TeamOverviewComponent>;
  let mockTeamService: any;
  let mockWsService: any;
  let messagesSubject: Subject<any>;

  const mockMembers: MemberWorkload[] = [
    {
      user_id: 'u-1',
      user_name: 'Alice',
      user_avatar: null,
      active_tasks: 5,
      overdue_tasks: 0,
      done_tasks: 10,
      total_tasks: 15,
      is_overloaded: false,
    },
    {
      user_id: 'u-2',
      user_name: 'Bob',
      user_avatar: null,
      active_tasks: 12,
      overdue_tasks: 3,
      done_tasks: 5,
      total_tasks: 17,
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

    messagesSubject = new Subject();

    mockTeamService = {
      getTeamWorkload: vi.fn().mockReturnValue(of(mockMembers)),
    };

    mockWsService = {
      connect: vi.fn(),
      send: vi.fn(),
      messages$: messagesSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [TeamOverviewComponent],
      providers: [
        { provide: TeamService, useValue: mockTeamService },
        { provide: WebSocketService, useValue: mockWsService },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ workspaceId: 'ws-1' }) },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TeamOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load team workload and setup websocket', () => {
      component.ngOnInit();
      expect(component.workspaceId).toBe('ws-1');
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalledWith('ws-1');
      expect(mockWsService.connect).toHaveBeenCalled();
      expect(mockWsService.send).toHaveBeenCalledWith('subscribe', {
        channel: 'workspace:ws-1',
      });
      expect(component.members()).toEqual(mockMembers);
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadTeamWorkload', () => {
    it('should load members', () => {
      component.workspaceId = 'ws-1';
      component.loadTeamWorkload();
      expect(component.members()).toEqual(mockMembers);
      expect(component.loading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('should handle errors', () => {
      mockTeamService.getTeamWorkload.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.workspaceId = 'ws-1';
      component.loadTeamWorkload();
      expect(component.error()).toBe(
        'Failed to load team workload. Please try again.',
      );
      expect(component.loading()).toBe(false);
    });
  });

  describe('websocket handling', () => {
    it('should reload on task events', () => {
      component.ngOnInit();
      vi.clearAllMocks();
      mockTeamService.getTeamWorkload.mockReturnValue(of(mockMembers));

      messagesSubject.next({ type: 'task:created', payload: {} });
      expect(mockTeamService.getTeamWorkload).toHaveBeenCalled();
    });

    it('should handle workload:updated event with direct data', () => {
      component.ngOnInit();
      const updatedMembers = [{ ...mockMembers[0], active_tasks: 8 }];
      messagesSubject.next({
        type: 'workload:updated',
        payload: { members: updatedMembers },
      });
      expect(component.members()).toEqual(updatedMembers);
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe from workspace channel', () => {
      component.workspaceId = 'ws-1';
      component.ngOnDestroy();
      expect(mockWsService.send).toHaveBeenCalledWith('unsubscribe', {
        channel: 'workspace:ws-1',
      });
    });
  });
});
