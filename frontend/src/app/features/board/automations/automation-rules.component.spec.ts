import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AutomationRulesComponent } from './automation-rules.component';
import {
  AutomationRuleWithActions,
  AutomationLog,
  AutomationService,
} from '../../../core/services/automation.service';

function makeRule(
  overrides: Partial<AutomationRuleWithActions['rule']> = {},
): AutomationRuleWithActions {
  return {
    rule: {
      id: 'rule-1',
      name: 'Test Rule',
      board_id: 'board-1',
      trigger: 'task_moved',
      trigger_config: {},
      is_active: true,
      tenant_id: 'tenant-1',
      created_by_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conditions: null,
      execution_count: 5,
      last_triggered_at: null,
      ...overrides,
    },
    actions: [
      {
        id: 'action-1',
        rule_id: overrides.id ?? 'rule-1',
        action_type: 'move_task',
        action_config: { column_id: 'col-2' },
        position: 0,
      },
    ],
  };
}

function makeLog(overrides: Partial<AutomationLog> = {}): AutomationLog {
  return {
    id: 'log-1',
    rule_id: 'rule-1',
    task_id: 'task-1',
    triggered_at: new Date().toISOString(),
    status: 'success',
    details: null,
    ...overrides,
  };
}

describe('AutomationRulesComponent', () => {
  let component: AutomationRulesComponent;
  let fixture: ComponentFixture<AutomationRulesComponent>;
  let httpTesting: HttpTestingController;

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

    await TestBed.configureTestingModule({
      imports: [AutomationRulesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AutomationRulesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in loading state', () => {
    expect(component.loading()).toBe(true);
    expect(component.rules()).toEqual([]);
  });

  it('should load rules on init', fakeAsync(() => {
    const rules = [makeRule(), makeRule({ id: 'rule-2', name: 'Rule 2' })];
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges(); // triggers ngOnInit

    const req = httpTesting.expectOne('/api/boards/board-1/automations');
    expect(req.request.method).toBe('GET');
    req.flush(rules);
    tick();

    expect(component.rules().length).toBe(2);
    expect(component.loading()).toBe(false);
  }));

  it('should handle load error gracefully', fakeAsync(() => {
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/boards/board-1/automations');
    req.flush('Server error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
    tick();

    expect(component.rules()).toEqual([]);
    expect(component.loading()).toBe(false);
  }));

  it('should show builder when Create Rule is clicked', () => {
    expect(component.showBuilder()).toBe(false);
    component.showBuilder.set(true);
    expect(component.showBuilder()).toBe(true);
  });

  it('should toggle active state of a rule', fakeAsync(() => {
    const rule = makeRule();
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    // Load rules
    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([rule]);
    tick();

    // Toggle active
    component.toggleActive(component.rules()[0]);

    const toggleReq = httpTesting.expectOne('/api/automations/rule-1');
    expect(toggleReq.request.method).toBe('PUT');
    expect(toggleReq.request.body).toEqual({ is_active: false });

    const updatedRule = makeRule({ is_active: false });
    toggleReq.flush(updatedRule);
    tick();

    expect(component.rules()[0].rule.is_active).toBe(false);
  }));

  it('should delete a rule after confirmation', fakeAsync(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const rule = makeRule();
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([rule]);
    tick();

    component.confirmDelete(component.rules()[0]);

    const deleteReq = httpTesting.expectOne('/api/automations/rule-1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
    tick();

    expect(component.rules().length).toBe(0);
  }));

  it('should not delete when confirm is cancelled', fakeAsync(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const rule = makeRule();
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([rule]);
    tick();

    component.confirmDelete(component.rules()[0]);

    httpTesting.expectNone('/api/automations/rule-1');
    expect(component.rules().length).toBe(1);
  }));

  it('should toggle logs panel', fakeAsync(() => {
    const rule = makeRule();
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([rule]);
    tick();

    // Open logs
    component.toggleLogs('rule-1');
    expect(component.expandedLogRuleId()).toBe('rule-1');

    const logsReq = httpTesting.expectOne(
      (req) => req.url === '/api/automations/rule-1/logs',
    );
    expect(logsReq.request.method).toBe('GET');
    logsReq.flush([makeLog()]);
    tick();

    expect(component.logs().length).toBe(1);
    expect(component.logsLoading()).toBe(false);

    // Close logs
    component.toggleLogs('rule-1');
    expect(component.expandedLogRuleId()).toBeNull();
    expect(component.logs()).toEqual([]);
  }));

  it('should set editing rule and open builder', () => {
    const rule = makeRule();
    component.editRule(rule);
    expect(component.editingRule()).toBe(rule);
    expect(component.showBuilder()).toBe(true);
  });

  it('should cancel builder and reset editing rule', () => {
    component.showBuilder.set(true);
    component.editingRule.set(makeRule());

    component.onBuilderCancelled();
    expect(component.showBuilder()).toBe(false);
    expect(component.editingRule()).toBeNull();
  });

  it('should add new rule to list on save', fakeAsync(() => {
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([]);
    tick();

    const newRule = makeRule({ id: 'new-rule' });
    component.onRuleSaved(newRule);

    expect(component.rules().length).toBe(1);
    expect(component.rules()[0].rule.id).toBe('new-rule');
    expect(component.showBuilder()).toBe(false);
  }));

  it('should update existing rule on save', fakeAsync(() => {
    const existingRule = makeRule();
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const listReq = httpTesting.expectOne('/api/boards/board-1/automations');
    listReq.flush([existingRule]);
    tick();

    const updatedRule = makeRule({ name: 'Updated Name' });
    component.onRuleSaved(updatedRule);

    expect(component.rules().length).toBe(1);
    expect(component.rules()[0].rule.name).toBe('Updated Name');
  }));

  // --- Label helper tests ---

  it('should return correct trigger labels', () => {
    expect(component.getTriggerLabel('task_moved')).toBe('Task Moved');
    expect(component.getTriggerLabel('task_created')).toBe('Task Created');
    expect(component.getTriggerLabel('task_completed')).toBe('Task Completed');
    expect(component.getTriggerLabel('comment_added')).toBe('Comment Added');
    expect(component.getTriggerLabel('member_joined')).toBe('Member Joined');
  });

  it('should return trigger string for unknown trigger', () => {
    expect(component.getTriggerLabel('unknown' as any)).toBe('unknown');
  });

  it('should return correct action labels', () => {
    expect(component.getActionLabel('move_task')).toBe('Move Task');
    expect(component.getActionLabel('assign_task')).toBe('Assign Task');
    expect(component.getActionLabel('send_notification')).toBe(
      'Send Notification',
    );
    expect(component.getActionLabel('create_subtask')).toBe('Create Subtask');
  });

  it('should return action string for unknown action type', () => {
    expect(component.getActionLabel('unknown' as any)).toBe('unknown');
  });

  it('should return correct trigger background class', () => {
    expect(component.getTriggerBgClass('task_moved')).toBe('bg-purple-100');
    expect(component.getTriggerBgClass('task_created')).toBe('bg-green-100');
    expect(component.getTriggerBgClass('task_completed')).toBe(
      'bg-emerald-100',
    );
  });

  it('should return fallback bg class for unknown trigger', () => {
    expect(component.getTriggerBgClass('unknown' as any)).toBe('bg-gray-100');
  });

  it('should return correct trigger icon class', () => {
    expect(component.getTriggerIconClass('task_moved')).toBe('text-purple-600');
    expect(component.getTriggerIconClass('task_created')).toBe(
      'text-green-600',
    );
  });

  it('should return fallback icon class for unknown trigger', () => {
    expect(component.getTriggerIconClass('unknown' as any)).toBe(
      'text-gray-600',
    );
  });

  it('should reload rules when boardId changes', fakeAsync(() => {
    fixture.componentRef.setInput('boardId', 'board-1');
    fixture.detectChanges();

    const req1 = httpTesting.expectOne('/api/boards/board-1/automations');
    req1.flush([]);
    tick();

    // Change boardId
    fixture.componentRef.setInput('boardId', 'board-2');
    fixture.detectChanges();

    const req2 = httpTesting.expectOne('/api/boards/board-2/automations');
    req2.flush([makeRule({ board_id: 'board-2' })]);
    tick();

    expect(component.rules().length).toBe(1);
  }));
});
