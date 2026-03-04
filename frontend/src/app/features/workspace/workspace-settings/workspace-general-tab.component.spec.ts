import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { WorkspaceGeneralTabComponent } from './workspace-general-tab.component';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { UploadService } from '../../../core/services/upload.service';

describe('WorkspaceGeneralTabComponent', () => {
  let component: WorkspaceGeneralTabComponent;
  let fixture: ComponentFixture<WorkspaceGeneralTabComponent>;
  let mockWorkspaceService: any;
  let mockUploadService: any;

  const testWorkspace = {
    id: 'ws-1',
    name: 'My Workspace',
    slug: 'my-ws',
    description: 'A test workspace',
    logo_url: null,
    owner_id: 'u-1',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(async () => {
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

    mockWorkspaceService = {
      update: vi
        .fn()
        .mockReturnValue(of({ ...testWorkspace, name: 'Updated WS' })),
    };

    mockUploadService = {
      getLogoUploadUrl: vi.fn(),
      uploadFileToPresignedUrl: vi.fn(),
      confirmLogoUpload: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WorkspaceGeneralTabComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: UploadService, useValue: mockUploadService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceGeneralTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workspaceId', 'ws-1');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a form with name and description controls', () => {
    expect(component.form.get('name')).toBeTruthy();
    expect(component.form.get('description')).toBeTruthy();
  });

  it('should patch form from workspace', () => {
    component.patchForm(testWorkspace as any);
    expect(component.form.get('name')?.value).toBe('My Workspace');
    expect(component.form.get('description')?.value).toBe('A test workspace');
  });

  it('should patch form with empty description when null', () => {
    component.patchForm({ ...testWorkspace, description: null } as any);
    expect(component.form.get('description')?.value).toBe('');
  });

  it('should save workspace', () => {
    component.patchForm(testWorkspace as any);
    component.form.markAsDirty();
    const emitSpy = vi.spyOn(component.workspaceSaved, 'emit');

    component.onSave();

    expect(mockWorkspaceService.update).toHaveBeenCalledWith('ws-1', {
      name: 'My Workspace',
      description: 'A test workspace',
    });
    expect(emitSpy).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('should not save when form is invalid', () => {
    component.form.get('name')?.setValue('');
    component.onSave();
    expect(mockWorkspaceService.update).not.toHaveBeenCalled();
  });

  it('should handle save error', () => {
    mockWorkspaceService.update.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    component.patchForm(testWorkspace as any);
    component.form.markAsDirty();
    component.onSave();
    expect(component.saving()).toBe(false);
  });

  it('should emit deleteRequested', () => {
    const emitSpy = vi.spyOn(component.deleteRequested, 'emit');
    component.onDeleteWorkspace();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should handle logo file too large', () => {
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    const mockFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(mockFile, 'size', { value: 3 * 1024 * 1024 });

    const inputEl = { files: [mockFile], value: 'C:\\big.jpg' };
    component.onLogoSelected({ target: inputEl } as any);

    expect(alertSpy).toHaveBeenCalledWith('File size must be under 2MB');
    expect(component.uploadingLogo()).toBe(false);
    vi.restoreAllMocks();
  });

  it('should upload logo successfully', () => {
    mockUploadService.getLogoUploadUrl.mockReturnValue(
      of({ upload_url: 'https://upload.url', storage_key: 'key-1' }),
    );
    mockUploadService.uploadFileToPresignedUrl.mockReturnValue(of({}));
    mockUploadService.confirmLogoUpload.mockReturnValue(
      of({ logo_url: 'https://logo.url' }),
    );
    fixture.componentRef.setInput('workspace', testWorkspace);

    const emitSpy = vi.spyOn(component.workspaceSaved, 'emit');
    const mockFile = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });

    const inputEl = { files: [mockFile], value: 'C:\\logo.png' };
    component.onLogoSelected({ target: inputEl } as any);

    expect(mockUploadService.getLogoUploadUrl).toHaveBeenCalledWith(
      'ws-1',
      'logo.png',
      1024,
      'image/png',
    );
    expect(emitSpy).toHaveBeenCalled();
    expect(component.uploadingLogo()).toBe(false);
    expect(inputEl.value).toBe('');
  });

  it('should handle upload presigned URL error', () => {
    mockUploadService.getLogoUploadUrl.mockReturnValue(
      throwError(() => new Error('fail')),
    );
    const mockFile = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(mockFile, 'size', { value: 1024 });

    const inputEl = { files: [mockFile], value: 'C:\\logo.png' };
    component.onLogoSelected({ target: inputEl } as any);

    expect(component.uploadingLogo()).toBe(false);
  });

  it('should do nothing when no file is selected', () => {
    const inputEl = { files: [], value: '' };
    component.onLogoSelected({ target: inputEl } as any);
    expect(mockUploadService.getLogoUploadUrl).not.toHaveBeenCalled();
  });

  it('should default isAdmin input to false', () => {
    expect(component.isAdmin()).toBe(false);
  });
});
