import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { WorkspaceStateService } from './workspace-state.service';
import { WorkspaceService, Workspace } from './workspace.service';
import { of, throwError } from 'rxjs';

const MOCK_WORKSPACE: Workspace = {
  id: 'ws-1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  description: 'A test workspace',
  logo_url: null,
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('WorkspaceStateService', () => {
  let service: WorkspaceStateService;
  let mockWorkspaceService: { list: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();

    mockWorkspaceService = {
      list: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        WorkspaceStateService,
        { provide: WorkspaceService, useValue: mockWorkspaceService },
      ],
    });

    service = TestBed.inject(WorkspaceStateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should have null currentWorkspaceId when no stored value', () => {
      expect(service.currentWorkspaceId()).toBeNull();
    });

    it('should have empty workspaces array', () => {
      expect(service.workspaces()).toEqual([]);
    });

    it('should have loading false', () => {
      expect(service.loading()).toBe(false);
    });

    it('should load workspace id from localStorage on construction', () => {
      localStorage.setItem('taskbolt_active_workspace', 'ws-stored');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          WorkspaceStateService,
          { provide: WorkspaceService, useValue: mockWorkspaceService },
        ],
      });
      const freshService = TestBed.inject(WorkspaceStateService);

      expect(freshService.currentWorkspaceId()).toBe('ws-stored');
    });
  });

  describe('selectWorkspace()', () => {
    it('should set currentWorkspaceId and persist to localStorage', () => {
      service.selectWorkspace('ws-1');

      expect(service.currentWorkspaceId()).toBe('ws-1');
      expect(localStorage.getItem('taskbolt_active_workspace')).toBe('ws-1');
    });

    it('should clear currentWorkspaceId and localStorage when null', () => {
      service.selectWorkspace('ws-1');
      service.selectWorkspace(null);

      expect(service.currentWorkspaceId()).toBeNull();
      expect(localStorage.getItem('taskbolt_active_workspace')).toBeNull();
    });
  });

  describe('loadWorkspaces()', () => {
    it('should set loading to true then false on success', () => {
      mockWorkspaceService.list.mockReturnValue(of([MOCK_WORKSPACE]));

      service.loadWorkspaces();

      expect(service.loading()).toBe(false);
      expect(service.workspaces()).toEqual([MOCK_WORKSPACE]);
    });

    it('should populate workspaces signal on success', () => {
      const workspaces = [MOCK_WORKSPACE];
      mockWorkspaceService.list.mockReturnValue(of(workspaces));

      service.loadWorkspaces();

      expect(service.workspaces()).toEqual(workspaces);
    });

    it('should set loading to false on error', () => {
      mockWorkspaceService.list.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      service.loadWorkspaces();

      expect(service.loading()).toBe(false);
      expect(service.workspaces()).toEqual([]);
    });
  });
});
