import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { AdminService, AdminUser } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminConfirmDialogComponent } from '../shared/confirm-dialog.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatMenuModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
          <p class="text-sm text-gray-500 mt-1">
            Manage users and their roles across the platform
          </p>
        </div>

        <!-- Stats & Filters -->
        <div class="bg-white rounded-lg shadow mb-6 p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <!-- User Count Stats -->
            <div class="text-sm text-gray-600">
              <span class="font-semibold text-gray-900">{{ users().length }}</span> users
              <span class="mx-2 text-gray-300">|</span>
              <span class="text-purple-600">{{ adminCount() }} admins</span>,
              <span class="text-blue-600">{{ managerCount() }} managers</span>,
              <span class="text-gray-600">{{ memberCount() }} members</span>
            </div>

            <!-- Filters -->
            <div class="flex flex-col sm:flex-row gap-3">
              <!-- Search -->
              <mat-form-field appearance="outline" class="w-full sm:w-64">
                <mat-label>Search users</mat-label>
                <input
                  matInput
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchChange($event)"
                  placeholder="Name or email..."
                />
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <!-- Role Filter -->
              <mat-form-field appearance="outline" class="w-full sm:w-40">
                <mat-label>Role</mat-label>
                <mat-select [(ngModel)]="selectedRole" (ngModelChange)="loadUsers()">
                  <mat-option [value]="''">All Roles</mat-option>
                  <mat-option value="admin">Admin</mat-option>
                  <mat-option value="manager">Manager</mat-option>
                  <mat-option value="member">Member</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <mat-spinner diameter="40"></mat-spinner>
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 mb-6">
            <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd" />
            </svg>
            <div>
              <p class="text-sm font-medium text-red-800">{{ error() }}</p>
              <button
                (click)="loadUsers()"
                class="text-sm text-red-600 hover:text-red-800 underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && users().length === 0) {
          <div class="bg-white rounded-lg shadow p-12 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p class="mt-1 text-sm text-gray-500">
              No users match your current search criteria.
            </p>
          </div>
        }

        <!-- Users Table -->
        @if (!loading() && users().length > 0) {
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workspaces
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  @for (user of users(); track user.id) {
                    <tr class="hover:bg-gray-50">
                      <!-- User Info -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 overflow-hidden">
                            @if (user.avatar_url) {
                              <img
                                [src]="user.avatar_url"
                                [alt]="user.display_name"
                                class="w-full h-full object-cover"
                              />
                            } @else {
                              {{ getInitials(user.display_name) }}
                            }
                          </div>
                          <div>
                            <p class="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {{ user.display_name }}
                              @if (!user.email_verified) {
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Unverified
                                </span>
                              }
                            </p>
                            <p class="text-sm text-gray-500">{{ user.email }}</p>
                          </div>
                        </div>
                      </td>

                      <!-- Role -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        @if (!isSelf(user)) {
                          <mat-form-field appearance="outline" class="role-select">
                            <mat-select
                              [value]="user.role"
                              (selectionChange)="onRoleChange(user, $event.value)"
                              [disabled]="updatingUser() === user.id"
                            >
                              <mat-option value="admin">Admin</mat-option>
                              <mat-option value="manager">Manager</mat-option>
                              <mat-option value="member">Member</mat-option>
                            </mat-select>
                          </mat-form-field>
                        } @else {
                          <span [class]="getRoleBadgeClass(user.role)">
                            {{ formatRole(user.role) }}
                          </span>
                        }
                      </td>

                      <!-- Workspaces -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {{ user.workspace_count }} workspace{{ user.workspace_count !== 1 ? 's' : '' }}
                        </span>
                      </td>

                      <!-- Joined -->
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          [matTooltip]="formatAbsoluteDate(user.created_at)"
                          class="cursor-help"
                        >
                          {{ formatDate(user.created_at) }}
                        </span>
                      </td>

                      <!-- Last Active -->
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        @if (user.last_active_at) {
                          <span
                            [matTooltip]="formatAbsoluteDate(user.last_active_at)"
                            class="cursor-help"
                          >
                            {{ formatRelativeDate(user.last_active_at) }}
                          </span>
                        } @else {
                          <span class="text-gray-400">Never</span>
                        }
                      </td>

                      <!-- Actions -->
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        @if (!isSelf(user)) {
                          <button
                            mat-icon-button
                            [matMenuTriggerFor]="userMenu"
                            [disabled]="updatingUser() === user.id"
                          >
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #userMenu="matMenu">
                            <button mat-menu-item (click)="onChangeRole(user, 'admin')" [disabled]="user.role === 'admin'">
                              <mat-icon class="text-purple-600">admin_panel_settings</mat-icon>
                              <span>Make Admin</span>
                            </button>
                            <button mat-menu-item (click)="onChangeRole(user, 'manager')" [disabled]="user.role === 'manager'">
                              <mat-icon class="text-blue-600">supervisor_account</mat-icon>
                              <span>Make Manager</span>
                            </button>
                            <button mat-menu-item (click)="onChangeRole(user, 'member')" [disabled]="user.role === 'member'">
                              <mat-icon class="text-gray-600">person</mat-icon>
                              <span>Make Member</span>
                            </button>
                            <mat-divider></mat-divider>
                            <button mat-menu-item (click)="onRemoveUser(user)" class="text-red-600">
                              <mat-icon class="text-red-600">delete</mat-icon>
                              <span class="text-red-600">Remove User</span>
                            </button>
                          </mat-menu>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    mat-form-field {
      font-size: 14px;
    }

    .mat-mdc-form-field {
      --mdc-outlined-text-field-container-shape: 8px;
    }

    .role-select {
      width: 120px;
    }

    .role-select ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .role-select ::ng-deep .mat-mdc-text-field-wrapper {
      padding: 0 8px;
    }

    ::ng-deep .mat-divider {
      margin: 4px 0 !important;
    }
  `],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  // State
  loading = signal(true);
  error = signal<string | null>(null);
  users = signal<AdminUser[]>([]);
  updatingUser = signal<string | null>(null);

  // Filters
  searchQuery = '';
  selectedRole = '';

  // Computed stats
  adminCount = computed(() => this.users().filter((u) => u.role === 'admin').length);
  managerCount = computed(() => this.users().filter((u) => u.role === 'manager').length);
  memberCount = computed(() => this.users().filter((u) => u.role === 'member').length);

  ngOnInit(): void {
    this.loadUsers();

    // Debounced search
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadUsers();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.adminService
      .getUsers({
        search: this.searchQuery || undefined,
        role: this.selectedRole || undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load users:', err);
          this.error.set('Failed to load users. Please try again.');
          this.loading.set(false);
        },
      });
  }

  onSearchChange(query: string): void {
    this.searchSubject$.next(query);
  }

  isSelf(user: AdminUser): boolean {
    const currentUser = this.authService.currentUser();
    return currentUser?.id === user.id;
  }

  onRoleChange(user: AdminUser, newRole: 'admin' | 'manager' | 'member'): void {
    if (user.role === newRole) return;
    this.updateUserRole(user, newRole);
  }

  onChangeRole(user: AdminUser, newRole: 'admin' | 'manager' | 'member'): void {
    if (user.role === newRole) return;
    this.updateUserRole(user, newRole);
  }

  private updateUserRole(user: AdminUser, newRole: 'admin' | 'manager' | 'member'): void {
    this.updatingUser.set(user.id);

    this.adminService
      .updateUserRole(user.id, newRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users.update((current) =>
            current.map((u) =>
              u.id === user.id ? { ...u, role: newRole } : u
            )
          );
          this.updatingUser.set(null);
        },
        error: (err) => {
          console.error('Failed to update user role:', err);
          this.updatingUser.set(null);
        },
      });
  }

  onRemoveUser(user: AdminUser): void {
    const dialogRef = this.dialog.open(AdminConfirmDialogComponent, {
      data: {
        title: 'Remove User',
        message: `Are you sure you want to remove "${user.display_name}" (${user.email})? This action cannot be undone and the user will lose access to all workspaces.`,
        confirmText: 'Remove User',
        cancelText: 'Cancel',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteUser(user);
      }
    });
  }

  private deleteUser(user: AdminUser): void {
    this.updatingUser.set(user.id);

    this.adminService
      .deleteUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users.update((current) => current.filter((u) => u.id !== user.id));
          this.updatingUser.set(null);
        },
        error: (err) => {
          console.error('Failed to delete user:', err);
          this.updatingUser.set(null);
        },
      });
  }

  // Formatting helpers
  getInitials(name: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  getRoleBadgeClass(role: string): string {
    const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const roleColors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      member: 'bg-gray-100 text-gray-800',
    };

    return `${baseClasses} ${roleColors[role] || 'bg-gray-100 text-gray-800'}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatAbsoluteDate(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}
