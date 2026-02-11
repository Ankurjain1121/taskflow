import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ProfileService, UserProfile } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  template: `
    <div class="min-h-screen bg-gray-100 p-4 md:p-8">
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
          <p class="text-gray-600">
            Manage your account information and preferences
          </p>
        </div>

        <!-- Loading state -->
        @if (isLoading()) {
          <div class="flex items-center justify-center py-12">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        }

        <!-- Profile form -->
        @if (!isLoading()) {
        <mat-card class="mb-6">
          <mat-card-header>
            <mat-card-title>Personal Information</mat-card-title>
          </mat-card-header>

          <mat-card-content class="pt-4">
            <form [formGroup]="profileForm" (ngSubmit)="onSubmit()">
              <!-- Avatar preview -->
              <div class="flex items-center gap-4 mb-6">
                <div
                  class="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden"
                >
                  @if (avatarPreview()) {
                    <img
                      [src]="avatarPreview()"
                      alt="Avatar"
                      class="w-full h-full object-cover"
                      (error)="onAvatarError()"
                    />
                  } @else {
                    <mat-icon class="text-gray-400 !text-4xl">
                      person
                    </mat-icon>
                  }
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">Profile Picture</p>
                  <p class="text-xs text-gray-500">Enter a URL below to update</p>
                </div>
              </div>

              <!-- Display Name -->
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Display Name</mat-label>
                <input
                  matInput
                  formControlName="displayName"
                  placeholder="Enter your display name"
                />
                @if (profileForm.get('displayName')?.hasError('required')) {
                  <mat-error>
                    Display name is required
                  </mat-error>
                }
                @if (profileForm.get('displayName')?.hasError('minlength')) {
                  <mat-error>
                    Display name must be at least 2 characters
                  </mat-error>
                }
              </mat-form-field>

              <!-- Email (read-only) -->
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  formControlName="email"
                  readonly
                />
                <mat-icon matSuffix class="text-gray-400">lock</mat-icon>
                <mat-hint>Email cannot be changed</mat-hint>
              </mat-form-field>

              <!-- Phone Number -->
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Phone Number</mat-label>
                <input
                  matInput
                  formControlName="phoneNumber"
                  placeholder="+1234567890"
                />
                <mat-hint>
                  Enter in E.164 format (e.g., +1234567890) for WhatsApp notifications
                </mat-hint>
                @if (profileForm.get('phoneNumber')?.hasError('pattern')) {
                  <mat-error>
                    Please enter a valid E.164 phone number (e.g., +1234567890)
                  </mat-error>
                }
              </mat-form-field>

              <!-- Avatar URL -->
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Avatar URL</mat-label>
                <input
                  matInput
                  formControlName="avatarUrl"
                  placeholder="https://example.com/avatar.jpg"
                  (input)="onAvatarUrlChange()"
                />
                <mat-hint>Enter a URL to your profile picture</mat-hint>
                @if (profileForm.get('avatarUrl')?.hasError('pattern')) {
                  <mat-error>
                    Please enter a valid URL
                  </mat-error>
                }
              </mat-form-field>

              <!-- Submit button -->
              <div class="flex justify-end">
                <button
                  mat-raised-button
                  color="primary"
                  type="submit"
                  [disabled]="!profileForm.valid || !profileForm.dirty || isSaving()"
                >
                  @if (isSaving()) {
                    <mat-spinner
                      diameter="20"
                      class="inline-block mr-2"
                    ></mat-spinner>
                  }
                  {{ isSaving() ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
        }

        <!-- Notification preferences link -->
        @if (!isLoading()) {
        <mat-card>
          <mat-card-content class="!py-4">
            <a
              routerLink="/settings/notifications"
              class="flex items-center justify-between group hover:bg-gray-50 -mx-4 px-4 py-3 rounded transition-colors"
            >
              <div class="flex items-center gap-3">
                <mat-icon class="text-gray-500">notifications</mat-icon>
                <div>
                  <p class="font-medium text-gray-900">Notification Preferences</p>
                  <p class="text-sm text-gray-500">
                    Configure how and when you receive notifications
                  </p>
                </div>
              </div>
              <mat-icon class="text-gray-400 group-hover:text-gray-600 transition-colors">
                chevron_right
              </mat-icon>
            </a>
          </mat-card-content>
        </mat-card>
        }

        <!-- Account info -->
        @if (!isLoading() && profile()) {
        <div class="mt-6 text-sm text-gray-500">
          <p>
            Account created: {{ profile()!.created_at | date:'longDate' }}
          </p>
          <p>
            Last updated: {{ profile()!.updated_at | date:'longDate' }}
          </p>
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        margin-bottom: 0.5rem;
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
    private snackBar: MatSnackBar
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
          displayName: profile.display_name,
          email: profile.email,
          phoneNumber: profile.phone_number || '',
          avatarUrl: profile.avatar_url || '',
        });
        this.avatarPreview.set(profile.avatar_url);
        this.profileForm.markAsPristine();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load profile:', error);
        // Try to use current user from auth service as fallback
        const currentUser = this.authService.currentUser();
        if (currentUser) {
          this.profile.set({
            id: currentUser.id,
            email: currentUser.email,
            display_name: currentUser.display_name,
            phone_number: null,
            avatar_url: currentUser.avatar_url,
            email_verified: currentUser.email_verified,
            created_at: currentUser.created_at,
            updated_at: currentUser.updated_at,
          });
          this.profileForm.patchValue({
            displayName: currentUser.display_name,
            email: currentUser.email,
            avatarUrl: currentUser.avatar_url || '',
          });
          this.avatarPreview.set(currentUser.avatar_url);
        }
        this.snackBar.open('Failed to load profile', 'Dismiss', {
          duration: 3000,
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
        this.snackBar.open('Profile updated successfully', 'Dismiss', {
          duration: 3000,
        });
        this.isSaving.set(false);
      },
      error: (error) => {
        console.error('Failed to update profile:', error);
        this.snackBar.open('Failed to update profile', 'Dismiss', {
          duration: 3000,
        });
        this.isSaving.set(false);
      },
    });
  }
}
