import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { ProjectSettingsComponent } from './project-settings.component';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from 'primeng/api';

describe('ProjectSettingsComponent', () => {
  let component: ProjectSettingsComponent;
  let fixture: ComponentFixture<ProjectSettingsComponent>;
  let mockProjectService: any;
  let mockConfirmationService: any;
  let paramsSubject: Subject<any>;
  let mockRouter: any;

  const mockBoard = {
    id: 'board-1',
    name: 'Test Board',
    description: 'A board',
    workspace_id: 'ws-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const mockMembers = [
    {
      user_id: 'u-1',
      name: 'Alice',
      email: 'alice@test.com',
      role: 'editor',
      avatar_url: null,
    },
    {
      user_id: 'u-2',
      name: 'Bob',
      email: 'bob@test.com',
      role: 'viewer',
      avatar_url: 'https://example.com/bob.jpg',
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

    paramsSubject = new Subject();
    const queryParamsSubject = new Subject();

    mockProjectService = {
      getBoard: vi.fn().mockReturnValue(of(mockBoard)),
      updateBoard: vi
        .fn()
        .mockReturnValue(of({ ...mockBoard, name: 'Updated Board' })),
      deleteBoard: vi.fn().mockReturnValue(of(void 0)),
      getProjectMembers: vi.fn().mockReturnValue(of(mockMembers)),
      inviteProjectMember: vi.fn().mockReturnValue(
        of({
          user_id: 'u-3',
          name: 'Charlie',
          email: 'charlie@test.com',
          role: 'viewer',
        }),
      ),
      updateProjectMemberRole: vi
        .fn()
        .mockReturnValue(of({ user_id: 'u-2', name: 'Bob', role: 'editor' })),
      removeProjectMember: vi.fn().mockReturnValue(of(void 0)),
    };

    mockRouter = { navigate: vi.fn() };

    mockConfirmationService = {
      confirm: vi.fn(),
    };

    const mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        role: 'Member',
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectSettingsComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: paramsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable(),
          },
        },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    mockRouter = TestBed.inject(Router);
    vi.spyOn(mockRouter, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(ProjectSettingsComponent);
    component = fixture.componentInstance;
    // Get the component-level ConfirmationService and spy on its confirm method
    const injector = fixture.debugElement.injector;
    mockConfirmationService = injector.get(ConfirmationService);
    vi.spyOn(mockConfirmationService, 'confirm');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit / loadBoard', () => {
    it('should load board and members on route params change', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      expect(component.workspaceId).toBe('ws-1');
      expect(component.boardId).toBe('board-1');
      expect(mockProjectService.getBoard).toHaveBeenCalledWith('board-1');
      expect(component.board()?.name).toBe('Test Board');
      expect(component.loading()).toBe(false);
    });

    it('should load board members after board', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      expect(mockProjectService.getProjectMembers).toHaveBeenCalledWith('board-1');
      expect(component.members().length).toBe(2);
    });

    it('should handle board load error', () => {
      mockProjectService.getBoard.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-bad' });
      expect(component.loading()).toBe(false);
    });
  });

  describe('canDeleteBoard', () => {
    it('should return true when user is logged in', () => {
      expect(component.canDeleteBoard()).toBe(true);
    });
  });

  describe('onBoardUpdated', () => {
    it('should update the board signal', () => {
      const updated = { ...mockBoard, name: 'New Name' };
      component.onBoardUpdated(updated as any);
      expect(component.board()?.name).toBe('New Name');
    });
  });

  describe('showError', () => {
    it('should set and clear error message', () => {
      vi.useFakeTimers();
      component.showError('Test error');
      expect(component.errorMessage()).toBe('Test error');
      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('onDeleteBoard', () => {
    it('should show confirmation and delete on accept', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onDeleteBoard();

      expect(mockProjectService.deleteBoard).toHaveBeenCalledWith('board-1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/workspace', 'ws-1']);
    });

    it('should not delete if board is null', () => {
      component.board.set(null);
      component.onDeleteBoard();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });

    it('should handle delete error', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockProjectService.deleteBoard.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onDeleteBoard();

      expect(component.deleting()).toBe(false);
    });
  });

  describe('onArchiveBoard', () => {
    it('should show confirmation and archive on accept', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onArchiveBoard();

      expect(mockProjectService.deleteBoard).toHaveBeenCalledWith('board-1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/workspace', 'ws-1']);
    });

    it('should not archive if board is null', () => {
      component.board.set(null);
      component.onArchiveBoard();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });

    it('should handle archive error', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockProjectService.deleteBoard.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onArchiveBoard();

      expect(component.archiving()).toBe(false);
    });
  });

  describe('onTabChange', () => {
    it('should update active tab', () => {
      component.onTabChange(3);
      expect(component.activeTab()).toBe(3);
    });
  });
});
