import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  ProjectTemplateService,
  ProjectTemplate,
  TemplateWithDetails,
  CreateTemplateRequest,
  CreateBoardFromTemplateRequest,
  SaveAsTemplateRequest,
} from './project-template.service';

const MOCK_TEMPLATE: ProjectTemplate = {
  id: 'tpl-1',
  name: 'Kanban Template',
  description: 'Standard kanban board',
  category: 'project-management',
  is_public: true,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_TEMPLATE_DETAILS: TemplateWithDetails = {
  ...MOCK_TEMPLATE,
  columns: [
    {
      id: 'tc-1',
      template_id: 'tpl-1',
      name: 'To Do',
      position: 0,
      color: '#3b82f6',
      wip_limit: null,
      status_mapping: {},
    },
  ],
  tasks: [
    {
      id: 'tt-1',
      template_id: 'tpl-1',
      column_index: 0,
      title: 'Sample Task',
      description: null,
      priority: 'medium',
      position: 0,
    },
  ],
};

describe('ProjectTemplateService', () => {
  let service: ProjectTemplateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProjectTemplateService],
    });
    service = TestBed.inject(ProjectTemplateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listTemplates()', () => {
    it('should GET /api/project-templates', () => {
      const templates = [MOCK_TEMPLATE];

      service.listTemplates().subscribe((result) => {
        expect(result).toEqual(templates);
      });

      const req = httpMock.expectOne('/api/project-templates');
      expect(req.request.method).toBe('GET');
      req.flush(templates);
    });
  });

  describe('getTemplate()', () => {
    it('should GET /api/project-templates/:templateId', () => {
      service.getTemplate('tpl-1').subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE_DETAILS);
      });

      const req = httpMock.expectOne('/api/project-templates/tpl-1');
      expect(req.request.method).toBe('GET');
      req.flush(MOCK_TEMPLATE_DETAILS);
    });
  });

  describe('createTemplate()', () => {
    it('should POST /api/project-templates with body', () => {
      const createReq: CreateTemplateRequest = {
        name: 'New Template',
        description: 'A new template',
        category: 'agile',
      };

      service.createTemplate(createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE);
      });

      const req = httpMock.expectOne('/api/project-templates');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_TEMPLATE);
    });
  });

  describe('deleteTemplate()', () => {
    it('should DELETE /api/project-templates/:templateId', () => {
      service.deleteTemplate('tpl-1').subscribe();

      const req = httpMock.expectOne('/api/project-templates/tpl-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('createBoardFromTemplate()', () => {
    it('should POST /api/project-templates/:templateId/create-board', () => {
      const boardReq: CreateBoardFromTemplateRequest = {
        workspace_id: 'ws-1',
        project_name: 'New Project',
      };

      service.createProjectFromTemplate('tpl-1', boardReq).subscribe((result) => {
        expect(result).toEqual({ project_id: 'board-new' });
      });

      const req = httpMock.expectOne(
        '/api/project-templates/tpl-1/create-board',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(boardReq);
      req.flush({ project_id: 'board-new' });
    });
  });

  describe('saveBoardAsTemplate()', () => {
    it('should POST /api/projects/:projectId/save-as-template', () => {
      const saveReq: SaveAsTemplateRequest = {
        name: 'Saved Template',
        category: 'custom',
      };

      service.saveBoardAsTemplate('board-1', saveReq).subscribe((result) => {
        expect(result).toEqual(MOCK_TEMPLATE);
      });

      const req = httpMock.expectOne('/api/projects/board-1/save-as-template');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(saveReq);
      req.flush(MOCK_TEMPLATE);
    });
  });
});
