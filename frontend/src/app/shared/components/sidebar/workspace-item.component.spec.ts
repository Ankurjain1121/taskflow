import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { WorkspaceItemComponent } from './workspace-item.component';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { WorkspaceSettingsDialogService } from '../../../core/services/workspace-settings-dialog.service';

describe('WorkspaceItemComponent', () => {
  let component: WorkspaceItemComponent;
  let fixture: ComponentFixture<WorkspaceItemComponent>;
  let mockProjectService: any;
  let mockAuthService: any;
  let mockFavoritesService: any;
  let mockSettingsDialog: any;

  const testWorkspace = {
    id: 'ws-1',
    name: 'Alpha',
    slug: 'alpha',
    owner_id: 'u-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(async () => {
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

    mockProjectService = {
      listBoards: vi.fn().mockReturnValue(
        of([
          {
            id: 'b-1',
            workspace_id: 'ws-1',
            name: 'Project 1',
            description: '',
            position: '0',
            created_at: '',
            updated_at: '',
          },
          {
            id: 'b-2',
            workspace_id: 'ws-1',
            name: 'Project 2',
            description: '',
            position: '1',
            created_at: '',
            updated_at: '',
          },
        ]),
      ),
      createBoard: vi.fn().mockReturnValue(
        of({
          id: 'b-new',
          workspace_id: 'ws-1',
          name: 'New Project',
          description: '',
          position: '2',
          created_at: '',
          updated_at: '',
        }),
      ),
    };

    mockAuthService = {
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

    mockFavoritesService = {
      list: vi.fn().mockReturnValue(of([])),
      add: vi.fn().mockReturnValue(of({})),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };

    mockSettingsDialog = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceItemComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: FavoritesService, useValue: mockFavoritesService },
        { provide: WorkspaceSettingsDialogService, useValue: mockSettingsDialog },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspace', testWorkspace);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expand and load projects on init', () => {
    component.ngOnInit();
    expect(component.expanded()).toBe(true);
    expect(mockProjectService.listProjects).toHaveBeenCalledWith('ws-1');
    expect(component.projects().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should handle board load error', () => {
    mockProjectService.listProjects.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.ngOnInit();
    expect(component.loading()).toBe(false);
    expect(component.projects().length).toBe(0);
  });

  it('should compute workspace color from name', () => {
    const color = component.getColor();
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should toggle expanded state', () => {
    component.expanded.set(true);
    component.toggleExpanded();
    expect(component.expanded()).toBe(false);
    component.toggleExpanded();
    expect(component.expanded()).toBe(true);
  });

  it('should load projects when expanding from collapsed with empty projects', () => {
    component.expanded.set(false);
    component.projects.set([]);
    mockProjectService.listProjects.mockClear();

    component.toggleExpanded();
    expect(component.expanded()).toBe(true);
    expect(mockProjectService.listProjects).toHaveBeenCalledWith('ws-1');
  });

  it('should not reload projects when expanding if projects already loaded', () => {
    component.expanded.set(false);
    component.projects.set([{ id: 'b-1' } as any]);
    mockProjectService.listProjects.mockClear();

    component.toggleExpanded();
    expect(component.expanded()).toBe(true);
    expect(mockProjectService.listProjects).not.toHaveBeenCalled();
  });

  it('should determine canCreateBoard based on current user', () => {
    expect(component.canCreateBoard()).toBe(true);
    mockAuthService.currentUser.set(null as any);
    expect(component.canCreateBoard()).toBe(false);
  });

  it('should stop propagation and show dialog on add board click', () => {
    const event = { stopPropagation: vi.fn() } as any;
    component.onAddBoardClick(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.showCreateBoardDialog()).toBe(true);
  });

  it('should create board and add to list', () => {
    component.projects.set([]);
    component.expanded.set(false);

    component.onBoardCreated({
      name: 'New Project',
      description: 'desc',
      template: 'kanban',
    });

    expect(mockProjectService.createProject).toHaveBeenCalledWith('ws-1', {
      name: 'New Project',
      description: 'desc',
      template: 'kanban',
    });
    expect(component.projects().length).toBe(1);
    expect(component.expanded()).toBe(true);
  });

  it('should handle board creation error', () => {
    mockProjectService.createProject.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.projects.set([]);
    component.onBoardCreated({
      name: 'Fail Board',
      description: '',
      template: 'kanban',
    });
    expect(component.projects().length).toBe(0);
  });

  it('should not change expanded to true if already expanded on board create', () => {
    component.expanded.set(true);
    component.onBoardCreated({
      name: 'Project',
      description: '',
      template: 'kanban',
    });
    expect(component.expanded()).toBe(true);
  });
});
