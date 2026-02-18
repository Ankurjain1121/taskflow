import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  BoardService,
  Board,
  Column,
  CreateBoardRequest,
  UpdateBoardRequest,
  CreateColumnRequest,
  UpdateColumnRequest,
  ReorderColumnRequest,
  BoardMember,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  BoardFullResponse,
} from './board.service';

const MOCK_BOARD: Board = {
  id: 'board-1',
  workspace_id: 'ws-1',
  name: 'Test Board',
  description: 'A test board',
  position: '1000',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_COLUMN: Column = {
  id: 'col-1',
  board_id: 'board-1',
  name: 'To Do',
  position: '1000',
  color: '#3b82f6',
  status_mapping: null,
  wip_limit: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_MEMBER: BoardMember = {
  user_id: 'user-1',
  board_id: 'board-1',
  role: 'editor',
  name: 'Test User',
  email: 'test@example.com',
  avatar_url: null,
};

describe('BoardService', () => {
  let service: BoardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BoardService],
    });
    service = TestBed.inject(BoardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listBoards()', () => {
    it('should GET /api/workspaces/:workspaceId/boards', () => {
      const boards = [MOCK_BOARD];

      service.listBoards('ws-1').subscribe((result) => {
        expect(result).toEqual(boards);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/boards');
      expect(req.request.method).toBe('GET');
      req.flush(boards);
    });
  });

  describe('getBoard()', () => {
    it('should GET /api/boards/:boardId', () => {
      service.getBoard('board-1').subscribe((board) => {
        expect(board).toEqual(MOCK_BOARD);
      });

      const req = httpMock.expectOne('/api/boards/board-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_BOARD);
    });
  });

  describe('createBoard()', () => {
    it('should POST /api/workspaces/:workspaceId/boards with body', () => {
      const createReq: CreateBoardRequest = {
        name: 'New Board',
        description: 'Board description',
        template: 'kanban',
      };

      service.createBoard('ws-1', createReq).subscribe((board) => {
        expect(board).toEqual(MOCK_BOARD);
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/boards');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_BOARD);
    });
  });

  describe('updateBoard()', () => {
    it('should PATCH /api/boards/:boardId with body', () => {
      const updateReq: UpdateBoardRequest = { name: 'Renamed Board' };

      service.updateBoard('board-1', updateReq).subscribe((board) => {
        expect(board).toEqual(MOCK_BOARD);
      });

      const req = httpMock.expectOne('/api/boards/board-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_BOARD);
    });
  });

  describe('deleteBoard()', () => {
    it('should DELETE /api/boards/:boardId', () => {
      service.deleteBoard('board-1').subscribe();

      const req = httpMock.expectOne('/api/boards/board-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('listColumns()', () => {
    it('should GET /api/boards/:boardId/columns', () => {
      const columns = [MOCK_COLUMN];

      service.listColumns('board-1').subscribe((result) => {
        expect(result).toEqual(columns);
      });

      const req = httpMock.expectOne('/api/boards/board-1/columns');
      expect(req.request.method).toBe('GET');
      req.flush(columns);
    });
  });

  describe('createColumn()', () => {
    it('should POST /api/boards/:boardId/columns with body', () => {
      const createReq: CreateColumnRequest = {
        name: 'In Progress',
        color: '#f59e0b',
        wip_limit: 5,
      };

      service.createColumn('board-1', createReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/boards/board-1/columns');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('updateColumn()', () => {
    it('should PATCH /api/columns/:columnId with body', () => {
      const updateReq: UpdateColumnRequest = {
        name: 'Done',
        color: '#22c55e',
        status_mapping: { done: true },
      };

      service.updateColumn('col-1', updateReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('reorderColumn()', () => {
    it('should PATCH /api/columns/:columnId/reorder with position', () => {
      const reorderReq: ReorderColumnRequest = { position: '3000' };

      service.reorderColumn('col-1', reorderReq).subscribe((column) => {
        expect(column).toEqual(MOCK_COLUMN);
      });

      const req = httpMock.expectOne('/api/columns/col-1/reorder');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(reorderReq);
      req.flush(MOCK_COLUMN);
    });
  });

  describe('deleteColumn()', () => {
    it('should DELETE /api/columns/:columnId', () => {
      service.deleteColumn('col-1').subscribe();

      const req = httpMock.expectOne('/api/columns/col-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getBoardMembers()', () => {
    it('should GET /api/boards/:boardId/members', () => {
      const members = [MOCK_MEMBER];

      service.getBoardMembers('board-1').subscribe((result) => {
        expect(result).toEqual(members);
      });

      const req = httpMock.expectOne('/api/boards/board-1/members');
      expect(req.request.method).toBe('GET');
      req.flush(members);
    });
  });

  describe('inviteBoardMember()', () => {
    it('should POST /api/boards/:boardId/members with email and role', () => {
      const inviteReq: InviteMemberRequest = {
        email: 'new@example.com',
        role: 'viewer',
      };

      service.inviteBoardMember('board-1', inviteReq).subscribe((member) => {
        expect(member).toEqual(MOCK_MEMBER);
      });

      const req = httpMock.expectOne('/api/boards/board-1/members');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(inviteReq);
      req.flush(MOCK_MEMBER);
    });
  });

  describe('updateBoardMemberRole()', () => {
    it('should PATCH /api/boards/:boardId/members/:userId with role', () => {
      const roleReq: UpdateMemberRoleRequest = { role: 'editor' };

      service
        .updateBoardMemberRole('board-1', 'user-1', roleReq)
        .subscribe((member) => {
          expect(member).toEqual(MOCK_MEMBER);
        });

      const req = httpMock.expectOne('/api/boards/board-1/members/user-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(roleReq);
      req.flush(MOCK_MEMBER);
    });
  });

  describe('removeBoardMember()', () => {
    it('should DELETE /api/boards/:boardId/members/:userId', () => {
      service.removeBoardMember('board-1', 'user-1').subscribe();

      const req = httpMock.expectOne('/api/boards/board-1/members/user-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getBoardFull()', () => {
    it('should GET /api/boards/:boardId/full', () => {
      const fullResponse: BoardFullResponse = {
        board: { ...MOCK_BOARD, columns: [MOCK_COLUMN] },
        tasks: [],
        members: [MOCK_MEMBER],
      };

      service.getBoardFull('board-1').subscribe((result) => {
        expect(result).toEqual(fullResponse);
      });

      const req = httpMock.expectOne('/api/boards/board-1/full');
      expect(req.request.method).toBe('GET');
      req.flush(fullResponse);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on getBoard', () => {
      let error: any;
      service.getBoard('nonexistent').subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/boards/nonexistent');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(404);
    });

    it('should propagate HTTP errors on createBoard', () => {
      let error: any;
      service.createBoard('ws-1', { name: '' }).subscribe({
        error: (e) => (error = e),
      });

      const req = httpMock.expectOne('/api/workspaces/ws-1/boards');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });
});
