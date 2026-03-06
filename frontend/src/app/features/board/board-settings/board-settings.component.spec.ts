import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { BoardSettingsComponent } from './board-settings.component';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmationService } from 'primeng/api';

describe('BoardSettingsComponent', () => {
  let component: BoardSettingsComponent;
  let fixture: ComponentFixture<BoardSettingsComponent>;
  let mockProjectService: any;
  let mockConfirmationService: any;
  let paramsSubject: Subject<any>;
  let mockRouter: any;

  const mockProject = {
    id: 'board-1',
    name: 'Test Project',
    description: 'A project',
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
      getProject: vi.fn().mockReturnValue(of(mockProject)),
      updateProject: vi
        .fn()
        .mockReturnValue(of({ ...mockProject, name: 'Updated Project' })),
      deleteProject: vi.fn().mockReturnValue(of(void 0)),
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
      imports: [BoardSettingsComponent, HttpClientTestingModule],
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

    fixture = TestBed.createComponent(BoardSettingsComponent);
    component = fixture.componentInstance;
    // Get the component-level ConfirmationService and spy on its confirm method
    const injector = fixture.debugElement.injector;
    mockConfirmationService = injector.get(ConfirmationService);
    vi.spyOn(mockConfirmationService, 'confirm');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit / loadProject', () => {
    it('should load project and members on route params change', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      expect(component.workspaceId).toBe('ws-1');
      expect(component.projectId).toBe('board-1');
      expect(mockProjectService.getProject).toHaveBeenCalledWith('board-1');
      expect(component.project()?.name).toBe('Test Project');
      expect(component.loading()).toBe(false);
    });

    it('should load project members after board', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      expect(mockProjectService.getProjectMembers).toHaveBeenCalledWith('board-1');
      expect(component.members().length).toBe(2);
    });

    it('should patch form with board data', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      expect(component.form.value.name).toBe('Test Project');
      expect(component.form.value.description).toBe('A project');
    });

    it('should handle board load error', () => {
      mockProjectService.getProject.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-bad' });
      expect(component.loading()).toBe(false);
    });
  });

  describe('canDeleteProject', () => {
    it('should return true when user is logged in', () => {
      expect(component.canDeleteProject()).toBe(true);
    });
  });

  describe('getInitials', () => {
    it('should compute initials from name', () => {
      expect(component.getInitials('Alice Smith')).toBe('AS');
    });

    it('should return ? for undefined', () => {
      expect(component.getInitials(undefined as any)).toBe('?');
    });

    it('should handle single name', () => {
      expect(component.getInitials('Bob')).toBe('B');
    });
  });

  describe('onSave', () => {
    it('should save project and mark form pristine', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      component.form.patchValue({ name: 'Updated Project' });
      component.form.markAsDirty();

      component.onSave();

      expect(mockProjectService.updateProject).toHaveBeenCalledWith('board-1', {
        name: 'Updated Project',
        description: 'A project',
      });
      expect(component.saving()).toBe(false);
      expect(component.project()?.name).toBe('Updated Project');
    });

    it('should not save if form is invalid', () => {
      component.form.patchValue({ name: '' });
      component.form.controls['name'].markAsTouched();
      component.onSave();
      expect(mockProjectService.updateProject).not.toHaveBeenCalled();
    });

    it('should handle save error', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockProjectService.updateProject.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      component.form.patchValue({ name: 'New Name' });
      component.form.markAsDirty();
      component.onSave();
      expect(component.saving()).toBe(false);
    });
  });

  describe('onInviteMember', () => {
    it('should show invite dialog', () => {
      component.onInviteMember();
      expect(component.showInviteDialog()).toBe(true);
    });
  });

  describe('onInviteResult', () => {
    it('should add new member to list', () => {
      component.projectId = 'board-1';
      component.members.set([...mockMembers] as any);
      component.onInviteResult({ email: 'charlie@test.com', role: 'viewer' });
      expect(mockProjectService.inviteProjectMember).toHaveBeenCalledWith(
        'board-1',
        {
          email: 'charlie@test.com',
          role: 'viewer',
        },
      );
      expect(component.members().length).toBe(3);
    });
  });

  describe('onMemberRoleChange', () => {
    it('should update member role', () => {
      component.projectId = 'board-1';
      component.members.set([...mockMembers] as any);
      component.onMemberRoleChange(mockMembers[1] as any, 'editor');
      expect(mockProjectService.updateProjectMemberRole).toHaveBeenCalledWith(
        'board-1',
        'u-2',
        { role: 'editor' },
      );
    });
  });

  describe('onRemoveMember', () => {
    it('should show confirmation dialog', () => {
      component.onRemoveMember(mockMembers[0] as any);
      expect(mockConfirmationService.confirm).toHaveBeenCalled();
    });

    it('should remove member when confirmed', () => {
      component.projectId = 'board-1';
      component.members.set([...mockMembers] as any);
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );
      component.onRemoveMember(mockMembers[1] as any);
      expect(mockProjectService.removeProjectMember).toHaveBeenCalledWith(
        'board-1',
        'u-2',
      );
      expect(component.members().length).toBe(1);
    });
  });

  describe('onDeleteProject', () => {
    it('should show confirmation and delete on accept', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onDeleteProject();

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith('board-1');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/workspace', 'ws-1']);
    });

    it('should not delete if board is null', () => {
      component.project.set(null);
      component.onDeleteProject();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
    });

    it('should handle delete error', () => {
      component.ngOnInit();
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      mockProjectService.deleteProject.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      mockConfirmationService.confirm.mockImplementation((opts: any) =>
        opts.accept(),
      );

      component.onDeleteProject();

      expect(component.deleting()).toBe(false);
    });
  });
});
