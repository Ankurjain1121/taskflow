import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { WorkspaceSettingsComponent } from './workspace-settings.component';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { BoardService } from '../../../core/services/board.service';
import { AuthService } from '../../../core/services/auth.service';

describe('WorkspaceSettingsComponent', () => {
  let component: WorkspaceSettingsComponent;
  let fixture: ComponentFixture<WorkspaceSettingsComponent>;
  let mockWorkspaceService: any;
  let mockBoardService: any;
  let paramsSubject: Subject<any>;

  beforeEach(async () => {
    paramsSubject = new Subject();

    mockWorkspaceService = {
      get: vi.fn().mockReturnValue(of({
        id: 'ws-1',
        name: 'My Workspace',
        slug: 'my-ws',
        owner_id: 'u-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      })),
      getMembers: vi.fn().mockReturnValue(of([
        { id: 'u-1', name: 'Alice', email: 'alice@test.com', role: 'owner', joined_at: '2026-01-01', user_id: 'u-1' },
      ])),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };

    mockBoardService = {
      listBoards: vi.fn().mockReturnValue(of([
        { id: 'b-1', name: 'Board 1', workspace_id: 'ws-1', created_at: '', updated_at: '' },
      ])),
    };

    const mockAuthService = {
      currentUser: signal({
        id: 'u-1',
        name: 'Alice',
        email: 'alice@test.com',
        avatar_url: null,
        role: 'Member' as const,
        tenant_id: 't-1',
        onboarding_completed: true,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceSettingsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { params: paramsSubject.asObservable() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: BoardService, useValue: mockBoardService },
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceSettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load workspace on route params change', () => {
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-1' });
    expect(component.workspaceId).toBe('ws-1');
    expect(mockWorkspaceService.get).toHaveBeenCalledWith('ws-1');
    expect(component.workspace()?.name).toBe('My Workspace');
  });

  it('should load members after workspace', () => {
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-1' });
    expect(mockWorkspaceService.getMembers).toHaveBeenCalledWith('ws-1');
    expect(component.members().length).toBe(1);
  });

  it('should load boards after workspace', () => {
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-1' });
    expect(mockBoardService.listBoards).toHaveBeenCalledWith('ws-1');
    expect(component.boards().length).toBe(1);
  });

  it('should set loading to false after members load', () => {
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-1' });
    expect(component.loading()).toBe(false);
  });

  it('should handle workspace load error', () => {
    mockWorkspaceService.get.mockReturnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-bad' });
    expect(component.loading()).toBe(false);
  });

  it('should check isAdmin correctly for owner', () => {
    component.ngOnInit();
    paramsSubject.next({ workspaceId: 'ws-1' });
    expect(component.isAdmin()).toBe(true);
  });

  it('should return false for isAdmin when no user', () => {
    // Set currentUser to null temporarily
    const authService = TestBed.inject(AuthService);
    (authService.currentUser as any).set(null);
    expect(component.isAdmin()).toBe(false);
    // Reset
    (authService.currentUser as any).set({
      id: 'u-1',
      name: 'Alice',
      email: 'alice@test.com',
      avatar_url: null,
      role: 'Member',
      tenant_id: 't-1',
      onboarding_completed: true,
    });
  });

  it('should update workspace on save', () => {
    const updated = {
      id: 'ws-1',
      name: 'Updated',
      slug: 'updated',
      owner_id: 'u-1',
      created_at: '2026-01-01',
      updated_at: '2026-02-01',
    };
    component.onWorkspaceSaved(updated as any);
    expect(component.workspace()?.name).toBe('Updated');
  });

  it('should remove member from list', () => {
    component.members.set([
      { user_id: 'u-1', name: 'Alice' } as any,
      { user_id: 'u-2', name: 'Bob' } as any,
    ]);
    component.onMemberRemoved('u-2');
    expect(component.members().length).toBe(1);
    expect(component.members()[0].user_id).toBe('u-1');
  });
});
