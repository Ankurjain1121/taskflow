import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WorkspaceComponent } from './workspace.component';
import { WorkspaceService } from '../../core/services/workspace.service';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceSettingsDialogService } from '../../core/services/workspace-settings-dialog.service';

describe('WorkspaceComponent', () => {
  let component: WorkspaceComponent;
  let fixture: ComponentFixture<WorkspaceComponent>;

  const projectsSignal = signal<any[]>([]);

  const mockWorkspaceService = {
    get: vi.fn(),
    getMembers: vi.fn(),
  };

  const mockProjectService = {
    listBoards: vi.fn(),
    createBoard: vi.fn(),
    projects: projectsSignal,
  };

  const mockSettingsDialogService = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    projectsSignal.set([]);

    mockWorkspaceService.get.mockReturnValue(
      of({
        id: 'ws-1',
        name: 'Test Workspace',
        slug: 'test-workspace',
        description: null,
        logo_url: null,
        created_by_id: 'user-1',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      }),
    );

    mockWorkspaceService.getMembers.mockReturnValue(
      of([
        {
          user_id: 'u-1',
          name: 'Alice',
          email: 'alice@example.com',
          avatar_url: null,
          role: 'admin' as const,
          joined_at: '2026-01-01',
        },
      ]),
    );

    const boardData = [
      {
        id: 'b-1',
        workspace_id: 'ws-1',
        name: 'Board 1',
        description: 'First board',
        position: '0',
        created_at: '2026-01-15T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
      },
    ];
    mockProjectService.listBoards.mockReturnValue(
      of(boardData).pipe(
        require('rxjs').tap((boards: any) => projectsSignal.set(boards)),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [
        WorkspaceComponent,
        HttpClientTestingModule,
        RouterTestingModule.withRoutes([]),
      ],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: ProjectService, useValue: mockProjectService },
        {
          provide: WorkspaceSettingsDialogService,
          useValue: mockSettingsDialogService,
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => null }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadData', () => {
    it('should populate workspace, boards, and members signals', () => {
      component.workspaceId.set('ws-1');
      component.loadData();

      expect(component.workspace()?.name).toBe('Test Workspace');
      expect(component.boards()).toHaveLength(1);
      expect(component.members()).toHaveLength(1);
      expect(component.loading()).toBe(false);
    });

    it('should set error when workspace load fails', () => {
      mockWorkspaceService.get.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      component.workspaceId.set('ws-1');
      component.loadData();

      expect(component.error()).toContain('Could not load');
      expect(component.loading()).toBe(false);
    });
  });

  describe('getBoardAccentColor', () => {
    it('should cycle through accent colors', () => {
      const color0 = component.getBoardAccentColor(0);
      const color1 = component.getBoardAccentColor(1);
      expect(color0).not.toBe(color1);

      // Should cycle back
      const colorWrap = component.getBoardAccentColor(8);
      expect(colorWrap).toBe(color0);
    });

    it('should return a string starting with #', () => {
      expect(component.getBoardAccentColor(0)).toMatch(/^#/);
    });
  });

  describe('formatDate', () => {
    it('should format a date string', () => {
      const result = component.formatDate('2026-01-15T10:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  describe('openCreateProjectDialog', () => {
    it('should set showCreateProjectDialog to true', () => {
      expect(component.showCreateProjectDialog()).toBe(false);
      component.openCreateProjectDialog();
      expect(component.showCreateProjectDialog()).toBe(true);
    });
  });

  describe('onBoardCreated', () => {
    it('should call projectService.createBoard and reload data', () => {
      mockProjectService.createBoard.mockReturnValue(of({ id: 'b-new' }));

      component.workspaceId.set('ws-1');
      component.onBoardCreated({
        name: 'New Board',
        description: 'Board desc',
        template: 'kanban',
      });

      expect(mockProjectService.createBoard).toHaveBeenCalledWith('ws-1', {
        name: 'New Board',
        description: 'Board desc',
        template: 'kanban',
      });
    });
  });
});
