import {
  Component,
  inject,
  signal,
  OnInit,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { UploadService } from '../../../core/services/upload.service';
import { switchMap } from 'rxjs';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

@Component({
  selector: 'app-profile-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <!-- Profile Card -->
    <div
      class="rounded-lg border shadow-sm p-6"
      style="background: var(--card); border-color: var(--border)"
    >
      <h2 class="text-xl font-semibold mb-4" style="color: var(--foreground)">
        Profile
      </h2>

      <form (ngSubmit)="saveProfile()" #profileForm="ngForm" class="space-y-5">
        <!-- Avatar -->
        <div class="flex items-start gap-5">
          <div
            class="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 flex items-center justify-center"
            style="border-color: var(--border); background: var(--muted)"
          >
            @if (avatarPreview()) {
              <img
                [src]="avatarPreview()"
                alt="Avatar"
                class="w-full h-full object-cover"
              />
            } @else {
              <span
                class="text-2xl font-bold"
                style="color: var(--muted-foreground)"
                >{{ initials() }}</span
              >
            }
            @if (avatarUploading()) {
              <div
                class="absolute inset-0 flex items-center justify-center"
                style="background: rgba(0,0,0,0.5)"
                role="status"
                aria-live="polite"
              >
                <i class="pi pi-spin pi-spinner text-white text-xl"></i>
              </div>
            }
          </div>

          <div class="flex flex-col gap-2">
            <div
              class="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
              [style.border-color]="
                dragOver() ? 'var(--primary)' : 'var(--border)'
              "
              [style.background]="dragOver() ? 'var(--muted)' : 'transparent'"
              (click)="fileInput.click()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave()"
              (drop)="onDrop($event)"
            >
              <i
                class="pi pi-cloud-upload text-xl mb-1"
                style="color: var(--muted-foreground)"
              ></i>
              <p class="text-sm" style="color: var(--muted-foreground)">
                Drop an image here or click to upload
              </p>
              <p class="text-xs mt-1" style="color: var(--muted-foreground)">
                JPEG, PNG or WebP. Max 5MB.
              </p>
            </div>
            <input
              #fileInput
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              (change)="onFileSelected($event)"
            />
          </div>
        </div>

        <!-- Name -->
        <div class="flex flex-col gap-2">
          <label
            for="profileName"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Name</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"><i class="pi pi-user"></i></span>
            <input
              pInputText
              id="profileName"
              type="text"
              name="name"
              [(ngModel)]="name"
              required
              maxlength="100"
              #nameInput="ngModel"
              class="w-full"
            />
          </div>
          @if (nameInput.invalid && (nameInput.dirty || nameInput.touched)) {
            @if (nameInput.errors?.['required']) {
              <small class="text-red-500">Name is required</small>
            }
          }
        </div>

        <!-- Email (read-only) -->
        <div class="flex flex-col gap-2">
          <label
            for="profileEmail"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Email</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"
              ><i class="pi pi-envelope"></i
            ></span>
            <input
              pInputText
              id="profileEmail"
              type="email"
              name="email"
              [ngModel]="email()"
              disabled
              class="w-full"
            />
          </div>
          <small style="color: var(--muted-foreground)"
            >Email cannot be changed</small
          >
        </div>

        <!-- Phone Number -->
        <div class="flex flex-col gap-2">
          <label
            for="profilePhone"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Phone Number</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"><i class="pi pi-phone"></i></span>
            <input
              pInputText
              id="profilePhone"
              type="tel"
              name="phone_number"
              [(ngModel)]="phoneNumber"
              placeholder="+1234567890"
              #phoneInput="ngModel"
              class="w-full"
            />
          </div>
          @if (phoneNumber && !isPhoneValid()) {
            <small class="text-red-500"
              >Use E.164 format (e.g. +1234567890)</small
            >
          }
          <small class="text-xs" style="color: var(--muted-foreground)">
            E.164 format (e.g., +919876543210). Required for WhatsApp notifications.
          </small>
        </div>

        <!-- Job Title -->
        <div class="flex flex-col gap-2">
          <label
            for="profileJobTitle"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Job Title</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"
              ><i class="pi pi-briefcase"></i
            ></span>
            <input
              pInputText
              id="profileJobTitle"
              type="text"
              name="job_title"
              [(ngModel)]="jobTitle"
              maxlength="100"
              placeholder="e.g. Product Manager"
              class="w-full"
            />
          </div>
        </div>

        <!-- Department -->
        <div class="flex flex-col gap-2">
          <label
            for="profileDepartment"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Department</label
          >
          <div class="p-inputgroup">
            <span class="p-inputgroup-addon"
              ><i class="pi pi-building"></i
            ></span>
            <input
              pInputText
              id="profileDepartment"
              type="text"
              name="department"
              [(ngModel)]="department"
              maxlength="100"
              placeholder="e.g. Engineering"
              class="w-full"
            />
          </div>
        </div>

        <!-- Bio -->
        <div class="flex flex-col gap-2">
          <label
            for="profileBio"
            class="text-sm font-medium"
            style="color: var(--foreground)"
            >Bio</label
          >
          <textarea
            pInputText
            id="profileBio"
            name="bio"
            [(ngModel)]="bio"
            maxlength="500"
            rows="3"
            placeholder="A short bio about yourself"
            class="w-full"
            style="resize: vertical"
          ></textarea>
          <small style="color: var(--muted-foreground)"
            >{{ bio.length }}/500 characters</small
          >
        </div>

        <!-- Save -->
        <div class="flex justify-end">
          <p-button
            type="submit"
            [label]="profileLoading() ? 'Saving...' : 'Save Profile'"
            [disabled]="
              profileLoading() ||
              profileForm.invalid ||
              (!!phoneNumber && !isPhoneValid())
            "
            [loading]="profileLoading()"
          />
        </div>
      </form>
    </div>

    <!-- Danger Zone -->
    <div
      class="rounded-lg border-2 shadow-sm p-6 mt-6"
      style="background: var(--card); border-color: var(--destructive)"
    >
      <h2 class="text-xl font-semibold mb-1" style="color: var(--destructive)">Danger Zone</h2>
      <p class="text-sm mb-4" style="color: var(--muted-foreground)">
        Permanently delete your account and all associated data. This action
        cannot be undone.
      </p>

      @if (!showDeleteConfirm()) {
        <p-button
          label="Delete Account"
          severity="danger"
          icon="pi pi-trash"
          (onClick)="showDeleteConfirm.set(true)"
        />
      } @else {
        <div
          class="rounded-lg border p-4 space-y-3"
          style="border-color: var(--destructive); background: color-mix(in srgb, var(--destructive) 5%, transparent)"
        >
          <p class="text-sm font-medium" style="color: var(--foreground)">
            Type <strong>DELETE</strong> and enter your password to confirm:
          </p>

          <div class="flex flex-col gap-2">
            <input
              pInputText
              type="text"
              name="deleteConfirmText"
              [(ngModel)]="deleteConfirmText"
              placeholder='Type "DELETE"'
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <input
              pInputText
              type="password"
              name="deletePassword"
              [(ngModel)]="deletePassword"
              placeholder="Enter your password"
              class="w-full"
            />
          </div>

          <div class="flex gap-2 justify-end">
            <p-button
              label="Cancel"
              severity="secondary"
              [outlined]="true"
              (onClick)="cancelDelete()"
            />
            <p-button
              label="Permanently Delete"
              severity="danger"
              icon="pi pi-trash"
              [disabled]="
                deleteConfirmText !== 'DELETE' ||
                !deletePassword ||
                deleteLoading()
              "
              [loading]="deleteLoading()"
              (onClick)="confirmDeleteAccount()"
            />
          </div>
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
export class ProfileSectionComponent implements OnInit {
  private authService = inject(AuthService);
  private uploadService = inject(UploadService);
  private messageService = inject(MessageService);

  name = '';
  phoneNumber = '';
  avatarUrl = '';
  jobTitle = '';
  department = '';
  bio = '';

  deleteConfirmText = '';
  deletePassword = '';

  profileLoading = signal(false);
  avatarUploading = signal(false);
  deleteLoading = signal(false);
  showDeleteConfirm = signal(false);
  dragOver = signal(false);

  email = computed(() => this.authService.currentUser()?.email ?? '');
  initials = computed(() => {
    const user = this.authService.currentUser();
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });
  avatarPreview = signal<string | null>(null);

  isPhoneValid = computed(() => {
    if (!this.phoneNumber) return true;
    return PHONE_REGEX.test(this.phoneNumber);
  });

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      this.name = user.name;
      this.phoneNumber = user.phone_number ?? '';
      this.avatarUrl = user.avatar_url ?? '';
      this.avatarPreview.set(user.avatar_url ?? null);
      this.jobTitle = user.job_title ?? '';
      this.department = user.department ?? '';
      this.bio = user.bio ?? '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(): void {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleAvatarUpload(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleAvatarUpload(file);
    }
    input.value = '';
  }

  private handleAvatarUpload(file: File): void {
    if (!ALLOWED_TYPES.includes(file.type)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid file type',
        detail: 'Please upload a JPEG, PNG or WebP image.',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.messageService.add({
        severity: 'error',
        summary: 'File too large',
        detail: 'Maximum file size is 5MB.',
      });
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      this.avatarPreview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    this.avatarUploading.set(true);

    this.uploadService
      .getAvatarUploadUrl(file.name, file.size, file.type)
      .pipe(
        switchMap(({ upload_url, storage_key }) =>
          this.uploadService
            .uploadFileToPresignedUrl(upload_url, file)
            .pipe(
              switchMap(() =>
                this.uploadService.confirmAvatarUpload(storage_key),
              ),
            ),
        ),
      )
      .subscribe({
        next: ({ avatar_url }) => {
          this.avatarUrl = avatar_url;
          this.avatarPreview.set(avatar_url);
          this.avatarUploading.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Avatar uploaded',
            detail: 'Your avatar has been updated.',
          });
        },
        error: (error) => {
          this.avatarUploading.set(false);
          const message = error.error?.message ?? 'Failed to upload avatar';
          this.messageService.add({
            severity: 'error',
            summary: 'Upload failed',
            detail: message,
          });
        },
      });
  }

  saveProfile(): void {
    if (this.phoneNumber && !this.isPhoneValid()) {
      return;
    }

    // Save snapshot for rollback
    const snapshotName = this.name;
    const snapshotPhone = this.phoneNumber;
    const snapshotJobTitle = this.jobTitle;
    const snapshotDepartment = this.department;
    const snapshotBio = this.bio;

    const updateData: {
      name?: string;
      phone_number?: string;
      avatar_url?: string;
      job_title?: string | null;
      department?: string | null;
      bio?: string | null;
    } = {};
    if (this.name) {
      updateData.name = this.name;
    }
    if (this.phoneNumber) {
      updateData.phone_number = this.phoneNumber;
    }
    if (this.avatarUrl) {
      updateData.avatar_url = this.avatarUrl;
    }
    updateData.job_title = this.jobTitle || null;
    updateData.department = this.department || null;
    updateData.bio = this.bio || null;

    // Optimistic: show success toast immediately
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Profile updated successfully',
    });

    this.authService.updateProfile(updateData).subscribe({
      error: (error) => {
        // Rollback form values
        this.name = snapshotName;
        this.phoneNumber = snapshotPhone;
        this.jobTitle = snapshotJobTitle;
        this.department = snapshotDepartment;
        this.bio = snapshotBio;

        const message = error.error?.message ?? 'Failed to update profile';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.deleteConfirmText = '';
    this.deletePassword = '';
  }

  confirmDeleteAccount(): void {
    if (this.deleteConfirmText !== 'DELETE' || !this.deletePassword) {
      return;
    }

    this.deleteLoading.set(true);

    this.authService.deleteAccount(this.deletePassword).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Account deleted',
          detail: 'Your account has been permanently deleted.',
        });
        this.authService.signOut('manual');
      },
      error: (error) => {
        this.deleteLoading.set(false);
        const message = error.error?.message ?? 'Failed to delete account';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: message,
        });
      },
    });
  }
}
