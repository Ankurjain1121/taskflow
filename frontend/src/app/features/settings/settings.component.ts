import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, Theme } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    ButtonModule,
    PasswordModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="p-6 max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold mb-6" style="color: var(--foreground)">Settings</h1>

      <div class="space-y-6">
        <!-- Appearance Section -->
        <div class="rounded-lg border shadow-sm p-6" style="background: var(--card); border-color: var(--border)">
          <h2 class="text-xl font-semibold mb-4" style="color: var(--foreground)">Appearance</h2>
          <p class="text-sm mb-4" style="color: var(--muted-foreground)">Choose your preferred theme</p>
          <div class="flex gap-3">
            @for (option of themeOptions; track option.value) {
              <button
                (click)="setTheme(option.value)"
                class="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer flex-1"
                [style.border-color]="currentTheme() === option.value ? 'var(--primary)' : 'var(--border)'"
                [style.background]="currentTheme() === option.value ? 'var(--muted)' : 'transparent'"
              >
                <i [class]="option.icon + ' text-xl'" [style.color]="currentTheme() === option.value ? 'var(--primary)' : 'var(--muted-foreground)'"></i>
                <span class="text-sm font-medium" [style.color]="currentTheme() === option.value ? 'var(--primary)' : 'var(--foreground)'">{{ option.label }}</span>
              </button>
            }
          </div>
        </div>

        <!-- Profile Section -->
        <div class="rounded-lg border shadow-sm p-6" style="background: var(--card); border-color: var(--border)">
          <h2 class="text-xl font-semibold mb-4" style="color: var(--foreground)">Profile</h2>
          <form (ngSubmit)="updateProfile()" #profileForm="ngForm" class="space-y-4">
            <div class="flex flex-col gap-2">
              <label for="name" class="text-sm font-medium" style="color: var(--foreground)">Name</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-user"></i></span>
                <input pInputText id="name" type="text" name="name" [(ngModel)]="profileData.name" required class="w-full" />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label for="email" class="text-sm font-medium" style="color: var(--foreground)">Email</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-envelope"></i></span>
                <input pInputText id="email" type="email" name="email" [(ngModel)]="profileData.email" disabled class="w-full" />
              </div>
              <small style="color: var(--muted-foreground)">Email cannot be changed</small>
            </div>

            <div class="flex flex-col gap-2">
              <label for="avatarUrl" class="text-sm font-medium" style="color: var(--foreground)">Avatar URL</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-image"></i></span>
                <input pInputText id="avatarUrl" type="url" name="avatarUrl" [(ngModel)]="profileData.avatar_url" class="w-full" />
              </div>
            </div>

            <div class="flex justify-end">
              <p-button type="submit" [label]="profileLoading() ? 'Saving...' : 'Save Profile'" [disabled]="profileLoading() || profileForm.invalid" [loading]="profileLoading()" />
            </div>
          </form>
        </div>

        <!-- Password Section -->
        <div class="rounded-lg border shadow-sm p-6" style="background: var(--card); border-color: var(--border)">
          <h2 class="text-xl font-semibold mb-4" style="color: var(--foreground)">Change Password</h2>
          <form (ngSubmit)="changePassword()" #passwordForm="ngForm" class="space-y-4">
            <div class="flex flex-col gap-2">
              <label for="currentPassword" class="text-sm font-medium" style="color: var(--foreground)">Current Password</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
                <input pInputText id="currentPassword" [type]="hideCurrentPassword() ? 'password' : 'text'" name="currentPassword" [(ngModel)]="passwordData.current_password" required class="w-full" />
                <button type="button" class="p-inputgroup-addon cursor-pointer" (click)="hideCurrentPassword.set(!hideCurrentPassword())">
                  <i [class]="hideCurrentPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label for="newPassword" class="text-sm font-medium" style="color: var(--foreground)">New Password</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
                <input pInputText id="newPassword" [type]="hideNewPassword() ? 'password' : 'text'" name="newPassword" [(ngModel)]="passwordData.new_password" required minlength="8" #newPasswordInput="ngModel" class="w-full" />
                <button type="button" class="p-inputgroup-addon cursor-pointer" (click)="hideNewPassword.set(!hideNewPassword())">
                  <i [class]="hideNewPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
              @if (newPasswordInput.invalid && (newPasswordInput.dirty || newPasswordInput.touched)) {
                @if (newPasswordInput.errors?.['minlength']) {
                  <small class="text-red-500">Password must be at least 8 characters</small>
                }
              }
            </div>

            <div class="flex flex-col gap-2">
              <label for="confirmPassword" class="text-sm font-medium" style="color: var(--foreground)">Confirm New Password</label>
              <div class="p-inputgroup">
                <span class="p-inputgroup-addon"><i class="pi pi-lock"></i></span>
                <input pInputText id="confirmPassword" [type]="hideConfirmPassword() ? 'password' : 'text'" name="confirmPassword" [(ngModel)]="passwordData.confirm_password" required #confirmPasswordInput="ngModel" class="w-full" />
                <button type="button" class="p-inputgroup-addon cursor-pointer" (click)="hideConfirmPassword.set(!hideConfirmPassword())">
                  <i [class]="hideConfirmPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
              </div>
              @if (confirmPasswordInput.touched && passwordData.new_password !== passwordData.confirm_password) {
                <small class="text-red-500">Passwords do not match</small>
              }
            </div>

            <div class="flex justify-end">
              <p-button type="submit" [label]="passwordLoading() ? 'Changing...' : 'Change Password'" [disabled]="passwordLoading() || passwordForm.invalid || passwordData.new_password !== passwordData.confirm_password" [loading]="passwordLoading()" />
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private messageService = inject(MessageService);
  private themeService = inject(ThemeService);

  currentTheme = this.themeService.theme;

  themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'system', label: 'System', icon: 'pi pi-desktop' },
  ];

  profileData = {
    name: '',
    email: '',
    avatar_url: '',
  };

  passwordData = {
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  profileLoading = signal(false);
  passwordLoading = signal(false);
  hideCurrentPassword = signal(true);
  hideNewPassword = signal(true);
  hideConfirmPassword = signal(true);

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.profileData.name = user.name;
      this.profileData.email = user.email;
      this.profileData.avatar_url = (user as any).avatar_url || '';
    }
  }

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  updateProfile(): void {
    this.profileLoading.set(true);

    const updateData: { name?: string; avatar_url?: string } = {};
    if (this.profileData.name) {
      updateData.name = this.profileData.name;
    }
    if (this.profileData.avatar_url) {
      updateData.avatar_url = this.profileData.avatar_url;
    }

    this.authService.updateProfile(updateData).subscribe({
      next: () => {
        this.profileLoading.set(false);
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Profile updated successfully' });
      },
      error: (error) => {
        this.profileLoading.set(false);
        const message = error.error?.message || 'Failed to update profile';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
      },
    });
  }

  changePassword(): void {
    if (this.passwordData.new_password !== this.passwordData.confirm_password) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Passwords do not match' });
      return;
    }

    this.passwordLoading.set(true);

    this.authService
      .changePassword({
        current_password: this.passwordData.current_password,
        new_password: this.passwordData.new_password,
      })
      .subscribe({
        next: () => {
          this.passwordLoading.set(false);
          this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Password changed successfully' });
          this.passwordData = { current_password: '', new_password: '', confirm_password: '' };
        },
        error: (error) => {
          this.passwordLoading.set(false);
          const message = error.error?.message || 'Failed to change password';
          this.messageService.add({ severity: 'error', summary: 'Error', detail: message });
        },
      });
  }
}
