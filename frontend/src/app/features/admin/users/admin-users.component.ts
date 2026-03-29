import {
  Component,
  signal,
  inject,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  computed,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Dialog } from 'primeng/dialog';
import { Menu } from 'primeng/menu';
import { DividerModule } from 'primeng/divider';
import { AdminService, AdminUser } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    Select,
    ButtonModule,
    Tooltip,
    ProgressSpinner,
    Dialog,
    Menu,
    DividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[var(--secondary)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-[var(--card-foreground)]">
            User Management
          </h1>
          <p class="text-sm text-[var(--muted-foreground)] mt-1">
            Manage users and their roles across the platform
          </p>
        </div>

        <!-- Stats & Filters -->
        <div class="bg-[var(--card)] rounded-lg shadow mb-6 p-4">
          <div
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <!-- User Count Stats -->
            <div class="text-sm text-[var(--muted-foreground)]">
              <span class="font-semibold text-[var(--card-foreground)]">{{
                users().length
              }}</span>
              users
              <span class="mx-2 text-[var(--border)]">|</span>
              <span class="text-purple-600">{{ adminCount() }} admins</span>,
              <span class="text-blue-600">{{ managerCount() }} managers</span>,
              <span class="text-[var(--muted-foreground)]"
                >{{ memberCount() }} members</span
              >
            </div>

            <!-- Filters -->
            <div class="flex flex-col sm:flex-row gap-3">
              <!-- Search -->
              <div class="flex flex-col gap-1">
                <div class="p-inputgroup w-full sm:w-64">
                  <span class="p-inputgroup-addon"
                    ><i class="pi pi-search"></i
                  ></span>
                  <input
                    pInputText
                    [(ngModel)]="searchQuery"
                    (ngModelChange)="onSearchChange($event)"
                    placeholder="Name or email..."
                    class="w-full"
                  />
                </div>
              </div>

              <!-- Role Filter -->
              <p-select
                [options]="roleOptions"
                [(ngModel)]="selectedRole"
                (ngModelChange)="loadUsers()"
                optionLabel="label"
                optionValue="value"
                placeholder="All Roles"
                [showClear]="true"
                styleClass="w-full sm:w-40"
              />
            </div>
          </div>
        </div>

        <!-- Loading State -->
        @if (loading()) {
          <div class="flex items-center justify-center py-12">
            <p-progressSpinner
              [style]="{ width: '40px', height: '40px' }"
              strokeWidth="4"
            />
          </div>
        }

        <!-- Error State -->
        @if (error()) {
          <div
            class="bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_30%,transparent)] rounded-lg p-4 flex items-center gap-3 mb-6"
          >
            <svg
              class="w-5 h-5 text-[var(--destructive)] flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <p class="text-sm font-medium text-[var(--destructive)]">{{ error() }}</p>
              <button
                (click)="loadUsers()"
                class="text-sm text-[var(--destructive)] hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        }

        <!-- Empty State -->
        @if (!loading() && !error() && users().length === 0) {
          <div class="bg-[var(--card)] rounded-lg shadow p-12 text-center">
            <svg
              class="mx-auto h-12 w-12 text-[var(--muted-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 class="mt-2 text-sm font-medium text-[var(--card-foreground)]">
              No users found
            </h3>
            <p class="mt-1 text-sm text-[var(--muted-foreground)]">
              No users match your current search criteria.
            </p>
          </div>
        }

        <!-- Users Table -->
        @if (!loading() && users().length > 0) {
          <div class="bg-[var(--card)] rounded-lg shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-[var(--border)]">
                <thead class="bg-[var(--secondary)]">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      User
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Role
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Workspaces
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Joined
                    </th>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Last Active
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-[var(--card)] divide-y divide-[var(--border)]">
                  @for (user of users(); track user.id) {
                    <tr class="hover:bg-[var(--secondary)]">
                      <!-- User Info -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center gap-3">
                          <div
                            class="w-10 h-10 rounded-full bg-[var(--secondary)] flex items-center justify-center text-sm font-medium text-[var(--muted-foreground)] overflow-hidden"
                          >
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
                            <p
                              class="text-sm font-medium text-[var(--card-foreground)] flex items-center gap-2"
                            >
                              {{ user.display_name }}
                              @if (!user.email_verified) {
                                <span
                                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                                >
                                  Unverified
                                </span>
                              }
                            </p>
                            <p class="text-sm text-[var(--muted-foreground)]">
                              {{ user.email }}
                            </p>
                          </div>
                        </div>
                      </td>

                      <!-- Role -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        @if (!isSelf(user)) {
                          <p-select
                            [options]="roleChangeOptions"
                            [ngModel]="user.role"
                            (ngModelChange)="onRoleChange(user, $event)"
                            optionLabel="label"
                            optionValue="value"
                            [disabled]="updatingUser() === user.id"
                            styleClass="w-28"
                          />
                        } @else {
                          <span [class]="getRoleBadgeClass(user.role)">
                            {{ formatRole(user.role) }}
                          </span>
                        }
                      </td>

                      <!-- Workspaces -->
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--secondary)] text-[var(--card-foreground)]"
                        >
                          {{ user.workspace_count }} workspace{{
                            user.workspace_count !== 1 ? 's' : ''
                          }}
                        </span>
                      </td>

                      <!-- Joined -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                      >
                        <span
                          [pTooltip]="formatAbsoluteDate(user.created_at)"
                          class="cursor-help"
                        >
                          {{ formatDate(user.created_at) }}
                        </span>
                      </td>

                      <!-- Last Active -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-[var(--muted-foreground)]"
                      >
                        @if (user.last_active_at) {
                          <span
                            [pTooltip]="formatAbsoluteDate(user.last_active_at)"
                            class="cursor-help"
                          >
                            {{ formatRelativeDate(user.last_active_at) }}
                          </span>
                        } @else {
                          <span class="text-[var(--muted-foreground)]">Never</span>
                        }
                      </td>

                      <!-- Actions -->
                      <td
                        class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                      >
                        @if (!isSelf(user)) {
                          <p-button
                            icon="pi pi-ellipsis-v"
                            [rounded]="true"
                            [text]="true"
                            severity="secondary"
                            (onClick)="openUserMenu($event, user)"
                            [disabled]="updatingUser() === user.id"
                          />
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

    <!-- Shared User Actions Menu -->
    <p-menu #sharedUserMenu [model]="activeMenuItems" [popup]="true" />

    <!-- Confirm Remove Dialog -->
    <p-dialog
      [(visible)]="showRemoveDialog"
      [modal]="true"
      [style]="{ width: '400px' }"
      header="Remove User"
    >
      <div class="flex items-start gap-3">
        <svg
          class="w-6 h-6 text-[var(--destructive)] flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="text-[var(--muted-foreground)]">
          Are you sure you want to remove "{{ userToRemove()?.display_name }}"
          ({{ userToRemove()?.email }})? This action cannot be undone and the
          user will lose access to all workspaces.
        </p>
      </div>
      <ng-template pTemplate="footer">
        <p-button
          label="Cancel"
          [text]="true"
          (onClick)="showRemoveDialog = false"
        />
        <p-button
          label="Remove User"
          severity="danger"
          (onClick)="confirmRemoveUser()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  // State
  loading = signal(true);
  error = signal<string | null>(null);
  users = signal<AdminUser[]>([]);
  updatingUser = signal<string | null>(null);

  // Dialog
  showRemoveDialog = false;
  userToRemove = signal<AdminUser | null>(null);

  // Filters
  searchQuery = '';
  selectedRole: string | null = null;

  roleOptions = [
    { label: 'Super Admin', value: 'super_admin' },
    { label: 'Admin', value: 'admin' },
    { label: 'Manager', value: 'manager' },
    { label: 'Member', value: 'member' },
  ];

  roleChangeOptions = [
    { label: 'Super Admin', value: 'super_admin' },
    { label: 'Admin', value: 'admin' },
    { label: 'Manager', value: 'manager' },
    { label: 'Member', value: 'member' },
  ];

  // Computed stats
  adminCount = computed(
    () => this.users().filter((u) => u.role === 'admin' || u.role === 'super_admin').length,
  );
  managerCount = computed(
    () => this.users().filter((u) => u.role === 'manager').length,
  );
  memberCount = computed(
    () => this.users().filter((u) => u.role === 'member').length,
  );

  // Shared popup menu
  @ViewChild('sharedUserMenu') sharedUserMenu!: Menu;
  activeMenuItems: MenuItem[] = [];

  ngOnInit(): void {
    this.loadUsers();

    // Debounced search
    this.searchSubject$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
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
        error: () => {
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

  onRoleChange(user: AdminUser, newRole: string): void {
    if (user.role === newRole) return;
    this.updateUserRole(user, newRole as 'super_admin' | 'admin' | 'manager' | 'member');
  }

  getUserMenuItems(user: AdminUser): MenuItem[] {
    return [
      {
        label: 'Make Super Admin',
        icon: 'pi pi-star',
        disabled: user.role === 'super_admin',
        command: () => this.onChangeRole(user, 'super_admin'),
      },
      {
        label: 'Make Admin',
        icon: 'pi pi-shield',
        disabled: user.role === 'admin',
        command: () => this.onChangeRole(user, 'admin'),
      },
      {
        label: 'Make Manager',
        icon: 'pi pi-users',
        disabled: user.role === 'manager',
        command: () => this.onChangeRole(user, 'manager'),
      },
      {
        label: 'Make Member',
        icon: 'pi pi-user',
        disabled: user.role === 'member',
        command: () => this.onChangeRole(user, 'member'),
      },
      { separator: true },
      {
        label: 'Remove User',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.onRemoveUser(user),
      },
    ];
  }

  openUserMenu(event: Event, user: AdminUser): void {
    this.activeMenuItems = this.getUserMenuItems(user);
    this.sharedUserMenu.toggle(event);
  }

  onChangeRole(user: AdminUser, newRole: 'super_admin' | 'admin' | 'manager' | 'member'): void {
    if (user.role === newRole) return;
    this.updateUserRole(user, newRole);
  }

  private updateUserRole(
    user: AdminUser,
    newRole: 'super_admin' | 'admin' | 'manager' | 'member',
  ): void {
    this.updatingUser.set(user.id);

    this.adminService
      .updateUserRole(user.id, newRole)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users.update((current) =>
            current.map((u) =>
              u.id === user.id ? { ...u, role: newRole } : u,
            ),
          );
          this.updatingUser.set(null);
        },
        error: () => {
          this.updatingUser.set(null);
        },
      });
  }

  onRemoveUser(user: AdminUser): void {
    this.userToRemove.set(user);
    this.showRemoveDialog = true;
  }

  confirmRemoveUser(): void {
    const user = this.userToRemove();
    if (!user) return;
    this.showRemoveDialog = false;
    this.deleteUser(user);
  }

  private deleteUser(user: AdminUser): void {
    this.updatingUser.set(user.id);

    this.adminService
      .deleteUser(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.users.update((current) =>
            current.filter((u) => u.id !== user.id),
          );
          this.updatingUser.set(null);
        },
        error: () => {
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
    const baseClasses =
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

    const roleColors: Record<string, string> = {
      SuperAdmin: 'bg-amber-100 text-amber-800',
      Admin: 'bg-purple-100 text-purple-800',
      Manager: 'bg-blue-100 text-blue-800',
      Member: 'bg-[var(--secondary)] text-[var(--card-foreground)]',
    };

    return `${baseClasses} ${roleColors[role] || 'bg-[var(--secondary)] text-[var(--card-foreground)]'}`;
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
