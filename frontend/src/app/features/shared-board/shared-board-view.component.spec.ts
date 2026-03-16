import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SharedProjectViewComponent } from './shared-board-view.component';
import {
  ProjectShareService,
  SharedBoardAccess,
} from '../../core/services/project-share.service';

function createMockBoardAccess(
  overrides: Partial<SharedBoardAccess> = {},
): SharedBoardAccess {
  return {
    board_id: 'board-1',
    board_name: 'Shared Board',
    permissions: { view: true },
    columns: [
      { id: 'col-1', name: 'To Do', position: '0', color: '#6366f1' },
      { id: 'col-2', name: 'Done', position: '1', color: '#22c55e' },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Task A',
        description: null,
        priority: 'medium',
        due_date: null,
        status_id: 'col-1',
      },
      {
        id: 'task-2',
        title: 'Task B',
        description: 'Some desc',
        priority: 'high',
        due_date: '2026-03-01',
        status_id: 'col-2',
      },
    ],
    ...overrides,
  };
}

describe('SharedProjectViewComponent', () => {
  let component: SharedProjectViewComponent;
  let fixture: ComponentFixture<SharedProjectViewComponent>;
  let mockShareService: {
    accessSharedBoard: ReturnType<typeof vi.fn>;
  };

  function setupTestBed(tokenParam: string | null = 'abc-token') {
    const params: Record<string, string> = {};
    if (tokenParam) {
      params['token'] = tokenParam;
    }
    const paramMap = convertToParamMap(params);

    TestBed.configureTestingModule({
      imports: [SharedProjectViewComponent],
      providers: [
        { provide: ProjectShareService, useValue: mockShareService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap },
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SharedProjectViewComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    mockShareService = {
      accessSharedBoard: vi.fn().mockReturnValue(of(createMockBoardAccess())),
    };
  });

  it('should create', () => {
    setupTestBed();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should set error when no token provided', () => {
      setupTestBed(null);
      component.ngOnInit();

      expect(component.error()).toBe('Invalid share link');
      expect(component.loading()).toBe(false);
    });

    it('should load board when token is provided', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        of(createMockBoardAccess()),
      );
      setupTestBed('valid-token');
      component.ngOnInit();

      expect(mockShareService.accessSharedBoard).toHaveBeenCalledWith(
        'valid-token',
        undefined,
      );
      expect(component.board()).toBeTruthy();
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadBoard', () => {
    it('should set board on success', () => {
      const boardData = createMockBoardAccess();
      mockShareService.accessSharedBoard.mockReturnValue(of(boardData));
      setupTestBed('test-token');
      component.ngOnInit();

      expect(component.board()).toEqual(boardData);
      expect(component.loading()).toBe(false);
      expect(component.needsPassword()).toBe(false);
    });

    it('should set needsPassword on 401 with UNAUTHORIZED code', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        throwError(() => ({
          status: 401,
          error: { error: { code: 'UNAUTHORIZED' } },
        })),
      );

      setupTestBed('test-token');
      component.ngOnInit();

      expect(component.needsPassword()).toBe(true);
    });

    it('should set passwordError when password was provided on 401', () => {
      // First call succeeds (for ngOnInit), second call fails with 401
      mockShareService.accessSharedBoard
        .mockReturnValueOnce(of(createMockBoardAccess()))
        .mockReturnValueOnce(
          throwError(() => ({
            status: 401,
            error: { error: { code: 'UNAUTHORIZED' } },
          })),
        );

      setupTestBed('test-token');
      component.ngOnInit();

      // Now simulate password attempt failure
      component.loadBoard('wrong-password');

      expect(component.passwordError()).toBe('Incorrect password');
    });

    it('should set error for 400 with server message', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        throwError(() => ({
          status: 400,
          error: { error: { message: 'Link expired' } },
        })),
      );

      setupTestBed('test-token');
      component.ngOnInit();

      expect(component.error()).toBe('Link expired');
    });

    it('should set default error for 400 without message', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        throwError(() => ({
          status: 400,
          error: {},
        })),
      );

      setupTestBed('test-token');
      component.ngOnInit();

      expect(component.error()).toBe('This share link is no longer valid');
    });

    it('should set generic error for other status codes', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        throwError(() => ({
          status: 500,
          error: {},
        })),
      );

      setupTestBed('test-token');
      component.ngOnInit();

      expect(component.error()).toBe('Unable to access this board');
    });
  });

  describe('submitPassword', () => {
    it('should clear passwordError and call loadBoard with password', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        of(createMockBoardAccess()),
      );
      setupTestBed('test-token');
      component.ngOnInit();

      component.passwordError.set('old error');
      component.password = 'my-secret';

      component.submitPassword();

      expect(component.passwordError()).toBeNull();
      const lastCall =
        mockShareService.accessSharedBoard.mock.calls[
          mockShareService.accessSharedBoard.mock.calls.length - 1
        ];
      expect(lastCall[1]).toBe('my-secret');
    });
  });

  describe('getTasksForColumn', () => {
    it('should return tasks matching column id', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        of(createMockBoardAccess()),
      );
      setupTestBed('test-token');
      component.ngOnInit();

      const col1Tasks = component.getTasksForColumn('col-1');
      expect(col1Tasks).toHaveLength(1);
      expect(col1Tasks[0].title).toBe('Task A');
    });

    it('should return empty array when board is null', () => {
      setupTestBed('test-token');
      component.board.set(null);
      expect(component.getTasksForColumn('col-1')).toEqual([]);
    });

    it('should return empty array for nonexistent column', () => {
      mockShareService.accessSharedBoard.mockReturnValue(
        of(createMockBoardAccess()),
      );
      setupTestBed('test-token');
      component.ngOnInit();
      expect(component.getTasksForColumn('nonexistent')).toEqual([]);
    });
  });

  describe('getPriorityClass', () => {
    beforeEach(() => {
      setupTestBed();
    });

    it('should return red classes for urgent', () => {
      expect(component.getPriorityClass('urgent')).toBe(
        'bg-red-100 text-red-800',
      );
    });

    it('should return orange classes for high', () => {
      expect(component.getPriorityClass('high')).toBe(
        'bg-orange-100 text-orange-800',
      );
    });

    it('should return blue classes for medium', () => {
      expect(component.getPriorityClass('medium')).toBe(
        'bg-blue-100 text-blue-800',
      );
    });

    it('should return secondary classes for low', () => {
      expect(component.getPriorityClass('low')).toContain(
        'bg-[var(--secondary)]',
      );
    });

    it('should return empty string for unknown', () => {
      expect(component.getPriorityClass('unknown')).toBe('');
    });
  });
});
