import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import {
  AttachmentService,
  Attachment,
  UploadProgress,
} from '../../../core/services/attachment.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-attachments-section',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressBar],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div
          class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <i class="pi pi-paperclip !text-[18px]"></i>
          <span>Attachments ({{ attachments().length }})</span>
        </div>
        <label class="cursor-pointer">
          <input
            type="file"
            class="hidden"
            (change)="onFileSelected($event)"
            multiple
          />
          <span
            class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-md cursor-pointer transition-colors"
          >
            <i class="pi pi-upload !text-[14px]"></i>
            Upload
          </span>
        </label>
      </div>

      <!-- Upload progress -->
      @if (uploading()) {
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>Uploading {{ uploadFileName() }}...</span>
            <span>{{ uploadProgress() }}%</span>
          </div>
          <p-progressbar
            [value]="uploadProgress()"
            [showValue]="false"
            [style]="{ height: '6px' }"
          />
        </div>
      }

      <!-- Drop zone -->
      <div
        class="border-2 border-dashed rounded-lg p-4 text-center transition-colors"
        [class]="
          dragOver()
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-200 dark:border-gray-700'
        "
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        @if (attachments().length === 0 && !loading()) {
          <div class="flex flex-col items-center gap-1 py-2">
            <i
              class="pi pi-cloud-upload !text-[24px] text-gray-300 dark:text-gray-600"
            ></i>
            <p class="text-xs text-gray-400">Drag files here or click Upload</p>
          </div>
        }

        @if (loading()) {
          <p class="text-sm text-gray-400 py-2">Loading attachments...</p>
        }

        <!-- Attachment list -->
        @if (!loading() && attachments().length > 0) {
          <div class="space-y-2 text-left">
            @for (attachment of attachments(); track attachment.id) {
              <div
                class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors"
              >
                <!-- File icon -->
                <div
                  class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  [class]="getFileIconBg(attachment.mime_type)"
                >
                  <i
                    class="pi !text-[16px] text-white"
                    [class]="getFileIcon(attachment.mime_type)"
                  ></i>
                </div>

                <!-- File info -->
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                  >
                    {{ attachment.file_name }}
                  </p>
                  <p class="text-xs text-gray-400">
                    {{ formatFileSize(attachment.file_size) }}
                    · {{ formatDate(attachment.created_at) }}
                  </p>
                </div>

                <!-- Actions -->
                <div
                  class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    pButton
                    [rounded]="true"
                    [text]="true"
                    severity="secondary"
                    class="!w-7 !h-7"
                    (click)="downloadAttachment(attachment)"
                    title="Download"
                  >
                    <i class="pi pi-download !text-[16px]"></i>
                  </button>
                  @if (attachment.uploaded_by === currentUserId()) {
                    <button
                      pButton
                      [rounded]="true"
                      [text]="true"
                      severity="danger"
                      class="!w-7 !h-7"
                      (click)="deleteAttachment(attachment)"
                      title="Delete"
                    >
                      <i class="pi pi-trash !text-[16px]"></i>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AttachmentsSectionComponent implements OnInit {
  private attachmentService = inject(AttachmentService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  taskId = input.required<string>();

  attachments = signal<Attachment[]>([]);
  loading = signal(true);
  uploading = signal(false);
  uploadProgress = signal(0);
  uploadFileName = signal('');
  dragOver = signal(false);

  currentUserId = (() => this.authService.currentUser()?.id) as () =>
    | string
    | undefined;

  ngOnInit(): void {
    this.loadAttachments();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      for (let i = 0; i < input.files.length; i++) {
        this.uploadFile(input.files[i]);
      }
      // Reset input so the same file can be selected again
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    if (event.dataTransfer?.files) {
      for (let i = 0; i < event.dataTransfer.files.length; i++) {
        this.uploadFile(event.dataTransfer.files[i]);
      }
    }
  }

  downloadAttachment(attachment: Attachment): void {
    this.attachmentService.getDownloadUrl(attachment.id).subscribe({
      next: (response) => {
        window.open(response.downloadUrl, '_blank');
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to get download URL.',
          life: 3000,
        });
      },
    });
  }

  deleteAttachment(attachment: Attachment): void {
    if (!confirm(`Delete "${attachment.file_name}"?`)) return;

    this.attachmentService.delete(attachment.id).subscribe({
      next: () => {
        this.attachments.update((list) =>
          list.filter((a) => a.id !== attachment.id),
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Attachment deleted.',
          life: 2000,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete attachment.',
          life: 3000,
        });
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'pi-image';
    if (mimeType.startsWith('video/')) return 'pi-video';
    if (mimeType.startsWith('audio/')) return 'pi-volume-up';
    if (mimeType === 'application/pdf') return 'pi-file-pdf';
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType === 'text/csv'
    )
      return 'pi-file-excel';
    if (
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.startsWith('text/')
    )
      return 'pi-file-word';
    if (
      mimeType.includes('zip') ||
      mimeType.includes('rar') ||
      mimeType.includes('tar') ||
      mimeType.includes('gzip')
    )
      return 'pi-box';
    return 'pi-file';
  }

  getFileIconBg(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'bg-purple-500';
    if (mimeType.startsWith('video/')) return 'bg-pink-500';
    if (mimeType.startsWith('audio/')) return 'bg-orange-500';
    if (mimeType === 'application/pdf') return 'bg-red-500';
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType === 'text/csv'
    )
      return 'bg-green-500';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
      return 'bg-amber-500';
    if (
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.startsWith('text/')
    )
      return 'bg-blue-500';
    if (
      mimeType.includes('zip') ||
      mimeType.includes('rar') ||
      mimeType.includes('tar') ||
      mimeType.includes('gzip')
    )
      return 'bg-gray-500';
    return 'bg-indigo-500';
  }

  private uploadFile(file: File): void {
    // 50 MB limit
    if (file.size > 50 * 1024 * 1024) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'File too large. Maximum size is 50 MB.',
        life: 3000,
      });
      return;
    }

    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.uploadFileName.set(file.name);

    this.attachmentService.uploadFile(this.taskId(), file).subscribe({
      next: (event: UploadProgress) => {
        if (event.status === 'uploading') {
          this.uploadProgress.set(event.progress);
        } else if (event.status === 'completed') {
          if (event.attachment) {
            this.attachments.update((list) => [event.attachment!, ...list]);
          }
          this.uploading.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Uploaded',
            detail: 'File uploaded.',
            life: 2000,
          });
        } else if (event.status === 'error') {
          this.uploading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: event.error || 'Failed to upload file.',
            life: 3000,
          });
        }
      },
      error: () => {
        this.uploading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to upload file.',
          life: 3000,
        });
      },
    });
  }

  private loadAttachments(): void {
    this.loading.set(true);
    this.attachmentService.listByTask(this.taskId()).subscribe({
      next: (attachments) => {
        this.attachments.set(attachments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load attachments.',
          life: 3000,
        });
      },
    });
  }
}
