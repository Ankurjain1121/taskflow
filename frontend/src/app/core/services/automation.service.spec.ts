import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  AutomationService,
  AutomationRule,
  AutomationAction,
  AutomationLog,
  AutomationRuleWithActions,
  CreateRuleRequest,
  UpdateRuleRequest,
} from './automation.service';

const MOCK_RULE: AutomationRule = {
  id: 'rule-1',
  name: 'Auto-assign on creation',
  board_id: 'board-1',
  trigger: 'task_created',
  trigger_config: {},
  is_active: true,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_ACTION: AutomationAction = {
  id: 'action-1',
  rule_id: 'rule-1',
  action_type: 'assign_task',
  action_config: { user_id: 'user-1' },
  position: 0,
};

const MOCK_RULE_WITH_ACTIONS: AutomationRuleWithActions = {
  rule: MOCK_RULE,
  actions: [MOCK_ACTION],
};

const MOCK_LOG: AutomationLog = {
  id: 'log-1',
  rule_id: 'rule-1',
  task_id: 'task-1',
  triggered_at: '2026-01-15T00:00:00Z',
  status: 'success',
  details: null,
};

describe('AutomationService', () => {
  let service: AutomationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AutomationService],
    });
    service = TestBed.inject(AutomationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listRules()', () => {
    it('should GET /api/boards/:boardId/automations', () => {
      const rules = [MOCK_RULE_WITH_ACTIONS];

      service.listRules('board-1').subscribe((result) => {
        expect(result).toEqual(rules);
      });

      const req = httpMock.expectOne('/api/boards/board-1/automations');
      expect(req.request.method).toBe('GET');
      req.flush(rules);
    });
  });

  describe('createRule()', () => {
    it('should POST /api/boards/:boardId/automations with rule request', () => {
      const createReq: CreateRuleRequest = {
        name: 'Auto-assign',
        trigger: 'task_created',
        actions: [{ action_type: 'assign_task', action_config: { user_id: 'user-1' } }],
      };

      service.createRule('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_RULE_WITH_ACTIONS);
      });

      const req = httpMock.expectOne('/api/boards/board-1/automations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_RULE_WITH_ACTIONS);
    });
  });

  describe('getRule()', () => {
    it('should GET /api/automations/:id', () => {
      service.getRule('rule-1').subscribe((result) => {
        expect(result).toEqual(MOCK_RULE_WITH_ACTIONS);
      });

      const req = httpMock.expectOne('/api/automations/rule-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_RULE_WITH_ACTIONS);
    });
  });

  describe('updateRule()', () => {
    it('should PUT /api/automations/:id with update request', () => {
      const updateReq: UpdateRuleRequest = {
        name: 'Updated rule',
        is_active: false,
      };

      service.updateRule('rule-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_RULE_WITH_ACTIONS);
      });

      const req = httpMock.expectOne('/api/automations/rule-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_RULE_WITH_ACTIONS);
    });
  });

  describe('deleteRule()', () => {
    it('should DELETE /api/automations/:id', () => {
      service.deleteRule('rule-1').subscribe();

      const req = httpMock.expectOne('/api/automations/rule-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getRuleLogs()', () => {
    it('should GET /api/automations/:id/logs without limit', () => {
      service.getRuleLogs('rule-1').subscribe((result) => {
        expect(result).toEqual([MOCK_LOG]);
      });

      const req = httpMock.expectOne('/api/automations/rule-1/logs');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_LOG]);
    });

    it('should pass limit param when provided', () => {
      service.getRuleLogs('rule-1', 10).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/automations/rule-1/logs' &&
          r.params.get('limit') === '10'
      );
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_LOG]);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on createRule', () => {
      let error: any;
      service
        .createRule('board-1', {
          name: '',
          trigger: 'task_created',
          actions: [],
        })
        .subscribe({
          error: (e) => (error = e),
        });

      const req = httpMock.expectOne('/api/boards/board-1/automations');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });
});
