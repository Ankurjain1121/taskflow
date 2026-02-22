import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AvatarUploadComponent } from './avatar-upload.component';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  standalone: true,
  imports: [AvatarUploadComponent],
  template: `<app-avatar-upload
    [entityType]="'avatar'"
    [currentUrl]="currentUrl"
    [workspaceId]="'ws-1'"
    (uploaded)="onUploaded($event)"
  />`,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class TestHostComponent {
  currentUrl: string | null = null;
  onUploaded = vi.fn();
}

describe('AvatarUploadComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: AvatarUploadComponent;
  let mockUploadService: any;

  beforeEach(async () => {
    mockUploadService = {
      getAvatarUploadUrl: vi.fn().mockReturnValue(of({
        upload_url: 'https://storage.example.com/upload',
        storage_key: 'key-1',
      })),
      uploadFileToPresignedUrl: vi.fn().mockReturnValue(of(void 0)),
      confirmAvatarUpload: vi.fn().mockReturnValue(of({
        avatar_url: 'https://cdn.example.com/avatar.jpg',
      })),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: UploadService, useValue: mockUploadService },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.children[0].componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start in idle state', () => {
    expect(component.uploadState()).toBe('idle');
  });

  it('should handle drag over', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragOver(event);
    expect(component.isDragOver()).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle drag leave', () => {
    component.isDragOver.set(true);
    component.onDragLeave();
    expect(component.isDragOver()).toBe(false);
  });

  it('should handle drop', () => {
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: { files: [file] },
    } as any;
    component.onDrop(event);
    expect(component.isDragOver()).toBe(false);
  });

  it('should handle image error', () => {
    component.previewUrl.set('bad-url');
    component.onImageError();
    expect(component.previewUrl()).toBeNull();
  });

  it('should remove image and emit empty string', () => {
    component.previewUrl.set('https://example.com/img.jpg');
    const spy = vi.spyOn(component.uploaded, 'emit');
    component.removeImage();
    expect(component.previewUrl()).toBeNull();
    expect(spy).toHaveBeenCalledWith('');
  });

  it('should reject invalid file type', () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const event = { target: { files: [file], value: '' } } as any;
    component.onFileSelected(event);
    expect(component.uploadState()).toBe('error');
    expect(component.errorMessage()).toContain('Invalid file type');
  });

  it('should reject oversized file', () => {
    const largeContent = new Uint8Array(6 * 1024 * 1024); // 6MB
    const file = new File([largeContent], 'huge.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file], value: '' } } as any;
    component.onFileSelected(event);
    expect(component.uploadState()).toBe('error');
    expect(component.errorMessage()).toContain('too large');
  });
});
