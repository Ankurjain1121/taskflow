import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  CustomFieldService,
  BoardCustomField,
  TaskCustomFieldValue,
  TaskCustomFieldValueWithField,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  SetFieldValue,
} from './custom-field.service';

const MOCK_FIELD: BoardCustomField = {
  id: 'field-1',
  project_id: 'board-1',
  name: 'Priority Score',
  field_type: 'number',
  options: null,
  is_required: false,
  position: 0,
  tenant_id: 'tenant-1',
  created_by_id: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_VALUE_WITH_FIELD: TaskCustomFieldValueWithField = {
  id: 'val-1',
  task_id: 'task-1',
  field_id: 'field-1',
  field_name: 'Priority Score',
  field_type: 'number',
  options: null,
  is_required: false,
  value_text: null,
  value_number: 42,
  value_date: null,
  value_bool: null,
};

const MOCK_VALUE: TaskCustomFieldValue = {
  id: 'val-1',
  task_id: 'task-1',
  field_id: 'field-1',
  value_text: null,
  value_number: 42,
  value_date: null,
  value_bool: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('CustomFieldService', () => {
  let service: CustomFieldService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CustomFieldService],
    });
    service = TestBed.inject(CustomFieldService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listBoardFields()', () => {
    it('should GET /api/projects/:projectId/custom-fields', () => {
      service.listBoardFields('board-1').subscribe((result) => {
        expect(result).toEqual([MOCK_FIELD]);
      });

      const req = httpMock.expectOne('/api/projects/board-1/custom-fields');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_FIELD]);
    });
  });

  describe('createField()', () => {
    it('should POST /api/projects/:projectId/custom-fields with request', () => {
      const createReq: CreateCustomFieldRequest = {
        name: 'Priority Score',
        field_type: 'number',
        is_required: false,
      };

      service.createField('board-1', createReq).subscribe((result) => {
        expect(result).toEqual(MOCK_FIELD);
      });

      const req = httpMock.expectOne('/api/projects/board-1/custom-fields');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createReq);
      req.flush(MOCK_FIELD);
    });
  });

  describe('updateField()', () => {
    it('should PUT /api/custom-fields/:id with request', () => {
      const updateReq: UpdateCustomFieldRequest = {
        name: 'Updated Field',
      };

      service.updateField('field-1', updateReq).subscribe((result) => {
        expect(result).toEqual(MOCK_FIELD);
      });

      const req = httpMock.expectOne('/api/custom-fields/field-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateReq);
      req.flush(MOCK_FIELD);
    });
  });

  describe('deleteField()', () => {
    it('should DELETE /api/custom-fields/:id', () => {
      service.deleteField('field-1').subscribe();

      const req = httpMock.expectOne('/api/custom-fields/field-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('getTaskValues()', () => {
    it('should GET /api/tasks/:taskId/custom-fields', () => {
      service.getTaskValues('task-1').subscribe((result) => {
        expect(result).toEqual([MOCK_VALUE_WITH_FIELD]);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/custom-fields');
      expect(req.request.method).toBe('GET');
      req.flush([MOCK_VALUE_WITH_FIELD]);
    });
  });

  describe('setTaskValues()', () => {
    it('should PUT /api/tasks/:taskId/custom-fields with values', () => {
      const values: SetFieldValue[] = [
        { field_id: 'field-1', value_number: 99 },
      ];

      service.setTaskValues('task-1', values).subscribe((result) => {
        expect(result).toEqual([MOCK_VALUE]);
      });

      const req = httpMock.expectOne('/api/tasks/task-1/custom-fields');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ values });
      req.flush([MOCK_VALUE]);
    });
  });

  describe('error handling', () => {
    it('should propagate HTTP errors on createField', () => {
      let error: any;
      service
        .createField('board-1', { name: '', field_type: 'text' })
        .subscribe({
          error: (e) => (error = e),
        });

      const req = httpMock.expectOne('/api/projects/board-1/custom-fields');
      req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

      expect(error).toBeTruthy();
      expect(error.status).toBe(400);
    });
  });
});
