import {
  Component,
  input,
  output,
  signal,
  inject,
  ElementRef,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { UploadService } from '../../../core/services/upload.service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Component({
  selector: 'app-avatar-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="flex flex-col items-center gap-4">
      <!-- Preview -->
      <div
        class="relative overflow-hidden flex items-center justify-center"
        [class]="
          entityType() === 'avatar'
            ? 'w-24 h-24 rounded-full'
            : 'w-32 h-32 rounded-lg'
        "
        style="background: var(--muted); border: 2px solid var(--border)"
      >
        @if (previewUrl()) {
          <img
            [src]="previewUrl()"
            alt="Preview"
            class="w-full h-full object-cover"
            (error)="onImageError()"
          />
        } @else {
          <i
            class="text-3xl"
            [class]="entityType() === 'avatar' ? 'pi pi-user' : 'pi pi-image'"
            style="color: var(--muted-foreground)"
          ></i>
        }
      </div>

      <!-- Drop Zone -->
      <div
        class="w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer"
        [style.border-color]="isDragOver() ? 'var(--primary)' : 'var(--border)'"
        [style.background]="isDragOver() ? 'var(--muted)' : 'transparent'"
        (click)="fileInput().nativeElement.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
      >
        @if (uploadState() === 'idle') {
          <div class="flex flex-col items-center gap-2">
            <i
              class="pi pi-cloud-upload text-2xl"
              style="color: var(--muted-foreground)"
            ></i>
            <p class="text-sm" style="color: var(--foreground)">
              Drag and drop an image here, or click to browse
            </p>
            <p class="text-xs" style="color: var(--muted-foreground)">
              JPEG, PNG, or WebP. Max 5MB.
            </p>
          </div>
        }

        @if (uploadState() === 'uploading') {
          <div class="flex flex-col items-center gap-2">
            <i
              class="pi pi-spin pi-spinner text-2xl"
              style="color: var(--primary)"
            ></i>
            <p class="text-sm" style="color: var(--foreground)">Uploading...</p>
          </div>
        }

        @if (uploadState() === 'confirming') {
          <div class="flex flex-col items-center gap-2">
            <i
              class="pi pi-spin pi-spinner text-2xl"
              style="color: var(--primary)"
            ></i>
            <p class="text-sm" style="color: var(--foreground)">
              Confirming...
            </p>
          </div>
        }

        @if (uploadState() === 'error') {
          <div class="flex flex-col items-center gap-2">
            <i class="pi pi-exclamation-triangle text-2xl text-[var(--destructive)]"></i>
            <p class="text-sm text-[var(--destructive)]">{{ errorMessage() }}</p>
            <p class="text-xs" style="color: var(--muted-foreground)">
              Click or drag to try again
            </p>
          </div>
        }
      </div>

      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        (change)="onFileSelected($event)"
      />

      <!-- Remove button (only if there's a current image) -->
      @if (previewUrl()) {
        <p-button
          [text]="true"
          severity="danger"
          icon="pi pi-trash"
          label="Remove Image"
          size="small"
          (onClick)="removeImage()"
        />
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
export class AvatarUploadComponent {
  private readonly uploadService = inject(UploadService);
  private readonly messageService = inject(MessageService);

  entityType = input.required<'avatar' | 'logo'>();
  currentUrl = input<string | null>(null);
  workspaceId = input<string>('');

  uploaded = output<string>();

  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  isDragOver = signal(false);
  uploadState = signal<'idle' | 'uploading' | 'confirming' | 'error'>('idle');
  errorMessage = signal('');
  previewUrl = signal<string | null>(null);

  constructor() {
    // Initialize preview from currentUrl once it's available
    const checkInterval = setInterval(() => {
      const url = this.currentUrl();
      if (url) {
        this.previewUrl.set(url);
        clearInterval(checkInterval);
      }
    }, 100);
    // Clean up after 2 seconds regardless
    setTimeout(() => clearInterval(checkInterval), 2000);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
    // Reset input so the same file can be selected again
    input.value = '';
  }

  onImageError(): void {
    this.previewUrl.set(null);
  }

  removeImage(): void {
    this.previewUrl.set(null);
    this.uploaded.emit('');
  }

  private processFile(file: File): void {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.uploadState.set('error');
      this.errorMessage.set(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
      );
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      this.uploadState.set('error');
      this.errorMessage.set('File is too large. Maximum size is 5MB.');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    this.uploadState.set('uploading');

    this.uploadService
      .getAvatarUploadUrl(file.name, file.size, file.type)
      .subscribe({
        next: (response) => {
          // Upload to presigned URL
          this.uploadService
            .uploadFileToPresignedUrl(response.upload_url, file)
            .subscribe({
              next: () => {
                // Confirm the upload
                this.uploadState.set('confirming');
                this.uploadService
                  .confirmAvatarUpload(response.storage_key)
                  .subscribe({
                    next: (confirmResponse) => {
                      this.uploadState.set('idle');
                      this.previewUrl.set(confirmResponse.avatar_url);
                      this.uploaded.emit(confirmResponse.avatar_url);
                      this.messageService.add({
                        severity: 'success',
                        summary: 'Uploaded',
                        detail: 'Image uploaded successfully',
                      });
                    },
                    error: () => {
                      this.uploadState.set('error');
                      this.errorMessage.set(
                        'Failed to confirm upload. Please try again.',
                      );
                    },
                  });
              },
              error: () => {
                this.uploadState.set('error');
                this.errorMessage.set(
                  'Failed to upload file. Please try again.',
                );
              },
            });
        },
        error: () => {
          this.uploadState.set('error');
          this.errorMessage.set('Failed to get upload URL. Please try again.');
        },
      });
  }
}
