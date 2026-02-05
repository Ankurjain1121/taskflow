import {
  Component,
  input,
  signal,
  effect,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import {
  AttachmentService,
  Attachment,
} from '../../../core/services/attachment.service';
import { FileSizePipe } from '../../../shared/pipes/file-size.pipe';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  selector: 'app-attachment-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    FileSizePipe,
  ],
  template: `
    @if (isLoading()) {
      <div class="flex items-center justify-center py-8">
        <mat-spinner diameter="32"></mat-spinner>
        <span class="ml-3 text-gray-500">Loading attachments...</span>
      </div>
    } @else if (attachments().length === 0) {
      <div class="text-center py-8 text-gray-500">
        <mat-icon class="text-4xl text-gray-300 mb-2">attach_file</mat-icon>
        <p>No files attached yet.</p>
      </div>
    } @else {
      <div class="space-y-2">
        @for (attachment of attachments(); track attachment.id) {
          <div
            class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
          >
            <!-- File type icon -->
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              [class]="getFileIconBgClass(attachment.mime_type)"
            >
              <mat-icon class="text-white">
                {{ getFileIcon(attachment.mime_type, attachment.file_name) }}
              </mat-icon>
            </div>

            <!-- File info -->
            <div class="flex-1 min-w-0">
              <button
                (click)="downloadFile(attachment)"
                class="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block text-left w-full"
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
            <div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              @if (downloadingId() === attachment.id) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <button
                  mat-icon-button
                  (click)="downloadFile(attachment)"
                  title="Download"
                >
                  <mat-icon>download</mat-icon>
                </button>
              }

              <button
                mat-icon-button
                (click)="confirmDelete(attachment)"
                [disabled]="deletingId() === attachment.id"
                title="Delete"
                class="text-gray-400 hover:text-red-500"
              >
                @if (deletingId() === attachment.id) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  <mat-icon>delete</mat-icon>
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
export class AttachmentListComponent implements OnDestroy {
  private attachmentService = inject(AttachmentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private destroy$ = new Subject<void>();

  taskId = input.required<string>();

  attachments = signal<Attachment[]>([]);
  isLoading = signal(false);
  downloadingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);

  constructor() {
    // Load attachments when taskId changes
    effect(() => {
      const taskId = this.taskId();
      if (taskId) {
        this.loadAttachments();
      }
    });
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
        error: (error) => {
          console.error('Failed to load attachments:', error);
          this.isLoading.set(false);
          this.snackBar.open('Failed to load attachments', 'Dismiss', {
            duration: 3000,
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
        error: (error) => {
          console.error('Failed to get download URL:', error);
          this.downloadingId.set(null);
          this.snackBar.open('Failed to download file', 'Dismiss', {
            duration: 3000,
          });
        },
      });
  }

  confirmDelete(attachment: Attachment): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Attachment',
        message: `Are you sure you want to delete "${attachment.file_name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteAttachment(attachment);
      }
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
            attachments.filter((a) => a.id !== attachment.id)
          );
          this.deletingId.set(null);
          this.snackBar.open('Attachment deleted', 'Dismiss', {
            duration: 3000,
          });
        },
        error: (error) => {
          console.error('Failed to delete attachment:', error);
          this.deletingId.set(null);
          this.snackBar.open('Failed to delete attachment', 'Dismiss', {
            duration: 3000,
          });
        },
      });
  }

  getFileIcon(mimeType: string, fileName: string): string {
    // Check by MIME type first
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'movie';
    if (mimeType.startsWith('audio/')) return 'audio_file';
    if (mimeType === 'application/pdf') return 'picture_as_pdf';

    // Fall back to extension
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'doc':
      case 'docx':
        return 'description';
      case 'xls':
      case 'xlsx':
        return 'table_chart';
      case 'ppt':
      case 'pptx':
        return 'slideshow';
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

  getFileIconBgClass(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'bg-pink-500';
    if (mimeType.startsWith('video/')) return 'bg-purple-500';
    if (mimeType.startsWith('audio/')) return 'bg-orange-500';
    if (mimeType === 'application/pdf') return 'bg-red-500';
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel')
    )
      return 'bg-green-500';
    if (
      mimeType.includes('presentation') ||
      mimeType.includes('powerpoint')
    )
      return 'bg-yellow-500';
    if (
      mimeType.includes('word') ||
      mimeType.includes('document')
    )
      return 'bg-blue-500';
    if (mimeType.includes('zip') || mimeType.includes('archive'))
      return 'bg-gray-500';
    return 'bg-indigo-500';
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
