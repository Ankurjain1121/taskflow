import { Component, OnInit, signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  ProfileService,
  UserProfile,
} from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    InputTextModule,
    ButtonModule,
    ProgressSpinner,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen bg-[var(--background)] p-4 md:p-8">
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
          <h1
            class="text-2xl md:text-3xl font-bold text-[var(--card-foreground)] mb-2"
          >
            Profile Settings
          </h1>
          <p class="text-[var(--muted-foreground)]">
            Manage your account information and preferences
          </p>
        </div>

        <!-- Loading state -->
        @if (isLoading()) {
          <div class="flex items-center justify-center py-12">
            <p-progressSpinner
              [style]="{ width: '40px', height: '40px' }"
              strokeWidth="4"
            />
          </div>
        }

        <!-- Profile form -->
        @if (!isLoading()) {
          <div
            class="bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-sm mb-6"
          >
            <div class="px-6 pt-6 pb-2">
              <h3 class="text-lg font-semibold text-[var(--card-foreground)]">
                Personal Information
              </h3>
            </div>

            <div class="px-6 pb-6 pt-4">
              <form [formGroup]="profileForm" (ngSubmit)="onSubmit()">
                <!-- Avatar preview -->
                <div class="flex items-center gap-4 mb-6">
                  <div
                    class="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center overflow-hidden"
                  >
                    @if (avatarPreview()) {
                      <img
                        [src]="avatarPreview()"
                        alt="Avatar"
                        class="w-full h-full object-cover"
                        (error)="onAvatarError()"
                      />
                    } @else {
                      <i
                        class="pi pi-user text-[var(--muted-foreground)] text-4xl"
                      ></i>
                    }
                  </div>
                  <div>
                    <p
                      class="text-sm font-medium text-[var(--card-foreground)]"
                    >
                      Profile Picture
                    </p>
                    <p class="text-xs text-[var(--muted-foreground)]">
                      Enter a URL below to update
                    </p>
                  </div>
                </div>

                <!-- Display Name -->
                <div class="flex flex-col gap-2 mb-5">
                  <label
                    for="displayName"
                    class="text-sm font-medium text-[var(--foreground)]"
                    >Display Name</label
                  >
                  <input
                    pInputText
                    id="displayName"
                    formControlName="displayName"
                    placeholder="Enter your display name"
                    class="w-full"
                  />
                  @if (
                    profileForm.get('displayName')?.hasError('required') &&
                    profileForm.get('displayName')?.touched
                  ) {
                    <small class="text-red-500">Display name is required</small>
                  }
                  @if (
                    profileForm.get('displayName')?.hasError('minlength') &&
                    profileForm.get('displayName')?.touched
                  ) {
                    <small class="text-red-500"
                      >Display name must be at least 2 characters</small
                    >
                  }
                </div>

                <!-- Email (read-only) -->
                <div class="flex flex-col gap-2 mb-5">
                  <label
                    for="email"
                    class="text-sm font-medium text-[var(--foreground)]"
                    >Email</label
                  >
                  <div class="p-inputgroup">
                    <input
                      pInputText
                      id="email"
                      formControlName="email"
                      readonly
                      class="w-full"
                    />
                    <span class="p-inputgroup-addon"
                      ><i class="pi pi-lock text-[var(--muted-foreground)]"></i
                    ></span>
                  </div>
                  <small class="text-[var(--muted-foreground)]"
                    >Email cannot be changed</small
                  >
                </div>

                <!-- Phone Number -->
                <div class="flex flex-col gap-2 mb-5">
                  <label
                    for="phoneNumber"
                    class="text-sm font-medium text-[var(--foreground)]"
                    >Phone Number</label
                  >
                  <input
                    pInputText
                    id="phoneNumber"
                    formControlName="phoneNumber"
                    placeholder="+1234567890"
                    class="w-full"
                  />
                  <small class="text-[var(--muted-foreground)]">
                    Enter in E.164 format (e.g., +1234567890) for WhatsApp
                    notifications
                  </small>
                  @if (
                    profileForm.get('phoneNumber')?.hasError('pattern') &&
                    profileForm.get('phoneNumber')?.touched
                  ) {
                    <small class="text-red-500">
                      Please enter a valid E.164 phone number (e.g.,
                      +1234567890)
                    </small>
                  }
                </div>

                <!-- Avatar URL -->
                <div class="flex flex-col gap-2 mb-5">
                  <label
                    for="avatarUrl"
                    class="text-sm font-medium text-[var(--foreground)]"
                    >Avatar URL</label
                  >
                  <input
                    pInputText
                    id="avatarUrl"
                    formControlName="avatarUrl"
                    placeholder="https://example.com/avatar.jpg"
                    (input)="onAvatarUrlChange()"
                    class="w-full"
                  />
                  <small class="text-[var(--muted-foreground)]"
                    >Enter a URL to your profile picture</small
                  >
                  @if (
                    profileForm.get('avatarUrl')?.hasError('pattern') &&
                    profileForm.get('avatarUrl')?.touched
                  ) {
                    <small class="text-red-500">
                      Please enter a valid URL
                    </small>
                  }
                </div>

                <!-- Submit button -->
                <div class="flex justify-end">
                  <p-button
                    type="submit"
                    [label]="isSaving() ? 'Saving...' : 'Save Changes'"
                    [disabled]="
                      !profileForm.valid || !profileForm.dirty || isSaving()
                    "
                    [loading]="isSaving()"
                  />
                </div>
              </form>
            </div>
          </div>
        }

        <!-- Notification preferences link -->
        @if (!isLoading()) {
          <div
            class="bg-[var(--card)] rounded-lg border border-[var(--border)] shadow-sm"
          >
            <div class="py-4 px-6">
              <a
                routerLink="/settings/notifications"
                class="flex items-center justify-between group hover:bg-[var(--muted)] -mx-4 px-4 py-3 rounded transition-colors"
              >
                <div class="flex items-center gap-3">
                  <i class="pi pi-bell text-[var(--muted-foreground)]"></i>
                  <div>
                    <p class="font-medium text-[var(--card-foreground)]">
                      Notification Preferences
                    </p>
                    <p class="text-sm text-[var(--muted-foreground)]">
                      Configure how and when you receive notifications
                    </p>
                  </div>
                </div>
                <i
                  class="pi pi-chevron-right text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors"
                ></i>
              </a>
            </div>
          </div>
        }

        <!-- Account info -->
        @if (!isLoading() && profile() && profile()!.created_at) {
          <div class="mt-6 text-sm text-[var(--muted-foreground)]">
            <p>
              Account created: {{ profile()!.created_at | date: 'longDate' }}
            </p>
            @if (profile()!.updated_at) {
              <p>
                Last updated: {{ profile()!.updated_at | date: 'longDate' }}
              </p>
            }
          </div>
        }
      </div>
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
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;

  isLoading = signal(true);
  isSaving = signal(false);
  profile = signal<UserProfile | null>(null);
  avatarPreview = signal<string | null>(null);

  // E.164 phone number pattern: + followed by 1-15 digits
  private readonly e164Pattern = /^\+[1-9]\d{1,14}$/;
  // URL pattern
  private readonly urlPattern = /^https?:\/\/.+/;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private authService: AuthService,
    private messageService: MessageService,
  ) {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      phoneNumber: ['', [Validators.pattern(this.e164Pattern)]],
      avatarUrl: ['', [Validators.pattern(this.urlPattern)]],
    });
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  private loadProfile(): void {
    this.isLoading.set(true);

    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.profileForm.patchValue({
          displayName: profile.name,
          email: profile.email,
          phoneNumber: profile.phone_number || '',
          avatarUrl: profile.avatar_url || '',
        });
        this.avatarPreview.set(profile.avatar_url);
        this.profileForm.markAsPristine();
        this.isLoading.set(false);
      },
      error: (error) => {
        // Try to use current user from auth service as fallback
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          this.profile.set({
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
            phone_number: null,
            avatar_url: currentUser.avatar_url,
            role: currentUser.role,
            tenant_id: currentUser.tenant_id,
            onboarding_completed: currentUser.onboarding_completed,
          });
          this.profileForm.patchValue({
            displayName: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatar_url || '',
          });
          this.avatarPreview.set(currentUser.avatar_url);
        }
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load profile',
        });
        this.isLoading.set(false);
      },
    });
  }

  onAvatarUrlChange(): void {
    const url = this.profileForm.get('avatarUrl')?.value;
    if (url && this.urlPattern.test(url)) {
      this.avatarPreview.set(url);
    } else {
      this.avatarPreview.set(null);
    }
  }

  onAvatarError(): void {
    this.avatarPreview.set(null);
  }

  onSubmit(): void {
    if (!this.profileForm.valid || !this.profileForm.dirty) {
      return;
    }

    this.isSaving.set(true);

    const formValue = this.profileForm.value;
    const updateData = {
      name: formValue.displayName,
      phoneNumber: formValue.phoneNumber || null,
      avatarUrl: formValue.avatarUrl || null,
    };

    this.profileService.updateProfile(updateData).subscribe({
      next: (updatedProfile) => {
        this.profile.set(updatedProfile);
        this.profileForm.markAsPristine();
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Profile updated successfully',
        });
        this.isSaving.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to update profile',
        });
        this.isSaving.set(false);
      },
    });
  }
}
