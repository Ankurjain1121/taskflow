import {
  Component,
  input,
  output,
  signal,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
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
  imports: [CommonModule, ButtonModule, ProgressBar, Toast, FileSizePipe],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="space-y-4">
      <!-- Drop zone -->
      <div
        #dropZone
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()"
        [style.border-color]="isDragging() ? 'var(--color-primary)' : ''"
        [style.background]="
          isDragging()
            ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
            : ''
        "
        class="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary hover:bg-[var(--secondary)]"
      >
        <input
          #fileInput
          type="file"
          (change)="onFileSelected($event)"
          multiple
          class="hidden"
        />

        <i class="pi pi-cloud-upload text-5xl text-gray-400 mb-2"></i>
        <p class="text-[var(--muted-foreground)] mb-1">
          Drag and drop files here, or
          <span class="text-primary font-medium">click to browse</span>
        </p>
        <p class="text-sm text-gray-400">Maximum file size: 10 MB</p>
      </div>

      <!-- Active uploads -->
      @if (uploads().length > 0) {
        <div class="space-y-3">
          <h4 class="text-sm font-medium text-[var(--foreground)]">
            Uploading files
          </h4>

          @for (upload of uploads(); track upload.id) {
            <div
              class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-3"
            >
              <div class="flex items-center gap-3">
                <!-- File icon -->
                <div class="flex-shrink-0">
                  <i
                    [class]="
                      'pi ' +
                      getFileIcon(upload.fileName) +
                      ' text-gray-400 text-xl'
                    "
                  ></i>
                </div>

                <!-- File info and progress -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-1">
                    <span
                      class="text-sm font-medium text-[var(--card-foreground)] truncate"
                    >
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
                      <i class="pi pi-check-circle mr-1"></i>
                      Uploaded successfully
                    </div>
                  } @else {
                    <p-progressBar
                      [value]="upload.progress"
                      [mode]="
                        upload.status === 'confirming'
                          ? 'indeterminate'
                          : 'determinate'
                      "
                      [style]="{ height: '6px' }"
                    />
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
                @if (
                  upload.status !== 'completed' && upload.status !== 'error'
                ) {
                  <button
                    pButton
                    [rounded]="true"
                    [text]="true"
                    (click)="cancelUpload(upload.id)"
                    class="flex-shrink-0"
                    title="Cancel upload"
                  >
                    <i class="pi pi-times"></i>
                  </button>
                } @else if (
                  upload.status === 'completed' || upload.status === 'error'
                ) {
                  <button
                    pButton
                    [rounded]="true"
                    [text]="true"
                    (click)="removeFromList(upload.id)"
                    class="flex-shrink-0"
                    title="Remove from list"
                  >
                    <i class="pi pi-times"></i>
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
  private messageService = inject(MessageService);
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
      this.messageService.add({
        severity: 'warn',
        summary: 'File too large',
        detail: `File "${file.name}" exceeds 10 MB limit`,
      });
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
        return 'pi-file-pdf';
      case 'doc':
      case 'docx':
        return 'pi-file-word';
      case 'xls':
      case 'xlsx':
        return 'pi-file-excel';
      case 'ppt':
      case 'pptx':
        return 'pi-file';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'pi-image';
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return 'pi-video';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'pi-volume-up';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return 'pi-box';
      case 'txt':
        return 'pi-file';
      case 'json':
      case 'xml':
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        return 'pi-code';
      default:
        return 'pi-file';
    }
  }

  private updateUploadState(
    uploadId: string,
    updates: Partial<UploadState>,
  ): void {
    this.uploads.update((uploads) =>
      uploads.map((upload) =>
        upload.id === uploadId ? { ...upload, ...updates } : upload,
      ),
    );
  }
}
