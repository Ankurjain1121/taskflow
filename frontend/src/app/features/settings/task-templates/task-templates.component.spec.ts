import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { TaskTemplatesComponent } from './task-templates.component';
import {
  TaskTemplateService,
  TaskTemplate,
} from '../../../core/services/task-template.service';

function makeTemplate(overrides: Partial<TaskTemplate> = {}): TaskTemplate {
  return {
    id: 'tmpl-1',
    name: 'Bug Report',
    scope: 'personal',
    task_title: 'Bug: ',
    task_description: 'Steps to reproduce...',
    task_priority: 'high',
    description: 'Standard bug report template',
    board_id: null,
    workspace_id: null,
    created_by: 'user-1',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  } as TaskTemplate;
}

describe('TaskTemplatesComponent', () => {
  let component: TaskTemplatesComponent;
  let fixture: ComponentFixture<TaskTemplatesComponent>;
  let templateServiceMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockTemplates = [
    makeTemplate({ id: 'tmpl-1', name: 'Bug Report' }),
    makeTemplate({ id: 'tmpl-2', name: 'Feature Request', scope: 'workspace' }),
  ];

  beforeEach(async () => {
    templateServiceMock = {
      list: vi.fn().mockReturnValue(of(mockTemplates)),
      create: vi.fn().mockReturnValue(of(makeTemplate({ id: 'tmpl-3', name: 'New' }))),
      update: vi.fn().mockReturnValue(of(makeTemplate({ id: 'tmpl-1', name: 'Updated' }))),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [TaskTemplatesComponent],
      providers: [
        provideHttpClient(),
        { provide: TaskTemplateService, useValue: templateServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskTemplatesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should start with loading true', () => {
      expect(component.loading()).toBe(true);
    });

    it('should start with empty templates', () => {
      expect(component.templates()).toEqual([]);
    });

    it('should have scope options', () => {
      expect(component.scopeOptions).toHaveLength(3);
    });

    it('should have priority options', () => {
      expect(component.priorityOptions).toHaveLength(4);
    });
  });

  describe('loadTemplates', () => {
    it('should load templates on init', () => {
      fixture.detectChanges();
      expect(templateServiceMock.list).toHaveBeenCalled();
      expect(component.templates()).toHaveLength(2);
      expect(component.loading()).toBe(false);
    });

    it('should handle load error', () => {
      templateServiceMock.list.mockReturnValue(throwError(() => new Error('fail')));
      fixture.detectChanges();
      expect(component.loading()).toBe(false);
      expect(component.templates()).toEqual([]);
    });
  });

  describe('getScopeSeverity', () => {
    it('should return info for personal', () => {
      expect(component.getScopeSeverity('personal')).toBe('info');
    });

    it('should return warn for board', () => {
      expect(component.getScopeSeverity('board')).toBe('warn');
    });

    it('should return success for workspace', () => {
      expect(component.getScopeSeverity('workspace')).toBe('success');
    });

    it('should return secondary for unknown', () => {
      expect(component.getScopeSeverity('unknown')).toBe('secondary');
    });
  });

  describe('onCreateTemplate', () => {
    it('should reset form and open dialog', () => {
      component.newName = 'old';
      component.onCreateTemplate();
      expect(component.newName).toBe('');
      expect(component.newScope).toBe('personal');
      expect(component.newTaskTitle).toBe('');
      expect(component.showCreateDialog).toBe(true);
    });
  });

  describe('onConfirmCreate', () => {
    it('should not create if name is empty', () => {
      component.newName = '';
      component.newTaskTitle = 'Title';
      component.onConfirmCreate();
      expect(templateServiceMock.create).not.toHaveBeenCalled();
    });

    it('should not create if task title is empty', () => {
      component.newName = 'Name';
      component.newTaskTitle = '';
      component.onConfirmCreate();
      expect(templateServiceMock.create).not.toHaveBeenCalled();
    });

    it('should create template and add to list', () => {
      fixture.detectChanges();
      component.newName = 'New Template';
      component.newTaskTitle = 'Task Title';
      component.onConfirmCreate();

      expect(templateServiceMock.create).toHaveBeenCalled();
      expect(component.templates()).toHaveLength(3);
      expect(component.showCreateDialog).toBe(false);
      expect(component.saving()).toBe(false);
    });

    it('should handle create error', () => {
      templateServiceMock.create.mockReturnValue(throwError(() => new Error('fail')));
      fixture.detectChanges();
      component.newName = 'New';
      component.newTaskTitle = 'Title';
      component.onConfirmCreate();

      expect(component.saving()).toBe(false);
    });
  });

  describe('onEditTemplate', () => {
    it('should set editing state', () => {
      const template = makeTemplate({ id: 'tmpl-1', name: 'Bug', description: 'desc' });
      component.onEditTemplate(template);

      expect(component.editingId()).toBe('tmpl-1');
      expect(component.editName).toBe('Bug');
      expect(component.editDescription).toBe('desc');
    });
  });

  describe('onSaveEdit', () => {
    it('should update template in list', () => {
      fixture.detectChanges();
      component.editName = 'Updated';
      component.editDescription = '';
      component.onSaveEdit('tmpl-1');

      expect(templateServiceMock.update).toHaveBeenCalledWith('tmpl-1', {
        name: 'Updated',
        description: undefined,
      });
      expect(component.editingId()).toBeNull();
    });

    it('should handle update error gracefully', () => {
      templateServiceMock.update.mockReturnValue(throwError(() => new Error('fail')));
      fixture.detectChanges();
      component.editingId.set('tmpl-1');
      component.editName = 'Updated';
      component.onSaveEdit('tmpl-1');
      // editingId stays set on error (not cleared)
      expect(component.editingId()).toBe('tmpl-1');
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = component.formatDate('2026-03-01T00:00:00Z');
      expect(result).toBeTruthy();
    });
  });

  describe('template rendering', () => {
    it('should show heading', () => {
      fixture.detectChanges();
      const heading = fixture.nativeElement.querySelector('h2');
      expect(heading?.textContent).toContain('Task Templates');
    });

    it('should show template items after loading', () => {
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('.bg-\\[var\\(--card\\)\\].border');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });

    it('should show empty state when no templates', () => {
      templateServiceMock.list.mockReturnValue(of([]));
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('No templates yet');
    });
  });
});
