import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { ProjectSettingsComponent } from './project-settings.component';
import { ProjectService } from '../../../core/services/project.service';

describe('ProjectSettingsComponent', () => {
  let component: ProjectSettingsComponent;
  let fixture: ComponentFixture<ProjectSettingsComponent>;
  let mockProjectService: any;

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

  let paramsSubject: Subject<any>;
  let queryParamsSubject: Subject<any>;

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
    queryParamsSubject = new Subject();

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

    await TestBed.configureTestingModule({
      imports: [ProjectSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: paramsSubject.asObservable(),
            queryParams: queryParamsSubject.asObservable(),
          },
        },
        { provide: ProjectService, useValue: mockProjectService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(ProjectSettingsComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectSettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('constructor effect / loadBoard', () => {
    it('should load board and members on route params change', () => {
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      fixture.detectChanges();

      expect(component.workspaceId).toBe('ws-1');
      expect(component.boardId).toBe('board-1');
      expect(mockProjectService.getBoard).toHaveBeenCalledWith('board-1');
      expect(component.board()?.name).toBe('Test Board');
      expect(component.loading()).toBe(false);
    });

    it('should load board members after board', () => {
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-1' });
      fixture.detectChanges();

      expect(mockProjectService.getProjectMembers).toHaveBeenCalledWith('board-1');
      expect(component.members().length).toBe(2);
    });

    it('should handle board load error', () => {
      mockProjectService.getBoard.mockReturnValue(
        throwError(() => new Error('fail')),
      );
      paramsSubject.next({ workspaceId: 'ws-1', projectId: 'board-bad' });
      fixture.detectChanges();

      expect(component.loading()).toBe(false);
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

  describe('onTabChange', () => {
    it('should update active tab', () => {
      component.onTabChange(3);
      expect(component.activeTab()).toBe(3);
    });
  });

  describe('tab query param', () => {
    it('should set activeTab from query param', () => {
      queryParamsSubject.next({ tab: '5' });
      fixture.detectChanges();

      expect(component.activeTab()).toBe(5);
    });

    it('should ignore invalid tab values', () => {
      queryParamsSubject.next({ tab: '99' });
      fixture.detectChanges();

      // Should remain at default (0)
      expect(component.activeTab()).toBe(0);
    });
  });
});
