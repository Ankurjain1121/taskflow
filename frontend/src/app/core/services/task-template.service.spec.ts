import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  TaskTemplateService,
  TaskTemplate,
  TaskTemplateWithDetails,
  CreateTaskTemplateRequest,
  UpdateTaskTemplateRequest,
  SaveAsTemplateRequest,
  CreateFromTemplateRequest,
} from './task-template.service';

const MOCK_TEMPLATE: TaskTemplate = {
  id: 'tt-1',
  name: 'Bug Report',
  description: 'Template for bugs',
  scope: 'workspace',
  project_id: null,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  task_title: 'Bug: ',
  task_description: 'Steps to reproduce:',
  task_priority: 'high',
  task_estimated_hours: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_TEMPLATE_DETAILS: TaskTemplateWithDetails = {
  ...MOCK_TEMPLATE,
  subtasks: [
    { id: 'sub-1', template_id: 'tt-1', title: 'Investigate', position: 0 },
  ],
  label_ids: ['label-1'],
  custom_fields: [],
};

describe('TaskTemplateService', () => {
  let service: TaskTemplateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TaskTemplateService],
    });
    service = TestBed.inject(TaskTemplateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list()', () => {
    it('should GET /api/task-templates with no params', () => {
      const templates = [MOCK_TEMPLATE];

      service.list().subscribe((result) => {
        expect(result).toEqual(templates);
      });

      const req = httpMock.expectOne('/api/task-templates');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush(templates);
    });

    it('should include scope and project_id params when provided', () => {
      service.list('project', 'board-1').subscribe();

      const req = httpMock.expectOne((r) => r.url === '/api/task-templates');
      expect(req.request.params.get('scope')).toBe('project');
      expect(req.request.params.get('project_id')).toBe('board-1');
      req.flush([]);
    });
  });

  describe('get()', () => {
    it('should GET /api/task-templates/:id', () => {
      service.get('tt-1').subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE_DETAILS);
      });

      const req = httpMock.expectOne('/api/task-templates/tt-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TEMPLATE_DETAILS);
    });
  });

  describe('create()', () => {
    it('should POST /api/task-templates with body', () => {
      const createReq: CreateTaskTemplateRequest = {
        name: 'Feature',
        task_title: 'Feature: ',
        task_priority: 'medium',
      };

      service.create(createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE);
      });

      const req = httpMock.expectOne('/api/task-templates');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_TEMPLATE);
    });
  });

  describe('update()', () => {
    it('should PUT /api/task-templates/:id with body', () => {
      const updateReq: UpdateTaskTemplateRequest = { name: 'Updated Bug' };

      service.update('tt-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE);
      });

      const req = httpMock.expectOne('/api/task-templates/tt-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_TEMPLATE);
    });
  });

  describe('delete()', () => {
    it('should DELETE /api/task-templates/:id', () => {
      service.delete('tt-1').subscribe((result) => {
        expect(result).toEqual({ success: true });
      });

      const req = httpMock.expectOne('/api/task-templates/tt-1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });
    });
  });

  describe('saveTaskAsTemplate()', () => {
    it('should POST /api/tasks/:taskId/save-as-template', () => {
      const saveReq: SaveAsTemplateRequest = {
        name: 'From Task',
        scope: 'personal',
      };

      service.saveTaskAsTemplate('task-1', saveReq).subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/save-as-template');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(saveReq);
      req.flush(MOCK_TEMPLATE);
    });
  });

  describe('createTaskFromTemplate()', () => {
    it('should POST /api/task-templates/:templateId/create-task', () => {
      const createReq: CreateFromTemplateRequest = {
        project_id: 'board-1',
        column_id: 'col-1',
      };

      service.createTaskFromTemplate('tt-1', createReq).subscribe((result) => {
        expect(result).toEqual({ task_id: 'task-new' });
      });

      const req = httpMock.expectOne('/api/task-templates/tt-1/create-task');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush({ task_id: 'task-new' });
    });
  });
});
