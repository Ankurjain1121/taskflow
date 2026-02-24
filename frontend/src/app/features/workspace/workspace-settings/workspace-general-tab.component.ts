import {
  Component,
  input,
  output,
  signal,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { switchMap, map, finalize } from 'rxjs';
import { Workspace } from '../../../core/services/workspace.service';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-workspace-general-tab',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="py-6 space-y-6">
      <!-- Error banner -->
      @if (errorMessage()) {
        <div
          class="p-3 rounded-md text-sm text-[var(--status-red-text)] bg-[var(--status-red-bg)] border border-[var(--status-red-border)]"
        >
          {{ errorMessage() }}
        </div>
      }

      <!-- Logo Upload -->
      <div class="widget-card p-6">
        <h3 class="text-sm font-medium text-[var(--foreground)] mb-4">
          Workspace Logo
        </h3>
        <div class="flex items-center gap-6">
          <div
            class="w-20 h-20 rounded-lg bg-[var(--muted)] flex items-center justify-center text-2xl font-bold text-[var(--muted-foreground)] overflow-hidden border-2 border-dashed border-[var(--border)]"
          >
            @if (logoPreview() || workspace()?.logo_url) {
              <img
                [src]="logoPreview() || workspace()?.logo_url"
                alt="Workspace logo"
                class="w-full h-full object-cover"
              />
            } @else {
              {{ workspace()?.name?.charAt(0)?.toUpperCase() }}
            }
          </div>
          <div>
            <button
              (click)="logoInput.click()"
              [disabled]="uploadingLogo()"
              class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/10 disabled:opacity-50"
            >
              @if (uploadingLogo()) {
                Uploading...
              } @else {
                Change Logo
              }
            </button>
            <input
              #logoInput
              type="file"
              accept="image/png,image/jpeg,image/webp"
              (change)="onLogoSelected($event)"
              class="hidden"
            />
            <p class="mt-1 text-xs text-[var(--muted-foreground)]">
              PNG, JPG, or WebP. Max 2MB.
            </p>
          </div>
        </div>
      </div>

      <!-- Name & Description -->
      <div class="widget-card">
        <div class="px-6 py-4 border-b border-[var(--border)]">
          <h3 class="text-sm font-medium text-[var(--foreground)]">
            General Information
          </h3>
        </div>
        <form
          [formGroup]="form"
          (ngSubmit)="onSave()"
          class="px-6 py-4 space-y-4"
        >
          <div>
            <label
              for="name"
              class="block text-sm font-medium text-[var(--foreground)]"
              >Name</label
            >
            <input
              type="text"
              id="name"
              formControlName="name"
              class="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
            />
            @if (
              form.controls['name'].invalid && form.controls['name'].touched
            ) {
              <p class="mt-1 text-sm text-[var(--status-red-text)]">
                Name is required
              </p>
            }
          </div>

          <div>
            <label
              for="description"
              class="block text-sm font-medium text-[var(--foreground)]"
              >Description</label
            >
            <textarea
              id="description"
              formControlName="description"
              rows="3"
              placeholder="Describe what this workspace is for..."
              class="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm placeholder:text-[var(--muted-foreground)]"
            ></textarea>
          </div>

          <!-- Visibility -->
          @if (isAdmin()) {
            <div>
              <label
                for="visibility"
                class="block text-sm font-medium text-[var(--foreground)]"
                >Visibility</label
              >
              <select
                id="visibility"
                formControlName="visibility"
                class="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] px-3 py-2 shadow-sm focus:border-primary focus:ring-ring sm:text-sm"
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
              </select>
              <p class="mt-1 text-xs text-[var(--muted-foreground)]">
                Open workspaces can be discovered and joined by anyone in your
                organization.
              </p>
            </div>
          }

          <div class="flex justify-end pt-4">
            <button
              type="submit"
              [disabled]="saving() || form.invalid || !form.dirty"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (saving()) {
                <svg
                  class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              } @else {
                Save Changes
              }
            </button>
          </div>
        </form>
      </div>

      <!-- Danger Zone -->
      @if (isAdmin()) {
        <div class="widget-card border-2 border-[var(--status-red-border)]">
          <div
            class="px-6 py-4 border-b border-[var(--status-red-border)] bg-[var(--status-red-bg)]"
          >
            <h3 class="text-sm font-medium text-[var(--status-red-text)]">
              Danger Zone
            </h3>
          </div>
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-medium text-[var(--foreground)]">
                  Delete Workspace
                </h4>
                <p class="text-sm text-[var(--muted-foreground)]">
                  Permanently delete this workspace and all its data. This
                  action cannot be undone.
                </p>
              </div>
              <button
                (click)="onDeleteWorkspace()"
                [disabled]="deleting()"
                class="inline-flex items-center px-4 py-2 border border-[var(--status-red-border)] text-sm font-medium rounded-md text-[var(--status-red-text)] bg-[var(--card)] hover:bg-[var(--status-red-bg)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                @if (deleting()) {
                  Deleting...
                } @else {
                  Delete Workspace
                }
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class WorkspaceGeneralTabComponent {
  private fb = inject(FormBuilder);
  private workspaceService = inject(WorkspaceService);
  private uploadService = inject(UploadService);

  workspace = input<Workspace | null>(null);
  workspaceId = input.required<string>();
  isAdmin = input(false);

  workspaceSaved = output<Workspace>();
  deleteRequested = output<void>();

  saving = signal(false);
  deleting = signal(false);
  logoPreview = signal<string | null>(null);
  uploadingLogo = signal(false);
  errorMessage = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    visibility: ['closed'],
  });

  patchForm(workspace: Workspace): void {
    this.form.patchValue({
      name: workspace.name,
      description: workspace.description || '',
      visibility: workspace.visibility || 'closed',
    });
  }

  onSave(): void {
    if (this.form.invalid) return;

    const { name, description, visibility } = this.form.value;
    const snapshotWorkspace = this.workspace();

    // Optimistic: emit updated workspace to parent, mark pristine
    if (snapshotWorkspace) {
      this.workspaceSaved.emit({
        ...snapshotWorkspace,
        name,
        description,
        visibility: visibility || snapshotWorkspace.visibility,
      });
    }
    this.form.markAsPristine();

    this.workspaceService
      .update(this.workspaceId(), { name, description })
      .subscribe({
        next: (updated) => {
          // Also update visibility if it changed
          const currentVisibility = snapshotWorkspace?.visibility || 'closed';
          if (visibility && visibility !== currentVisibility) {
            this.workspaceService
              .updateVisibility(this.workspaceId(), visibility)
              .subscribe({
                next: () => {
                  this.workspaceSaved.emit({ ...updated, visibility });
                },
                error: () => {
                  // Visibility update failed but name/desc saved
                  this.workspaceSaved.emit(updated);
                  this.showError(
                    'Saved name/description but failed to update visibility',
                  );
                },
              });
          } else {
            this.workspaceSaved.emit(updated);
          }
        },
        error: () => {
          // Rollback: re-emit original workspace
          if (snapshotWorkspace) {
            this.workspaceSaved.emit(snapshotWorkspace);
            this.form.patchValue({
              name: snapshotWorkspace.name,
              description: snapshotWorkspace.description || '',
              visibility: snapshotWorkspace.visibility || 'closed',
            });
          }
          this.showError('Failed to save workspace settings');
        },
      });
  }

  onDeleteWorkspace(): void {
    this.deleteRequested.emit();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a PNG, JPG, or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be under 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.logoPreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    this.uploadingLogo.set(true);
    this.uploadService
      .getLogoUploadUrl(this.workspaceId(), file.name, file.size, file.type)
      .pipe(
        switchMap((presigned) =>
          this.uploadService
            .uploadFileToPresignedUrl(presigned.upload_url, file)
            .pipe(map(() => presigned)),
        ),
        switchMap((presigned) =>
          this.uploadService.confirmLogoUpload(
            this.workspaceId(),
            presigned.storage_key,
          ),
        ),
        finalize(() => this.uploadingLogo.set(false)),
      )
      .subscribe({
        next: (result) => {
          const ws = this.workspace();
          if (ws) {
            this.workspaceSaved.emit({ ...ws, logo_url: result.logo_url });
          }
          this.logoPreview.set(null);
        },
      });

    input.value = '';
  }

  private showError(message: string): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }
}
