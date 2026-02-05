import {
  Component,
  input,
  output,
  signal,
  inject,
  ElementRef,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  AttachmentService,
  Attachment,
  UploadProgress,
} from '../../../core/services/attachment.service';
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe';

export interface UploadState {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'confirming' | 'completed' | 'error';
  error?: string;
  abortController?: AbortController;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Component({
  selector: 'app-file-upload-zone',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    FileSizePipe,
  ],
  template: `
    <div class="space-y-4">
      <!-- Drop zone -->
      <div
        #dropZone
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
        [class.border-indigo-500]="isDragging()"
        [class.bg-indigo-50]="isDragging()"
        class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-indigo-400 hover:bg-gray-50"
      >
        <input
          #fileInput
          type="file"
          (change)="onFileSelected($event)"
          multiple
          class="hidden"
        />

        <mat-icon class="text-5xl text-gray-400 mb-2">cloud_upload</mat-icon>
        <p class="text-gray-600 mb-1">
          Drag and drop files here, or
          <span class="text-indigo-600 font-medium">click to browse</span>
        </p>
        <p class="text-sm text-gray-400">Maximum file size: 10 MB</p>
      </div>

      <!-- Active uploads -->
      @if (uploads().length > 0) {
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-gray-700">Uploading files</h4>

          @for (upload of uploads(); track upload.id) {
            <div class="bg-white rounded-lg border border-gray-200 p-3">
              <div class="flex items-center gap-3">
                <!-- File icon -->
                <div class="flex-shrink-0">
                  <mat-icon class="text-gray-400">
                    {{ getFileIcon(upload.fileName) }}
                  </mat-icon>
                </div>

                <!-- File info and progress -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium text-gray-900 truncate">
                      {{ upload.fileName }}
                    </span>
                    <span class="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {{ upload.fileSize | fileSize }}
                    </span>
                  </div>

                  @if (upload.status === 'error') {
                    <div class="text-sm text-red-600">
                      {{ upload.error || 'Upload failed' }}
                    </div>
                  } @else if (upload.status === 'completed') {
                    <div class="text-sm text-green-600 flex items-center">
                      <mat-icon class="text-base mr-1">check_circle</mat-icon>
                      Uploaded successfully
                    </div>
                  } @else {
                    <mat-progress-bar
                      [value]="upload.progress"
                      [mode]="upload.status === 'confirming' ? 'indeterminate' : 'determinate'"
                      color="primary"
                    ></mat-progress-bar>
                    <div class="mt-1 text-xs text-gray-400">
                      @switch (upload.status) {
                        @case ('pending') {
                          Preparing...
                        }
                        @case ('uploading') {
                          Uploading... {{ upload.progress }}%
                        }
                        @case ('confirming') {
                          Finalizing...
                        }
                      }
                    </div>
                  }
                </div>

                <!-- Cancel button -->
                @if (upload.status !== 'completed' && upload.status !== 'error') {
                  <button
                    mat-icon-button
                    (click)="cancelUpload(upload.id)"
                    class="flex-shrink-0"
                    title="Cancel upload"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                } @else if (upload.status === 'completed' || upload.status === 'error') {
                  <button
                    mat-icon-button
                    (click)="removeFromList(upload.id)"
                    class="flex-shrink-0"
                    title="Remove from list"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class FileUploadZoneComponent implements OnDestroy {
  private attachmentService = inject(AttachmentService);
  private snackBar = inject(MatSnackBar);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();

  uploadCompleted = output<Attachment>();

  uploads = signal<UploadState[]>([]);
  isDragging = signal(false);

  private uploadIdCounter = 0;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
      // Reset input so same file can be selected again
      input.value = '';
    }
  }

  uploadFiles(files: File[]): void {
    for (const file of files) {
      this.uploadFile(file);
    }
  }

  uploadFile(file: File): void {
    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      this.snackBar.open(
        `File "${file.name}" exceeds 10 MB limit`,
        'Dismiss',
        { duration: 5000 }
      );
      return;
    }

    const uploadId = `upload-${++this.uploadIdCounter}`;

    // Add to uploads list
    this.uploads.update((uploads) => [
      ...uploads,
      {
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'pending',
      },
    ]);

    // Start upload
    this.attachmentService
      .uploadFile(this.taskId(), file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (progress: UploadProgress) => {
          this.updateUploadState(uploadId, {
            progress: progress.progress,
            status: progress.status,
            error: progress.error,
          });

          if (progress.status === 'completed' && progress.attachment) {
            this.uploadCompleted.emit(progress.attachment);
          }
        },
        error: (error) => {
          this.updateUploadState(uploadId, {
            status: 'error',
            error: error.message || 'Upload failed',
          });
        },
      });
  }

  cancelUpload(uploadId: string): void {
    // Remove from list (the service subscription will be cleaned up via takeUntil)
    this.removeFromList(uploadId);
  }

  removeFromList(uploadId: string): void {
    this.uploads.update((uploads) => uploads.filter((u) => u.id !== uploadId));
  }

  getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'xls':
      case 'xlsx':
        return 'table_chart';
      case 'ppt':
      case 'pptx':
        return 'slideshow';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return 'movie';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'audio_file';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return 'folder_zip';
      case 'txt':
        return 'article';
      case 'json':
      case 'xml':
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        return 'code';
      default:
        return 'insert_drive_file';
    }
  }

  private updateUploadState(
    uploadId: string,
    updates: Partial<UploadState>
  ): void {
    this.uploads.update((uploads) =>
      uploads.map((upload) =>
        upload.id === uploadId ? { ...upload, ...updates } : upload
      )
    );
  }
}
