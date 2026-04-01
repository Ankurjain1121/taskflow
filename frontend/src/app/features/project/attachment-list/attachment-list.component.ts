import {
  Component,
  input,
  signal,
  effect,
  inject,
  Injector,
  OnInit,
  OnDestroy,
  untracked,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';

import {
  AttachmentService,
  Attachment,
} from '../../../core/services/attachment.service';
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe';

@Component({
  selector: 'app-attachment-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressSpinner,
    ConfirmDialog,
    Toast,
    FileSizePipe,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />
    @if (isLoading()) {
      <div class="flex items-center justify-center py-8">
        <p-progressSpinner
          [style]="{ width: '32px', height: '32px' }"
          strokeWidth="4"
        />
        <span class="ml-3 text-[var(--muted-foreground)]"
          >Loading attachments...</span
        >
      </div>
    } @else if (attachments().length === 0) {
      <div class="text-center py-8 text-[var(--muted-foreground)]">
        <i class="pi pi-paperclip text-4xl text-gray-300 mb-2"></i>
        <p>No files attached yet.</p>
      </div>
    } @else {
      <div class="space-y-2">
        @for (attachment of attachments(); track attachment.id) {
          <div
            class="bg-[var(--card)] rounded-lg border border-[var(--border)] p-3 flex items-center gap-3 hover:bg-[var(--muted)] transition-colors group"
          >
            <!-- File type icon -->
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              [class]="getFileIconBgClass(attachment.mime_type)"
            >
              <i
                [class]="
                  'pi ' +
                  getFileIcon(attachment.mime_type, attachment.file_name) +
                  ' text-white'
                "
              ></i>
            </div>

            <!-- File info -->
            <div class="flex-1 min-w-0">
              <button
                (click)="downloadFile(attachment)"
                class="text-sm font-medium text-[var(--card-foreground)] hover:text-primary truncate block text-left w-full"
                [disabled]="downloadingId() === attachment.id"
              >
                {{ attachment.file_name }}
              </button>
              <div class="text-xs text-gray-400 flex items-center gap-2">
                <span>{{ attachment.file_size | fileSize }}</span>
                <span class="text-gray-300">|</span>
                <span>{{ attachment.uploader.display_name }}</span>
                <span class="text-gray-300">|</span>
                <span>{{ formatTimestamp(attachment.created_at) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div
              class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              @if (downloadingId() === attachment.id) {
                <p-progressSpinner
                  [style]="{ width: '20px', height: '20px' }"
                  strokeWidth="4"
                />
              } @else {
                <button
                  pButton
                  [rounded]="true"
                  [text]="true"
                  (click)="downloadFile(attachment)"
                  title="Download"
                  aria-label="Download"
                >
                  <i class="pi pi-download"></i>
                </button>
              }

              <button
                pButton
                [rounded]="true"
                [text]="true"
                (click)="confirmDelete(attachment)"
                [disabled]="deletingId() === attachment.id"
                title="Delete"
                aria-label="Delete"
                class="text-gray-400 hover:text-red-500"
              >
                @if (deletingId() === attachment.id) {
                  <p-progressSpinner
                    [style]="{ width: '20px', height: '20px' }"
                    strokeWidth="4"
                  />
                } @else {
                  <i class="pi pi-trash"></i>
                }
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AttachmentListComponent implements OnInit, OnDestroy {
  private attachmentService = inject(AttachmentService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private injector = inject(Injector);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();

  attachments = signal<Attachment[]>([]);
  isLoading = signal(false);
  downloadingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);

  ngOnInit(): void {
    // Load attachments when taskId changes
    effect(
      () => {
        const taskId = this.taskId();
        untracked(() => {
          if (taskId) {
            this.loadAttachments();
          }
        });
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAttachments(): void {
    this.isLoading.set(true);

    this.attachmentService
      .listByTask(this.taskId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (attachments) => {
          this.attachments.set(attachments);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load attachments',
          });
        },
      });
  }

  downloadFile(attachment: Attachment): void {
    if (this.downloadingId()) return;

    this.downloadingId.set(attachment.id);

    this.attachmentService
      .getDownloadUrl(attachment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // Open download URL in new tab
          window.open(response.downloadUrl, '_blank');
          this.downloadingId.set(null);
        },
        error: () => {
          this.downloadingId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to download file',
          });
        },
      });
  }

  confirmDelete(attachment: Attachment): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${attachment.file_name}"? This action cannot be undone.`,
      header: 'Delete Attachment',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deleteAttachment(attachment);
      },
    });
  }

  private deleteAttachment(attachment: Attachment): void {
    this.deletingId.set(attachment.id);

    this.attachmentService
      .delete(attachment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.attachments.update((attachments) =>
            attachments.filter((a) => a.id !== attachment.id),
          );
          this.deletingId.set(null);
          this.messageService.add({
            severity: 'success',
            summary: 'Deleted',
            detail: 'Attachment deleted',
          });
        },
        error: () => {
          this.deletingId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to delete attachment',
          });
        },
      });
  }

  getFileIcon(mimeType: string, fileName: string): string {
    // Check by MIME type first
    if (mimeType.startsWith('image/')) return 'pi-image';
    if (mimeType.startsWith('video/')) return 'pi-video';
    if (mimeType.startsWith('audio/')) return 'pi-volume-up';
    if (mimeType === 'application/pdf') return 'pi-file-pdf';

    // Fall back to extension
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'doc':
      case 'docx':
        return 'pi-file-word';
      case 'xls':
      case 'xlsx':
        return 'pi-file-excel';
      case 'ppt':
      case 'pptx':
        return 'pi-file';
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

  getFileIconBgClass(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'bg-pink-500';
    if (mimeType.startsWith('video/')) return 'bg-purple-500';
    if (mimeType.startsWith('audio/')) return 'bg-orange-500';
    if (mimeType === 'application/pdf') return 'bg-red-500';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
      return 'bg-green-500';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
      return 'bg-yellow-500';
    if (mimeType.includes('word') || mimeType.includes('document'))
      return 'bg-blue-500';
    if (mimeType.includes('zip') || mimeType.includes('archive'))
      return 'bg-gray-500';
    return 'bg-primary';
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  }

  /**
   * Called externally when a new attachment is uploaded
   */
  addAttachment(attachment: Attachment): void {
    this.attachments.update((attachments) => [attachment, ...attachments]);
  }
}
